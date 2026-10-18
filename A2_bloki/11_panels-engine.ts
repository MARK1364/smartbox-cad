/**
 * panels-engine.ts — moduł BLENDY (blok_panels)
 * Odpowiednik @@BLENDER/A2_bloki/panels_2_engine_v1.py + panels_3_rules_V1.json
 *
 * Jedyne Bloki na ZEWNĄTRZ korpusu (side_references_bloki: OUTER).
 * Gabaryt Bloku = zewnętrzna obudowa SmartFrame; blendy siadają na zewnątrz
 * tej obudowy (lewa/prawa/góra) albo pod spodem (cokół).
 *
 * Origin web: Z=0 = spód strefy (w Blenderze środek). Bez nawierceń.
 *
 * Architektura funkcyjna:
 *  - normalizePanelsParams(raw, dims)
 *  - calculatePanelsPlan(dims, params)
 */
import panelsRules from './11_panels_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';
import { type ModuleDims } from './01_base-engine.js';
import type {
    BlokiDimensions_mm,
    BlokiPart,
    BlokiPlanResult
} from './01_bloki-types.js';
import type { PanelsPlanParams, SidePanelMode } from './01_bloki-module-types.js';
import {
    assertCanonicalPanelsParams,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';

export { assertCanonicalPanelsParams, LEGACY_PANELS_PARAM_ALIASES } from './01_bloki-module-param-guards.js';
export type { SidePanelMode } from './01_bloki-module-types.js';

export const PANEL_FRONT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

export const PANEL_SHELF_LCS = {
    mapping: { X: 'x', Y: 'y', Z: 'z' },
    rotation: [90, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

export const PANEL_SIDE_L_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' },
    rotation: [0, 0, -90] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

export const PANEL_SIDE_R_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' },
    rotation: [0, 0, 90] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

export interface NormalizedPanelsParams {
    grubosc_blendy_mm: number;
    tryb_paneli_bocznych: SidePanelMode;
    wlacz_lewy: boolean;
    wlacz_prawy: boolean;
    wlacz_gorny: boolean;
    wlacz_dolny: boolean;
    auto_glebokosc_lewy: boolean;
    auto_glebokosc_prawy: boolean;
    auto_glebokosc_gorny: boolean;
    glebokosc_blendy_lewa_mm: number;
    glebokosc_blendy_prawa_mm: number;
    glebokosc_blendy_gora_mm: number;
    wysokosc_cokolu_mm: number;
    szczelina_cokolu_mm: number;
    cofniecie_cokolu_mm: number;
    luz_lewy_mm: number;
    luz_prawy_mm: number;
    luz_gorny_mm: number;
}

function edgeFor(role: string): any {
    return (panelsRules as any).parameters?.smart_panel_integration?.role_overrides?.[role]?.edge_banding;
}

export function calcSideSpan(mode: SidePanelMode, height_mm: number, plinthH_mm: number, plinthGap_mm: number, topThick_mm: number) {
    let zBottom = 0;
    let zTop = height_mm;
    if (mode === 'FULL') {
        zBottom = -plinthGap_mm - plinthH_mm;
        zTop = height_mm + topThick_mm;
    } else if (mode === 'KORPUS_BLENDA_G') {
        zBottom = 0;
        zTop = height_mm + topThick_mm;
    } else if (mode === 'COKOL_KORPUS') {
        zBottom = -plinthH_mm - plinthGap_mm;
        zTop = height_mm;
    }
    return { zBottom, zTop, sideH: zTop - zBottom, zCenter: (zBottom + zTop) / 2 };
}

function asMode(raw: unknown): SidePanelMode {
    const m = String(raw || 'FULL').toUpperCase();
    if (m === 'KORPUS_BLENDA_G' || m === 'COKOL_KORPUS' || m === 'KORPUS') return m;
    return 'FULL';
}

function flag(params: Record<string, unknown>, key: string, defaultValue = true): boolean {
    if (params[key] !== undefined) return !!params[key];
    return defaultValue;
}

export function normalizePanelsParams(raw: PanelsPlanParams = {}, dims?: BlokiDimensions_mm): NormalizedPanelsParams {
    assertCanonicalPanelsParams(raw);
    const input = raw as Record<string, unknown>;
    const defThick = resolveRuleThicknessMm(panelsRules, ['PANEL_L', 'PANEL_P', 'PANEL_T', 'PANEL_B', 'PANEL'], 'thickness', 'panels');
    const grubosc_blendy_mm = readOptionalNumber(input, 'grubosc_blendy_mm') ?? defThick;
    const tryb_paneli_bocznych = asMode(input.tryb_paneli_bocznych);

    const wlacz_lewy = flag(input, 'wlacz_lewy', true);
    const wlacz_prawy = flag(input, 'wlacz_prawy', true);
    const wlacz_gorny = flag(input, 'wlacz_gorny', true);
    const wlacz_dolny = flag(input, 'wlacz_dolny', true);

    const auto_glebokosc_lewy = flag(input, 'auto_glebokosc_lewy', true);
    const auto_glebokosc_prawy = flag(input, 'auto_glebokosc_prawy', true);
    const auto_glebokosc_gorny = flag(input, 'auto_glebokosc_gorny', true);

    const glebokosc_blendy_lewa_mm = readOptionalNumber(input, 'glebokosc_blendy_lewa_mm') ?? 100;
    const glebokosc_blendy_prawa_mm = readOptionalNumber(input, 'glebokosc_blendy_prawa_mm') ?? 100;
    const glebokosc_blendy_gora_mm = readOptionalNumber(input, 'glebokosc_blendy_gora_mm') ?? 100;

    const wysokosc_cokolu_mm = readOptionalNumber(input, 'wysokosc_cokolu_mm') ?? 97;
    const szczelina_cokolu_mm = readOptionalNumber(input, 'szczelina_cokolu_mm') ?? 3;
    const cofniecie_cokolu_mm = readOptionalNumber(input, 'cofniecie_cokolu_mm') ?? 20;

    const luz_lewy_mm = readOptionalNumber(input, 'luz_lewy_mm') ?? 0;
    const luz_prawy_mm = readOptionalNumber(input, 'luz_prawy_mm') ?? 0;
    const luz_gorny_mm = readOptionalNumber(input, 'luz_gorny_mm') ?? 0;

    return {
        grubosc_blendy_mm,
        tryb_paneli_bocznych,
        wlacz_lewy,
        wlacz_prawy,
        wlacz_gorny,
        wlacz_dolny,
        auto_glebokosc_lewy,
        auto_glebokosc_prawy,
        auto_glebokosc_gorny,
        glebokosc_blendy_lewa_mm,
        glebokosc_blendy_prawa_mm,
        glebokosc_blendy_gora_mm,
        wysokosc_cokolu_mm,
        szczelina_cokolu_mm,
        cofniecie_cokolu_mm,
        luz_lewy_mm,
        luz_prawy_mm,
        luz_gorny_mm
    };
}

export function calculatePanelsPlan(
    dims_mm: BlokiDimensions_mm,
    params: NormalizedPanelsParams
): BlokiPlanResult {
    const width_mm = dims_mm.width_mm;
    const height_mm = dims_mm.height_mm;
    const depth_mm = dims_mm.depth_mm;
    const grubosc_blendy_mm = params.grubosc_blendy_mm;

    const depthLeft_mm = params.auto_glebokosc_lewy ? depth_mm : params.glebokosc_blendy_lewa_mm;
    const depthRight_mm = params.auto_glebokosc_prawy ? depth_mm : params.glebokosc_blendy_prawa_mm;
    const depthTop_mm = params.auto_glebokosc_gorny ? depth_mm : params.glebokosc_blendy_gora_mm;

    const { sideH, zCenter } = calcSideSpan(
        params.tryb_paneli_bocznych,
        height_mm,
        params.wysokosc_cokolu_mm,
        params.szczelina_cokolu_mm,
        grubosc_blendy_mm
    );
    const parts: BlokiPart[] = [];

    if (params.wlacz_lewy) {
        const posY = params.auto_glebokosc_lewy ? 0 : -(depth_mm / 2) + depthLeft_mm / 2;
        parts.push({
            name: 'Blenda_lewa',
            key: 'PANEL_LEFT',
            role: 'LEFT_SIDE_PANEL',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: sideH, y: depthLeft_mm, z: grubosc_blendy_mm },
            loc: { x: -width_mm / 2 - grubosc_blendy_mm / 2 - params.luz_lewy_mm, y: posY, z: zCenter },
            lcs: PANEL_SIDE_L_LCS,
            edge_banding: edgeFor('LEFT_SIDE_PANEL'),
            features: []
        });
    }

    if (params.wlacz_prawy) {
        const posY = params.auto_glebokosc_prawy ? 0 : -(depth_mm / 2) + depthRight_mm / 2;
        parts.push({
            name: 'Blenda_prawa',
            key: 'PANEL_RIGHT',
            role: 'RIGHT_SIDE_PANEL',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: sideH, y: depthRight_mm, z: grubosc_blendy_mm },
            loc: { x: width_mm / 2 + grubosc_blendy_mm / 2 + params.luz_prawy_mm, y: posY, z: zCenter },
            lcs: PANEL_SIDE_R_LCS,
            edge_banding: edgeFor('RIGHT_SIDE_PANEL'),
            features: []
        });
    }

    if (params.wlacz_gorny) {
        let leftEdge = -width_mm / 2;
        let rightEdge = width_mm / 2;
        if (params.tryb_paneli_bocznych === 'KORPUS' || params.tryb_paneli_bocznych === 'COKOL_KORPUS') {
            if (params.wlacz_lewy) leftEdge -= grubosc_blendy_mm;
            if (params.wlacz_prawy) rightEdge += grubosc_blendy_mm;
        }
        const topW = rightEdge - leftEdge;
        const posY = params.auto_glebokosc_gorny ? 0 : -(depth_mm / 2) + depthTop_mm / 2;
        parts.push({
            name: 'Blenda_gora',
            key: 'PANEL_TOP',
            role: 'TOP_PANEL',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: topW, y: depthTop_mm, z: grubosc_blendy_mm },
            loc: { x: (leftEdge + rightEdge) / 2, y: posY, z: height_mm + grubosc_blendy_mm / 2 + params.luz_gorny_mm },
            lcs: PANEL_SHELF_LCS,
            edge_banding: edgeFor('TOP_PANEL'),
            features: []
        });
    }

    if (params.wlacz_dolny) {
        let leftEdge = -width_mm / 2;
        let rightEdge = width_mm / 2;
        if (params.tryb_paneli_bocznych === 'KORPUS_BLENDA_G' || params.tryb_paneli_bocznych === 'KORPUS') {
            if (params.wlacz_lewy) leftEdge -= grubosc_blendy_mm;
            if (params.wlacz_prawy) rightEdge += grubosc_blendy_mm;
        }
        const cokolW = rightEdge - leftEdge;
        parts.push({
            name: 'Panel_Cokol',
            key: 'PANEL_BOTTOM',
            role: 'BOTTOM_PANEL',
            nodeType: 'PART',
            material: 'W1100_ST9_18',
            materialName: 'Biały Alpejski',
            materialCode: 'W1100 ST9',
            dim: { x: cokolW, y: grubosc_blendy_mm, z: params.wysokosc_cokolu_mm },
            loc: {
                x: (leftEdge + rightEdge) / 2,
                y: -(depth_mm / 2) + params.cofniecie_cokolu_mm + grubosc_blendy_mm / 2,
                z: -params.szczelina_cokolu_mm - params.wysokosc_cokolu_mm / 2
            },
            lcs: PANEL_FRONT_LCS,
            edge_banding: edgeFor('BOTTOM_PANEL'),
            features: []
        });
    }

    return { parts };
}


