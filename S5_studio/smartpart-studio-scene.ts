/**
 * A5_smartparts / studio — smartpart-studio-scene.ts
 * Scena 3D Babylon.js — wierne odwzorowanie stylu z głównej aplikacji CAD:
 *  - Tło jak w aplikacji CAD (jasne #ebeff2), oświetlenie i siatka podłoża
 *  - Kontener Główny SmartPart (objętość montażowa styku z korpusem)
 *  - Kolekcja kontenerów Parts (bryły 3D akcesoriów wewnątrz)
 *  - Walce (otwory) i sześciany (rewizje) z wizualizacją strefy wystającej poza kontener
 *  - Narzędzia Gizmo: Przesuwanie (Position Gizmo) i Rotacja (Rotation Gizmo)
 *  - Belka widoków: ISO, GÓRA, PRZÓD, BOK, Rzutowanie (Persp/Ortho), Reset
 *  - Przechwytywanie miniatury (ikony UI) z canvasu
 */

import { cadToRender, renderToCAD } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { CadTranslateGizmo } from '../A1_core/cad-translate-gizmo.js';
import {
    SmartPartPackageDefinition,
    SmartPartBodyItem,
    SmartPartCut,
    SmartPartHoleCut,
    SmartPartPocketCut,
} from './smartpart-studio-types.js';
import { cutOrientFromRefs, findPartForCut } from './smartpart-studio-types.js';
import { namedCameraView, type CameraUp } from '../S3_scena/named-camera-view.js';

declare const BABYLON: any;

/** Kolory osi CAD: X czerwony, Y (głęb.) zielony, Z (wys.) niebieski. */
const AXIS_FACE_COLOR = {
    X: { r: 0.92, g: 0.22, b: 0.22 },
    Y: { r: 0.18, g: 0.78, b: 0.35 },
    Z: { r: 0.22, g: 0.48, b: 0.95 },
} as const;

type ActiveWallRef = 'LEFT' | 'RIGHT' | 'FRONT' | 'BACK' | 'TOP' | 'BOTTOM';

function collectActiveWallRefs(def: SmartPartPackageDefinition): Set<ActiveWallRef> {
    const out = new Set<ActiveWallRef>();
    const add = (item: { refX?: string; refY?: string; refZ?: string } | null | undefined) => {
        if (!item) return;
        const rx = String(item.refX || '').toUpperCase();
        const ry = String(item.refY || '').toUpperCase();
        const rz = String(item.refZ || '').toUpperCase();
        if (rx === 'LEFT' || rx === 'RIGHT') out.add(rx);
        if (ry === 'FRONT' || ry === 'BACK') out.add(ry);
        if (rz === 'TOP' || rz === 'BOTTOM') out.add(rz);
    };
    // Tylko Party → ściany Kontenera Głównego (cięcia mają ref do Parta, nie do kontenera)
    for (const p of def.parts || []) add(p);
    if ((!def.parts || def.parts.length === 0) && def.partBody) add(def.partBody);
    return out;
}

/** CAD (x,y=głęb,z=wys) → pozycja Babylon (x, z, y). */
function cadPosToBabylon(xMm: number, yMm: number, zMm: number): { x: number; y: number; z: number } {
    const r = cadToRender(new Vec3(xMm, yMm, zMm));
    return { x: r.x, y: r.y, z: r.z };
}

export type CameraViewPreset = 'ISO' | 'TOP' | 'FRONT' | 'SIDE';
export type TransformToolMode = 'select' | 'translate' | 'rotate';

export interface TransformUpdateEvent {
    xMm: number;
    yMm: number;
    zMm: number;
    axis?: 'X' | 'Y' | 'Z';
}

export class SmartPartStudioScene {
    private canvas: HTMLCanvasElement;
    private engine: any = null;
    private scene: any = null;
    private camera: any = null;

    // Gizmo przesuwania / obrotu (jak główna aplikacja CAD — G i R)
    private cadTranslateGizmo: CadTranslateGizmo | null = null;
    private rotationGizmo: any = null;
    private currentTool: TransformToolMode = 'select';
    private _gizmoDragging = false;

