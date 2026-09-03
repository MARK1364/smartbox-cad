import { MaterialItem, EdgeBandingType, MaterialFilters, MaterialInfo } from './material-types.js';
import smartPanelData from '../A4_smartpanel/smart_panel_V1.json';

// Domyślna paleta kolorów i właściwości dla znanych dekorów Egger oraz materiałów
const MATERIAL_VISUAL_PROPERTIES: Record<string, { color: { r: number; g: number; b: number }; hex: string; roughness: number; isTransparent?: boolean; opacity?: number }> = {
    // Biel i uniwersalne
    "W1100_ST9": { color: { r: 0.95, g: 0.95, b: 0.95 }, hex: "#f2f2f2", roughness: 0.4 },
    "U999_ST9": { color: { r: 0.12, g: 0.12, b: 0.12 }, hex: "#1f1f1f", roughness: 0.4 },
    "U708_ST9": { color: { r: 0.75, g: 0.74, b: 0.72 }, hex: "#bfbcb8", roughness: 0.4 },
    
    // Drewna
    "H1110_ST9": { color: { r: 0.82, g: 0.74, b: 0.62 }, hex: "#d1bd9e", roughness: 0.6 },
    "H1113_ST10": { color: { r: 0.55, g: 0.42, b: 0.30 }, hex: "#8c6b4d", roughness: 0.65 },
    "H1115_ST12": { color: { r: 0.65, g: 0.58, b: 0.52 }, hex: "#a69485", roughness: 0.6 },
    "H1115_ST9": { color: { r: 0.65, g: 0.58, b: 0.52 }, hex: "#a69485", roughness: 0.6 },
    "H1122_ST22": { color: { r: 0.88, g: 0.86, b: 0.82 }, hex: "#e0dcd1", roughness: 0.55 },
    "H1123_ST22": { color: { r: 0.28, g: 0.28, b: 0.30 }, hex: "#47474d", roughness: 0.55 },
    "H1137_ST12": { color: { r: 0.22, g: 0.18, b: 0.15 }, hex: "#382e26", roughness: 0.7 },
    "H1145_ST10": { color: { r: 0.78, g: 0.68, b: 0.54 }, hex: "#c7ad8a", roughness: 0.6 },
    "H1146_ST10": { color: { r: 0.62, g: 0.59, b: 0.55 }, hex: "#9e968c", roughness: 0.6 },
    "H1150_ST10": { color: { r: 0.58, g: 0.54, b: 0.50 }, hex: "#948a80", roughness: 0.6 },
    "H1180_ST37": { color: { r: 0.72, g: 0.62, b: 0.48 }, hex: "#b89e7a", roughness: 0.7 },
    "H1181_ST37": { color: { r: 0.45, g: 0.36, b: 0.28 }, hex: "#735c47", roughness: 0.7 },
    "H3170_ST12": { color: { r: 0.75, g: 0.65, b: 0.50 }, hex: "#bfa680", roughness: 0.6 },
    "H3309_ST28": { color: { r: 0.70, g: 0.60, b: 0.45 }, hex: "#b39973", roughness: 0.65 },

    // MDF
    "MDF_SUROWY_18": { color: { r: 0.62, g: 0.48, b: 0.35 }, hex: "#9e7a59", roughness: 0.8 },
    "MDF_SUROWY_16": { color: { r: 0.62, g: 0.48, b: 0.35 }, hex: "#9e7a59", roughness: 0.8 },
    "MDF_SUROWY_10": { color: { r: 0.62, g: 0.48, b: 0.35 }, hex: "#9e7a59", roughness: 0.8 },

    // HDF
    "HDF_BIALY_3": { color: { r: 0.94, g: 0.94, b: 0.94 }, hex: "#f0f0f0", roughness: 0.3 },
    "HDF_CZARNY_3": { color: { r: 0.15, g: 0.15, b: 0.15 }, hex: "#262626", roughness: 0.3 },
    "HDF_SUROWY_3": { color: { r: 0.58, g: 0.45, b: 0.32 }, hex: "#947352", roughness: 0.85 },

    // Szkła & Lustra
    "LACOBEL_CZARNY": { color: { r: 0.08, g: 0.08, b: 0.08 }, hex: "#141414", roughness: 0.05 },
    "LACOBEL_BIALY": { color: { r: 0.96, g: 0.96, b: 0.98 }, hex: "#f5f5fa", roughness: 0.05 },
    "SZKLO_MATOWE": { color: { r: 0.85, g: 0.90, b: 0.92 }, hex: "#d9e6eb", roughness: 0.4, isTransparent: true, opacity: 0.45 },
    "SZKLO_DYMNE": { color: { r: 0.25, g: 0.25, b: 0.28 }, hex: "#404047", roughness: 0.1, isTransparent: true, opacity: 0.4 },
    "LUSTRO_SREBRNE_4": { color: { r: 0.88, g: 0.92, b: 0.95 }, hex: "#e0ebf2", roughness: 0.02 }
};

