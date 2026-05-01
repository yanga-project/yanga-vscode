export interface YangaDiagnostic {
    severity: "error" | "warning" | "info";
    message: string;
    file?: string;
    line?: number;
    column?: number;
    code?: string;
}

/**
 * Scoped build targets for a platform (yanga schema 1.1+).
 * `generic` applies to both variant and component scopes; `variant` and
 * `component` are scope-only. Effective set per scope = generic + scope-specific,
 * deduplicated and order-preserving.
 */
export interface YangaBuildTargets {
    generic: string[];
    variant: string[];
    component: string[];
}

export interface YangaPlatform {
    name: string;
    build_types: string[];
    build_targets: YangaBuildTargets;
    components: string[];
}

export interface YangaVariant {
    name: string;
    components: string[];
    platform_components: Record<string, string[]>;
}

export interface YangaComponent {
    name: string;
    path: string;
}

/**
 * `schema_version` is a "major.minor" string. Major bumps are breaking;
 * minor bumps are additive. The extension targets `1.x`.
 */
export interface YangaProjectModel {
    schema_version: string;
    project_dir: string;
    config_files: string[];
    watch_patterns: string[];
    ignore_patterns: string[];
    platforms: YangaPlatform[];
    variants: YangaVariant[];
    components: YangaComponent[];
    diagnostics: YangaDiagnostic[];
}
