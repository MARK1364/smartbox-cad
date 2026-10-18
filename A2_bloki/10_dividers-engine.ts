/**
 * dividers-engine.ts — moduł PRZEGRODY (blok_dividers)
 *
 * Czysta architektura funkcyjna (Functional Core) sprzyjająca agentom AI:
 *  - Wyraźne typy DTO ze sprecyzowanymi jednostkami fizycznymi (_mm).
 *  - Czyste funkcje kalkulacji geometrii bez ukrytego stanu (pure functions).
 *  - Zgodność z .agents/AGENTS.md (role 'DIVIDER_PLATE', nodeType 'PART', jednostki mm w planowaniu).
 *  - SSOT parametrów: A2_bloki/01_BLOKI_PARAMETERS.md
 */

import dividersRules from './10_dividers_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';
import { toDimensionsMm, type ModuleDims } from './01_base-engine.js';
import type {
    BlokiDimensions_mm,
    BlokiPlanResult,
    BlokiPart
} from './01_bloki-types.js';
import type { DividersPlanParams } from './01_bloki-module-types.js';
import {
    assertCanonicalDividersParams,
    readOptionalNumber
} from './01_bloki-module-param-guards.js';

export { assertCanonicalDividersParams, LEGACY_DIVIDERS_PARAM_ALIASES } from './01_bloki-module-param-guards.js';

const DIVIDER_LCS = {
    mapping: { X: 'x', Y: 'y', Z: 'z' },
    rotation: [90, 0, 90] as [number, number, number],
    faces: { INNER: 'FACE_Z_PLUS', OUTER: 'FACE_Z_MINUS' }
};

const MAX_DIVIDERS = 5;
const DEFAULT_SECTION_MM = 200;

function defaultThicknessMm(): number {
    return resolveRuleThicknessMm(dividersRules, ['DIVIDERS_1', 'DIVIDER_PLATE'], 'thickness', 'dividers');
}

// ─── Typy Domenowe Przegród ───────────────────────────────────────────────────

export interface DividerSlot {
    index: number;
    xCenter: number;
    bayBefore: number;
}

export interface DividerLayout {
    liczba_przegrod: number;
    width_mm: number;
    height_mm: number;
    depth_mm: number;
    grubosc_przegrody_mm: number;
    tryb_rozstawu: 'EQUAL' | 'CUSTOM';
    szerokosci_wnek_mm: number[];
    ostatnia_wneka_mm: number;
    ostatnia_wneka_poza_panelem: boolean;
    slots: DividerSlot[];
}

export interface NormalizedDividersParams {
    liczba_przegrod: number;
    grubosc_przegrody_mm: number;
    tryb_rozstawu: 'EQUAL' | 'CUSTOM';
    szerokosci_wnek_mm: number[];
}

// ─── Czyste Funkcje Matematyczne ──────────────────────────────────────────────

function readSectionWidths(params: Record<string, unknown>, count: number): number[] {
    const candidate = params.szerokosci_wnek_mm;
    const fromArray = Array.isArray(candidate) ? candidate as number[] : [];
    const widths: number[] = [];
    for (let i = 1; i <= count; i++) {
        let v = fromArray[i - 1];
        v = Number(v);
        if (!Number.isFinite(v) || v <= 0) v = DEFAULT_SECTION_MM;
        widths.push(v);
    }
    return widths;
}

/** Oblicza równe światło pojedynczej wnęki: (W − n×grubość) / (n + 1). */
export function equalBayWidth(
    szerokosc_strefy_mm: number,
    liczba_przegrod: number,
    grubosc_przegrody_mm: number
): number {
    if (liczba_przegrod <= 0) return szerokosc_strefy_mm;
    const remaining_mm = szerokosc_strefy_mm - liczba_przegrod * grubosc_przegrody_mm;
    return Math.round((remaining_mm / (liczba_przegrod + 1)) * 100) / 100;
}

/**
 * Normalizuje parametry wejściowe do spójnego DTO. Tylko klucze kanoniczne.
 */
