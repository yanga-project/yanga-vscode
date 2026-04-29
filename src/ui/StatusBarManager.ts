import * as vscode from 'vscode';
import { ProjectState } from '../model/ProjectState';

export class StatusBarManager {
    private readonly contextItem: vscode.StatusBarItem;
    private readonly buildItem: vscode.StatusBarItem;
    private readonly progressItem: vscode.StatusBarItem;
    private clearProgressTimer: NodeJS.Timeout | undefined;

    constructor(private readonly state: ProjectState) {
        this.contextItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.contextItem.command = 'yanga.selectVariant';
        this.contextItem.tooltip = 'Yanga: pick variant';

        this.buildItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.buildItem.command = 'yanga.buildVariant';
        this.buildItem.text = '$(play)';
        this.buildItem.tooltip = 'Yanga: build active selection';

        this.progressItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    }

    public update(): void {
        const variant = this.state.activeVariant ?? 'no variant';
        const platform = this.state.activePlatform ?? 'no platform';
        this.contextItem.text = `$(tools) ${variant} | ${platform}`;
        this.contextItem.show();
        this.buildItem.show();
    }

    public showBuildStarted(): void {
        if (this.clearProgressTimer) {
            clearTimeout(this.clearProgressTimer);
            this.clearProgressTimer = undefined;
        }
        const v = this.state.activeVariant ?? '?';
        const p = this.state.activePlatform ?? '?';
        this.progressItem.text = `$(sync~spin) Yanga: building ${v}/${p}`;
        this.progressItem.tooltip = undefined;
        this.progressItem.show();
    }

    public showBuildResult(success: boolean): void {
        this.progressItem.text = success ? '$(check) Yanga: build OK' : '$(error) Yanga: build failed';
        this.progressItem.show();
        this.clearProgressTimer = setTimeout(() => {
            this.progressItem.hide();
            this.clearProgressTimer = undefined;
        }, 5000);
    }

    public dispose(): void {
        if (this.clearProgressTimer) {
            clearTimeout(this.clearProgressTimer);
        }
        this.contextItem.dispose();
        this.buildItem.dispose();
        this.progressItem.dispose();
    }
}
