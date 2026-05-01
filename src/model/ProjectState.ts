import { YangaProjectModel, YangaComponent, YangaPlatform } from '../yanga/schema';

export class ProjectState {
    public model: YangaProjectModel | null = null;

    public activeVariant: string | null = null;
    public activePlatform: string | null = null;
    public activeBuildType: string | null = null;
    public activeVariantBuildTarget: string | null = null;
    public activeComponent: string | null = null;
    public activeComponentBuildTarget: string | null = null;

    public updateModel(newModel: YangaProjectModel) {
        this.model = newModel;
        this.validateSelections();
    }

    public setVariant(variant: string) {
        this.activeVariant = variant;
        this.validateSelections();
    }

    public setPlatform(platform: string) {
        this.activePlatform = platform;
        this.validateSelections();
    }

    public setBuildType(type: string) {
        this.activeBuildType = type;
    }

    public setVariantBuildTarget(target: string) {
        this.activeVariantBuildTarget = target;
    }

    public setComponent(component: string) {
        this.activeComponent = component;
    }

    public setComponentBuildTarget(target: string) {
        this.activeComponentBuildTarget = target;
    }

    /**
     * Effective targets for variant builds: generic ∪ variant-only.
     */
    public effectiveVariantTargets(platform?: YangaPlatform): string[] {
        return dedupe(platform ? [...platform.build_targets.generic, ...platform.build_targets.variant] : []);
    }

    /**
     * Effective targets for component builds: generic ∪ component-only.
     */
    public effectiveComponentTargets(platform?: YangaPlatform): string[] {
        return dedupe(platform ? [...platform.build_targets.generic, ...platform.build_targets.component] : []);
    }

    /**
     * Validates and falls back selections if they are invalid according to the model.
     * Mirrors GUI behavior: falls back to the first alphabetically sorted item if invalid.
     */
    public validateSelections() {
        if (!this.model) {
            return;
        }

        if (!this.activeVariant || !this.model.variants.find(v => v.name === this.activeVariant)) {
            this.activeVariant = sortedFirst(this.model.variants.map(v => v.name));
        }

        if (!this.activePlatform || !this.model.platforms.find(p => p.name === this.activePlatform)) {
            this.activePlatform = sortedFirst(this.model.platforms.map(p => p.name));
        }

        const platform = this.model.platforms.find(p => p.name === this.activePlatform);
        if (platform) {
            const variantTargets = this.effectiveVariantTargets(platform);
            if (!this.activeVariantBuildTarget || !variantTargets.includes(this.activeVariantBuildTarget)) {
                this.activeVariantBuildTarget = sortedFirst(variantTargets);
            }
            const componentTargets = this.effectiveComponentTargets(platform);
            if (!this.activeComponentBuildTarget || !componentTargets.includes(this.activeComponentBuildTarget)) {
                this.activeComponentBuildTarget = sortedFirst(componentTargets);
            }
            if (!this.activeBuildType || !platform.build_types.includes(this.activeBuildType)) {
                this.activeBuildType = sortedFirst(platform.build_types);
            }
        } else {
            this.activeVariantBuildTarget = null;
            this.activeComponentBuildTarget = null;
            this.activeBuildType = null;
        }

        const visibleNames = this.getVisibleComponents().map(c => c.name);
        if (!this.activeComponent || !visibleNames.includes(this.activeComponent)) {
            this.activeComponent = visibleNames.length > 0 ? visibleNames[0] : null;
        }
    }

    /**
     * Computes the three-source component union for the current active variant and platform.
     */
    public getVisibleComponents(): YangaComponent[] {
        if (!this.model || !this.activeVariant || !this.activePlatform) {
            return [];
        }

        const v = this.model.variants.find(x => x.name === this.activeVariant);
        const p = this.model.platforms.find(x => x.name === this.activePlatform);

        if (!v || !p) {
            return [];
        }

        const componentNames = new Set([
            ...v.components,
            ...(v.platform_components[this.activePlatform] || []),
            ...p.components
        ]);

        return Array.from(componentNames).map(name => {
            const comp = this.model!.components.find(c => c.name === name);
            return comp || { name, path: '' };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }
}

function sortedFirst(items: string[]): string | null {
    return items.length > 0 ? [...items].sort()[0] : null;
}

function dedupe(items: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
        if (!seen.has(item)) {
            seen.add(item);
            out.push(item);
        }
    }
    return out;
}
