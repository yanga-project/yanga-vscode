import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Integration Test Suite', () => {
    test('Should register Yanga commands', async () => {
        const ext = vscode.extensions.getExtension('yanga-project.yanga-vscode');
        assert.ok(ext, 'extension yanga-project.yanga-vscode is not installed in the test host');
        if (!ext.isActive) {
            await ext.activate();
        }

        const commands = await vscode.commands.getCommands(true);
        
        const expected = [
            'yanga.refresh',
            'yanga.buildVariant',
            'yanga.cleanVariant',
            'yanga.buildComponent',
            'yanga.selectVariant',
            'yanga.selectPlatform',
            'yanga.selectBuildType',
            'yanga.selectVariantBuildTarget',
            'yanga.selectComponent',
            'yanga.selectComponentBuildTarget',
        ];
        for (const id of expected) {
            assert.ok(commands.includes(id), `missing command: ${id}`);
        }
    });
});