    /** Pan narzędzie belki (jak Viewport.isPanToolActive) — LMB przesuwa widok */
    private isPanToolActive = false;
    private _pointerObserver: any = null;
    private _suppressContextMenuUntil = 0;
    private _lastCubeAlpha: number | null = null;
    private _lastCubeBeta: number | null = null;
    private _onCanvasContextMenu = (e: Event): void => {
        if (Date.now() < this._suppressContextMenuUntil) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    // Oświetlenie i podłoże CAD (jak w S3_scena/viewport.ts)
    private headlamp: any = null;
    private backlight: any = null;
    private groundMesh: any = null;
    private gridLinesMesh: any = null;

    // Meshe sceny
    private mainContainerMesh: any = null;
    private partMeshes: Map<string, any> = new Map();
    private cutMeshes: Map<string, any> = new Map();
    private selectedId: string | null = null;
    private lcsVisible = true;
    private mainLcsNode: any = null;
    private partLcsNodes: Map<string, any> = new Map();
    private cutLcsNodes: Map<string, any> = new Map();

    private currentDef: SmartPartPackageDefinition | null = null;
    private onSelectCallback?: (id: string) => void;
    private onTransformCallback?: (id: string, transform: TransformUpdateEvent) => void;
    /** Podświetlone ściany referencyjne kontenera głównego (wire + tint). */
    private refFaceMeshes: any[] = [];
    /** Materiał cienkich czarnych krawędzi (nieaktywne). */
    private edgeFrameMat: any = null;
    /** Materiał podświetlenia krawędzi aktywnego komponentu. */
    private edgeFrameSelectedMat: any = null;

    constructor(
        canvas: HTMLCanvasElement,
        onSelect?: (id: string) => void,
        onTransform?: (id: string, transform: TransformUpdateEvent) => void
    ) {
        this.canvas = canvas;
        this.onSelectCallback = onSelect;
        this.onTransformCallback = onTransform;
        this.initBabylon();
    }

    private initBabylon(): void {
        if (typeof BABYLON === 'undefined') {
            console.error('[SmartPartStudioScene] Brak Babylon.js w oknie przeglądarki.');
            return;
        }

        this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.scene = new BABYLON.Scene(this.engine);
        // Tło jak viewport aplikacji (S3_scena/viewport.ts)
        this.scene.clearColor = new BABYLON.Color4(0.92, 0.93, 0.95, 1.0);
        this.scene.ambientColor = new BABYLON.Color3(0.15, 0.15, 0.15);

        // Kamera ArcRotate — sterowanie jak w S3_scena/viewport (bez domyślnego LMB-orbit)
        this.camera = new BABYLON.ArcRotateCamera(
            'cad_studio_camera',
            -Math.PI / 4,
            Math.PI / 3,
            1200,
            new BABYLON.Vector3(0, 0, 0),
            this.scene
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.inertia = 0;
        this.camera.panningInertia = 0;
        this.camera.wheelPrecision = 2.0;
        this.camera.minZ = 1.0;
        this.camera.maxZ = 10000.0;
        this.camera.lowerRadiusLimit = 50;
        this.camera.upperRadiusLimit = 8000;

        // Wyłącz natywne LMB-obrót / scroll Babylon — własne gesty CAD poniżej
        if (this.camera.inputs?.attached?.pointers) {
            this.camera.inputs.remove(this.camera.inputs.attached.pointers);
        }
        if (this.camera.inputs?.attached?.mousewheel) {
            this.camera.inputs.remove(this.camera.inputs.attached.mousewheel);
        }
        this.initCadCameraControls();
        this.canvas.addEventListener('contextmenu', this._onCanvasContextMenu);

        // Oświetlenie CAD: Headlamp + Backlight dynamicznie podążające za kamerą (jak w S3_scena/viewport.ts)
        this.headlamp = new BABYLON.HemisphericLight(
            'cad_headlamp',
            new BABYLON.Vector3(0, 1, 0),
            this.scene
        );
        this.headlamp.intensity = 0.85;
        this.headlamp.specular = new BABYLON.Color3(0.05, 0.05, 0.05);

        this.backlight = new BABYLON.HemisphericLight(
            'cad_backlight',
            new BABYLON.Vector3(0, -1, 0),
            this.scene
        );
        this.backlight.intensity = 0.35;
        this.backlight.specular = new BABYLON.Color3(0, 0, 0);

        this.scene.registerBeforeRender(() => {
            if (this.camera && this.camera.position && this.camera.target) {
                const dir = this.camera.position.subtract(this.camera.target).normalize();
                this.headlamp.direction = dir;
                this.backlight.direction = dir.negate();
            }
            this._syncViewCube();
        });

        // Gizmo G (przesuń) + R (obróć) — jak główna aplikacja
        this.initCadTransformGizmos();

        // Pętla renderowania
        this.engine.runRenderLoop(() => {
            if (this.scene) {
                this.scene.render();
            }
        });

        window.addEventListener('resize', this.onResize);

        // Siatka podłoża jak w CAD
        this.buildCadGroundGrid();

        // LMB: zaznacz Part / wycięcie na scenie (preferuj cut nad Partem)
        this.scene.onPointerDown = (evt: any) => {
            if (this._gizmoDragging || this.isPanToolActive) return;
            if (evt?.button != null && evt.button !== 0) return;
            if (!this.onSelectCallback || !this.scene) return;
            const picks: any[] = this.scene.multiPick(this.scene.pointerX, this.scene.pointerY) || [];
            const withId = picks.filter((p) => p?.hit && p.pickedMesh?.metadata?.id);
            if (!withId.length) return;
            const prefer = (type: string) =>
                withId.find((p) => p.pickedMesh.metadata?.type === type);
            const hit =
                prefer('HOLE')
                || prefer('POCKET')
                || prefer('PART')
                || withId.find((p) => p.pickedMesh.metadata?.id === 'main_container')
                || withId[0];
            const meshId = hit?.pickedMesh?.metadata?.id;
            if (meshId) this.onSelectCallback(meshId);
        };
    }

    /**
     * Sterowanie kamerą 1:1 z głównym Viewport:
     *  - MMB = obrót, Shift+MMB / PPM-drag / side / narzędzie Pan = przesuwanie widoku
     *  - LMB bez Pan = wybór / gizmo (nie rusza całej sceny)
     *  - kółko = zoom
     */
    private initCadCameraControls(): void {
        if (!this.scene || !this.camera || typeof BABYLON === 'undefined') return;

        const rotationSensibility = 150;
        const panningSensibility = 0.15;
        const zoomSensibility = 0.15;
        const RMB_DRAG_THRESHOLD = 5;

        let isRotating = false;
        let isPanning = false;
        let isRmbPending = false;
        let isRmbPanning = false;
        let rmbStartX = 0;
        let rmbStartY = 0;
        let lastX = 0;
        let lastY = 0;

        const applyPan = (deltaX: number, deltaY: number) => {
            if (!this.camera || (deltaX === 0 && deltaY === 0)) return;
            const moveSpeed = this.camera.radius * panningSensibility * 0.01;
            const transformMatrix = this.camera.getViewMatrix();
            if (!transformMatrix?.m) return;
            const right = new BABYLON.Vector3(transformMatrix.m[0], transformMatrix.m[4], transformMatrix.m[8]);
            const up = new BABYLON.Vector3(transformMatrix.m[1], transformMatrix.m[5], transformMatrix.m[9]);
            this.camera.target.addInPlace(right.scale(-deltaX * moveSpeed)).addInPlace(up.scale(deltaY * moveSpeed));
        };

        this._pointerObserver = this.scene.onPointerObservable.add((pointerInfo: any) => {
            if (this._gizmoDragging || !this.camera) return;
            const evt = pointerInfo.event as PointerEvent | WheelEvent;

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                if (evt.button === 1) {
                    if ((evt as PointerEvent).shiftKey) {
                        isPanning = true;
                    } else {
                        isRotating = true;
                    }
                    lastX = this.scene.pointerX;
                    lastY = this.scene.pointerY;
                    evt.preventDefault();
                } else if (evt.button === 2) {
                    isRmbPending = true;
                    isRmbPanning = false;
                    rmbStartX = this.scene.pointerX;
                    rmbStartY = this.scene.pointerY;
                } else if (evt.button === 3 || evt.button === 4) {
                    isPanning = true;
                    lastX = this.scene.pointerX;
                    lastY = this.scene.pointerY;
                    evt.preventDefault();
                    evt.stopPropagation();
                } else if (evt.button === 0) {
                    if (this.isPanToolActive) {
                        isPanning = true;
                        lastX = this.scene.pointerX;
                        lastY = this.scene.pointerY;
                        evt.preventDefault();
                    } else if ((evt as PointerEvent).altKey) {
                        isRotating = true;
                        lastX = this.scene.pointerX;
                        lastY = this.scene.pointerY;
                        evt.preventDefault();
                    }
                }
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
                if (evt.button === 1 || evt.button === 3 || evt.button === 4) {
                    evt.preventDefault();
                } else if (evt.button === 2) {
                    if (isRmbPanning) {
                        this._suppressContextMenuUntil = Date.now() + 200;
                        evt.preventDefault();
                    }
                    isRmbPending = false;
                    isRmbPanning = false;
                }
                isRotating = false;
                isPanning = false;
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                if (isRmbPending || isRmbPanning) {
                    const dx = this.scene.pointerX - rmbStartX;
                    const dy = this.scene.pointerY - rmbStartY;
                    const dist = Math.hypot(dx, dy);
                    if (!isRmbPanning && dist > RMB_DRAG_THRESHOLD) {
                        isRmbPanning = true;
                        isRmbPending = false;
                        lastX = this.scene.pointerX;
                        lastY = this.scene.pointerY;
                    }
                    if (isRmbPanning) {
                        applyPan(this.scene.pointerX - lastX, this.scene.pointerY - lastY);
                        lastX = this.scene.pointerX;
                        lastY = this.scene.pointerY;
                    }
                }

                if (isRotating || isPanning) {
                    const deltaX = this.scene.pointerX - lastX;
                    const deltaY = this.scene.pointerY - lastY;
                    if (deltaX !== 0 || deltaY !== 0) {
                        if (isRotating) {
                            this.camera.alpha -= deltaX / rotationSensibility;
                            this.camera.beta -= deltaY / rotationSensibility;
                            const eps = 0.01;
                            this.camera.beta = Math.max(eps, Math.min(Math.PI - eps, this.camera.beta));
                        } else if (isPanning) {
                            applyPan(deltaX, deltaY);
                        }
                        lastX = this.scene.pointerX;
                        lastY = this.scene.pointerY;
                    }
                }
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
                const wheelEvt = evt as WheelEvent;
                const isZoomIn = wheelEvt.deltaY > 0;
                const zoomFactor = isZoomIn ? (1 - zoomSensibility) : (1 + zoomSensibility);
                let newRadius = this.camera.radius * zoomFactor;
                if (newRadius < this.camera.lowerRadiusLimit) newRadius = this.camera.lowerRadiusLimit;
                if (newRadius > this.camera.upperRadiusLimit) newRadius = this.camera.upperRadiusLimit;
                this.camera.radius = newRadius;
                wheelEvt.preventDefault?.();
            }
        });
    }

    /** Narzędzie Pan z belki — jak Viewport.setPanToolActive */
    public setPanToolActive(active: boolean): void {
        this.isPanToolActive = active;
        if (this.canvas) {
            this.canvas.style.cursor = active ? 'grab' : 'default';
        }
    }

    public togglePanTool(): boolean {
        this.setPanToolActive(!this.isPanToolActive);
        return this.isPanToolActive;
    }

    public getPanToolActive(): boolean {
        return this.isPanToolActive;
    }

    private initCadTransformGizmos(): void {
        if (!this.scene || typeof BABYLON === 'undefined') return;

        try {
            this.cadTranslateGizmo = new CadTranslateGizmo(this.scene);
            this.cadTranslateGizmo.setEnabled(false);
            this.cadTranslateGizmo.attachedNode = null;
            this.cadTranslateGizmo.onDragStart(() => { this._gizmoDragging = true; });
            this.cadTranslateGizmo.onDragEnd(() => {
                this._gizmoDragging = false;
                this.emitTransformFromGizmo();
            });
        } catch (e) {
            console.warn('[SmartPartStudioScene] CadTranslateGizmo:', e);
        }

        try {
            if (BABYLON.RotationGizmo) {
                this.rotationGizmo = new BABYLON.RotationGizmo();
                this.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
                this.rotationGizmo.attachedNode = null;
                const bindRot = (obs: any, fn: () => void) => {
                    obs?.add?.(fn);
                };
                for (const g of [this.rotationGizmo.xGizmo, this.rotationGizmo.yGizmo, this.rotationGizmo.zGizmo]) {
                    bindRot(g?.dragBehavior?.onDragStartObservable, () => { this._gizmoDragging = true; });
                    bindRot(g?.dragBehavior?.onDragEndObservable, () => { this._gizmoDragging = false; });
                }
            }
        } catch (e) {
            console.warn('[SmartPartStudioScene] RotationGizmo:', e);
        }
    }

    private emitTransformFromGizmo(): void {
        if (!this.selectedId || !this.onTransformCallback) return;

        const targetMesh = this.getSelectedMesh();
        if (!targetMesh) return;

        // Pivot walca = początek (LCS / utwierdzenie) — zapis bezpośrednio do xMm/yMm/zMm
        const localPos = targetMesh.position;
        const cad = renderToCAD(new Vec3(localPos.x, localPos.y, localPos.z));
        this.onTransformCallback(this.selectedId, {
            xMm: Math.round(cad.x),
            yMm: Math.round(cad.y),
            zMm: Math.round(cad.z),
        });
    }

    /**
     * Offset od początku (LCS) do środka bryły walca w przestrzeni Babylona.
     * center = origin + direction × (length/2) wzdłuż osi CAD.
     */
    private holeCenterOffsetFromOriginBabylon(hole: SmartPartHoleCut): { x: number; y: number; z: number } {
        const half = Math.max(1, hole.lengthMm) / 2;
        const { axis, direction } = cutOrientFromRefs(hole);
        const along = direction * half;
        if (axis === 'X') return { x: along, y: 0, z: 0 };
        if (axis === 'Y') return { x: 0, y: 0, z: along };
        return { x: 0, y: along, z: 0 };
    }

    private getSelectedMesh(): any {
        if (!this.selectedId) return null;
        if (this.selectedId === 'main_container') return this.mainContainerMesh;
        if (this.partMeshes.has(this.selectedId)) return this.partMeshes.get(this.selectedId);
        if (this.cutMeshes.has(this.selectedId)) return this.cutMeshes.get(this.selectedId);
        return null;
    }

    private clearGizmoAttachments(): void {
        if (this.cadTranslateGizmo) {
            this.cadTranslateGizmo.attachedNode = null;
            this.cadTranslateGizmo.setEnabled(false);
        }
        if (this.rotationGizmo) {
            this.rotationGizmo.attachedNode = null;
        }
    }

    private updateGizmoAttachment(): void {
        const targetMesh = this.getSelectedMesh();
        const canTransform =
            !!targetMesh
            && this.selectedId !== 'main_container'
            && (this.currentTool === 'translate' || this.currentTool === 'rotate');

        if (!canTransform) {
            this.clearGizmoAttachments();
            return;
        }

        if (this.currentTool === 'translate' && this.cadTranslateGizmo) {
            if (this.rotationGizmo) this.rotationGizmo.attachedNode = null;
            this.cadTranslateGizmo.attachedNode = targetMesh;
            this.cadTranslateGizmo.setEnabled(true);
            return;
        }

        if (this.currentTool === 'rotate' && this.rotationGizmo) {
            if (this.cadTranslateGizmo) {
                this.cadTranslateGizmo.attachedNode = null;
                this.cadTranslateGizmo.setEnabled(false);
            }
            this.rotationGizmo.attachedNode = targetMesh;
            return;
        }

        this.clearGizmoAttachments();
    }

    public setTransformTool(tool: TransformToolMode): void {
        this.currentTool = tool;
        this.updateGizmoAttachment();
    }

    public getTransformTool(): TransformToolMode {
        return this.currentTool;
    }

    private onResize = (): void => {
        if (this.engine) {
            this.engine.resize();
        }
    };

    /** Czarny materiał obrysu — ciągłe krawędzie (CreateTube), nie EdgesRenderer. */
    private getEdgeFrameMat(selected = false): any {
        if (selected) {
            if (this.edgeFrameSelectedMat) return this.edgeFrameSelectedMat;
            const mat = new BABYLON.StandardMaterial('studio_edge_frame_sel_mat', this.scene);
            // Klasyczny seledyn zaznaczenia
            mat.diffuseColor = new BABYLON.Color3(0.0, 0.95, 0.72);
            mat.emissiveColor = new BABYLON.Color3(0.05, 1.0, 0.78);
            mat.specularColor = new BABYLON.Color3(0, 0, 0);
            mat.disableLighting = true;
            mat.backFaceCulling = false;
            this.edgeFrameSelectedMat = mat;
            return mat;
        }
        if (this.edgeFrameMat) return this.edgeFrameMat;
        const mat = new BABYLON.StandardMaterial('studio_edge_frame_mat', this.scene);
        mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
        mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        this.edgeFrameMat = mat;
        return mat;
    }

    private edgeTubeRadius(sizeHint: number, selected: boolean): number {
        const base = Math.max(0.08, Math.min(0.32, sizeHint * 0.0015));
        // Seledyn ≈ ta sama grubość co czarne krawędzie Parta (minimalnie grubsze)
        return selected ? base * 1.15 : base;
    }

    /** 12 ciągłych czarnych krawędzi sześcianu (tubes) — bez przerywania. */
    private attachBoxEdgeFrame(
        parent: any,
        name: string,
        width: number,
        height: number,
        depth: number,
        selected: boolean,
    ): void {
        if (!this.scene || !parent) return;
        const hx = width / 2;
        const hy = height / 2;
        const hz = depth / 2;
        const c = [
            new BABYLON.Vector3(-hx, -hy, -hz),
            new BABYLON.Vector3(hx, -hy, -hz),
            new BABYLON.Vector3(hx, -hy, hz),
            new BABYLON.Vector3(-hx, -hy, hz),
            new BABYLON.Vector3(-hx, hy, -hz),
            new BABYLON.Vector3(hx, hy, -hz),
            new BABYLON.Vector3(hx, hy, hz),
            new BABYLON.Vector3(-hx, hy, hz),
        ];
        const edges: Array<[number, number]> = [
            [0, 1], [1, 2], [2, 3], [3, 0],
            [4, 5], [5, 6], [6, 7], [7, 4],
            [0, 4], [1, 5], [2, 6], [3, 7],
        ];
        const radius = this.edgeTubeRadius(Math.min(width, height, depth), selected);
        const mat = this.getEdgeFrameMat(selected);
        for (let i = 0; i < edges.length; i++) {
            const [a, b] = edges[i];
            const tube = BABYLON.MeshBuilder.CreateTube(`${name}_e${i}`, {
                path: [c[a], c[b]],
                radius,
                tessellation: 8,
                cap: BABYLON.Mesh.CAP_ALL,
            }, this.scene);
            tube.parent = parent;
            tube.material = mat;
            tube.isPickable = false;
            tube.renderingGroupId = selected ? 2 : 1;
            tube.metadata = { kind: 'edge_frame', selected };
        }
    }

    /** Obrys walca: dwa pierścienie + 4 tworzące (ciągłe czarne tubes). */
    private attachCylinderEdgeFrame(
        parent: any,
        name: string,
        diameter: number,
        height: number,
        selected: boolean,
    ): void {
        if (!this.scene || !parent) return;
        const r = diameter / 2;
        const hy = height / 2;
        const radius = this.edgeTubeRadius(Math.min(diameter, height), selected);
        const mat = this.getEdgeFrameMat(selected);
        const ringSegs = 48;
        const groupId = selected ? 2 : 1;

        const makeRing = (y: number, suffix: string) => {
            const path: any[] = [];
            for (let i = 0; i <= ringSegs; i++) {
                const a = (i / ringSegs) * Math.PI * 2;
                path.push(new BABYLON.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
            }
            const tube = BABYLON.MeshBuilder.CreateTube(`${name}_${suffix}`, {
                path,
                radius,
                tessellation: 8,
                cap: BABYLON.Mesh.CAP_ALL,
            }, this.scene);
            tube.parent = parent;
            tube.material = mat;
            tube.isPickable = false;
            tube.renderingGroupId = groupId;
            tube.metadata = { kind: 'edge_frame', selected };
        };
        makeRing(-hy, 'bot');
        makeRing(hy, 'top');

        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            const tube = BABYLON.MeshBuilder.CreateTube(`${name}_g${i}`, {
                path: [
                    new BABYLON.Vector3(x, -hy, z),
                    new BABYLON.Vector3(x, hy, z),
                ],
                radius,
                tessellation: 8,
                cap: BABYLON.Mesh.CAP_ALL,
            }, this.scene);
            tube.parent = parent;
            tube.material = mat;
            tube.isPickable = false;
            tube.renderingGroupId = groupId;
            tube.metadata = { kind: 'edge_frame', selected };
        }
    }

    /**
     * Buduje siatkę linii podłoża (bez szarej płaszczyzny).
     */
    private buildCadGroundGrid(bottomY: number = -60): void {
        if (this.groundMesh) {
            this.groundMesh.dispose();
            this.groundMesh = null;
        }
        if (this.gridLinesMesh) {
            this.gridLinesMesh.dispose();
            this.gridLinesMesh = null;
        }

        // Tylko linie siatki — bez szarego podłoża
        const gridLines: any[] = [];
        const gridSize = 400;
        const step = 20;
        for (let i = -gridSize; i <= gridSize; i += step) {
            gridLines.push([
                new BABYLON.Vector3(i, 0, -gridSize),
                new BABYLON.Vector3(i, 0, gridSize),
            ]);
            gridLines.push([
                new BABYLON.Vector3(-gridSize, 0, i),
                new BABYLON.Vector3(gridSize, 0, i),
            ]);
        }

        const grid = BABYLON.MeshBuilder.CreateLineSystem('cad_gridLines', {
            lines: gridLines,
        }, this.scene);
        grid.position.y = bottomY + 0.05;
        grid.color = new BABYLON.Color3(0.78, 0.80, 0.83);
        grid.alpha = 0.35;
        grid.isPickable = false;
        this.gridLinesMesh = grid;
    }

    /**
     * Aktualizacja sceny. Podczas drag gizmem nie przebudowujemy meshów.
     */
    public updateDefinition(def: SmartPartPackageDefinition, selectedId?: string | null): void {
        this.currentDef = def;
        this.selectedId = selectedId || null;
        if (!this.scene) return;

        if (this._gizmoDragging) {
            this.updateGizmoAttachment();
            return;
        }

        const halfH = Math.max(1, def.mainContainer.heightMm) / 2;
        const groundY = -halfH - 1.0;
        if (!this.gridLinesMesh || Math.abs((this.gridLinesMesh.position?.y ?? 0) - (groundY + 0.05)) > 0.5) {
            this.buildCadGroundGrid(groundY);
        }

        this.currentDef = def;
        this.renderMainContainer(def);
        this.renderParts(def);
        this.renderCuts(def);
        this.updateGizmoAttachment();
    }

    /**
     * 1. Kontener Główny SmartPart (objętość referencyjna do ścian korpusu)
     */
    private renderMainContainer(def: SmartPartPackageDefinition): void {
        if (this.mainContainerMesh) {
            this.mainContainerMesh.dispose();
            this.mainContainerMesh = null;
        }
        this.disposeRefFaceMeshes();

        const { widthMm, heightMm, depthMm } = def.mainContainer;
        this.mainContainerMesh = BABYLON.MeshBuilder.CreateBox('main_container_box', {
            width: Math.max(1, widthMm),
            height: Math.max(1, heightMm),
            depth: Math.max(1, depthMm),
        }, this.scene);

        this.mainContainerMesh.position = new BABYLON.Vector3(0, 0, 0);

        // Niewidoczny pick — ciągły czarny obrys tubes (bez przerywanego EdgesRenderer / wireframe)
        const mat = new BABYLON.StandardMaterial('main_container_mat', this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.60, 0.80, 0.96);
        mat.emissiveColor = new BABYLON.Color3(0.08, 0.16, 0.28);
        mat.alpha = 0;
        mat.disableDepthWrite = true;
        mat.backFaceCulling = false;
        this.mainContainerMesh.material = mat;
        this.mainContainerMesh.metadata = { id: 'main_container', kind: 'main_container' };
        // Niewidoczny gabaryt nie blokuje picka Partów / wycięć
        this.mainContainerMesh.isPickable = false;
        this.attachBoxEdgeFrame(
            this.mainContainerMesh,
            'main_container_edges',
            Math.max(1, widthMm),
            Math.max(1, heightMm),
            Math.max(1, depthMm),
            this.selectedId === 'main_container',
        );

        this.renderActiveRefFaces(def);

        this.disposeLcsNode(this.mainLcsNode);
        this.mainLcsNode = null;
        if (this.lcsVisible) {
            const axisLen = this.lcsAxisLengthMm(widthMm, heightMm, depthMm, 0.10, 14, 36);
            this.mainLcsNode = this.buildLcsNode(this.mainContainerMesh, 'main_lcs', axisLen, {
                origin: 'front-bottom',
                widthMm,
                heightMm,
                depthMm,
                positiveOnly: true,
            });
        }
    }

    private disposeRefFaceMeshes(): void {
        for (const m of this.refFaceMeshes) {
            try { m.dispose(); } catch { /* */ }
        }
        this.refFaceMeshes = [];
    }

    /**
     * Podświetla tylko ściany kontenera, na które wskazują aktywne ref Partów/cięć.
     * Kolor = oś CAD: X czerwień, Y (głęb.) zieleń, Z (wys.) niebieski.
     * Babylon: CreateBox width=X, height=CAD_Z, depth=CAD_Y.
     */
    private renderActiveRefFaces(def: SmartPartPackageDefinition): void {
        if (!this.scene || !this.mainContainerMesh) return;
        const active = collectActiveWallRefs(def);
        if (active.size === 0) return;

        const W = Math.max(1, def.mainContainer.widthMm);
        const H = Math.max(1, def.mainContainer.heightMm);
        const D = Math.max(1, def.mainContainer.depthMm);
        const t = Math.max(0.6, Math.min(2.2, Math.min(W, H, D) * 0.008));

        type FaceSpec = {
            wall: ActiveWallRef;
            axis: 'X' | 'Y' | 'Z';
            w: number; h: number; d: number;
            x: number; y: number; z: number;
        };
        const specs: FaceSpec[] = [];
        if (active.has('LEFT')) {
            specs.push({ wall: 'LEFT', axis: 'X', w: t, h: H, d: D, x: -W / 2, y: 0, z: 0 });
        }
        if (active.has('RIGHT')) {
            specs.push({ wall: 'RIGHT', axis: 'X', w: t, h: H, d: D, x: W / 2, y: 0, z: 0 });
        }
        // FRONT = CAD −Y → Babylon −Z; BACK = CAD +Y → Babylon +Z
        if (active.has('FRONT')) {
            specs.push({ wall: 'FRONT', axis: 'Y', w: W, h: H, d: t, x: 0, y: 0, z: -D / 2 });
        }
        if (active.has('BACK')) {
            specs.push({ wall: 'BACK', axis: 'Y', w: W, h: H, d: t, x: 0, y: 0, z: D / 2 });
        }
        // BOTTOM = CAD −Z → Babylon −Y; TOP = CAD +Z → Babylon +Y
        if (active.has('BOTTOM')) {
            specs.push({ wall: 'BOTTOM', axis: 'Z', w: W, h: t, d: D, x: 0, y: -H / 2, z: 0 });
        }
        if (active.has('TOP')) {
            specs.push({ wall: 'TOP', axis: 'Z', w: W, h: t, d: D, x: 0, y: H / 2, z: 0 });
        }

        for (const s of specs) {
            const col = AXIS_FACE_COLOR[s.axis];
            const face = BABYLON.MeshBuilder.CreateBox(`ref_face_${s.wall}`, {
                width: s.w, height: s.h, depth: s.d,
            }, this.scene);
            face.position = new BABYLON.Vector3(s.x, s.y, s.z);
            face.parent = this.mainContainerMesh;
            face.isPickable = false;
            face.renderingGroupId = 1;
            face.enableEdgesRendering();
            face.edgesWidth = 3.2;
            face.edgesColor = new BABYLON.Color4(col.r, col.g, col.b, 1.0);

            const fmat = new BABYLON.StandardMaterial(`ref_face_mat_${s.wall}`, this.scene);
            fmat.diffuseColor = new BABYLON.Color3(col.r, col.g, col.b);
            fmat.emissiveColor = new BABYLON.Color3(col.r * 0.55, col.g * 0.55, col.b * 0.55);
            fmat.alpha = 0.16;
            fmat.backFaceCulling = false;
            fmat.disableDepthWrite = true;
            face.material = fmat;
            face.metadata = { id: 'main_container', kind: 'ref_face', wall: s.wall };
            this.refFaceMeshes.push(face);
        }
    }

    /**
     * 2. Kolekcja Kontenerów Parts (bryły wewnątrz kontenera głównego)
     */
    private renderParts(def: SmartPartPackageDefinition): void {
        for (const m of this.partMeshes.values()) {
            m.dispose();
        }
        this.partMeshes.clear();
        for (const n of this.partLcsNodes.values()) {
            this.disposeLcsNode(n);
        }
        this.partLcsNodes.clear();

        const partsList = Array.isArray(def.parts) && def.parts.length > 0
            ? def.parts
            : def.partBody
                ? [def.partBody]
                : [];

        for (const part of partsList) {
            this.renderSinglePart(part);
        }
    }

    private renderSinglePart(part: SmartPartBodyItem): void {
        const isSelected = this.selectedId === part.id;
        const box = BABYLON.MeshBuilder.CreateBox(`part_${part.id}`, {
            width: Math.max(1, part.widthMm),
            height: Math.max(1, part.heightMm),
            depth: Math.max(1, part.depthMm),
        }, this.scene);

        const bp = cadPosToBabylon(part.xMm, part.yMm, part.zMm);
        box.position = new BABYLON.Vector3(bp.x, bp.y, bp.z);

        const isFrozen = part.frozen === true;
        const mat = new BABYLON.StandardMaterial(`part_mat_${part.id}`, this.scene);
        const col = BABYLON.Color3.FromHexString(part.colorHex || '#38bdf8');
        // Zamrożony Part (panel → Zamroź): duch / bez wycięć CNC
        mat.diffuseColor = isFrozen ? new BABYLON.Color3(0.35, 0.45, 0.55) : col;
        mat.emissiveColor = isFrozen
            ? new BABYLON.Color3(0.08, 0.22, 0.32)
            : (isSelected ? col.scale(0.35) : col.scale(0.12));
        mat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.35);
        mat.alpha = isFrozen ? 0.28 : 0.95;
        mat.wireframe = isFrozen;
        box.material = mat;
        box.metadata = { id: part.id, type: 'PART', frozen: isFrozen };
        box.isPickable = true;
        const parentSet = this.currentDef?.sets?.find((s) => s.id === part.setId);
        const isSetVisible = parentSet ? parentSet.visible !== false : true;
        box.setEnabled(part.visible !== false && isSetVisible);
        this.attachBoxEdgeFrame(
            box,
            `part_edges_${part.id}`,
            Math.max(1, part.widthMm),
            Math.max(1, part.heightMm),
            Math.max(1, part.depthMm),
            isSelected,
        );

        this.partMeshes.set(part.id, box);

        if (this.lcsVisible) {
            const axisLen = this.lcsAxisLengthMm(part.widthMm, part.heightMm, part.depthMm, 0.22, 10, 28);
            const lcs = this.buildLcsNode(box, `part_lcs_${part.id}`, axisLen, {
                origin: 'front-bottom',
                widthMm: part.widthMm,
                heightMm: part.heightMm,
                depthMm: part.depthMm,
                positiveOnly: true,
            });
            this.partLcsNodes.set(part.id, lcs);
        }
    }

