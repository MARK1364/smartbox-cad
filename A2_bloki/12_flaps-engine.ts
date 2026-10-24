/**
 * flaps-engine.ts — moduł KLAPY (blok_flaps)
 * Odpowiednik @@BLENDER/A2_bloki/flaps_2_engine_v1.py + flaps_3_rules_V1.json
 * Nawiercenia prowadników korpusu: flaps-drilling-builder.ts
 *
 * Architektura funkcyjna:
 *  - normalizeFlapsParams(raw, dims)
 *  - calculateFlapsPlan(dims, params)
 */
import flapsRules from './12_flaps_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';
import { DEFAULT_HINGE_CUP_EDGE_DIST_MM, DEFAULT_HINGE_ID, hingeFrontHolesMm, hingeTemplateId } from '../B1_biblioteka/index.js';
import { buildHoleMachiningIntent } from './01_machining-intent.js';
import type {
    BlokiDimensions_mm,
    BlokiPart,
    BlokiHardware,
    BlokiPlanResult
} from './01_bloki-types.js';
import type { FlapsPlanParams } from './01_bloki-module-types.js';
import {
    assertCanonicalFlapsParams,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';

export { assertCanonicalFlapsParams, LEGACY_FLAPS_PARAM_ALIASES } from './01_bloki-module-param-guards.js';

export const FLAP_FRONT_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' },
    rotation: [0, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

export type FlapHingeSide = 'left' | 'right' | 'center';

export interface NormalizedFlapsParams {
    kierunek_klapy: 'TOP' | 'BOTTOM';
    grubosc_frontu_mm: number;
    nalozenie_gora_mm: number;
    nalozenie_dol_mm: number;
    nalozenie_lewe_mm: number;
    nalozenie_prawe_mm: number;
    odsuniecie_zawiasu_lewe_mm: number;
    odsuniecie_zawiasu_prawe_mm: number;
    zawias_srodkowy: boolean;
    szablon_zawiasu_domyslny: string;
    szablon_zawiasu_lewy?: string;
    szablon_zawiasu_prawy?: string;
    szablon_zawiasu_srodkowy?: string;
}

export function normalizeFlapsParams(raw: FlapsPlanParams = {}, dims?: BlokiDimensions_mm): NormalizedFlapsParams {
    assertCanonicalFlapsParams(raw);

    const rawType = String(raw.kierunek_klapy ?? 'TOP').toUpperCase();
    const kierunek_klapy: 'TOP' | 'BOTTOM' = rawType === 'BOTTOM' ? 'BOTTOM' : 'TOP';

    const defThick = resolveRuleThicknessMm(flapsRules, ['KLAPA', 'FRONT'], 'front_thickness', 'flaps');
    const grubosc_frontu_mm = readOptionalNumber(raw, 'grubosc_frontu_mm') ?? defThick;
    const nalozenie_gora_mm = readOptionalNumber(raw, 'nalozenie_gora_mm') ?? 14;
    const nalozenie_dol_mm = readOptionalNumber(raw, 'nalozenie_dol_mm') ?? 15;
    const nalozenie_lewe_mm = readOptionalNumber(raw, 'nalozenie_lewe_mm') ?? 16;
    const nalozenie_prawe_mm = readOptionalNumber(raw, 'nalozenie_prawe_mm') ?? 16;

    const odsuniecie_zawiasu_lewe_mm = readOptionalNumber(raw, 'odsuniecie_zawiasu_lewe_mm') ?? 80;
    const odsuniecie_zawiasu_prawe_mm = readOptionalNumber(raw, 'odsuniecie_zawiasu_prawe_mm') ?? 80;
    const zawias_srodkowy = Boolean(raw.zawias_srodkowy);

    const szablon_zawiasu_domyslny = String(raw.szablon_zawiasu_domyslny ?? DEFAULT_HINGE_ID);
    const szablon_zawiasu_lewy = typeof raw.szablon_zawiasu_lewy === 'string' ? raw.szablon_zawiasu_lewy : undefined;
    const szablon_zawiasu_prawy = typeof raw.szablon_zawiasu_prawy === 'string' ? raw.szablon_zawiasu_prawy : undefined;
    const szablon_zawiasu_srodkowy = typeof raw.szablon_zawiasu_srodkowy === 'string' ? raw.szablon_zawiasu_srodkowy : undefined;

    return {
        kierunek_klapy,
        grubosc_frontu_mm,
        nalozenie_gora_mm,
        nalozenie_dol_mm,
        nalozenie_lewe_mm,
        nalozenie_prawe_mm,
        odsuniecie_zawiasu_lewe_mm,
        odsuniecie_zawiasu_prawe_mm,
        zawias_srodkowy,
        szablon_zawiasu_domyslny,
        szablon_zawiasu_lewy,
        szablon_zawiasu_prawy,
        szablon_zawiasu_srodkowy
    };
}

export function calculateFlapsPlan(
    dims_mm: BlokiDimensions_mm,
    params: NormalizedFlapsParams
): BlokiPlanResult {
    const isTop = params.kierunek_klapy !== 'BOTTOM';

    const resolveHingeId = (side: FlapHingeSide): string => {
        if (side === 'left' && params.szablon_zawiasu_lewy) return params.szablon_zawiasu_lewy;
        if (side === 'right' && params.szablon_zawiasu_prawy) return params.szablon_zawiasu_prawy;
        if (side === 'center' && params.szablon_zawiasu_srodkowy) return params.szablon_zawiasu_srodkowy;

        const baseHingeId = params.szablon_zawiasu_domyslny;
        if (baseHingeId === 'BLUM_71B3550' || baseHingeId === 'BLUM_71T3550') {
            if (side === 'right') return 'BLUM_71T3550';
            return 'BLUM_71B3550';
        }
        return baseHingeId;
    };

    const flapWidth_mm = dims_mm.width_mm + params.nalozenie_lewe_mm + params.nalozenie_prawe_mm;
    const flapHeight_mm = dims_mm.height_mm + params.nalozenie_gora_mm + params.nalozenie_dol_mm;
    const posX_mm = (params.nalozenie_prawe_mm - params.nalozenie_lewe_mm) / 2;
    const posZ_mm = dims_mm.height_mm / 2 + (params.nalozenie_gora_mm - params.nalozenie_dol_mm) / 2;
    const posY_mm = -(dims_mm.depth_mm / 2 + params.grubosc_frontu_mm / 2);

    const hingeUCenter = (side: FlapHingeSide): number => {
        if (side === 'left') return params.nalozenie_lewe_mm + params.odsuniecie_zawiasu_lewe_mm;
        if (side === 'right') return flapWidth_mm - params.nalozenie_prawe_mm - params.odsuniecie_zawiasu_prawe_mm;
        return flapWidth_mm / 2 - (params.nalozenie_prawe_mm - params.nalozenie_lewe_mm) / 2;
    };

    const buildHingeFeatures = (side: FlapHingeSide, hingeKey: string) => {
        const uCenter = hingeUCenter(side);
        const hingeId = resolveHingeId(side);
        const frontHoles = hingeFrontHolesMm(hingeId);
        const templateId = hingeTemplateId(hingeId);
        const features: any[] = [];

        for (const hole of frontHoles) {
            const isCup = hole.isCup;
            const v = isTop
                ? flapHeight_mm - hole.edgeDist
                : hole.edgeDist;
            const u = isCup ? uCenter : (uCenter + hole.yOffset);
            const intent = buildHoleMachiningIntent({
                targetNodeId: 'Klapa',
                id: isCup ? `flap_cup_${hingeKey}` : `flap_screw_${hingeKey}_${hole.name || 's'}`,
                face: 'FACE_Z_PLUS',
                side: 'FACE_Z_PLUS',
                template_id: templateId,
                drivenBy: {
                    nodeId: `hinge_${hingeKey.toLowerCase()}`,
                    role: 'HARDWARE',
                    hardwareType: 'HINGE',
                    partKey: hingeKey,
                },
                rule: isCup ? 'cup' : 'screw',
                generatedBy: 'blok_flaps',
                u,
                v,
                diameter: hole.dia,
                depth: hole.depth,
                sourcePartId: hingeKey,
                extraParams: {
                    hinge_id: hingeId,
                    isFlapCup: isCup,
                    isFlapScrew: !isCup,
                    hingeKey: hingeKey,
                    // hingeSide = pozycja L/P/C; nie mylić z orientation drzwi (left/right = oś zawiasu)
                    hingeSide: side,
                    side: side,
                    orientation: isTop ? 'top' : 'bottom',
                    hardwareId: `hinge_${hingeKey.toLowerCase()}`,
                },
            });
            features.push(intent.feature);
        }

        return features;
    };

    const activeHinges: { key: string; side: FlapHingeSide }[] = [];
    if (isTop) {
        activeHinges.push({ key: 'HINGE_TL', side: 'left' });
        activeHinges.push({ key: 'HINGE_TR', side: 'right' });
        if (params.zawias_srodkowy) activeHinges.push({ key: 'HINGE_TC', side: 'center' });
    } else {
        activeHinges.push({ key: 'HINGE_BL', side: 'left' });
        activeHinges.push({ key: 'HINGE_BR', side: 'right' });
        if (params.zawias_srodkowy) activeHinges.push({ key: 'HINGE_BC', side: 'center' });
    }

    const flapRule = (flapsRules as any).model_tree?.root_assembly?.subcomponents?.FLAP;
    const allFeatures = activeHinges.flatMap((h) => buildHingeFeatures(h.side, h.key));

    const flapOverride = (flapsRules as any).parameters?.smart_panel_integration?.role_overrides?.FRONT ||
                         (flapsRules as any).parameters?.smart_panel_integration?.role_overrides?.FLAP ||
                         (flapsRules as any).smart_panel_integration?.role_overrides?.FRONT;
    const edgeBanding = flapOverride?.edge_banding || {
        "+X": { active: true, type_id: "0.008x0.022" },
        "-X": { active: true, type_id: "0.008x0.022" },
        "+Y": { active: true, type_id: "0.008x0.022" },
        "-Y": { active: true, type_id: "0.008x0.022" }
    };

    const parts: BlokiPart[] = [{
        name: 'Klapa',
        role: flapRule?.role || 'FLAP',
        nodeType: 'PART',
        material: 'W1100_ST9_18',
        materialName: 'Biały Alpejski',
        materialCode: 'W1100 ST9',
        dim: { x: flapWidth_mm, y: params.grubosc_frontu_mm, z: flapHeight_mm },
        loc: { x: posX_mm, y: posY_mm, z: posZ_mm },
        lcs: flapRule?.lcs || FLAP_FRONT_LCS,
        edge_banding: edgeBanding,
        features: allFeatures
    }];

    const hardware: BlokiHardware[] = [];
    for (const h of activeHinges) {
        const hingeId = resolveHingeId(h.side);
        const uCenter = hingeUCenter(h.side);
        const frontHoles = hingeFrontHolesMm(hingeId);
        const cupHole = frontHoles.find(hole => hole.isCup);
        const cupEdgeDist = cupHole?.edgeDist ?? DEFAULT_HINGE_CUP_EDGE_DIST_MM;
        const vCenter = isTop ? (flapHeight_mm - cupEdgeDist) : cupEdgeDist;

        const hwX = posX_mm - flapWidth_mm / 2 + uCenter;
        const hwZ = posZ_mm - flapHeight_mm / 2 + vCenter;

        hardware.push({
            id: `hinge_${h.key.toLowerCase()}`,
            name: `Zawias Klapy (${h.side === 'left' ? 'Lewy' : h.side === 'right' ? 'Prawy' : 'Środkowy'}) [${hingeId}]`,
            hardwareType: 'HINGE',
            hardwareId: hingeId,
            side: h.side,
            loc: { x: hwX, y: posY_mm, z: hwZ },
            params: {
                hingeKey: h.key,
                side: h.side,
                isTop
            }
        });
    }

    return { parts, hardware };
}
