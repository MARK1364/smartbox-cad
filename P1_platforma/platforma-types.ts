/**
 * P1_platforma — Typy danych platformy modeli mebli CAD
 * Jednostki w katalogu: mm (zgodnie z AGENTS.md, konwersja do nm na brzegu).
 */

export type FurnitureCategory =
    | 'DOLNE'
    | 'WISZACE'
    | 'SLUPKI'
    | 'NAROZNE'
    | 'SZAFY'
    | 'BIURO_POKOJ';

export interface FurnitureDimensionsMm {
    width_mm: number;
    height_mm: number;
    depth_mm: number;
}

export interface FurnitureFeatureTag {
    id: string;
    label: string;
    icon?: string;
}

export interface FurnitureCatalogItem {
    id: string;
    code: string;
    name: string;
    category: FurnitureCategory;
    categoryLabel: string;
    dimensions: FurnitureDimensionsMm;
    description: string;
    tags: string[];
    korpusType: string;
    thumbnailSvg?: string;
    // Podsumowanie techniczne do specyfikacji
    shelfCount?: number;
    doorCount?: number;
    drawerCount?: number;
    flapCount?: number;
    hingeBrand?: string;
    hardwareBrand?: string;
    // Dane konfiguracyjne do otwarcia w głównym programie CAD
    projectConfig: {
        typ_korpusu: string;
        width_mm: number;
        height_mm: number;
        depth_mm: number;
        material_korpus?: string;
        material_front?: string;
        bloki?: Array<{
            kind: string;
            params: Record<string, any>;
        }>;
    };
}
