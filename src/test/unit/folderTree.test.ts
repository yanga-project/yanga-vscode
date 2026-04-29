import * as assert from 'assert';
import { buildComponentFolderTree } from '../../model/folderTree';
import { YangaComponent } from '../../yanga/schema';

const mk = (name: string, path: string): YangaComponent => ({ name, path });

suite('folderTree Test Suite', () => {
    test('empty input yields empty root', () => {
        const root = buildComponentFolderTree([]);
        assert.deepStrictEqual(root, { name: '', path: '', folders: [], components: [] });
    });

    test('component at the project root lives in root.components', () => {
        const root = buildComponentFolderTree([mk('a', 'a')]);
        assert.deepStrictEqual(root.folders, []);
        assert.deepStrictEqual(root.components.map(c => c.name), ['a']);
    });

    test('single-child folder chain collapses into one node', () => {
        const root = buildComponentFolderTree([mk('comp', 'src/lib/foo/comp')]);
        assert.strictEqual(root.folders.length, 1);
        assert.strictEqual(root.folders[0].name, 'src/lib/foo');
        assert.strictEqual(root.folders[0].path, 'src/lib/foo');
        assert.deepStrictEqual(root.folders[0].components.map(c => c.name), ['comp']);
        assert.deepStrictEqual(root.folders[0].folders, []);
    });

    test('siblings prevent collapse at the branching point', () => {
        const root = buildComponentFolderTree([
            mk('a', 'src/lib/a/a'),
            mk('b', 'src/lib/b/b')
        ]);
        // src/lib has two children, so the chain stops at "src/lib"
        assert.strictEqual(root.folders.length, 1);
        assert.strictEqual(root.folders[0].name, 'src/lib');
        assert.deepStrictEqual(root.folders[0].folders.map(f => f.name), ['a', 'b']);
    });

    test('a folder mixing components and subfolders does not collapse through itself', () => {
        const root = buildComponentFolderTree([
            mk('top', 'src/top'),
            mk('deep', 'src/sub/deep')
        ]);
        assert.strictEqual(root.folders.length, 1);
        const src = root.folders[0];
        assert.strictEqual(src.name, 'src');
        assert.deepStrictEqual(src.components.map(c => c.name), ['top']);
        assert.deepStrictEqual(src.folders.map(f => f.name), ['sub']);
        assert.deepStrictEqual(src.folders[0].components.map(c => c.name), ['deep']);
    });

    test('folders are sorted alphabetically at each level', () => {
        const root = buildComponentFolderTree([
            mk('zc', 'pkg/zeta/zc'),
            mk('ac', 'pkg/alpha/ac'),
            mk('mc', 'pkg/mid/mc')
        ]);
        const pkg = root.folders[0];
        assert.strictEqual(pkg.name, 'pkg');
        assert.deepStrictEqual(pkg.folders.map(f => f.name), ['alpha', 'mid', 'zeta']);
    });

    test('paths use forward slashes regardless of input separator', () => {
        const root = buildComponentFolderTree([mk('comp', 'src\\lib\\comp')]);
        assert.strictEqual(root.folders.length, 1);
        assert.strictEqual(root.folders[0].name, 'src/lib');
        assert.strictEqual(root.folders[0].path, 'src/lib');
    });

    test('multiple components in the same leaf folder are listed together and sorted', () => {
        const root = buildComponentFolderTree([
            mk('b', 'src/lib/b'),
            mk('a', 'src/lib/a')
        ]);
        const lib = root.folders[0];
        assert.strictEqual(lib.name, 'src/lib');
        assert.deepStrictEqual(lib.components.map(c => c.name), ['a', 'b']);
    });
});
