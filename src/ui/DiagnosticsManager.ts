import * as vscode from 'vscode';
import { YangaDiagnostic } from '../yanga/schema';

export class DiagnosticsManager {
    private collection: vscode.DiagnosticCollection;

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('yanga');
    }

    public updateDiagnostics(projectDir: string, diagnostics: YangaDiagnostic[]) {
        this.collection.clear();

        const projectUri = vscode.Uri.file(projectDir);
        const byFile = new Map<string, { uri: vscode.Uri; diags: vscode.Diagnostic[] }>();

        for (const diag of diagnostics) {
            const severity = this.mapSeverity(diag.severity);
            const line = diag.line !== undefined ? Math.max(0, diag.line - 1) : 0;
            const column = diag.column !== undefined ? Math.max(0, diag.column - 1) : 0;

            const range = new vscode.Range(line, column, line, column);
            const vscodeDiag = new vscode.Diagnostic(range, diag.message, severity);
            if (diag.code) {
                vscodeDiag.code = diag.code;
            }

            const fileUri = diag.file
                ? vscode.Uri.joinPath(projectUri, diag.file)
                : projectUri;

            const key = fileUri.toString();
            let entry = byFile.get(key);
            if (!entry) {
                entry = { uri: fileUri, diags: [] };
                byFile.set(key, entry);
            }
            entry.diags.push(vscodeDiag);
        }

        for (const { uri, diags } of byFile.values()) {
            this.collection.set(uri, diags);
        }
    }

    public dispose() {
        this.collection.dispose();
    }

    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity.toLowerCase()) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            default: return vscode.DiagnosticSeverity.Error;
        }
    }
}
