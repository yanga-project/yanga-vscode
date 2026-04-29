import * as assert from 'assert';
import { YangaCli, ExecFunction } from '../../yanga/YangaCli';

suite('YangaCli Test Suite', () => {
    test('info handles valid json', async () => {
        const mockExec: ExecFunction = (cmd, opts, cb) => {
            cb(null, '{"schema_version": 1}', '');
        };
        
        const cli = new YangaCli('mock-yanga', mockExec as any);
        const res = await cli.info('/dummy');

        assert.strictEqual(res.exitCode, 0);
        assert.strictEqual(res.model?.schema_version, 1);
        assert.strictEqual(res.stderr, '');
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
