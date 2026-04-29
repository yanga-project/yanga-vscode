import { YangaProjectModel } from './schema';

export interface YangaInfoResult {
    model?: YangaProjectModel;
    stderr: string;
    exitCode: number;
}

export interface YangaRunOptions {
    variant: string;
    platform: string;
    buildType?: string;
    target?: string;
    component?: string;
}

export interface IYangaRunner {
    /**
     * Executes `yanga info` to fetch the project model.
     * @param projectDir Optional path to the project directory.
     */
    info(projectDir?: string): Promise<YangaInfoResult>;

    /**
     * Executes `yanga run` to build or clean a variant/component.
     * @param options Build options.
     * @param projectDir Optional path to the project directory.
     * @param onOutput Callback for stdout/stderr chunks.
     */
    run(options: YangaRunOptions, projectDir?: string, onOutput?: (data: string) => void): Promise<number>;
}
