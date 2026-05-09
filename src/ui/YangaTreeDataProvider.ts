import * as vscode from 'vscode';
import { ProjectState } from '../model/ProjectState';

export type YangaTreeItemKind =
    | 'section-build'
    | 'section-components'
    | 'selector'
    | 'action'
    | 'placeholder';

export class YangaTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly kind: YangaTreeItemKind,
        public readonly contextValue?: string,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly description?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.command = command;
        this.iconPath = iconPath;
        this.description = description;
    }
}

/**
 * Sidebar tree mirrors the ygui layout: two flat sections, each with its own
 * dropdowns + Build/Clean actions. No component tree — components are picked
 * via a dropdown like variants are.
 */
export class YangaTreeDataProvider implements vscode.TreeDataProvider<YangaTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<YangaTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private placeholder: string | null = null;

    constructor(private readonly state: ProjectState) {}

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    public setPlaceholder(message: string | null): void {
        if (this.placeholder !== message) {
            this.placeholder = message;
            this.refresh();
        }
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
                new YangaTreeItem('VARIANT BUILD', vscode.TreeItemCollapsibleState.Expanded, 'section-build', 'yangaSection'),
                new YangaTreeItem('COMPONENT BUILD', vscode.TreeItemCollapsibleState.Expanded, 'section-components', 'yangaSection')
            ]);
        }

        switch (element.kind) {
            case 'section-build':
                return Promise.resolve(this.buildVariantSection());
            case 'section-components':
                return Promise.resolve(this.buildComponentSection());
            default:
                return Promise.resolve([]);
        }
    }

    private buildVariantSection(): YangaTreeItem[] {
        return [
            this.selector('Variant', 'yanga.selectVariant', this.state.activeVariant),
            this.selector('Platform', 'yanga.selectPlatform', this.state.activePlatform),
            this.selector('Build Type', 'yanga.selectBuildType', this.buildTypeDescription()),
            this.selector('Build Target', 'yanga.selectVariantBuildTarget', this.state.activeVariantBuildTarget),
            this.toggle('Pristine', 'yanga.togglePristine', this.state.activePristine),
            this.action('Build', 'yanga.buildVariant', 'play'),
            this.action('Clean', 'yanga.cleanVariant', 'trash')
        ];
    }

    private buildComponentSection(): YangaTreeItem[] {
        const visible = this.state.getVisibleComponents();
        if (visible.length === 0) {
            return [new YangaTreeItem('No components in scope', vscode.TreeItemCollapsibleState.None, 'placeholder')];
        }
        return [
            this.selector('Component', 'yanga.selectComponent', this.state.activeComponent),
            this.selector('Build Target', 'yanga.selectComponentBuildTarget', this.state.activeComponentBuildTarget),
            this.action('Build', 'yanga.buildComponent', 'play'),
            this.action('Clean', 'yanga.cleanComponent', 'trash')
        ];
    }

    private selector(label: string, command: string, value: string | null): YangaTreeItem {
        return new YangaTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'selector',
            'yangaSelector',
            { command, title: `Select ${label}` },
            undefined,
            value || 'None'
        );
    }

    private action(label: string, command: string, icon: string): YangaTreeItem {
        return new YangaTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'action',
            'yangaAction',
            { command, title: label },
            new vscode.ThemeIcon(icon)
        );
    }

    private toggle(label: string, command: string, value: boolean): YangaTreeItem {
        // Stateful row with click-to-toggle behavior. Mirrors the GUI's Pristine checkbox.
        return new YangaTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'selector',
            'yangaToggle',
            { command, title: `Toggle ${label}` },
            new vscode.ThemeIcon(value ? 'check' : 'circle-large-outline'),
            value ? 'on' : 'off'
        );
    }

    private buildTypeDescription(): string {
        const platform = this.state.model!.platforms.find(p => p.name === this.state.activePlatform);
        if (platform && platform.build_types.length === 0) {
            return '-';
        }
        return this.state.activeBuildType || 'None';
    }
}
