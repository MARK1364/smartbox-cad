/**
 * walls-engine — plan ścian pomieszczenia [mm] z JSON rules (metry → mm).
 * Konwencja jak SmartFrame: origin kontenera = środek XY, Z=0 na podłodze;
 * loc części = środek panelu; LCS ustawia pion.
 */

import wallsRules from './walls_3_rules_V1.json';
import { rulesMToMm } from '../A1_core/cad-math/units.js';
import { FLOOR_DEFAULT_COLOR } from './smartfloor-types.js';
import type { SmartWallPartPlanMm, SmartWallPreset } from './smartwall-types.js';

/**
 * Ściana przód — jak drzwi FRONT (mapping Y↔Z, bez Rx90).
 * Rx90 = półka/podłoga w Babylonie (grubość → góra); tu ma być pion.
 */
export const WALL_FRONT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' } as const,
    rotation: [0, 0, 0] as [number, number, number],
};

/** Ściana tył — jak BACK_PANEL / plecy. */
export const WALL_BACK_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' } as const,
    rotation: [180, 0, 0] as [number, number, number],
};

/** @deprecated alias — domyślnie jak przód (pion, bez Rx90). */
export const WALL_ALONG_X_LCS = WALL_FRONT_LCS;

/** Ściana lewa — jak SIDE_L w Bloki (pion = dim.x → bbHeight). */
export const WALL_LEFT_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' } as const,
    rotation: [0, 0, -90] as [number, number, number],
};

/** Ściana prawa — jak SIDE_R w Bloki. */
export const WALL_RIGHT_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' } as const,
    rotation: [0, 0, 90] as [number, number, number],
};

function defMm(key: 'wall_height_m' | 'wall_thickness_m' | 'room_width_m' | 'room_depth_m', fallbackMm: number): number {
    const raw = (wallsRules as any)?.defaults?.[key];
    // JSON w metrach, fallback już w mm — nie mieszaj jednostek w jednym wywołaniu.
    return rulesMToMm(typeof raw === 'number' ? raw : undefined, fallbackMm);
}

export interface WallsPlanParamsMm {
    preset: SmartWallPreset;
    roomWidth?: number;
    roomDepth?: number;
    wallHeight?: number;
    wallThickness?: number;
    singleLength?: number;
    uskokGapStart?: number;
    uskokGapEnd?: number;
}

type WallAlong = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';

/** Wykończenie krawędzi — bez ciemnego „rdzenia płyty” na ścianach architektonicznych. */
export const WALL_SURFACE_EDGE_BANDING = {
    '+X': { active: true, type_id: 'wall_finish' },
    '-X': { active: true, type_id: 'wall_finish' },
    '+Y': { active: true, type_id: 'wall_finish' },
    '-Y': { active: true, type_id: 'wall_finish' },
};

/** Jasny tynk — odróżnia ścianę od formatek meblowych. */
export const WALL_DEFAULT_COLOR = { r: 0.88, g: 0.88, b: 0.86 };

function wallPart(
    key: string,
    name: string,
    loc: { x: number; y: number; z: number },
    length: number,
    height: number,
    thickness: number,
    along: WallAlong,
): SmartWallPartPlanMm {
    if (along === 'LEFT' || along === 'RIGHT') {
        // Jak blenda boczna: dim.x = wysokość (pion), dim.y = długość wzdłuż Y, dim.z = grubość
        const lcs = along === 'LEFT' ? WALL_LEFT_LCS : WALL_RIGHT_LCS;
        return {
            key,
            name,
            role: 'WALL',
            loc,
            dim: { x: height, y: length, z: thickness },
            rotationDeg: lcs.rotation,
            lcs,
            edge_banding: WALL_SURFACE_EDGE_BANDING,
            color: WALL_DEFAULT_COLOR,
            custom_properties: {
                excludeFromProduction: true,
                domain: 'wall_segment',
                shape: 'wall',
            },
        };
    }

    // Przód/tył jak drzwi / plecy — bez Rx90 (Rx90 = leżenie jak podłoga w widoku).
    const lcs = along === 'BACK' ? WALL_BACK_LCS : WALL_FRONT_LCS;
    return {
        key,
        name,
        role: 'WALL',
        loc,
        dim: { x: length, y: thickness, z: height },
        rotationDeg: lcs.rotation,
        lcs,
        edge_banding: WALL_SURFACE_EDGE_BANDING,
        color: WALL_DEFAULT_COLOR,
        custom_properties: {
            excludeFromProduction: true,
            domain: 'wall_segment',
            shape: 'wall',
        },
    };
}