// Domyślne ceny bazowe (PLN / m2)
const DEFAULT_CATEGORY_PRICES_M2: Record<string, number> = {
    "Płyta Wiórowa": 65.0,
    "MDF": 75.0,
    "HDF": 25.0,
    "Szkło": 180.0,
    "Lustro": 140.0
};

class MaterialDatabase {
    private materials: MaterialItem[] = [];
    private edgeBandings: EdgeBandingType[] = [];

    constructor() {
        this.loadDatabase();
    }

    private loadDatabase() {
        const rawDb = (smartPanelData as any).materials_database || {};
        const loaded: MaterialItem[] = [];

        for (const [groupId, groupData] of Object.entries<any>(rawDb)) {
            const categoryName = groupData.category_name || 'Płyta Wiórowa';
            const defaultThickness = Number(groupData.default_thickness_mm) || 18.0;
            const density = Number(groupData.density_kg_m3) || 680.0;
            const items = groupData.items || {};

            for (const [itemId, itemData] of Object.entries<any>(items)) {
                const thickness = Number(itemData.thickness_mm) || defaultThickness;
                const name = itemData.name || itemId;
                const code = itemData.code || '';

                // Dopasowanie właściwości wizualnych (kolor, przezroczystość, roughness)
                const baseKey = itemId.replace(/_\d+$/, '');
                const visual = MATERIAL_VISUAL_PROPERTIES[itemId] || 
                               MATERIAL_VISUAL_PROPERTIES[baseKey] || 
                               MATERIAL_VISUAL_PROPERTIES[code.replace(/\s+/g, '_')] || {
                    color: { r: 0.78, g: 0.72, b: 0.64 },
                    hex: "#c7b8a3",
                    roughness: 0.6
                };

                // Mapowanie tekstury Egger (np. H1145_ST10_Dab Bardolino naturalny_Albedo.png)
                const safeCode = code.replace(/\s+/g, '_');
                const texturePath = itemData.texture_path || (code ? `/textures/egger/${safeCode}_Albedo.png` : undefined);

                const priceM2 = itemData.price_per_m2 || (DEFAULT_CATEGORY_PRICES_M2[categoryName] || 65.0) * (thickness / 18.0);

                loaded.push({
                    id: itemId,
                    name,
                    code,
                    category: categoryName,
                    thickness_mm: thickness,
                    density_kg_m3: density,
                    color: visual.color,
                    hexColor: visual.hex,
                    roughness: visual.roughness,
                    isTransparent: visual.isTransparent || false,
                    opacity: visual.opacity !== undefined ? visual.opacity : 1.0,
                    texture_path: texturePath,
                    price_key: itemData.price_key || itemId,
                    price_per_m2: Math.round(priceM2 * 100) / 100,
                    price_per_m3: Math.round((priceM2 / (thickness / 1000.0)) * 100) / 100
                });
            }
        }

        // Dodanie wariantów 16mm dla płyt (częsty standard meblarski)
        const sample18 = loaded.filter(m => m.thickness_mm === 18 && m.category === 'Płyta Wiórowa');
        for (const mat of sample18) {
            const id16 = mat.id.replace(/_18$/, '') + '_16';
            if (!loaded.some(m => m.id === id16)) {
                loaded.push({
                    ...mat,
                    id: id16,
                    thickness_mm: 16.0,
                    price_per_m2: Math.round(mat.price_per_m2! * (16.0 / 18.0) * 100) / 100
                });
            }
        }

        this.materials = loaded;

        // Załaduj okleiny
        const rawEdges = (smartPanelData as any).edge_banding_types || {};
        const edges: EdgeBandingType[] = [];
        for (const [edgeId, edgeData] of Object.entries<any>(rawEdges)) {
            edges.push({
                id: edgeId,
                name: edgeData.name || edgeId,
                thickness_mm: 0.8,
                width_mm: 22.0,
                price_per_mb: 3.50
            });
        }
        // Dodaj standardowe okleiny jeśli brak
        if (edges.length === 0 || !edges.some(e => e.id === 'ABS_1x22')) {
            edges.push({ id: 'ABS_0.8x22', name: 'Okleina ABS 0.8x22 mm', thickness_mm: 0.8, width_mm: 22.0, price_per_mb: 2.80 });
            edges.push({ id: 'ABS_1x22', name: 'Okleina ABS 1.0x22 mm', thickness_mm: 1.0, width_mm: 22.0, price_per_mb: 3.50 });
            edges.push({ id: 'ABS_2x22', name: 'Okleina ABS 2.0x22 mm', thickness_mm: 2.0, width_mm: 22.0, price_per_mb: 5.20 });
            edges.push({ id: 'ABS_0.8x43', name: 'Okleina ABS 0.8x43 mm', thickness_mm: 0.8, width_mm: 43.0, price_per_mb: 6.00 });
        }
        this.edgeBandings = edges;
    }

