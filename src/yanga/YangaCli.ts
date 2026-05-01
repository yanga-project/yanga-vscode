import { exec, spawn, ExecException, ChildProcess } from 'child_process';
import { IYangaRunner, YangaInfoResult, YangaRunOptions } from './YangaRunner';
import { YangaProjectModel } from './schema';

export type ExecFunction = (command: string, options: any, callback: (error: ExecException | null, stdout: string, stderr: string) => void) => void;
export type SpawnFunction = (command: string, args: string[], options: any) => ChildProcess;

export class YangaCli implements IYangaRunner {
    constructor(
        private executablePath: string = 'yanga',
        private readonly execFn: ExecFunction = exec,
        private readonly spawnFn: SpawnFunction = spawn
    ) {}

    public setExecutablePath(path: string): void {
        this.executablePath = path;
    }

    public async info(projectDir?: string): Promise<YangaInfoResult> {
        return new Promise((resolve) => {
            const args = ['info'];
            if (projectDir) {
                args.push('--project-dir', projectDir);
            }

            this.execFn(`"${this.executablePath}" ${args.join(' ')}`, { cwd: projectDir, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                const result: YangaInfoResult = {
                    exitCode: error?.code ?? 0,
                    stderr: stderr || ''
                };

                try {
                    const jsonStart = stdout.indexOf('{');
                    const jsonEnd = stdout.lastIndexOf('}');
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
                        result.model = normalizeModel(JSON.parse(jsonStr));
                    } else if (stdout.trim()) {
                        throw new Error("No JSON object found in output");
                    }
                } catch (e) {
                    result.stderr += `\nFailed to parse JSON: ${(e as Error).message}\nRaw stdout:\n${stdout}`;
                    result.exitCode = result.exitCode === 0 ? 1 : result.exitCode;
                }

                resolve(result);
            });
        });
    }

    public run(options: YangaRunOptions, projectDir?: string, onOutput?: (data: string) => void): Promise<number> {
        return new Promise((resolve) => {
            const args = [
                'run',
                '--not-interactive',
                '--variant', options.variant,
                '--platform', options.platform
            ];

            if (options.buildType) {
                args.push('--build-type', options.buildType);
            }
            if (options.target) {
                args.push('--target', options.target);
            }
            if (options.component) {
                args.push('--component', options.component);
            }
            if (projectDir) {
                args.push('--project-dir', projectDir);
            }

            const child = this.spawnFn(this.executablePath, args, { 
                cwd: projectDir, 
                shell: true,
                env: process.env
            });

            if (onOutput) {
                const fullCommand = `${this.executablePath} ${args.join(' ')}`;
                onOutput(`> Executing: ${fullCommand}\n> Working Directory: ${projectDir}\n\n`);
                child.stdout?.on('data', (data) => onOutput(data.toString()));
                child.stderr?.on('data', (data) => onOutput(data.toString()));
            }

            child.on('close', (code) => {
                resolve(code ?? 1);
            });
            child.on('error', (err) => {
                if (onOutput) {
                    onOutput(`Error spawning yanga: ${err.message}\n`);
                }
                resolve(1);
            });
        });
    }
}

/**
 * Bring legacy `yanga info` payloads (schema 1.0: number version, flat-array
 * build_targets) onto the v1.1 shape so the rest of the extension can
 * uniformly read structured targets and a string version. The extension stays
 * forward-compatible with the older yanga release this way.
 */
function normalizeModel(raw: any): YangaProjectModel {
    if (typeof raw.schema_version === 'number') {
        raw.schema_version = raw.schema_version === 1 ? '1.0' : String(raw.schema_version);
    }
    for (const p of raw.platforms ?? []) {
        if (Array.isArray(p.build_targets)) {
            // Pre-1.1: a flat list applied to both scopes; map to `generic`.
            p.build_targets = { generic: p.build_targets, variant: [], component: [] };
        } else if (p.build_targets === null || p.build_targets === undefined || typeof p.build_targets !== 'object') {
            p.build_targets = { generic: [], variant: [], component: [] };
        } else {
            p.build_targets.generic = p.build_targets.generic ?? [];
            p.build_targets.variant = p.build_targets.variant ?? [];
            p.build_targets.component = p.build_targets.component ?? [];
        }
    }
    return raw as YangaProjectModel;
}
