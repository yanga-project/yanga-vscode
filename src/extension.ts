import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectState } from './model/ProjectState';
import { ComponentsViewMode, YangaTreeDataProvider, YangaTreeItem } from './ui/YangaTreeDataProvider';
import { DiagnosticsManager } from './ui/DiagnosticsManager';
import { StatusBarManager } from './ui/StatusBarManager';
import { WatcherManager } from './ui/WatcherManager';
import { YangaCli } from './yanga/YangaCli';

let outputChannel: vscode.OutputChannel;

function resolveExecutablePath(projectDir: string): string {
    const configured = vscode.workspace.getConfiguration('yanga').get<string>('executablePath', '').trim();
    if (configured) {
        return configured;
    }
    if (projectDir) {
        const venvBinary = process.platform === 'win32'
            ? path.join(projectDir, '.venv', 'Scripts', 'yanga.exe')
            : path.join(projectDir, '.venv', 'bin', 'yanga');
        if (fs.existsSync(venvBinary)) {
            return venvBinary;
        }
    }
    return 'yanga';
}

export async function activate(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const projectDir = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';

    const executablePath = resolveExecutablePath(projectDir);
    const cli = new YangaCli(executablePath);
    const state = new ProjectState();

    outputChannel = vscode.window.createOutputChannel("Yanga");
    context.subscriptions.push(outputChannel);
    
    outputChannel.appendLine(`[Debug] Extension activated.`);
    outputChannel.appendLine(`[Debug] Workspace folders: ${workspaceFolders ? workspaceFolders.map(f => f.uri.fsPath).join(', ') : 'None'}`);
    outputChannel.appendLine(`[Debug] projectDir resolved to: ${projectDir}`);
    outputChannel.appendLine(`[Debug] executablePath resolved to: ${executablePath}`);

    // 1. Load saved selections from workspaceState
    state.activeVariant = context.workspaceState.get<string | null>('yanga.activeVariant', null);
    state.activePlatform = context.workspaceState.get<string | null>('yanga.activePlatform', null);
    state.activeBuildTarget = context.workspaceState.get<string | null>('yanga.activeBuildTarget', null);
    state.activeBuildType = context.workspaceState.get<string | null>('yanga.activeBuildType', null);

    const diagnosticsManager = new DiagnosticsManager();
    context.subscriptions.push({ dispose: () => diagnosticsManager.dispose() });

    const statusBar = new StatusBarManager(state);
    context.subscriptions.push({ dispose: () => statusBar.dispose() });

    let watcherManager: WatcherManager | undefined;
    if (projectDir) {
        watcherManager = new WatcherManager(projectDir, async () => {
            outputChannel.appendLine(`[Yanga] File change detected, refreshing project model...`);
            await fetchAndUpdateModel(cli, state, treeProvider, context, diagnosticsManager, statusBar, watcherManager, projectDir);
        });
        context.subscriptions.push({ dispose: () => watcherManager!.dispose() });
    }

    const treeProvider = new YangaTreeDataProvider(state, projectDir);
    const initialMode = context.workspaceState.get<ComponentsViewMode>('yanga.componentsView', 'tree');
    treeProvider.setViewMode(initialMode);
    await vscode.commands.executeCommand('setContext', 'yanga.componentsView', initialMode);

    const treeView = vscode.window.createTreeView('yanga.projectTree', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    const setComponentsView = async (mode: ComponentsViewMode) => {
        await context.workspaceState.update('yanga.componentsView', mode);
        await vscode.commands.executeCommand('setContext', 'yanga.componentsView', mode);
        treeProvider.setViewMode(mode);
    };
    context.subscriptions.push(vscode.commands.registerCommand('yanga.componentsViewAsTree', () => setComponentsView('tree')));
    context.subscriptions.push(vscode.commands.registerCommand('yanga.componentsViewAsFlat', () => setComponentsView('flat')));

    // Register refresh command
    context.subscriptions.push(vscode.commands.registerCommand('yanga.refresh', async () => {
        await fetchAndUpdateModel(cli, state, treeProvider, context, diagnosticsManager, statusBar, watcherManager, projectDir);
    }));

    // Kick off the initial fetch without blocking activation. VS Code expects
    // activate() to return quickly; a slow `yanga info` would otherwise stall
    // the editor. Errors surface through fetchAndUpdateModel's own UI paths.
    if (projectDir) {
        treeProvider.setPlaceholder('Loading project model…');
        outputChannel.appendLine(`[Debug] Scheduling initial fetchAndUpdateModel...`);
        void fetchAndUpdateModel(cli, state, treeProvider, context, diagnosticsManager, statusBar, watcherManager, projectDir);
    } else {
        treeProvider.setPlaceholder('Open a folder to use Yanga');
    }

    // SELECTION COMMANDS
    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectVariant', async () => {
        if (!state.model) {return;}
        const variants = state.model.variants.map(v => v.name);
        const selected = await vscode.window.showQuickPick(variants, { placeHolder: 'Select Variant' });
        if (selected) {
            state.setVariant(selected);
            updateStateAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectPlatform', async () => {
        if (!state.model) {return;}
        const platforms = state.model.platforms.map(p => p.name);
        const selected = await vscode.window.showQuickPick(platforms, { placeHolder: 'Select Platform' });
        if (selected) {
            state.setPlatform(selected);
            updateStateAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectBuildTarget', async () => {
        if (!state.model || !state.activePlatform) {return;}
        const p = state.model.platforms.find(x => x.name === state.activePlatform);
        if (!p || p.build_targets.length === 0) {return;}
        
        const selected = await vscode.window.showQuickPick(p.build_targets, { placeHolder: 'Select Build Target' });
        if (selected) {
            state.setBuildTarget(selected);
            updateStateAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectBuildType', async () => {
        if (!state.model || !state.activePlatform) {return;}
        const p = state.model.platforms.find(x => x.name === state.activePlatform);
        if (!p || p.build_types.length === 0) {return;}
        
        const selected = await vscode.window.showQuickPick(p.build_types, { placeHolder: 'Select Build Type' });
        if (selected) {
            state.setBuildType(selected);
            updateStateAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    // EXECUTION COMMANDS
    let buildInFlight = false;
    const runYangaCommand = async (actionLabel: string, target?: string, component?: string) => {
        if (!state.activeVariant || !state.activePlatform) {
            vscode.window.showErrorMessage('Variant and Platform must be selected before building.');
            return;
        }
        if (buildInFlight) {
            vscode.window.showInformationMessage('Yanga: a build is already running. Wait for it to finish or open the output to follow along.');
            return;
        }

        buildInFlight = true;
        try {
            outputChannel.show(true);
            outputChannel.appendLine(`\n[Yanga] ${actionLabel} ${state.activeVariant} / ${state.activePlatform}${component ? ' (component: ' + component + ')' : ''}...`);

            statusBar.showBuildStarted();
            const exitCode = await cli.run({
                variant: state.activeVariant,
                platform: state.activePlatform,
                buildType: state.activeBuildType || undefined,
                target: target || state.activeBuildTarget || undefined,
                component: component
            }, projectDir, (data) => outputChannel.append(data));
            statusBar.showBuildResult(exitCode === 0);

            if (exitCode !== 0) {
                const choice = await vscode.window.showErrorMessage(
                    `Yanga: ${actionLabel} failed (exit ${exitCode})`,
                    'Show Output'
                );
                if (choice === 'Show Output') {
                    outputChannel.show(true);
                }
            }
        } finally {
            buildInFlight = false;
        }
    };

    context.subscriptions.push(vscode.commands.registerCommand('yanga.buildVariant', async () => {
        await runYangaCommand('Build Variant');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.cleanVariant', async () => {
        await runYangaCommand('Clean Variant', 'clean');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.buildComponent', async (treeItem?: YangaTreeItem) => {
        if (treeItem && treeItem.label) {
            await runYangaCommand('Build Component', undefined, treeItem.label.toString());
        }
    }));
}

function updateStateAndRefresh(state: ProjectState, treeProvider: YangaTreeDataProvider, context: vscode.ExtensionContext, statusBar: StatusBarManager) {
    context.workspaceState.update('yanga.activeVariant', state.activeVariant);
    context.workspaceState.update('yanga.activePlatform', state.activePlatform);
    context.workspaceState.update('yanga.activeBuildTarget', state.activeBuildTarget);
    context.workspaceState.update('yanga.activeBuildType', state.activeBuildType);
    treeProvider.refresh();
    statusBar.update();
}

async function fetchAndUpdateModel(
    cli: YangaCli,
    state: ProjectState,
    treeProvider: YangaTreeDataProvider,
    context: vscode.ExtensionContext,
    diagnosticsManager: DiagnosticsManager,
    statusBar: StatusBarManager,
    watcherManager: WatcherManager | undefined,
    projectDir: string
) {
    const result = await cli.info(projectDir);
    if (result.exitCode === 0 && result.model) {
        state.updateModel(result.model);
        treeProvider.setPlaceholder(null);
        updateStateAndRefresh(state, treeProvider, context, statusBar);
        diagnosticsManager.updateDiagnostics(projectDir, result.model.diagnostics);
        if (watcherManager) {
            watcherManager.updateWatchers(result.model);
        }
    } else {
        treeProvider.setPlaceholder('Failed to load project, see the Yanga output for details');
        vscode.window.showErrorMessage(`Yanga info failed: ${result.stderr}`);
        if (outputChannel) {
            outputChannel.appendLine(`[Yanga info error]\n${result.stderr}`);
            outputChannel.show(true);
        }
    }
}

export function deactivate() {}

