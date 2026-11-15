import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { ContextManager } from '../context-manager.js';
import { CADNode } from '../cad-node/cad-node.js';
import { NodeType } from '../cad-node/node-type.js';
import { isManualPanel, findOwningContainer } from '../panel-like.js';

describe('findOwningContainer and Panel Activation SSOT', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Test Document' });
        ContextManager.instance.document = doc;
    });

    it('returns null when document or panel is null or undefined', () => {
        expect(findOwningContainer(null, null)).toBeNull();
        expect(findOwningContainer(doc, null)).toBeNull();
        expect(findOwningContainer(doc, undefined)).toBeNull();
        expect(findOwningContainer(doc, 'non-existent-id')).toBeNull();
    });

    it('returns the cabinet assembly container for a panel belonging to a cabinet', () => {
        const cabinet = doc.createAssembly({ name: 'Szafka_Dolna', type: 'container' });
        const panel = { id: 'p_side_left', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL' };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(cabinet.id, panelNode);

        const container = findOwningContainer(doc, panel);
        expect(container).toBeDefined();
        expect(container?.id).toBe(cabinet.id);
        expect(container?.name).toBe('Szafka_Dolna');

        // Także przy przekazaniu panel.id jako string
        const containerById = findOwningContainer(doc, panel.id);
        expect(containerById?.id).toBe(cabinet.id);
    });

    it('returns the nested subassembly container for a panel in a bloki drawer inside a cabinet', () => {
        const cabinet = doc.createAssembly({ name: 'Szafka_Główna', type: 'container' });
        const blokDrawer = doc.createAssembly({ name: 'Szuflada_1', type: 'bloki_container', is_blok: true }, cabinet.id);
        const frontPanel = { id: 'p_front_1', name: 'Front', type: 'panel', role: 'FRONT' };
        const frontNode = new CADNode(frontPanel.id, frontPanel.name, NodeType.PART);
        frontNode.domainData = frontPanel as any;
        doc.addNode(blokDrawer.id, frontNode);

        const container = findOwningContainer(doc, frontPanel);
        expect(container).toBeDefined();
        // Zwraca najbliższy kontener nadrzędny (w tym wypadku moduł bloku)
        expect(container?.id).toBe(blokDrawer.id);
    });

    it('returns null for a standalone panel attached directly to rootNode', () => {
        const standalonePanel = { id: 'p_free', name: 'Formatka_Wolna', type: 'panel' };
        const panelNode = new CADNode(standalonePanel.id, standalonePanel.name, NodeType.PART);
        panelNode.domainData = standalonePanel as any;
        doc.addNode(doc.rootNode.id, panelNode);

        const container = findOwningContainer(doc, standalonePanel);
        expect(container).toBeNull();
    });

    it('promotes container on single click and allows formatka activation only when explicitly set (double click)', () => {
        const cabinet = doc.createAssembly({ name: 'Szafa', type: 'container' });
        const panel = { id: 'p_shelf', name: 'Polka', type: 'panel', role: 'SHELF' };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(cabinet.id, panelNode);

        // 1. Pojedyncze kliknięcie (1-klik): wykrycie formatki i awansowanie kontenera (brak aktywacji formatki)
        const container = findOwningContainer(doc, panel);
        expect(container).toBeDefined();
        doc.setActiveEntity(container);
        expect(doc.activeEntity?.id).toBe(cabinet.id);
        expect(doc.activeEntity?.type).toBe('container');

        // 2. Podwójne kliknięcie (2-klik): aktywacja formatki jako doc.activeEntity
        doc.setActiveEntity(panel as any);
        expect(doc.activeEntity?.id).toBe(panel.id);
        expect(doc.activeEntity?.type).toBe('panel');
    });

    it('distinguishes native cabinet panel from manual smartpanel panel', () => {
        const cabinet = doc.createAssembly({ name: 'Szafa', type: 'container' });

        // 1. Natywna formatka korpusu (silnikowa: engineManaged !== false)
        const nativePanel = { id: 'p_native_bok', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', engineManaged: true };
        const nativeNode = new CADNode(nativePanel.id, nativePanel.name, NodeType.PART);
        nativeNode.domainData = nativePanel as any;
        doc.addNode(cabinet.id, nativeNode);

        expect(isManualPanel(nativePanel)).toBe(false);
        const nativeContainer = findOwningContainer(doc, nativePanel);
        expect(nativeContainer).toBeDefined();
        // Dla formatki natywnej korpusu: edycja dotyczy kontenera (korpus), a NIE smartpanelu
        const isNativeCabinetPanel = Boolean(nativeContainer && !isManualPanel(nativePanel));
        expect(isNativeCabinetPanel).toBe(true);

        // 2. Formatka manualna / SmartPanel (engineManaged === false)
        const manualPanel = { id: 'p_manual', name: 'Formatka_Custom', type: 'panel', engineManaged: false };
        const manualNode = new CADNode(manualPanel.id, manualPanel.name, NodeType.PART);
        manualNode.domainData = manualPanel as any;
        doc.addNode(cabinet.id, manualNode);

        expect(isManualPanel(manualPanel)).toBe(true);
        const isManualSmartPanel = !nativeContainer || isManualPanel(manualPanel);
        expect(isManualSmartPanel).toBe(true);
    });
});

