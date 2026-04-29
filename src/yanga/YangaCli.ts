import { exec, spawn, ExecException, ChildProcess } from 'child_process';
import { IYangaRunner, YangaInfoResult, YangaRunOptions } from './YangaRunner';

export type ExecFunction = (command: string, options: any, callback: (error: ExecException | null, stdout: string, stderr: string) => void) => void;
export type SpawnFunction = (command: string, args: string[], options: any) => ChildProcess;

export class YangaCli implements IYangaRunner {
    constructor(
        private readonly executablePath: string = 'yanga',
        private readonly execFn: ExecFunction = exec,
        private readonly spawnFn: SpawnFunction = spawn
    ) {}

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
                        result.model = JSON.parse(jsonStr);
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
