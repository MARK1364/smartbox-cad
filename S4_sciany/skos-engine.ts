/**
 * skos-engine — plan parametrycznego skosa pod schody [mm].
 *
 * Trapez w obrysie płyty, ukos na dole (default, zabudowy pod schodami)
 * lub na górze (przełącznik):
 *   dół:  (0,H-hL) → (L,H-hR) → (L,H) → (0,H)   // góra płaska
 *   góra: (0,0) → (L,0) → (L,hR) → (0,hL)         // dół płaski
 * hL == hR → zwykły prostokąt (też poprawny obrys).
 *
 * B-rep (polygon-extrusion) wyciąga obrys wzdłuż grubości — klin pryzmatyczny.
 * Ukośna krawędź klasyfikuje się jako NOTCH (bez auto-okleiny na v1).
 */

import { WALL_SURFACE_EDGE_BANDING, WALL_FRONT_LCS } from './walls-engine.js';
import type { SmartWallPartPlanMm } from './smartwall-types.js';

/** Która krawędź trapezu jest ukośna. */
export type SkosSlant = 'top' | 'bottom';

export interface SkosPlanParamsMm {
    skosLength?: number;
    skosHeightLeft?: number;
    skosHeightRight?: number;
    wallThickness?: number;
    skosSlant?: SkosSlant;
}

export const SKOS_DEFAULTS_MM = {
    length: 2000,
    heightLeft: 1800,
    heightRight: 900,
    thickness: 500,
    slant: 'bottom' as SkosSlant,
} as const;

/** Oblisz obrys trapezowy [mm] w ramce bbox (plateW × maxH). */
export function skosOutline2dMm(length: number, heightLeft: number, heightRight: number, slant: SkosSlant = 'bottom'): number[][] {
    const L = Math.max(100, length);
    const hL = Math.max(10, heightLeft);
    const hR = Math.max(10, heightRight);
    if (slant === 'top') {
        return [
            [0, 0],
            [L, 0],
            [L, hR],
            [0, hL],
        ];
    }
    const H = Math.max(hL, hR);
    return [
        [0, H - hL],
        [L, H - hR],
        [L, H],
        [0, H],
    ];
}

export function planSkos(params: SkosPlanParamsMm): { parts: SmartWallPartPlanMm[] } {
    const L = Math.max(100, params.skosLength ?? SKOS_DEFAULTS_MM.length);
    const hL = Math.max(10, params.skosHeightLeft ?? SKOS_DEFAULTS_MM.heightLeft);
    const hR = Math.max(10, params.skosHeightRight ?? SKOS_DEFAULTS_MM.heightRight);
    const T = Math.max(10, params.wallThickness ?? SKOS_DEFAULTS_MM.thickness);
    const slant = params.skosSlant ?? SKOS_DEFAULTS_MM.slant;
    const maxH = Math.max(hL, hR);

    return {
        parts: [
            {
                key: 'SKOS',
                name: 'Skos',
                role: 'SKOS',
                // Środek bboxa; ściana stoi na Z=0 jak reszta S4.
                loc: { x: 0, y: 0, z: maxH / 2 },
                // Jak ściana FRONT: dim.x = długość, dim.y = grubość, dim.z = wysokość.
                dim: { x: L, y: T, z: maxH },
                rotationDeg: WALL_FRONT_LCS.rotation,
                lcs: {
                    mapping: { ...WALL_FRONT_LCS.mapping },
                    rotation: [...WALL_FRONT_LCS.rotation] as [number, number, number],
                },
                edge_banding: WALL_SURFACE_EDGE_BANDING,
                custom_properties: {
                    excludeFromProduction: true,
                    domain: 'skos_segment',
                    shape: 'skos',
                    outline2d: skosOutline2dMm(L, hL, hR, slant),
                    skosHeightLeft: hL,
                    skosHeightRight: hR,
                    skosSlant: slant,
                },
            },
        ],
    };
}
