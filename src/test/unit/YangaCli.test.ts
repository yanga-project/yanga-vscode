import * as assert from 'assert';
import { EventEmitter } from 'events';
import { YangaCli, ExecFunction, SpawnFunction } from '../../yanga/YangaCli';

function makeMockSpawn(): { mockSpawn: SpawnFunction; capturedArgs: string[][] } {
    const capturedArgs: string[][] = [];
    const mockSpawn: SpawnFunction = (_command, args) => {
        capturedArgs.push([...args]);
        const child: any = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        // Simulate immediate clean exit so cli.run() resolves.
        process.nextTick(() => child.emit('close', 0));
        return child;
    };
    return { mockSpawn, capturedArgs };
}

suite('YangaCli Test Suite', () => {
    test('info handles valid v1.1 json', async () => {
        const mockExec: ExecFunction = (cmd, opts, cb) => {
            cb(null, JSON.stringify({
                schema_version: '1.1',
                project_dir: '/x',
                config_files: [],
                watch_patterns: [],
                ignore_patterns: [],
                platforms: [{
                    name: 'gtest',
                    build_types: [],
                    build_targets: { generic: ['report'], variant: ['all'], component: ['coverage'] },
                    components: []
                }],
                variants: [],
                components: [],
                diagnostics: []
            }), '');
        };

        const cli = new YangaCli('mock-yanga', mockExec as any);
        const res = await cli.info('/dummy');

        assert.strictEqual(res.exitCode, 0);
        assert.strictEqual(res.model?.schema_version, '1.1');
        assert.deepStrictEqual(res.model?.platforms[0].build_targets, { generic: ['report'], variant: ['all'], component: ['coverage'] });
        assert.strictEqual(res.stderr, '');
    });

    test('info normalizes legacy v1.0 payload (number version, flat-array build_targets)', async () => {
        const mockExec: ExecFunction = (cmd, opts, cb) => {
            cb(null, JSON.stringify({
                schema_version: 1,
                project_dir: '/x',
                config_files: [],
                watch_patterns: [],
                ignore_patterns: [],
                platforms: [{
                    name: 'gtest',
                    build_types: [],
                    build_targets: ['unit_tests', 'report'],
                    components: []
                }],
                variants: [],
                components: [],
                diagnostics: []
            }), '');
        };

        const cli = new YangaCli('mock-yanga', mockExec as any);
        const res = await cli.info('/dummy');

        assert.strictEqual(res.exitCode, 0);
        // schema_version coerced to "1.0"
        assert.strictEqual(res.model?.schema_version, '1.0');
        // flat-list build_targets coerced to {generic: [...], variant: [], component: []}
        assert.deepStrictEqual(res.model?.platforms[0].build_targets, { generic: ['unit_tests', 'report'], variant: [], component: [] });
    });

    test('run appends --pristine when options.pristine is true', async () => {
        const { mockSpawn, capturedArgs } = makeMockSpawn();
        const cli = new YangaCli('mock-yanga', undefined as any, mockSpawn);

        await cli.run({ variant: 'V', platform: 'P', pristine: true }, '/dummy');

        assert.strictEqual(capturedArgs.length, 1);
        assert.ok(capturedArgs[0].includes('--pristine'), `expected --pristine in ${capturedArgs[0].join(' ')}`);
    });

    test('run omits --pristine when options.pristine is falsy', async () => {
        const { mockSpawn, capturedArgs } = makeMockSpawn();
        const cli = new YangaCli('mock-yanga', undefined as any, mockSpawn);

        await cli.run({ variant: 'V', platform: 'P' }, '/dummy');
        await cli.run({ variant: 'V', platform: 'P', pristine: false }, '/dummy');

        for (const args of capturedArgs) {
            assert.ok(!args.includes('--pristine'), `unexpected --pristine in ${args.join(' ')}`);
        }
    });

    test('info handles json parse error', async () => {
        const mockExec: ExecFunction = (cmd, opts, cb) => {
            cb(null, 'invalid json', '');
        };

        const cli = new YangaCli('mock-yanga', mockExec as any);
        const res = await cli.info('/dummy');

        assert.strictEqual(res.exitCode, 1);
        assert.strictEqual(res.model, undefined);
        assert.ok(res.stderr.includes('Failed to parse JSON'));
    });
});
