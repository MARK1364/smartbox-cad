import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale } from '../../../T1_tlumaczenia/core';
import { parseNestingCsv } from '../csv-nesting';
import { filterPanelsByScope } from '../scope-filter';
import { hydrateCncWorkpiece, snapshotPanelForCnc } from '../cad-extract';
import { ProjectDocument } from '../../../A1_core/project-document';
import { ContextManager } from '../../../A1_core/context-manager';
import { registerProjectDomain } from '../../application/project-domain.js';
import type { CuttingPanelContract } from '../../../R1_reports/report-data-normalizer';
import type { CncWorkpiece } from '../types';

describe('parseNestingCsv', () => {
    it('czyta CSV z nagłówkiem PL/EN', () => {
        const csv = `nazwa;długość;szerokość;szt;gruboĹ›ć;materiał;obrót
Bok Lewy;2000;600;1;18;Biel;tak
Plecy;1964;796;2;3;HDF;nie`;
        const parts = parseNestingCsv(csv);
        expect(parts).toHaveLength(2);
        expect(parts[0].name).toBe('Bok Lewy');
        expect(parts[0].width).toBe(2000);
        expect(parts[0].quantity).toBe(1);
        expect(parts[1].canRotate).toBe(false);
        expect(parts[1].thickness).toBe(3);
    });

    it('pomija wiersze bez wymiarów', () => {
        const csv = `name,width,height,quantity
A,0,10,1
B,100,50,1`;
        const parts = parseNestingCsv(csv);
        expect(parts).toHaveLength(1);
        expect(parts[0].name).toBe('B');
    });
});

describe('filterPanelsByScope', () => {
    const panels = [
        { part_id: 'a', node_id: 'n1', container_id: 'c1', blok_id: 's1', furniture_name: 'Szafa', role: 'BOK', material: 'x', thickness_mm: 18, length_mm: 700, width_mm: 500, edge_config: {}, is_x_longer: true, qty: 1 },
        { part_id: 'b', node_id: 'n2', container_id: 'c2', blok_id: 's2', furniture_name: 'Inna', role: 'Wieniec', material: 'x', thickness_mm: 18, length_mm: 600, width_mm: 400, edge_config: {}, is_x_longer: true, qty: 1 },
    ] as CuttingPanelContract[];

    it('PROJECT zwraca wszystkie', () => {
        expect(filterPanelsByScope(panels, { type: 'PROJECT', id: 'ALL', name: 'Projekt' })).toHaveLength(2);
    });

    it('CONTAINER filtruje po korpusie', () => {
        const out = filterPanelsByScope(panels, { type: 'CONTAINER', id: 'c1', name: 'Szafa' });
        expect(out.map((p) => p.part_id)).toEqual(['a']);
    });

    it('BLOKI filtruje po blok_id', () => {
        const out = filterPanelsByScope(panels, { type: 'BLOKI', id: 's1', name: 'Szuflady' });
        expect(out.map((p) => p.part_id)).toEqual(['a']);
    });

    it('PANEL filtruje po pojedynczej formatce', () => {
        const out = filterPanelsByScope(panels, { type: 'PANEL', id: 'b', name: 'Wieniec' });
        expect(out.map((p) => p.part_id)).toEqual(['b']);
    });
});

