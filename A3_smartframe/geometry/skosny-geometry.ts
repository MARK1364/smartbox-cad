/**
 * skosny-geometry.ts
 *
 * Czyste funkcje kalkulacji geometrii korpusów skośnych:
 *  - resolveSkosnyGeometry: prototyp (skos w głąb przód-tył, trapezy boków w outline2d, wieniec górny pochylony)
 *  - resolveSkosnyDachGeometry: pod skośny dach (skos w głąb, boki symetryczne)
 *  - resolveSkosnyLrGeometry: skos w poprzek szerokości lewy/prawy (prostokąty boków o różnych wys., wieniec Rz(-beta), plecy trapez)
 *  - resolveSkosnyLrUcGeometry: skos LR z uciosem (cutAngle i kotwice Z_PLUS / Z_MINUS na styku z wieńcem)
 */

import { CabinetGeometryPart } from '../smartframe-types.js';

export interface SkosnyFbGeometryContext {
    W: number;
    D: number;
    hF: number;
    hB: number;
    maxH: number;
    thickness: number;
    backOffset: number;
    shiftX: number;
    shiftY: number;
    shiftZ: number;
    pXPlus: number;
    pXMinus: number;
    pYPlus: number;
    pYMinus: number;
    leftThick: number;
    rightThick: number;
    innerWidth: number;
    midShift: number;
}

export interface SkosnyLrGeometryContext {
    W: number;
    D: number;
    hL: number;
    hR: number;
    maxH: number;
    thickness: number;
    backOffset: number;
    shiftX: number;
    shiftY: number;
    shiftZ: number;
    pXPlus: number;
    pXMinus: number;
    pYPlus: number;
    pYMinus: number;
    leftThick: number;
    rightThick: number;
    innerWidth: number;
    midShift: number;
}

/**
 * Geometria korpusu skośnego (prototyp, skos w głąb: przód niski / tył wysoki).
 * Boki-trapezoidy z osobnym obrysem L/P przez lustro osi U.
 */
