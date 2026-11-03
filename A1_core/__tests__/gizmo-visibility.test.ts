import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { ContextManager } from '../context-manager.js';
import { GizmoController } from '../gizmo-controller.js';
import { CADNode } from '../cad-node/cad-node.js';
import { NodeType } from '../cad-node/node-type.js';

describe('Gizmo Visibility Control', () => {
    let doc: ProjectDocument;
    let gizmoCtrl: GizmoController;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Gizmo Visibility Test' });
        ContextManager.instance.document = doc;
        gizmoCtrl = new GizmoController();
        ContextManager.instance.gizmoController = gizmoCtrl;
    });

    it('isEntityVisible returns true for visible panels and containers', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        expect(gizmoCtrl.isEntityVisible(panel)).toBe(true);
        expect(gizmoCtrl.isEntityVisible(container)).toBe(true);
    });

    it('isEntityVisible returns false when panel.visible is false', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: false };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        expect(gizmoCtrl.isEntityVisible(panel)).toBe(false);
    });

    it('isEntityVisible returns false when parent container is hidden', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        (container as any).visible = false;
        expect(gizmoCtrl.isEntityVisible(panel)).toBe(false);
    });

    it('isEntityVisible returns false when container.generatorParams.visible is false', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        (container as any).generatorParams = { visible: false };
        expect(gizmoCtrl.isEntityVisible(panel)).toBe(false);
    });

    it('isEntityVisible returns false when panel is frozen', () => {
        const container = doc.createAssembly({ name: 'Szafa' });
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true, frozen: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);

        expect(gizmoCtrl.isEntityVisible(panel)).toBe(false);
    });

    it('clearFaceGizmos resets all internal gizmo states', () => {
        gizmoCtrl.clearFaceGizmos();
        expect((gizmoCtrl as any).activeFaceGizmoSpheres).toEqual([]);
        expect((gizmoCtrl as any).activeGizmoSphere).toBeNull();
        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(false);
        expect((gizmoCtrl as any).isDraggingFaceGizmo).toBe(false);
    });

    it('hideGizmos callback in ContextManager calls clearFaceGizmos', () => {
        let cleared = false;
        const origClear = gizmoCtrl.clearFaceGizmos.bind(gizmoCtrl);
        gizmoCtrl.clearFaceGizmos = () => {
            cleared = true;
            origClear();
        };

        gizmoCtrl.init();
        expect(typeof ContextManager.instance.hideGizmos).toBe('function');
        ContextManager.instance.hideGizmos!();
        expect(cleared).toBe(true);
    });

    it('updateFaceGizmo is not blocked when activeTab is tab-a4-smartpanel or tab-s2-solver', () => {
        const origBabylon = (globalThis as any).BABYLON;
        (globalThis as any).BABYLON = {
            Vector3: class {
                constructor(public x=0, public y=0, public z=0) {}
                scale(s: number) { return new (globalThis as any).BABYLON.Vector3(this.x * s, this.y * s, this.z * s); }
                static Zero() { return new (globalThis as any).BABYLON.Vector3(); }
            },
            Color3: class { constructor(public r=0, public g=0, public b=0) {} },
            StandardMaterial: class { constructor() {} },
            PointerDragBehavior: class {
                useObjectOrientationForDragging = false;
                dragDeltaRatio = 1;
                onDragStartObservable = { add: () => {} };
                onDragObservable = { add: () => {} };
                onDragEndObservable = { add: () => {} };
            },
            ActionManager: class {
                registerAction() {}
                static OnPointerOverTrigger = 1;
                static OnPointerOutTrigger = 2;
                static OnPickTrigger = 3;
            },
            ExecuteCodeAction: class { constructor() {} },
            MeshBuilder: {
                CreateSphere: () => ({
                    position: { copyFrom: () => {}, addInPlace: () => {}, clone: () => ({}) },
                    setParent: () => {},
                    actionManager: null,
                    material: null,
                    addBehavior: () => {}
                })
            }
        };

        ContextManager.instance.viewport = { scene: {}, canvas: {}, camera: { detachControl: () => {}, attachControl: () => {} } } as any;
        const container = doc.createAssembly({ name: 'Szafa' });
        (container as any).generatorParams = { visible: true };
        const panel = { id: 'p1', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true };
        const panelNode = new CADNode(panel.id, panel.name, NodeType.PART);
        panelNode.domainData = panel as any;
        doc.addNode(container.id, panelNode);
        doc.setActiveEntity(panel as any);

        const mockView = {
            faceMeshes: {},
            root: {
                isEnabled: () => true,
                isVisible: true,
                computeWorldMatrix: () => {},
                getAbsolutePosition: () => ({ clone: () => ({ x: 0, y: 0, z: 0 }) }),
                position: { clone: () => ({ x: 0, y: 0, z: 0 }) }
            }
        };
        ContextManager.instance.panelViews.set(panel, mockView as any);

        ContextManager.instance.activeTab = 'tab-a4-smartpanel';
        gizmoCtrl.updateFaceGizmo();
        // Sprawdź czy kule zostały utworzone w activeFaceGizmoSpheres
        expect((gizmoCtrl as any).activeFaceGizmoSpheres.length).toBeGreaterThan(0);

        (gizmoCtrl as any).clearFaceGizmos();

        ContextManager.instance.activeTab = 'tab-s2-solver';
        gizmoCtrl.updateFaceGizmo();
        expect((gizmoCtrl as any).activeFaceGizmoSpheres.length).toBeGreaterThan(0);

        (gizmoCtrl as any).clearFaceGizmos();

        ContextManager.instance.activeTab = 'tab-c1-cnc';
        gizmoCtrl.updateFaceGizmo();
        // Na tab-c1-cnc kule NIE powstają (wczesny return)
        expect((gizmoCtrl as any).activeFaceGizmoSpheres.length).toBe(0);

        (globalThis as any).BABYLON = origBabylon;
    });

    it('switching active formatka resets isEditingFaceGizmo and creates gizmos even if sibling is frozen and offsets were modified', () => {
        const origBabylon = (globalThis as any).BABYLON;
        (globalThis as any).BABYLON = {
            Vector3: class {
                constructor(public x=0, public y=0, public z=0) {}
                scale(s: number) { return new (globalThis as any).BABYLON.Vector3(this.x * s, this.y * s, this.z * s); }
                normalize() { return this; }
                static Zero() { return new (globalThis as any).BABYLON.Vector3(); }
                static TransformNormal() { return new (globalThis as any).BABYLON.Vector3(1, 0, 0); }
            },
            Color3: class { constructor(public r=0, public g=0, public b=0) {} },
            StandardMaterial: class { constructor() {} },
            PointerDragBehavior: class {
                useObjectOrientationForDragging = false;
                dragDeltaRatio = 1;
                onDragStartObservable = { add: () => {} };
                onDragObservable = { add: () => {} };
                onDragEndObservable = { add: () => {} };
            },
            ActionManager: class {
                registerAction() {}
                static OnPointerOverTrigger = 1;
                static OnPointerOutTrigger = 2;
                static OnPickTrigger = 3;
            },
            ExecuteCodeAction: class { constructor() {} },
            MeshBuilder: {
                CreateSphere: () => ({
                    position: { copyFrom: () => {}, addInPlace: () => {}, clone: () => ({}) },
                    setParent: () => {},
                    actionManager: null,
                    material: null,
                    addBehavior: () => {}
                })
            }
        };

        ContextManager.instance.viewport = { scene: {}, canvas: {}, camera: { detachControl: () => {}, attachControl: () => {} } } as any;
        ContextManager.instance.activeTab = 'tab-a4-smartpanel';

        const container = doc.createAssembly({ name: 'Szafa' });
        (container as any).generatorParams = { typ_korpusu: 'korpus_standard', visible: true, offsets: {} };

        // Panel 1: zamrożony formatka referencyjna
        const panelFrozen = { id: 'p_frozen', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true, frozen: true };
        const nodeFrozen = new CADNode(panelFrozen.id, panelFrozen.name, NodeType.PART);
        nodeFrozen.domainData = panelFrozen as any;
        doc.addNode(container.id, nodeFrozen);

        // Panel 2: aktywna formatka do edycji
        const panelActive = { id: 'p_active', name: 'BokP', type: 'panel', role: 'RIGHT_SIDE_PANEL', visible: true };
        const nodeActive = new CADNode(panelActive.id, panelActive.name, NodeType.PART);
        nodeActive.domainData = panelActive as any;
        doc.addNode(container.id, nodeActive);

        const createMockMesh = () => ({
            computeWorldMatrix: () => {},
            getBoundingInfo: () => ({ boundingBox: { centerWorld: { x: 0, y: 0, z: 0 } } })
        });

        const mockViewActive = {
            faceMeshes: {
                FACE_X_PLUS: createMockMesh(),
                FACE_X_MINUS: createMockMesh(),
                FACE_Y_PLUS: createMockMesh(),
                FACE_Y_MINUS: createMockMesh(),
            },
            root: {
                isEnabled: () => true,
                isVisible: true,
                computeWorldMatrix: () => {},
                getWorldMatrix: () => ({}),
                getAbsolutePosition: () => ({ clone: () => ({ x: 0, y: 0, z: 0 }) }),
                position: { clone: () => ({ x: 0, y: 0, z: 0 }) }
            }
        };
        ContextManager.instance.panelViews.set(panelActive, mockViewActive as any);

        // Symulacja: użytkownik wcześniej modyfikował offset na innej formatce i flaga edycji została zablokowana
        (gizmoCtrl as any).isEditingFaceGizmo = true;
        (gizmoCtrl as any).activeGizmoContainer = container;

        // Użytkownik klika/aktywuje panelActive
        doc.setActiveEntity(panelActive as any);
        gizmoCtrl.updateFaceGizmo();

        // Flaga isEditingFaceGizmo została zresetowana, a gizma offsetów powstały
        expect((gizmoCtrl as any).isEditingFaceGizmo).toBe(false);
        expect((gizmoCtrl as any).activeFaceGizmoSpheres.length).toBeGreaterThan(0);

        (globalThis as any).BABYLON = origBabylon;
    });

    it('resolves outline side meshes with outlineEdgeKey for face gizmos', () => {
        const origBabylon = (globalThis as any).BABYLON;
        (globalThis as any).BABYLON = {
            Vector3: class {
                constructor(public x=0, public y=0, public z=0) {}
                scale(s: number) { return new (globalThis as any).BABYLON.Vector3(this.x * s, this.y * s, this.z * s); }
                normalize() { return this; }
                static Zero() { return new (globalThis as any).BABYLON.Vector3(); }
                static TransformNormal() { return new (globalThis as any).BABYLON.Vector3(1, 0, 0); }
            },
            Color3: class { constructor(public r=0, public g=0, public b=0) {} },
            StandardMaterial: class { constructor() {} },
            PointerDragBehavior: class {
                useObjectOrientationForDragging = false;
                dragDeltaRatio = 1;
                onDragStartObservable = { add: () => {} };
                onDragObservable = { add: () => {} };
                onDragEndObservable = { add: () => {} };
            },
            ActionManager: class {
                registerAction() {}
                static OnPointerOverTrigger = 1;
                static OnPointerOutTrigger = 2;
                static OnPickTrigger = 3;
            },
            ExecuteCodeAction: class { constructor() {} },
            MeshBuilder: {
                CreateSphere: () => ({
                    position: { copyFrom: () => {}, addInPlace: () => {}, clone: () => ({}) },
                    setParent: () => {},
                    actionManager: null,
                    material: null,
                    addBehavior: () => {}
                })
            }
        };

        ContextManager.instance.viewport = { scene: {}, canvas: {}, camera: { detachControl: () => {}, attachControl: () => {} } } as any;
        ContextManager.instance.activeTab = 'tab-a4-smartpanel';

        const container = doc.createAssembly({ name: 'Szafa' });
        (container as any).generatorParams = { typ_korpusu: 'korpus_standard', visible: true, offsets: {} };

        const panel = { id: 'p_outline', name: 'BokL', type: 'panel', role: 'LEFT_SIDE_PANEL', visible: true };
        const node = new CADNode(panel.id, panel.name, NodeType.PART);
        node.domainData = panel as any;
        doc.addNode(container.id, node);

        const createMockOutlineMesh = (edgeKey: string) => ({
            metadata: { outlineEdgeKey: edgeKey },
            computeWorldMatrix: () => {},
            getBoundingInfo: () => ({ boundingBox: { centerWorld: { x: 0, y: 0, z: 0 } } })
        });

        // Formatka outline: brak FACE_X_PLUS w kluczach, meshe nazwane OUTLINE_SIDE_0..3 z metadata.outlineEdgeKey
        const mockViewOutline = {
            faceMeshes: {
                OUTLINE_SIDE_0: createMockOutlineMesh('+X'),
                OUTLINE_SIDE_1: createMockOutlineMesh('-X'),
                OUTLINE_SIDE_2: createMockOutlineMesh('+Y'),
                OUTLINE_SIDE_3: createMockOutlineMesh('-Y'),
            },
            root: {
                isEnabled: () => true,
                isVisible: true,
                computeWorldMatrix: () => {},
                getWorldMatrix: () => ({}),
                getAbsolutePosition: () => ({ clone: () => ({ x: 0, y: 0, z: 0 }) }),
                position: { clone: () => ({ x: 0, y: 0, z: 0 }) }
            }
        };
        ContextManager.instance.panelViews.set(panel, mockViewOutline as any);

        doc.setActiveEntity(panel as any);
        gizmoCtrl.updateFaceGizmo();

        expect((gizmoCtrl as any).activeFaceGizmoSpheres.length).toBeGreaterThan(0);

        (globalThis as any).BABYLON = origBabylon;
    });
});