describe('CNC workpiece', () => {
    it('snapshot pomija targetPanel (cykliczna referencja)', () => {
        const panel: any = {
            id: 'p1',
            name: 'Bok',
            width: 600_000_000,
            height: 720_000_000,
            thickness: 18_000_000,
            features: [{ id: 1, type: 'HOLE', params: { dia: 35 } }],
            cncPrograms: [],
        };
        panel.cncPrograms = [{ id: 'prog1', name: 'P1', targetPanel: panel, features: [{ featureId: 'h1' }] }];
        const snap = snapshotPanelForCnc(panel);
        expect(snap.cncPrograms?.[0].targetPanel).toBeUndefined();
        expect(snap.cncPrograms?.[0].features).toHaveLength(1);
        expect(snap.features).toHaveLength(1);
    });

    it('hydratuje żyły PanelModel z cechami i programem CAM', () => {
        const doc = new ProjectDocument();
        registerProjectDomain(doc);
        const workpiece: CncWorkpiece = {
            id: 'p1',
            name: 'Bok',
            width: 600_000_000,
            height: 720_000_000,
            thickness: 18_000_000,
            features: [{ id: 1, type: 'HOLE', params: { dia: 35 } }],
            cncPrograms: [{ id: 'prog1', name: 'P1', targetPanelName: 'Bok', features: [] }],
        };
        const panel = hydrateCncWorkpiece(doc, workpiece);
        expect(panel.name).toBe('Bok');
        expect(panel.width).toBe(600_000_000);
        expect(panel.features).toHaveLength(1);
        expect(panel.cncPrograms[0].targetPanel).toBe(panel);
        expect(doc.activeEntity).toBe(panel);
    });
});

