/**
 * A2_bloki/17_hangers-types.ts
 *
 * DTO i typy dla dedykowanego modułu ZAWIESZKI (HANGERS) w Blokach.
 * Obsługuje pliki pojedyncze (jak TT2.json) oraz pliki z zestawami (sets: [...]).
 * Jednostki: milimetry (mm) na poziomie DTO i UI; units: 'mm'.
 */

import type { SmartPartPackageDefinition } from '../S5_studio/smartpart-studio-types.js';

export interface HangerSetDefinition {
    id: string;
    name: string;
    description?: string;
    brand?: string;
    mainContainer?: {
        widthMm: number;
        heightMm: number;
        depthMm: number;
    };
    parts: any[];
    cuts?: any[];
    parameters?: any[];
    bindings?: any[];
    iconDataUrl?: string;
    visual?: {
        glb?: string;
        png?: string;
        origin?: string;
        units?: string;
    };
}

export interface HangersPlanParams {
    szablon_id?: string;            // Nazwa pliku lub id w bibliotece (np. 'TT2', 'k500')
    zestaw_id?: string;              // Id konkretnego zestawu wewnątrz pliku (np. 'camaro_807')
    odsuniecie_bok_mm?: number;     // Dodatkowa korekta odsunięcia od boku [mm]
    odsuniecie_tyl_mm?: number;     // Dodatkowa korekta odsunięcia od pleców [mm]
    odsuniecie_gora_mm?: number;    // Dodatkowa korekta odsunięcia od góry [mm]
    parametry_zestawu?: Record<string, any>; // Wartości parametrów zdefiniowanych w JSON (np. zamroz_1)
}

/**
 * Wyciąga listę zestawów z dowolnego formatu JSON (pojedynczy pakiet lub wielozestawowy).
 */
export function extractHangerSets(definition: any, fallbackId = 'default'): HangerSetDefinition[] {
    if (!definition || typeof definition !== 'object') return [];

    // Format wielozestawowy: tablica sets: [...]
    if (Array.isArray(definition.sets) && definition.sets.length > 0) {
        return definition.sets.map((s: any, idx: number) => ({
            id: String(s.id || `set_${idx + 1}`),
            name: String(s.name || s.id || `Zestaw ${idx + 1}`),
            description: s.description,
            brand: s.brand || definition.brand,
            mainContainer: s.mainContainer || definition.mainContainer,
            parts: Array.isArray(s.parts) ? s.parts : (s.partBody ? [s.partBody] : []),
            cuts: Array.isArray(s.cuts) ? s.cuts : [],
            parameters: Array.isArray(s.parameters) ? s.parameters : [],
            bindings: Array.isArray(s.bindings) ? s.bindings : [],
            iconDataUrl: s.iconDataUrl || definition.iconDataUrl,
            visual: s.visual || definition.visual,
        }));
    }

    // Format pojedynczy: parts i cuts bezpośrednio w obiekcie (np. TT2.json)
    const parts = Array.isArray(definition.parts) && definition.parts.length > 0
        ? definition.parts
        : definition.partBody
            ? [definition.partBody]
            : [];

    if (parts.length > 0 || definition.mainContainer) {
        return [{
            id: String(definition.id || fallbackId),
            name: String(definition.name || fallbackId),
            description: definition.description,
            brand: definition.brand,
            mainContainer: definition.mainContainer,
            parts,
            cuts: Array.isArray(definition.cuts) ? definition.cuts : [],
            parameters: Array.isArray(definition.parameters) ? definition.parameters : [],
            bindings: Array.isArray(definition.bindings) ? definition.bindings : [],
            iconDataUrl: definition.iconDataUrl,
            visual: definition.visual,
        }];
    }

    return [];
}

/**
 * Pobiera aktywny zestaw na podstawie zestaw_id lub zwraca pierwszy dostępny.
 */
export function resolveActiveHangerSet(definition: any, setId?: string, fallbackId = 'default'): HangerSetDefinition | null {
    const sets = extractHangerSets(definition, fallbackId);
    if (sets.length === 0) return null;
    if (setId) {
        const found = sets.find((s) => s.id === setId);
        if (found) return found;
    }
    return sets[0];
}
