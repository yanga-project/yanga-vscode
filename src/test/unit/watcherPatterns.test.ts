import * as assert from 'assert';
import { buildWatcherPatterns, escapeGlob, patternListsEqual } from '../../ui/watcherPatterns';

suite('watcherPatterns Test Suite', () => {
    test('escapeGlob escapes every glob metacharacter', () => {
        assert.strictEqual(escapeGlob('foo[bar].yaml'), 'foo\\[bar\\].yaml');
        assert.strictEqual(escapeGlob('a*b?c'), 'a\\*b\\?c');
        assert.strictEqual(escapeGlob('one(2){3}!4@5+6'), 'one\\(2\\)\\{3\\}\\!4\\@5\\+6');
    });

    test('escapeGlob is a no-op for paths without metacharacters', () => {
        assert.strictEqual(escapeGlob('config/yanga.yaml'), 'config/yanga.yaml');
    });

    test('buildWatcherPatterns escapes config files but leaves watch globs alone', () => {
        const result = buildWatcherPatterns(
            ['config/yanga.yaml', 'config/[generated].json'],
            ['**/*.cmake', 'src/**/*.c']
        );
        assert.deepStrictEqual(result, [
            '**/*.cmake',
            'config/\\[generated\\].json',
            'config/yanga.yaml',
            'src/**/*.c'
        ]);
    });

    test('buildWatcherPatterns deduplicates across both lists', () => {
        const result = buildWatcherPatterns(
            ['config/yanga.yaml', 'config/yanga.yaml'],
            ['config/yanga.yaml']
        );
        assert.deepStrictEqual(result, ['config/yanga.yaml']);
    });

    test('buildWatcherPatterns returns a stable sorted order', () => {
        const a = buildWatcherPatterns(['z.yaml', 'a.yaml'], ['m/**']);
        const b = buildWatcherPatterns(['a.yaml', 'z.yaml'], ['m/**']);
        assert.deepStrictEqual(a, b);
    });

    test('patternListsEqual: same content returns true', () => {
        assert.strictEqual(patternListsEqual(['a', 'b'], ['a', 'b']), true);
        assert.strictEqual(patternListsEqual([], []), true);
    });

    test('patternListsEqual: different lengths return false', () => {
        assert.strictEqual(patternListsEqual(['a'], ['a', 'b']), false);
    });

    test('patternListsEqual: different order is treated as different', () => {
        // The check is order-sensitive, buildWatcherPatterns guarantees sorted input.
        assert.strictEqual(patternListsEqual(['a', 'b'], ['b', 'a']), false);
    });
});
