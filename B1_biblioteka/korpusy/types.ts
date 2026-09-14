/**
 * B1_biblioteka/korpusy/types.ts
 *
 * Typy danych szablonów korpusów w bibliotece.
 * Zgodnie z AGENTS.md wszystkie wymiary wejściowe definiowane są w milimetrach ("units": "mm").
 */

export type CabinetCategory = 'dolne' | 'gorne' | 'slupki' | 'inne';

export interface CabinetDimensionsMm {
    width: number;
    height: number;
    depth: number;
    cokolHeight?: number;
}

export interface CabinetFrameParamsMm {
    zoneCount: 1 | 2 | 3;
    bottomHeight?: number;
    middleHeight?: number;
    backOffset?: number;
    offsets?: Record<string, number>;
}

export interface CabinetSubmoduleRecipe {
    id?: string;
    type: string; // np. 'smartbox_shelves', 'smartbox_doors', 'smartbox_drawers', 'smartbox_flaps', 'smartbox_panels'
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

