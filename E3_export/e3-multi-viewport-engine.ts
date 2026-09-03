/**
 * E3_export - e3-multi-viewport-engine.ts
 * Architektura Jednego Wspólnego Płótna (Single Unified Canvas).
 * Każdy drop to niezależny widok: własny kąt, pan i zakres rysunkowy.
 * Kamera arkusza jest 1:1 z mm papieru; model jest przycinany do ramki.
 */

import {
    E3LibraryItem,
    E3ProjectionAngle,
    E3PaperFormat,
    E3_PAPER_FORMATS,
    E3SavedSheet,
    E3SavedModelSnapshot,
} from './e3-library-types';
import { LIVE_PMI_STORAGE_KEY, DrawingProjectExtractor } from './drawing-project-extractor';
import type { DrawingPMIDimension } from './drawing-types';
import { resolveGeometrySnapshot, type E3PartPose } from './e3-geometry-snapshot';

declare const BABYLON: any;

export type E3RenderMode = 'shaded' | 'edges' | 'wireframe' | 'xray';
export type E3ProjectionType = 'perspective' | 'ortho';

const FRAME_MARGIN_MM = 4;
const TARGET_VIEW_MM = 110;
const MIN_VIEW_SCALE = 0.01;
const MAX_VIEW_SCALE = 2.0;
const FRAME_REVEAL_DELAY_MS = 700;
const E3_SHEETS_STORAGE_KEY = 'smartbox_cad_e3_sheets_v1';
const E3_CURRENT_SHEET_KEY = 'smartbox_cad_e3_current_sheet_id';

export interface E3SheetModel {
    id: string;
    item: E3LibraryItem;
    name: string;
    type: 'CONTAINER' | 'PANEL';
    sheetX: number;
    sheetY: number;
    frameWidth: number;
    frameHeight: number;
    viewOffsetX: number;
    viewOffsetY: number;
    scale: number;
    angle: E3ProjectionAngle;
    rotX: number;
    rotY: number;
    rotZ: number;
    renderMode: E3RenderMode;
    showPMI: boolean;
    rootNode?: any;
    meshes: any[];
    pmiNodes: any[];
}

export class E3MultiViewportEngine {
    private static _instance: E3MultiViewportEngine;

    public static get instance(): E3MultiViewportEngine {
        if (!E3MultiViewportEngine._instance) {
            E3MultiViewportEngine._instance = new E3MultiViewportEngine();
        }
        return E3MultiViewportEngine._instance;
    }

    public models: E3SheetModel[] = [];
    public activeModelId: string | null = null;
    public paperFormat: E3PaperFormat = 'A4_LANDSCAPE';
    public projection: E3ProjectionType = 'ortho';
    public activeTool: 'select_move' | 'rotate' = 'select_move';
    public savedSheets: E3SavedSheet[] = [];
    public currentSheetId: string | null = null;
    public currentSheetName = 'Arkusz 1';
    public frameSuppressed = false;

    public canvas: HTMLCanvasElement | null = null;
    public engine: any = null;
    public scene: any = null;
    public camera: any = null;
    public highlightLayer: any = null;

    public titleBlock = {
        furnitureName: 'Szafa / Korpus CAD',
        drawingNumber: 'E3-001',
        author: 'Projektant',
        date: new Date().toISOString().split('T')[0],
    };