    /** Długość osi LCS proporcjonalna do gabarytu kontenera [mm]. */
    private lcsAxisLengthMm(w: number, h: number, d: number, factor: number, minMm: number, maxMm: number): number {
        const m = Math.min(Math.max(1, w), Math.max(1, h), Math.max(1, d));
        return Math.max(minMm, Math.min(maxMm, m * factor));
    }

    private disposeLcsNode(node: any): void {
        if (!node) return;
        try {
            node.dispose(false, true);
        } catch {
            /* ignore */
        }
    }

    /**
     * LCS w etykietach CAD: X=szer., Y=głęb., Z=wysokość.
     * W Babylon: X→X, CAD Y→Z, CAD Z→Y (jak cadToRender) — Z zawsze w górę.
     */
    private buildLcsNode(
        parent: any,
        namePrefix: string,
        axesLength: number,
        opts?: {
            /** front-bottom: kontener/Part; front-center: walec/sześcian; center: środek */
            origin?: 'center' | 'front-bottom' | 'front-center';
            widthMm?: number;
            heightMm?: number;
            depthMm?: number;
            /** Tylko +X/+Y/+Z (czytelniej na ścianie) */
            positiveOnly?: boolean;
        },
    ): any {
        if (!this.scene || !parent || typeof BABYLON === 'undefined') return null;

        const origin = opts?.origin ?? 'center';
        const positiveOnly = opts?.positiveOnly ?? (origin !== 'center');
        const h = Math.max(1, opts?.heightMm ?? 0);
        const d = Math.max(1, opts?.depthMm ?? 0);

        const root = new BABYLON.TransformNode(`${namePrefix}_root`, this.scene);
        root.parent = parent;
        root.rotation.set(0, 0, 0);
        // Nie dziedzicz rotacji walca — układ CAD: Z = wysokość (Babylon +Y)
        if (root.rotationQuaternion) root.rotationQuaternion = null;
        if (origin === 'front-bottom') {
            // FRONT (−Y) + BOTTOM (−Z) → Bab: z=−D/2, y=−H/2
            root.position = new BABYLON.Vector3(0, -h / 2, -d / 2);
        } else if (origin === 'front-center') {
            // FRONT (−Y), centrum ściany → Bab: z=−D/2, y=0
            root.position = new BABYLON.Vector3(0, 0, -d / 2);
        } else {
            root.position = new BABYLON.Vector3(0, 0, 0);
        }
        root.metadata = { type: 'lcs', pickable: false };

        const thickness = Math.max(0.45, Math.min(1.2, axesLength * 0.028));
        const headH = Math.max(2.5, axesLength * 0.09);
        const labelSize = Math.max(5, axesLength * 0.10);

        /** dir = kierunek w przestrzeni Babylon; label = nazwa osi CAD */
        const createAxis = (
            name: string,
            color: any,
            dir: 'X' | 'Y' | 'Z',
            label: string,
            hexColor: string,
            length = axesLength,
        ) => {
            const mat = new BABYLON.StandardMaterial(`${namePrefix}_${name}_Mat`, this.scene);
            mat.diffuseColor = color;
            mat.emissiveColor = color;
            mat.alpha = 1.0;
            mat.disableDepthWrite = true;
            mat.backFaceCulling = false;

            const placeAlong = (mesh: any, sign: 1 | -1) => {
                const half = (length / 2) * sign;
                const tip = length * sign;
                if (dir === 'X') {
                    mesh.rotation.z = -Math.PI / 2;
                    mesh.position.x = half;
                } else if (dir === 'Z') {
                    // Babylon Z = CAD Y (głębokość)
                    mesh.rotation.x = Math.PI / 2;
                    mesh.position.z = half;
                } else {
                    // Babylon Y = CAD Z (wysokość)
                    mesh.position.y = half;
                }
                return tip;
            };

            const cylPos = BABYLON.MeshBuilder.CreateCylinder(`${namePrefix}_${name}_pos`, {
                height: length,
                diameter: thickness,
                tessellation: 12,
            }, this.scene);
            cylPos.material = mat;
            cylPos.renderingGroupId = 2;
            cylPos.isPickable = false;
            placeAlong(cylPos, 1);
            cylPos.parent = root;

            if (!positiveOnly) {
                const cylNeg = BABYLON.MeshBuilder.CreateCylinder(`${namePrefix}_${name}_neg`, {
                    height: length,
                    diameter: thickness,
                    tessellation: 12,
                }, this.scene);
                cylNeg.material = mat;
                cylNeg.renderingGroupId = 2;
                cylNeg.isPickable = false;
                placeAlong(cylNeg, -1);
                cylNeg.parent = root;
            }

            const cone = BABYLON.MeshBuilder.CreateCylinder(`${namePrefix}_${name}_head`, {
                height: headH,
                diameterTop: 0,
                diameterBottom: thickness * 3.2,
                tessellation: 12,
            }, this.scene);
            cone.material = mat;
            cone.renderingGroupId = 2;
            cone.isPickable = false;
            if (dir === 'X') {
                cone.rotation.z = -Math.PI / 2;
                cone.position.x = length;
            } else if (dir === 'Z') {
                cone.rotation.x = Math.PI / 2;
                cone.position.z = length;
            } else {
                cone.position.y = length;
            }
            cone.parent = root;

            const makeLabel = (text: string, posOffset: any) => {
                const plane = BABYLON.MeshBuilder.CreatePlane(`${namePrefix}_lbl_${text}`, { size: labelSize }, this.scene);
                plane.position = posOffset;
                plane.parent = root;
                plane.renderingGroupId = 2;
                plane.isPickable = false;
                plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
                const dt = new BABYLON.DynamicTexture(`${namePrefix}_dt_${text}`, { width: 64, height: 64 }, this.scene, false);
                dt.hasAlpha = true;
                dt.drawText(text, null, 42, 'bold 36px Arial', hexColor, 'transparent', true);
                const matText = new BABYLON.StandardMaterial(`${namePrefix}_matText_${text}`, this.scene);
                matText.diffuseTexture = dt;
                matText.emissiveColor = new BABYLON.Color3(1, 1, 1);
                matText.disableDepthWrite = true;
                matText.backFaceCulling = false;
                plane.material = matText;
            };

            const lblDist = length + labelSize * 0.7;
            if (dir === 'X') {
                makeLabel(`+${label}`, new BABYLON.Vector3(lblDist, 0, 0));
                if (!positiveOnly) makeLabel(`-${label}`, new BABYLON.Vector3(-lblDist, 0, 0));
            } else if (dir === 'Y') {
                // Babylon Y = CAD Z
                makeLabel(`+${label}`, new BABYLON.Vector3(0, lblDist, 0));
                if (!positiveOnly) makeLabel(`-${label}`, new BABYLON.Vector3(0, -lblDist, 0));
            } else {
                // Babylon Z = CAD Y
                makeLabel(`+${label}`, new BABYLON.Vector3(0, 0, lblDist));
                if (!positiveOnly) makeLabel(`-${label}`, new BABYLON.Vector3(0, 0, -lblDist));
            }
        };

        // CAD: X czerwień, Y (głęb.) zieleń → Bab Z, Z (wys.) niebieski → Bab Y
        createAxis('X', new BABYLON.Color3(1.0, 0.1, 0.1), 'X', 'X', '#ff2222');
        createAxis('Y', new BABYLON.Color3(0.1, 0.9, 0.1), 'Z', 'Y', '#22ff22');
        // Z = wysokość — nieco dłuższa, żeby było widać od razu
        createAxis('Z', new BABYLON.Color3(0.1, 0.4, 1.0), 'Y', 'Z', '#2266ff', axesLength * 1.1);

        root.setEnabled(this.lcsVisible);
        return root;
    }

