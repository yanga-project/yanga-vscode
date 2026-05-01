import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProjectState } from './model/ProjectState';
import { YangaTreeDataProvider } from './ui/YangaTreeDataProvider';
import { DiagnosticsManager } from './ui/DiagnosticsManager';
import { StatusBarManager } from './ui/StatusBarManager';
import { WatcherManager } from './ui/WatcherManager';
import { YangaCli } from './yanga/YangaCli';

let outputChannel: vscode.OutputChannel;

function expandPath(p: string): string {
    // The yanga executable path is passed through as a quoted shell argument, so
    // `~` and `${userHome}` need to be expanded here — the shell would leave
    // them literal inside quotes.
    if (p === '~' || p.startsWith('~/')) {
        return path.join(os.homedir(), p.slice(1));
    }
    return p.replace(/\$\{userHome\}/g, os.homedir());
}

function resolveExecutablePath(projectDir: string): string {
    const configured = vscode.workspace.getConfiguration('yanga').get<string>('executablePath', '').trim();
    if (configured) {
        return expandPath(configured);
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

    state.activeVariant = context.workspaceState.get<string | null>('yanga.activeVariant', null);
    state.activePlatform = context.workspaceState.get<string | null>('yanga.activePlatform', null);
    state.activeBuildType = context.workspaceState.get<string | null>('yanga.activeBuildType', null);
    state.activeVariantBuildTarget = context.workspaceState.get<string | null>('yanga.activeVariantBuildTarget', null);
    state.activeComponent = context.workspaceState.get<string | null>('yanga.activeComponent', null);
    state.activeComponentBuildTarget = context.workspaceState.get<string | null>('yanga.activeComponentBuildTarget', null);

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

    const treeProvider = new YangaTreeDataProvider(state);

    const treeView = vscode.window.createTreeView('yanga.projectTree', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    context.subscriptions.push(vscode.commands.registerCommand('yanga.refresh', async () => {
        await fetchAndUpdateModel(cli, state, treeProvider, context, diagnosticsManager, statusBar, watcherManager, projectDir);
    }));

    // React to settings changes without forcing a window reload. The executable
    // path is the only setting that needs live re-resolution today; treat any
    // change to it as "swap the path and refresh the model".
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async event => {
        if (!event.affectsConfiguration('yanga.executablePath')) {
            return;
        }
        const newPath = resolveExecutablePath(projectDir);
        cli.setExecutablePath(newPath);
        outputChannel.appendLine(`[Debug] yanga.executablePath changed; now using: ${newPath}`);
        if (projectDir) {
            await fetchAndUpdateModel(cli, state, treeProvider, context, diagnosticsManager, statusBar, watcherManager, projectDir);
        }
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
    const pickFromList = async (placeHolder: string, items: string[]): Promise<string | undefined> => {
        if (items.length === 0) {
            return undefined;
        }
        return vscode.window.showQuickPick(items, { placeHolder });
    };

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectVariant', async () => {
        if (!state.model) { return; }
        const selected = await pickFromList('Select Variant', state.model.variants.map(v => v.name));
        if (selected) {
            state.setVariant(selected);
            persistAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectPlatform', async () => {
        if (!state.model) { return; }
        const selected = await pickFromList('Select Platform', state.model.platforms.map(p => p.name));
        if (selected) {
            state.setPlatform(selected);
            persistAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectBuildType', async () => {
        if (!state.model || !state.activePlatform) { return; }
        const platform = state.model.platforms.find(p => p.name === state.activePlatform);
        const selected = await pickFromList('Select Build Type', platform?.build_types ?? []);
        if (selected) {
            state.setBuildType(selected);
            persistAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectVariantBuildTarget', async () => {
        if (!state.model || !state.activePlatform) { return; }
        const platform = state.model.platforms.find(p => p.name === state.activePlatform);
        const selected = await pickFromList('Select Variant Build Target', state.effectiveVariantTargets(platform));
        if (selected) {
            state.setVariantBuildTarget(selected);
            persistAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectComponentBuildTarget', async () => {
        if (!state.model || !state.activePlatform) { return; }
        const platform = state.model.platforms.find(p => p.name === state.activePlatform);
        const selected = await pickFromList('Select Component Build Target', state.effectiveComponentTargets(platform));
        if (selected) {
            state.setComponentBuildTarget(selected);
            persistAndRefresh(state, treeProvider, context, statusBar);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.selectComponent', async () => {
        if (!state.model) { return; }
        const selected = await pickFromList('Select Component', state.getVisibleComponents().map(c => c.name));
        if (selected) {
            state.setComponent(selected);
            persistAndRefresh(state, treeProvider, context, statusBar);
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
                target: target || undefined,
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
        await runYangaCommand('Build Variant', state.activeVariantBuildTarget || undefined);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.cleanVariant', async () => {
        await runYangaCommand('Clean Variant', 'clean');
    }));

    context.subscriptions.push(vscode.commands.registerCommand('yanga.buildComponent', async () => {
        if (!state.activeComponent) {
            vscode.window.showErrorMessage('No component selected.');
            return;
        }
        await runYangaCommand('Build Component', state.activeComponentBuildTarget || undefined, state.activeComponent);
    }));
}

function persistAndRefresh(state: ProjectState, treeProvider: YangaTreeDataProvider, context: vscode.ExtensionContext, statusBar: StatusBarManager) {
    context.workspaceState.update('yanga.activeVariant', state.activeVariant);
    context.workspaceState.update('yanga.activePlatform', state.activePlatform);
    context.workspaceState.update('yanga.activeBuildType', state.activeBuildType);
    context.workspaceState.update('yanga.activeVariantBuildTarget', state.activeVariantBuildTarget);
    context.workspaceState.update('yanga.activeComponent', state.activeComponent);
    context.workspaceState.update('yanga.activeComponentBuildTarget', state.activeComponentBuildTarget);
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
        persistAndRefresh(state, treeProvider, context, statusBar);
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
