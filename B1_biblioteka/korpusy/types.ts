/**
 * B1_biblioteka/korpusy/types.ts
 *
 * Typy danych szablonów korpusów w bibliotece.
 * Zgodnie z AGENTS.md wszystkie wymiary wejściowe definiowane są w milimetrach ("units": "mm").
 */

export type CabinetCategory = 'dolne' | 'gorne' | 'slupki' | 'inne';

/** Gabaryt korpusu [mm] — klucze kanoniczne (SSOT: CabinetPlanParams). */
export interface CabinetDimensionsMm {
    szerokosc_mm: number;
    wysokosc_mm: number;
    glebokosc_mm: number;
    cokolHeight?: number;
}

/** Parametry podziału korpusu [mm] — klucze kanoniczne. */
export interface CabinetFrameParamsMm {
    liczba_stref: 1 | 2 | 3;
    wysokosc_strefy_dolnej_mm?: number;
    wysokosc_strefy_srodkowej_mm?: number;
    cofniecie_plecow_mm?: number;
    offsets?: Record<string, number>;
}

export interface CabinetSubmoduleRecipe {
    id?: string;
    type: string; // np. 'blok_shelves', 'blok_doors', 'blok_drawers', 'blok_flaps', 'blok_panels'
    boxType: string; // np. 'SHELVES', 'DOORS', 'DRAWERS', 'FLAPS', 'PANELS'
    label?: string;
    zoneIndex?: number; // 0 = dół / główna, 1 = środek, 2 = góra
    params: Record<string, any>; // parametry specyficzne modułu (shelfCount, drawerHeights, doorType, etc.)
}

export interface CabinetTemplate {
    id: string;
    name: string;
    category: CabinetCategory;
    units: 'mm';
    description?: string;
    thumbnail?: string; // dataURL (JPG/PNG/WebP)
    createdAt?: number;
    dimensions: CabinetDimensionsMm;
    frameParams: CabinetFrameParamsMm;
    submodules: CabinetSubmoduleRecipe[];
}