    private rebuildAllLcs(): void {
        this.disposeLcsNode(this.mainLcsNode);
        this.mainLcsNode = null;
        for (const n of this.partLcsNodes.values()) this.disposeLcsNode(n);
        this.partLcsNodes.clear();
        for (const n of this.cutLcsNodes.values()) this.disposeLcsNode(n);
        this.cutLcsNodes.clear();

        if (!this.lcsVisible || !this.currentDef) return;

        if (this.mainContainerMesh) {
            const { widthMm, heightMm, depthMm } = this.currentDef.mainContainer;
            const axisLen = this.lcsAxisLengthMm(widthMm, heightMm, depthMm, 0.10, 14, 36);
            this.mainLcsNode = this.buildLcsNode(this.mainContainerMesh, 'main_lcs', axisLen, {
                origin: 'front-bottom',
                widthMm,
                heightMm,
                depthMm,
                positiveOnly: true,
            });
        }

        const partsList = Array.isArray(this.currentDef.parts) && this.currentDef.parts.length > 0
            ? this.currentDef.parts
            : this.currentDef.partBody
                ? [this.currentDef.partBody]
                : [];

        for (const part of partsList) {
            const mesh = this.partMeshes.get(part.id);
            if (!mesh) continue;
            const axisLen = this.lcsAxisLengthMm(part.widthMm, part.heightMm, part.depthMm, 0.22, 10, 28);
            this.partLcsNodes.set(part.id, this.buildLcsNode(mesh, `part_lcs_${part.id}`, axisLen, {
                origin: 'front-bottom',
                widthMm: part.widthMm,
                heightMm: part.heightMm,
                depthMm: part.depthMm,
                positiveOnly: true,
            }));
        }

        for (const cut of this.currentDef.cuts || []) {
            this.attachCutLcs(cut);
        }
    }

