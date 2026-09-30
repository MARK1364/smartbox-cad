/**
 * smartframe-engine.ts
 *
 * Silnik geometrii korpusu SmartFrame (1 / 2 / 3 strefy).
 * Czysty Functional Core:
 *  - normalizeCabinetParams (normalizacja parametrów z jawnymi jednostkami _mm)
 *  - calculateCabinetPlan (czysty bezstanowy dispatcher)
 *  - calculateStandardCabinetPlan, calculateRogowy1CabinetPlan, calculateRogowy90CabinetPlan, calculateSkosnyCabinetPlan
 *  - planCabinet (wejście raw → plan; bez klas)
 *  - collectCabinetGeometry (zgeometryzowane formatki korpusu)
 */

import korpusRulesData from './korpus3_3_rules.json';
import korpusRogowy1RulesData from './korpus_rogowy1_rules.json';
import korpusRogowy90RulesData from './korpus_rogowy90_rules.json';
import korpusSkosnyRulesData from './korpus_skosny_rules.json';

export type {
    CabinetType,
    CabinetDimensions_mm,
    CabinetGeometryPart,
    CabinetEdgeBandingRule,
    CabinetLcsDefinition,
    ZoneLayout,
    CabinetPlanParams,
    CabinetPlanResult,
    NormalizedCabinetParams
} from './smartframe-types.js';
export {
    assertCanonicalCabinetParams,
    LEGACY_CABINET_PARAM_ALIASES,
    CANONICAL_CABINET_PARAM_KEYS
} from './smartframe-types.js';
import {
    CabinetType,
    CabinetDimensions_mm,
    CabinetGeometryPart,
    ZoneLayout,
    CabinetPlanParams,
    CabinetPlanResult,
    NormalizedCabinetParams,
    assertCanonicalCabinetParams
} from './smartframe-types.js';

import { rulesMToMm } from '../A1_core/cad-math/units.js';
import { collectCabinetGeometry } from './geometry/subcomponents-builder.js';
import { getRootSubcomponents } from './geometry/cabinet-thickness.js';

export { collectCabinetGeometry } from './geometry/subcomponents-builder.js';

/** Defaulty gabarytu [mm] — jawne, nie zgadywane z braku danych. */
const DEFAULT_SZEROKOSC_MM = 600;
const DEFAULT_WYSOKOSC_MM = 720;
const DEFAULT_GLEBOKOSC_MM = 560;
const DEFAULT_SZEROKOSC_TRAWERSU_MM = 80;
const DEFAULT_COFNIECIE_PLECOW_MM = 3;
const DEFAULT_GRUBOSC_PLECOW_MM = 3;
const DEFAULT_WPUSZCZENIE_PLECOW_MM = 10;

/**
 * Czysta funkcja normalizująca parametry wejściowe korpusu do DTO z jawnymi jednostkami.
 *
 * Wejście jest KANONICZNE — `assertCanonicalCabinetParams` odrzuca wycofane nazwy
 * (`width`, `bottomHeight`, `blindWidth`, `bokLewy`, `armDepth`, …) czytelnym błędem.
 * Brak łańcuchów `??` między dialektami i brak zgadywania jednoski po wartości.
 */
