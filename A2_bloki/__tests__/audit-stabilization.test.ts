import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import type { Command } from '../../A1_core/commands/command.js';
import { MacroCommand } from '../../A1_core/commands/macro-command.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { InsertBlokiCommand } from '../02_bloki-bay-actions.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { SmartModuleRegistry } from '../core/smart-module-registry.js';
import { registerAllBlokiModules } from '../01_bootstrap-bloki-modules.js';
import { SyncDrawerDrillingsCommand } from '../commands/sync-drawer-drillings-command.js';
import { SetBlokiParamsCommand } from '../commands/set-blok-params-command.js';
import { flushBlokiPreview, scheduleBlokiPreviewCommitBeforeRefresh } from '../bloki-transaction.js';
import { buildBackGrooves, type PanelState } from '../../A3_smartframe/back-groove-builder.js';

function createDoorBlokFixture(doc: ProjectDocument) {
    const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
    cabinet.width = mmToNm(800);
    cabinet.height = mmToNm(2000);
    cabinet.depth = mmToNm(600);
    cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };

    const leftPanel = new PanelModel({ width: mmToNm(600), height: mmToNm(2000), thickness: mmToNm(18) });
    leftPanel.role = 'LEFT_SIDE_PANEL';
    leftPanel.name = 'Bok_L';
    leftPanel.setFeatures([{ id: 'existing-hole', type: 'hole', params: { diameter: 5 } }]);
    const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
    leftNode.domainData = leftPanel;
    leftNode.setLocalTransform(new Vec3(mmToNm(-391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
    doc.addNode(cabinet.id, leftNode);

    const rightPanel = new PanelModel({ width: mmToNm(600), height: mmToNm(2000), thickness: mmToNm(18) });
    rightPanel.role = 'RIGHT_SIDE_PANEL';
    rightPanel.name = 'Bok_P';
    const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
    rightNode.domainData = rightPanel;
    rightNode.setLocalTransform(new Vec3(mmToNm(391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, Math.PI / 2));
    doc.addNode(cabinet.id, rightNode);

    const sbContainer = new ContainerModel({ width: mmToNm(764), height: mmToNm(2000), depth: mmToNm(600), name: 'blok_drzwi' });
    sbContainer.generatorParams = {
        type: 'blok_doors',
        boxType: 'DOORS',
        parentContainerId: cabinet.id,
        width_mm: 764,
        height_mm: 2000,
        depth_mm: 600,
        customReferences: {
            xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' },
            xMax: { panelId: rightNode.id, face: 'FACE_Z_MINUS' },
        },
        disabledReferences: { yMin: true, yMax: true, zMin: true, zMax: true },
        rodzaj_drzwi: 'LEFT',
    };
    const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
    sbNode.domainData = sbContainer;
    return { cabinet, leftPanel, leftNode, rightPanel, rightNode, sbNode };
}

describe('Bloki & SmartFrame Audit Stabilization', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('InsertBlokiCommand.undo cleanly removes drilling features from adjacent panels', () => {
        // 1. Tworzymy korpus z dwoma bokami
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.width = mmToNm(800);
        cabinet.height = mmToNm(2000);
        cabinet.depth = mmToNm(600);
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };
        const cabinetNode = doc.findNode(cabinet.id)!;

        const leftPanel = new PanelModel({ width: mmToNm(600), height: mmToNm(2000), thickness: mmToNm(18) });
        leftPanel.role = 'LEFT_SIDE_PANEL';
        leftPanel.name = 'Bok_L';
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
        doc.addNode(cabinet.id, leftNode);

        const rightPanel = new PanelModel({ width: mmToNm(600), height: mmToNm(2000), thickness: mmToNm(18) });
        rightPanel.role = 'RIGHT_SIDE_PANEL';
        rightPanel.name = 'Bok_P';
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, Math.PI / 2));
        doc.addNode(cabinet.id, rightNode);

        // 2. Wstawiamy Bloki Drzwi (Doors)
        const sbContainer = new ContainerModel({ width: mmToNm(764), height: mmToNm(2000), depth: mmToNm(600), name: 'blok_drzwi' });
        sbContainer.generatorParams = {
            type: 'blok_doors',
            boxType: 'DOORS',
            parentContainerId: cabinet.id,
            width_mm: 764,
            height_mm: 2000,
            depth_mm: 600,
            customReferences: {
                xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' },
                xMax: { panelId: rightNode.id, face: 'FACE_Z_MINUS' }
            },
            disabledReferences: { yMin: true, yMax: true, zMin: true, zMax: true },
            rodzaj_drzwi: 'LEFT'
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;

        const cmd = new InsertBlokiCommand(cabinet.id, sbNode, 'Wstaw Drzwi');
        cmd.execute(doc);

        // Upewniamy się, że nawiercenia pod zawiasy zostały dodane do lewego boku
        expect(leftPanel.features.length).toBeGreaterThan(0);
        expect(leftPanel.features.some(f => f.params?.isDoorDrilling || f.params?.sourceContainerId === sbNode.id)).toBe(true);

        // 3. Wykonujemy UNDO
        cmd.undo(doc);

        // Węzeł Bloki powinien zniknąć, a nawiercenia na lewym boku zostały wyczyszczone
        expect(doc.findNode(sbNode.id)).toBeNull();
        const remainingDoorHoles = leftPanel.features.filter(f => f.params?.isDoorDrilling || f.params?.sourceContainerId === sbNode.id);
        expect(remainingDoorHoles.length).toBe(0);
    });

    it('InsertBlokiCommand restores panels and history when drilling sync fails', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        cabinet.width = mmToNm(800);
        cabinet.height = mmToNm(2000);
        cabinet.depth = mmToNm(600);
        cabinet.generatorParams = { type: 'korpus3_2', liczba_stref: 1 };

        const leftPanel = new PanelModel({ width: mmToNm(600), height: mmToNm(2000), thickness: mmToNm(18) });
        leftPanel.role = 'LEFT_SIDE_PANEL';
        leftPanel.name = 'Bok_L';
        leftPanel.setFeatures([{ id: 'existing-hole', type: 'hole', params: { diameter: 5 } }]);
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
        doc.addNode(cabinet.id, leftNode);

        const rightPanel = new PanelModel({ width: mmToNm(600), height: mmToNm(2000), thickness: mmToNm(18) });
        rightPanel.role = 'RIGHT_SIDE_PANEL';
        rightPanel.name = 'Bok_P';
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, Math.PI / 2));
        doc.addNode(cabinet.id, rightNode);

        const sbContainer = new ContainerModel({ width: mmToNm(764), height: mmToNm(2000), depth: mmToNm(600), name: 'blok_drzwi' });
        sbContainer.generatorParams = {
            type: 'blok_doors',
            boxType: 'DOORS',
            parentContainerId: cabinet.id,
            width_mm: 764,
            height_mm: 2000,
            depth_mm: 600,
            customReferences: {
                xMin: { panelId: leftNode.id, face: 'FACE_Z_PLUS' },
                xMax: { panelId: rightNode.id, face: 'FACE_Z_MINUS' },
            },
            disabledReferences: { yMin: true, yMax: true, zMin: true, zMax: true },
            rodzaj_drzwi: 'LEFT',
        };
        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        const originalPanelState = leftPanel.toJSON();
        const initialRevision = doc.revision;
        const publishedChanges: unknown[] = [];
        doc.onDocumentChanged((change) => publishedChanges.push(change));
        const history = new CommandHistory(doc);

        registerAllBlokiModules();
        const originalPlugin = SmartModuleRegistry.get('DOORS')!;
        SmartModuleRegistry.register({
            ...originalPlugin,
            syncDrillings: () => {
                leftPanel.features.push({ id: 'partial-sync-hole', type: 'hole', params: { diameter: 8 } });
                throw new Error('Drilling sync failed');
            },
        });

        try {
            const command = new InsertBlokiCommand(cabinet.id, sbNode, 'Wstaw Drzwi');
            expect(() => history.execute(command)).toThrow('Drilling sync failed');

            expect(doc.findNode(sbNode.id)).toBeNull();
            expect(leftPanel.toJSON()).toEqual(originalPanelState);
            expect(doc.revision).toBe(initialRevision);
            expect(publishedChanges).toEqual([]);
            expect(history.undoStack).toEqual([]);
            expect(history.redoStack).toEqual([]);
        } finally {
            SmartModuleRegistry.register(originalPlugin);
        }
    });

    it('SetBlokiParamsCommand restores the block and panels when rebuild sync fails', () => {
        const fixture = createDoorBlokFixture(doc);
        const history = new CommandHistory(doc);
        const insertCommand = new InsertBlokiCommand(fixture.cabinet.id, fixture.sbNode, 'Wstaw Drzwi');
        history.execute(insertCommand);
        const originalPlugin = SmartModuleRegistry.get('DOORS')!;
        let shouldFail = true;
        SmartModuleRegistry.register({
            ...originalPlugin,
            syncDrillings: () => {
                if (shouldFail) {
                    fixture.leftPanel.features.push({
                        id: 'partial-params-sync-hole',
                        type: 'hole',
                        params: { diameter: 10 },
                    });
                    throw new Error('Drilling sync failed during parameter update');
                }
                originalPlugin.syncDrillings?.(doc, fixture.cabinet.id, fixture.sbNode);
            },
        });

        try {
            const originalContainerState = fixture.sbNode.domainData!.toJSON();
            const originalChildren = fixture.sbNode.findAll().map((node) => ({
                id: node.id,
                name: node.name,
                domainData: node.domainData?.toJSON?.(),
            }));
            const originalPanels = [fixture.leftPanel.toJSON(), fixture.rightPanel.toJSON()];
            const oldParams = { ...fixture.sbNode.domainData!.generatorParams! };
            const newParams = { ...oldParams, rodzaj_drzwi: 'RIGHT' };
            const publishedChanges: unknown[] = [];
            doc.setActiveEntity(fixture.leftPanel);
            const activeEntity = doc.activeEntity;
            const initialRevision = doc.revision;
            doc.onDocumentChanged((change) => publishedChanges.push(change));
            const command = new SetBlokiParamsCommand(fixture.sbNode.id, oldParams, newParams);

            expect(() => history.execute(command)).toThrow('Drilling sync failed during parameter update');

            expect(fixture.sbNode.domainData!.toJSON()).toEqual(originalContainerState);
            expect(fixture.sbNode.findAll().map((node) => ({
                id: node.id,
                name: node.name,
                domainData: node.domainData?.toJSON?.(),
            }))).toEqual(originalChildren);
            expect([fixture.leftPanel.toJSON(), fixture.rightPanel.toJSON()]).toEqual(originalPanels);
            expect(doc.activeEntity).toBe(activeEntity);
            expect(doc.revision).toBe(initialRevision);
            expect(publishedChanges).toEqual([]);
            expect(history.undoStack).toEqual([insertCommand]);
            expect(history.redoStack).toEqual([]);

            shouldFail = false;
            expect(() => history.execute(command)).not.toThrow();
            expect(fixture.sbNode.domainData!.generatorParams).toEqual(newParams);
            expect(history.undoStack).toEqual([insertCommand, command]);
        } finally {
            SmartModuleRegistry.register(originalPlugin);
        }
    });

    it('Bloki preview retains queued updates and restores models when rebuild fails', () => {
        const fixture = createDoorBlokFixture(doc);
        const history = new CommandHistory(doc);
        const insertCommand = new InsertBlokiCommand(fixture.cabinet.id, fixture.sbNode, 'Wstaw Drzwi');
        history.execute(insertCommand);
        const originalParams = JSON.parse(JSON.stringify(fixture.sbNode.domainData!.generatorParams));
        const originalPanel = fixture.leftPanel.toJSON();
        const pendingParams = { rodzaj_drzwi: 'RIGHT' };
        const publishedChanges: unknown[] = [];
        doc.setActiveEntity(fixture.leftPanel);
        const activeEntity = doc.activeEntity;
        const initialRevision = doc.revision;
        doc.onDocumentChanged((change) => publishedChanges.push(change));

        expect(() => flushBlokiPreview(doc, fixture.sbNode, fixture.sbNode.domainData as ContainerModel, pendingParams, () => {
            fixture.leftPanel.features.push({
                id: 'preview-partial-hole',
                type: 'hole',
                params: { diameter: 11 },
            });
            throw new Error('Preview rebuild failed');
        })).toThrow('Preview rebuild failed');

        expect(fixture.sbNode.domainData!.generatorParams).toEqual(originalParams);
        expect(fixture.leftPanel.toJSON()).toEqual(originalPanel);
        expect(pendingParams).toEqual({ rodzaj_drzwi: 'RIGHT' });
        expect(doc.activeEntity).toBe(activeEntity);
        expect(doc.revision).toBe(initialRevision);
        expect(publishedChanges).toEqual([]);
        expect(history.undoStack).toEqual([insertCommand]);

        flushBlokiPreview(doc, fixture.sbNode, fixture.sbNode.domainData as ContainerModel, pendingParams, () => {
            fixture.leftPanel.features.push({
                id: 'preview-success-hole',
                type: 'hole',
                params: { diameter: 11 },
            });
        });
        expect(fixture.sbNode.domainData!.generatorParams).toMatchObject({ rodzaj_drzwi: 'RIGHT' });
        expect(pendingParams).toEqual({});
    });

    it('schedules the parameter command before an isolated geometry refresh failure', () => {
        const order: string[] = [];
        const refreshError = new Error('Geometry refresh failed');
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            scheduleBlokiPreviewCommitBeforeRefresh(
                () => order.push('schedule-undo'),
                () => {
                    order.push('refresh');
                    throw refreshError;
                }
            );

            expect(order).toEqual(['schedule-undo', 'refresh']);
            expect(consoleError).toHaveBeenCalledWith(
                '[Bloki preview] Geometry refresh failed after parameter update:',
                refreshError
            );
        } finally {
            consoleError.mockRestore();
        }
    });

    it('InsertBlokiCommand.undo restores tree and panels when a later drilling sync fails', () => {
        const fixture = createDoorBlokFixture(doc);
        const history = new CommandHistory(doc);
        const command = new InsertBlokiCommand(fixture.cabinet.id, fixture.sbNode, 'Wstaw Drzwi');
        history.execute(command);

        const panelState = [fixture.leftPanel.toJSON(), fixture.rightPanel.toJSON()];
        const childIds = fixture.cabinet && doc.findNode(fixture.cabinet.id)!.children.map((node) => node.id);
        doc.setActiveEntity(fixture.leftPanel);
        const activeEntity = doc.activeEntity;
        const initialRevision = doc.revision;
        const publishedChanges: unknown[] = [];
        doc.onDocumentChanged((change) => publishedChanges.push(change));
        const syncSpy = vi.spyOn(SyncDrawerDrillingsCommand.prototype, 'execute')
            .mockImplementationOnce(() => { throw new Error('Drawer sync failed during undo'); });

        try {
            expect(() => history.undo()).toThrow('Drawer sync failed during undo');

            expect(doc.findNode(fixture.sbNode.id)).toBe(fixture.sbNode);
            expect(fixture.sbNode.parent?.id).toBe(fixture.cabinet.id);
            expect(doc.findNode(fixture.cabinet.id)!.children.map((node) => node.id)).toEqual(childIds);
            expect([fixture.leftPanel.toJSON(), fixture.rightPanel.toJSON()]).toEqual(panelState);
            expect(doc.revision).toBe(initialRevision);
            expect(publishedChanges).toEqual([]);
            expect(doc.activeEntity).toBe(activeEntity);
            expect(history.undoStack).toEqual([command]);
            expect(history.redoStack).toEqual([]);

            publishedChanges.length = 0;
            expect(history.undo()).toBe(true);
            expect(doc.findNode(fixture.sbNode.id)).toBeNull();
            expect(doc.activeEntity).toBe(activeEntity);
            expect(history.undoStack).toEqual([]);
            expect(history.redoStack).toEqual([command]);
        } finally {
            syncSpy.mockRestore();
        }
    });

    it('InsertBlokiCommand.redo restores panels when module drilling sync fails', () => {
        const fixture = createDoorBlokFixture(doc);
        const history = new CommandHistory(doc);
        const command = new InsertBlokiCommand(fixture.cabinet.id, fixture.sbNode, 'Wstaw Drzwi');
        registerAllBlokiModules();
        const originalPlugin = SmartModuleRegistry.get('DOORS')!;
        let shouldFail = false;
        SmartModuleRegistry.register({
            ...originalPlugin,
            syncDrillings: (document, cabinetId, containerNode) => {
                if (shouldFail) {
                    fixture.leftPanel.features.push({
                        id: 'partial-redo-hole',
                        type: 'hole',
                        params: { diameter: 9 },
                    });
                    throw new Error('Door sync failed during redo');
                }
                originalPlugin.syncDrillings?.(document, cabinetId, containerNode);
            },
        });

        try {
            history.execute(command);
            history.undo();
            const panelState = [fixture.leftPanel.toJSON(), fixture.rightPanel.toJSON()];
            const childIds = doc.findNode(fixture.cabinet.id)!.children.map((node) => node.id);
            doc.setActiveEntity(fixture.leftPanel);
            const activeEntity = doc.activeEntity;
            const initialRevision = doc.revision;
            const publishedChanges: unknown[] = [];
            doc.onDocumentChanged((change) => publishedChanges.push(change));
            shouldFail = true;

            expect(() => history.redo()).toThrow('Door sync failed during redo');

            expect(doc.findNode(fixture.sbNode.id)).toBeNull();
            expect(doc.findNode(fixture.cabinet.id)!.children.map((node) => node.id)).toEqual(childIds);
            expect([fixture.leftPanel.toJSON(), fixture.rightPanel.toJSON()]).toEqual(panelState);
            expect(doc.revision).toBe(initialRevision);
            expect(publishedChanges).toEqual([]);
            expect(doc.activeEntity).toBe(activeEntity);
            expect(history.undoStack).toEqual([]);
            expect(history.redoStack).toEqual([command]);

            publishedChanges.length = 0;
            shouldFail = false;
            expect(history.redo()).toBe(true);
            expect(doc.findNode(fixture.sbNode.id)).toBe(fixture.sbNode);
            expect(doc.activeEntity).toBe(activeEntity);
            expect(history.undoStack).toEqual([command]);
            expect(history.redoStack).toEqual([]);
        } finally {
            SmartModuleRegistry.register(originalPlugin);
        }
    });

    it('InsertBlokiCommand rolls back with its macro when a later macro command fails', () => {
        const fixture = createDoorBlokFixture(doc);
        const history = new CommandHistory(doc);
        const panelState = [fixture.leftPanel.toJSON(), fixture.rightPanel.toJSON()];
        const childIds = doc.findNode(fixture.cabinet.id)!.children.map((node) => node.id);
        const initialRevision = doc.revision;
        const publishedChanges: unknown[] = [];
        doc.onDocumentChanged((change) => publishedChanges.push(change));
        const insertCommand = new InsertBlokiCommand(fixture.cabinet.id, fixture.sbNode, 'Wstaw Drzwi');
        const failCommand: Command = {
            id: 'fail-after-bloki-insert',
            label: 'Fail after insertion',
            timestamp: 0,
            affectedNodeIds: [fixture.sbNode.id],
            execute: () => { throw new Error('Later macro command failed'); },
            undo: () => {},
        };
        const macro = new MacroCommand([insertCommand, failCommand]);

        expect(() => history.execute(macro)).toThrow('Later macro command failed');

        expect(doc.findNode(fixture.sbNode.id)).toBeNull();
        expect(doc.findNode(fixture.cabinet.id)!.children.map((node) => node.id)).toEqual(childIds);
        expect([fixture.leftPanel.toJSON(), fixture.rightPanel.toJSON()]).toEqual(panelState);
        expect(doc.revision).toBe(initialRevision);
        expect(publishedChanges).toEqual([]);
        expect(history.undoStack).toEqual([]);
        expect(history.redoStack).toEqual([]);
    });

    it('buildBackGrooves generates back grooves for PARTITION and MANUAL_PANEL roles', () => {
        const panels: PanelState[] = [
            {
                id: 'B_PLECY',
                role: 'BACK_PANEL',
                dim_nm: { x: mmToNm(1000), y: mmToNm(2000), z: mmToNm(3) },
                localMatrix: Mat4.fromTRS(new Vec3(0, mmToNm(280), mmToNm(1000)), Quat.IDENTITY),
                zonePrefix: ''
            },
            {
                id: 'B_PRZEGRODA',
                role: 'PARTITION',
                dim_nm: { x: mmToNm(600), y: mmToNm(2000), z: mmToNm(18) },
                localMatrix: Mat4.fromTRS(new Vec3(0, 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2)),
                zonePrefix: ''
            }
        ];

        const grooves = buildBackGrooves(panels);
        expect(grooves.length).toBeGreaterThan(0);
        expect(grooves[0].targetNodeId).toBe('B_PRZEGRODA');
    });
});