    /**
     * LCS walca/sześcianu na licu utwierdzenia.
     * Z = oś wysuwu (direction na zewnątrz) — bez zmian.
     * X/Y = baza ortonormalna w płaszczyźnie lica (prawoskrętna: Y = Z × X).
     */
    private buildHoleCadLcs(
        pivot: any,
        namePrefix: string,
        axesLength: number,
        orient: { axis: 'X' | 'Y' | 'Z'; direction: 1 | -1 },
    ): any {
        if (!this.scene || !pivot || typeof BABYLON === 'undefined') return null;

        const root = new BABYLON.TransformNode(`${namePrefix}_root`, this.scene);
        root.parent = pivot;
        root.position = new BABYLON.Vector3(0, 0, 0);
        root.rotation.set(0, 0, 0);
        if (root.rotationQuaternion) root.rotationQuaternion = null;
        root.metadata = { type: 'lcs', pickable: false };

        const thickness = Math.max(0.45, Math.min(1.2, axesLength * 0.028));
        const headH = Math.max(2.5, axesLength * 0.09);
        const labelSize = Math.max(5, axesLength * 0.10);
        const zLen = axesLength * 1.15;
        const d = orient.direction >= 0 ? 1 : -1;
        // Z = oś wysuwu (walec/sześcian), Bab: X=CAD_X, Y=CAD_Z, Z=CAD_Y
        const zDir =
            orient.axis === 'X' ? { x: d, y: 0, z: 0 }
            : orient.axis === 'Y' ? { x: 0, y: 0, z: d }
            : { x: 0, y: d, z: 0 };

        // Preferuj CAD wysokość (Bab +Y) jako X; gdy Z || wysokość → CAD szer. (Bab +X)
        const preferUp = { x: 0, y: 1, z: 0 };
        const preferWidth = { x: 1, y: 0, z: 0 };
        const zDotUp = zDir.x * preferUp.x + zDir.y * preferUp.y + zDir.z * preferUp.z;
        const xRef = Math.abs(zDotUp) > 0.99 ? preferWidth : preferUp;
        // X = normalize(ref − (ref·Z)Z), potem Y = Z × X (prawoskrętny)
        const xProj = xRef.x * zDir.x + xRef.y * zDir.y + xRef.z * zDir.z;
        let xDir = {
            x: xRef.x - xProj * zDir.x,
            y: xRef.y - xProj * zDir.y,
            z: xRef.z - xProj * zDir.z,
        };
        const xLen = Math.hypot(xDir.x, xDir.y, xDir.z) || 1;
        xDir = { x: xDir.x / xLen, y: xDir.y / xLen, z: xDir.z / xLen };
        // Y = −(Z × X) — odbicie względem prawoskrętnego iloczynu, klasyczny układ na licu
        const yCross = {
            x: zDir.y * xDir.z - zDir.z * xDir.y,
            y: zDir.z * xDir.x - zDir.x * xDir.z,
            z: zDir.x * xDir.y - zDir.y * xDir.x,
        };
        const yDir = { x: -yCross.x, y: -yCross.y, z: -yCross.z };

        type AxisDef = {
            name: string;
            label: string;
            color: any;
            hex: string;
            /** Jednostkowy kierunek w przestrzeni pivota (Babylon) */
            dir: { x: number; y: number; z: number };
            length: number;
        };

        const axes: AxisDef[] = [
            { name: 'X', label: 'X', color: new BABYLON.Color3(1.0, 0.1, 0.1), hex: '#ff2222', dir: xDir, length: axesLength },
            { name: 'Y', label: 'Y', color: new BABYLON.Color3(0.1, 0.9, 0.1), hex: '#22ff22', dir: yDir, length: axesLength },
            { name: 'Z', label: 'Z', color: new BABYLON.Color3(0.1, 0.4, 1.0), hex: '#2266ff', dir: zDir, length: zLen },
        ];

        for (const ax of axes) {
            const mat = new BABYLON.StandardMaterial(`${namePrefix}_${ax.name}_Mat`, this.scene);
            mat.diffuseColor = ax.color;
            mat.emissiveColor = ax.color;
            mat.disableDepthWrite = true;
            mat.backFaceCulling = false;

            const shaft = BABYLON.MeshBuilder.CreateCylinder(`${namePrefix}_${ax.name}_shaft`, {
                height: ax.length,
                diameter: thickness,
                tessellation: 12,
            }, this.scene);
            shaft.material = mat;
            shaft.renderingGroupId = 2;
            shaft.isPickable = false;
            shaft.parent = root;
            // Domyślny walec wzdłuż +Y → ustaw na ax.dir (przestrzeń pivota = CAD)
            if (ax.dir.x === 1) shaft.rotation.z = -Math.PI / 2;
            else if (ax.dir.x === -1) shaft.rotation.z = Math.PI / 2;
            else if (ax.dir.z === 1) shaft.rotation.x = Math.PI / 2;
            else if (ax.dir.z === -1) shaft.rotation.x = -Math.PI / 2;
            else if (ax.dir.y === -1) shaft.rotation.x = Math.PI;
            else shaft.rotation.set(0, 0, 0);
            shaft.position = new BABYLON.Vector3(
                ax.dir.x * ax.length / 2,
                ax.dir.y * ax.length / 2,
                ax.dir.z * ax.length / 2,
            );

            const cone = BABYLON.MeshBuilder.CreateCylinder(`${namePrefix}_${ax.name}_head`, {
                height: headH,
                diameterTop: 0,
                diameterBottom: thickness * 3.2,
                tessellation: 12,
            }, this.scene);
            cone.material = mat;
            cone.renderingGroupId = 2;
            cone.isPickable = false;
            cone.parent = root;
            if (ax.dir.x === 1) cone.rotation.z = -Math.PI / 2;
            else if (ax.dir.x === -1) cone.rotation.z = Math.PI / 2;
            else if (ax.dir.z === 1) cone.rotation.x = Math.PI / 2;
            else if (ax.dir.z === -1) cone.rotation.x = -Math.PI / 2;
            else if (ax.dir.y === -1) cone.rotation.x = Math.PI;
            else cone.rotation.set(0, 0, 0);
            cone.position = new BABYLON.Vector3(
                ax.dir.x * ax.length,
                ax.dir.y * ax.length,
                ax.dir.z * ax.length,
            );

            const plane = BABYLON.MeshBuilder.CreatePlane(`${namePrefix}_lbl_${ax.label}`, { size: labelSize }, this.scene);
            const lblDist = ax.length + labelSize * 0.7;
            plane.position = new BABYLON.Vector3(ax.dir.x * lblDist, ax.dir.y * lblDist, ax.dir.z * lblDist);
            plane.parent = root;
            plane.renderingGroupId = 2;
            plane.isPickable = false;
            plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            const dt = new BABYLON.DynamicTexture(`${namePrefix}_dt_${ax.label}`, { width: 64, height: 64 }, this.scene, false);
            dt.hasAlpha = true;
            dt.drawText(`+${ax.label}`, null, 42, 'bold 36px Arial', ax.hex, 'transparent', true);
            const matText = new BABYLON.StandardMaterial(`${namePrefix}_matText_${ax.label}`, this.scene);
            matText.diffuseTexture = dt;
            matText.emissiveColor = new BABYLON.Color3(1, 1, 1);
            matText.disableDepthWrite = true;
            matText.backFaceCulling = false;
            plane.material = matText;
        }

        root.setEnabled(this.lcsVisible);
        return root;
    }

