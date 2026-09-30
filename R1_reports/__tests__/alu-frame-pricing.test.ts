import { describe, it, expect } from 'vitest';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ReportDataNormalizer } from '../report-data-normalizer.js';
import { GlobalReportsEngineWeb } from '../global-reports-engine.js';

describe('R1_reports — Ramka Aluminiowa jako Osprzęt Gotowy (300 PLN / m²)', () => {
    it('przenosi formatkę ALU_FRAME z listy płyt do tabeli osprzętu/akcesoriów', () => {
        const sidePanel = new PanelModel({
            width: mmToNm(560),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Bok_Lewy',
            role: 'SIDE_PANEL'
        });

        const frontPanel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(800), // 0.48 m²
            thickness: mmToNm(18),
            name: 'Front_Witryna',
            role: 'FRONT'
        });

        // Konwersja frontu na ramkę Z-1
        frontPanel.convertToAluFrame('Z1_BLACK');

        // Tworzymy sztuczne drzewo dokumentu
        const fakeDoc = {
            rootNode: {
                name: 'Szafka_Kuchenna',
                nodeType: 'ASSEMBLY',
                children: [
                    { id: 'node_side', name: 'Bok_Lewy', nodeType: 'PART', domainData: sidePanel },
                    { id: 'node_front', name: 'Front_Witryna', nodeType: 'PART', domainData: frontPanel }
                ]
            }
        };

        const result = ReportDataNormalizer.extractProjectData(fakeDoc);

        // 1. Tabela płyt do cięcia na pile: tylko Bok_Lewy!
        // Strict: part_id to tożsamość (node id), nie display name.
        expect(result.panels).toHaveLength(1);
        expect(result.panels[0].part_id).toBe('node_side');
        expect(result.panels[0].material).toBe('W1100_ST9_18');

        // 2. Tabela osprzętu: Front ramka aluminiowa
        expect(result.accessories).toHaveLength(1);
        const aluAcc = result.accessories[0];
        expect(aluAcc.role).toBe('RAMKA_ALU');
        expect(aluAcc.library_id).toBe('RAMKA_ALU_Z1_BLACK');
        expect(aluAcc.name).toContain('Ramka alu');
        expect(aluAcc.name).toContain('600x800mm');
        expect(aluAcc.area_m2).toBe(0.48);
        expect(aluAcc.custom_unit_price).toBe(144.0); // 0.48 m² * 300 zł/m²
    });

    it('wylicza poprawny koszt frontu jako osprzętu: 0.48 m² * 300 PLN = 144 PLN', () => {
        const engine = new GlobalReportsEngineWeb();

        const aluAcc = {
            id: 'alu_frame_1',
            name: 'Front [Ramka alu Z-1 20x20mm, 600x800mm, szkło Antisol]',
            role: 'RAMKA_ALU',
            library_id: 'RAMKA_ALU_Z1_BLACK',
            qty: 1,
            furniture_name: 'Szafka_Gorna',
            custom_unit_price: 144.0,
            area_m2: 0.48
        };

        const pricing = engine.calculateAccessoryPricing(aluAcc);

        expect(pricing.unit_price_pln).toBe(144.0);
        expect(pricing.total_price_pln).toBe(144.0);
        expect(pricing.role).toBe('RAMKA_ALU');
    });

    it('uwzględnia ramkę alu w podsumowaniu całego projektu w sekcji akcesoriów', () => {
        const engine = new GlobalReportsEngineWeb();

        const aluAccPricing = engine.calculateAccessoryPricing({
            id: 'alu_frame_1',
            name: 'Front Witryna Z-1',
            role: 'RAMKA_ALU',
            library_id: 'RAMKA_ALU_Z1_BLACK',
            qty: 1,
            furniture_name: 'Szafka_Wysoka',
            custom_unit_price: 144.0,
            area_m2: 0.48
        });

        const panelPricing = engine.calculatePartPricing({
            part_id: 'Bok',
            role: 'SIDE_PANEL',
            material: 'W1100_ST9_18',
            thickness_mm: 18,
            length_mm: 720,
            width_mm: 560,
            edge_config: {},
            is_x_longer: true,
            furniture_name: 'Szafka_Wysoka',
            qty: 1
        });

        const summary = engine.calculateGlobalSummary([panelPricing], [aluAccPricing]);

        expect(summary.SUMA_PLYTY_PLN).toBe(pricingRound(panelPricing.total_netto_pln));
        expect(summary.SUMA_AKCESORIA_PLN).toBe(144.0);
        expect(summary.SUMA_CALKOWITA_PLN).toBe(pricingRound(Number(summary.SUMA_PLYTY_PLN) + 144.0));
    });
});

function pricingRound(val: any): number {
    return Math.round(Number(val) * 100) / 100.0;
}
