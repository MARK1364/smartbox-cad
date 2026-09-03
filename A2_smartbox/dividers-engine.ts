/**
 * dividers-engine.ts — moduł PRZEGRODY (smartbox_dividers)
 * Odpowiednik @@BLENDER/A2_smartbox/dividers_2_engine_v1.py + dividers_3_rules_V1.json
 *
 * Pionowe przegrody we wnętrzu SmartBoxa. Bez nawierceń (machining_library puste).
 * Origin SmartBoxa w web: Z=0 to spód strefy (w Blenderze środek → tu loc.z = height/2).
 *
 * EQUAL: równe wnęki wewnętrzne, grubość płyty wliczona (inaczej ostatnia wnęka
 * byłaby cieńsza o count×18 mm). CUSTOM: wnęka i = światło PRZED i-tą przegrodą,
 * reszta za ostatnią przegrodą.
 */
import dividersRules from './dividers_3_rules_V1.json';
import { BaseEngine, type ModuleDims } from './base-engine.js';
import { rulesMToMm } from '../A1_core/cad-math/units.js';

const SIDE_L_LCS = {
    mapping: { X: 'y', Y: 'x', Z: 'z' },
    rotation: [0, 0, -90],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const MAX_DIVIDERS = 5;
const DEFAULT_SECTION_MM = 200;

function defaultThicknessMm(): number {
    return rulesMToMm((dividersRules as any).parameters?.defaults?.thickness, 18);
}

export interface DividerSlot {
    index: number;
    xCenter: number;
    bayBefore: number;
}

export interface DividerLayout {
    count: number;
    width: number;
    height: number;
    depth: number;
    thickness: number;
    spacingMode: 'EQUAL' | 'CUSTOM';
    bays: number[];
    lastBay: number;
    lastBayOutOfPanel: boolean;
    slots: DividerSlot[];
}

function readSectionWidths(params: any, count: number): number[] {
    const fromArray: number[] = params.sectionWidths || params.section_widths || [];
    const widths: number[] = [];
    for (let i = 1; i <= count; i++) {
        const named = params[`section_${i}_width`];
        let v = fromArray[i - 1];
        if (v === undefined && named !== undefined) v = named;
        v = Number(v);
        if (!Number.isFinite(v) || v <= 0) v = DEFAULT_SECTION_MM;
        widths.push(v);
    }
    return widths;
}

export function equalBayWidth(width: number, count: number, thickness: number): number {
    if (count <= 0) return width;
    const remaining = width - count * thickness;
    return remaining / (count + 1);
}

export function resolveDividerLayout(params: any, dims: ModuleDims): DividerLayout {
    const width = dims.width || 600;
    const height = dims.height || 720;
    const depth = dims.depth || 500;
    const thickness = params.thickness !== undefined ? params.thickness : defaultThicknessMm();
    const count = Math.max(0, Math.min(MAX_DIVIDERS, Math.round(params.count ?? params.dividerCount ?? 2)));
    const spacingMode = String(params.spacingMode || params.spacing_mode || 'EQUAL').toUpperCase() === 'CUSTOM'
        ? 'CUSTOM'
        : 'EQUAL';

    let bays: number[];
    if (count <= 0) {
        bays = [];
    } else if (spacingMode === 'CUSTOM') {
        bays = readSectionWidths(params, count);
    } else {
        const eq = equalBayWidth(width, count, thickness);
        bays = Array.from({ length: count }, () => eq);
    }

    const used = bays.reduce((s, v) => s + v, 0) + count * thickness;
    const lastBay = width - used;

    const slots: DividerSlot[] = [];
    let currentX = -width / 2;
    for (let i = 0; i < count; i++) {
        currentX += bays[i];
        const xCenter = currentX + thickness / 2;
        slots.push({ index: i + 1, xCenter, bayBefore: bays[i] });
        currentX += thickness;
    }

    return {
        count, width, height, depth, thickness, spacingMode, bays, lastBay,
        lastBayOutOfPanel: count > 0 && lastBay < 10,
        slots
    };
}

export class DividersEngine extends BaseEngine {
    plan(params: any): { parts: any[] } {
        const dims: ModuleDims = {
            width: params.width || 600,
            height: params.height || 720,
            depth: params.depth || 500
        };
        const layout = resolveDividerLayout(params, dims);
        const roleOverride = (dividersRules as any).parameters?.smart_panel_integration?.role_overrides?.DIVIDER_PLATE;
        // JSON okleja -X (FRONT w rotacji Blendera). W web LCS boku FRONT to -Y.
        const edgeBanding = {
            "+X": { active: false, type_id: "none" },
            "-X": { active: false, type_id: "none" },
            "+Y": { active: false, type_id: "none" },
            "-Y": { active: true, type_id: roleOverride?.edge_banding?.["-X"]?.type_id || "0.008x0.022" }
        };

        return {
            parts: layout.slots.map((slot) => ({
                name: `Przegroda_${slot.index}`,
                key: `DIVIDERS_${slot.index}`,
                role: 'DIVIDER_PLATE',
                dim: { x: layout.height, y: layout.depth, z: layout.thickness },
                loc: { x: slot.xCenter, y: 0, z: layout.height / 2 },
                lcs: SIDE_L_LCS,
                edge_banding: edgeBanding,
                features: []
            }))
        };
    }
}
