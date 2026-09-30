/**
 * standard-geometry.ts
 *
 * Czysta funkcja kalkulacji geometrii formatek korpusu standardowego,
 * rogowego z blendą (korpus_rogowy1) oraz delegat do geometrii specjalnych.
 */

import { rulesMToMm } from '../../A1_core/cad-math/units.js';
import { readBackEdgeOffset } from '../back-overlap.js';
import { CabinetType, CabinetGeometryPart } from '../smartframe-types.js';
import {
    resolveCabinetPartThickness,
    requireCabinetPartThickness,
    CabinetThicknessLookupContext
} from './cabinet-thickness.js';
import { resolveCorner90Geometry } from './corner90-geometry.js';
import {
    resolveSkosnyGeometry,
    resolveSkosnyDachGeometry,
    resolveSkosnyLrGeometry,
    resolveSkosnyLrUcGeometry
} from './skosny-geometry.js';

export interface CabinetPartGeometryContext {
    sb_width: number;
    sb_height: number;
    sb_depth: number;
    back_offset_mm: number;
    back_groove_depth: number;
    zonePrefix?: string;
    zoneId?: string;
    top_panel_mode?: 'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V';
    traverse_width?: number;
    blind_width?: number;
    blind_side?: 'LEFT' | 'RIGHT';
    /** Głębokość lewego boku / ramienia [mm] — korpus_rogowy90. */
    bok_lewy?: number;
    /** Głębokość prawego boku / ramienia [mm] — korpus_rogowy90. */
    bok_prawy?: number;
    cabinet_type?: CabinetType;
    /** Wysokość przodu [mm] — korpus_skosny. */
    height_front?: number;
    /** Wysokość tyłu [mm] — korpus_skosny. */
    height_back?: number;
    /** Wysokość lewego boku [mm] — korpus_skosny_lr. */
    height_left?: number;
    /** Wysokość prawego boku [mm] — korpus_skosny_lr. */
    height_right?: number;
    offsets: Record<string, number>;
    rules?: any;
    baseRules?: any;
    thicknessLookup: CabinetThicknessLookupContext;
}

