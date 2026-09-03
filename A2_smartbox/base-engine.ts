/**
 * base-engine.ts — wspólna baza silników SmartBox.
 * Odpowiednik @@BLENDER/A2_smartbox/base_engine.py
 *
 * Kontrakt 1 moduł = osobna jednostka, ta sama architektura:
 *   {mod}-adapter.tsx          build{Mod}Plan + {Mod}SubModule
 *   {mod}-engine.ts            {Mod}Engine.plan()
 *   {mod}_3_rules_V1.json      rules (metry) → rulesMToNm w silniku (CAD = nm)
 *   {mod}-drilling-builder.ts  build{Mod}Drillings   (opcjonalnie)
 *   {mod}-drilling-intent.ts   {Mod}DrillingIntent   (opcjonalnie)
 *
 * Shared tylko: BaseEngine, smartbox-core, smartbox-ui.
 */

/** Gabaryt strefy SmartBox (mm), wyliczony przez smartbox-core i podawany adapterom. */
export interface ModuleDims {
    width: number;
    height: number;
    depth: number;
}

export abstract class BaseEngine {
    protected width: number = 0;
    protected height: number = 0;
    protected depth: number = 0;

    constructor(width: number = 0, height: number = 0, depth: number = 0) {
        this.width = width;
        this.height = height;
        this.depth = depth;
    }

    abstract plan(params: any): { parts: any[] };
}
