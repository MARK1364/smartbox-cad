/**
 * base-engine.ts — wspólne helpery wymiarów Bloki.
 * Odpowiednik @@BLENDER/A2_bloki/base_engine.py (bez klas).
 *
 * Kontrakt 1 moduł = osobna jednostka, ta sama architektura:
 *   {mod}-adapter.tsx          build{Mod}Plan + {Mod}SubModule
 *   {mod}-engine.ts            normalize + calculate (czyste funkcje)
 *   {mod}_3_rules_V1.json      rules (metry) → rulesMToNm w silniku (CAD = nm)
 *   {mod}-drilling-builder.ts  build{Mod}Drillings   (opcjonalnie)
 *   {mod}-drilling-intent.ts   {Mod}DrillingIntent   (opcjonalnie)
 *
 * Shared: toDimensionsMm, bloki-core, bloki-ui.
 *
 * Jednostki: gabaryt i plan Bloki = mm. Zapis do CADNode = mmToNm w bloki-core.
 */

import type { BlokiDimensions_mm } from './01_bloki-types.js';

/** Gabaryt strefy Bloki (mm) — kanoniczne *_mm, bez bare width/height/depth. */
export type ModuleDims = BlokiDimensions_mm;

/** Brakujący wymiar = 0; wymiary spoza DTO (width/height/depth) nie są akceptowane. */
export function toDimensionsMm(dims: ModuleDims): BlokiDimensions_mm {
    return {
        width_mm: Number(dims.width_mm ?? 0),
        height_mm: Number(dims.height_mm ?? 0),
        depth_mm: Number(dims.depth_mm ?? 0)
    };
}
