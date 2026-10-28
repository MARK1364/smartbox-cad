/**
 * standard-geometry.ts
 *
 * Czysta funkcja kalkulacji geometrii formatek korpusu standardowego,
 * rogowego z blendą (korpus_rogowy1) oraz delegat do geometrii specjalnych.
 */

import { rulesMToMm } from '../../A1_core/cad-math/units.js';
import { readBackEdgeOffset } from '../back-overlap.js';
import { CabinetType, CabinetGeometryPart, BACK_OVERLAP_EPS_MM } from '../smartframe-types.js';
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
    szerokosc_mm: number;
    wysokosc_mm: number;
    glebokosc_mm: number;
    cofniecie_plecow_mm: number;
    wpuszczenie_plecow_mm: number;
    zonePrefix?: string;
    zoneId?: string;
    tryb_wienca_gornego?: 'FULL' | 'TRAVERSE_H' | 'TRAVERSE_V';
    szerokosc_trawersu_mm?: number;
    szerokosc_blendy_mm?: number;
    strona_blendy?: 'LEFT' | 'RIGHT';
    /** Głębokość lewego boku / ramienia [mm] — korpus_rogowy90. */
    glebokosc_boku_lewego_mm?: number;
    /** Głębokość prawego boku / ramienia [mm] — korpus_rogowy90. */
    glebokosc_boku_prawego_mm?: number;
    /** Szerokość listwy narożnej [mm] — korpus_rogowy90. */
    szerokosc_listwy_naroznej_mm?: number;
    /** Tryb listwy narożnej: POJEDYNCZA (płaska) | KATOWA_90 (dwie listwy w kąt) | BRAK */
    typ_listwy_naroznej?: 'POJEDYNCZA' | 'KATOWA_90' | 'BRAK';
    typ_korpusu?: CabinetType;
    /** Wysokość przodu [mm] — korpus_skosny. */
    wysokosc_przod_mm?: number;
    /** Wysokość tyłu [mm] — korpus_skosny. */
    wysokosc_tyl_mm?: number;
    /** Wysokość lewego boku [mm] — korpus_skosny_lr. */
    wysokosc_lewy_mm?: number;
    /** Wysokość prawego boku [mm] — korpus_skosny_lr. */
    wysokosc_prawy_mm?: number;
    offsets: Record<string, number>;
    rules?: any;
    baseRules?: any;
    thicknessLookup: CabinetThicknessLookupContext;
}

/**
 * Wysokość zajmowana przez wieniec górny w Z [mm].
 * FULL / TRAVERSE_H → grubość płyty; TRAVERSE_V → szerokość trawersu (stoi na sztorc).
 */
function resolveTopOccupyHeightMm(
    ctx: Pick<CabinetPartGeometryContext, 'tryb_wienca_gornego' | 'szerokosc_trawersu_mm'>,
    topPlateMm: number
): number {
    if ((ctx.tryb_wienca_gornego || 'FULL') === 'TRAVERSE_V') {
        return ctx.szerokosc_trawersu_mm || 80;
    }
    return topPlateMm;
}

