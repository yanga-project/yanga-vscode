import * as assert from 'assert';
import { ProjectState } from '../../model/ProjectState';
import { YangaProjectModel } from '../../yanga/schema';

suite('ProjectState Test Suite', () => {
    const mockModel: YangaProjectModel = {
        schema_version: 1,
        project_dir: '/test',
        config_files: [],
        watch_patterns: [],
        ignore_patterns: [],
        platforms: [
            {
                name: 'gtest',
                build_types: [],
                build_targets: ['all', 'report'],
                components: ['platform_comp']
            },
            {
                name: 'pc',
                build_types: ['Debug', 'Release'],
                build_targets: ['build'],
                components: []
            }
        ],
        variants: [
            {
                name: 'VariantA',
                components: ['var_comp'],
                platform_components: {
                    'gtest': ['gtest_mock']
                }
            },
            {
                name: 'VariantB',
                components: ['var_comp_b'],
                platform_components: {}
            }
        ],
        components: [
            { name: 'platform_comp', path: 'p1' },
            { name: 'var_comp', path: 'v1' },
            { name: 'gtest_mock', path: 'gm' },
            { name: 'var_comp_b', path: 'v2' }
        ],
        diagnostics: []
    };

    test('validates selections on updateModel to first sorted entry', () => {
        const state = new ProjectState();
        state.updateModel(mockModel);

        assert.strictEqual(state.activeVariant, 'VariantA'); // VariantA < VariantB
        assert.strictEqual(state.activePlatform, 'gtest'); // gtest < pc
        assert.strictEqual(state.activeBuildTarget, 'all');
        assert.strictEqual(state.activeBuildType, null); // gtest has no build_types
    });

    test('preserves valid selections on updateModel', () => {
        const state = new ProjectState();
        state.setVariant('VariantB');
        state.setPlatform('pc');
        state.setBuildTarget('build');
        state.setBuildType('Release');
        
        state.updateModel(mockModel);

        assert.strictEqual(state.activeVariant, 'VariantB');
        assert.strictEqual(state.activePlatform, 'pc');
        assert.strictEqual(state.activeBuildTarget, 'build');
        assert.strictEqual(state.activeBuildType, 'Release');
    });

    test('computes three-source union correctly', () => {
        const state = new ProjectState();
        state.updateModel(mockModel); // defaults to VariantA / gtest

        const components = state.getVisibleComponents();
        const names = components.map(c => c.name);

        assert.deepStrictEqual(names, ['gtest_mock', 'platform_comp', 'var_comp']); // Sorted alphabetically
    });

    test('cascades target and type on platform change', () => {
        const state = new ProjectState();
        state.updateModel(mockModel); // defaults to VariantA / gtest
        
        assert.strictEqual(state.activeBuildTarget, 'all');
        assert.strictEqual(state.activeBuildType, null);

        state.setPlatform('pc'); // Validates automatically
        assert.strictEqual(state.activeBuildTarget, 'build');
        assert.strictEqual(state.activeBuildType, 'Debug');
    });
});