    /**
     * LCS cięcia na pivotcie (bez rotacji mesha) — CAD Z = wysokość (Babylon +Y).
     * Walec: środek koła (lico wejścia wg direction), nie bok walca.
     * Sześcian: środek ściany przedniej (−Y).
     */
    private attachCutLcs(cut: SmartPartHoleCut | SmartPartPocketCut | SmartPartCut): void {
        if (!this.lcsVisible || !this.scene) return;
        const pivot = this.cutMeshes.get(cut.id);
        if (!pivot) return;

        if (cut.type === 'HOLE') {
            const hole = cut as SmartPartHoleCut;
            const dia = Math.max(1, hole.diameterMm);
            const len = Math.max(1, hole.lengthMm);
            // Pivot = lico utwierdzenia (przód) — LCS w (0,0,0) na tej płaszczyźnie
            pivot.rotation.set(0, 0, 0);
            if (pivot.rotationQuaternion) pivot.rotationQuaternion = null;

            const orient = cutOrientFromRefs(hole);
            const axisLen = this.lcsAxisLengthMm(dia, len, dia, 0.35, 8, 22);
            const lcs = this.buildHoleCadLcs(pivot, `cut_lcs_${cut.id}`, axisLen, orient);
            if (lcs) {
                lcs.position = new BABYLON.Vector3(0, 0, 0);
                this.cutLcsNodes.set(cut.id, lcs);
            }
            return;
        }

        const pocket = cut as SmartPartPocketCut;
        const w = Math.max(1, pocket.widthMm);
        const h = Math.max(1, pocket.heightMm);
        const d = Math.max(1, pocket.depthMm);
        const orient = cutOrientFromRefs(pocket);
        const axisLen = this.lcsAxisLengthMm(w, h, d, 0.35, 8, 22);
        pivot.rotation.set(0, 0, 0);
        if (pivot.rotationQuaternion) pivot.rotationQuaternion = null;
        const lcs = this.buildHoleCadLcs(pivot, `cut_lcs_${cut.id}`, axisLen, orient);
        if (lcs) {
            lcs.position = new BABYLON.Vector3(0, 0, 0);
            this.cutLcsNodes.set(cut.id, lcs);
        }
    }

