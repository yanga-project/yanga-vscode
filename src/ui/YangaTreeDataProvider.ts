import * as vscode from 'vscode';
import { ProjectState } from '../model/ProjectState';
import { ComponentFolder, buildComponentFolderTree } from '../model/folderTree';
import { YangaComponent } from '../yanga/schema';

export type ComponentsViewMode = 'tree' | 'flat';

export type YangaTreeItemKind =
    | 'section-build'
    | 'section-components'
    | 'selector'
    | 'action'
    | 'folder'
    | 'component'
    | 'placeholder';

export class YangaTreeItem extends vscode.TreeItem {
    public children: YangaTreeItem[] | undefined;

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly kind: YangaTreeItemKind,
        public readonly contextValue?: string,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        public readonly description?: string,
        public readonly resourceUri?: vscode.Uri
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.command = command;
        this.iconPath = iconPath;
        this.description = description;
        this.resourceUri = resourceUri;
    }
}

export class YangaTreeDataProvider implements vscode.TreeDataProvider<YangaTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<YangaTreeItem | undefined | void> = new vscode.EventEmitter<YangaTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<YangaTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private viewMode: ComponentsViewMode = 'tree';
    private placeholder: string | null = null;

    constructor(private readonly state: ProjectState, private readonly projectDir: string) {}

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public setPlaceholder(message: string | null): void {
        if (this.placeholder !== message) {
            this.placeholder = message;
            this.refresh();
        }
    }

    public setViewMode(mode: ComponentsViewMode): void {
        if (this.viewMode !== mode) {
            this.viewMode = mode;
            this.refresh();
        }
    }

    public getViewMode(): ComponentsViewMode {
        return this.viewMode;
    }

    getTreeItem(element: YangaTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: YangaTreeItem): Thenable<YangaTreeItem[]> {
        if (!this.state.model) {
            const message = this.placeholder ?? 'No project loaded';
            return Promise.resolve([new YangaTreeItem(message, vscode.TreeItemCollapsibleState.None, 'placeholder')]);
        }

        if (!element) {
            return Promise.resolve([
                new YangaTreeItem('BUILD SELECTION', vscode.TreeItemCollapsibleState.Expanded, 'section-build', 'yangaSection'),
                new YangaTreeItem(
                    `COMPONENTS (${this.state.activeVariant} × ${this.state.activePlatform})`,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'section-components',
                    'yangaSection'
                )
            ]);
        }

        switch (element.kind) {
            case 'section-build': {
                const platform = this.state.model.platforms.find(p => p.name === this.state.activePlatform);
                const buildTypeDescription = platform && platform.build_types.length === 0
                    ? '-'
                    : (this.state.activeBuildType || 'None');

                return Promise.resolve([
                    new YangaTreeItem('Variant', vscode.TreeItemCollapsibleState.None, 'selector', 'yangaSelector', {
                        command: 'yanga.selectVariant', title: 'Select Variant'
                    }, undefined, this.state.activeVariant || 'None'),

                    new YangaTreeItem('Platform', vscode.TreeItemCollapsibleState.None, 'selector', 'yangaSelector', {
                        command: 'yanga.selectPlatform', title: 'Select Platform'
                    }, undefined, this.state.activePlatform || 'None'),

                    new YangaTreeItem('Build Target', vscode.TreeItemCollapsibleState.None, 'selector', 'yangaSelector', {
                        command: 'yanga.selectBuildTarget', title: 'Select Build Target'
                    }, undefined, this.state.activeBuildTarget || 'None'),

                    new YangaTreeItem('Build Type', vscode.TreeItemCollapsibleState.None, 'selector', 'yangaSelector', {
                        command: 'yanga.selectBuildType', title: 'Select Build Type'
                    }, undefined, buildTypeDescription),

                    new YangaTreeItem('Build', vscode.TreeItemCollapsibleState.None, 'action', 'yangaAction', {
                        command: 'yanga.buildVariant', title: 'Build Variant'
                    }, new vscode.ThemeIcon('play')),

                    new YangaTreeItem('Clean', vscode.TreeItemCollapsibleState.None, 'action', 'yangaAction', {
                        command: 'yanga.cleanVariant', title: 'Clean Variant'
                    }, new vscode.ThemeIcon('trash'))
                ]);
            }

            case 'section-components': {
                const components = this.state.getVisibleComponents();
                if (components.length === 0) {
                    return Promise.resolve([new YangaTreeItem('No components in scope', vscode.TreeItemCollapsibleState.None, 'placeholder')]);
                }
                return Promise.resolve(this.viewMode === 'flat'
                    ? this.buildFlatComponents(components)
                    : this.buildComponentTree(components));
            }

            case 'folder':
                return Promise.resolve(element.children ?? []);

            default:
                return Promise.resolve([]);
        }
    }

    private buildFlatComponents(components: YangaComponent[]): YangaTreeItem[] {
        return [...components]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(comp => this.makeComponentItem(comp));
    }

    private buildComponentTree(components: YangaComponent[]): YangaTreeItem[] {
        return this.folderNodeToItems(buildComponentFolderTree(components));
    }

    private folderNodeToItems(node: ComponentFolder): YangaTreeItem[] {
        const items: YangaTreeItem[] = [];

        for (const folder of node.folders) {
            const folderItem = new YangaTreeItem(
                folder.name,
                vscode.TreeItemCollapsibleState.Collapsed,
                'folder',
                'yangaFolder',
                undefined,
                vscode.ThemeIcon.Folder,
                undefined,
                vscode.Uri.joinPath(vscode.Uri.file(this.projectDir), folder.path)
            );
            folderItem.id = `folder:${folder.path}`;
            folderItem.children = this.folderNodeToItems(folder);
            items.push(folderItem);
        }

        for (const comp of node.components) {
            items.push(this.makeComponentItem(comp));
        }

        return items;
    }

    private makeComponentItem(comp: YangaComponent): YangaTreeItem {
        const item = new YangaTreeItem(
            comp.name,
            vscode.TreeItemCollapsibleState.None,
            'component',
            'yangaComponent',
            undefined,
            new vscode.ThemeIcon('package'),
            undefined,
            vscode.Uri.joinPath(vscode.Uri.file(this.projectDir), comp.path)
        );
        item.id = `component:${comp.path}`;
        return item;
    }
}
