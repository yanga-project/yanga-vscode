/**
 * Pure helpers for building the deduplicated, glob-correct pattern list that
 * WatcherManager hands to vscode.RelativePattern. Kept separate from
 * WatcherManager so they can be unit-tested without the VS Code runtime.
 */

/**
 * config_files in the schema are literal paths, but vscode.FileSystemWatcher
 * interprets its pattern argument as a glob. Escape every glob metacharacter
 * so a config file named `foo[bar].yaml` is matched literally rather than as
 * a character class.
 */
export function escapeGlob(literal: string): string {
    return literal.replace(/[?*+@!()[\]{}]/g, '\\$&');
}

/**
 * Combine literal `config_files` (escaped) with `watch_patterns` (already
 * globs by design) into the deduplicated, sorted list of patterns to watch.
 * Returning a stable order makes it easy to detect changes via array equality.
 */
export function buildWatcherPatterns(configFiles: string[], watchPatterns: string[]): string[] {
    const escaped = configFiles.map(escapeGlob);
    return [...new Set([...escaped, ...watchPatterns])].sort();
}

export function patternListsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) { return false; }
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) { return false; }
    }
    return true;
}