    /**
     * 3. Cięcia (Walce jako otwory, Sześciany jako rewizje)
     */
    private renderCuts(def: SmartPartPackageDefinition): void {
        for (const n of this.cutLcsNodes.values()) this.disposeLcsNode(n);
        this.cutLcsNodes.clear();
        for (const m of this.cutMeshes.values()) {
            m.dispose();
        }
        this.cutMeshes.clear();

        for (const cut of def.cuts) {
            // Nie doklejaj do Part1 przy złym/brakującym partId (multi-part)
            const part = findPartForCut(def, cut);
            const parentSet = def.sets?.find((s) => s.id === part?.setId);
            if (parentSet && parentSet.visible === false) continue;
            // Jak w hanger-mesh / bay-placement: zamrożony Part lub cut → bez meshy wycięć
            if (part?.frozen === true || cut.frozen === true) continue;
            const parentMesh = (part && this.partMeshes.get(part.id)) || null;
            if (cut.type === 'HOLE') {
                this.renderHoleCut(cut as SmartPartHoleCut, parentMesh);
            } else {
                this.renderPocketCut(cut as SmartPartPocketCut, parentMesh);
            }
            this.attachCutLcs(cut);
        }
    }

    private renderHoleCut(hole: SmartPartHoleCut, parentMesh: any | null): void {
        const dia = Math.max(1, hole.diameterMm);
        const len = Math.max(1, hole.lengthMm);
        const isSelected = this.selectedId === hole.id;

        // xMm/yMm/zMm = początek (LCS / utwierdzenie) — pivot tu, nie w połowie długości
        const centerOff = this.holeCenterOffsetFromOriginBabylon(hole);
        const pivot = new BABYLON.TransformNode(`cut_pivot_${hole.id}`, this.scene);
        const origin = cadPosToBabylon(hole.xMm, hole.yMm, hole.zMm);
        if (parentMesh) {
            pivot.parent = parentMesh;
            pivot.position = new BABYLON.Vector3(origin.x, origin.y, origin.z);
        } else {
            pivot.position = new BABYLON.Vector3(origin.x, origin.y, origin.z);
        }
        pivot.rotation.set(0, 0, 0);
        pivot.metadata = {
            id: hole.id,
            type: 'HOLE',
            kind: 'utwierdzenie',
        };

        const cylinder = BABYLON.MeshBuilder.CreateCylinder(`cut_${hole.id}`, {
            diameter: dia,
            height: len,
            tessellation: 32,
        }, this.scene);
        cylinder.parent = pivot;
        // Bryła: środek odsunięty od początku wzdłuż osi
        cylinder.position = new BABYLON.Vector3(centerOff.x, centerOff.y, centerOff.z);

        const { axis: holeAxis } = cutOrientFromRefs(hole);
        if (holeAxis === 'X') {
            cylinder.rotation.z = Math.PI / 2;
        } else if (holeAxis === 'Y') {
            cylinder.rotation.x = Math.PI / 2;
        } else {
            cylinder.rotation.set(0, 0, 0);
        }

        const mat = new BABYLON.StandardMaterial(`mat_cut_${hole.id}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.22, 0.74, 0.97);
        mat.emissiveColor = isSelected ? new BABYLON.Color3(0.2, 0.6, 0.9) : new BABYLON.Color3(0.08, 0.35, 0.55);
        mat.alpha = 0.9;
        cylinder.material = mat;
        cylinder.metadata = { id: hole.id, type: 'HOLE' };
        cylinder.isPickable = true;
        if (isSelected) {
            this.attachCylinderEdgeFrame(cylinder, `hole_edges_${hole.id}`, dia, len, true);
        }
        pivot.setEnabled(hole.visible !== false);

        this.cutMeshes.set(hole.id, pivot);
    }

    private renderPocketCut(pocket: SmartPartPocketCut, parentMesh: any | null): void {
        const w = Math.max(1, pocket.widthMm);
        const h = Math.max(1, pocket.heightMm);
        const d = Math.max(1, pocket.depthMm);
        const isSelected = this.selectedId === pocket.id;
        const { axis, direction } = cutOrientFromRefs(pocket);
        const half =
            axis === 'X' ? w / 2
            : axis === 'Y' ? d / 2
            : h / 2;
        // Babylon: X=X, Y=CAD_Z, Z=CAD_Y — offset środka od LCS
        const centerOff =
            axis === 'X' ? { x: direction * half, y: 0, z: 0 }
            : axis === 'Y' ? { x: 0, y: 0, z: direction * half }
            : { x: 0, y: direction * half, z: 0 };

        // xMm/yMm/zMm = początek (LCS / utwierdzenie)
        const pivot = new BABYLON.TransformNode(`cut_pivot_${pocket.id}`, this.scene);
        const origin = cadPosToBabylon(pocket.xMm, pocket.yMm, pocket.zMm);
        if (parentMesh) {
            pivot.parent = parentMesh;
            pivot.position = new BABYLON.Vector3(origin.x, origin.y, origin.z);
        } else {
            pivot.position = new BABYLON.Vector3(origin.x, origin.y, origin.z);
        }
        pivot.rotation.set(0, 0, 0);
        pivot.metadata = { id: pocket.id, type: 'POCKET', kind: 'utwierdzenie' };

        const box = BABYLON.MeshBuilder.CreateBox(`cut_${pocket.id}`, {
            width: w,
            height: h,
            depth: d,
        }, this.scene);
        box.parent = pivot;
        box.position = new BABYLON.Vector3(centerOff.x, centerOff.y, centerOff.z);

        const mat = new BABYLON.StandardMaterial(`mat_cut_${pocket.id}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.96, 0.62, 0.04);
        mat.emissiveColor = isSelected ? new BABYLON.Color3(0.6, 0.4, 0.05) : new BABYLON.Color3(0.4, 0.22, 0.02);
        mat.alpha = 0.9;
        box.material = mat;
        box.metadata = { id: pocket.id, type: 'POCKET' };
        box.isPickable = true;
        if (isSelected) {
            this.attachBoxEdgeFrame(box, `pocket_edges_${pocket.id}`, w, h, d, true);
        }
        pivot.setEnabled(pocket.visible !== false);

        this.cutMeshes.set(pocket.id, pivot);
    }

    /**
     * Generuje zrzut ekranu miniatury (ikony UI) w formacie DataURL (przeskalowany, lekki thumbnail)
     */
    public captureThumbnail(targetWidth: number = 120, targetHeight: number = 90): string {
        if (!this.canvas) return '';
        try {
            if (this.scene) {
                // Ukryj gizmo i LCS przed zrzutem ikony
                if (this.cadTranslateGizmo) {
                    this.cadTranslateGizmo.attachedNode = null;
                    this.cadTranslateGizmo.setEnabled(false);
                }
                if (this.rotationGizmo) {
                    this.rotationGizmo.attachedNode = null;
                }
                const lcsWas = this.lcsVisible;
                if (lcsWas) this.setLcsVisible(false);
                this.scene.render();
                const data = (() => {
                    const offscreenCanvas = document.createElement('canvas');
                    offscreenCanvas.width = targetWidth;
                    offscreenCanvas.height = targetHeight;
                    const ctx = offscreenCanvas.getContext('2d');
                    if (ctx && this.canvas.width > 0 && this.canvas.height > 0) {
                        ctx.drawImage(this.canvas, 0, 0, targetWidth, targetHeight);
                        return offscreenCanvas.toDataURL('image/jpeg', 0.85);
                    }
                    return this.canvas.toDataURL('image/jpeg', 0.7);
                })();
                if (lcsWas) this.setLcsVisible(true);
                this.updateGizmoAttachment();
                return data;
            }
            return '';
        } catch (e) {
            console.warn('[SmartPartStudioScene] Błąd przechwytywania miniatury:', e);
            return '';
        }
    }