export function normalizeDividersParams(
    raw: DividersPlanParams = {},
    dims?: BlokiDimensions_mm | ModuleDims
): NormalizedDividersParams {
    assertCanonicalDividersParams(raw);
    const input = raw as Record<string, unknown>;
    const liczba_przegrod = Math.max(0, Math.min(MAX_DIVIDERS, Math.round(readOptionalNumber(input, 'liczba_przegrod') ?? 2)));
    const grubosc_przegrody_mm = readOptionalNumber(input, 'grubosc_przegrody_mm') ?? defaultThicknessMm();

    const rawMode = String(input.tryb_rozstawu || 'EQUAL').toUpperCase();
    const tryb_rozstawu: 'EQUAL' | 'CUSTOM' = rawMode === 'CUSTOM' ? 'CUSTOM' : 'EQUAL';

    const szerokosci_wnek_mm = readSectionWidths(input, liczba_przegrod);

    return {
        liczba_przegrod,
        grubosc_przegrody_mm,
        tryb_rozstawu,
        szerokosci_wnek_mm
    };
}

/**
 * Wylicza układ wnęk i pozycji X przegród.
 */
export function resolveDividerLayout(
    params: DividersPlanParams,
    dims: BlokiDimensions_mm | ModuleDims
): DividerLayout {
    const d = toDimensionsMm(dims);
    const szerokosc_mm = d.width_mm || 600;
    const wysokosc_mm = d.height_mm || 720;
    const glebokosc_mm = d.depth_mm || 500;

    const p = normalizeDividersParams(params, {
        width_mm: szerokosc_mm,
        height_mm: wysokosc_mm,
        depth_mm: glebokosc_mm
    });

    let bays: number[];
    if (p.liczba_przegrod <= 0) {
        bays = [];
    } else if (p.tryb_rozstawu === 'CUSTOM') {
        bays = p.szerokosci_wnek_mm.map(v => Math.round(v * 100) / 100);
    } else {
        const eq = equalBayWidth(szerokosc_mm, p.liczba_przegrod, p.grubosc_przegrody_mm);
        bays = Array.from({ length: p.liczba_przegrod }, () => eq);
    }

    const used_mm = bays.reduce((s, v) => s + v, 0) + p.liczba_przegrod * p.grubosc_przegrody_mm;
    const lastBay_mm = Math.round((szerokosc_mm - used_mm) * 100) / 100;

    const slots: DividerSlot[] = [];
    let currentX = -szerokosc_mm / 2;
    for (let i = 0; i < p.liczba_przegrod; i++) {
        currentX += bays[i];
        const xCenter = currentX + p.grubosc_przegrody_mm / 2;
        slots.push({ index: i + 1, xCenter, bayBefore: bays[i] });
        currentX += p.grubosc_przegrody_mm;
    }

    return {
        liczba_przegrod: p.liczba_przegrod,
        width_mm: szerokosc_mm,
        height_mm: wysokosc_mm,
        depth_mm: glebokosc_mm,
        grubosc_przegrody_mm: p.grubosc_przegrody_mm,
        tryb_rozstawu: p.tryb_rozstawu,
        szerokosci_wnek_mm: bays,
        ostatnia_wneka_mm: lastBay_mm,
        ostatnia_wneka_poza_panelem: p.liczba_przegrod > 0 && lastBay_mm < 10,
        slots
    };
}

// ─── Czysta Funkcja Kalkulacji Planu Przegród ──────────────────────────────────

/**
 * Czysta funkcja matematyczna generująca formatki pionowych przegród.
 * Zero stanu, zero zależności od sceny/DOM/Babylon.
 */
export function calculateDividersPlan(
    dims: BlokiDimensions_mm,
    params: NormalizedDividersParams
): BlokiPlanResult {
    const layout = resolveDividerLayout(params, dims);
    const roleOverride = (dividersRules as any).parameters?.smart_panel_integration?.role_overrides?.DIVIDER_PLATE;

    // FRONT w orientacji LCS formatki to +Y (identycznie jak w półkach — skierowane do przodu szafy)
    const edgeBanding = {
        "+X": { active: false, type_id: "none" },
        "-X": { active: false, type_id: "none" },
        "+Y": { active: true, type_id: roleOverride?.edge_banding?.["-X"]?.type_id || "0.008x0.022" },
        "-Y": { active: false, type_id: "none" }
    };

    const parts: BlokiPart[] = layout.slots.map((slot) => ({
        name: `Przegroda_${slot.index}`,
        key: `DIVIDERS_${slot.index}`,
        role: 'DIVIDER_PLATE',
        nodeType: 'PART',
        material: 'W1100_ST9_18',
        materialName: 'Biały Alpejski',
        materialCode: 'W1100 ST9',
        dim: { x: layout.height_mm, y: layout.depth_mm, z: layout.grubosc_przegrody_mm },
        loc: { x: slot.xCenter, y: 0, z: layout.height_mm / 2 },
        lcs: DIVIDER_LCS,
        edge_banding: edgeBanding,
        features: []
    }));

    return { parts };
}