export function normalizeCabinetParams(
    raw: CabinetPlanParams = {}
): NormalizedCabinetParams {
    assertCanonicalCabinetParams(raw);

    const szerokosc_mm = Number(raw.szerokosc_mm ?? DEFAULT_SZEROKOSC_MM);
    const wysokosc_mm = Number(raw.wysokosc_mm ?? DEFAULT_WYSOKOSC_MM);
    const glebokosc_mm = Number(raw.glebokosc_mm ?? DEFAULT_GLEBOKOSC_MM);
    const liczba_stref = Math.max(1, Math.min(3, Number(raw.liczba_stref ?? 1))) as 1 | 2 | 3;

    const typ_korpusu = raw.typ_korpusu ?? 'korpus3';
    const strona_blendy: 'LEFT' | 'RIGHT' = raw.strona_blendy === 'RIGHT' ? 'RIGHT' : 'LEFT';
    const tryb_wienca_gornego = raw.tryb_wienca_gornego ?? 'FULL';

    return {
        typ_korpusu,
        szerokosc_mm,
        wysokosc_mm,
        glebokosc_mm,
        liczba_stref,
        wysokosc_strefy_dolnej_mm: raw.wysokosc_strefy_dolnej_mm !== undefined
            ? Number(raw.wysokosc_strefy_dolnej_mm)
            : (liczba_stref > 1 ? 300 : undefined),
        wysokosc_strefy_srodkowej_mm: raw.wysokosc_strefy_srodkowej_mm !== undefined
            ? Number(raw.wysokosc_strefy_srodkowej_mm)
            : (liczba_stref === 3 ? 300 : undefined),
        cofniecie_plecow_mm: raw.cofniecie_plecow_mm !== undefined
            ? Number(raw.cofniecie_plecow_mm)
            : DEFAULT_COFNIECIE_PLECOW_MM,
        grubosc_plecow_mm: raw.grubosc_plecow_mm !== undefined
            ? Number(raw.grubosc_plecow_mm)
            : DEFAULT_GRUBOSC_PLECOW_MM,
        wpuszczenie_plecow_mm: raw.wpuszczenie_plecow_mm !== undefined
            ? Number(raw.wpuszczenie_plecow_mm)
            : DEFAULT_WPUSZCZENIE_PLECOW_MM,
        tryb_wienca_gornego,
        szerokosc_trawersu_mm: raw.szerokosc_trawersu_mm !== undefined
            ? Number(raw.szerokosc_trawersu_mm)
            : DEFAULT_SZEROKOSC_TRAWERSU_MM,
        szerokosc_blendy_mm: raw.szerokosc_blendy_mm !== undefined
            ? Number(raw.szerokosc_blendy_mm)
            : undefined,
        strona_blendy,
        glebokosc_boku_lewego_mm: raw.glebokosc_boku_lewego_mm !== undefined
            ? Number(raw.glebokosc_boku_lewego_mm)
            : undefined,
        glebokosc_boku_prawego_mm: raw.glebokosc_boku_prawego_mm !== undefined
            ? Number(raw.glebokosc_boku_prawego_mm)
            : undefined,
        wysokosc_przod_mm: raw.wysokosc_przod_mm !== undefined ? Number(raw.wysokosc_przod_mm) : undefined,
        wysokosc_tyl_mm: raw.wysokosc_tyl_mm !== undefined ? Number(raw.wysokosc_tyl_mm) : undefined,
        wysokosc_lewy_mm: raw.wysokosc_lewy_mm !== undefined ? Number(raw.wysokosc_lewy_mm) : undefined,
        wysokosc_prawy_mm: raw.wysokosc_prawy_mm !== undefined ? Number(raw.wysokosc_prawy_mm) : undefined,
        offsets: raw.offsets,
        container: raw.container
    };
}

/**
 * Czysta funkcja wyliczająca plan dla standardowego korpusu szafki (1, 2 lub 3 strefy).
 */
export function calculateStandardCabinetPlan(
    dims: CabinetDimensions_mm,
    params: NormalizedCabinetParams,
    customRules?: any
): CabinetPlanResult {
    const baseRules = customRules || korpusRulesData;
    const numZones = Math.max(1, Math.min(3, params.liczba_stref || 3)) as 1 | 2 | 3;
    const activeRules = filterRulesForZoneCount(baseRules, numZones);
    const defaults = baseRules.parameters?.defaults || {};
    const defB = rulesMToMm(defaults.bottom_height ?? 0.5);
    const defM = rulesMToMm(defaults.middle_height ?? 1.2);
    const bottomH = params.wysokosc_strefy_dolnej_mm ?? defB;
    const middleH = params.wysokosc_strefy_srodkowej_mm ?? defM;
    const zones = computeCabinetZoneLayout(numZones, dims.wysokosc_mm, bottomH, middleH, baseRules);

    const effectiveParams: CabinetPlanParams = {
        ...params,
        szerokosc_mm: dims.szerokosc_mm,
        wysokosc_mm: dims.wysokosc_mm,
        glebokosc_mm: dims.glebokosc_mm,
        liczba_stref: numZones,
        wysokosc_strefy_dolnej_mm: bottomH,
        wysokosc_strefy_srodkowej_mm: middleH,
        typ_korpusu: 'korpus3'
    };

    const parts = collectCabinetGeometry(effectiveParams, activeRules, baseRules, zones, params.offsets || {});
    return { parts, zones };
}

/**
 * Czysta funkcja wyliczająca plan dla szafki narożnej prostej z blendą (korpus_rogowy1).
 */
