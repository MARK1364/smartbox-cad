/**
 * A6_agd — microwave-engine.ts
 * Silnik obliczeń geometrii i planu paneli B-rep dla kuchenki mikrofalowej.
 *
 * Formuły zgodne z piekarnikowa.html:
 *   wyskosc_body_micro = frontHeight - nalGoraMicro - nalDolneMicro
 *   polozenie_body_micro = baza Z=0
 *   dół frontu = -nalDolneMicro
 *   góra frontu = corpusHeight + nalGoraMicro
 */

import type { MicrowaveParamsMm } from './smart-appliance-types.js';

export interface AppliancePartPlanMm {
    key: string;
    name: string;
    role: string;
    loc: { x: number; y: number; z: number };
    dim: { x: number; y: number; z: number };
    rotationDeg: [number, number, number];
    lcs: {
        mapping: { X: 'x'; Y: 'z'; Z: 'y' };
        rotation: [number, number, number];
        faces: { INNER: string; OUTER: string };
    };
    color: { r: number; g: number; b: number };
    custom_properties: Record<string, any>;
}

export const APPLIANCE_LCS = {
    mapping: { X: 'x', Y: 'z', Z: 'y' } as const,
    rotation: [0, 0, 0] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' },
};

/** Kolor frontu mikrofalówki i piekarnika (jaśniejszy czarny / ciemny grafit, z wyraźnie czytelnymi krawędziami) */
export const APPLIANCE_FRONT_COLOR = { r: 0.30, g: 0.31, b: 0.33 };

/** Kolor technicznego korpusu wnękowego (ocynkowana blacha / jasny szary) */
export const APPLIANCE_CORPUS_COLOR = { r: 0.76, g: 0.78, b: 0.80 };

export function planMicrowave(params: MicrowaveParamsMm): { parts: AppliancePartPlanMm[]; corpusHeight: number } {
    const frontH = Math.max(100, params.frontHeight || 380);
    const nalGora = Number.isFinite(params.nalGoraMicro) ? params.nalGoraMicro : 20;
    const nalDol = Number.isFinite(params.nalDolneMicro) ? params.nalDolneMicro : 8;
    const frontW = Math.max(100, params.frontWidth || 595);
    const frontD = Math.max(5, params.frontDepth || 20);
    const corpusW = Math.max(100, params.corpusWidth || 560);
    const corpusD = Math.max(50, params.corpusDepth || 320);

    // Wzór z piekarnikowa.html: wysokość korpusu pomniejszona o nałożenia
    const corpusHeight = Math.max(50, frontH - nalGora - nalDol);

    // Płaszczyzna lica szafki w układzie współrzędnych kontenera:
    // W CAD wartości Y rosną w głąb wnęki (+Y ku plecom), a maleją w stronę pokoju (-Y ku licu).
    // Gdy kontener jest zadokowany we wnęce (środek Y kontenera = bay.centerWorldMm.y):
    //   - Wnęka rozciąga się od -bayDepth/2 (lico) do +bayDepth/2 (plecy)
    //   - Lico przodu to frontPlaneY = -bayDepth / 2
    // W trybie wolnostojącym (brak bayDepth):
    //   - Całkowita głębokość kontenera = corpusD + frontD
    //   - Lico przodu to frontPlaneY = -totalD / 2 + frontD
    const isBayDocked = Number.isFinite(params.bayDepth) && (params.bayDepth! > 0);
    const totalD = isBayDocked ? params.bayDepth! : (corpusD + frontD);
    const frontPlaneY = isBayDocked ? (-totalD / 2) : (-totalD / 2 + frontD);

    // 1. Korpus B-rep:
    // - Baza spodu opiera się na półce szafki: dolna ściana Z = 0
    // - Korpus wchodzi w głąb wnęki (+Y): od frontPlaneY do frontPlaneY + corpusD
    // - Środek korpusu: X=0, Y = frontPlaneY + corpusD/2, Z = corpusHeight/2
    const corpusPart: AppliancePartPlanMm = {
        key: 'appliance_corpus',
        name: 'Korpus_Mikrofali',
        role: 'APPLIANCE_CORPUS',
        loc: {
            x: 0,
            y: frontPlaneY + corpusD / 2,
            z: corpusHeight / 2,
        },
        dim: {
            x: corpusW,
            y: corpusD,
            z: corpusHeight,
        },
        rotationDeg: [0, 0, 0],
        lcs: APPLIANCE_LCS,
        color: APPLIANCE_CORPUS_COLOR,
        custom_properties: {
            excludeFromProduction: true,
            domain: 'appliance_part',
            applianceType: 'MICROWAVE',
            partKey: 'corpus',
        },
    };

    // 2. Front B-rep:
    // - Tył frontu przylega do lica w frontPlaneY
    // - Front wychodzi na zewnątrz do pokoju (-Y): od frontPlaneY - frontD do frontPlaneY
    // - Dół frontu opada poniżej bazy o nalDol: Z_min = -nalDol
    // - Góra frontu wystaje ponad korpus o nalGora: Z_max = corpusHeight + nalGora
    // - Środek Z = (frontH / 2) - nalDol
    const frontZCenter = (frontH / 2) - nalDol;
    const frontPart: AppliancePartPlanMm = {
        key: 'appliance_front',
        name: 'Front_Mikrofali',
        role: 'APPLIANCE_FRONT',
        loc: {
            x: 0,
            y: frontPlaneY - frontD / 2,
            z: frontZCenter,
        },
        dim: {
            x: frontW,
            y: frontD,
            z: frontH,
        },
        rotationDeg: [0, 0, 0],
        lcs: APPLIANCE_LCS,
        color: APPLIANCE_FRONT_COLOR,
        custom_properties: {
            excludeFromProduction: true,
            domain: 'appliance_part',
            applianceType: 'MICROWAVE',
            partKey: 'front',
        },
    };

    return {
        parts: [corpusPart, frontPart],
        corpusHeight,
    };
}