describe('tree-context-menu', () => {
    beforeEach(() => { setLocale('pl'); });
    const labelsOf = (items: any[]): string[] => {
        const out: string[] = [];
        for (const i of items || []) {
            if (i?.label) out.push(i.label);
            if (Array.isArray(i?.toolbar)) {
                for (const t of i.toolbar) {
                    if (t?.label) out.push(t.label);
                }
            }
        }
        return out;
    };

    it('shows "Edytuj korpus" in context menu for container / korpus nodes', async () => {
        const { showCadTreeContextMenu } = await import('../tree-context-menu');
        const doc = new ProjectDocument();
        registerProjectDomain(doc);
        const container = doc.createAssembly({ name: 'Korpus (SmartFrame) 1' });
        container.generatorParams = { type: 'korpus3_2', liczba_stref: 3 };
        ContextManager.instance.document = doc;

        const { ContextMenu } = await import('../../../A1_core/context-menu.js');
        let shownItems: any[] = [];
        const originalShow = ContextMenu.prototype.show;
        ContextMenu.prototype.show = function(x: number, y: number, items: any[]) {
            shownItems = items;
        };

        try {
            showCadTreeContextMenu({
                type: 'container',
                id: container.id,
                name: container.name,
                clientX: 100,
                clientY: 100
            });

            const labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj korpus');
        } finally {
            ContextMenu.prototype.show = originalShow;
        }
    }, 15000);

    it('shows "Edytuj AGD" for appliance containers in tree context menu', async () => {
        const { showCadTreeContextMenu } = await import('../tree-context-menu');
        const doc = new ProjectDocument();
        registerProjectDomain(doc);
        const agd = doc.createAssembly({ name: 'Mikrofalówka' }) as any;
        agd.role = 'APPLIANCE';
        agd.generatorParams = { type: 'smart_appliance', kind: 'MICROWAVE' };
        ContextManager.instance.document = doc;

        const { ContextMenu } = await import('../../../A1_core/context-menu.js');
        let shownItems: any[] = [];
        const originalShow = ContextMenu.prototype.show;
        ContextMenu.prototype.show = function (_x: number, _y: number, items: any[]) {
            shownItems = items;
        };

        try {
            showCadTreeContextMenu({
                type: 'agd',
                id: agd.id,
                name: agd.name,
                clientX: 10,
                clientY: 10,
            });
            let labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj AGD');
            expect(labels).not.toContain('Edytuj korpus');
            expect(labels).not.toContain('Edytuj blok');

            showCadTreeContextMenu({
                type: 'container',
                id: agd.id,
                name: agd.name,
                clientX: 10,
                clientY: 10,
            });
            labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj AGD');
            expect(labels).not.toContain('Edytuj korpus');
        } finally {
            ContextMenu.prototype.show = originalShow;
        }
    }, 15000);

    it('shows "Edytuj" for SmartPart and "Edytuj formatkę" for panel in tree context menu', async () => {
        const { showCadTreeContextMenu } = await import('../tree-context-menu');
        const doc = new ProjectDocument();
        registerProjectDomain(doc);
        const handle = doc.createAssembly({ name: 'Uchwyt 1' }) as any;
        handle.role = 'SMARTPART_HANDLE';
        handle.generatorParams = { type: 'smartpart_handle', partType: 'HANDLE' };
        ContextManager.instance.document = doc;

        const { ContextMenu } = await import('../../../A1_core/context-menu.js');
        let shownItems: any[] = [];
        const originalShow = ContextMenu.prototype.show;
        ContextMenu.prototype.show = function (_x: number, _y: number, items: any[]) {
            shownItems = items;
        };

        try {
            showCadTreeContextMenu({
                type: 'handle',
                id: handle.id,
                name: handle.name,
                clientX: 10,
                clientY: 10,
            });
            let labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj');
            expect(labels).not.toContain('Edytuj korpus');
            expect(labels).not.toContain('Edytuj blok');

            // SmartPart jako container (bez type=handle z drzewa) — nadal Edytuj
            showCadTreeContextMenu({
                type: 'container',
                id: handle.id,
                name: handle.name,
                clientX: 10,
                clientY: 10,
            });
            labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj');
            expect(labels).not.toContain('Edytuj korpus');

            showCadTreeContextMenu({
                type: 'part',
                id: 'panel_fmt_1',
                name: 'Bok',
                isManual: true,
                clientX: 10,
                clientY: 10,
            });
            labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj formatkę');
            expect(labels).not.toContain('Edytuj korpus');
        } finally {
            ContextMenu.prototype.show = originalShow;
        }
    });

    it('shows "Edytuj" for smart library operations and excludes "Usuń" and "Ukryj / Pokaż" in tree context menu', async () => {
        const { showCadTreeContextMenu } = await import('../tree-context-menu');
        const { ContextMenu } = await import('../../../A1_core/context-menu.js');
        let shownItems: any[] = [];
        const originalShow = ContextMenu.prototype.show;
        ContextMenu.prototype.show = function(x: number, y: number, items: any[]) {
            shownItems = items;
        };

        try {
            // 1. Smart feature
            showCadTreeContextMenu({
                type: 'feature',
                id: 'feat_123',
                name: 'Przetoczenie / Wycięcie',
                panelId: 'panel_1',
                libraryId: 'przetloczenie',
                isSmart: true,
                source: 'library',
                face: 'FACE_Z_MINUS',
                clientX: 100,
                clientY: 100
            });

            let labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj');
            expect(labels).toContain('Właściwości');
            expect(labels).not.toContain('Usuń');
            expect(labels).not.toContain('Ukryj / Pokaż');
            expect(labels).not.toContain('Zamroź obróbkę');

            // 2. Engine feature (e.g. wpust / groove / drill)
            showCadTreeContextMenu({
                type: 'feature',
                id: 'grv_native',
                name: 'Wpust',
                panelId: 'panel_1',
                isSmart: false,
                source: 'engine',
                frozen: false,
                face: 'FACE_Z_MINUS',
                clientX: 100,
                clientY: 100
            });

            labels = labelsOf(shownItems);
            expect(labels).not.toContain('Edytuj');
            expect(labels).not.toContain('Usuń');
            expect(labels).not.toContain('Ukryj / Pokaż');
            expect(labels).toContain('Zamroź obróbkę');

            // 3. Native panel (assembly managed)
            showCadTreeContextMenu({
                type: 'part',
                id: 'bok_l',
                name: 'Bok Lewy',
                isManual: false,
                frozen: false,
                clientX: 100,
                clientY: 100
            });

            labels = labelsOf(shownItems);
            expect(labels).not.toContain('Edytuj formatkę');
            expect(labels).not.toContain('Usuń');
            expect(labels).not.toContain('Ukryj / Pokaż');
            expect(labels).toContain('Zamroź formatkę');

            // 4. Manual panel
            showCadTreeContextMenu({
                type: 'part',
                id: 'manual_1',
                name: 'Formatka Ręczna',
                isManual: true,
                frozen: false,
                clientX: 100,
                clientY: 100
            });

            labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj formatkę');
            expect(labels).not.toContain('Usuń');
            expect(labels).not.toContain('Ukryj / Pokaż');
            expect(labels).not.toContain('Zamroź formatkę');
            expect(labels).toContain('Raport z formatki');

            // 5. Bloki container
            const doc2 = new ProjectDocument();
            registerProjectDomain(doc2);
            const sbContainer = doc2.createAssembly({ name: 'blok_szuflady' });
            sbContainer.generatorParams = { type: 'blok_drawers', boxType: 'DRAWERS' };
            ContextManager.instance.document = doc2;

            showCadTreeContextMenu({
                type: 'container',
                id: sbContainer.id,
                name: sbContainer.name,
                clientX: 100,
                clientY: 100
            });

            labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj blok');
            expect(labels).toContain('Raport ze Bloku');
            expect(labels).not.toContain('Edytuj korpus');
            expect(labels).not.toContain('Usuń');
            expect(labels).not.toContain('Ukryj / Pokaż');

            // type z drzewa / belki: 'bloki' (nie 'container')
            showCadTreeContextMenu({
                type: 'bloki',
                id: sbContainer.id,
                name: sbContainer.name,
                clientX: 100,
                clientY: 100
            });
            labels = labelsOf(shownItems);
            expect(labels).toContain('Edytuj blok');
            expect(labels).not.toContain('Edytuj korpus');
        } finally {
            ContextMenu.prototype.show = originalShow;
        }
    });

    it('shows "Edytuj formatkę" only for SmartPanel manual panels (engineManaged === false)', async () => {
        const { showCadTreeContextMenu } = await import('../tree-context-menu');
        const doc = new ProjectDocument();
        registerProjectDomain(doc);
        const manual = doc.createPanel({ name: 'Manualna', width: 600_000_000, height: 720_000_000, thickness: 18_000_000, engineManaged: false });
        const engine = doc.createPanel({ name: 'Bok silnikowy', width: 600_000_000, height: 720_000_000, thickness: 18_000_000 });
        ContextManager.instance.document = doc;

        const { ContextMenu } = await import('../../../A1_core/context-menu.js');
        let shownItems: any[] = [];
        const originalShow = ContextMenu.prototype.show;
        ContextMenu.prototype.show = function (_x: number, _y: number, items: any[]) {
            shownItems = items;
        };

        try {
            // Manualna: model engineManaged === false → edycja widoczna (nawet bez flagi isManual)
            showCadTreeContextMenu({
                type: 'part',
                id: (manual as any).id,
                name: (manual as any).name,
                clientX: 10,
                clientY: 10,
            });
            expect(labelsOf(shownItems)).toContain('Edytuj formatkę');

            // Silnikowa (korpus/blok): brak edycji formatki
            showCadTreeContextMenu({
                type: 'part',
                id: (engine as any).id,
                name: (engine as any).name,
                clientX: 10,
                clientY: 10,
            });
            expect(labelsOf(shownItems)).not.toContain('Edytuj formatkę');
        } finally {
            ContextMenu.prototype.show = originalShow;
        }
    });

    it('shows "Pokaż tylko" + scoped "Pokaż wszystko" on container/panel; project has only "Pokaż wszystko"', async () => {
        const { showCadTreeContextMenu } = await import('../tree-context-menu');
        const doc = new ProjectDocument();
        registerProjectDomain(doc);
        const container = doc.createAssembly({ name: 'Korpus 1' });
        container.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        ContextManager.instance.document = doc;

        const { ContextMenu } = await import('../../../A1_core/context-menu.js');
        let shownItems: any[] = [];
        const originalShow = ContextMenu.prototype.show;
        ContextMenu.prototype.show = function (_x: number, _y: number, items: any[]) {
            shownItems = items;
        };

        try {
            showCadTreeContextMenu({
                type: 'container',
                id: container.id,
                name: container.name,
                clientX: 10,
                clientY: 10,
            });
            let labels = labelsOf(shownItems);
            expect(labels).toContain('Pokaż tylko');
            expect(labels).toContain('Pokaż wszystko');

            showCadTreeContextMenu({
                type: 'part',
                id: 'bok_l',
                name: 'Bok Lewy',
                clientX: 10,
                clientY: 10,
            });
            labels = labelsOf(shownItems);
            expect(labels).toContain('Pokaż tylko');
            expect(labels).toContain('Pokaż wszystko');

            showCadTreeContextMenu({
                type: 'project',
                id: 'root',
                name: 'Projekt WebCAD',
                clientX: 10,
                clientY: 10,
            });
            labels = labelsOf(shownItems);
            expect(labels).toContain('Pokaż wszystko');
            expect(labels).not.toContain('Pokaż tylko');
        } finally {
            ContextMenu.prototype.show = originalShow;
        }
    });
});

