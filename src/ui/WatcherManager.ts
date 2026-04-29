import * as vscode from 'vscode';
import { YangaProjectModel } from '../yanga/schema';
import { minimatch } from 'minimatch';
import { buildWatcherPatterns, patternListsEqual } from './watcherPatterns';

export class WatcherManager {
    private watchers: vscode.FileSystemWatcher[] = [];
    private debounceTimeout: NodeJS.Timeout | null = null;
    private currentPatterns: string[] = [];

    constructor(
        private readonly projectDir: string,
        private readonly onFilesChanged: () => void
    ) {}

    public updateWatchers(model: YangaProjectModel) {
        const nextPatterns = buildWatcherPatterns(model.config_files, model.watch_patterns);
        if (patternListsEqual(nextPatterns, this.currentPatterns)) {
            return;
        }

        this.disposeWatchers();
        this.currentPatterns = nextPatterns;

        for (const pattern of nextPatterns) {
            const relativePattern = new vscode.RelativePattern(this.projectDir, pattern);
            const watcher = vscode.workspace.createFileSystemWatcher(relativePattern);

            watcher.onDidChange(uri => this.handleFileEvent(uri, model.ignore_patterns));
            watcher.onDidCreate(uri => this.handleFileEvent(uri, model.ignore_patterns));
            watcher.onDidDelete(uri => this.handleFileEvent(uri, model.ignore_patterns));

            this.watchers.push(watcher);
        }
    }

    private handleFileEvent(uri: vscode.Uri, ignorePatterns: string[]) {
        const relativePath = vscode.workspace.asRelativePath(uri, false);

        for (const ignore of ignorePatterns) {
            if (minimatch(relativePath, ignore, { dot: true })) {
                return;
            }
        }

        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        this.debounceTimeout = setTimeout(() => {
            this.onFilesChanged();
        }, 500);
    }

    public dispose() {
        this.disposeWatchers();
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
    }

    private disposeWatchers() {
        for (const watcher of this.watchers) {
            watcher.dispose();
        }
        this.watchers = [];
    }
}
