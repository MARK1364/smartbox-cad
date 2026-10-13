/**
 * A2_bloki/hangers-engine.ts
 *
 * Funkcyjny rdzeń dedykowanego silnika ZAWIESZEK (HANGERS).
 * Oblicza rozmieszczenie brył okuć (BlokiHardware) w układzie wnęki kontenera Bloki.
 * Czysta funkcja bez zależności od Reacta i DOM.
 * Jednostki fizyczne: mm (_mm).
 */

import type { BlokiDimensions_mm, BlokiHardware, BlokiPlanResult } from './bloki-types.js';
import type { HangersPlanParams, HangerSetDefinition } from './hangers-types.js';
import { resolveActiveHangerSet } from './hangers-types.js';
import { getHardware } from '../B1_biblioteka/index.js';

export function normalizeHangersParams(
    raw: Partial<HangersPlanParams> | undefined,
    _dims_mm: BlokiDimensions_mm
): Required<HangersPlanParams> {
    return {
        szablon_id: String(raw?.szablon_id || 'TT2'),
        zestaw_id: String(raw?.zestaw_id || ''),
        odsuniecie_bok_mm: Number.isFinite(Number(raw?.odsuniecie_bok_mm)) ? Number(raw!.odsuniecie_bok_mm) : 0,
        odsuniecie_tyl_mm: Number.isFinite(Number(raw?.odsuniecie_tyl_mm)) ? Number(raw!.odsuniecie_tyl_mm) : 0,
        odsuniecie_gora_mm: Number.isFinite(Number(raw?.odsuniecie_gora_mm)) ? Number(raw!.odsuniecie_gora_mm) : 0,
        parametry_zestawu: (raw?.parametry_zestawu && typeof raw.parametry_zestawu === 'object')
            ? { ...raw.parametry_zestawu }
            : {},
    };
}

function resolvePartPosInBayMm(
    dims: BlokiDimensions_mm,
    part: any,
    extraOffset: { bok_mm: number; tyl_mm: number; gora_mm: number }
): { x: number; y: number; z: number } {
    const W = dims.width_mm;
    const H = dims.height_mm;
    const D = dims.depth_mm;

    const refX = String(part.refX || 'CENTER').toUpperCase();
    const refY = String(part.refY || 'CENTER').toUpperCase();
    const refZ = String(part.refZ || 'CENTER').toUpperCase();

    const offX = (Number(part.offsetX_mm) || 0) + extraOffset.bok_mm;
    const offY = (Number(part.offsetY_mm) || 0) + extraOffset.tyl_mm;
    const offZ = (Number(part.offsetZ_mm) || 0) + extraOffset.gora_mm;

    // Pozycja w układzie wnęki [0 do W, 0 do D, 0 do H]
    const bayX = refX === 'LEFT' ? offX : refX === 'RIGHT' ? W - offX : W / 2 + offX;
    const bayD = refY === 'BACK' ? offY : refY === 'FRONT' ? D - offY : D / 2 + offY;
    const bayH = refZ === 'BOTTOM' ? offZ : refZ === 'TOP' ? H - offZ : H / 2 + offZ;

    // Przeliczenie na lokalny układ kontenera Bloki:
    // X w [-W/2, +W/2]
    // Y w [-D/2, +D/2] (plecy = +D/2, przód = -D/2)
    // Z w [0, H]
    return {
        x: Math.round((bayX - W / 2) * 100) / 100,
        y: Math.round((D / 2 - bayD) * 100) / 100,
        z: Math.round(bayH * 100) / 100,
    };
}

/**
 * Główna funkcja wyliczająca plan zawieszek dla danego gabarytu wnęki.
 */
export function calculateHangersPlan(
    dims_mm: BlokiDimensions_mm,
    params: HangersPlanParams,
    definitionOrSet?: any
): BlokiPlanResult {
    const norm = normalizeHangersParams(params, dims_mm);

    let setDef: HangerSetDefinition | null = null;
    if (definitionOrSet) {
        setDef = resolveActiveHangerSet(definitionOrSet, norm.zestaw_id, norm.szablon_id);
    }

    if (!setDef) {
        const hw = getHardware(norm.szablon_id);
        const def = (hw as any)?.definition || hw;
        if (def) {
            setDef = resolveActiveHangerSet(def, norm.zestaw_id, norm.szablon_id);
        }
    }

    if (!setDef || !Array.isArray(setDef.parts) || setDef.parts.length === 0) {
        return { parts: [], hardware: [] };
    }

    const hardware: BlokiHardware[] = [];
    const extraOffset = {
        bok_mm: norm.odsuniecie_bok_mm,
        tyl_mm: norm.odsuniecie_tyl_mm,
        gora_mm: norm.odsuniecie_gora_mm,
    };

    for (let i = 0; i < setDef.parts.length; i++) {
        const part = setDef.parts[i];
        if (part?.frozen === true) continue;

        const partW = Math.max(1, Number(part.widthMm) || 20);
        const partH = Math.max(1, Number(part.heightMm) || 40);
        const partD = Math.max(1, Number(part.depthMm) || 70);

        const loc = resolvePartPosInBayMm(dims_mm, part, extraOffset);
        const partId = String(part.id || `part_${i + 1}`);
        const partName = String(part.name || `Zawieszka_${i + 1}`);

        const glbModel = part.glbPath || setDef.visual?.glb || '';

        hardware.push({
            id: `hanger_${setDef.id}_${partId}_${i}`,
            name: partName,
            role: 'HARDWARE',
            hardwareType: 'OTHER',
            hardwareId: setDef.id,
            loc,
            dim: { x: partW, y: partD, z: partH },
            params: {
                glbModelPath: glbModel || undefined,
                colorHex: part.colorHex || '#38bdf8',
                partId,
                setId: setDef.id,
                templateId: norm.szablon_id,
            },
            customProperties: {
                part,
                setDefinition: setDef,
            },
        });
    }

    return {
        parts: [],
        hardware,
    };
}