    public getAllMaterials(): MaterialItem[] {
        return this.materials;
    }

    public getMaterialById(id: string): MaterialItem | undefined {
        if (!id) return undefined;
        return this.materials.find(m => m.id === id || m.id.toLowerCase() === id.toLowerCase() || m.code.toLowerCase() === id.toLowerCase());
    }

    /**
     * Zwraca pełne, znormalizowane informacje o materiale (ID, Kod, Nazwa, Grubość, Pełna Etykieta).
     * Zapobiega myleniu kodu dekoru (np. W1100 ST9) ze specyficzną grubością płyty (np. W1100_ST9_18 / W1100_ST9_10).
     */
    public getMaterialInfo(rawInput?: string, fallbackThickness?: number): MaterialInfo {
        const cleaned = (rawInput || '').trim();
        const thickness = fallbackThickness ? Math.round(fallbackThickness * 10) / 10 : 18.0;

        const buildLabel = (name: string, code: string, thk: number) => {
            const cleanName = name.replace(/\s+\d+(\.\d+)?\s*mm$/i, '').trim();
            const codePart = code ? ` (${code})` : '';
            return `${cleanName}${codePart} ${Math.round(thk * 10) / 10}mm`;
        };

        if (!cleaned) {
            return {
                id: `W1100_ST9_${Math.round(thickness)}`,
                code: 'W1100 ST9',
                name: 'Biały Alpejski',
                thickness_mm: thickness,
                fullLabel: buildLabel('Biały Alpejski', 'W1100 ST9', thickness),
                category: 'Płyta Wiórowa'
            };
        }

        // 1. Bezpośrednie dopasowanie po ID w bazie (np. "W1100_ST9_18")
        const byId = this.materials.find(m => m.id.toLowerCase() === cleaned.toLowerCase());
        if (byId) {
            const cleanName = byId.name.replace(/\s+\d+(\.\d+)?\s*mm$/i, '').trim();
            return {
                id: byId.id,
                code: byId.code || '',
                name: cleanName,
                thickness_mm: byId.thickness_mm,
                fullLabel: buildLabel(cleanName, byId.code || '', byId.thickness_mm),
                category: byId.category
            };
        }

        // 2. Dopasowanie po nazwie lub kodzie (np. "Biały Alpejski" lub "W1100 ST9")
        const byNameOrCode = this.materials.find(m => 
            m.name.toLowerCase() === cleaned.toLowerCase() || 
            (m.code && m.code.toLowerCase() === cleaned.toLowerCase())
        );
        if (byNameOrCode) {
            const cleanName = byNameOrCode.name.replace(/\s+\d+(\.\d+)?\s*mm$/i, '').trim();
            return {
                id: byNameOrCode.id,
                code: byNameOrCode.code || '',
                name: cleanName,
                thickness_mm: byNameOrCode.thickness_mm,
                fullLabel: buildLabel(cleanName, byNameOrCode.code || '', byNameOrCode.thickness_mm),
                category: byNameOrCode.category
            };
        }

        // 3. Sprawdzenie po bazie dekoru bez sufiksu grubości (np. W1100_ST9)
        const baseKey = cleaned.replace(/_\d+$/, '');
        const byBase = this.materials.find(m => m.id.startsWith(baseKey));
        if (byBase) {
            const cleanName = byBase.name.replace(/\s+\d+(\.\d+)?\s*mm$/i, '').trim();
            return {
                id: `${baseKey}_${Math.round(thickness)}`,
                code: byBase.code || '',
                name: cleanName,
                thickness_mm: thickness,
                fullLabel: buildLabel(cleanName, byBase.code || '', thickness),
                category: byBase.category
            };
        }

        // 4. Mapowanie znanych aliasów (Biały Alpejski / Biel Alpejska / W1100)
        const lower = cleaned.toLowerCase();
        if (lower.includes('biel alpejska') || lower.includes('bialy alpejski') || lower.includes('biały alpejski') || lower.startsWith('w1100')) {
            return {
                id: `W1100_ST9_${Math.round(thickness)}`,
                code: 'W1100 ST9',
                name: 'Biały Alpejski',
                thickness_mm: thickness,
                fullLabel: buildLabel('Biały Alpejski', 'W1100 ST9', thickness),
                category: 'Płyta Wiórowa'
            };
        }

        // 5. Fallback dla customowych materiałów
        const fallbackName = cleaned.replace(/_\d+$/, '').replace(/_/g, ' ');
        return {
            id: cleaned,
            code: '',
            name: fallbackName,
            thickness_mm: thickness,
            fullLabel: buildLabel(fallbackName, '', thickness),
            category: 'Inne'
        };
    }