    /**
     * Ustawia widok kamery
     */
    public setView(view: string): void {
        if (!this.camera) return;
        const nv = namedCameraView(view);
        this.animateCameraTo(nv.alpha, nv.beta, this.camera.radius, this.camera.target, nv.up);
    }

    /**
     * Animuje kamerę do podanej pozycji i orientacji (ArcRotate).
     */
    public animateCameraTo(
        alpha: number,
        beta: number,
        radius: number,
        target?: any,
        up?: CameraUp
    ): void {
        if (!this.camera || typeof BABYLON === 'undefined') return;

        if (up) {
            if (this.camera.upVector?.set) {
                this.camera.upVector.set(up.x, up.y, up.z);
            } else {
                this.camera.upVector = new BABYLON.Vector3(up.x, up.y, up.z);
            }
        }

        const fps = 60;
        const frames = 24;
        const ease = new BABYLON.QuadraticEase();
        const loopMode = 2;

        BABYLON.Animation.CreateAndStartAnimation(
            'camAlpha', this.camera, 'alpha', fps, frames,
            this.camera.alpha, alpha, loopMode, ease
        );
        BABYLON.Animation.CreateAndStartAnimation(
            'camBeta', this.camera, 'beta', fps, frames,
            this.camera.beta, beta, loopMode, ease
        );
        BABYLON.Animation.CreateAndStartAnimation(
            'camRadius', this.camera, 'radius', fps, frames,
            this.camera.radius, radius, loopMode, ease
        );
        if (target) {
            BABYLON.Animation.CreateAndStartAnimation(
                'camTarget', this.camera, 'target', fps, frames,
                this.camera.target.clone(), target, loopMode, ease
            );
        }
    }

    /**
     * Synchronizuje obrót kostki orientacji (ViewCube w prawym górnym rogu) z kamerą sceny 3D.
     */
    private _syncViewCube(): void {
        const cubes = typeof window !== 'undefined' && window.document
            ? window.document.querySelectorAll<HTMLElement>('.view-cube-wrapper')
            : null;
        if (!cubes || cubes.length === 0) return;

        if (!this.camera) return;
        const alpha = this.camera.alpha;
        const beta = this.camera.beta;
        if (alpha === this._lastCubeAlpha && beta === this._lastCubeBeta) return;
        this._lastCubeAlpha = alpha;
        this._lastCubeBeta = beta;

        const degX = (beta * 180 / Math.PI) - 90;
        const degY = -((alpha * 180 / Math.PI) + 90);
        const transformStr = `rotateX(${degX.toFixed(2)}deg) rotateY(${degY.toFixed(2)}deg)`;
        for (let i = 0; i < cubes.length; i++) {
            cubes[i].style.transform = transformStr;
        }
    }

    /**
     * Ustawia kamerę na jeden z predefiniowanych rzutów.
     */
    public setViewPreset(preset: CameraViewPreset): void {
        switch (preset) {
            case 'TOP':
                this.setView('top');
                break;
            case 'FRONT':
                this.setView('front');
                break;
            case 'SIDE':
                this.setView('right');
                break;
            case 'ISO':
            default:
                this.setView('iso');
                break;
        }
    }

    public toggleProjection(): boolean {
        if (!this.camera || typeof BABYLON === 'undefined') return false;

        const isCurrentlyPersp = this.camera.mode === BABYLON.Camera.PERSPECTIVE_CAMERA;
        if (isCurrentlyPersp) {
            this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
            const aspect = (this.canvas.width || 800) / (this.canvas.height || 600);
            const orthoSize = (this.camera.radius || 160) * 0.45;
            this.camera.orthoLeft = -orthoSize * aspect;
            this.camera.orthoRight = orthoSize * aspect;
            this.camera.orthoTop = orthoSize;
            this.camera.orthoBottom = -orthoSize;
            return true;
        } else {
            this.camera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA;
            return false;
        }
    }

    public isOrthographic(): boolean {
        if (!this.camera || typeof BABYLON === 'undefined') return false;
        return this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    }

    public resetCamera(): void {
        if (!this.camera) return;
        this.setViewPreset('ISO');
        const maxDim = this.currentDef
            ? Math.max(this.currentDef.mainContainer.widthMm, this.currentDef.mainContainer.heightMm, this.currentDef.mainContainer.depthMm)
            : 600;
        this.camera.radius = Math.max(1000, maxDim * 1.8);
    }

    /** Widoczność siatki podłoża (belka → Podgląd → Siatka). */
    public setGridVisible(visible: boolean): void {
        if (this.groundMesh) this.groundMesh.setEnabled(visible);
        if (this.gridLinesMesh) this.gridLinesMesh.setEnabled(visible);
    }

    /** Widoczność LCS kontenera, Parts i cutów (belka → Podgląd → LCS). */
    public setLcsVisible(visible: boolean): void {
        this.lcsVisible = visible;
        if (this.mainLcsNode) {
            this.mainLcsNode.setEnabled(visible);
        } else if (visible) {
            this.rebuildAllLcs();
            return;
        }
        for (const n of this.partLcsNodes.values()) {
            if (n) n.setEnabled(visible);
        }
        for (const n of this.cutLcsNodes.values()) {
            if (n) n.setEnabled(visible);
        }
        if (visible && (
            (this.partLcsNodes.size === 0 && this.partMeshes.size > 0)
            || (this.cutLcsNodes.size === 0 && this.cutMeshes.size > 0)
        )) {
            this.rebuildAllLcs();
        }
    }

    /** Tryb cieniowania — uproszczony (shaded / edges / wireframe / xray). */
    public setRenderMode(mode: string): void {
        const apply = (mesh: any) => {
            if (!mesh?.material) return;
            if (mesh.metadata?.kind === 'edge_frame') return;
            if (mesh.material === this.edgeFrameMat || mesh.material === this.edgeFrameSelectedMat) return;
            const mat = mesh.material;
            mat.wireframe = mode === 'wireframe';
            if (typeof mat.alpha === 'number') {
                if (mode === 'xray') mat.alpha = Math.min(mat.alpha, 0.35);
                else if (mode === 'shaded' || mode === 'edges') {
                    if (mesh === this.mainContainerMesh) {
                        mat.alpha = 0;
                        mat.wireframe = false;
                        mat.disableDepthWrite = true;
                    } else if (mesh.metadata?.type === 'HOLE' || mesh.metadata?.type === 'POCKET') {
                        mat.alpha = 0.9;
                        mat.wireframe = false;
                    } else {
                        mat.alpha = 0.95;
                        mat.wireframe = false;
                    }
                }
                if (mesh === this.mainContainerMesh && mode === 'wireframe') {
                    mat.alpha = 0;
                    mat.wireframe = false;
                    mat.disableDepthWrite = true;
                }
            }
        };
        if (this.mainContainerMesh) apply(this.mainContainerMesh);
        for (const m of this.partMeshes.values()) apply(m);
        for (const m of this.cutMeshes.values()) {
            apply(m);
            const kids = m.getChildMeshes?.(true) || m.getChildren?.() || [];
            for (const child of kids) apply(child);
        }
    }

    public dispose(): void {
        window.removeEventListener('resize', this.onResize);
        this.canvas.removeEventListener('contextmenu', this._onCanvasContextMenu);
        if (this._pointerObserver && this.scene) {
            this.scene.onPointerObservable.remove(this._pointerObserver);
            this._pointerObserver = null;
        }
        this.disposeLcsNode(this.mainLcsNode);
        this.mainLcsNode = null;
        for (const n of this.partLcsNodes.values()) this.disposeLcsNode(n);
        this.partLcsNodes.clear();
        for (const n of this.cutLcsNodes.values()) this.disposeLcsNode(n);
        this.cutLcsNodes.clear();
        if (this.groundMesh) {
            this.groundMesh.dispose();
            this.groundMesh = null;
        }
        if (this.gridLinesMesh) {
            this.gridLinesMesh.dispose();
            this.gridLinesMesh = null;
        }
        if (this.headlamp) {
            this.headlamp.dispose();
            this.headlamp = null;
        }
        if (this.backlight) {
            this.backlight.dispose();
            this.backlight = null;
        }
        this.disposeRefFaceMeshes();
        if (this.cadTranslateGizmo) {
            this.cadTranslateGizmo.dispose();
            this.cadTranslateGizmo = null;
        }
        if (this.rotationGizmo) {
            this.rotationGizmo.dispose();
            this.rotationGizmo = null;
        }
        if (this.scene) {
            this.scene.dispose();
            this.scene = null;
        }
        if (this.engine) {
            this.engine.dispose();
            this.engine = null;
        }
    }
}
