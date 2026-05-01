# AGENTS.md

This file provides guidance to coding agents working in this repository.

## Commands

- `npm run watch` — esbuild + tsc-noEmit watchers in parallel; the dev loop while editing extension code.
- `npm run compile` — type-check, lint, and produce `dist/extension.js` (dev bundle).
- `npm run package` — same as compile but minified, no sourcemaps; this is what `vscode:prepublish` runs.
- `npm run check-types` — `tsc --noEmit` only.
- `npm run lint` — ESLint over `src/`.
- `npm test` — runs unit tests then integration tests. The `pretest` hook compiles both bundles first.
- `npm run test:unit` — Mocha against `out/test/unit/**/*.test.js`. **Requires `npm run compile-tests` first** if you didn't go through `npm test`.
- `npm run test:integration` — `@vscode/test-cli`, downloads VS Code (~200 MB on first run, then cached in `.vscode-test/`) and runs `out/test/suite/**/*.test.js` inside a real Extension Host. **Also requires `compile-tests`** when invoked directly.
- Run a single unit test: `npx mocha out/test/unit/<file>.test.js` (after compiling).

## Release / commit conventions

- Releases are automated by `semantic-release` from `main` (see `.releaserc.json`): version bump → `CHANGELOG.md` → `vsce package` → GitHub release with `.vsix` asset → release commit. Don't bump the version manually.
- Commit messages must be Conventional Commits (`commitlint` + Husky `commit-msg`). `feat:` / `fix:` drive minor/patch bumps; `BREAKING CHANGE:` drives major. Commits containing `[skip ci]` (the release commit) are exempt.
- The extension is **not on the Marketplace**. Distribution is GitHub Release `.vsix` only.

## Architecture

The extension is a thin client over an external CLI. It never reads project files directly — it shells out to `yanga` (or whatever `yanga.executablePath` points at) and renders what comes back. Understanding two contracts is key:

### 1. The CLI contract (defined in [src/yanga/schema.ts](src/yanga/schema.ts), implemented in [src/yanga/YangaCli.ts](src/yanga/YangaCli.ts))

- `yanga info --project-dir <DIR>` → JSON project model on stdout. Parser tolerates leading log lines by extracting from first `{` to last `}`.
- `yanga run --not-interactive --variant V --platform P [--build-type T] [--target X] [--component C] --project-dir DIR` → streamed build output, exit code 0/non-zero is the only signal.
- README.md "How it works" is the canonical reference for the wire format and arg flow — keep it in sync if you change either.

### 2. Schema versioning (handled in `normalizeModel` at the bottom of [src/yanga/YangaCli.ts](src/yanga/YangaCli.ts))

- `schema_version` is `"major.minor"` string. Extension targets `1.x`. Major bumps are breaking and must be handled in lockstep.
- Legacy 1.0 payloads are normalized on the way in: `schema_version: 1` (number) → `"1.0"`, and flat `build_targets: string[]` → `{generic: [...], variant: [], component: []}`. **The rest of the codebase always sees the v1.1 shape** — don't add 1.0 branches downstream.
- `build_targets` is *scoped*: effective set per scope = `generic ∪ scope-specific`, deduped, order-preserving. See `ProjectState.effectiveVariantTargets` / `effectiveComponentTargets`.

### Module layout

- [src/extension.ts](src/extension.ts) — `activate()`. Wires everything: resolves the executable path, constructs `YangaCli` + `ProjectState`, hydrates state from `workspaceState`, registers commands, schedules the initial `yanga info` (non-blocking — never `await` it in `activate`, see comment at line 105–107). All command handlers and the `runYangaCommand` build-orchestration helper live here.
- [src/yanga/](src/yanga/) — CLI boundary. `YangaCli` is the only thing that touches `child_process`. `IYangaRunner` exists so tests can substitute fakes.
- [src/model/ProjectState.ts](src/model/ProjectState.ts) — the in-memory model + active selections. `validateSelections()` is the authoritative reconciliation: any time the model or a selection changes, invalid selections fall back to the alphabetically-first valid value. The "visible components for current variant/platform" rule is here too: union of `variant.components`, `variant.platform_components[platform]`, and `platform.components`.
- [src/ui/](src/ui/) — VS Code adapters: `YangaTreeDataProvider` (sidebar), `StatusBarManager`, `DiagnosticsManager` (Problems panel from `model.diagnostics`), `WatcherManager` (filesystem watchers).
- [src/ui/watcherPatterns.ts](src/ui/watcherPatterns.ts) — pure helpers extracted from `WatcherManager` so they're unit-testable without the `vscode` runtime. Note `escapeGlob`: `config_files` are literal paths, but `FileSystemWatcher` interprets globs, so metacharacters must be escaped.

### State and persistence

- `ProjectState` selections (variant, platform, build type, two build targets, component) are persisted via `context.workspaceState` keyed `yanga.activeXxx`. Hydration happens at the top of `activate()`; persistence happens through `persistAndRefresh` whenever a selection changes or the model reloads.
- The settings observer in `activate()` only listens for `yanga.executablePath`; it swaps the path on the existing `YangaCli` and re-fetches. No window reload.

### Auto-refresh flow

`fetchAndUpdateModel` → on success, `WatcherManager.updateWatchers(model)` rebuilds the watcher set from `config_files ∪ watch_patterns`. Filesystem events are filtered through `ignore_patterns` (minimatch with `dot: true`) and debounced 500 ms before re-firing `fetchAndUpdateModel`. Any new field that should drive watcher behavior must flow through `buildWatcherPatterns`.

## Testing

- **Unit tests** ([src/test/unit/](src/test/unit/)) run plain Mocha (`tdd` UI, see `.mocharc.json`). They must not import `vscode` — keep VS Code–dependent code behind interfaces (`IYangaRunner`) or in `src/ui/`.
- **Integration tests** ([src/test/suite/](src/test/suite/)) run inside a real Extension Host via `@vscode/test-cli` (config: [.vscode-test.mjs](.vscode-test.mjs)). Use these for anything that needs the real `vscode` API (command registration, tree views, etc.).
- After editing tests or sources, integration tests need a recompile: the Extension Host loads from `out/`, not from sources. `npm test` does this for you; `npm run test:integration` alone does not.