export function resolveSkosnyGeometry(
    matchedKey: string,
    role: string,
    o: SkosnyFbGeometryContext
): Partial<CabinetGeometryPart> | null {
    const { W, D, hF, hB, maxH, thickness, backOffset } = o;
    // Prawy bok: u=0 na froncie (niski), u=D na tyle (wysoki).
    const outlineR: [number, number][] = [
        [0, 0],
        [D, 0],
        [D, hB],
        [0, hF]
    ];
    // Lewy bok: u=0 na tyle (wysoki), u=D na froncie (niski) — lustro.
    const outlineL: [number, number][] = [
        [0, 0],
        [D, 0],
        [D, hF],
        [0, hB]
    ];

    if (matchedKey === 'BOK_L' || matchedKey === 'SIDE_LEFT' || role === 'LEFT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: maxH, y: D, z: thickness },
            loc: { x: -W / 2 + thickness / 2, y: 0, z: maxH / 2 },
            customProperties: { outline2d: outlineL, shape: 'skos_side' }
        };
    }
    if (matchedKey === 'BOK_P' || matchedKey === 'SIDE_RIGHT' || role === 'RIGHT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: maxH, y: D, z: thickness },
            loc: { x: W / 2 - thickness / 2, y: 0, z: maxH / 2 },
            customProperties: { outline2d: outlineR, shape: 'skos_side' }
        };
    }
    if (matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') {
        return {
            thickness,
            dim: { x: o.innerWidth, y: D, z: thickness },
            loc: { x: o.midShift, y: 0, z: thickness / 2 }
        };
    }
    if (matchedKey === 'WIENIEC_G' || matchedKey === 'TOP' || role === 'TOP_PANEL') {
        const betaDeg = Math.atan2(hB - hF, D) * 180 / Math.PI;
        const beta = betaDeg * Math.PI / 180;
        const slopeLen = Math.hypot(D, hB - hF);
        return {
            thickness,
            dim: { x: o.innerWidth, y: slopeLen, z: thickness },
            loc: {
                x: o.midShift,
                y: -Math.sin(beta) * thickness / 2,
                z: (hF + hB) / 2 + Math.cos(beta) * thickness / 2
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [betaDeg - 90, 0, 0]
            }
        };
    }
    if (matchedKey === 'PLECY' || matchedKey === 'BACK' || role === 'BACK_PANEL') {
        const bottomThick = thickness;
        const backH = hB - bottomThick + thickness;
        return {
            thickness,
            dim: { x: o.innerWidth, y: thickness, z: backH },
            loc: { x: o.midShift, y: D / 2 + thickness / 2 - backOffset, z: bottomThick + backH / 2 }
        };
    }

    console.warn(`[resolveSkosnyGeometry] Skosny: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}

/**
 * Korpus pod skośny dach — skos w głąb (przód niski / tył wysoki), boki L=P symetryczne.
 */
export function resolveSkosnyDachGeometry(
    matchedKey: string,
    role: string,
    o: SkosnyFbGeometryContext
): Partial<CabinetGeometryPart> | null {
    const { W, D, hF, hB, maxH, thickness, backOffset } = o;
    const outlineR: [number, number][] = [
        [0, 0],
        [D, 0],
        [D, hB],
        [0, hF]
    ];
    const outlineL: [number, number][] = [
        [0, 0],
        [D, 0],
        [D, hF],
        [0, hB]
    ];

    if (matchedKey === 'BOK_L' || matchedKey === 'SIDE_LEFT' || role === 'LEFT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: maxH, y: D, z: thickness },
            loc: { x: -W / 2 + thickness / 2, y: 0, z: maxH / 2 },
            customProperties: { outline2d: outlineL, shape: 'skos_dach_side' }
        };
    }
    if (matchedKey === 'BOK_P' || matchedKey === 'SIDE_RIGHT' || role === 'RIGHT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: maxH, y: D, z: thickness },
            loc: { x: W / 2 - thickness / 2, y: 0, z: maxH / 2 },
            customProperties: { outline2d: outlineR, shape: 'skos_dach_side' }
        };
    }
    if (matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') {
        return {
            thickness,
            dim: { x: o.innerWidth, y: D, z: thickness },
            loc: { x: o.midShift, y: 0, z: thickness / 2 }
        };
    }
    if (matchedKey === 'WIENIEC_G' || matchedKey === 'TOP' || role === 'TOP_PANEL') {
        const betaDeg = Math.atan2(hB - hF, D) * 180 / Math.PI;
        const beta = betaDeg * Math.PI / 180;
        const slopeLen = Math.hypot(D, hB - hF);
        return {
            thickness,
            dim: { x: o.innerWidth, y: slopeLen, z: thickness },
            loc: {
                x: o.midShift,
                y: -Math.sin(beta) * thickness / 2,
                z: (hF + hB) / 2 + Math.cos(beta) * thickness / 2
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [betaDeg - 90, 0, 0]
            }
        };
    }
    if (matchedKey === 'PLECY' || matchedKey === 'BACK' || role === 'BACK_PANEL') {
        const bottomThick = thickness;
        const backH = hB - bottomThick + thickness;
        return {
            thickness,
            dim: { x: o.innerWidth, y: thickness, z: backH },
            loc: { x: o.midShift, y: D / 2 + thickness / 2 - backOffset, z: bottomThick + backH / 2 }
        };
    }

    console.warn(`[resolveSkosnyDachGeometry] SkosnyDach: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}

/**
 * Geometria korpusu skośnego LR (skos w poprzek szerokości: lewy niski / prawy wysoki).
 */
