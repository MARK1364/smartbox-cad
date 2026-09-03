import pricesData from './prices.json';
import smartPanelV1 from '../A4_smartpanel/smart_panel_V1.json';
import { CuttingPanelContract, AccessoryItem } from './report-data-normalizer';

export interface PanelPricingResult {
    part_id: string;
    role: string;
    material_id: string;
    material_name: string;
    thickness_mm: number;
    length_mm: number;
    width_mm: number;
    area_m2: number;
    price_per_m2: number | 'BRAK CENY';
    material_cost: number | 'BRAK CENY';
    edge_length_mb: number;
    edge_cost: number | 'BRAK CENY';
    total_netto_pln: number | 'BRAK CENY';
    edge_config: any;
    is_x_longer: boolean;
    furniture_name: string;
    qty: number;
}

export interface AccessoryPricingResult {
    id: string;
    name: string;
    role: string;
    library_id: string;
    qty: number;
    unit_price_pln: number | 'BRAK CENY';
    total_price_pln: number | 'BRAK CENY';
    furniture_name: string;
}

export interface GlobalProjectSummary {
    Liczba_elementow: number;
    Calkowite_powierzchnia_m2: number;
    Calkowite_cena_plyt_PLN: number | 'BRAK CENY';
    Calkowite_dlugosc_obrzezy_mb: number;
    Calkowite_cena_obrzezy_PLN: number | 'BRAK CENY';
    SUMA_PLYTY_PLN: number | 'BRAK CENY';
    Calkowite_liczba_akcesorii_szt: number;
    Calkowite_cena_akcesorii_PLN: number | 'BRAK CENY';
    SUMA_AKCESORIA_PLN: number | 'BRAK CENY';
    SUMA_CALKOWITA_PLN: number | 'BLAD W WYCENIE';
    furnituresBreakdown: Array<{ name: string; cost: number }>;
}

export class GlobalReportsEngineWeb {
    private prices: typeof pricesData;
    private smartPanel: any;
    private materialNameCache: Record<string, string> = {};

    constructor() {
        this.prices = pricesData;
        this.smartPanel = smartPanelV1;
        this._buildMaterialNameCache();
    }

    private _buildMaterialNameCache() {
        try {
            const db = this.smartPanel?.materials_database || {};
            for (const group of Object.values(db) as any[]) {
                if (group?.items) {
                    for (const [mid, item] of Object.entries(group.items) as [string, any][]) {
                        if (item?.name) {
                            this.materialNameCache[mid] = String(item.name);
                        }
                    }
                }
            }
        } catch {
            this.materialNameCache = {};
        }
    }

    public resolveMaterialName(materialId: string): string {
        if (!materialId) return 'Płyta';
        if (this.materialNameCache[materialId]) {
            return this.materialNameCache[materialId];
        }
        const matPrices = (this.prices?.prices_materials as Record<string, any>) || {};
        if (matPrices[materialId]?.name) {
            return matPrices[materialId].name;
        }
        return materialId.replace(/_/g, ' ');
    }

    public getMaterialPricePerM2(materialId: string): number | null {
        const matPrices = (this.prices?.prices_materials as Record<string, any>) || {};
        if (matPrices[materialId] !== undefined) {
            const val = matPrices[materialId];
            return typeof val === 'object' ? Number(val.price) : Number(val);
        }

        const normKey = materialId.trim().toUpperCase().replace(/[\s\-]+/g, '_');
        for (const [k, v] of Object.entries(matPrices)) {
            if (k.trim().toUpperCase().replace(/[\s\-]+/g, '_') === normKey) {
                return typeof v === 'object' ? Number((v as any).price) : Number(v);
            }
        }
        return null;
    }