    private _subscribers: Set<() => void> = new Set();
    private _clipObservers = new Map<string, Array<{ mesh: any; before: any; after: any }>>();
    private _resizeHandler: (() => void) | null = null;
    private _navEndTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this._loadSheetsFromStorage();
        this.currentSheetId = null;
        this.currentSheetName = `Arkusz ${this.savedSheets.length + 1}`;
    }

    public subscribe(cb: () => void): () => void {
        this._subscribers.add(cb);
        return () => this._subscribers.delete(cb);
    }

    private _notify(): void {
        for (const cb of this._subscribers) {
            cb();
        }
    }

    public get activeModel(): E3SheetModel | null {
        return this.models.find((m) => m.id === this.activeModelId) || null;
    }

    public setActiveModel(modelId: string | null): void {
        this.activeModelId = modelId;
        this._updateHighlight();
        this._notify();
    }

    public setPaperFormat(format: E3PaperFormat): void {
        this.paperFormat = format;
        this._updateCameraBounds();
        this._notify();
    }

    public setTool(tool: 'select_move' | 'rotate'): void {
        this.activeTool = tool;
        this._notify();
    }

    public updateModelPosition(modelId: string, x: number, y: number): void {
        const model = this.models.find((m) => m.id === modelId);
        if (!model) return;
        model.sheetX = x;
        model.sheetY = y;
        this._applyRootTransform(model);
        this._applyClipToModel(model);
        this._notify();
    }

    public resizeModelFrame(modelId: string, width: number, height: number, x?: number, y?: number): void {
        const model = this.models.find((m) => m.id === modelId);
        if (!model) return;
        model.frameWidth = Math.max(40, width);
        model.frameHeight = Math.max(30, height);
        if (x !== undefined) model.sheetX = x;
        if (y !== undefined) model.sheetY = y;
        this._applyRootTransform(model);
        this._applyClipToModel(model);
        this._notify();
    }

    public initSheetScene(canvas: HTMLCanvasElement): void {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            this._resizeHandler = null;
        }
        if (this.engine) {
            this.engine.dispose();
        }
        this._clipObservers.clear();

        this.canvas = canvas;
        const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
        const scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0);

        this.engine = engine;
        this.scene = scene;

        try {
            this.highlightLayer = new BABYLON.HighlightLayer('sheetHighlight', scene);
            this.highlightLayer.innerGlow = false;
            this.highlightLayer.outerGlow = true;
        } catch {}

        const paperDims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const centerX = paperDims.width / 2;
        const centerY = paperDims.height / 2;

        // Kamera od +Z (przód mebla), ortho zsynchronizowane z mm papieru.
        // ArcRotate + orthoLeft=0 przy targecie na środku przesuwało 3D względem ramki HTML.
        const camera = new BABYLON.FreeCamera(
            'sheetMainCamera',
            new BABYLON.Vector3(centerX, centerY, 1000),
            scene
        );
        camera.setTarget(new BABYLON.Vector3(centerX, centerY, 0));
        camera.upVector = new BABYLON.Vector3(0, 1, 0);
        camera.minZ = 0.1;
        camera.maxZ = 50000;
        camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        camera.inputs.clear();

        this.camera = camera;
        this._updateCameraBounds();
        engine.resize();

        const hemiLight = new BABYLON.HemisphericLight('sheetHemiLight', new BABYLON.Vector3(0, 0, 1), scene);
        hemiLight.intensity = 1.0;
        hemiLight.diffuse = new BABYLON.Color3(1, 1, 1);
        hemiLight.groundColor = new BABYLON.Color3(0.85, 0.85, 0.85);

        const dirLight = new BABYLON.DirectionalLight('sheetDirLight', new BABYLON.Vector3(0.25, -0.35, -1), scene);
        dirLight.intensity = 0.35;

        this._setupInteractions(canvas, scene);

        for (const model of this.models) {
            this._buildModel3DNode(model);
        }
        this._updateHighlight();

        engine.runRenderLoop(() => {
            this._applyPaperOrtho();
            if (scene) scene.render();
        });

        this._resizeHandler = () => {
            if (engine) engine.resize();
            this._updateCameraBounds();
        };
        window.addEventListener('resize', this._resizeHandler);
    }

    private _updateCameraBounds(): void {
        if (!this.camera || !this.canvas) return;
        const paperDims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const cx = paperDims.width / 2;
        const cy = paperDims.height / 2;

        this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        this.projection = 'ortho';
        this.camera.position.x = cx;
        this.camera.position.y = cy;
        this.camera.position.z = 1000;
        if (typeof this.camera.setTarget === 'function') {
            this.camera.setTarget(new BABYLON.Vector3(cx, cy, 0));
        }
        this._applyPaperOrtho();
    }

    /**
     * 1 mm papieru = 1 jednostka 3D. Y bez zmian (dół arkusza = 0).
     * Kamera stoi na +Z (przód modelu). W leworęcznym Babylonie
     * LookAt z +Z na arkusz odwraca oś X kamery, więc orthoLeft/Right
     * mają przeciwne znaki niż przy kamerze na -Z — wtedy 0 mm jest z lewej.
     */
    private _applyPaperOrtho(): void {
        if (!this.camera) return;
        const paperDims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const cx = paperDims.width / 2;
        const cy = paperDims.height / 2;
        this.camera.orthoLeft = cx;
        this.camera.orthoRight = cx - paperDims.width;
        this.camera.orthoBottom = -cy;
        this.camera.orthoTop = paperDims.height - cy;
    }

    private _sheetCoords(screenX: number, screenY: number, canvas: HTMLCanvasElement): { x: number; y: number } {
        const canvasWidth = canvas.clientWidth || 1000;
        const canvasHeight = canvas.clientHeight || 700;
        const paperDims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const normX = screenX / canvasWidth;
        const normY = screenY / canvasHeight;
        return {
            x: normX * paperDims.width,
            y: (1 - normY) * paperDims.height,
        };
    }

    private _frameContains(model: E3SheetModel, x: number, y: number): boolean {
        const halfW = model.frameWidth / 2;
        const halfH = model.frameHeight / 2;
        return x >= model.sheetX - halfW && x <= model.sheetX + halfW
            && y >= model.sheetY - halfH && y <= model.sheetY + halfH;
    }

    public hitModelAtSheet(x: number, y: number): E3SheetModel | null {
        for (let i = this.models.length - 1; i >= 0; i--) {
            if (this._frameContains(this.models[i], x, y)) return this.models[i];
        }
        return null;
    }

    private _modelFromNode(node: any): E3SheetModel | null {
        let current = node;
        while (current) {
            const metaId = current.metadata?.e3ModelId;
            if (metaId) {
                const byMeta = this.models.find((m) => m.id === metaId);
                if (byMeta) return byMeta;
            }
            const byRoot = this.models.find((m) => m.rootNode === current);
            if (byRoot) return byRoot;
            const byMesh = this.models.find((m) => (m.meshes || []).includes(current));
            if (byMesh) return byMesh;
            current = current.parent;
        }
        return null;
    }

    private _pickModel(scene: any): E3SheetModel | null {
        const pickResult = scene.pick(
            scene.pointerX,
            scene.pointerY,
            (m: any) => m.isPickable && m.isVisible && !String(m.name || '').includes('ground')
        );
        if (!pickResult?.hit || !pickResult.pickedMesh) return null;
        return this._modelFromNode(pickResult.pickedMesh);
    }

    private _hitTargetAtPointer(scene: any, canvas: HTMLCanvasElement): E3SheetModel | null {
        const sheetPt = this._sheetCoords(scene.pointerX, scene.pointerY, canvas);
        return this.hitModelAtSheet(sheetPt.x, sheetPt.y) || this._pickModel(scene);
    }

    private _setupInteractions(canvas: HTMLCanvasElement, scene: any): void {
        const preventSideNav = (e: MouseEvent) => {
            if (e.button === 3 || e.button === 4) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        canvas.addEventListener('mousedown', preventSideNav);
        canvas.addEventListener('mouseup', preventSideNav);
        canvas.addEventListener('auxclick', preventSideNav);
        canvas.addEventListener('wheel', (e) => {
            if (this._hitTargetAtPointer(scene, canvas)) {
                e.preventDefault();
            }
        }, { passive: false });

        let isPanningView = false;
        let isRotatingModel = false;
        let navModel: E3SheetModel | null = null;
        let lastPointerX = 0;
        let lastPointerY = 0;

        scene.onPointerObservable.add((pointerInfo: any) => {
            const evt = pointerInfo.event as PointerEvent | WheelEvent;

            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                lastPointerX = scene.pointerX;
                lastPointerY = scene.pointerY;
                const target = this._hitTargetAtPointer(scene, canvas);

                const isPanButton = evt.button === 3 || evt.button === 4 || (evt.button === 1 && evt.shiftKey);
                const isRotateButton = (evt.button === 1 && !evt.shiftKey) || (evt.button === 0 && evt.altKey);

                if (target) {
                    navModel = target;
                    if (isPanButton || isRotateButton) {
                        this._suppressFrame();
                        this.activeModelId = target.id;
                        if (isPanButton) {
                            isPanningView = true;
                            evt.preventDefault();
                            evt.stopPropagation();
                        } else {
                            isRotatingModel = true;
                            evt.preventDefault();
                        }
                    } else {
                        this.setActiveModel(target.id);
                    }
                    return;
                }

                if (evt.button === 0) {
                    this.setActiveModel(null);
                }
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
                const changed = isPanningView || isRotatingModel;
                const finished = navModel;
                isPanningView = false;
                isRotatingModel = false;
                navModel = null;
                if (changed && finished) {
                    this._revealFrame(finished.id);
                }
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                const deltaPxX = scene.pointerX - lastPointerX;
                const deltaPxY = scene.pointerY - lastPointerY;

                if (isPanningView && navModel && navModel.rootNode) {
                    const prev = this._sheetCoords(lastPointerX, lastPointerY, canvas);
                    const next = this._sheetCoords(scene.pointerX, scene.pointerY, canvas);
                    navModel.viewOffsetX += next.x - prev.x;
                    navModel.viewOffsetY += next.y - prev.y;
                    this._applyRootTransform(navModel);
                } else if (isRotatingModel && navModel && navModel.rootNode) {
                    // Jak na głównej scenie: camera.alpha/beta -= delta (MMB w prawo = orbit w prawo).
                    navModel.rotY += deltaPxX * 0.01;
                    navModel.rotX += deltaPxY * 0.01;
                    navModel.rootNode.rotation.y = navModel.rotY;
                    navModel.rootNode.rotation.x = navModel.rotX;
                }

                lastPointerX = scene.pointerX;
                lastPointerY = scene.pointerY;
            } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
                const wheelEvt = evt as WheelEvent;
                const sheetPt = this._sheetCoords(scene.pointerX, scene.pointerY, canvas);
                const target = this._hitTargetAtPointer(scene, canvas);
                if (!target) {
                    return;
                }

                this._suppressFrame();
                this.activeModelId = target.id;
                const isZoomIn = wheelEvt.deltaY > 0;
                const factor = isZoomIn ? 0.9 : 1.1;
                this.zoomModelToward(target.id, factor, sheetPt.x, sheetPt.y, false);
                this._revealFrame(target.id);
                wheelEvt.preventDefault();
            }
        });
    }

    public zoomModelToward(
        modelId: string,
        factor: number,
        sheetX: number,
        sheetY: number,
        wrapFrame: boolean = true
    ): void {
        const model = this.models.find((m) => m.id === modelId);
        if (!model || !model.rootNode) return;

        const oldScale = model.scale;
        const newScale = Math.max(MIN_VIEW_SCALE, Math.min(MAX_VIEW_SCALE, oldScale * factor));
        if (newScale === oldScale) return;

        const rootX = model.sheetX + model.viewOffsetX;
        const rootY = model.sheetY + model.viewOffsetY;
        const k = newScale / oldScale;
        model.viewOffsetX = sheetX - model.sheetX - (sheetX - rootX) * k;
        model.viewOffsetY = sheetY - model.sheetY - (sheetY - rootY) * k;
        model.scale = newScale;
        this._applyRootTransform(model);
        if (wrapFrame) this.wrapFrameAroundModel(modelId);
    }

    private _suppressFrame(): void {
        if (this._navEndTimer) {
            clearTimeout(this._navEndTimer);
            this._navEndTimer = null;
        }
        if (!this.frameSuppressed) {
            this.frameSuppressed = true;
            this._notify();
        }
    }

    private _revealFrame(modelId: string, delayMs: number = FRAME_REVEAL_DELAY_MS): void {
        if (this._navEndTimer) {
            clearTimeout(this._navEndTimer);
            this._navEndTimer = null;
        }
        this._navEndTimer = setTimeout(() => {
            this._navEndTimer = null;
            this.frameSuppressed = false;
            this.wrapFrameAroundModel(modelId);
        }, Math.max(FRAME_REVEAL_DELAY_MS, delayMs));
    }

    private _applyRootTransform(model: E3SheetModel): void {
        if (!model.rootNode) return;
        model.rootNode.position.x = model.sheetX + model.viewOffsetX;
        model.rootNode.position.y = model.sheetY + model.viewOffsetY;
        model.rootNode.position.z = 0;
        model.rootNode.scaling = new BABYLON.Vector3(model.scale, model.scale, model.scale);
        model.rootNode.rotation = new BABYLON.Vector3(model.rotX, model.rotY, model.rotZ);
    }

    private _getFrameClipPlanes(model: E3SheetModel): any[] {
        const left = model.sheetX - model.frameWidth / 2;
        const right = model.sheetX + model.frameWidth / 2;
        const bottom = model.sheetY - model.frameHeight / 2;
        const top = model.sheetY + model.frameHeight / 2;
        return [
            BABYLON.Plane.FromPositionAndNormal(new BABYLON.Vector3(left, 0, 0), new BABYLON.Vector3(-1, 0, 0)),
            BABYLON.Plane.FromPositionAndNormal(new BABYLON.Vector3(right, 0, 0), new BABYLON.Vector3(1, 0, 0)),
            BABYLON.Plane.FromPositionAndNormal(new BABYLON.Vector3(0, bottom, 0), new BABYLON.Vector3(0, -1, 0)),
            BABYLON.Plane.FromPositionAndNormal(new BABYLON.Vector3(0, top, 0), new BABYLON.Vector3(0, 1, 0)),
        ];
    }

    private _clearClip(modelId: string): void {
        const observers = this._clipObservers.get(modelId);
        if (!observers) return;
        for (const entry of observers) {
            try {
                entry.mesh.onBeforeRenderObservable.remove(entry.before);
                entry.mesh.onAfterRenderObservable.remove(entry.after);
            } catch {}
        }
        this._clipObservers.delete(modelId);
    }

    private _clipableMeshes(model: E3SheetModel): any[] {
        return [...(model.meshes || []), ...(model.pmiNodes || [])].filter(Boolean);
    }

    private _applyClipToModel(model: E3SheetModel): void {
        // Ramka to tylko prostokąt HTML (jak SW Draw) — clip 3D dawał szarą płaszczyznę cięcia.
        this._clearClip(model.id);
        if (this.scene) {
            this.scene.clipPlane = null;
            this.scene.clipPlane2 = null;
            this.scene.clipPlane3 = null;
            this.scene.clipPlane4 = null;
        }
    }

    private _updateHighlight(): void {
        if (!this.highlightLayer) return;
        try {
            this.highlightLayer.removeAllMeshes();
        } catch {}
    }

    private _framesOverlap(
        ax: number, ay: number, aw: number, ah: number,
        bx: number, by: number, bw: number, bh: number,
        gap: number = 8
    ): boolean {
        return Math.abs(ax - bx) < (aw + bw) / 2 + gap
            && Math.abs(ay - by) < (ah + bh) / 2 + gap;
    }

    private _nudgeDropPosition(
        x: number,
        y: number,
        frameW: number,
        frameH: number,
        skipId?: string
    ): { x: number; y: number } {
        const paperDims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const minX = frameW / 2 + 24;
        const maxX = paperDims.width - frameW / 2 - 10;
        const minY = frameH / 2 + 10;
        const maxY = paperDims.height - frameH / 2 - 40;
        let nx = Math.max(minX, Math.min(maxX, x));
        let ny = Math.max(minY, Math.min(maxY, y));
        const stepX = Math.max(40, frameW * 0.6);
        const stepY = Math.max(30, frameH * 0.6);

        for (let i = 0; i < 16; i++) {
            const hits = this.models.some((m) => {
                if (skipId && m.id === skipId) return false;
                return this._framesOverlap(nx, ny, frameW, frameH, m.sheetX, m.sheetY, m.frameWidth, m.frameHeight);
            });
            if (!hits) break;
            nx += stepX;
            if (nx > maxX) {
                nx = minX;
                ny -= stepY;
                if (ny < minY) ny = maxY;
            }
        }

        return {
            x: Math.max(minX, Math.min(maxX, nx)),
            y: Math.max(minY, Math.min(maxY, ny)),
        };
    }

    public addModelFromItem(item: E3LibraryItem, sheetX?: number, sheetY?: number, angle: E3ProjectionAngle = 'front'): E3SheetModel {
        const id = 'model_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const paperDims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const isContainer = item.type === 'CONTAINER' || item.type === 'SMARTBOX' || (item.children && item.children.length > 0);

        const rawX = sheetX !== undefined ? sheetX : paperDims.width / 2;
        const rawY = sheetY !== undefined ? sheetY : paperDims.height / 2;

        const model: E3SheetModel = {
            id,
            item,
            name: item.name || (isContainer ? 'Szafa / Korpus' : 'Formatka'),
            type: isContainer ? 'CONTAINER' : 'PANEL',
            sheetX: rawX,
            sheetY: rawY,
            frameWidth: 40,
            frameHeight: 30,
            viewOffsetX: 0,
            viewOffsetY: 0,
            scale: 1,
            angle,
            rotX: 0,
            rotY: 0,
            rotZ: 0,
            renderMode: 'edges',
            showPMI: true,
            meshes: [],
            pmiNodes: [],
        };

        this.models.push(model);
        this.activeModelId = id;

        if (this.scene) {
            this._buildModel3DNode(model);
            this._autoScaleForSheet(model);
            this.wrapFrameAroundModel(id, false);
            const nudged = this._nudgeDropPosition(model.sheetX, model.sheetY, model.frameWidth, model.frameHeight, id);
            if (nudged.x !== model.sheetX || nudged.y !== model.sheetY) {
                this.updateModelPosition(id, nudged.x, nudged.y);
                this.wrapFrameAroundModel(id, false);
            }
            this._updateHighlight();
        }

        this._notify();
        return model;
    }

    private _autoScaleForSheet(model: E3SheetModel): void {
        if (!model.rootNode) return;
        model.viewOffsetX = 0;
        model.viewOffsetY = 0;
        model.scale = 1;
        this._applyRootTransform(model);
        model.rootNode.computeWorldMatrix(true);
        const size = this._projectedAabb(model);
        if (size.w < 0.001 || size.h < 0.001) {
            model.scale = 0.12;
            this._applyRootTransform(model);
            return;
        }
        const nextScale = Math.max(
            MIN_VIEW_SCALE,
            Math.min(MAX_VIEW_SCALE, Math.min(TARGET_VIEW_MM / size.w, TARGET_VIEW_MM / size.h))
        );
        model.scale = nextScale;
        this._applyRootTransform(model);
    }

    /**
     * Ramka jak w SolidWorks: kilka mm większa niż obrys 3D na arkuszu.
     */
    public wrapFrameAroundModel(modelId: string, notify: boolean = true): void {
        const model = this.models.find((m) => m.id === modelId);
        if (!model || !model.rootNode || !this.scene) return;

        model.rootNode.computeWorldMatrix(true);
        const aabb = this._projectedAabb(model);
        if (aabb.w < 0.001 || aabb.h < 0.001) {
            if (notify) this._notify();
            return;
        }

        const rootX = model.rootNode.position.x;
        const rootY = model.rootNode.position.y;
        model.sheetX = aabb.cx;
        model.sheetY = aabb.cy;
        model.frameWidth = Math.max(16, aabb.w + FRAME_MARGIN_MM * 2);
        model.frameHeight = Math.max(12, aabb.h + FRAME_MARGIN_MM * 2);
        model.viewOffsetX = rootX - model.sheetX;
        model.viewOffsetY = rootY - model.sheetY;
        this._clampFrameOnPaper(model);
        this._applyRootTransform(model);
        this._applyClipToModel(model);
        if (notify) this._notify();
    }

    private _clampFrameOnPaper(model: E3SheetModel): void {
        const paperDims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const halfW = model.frameWidth / 2;
        const halfH = model.frameHeight / 2;
        const minX = halfW + 24;
        const maxX = paperDims.width - halfW - 10;
        const minY = halfH + 10;
        const maxY = paperDims.height - halfH - 40;
        const nx = Math.max(minX, Math.min(maxX, model.sheetX));
        const ny = Math.max(minY, Math.min(maxY, model.sheetY));
        const dx = nx - model.sheetX;
        const dy = ny - model.sheetY;
        model.sheetX = nx;
        model.sheetY = ny;
        if (model.rootNode && (dx !== 0 || dy !== 0)) {
            model.rootNode.position.x += dx;
            model.rootNode.position.y += dy;
            model.viewOffsetX = model.rootNode.position.x - model.sheetX;
            model.viewOffsetY = model.rootNode.position.y - model.sheetY;
        }
    }

    public fitModelToFrame(modelId: string): void {
        this.wrapFrameAroundModel(modelId);
    }

    public fitActiveViewToFrame(): void {
        if (this.activeModelId) {
            this.wrapFrameAroundModel(this.activeModelId);
        }
    }

    private _projectedAabb(model: E3SheetModel): { w: number; h: number; cx: number; cy: number } {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const mesh of model.meshes || []) {
            try {
                mesh.computeWorldMatrix(true);
                if (typeof mesh.refreshBoundingInfo === 'function') {
                    mesh.refreshBoundingInfo(true, true);
                }
                const bi = mesh.getBoundingInfo();
                const min = bi.boundingBox.minimumWorld;
                const max = bi.boundingBox.maximumWorld;
                minX = Math.min(minX, min.x);
                minY = Math.min(minY, min.y);
                maxX = Math.max(maxX, max.x);
                maxY = Math.max(maxY, max.y);
            } catch {}
        }

        if (!isFinite(minX)) {
            return { w: 0, h: 0, cx: model.sheetX, cy: model.sheetY };
        }
        return {
            w: maxX - minX,
            h: maxY - minY,
            cx: (minX + maxX) / 2,
            cy: (minY + maxY) / 2,
        };
    }

    private _stylePartMesh(mesh: any, mat: any): void {
        mesh.material = mat;
        mesh.enableEdgesRendering();
        mesh.edgesWidth = 1.8;
        mesh.edgesColor = new BABYLON.Color4(0.05, 0.05, 0.05, 1.0);
        mesh.isPickable = true;
    }

    private _createPartBox(part: E3PartPose, parent: any, mat: any, meshes: any[], modelId: string): void {
        const w = Math.max(1, part.width || 18);
        const h = Math.max(1, part.height || 18);
        const t = Math.max(1, part.thickness || 18);
        const mesh = BABYLON.MeshBuilder.CreateBox(`part_${modelId}_${part.id || Math.random()}`, {
            width: w,
            height: h,
            depth: t,
        }, this.scene);
        mesh.parent = parent;
        mesh.metadata = { e3ModelId: modelId };
        mesh.position = new BABYLON.Vector3(part.pos[0], part.pos[1], part.pos[2]);
        mesh.rotationQuaternion = new BABYLON.Quaternion(part.rotq[0], part.rotq[1], part.rotq[2], part.rotq[3]);
        this._stylePartMesh(mesh, mat);
        meshes.push(mesh);
    }

    private _centerGeometry(geomNode: any, meshes: any[]): void {
        if (!geomNode || meshes.length === 0) return;
        geomNode.computeWorldMatrix(true);
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (const mesh of meshes) {
            try {
                mesh.computeWorldMatrix(true);
                const bi = mesh.getBoundingInfo();
                const min = bi.boundingBox.minimumWorld;
                const max = bi.boundingBox.maximumWorld;
                minX = Math.min(minX, min.x);
                minY = Math.min(minY, min.y);
                minZ = Math.min(minZ, min.z);
                maxX = Math.max(maxX, max.x);
                maxY = Math.max(maxY, max.y);
                maxZ = Math.max(maxZ, max.z);
            } catch {}
        }
        if (!isFinite(minX)) return;
        geomNode.position.x -= (minX + maxX) / 2;
        geomNode.position.y -= (minY + maxY) / 2;
        geomNode.position.z -= (minZ + maxZ) / 2;
    }

    private _partsFromItem(item: E3LibraryItem): E3PartPose[] {
        const snap = resolveGeometrySnapshot(item.id) || (item.uid ? resolveGeometrySnapshot(item.uid) : null);
        if (snap && snap.parts && snap.parts.length > 0) {
            return snap.parts;
        }

        const fromChildren: E3PartPose[] = [];
        for (const child of item.children || []) {
            if (!child.pos || !child.rotq) continue;
            fromChildren.push({
                id: child.id,
                name: child.name,
                role: child.role,
                width: child.width,
                height: child.height,
                thickness: child.depth || 18,
                pos: child.pos,
                rotq: child.rotq,
            });
        }
        if (fromChildren.length > 0) return fromChildren;

        return [{
            id: item.id,
            name: item.name,
            width: item.width || 600,
            height: item.height || 720,
            thickness: item.type === 'PANEL' ? (item.depth || 18) : 18,
            pos: [0, 0, 0],
            rotq: [0, 0, 0, 1],
        }];
    }

    private _buildModel3DNode(model: E3SheetModel): void {
        if (!this.scene) return;

        this._clearClip(model.id);
        if (model.rootNode) {
            model.rootNode.dispose();
        }

        const rootNode = new BABYLON.TransformNode(`root_${model.id}`, this.scene);
        const geomNode = new BABYLON.TransformNode(`geom_${model.id}`, this.scene);
        rootNode.metadata = { e3ModelId: model.id };
        geomNode.metadata = { e3ModelId: model.id };
        geomNode.parent = rootNode;

        const mat = new BABYLON.StandardMaterial(`mat_${model.id}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);

        const meshes: any[] = [];
        const parts = this._partsFromItem(model.item);
        for (const part of parts) {
            this._createPartBox(part, geomNode, mat, meshes, model.id);
        }

        if (meshes.length === 0) {
            const fallback: E3PartPose = {
                id: model.item.id,
                name: model.item.name,
                width: model.item.width || 800,
                height: model.item.height || 720,
                thickness: model.item.depth || 18,
                pos: [0, 0, 0],
                rotq: [0, 0, 0, 1],
            };
            this._createPartBox(fallback, geomNode, mat, meshes, model.id);
        }

        this._centerGeometry(geomNode, meshes);

        model.rootNode = rootNode;
        model.meshes = meshes;
        model.pmiNodes = [];

        this._applyRootTransform(model);
        this.applyRenderMode(model);
        this._buildPmiForModel(model);
        this._applyClipToModel(model);
        this._setPmiVisible(model, model.showPMI);
    }

    private _collectPmiForItem(item: E3LibraryItem): DrawingPMIDimension[] {
        const nodeIds = new Set<string>();
        if (item.id) nodeIds.add(item.id);
        if (item.uid) nodeIds.add(item.uid);
        for (const child of item.children || []) {
            if (child.id) nodeIds.add(child.id);
            if (child.uid) nodeIds.add(child.uid);
        }

        let list: DrawingPMIDimension[] = [];
        try {
            list = DrawingProjectExtractor.instance.extractPMIDimensions();
        } catch {
            list = [];
        }

        if (list.length === 0 && typeof localStorage !== 'undefined') {
            try {
                const raw = localStorage.getItem(LIVE_PMI_STORAGE_KEY);
                if (raw) list = JSON.parse(raw);
            } catch {}
        }

        const withNode = list.filter((dim) => dim.nodeId && nodeIds.has(dim.nodeId));
        if (withNode.length > 0) return withNode;
        const unscoped = list.filter((dim) => !dim.nodeId);
        if (unscoped.length === list.length && list.length > 0) return list;
        return [];
    }

    private _toProxyLocal(x: number, y: number, z: number, w: number, h: number, d: number): { x: number; y: number; z: number } {
        const looksCornerBased = x >= -2 && y >= -2 && z >= -2
            && x <= w * 1.6 && y <= h * 1.6 && z <= d * 1.6;
        if (looksCornerBased) {
            return { x: x - w / 2, y: y - h / 2, z: z - d / 2 };
        }
        return { x, y, z };
    }

    private _buildPmiForModel(model: E3SheetModel): void {
        if (!this.scene || !model.rootNode) return;
        for (const node of model.pmiNodes || []) {
            try { node.dispose(); } catch {}
        }
        model.pmiNodes = [];

        const dims = this._collectPmiForItem(model.item);
        if (dims.length === 0) return;

        const w = model.item.width || 800;
        const h = model.item.height || 720;
        const d = model.item.depth || 560;
        const color = new BABYLON.Color3(0.15, 0.39, 0.92);

        for (const dim of dims) {
            const raw1 = {
                x: dim.lx1 ?? dim.x1,
                y: dim.ly1 ?? dim.y1,
                z: dim.lz1 ?? dim.z1 ?? 0,
            };
            const raw2 = {
                x: dim.lx2 ?? dim.x2,
                y: dim.ly2 ?? dim.y2,
                z: dim.lz2 ?? dim.z2 ?? 0,
            };
            const p1l = this._toProxyLocal(raw1.x, raw1.y, raw1.z, w, h, d);
            const p2l = this._toProxyLocal(raw2.x, raw2.y, raw2.z, w, h, d);
            const p1 = new BABYLON.Vector3(p1l.x, p1l.y, p1l.z);
            const p2 = new BABYLON.Vector3(p2l.x, p2l.y, p2l.z);

            const line = BABYLON.MeshBuilder.CreateLines(`pmi_${model.id}_${dim.id}`, { points: [p1, p2] }, this.scene);
            line.color = color;
            line.parent = model.rootNode;
            line.isPickable = false;
            model.pmiNodes.push(line);

            const mid = p1.add(p2).scale(0.5);
            const label = dim.text || (dim.distanceMM ? `${dim.distanceMM.toFixed(1)} mm` : '');
            if (!label) continue;

            const plane = BABYLON.MeshBuilder.CreatePlane(`pmi_txt_${model.id}_${dim.id}`, { width: 48, height: 16 }, this.scene);
            plane.position = mid.add(new BABYLON.Vector3(0, 10, 4));
            plane.parent = model.rootNode;
            plane.isPickable = false;
            plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

            const dynTex = new BABYLON.DynamicTexture(`pmi_dt_${model.id}_${dim.id}`, { width: 256, height: 64 }, this.scene, false);
            dynTex.hasAlpha = true;
            dynTex.drawText(label, null, 48, 'bold 28px Segoe UI, Arial', '#1e3a8a', 'transparent', true);
            const planeMat = new BABYLON.StandardMaterial(`pmi_mat_${model.id}_${dim.id}`, this.scene);
            planeMat.diffuseTexture = dynTex;
            planeMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
            planeMat.specularColor = new BABYLON.Color3(0, 0, 0);
            planeMat.backFaceCulling = false;
            planeMat.useAlphaFromDiffuseTexture = true;
            plane.material = planeMat;
            model.pmiNodes.push(plane);
        }
    }

    private _setPmiVisible(model: E3SheetModel, visible: boolean): void {
        for (const node of model.pmiNodes || []) {
            node.setEnabled(visible);
        }
    }

    public setModelAngle(modelId: string, angle: E3ProjectionAngle, notify: boolean = true): void {
        const model = this.models.find((m) => m.id === modelId);
        if (!model || !model.rootNode) return;

        model.angle = angle;
        switch (angle) {
            case 'front':
                model.rotX = 0;
                model.rotY = 0;
                model.rotZ = 0;
                break;
            case 'back':
                model.rotX = 0;
                model.rotY = Math.PI;
                model.rotZ = 0;
                break;
            case 'left':
                model.rotX = 0;
                model.rotY = -Math.PI / 2;
                model.rotZ = 0;
                break;
            case 'right':
                model.rotX = 0;
                model.rotY = Math.PI / 2;
                model.rotZ = 0;
                break;
            case 'top':
                model.rotX = -Math.PI / 2;
                model.rotY = 0;
                model.rotZ = 0;
                break;
            case 'bottom':
                model.rotX = Math.PI / 2;
                model.rotY = 0;
                model.rotZ = 0;
                break;
            case 'isometric':
                model.rotX = Math.PI / 6;
                model.rotY = Math.PI / 4;
                model.rotZ = 0;
                break;
        }

        this._applyRootTransform(model);
        if (notify) {
            this.wrapFrameAroundModel(modelId, true);
        }
    }

    public setActiveModelAngle(angle: E3ProjectionAngle): void {
        if (this.activeModelId) {
            this.setModelAngle(this.activeModelId, angle);
        }
    }

    public setActiveModelRenderMode(mode: E3RenderMode): void {
        const model = this.activeModel;
        if (model) {
            model.renderMode = mode;
            this.applyRenderMode(model);
            this._notify();
        }
    }

    public applyRenderMode(model: E3SheetModel): void {
        if (!model.meshes || model.meshes.length === 0) return;

        for (const mesh of model.meshes) {
            if (!mesh.material) continue;

            if (model.renderMode === 'shaded') {
                mesh.material.wireframe = false;
                mesh.material.alpha = 1.0;
                mesh.material.diffuseColor = new BABYLON.Color3(0.92, 0.92, 0.92);
                mesh.enableEdgesRendering();
                mesh.edgesWidth = 1.2;
                mesh.edgesColor = new BABYLON.Color4(0.2, 0.2, 0.2, 1.0);
            } else if (model.renderMode === 'edges') {
                mesh.material.wireframe = false;
                mesh.material.alpha = 1.0;
                mesh.material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
                mesh.enableEdgesRendering();
                mesh.edgesWidth = 1.8;
                mesh.edgesColor = new BABYLON.Color4(0.05, 0.05, 0.05, 1.0);
            } else if (model.renderMode === 'wireframe') {
                mesh.material.wireframe = true;
                mesh.material.alpha = 1.0;
                mesh.disableEdgesRendering();
            } else if (model.renderMode === 'xray') {
                mesh.material.wireframe = false;
                mesh.material.alpha = 0.35;
                mesh.material.diffuseColor = new BABYLON.Color3(0.3, 0.6, 0.9);
                mesh.enableEdgesRendering();
                mesh.edgesWidth = 1.5;
                mesh.edgesColor = new BABYLON.Color4(0.1, 0.3, 0.7, 1.0);
            }
        }
    }

    public setModelScale(modelId: string, scale: number): void {
        const model = this.models.find((m) => m.id === modelId);
        if (!model || !model.rootNode) return;
        model.scale = Math.max(MIN_VIEW_SCALE, Math.min(MAX_VIEW_SCALE, scale));
        this._applyRootTransform(model);
        this.wrapFrameAroundModel(modelId);
    }

    public toggleProjection(): void {
        this._updateCameraBounds();
        this._notify();
    }

    public toggleActiveModelPMI(): void {
        const model = this.activeModel;
        if (!model) return;
        model.showPMI = !model.showPMI;
        this._setPmiVisible(model, model.showPMI);
        this._notify();
    }

    public deleteActiveModel(): void {
        if (this.activeModelId) {
            this.removeModel(this.activeModelId);
        }
    }

    public removeModel(modelId: string): void {
        const index = this.models.findIndex((m) => m.id === modelId);
        if (index !== -1) {
            const model = this.models[index];
            this._clearClip(modelId);
            if (model.rootNode) {
                model.rootNode.dispose();
            }
            this.models.splice(index, 1);
            if (this.activeModelId === modelId) {
                this.activeModelId = this.models[0]?.id || null;
            }
            this._updateHighlight();
            this._notify();
        }
    }

    public clearAllModels(): void {
        for (const model of this.models) {
            this._clearClip(model.id);
            if (model.rootNode) model.rootNode.dispose();
        }
        this.models = [];
        this.activeModelId = null;
        this._updateHighlight();
        this._notify();
    }

    public printSheet(): void {
        window.print();
    }

    public setSheetName(name: string): void {
        this.currentSheetName = (name || '').trim() || 'Arkusz';
        this._notify();
    }

    public saveCurrentSheet(name?: string): E3SavedSheet {
        const sheetName = (name || this.currentSheetName || '').trim() || `Arkusz ${this.savedSheets.length + 1}`;
        this.currentSheetName = sheetName;
        const now = new Date().toISOString();
        const payload: E3SavedSheet = {
            id: this.currentSheetId || ('sheet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
            name: sheetName,
            createdAt: now,
            updatedAt: now,
            paperFormat: this.paperFormat,
            titleBlock: { ...this.titleBlock },
            models: this.models.map((m) => this._snapshotFromModel(m)),
            activeModelId: this.activeModelId,
        };

        const existing = this.savedSheets.findIndex((s) => s.id === payload.id);
        if (existing >= 0) {
            payload.createdAt = this.savedSheets[existing].createdAt || now;
            this.savedSheets[existing] = payload;
        } else {
            this.savedSheets.push(payload);
        }

        this.currentSheetId = payload.id;
        this._persistSheets();
        this._notify();
        return payload;
    }

    public newSheet(): void {
        if (this._navEndTimer) {
            clearTimeout(this._navEndTimer);
            this._navEndTimer = null;
        }
        this.frameSuppressed = false;
        this.clearAllModels();
        this.currentSheetId = null;
        this.currentSheetName = `Arkusz ${this.savedSheets.length + 1}`;
        this.titleBlock = {
            ...this.titleBlock,
            drawingNumber: this._nextDrawingNumber(this.titleBlock.drawingNumber),
            date: new Date().toISOString().split('T')[0],
        };
        this._persistCurrentSheetId();
        this._notify();
    }

    public loadSheet(sheetId: string): boolean {
        const sheet = this.savedSheets.find((s) => s.id === sheetId);
        if (!sheet) return false;
        this._applySheetData(sheet, true);
        this.currentSheetId = sheet.id;
        this.currentSheetName = sheet.name;
        this._persistCurrentSheetId();
        this._notify();
        return true;
    }

    public deleteSavedSheet(sheetId: string): void {
        this.savedSheets = this.savedSheets.filter((s) => s.id !== sheetId);
        if (this.currentSheetId === sheetId) {
            this.currentSheetId = null;
        }
        this._persistSheets();
        this._notify();
    }

    private _snapshotFromModel(model: E3SheetModel): E3SavedModelSnapshot {
        return {
            id: model.id,
            item: this._cloneItem(model.item),
            name: model.name,
            type: model.type,
            sheetX: model.sheetX,
            sheetY: model.sheetY,
            frameWidth: model.frameWidth,
            frameHeight: model.frameHeight,
            viewOffsetX: model.viewOffsetX,
            viewOffsetY: model.viewOffsetY,
            scale: model.scale,
            angle: model.angle,
            rotX: model.rotX,
            rotY: model.rotY,
            rotZ: model.rotZ,
            renderMode: model.renderMode,
            showPMI: model.showPMI,
        };
    }

    private _cloneItem(item: E3LibraryItem): E3LibraryItem {
        return {
            id: item.id,
            uid: item.uid,
            name: item.name,
            type: item.type,
            width: item.width,
            height: item.height,
            depth: item.depth,
            materialName: item.materialName,
            colorHex: item.colorHex,
            childCount: item.childCount,
            cncCount: item.cncCount,
            role: item.role,
            pos: item.pos ? [...item.pos] : undefined,
            rotq: item.rotq ? [...item.rotq] : undefined,
            children: (item.children || []).map((ch) => this._cloneItem(ch)),
        };
    }

    private _applySheetData(sheet: E3SavedSheet, build3d: boolean): void {
        for (const model of this.models) {
            this._clearClip(model.id);
            if (model.rootNode) {
                try { model.rootNode.dispose(); } catch {}
            }
        }
        this.models = [];
        this.paperFormat = sheet.paperFormat || 'A4_LANDSCAPE';
        this.titleBlock = { ...this.titleBlock, ...(sheet.titleBlock || {}) };
        this.currentSheetName = sheet.name || this.currentSheetName;

        for (const snap of sheet.models || []) {
            const model: E3SheetModel = {
                id: snap.id,
                item: this._cloneItem(snap.item),
                name: snap.name,
                type: snap.type,
                sheetX: snap.sheetX,
                sheetY: snap.sheetY,
                frameWidth: snap.frameWidth,
                frameHeight: snap.frameHeight,
                viewOffsetX: snap.viewOffsetX,
                viewOffsetY: snap.viewOffsetY,
                scale: snap.scale,
                angle: snap.angle,
                rotX: snap.rotX,
                rotY: snap.rotY,
                rotZ: snap.rotZ,
                renderMode: snap.renderMode || 'edges',
                showPMI: snap.showPMI !== false,
                meshes: [],
                pmiNodes: [],
            };
            this.models.push(model);
            if (build3d && this.scene) {
                this._buildModel3DNode(model);
            }
        }

        const stillThere = this.models.some((m) => m.id === sheet.activeModelId);
        this.activeModelId = stillThere ? sheet.activeModelId : (this.models[0]?.id || null);
        this._updateCameraBounds();
        this._updateHighlight();
    }

    private _nextDrawingNumber(current: string): string {
        const match = String(current || 'E3-001').match(/^(.*?)(\d+)$/);
        if (!match) return 'E3-001';
        const next = String(parseInt(match[2], 10) + 1).padStart(match[2].length, '0');
        return match[1] + next;
    }

    private _loadSheetsFromStorage(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            const raw = localStorage.getItem(E3_SHEETS_STORAGE_KEY);
            this.savedSheets = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(this.savedSheets)) this.savedSheets = [];
        } catch {
            this.savedSheets = [];
        }
        try {
            this.currentSheetId = localStorage.getItem(E3_CURRENT_SHEET_KEY);
        } catch {
            this.currentSheetId = null;
        }
    }

    private _persistSheets(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(E3_SHEETS_STORAGE_KEY, JSON.stringify(this.savedSheets));
        } catch (err) {
            console.warn('Nie udało się zapisać arkuszy E3:', err);
        }
        this._persistCurrentSheetId();
    }

    private _persistCurrentSheetId(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            if (this.currentSheetId) {
                localStorage.setItem(E3_CURRENT_SHEET_KEY, this.currentSheetId);
            } else {
                localStorage.removeItem(E3_CURRENT_SHEET_KEY);
            }
        } catch {}
    }
}