export function calculateRogowy1CabinetPlan(
    dims: CabinetDimensions_mm,
    params: NormalizedCabinetParams,
    customRules?: any
): CabinetPlanResult {
    const baseRules = customRules || korpusRogowy1RulesData;
    const activeRules = filterRulesForZoneCount(baseRules, 1);
    const zones: ZoneLayout[] = [{ zoneKey: "SEKCJA_B", size: dims.wysokosc_mm, baseOffset: 0 }];

    const effectiveParams: CabinetPlanParams = {
        ...params,
        szerokosc_mm: dims.szerokosc_mm,
        wysokosc_mm: dims.wysokosc_mm,
        glebokosc_mm: dims.glebokosc_mm,
        szerokosc_blendy_mm: params.szerokosc_blendy_mm,
        strona_blendy: params.strona_blendy,
        liczba_stref: 1,
        typ_korpusu: 'korpus_rogowy1'
    };

    const parts = collectCabinetGeometry(effectiveParams, activeRules, baseRules, zones, params.offsets || {});
    return { parts, zones };
}

/**
 * Czysta funkcja wyliczająca plan dla szafki narożnej L 90° (korpus_rogowy90).
 */
export function calculateRogowy90CabinetPlan(
    dims: CabinetDimensions_mm,
    params: NormalizedCabinetParams,
    customRules?: any
): CabinetPlanResult {
    const baseRules = customRules || korpusRogowy90RulesData;
    const activeRules = filterRulesForZoneCount(baseRules, 1);
    const zones: ZoneLayout[] = [{ zoneKey: "SEKCJA_B", size: dims.wysokosc_mm, baseOffset: 0 }];

    const effectiveParams: CabinetPlanParams = {
        ...params,
        szerokosc_mm: dims.szerokosc_mm,
        wysokosc_mm: dims.wysokosc_mm,
        glebokosc_mm: dims.glebokosc_mm,
        glebokosc_boku_lewego_mm: params.glebokosc_boku_lewego_mm,
        glebokosc_boku_prawego_mm: params.glebokosc_boku_prawego_mm,
        liczba_stref: 1,
        typ_korpusu: 'korpus_rogowy90'
    };

    const parts = collectCabinetGeometry(effectiveParams, activeRules, baseRules, zones, params.offsets || {});
    return { parts, zones };
}

/**
 * Czysta funkcja wyliczająca plan dla szafek skośnych (korpus_skosny*).
 */
export function calculateSkosnyCabinetPlan(
    dims: CabinetDimensions_mm,
    params: NormalizedCabinetParams,
    customRules?: any
): CabinetPlanResult {
    const baseRules = customRules || korpusSkosnyRulesData;
    const activeRules = filterRulesForZoneCount(baseRules, 1);
    const zones: ZoneLayout[] = [{ zoneKey: "SEKCJA_B", size: dims.wysokosc_mm, baseOffset: 0 }];

    const effectiveParams: CabinetPlanParams = {
        ...params,
        szerokosc_mm: dims.szerokosc_mm,
        wysokosc_mm: dims.wysokosc_mm,
        glebokosc_mm: dims.glebokosc_mm,
        wysokosc_przod_mm: params.wysokosc_przod_mm,
        wysokosc_tyl_mm: params.wysokosc_tyl_mm,
        wysokosc_lewy_mm: params.wysokosc_lewy_mm,
        wysokosc_prawy_mm: params.wysokosc_prawy_mm,
        liczba_stref: 1,
        typ_korpusu: params.typ_korpusu
    };

    const parts = collectCabinetGeometry(effectiveParams, activeRules, baseRules, zones, params.offsets || {});
    return { parts, zones };
}

/**
 * Główny czysty dispatcher kalkulacji geometrii korpusu na podstawie wymiarów i znormalizowanych parametrów.
 * Nie tworzy instancji klas, działa bezstanowo.
 */
export function calculateCabinetPlan(
    dims: CabinetDimensions_mm,
    params: NormalizedCabinetParams,
    rulesMap?: Record<string, any>
): CabinetPlanResult {
    const t = String(params.typ_korpusu || 'korpus3').toLowerCase();
    if (t.includes('skosny')) {
        return calculateSkosnyCabinetPlan(dims, params, rulesMap?.[params.typ_korpusu] ?? rulesMap?.korpus_skosny);
    }
    if (t.includes('rogowy90') || t.includes('rogowy_90')) {
        return calculateRogowy90CabinetPlan(dims, params, rulesMap?.[params.typ_korpusu] ?? rulesMap?.korpus_rogowy90);
    }
    if (t.includes('rogowy')) {
        return calculateRogowy1CabinetPlan(dims, params, rulesMap?.[params.typ_korpusu] ?? rulesMap?.korpus_rogowy1);
    }
    return calculateStandardCabinetPlan(dims, params, rulesMap?.[params.typ_korpusu] ?? rulesMap?.korpus3);
}