export function resolveCabinetPartGeometry(
    key: string,
    comp: any,
    ctx: CabinetPartGeometryContext
): Partial<CabinetGeometryPart> | null {
    const W = ctx.sb_width;
    const H = ctx.sb_height;
    const D = ctx.sb_depth;
    const backOffset = ctx.back_offset_mm ?? 0;

    const name = comp.name || key;
    const role = comp.role || "";
    const pYPlus  = ctx.offsets[`${name}_+Y`] || 0;
    const pYMinus = ctx.offsets[`${name}_-Y`] || 0;
    const pXMinus = ctx.offsets[`${name}_-X`] || 0;
    const pXPlus  = ctx.offsets[`${name}_+X`] || 0;

    const shiftX = ctx.offsets[`${name}_shiftX`] || 0;
    const shiftY = ctx.offsets[`${name}_shiftY`] || 0;
    const shiftZ = ctx.offsets[`${name}_shiftZ`] || 0;

    const cleanKey = key.replace(/^(B_|M_|T_)/i, '');
    const matchedKey = cleanKey.toUpperCase();
    const pfx = ctx.zonePrefix || '';

    const customTh = resolveCabinetPartThickness(key, pfx, ctx.thicknessLookup) ??
                     resolveCabinetPartThickness(cleanKey, pfx, ctx.thicknessLookup) ??
                     resolveCabinetPartThickness(name, pfx, ctx.thicknessLookup) ??
                     resolveCabinetPartThickness(role, pfx, ctx.thicknessLookup);

    let thickness: number;
    if (customTh !== undefined) {
        thickness = customTh;
    } else if (comp.thickness !== undefined && comp.thickness !== null) {
        const raw = parseFloat(comp.thickness);
        thickness = !isNaN(raw) ? rulesMToMm(raw) : requireCabinetPartThickness(cleanKey, pfx, ctx.thicknessLookup, [key, name, role]);
    } else {
        thickness = requireCabinetPartThickness(cleanKey, pfx, ctx.thicknessLookup, [key, name, role]);
    }

    const leftThick  = requireCabinetPartThickness("LEFT_SIDE_PANEL", pfx, ctx.thicknessLookup, ["BOK_L", "SIDE_LEFT"]);
    const rightThick = requireCabinetPartThickness("RIGHT_SIDE_PANEL", pfx, ctx.thicknessLookup, ["BOK_P", "SIDE_RIGHT"]);
    const innerWidth = W - leftThick - rightThick;
    const midShift   = (leftThick - rightThick) / 2;

    // Kątownik 90° — osobna geometria (dwa plecy, boki prostopadłe, L-wieńce)
    if (ctx.cabinet_type === 'korpus_rogowy90') {
        const fallbackArmMm = 600;
        const rotXDeg = Number(comp.lcs?.rotation?.[0]);
        const rotYDeg = Number(comp.lcs?.rotation?.[1]);
        return resolveCorner90Geometry(matchedKey, role, {
            W, H, D, thickness, backOffset, shiftX, shiftY, shiftZ,
            pXPlus, pXMinus, pYPlus, pYMinus,
            bok_lewy: ctx.bok_lewy ?? fallbackArmMm,
            bok_prawy: ctx.bok_prawy ?? fallbackArmMm,
            pfx,
            name,
            backGrooveDepth: ctx.back_groove_depth ?? 11,
            rotXDeg: Number.isFinite(rotXDeg)
                ? rotXDeg
                : ((matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') ? 90 : -90),
            rotYDeg: Number.isFinite(rotYDeg)
                ? rotYDeg
                : ((matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') ? 180 : 0),
            offsets: ctx.offsets,
            rules: ctx.rules,
            baseRules: ctx.baseRules,
            thicknessLookup: ctx.thicknessLookup
        });
    }

    // Korpus skośny pod dach — boki L=P (symetria), skos do tyłu, wieniec pochylony w głąb
    if (ctx.cabinet_type === 'korpus_skosny_dach') {
        const hF = Math.max(100, ctx.height_front ?? 1000);
        const hB = Math.max(100, ctx.height_back ?? 2200);
        return resolveSkosnyDachGeometry(matchedKey, role, {
            W, D,
            hF, hB, maxH: Math.max(hF, hB),
            thickness, backOffset, shiftX, shiftY, shiftZ,
            pXPlus, pXMinus, pYPlus, pYMinus,
            leftThick, rightThick, innerWidth, midShift
        });
    }

    // Korpus skośny — prototyp (boki-trapezoidy, wieniec pochylony w głąb, plecy pełne)
    if (ctx.cabinet_type === 'korpus_skosny') {
        const hF = Math.max(100, ctx.height_front ?? 1000);
        const hB = Math.max(100, ctx.height_back ?? 2200);
        return resolveSkosnyGeometry(matchedKey, role, {
            W, D,
            hF, hB, maxH: Math.max(hF, hB),
            thickness, backOffset, shiftX, shiftY, shiftZ,
            pXPlus, pXMinus, pYPlus, pYMinus,
            leftThick, rightThick, innerWidth, midShift
        });
    }

    // Korpus skośny LR (ucio) — wieniec w świetle + cutAngle na stykach z bokami
    if (ctx.cabinet_type === 'korpus_skosny_lr_uc') {
        const hL = Math.max(100, ctx.height_left ?? 1000);
        const hR = Math.max(100, ctx.height_right ?? 2200);
        return resolveSkosnyLrUcGeometry(matchedKey, role, {
            W, D,
            hL, hR, maxH: Math.max(hL, hR),
            thickness, backOffset, shiftX, shiftY, shiftZ,
            pXPlus, pXMinus, pYPlus, pYMinus,
            leftThick, rightThick, innerWidth, midShift
        });
    }

    // Korpus skośny LR — osobna geometria (skos w poprzek: lewy niski / prawy wysoki)
    if (ctx.cabinet_type === 'korpus_skosny_lr') {
        const hL = Math.max(100, ctx.height_left ?? 1000);
        const hR = Math.max(100, ctx.height_right ?? 2200);
        return resolveSkosnyLrGeometry(matchedKey, role, {
            W, D,
            hL, hR, maxH: Math.max(hL, hR),
            thickness, backOffset, shiftX, shiftY, shiftZ,
            pXPlus, pXMinus, pYPlus, pYMinus,
            leftThick, rightThick, innerWidth, midShift
        });
    }

    if (matchedKey === "BOK_L" || matchedKey === "SIDE_LEFT" || role === "LEFT_SIDE_PANEL") {
        return {
            thickness,
            dim: { x: H + pYPlus + pYMinus, y: D + pXMinus + pXPlus, z: thickness },
            loc: { x: -W / 2 + thickness / 2 + shiftX, y: (pXPlus - pXMinus) / 2 + shiftY, z: H / 2 + (pYPlus - pYMinus) / 2 + shiftZ }
        };
    }
    if (matchedKey === "BOK_P" || matchedKey === "SIDE_RIGHT" || role === "RIGHT_SIDE_PANEL") {
        return {
            thickness,
            dim: { x: H + pYPlus + pYMinus, y: D + pXMinus + pXPlus, z: thickness },
            loc: { x: W / 2 - thickness / 2 + shiftX, y: (pXPlus - pXMinus) / 2 + shiftY, z: H / 2 + (pYPlus - pYMinus) / 2 + shiftZ }
        };
    }
    if (matchedKey === "WIENIEC_D" || matchedKey === "BOTTOM" || role === "BOTTOM_PANEL") {
        return {
            thickness,
            dim: { x: innerWidth + pYMinus + pYPlus, y: D + pXMinus + pXPlus, z: thickness },
            loc: { x: midShift + (pYPlus - pYMinus) / 2, y: (pXPlus - pXMinus) / 2, z: thickness / 2 - shiftZ }
        };
    }
    if (matchedKey === "WIENIEC_S" || matchedKey === "SHELF" || role === "SHELF") {
        return {
            thickness,
            dim: { x: innerWidth + pYMinus + pYPlus, y: D + pXMinus + pXPlus, z: thickness },
            loc: { x: midShift + (pYPlus - pYMinus) / 2, y: (pXPlus - pXMinus) / 2, z: H / 2 + shiftZ }
        };
    }
    if (matchedKey === "WIENIEC_G" || matchedKey === "TOP" || role === "TOP_PANEL") {
        const mode = ctx.top_panel_mode || 'FULL';
        const isWieniecGT2 = key.endsWith("_T2");

        if (mode === 'TRAVERSE_H') {
            const trWidth = ctx.traverse_width || 80;
            const isFront = !isWieniecGT2;
            const baseY = isFront ? (-D / 2 + trWidth / 2) : (D / 2 - trWidth / 2);
            return {
                thickness,
                dim: { x: innerWidth + pYMinus + pYPlus, y: trWidth + pXMinus + pXPlus, z: thickness },
                loc: {
                    x: midShift + (pYPlus - pYMinus) / 2,
                    y: baseY + (pXPlus - pXMinus) / 2,
                    z: H - thickness / 2 + shiftZ
                }
            };
        } else if (mode === 'TRAVERSE_V') {
            const trWidth = ctx.traverse_width || 80;
            const isFront = !isWieniecGT2;
            const baseY = isFront ? (-D / 2 + thickness / 2) : (D / 2 - thickness / 2);
            return {
                thickness,
                dim: { x: innerWidth + pYMinus + pYPlus, y: thickness + pXMinus + pXPlus, z: trWidth },
                loc: {
                    x: midShift + (pYPlus - pYMinus) / 2,
                    y: baseY + (pXPlus - pXMinus) / 2,
                    z: H - trWidth / 2 + shiftZ
                },
                lcs: {
                    mapping: { X: 'x', Y: 'z', Z: 'y' },
                    rotation: [180, 0, 0],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                }
            };
        } else {
            if (isWieniecGT2) return null;
            return {
                thickness,
                dim: { x: innerWidth + pYMinus + pYPlus, y: D + pXMinus + pXPlus, z: thickness },
                loc: { x: midShift + (pYPlus - pYMinus) / 2, y: (pXPlus - pXMinus) / 2, z: H - thickness / 2 + shiftZ }
            };
        }
    }
    if (matchedKey === "PLECY" || matchedKey === "BACK" || role === "BACK_PANEL") {
        const defaultGroove = ctx.back_groove_depth || 11;
        const overlapLeft   = readBackEdgeOffset(ctx.offsets, name, '-X', defaultGroove, pfx);
        const overlapRight  = readBackEdgeOffset(ctx.offsets, name, '+X', defaultGroove, pfx);
        const overlapBottom = readBackEdgeOffset(ctx.offsets, name, '-Y', defaultGroove, pfx);
        const overlapTop    = readBackEdgeOffset(ctx.offsets, name, '+Y', defaultGroove, pfx);

        const bottomThick = requireCabinetPartThickness("BOTTOM", pfx, ctx.thicknessLookup, ["WIENIEC_D"]);
        const topThick    = requireCabinetPartThickness("TOP", pfx, ctx.thicknessLookup, ["WIENIEC_G"]);
        const innerH      = H - bottomThick - topThick;

        const backW       = innerWidth + overlapLeft + overlapRight;
        const backH       = innerH + overlapBottom + overlapTop;
        const backY       = D / 2 + thickness / 2 - backOffset + shiftY;
        return {
            thickness,
            dim: { x: backW, y: thickness, z: backH },
            loc: {
                x: midShift + (overlapRight - overlapLeft) / 2,
                y: backY,
                z: bottomThick - overlapBottom + backH / 2
            }
        };
    }

    if (
        matchedKey === "PANEL_ZASLEPIAJACY" ||
        matchedKey === "BLIND" ||
        matchedKey === "BLIND_PANEL" ||
        role === "BLIND_PANEL"
    ) {
        const bottomThick = requireCabinetPartThickness("BOTTOM", pfx, ctx.thicknessLookup, ["WIENIEC_D"]);
        const topThick    = requireCabinetPartThickness("TOP", pfx, ctx.thicknessLookup, ["WIENIEC_G"]);
        const innerH      = H - bottomThick - topThick;

        const rulesDefaults = ctx.rules?.parameters?.defaults || ctx.baseRules?.parameters?.defaults || {};
        const validation = ctx.rules?.parameters?.validation || ctx.baseRules?.parameters?.validation || {};
        const minBlind = rulesMToMm(validation.min_blind_width ?? 0.05);
        const defaultBlind = rulesMToMm(rulesDefaults.blind_width ?? 0.4);
        let blindW = ctx.blind_width ?? defaultBlind;
        const maxBlind = Math.max(minBlind, innerWidth - 1);
        blindW = Math.max(minBlind, Math.min(blindW, maxBlind));

        const sideRaw = (ctx.blind_side || rulesDefaults.blind_side || 'LEFT').toString().toUpperCase();
        const side: 'LEFT' | 'RIGHT' = sideRaw === 'RIGHT' ? 'RIGHT' : 'LEFT';

        const construction = ctx.rules?.cabinet_construction_rules?.defaults
            || ctx.baseRules?.cabinet_construction_rules?.defaults
            || {};
        const frontInset = rulesMToMm(construction.blind_front_inset ?? 0);

        const locY = -D / 2 + thickness / 2 + frontInset + shiftY;
        const locX = side === 'RIGHT'
            ? (W / 2 - rightThick - blindW / 2 + shiftX)
            : (-W / 2 + leftThick + blindW / 2 + shiftX);
        const locZ = bottomThick + innerH / 2 + shiftZ;

        return {
            thickness,
            dim: { x: blindW + pXMinus + pXPlus, y: thickness, z: innerH + pYMinus + pYPlus },
            loc: {
                x: locX + (pXPlus - pXMinus) / 2,
                y: locY,
                z: locZ + (pYPlus - pYMinus) / 2
            }
        };
    }

    console.warn(`[resolveCabinetPartGeometry] Nieznany węzeł geometrii: "${key}" (role: "${role}")`);
    return null;
}
