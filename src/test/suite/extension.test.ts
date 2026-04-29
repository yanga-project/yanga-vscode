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
        
        assert.ok(commands.includes('yanga.refresh'));
        assert.ok(commands.includes('yanga.buildVariant'));
        assert.ok(commands.includes('yanga.cleanVariant'));
        assert.ok(commands.includes('yanga.buildComponent'));
        assert.ok(commands.includes('yanga.selectVariant'));
        assert.ok(commands.includes('yanga.selectPlatform'));
        assert.ok(commands.includes('yanga.selectBuildTarget'));
        assert.ok(commands.includes('yanga.selectBuildType'));
        assert.ok(commands.includes('yanga.componentsViewAsTree'));
        assert.ok(commands.includes('yanga.componentsViewAsFlat'));
    });
});
