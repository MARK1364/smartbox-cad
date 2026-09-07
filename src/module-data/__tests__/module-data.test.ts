import { describe, it, expect } from 'vitest';
import { parseNestingCsv } from '../csv-nesting';
import { filterPanelsByScope } from '../scope-filter';
import { hydrateCncWorkpiece, snapshotPanelForCnc } from '../cad-extract';
import { ProjectDocument } from '../../../A1_core/project-document';
import { ContextManager } from '../../../A1_core/context-manager';
import { registerProjectDomain } from '../../../A1_core/project-domain';
import type { CuttingPanelContract } from '../../../R1_reports/report-data-normalizer';
import type { CncWorkpiece } from '../types';

describe('parseNestingCsv', () => {
    it('czyta CSV z nagłówkiem PL/EN', () => {
        const csv = `nazwa;długość;szerokość;szt;grubość;materiał;obrót
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
        { part_id: 'a', node_id: 'n1', container_id: 'c1', smartbox_id: 's1', furniture_name: 'Szafa', role: 'BOK', material: 'x', thickness_mm: 18, length_mm: 700, width_mm: 500, edge_config: {}, is_x_longer: true, qty: 1 },
        { part_id: 'b', node_id: 'n2', container_id: 'c2', smartbox_id: 's2', furniture_name: 'Inna', role: 'Wieniec', material: 'x', thickness_mm: 18, length_mm: 600, width_mm: 400, edge_config: {}, is_x_longer: true, qty: 1 },
    ] as CuttingPanelContract[];

    it('PROJECT zwraca wszystkie', () => {
        expect(filterPanelsByScope(panels, { type: 'PROJECT', id: 'ALL', name: 'Projekt' })).toHaveLength(2);
    });

    it('CONTAINER filtruje po korpusie', () => {
        const out = filterPanelsByScope(panels, { type: 'CONTAINER', id: 'c1', name: 'Szafa' });
        expect(out.map((p) => p.part_id)).toEqual(['a']);
    });

    it('SMARTBOX filtruje po smartbox_id', () => {
        const out = filterPanelsByScope(panels, { type: 'SMARTBOX', id: 's1', name: 'Szuflady' });
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

    it('hydratuje żywy PanelModel z cechami i programem CAM', () => {
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
    it('shows "Edytuj korpus" in context menu for container / korpus nodes', async () => {
        const { showCadTreeContextMenu } = await import('../tree-context-menu');
        const doc = new ProjectDocument();
        registerProjectDomain(doc);
        const container = doc.createContainer({ name: 'Korpus (SmartFrame) 1' });
        container.generatorParams = { type: 'korpus3_2', zoneCount: 3 };
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

            const labels = shownItems.map(i => i.label);
            expect(labels).toContain('Edytuj korpus');
        } finally {
            ContextMenu.prototype.show = originalShow;
        }
    });

    it('shows "Edytuj operację" and "Usuń" for smart library operations, but not for native engine operations', async () => {
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
                name: 'Przetłoczenie / Wycięcie',
                panelId: 'panel_1',
                libraryId: 'przetloczenie',
                isSmart: true,
                source: 'library',
                face: 'FACE_Z_MINUS',
                clientX: 100,
                clientY: 100
            });

            let labels = shownItems.map(i => i.label);
            expect(labels).toContain('Edytuj operację');
            expect(labels).toContain('Właściwości');
            expect(labels).toContain('Usuń');
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

            labels = shownItems.map(i => i.label);
            expect(labels).not.toContain('Edytuj operację');
            expect(labels).not.toContain('Usuń');
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

            labels = shownItems.map(i => i.label);
            expect(labels).toContain('Edytuj formatkę');
            expect(labels).not.toContain('Usuń');
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

            labels = shownItems.map(i => i.label);
            expect(labels).toContain('Edytuj formatkę');
            expect(labels).toContain('Usuń');
            expect(labels).not.toContain('Zamroź formatkę');
            expect(labels).toContain('Raport z formatki');

            // 5. SmartBox container
            const doc2 = new ProjectDocument();
            registerProjectDomain(doc2);
            const sbContainer = doc2.createContainer({ name: 'smartbox_szuflady' });
            sbContainer.generatorParams = { type: 'smartbox_drawers', boxType: 'DRAWERS' };
            ContextManager.instance.document = doc2;

            showCadTreeContextMenu({
                type: 'container',
                id: sbContainer.id,
                name: sbContainer.name,
                clientX: 100,
                clientY: 100
            });

            labels = shownItems.map(i => i.label);
            expect(labels).toContain('Raport ze SmartBoxa');
            expect(labels).not.toContain('Edytuj korpus');
        } finally {
            ContextMenu.prototype.show = originalShow;
        }
    });
});