export function resolveSkosnyLrGeometry(
    matchedKey: string,
    role: string,
    o: SkosnyLrGeometryContext
): Partial<CabinetGeometryPart> | null {
    const { W, D, hL, hR, maxH, thickness, backOffset } = o;
    if (matchedKey === 'BOK_L' || matchedKey === 'SIDE_LEFT' || role === 'LEFT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: hL, y: D, z: thickness },
            loc: { x: -W / 2 + thickness / 2, y: 0, z: hL / 2 }
        };
    }
    if (matchedKey === 'BOK_P' || matchedKey === 'SIDE_RIGHT' || role === 'RIGHT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: hR, y: D, z: thickness },
            loc: { x: W / 2 - thickness / 2, y: 0, z: hR / 2 }
        };
    }
    if (matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') {
        return {
            thickness,
            dim: { x: o.innerWidth, y: D, z: thickness },
            loc: { x: o.midShift, y: 0, z: thickness / 2 }
        };
    }
    if (matchedKey === 'WIENIEC_G' || matchedKey === 'TOP' || role === 'TOP_PANEL') {
        const betaDeg = Math.atan2(hR - hL, o.innerWidth) * 180 / Math.PI;
        const slopeLen = Math.hypot(o.innerWidth, hR - hL);
        return {
            thickness,
            dim: { x: slopeLen, y: D, z: thickness },
            loc: {
                x: o.midShift,
                y: 0,
                z: (hL + hR) / 2
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [-90, 0, -betaDeg]
            }
        };
    }
    if (matchedKey === 'PLECY' || matchedKey === 'BACK' || role === 'BACK_PANEL') {
        const outlineBack: [number, number][] = [
            [0, maxH],
            [o.innerWidth, maxH],
            [o.innerWidth, maxH - hR],
            [0, maxH - hL]
        ];
        return {
            thickness,
            dim: { x: o.innerWidth, y: thickness, z: maxH },
            loc: { x: o.midShift, y: D / 2 + thickness / 2 - backOffset, z: maxH / 2 },
            customProperties: {
                outline2d: outlineBack,
                shape: 'skos_back'
            }
        };
    }

    console.warn(`[resolveSkosnyLrGeometry] SkosnyLR: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}

/**
 * Korpus skośny LR z uciosem (cutAngle na wieńcu i bokach).
 */
export function resolveSkosnyLrUcGeometry(
    matchedKey: string,
    role: string,
    o: SkosnyLrGeometryContext
): Partial<CabinetGeometryPart> | null {
    const { W, D, hL, hR, maxH, thickness, backOffset } = o;
    const betaDeg = Math.atan2(hR - hL, o.innerWidth) * 180 / Math.PI;
    const sideCut = Math.abs(betaDeg) < 0.05 ? 0 : betaDeg;
    // Obniżenie górnej krawędzi boków o ucięcie +Y = β: t·tanβ (pionowo).
    const bevelRise = thickness * Math.tan(betaDeg * Math.PI / 180);
    // Wszystkie górne krawędzie (oba boki + lico górne wienca) leżą w JEDNEJ
    // płaszczyźnie o spadku β. Płaszczyznę kotwiczy wieniec: jego najwyższy naroż
    // (przy wyższym boku) na hR − t·tanβ.
    //   prawy bok: wewn. hR − t·tanβ, zewn. hR          (zewn. = pełna wysokość korpusu)
    //   lewy bok:  wewn. hL − t·tanβ, zewn. hL − 2·t·tanβ (opada na zewnątrz!)
    // Lewy bok jest więc niższy o t·tanβ od nominalnego i ucięty kotwicą Z_PLUS
    // (cofa Z− = lico zewnętrzne). Bez tego jego górna krawędź wznosiła się do
    // zewnątrz, była nie współbieżna z wiencem i zostawiała klin.
    const hLeftCut = hL - bevelRise;
    // Końce wienca pod kątem β (NIE 90−β) z PRZECIWNYMI znakami i kotwicą Z_MINUS.
    // Skos nachyla lica płyty, więc górne i dolne lico mają w świecie różne pozycje X
    // o t·sinβ. Ucięcie β z przeciwnymi znakami kasuje to przesunięcie na obu
    // końcach: lica górne i dolne trafiają w te same płaszczyzny x = ∓innerW/2,
    // czyli końce są pionowe i szczelne. Bez ucięcia spód wystawałby o t·sinβ,
    // a przy 90−β zostawał klin ~25 mm z lewej strony.
    const topEndCut = Math.abs(betaDeg) < 0.05 ? 0 : betaDeg;
    const topEndBandRight = topEndCut
        ? { active: false, type_id: 'none', cutAngle: topEndCut, cutAnchor: 'Z_MINUS' as const }
        : { active: false, type_id: 'none' };
    const topEndBandLeft = topEndCut
        ? { active: false, type_id: 'none', cutAngle: -topEndCut, cutAnchor: 'Z_MINUS' as const }
        : { active: false, type_id: 'none' };
    // Lewy bok: Z+ = lico wewnętrzne, więc kotwica Z_PLUS zostawia je nominalne
    // (na hL − t·tanβ) i cofa Z− = lico zewnętrzne do hL − 2·t·tanβ.
    const sideTopBevelLeft = {
        active: true,
        type_id: '0.008x0.022',
        ...(sideCut ? { cutAngle: sideCut, cutAnchor: 'Z_PLUS' as const } : {})
    };
    // Prawy bok: Z+ = lico zewnętrzne (nominalne hR), kotwica Z_MINUS cofa
    // Z− = lico wewnętrzne do hR − t·tanβ.
    const sideTopBevelRight = {
        active: true,
        type_id: '0.008x0.022',
        ...(sideCut ? { cutAngle: sideCut, cutAnchor: 'Z_MINUS' as const } : {})
    };

    if (matchedKey === 'BOK_L' || matchedKey === 'SIDE_LEFT' || role === 'LEFT_SIDE_PANEL') {
        return {
            thickness,
            // Niższy o t·tanβ, żeby jego górna krawędź leżała w płaszczyźnie wienca.
            dim: { x: hLeftCut, y: D, z: thickness },
            loc: { x: -W / 2 + thickness / 2, y: 0, z: hLeftCut / 2 },
            edge_banding: {
                '+X': { active: true, type_id: '0.008x0.022' },
                '-X': { active: false, type_id: 'none' },
                '+Y': sideTopBevelLeft,
                '-Y': { active: true, type_id: '0.008x0.022' }
            }
        };
    }
    if (matchedKey === 'BOK_P' || matchedKey === 'SIDE_RIGHT' || role === 'RIGHT_SIDE_PANEL') {
        return {
            thickness,
            dim: { x: hR, y: D, z: thickness },
            loc: { x: W / 2 - thickness / 2, y: 0, z: hR / 2 },
            edge_banding: {
                '+X': { active: false, type_id: 'none' },
                '-X': { active: true, type_id: '0.008x0.022' },
                '+Y': sideTopBevelRight,
                '-Y': { active: true, type_id: '0.008x0.022' }
            }
        };
    }
    if (matchedKey === 'WIENIEC_D' || matchedKey === 'BOTTOM' || role === 'BOTTOM_PANEL') {
        return {
            thickness,
            dim: { x: o.innerWidth, y: D, z: thickness },
            loc: { x: o.midShift, y: 0, z: thickness / 2 }
        };
    }
    if (matchedKey === 'WIENIEC_G' || matchedKey === 'TOP' || role === 'TOP_PANEL') {
        const slopeLen = Math.hypot(o.innerWidth, hR - hL);
        const beta = betaDeg * Math.PI / 180;
        return {
            thickness,
            dim: { x: slopeLen, y: D, z: thickness },
            loc: {
                // Wieniec WPUŚCZANY: lico górne leży na linii łączącej WEWNĘTRZNE
                // górne krawędzie boków, czyli (hL−bevelRise) i (hR−bevelRise).
                // Środek płyty jest o pół grubości prostopadle do skosu poniżej tego
                // lica (lokalna −Z wychodzi w górę przy rotacji [-90,0,−β]).
                // Sprawdzone: naroże lica górnego = x ∓innerW/2 oraz hL/hR − t·tanβ.
                x: o.midShift + (thickness / 2) * Math.sin(beta),
                y: 0,
                z: (hL + hR) / 2 - bevelRise - (thickness / 2) * Math.cos(beta)
            },
            lcs: {
                mapping: { X: 'x', Y: 'y', Z: 'z' },
                rotation: [-90, 0, -betaDeg],
                faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
            },
            edge_banding: {
                '+X': topEndBandRight,
                '-X': topEndBandLeft,
                '+Y': { active: false, type_id: 'none' },
                '-Y': { active: true, type_id: '0.008x0.022' }
            },
            customProperties: {
                outline2d: undefined,
                shape: undefined,
                boardThickness: undefined
            }
        };
    }
    if (matchedKey === 'PLECY' || matchedKey === 'BACK' || role === 'BACK_PANEL') {
        const outlineBack: [number, number][] = [
            [0, maxH],
            [o.innerWidth, maxH],
            [o.innerWidth, maxH - hR],
            [0, maxH - hL]
        ];
        return {
            thickness,
            dim: { x: o.innerWidth, y: thickness, z: maxH },
            loc: { x: o.midShift, y: D / 2 + thickness / 2 - backOffset, z: maxH / 2 },
            customProperties: {
                outline2d: outlineBack,
                shape: 'skos_back'
            }
        };
    }

    console.warn(`[resolveSkosnyLrUcGeometry] SkosnyLR_UC: nieznany węzeł "${matchedKey}" (role: "${role}")`);
    return null;
}
