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
import { ContainerModel } from '../container-model.js';
import { HardwareModel } from '../hardware-model.js';

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
        const container = doc.createAssembly({ name: 'Szafa', width: mmToNm(600) }) as ContainerModel;
        const containerNode = doc.findNode(container.id)!;
        expect(containerNode.parent).toBe(doc.rootNode);
        expect(doc.findNode(container.id)).toBe(containerNode);
        expect(doc.getContainers()).toHaveLength(1);

        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok lewy' }, container.id);
        const panelNode = doc.findNode(panel.id)!;
        expect(panelNode.parent).toBe(containerNode);
        expect(doc.findNode(panel.id)).toBe(panelNode);
        expect(doc.getPanels()).toHaveLength(1);
    });

    it('should prevent cyclic references when adding or reparenting nodes', () => {
        const parent = doc.createAssembly({ name: 'Parent' }) as ContainerModel;
        const child = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Child' }, parent.id);
        const parentNode = doc.findNode(parent.id)!;

        // PrĂłba dodania parent jako dziecka child musi wyrzuciÄ‡ bĹ‚Ä…d
        expect(() => {
            doc.addNode(child.id, parentNode);
        }).toThrow(/cycle detected/i);
    });

    it('should remove node and its subtree', () => {
        const parent = doc.createAssembly({ name: 'Parent' }) as ContainerModel;
        const child = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Child' }, parent.id);
        const childNode = doc.findNode(child.id)!;

        expect(doc.findNode(child.id)).toBe(childNode);

        doc.setActiveEntity(parent);
        expect(doc.activeEntity).toBe(parent);

        doc.removeNode(parent.id);

        expect(doc.findNode(parent.id)).toBeNull();
        expect(doc.findNode(child.id)).toBeNull();
        expect(doc.rootNode.children).toHaveLength(0);
        expect(doc.activeEntity).toBeNull();
    });

    it('should reparent node keeping world transform', () => {
        const container1 = doc.createAssembly({ name: 'Szafa 1' }) as ContainerModel;
        doc.findNode(container1.id)!.setLocalTransform(new Vec3(mmToNm(1000), 0, 0), Quat.IDENTITY);

        const container2 = doc.createAssembly({ name: 'Szafa 2' }) as ContainerModel;
        doc.findNode(container2.id)!.setLocalTransform(new Vec3(mmToNm(2000), 0, 0), Quat.IDENTITY);

        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'PĂłĹ‚ka' }, container1.id);
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

        doc.createAssembly({ name: 'Szafa' }) as ContainerModel;
        expect(eventCount).toBe(1);
    });

    it('buffers document changes until commit and discards them when a transaction fails', () => {
        const events: Array<{ type: string; revision: number }> = [];
        const deferredEffect = vi.fn();
        doc.onDocumentChanged((event) => events.push({ type: event.type, revision: event.revision }));
        const initialRevision = doc.revision;

        expect(() => doc.transaction(() => {
            doc.emitChange('structure', ['temporary']);
            doc.emitChange('dimensions', ['temporary']);
            doc.afterCommit(deferredEffect);
            expect(doc.revision).toBe(initialRevision);
            expect(events).toHaveLength(0);
            throw new Error('transaction failure');
        })).toThrow('transaction failure');

        expect(doc.revision).toBe(initialRevision);
        expect(events).toEqual([]);
        expect(deferredEffect).not.toHaveBeenCalled();
    });

    it('publishes buffered document changes in order only after a successful transaction', () => {
        const events: Array<{ type: string; revision: number }> = [];
        const beforeCommitEffect = vi.fn(() => {
            expect(events).toHaveLength(0);
            expect(doc.revision).toBe(initialRevision);
        });
        const afterCommitEffect = vi.fn(() => {
            expect(events).toHaveLength(2);
            expect(doc.revision).toBe(initialRevision + 2);
        });
        doc.onDocumentChanged((event) => events.push({ type: event.type, revision: event.revision }));
        const initialRevision = doc.revision;

        doc.transaction(() => {
            doc.emitChange('structure', ['node']);
            doc.beforeCommit(beforeCommitEffect);
            doc.afterCommit(afterCommitEffect);
            doc.transaction(() => doc.emitChange('dimensions', ['node']));
            expect(doc.revision).toBe(initialRevision);
            expect(events).toHaveLength(0);
        });

        expect(events).toEqual([
            { type: 'structure', revision: initialRevision + 1 },
            { type: 'dimensions', revision: initialRevision + 2 },
        ]);
        expect(doc.revision).toBe(initialRevision + 2);
        expect(beforeCommitEffect).toHaveBeenCalledOnce();
        expect(afterCommitEffect).toHaveBeenCalledOnce();
    });

    it('keeps the transaction committed when a post-commit UI effect fails', () => {
        const events: Array<{ type: string; revision: number }> = [];
        const rollback = vi.fn(() => doc.emitChange('structure', ['restored']));
        doc.onDocumentChanged((event) => events.push({ type: event.type, revision: event.revision }));
        const initialRevision = doc.revision;
        const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(doc.transaction(() => {
            doc.emitChange('dimensions', ['changed']);
            doc.afterCommit(() => { throw new Error('post-commit UI failure'); });
        }, rollback)).toBeUndefined();

        expect(rollback).not.toHaveBeenCalled();
        expect(doc.revision).toBe(initialRevision + 1);
        expect(events).toEqual([{ type: 'dimensions', revision: initialRevision + 1 }]);
        expect(logError).toHaveBeenCalledWith(
            'ProjectDocument afterCommit effect failed:',
            expect.objectContaining({ message: 'post-commit UI failure' })
        );
        logError.mockRestore();
    });

    it('continues running remaining afterCommit effects after one fails', () => {
        const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const firstEffect = vi.fn(() => { throw new Error('geometry refresh failed'); });
        const nextEffect = vi.fn();

        try {
            doc.transaction(() => {
                doc.afterCommit(firstEffect);
                doc.afterCommit(nextEffect);
            });
            expect(firstEffect).toHaveBeenCalledOnce();
            expect(nextEffect).toHaveBeenCalledOnce();
            expect(logError).toHaveBeenCalledOnce();
        } finally {
            logError.mockRestore();
        }
    });

    it('runs nested rollback handlers in reverse order when the outer commit effect fails', () => {
        const rollbackOrder: string[] = [];

        expect(() => doc.transaction(() => {
            doc.transaction(
                () => doc.beforeCommit(() => { throw new Error('nested commit effect failure'); }),
                () => rollbackOrder.push('nested')
            );
        }, () => rollbackOrder.push('outer'))).toThrow('nested commit effect failure');

        expect(rollbackOrder).toEqual(['nested', 'outer']);
    });

    it('should serialize to v4 JSON format and load back identically', () => {
        const container = doc.createAssembly({ name: 'Szafa Test' }) as ContainerModel;
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok' }, container.id);

        const serialized = JSON.parse(JSON.stringify(doc.serialize()));
        expect(serialized.format).toBe('smartpanel-project');
        expect(serialized.version).toBe(PROJECT_FORMAT_VERSION);
        expect(PROJECT_FORMAT_VERSION).toBe(4);
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
        const panel: any = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok' });
        panel.materialId = 'H1180_ST37_18';
        panel.materialName = 'DÄ…b Halifax';
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
        expect(restoredPanel.materialName).toBe('DÄ…b Halifax');
        expect(restoredPanel.materialCode).toBe('H1180 ST37');
        expect(restoredPanel.color).toEqual({ r: 0.4, g: 0.3, b: 0.2 });
        expect(restoredPanel.edgeBanding['+X'].type_id).toBe('0.008x0.022');
        expect(restoredPanel.custom_properties.note).toBe('round-trip');
        expect(restoredPanel.features).toHaveLength(1);
        expect(restoredPanel.features[0].type).toBe('hole');
        expect(restoredPanel.features[0].id).toBe(panel.features[0].id);
    });

    it('should restore container generatorParams via fromJSON', () => {
        const container = doc.createAssembly({ name: 'Korpus' }) as ContainerModel;
        container.generatorParams = { type: 'korpus3_2', liczba_stref: 3, thickness: 18 };

        const restored = new ProjectDocument();
        restored.load(JSON.parse(JSON.stringify(doc.serialize())));
        const restoredContainer = restored.findNode(container.id)!.domainData as any;

        expect(restoredContainer.generatorParams).toEqual({
            type: 'korpus3_2',
            liczba_stref: 3,
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

    it('odrzuca plik v2 czytelnym bledem (zero kompatybilnosci wstecznej)', () => {
        const v2 = {
            format: 'smartpanel-project',
            version: 2,
            domainUnit: 'nm',
            id: 'doc_old',
            name: 'Stary projekt',
            rootNode: {
                id: 'root_room',
                name: 'Pokoj',
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

        // v2 mialo wycofane nazwy parametrow korpusu — migracja bylaby trwalym dlugiem.
        expect(() => migrateProjectToCurrent(v2)).toThrow(/wersji 2/);
        expect(() => migrateProjectToCurrent(v2)).toThrow(/4/);
    });

    it('odrzuca plik v3 (z aliasami parametrow) zamiast go cicho wczytac', () => {
        const v3 = {
            format: 'smartpanel-project',
            version: 3,
            domainUnit: 'nm',
            id: 'doc_v3',
            name: 'Projekt v3',
            rootNode: {
                id: 'root_room',
                name: 'Pokoj',
                nodeType: 'ROOM',
                translationNm: [0, 0, 0],
                rotationQuat: [0, 0, 0, 1],
                scale: [1, 1, 1],
                children: [],
            },
        };

        expect(() => new ProjectDocument().load(v3)).toThrow(/wersji 3/);
    });

    it('odrzuca plik z domainUnit innym niż nm', () => {
        const badUnit = {
            format: 'smartpanel-project',
            version: PROJECT_FORMAT_VERSION,
            domainUnit: 'µm',
            id: 'doc_bad_unit',
            name: 'Złe jednostki',
            rootNode: {
                id: 'root_room',
                name: 'Pokoj',
                nodeType: 'ROOM',
                translationNm: [0, 0, 0],
                rotationQuat: [0, 0, 0, 1],
                scale: [1, 1, 1],
                children: [],
            },
        };

        expect(() => migrateProjectToCurrent(badUnit)).toThrow(/domainUnit/);
        expect(() => migrateProjectToCurrent(badUnit)).toThrow(/nm/);
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
        doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'A' });
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

    it('does not replace the current native handle until a project open is committed', async () => {
        const previousWindow = (globalThis as any).window;
        const createHandle = (name: string, text: string) => ({
            name,
            getFile: async () => ({ name, text: async () => text }),
        });
        const firstHandle = createHandle('first.spp.json', '{"name":"first"}');
        const nextHandle = createHandle('next.spp.json', JSON.stringify({
            format: 'smartpanel-project',
            version: PROJECT_FORMAT_VERSION + 1,
        }));
        const validHandle = createHandle('valid.spp.json', JSON.stringify(doc.serialize()));
        (globalThis as any).window = {
            showOpenFilePicker: vi.fn()
                .mockResolvedValueOnce([firstHandle])
                .mockResolvedValueOnce([nextHandle])
                .mockResolvedValueOnce([validHandle])
                .mockResolvedValueOnce([createHandle('invalid.spp.json', '{broken')]),
        };

        try {
            const io = new ProjectFileIO();
            const first = await io.open();
            expect(first).not.toBeNull();
            first!.commit();
            expect(io.currentFileName).toBe('first.spp.json');

            const next = await io.open();
            expect(next?.data.version).toBe(PROJECT_FORMAT_VERSION + 1);
            expect(io.currentFileName).toBe('first.spp.json');

            expect(() => doc.load(next!.data)).toThrow();
            expect(io.currentFileName).toBe('first.spp.json');

            const valid = await io.open();
            doc.load(valid!.data);
            valid!.commit();
            expect(io.currentFileName).toBe('valid.spp.json');

            await expect(io.open()).rejects.toThrow();
            expect(io.currentFileName).toBe('valid.spp.json');
        } finally {
            (globalThis as any).window = previousWindow;
        }
    });

    it('openFromFile keeps the existing handle on parse or document load failure', async () => {
        const previousWindow = (globalThis as any).window;
        (globalThis as any).window = {};
        try {
            const io = new ProjectFileIO();
            const nativeHandle = {
                name: 'current.spp.json',
                getFile: async () => ({ name: 'current.spp.json', text: async () => '{"name":"current"}' }),
            };
            (globalThis as any).window.showOpenFilePicker = vi.fn().mockResolvedValue([nativeHandle]);
            const nativeOpen = await io.open();
            nativeOpen!.commit();

            const invalidFile = { name: 'invalid.spp.json', text: async () => '{broken' } as File;
            await expect(io.openFromFile(invalidFile)).rejects.toThrow();
            expect(io.currentFileName).toBe('current.spp.json');

            const validFile = { name: 'valid.spp.json', text: async () => '{"name":"valid"}' } as File;
            const pendingOpen = await io.openFromFile(validFile);
            expect(io.currentFileName).toBe('current.spp.json');
            expect(() => doc.load({
                format: 'smartpanel-project',
                version: PROJECT_FORMAT_VERSION + 1,
            })).toThrow();
            expect(io.currentFileName).toBe('current.spp.json');

            pendingOpen.commit();
            expect(io.currentFileName).toBeNull();
        } finally {
            (globalThis as any).window = previousWindow;
        }
    });

    it('odrzuca plik nowszy niz obslugiwany zamiast go clampowac', () => {
        const newer = {
            format: 'smartpanel-project',
            version: PROJECT_FORMAT_VERSION + 1,
            domainUnit: 'nm',
            id: 'doc_future',
            name: 'Przyszly',
            rootNode: {
                id: 'root_room',
                name: 'Pokoj',
                nodeType: 'ROOM',
                translationNm: [0, 0, 0],
                rotationQuat: [0, 0, 0, 1],
                scale: [1, 1, 1],
                children: [],
            },
        };

        // Clampowanie do dolnej wersji czytalo strukture nowego formatu stara semantyka —
        // to ten sam problem co wersja 3. Teraz: czytelny blad.
        expect(() => migrateProjectToCurrent(newer)).toThrow(/wersji/);
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

    it('markSaved also on download fallback', async () => {
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
            doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'A' });
            expect(doc.isDirty()).toBe(true);
            const io = new ProjectFileIO();
            const mode = await io.save(doc);
            expect(mode).toBe('download');
            expect(clicks).toHaveLength(1);
            expect(doc.isDirty()).toBe(false);
            expect(doc.metadata.savedAt).toMatch(/^\d{4}-/);
        } finally {
            (globalThis as any).window = prevWindow;
            (globalThis as any).URL = prevURL;
        }
    });

    it('keeps a manual panel independently transformable inside a cabinet', () => {
        const container = doc.createAssembly({ name: 'Szafa' }) as ContainerModel;
        const enginePanel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok lewy' }, container.id);
        const manual = doc.createPanel(
            { width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Wzmocnienie', engineManaged: false },
            container.id,
        );

        expect(doc.getTransformableTarget(enginePanel).isChildPanel).toBe(true);
        expect(doc.getTransformableTarget(enginePanel).target).toBe(container);

        const manualTarget = doc.getTransformableTarget(manual);
        expect(manualTarget.isChildPanel).toBe(false);
        expect(manualTarget.target).toBe(manual);
    });

    it('round-trips engineManaged on a manual panel', () => {
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Wzmocnienie', engineManaged: false });
        expect((panel as PanelModel).engineManaged).toBe(false);

        const restored = new ProjectDocument();
        restored.load(JSON.parse(JSON.stringify(doc.serialize())));
        const restoredPanel = restored.findNode(panel.id)!.domainData as PanelModel;
        expect(restoredPanel.engineManaged).toBe(false);
    });

    it('hydrates PART/ASSEMBLY through the registered factory registry', () => {
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok', materialId: 'H1180_ST37_18' });
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
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'X' });
        const json = JSON.parse(JSON.stringify(doc.serialize()));
        doc.load(json);
        expect(calls).toContain(panel.id);
    });

    it('should reset document to a clean empty project with reset()', () => {
        const container = doc.createAssembly({ name: 'Szafa' }) as ContainerModel;
        doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'Panel' }, container.id);
        expect(doc.getPanels()).toHaveLength(1);
        expect(doc.getContainers()).toHaveLength(1);
        expect(doc.isDirty()).toBe(true);

        let loadedEventFired = false;
        doc.onDocumentChanged((evt) => {
            if (evt.type === 'loaded') loadedEventFired = true;
        });

        doc.reset('MĂłj Nowy Projekt');

        expect(doc.name).toBe('MĂłj Nowy Projekt');
        expect(doc.rootNode.nodeType).toBe(NodeType.ROOM);
        expect(doc.rootNode.children).toHaveLength(0);
        expect(doc.getPanels()).toHaveLength(0);
        expect(doc.getContainers()).toHaveLength(0);
        expect(doc.isDirty()).toBe(false);
        expect(doc.activeEntity).toBeNull();
        expect(loadedEventFired).toBe(true);
    });

    it('throws when extension serialize fails instead of omitting the section', () => {
        doc.registerExtension('broken', {
            serialize: () => {
                throw new Error('boom-serialize');
            },
            load: () => {},
        });
        expect(() => doc.serialize()).toThrow(/serializacji rozszerzenia "broken"/);
    });

    it('throws when extension load fails instead of continuing', () => {
        doc.registerExtension('broken', {
            serialize: () => ({}),
            load: () => {
                throw new Error('boom-load');
            },
        });
        const json = doc.serialize();
        json.extensions = { ...(json.extensions || {}), broken: { x: 1 } };
        expect(() => doc.load(json)).toThrow(/wczytywania rozszerzenia "broken"/);
    });

    it('throws when domainData lacks toJSON during serialize', () => {
        const panel = doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'X' });
        const node = doc.findNode(panel.id)!;
        node.domainData = { type: 'part', id: panel.id } as any;
        expect(() => doc.serialize()).toThrow(/bez toJSON/);
    });

    it('throws when hydrator is missing for a node with domainData', () => {
        doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'X' });
        const json = JSON.parse(JSON.stringify(doc.serialize()));
        const bare = new ProjectDocument();
        (bare as any)._hydrators.delete(NodeType.PART);
        expect(() => bare.load(json)).toThrow(/brak hydratora dla nodeType "PART"/);
    });

    it('throws when hydrator itself fails', () => {
        doc.createPanel({ width: mmToNm(600), height: mmToNm(720), thickness: mmToNm(18), name: 'X' });
        const json = JSON.parse(JSON.stringify(doc.serialize()));
        doc.registerHydrator(NodeType.PART, () => {
            throw new Error('broken-hydrate');
        });
        expect(() => doc.load(json)).toThrow(/błąd hydratacji "PART"/);
    });

    it('serializes and hydrates NodeType.HARDWARE nodes (e.g. shelf pins, handles)', () => {
        const container = doc.createAssembly({ name: 'Szafka_Polki' }) as ContainerModel;
        const hwNode = CADNode.create(NodeType.HARDWARE, 'Podpórka 1 (Lewy Przód)', 'shelf_1_pin_LF');
        hwNode.domainData = HardwareModel.fromJSON({
            id: 'shelf_1_pin_LF',
            name: 'Podpórka 1 (Lewy Przód)',
            role: 'HARDWARE',
            hardwareType: 'SHELF_PIN',
            hardwareId: 'PODPORKA_FI5',
            side: 'left',
            loc: { x: -250, y: 100, z: 200 },
            params: { shelfIndex: 1, position: 'LF', side: 'left' },
            visible: true,
        });
        doc.addNode(container.id, hwNode);

        const serialized = JSON.parse(JSON.stringify(doc.serialize()));
        expect(serialized.rootNode).toBeDefined();

        const restored = new ProjectDocument();
        restored.load(serialized);

        const restoredHw = restored.findNode('shelf_1_pin_LF');
        expect(restoredHw).toBeDefined();
        expect(restoredHw!.nodeType).toBe(NodeType.HARDWARE);
        expect(restoredHw!.domainData).toBeInstanceOf(HardwareModel);
        expect((restoredHw!.domainData as HardwareModel).hardwareId).toBe('PODPORKA_FI5');
        expect((restoredHw!.domainData as HardwareModel).hardwareType).toBe('SHELF_PIN');
        expect((restoredHw!.domainData as HardwareModel).side).toBe('left');
    });

    it('addNode rejects duplicate node ID without mutating parent children', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const cntNode = doc.findNode(container.id);
        const initialChildrenCount = cntNode.children.length;
        const duplicateNode = new CADNode(container.id, 'Zdublowany węzeł', NodeType.PART);
        expect(() => {
            doc.addNode(cntNode.id, duplicateNode);
        }).toThrow(/duplicate node ID/i);
        expect(cntNode.children.length).toBe(initialChildrenCount);
        expect(duplicateNode.parent).toBeNull();
    });

    it('load preserves current document state if deserialization fails (rollback)', () => {
        const c1 = doc.createAssembly({ name: 'Oryginalna Szafa' });
        const originalDocId = doc.id;
        const originalName = doc.name;
        const corruptedData = {
            format: 'CAD_PROJECT',
            version: 4,
            rootNode: {
                id: 'root_room',
                name: 'Pokój',
                nodeType: 'ROOM',
                children: [
                    { id: 'broken_node', name: 'Zepsuty', nodeType: 'UNKNOWN_TYPE_THAT_THROWS' }
                ]
            }
        };
        expect(() => {
            doc.load(corruptedData);
        }).toThrow();
        expect(doc.id).toBe(originalDocId);
        expect(doc.name).toBe(originalName);
        expect(doc.findNode(c1.id)).toBeDefined();
    });

    it('addNode rejects duplicate node ID within subtree being added and leaves index clean', () => {
        const root = doc.rootNode;
        const initialCount = root.children.length;

        const branch = new CADNode('branch_node', 'Branch', NodeType.ASSEMBLY);
        const child1 = new CADNode('dup_child_id', 'Child 1', NodeType.PART);
        const child2 = new CADNode('dup_child_id', 'Child 2', NodeType.PART);
        branch.addChild(child1);
        branch.addChild(child2);

        expect(() => {
            doc.addNode(root.id, branch);
        }).toThrow(/within subtree being added/i);

        expect(root.children.length).toBe(initialCount);
        expect(branch.parent).toBeNull();
        expect(doc.findNode('branch_node')).toBeNull();
        expect(doc.findNode('dup_child_id')).toBeNull();
    });

    it('load rollback restores activeEntity and extension states when extension fails', () => {
        const c1 = doc.createAssembly({ name: 'Szafa Z Rozszerzeniem' });
        doc.setActiveEntity(c1);

        let extState = 'initial_state';
        doc.registerExtension('mock_ext', {
            serialize: () => ({ state: extState }),
            load: (data: any) => {
                if (data?.throwError) {
                    extState = 'corrupted_partial_state';
                    throw new Error('Awaria rozszerzenia!');
                }
                extState = data?.state ?? 'default';
            },
        });

        const originalDocId = doc.id;
        const originalActive = doc.activeEntity;

        const badData = {
            format: 'smartpanel-project',
            version: 4,
            domainUnit: 'nm',
            rootNode: { id: 'root_room', name: 'Pokój', nodeType: 'ROOM' },
            extensions: {
                mock_ext: { throwError: true },
            },
        };

        expect(() => {
            doc.load(badData);
        }).toThrow(/Awaria rozszerzenia!/i);

        // activeEntity zostało przywrócone
        expect(doc.activeEntity).toBe(originalActive);
        expect(doc.id).toBe(originalDocId);
        // Stan rozszerzenia został cofnięty
        expect(extState).toBe('initial_state');
    });

    it('aborts load before changing the document when an extension cannot be snapshotted', () => {
        const container = doc.createAssembly({ name: 'Stan przed load' });
        doc.registerExtension('unsnapshotable', {
            serialize: () => {
                throw new Error('snapshot unavailable');
            },
            load: () => {},
        });
        const originalId = doc.id;
        const data = {
            format: 'smartpanel-project',
            version: 4,
            domainUnit: 'nm',
            id: 'replacement',
            name: 'Nowy projekt',
            rootNode: { id: 'root_room', name: 'Pokój', nodeType: 'ROOM' },
        };

        expect(() => doc.load(data)).toThrow(/rozszerzenia "unsnapshotable".*snapshot unavailable/i);
        expect(doc.id).toBe(originalId);
        expect(doc.findNode(container.id)).not.toBeNull();
    });

    it('reports extension restoration failures during rollback', () => {
        let failEveryLoad = false;
        doc.registerExtension('unstable', {
            serialize: () => ({ state: 'saved' }),
            load: (data: any) => {
                if (failEveryLoad || data?.fail) {
                    throw new Error('restore failed');
                }
            },
        });
        const data = {
            format: 'smartpanel-project',
            version: 4,
            domainUnit: 'nm',
            rootNode: { id: 'root_room', name: 'Pokój', nodeType: 'ROOM' },
            extensions: { unstable: { fail: true } },
        };
        failEveryLoad = true;

        expect(() => doc.load(data)).toThrow(/rollback rozszerzeń nie powiódł się: "unstable": restore failed/i);
    });

    it('auto-promotes plain object domainData on NodeType.HARDWARE during serialize', () => {
        const container = doc.createAssembly({ name: 'Szafka_Polki' }) as ContainerModel;
        const hwNode = CADNode.create(NodeType.HARDWARE, 'Podpórka 1 (Prawy Tył)', 'shelf_1_pin_RB');
        // Surowy obiekt bez metody toJSON()
        hwNode.domainData = {
            id: 'shelf_1_pin_RB',
            name: 'Podpórka 1 (Prawy Tył)',
            role: 'HARDWARE',
            hardwareType: 'SHELF_PIN',
            hardwareId: 'PODPORKA_FI5',
        } as any;
        doc.addNode(container.id, hwNode);

        // Nie powinno rzucić błędu "domainData bez toJSON()"
        const serialized = JSON.parse(JSON.stringify(doc.serialize()));

        const restored = new ProjectDocument();
        restored.load(serialized);

        const restoredHw = restored.findNode('shelf_1_pin_RB');
        expect(restoredHw).toBeDefined();
        expect(restoredHw!.domainData).toBeInstanceOf(HardwareModel);
        expect((restoredHw!.domainData as HardwareModel).hardwareId).toBe('PODPORKA_FI5');
    });
});
