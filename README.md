# Yanga for VS Code

A sidebar UI for Software Product Line (SPL) projects: pick a variant, pick a platform, browse the components in scope, and build without leaving the editor.

The extension is a thin client over a JSON project model produced by your build tool. The reference backend is [Yanga](https://github.com/cuinixam/yanga); any tool that emits the same `info` schema can plug in.

## Features

- **Single sidebar panel** with the build context up top (Variant, Platform, Build Target, Build Type) and the components in scope below.
- **One-click Build / Clean** as full-row actions in the panel, no hunting through context menus.
- **Status bar** shows the active variant/platform and a build progress indicator; click to switch variants or trigger a build from anywhere in the editor.
- **Component view modes**: flat list or tree-by-path with single-child folder collapse. Toggle from the panel's `…` menu.
- **Auto-refresh on config change**: the extension watches the files your build tool reports as configuration sources and re-fetches the project model when they change.
- **Diagnostics in the Problems panel** so SPL configuration errors surface where you'd expect.

## Requirements

- VS Code 1.116 or later.
- A build tool on your `PATH` (or in the workspace `.venv/bin/`) that exposes:
  - `yanga info`, emit the project model as JSON on stdout. See the [schema reference](https://github.com/yanga-project/yanga-core).
  - `yanga run --not-interactive --variant <V> --platform <P> [--build-type <T>] [--target <X>] [--component <C>]`, execute a build/clean with the selected scope.

If you're using Yanga, you already have both. If you're targeting another framework, point the extension at your binary via the configuration setting (see below).

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
4. Pick a variant and a platform from the BUILD SELECTION section.
5. Click **Build**.

Selections are remembered per workspace via `workspaceState`.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `yanga.executablePath` | `""` | Absolute path to the `yanga` binary. Leave empty to auto-detect. |

When `yanga.executablePath` is empty, the extension looks for, in order:

1. `${workspaceFolder}/.venv/bin/yanga` on macOS/Linux, or `${workspaceFolder}/.venv/Scripts/yanga.exe` on Windows.
2. `yanga` on the system `PATH`.

## Commands

| Command | What it does |
|---|---|
| `Yanga: Refresh` | Re-fetch the project model. Bound to the panel title-bar refresh icon. |
| `Yanga: Build Variant` | Run `yanga run` for the active variant/platform/build-type/build-target. |
| `Yanga: Clean Variant` | Same as Build, with `--target=clean`. |
| `Yanga: Build Component` | Build a single component within the active variant/platform. |
| `Yanga: Select Variant` / `Platform` / `Build Target` / `Build Type` | Quick-pick selectors for the BUILD SELECTION rows. |
| `Yanga: View Components as Tree` / `as Flat List` | Toggle the COMPONENTS section's layout. |

## Issues and feedback

Open an issue at [github.com/yanga-project/yanga-vscode/issues](https://github.com/yanga-project/yanga-vscode/issues).

## License

MIT, see [LICENSE](LICENSE).