/**
 * Podłoga jako 5. element pokoju (preset rect): płyta pozioma na cały obrys
 * (W+2T)×(D+2T), grubość = T, góra na Z=0 → środek na Z=-T/2.
 * Jak półka w Bloki: mapping identity + Rx90 kładzie formatkę płasko
 * (grubość → góra, front +Z → do góry, stąd jasny kolor zamiast czerni).
 * Docelowo wydzielimy ją do osobnego komponentu (SmartFloor już czeka w S4).
 */
function floorPart(roomWidth: number, roomDepth: number, thickness: number): SmartWallPartPlanMm {
    return {
        key: 'FLOOR',
        name: 'Podłoga',
        role: 'FLOOR',
        loc: { x: 0, y: 0, z: -thickness / 2 },
        dim: { x: roomWidth + 2 * thickness, y: roomDepth + 2 * thickness, z: thickness },
        rotationDeg: [90, 0, 0],
        lcs: {
            mapping: { X: 'x', Y: 'y', Z: 'z' },
            rotation: [90, 0, 0],
        },
        edge_banding: WALL_SURFACE_EDGE_BANDING,
        color: { ...FLOOR_DEFAULT_COLOR },
        custom_properties: {
            excludeFromProduction: true,
            domain: 'floor_segment',
            shape: 'floor',
        },
    };
}

/**
 * Preset rect/L/U — W/D = światło wnętrza (pomiar użytkownika).
 * Ściany leżą na zewnątrz boxa: wewnętrzne lico na ±W/2 / ±D/2, grubość na zewnątrz.
 * Boki mają długość D+2T (domykają narożniki na zewnątrz F/B).
 * Podłoga (5. element): pełny obrys, góra na Z=0.
 * Origin = środek podłogi; wnętrze: X∈[-W/2,W/2], Y∈[-D/2,D/2], Z∈[0,H].
 */
export function planWalls(params: WallsPlanParamsMm): { parts: SmartWallPartPlanMm[] } {
    const W = params.roomWidth ?? defMm('room_width_m', 4000);
    const D = params.roomDepth ?? defMm('room_depth_m', 3000);
    const H = params.wallHeight ?? defMm('wall_height_m', 2700);
    const T = params.wallThickness ?? defMm('wall_thickness_m', 100);
    // Legacy L/U → pełny rect (presety usunięte; ściany wyłącza się zamrażaniem)
    let preset: string = params.preset || 'rect';
    if (preset === 'L' || preset === 'U') preset = 'rect';
    const zc = H / 2;

    if (preset === 'empty') {
        return { parts: [] };
    }

    if (preset === 'single') {
        const len = params.singleLength ?? W;
        return {
            parts: [wallPart('WALL_SINGLE', 'Ściana', { x: 0, y: 0, z: zc }, len, H, T, 'FRONT')],
        };
    }

    if (preset === 'uskok') {
        const len = params.singleLength ?? W;
        const gapStart = params.uskokGapStart ?? Math.round(len / 3);
        const gapEnd = params.uskokGapEnd ?? Math.round((2 * len) / 3);
        const parts: SmartWallPartPlanMm[] = [];
        // Segmenty wzdłuż X, wyśrodkowane w całości len wokół 0
        const x0 = -len / 2;
        if (gapStart > 0) {
            const segLen = gapStart;
            const cx = x0 + segLen / 2;
            parts.push(wallPart('WALL_SEG_0', 'Ściana A', { x: cx, y: 0, z: zc }, segLen, H, T, 'FRONT'));
        }
        if (gapEnd < len) {
            const segLen = len - gapEnd;
            const cx = x0 + gapEnd + segLen / 2;
            parts.push(wallPart('WALL_SEG_1', 'Ściana B', { x: cx, y: 0, z: zc }, segLen, H, T, 'FRONT'));
        }
        return { parts };
    }

    // Zewnętrzne: środek panelu = krawędź wnętrza ± T/2 na zewnątrz.
    // Boki D+2T obejmują grubość F/B (narożniki domknięte, bez „dziur” / ciemnych torców).
    const yBack = D / 2 + T / 2;
    const yFront = -D / 2 - T / 2;
    const xLeft = -W / 2 - T / 2;
    const xRight = W / 2 + T / 2;
    const lenFB = W;
    const lenLR = D + 2 * T;

    const all = [
        wallPart('WALL_BACK', 'Ściana tył', { x: 0, y: yBack, z: zc }, lenFB, H, T, 'BACK'),
        wallPart('WALL_FRONT', 'Ściana przód', { x: 0, y: yFront, z: zc }, lenFB, H, T, 'FRONT'),
        wallPart('WALL_LEFT', 'Ściana lewa', { x: xLeft, y: 0, z: zc }, lenLR, H, T, 'LEFT'),
        wallPart('WALL_RIGHT', 'Ściana prawa', { x: xRight, y: 0, z: zc }, lenLR, H, T, 'RIGHT'),
        floorPart(W, D, T),
    ];

    return { parts: all };
}
