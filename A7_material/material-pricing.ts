import { PanelPricingCalculation, ProjectPricingSummary, MaterialItem } from './material-types.js';
import { materialDatabase } from './material-database.js';
import { nmToMm } from '../A1_core/cad-math/units.js';

export class MaterialPricingCalculator {
    /**
     * Oblicza parametry geometryczne, wagę i koszty dla pojedynczej formatki (PanelModel / domainData).
     */
    static calculatePanel(panel: any): PanelPricingCalculation | null {
        if (!panel) return null;

        // Wymiary w mm
        const rawW = panel.width || 0;
        const rawH = panel.height || 0;
        const rawT = panel.thickness || 18_000_000;

        const w_mm = nmToMm(rawW);
        const h_mm = nmToMm(rawH);
        const t_mm = nmToMm(rawT);

        if (w_mm <= 0 || h_mm <= 0 || t_mm <= 0) return null;

        // Powierzchnia i objętość
        const area_m2 = (w_mm * h_mm) / 1_000_000.0;
        const volume_m3 = (w_mm * h_mm * t_mm) / 1_000_000_000.0;

        // Materiał formatki
        const matId = panel.materialId || panel.material || panel.custom_properties?.material || 'PLYTY_18';
        const material: MaterialItem = materialDatabase.getMaterialById(matId) || {
            id: matId,
            name: panel.materialName || 'Płyta Wiórowa',
            code: panel.materialCode || '',
            category: 'Płyta Wiórowa',
            thickness_mm: t_mm,
            density_kg_m3: 680.0,
            color: { r: 0.8, g: 0.8, b: 0.8 },
            price_per_m2: 65.0
        };

        // Waga [kg] = m3 * kg/m3
        const weight_kg = volume_m3 * material.density_kg_m3;

        // Kalkulacja oklein krawędziowych (mb)
        let edgeBanding_mb = 0;
        let edgeBandingCost = 0;
        const edgeBanding = panel.edgeBanding || panel.custom_properties?.edge_banding || {};
        
        const edgeEdges = [
            { key: '+X', len_mm: h_mm },
            { key: '-X', len_mm: h_mm },
            { key: '+Y', len_mm: w_mm },
            { key: '-Y', len_mm: w_mm }
        ];

        for (const edge of edgeEdges) {
            const eb = edgeBanding[edge.key];
            if (eb && (eb.active !== false && eb !== 'none' && eb.type_id !== 'none')) {
                const len_mb = edge.len_mm / 1000.0;
                edgeBanding_mb += len_mb;
                edgeBandingCost += len_mb * 3.50; // Standard 3.50 PLN/mb
            }
        }

        // Koszt materiału
        const pricePerM2 = material.price_per_m2 || 65.0;
        const materialCost = area_m2 * pricePerM2;
        const totalCost = materialCost + edgeBandingCost;

        return {
            panelId: panel.id || panel.smartId?.uid || '',
            panelName: panel.name || 'Płyta',
            materialName: material.name,
            materialCode: material.code,
            thickness_mm: Math.round(t_mm * 10) / 10,
            area_m2: Math.round(area_m2 * 1000) / 1000,
            volume_m3: Math.round(volume_m3 * 10000) / 10000,
            weight_kg: Math.round(weight_kg * 100) / 100,
            edgeBanding_mb: Math.round(edgeBanding_mb * 100) / 100,
            materialCost: Math.round(materialCost * 100) / 100,
            edgeBandingCost: Math.round(edgeBandingCost * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100
        };
    }

    /**
     * Zbiorcze obliczenia dla całego projektu CAD / sceny.
     */
    static calculateProject(document: any): ProjectPricingSummary {
        let totalArea_m2 = 0;
        let totalVolume_m3 = 0;
        let totalWeight_kg = 0;
        let totalEdgeBanding_mb = 0;
        let totalMaterialCost = 0;
        let totalEdgeBandingCost = 0;
        let panelsCount = 0;

        const breakdown: Record<string, any> = {};

        if (!document) {
            return {
                totalArea_m2: 0,
                totalVolume_m3: 0,
                totalWeight_kg: 0,
                totalEdgeBanding_mb: 0,
                totalMaterialCost: 0,
                totalEdgeBandingCost: 0,
                totalCost: 0,
                panelsCount: 0,
                materialsBreakdown: {}
            };
        }

        const candidatePanels: any[] = [];
        const collectPanels = (node: any) => {
            if (!node) return;
            const domain = node.domainData;
            if (domain && domain.type !== 'container' && (domain.role || domain.width)) {
                candidatePanels.push(domain);
            }
            if (node.children) {
                for (const child of node.children) collectPanels(child);
            }
        };

        if (document.rootNode) {
            collectPanels(document.rootNode);
        } else if (typeof document.getPanels === 'function') {
            const panels = document.getPanels();
            for (const p of panels) candidatePanels.push(p.domainData || p);
        }

        for (const panel of candidatePanels) {
            const calc = this.calculatePanel(panel);
            if (!calc) continue;

            panelsCount++;
            totalArea_m2 += calc.area_m2;
            totalVolume_m3 += calc.volume_m3;
            totalWeight_kg += calc.weight_kg;
            totalEdgeBanding_mb += calc.edgeBanding_mb;
            totalMaterialCost += calc.materialCost;
            totalEdgeBandingCost += calc.edgeBandingCost;

            const matKey = calc.materialCode || calc.materialName;
            if (!breakdown[matKey]) {
                const mat = materialDatabase.getMaterialById(panel.materialId || panel.material) || {
                    id: matKey,
                    name: calc.materialName,
                    code: calc.materialCode,
                    category: 'Płyta',
                    thickness_mm: calc.thickness_mm,
                    density_kg_m3: 680,
                    color: { r: 0.8, g: 0.8, b: 0.8 }
                };
                breakdown[matKey] = {
                    material: mat,
                    count: 0,
                    area_m2: 0,
                    volume_m3: 0,
                    weight_kg: 0,
                    cost: 0
                };
            }

            breakdown[matKey].count++;
            breakdown[matKey].area_m2 += calc.area_m2;
            breakdown[matKey].volume_m3 += calc.volume_m3;
            breakdown[matKey].weight_kg += calc.weight_kg;
            breakdown[matKey].cost += calc.materialCost;
        }

        // Zaokrąglenia wyników
        for (const k of Object.keys(breakdown)) {
            breakdown[k].area_m2 = Math.round(breakdown[k].area_m2 * 100) / 100;
            breakdown[k].volume_m3 = Math.round(breakdown[k].volume_m3 * 1000) / 1000;
            breakdown[k].weight_kg = Math.round(breakdown[k].weight_kg * 10) / 10;
            breakdown[k].cost = Math.round(breakdown[k].cost * 100) / 100;
        }

        const totalCost = totalMaterialCost + totalEdgeBandingCost;

        return {
            totalArea_m2: Math.round(totalArea_m2 * 100) / 100,
            totalVolume_m3: Math.round(totalVolume_m3 * 1000) / 1000,
            totalWeight_kg: Math.round(totalWeight_kg * 10) / 10,
            totalEdgeBanding_mb: Math.round(totalEdgeBanding_mb * 100) / 100,
            totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
            totalEdgeBandingCost: Math.round(totalEdgeBandingCost * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
            panelsCount,
            materialsBreakdown: breakdown
        };
    }
}
