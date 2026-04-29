export interface YangaDiagnostic {
    severity: "error" | "warning" | "info";
    message: string;
    file?: string;
    line?: number;
    column?: number;
    code?: string;
}

export interface YangaPlatform {
    name: string;
    build_types: string[];
    build_targets: string[];
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

export interface YangaProjectModel {
    schema_version: number;
    project_dir: string;
    config_files: string[];
    watch_patterns: string[];
    ignore_patterns: string[];
    platforms: YangaPlatform[];
    variants: YangaVariant[];
    components: YangaComponent[];
    diagnostics: YangaDiagnostic[];
}
