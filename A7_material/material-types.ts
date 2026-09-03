/**
 * Typy i interfejsy dla modułu A7_material (Baza Materiałów, Okleiny, Wycena).
 */

export type MaterialScope = 'SINGLE' | 'CONTAINER' | 'SMARTBOX' | 'PROJECT';

export interface MaterialItem {
    id: string;
    name: string;
    code: string;
    category: string;
    thickness_mm: number;
    density_kg_m3: number;
    color: { r: number; g: number; b: number; a?: number };
    hexColor?: string;
    texture_path?: string;
    price_key?: string;
    price_per_m2?: number;
    price_per_m3?: number;
    isTransparent?: boolean;
    opacity?: number;
    roughness?: number;
}

export interface EdgeBandingType {
    id: string;
    name: string;
    thickness_mm: number;
    width_mm: number;
    price_per_mb?: number;
    color?: string;
}

export interface PanelPricingCalculation {
    panelId: string;
    panelName: string;
    materialName: string;
    materialCode: string;
    thickness_mm: number;
    area_m2: number;
    volume_m3: number;
    weight_kg: number;
    edgeBanding_mb: number;
    materialCost: number;
    edgeBandingCost: number;
    totalCost: number;
}

export interface ProjectPricingSummary {
    totalArea_m2: number;
    totalVolume_m3: number;
    totalWeight_kg: number;
    totalEdgeBanding_mb: number;
    totalMaterialCost: number;
    totalEdgeBandingCost: number;
    totalCost: number;
    panelsCount: number;
    materialsBreakdown: Record<string, {
        material: MaterialItem;
        count: number;
        area_m2: number;
        volume_m3: number;
        weight_kg: number;
        cost: number;
    }>;
}

export interface MaterialFilters {
    category: string;
    thickness: string;
    searchQuery: string;
    sortMode: 'NAME_ASC' | 'NAME_DESC' | 'THICKNESS_ASC' | 'THICKNESS_DESC' | 'CODE_ASC';
}

export interface MaterialInfo {
    id: string;             // np. "W1100_ST9_18" (pełne ID SKU)
    code: string;           // np. "W1100 ST9" (kod dekoru producenta)
    name: string;           // np. "Biały Alpejski" (nazwa dekoru)
    thickness_mm: number;   // np. 18.0 (fizyczna grubość płyty)
    fullLabel: string;      // np. "Biały Alpejski (W1100 ST9) 18mm"
    category: string;       // np. "Płyta Wiórowa"
}
