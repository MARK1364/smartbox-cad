import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { applyPlanToContainer, applyRealtimeUpdate, runEngineAndApply } from '../smartframe-adapter.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { CreateKorpusCommand } from '../commands/create-korpus-command.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { SyncBackGroovesCommand } from '../commands/sync-back-grooves-command.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { registerKorpusRebuiltListener, resetCabinetPortForTests } from '../../A1_core/cabinet-port.js';
import { applyAllAssociativeDims } from '../../A4_smartpanel/associative-dim.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';

describe('Panel Role and Zone Metadata in SmartFrame Container', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('assigns strict roles, zoneId, and zonePrefix on all generated panels for 3-zone cabinet', () => {
        const cabinet = doc.createAssembly({ name: 'Szafa 3-strefowa' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 3 };

        runEngineAndApply(
            cabinet,
            1000,
            2400,
            600,
            3,
            500,
            1100
        );

        const cntNode = doc.findNode(cabinet.id);
        expect(cntNode).toBeDefined();
        expect(cntNode!.children.length).toBeGreaterThan(0);

        const allowedRoles = new Set([
            'LEFT_SIDE_PANEL',
            'RIGHT_SIDE_PANEL',
            'BOTTOM_PANEL',
            'TOP_PANEL',
            'BACK_PANEL'
        ]);

        for (const childNode of cntNode!.children) {
            const panel = childNode.domainData as any;
            expect(panel).toBeDefined();
            expect(allowedRoles.has(panel.role), `Invalid role "${panel.role}" on panel "${panel.name}"`).toBe(true);
            expect(panel.zoneId).toBeDefined();
            expect(['SEKCJA_B', 'SEKCJA_M', 'SEKCJA_T']).toContain(panel.zoneId);
            expect(panel.zonePrefix).toBeDefined();
            expect(['B_', 'M_', 'T_']).toContain(panel.zonePrefix);
            expect(panel.key).toBeDefined();

            // Asercje LCS na PanelModel
            expect(panel.lcs, `Brak LCS na formatce ${panel.name}`).toBeDefined();
            expect(panel.lcs?.faces?.INNER).toBe('FACE_Z_PLUS');
            expect(panel.lcs?.faces?.OUTER).toBe('FACE_Z_MINUS');
            expect(panel.lcs?.mapping).toBeDefined();
            expect(panel.lcs?.rotation).toBeDefined();
        }

        // Test aktualizacji (drugie wywoĹ‚anie runEngineAndApply)
        runEngineAndApply(
            cabinet,
            1200,
            2500,
            600,
            3,
            600,
            1200
        );

        for (const childNode of cntNode!.children) {
            const panel = childNode.domainData as any;
            expect(allowedRoles.has(panel.role)).toBe(true);
            expect(['SEKCJA_B', 'SEKCJA_M', 'SEKCJA_T']).toContain(panel.zoneId);
            expect(panel.zonePrefix).toBeDefined();
            expect(panel.key).toBeDefined();
            expect(panel.lcs).toBeDefined();
            expect(panel.lcs?.faces?.INNER).toBe('FACE_Z_PLUS');
            expect(panel.lcs?.faces?.OUTER).toBe('FACE_Z_MINUS');
        }
    });

    it('assigns single zone SEKCJA_B with prefix B_ for 1-zone cabinet and stores LCS', () => {
        const cabinet = doc.createAssembly({ name: 'Szafa 1-strefowa' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };

        runEngineAndApply(
            cabinet,
            800,
            2000,
            500,
            1
        );

        const cntNode = doc.findNode(cabinet.id);
        expect(cntNode).toBeDefined();
        expect(cntNode!.children.length).toBeGreaterThan(0);

        for (const childNode of cntNode!.children) {
            const panel = childNode.domainData as any;
            expect(panel.zoneId).toBe('SEKCJA_B');
            expect(panel.zonePrefix).toBe('B_');
            expect(panel.lcs).toBeDefined();
            expect(panel.lcs?.faces?.INNER).toBe('FACE_Z_PLUS');
            expect(panel.lcs?.faces?.OUTER).toBe('FACE_Z_MINUS');
        }
    });

    it('resolves LCS per rules tree when alternating standard and corner-90 plans without part.lcs', () => {
        const applyWithoutPartLcs = (
            type: string,
            name: string,
            dim: { x: number; y: number; z: number },
        ) => {
            const cabinet = doc.createAssembly({ name }) as ContainerModel;
            cabinet.generatorParams = { type };
            applyPlanToContainer(cabinet, {
                parts: [{
                    key: 'B_BOK_L',
                    name: 'Left side',
                    role: 'LEFT_SIDE_PANEL',
                    zonePrefix: 'B_',
                    zoneId: 'SEKCJA_B',
                    loc: { x: 0, y: 0, z: 0 },
                    dim,
                }],
            });
            const node = doc.findNode(cabinet.id)!.children[0];
            return { panel: node.domainData as any, node };
        };

        const standard = applyWithoutPartLcs('korpus3_2', 'Standard', { x: 720, y: 600, z: 18 });
        const corner90 = applyWithoutPartLcs('korpus_rogowy90', 'Corner 90', { x: 600, y: 18, z: 720 });
        const standardAgain = applyWithoutPartLcs('korpus3_2', 'Standard again', { x: 720, y: 600, z: 18 });

        expect(standard.panel.lcs.mapping).toEqual({ X: 'y', Y: 'x', Z: 'z' });
        expect(standard.panel.lcs.rotation).toEqual([0, 0, -90]);
        expect(corner90.panel.lcs.mapping).toEqual({ X: 'x', Y: 'z', Z: 'y' });
        expect(corner90.panel.lcs.rotation).toEqual([0, 0, 0]);
        expect(standardAgain.panel.lcs.mapping).toEqual(standard.panel.lcs.mapping);
        expect(standardAgain.panel.lcs.rotation).toEqual(standard.panel.lcs.rotation);

        for (const { panel } of [standard, corner90, standardAgain]) {
            expect(nmToMm(panel.width)).toBeCloseTo(600, 5);
            expect(nmToMm(panel.height)).toBeCloseTo(720, 5);
            expect(nmToMm(panel.thickness)).toBeCloseTo(18, 5);
        }

        const xAxis = new Vec3(1, 0, 0);
        const standardXAxis = standard.node.localMatrix.decompose().rotation.rotateVec3(xAxis);
        const cornerXAxis = corner90.node.localMatrix.decompose().rotation.rotateVec3(xAxis);
        expect(standardXAxis.x).toBeCloseTo(0, 5);
        expect(standardXAxis.y).toBeCloseTo(-1, 5);
        expect(cornerXAxis.x).toBeCloseTo(1, 5);
        expect(cornerXAxis.y).toBeCloseTo(0, 5);
    });

    it('passes an explicit zero middle-zone height through runEngineAndApply', () => {
        const cabinet = doc.createAssembly({ name: 'Zero middle height' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };

        runEngineAndApply(cabinet, 1000, 2400, 600, 3, 500, 0);

        expect(cabinet.generatorParams.wysokosc_strefy_srodkowej_mm).toBe(0);
    });

    it('rejects a zero lower-zone height before mutating an existing container', () => {
        const cabinet = doc.createAssembly({
            name: 'Invalid rebuild',
            width: mmToNm(700),
            height: mmToNm(1800),
            depth: mmToNm(550),
        }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus3_2',
            szerokosc_mm: 700,
            wysokosc_mm: 1800,
            glebokosc_mm: 550,
            liczba_stref: 2,
            wysokosc_strefy_dolnej_mm: 500,
        };
        const originalGeneratorParams = { ...cabinet.generatorParams };

        expect(() => runEngineAndApply(cabinet, 900, 2000, 600, 2, 0, 300))
            .toThrow(/wysokosc_strefy_dolnej_mm/);
        expect(cabinet.width).toBe(mmToNm(700));
        expect(cabinet.height).toBe(mmToNm(1800));
        expect(cabinet.depth).toBe(mmToNm(550));
        expect(cabinet.generatorParams).toEqual(originalGeneratorParams);
    });

    it('does not add a korpus to the document when its initial plan is invalid', () => {
        const command = new CreateKorpusCommand({
            szerokosc_mm: 900,
            wysokosc_mm: 2000,
            glebokosc_mm: 600,
            liczba_stref: 2,
            wysokosc_strefy_dolnej_mm: 0,
        });
        const rootChildrenBefore = doc.rootNode.children.length;

        expect(() => command.execute(doc)).toThrow(/wysokosc_strefy_dolnej_mm/);
        expect(doc.rootNode.children).toHaveLength(rootChildrenBefore);
    });

    it('does not mutate a korpus when realtime planning rejects an explicit zero lower height', () => {
        const cabinet = doc.createAssembly({
            name: 'Invalid realtime update',
            width: mmToNm(700),
            height: mmToNm(1800),
            depth: mmToNm(550),
        }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus3_2',
            typ_korpusu: 'korpus3',
            szerokosc_mm: 700,
            wysokosc_mm: 1800,
            glebokosc_mm: 550,
            liczba_stref: 2,
            wysokosc_strefy_dolnej_mm: 500,
            wysokosc_strefy_srodkowej_mm: 0,
        };
        const originalGeneratorParams = { ...cabinet.generatorParams };

        expect(() => applyRealtimeUpdate(doc, { wysokosc_strefy_dolnej_mm: 0 }, cabinet))
            .toThrow(/wysokosc_strefy_dolnej_mm/);
        expect(cabinet.width).toBe(mmToNm(700));
        expect(cabinet.height).toBe(mmToNm(1800));
        expect(cabinet.depth).toBe(mmToNm(550));
        expect(cabinet.generatorParams).toEqual(originalGeneratorParams);
    });

    it('restores the complete container when applying a regeneration fails midway', () => {
        const cabinet = doc.createAssembly({ name: 'Atomic rebuild' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        runEngineAndApply(cabinet, 800, 2000, 500, 1);

        const containerNode = doc.findNode(cabinet.id)!;
        const originalChildren = [...containerNode.children];
        const panelNode = originalChildren.find((node) => node.domainData instanceof PanelModel)!;
        const panel = panelNode.domainData as PanelModel;
        const originalPanelJson = JSON.stringify(panel.toJSON());
        const originalMatrix = [...panelNode.localMatrix.data];
        const originalDimensions = [cabinet.width, cabinet.height, cabinet.depth];
        const originalGeneratorParams = JSON.stringify(cabinet.generatorParams);
        const originalSetDimensions = panel.setDimensions;
        panel.setDimensions = function (width, height, thickness) {
            originalSetDimensions.call(this, width, height, thickness);
            throw new Error('injected panel update failure');
        };

        try {
            expect(() => runEngineAndApply(cabinet, 900, 2200, 600, 1))
                .toThrow('injected panel update failure');
        } finally {
            panel.setDimensions = originalSetDimensions;
        }

        expect(containerNode.children).toEqual(originalChildren);
        expect(containerNode.children.every((node) => doc.findNode(node.id) === node)).toBe(true);
        expect(panelNode.domainData).toBe(panel);
        expect(JSON.stringify(panel.toJSON())).toBe(originalPanelJson);
        expect([...panelNode.localMatrix.data]).toEqual(originalMatrix);
        expect([cabinet.width, cabinet.height, cabinet.depth]).toEqual(originalDimensions);
        expect(JSON.stringify(cabinet.generatorParams)).toBe(originalGeneratorParams);
    });

    it('rolls back regeneration when groove synchronization fails', () => {
        const cabinet = doc.createAssembly({ name: 'Groove sync failure' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        runEngineAndApply(cabinet, 800, 2000, 500, 1);

        const containerNode = doc.findNode(cabinet.id)!;
        const originalChildren = [...containerNode.children];
        const originalState = JSON.stringify({
            dimensions: [cabinet.width, cabinet.height, cabinet.depth],
            params: cabinet.generatorParams,
            panels: originalChildren.map((node) => ({
                id: node.id,
                name: node.name,
                matrix: [...node.localMatrix.data],
                data: node.domainData?.toJSON?.() ?? node.domainData,
            })),
        });
        const execute = vi.spyOn(SyncBackGroovesCommand.prototype, 'execute')
            .mockImplementation(() => { throw new Error('injected groove sync failure'); });

        try {
            expect(() => runEngineAndApply(cabinet, 900, 2200, 600, 1))
                .toThrow('injected groove sync failure');
        } finally {
            execute.mockRestore();
        }

        expect(containerNode.children).toEqual(originalChildren);
        expect(JSON.stringify({
            dimensions: [cabinet.width, cabinet.height, cabinet.depth],
            params: cabinet.generatorParams,
            panels: containerNode.children.map((node) => ({
                id: node.id,
                name: node.name,
                matrix: [...node.localMatrix.data],
                data: node.domainData?.toJSON?.() ?? node.domainData,
            })),
        })).toBe(originalState);
    });

    it('restores associative dimensions and solver side effects outside the regenerated korpus', () => {
        const cabinet = doc.createAssembly({ name: 'Associative source' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        runEngineAndApply(cabinet, 800, 2000, 500, 1);

        const left = doc.findNode(cabinet.id)!.children.find(
            (node) => (node.domainData as any)?.role === 'LEFT_SIDE_PANEL'
        )!;
        const right = doc.findNode(cabinet.id)!.children.find(
            (node) => (node.domainData as any)?.role === 'RIGHT_SIDE_PANEL'
        )!;
        const externalPanel = new PanelModel({
            width: mmToNm(100),
            height: mmToNm(300),
            thickness: mmToNm(18),
            name: 'External associative panel',
            role: 'MANUAL_PANEL',
            engineManaged: false,
        });
        const externalPanelNode = CADNode.create(NodeType.PART, externalPanel.name, externalPanel.id);
        externalPanelNode.domainData = externalPanel;
        externalPanelNode.setLocalTransform(new Vec3(10, 20, 30));
        doc.addNode(doc.rootNode.id, externalPanelNode);
        externalPanel.associativeDims = {
            width: {
                planeA: { nodeId: left.id, face: 'FACE_Z_PLUS' },
                planeB: { nodeId: right.id, face: 'FACE_Z_PLUS' },
                offsetMm: 0,
            },
        };

        const originalWidth = externalPanel.width;
        const originalMatrix = [...externalPanelNode.localMatrix.data];
        const initialRevision = doc.revision;
        const documentEvents: number[] = [];
        const unsubscribe = doc.onDocumentChanged((event) => documentEvents.push(event.revision));
        const dispatchEvent = vi.fn();
        const rebuildGeometry = vi.fn();
        vi.stubGlobal('window', {
            document: { dispatchEvent },
            __rebuildGeometry: rebuildGeometry,
        });
        vi.stubGlobal('CustomEvent', class {
            constructor(public type: string) {}
        });
        const constraint = { residual: { position: 0 }, conflict: false };
        const undoStack: unknown[] = [];
        const redoStack: unknown[] = ['redo-entry'];
        const previousSolver = ContextManager.instance.solverController;
        const mockSolver = {
            _store: {
                constraints: [constraint],
                _issuesById: new Map([['constraint', [{ severity: 'warning' }]]]),
            },
            _history: { _undoStack: undoStack, _redoStack: redoStack },
            _debounceTimer: null,
            solveNow() {
                externalPanelNode.setLocalTransform(new Vec3(99, 99, 99));
                constraint.residual = { position: 99 };
                this._history._undoStack.push('solver-entry');
                this._history._redoStack = [];
                throw new Error('injected solver synchronization failure');
            },
        };
        ContextManager.instance.solverController = mockSolver;

        try {
            expect(() => runEngineAndApply(cabinet, 900, 2000, 500, 1))
                .toThrow('injected solver synchronization failure');
        } finally {
            ContextManager.instance.solverController = previousSolver;
            unsubscribe();
            vi.unstubAllGlobals();
        }

        expect(externalPanel.width).toBe(originalWidth);
        expect([...externalPanelNode.localMatrix.data]).toEqual(originalMatrix);
        expect(constraint.residual).toEqual({ position: 0 });
        expect(mockSolver._history._undoStack).toEqual([]);
        expect(mockSolver._history._redoStack).toEqual(['redo-entry']);
        expect(doc.findNode(externalPanel.id)).toBe(externalPanelNode);
        expect(doc.revision).toBe(initialRevision);
        expect(documentEvents).toEqual([]);
        expect(dispatchEvent).not.toHaveBeenCalled();
        expect(rebuildGeometry).not.toHaveBeenCalled();
    });

    it('restores an external Bloki container and solver when a later commit listener fails', () => {
        const cabinet = doc.createAssembly({ name: 'Listener failure source' }) as ContainerModel;
        cabinet.generatorParams = { type: 'korpus3_2' };
        runEngineAndApply(cabinet, 800, 2000, 500, 1);
        const cabinetNode = doc.findNode(cabinet.id)!;
        const left = cabinetNode.children.find(
            (node) => (node.domainData as any)?.role === 'LEFT_SIDE_PANEL'
        )!;
        const right = cabinetNode.children.find(
            (node) => (node.domainData as any)?.role === 'RIGHT_SIDE_PANEL'
        )!;

        const externalBlock = doc.createAssembly({ name: 'External Bloki' }) as ContainerModel;
        externalBlock.generatorParams = {
            type: 'blok_shelf',
            boxType: 'SHELF',
            parentContainerId: cabinet.id,
            offsets: { xMin: 12 },
        };
        const originalBlockJson = JSON.stringify(externalBlock.toJSON());

        const externalPanel = new PanelModel({
            width: mmToNm(100),
            height: mmToNm(300),
            thickness: mmToNm(18),
            name: 'External associative panel',
            role: 'MANUAL_PANEL',
            engineManaged: false,
        });
        const externalPanelNode = CADNode.create(NodeType.PART, externalPanel.name, externalPanel.id);
        externalPanelNode.domainData = externalPanel;
        doc.addNode(doc.rootNode.id, externalPanelNode);
        externalPanel.associativeDims = {
            width: {
                planeA: { nodeId: left.id, face: 'FACE_Z_PLUS' },
                planeB: { nodeId: right.id, face: 'FACE_Z_PLUS' },
                offsetMm: 0,
            },
        };

        const originalWidth = externalPanel.width;
        const originalMatrix = [...externalPanelNode.localMatrix.data];
        const originalRevision = doc.revision;
        const documentEvents: number[] = [];
        const unsubscribe = doc.onDocumentChanged((event) => documentEvents.push(event.revision));
        const dispatchEvent = vi.fn();
        const rebuildGeometry = vi.fn();
        vi.stubGlobal('window', {
            document: { dispatchEvent },
            __rebuildGeometry: rebuildGeometry,
        });
        vi.stubGlobal('CustomEvent', class {
            constructor(public type: string) {}
        });

        const constraint = { residual: { position: 0 }, conflict: false };
        const solverHistory = { _undoStack: [] as unknown[], _redoStack: ['redo-entry'] as unknown[] };
        const previousSolver = ContextManager.instance.solverController;
        const solveNow = vi.fn(() => {
            externalPanelNode.setLocalTransform(new Vec3(99, 99, 99));
            constraint.residual = { position: 99 };
            solverHistory._undoStack.push('solver-entry');
            solverHistory._redoStack = [];
        });
        ContextManager.instance.solverController = {
            _store: {
                constraints: [constraint],
                _issuesById: new Map(),
            },
            _history: solverHistory,
            _debounceTimer: null,
            solveNow,
        };

        resetCabinetPortForTests();
        registerKorpusRebuiltListener(() => {
            externalBlock.generatorParams!.offsets = { xMin: 99 };
            externalBlock.width = mmToNm(999);
        });
        registerKorpusRebuiltListener(() => {
            throw new Error('injected later commit listener failure');
        });

        try {
            expect(() => runEngineAndApply(cabinet, 900, 2000, 500, 1))
                .toThrow('injected later commit listener failure');
        } finally {
            resetCabinetPortForTests();
            ContextManager.instance.solverController = previousSolver;
            unsubscribe();
            vi.unstubAllGlobals();
        }

        expect(solveNow).toHaveBeenCalledOnce();
        expect(JSON.stringify(externalBlock.toJSON())).toBe(originalBlockJson);
        expect(externalPanel.width).toBe(originalWidth);
        expect([...externalPanelNode.localMatrix.data]).toEqual(originalMatrix);
        expect(constraint.residual).toEqual({ position: 0 });
        expect(solverHistory._undoStack).toEqual([]);
        expect(solverHistory._redoStack).toEqual(['redo-entry']);
        expect(doc.revision).toBe(originalRevision);
        expect(documentEvents).toEqual([]);
        expect(dispatchEvent).not.toHaveBeenCalled();
        expect(rebuildGeometry).not.toHaveBeenCalled();
    });

    it('keeps korpus creation in Undo when post-commit geometry refresh fails', () => {
        const history = new CommandHistory(doc);
        const command = new CreateKorpusCommand({
            szerokosc_mm: 800,
            wysokosc_mm: 2000,
            glebokosc_mm: 500,
            typ_korpusu: 'korpus3',
        });
        const externalPanel = new PanelModel({
            width: mmToNm(100),
            height: mmToNm(300),
            thickness: mmToNm(18),
            name: 'External associative panel',
            role: 'MANUAL_PANEL',
            engineManaged: false,
        });
        const externalPanelNode = CADNode.create(NodeType.PART, externalPanel.name, externalPanel.id);
        externalPanelNode.domainData = externalPanel;
        doc.addNode(doc.rootNode.id, externalPanelNode);

        const dispatchEvent = vi.fn();
        const rebuildGeometry = vi.fn(() => { throw new Error('injected geometry refresh failure'); });
        const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('window', {
            document: { dispatchEvent },
            __rebuildGeometry: rebuildGeometry,
        });
        vi.stubGlobal('CustomEvent', class {
            constructor(public type: string) {}
        });

        const previousSolver = ContextManager.instance.solverController;
        const solveNow = vi.fn();
        ContextManager.instance.solverController = {
            _store: { constraints: [], _issuesById: new Map() },
            _history: { _undoStack: [], _redoStack: [] },
            _debounceTimer: null,
            solveNow,
        };
        resetCabinetPortForTests();
        registerKorpusRebuiltListener((document, containerId) => {
            const containerNode = document.findNode(containerId)!;
            const left = containerNode.children.find(
                (node) => (node.domainData as any)?.role === 'LEFT_SIDE_PANEL'
            )!;
            const right = containerNode.children.find(
                (node) => (node.domainData as any)?.role === 'RIGHT_SIDE_PANEL'
            )!;
            externalPanel.associativeDims = {
                width: {
                    planeA: { nodeId: left.id, face: 'FACE_Z_PLUS' },
                    planeB: { nodeId: right.id, face: 'FACE_Z_PLUS' },
                    offsetMm: 0,
                },
            };
            applyAllAssociativeDims(document);
        });

        try {
            expect(() => history.execute(command)).not.toThrow();
            expect(history.undoStack).toContain(command);
            expect(doc.findNode(command['createdId']!)).not.toBeNull();
            expect(externalPanel.width).not.toBe(mmToNm(100));
            expect(solveNow).toHaveBeenCalledOnce();
            expect(rebuildGeometry).toHaveBeenCalledOnce();
            expect(dispatchEvent).toHaveBeenCalledTimes(3);
            expect(logError).toHaveBeenCalledWith(
                'ProjectDocument afterCommit effect failed:',
                expect.objectContaining({ message: 'injected geometry refresh failure' })
            );
            expect(history.undo()).toBe(true);
            expect(doc.findNode(command['createdId']!)).toBeNull();
        } finally {
            resetCabinetPortForTests();
            ContextManager.instance.solverController = previousSolver;
            logError.mockRestore();
            vi.unstubAllGlobals();
        }
    });

    it('removes a newly added korpus when applying its initial plan fails', () => {
        const command = new CreateKorpusCommand({
            szerokosc_mm: 800,
            wysokosc_mm: 2000,
            glebokosc_mm: 500,
            typ_korpusu: 'korpus3',
        });
        const revisionBefore = doc.revision;
        const documentEvents: number[] = [];
        const unsubscribe = doc.onDocumentChanged((event) => documentEvents.push(event.revision));
        const originalAddNode = doc.addNode;
        let failedAfterPartWasAdded = false;
        doc.addNode = function (parentId, node, index) {
            originalAddNode.call(this, parentId, node, index);
            if (!failedAfterPartWasAdded && parentId !== doc.rootNode.id) {
                failedAfterPartWasAdded = true;
                throw new Error('injected initial apply failure');
            }
        };

        try {
            expect(() => command.execute(doc)).toThrow('injected initial apply failure');
        } finally {
            doc.addNode = originalAddNode;
            unsubscribe();
        }

        expect(failedAfterPartWasAdded).toBe(true);
        expect(doc.rootNode.children).toHaveLength(0);
        expect((command as any).createdId).toBeNull();
        expect(command.affectedNodeIds).toEqual([]);
        expect(doc.revision).toBe(revisionBefore);
        expect(documentEvents).toEqual([]);
    });
});
