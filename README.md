# Yanga for VS Code

A sidebar UI for Software Product Line (SPL) projects: pick a variant, pick a platform, pick a component, and build without leaving the editor.

The extension is a thin client over a JSON project model produced by your build tool. The reference backend is [Yanga](https://github.com/cuinixam/yanga); any tool that conforms to the contract described in [How it works](#how-it-works) can plug in.

## Features

- **Sidebar panel** with two flat sections — **VARIANT BUILD** (Variant / Platform / Build Type / Build Target / Build / Clean) and **COMPONENT BUILD** (Component / Build Target / Build) — each scoping its own build target.
- **One-click Build / Clean** as full-row actions in the panel, no hunting through context menus.
- **Status bar** shows the active variant/platform and a build progress indicator; click to switch variants or trigger a build from anywhere in the editor.
- **Auto-refresh on config change**: the extension watches the files your build tool reports as configuration sources and re-fetches the project model when they change.
- **Diagnostics in the Problems panel** so SPL configuration errors surface where you'd expect.
- **Live settings**: changing `yanga.executablePath` takes effect immediately without reloading the window.

## How it works

The extension never reads your project files directly. It talks to a single command-line tool over two subcommands and a JSON wire format. Anything that implements that contract works as a backend.

### The tool contract

The configured executable (default: `yanga`) must support:

#### `yanga info [--project-dir <DIR>]`

Reads the project on disk and emits the project model as JSON on stdout. The extension parses everything between the first `{` and the last `}`, so leading log lines are tolerated.

#### `yanga run --not-interactive --variant <V> --platform <P> [--build-type <T>] [--target <X>] [--component <C>] [--project-dir <DIR>]`

Executes a build (or clean) with the chosen scope. Output goes to stdout/stderr and is streamed into the **Yanga** output channel. The extension only inspects the process exit code (`0` = success).

Argument flow from the UI:

| UI action | `yanga run` arguments |
|---|---|
| Build (variant section) | `--variant V --platform P [--build-type T] [--target <selected variant build target>]` |
| Clean (variant section) | `--variant V --platform P [--build-type T] --target clean` |
| Build (component section) | `--variant V --platform P [--build-type T] --component C [--target <selected component build target>]` |

Component-scope `clean` is intentionally not exposed — the reference backend does not generate per-component clean targets.

### The project model

`yanga info` returns a JSON object with this shape (excerpted; see `src/yanga/schema.ts` for the canonical TypeScript type):

```jsonc
{
  "schema_version": "1.1",
  "project_dir": "/abs/path/to/project",
  "config_files": ["yanga.yaml", "platforms/gtest/yanga.yaml", "..."],
  "watch_patterns": ["**/yanga.yaml"],
  "ignore_patterns": [".git/**", "build/**", "..."],
  "platforms": [
    {
      "name": "gtest",
      "build_types": ["Debug", "Release"],
      "build_targets": {
        "generic":   ["report", "coverage", "lint"],
        "variant":   ["all"],
        "component": []
      },
      "components": ["mock_lib"]
    }
  ],
  "variants": [
    {
      "name": "Disco",
      "components": ["app", "common"],
      "platform_components": { "gtest": ["disco_test_helpers"] }
    }
  ],
  "components": [
    { "name": "app", "path": "src/app" }
  ],
  "diagnostics": [
    { "severity": "warning", "message": "...", "code": "yanga.unknown_component", "file": "yanga.yaml" }
  ]
}
```

Notable fields:

- **`schema_version`** is a `"major.minor"` string. Major bumps are breaking; minor bumps are additive (new fields, new enum values).
- **`platforms[].build_targets`** is **scoped**: `generic` applies to both scopes, `variant` is variant-only, `component` is component-only. The extension computes the effective set per scope as `generic ∪ scope-specific`, deduplicated and order-preserving.
- **`watch_patterns`** and **`ignore_patterns`** are globs (relative to `project_dir`). The extension creates filesystem watchers from the union of `watch_patterns` and `config_files`, so changes to any of them trigger a re-fetch.
- **`diagnostics`** populate VS Code's Problems panel. Items with `severity: "error"` flip the `yanga info` exit code to non-zero; warnings do not.
- **Effective component list** for a `(variant, platform)` pair is the union of `variants[v].components`, `variants[v].platform_components[p]`, and `platforms[p].components`.

### Schema version handling

The extension targets schema `1.x`. It is **forward-compatible** with the legacy `1.0` shape:

| Legacy (1.0) | Current (1.1) | Normalized to |
|---|---|---|
| `"schema_version": 1` (number) | `"schema_version": "1.1"` (string) | `"1.0"` |
| `"build_targets": ["a", "b"]` (flat array) | `"build_targets": {"generic": [...], "variant": [...], "component": [...]}` | `{"generic": ["a", "b"], "variant": [], "component": []}` |

Normalization happens in `YangaCli.info()` so the rest of the extension always sees the v1.1 shape.

If a future yanga release bumps the major version (`2.x`), the extension will surface that as an error rather than silently misinterpret unknown fields. To support a major bump, the extension must be updated in lockstep.

### Auto-refresh

When the project model is loaded, the extension installs filesystem watchers based on the model's `watch_patterns` and `config_files`. Any change to those files fires a re-fetch of `yanga info` and refreshes the sidebar. No manual refresh needed for ordinary configuration edits — though the title-bar refresh button is there if you want it.

### State persistence

The active selections (variant, platform, build type, variant build target, component, component build target) are persisted in the workspace via VS Code's `workspaceState`, so the panel comes back the way you left it next time you open the workspace.

## Requirements

- VS Code 1.116 or later.
- A build tool on your `PATH` (or in the workspace `.venv/bin/`) that implements the [tool contract](#the-tool-contract). If you're using Yanga, you already have both subcommands. If you're targeting another framework, point the extension at your binary via `yanga.executablePath`.

## Install

This extension is **not published to the Visual Studio Marketplace or Open VSX**. Publishing to the Marketplace requires an Azure DevOps organization, which in turn requires an Azure subscription tied to a payment method that the Azure signup flow refused to accept, without explanation, for the maintainer. Rather than spend more time fighting that flow, releases are distributed as `.vsix` files attached to [GitHub Releases](https://github.com/yanga-project/yanga-vscode/releases).

To install:

1. Download the latest `yanga-vscode-<version>.vsix` from the [Releases page](https://github.com/yanga-project/yanga-vscode/releases).
2. In VS Code, open the Extensions view, click the `…` menu, choose **Install from VSIX…**, and select the downloaded file.
   - Or from the command line: `code --install-extension yanga-vscode-<version>.vsix`.
3. Reload the window if prompted.

VS Code does not auto-update extensions installed from a VSIX, so re-run the steps above when a new release is published. Watch the repo on GitHub to get a notification.

## Getting started

1. Install the extension (see above).
2. Open a workspace containing a Yanga (or compatible) project.
3. Click the Yanga icon in the activity bar.
4. In the **VARIANT BUILD** section, pick Variant, Platform, Build Type, and Build Target. Click **Build**.
5. To build a single component, scroll to the **COMPONENT BUILD** section, pick a Component and a Build Target, and click **Build**.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `yanga.executablePath` | `""` | Path to the `yanga` binary. Supports `~` and `${userHome}` expansion. Changes apply immediately — no window reload required. |

When `yanga.executablePath` is empty, the extension looks for, in order:

1. `${workspaceFolder}/.venv/bin/yanga` on macOS/Linux, or `${workspaceFolder}/.venv/Scripts/yanga.exe` on Windows.
2. `yanga` on the system `PATH`.

## Commands

| Command | What it does |
|---|---|
| `Yanga: Refresh` | Re-fetch the project model. Bound to the panel title-bar refresh icon. |
| `Yanga: Build Variant` | Run `yanga run` for the active variant/platform/build-type, with `--target` set to the active *variant* build target. |
| `Yanga: Clean Variant` | Same as Build Variant, with `--target=clean`. |
| `Yanga: Build Component` | Build the active component within the active variant/platform, with `--target` set to the active *component* build target. |
| `Yanga: Select Variant` / `Platform` / `Build Type` | Quick-pick selectors for the variant section. |
| `Yanga: Select Variant Build Target` | Quick-pick from the variant-scope effective targets (`generic ∪ variant`). |
| `Yanga: Select Component` | Quick-pick from the components in scope for the active variant/platform. |
| `Yanga: Select Component Build Target` | Quick-pick from the component-scope effective targets (`generic ∪ component`). |

## Issues and feedback

Open an issue at [github.com/yanga-project/yanga-vscode/issues](https://github.com/yanga-project/yanga-vscode/issues).

## License

MIT, see [LICENSE](LICENSE).
