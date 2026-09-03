import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectDocument, migrateProjectToCurrent, PROJECT_FORMAT_VERSION, PROJECT_APP_VERSION } from '../project-document.js';
import { CADNode } from '../cad-node/cad-node.js';
import { NodeType } from '../cad-node/node-type.js';
import { Vec3 } from '../cad-math/vec3.js';
import { Quat } from '../cad-math/quat.js';
import { mmToNm } from '../cad-math/units.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { ProjectFileIO, suggestedProjectFileName, stampProjectFileMetadata } from '../project-file-io.js';
import appPackage from '../../package.json';

describe('ProjectDocument', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Test Project' });
    });

    it('should initialize with a root ROOM node', () => {
        expect(doc.rootNode).toBeDefined();
        expect(doc.rootNode.nodeType).toBe(NodeType.ROOM);
        expect(doc.rootNode.id).toBe('root_room');
        expect(doc.findNode('root_room')).toBe(doc.rootNode);
    });

    it('should add containers and panels to the document tree', () => {
        const container = doc.createContainer({ name: 'Szafa', width: mmToNm(600) });
        const containerNode = doc.findNode(container.id)!;
        expect(containerNode.parent).toBe(doc.rootNode);
        expect(doc.findNode(container.id)).toBe(containerNode);
        expect(doc.getContainers()).toHaveLength(1);

        const panel = doc.createPanel({ name: 'Bok lewy' }, container.id);
        const panelNode = doc.findNode(panel.id)!;
        expect(panelNode.parent).toBe(containerNode);
        expect(doc.findNode(panel.id)).toBe(panelNode);
        expect(doc.getPanels()).toHaveLength(1);
    });

    it('should prevent cyclic references when adding or reparenting nodes', () => {
        const parent = doc.createContainer({ name: 'Parent' });
        const child = doc.createPanel({ name: 'Child' }, parent.id);
        const parentNode = doc.findNode(parent.id)!;

        // Próba dodania parent jako dziecka child musi wyrzucić błąd
        expect(() => {
            doc.addNode(child.id, parentNode);
        }).toThrow(/cycle detected/i);
    });

    it('should remove node and its subtree', () => {
        const parent = doc.createContainer({ name: 'Parent' });
        const child = doc.createPanel({ name: 'Child' }, parent.id);
        const childNode = doc.findNode(child.id)!;

        expect(doc.findNode(child.id)).toBe(childNode);

        doc.removeNode(parent.id);

        expect(doc.findNode(parent.id)).toBeNull();
        expect(doc.findNode(child.id)).toBeNull();
        expect(doc.rootNode.children).toHaveLength(0);
    });

    it('should reparent node keeping world transform', () => {
        const container1 = doc.createContainer({ name: 'Szafa 1' });
        doc.findNode(container1.id)!.setLocalTransform(new Vec3(mmToNm(1000), 0, 0), Quat.IDENTITY);

        const container2 = doc.createContainer({ name: 'Szafa 2' });
        doc.findNode(container2.id)!.setLocalTransform(new Vec3(mmToNm(2000), 0, 0), Quat.IDENTITY);

        const panel = doc.createPanel({ name: 'Półka' }, container1.id);
        const panelNode = doc.findNode(panel.id)!;
        panelNode.setLocalTransform(new Vec3(mmToNm(100), 0, 0), Quat.IDENTITY);

        const worldPosBefore = panelNode.getWorldMatrix().decompose().translation;

        doc.reparentNode(panel.id, container2.id, { mode: 'keepWorld' });

        const worldPosAfter = panelNode.getWorldMatrix().decompose().translation;
        expect(worldPosAfter.x).toBeCloseTo(worldPosBefore.x, 0);
    });

    it('should emit documentChanged events when structure changes', () => {
        let eventCount = 0;
        doc.onDocumentChanged((evt) => {
            eventCount++;
            expect(evt.type).toBe('structure');
        });

        doc.createContainer({ name: 'Szafa' });
        expect(eventCount).toBe(1);
    });

    it('should serialize to v3 JSON format and load back identically', () => {
        const container = doc.createContainer({ name: 'Szafa Test' });
        const panel = doc.createPanel({ name: 'Bok' }, container.id);

        const serialized = JSON.parse(JSON.stringify(doc.serialize()));
        expect(serialized.format).toBe('smartpanel-project');
        expect(serialized.version).toBe(3);
        expect(serialized.extensions).toEqual({});
        expect(serialized).not.toHaveProperty('pmi');
        expect(serialized).not.toHaveProperty('constraints');
        expect(serialized).not.toHaveProperty('camera');

        const newDoc = new ProjectDocument();
        newDoc.load(serialized);

        expect(newDoc.isDirty()).toBe(false);
        expect(newDoc.getContainers()).toHaveLength(1);
        expect(newDoc.getPanels()).toHaveLength(1);
        const restoredPanel = newDoc.findNode(panel.id);
        expect(restoredPanel).toBeDefined();
        expect(restoredPanel?.name).toBe('Bok');
    });

    it('should enforce domainUnit nm and reject other units', () => {
        expect(() => {
            new ProjectDocument({ domainUnit: 'mm' });
        }).toThrow(/unsupported domainUnit/i);
    });

    it('should restore panel material, edgebanding and custom_properties via fromJSON', () => {
        const panel: any = doc.createPanel({ name: 'Bok' });
        panel.materialId = 'H1180_ST37_18';
        panel.materialName = 'Dąb Halifax';
        panel.materialCode = 'H1180 ST37';
        panel.color = { r: 0.4, g: 0.3, b: 0.2 };
        panel.setEdgeBand('+X', { type_id: '0.008x0.022', name: 'ABS 0.8', thickness_mm: 0.8 });
        panel.custom_properties.note = 'round-trip';
        panel.addFeature({
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { diameter: 8_000_000, depth: 12_000_000, u: 32_000_000, v: 32_000_000 },
        });

        const restored = new ProjectDocument();
        restored.load(JSON.parse(JSON.stringify(doc.serialize())));
        const restoredPanel = restored.findNode(panel.id)!.domainData as PanelModel;

        expect(restoredPanel.materialId).toBe('H1180_ST37_18');
        expect(restoredPanel.materialName).toBe('Dąb Halifax');
        expect(restoredPanel.materialCode).toBe('H1180 ST37');
        expect(restoredPanel.color).toEqual({ r: 0.4, g: 0.3, b: 0.2 });
        expect(restoredPanel.edgeBanding['+X'].type_id).toBe('0.008x0.022');
        expect(restoredPanel.custom_properties.note).toBe('round-trip');
        expect(restoredPanel.features).toHaveLength(1);
        expect(restoredPanel.features[0].type).toBe('hole');
        expect(restoredPanel.features[0].id).toBe(panel.features[0].id);
    });

    it('should restore container generatorParams via fromJSON', () => {
        const container = doc.createContainer({ name: 'Korpus' });
        container.generatorParams = { type: 'korpus3_2', zoneCount: 3, thickness: 18 };

        const restored = new ProjectDocument();
        restored.load(JSON.parse(JSON.stringify(doc.serialize())));
        const restoredContainer = restored.findNode(container.id)!.domainData as any;

        expect(restoredContainer.generatorParams).toEqual({
            type: 'korpus3_2',
            zoneCount: 3,
            thickness: 18,
        });
    });

    it('should put registered extensions under extensions, not at JSON root', () => {
        doc.registerExtension('pmi', {
            serialize: () => ({ version: 1, annotations: [{ id: 'd1' }] }),
            load: () => {},
        });

        const json = doc.serialize();
        expect(json.extensions?.pmi).toEqual({ version: 1, annotations: [{ id: 'd1' }] });
        expect(json).not.toHaveProperty('pmi');
    });

    it('should migrate v2 root pmi/constraints/camera into extensions', () => {
        const v2 = {
            format: 'smartpanel-project',
            version: 2,
            domainUnit: 'nm',
            id: 'doc_old',
            name: 'Stary projekt',
            rootNode: {
                id: 'root_room',
                name: 'Pokój',
                nodeType: 'ROOM',
                translationNm: [0, 0, 0],
                rotationQuat: [0, 0, 0, 1],
                scale: [1, 1, 1],
                children: [],
            },
            pmi: { version: 1, annotations: [], measurements: [] },
            constraints: { version: 1, constraints: [] },
            camera: { alpha: 1.2, beta: 0.8, radius: 1400, target: [10, 20, 30] },
        };

        const migrated = migrateProjectToCurrent(v2);
        expect(migrated.version).toBe(PROJECT_FORMAT_VERSION);
        expect(migrated.extensions?.pmi).toEqual(v2.pmi);
        expect(migrated.extensions?.constraints).toEqual(v2.constraints);
        expect(migrated.extensions?.viewport).toEqual({
            version: 1,
            camera: v2.camera,
        });
        expect(migrated).not.toHaveProperty('pmi');
        expect(migrated).not.toHaveProperty('camera');

        let loadedPmi: any = null;
        let loadedViewport: any = null;
        const restored = new ProjectDocument();
        restored.registerExtension('pmi', {
            serialize: () => loadedPmi,
            load: (data) => { loadedPmi = data; },
        });
        restored.registerExtension('viewport', {
            serialize: () => loadedViewport,
            load: (data) => { loadedViewport = data; },
        });
        restored.load(v2);

        expect(loadedPmi).toEqual(v2.pmi);
        expect(loadedViewport.camera.alpha).toBe(1.2);
        expect(restored.serialize().extensions?.pmi).toEqual(v2.pmi);
        expect(restored.serialize()).not.toHaveProperty('pmi');
    });

    it('should keep unknown extension payloads for round-trip', () => {
        const json = doc.serialize();
        json.extensions = { drawings: { version: 1, sheets: [{ id: 's1' }] } };

        const restored = new ProjectDocument();
        restored.load(json);
        expect(restored.serialize().extensions?.drawings).toEqual({
            version: 1,
            sheets: [{ id: 's1' }],
        });
    });

    it('should markSaved after an explicit save, and load() resets dirty', () => {
        doc.createPanel({ name: 'A' });
        expect(doc.isDirty()).toBe(true);
        doc.markSaved();
        expect(doc.isDirty()).toBe(false);
    });

    it('should stamp file metadata and build .spp.json filename', () => {
        expect(suggestedProjectFileName('Moja szafa')).toBe('Moja szafa.spp.json');
        const stamped = stampProjectFileMetadata(doc.serialize());
        expect(stamped.metadata?.savedAt).toMatch(/^\d{4}-/);
        expect(stamped.metadata?.appVersion).toBe(PROJECT_APP_VERSION);
        expect(PROJECT_APP_VERSION).toBe(appPackage.version);
    });

    it('warns when opening a newer format version and clamps to current', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const newer = {
            format: 'smartpanel-project',
            version: PROJECT_FORMAT_VERSION + 1,
            domainUnit: 'nm',
            id: 'doc_future',
            name: 'Przyszły',
            rootNode: {
                id: 'root_room',
                name: 'Pokój',
                nodeType: 'ROOM',
                translationNm: [0, 0, 0],
                rotationQuat: [0, 0, 0, 1],
                scale: [1, 1, 1],
                children: [],
            },
        };

        const migrated = migrateProjectToCurrent(newer);
        expect(migrated.version).toBe(PROJECT_FORMAT_VERSION);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('skips includeInSnapshots:false extensions in undo snapshots', () => {
        let loaded: any = 'untouched';
        doc.registerExtension('drawings', {
            serialize: () => ({ sheets: [{ id: 's1' }] }),
            load: (data) => { loaded = data; },
            includeInSnapshots: false,
        });

        expect(doc.serialize().extensions?.drawings).toEqual({ sheets: [{ id: 's1' }] });
        const snap = doc.serialize({ snapshot: true });
        expect(snap.extensions?.drawings).toBeUndefined();

        loaded = 'untouched';
        doc.load(snap, { snapshot: true });
        expect(loaded).toBe('untouched');

        doc.load(snap);
        expect(loaded).toBeNull();
    });

    it('does not markSaved on download fallback', async () => {
        const clicks: string[] = [];
        const fakeAnchor = {
            href: '',
            download: '',
            rel: '',
            click: () => { clicks.push('click'); },
            remove: () => {},
        };
        const prevWindow = (globalThis as any).window;
        const prevURL = globalThis.URL;
        (globalThis as any).window = {
            document: {
                createElement: () => fakeAnchor,
                body: { appendChild: () => {} },
            },
        };
        (globalThis as any).URL = {
            createObjectURL: () => 'blob:fake',
            revokeObjectURL: () => {},
        };

        try {
            doc.createPanel({ name: 'A' });
            expect(doc.isDirty()).toBe(true);
            const io = new ProjectFileIO();
            const mode = await io.save(doc);
            expect(mode).toBe('download');
            expect(clicks).toHaveLength(1);
            expect(doc.isDirty()).toBe(true);
            expect(doc.metadata.savedAt).toMatch(/^\d{4}-/);
        } finally {
            (globalThis as any).window = prevWindow;
            (globalThis as any).URL = prevURL;
        }
    });

    it('keeps a manual panel independently transformable inside a cabinet', () => {
        const container = doc.createContainer({ name: 'Szafa' });
        const enginePanel = doc.createPanel({ name: 'Bok lewy' }, container.id);
        const manual = doc.createPanel(
            { name: 'Wzmocnienie', engineManaged: false },
            container.id,
        );

        expect(doc.getTransformableTarget(enginePanel).isChildPanel).toBe(true);
        expect(doc.getTransformableTarget(enginePanel).target).toBe(container);

        const manualTarget = doc.getTransformableTarget(manual);
        expect(manualTarget.isChildPanel).toBe(false);
        expect(manualTarget.target).toBe(manual);
    });

    it('round-trips engineManaged on a manual panel', () => {
        const panel = doc.createPanel({ name: 'Wzmocnienie', engineManaged: false });
        expect((panel as PanelModel).engineManaged).toBe(false);

        const restored = new ProjectDocument();
        restored.load(JSON.parse(JSON.stringify(doc.serialize())));
        const restoredPanel = restored.findNode(panel.id)!.domainData as PanelModel;
        expect(restoredPanel.engineManaged).toBe(false);
    });

    it('hydrates PART/ASSEMBLY through the registered factory registry', () => {
        const panel = doc.createPanel({ name: 'Bok', materialId: 'H1180_ST37_18' });
        expect(panel.type).toBe('part');
        expect(panel).toBeInstanceOf(PanelModel);

        const json = JSON.parse(JSON.stringify(doc.serialize()));
        const restored = new ProjectDocument();
        restored.load(json);
        const restoredPanel = restored.findNode(panel.id)!.domainData as PanelModel;
        expect(restoredPanel).toBeInstanceOf(PanelModel);
        expect(restoredPanel.materialId).toBe('H1180_ST37_18');
    });

    it('allows replacing a hydrator without core knowing PanelModel', () => {
        const calls: string[] = [];
        doc.registerHydrator(NodeType.PART, (raw, nodeJson) => {
            calls.push(nodeJson.id);
            return PanelModel.fromJSON(raw);
        });
        const panel = doc.createPanel({ name: 'X' });
        const json = JSON.parse(JSON.stringify(doc.serialize()));
        doc.load(json);
        expect(calls).toContain(panel.id);
    });
});
