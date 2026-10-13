/**
 * SmartPanel Web — Schemat Danych Projektu (SSOT Contract)
 *
 * Ten plik opisuje starszy kontrakt interchange (płaska lista `containers[]`,
 * rotacja Eulera). Żywy zapis projektu to drzewo `smartpanel-project` v3
 * w `ProjectDocument` (`rootNode` + `extensions`). Nie używaj tego schematu
 * jako źródła prawdy dla `.spp.json`.
 *
 * JEDNOSTKI: Wszystkie wartości liniowe w tym schemacie są w NANOMETRACH (nm) jako integer.
 *   1 mm = 1 000 000 nm
 *   600 mm płyta = 600_000_000 nm
 *
 * Konwersje:
 *   UI (mm)    ← unit.toMM(nm)      /  unit.fromMM(mm) → nm
 *   Babylon    ← unit.toBabylon(nm)  /  unit.fromBabylon(mm) → nm
 */

import type { Nanometers } from './unit-system.js';

// Alias dla czytelności w schemacie
type NM = Nanometers;

export interface Vector3D {
    x: NM;
    y: NM;
    z: NM;
}

export interface TransformJSON {
    /** Pozycja [X, Y, Z] w nanometrach. Oś Y = wysokość (w górę). */
    loc: [NM, NM, NM];
    /** Kąty Eulera w radianach. */
    rot: [number, number, number];
}

export const SUPPORTED_FEATURE_TYPES = ['hole', 'groove'] as const;
export type SupportedFeatureType = typeof SUPPORTED_FEATURE_TYPES[number];

/**
 * Walidacja typu feature'a na granicy wejścia (wczytanie / import / edycja projektu).
 * Rzuca czytelny błąd walidacyjny (Fail-Fast), uniemożliwiając wstrzyknięcie uszkodzonych danych.
 */
export function validateFeatureType(feat: { type?: string; id?: number | string }): void {
    if (!feat || !feat.type || !SUPPORTED_FEATURE_TYPES.includes(feat.type as any)) {
        throw new Error(
            `[project-schema] Nieobsługiwany typ feature: "${feat?.type}" (id: ${feat?.id ?? 'brak'}). ` +
            `Dozwolone typy w natywnym silniku 2.5D to: ${SUPPORTED_FEATURE_TYPES.join(', ')}.`
        );
    }
}

export function validatePanelFeatures(features: any[] | undefined): void {
    if (!features || !Array.isArray(features)) return;
    for (const feat of features) {
        validateFeatureType(feat);
    }
}

export interface FeatureJSON {
    id: number;
    /**
     * Typ obróbki/cechy.
     * Natywny silnik 2.5D wspiera w pełni: "hole" oraz "groove".
     * Typy "fillet", "pocket", "slot" są zdefiniowane w schemacie pod przyszłe rozszerzenia (rzucają błąd przy walidacji wejściowej).
     */
    type: "hole" | "groove" | "fillet" | "pocket" | "slot" | string;
    name?: string;
    visible?: boolean;
    /** Nazwa ściany na której leży feature, np. "front", "back", "left", "right", "top", "bottom" */
    face: string;
    params: {
        /** Średnica otworu [nm] */
        diameter?: NM;
        /** Głębokość otworu/kieszeni [nm] */
        depth?: NM;
        /** Promień zaokrąglenia [nm] */
        radius?: NM;
        /** Pozycja U na ścianie (pozioma) [nm] */
        u?: NM;
        /** Pozycja V na ścianie (pionowa) [nm] */
        v?: NM;
        [key: string]: any;
    };
}

export interface PartJSON {
    id: string;
    parent_id: string | null;
    name: string;
    type: "part";
    /** Rola płyty w konstrukcji, np. "LEFT_SIDE_PANEL", "BOTTOM_PANEL", "BACK_PANEL" */
    role: string;
    /** Grubość płyty [nm] */
    thickness: NM;
    /** Wymiary [szerokość, wysokość, grubość] w nanometrach */
    dims: [NM, NM, NM];
    transform: TransformJSON;
    features?: FeatureJSON[];
    custom_properties?: Record<string, any>;
}

export interface SmartFrameJSON {
    id: string;
    parent_id: string | null;
    name: string;
    type: "container";
    subtype: "SMARTFRAME" | "BLOKI" | string;
    properties?: {
        /** Szerokość kontenera [nm] */
        width: NM;
        /** Wysokość kontenera [nm] */
        height: NM;
        /** Głębokość kontenera [nm] */
        depth: NM;
        [key: string]: any;
    };
    transform?: TransformJSON;
    children?: (PartJSON | SmartFrameJSON)[];
}

export interface ProjectStateJSON {
    project: {
        /** Wersja formatu pliku */
        version: string;
        /** Czas zapisu ISO 8601 */
        timestamp: string;
        project_name: string;
        type: "project";
        /** Wszystkie kontenery (korpusy, Bloki itp.) */
        containers: SmartFrameJSON[];
        constraints?: any[];
        materials_catalog?: Record<string, any>;
        settings?: Record<string, any>;
    };
}

// Jednostka domenowa jest jawnie nazwana — bez aliasów typu `Microns`.
export type { Nanometers } from './unit-system.js';