export function resolveCabinetPartGeometry(
    key: string,
    comp: any,
    ctx: CabinetPartGeometryContext
): Partial<CabinetGeometryPart> | null {
    const W = ctx.szerokosc_mm;
    const H = ctx.wysokosc_mm;
    const D = ctx.glebokosc_mm;
    const backOffset = ctx.cofniecie_plecow_mm ?? 0;

    const name = comp.name || key;
    const role = comp.role || "";
    const backEdgeDefault = ctx.wpuszczenie_plecow_mm || 11;
    const isBackPanel = role === "BACK_PANEL";
    const offsetNames = [name, key, `${ctx.zonePrefix || ''}${key}`, role];
    const readPanelOffset = (suffix: string): number | undefined => {
        for (const offsetName of offsetNames) {
            const value = ctx.offsets[`${offsetName}_${suffix}`];
            if (value !== undefined && value !== null && Number.isFinite(Number(value))) {
                return Number(value);
            }
        }
        return undefined;
    };
    const pYPlus  = isBackPanel
        ? readPanelOffset('+Y') ?? readBackEdgeOffset(ctx.offsets, name, '+Y', backEdgeDefault, ctx.zonePrefix)
        : readPanelOffset('+Y') ?? ctx.offsets[`${name}_+Y`] ?? 0;
    const pYMinus = isBackPanel
        ? readPanelOffset('-Y') ?? readBackEdgeOffset(ctx.offsets, name, '-Y', backEdgeDefault, ctx.zonePrefix)
        : readPanelOffset('-Y') ?? ctx.offsets[`${name}_-Y`] ?? 0;
    const pXMinus = isBackPanel
        ? readPanelOffset('-X') ?? readBackEdgeOffset(ctx.offsets, name, '-X', backEdgeDefault, ctx.zonePrefix)
        : readPanelOffset('-X') ?? ctx.offsets[`${name}_-X`] ?? 0;
    const pXPlus  = isBackPanel
        ? readPanelOffset('+X') ?? readBackEdgeOffset(ctx.offsets, name, '+X', backEdgeDefault, ctx.zonePrefix)
        : readPanelOffset('+X') ?? ctx.offsets[`${name}_+X`] ?? 0;

    const shiftX = readPanelOffset('shiftX') ?? 0;
    const shiftY = readPanelOffset('shiftY') ?? 0;
    const shiftZ = readPanelOffset('shiftZ') ?? 0;

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
    const grubosc_plecow_mm = requireCabinetPartThickness("BACK_PANEL", pfx, ctx.thicknessLookup, ["PLECY", "BACK"]);
    const margines_gorny_plecow_mm = readBackEdgeOffset(ctx.offsets, "PLECY", "+Y", backEdgeDefault, ctx.zonePrefix);
    const innerWidth = W - leftThick - rightThick;
    const midShift   = (leftThick - rightThick) / 2;

    // Kątownik 90° — osobna geometria (dwa plecy, boki prostopadłe, L-wieńce)
    if (ctx.typ_korpusu === 'korpus_rogowy90') {
        const fallbackArmMm = 600;
        const rotXDeg = Number(comp.lcs?.rotation?.[0]);
        const rotYDeg = Number(comp.lcs?.rotation?.[1]);
        return resolveCorner90Geometry(matchedKey, role, {
            W, H, D, thickness, backOffset, shiftX, shiftY, shiftZ,
            pXPlus, pXMinus, pYPlus, pYMinus,
            bok_lewy: ctx.glebokosc_boku_lewego_mm ?? fallbackArmMm,
            bok_prawy: ctx.glebokosc_boku_prawego_mm ?? fallbackArmMm,
            szerokosc_listwy_naroznej_mm: ctx.szerokosc_listwy_naroznej_mm,
            typ_listwy_naroznej: ctx.typ_listwy_naroznej,
            pfx,
            name,
            backGrooveDepth: ctx.wpuszczenie_plecow_mm ?? 11,
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





    const readBackShift = (): number => {
        const candidates = [
            `${ctx.zonePrefix || ''}Plecy_shiftY`,
            `${ctx.zonePrefix || ''}BACK_PANEL_shiftY`,
            'Dol_Plecy_shiftY',
            'B_Plecy_shiftY',
            'Plecy_shiftY',
            'BACK_PANEL_shiftY'
        ];
        for (const k of candidates) {
            const v = ctx.offsets?.[k];
            if (v !== undefined && v !== null && Number.isFinite(Number(v))) return Number(v);
        }
        return 0;
    };
    const backShiftY = readBackShift();
    const shortenedD = D - backOffset + backShiftY;
    const shortenedLocY = (-backOffset + backShiftY) / 2;

    const overlapLeft   = readBackEdgeOffset(ctx.offsets, 'Plecy', '-X', backEdgeDefault, pfx);
    const overlapRight  = readBackEdgeOffset(ctx.offsets, 'Plecy', '+X', backEdgeDefault, pfx);
    const overlapBottom = readBackEdgeOffset(ctx.offsets, 'Plecy', '-Y', backEdgeDefault, pfx);
    const overlapTop    = readBackEdgeOffset(ctx.offsets, 'Plecy', '+Y', backEdgeDefault, pfx);

    // Korpus skośny pod dach — boki L=P (symetria), skos do tyłu, wieniec pochylony w głąb
    if (ctx.typ_korpusu === 'korpus_skosny_dach') {
        const hF = Math.max(100, ctx.wysokosc_przod_mm ?? 1000);
        const hB = Math.max(100, ctx.wysokosc_tyl_mm ?? 2200);
        return resolveSkosnyDachGeometry(matchedKey, role, {
            W, D,
            hF, hB, maxH: Math.max(hF, hB),
            thickness, backOffset, shiftX, shiftY, shiftZ,
            pXPlus, pXMinus, pYPlus, pYMinus,
            leftThick, rightThick, innerWidth, midShift, grubosc_plecow_mm, margines_gorny_plecow_mm,
            overlapLeft, overlapRight, overlapBottom, overlapTop, backShiftY
        });
    }

    // Korpus skośny — prototyp (boki-trapezoidy, wieniec pochylony w głąb, plecy pełne)
    if (ctx.typ_korpusu === 'korpus_skosny') {
        const hF = Math.max(100, ctx.wysokosc_przod_mm ?? 1000);
        const hB = Math.max(100, ctx.wysokosc_tyl_mm ?? 2200);
        return resolveSkosnyGeometry(matchedKey, role, {
            W, D,
            hF, hB, maxH: Math.max(hF, hB),
            thickness, backOffset, shiftX, shiftY, shiftZ,
            pXPlus, pXMinus, pYPlus, pYMinus,
            leftThick, rightThick, innerWidth, midShift, grubosc_plecow_mm, margines_gorny_plecow_mm,
            overlapLeft, overlapRight, overlapBottom, overlapTop, backShiftY
        });
    }

    // Korpus skośny LR (ucio) — wieniec w świetle + cutAngle na stykach z bokami
    if (ctx.typ_korpusu === 'korpus_skosny_lr_uc') {
        const hL_mm = Math.max(1, ctx.wysokosc_lewy_mm ?? 1000);
        const hR_mm = Math.max(1, ctx.wysokosc_prawy_mm ?? H);
        const bottomThick = requireCabinetPartThickness("BOTTOM", pfx, ctx.thicknessLookup, ["WIENIEC_D"]);
        const topThick    = requireCabinetPartThickness("TOP", pfx, ctx.thicknessLookup, ["WIENIEC_G"]);
        return resolveSkosnyLrUcGeometry(matchedKey, role, {
            W_mm: W,
            D_mm: D,
            wysokosc_lewy_mm: hL_mm,
            wysokosc_prawy_mm: hR_mm,
            max_wysokosc_mm: Math.max(hL_mm, hR_mm),
            grubosc_mm: thickness,
            grubosc_dolny_mm: bottomThick,
            grubosc_gorny_mm: topThick,
            odsuniecie_plecow_mm: backOffset,
            przesuniecie_x_mm: shiftX,
            przesuniecie_y_mm: shiftY,
            przesuniecie_z_mm: shiftZ,
            wpuszczenie_prawe_mm: pXPlus,
            wpuszczenie_lewe_mm: pXMinus,
            margines_gorny_mm: pYPlus,
            margines_dolny_mm: pYMinus,
            grubosc_lewy_mm: leftThick,
            grubosc_prawy_mm: rightThick,
            szerokosc_wewnetrzna_mm: innerWidth,
            przesuniecie_srodka_mm: midShift,
            overlapLeft,
            overlapRight,
            overlapBottom,
            overlapTop,
            backShiftY,
        });
    }

    // Korpus skośny LR — osobna geometria (skos w poprzek: lewy niski / prawy wysoki)
    if (ctx.typ_korpusu === 'korpus_skosny_lr') {
        const hL_mm = Math.max(1, ctx.wysokosc_lewy_mm ?? 1000);
        const hR_mm = Math.max(1, ctx.wysokosc_prawy_mm ?? H);
        const bottomThick = requireCabinetPartThickness("BOTTOM", pfx, ctx.thicknessLookup, ["WIENIEC_D"]);
        const topThick    = requireCabinetPartThickness("TOP", pfx, ctx.thicknessLookup, ["WIENIEC_G"]);
        return resolveSkosnyLrGeometry(matchedKey, role, {
            W_mm: W,
            D_mm: D,
            wysokosc_lewy_mm: hL_mm,
            wysokosc_prawy_mm: hR_mm,
            max_wysokosc_mm: Math.max(hL_mm, hR_mm),
            grubosc_mm: thickness,
            grubosc_dolny_mm: bottomThick,
            grubosc_gorny_mm: topThick,
            odsuniecie_plecow_mm: backOffset,
            przesuniecie_x_mm: shiftX,
            przesuniecie_y_mm: shiftY,
            przesuniecie_z_mm: shiftZ,
            wpuszczenie_prawe_mm: pXPlus,
            wpuszczenie_lewe_mm: pXMinus,
            margines_gorny_mm: pYPlus,
            margines_dolny_mm: pYMinus,
            grubosc_lewy_mm: leftThick,
            grubosc_prawy_mm: rightThick,
            szerokosc_wewnetrzna_mm: innerWidth,
            przesuniecie_srodka_mm: midShift,
            overlapLeft,
            overlapRight,
            overlapBottom,
            overlapTop,
            backShiftY
        });
    }



    if (matchedKey === "BOK_L" || matchedKey === "SIDE_LEFT" || role === "LEFT_SIDE_PANEL") {
        // overlapLeft
        const isShortened = overlapLeft >= thickness - BACK_OVERLAP_EPS_MM && shortenedD > 0;
        const targetD = isShortened ? shortenedD : D;
        const targetLocY = isShortened ? shortenedLocY : 0;
        return {
            thickness,
            dim: { x: H + pYPlus + pYMinus, y: targetD + pXMinus + pXPlus, z: thickness },
            loc: { x: -W / 2 + thickness / 2 + shiftX, y: targetLocY + (pXPlus - pXMinus) / 2 + shiftY, z: H / 2 + (pYPlus - pYMinus) / 2 + shiftZ }
        };
    }
    if (matchedKey === "BOK_P" || matchedKey === "SIDE_RIGHT" || role === "RIGHT_SIDE_PANEL") {
        // overlapRight
        const isShortened = overlapRight >= thickness - BACK_OVERLAP_EPS_MM && shortenedD > 0;
        const targetD = isShortened ? shortenedD : D;
        const targetLocY = isShortened ? shortenedLocY : 0;
        return {
            thickness,
            dim: { x: H + pYPlus + pYMinus, y: targetD + pXMinus + pXPlus, z: thickness },
            loc: { x: W / 2 - thickness / 2 + shiftX, y: targetLocY + (pXPlus - pXMinus) / 2 + shiftY, z: H / 2 + (pYPlus - pYMinus) / 2 + shiftZ }
        };
    }
    if (matchedKey === "WIENIEC_D" || matchedKey === "BOTTOM" || role === "BOTTOM_PANEL") {
        const overlapBottom = readBackEdgeOffset(ctx.offsets, 'Plecy', '-Y', backEdgeDefault, pfx);
        const isShortened = overlapBottom >= thickness - BACK_OVERLAP_EPS_MM && shortenedD > 0;
        const targetD = isShortened ? shortenedD : D;
        const targetLocY = isShortened ? shortenedLocY : 0;
        return {
            thickness,
            dim: { x: innerWidth + pYMinus + pYPlus, y: targetD + pXMinus + pXPlus, z: thickness },
            loc: { x: midShift + (pYPlus - pYMinus) / 2, y: targetLocY + (pXPlus - pXMinus) / 2, z: thickness / 2 - shiftZ }
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
        const mode = ctx.tryb_wienca_gornego || 'FULL';
        const isWieniecGT2 = key.endsWith("_T2");

        if (mode === 'TRAVERSE_H') {
            const trWidth = ctx.szerokosc_trawersu_mm || 80;
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
            const trWidth = ctx.szerokosc_trawersu_mm || 80;
            const isFront = !isWieniecGT2;
            const baseY = isFront ? (-D / 2 + thickness / 2) : (D / 2 - thickness / 2);
            // pX (czerwone gizmo) → szerokość trawersu (dim.z), NIE grubość.
            // Po mapping Y←z, Z←y: thickness = dim.y — musi zostać czystą grubością płyty.
            return {
                thickness,
                dim: { x: innerWidth + pYMinus + pYPlus, y: thickness, z: trWidth + pXMinus + pXPlus },
                loc: {
                    x: midShift + (pYPlus - pYMinus) / 2,
                    y: baseY + shiftY,
                    z: H - trWidth / 2 + shiftZ + (pXPlus - pXMinus) / 2
                },
                lcs: {
                    mapping: { X: 'x', Y: 'z', Z: 'y' },
                    rotation: [180, 0, 0],
                    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
                }
            };
        } else {
            if (isWieniecGT2) return null;
            // overlapTop
            const isShortened = overlapTop >= thickness - BACK_OVERLAP_EPS_MM && shortenedD > 0;
            const targetD = isShortened ? shortenedD : D;
            const targetLocY = isShortened ? shortenedLocY : 0;
            return {
                thickness,
                dim: { x: innerWidth + pYMinus + pYPlus, y: targetD + pXMinus + pXPlus, z: thickness },
                loc: { x: midShift + (pYPlus - pYMinus) / 2, y: targetLocY + (pXPlus - pXMinus) / 2, z: H - thickness / 2 + shiftZ }
            };
        }
    }
    if (matchedKey === "PLECY" || matchedKey === "BACK" || role === "BACK_PANEL") {
        const defaultGroove = ctx.wpuszczenie_plecow_mm || 11;
        const overlapLeft   = readBackEdgeOffset(ctx.offsets, name, '-X', defaultGroove, pfx);
        const overlapRight  = readBackEdgeOffset(ctx.offsets, name, '+X', defaultGroove, pfx);
        const overlapBottom = readBackEdgeOffset(ctx.offsets, name, '-Y', defaultGroove, pfx);
        const overlapTop    = readBackEdgeOffset(ctx.offsets, name, '+Y', defaultGroove, pfx);

        const bottomThick = requireCabinetPartThickness("BOTTOM", pfx, ctx.thicknessLookup, ["WIENIEC_D"]);
        const topPlate    = requireCabinetPartThickness("TOP", pfx, ctx.thicknessLookup, ["WIENIEC_G"]);
        // FULL/TRAVERSE_H: wysokość = grubość płyty; TRAVERSE_V: wysokość = szerokość trawersu
        const topOccupy   = resolveTopOccupyHeightMm(ctx, topPlate);
        const innerH      = H - bottomThick - topOccupy;

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
        const topPlate    = requireCabinetPartThickness("TOP", pfx, ctx.thicknessLookup, ["WIENIEC_G"]);
        // FULL/TRAVERSE_H: wysokość = grubość płyty; TRAVERSE_V: wysokość = szerokość trawersu
        const topOccupy   = resolveTopOccupyHeightMm(ctx, topPlate);
        const innerH      = H - bottomThick - topOccupy;

        const rulesDefaults = ctx.rules?.parameters?.defaults || ctx.baseRules?.parameters?.defaults || {};
        const validation = ctx.rules?.parameters?.validation || ctx.baseRules?.parameters?.validation || {};
        const minBlind = rulesMToMm(validation.min_blind_width ?? 0.05);
        const defaultBlind = rulesMToMm(rulesDefaults.blind_width ?? 0.4);
        let blindW = ctx.szerokosc_blendy_mm ?? defaultBlind;
        const maxBlind = Math.max(minBlind, innerWidth - 1);
        blindW = Math.max(minBlind, Math.min(blindW, maxBlind));

        const sideRaw = (ctx.strona_blendy || rulesDefaults.blind_side || 'LEFT').toString().toUpperCase();
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