describe('HtmlReportsGeneratorWeb', () => {
    it('generates Grubość column right after Materiał and highlights 16 mm drawer panels', async () => {
        const { HtmlReportsGeneratorWeb } = await import('../../../R1_reports/html-reports-generator');
        const generator = new HtmlReportsGeneratorWeb();
        const html = generator.generateFullProjectReport(
            'TestProject',
            {
                Liczba_elementow: 2,
                Calkowite_powierzchnia_m2: 0.5,
                Calkowite_cena_plyt_PLN: 50,
                Calkowite_dlugosc_obrzezy_mb: 2,
                Calkowite_cena_obrzezy_PLN: 10,
                SUMA_PLYTY_PLN: 60,
                Calkowite_liczba_akcesorii_szt: 0,
                Calkowite_cena_akcesorii_PLN: 0,
                SUMA_AKCESORIA_PLN: 0,
                SUMA_CALKOWITA_PLN: 60,
                furnituresBreakdown: []
            },
            [
                {
                    part_id: 'p1',
                    role: 'DRAWER_BOTTOM',
                    material_id: 'W1100_ST9_16',
                    material_name: 'Biały Alpejski 16mm',
                    thickness_mm: 16,
                    length_mm: 500,
                    width_mm: 400,
                    area_m2: 0.2,
                    price_per_m2: 82,
                    material_cost: 16.4,
                    edge_length_mb: 1.8,
                    edge_cost: 6.3,
                    total_netto_pln: 22.7,
                    edge_config: {},
                    is_x_longer: true,
                    furniture_name: 'Szafka',
                    qty: 1
                }
            ],
            []
        );

        // Nagłówek Grubość występuje w tabeli
        expect(html).toContain('<th>Materiał</th>\n                        <th>Grubość</th>');
        // Grubość jest wyświetlana jako prosty tekst
        expect(html).toContain('16 mm</td>');
    });

    it('generates accessories total sum and card in full report', async () => {
        const { HtmlReportsGeneratorWeb } = await import('../../../R1_reports/html-reports-generator');
        const generator = new HtmlReportsGeneratorWeb();
        const html = generator.generateFullProjectReport(
            'TestProjectAcc',
            {
                Liczba_elementow: 1,
                Calkowite_powierzchnia_m2: 0.2,
                Calkowite_cena_plyt_PLN: 20,
                Calkowite_dlugosc_obrzezy_mb: 1,
                Calkowite_cena_obrzezy_PLN: 5,
                SUMA_PLYTY_PLN: 25,
                Calkowite_liczba_akcesorii_szt: 4,
                Calkowite_cena_akcesorii_PLN: 48,
                SUMA_AKCESORIA_PLN: 48,
                SUMA_CALKOWITA_PLN: 73,
                furnituresBreakdown: []
            },
            [],
            [
                {
                    id: 'acc1',
                    name: 'Zawias Blum Clip Top',
                    role: 'ZAWIAS',
                    library_id: 'HINGE_BLUM_71B3550',
                    qty: 4,
                    unit_price_pln: 12,
                    total_price_pln: 48,
                    furniture_name: 'Szafka'
                }
            ]
        );

        expect(html).toContain('SUMA OKUĆ I AKCESORIÓW');
        expect(html).toContain('48.00 PLN');
        expect(html).toContain('4 szt.');
    });
});

