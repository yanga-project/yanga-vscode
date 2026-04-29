import { YangaProjectModel, YangaComponent } from '../yanga/schema';

export class ProjectState {
    public model: YangaProjectModel | null = null;

    public activeVariant: string | null = null;
    public activePlatform: string | null = null;
    public activeBuildTarget: string | null = null;
    public activeBuildType: string | null = null;

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

    public setBuildTarget(target: string) {
        this.activeBuildTarget = target;
    }

    public setBuildType(type: string) {
        this.activeBuildType = type;
    }

    /**
     * Validates and falls back selections if they are invalid according to the model.
     * Mirros GUI behavior: falls back to the first alphabetically sorted item if invalid.
     */
    public validateSelections() {
        if (!this.model) {
            return;
        }

        // 1. Validate Variant
        if (!this.activeVariant || !this.model.variants.find(v => v.name === this.activeVariant)) {
            this.activeVariant = this.model.variants.length > 0 
                ? [...this.model.variants].sort((a, b) => a.name.localeCompare(b.name))[0].name 
                : null;
        }

        // 2. Validate Platform (NOT filtered by variant)
        if (!this.activePlatform || !this.model.platforms.find(p => p.name === this.activePlatform)) {
            this.activePlatform = this.model.platforms.length > 0 
                ? [...this.model.platforms].sort((a, b) => a.name.localeCompare(b.name))[0].name 
                : null;
        }

        // 3. Validate Build Target & Type based on active Platform
        const platform = this.model.platforms.find(p => p.name === this.activePlatform);
        if (platform) {
            if (!this.activeBuildTarget || !platform.build_targets.includes(this.activeBuildTarget)) {
                this.activeBuildTarget = platform.build_targets.length > 0 
                    ? [...platform.build_targets].sort()[0] 
                    : null;
            }
            if (!this.activeBuildType || !platform.build_types.includes(this.activeBuildType)) {
                this.activeBuildType = platform.build_types.length > 0 
                    ? [...platform.build_types].sort()[0] 
                    : null;
            }
        } else {
            this.activeBuildTarget = null;
            this.activeBuildType = null;
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