    public getEdgeBandingTypes(): EdgeBandingType[] {
        return this.edgeBandings;
    }

    public getEdgeBandingById(id: string): EdgeBandingType | undefined {
        if (!id) return undefined;
        return this.edgeBandings.find((edge) => edge.id === id || edge.id.toLowerCase() === id.toLowerCase());
    }

    /**
     * Wlewa overlay z pliku projektu do katalogu (upsert po id).
     * Nie kasuje globalnej bazy — tylko uzupełnia / nadpisuje użyte pozycje.
     */
    public mergeOverlay(overlay: { materials?: MaterialItem[]; edgeBandings?: EdgeBandingType[] } | null | undefined): void {
        if (!overlay) return;

        for (const item of overlay.materials || []) {
            if (!item?.id) continue;
            const index = this.materials.findIndex((m) => m.id === item.id);
            if (index >= 0) {
                this.materials[index] = { ...this.materials[index], ...item };
            } else {
                this.materials.push({ ...item });
            }
        }

        for (const edge of overlay.edgeBandings || []) {
            if (!edge?.id) continue;
            const index = this.edgeBandings.findIndex((e) => e.id === edge.id);
            if (index >= 0) {
                this.edgeBandings[index] = { ...this.edgeBandings[index], ...edge };
            } else {
                this.edgeBandings.push({ ...edge });
            }
        }
    }

    public getCategories(): string[] {
        const cats = new Set<string>();
        for (const m of this.materials) {
            cats.add(m.category);
        }
        return ['Wszystkie', ...Array.from(cats)];
    }

    public getAvailableThicknesses(): number[] {
        const ths = new Set<number>();
        for (const m of this.materials) {
            ths.add(m.thickness_mm);
        }
        return Array.from(ths).sort((a, b) => a - b);
    }

    public filterMaterials(filters: MaterialFilters): MaterialItem[] {
        let list = [...this.materials];

        // Filtrowanie po kategorii
        if (filters.category && filters.category !== 'Wszystkie') {
            list = list.filter(m => m.category === filters.category);
        }

        // Filtrowanie po grubości
        if (filters.thickness && filters.thickness !== 'Wszystkie') {
            const th = parseFloat(filters.thickness);
            if (!isNaN(th)) {
                list = list.filter(m => Math.abs(m.thickness_mm - th) < 0.1);
            }
        }

        // Wyszukiwanie tekstowe
        if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
            const q = filters.searchQuery.toLowerCase().trim();
            list = list.filter(m => 
                m.name.toLowerCase().includes(q) ||
                m.code.toLowerCase().includes(q) ||
                m.id.toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q)
            );
        }

        // Sortowanie
        switch (filters.sortMode) {
            case 'NAME_DESC':
                list.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'THICKNESS_ASC':
                list.sort((a, b) => a.thickness_mm - b.thickness_mm || a.name.localeCompare(b.name));
                break;
            case 'THICKNESS_DESC':
                list.sort((a, b) => b.thickness_mm - a.thickness_mm || a.name.localeCompare(b.name));
                break;
            case 'CODE_ASC':
                list.sort((a, b) => a.code.localeCompare(b.code));
                break;
            case 'NAME_ASC':
            default:
                list.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }

        return list;
    }
}

export const materialDatabase = new MaterialDatabase();
