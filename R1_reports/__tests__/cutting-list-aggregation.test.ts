import { describe, it, expect } from 'vitest';
import { ReportDataNormalizer, type CuttingPanelContract } from '../report-data-normalizer.js';
import { HtmlReportsGeneratorWeb } from '../html-reports-generator.js';

describe('R1_reports — Lista formatek do hurtowni (Scalone vs Rozpisane)', () => {
    const createPanel = (opts: Partial<CuttingPanelContract> = {}): CuttingPanelContract => ({
        part_id: opts.part_id || 'p_1',
        role: opts.role || 'Bok Lewy',
        material: opts.material || 'DAB_HALIFAX',
        thickness_mm: opts.thickness_mm || 18,
        length_mm: opts.length_mm || 720,
        width_mm: opts.width_mm || 560,
        edge_config: opts.edge_config || {
            '+X': { active: true, type_id: '0.008x0.022' },
            '-X': { active: false, type_id: 'none' },
            '+Y': { active: false, type_id: 'none' },
            '-Y': { active: false, type_id: 'none' },
        },
        is_x_longer: opts.is_x_longer !== undefined ? opts.is_x_longer : true,
        furniture_name: opts.furniture_name || 'Szafka Dolna',
        qty: opts.qty || 1,
    });

    it('aggregateContractRowsByGeometry scala formatki o tym samym gabarycie i okleinowaniu, sumując qty', () => {
        const panels: CuttingPanelContract[] = [
            createPanel({ part_id: 'p1', role: 'Bok Lewy', qty: 1 }),
            createPanel({ part_id: 'p2', role: 'Bok Prawy', qty: 1 }),
            createPanel({ part_id: 'p3', role: 'Bok Lewy', furniture_name: 'Szafka 2', qty: 1 }),
            // Inny gabaryt (wieniec)
            createPanel({ part_id: 'p4', role: 'Wieniec Dolny', length_mm: 564, width_mm: 560, qty: 1 }),
            createPanel({ part_id: 'p5', role: 'Wieniec Górny', length_mm: 564, width_mm: 560, qty: 1 }),
        ];

        const merged = ReportDataNormalizer.aggregateContractRowsByGeometry(panels);

        expect(merged).toHaveLength(2);

        // Boki (3 sztuki zsumowane)
        const boki = merged.find((p) => p.length_mm === 720 && p.width_mm === 560);
        expect(boki).toBeDefined();
        expect(boki!.qty).toBe(3);
        expect(boki!.role).toContain('Bok Lewy');
        expect(boki!.role).toContain('Bok Prawy');

        // Wieńce (2 sztuki zsumowane)
        const wience = merged.find((p) => p.length_mm === 564 && p.width_mm === 560);
        expect(wience).toBeDefined();
        expect(wience!.qty).toBe(2);
        expect(wience!.role).toContain('Wieniec Dolny');
        expect(wience!.role).toContain('Wieniec Górny');
    });

    it('nie scala formatek o innym okleinowaniu lub innym materiale pomimo identycznego gabarytu', () => {
        const panels: CuttingPanelContract[] = [
            createPanel({ part_id: 'p1', role: 'Bok 1', edge_config: { '+X': { active: true, type_id: '0.008x0.022' } } as any }),
            // Okleinowane 2 krawędzie długości
            createPanel({
                part_id: 'p2',
                role: 'Bok 2',
                edge_config: {
                    '+X': { active: true, type_id: '0.008x0.022' },
                    '-X': { active: true, type_id: '0.008x0.022' },
                } as any,
            }),
            // Inny materiał
            createPanel({ part_id: 'p3', role: 'Bok 3', material: 'BIEL_ALPEJSKA_18' }),
        ];

        const merged = ReportDataNormalizer.aggregateContractRowsByGeometry(panels);
        expect(merged).toHaveLength(3);
    });

    it('HtmlReportsGeneratorWeb generuje przełącznik widoku oraz obie grupy arkuszy (scalone i rozpisane)', () => {
        const generator = new HtmlReportsGeneratorWeb();
        const panels: CuttingPanelContract[] = [
            createPanel({ part_id: 'p1', role: 'Bok Lewy', qty: 1 }),
            createPanel({ part_id: 'p2', role: 'Bok Prawy', qty: 1 }),
        ];

        const { contentHtml } = generator.generateMaterialCuttingTabsHtml(panels, 'testTab');

        // Zawiera obie grupy arkuszy
        expect(contentHtml).toContain('sheets-group sheets-merged');
        expect(contentHtml).toContain('sheets-group sheets-detailed');

        // Grupa scalona zawiera 1 wiersz z qty = 2
        expect(contentHtml).toContain('<td contenteditable="true" style="font-weight:bold;">2</td>');
        expect(contentHtml).toContain('Bok Lewy, Bok Prawy');

        // Pełny raport projektu zawiera przełącznik
        const fullHtml = generator.generateFullProjectReport(
            'TestProject',
            {
                Liczba_elementow: 2,
                Calkowite_powierzchnia_m2: 0.8,
                Calkowite_cena_plyt_PLN: 80,
                Calkowite_dlugosc_obrzezy_mb: 2.8,
                Calkowite_cena_obrzezy_PLN: 14,
                SUMA_PLYTY_PLN: 94,
                Calkowite_liczba_akcesorii_szt: 0,
                Calkowite_cena_akcesorii_PLN: 0,
                SUMA_AKCESORIA_PLN: 0,
                SUMA_CALKOWITA_PLN: 94,
                furnituresBreakdown: [],
            },
            [
                {
                    part_id: 'p1',
                    role: 'Bok Lewy',
                    material_id: 'DAB_HALIFAX',
                    material_name: 'Dąb Halifax',
                    thickness_mm: 18,
                    length_mm: 720,
                    width_mm: 560,
                    area_m2: 0.4,
                    price_per_m2: 100,
                    material_cost: 40,
                    edge_length_mb: 1.4,
                    edge_cost: 7,
                    total_netto_pln: 47,
                    edge_config: { '+X': { active: true, type_id: '0.008x0.022' } } as any,
                    is_x_longer: true,
                    furniture_name: 'Szafka',
                    qty: 1,
                },
                {
                    part_id: 'p2',
                    role: 'Bok Prawy',
                    material_id: 'DAB_HALIFAX',
                    material_name: 'Dąb Halifax',
                    thickness_mm: 18,
                    length_mm: 720,
                    width_mm: 560,
                    area_m2: 0.4,
                    price_per_m2: 100,
                    material_cost: 40,
                    edge_length_mb: 1.4,
                    edge_cost: 7,
                    total_netto_pln: 47,
                    edge_config: { '+X': { active: true, type_id: '0.008x0.022' } } as any,
                    is_x_longer: true,
                    furniture_name: 'Szafka',
                    qty: 1,
                },
            ],
            []
        );

        // Przełącznik radio w widoku Listy Cięć (Scalenie vs Rozpisane)
        expect(fullHtml).toContain('cutting-mode-radios');
        expect(fullHtml).toContain('type="radio"');
        expect(fullHtml).toContain('Scalenie');
        expect(fullHtml).toContain('Rozpisane');
        expect(fullHtml).toContain('switchCuttingMode');
        expect(fullHtml).toContain('const matName = headerCells[0]?.textContent?.trim() ||');
        expect(fullHtml).toContain('const thick = headerCells[1]?.textContent?.trim() ||');
    });

    it('generateCsv generuje plik w trybie scalonym (domyślnym) lub rozpisanym', () => {
        const generator = new HtmlReportsGeneratorWeb();
        const panels: CuttingPanelContract[] = [
            createPanel({ part_id: 'p1', role: 'Bok Lewy', qty: 1 }),
            createPanel({ part_id: 'p2', role: 'Bok Prawy', qty: 1 }),
        ];

        const csvMerged = generator.generateCsv(panels, 'merged');
        const csvDetailed = generator.generateCsv(panels, 'detailed');

        // Scalony ma 1 wiersz danych z ilością 2
        const mergedLines = csvMerged.trim().split('\n');
        expect(mergedLines).toHaveLength(2); // nagłówek + 1 wiersz
        expect(mergedLines[1]).toContain(';2;'); // qty = 2
        expect(mergedLines[1]).toContain('Bok Lewy, Bok Prawy');

        // Rozpisany ma 2 wiersze danych z ilością 1
        const detailedLines = csvDetailed.trim().split('\n');
        expect(detailedLines).toHaveLength(3); // nagłówek + 2 wiersze
        expect(detailedLines[1]).toContain(';1;');
        expect(detailedLines[2]).toContain(';1;');
    });
});
