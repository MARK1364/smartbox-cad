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
import { UIController } from '../../A1_core/ui-controller.js';

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
    szerokosc_listwy_naroznej_mm?: number;
    typ_listwy_naroznej?: 'POJEDYNCZA' | 'KATOWA_90' | 'BRAK';
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

    const minBok = 10;
    const maxBokL = W - 10;
    const maxBokP = D - 10;
    const reqBokL = ctx.bok_lewy || 600;
    const reqBokP = ctx.bok_prawy || 600;

    const bok_lewy = Math.max(minBok, Math.min(reqBokL, maxBokL));
    const bok_prawy = Math.max(minBok, Math.min(reqBokP, maxBokP));

    if (matchedKey === "WIENIEC_D" && (reqBokL > maxBokL || reqBokL < minBok || reqBokP > maxBokP || reqBokP < minBok)) {
        const msg = reqBokL > maxBokL
            ? `⚠️ Ramię lewe korpusu (${reqBokL} mm) przekracza szerokość szafki — zredukowano do ${bok_lewy} mm`
            : reqBokP > maxBokP
            ? `⚠️ Ramię prawe korpusu (${reqBokP} mm) przekracza głębokość szafki — zredukowano do ${bok_prawy} mm`
            : `⚠️ Ramię szafki narożnej mniejsze niż minimalne ${minBok} mm — ustawiono ${minBok} mm`;
        UIController.instance?.setStatus(msg, true, 'warning');
    }

    // Odsunięcie lica WEWNĘTRZNEGO pleców od ściany zewnętrznej korpusu [mm]:
    // Jeśli wartość ustawiono gizmem (offsets), bierzemy ją bezpośrednio (bezwzględne cofnięcie).
    // W przeciwnym razie cofnięcie równe domyślnemu cofnięciu korpusu (backOffset, standardowo 3 mm).
    const readBackInset = (stem: string, suffix: 'shiftX' | 'shiftY'): number => {
        const candidates = [`${pfx}${stem}`, stem, `B_${stem}`].map(c => `${c}_${suffix}`.toUpperCase());
        if (offsets) {
            for (const [k, v] of Object.entries(offsets)) {
                if (candidates.includes(k.toUpperCase()) && v !== undefined && v !== null && Number.isFinite(Number(v))) {
                    return Number(v);
                }
            }
        }
        return backOffset;
    };
    // PLECY_X: loc.x = −W/2 − T/2 + insetX_mm → lico wewn. = −W/2 + insetX_mm
    const insetX_mm = readBackInset('PLECY_X', 'shiftX');
    // PLECY_Y: loc.y = D/2 + T/2 − insetY_mm → lico wewn. = D/2 − insetY_mm
    const insetY_mm = readBackInset('PLECY_Y', 'shiftY');

    // —— Plecy wzdłuż X (ściana +Y) —— jak BACK_PANEL w Korpus3
    if (matchedKey === "PLECY_Y" || matchedKey === "BACK_Y") {
        const overlapLeft   = readBackEdgeOffset(offsets, name, '-X', cornerOverlap, pfx);
        const overlapRight  = readBackEdgeOffset(offsets, name, '+X', defOverlap, pfx);
        const overlapBottom = readBackEdgeOffset(offsets, name, '-Y', defOverlap, pfx);
        const overlapTop    = readBackEdgeOffset(offsets, name, '+Y', defOverlap, pfx);

        // Lewy koniec pleców Y = lico wewnętrzne pleców X (styk w narożniku).
        const innerW = Math.max(1, W - insetX_mm - bokPTh);
        const innerH = Math.max(1, H - bottomThick - topThick);
        const backW = innerW + overlapLeft + overlapRight;
        const backH = innerH + overlapBottom + overlapTop;
        const midX = (-W / 2 + insetX_mm + W / 2 - bokPTh) / 2;

        return {
            thickness,
            dim: { x: backW, y: thickness, z: backH },
            loc: {
                x: midX + (overlapRight - overlapLeft) / 2 + shiftX,
                y: D / 2 + thickness / 2 - insetY_mm,
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
        // Tylny koniec pleców X = lico wewnętrzne pleców Y (styk w narożniku).
        const innerD = Math.max(1, D - insetY_mm - bokLTh);
        const backH = innerH + overlapBottom + overlapTop;
        const backD = innerD + overlapFront + overlapBack;
        const midY = (-D / 2 + bokLTh + D / 2 - insetY_mm) / 2;

        return {
            thickness,
            dim: { x: backH, y: backD, z: thickness },
            loc: {
                x: -W / 2 - thickness / 2 + insetX_mm,
                y: midY + (overlapBack - overlapFront) / 2 + shiftY,
                z: bottomThick - overlapBottom + backH / 2 + shiftZ
            }
        };
    }

    const isNailer2 = matchedKey === "LISTWA_NAROZNA_2" ||
                      matchedKey === "KOTWICA_ROG_2" ||
                      matchedKey === "CORNER_NAILER_2" ||
                      (role === "VERTICAL_DIVIDER" && String(name).toUpperCase().includes("2"));

    const isNailer1 = !isNailer2 && (
        matchedKey === "LISTWA_NAROZNA" ||
        matchedKey === "KOTWICA_ROG" ||
        matchedKey === "CORNER_NAILER" ||
        (role === "VERTICAL_DIVIDER" && (String(name).toUpperCase().includes("NAROZ") || String(name).toUpperCase().includes("KOTWICA")))
    );

    // —— Listwa narożna 2 (ramię wzdłuż X przy trybie KATOWA_90) ——
    if (isNailer2) {
        const rulesDefaults = ctx.rules?.parameters?.defaults || ctx.baseRules?.parameters?.defaults || {};
        const nailerW = ctx.szerokosc_listwy_naroznej_mm ?? rulesMToMm(rulesDefaults.corner_nailer_width ?? 0.1);
        const innerH = Math.max(1, H - bottomThick - topThick);
        const nailerH = innerH;
        const nailerThick = thickness;
        const nailerLenX = Math.max(1, nailerW - nailerThick);

        return {
            thickness: nailerThick,
            dim: {
                x: nailerLenX + pXMinus + pXPlus,
                y: nailerThick,
                z: nailerH + pYPlus + pYMinus
            },
            loc: {
                x: -W / 2 + insetX_mm + nailerLenX / 2 + (pXPlus - pXMinus) / 2 + shiftX,
                y: D / 2 - insetY_mm - nailerW + nailerThick / 2 + shiftY,
                z: bottomThick + innerH / 2 + (pYPlus - pYMinus) / 2 + shiftZ
            },
            lcs: {
                mapping: { X: 'x', Y: 'z', Z: 'y' },
                rotation: [0, 0, 0]
            },
            edge_banding: {
                '-X': { active: true, type_id: '0.008x0.022' },
                '+X': { active: false, type_id: 'none' },
                '+Y': { active: false, type_id: 'none' },
                '-Y': { active: true, type_id: '0.008x0.022' }
            }
        };
    }

    // —— Listwa narożna 1 (ramię wzdłuż Y: płasko do pleców X w POJEDYNCZA lub wysunięte w KATOWA_90) ——
    if (isNailer1) {
        const rulesDefaults = ctx.rules?.parameters?.defaults || ctx.baseRules?.parameters?.defaults || {};
        const nailerW = ctx.szerokosc_listwy_naroznej_mm ?? rulesMToMm(rulesDefaults.corner_nailer_width ?? 0.1);
        const innerH = Math.max(1, H - bottomThick - topThick);
        const nailerH = innerH;
        const nailerThick = thickness;
        const isKatowa90 = ctx.typ_listwy_naroznej === 'KATOWA_90';

        const locX = isKatowa90
            ? -W / 2 + insetX_mm + nailerW - nailerThick / 2 + shiftX
            : -W / 2 + insetX_mm + nailerThick / 2 + shiftX;

        return {
            thickness: nailerThick,
            dim: {
                x: nailerH + pYPlus + pYMinus,
                y: nailerW + pXMinus + pXPlus,
                z: nailerThick
            },
            loc: {
                x: locX,
                y: D / 2 - insetY_mm - nailerW / 2 + (pXPlus - pXMinus) / 2 + shiftY,
                z: bottomThick + innerH / 2 + (pYPlus - pYMinus) / 2 + shiftZ
            },
            lcs: {
                mapping: { X: 'y', Y: 'x', Z: 'z' },
                rotation: [0, 0, -90]
            },
            ...(isKatowa90 ? {
                edge_banding: {
                    '+X': { active: false, type_id: 'none' },
                    '-X': { active: true, type_id: '0.008x0.022' },
                    '+Y': { active: true, type_id: '0.008x0.022' },
                    '-Y': { active: false, type_id: 'none' }
                }
            } : {})
        };
    }

    // —— BOK_P (przy +X, prostopadły do osi X — grubość w X, głębokość ramienia w Y) ——
    if (matchedKey === "BOK_P" || matchedKey === "BOK_X" || role === "RIGHT_SIDE_PANEL") {
        const overlapRightY = readBackEdgeOffset(offsets, 'PLECY_Y', '+X', defOverlap, pfx);
        const cutY = (overlapRightY >= thickness - 0.05) ? insetY_mm : 0;
        const effBokP = bok_prawy - cutY;
        return {
            thickness,
            dim: { x: H + pYPlus + pYMinus, y: effBokP + pXMinus + pXPlus, z: thickness },
            loc: {
                x: W / 2 - thickness / 2 + shiftX,
                y: (D / 2 - cutY) - effBokP / 2 + (pXPlus - pXMinus) / 2 + shiftY,
                z: H / 2 + (pYPlus - pYMinus) / 2 + shiftZ
            }
        };
    }

    // —— BOK_L (przy −Y, prostopadły do osi Y — grubość w Y, szerokość ramienia w X) ——
    if (matchedKey === "BOK_L" || matchedKey === "BOK_Y" || role === "LEFT_SIDE_PANEL") {
        const overlapFrontX = readBackEdgeOffset(offsets, 'PLECY_X', '-X', defOverlap, pfx);
        const cutX = (overlapFrontX >= thickness - 0.05) ? insetX_mm : 0;
        const effBokL = bok_lewy - cutX;
        return {
            thickness,
            dim: { x: effBokL + pXMinus + pXPlus, y: thickness, z: H + pYPlus + pYMinus },
            loc: {
                x: (-W / 2 + cutX) + effBokL / 2 + (pXPlus - pXMinus) / 2 + shiftX,
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

        const edgeSuf = isBottom ? '-Y' : '+Y';
        const overlapY = readBackEdgeOffset(offsets, 'PLECY_Y', edgeSuf, defOverlap, pfx);
        const overlapX = readBackEdgeOffset(offsets, 'PLECY_X', edgeSuf, defOverlap, pfx);

        let cutY = (overlapY >= thickness - 0.05) ? insetY_mm : 0;
        let cutX = (overlapX >= thickness - 0.05) ? insetX_mm : 0;

        // Jeśli choć jedne plecy mają odcięcie wieńca (margines >= grubość),
        // automatycznie odcinamy oba ramiona w narożniku do lica drugich pleców,
        // aby nie zostawał wystający przekrój drugiego ramienia wieńca.
        if (cutY > 0 || cutX > 0) {
            cutY = insetY_mm;
            cutX = insetX_mm;
        }

        const effectiveX0 = x0 + cutX;
        const effectiveY1 = y1 - cutY;

        const worldL: [number, number][] = [
            [effectiveX0, y0 + bokLTh],
            [x0 + bok_lewy, y0 + bokLTh],
            [x0 + bok_lewy, y1 - bok_prawy],
            [x1 - bokPTh, y1 - bok_prawy],
            [x1 - bokPTh, effectiveY1],
            [effectiveX0, effectiveY1]
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
            },
            edge_banding: {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: false, type_id: 'none' },
                '+Y': { active: false, type_id: 'none' },
                '-Y': { active: true, type_id: '0.008x0.022' },
                'NOTCH': { active: true, type_id: '0.008x0.022' }
            }
        };
    }

    console.warn(`[resolveCorner90Geometry] Rogowy90: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}
