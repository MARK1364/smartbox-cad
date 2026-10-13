/**
 * corner90-geometry.ts
 *
 * Czysta funkcja kalkulacji geometrii korpusu kątowego 90° (korpus_rogowy90).
 * Cechy:
 *  - Dwa prostopadłe plecy (PLECY_X i PLECY_Y) ze stykiem 0 mm w rogu i 11 mm przy bokach/wieńcach
 *  - Listwa narożna (CORNER_NAILER) w osi styku pleców
 *  - Dwa prostopadłe boki końcowe (Bok_P w YZ, Bok_L w XZ)
 *  - Dwie pojedyncze płyty kątowe L (wieniec górny i dolny) z konturem 2D (outline2d)
 */

import { readBackEdgeOffset } from '../back-overlap.js';
import { rulesMToMm } from '../../A1_core/cad-math/units.js';
import { CabinetGeometryPart } from '../smartframe-types.js';
import {
    resolveCabinetPartThickness,
    requireCabinetPartThickness,
    CabinetThicknessLookupContext
} from './cabinet-thickness.js';

export interface Corner90GeometryContext {
    W: number;
    H: number;
    D: number;
    thickness: number;
    backOffset: number;
    shiftX: number;
    shiftY: number;
    shiftZ: number;
    pXPlus: number;
    pXMinus: number;
    pYPlus: number;
    pYMinus: number;
    bok_lewy: number;
    bok_prawy: number;
    pfx: string;
    name: string;
    backGrooveDepth: number;
    /** LCS rotation[0] ° — +90 dół / −90 góra w JSON; UV z tego, nie z roli. */
    rotXDeg: number;
    /** LCS rotation[1] ° — 180 = obrót 180° wokół grubości (niebieska oś LCS Z na ekranie). */
    rotYDeg?: number;
    offsets: Record<string, number>;
    rules?: any;
    baseRules?: any;
    thicknessLookup: CabinetThicknessLookupContext;
}