    public getEdgeBandPricePerM(edgeTypeId: string): number | null {
        const edgeTypes = (this.smartPanel?.edge_banding_types as Record<string, any>) || {};
        const servPrices = (this.prices?.prices_services as Record<string, any>) || {};

        let priceKey = '';
        if (edgeTypes[edgeTypeId]?.prices_services) {
            priceKey = edgeTypes[edgeTypeId].prices_services;
        }

        if (priceKey && servPrices[priceKey] !== undefined) {
            const val = servPrices[priceKey];
            return typeof val === 'object' ? Number(val.price) : Number(val);
        }

        const fallbackMap: Record<string, string> = {
            '0.008X0.022': 'EDGE_BANDING_08x22',
            '0.008x0.022': 'EDGE_BANDING_08x22',
            '0.8X22': 'EDGE_BANDING_08x22',
            'ABS_0.8X22': 'EDGE_BANDING_08x22',
            'ABS_0.8x22': 'EDGE_BANDING_08x22',
            'ABS_1X22': 'EDGE_BANDING_08x22',
            'ABS_1x22': 'EDGE_BANDING_08x22',
            'ABS_1.0X22': 'EDGE_BANDING_08x22',
            'ABS_1.0x22': 'EDGE_BANDING_08x22',
            '2.0X22': 'okleinowanie_2x22',
            '2.0x22': 'okleinowanie_2x22',
            '2X22': 'okleinowanie_2x22',
            'ABS_2X22': 'okleinowanie_2x22',
            'ABS_2.0X22': 'okleinowanie_2x22',
            '2.0X50': 'okleinowanie_2x50',
            '2.0x50': 'okleinowanie_2x50',
            '2X50': 'okleinowanie_2x50',
            'ABS_0.8X43': 'okleinowanie_2x50',
            'ABS_0.8x43': 'okleinowanie_2x50',
        };

        const edgeNorm = edgeTypeId.trim().toUpperCase();
        if (fallbackMap[edgeNorm] && servPrices[fallbackMap[edgeNorm]] !== undefined) {
            const val = servPrices[fallbackMap[edgeNorm]];
            return typeof val === 'object' ? Number(val.price) : Number(val);
        }

        // Domyślna cena za okleinowanie (3.50 PLN/mb) jeśli brak w cenniku
        return 3.50;
    }

    public calculatePartPricing(panel: CuttingPanelContract): PanelPricingResult {
        const length_m = panel.length_mm / 1000.0;
        const width_m = panel.width_mm / 1000.0;
        const area_m2 = Math.round(length_m * width_m * 1000) / 1000.0;

        const pricePerM2 = this.getMaterialPricePerM2(panel.material);
        const material_name = this.resolveMaterialName(panel.material);

        let material_cost: number | 'BRAK CENY' = 'BRAK CENY';
        if (pricePerM2 !== null) {
            material_cost = Math.round(area_m2 * pricePerM2 * 100) / 100.0;
        }

        let total_edge_length = 0;
        let edge_price = 0;
        let edge_error = false;

        const edgeConfig = panel.edge_config || {};
        const edgeKeys = ['+X', '-X', '+Y', '-Y'];

        for (const ek of edgeKeys) {
            const eb = edgeConfig[ek];
            if (eb && eb.active) {
                const isLenEdge = (ek === '+X' || ek === '-X') ? panel.is_x_longer : !panel.is_x_longer;
                const edgeLen_m = isLenEdge ? length_m : width_m;
                total_edge_length += edgeLen_m;

                const edgePricePerM = this.getEdgeBandPricePerM(eb.type_id || '0.008x0.022');
                if (edgePricePerM === null) {
                    edge_error = true;
                } else if (!edge_error) {
                    edge_price += edgeLen_m * edgePricePerM;
                }
            }
        }

        const edge_length_mb = Math.round(total_edge_length * 100) / 100.0;
        const edge_cost: number | 'BRAK CENY' = edge_error ? 'BRAK CENY' : Math.round(edge_price * 100) / 100.0;

        let total_netto_pln: number | 'BRAK CENY' = 'BRAK CENY';
        if (material_cost !== 'BRAK CENY' && edge_cost !== 'BRAK CENY') {
            total_netto_pln = Math.round((material_cost + edge_cost) * 100) / 100.0;
        }

        return {
            part_id: panel.part_id,
            role: panel.role,
            material_id: panel.material,
            material_name,
            thickness_mm: panel.thickness_mm,
            length_mm: panel.length_mm,
            width_mm: panel.width_mm,
            area_m2,
            price_per_m2: pricePerM2 !== null ? pricePerM2 : 'BRAK CENY',
            material_cost,
            edge_length_mb,
            edge_cost,
            total_netto_pln,
            edge_config: panel.edge_config,
            is_x_longer: panel.is_x_longer,
            furniture_name: panel.furniture_name,
            qty: panel.qty || 1
        };
    }

