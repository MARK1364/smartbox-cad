/**
 * Testy nakładki podświetlenia więzów (ConstraintHighlightOverlay) — strzałki normalnych.
 *
 * Uruchom: npx vitest run S2_solver/__tests__/constraint-highlight
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ConstraintStore } from '../constraint-store.js';
import { ConstraintHighlightOverlay } from '../constraint-highlight.js';
import { makeAnchor } from '../constraint-types.js';

describe('ConstraintHighlightOverlay — strzałki normalnych dla COPLANAR i FLUSH', () => {
    let createdMeshes: any[] = [];

    beforeEach(() => {
        createdMeshes = [];

        // Mock Babylon.js environment
        (globalThis as any).BABYLON = {
            PointerEventTypes: { POINTERMOVE: 4 },
            Color3: class {
                constructor(public r: number, public g: number, public b: number) {}
            },
            StandardMaterial: class {
                public diffuseColor: any;
                public emissiveColor: any;
                public alpha = 1;
                public backFaceCulling = true;
                public disableDepthWrite = false;
                public zOffset = 0;
                constructor(public name: string, public scene: any) {}
                dispose() {}
            },
            Vector3: class {
                constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}
                lengthSquared() {
                    return this.x * this.x + this.y * this.y + this.z * this.z;
                }
                normalize() {
                    const l = Math.hypot(this.x, this.y, this.z) || 1;
                    this.x /= l;
                    this.y /= l;
                    this.z /= l;
                    return this;
                }
                copyFrom(v: any) {
                    this.x = v.x;
                    this.y = v.y;
                    this.z = v.z;
                    return this;
                }
                static Cross(a: any, b: any) {
                    return new (globalThis as any).BABYLON.Vector3(
                        a.y * b.z - a.z * b.y,
                        a.z * b.x - a.x * b.z,
                        a.x * b.y - a.y * b.x,
                    );
                }
            },
            Matrix: class {
                static FromXYZAxesToRef = vi.fn();
            },
            Quaternion: {
                FromRotationMatrix: vi.fn(() => ({ x: 0, y: 0, z: 0, w: 1 })),
            },
            Mesh: {
                DOUBLESIDE: 2,
            },
            MeshBuilder: {
                CreatePlane: (name: string, opts: any, scene: any) => {
                    const mesh = {
                        name,
                        opts,
                        scene,
                        position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
                        rotationQuaternion: null,
                        material: null,
                        isPickable: true,
                        renderingGroupId: 0,
                        parent: null as any,
                        isVisible: true,
                        setEnabled: vi.fn(),
                        dispose: vi.fn(),
                    };
                    createdMeshes.push(mesh);
                    return mesh;
                },
                CreateCylinder: (name: string, opts: any, scene: any) => {
                    const mesh = {
                        name,
                        opts,
                        scene,
                        position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
                        rotation: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
                        rotationQuaternion: null,
                        material: null,
                        isPickable: true,
                        renderingGroupId: 0,
                        parent: null as any,
                        isVisible: true,
                        setEnabled: vi.fn(),
                        dispose: vi.fn(),
                    };
                    createdMeshes.push(mesh);
                    return mesh;
                },
                CreateTube: (name: string, opts: any, scene: any) => {
                    const mesh = {
                        name,
                        opts,
                        scene,
                        position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
                        rotation: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
                        rotationQuaternion: null,
                        material: null,
                        isPickable: true,
                        renderingGroupId: 0,
                        parent: null as any,
                        isVisible: true,
                        setEnabled: vi.fn(),
                        dispose: vi.fn(),
                    };
                    createdMeshes.push(mesh);
                    return mesh;
                },
                CreateSphere: (name: string, opts: any, scene: any) => {
                    const mesh = {
                        name,
                        opts,
                        scene,
                        position: { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
                        material: null,
                        isPickable: true,
                        renderingGroupId: 0,
                        parent: null as any,
                        isVisible: true,
                        setEnabled: vi.fn(),
                        dispose: vi.fn(),
                    };
                    createdMeshes.push(mesh);
                    return mesh;
                },
            },
        };

        const sceneMock = {
            pointerX: 100,
            pointerY: 100,
            pick: vi.fn(() => ({ hit: true, pickedPoint: { x: 50, y: 60, z: 70 } })),
            onAfterRenderObservable: {
                addOnce: (cb: () => void) => cb(),
            },
            onPointerObservable: {
                add: vi.fn((cb: any) => cb),
                remove: vi.fn(),
            },
        };

        const doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.viewport = { scene: sceneMock, requestRender: vi.fn() } as any;
        ConstraintStore.instance.clear();
        ConstraintHighlightOverlay.instance.clear();
    });

    afterEach(() => {
        ConstraintHighlightOverlay.instance.clear();
        delete (globalThis as any).BABYLON;
    });

    it('tworzy strzałki normalnych (trzonek i grot) dla relacji COPLANAR', () => {
        const doc = ContextManager.instance.document!;
        const panelA = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });
        const panelB = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });

        const constraint = ConstraintStore.instance.add({
            bindType: 'COPLANAR',
            anchorA: makeAnchor({
                nodeId: panelA.id,
                kind: 'FACE',
                faceName: 'FACE_Z_PLUS',
            }),
            anchorB: makeAnchor({
                nodeId: panelB.id,
                kind: 'FACE',
                faceName: 'FACE_Z_PLUS',
            }),
        });

        ConstraintHighlightOverlay.instance.setHighlighted([constraint.id]);
        (ConstraintHighlightOverlay.instance as any)._refreshNow();

        // 2 płaszczyzny (dla anchorA i anchorB)
        const planes = createdMeshes.filter((m) => m.name === 'solver_hl_face');
        expect(planes).toHaveLength(2);

        // Strzałki normalnych: po jednym trzonku i grocie dla każdej ściany
        const shafts = createdMeshes.filter((m) => m.name === 'solver_arrow_shaft');
        const heads = createdMeshes.filter((m) => m.name === 'solver_arrow_head');

        expect(shafts).toHaveLength(2);
        expect(heads).toHaveLength(2);

        // Upewniamy się, że strzałki są przypięte jako dzieci odpowiednich płaszczyzn i wskazują na zewnątrz (z > 0)
        expect(shafts[0].parent).toBe(planes[0]);
        expect(heads[0].parent).toBe(planes[0]);
        expect(shafts[1].parent).toBe(planes[1]);
        expect(heads[1].parent).toBe(planes[1]);

        expect(shafts[0].position.z).toBeGreaterThan(0);
        expect(heads[0].position.z).toBeGreaterThan(shafts[0].position.z);
    });

    it('tworzy strzałki normalnych dla relacji FLUSH, cofnięte tak, że grot styka się z płaszczyzną (z = 0)', () => {
        const doc = ContextManager.instance.document!;
        const panelA = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });
        const panelB = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });

        const constraint = ConstraintStore.instance.add({
            bindType: 'FLUSH',
            anchorA: makeAnchor({
                nodeId: panelA.id,
                kind: 'FACE',
                faceName: 'FACE_Z_PLUS',
            }),
            anchorB: makeAnchor({
                nodeId: panelB.id,
                kind: 'FACE',
                faceName: 'FACE_Z_MINUS',
            }),
        });

        ConstraintHighlightOverlay.instance.setHighlighted([constraint.id]);
        (ConstraintHighlightOverlay.instance as any)._refreshNow();

        const shafts = createdMeshes.filter((m) => m.name === 'solver_arrow_shaft');
        const heads = createdMeshes.filter((m) => m.name === 'solver_arrow_head');
        expect(shafts).toHaveLength(2);
        expect(heads).toHaveLength(2);

        // Dla FLUSH: grot ma czubek na z = 0 (środek stożka o wys 14 jest w z = -7, podstawa w z = -14)
        expect(heads[0].position.z).toBe(-7);
        expect(shafts[0].position.z).toBe(-30);
    });

    it('nie tworzy strzałek dla relacji narożnych (VERTEX)', () => {
        const doc = ContextManager.instance.document!;
        const panelA = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });
        const panelB = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });

        const constraint = ConstraintStore.instance.add({
            bindType: 'VERTEX',
            anchorA: makeAnchor({
                nodeId: panelA.id,
                kind: 'VERTEX',
                cornerIndex: 0,
            }),
            anchorB: makeAnchor({
                nodeId: panelB.id,
                kind: 'VERTEX',
                cornerIndex: 1,
            }),
        });

        ConstraintHighlightOverlay.instance.setHighlighted([constraint.id]);
        (ConstraintHighlightOverlay.instance as any)._refreshNow();

        const shafts = createdMeshes.filter((m) => m.name === 'solver_arrow_shaft');
        const heads = createdMeshes.filter((m) => m.name === 'solver_arrow_head');
        expect(shafts).toHaveLength(0);
        expect(heads).toHaveLength(0);

        const spheres = createdMeshes.filter((m) => m.name === 'solver_hl_pt');
        expect(spheres).toHaveLength(2);

        // Tworzy rurkę łączącą narożnik A i B (odległość 500 mm > 1 mm)
        const tubes = createdMeshes.filter((m) => m.name === 'solver_hl_vertex_tube');
        expect(tubes).toHaveLength(1);
    });

    it('nie tworzy rurki łączącej gdy narożniki idealnie się stykają (odległość < 1 mm)', () => {
        const doc = ContextManager.instance.document!;
        const panelA = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });
        const panelB = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });

        // Ten sam narożnik na obu panelach w (0,0,0) -> odległość 0 mm
        const constraint = ConstraintStore.instance.add({
            bindType: 'VERTEX',
            anchorA: makeAnchor({
                nodeId: panelA.id,
                kind: 'VERTEX',
                cornerIndex: 0,
            }),
            anchorB: makeAnchor({
                nodeId: panelB.id,
                kind: 'VERTEX',
                cornerIndex: 0,
            }),
        });

        ConstraintHighlightOverlay.instance.setHighlighted([constraint.id]);
        (ConstraintHighlightOverlay.instance as any)._refreshNow();

        const tubes = createdMeshes.filter((m) => m.name === 'solver_hl_vertex_tube');
        expect(tubes).toHaveLength(0);

        const spheres = createdMeshes.filter((m) => m.name === 'solver_hl_pt');
        expect(spheres).toHaveLength(2);
    });

    it('startVertexRubberBand buduje dynamiczną rurkę do pozycji kursora i usuwa ją w stopVertexRubberBand', () => {
        const doc = ContextManager.instance.document!;
        const panelA = doc.createPanel({ width: mmToNm(500), height: mmToNm(700), thickness: mmToNm(18) });

        const constraint = ConstraintStore.instance.add({
            bindType: 'VERTEX',
            anchorA: makeAnchor({
                nodeId: panelA.id,
                kind: 'VERTEX',
                cornerIndex: 0,
            }),
            anchorB: null,
        });

        ConstraintHighlightOverlay.instance.startVertexRubberBand(constraint.id);

        const rubberTubes = createdMeshes.filter((m) => m.name === 'solver_rubber_band_tube');
        expect(rubberTubes.length).toBeGreaterThanOrEqual(1);

        ConstraintHighlightOverlay.instance.stopVertexRubberBand();
        expect((ConstraintHighlightOverlay.instance as any)._rubberBandMesh).toBeNull();
    });
});
