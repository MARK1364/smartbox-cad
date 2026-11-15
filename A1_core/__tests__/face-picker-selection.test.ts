import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FacePicker } from '../face-picker.js';
import { ContextManager } from '../context-manager.js';

function setupBabylonMock() {
    class Color3 {
        constructor(public r = 0, public g = 0, public b = 0) {}
        static Black() { return new Color3(0, 0, 0); }
    }
    class Vector3 {
        constructor(public x = 0, public y = 0, public z = 0) {}
    }
    class Matrix {
        static Identity() { return {}; }
    }
    (globalThis as any).BABYLON = {
        Color3,
        Vector3,
        Matrix,
        PointerEventTypes: {
            POINTERMOVE: 1,
            POINTERDOWN: 2,
            POINTERUP: 4,
        },
    };
    if (typeof (globalThis as any).document === 'undefined') {
        (globalThis as any).document = { dispatchEvent: vi.fn() };
    }
}

function createKorpusAndPanelScene() {
    const container: any = {
        id: 'korpus-1',
        type: 'container',
        name: 'Korpus_1',
        visible: true,
    };
    const panel: any = {
        id: 'panel-1',
        type: 'part',
        name: 'Bok_L',
        visible: true,
        features: [],
    };
    const panel2: any = {
        id: 'panel-2',
        type: 'part',
        name: 'Bok_P',
        visible: true,
        features: [],
    };
    const containerNode: any = {
        id: 'korpus-1',
        nodeType: 'ASSEMBLY',
        domainData: container,
        parent: null,
    };
    const panelNode: any = {
        id: 'panel-1',
        nodeType: 'PART',
        domainData: panel,
        parent: containerNode,
    };
    const panel2Node: any = {
        id: 'panel-2',
        nodeType: 'PART',
        domainData: panel2,
        parent: containerNode,
    };

    let currentMesh: any = null;
    const makeFaceMesh = (id: string, p: any) => ({
        name: `FACE_FRONT_${id}`,
        isPickable: true,
        isVisible: true,
        isEnabled: () => true,
        isDisposed: () => false,
        material: {
            emissiveColor: { r: 0, g: 0, b: 0 },
            diffuseColor: { r: 0.8, g: 0.8, b: 0.8 },
        },
        metadata: {
            type: 'face',
            faceName: 'FACE_FRONT',
            panelModel: p,
            smartId: { uid: id, subType: 'face', subId: 'FACE_FRONT' },
        },
    });

    const faceMesh = makeFaceMesh('panel-1', panel);
    const faceMesh2 = makeFaceMesh('panel-2', panel2);
    currentMesh = faceMesh;

    const doc: any = {
        root: { id: 'root' },
        activeEntity: null as any,
        findNode: (id: string) =>
            id === 'panel-1' ? panelNode : id === 'panel-2' ? panel2Node : id === 'korpus-1' ? containerNode : null,
        setActiveEntity(entity: any) {
            this.activeEntity = entity;
        },
    };

    const makeHit = () => ({
        hit: true,
        distance: 10,
        pickedMesh: currentMesh,
        pickedPoint: { x: 0, y: 0, z: 0 },
        getNormal: () => ({ x: 0, y: 0, z: 1 }),
    });

    const scene: any = {
        pointerX: 100,
        pointerY: 100,
        activeCamera: {},
        onPointerObservable: { add: vi.fn() },
        pick: vi.fn((_x: number, _y: number, predicate?: (m: any) => boolean) => {
            if (!predicate || predicate(currentMesh)) {
                return makeHit();
            }
            return { hit: false };
        }),
        multiPick: vi.fn((_x: number, _y: number, predicate?: (m: any) => boolean) => {
            if (!predicate || predicate(currentMesh)) {
                return [makeHit()];
            }
            return [];
        }),
        createPickingRay: vi.fn(() => ({})),
        multiPickWithRay: vi.fn((_ray: any, predicate?: (m: any) => boolean) => {
            if (!predicate || predicate(currentMesh)) {
                return [makeHit()];
            }
            return [];
        }),
    };

    return {
        container,
        panel,
        panel2,
        faceMesh,
        faceMesh2,
        setCurrentMesh: (m: any) => { currentMesh = m; },
        doc,
        scene,
    };
}

describe('FacePicker korpus vs formatka selection (single click = korpus, double click = panel)', () => {
    beforeEach(() => {
        setupBabylonMock();
        const cm = ContextManager.instance;
        cm.activeTab = 'tab-a3-smartframe';
        cm.activeConstraintPicker = null;
        cm.activeReferencePicker = null;
        cm.containerViews = new Map();
        cm.panelViews = new Map();
        cm.gizmoController = null;
    });

    it('in object mode: single click ALWAYS selects korpus (even after another panel was active), double click activates panel', () => {
        const { container, panel, panel2, faceMesh2, setCurrentMesh, doc, scene } = createKorpusAndPanelScene();
        const picker = new FacePicker(scene, null, new Map(), doc);
        picker.selectionMode = 'object';

        picker.handlePointerDown(100, 100, { button: 0, detail: 1 });
        expect(doc.activeEntity).toBe(container);

        picker.handlePointerDown(100, 100, { button: 0, detail: 2 });
        expect(doc.activeEntity).toBe(panel);

        // Pojedyncze kliknięcie na inną formatkę w tym samym korpusie musi wrócić do korpusu
        setCurrentMesh(faceMesh2);
        picker.handlePointerDown(220, 100, { button: 0, detail: 1 });
        expect(doc.activeEntity).toBe(container);

        // Dopiero dwuklik aktywuje drugą formatkę
        picker.handlePointerDown(220, 100, { button: 0, detail: 2 });
        expect(doc.activeEntity).toBe(panel2);
    });

    it('in subgeometry mode: single click ALWAYS selects korpus, double click on same face activates panel without toggling off', () => {
        const { container, panel, panel2, faceMesh, faceMesh2, setCurrentMesh, doc, scene } = createKorpusAndPanelScene();
        ContextManager.instance.activeTab = 'tab-a4-smartpanel';
        const picker = new FacePicker(scene, null, new Map(), doc);
        picker.selectionMode = 'subgeometry';

        picker.handlePointerDown(100, 100, { button: 0, detail: 1 });
        expect(doc.activeEntity).toBe(container);
        expect(picker.selectedFace).toBe(faceMesh);

        picker.handlePointerDown(100, 100, { button: 0, detail: 2 });
        expect(doc.activeEntity).toBe(panel);

        // Pojedyncze kliknięcie na inną formatkę w tym samym korpusie musi aktywować korpus
        setCurrentMesh(faceMesh2);
        picker.handlePointerDown(220, 100, { button: 0, detail: 1 });
        expect(doc.activeEntity).toBe(container);

        picker.handlePointerDown(220, 100, { button: 0, detail: 2 });
        expect(doc.activeEntity).toBe(panel2);
    });
});