    public calculateAccessoryPricing(acc: AccessoryItem): AccessoryPricingResult {
        const pricesHw = (this.prices?.prices_hardware as Record<string, any>) || {};
        let hwPrice = pricesHw[acc.library_id];
        if (hwPrice === undefined) {
            // lookup case-tolerant
            const norm = acc.library_id.trim().toUpperCase();
            for (const [k, v] of Object.entries(pricesHw)) {
                if (k.trim().toUpperCase() === norm) {
                    hwPrice = v;
                    break;
                }
            }
        }

        let unit_price: number | 'BRAK CENY' = 'BRAK CENY';
        let total_price: number | 'BRAK CENY' = 'BRAK CENY';

        if (hwPrice !== undefined) {
            const val = typeof hwPrice === 'object' ? Number(hwPrice.price) : Number(hwPrice);
            unit_price = val;
            total_price = Math.round(val * acc.qty * 100) / 100.0;
        }

        return {
            id: acc.id,
            name: acc.name,
            role: acc.role,
            library_id: acc.library_id,
            qty: acc.qty,
            unit_price_pln: unit_price,
            total_price_pln: total_price,
            furniture_name: acc.furniture_name
        };
    }

    public calculateGlobalSummary(
        panels: PanelPricingResult[],
        accessories: AccessoryPricingResult[] = []
    ): GlobalProjectSummary {
        let total_area_m2 = 0;
        let total_mat_cost = 0;
        let total_edge_mb = 0;
        let total_edge_cost = 0;
        let has_plyty_error = false;

        const furnitureCosts: Record<string, number> = {};

        for (const p of panels) {
            const qty = p.qty || 1;
            total_area_m2 += p.area_m2 * qty;
            total_edge_mb += p.edge_length_mb * qty;

            if (p.material_cost === 'BRAK CENY' || p.edge_cost === 'BRAK CENY') {
                has_plyty_error = true;
            } else {
                total_mat_cost += Number(p.material_cost) * qty;
                total_edge_cost += Number(p.edge_cost) * qty;
            }

            if (p.total_netto_pln !== 'BRAK CENY') {
                furnitureCosts[p.furniture_name] = (furnitureCosts[p.furniture_name] || 0) + (Number(p.total_netto_pln) * qty);
            }
        }

        let total_acc_qty = 0;
        let total_acc_cost = 0;
        let has_acc_error = false;

        for (const a of accessories) {
            total_acc_qty += a.qty;
            if (a.total_price_pln === 'BRAK CENY') {
                has_acc_error = true;
            } else {
                total_acc_cost += Number(a.total_price_pln);
                furnitureCosts[a.furniture_name] = (furnitureCosts[a.furniture_name] || 0) + Number(a.total_price_pln);
            }
        }

        const suma_plyty: number | 'BRAK CENY' = has_plyty_error ? 'BRAK CENY' : Math.round((total_mat_cost + total_edge_cost) * 100) / 100.0;
        const suma_akcesoria: number | 'BRAK CENY' = has_acc_error ? 'BRAK CENY' : Math.round(total_acc_cost * 100) / 100.0;

        let suma_calkowita: number | 'BLAD W WYCENIE' = 'BLAD W WYCENIE';
        if (suma_plyty !== 'BRAK CENY' && suma_akcesoria !== 'BRAK CENY') {
            suma_calkowita = Math.round((suma_plyty + suma_akcesoria) * 100) / 100.0;
        }

        const furnituresBreakdown = Object.entries(furnitureCosts).map(([name, cost]) => ({
            name,
            cost: Math.round(cost * 100) / 100.0
        }));

        return {
            Liczba_elementow: panels.reduce((acc, p) => acc + (p.qty || 1), 0),
            Calkowite_powierzchnia_m2: Math.round(total_area_m2 * 1000) / 1000.0,
            Calkowite_cena_plyt_PLN: has_plyty_error ? 'BRAK CENY' : Math.round(total_mat_cost * 100) / 100.0,
            Calkowite_dlugosc_obrzezy_mb: Math.round(total_edge_mb * 100) / 100.0,
            Calkowite_cena_obrzezy_PLN: has_plyty_error ? 'BRAK CENY' : Math.round(total_edge_cost * 100) / 100.0,
            SUMA_PLYTY_PLN: suma_plyty,
            Calkowite_liczba_akcesorii_szt: total_acc_qty,
            Calkowite_cena_akcesorii_PLN: suma_akcesoria,
            SUMA_AKCESORIA_PLN: suma_akcesoria,
            SUMA_CALKOWITA_PLN: suma_calkowita,
            furnituresBreakdown
        };
    }
}