export function resolveCorner90Geometry(
    matchedKey: string,
    role: string,
    ctx: Corner90GeometryContext
): Partial<CabinetGeometryPart> | null {
    const { W, H, D, thickness, backOffset, shiftX, shiftY, shiftZ } = ctx;
    const { pXPlus, pXMinus, pYPlus, pYMinus, pfx, name, offsets, thicknessLookup } = ctx;

    const defOverlap = ctx.backGrooveDepth ?? 11;
    const cornerOverlap = 0;

    const backThY = requireCabinetPartThickness("PLECY_Y", pfx, thicknessLookup, ["BACK_PANEL", "PLECY"]);
    const backThX = resolveCabinetPartThickness("PLECY_X", pfx, thicknessLookup) ?? backThY;
    const bokPTh = requireCabinetPartThickness("RIGHT_SIDE_PANEL", pfx, thicknessLookup, ["BOK_P", "BOK_X"]);
    const bokLTh = requireCabinetPartThickness("LEFT_SIDE_PANEL", pfx, thicknessLookup, ["BOK_L", "BOK_Y"]);
    const bottomThick = requireCabinetPartThickness("BOTTOM", pfx, thicknessLookup, ["WIENIEC_D"]);
    const topThick = requireCabinetPartThickness("TOP", pfx, thicknessLookup, ["WIENIEC_G"]);

    const minBok = 50;
    const bok_lewy = Math.max(minBok, Math.min(ctx.bok_lewy || 600, W - 50));
    const bok_prawy = Math.max(minBok, Math.min(ctx.bok_prawy || 600, D - 50));

    // —— Plecy wzdłuż X (ściana +Y) —— jak BACK_PANEL w Korpus3
    if (matchedKey === "PLECY_Y" || matchedKey === "BACK_Y") {
        const overlapLeft   = readBackEdgeOffset(offsets, name, '-X', cornerOverlap, pfx);
        const overlapRight  = readBackEdgeOffset(offsets, name, '+X', defOverlap, pfx);
        const overlapBottom = readBackEdgeOffset(offsets, name, '-Y', defOverlap, pfx);
        const overlapTop    = readBackEdgeOffset(offsets, name, '+Y', defOverlap, pfx);

        const innerW = Math.max(1, W - backThX - bokPTh);
        const innerH = Math.max(1, H - bottomThick - topThick);
        const backW = innerW + overlapLeft + overlapRight;
        const backH = innerH + overlapBottom + overlapTop;
        const midX = (-W / 2 + backThX + W / 2 - bokPTh) / 2;

        return {
            thickness,
            dim: { x: backW, y: thickness, z: backH },
            loc: {
                x: midX + (overlapRight - overlapLeft) / 2 + shiftX,
                y: D / 2 + thickness / 2 - backOffset - shiftY,
                z: bottomThick - overlapBottom + backH / 2 + shiftZ
            }
        };
    }

    // —— Plecy wzdłuż Y (ściana −X) —— orientacja jak bok, zakładka jak Korpus3
    if (matchedKey === "PLECY_X" || matchedKey === "BACK_X") {
        const overlapBottom = readBackEdgeOffset(offsets, name, '-Y', defOverlap, pfx);
        const overlapTop    = readBackEdgeOffset(offsets, name, '+Y', defOverlap, pfx);
        const overlapFront  = readBackEdgeOffset(offsets, name, '-X', defOverlap, pfx);
        const overlapBack   = readBackEdgeOffset(offsets, name, '+X', cornerOverlap, pfx);

        const innerH = Math.max(1, H - bottomThick - topThick);
        const innerD = Math.max(1, D - bokLTh - backThY);
        const backH = innerH + overlapBottom + overlapTop;
        const backD = innerD + overlapFront + overlapBack;
        const midY = (-D / 2 + bokLTh + D / 2 - backThY) / 2;

        return {
            thickness,
            dim: { x: backH, y: backD, z: thickness },
            loc: {
                x: -W / 2 + thickness / 2 + shiftX,
                y: midY + (overlapBack - overlapFront) / 2 + shiftY,
                z: bottomThick - overlapBottom + backH / 2 + shiftZ
            }
        };
    }

    // —— Listwa narożna (kotwica pod zszywki w styku PLECY_X / PLECY_Y) ——
    if (
        matchedKey === "LISTWA_NAROZNA" ||
        matchedKey === "KOTWICA_ROG" ||
        matchedKey === "CORNER_NAILER" ||
        (role === "VERTICAL_DIVIDER" && (String(name).toUpperCase().includes("NAROZ") || String(name).toUpperCase().includes("KOTWICA")))
    ) {
        const rulesDefaults = ctx.rules?.parameters?.defaults || ctx.baseRules?.parameters?.defaults || {};
        const nailerW = rulesMToMm(rulesDefaults.corner_nailer_width ?? 0.1);
        const innerH = Math.max(1, H - bottomThick - topThick);
        const nailerH = innerH;
        const nailerThick = thickness;

        const locX = -W / 2 + backThX + nailerThick / 2 + shiftX;
        const locY = D / 2 - backOffset - nailerW / 2 + shiftY;
        const locZ = bottomThick + innerH / 2 + shiftZ;

        return {
            thickness: nailerThick,
            dim: { x: nailerH, y: nailerW, z: nailerThick },
            loc: { x: locX, y: locY, z: locZ },
            lcs: {
                mapping: { X: 'y', Y: 'x', Z: 'z' },
                rotation: [0, 0, -90]
            }
        };
    }

    // —— BOK_P (przy +X, prostopadły do osi X — grubość w X, głębokość ramienia w Y) ——
    if (matchedKey === "BOK_P" || matchedKey === "BOK_X" || role === "RIGHT_SIDE_PANEL") {
        return {
            thickness,
            dim: { x: H + pYPlus + pYMinus, y: bok_prawy + pXMinus + pXPlus, z: thickness },
            loc: {
                x: W / 2 - thickness / 2 + shiftX,
                y: D / 2 - bok_prawy / 2 + (pXPlus - pXMinus) / 2 + shiftY,
                z: H / 2 + (pYPlus - pYMinus) / 2 + shiftZ
            }
        };
    }

    // —— BOK_L (przy −Y, prostopadły do osi Y — grubość w Y, szerokość ramienia w X) ——
    if (matchedKey === "BOK_L" || matchedKey === "BOK_Y" || role === "LEFT_SIDE_PANEL") {
        return {
            thickness,
            dim: { x: bok_lewy + pXMinus + pXPlus, y: thickness, z: H + pYPlus + pYMinus },
            loc: {
                x: -W / 2 + bok_lewy / 2 + (pXPlus - pXMinus) / 2 + shiftX,
                y: -D / 2 + thickness / 2 + shiftY,
                z: H / 2 + (pYPlus - pYMinus) / 2 + shiftZ
            },
            lcs: {
                mapping: { X: "x", Y: "z", Z: "y" },
                rotation: [0, 0, 0]
            }
        };
    }

    // —— WIENIEC_D / WIENIEC_G (jedna płyta kątowa L z wycięciem pod narożnik) ——
    if (
        matchedKey === "WIENIEC_D" || matchedKey === "BOTTOM" || role === "BOTTOM_PANEL" ||
        matchedKey === "WIENIEC_G" || matchedKey === "TOP" || role === "TOP_PANEL"
    ) {
        const isBottom = matchedKey === "WIENIEC_D" || matchedKey === "BOTTOM" || role === "BOTTOM_PANEL";
        const plateW = W;
        const plateD = D;
        const locX = (pXPlus - pXMinus) / 2 + shiftX;
        const locY = (pYPlus - pYMinus) / 2 + shiftY;
        const x0 = locX - plateW / 2;
        const x1 = locX + plateW / 2;
        const y0 = locY - plateD / 2;
        const y1 = locY + plateD / 2;

        const worldL: [number, number][] = [
            [x0, y0 + bokLTh],
            [x0 + bok_lewy, y0 + bokLTh],
            [x0 + bok_lewy, y1 - bok_prawy],
            [x1 - bokPTh, y1 - bok_prawy],
            [x1 - bokPTh, y1],
            [x0, y1]
        ];

        const rotX = ctx.rotXDeg;
        const flipU = Math.abs(Number(ctx.rotYDeg) || 0) > 90;
        const flipV = rotX > 0 && !flipU;
        const outlineUv = worldL.map(([wx, wy]) => {
            const u = flipU
                ? locX + plateW / 2 - wx
                : wx - locX + plateW / 2;
            const v = flipV
                ? locY + plateD / 2 - wy
                : wy - locY + plateD / 2;
            return [u, v] as [number, number];
        });

        const outline2d = rotX > 0 ? outlineUv.slice().reverse() : outlineUv;
        const locZ = isBottom
            ? (thickness / 2 - shiftZ)
            : (H - thickness / 2 + shiftZ);

        return {
            thickness,
            dim: { x: plateW, y: plateD, z: thickness },
            loc: { x: locX, y: locY, z: locZ },
            customProperties: {
                shape: 'L_NOTCH',
                outline2d
            }
        };
    }

    console.warn(`[resolveCorner90Geometry] Rogowy90: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}