const ZONE_KEYS_3 = ["SEKCJA_B", "SEKCJA_M", "SEKCJA_T"];
const ACTIVE_ZONES: Record<number, string[]> = {
    1: ["SEKCJA_B"],
    2: ["SEKCJA_B", "SEKCJA_T"],
    3: ZONE_KEYS_3
};

export function applyLcsMapping(dim: { x: number; y: number; z: number }, lcs?: any): { x: number; y: number; z: number } {
    if (!lcs || !lcs.mapping) return { x: dim.x, y: dim.y, z: dim.z };
    const map = lcs.mapping as any;
    const getVal = (k: string) => {
        const clean = String(k || '').replace(/[+-]/g, '').toUpperCase();
        if (clean === 'X') return dim.x;
        if (clean === 'Y') return dim.y;
        if (clean === 'Z') return dim.z;
        return (dim as any)[k] ?? dim.x;
    };
    return {
        x: map.X ? getVal(map.X) : dim.x,
        y: map.Y ? getVal(map.Y) : dim.y,
        z: map.Z ? getVal(map.Z) : dim.z,
    };
}

/**
 * Czysta funkcja wyliczająca rozkład stref pionowych korpusu na podstawie reguł JSON.
 */
export function computeCabinetZoneLayout(
    liczba_stref: number,
    height: number,
    wysokosc_strefy_dolnej_mm: number,
    wysokosc_strefy_srodkowej_mm: number,
    baseRules: any
): ZoneLayout[] {
    const numZones = Math.max(1, Math.min(3, liczba_stref));
    if (numZones === 1) {
        return [{ zoneKey: "SEKCJA_B", size: height, baseOffset: 0 }];
    }
    const activeKeys = ACTIVE_ZONES[numZones] || ZONE_KEYS_3;
    const rootComps = getRootSubcomponents(baseRules);

    const sizes: Record<string, number | null> = {};
    const fillZones: string[] = [];
    let totalFixed = 0;

    for (const key of activeKeys) {
        const zoneDef = rootComps[key]?.zone || {};
        const mode = zoneDef.size_mode || "FIXED";
        if (numZones === 2 && key === "SEKCJA_T") {
            fillZones.push(key);
            sizes[key] = null;
            continue;
        }
        if (mode === "FILL") {
            fillZones.push(key);
            sizes[key] = null;
        } else {
            let sz: number;
            if (key === "SEKCJA_B") sz = wysokosc_strefy_dolnej_mm;
            else if (key === "SEKCJA_M") sz = wysokosc_strefy_srodkowej_mm;
            else {
                const parsed = parseFloat(zoneDef.size || "0");
                sz = rulesMToMm(parsed);
            }
            sizes[key] = sz;
            totalFixed += sz;
        }
    }

    if (fillZones.length > 0) {
        const fillSize = Math.max(height - totalFixed, 0) / fillZones.length;
        for (const fillKey of fillZones) {
            sizes[fillKey] = fillSize;
        }
    }

    const layout: ZoneLayout[] = [];
    let currentOffset = 0;
    for (const key of activeKeys) {
        const sz = sizes[key] ?? 0;
        layout.push({ zoneKey: key, size: sz, baseOffset: currentOffset });
        currentOffset += sz;
    }
    return layout;
}

export function selectCabinetBaseRules(cabinetType?: CabinetType | string): any {
    const t = String(cabinetType || 'korpus3').toLowerCase();
    if (t === 'korpus_skosny_lr_uc' || t.includes('skosny_lr_uc') || t.includes('skosny-lr-uc')) {
        return korpusSkosnyRulesData;
    }
    if (t === 'korpus_skosny_lr' || t === 'korpus-skosny-lr' || t.includes('skosny_lr') || t.includes('skosny-lr')) {
        return korpusSkosnyRulesData;
    }
    if (t === 'korpus_skosny_dach' || t.includes('skosny_dach') || t.includes('skosny-dach')) {
        return korpusSkosnyRulesData;
    }
    if (t === 'korpus_skosny' || t === 'korpus-skosny' || t.includes('skosny')) {
        return korpusSkosnyRulesData;
    }
    if (t === 'korpus_rogowy90' || t === 'korpus-rogowy90' || t === 'korpusrogowy90' || t.includes('rogowy90')) {
        return korpusRogowy90RulesData;
    }
    if (t === 'korpus_rogowy1' || t === 'korpus-rogowy1' || t === 'korpusrogowy1' || (t.includes('rogowy') && !t.includes('90'))) {
        return korpusRogowy1RulesData;
    }
    return korpusRulesData;
}

