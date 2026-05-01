import * as assert from 'assert';
import { ProjectState } from '../../model/ProjectState';
import { YangaProjectModel } from '../../yanga/schema';

suite('ProjectState Test Suite', () => {
    const mockModel: YangaProjectModel = {
        schema_version: '1.1',
        project_dir: '/test',
        config_files: [],
        watch_patterns: [],
        ignore_patterns: [],
        platforms: [
            {
                name: 'gtest',
                build_types: [],
                build_targets: { generic: ['report'], variant: ['all'], component: ['coverage'] },
                components: ['platform_comp']
            },
            {
                name: 'pc',
                build_types: ['Debug', 'Release'],
                build_targets: { generic: ['build'], variant: [], component: [] },
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

        assert.strictEqual(state.activeVariant, 'VariantA');
        assert.strictEqual(state.activePlatform, 'gtest');
        // Variant effective targets for gtest = generic + variant = ['report','all'] sorted → 'all'
        assert.strictEqual(state.activeVariantBuildTarget, 'all');
        // Component effective targets for gtest = generic + component = ['report','coverage'] sorted → 'coverage'
        assert.strictEqual(state.activeComponentBuildTarget, 'coverage');
        assert.strictEqual(state.activeBuildType, null); // gtest has no build_types
        // First component alphabetically from the three-source union of VariantA / gtest
        assert.strictEqual(state.activeComponent, 'gtest_mock');
    });

    test('preserves valid selections on updateModel', () => {
        const state = new ProjectState();
        state.setVariant('VariantB');
        state.setPlatform('pc');
        state.setVariantBuildTarget('build');
        state.setComponentBuildTarget('build');
        state.setBuildType('Release');

        state.updateModel(mockModel);

        assert.strictEqual(state.activeVariant, 'VariantB');
        assert.strictEqual(state.activePlatform, 'pc');
        assert.strictEqual(state.activeVariantBuildTarget, 'build');
        assert.strictEqual(state.activeComponentBuildTarget, 'build');
        assert.strictEqual(state.activeBuildType, 'Release');
    });

    test('computes three-source component union correctly', () => {
        const state = new ProjectState();
        state.updateModel(mockModel); // defaults to VariantA / gtest

        const components = state.getVisibleComponents();
        const names = components.map(c => c.name);

        assert.deepStrictEqual(names, ['gtest_mock', 'platform_comp', 'var_comp']);
    });

    test('cascades targets and type on platform change', () => {
        const state = new ProjectState();
        state.updateModel(mockModel); // defaults to VariantA / gtest

        assert.strictEqual(state.activeVariantBuildTarget, 'all');
        assert.strictEqual(state.activeComponentBuildTarget, 'coverage');
        assert.strictEqual(state.activeBuildType, null);

        state.setPlatform('pc');

        assert.strictEqual(state.activeVariantBuildTarget, 'build');
        assert.strictEqual(state.activeComponentBuildTarget, 'build');
        assert.strictEqual(state.activeBuildType, 'Debug');
    });

    test('effectiveVariantTargets dedupes generic against variant scope', () => {
        const state = new ProjectState();
        const targets = state.effectiveVariantTargets({
            name: 'p',
            build_types: [],
            components: [],
            build_targets: { generic: ['all', 'build'], variant: ['build', 'docs'], component: [] }
        });
        assert.deepStrictEqual(targets, ['all', 'build', 'docs']);
    });

    test('effectiveComponentTargets dedupes generic against component scope', () => {
        const state = new ProjectState();
        const targets = state.effectiveComponentTargets({
            name: 'p',
            build_types: [],
            components: [],
            build_targets: { generic: ['all', 'build'], variant: [], component: ['all', 'unit_tests'] }
        });
        assert.deepStrictEqual(targets, ['all', 'build', 'unit_tests']);
    });

    test('falls back active component when variant changes', () => {
        const state = new ProjectState();
        state.updateModel(mockModel); // VariantA / gtest, component=gtest_mock

        state.setVariant('VariantB');
        // VariantB / gtest → components: var_comp_b (variant) + platform_comp (platform) = ['platform_comp', 'var_comp_b']
        assert.strictEqual(state.activeComponent, 'platform_comp');
    });
});