function filterRulesForZoneCount(baseRules: any, liczba_stref: number): any {
    const numZones = Math.max(1, Math.min(3, liczba_stref));
    const rules = JSON.parse(JSON.stringify(baseRules));
    const modelTree = rules.model_tree || {};
    if (!Object.keys(modelTree).length) return rules;

    const rootKey = Object.keys(modelTree)[0];
    const rootNode = modelTree[rootKey];
    const allZones = getRootSubcomponents(baseRules);

    if (numZones === 1) {
        const zoneB = allZones.SEKCJA_B;
        rootNode.subcomponents = zoneB ? flattenSingleZone(zoneB) : {};
        return rules;
    }

    const activeKeys = ACTIVE_ZONES[numZones] || ZONE_KEYS_3;
    const filteredComps: Record<string, any> = {};

    for (const key of activeKeys) {
        if (!allZones[key]) continue;
        const zoneCopy = JSON.parse(JSON.stringify(allZones[key]));
        const zoneDef = zoneCopy.zone || {};
        if (numZones === 2 && key === "SEKCJA_T") zoneDef.size_mode = "FILL";
        if (numZones === 2 && key === "SEKCJA_B") zoneDef.size_mode = "FIXED";
        zoneCopy.zone = zoneDef;
        filteredComps[key] = zoneCopy;
    }

    rootNode.subcomponents = filteredComps;
    return rules;
}

function flattenSingleZone(zoneNode: any): Record<string, any> {
    const parts: Record<string, any> = {};
    for (const [key, part] of Object.entries(zoneNode.subcomponents || {})) {
        const cleanKey = key.length > 2 && key[1] === "_" ? key.slice(2) : key;
        const partCopy = JSON.parse(JSON.stringify(part));
        if (typeof partCopy.name === "string") {
            for (const prefix of ["Dol_", "Srodek_", "Gora_"]) {
                if (partCopy.name.startsWith(prefix)) {
                    partCopy.name = partCopy.name.slice(prefix.length);
                    break;
                }
            }
        }
        parts[cleanKey] = partCopy;
    }
    return parts;
}

function resolveCabinetTypeFromRaw(rawType: unknown): CabinetType {
    const t = String(rawType || 'korpus3').toLowerCase();
    if (t.includes('skosny_lr_uc') || t.includes('skosny-lr-uc')) return 'korpus_skosny_lr_uc';
    if (t.includes('skosny_lr') || t.includes('skosny-lr')) return 'korpus_skosny_lr';
    if (t.includes('skosny_dach') || t.includes('skosny-dach')) return 'korpus_skosny_dach';
    if (t.includes('skosny')) return 'korpus_skosny';
    if (t.includes('rogowy90') || t.includes('rogowy_90')) return 'korpus_rogowy90';
    if (t.includes('rogowy')) return 'korpus_rogowy1';
    return 'korpus3';
}

/**
 * Jedno wejście planowania korpusu: kanoniczne DTO → CabinetPlanResult.
 * Bez klas, bez trwałego stanu — odpowiednik dawnego Korpus3Engine.plan().
 */
export function planCabinet(rawParams: CabinetPlanParams = {}): CabinetPlanResult {
    const norm = normalizeCabinetParams(rawParams);
    const containerParams = rawParams.container?.generatorParams;
    // `container` to węzeł CAD, nie część DTO — strażnik musi zajrzeć głębiej,
    // bo tam realnie leżą zapisane parametry (górny poziom jest zawsze kanoniczny).
    assertCanonicalCabinetParams(containerParams);
    norm.typ_korpusu = resolveCabinetTypeFromRaw(rawParams.typ_korpusu ?? containerParams?.type);
    const dims: CabinetDimensions_mm = {
        szerokosc_mm: norm.szerokosc_mm,
        wysokosc_mm: norm.wysokosc_mm,
        glebokosc_mm: norm.glebokosc_mm
    };
    return calculateCabinetPlan(dims, norm);
}
