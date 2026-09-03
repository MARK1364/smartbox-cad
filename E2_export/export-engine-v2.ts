/**
 * E2_export - export-engine-v2.ts
 * Silnik Eksportu 2 zintegrowany z żywą sceną 3D:
 * - Czysty arkusz na starcie,
 * - Dodawanie instancji modeli przez Drag & Drop z żywego drzewa obiektów (jak z biblioteki),
 * - Niezależny obrót każdego egzemplarza przez ViewCube / przyciski,
 * - Swobodne przesuwanie modeli myszą po arkuszu w 3D,
 * - Asocjatywne wymiary PMI,
 * - Wirtualny arkusz HUD ISO 7200 i bezpośredni eksport do PDF/JPG/SVG.
 */

import {
    PaperFormat,
    PAPER_FORMATS,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    MARGIN_BOTTOM,
    TITLE_BLOCK_WIDTH,
    TITLE_BLOCK_HEIGHT,
    TitleBlockInfo,
} from './export-types';
import { ContextManager } from '../A1_core/context-manager';
import { CADNode } from '../A1_core/cad-node/cad-node';
import { NodeType } from '../A1_core/cad-node/node-type';
import type { ProjectDocument } from '../A1_core/project-document';
import { PMIStore } from '../A8_pmi/pmi-data';

declare const BABYLON: any;

export interface PlacedExportModel {
    id: string;
    nodeId: string;
    nodeName: string;
    nodeType: string;
    width: number;
    height: number;
    depth: number;
    thickness: number;
    angleName: string;
    showPMI: boolean;
    position?: [number, number, number];
    rootNode?: any;
}

export type SerializedPlacedModel = Omit<PlacedExportModel, 'rootNode'>;

export interface AddPlacedModelOptions {
    id?: string;
    position?: [number, number, number];
}

const VIEW_ANGLES: { [key: string]: { label: string; rx: number; ry: number; rz: number } } = {
    front: { label: 'Przód', rx: 0, ry: 0, rz: 0 },
    back: { label: 'Tył', rx: 0, ry: Math.PI, rz: 0 },
    top: { label: 'Góra', rx: -Math.PI / 2, ry: 0, rz: 0 },
    bottom: { label: 'Dół', rx: Math.PI / 2, ry: 0, rz: 0 },
    left: { label: 'Bok Lewy', rx: 0, ry: Math.PI / 2, rz: 0 },
    right: { label: 'Bok Prawy', rx: 0, ry: -Math.PI / 2, rz: 0 },
    isometric: { label: 'Izometria', rx: -0.55, ry: 0.78, rz: 0 },
};

function resolveViewAngle(name?: string): { key: string; def: (typeof VIEW_ANGLES)[string] } {
    if (!name) return { key: 'front', def: VIEW_ANGLES.front };
    const lower = name.toLowerCase();
    if (VIEW_ANGLES[lower]) return { key: lower, def: VIEW_ANGLES[lower] };
    for (const [key, def] of Object.entries(VIEW_ANGLES)) {
        if (def.label.toLowerCase() === lower) return { key, def };
    }
    return { key: 'front', def: VIEW_ANGLES.front };
}

function readModelPosition(model: PlacedExportModel | SerializedPlacedModel): [number, number, number] | undefined {
    const pos = (model as PlacedExportModel).rootNode?.position;
    if (pos && typeof pos.x === 'number') {
        return [pos.x, pos.y, pos.z];
    }
    if (Array.isArray(model.position) && model.position.length >= 3) {
        return [model.position[0], model.position[1], model.position[2]];
    }
    return undefined;
}

export class ExportEngineV2 {
    private static _instance: ExportEngineV2;

    public paperFormat: PaperFormat = 'A4_LANDSCAPE';
    public showBounds: boolean = false;
    public includePMI: boolean = true;
    public notes: string = '';

    public titleBlock: TitleBlockInfo = {
        projectName: 'Projekt WebCAD',
        furnitureName: 'Szafka / Komoda',
        author: 'SmartBox CAD',
        date: new Date().toISOString().split('T')[0],
        scale: '1:10',
        sheetNumber: '1/1',
        drawingNumber: 'SB-001',
        remarks: '',
    };

    public placedModels: PlacedExportModel[] = [];
    public activeModelId: string | null = null;
    public previewSvg: string | null = null;

    /** Modele z pliku, czekające na scenę / drzewo CAD — nie trafiają na listę UI. */
    private _pendingPlacedModels: SerializedPlacedModel[] = [];

    private _listeners: Set<() => void> = new Set();
    private _passepartoutElement: HTMLElement | null = null;
    private _hiddenSceneMeshes: any[] = [];

    public static get instance(): ExportEngineV2 {
        if (!ExportEngineV2._instance) {
            ExportEngineV2._instance = new ExportEngineV2();
        }
        return ExportEngineV2._instance;
    }

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => {
                if (this.showBounds && ContextManager.instance?.activeTab === 'tab-e2-export') {
                    this.updatePassepartout();
                }
            });
        }
    }

    public subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private _notify(): void {
        this._listeners.forEach((fn) => fn());
    }

    public setPaperFormat(format: PaperFormat): void {
        this.paperFormat = format;
        this.updatePassepartout();
        this._notify();
    }

    public setTitleBlock(info: Partial<TitleBlockInfo>): void {
        this.titleBlock = { ...this.titleBlock, ...info };
        this.updatePassepartout();
        this._notify();
    }

    public setPreviewSvg(svg: string | null): void {
        this.previewSvg = svg;
        this._notify();
    }

    public setActiveModelId(id: string | null): void {
        this.activeModelId = id;
        this._notify();
    }

    // ─── Włączanie / Wyłączanie Trybu Eksport 2 na Żywej Scenie 3D ───

    public setShowBounds(show: boolean): void {
        this.showBounds = show;
        const scene = ContextManager.instance.babylonScene;

        if (show) {
            this.updatePassepartout();
            // Ukryj standardowe obiekty pokoju / sceny głównej, aby arkusz był czysty
            if (scene) {
                this._hiddenSceneMeshes = [];
                for (const mesh of scene.meshes) {
                    if (mesh.isVisible && !mesh.name.startsWith('export_sheet_') && !mesh.name.startsWith('dim_')) {
                        mesh.isVisible = false;
                        this._hiddenSceneMeshes.push(mesh);
                    }
                }
            }
        } else {
            this._removePassepartout();
            // Przywróć widoczność standardowych obiektów sceny
            for (const mesh of this._hiddenSceneMeshes) {
                if (mesh && !mesh.isDisposed()) {
                    mesh.isVisible = true;
                }
            }
            this._hiddenSceneMeshes = [];
        }
        if (show) {
            this.rebuildPendingModels();
        }
        this._notify();
    }

    // ─── Dodawanie Modela z Drzewa Obiektów (Drag & Drop z Biblioteki) ───

    public addModelFromCADNode(
        node: CADNode,
        initialAngle: string = 'front',
        options?: AddPlacedModelOptions,
    ): string {
        const scene = ContextManager.instance.babylonScene;
        if (!scene || typeof BABYLON === 'undefined') return '';

        const domainData = (node.domainData || {}) as any;
        const rawName = domainData.name || node.name || 'Komponent CAD';

        const toMm = (v: any, def: number) => {
            if (v === undefined || v === null) return def;
            const n = parseFloat(v);
            if (isNaN(n)) return def;
            return Math.abs(n) > 10000 ? Math.round(n / 1000000) : Math.round(n);
        };

        const W = toMm(domainData.width ?? domainData.dimX, 600);
        const H = toMm(domainData.height ?? domainData.dimY, 720);
        const D = toMm(domainData.depth ?? domainData.dimZ, 560);
        const T = toMm(domainData.thickness ?? domainData.dimZ, 18);

        const modelId = options?.id || `exp_model_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

        // Pozycja początkowa na arkuszu
        const offsetIdx = this.placedModels.length;
        const posX = options?.position?.[0] ?? ((offsetIdx % 2 === 0 ? -1 : 1) * (200 + offsetIdx * 120));
        const posY = options?.position?.[1] ?? (offsetIdx > 1 ? -200 : 100);
        const posZ = options?.position?.[2] ?? 0;

        // Tworzenie TransformNode dla tego egzemplarza
        const rootTransform = new BABYLON.TransformNode(`export_sheet_${modelId}`, scene);
        rootTransform.position = new BABYLON.Vector3(posX, posY, posZ);

        const { def: angleDef } = resolveViewAngle(initialAngle);
        rootTransform.rotation = new BABYLON.Vector3(angleDef.rx, angleDef.ry, angleDef.rz);

        // Tworzenie materiału
        const mat = new BABYLON.StandardMaterial(`mat_${modelId}`, scene);
        mat.diffuseColor = new BABYLON.Color3(0.96, 0.96, 0.96);
        mat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);

        const isPart = node.nodeType === NodeType.PART || domainData.type === 'panel';

        if (isPart) {
            const box = BABYLON.MeshBuilder.CreateBox(`mesh_${modelId}`, { width: W, height: H, depth: T }, scene);
            box.material = mat;
            box.parent = rootTransform;
            box.enableEdgesRendering();
            box.edgesWidth = 2.5;
            box.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            this._attachInteractions(box, modelId);
        } else {
            // Szafka / Korpus
            const wallT = 18;
            const left = BABYLON.MeshBuilder.CreateBox(`left_${modelId}`, { width: wallT, height: H, depth: D }, scene);
            left.position.x = -W / 2 + wallT / 2;
            left.material = mat;
            left.parent = rootTransform;
            left.enableEdgesRendering();
            left.edgesWidth = 2.0;
            left.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            this._attachInteractions(left, modelId);

            const right = BABYLON.MeshBuilder.CreateBox(`right_${modelId}`, { width: wallT, height: H, depth: D }, scene);
            right.position.x = W / 2 - wallT / 2;
            right.material = mat;
            right.parent = rootTransform;
            right.enableEdgesRendering();
            right.edgesWidth = 2.0;
            right.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            this._attachInteractions(right, modelId);

            const bottom = BABYLON.MeshBuilder.CreateBox(`bottom_${modelId}`, { width: W - 2 * wallT, height: wallT, depth: D }, scene);
            bottom.position.y = -H / 2 + wallT / 2;
            bottom.material = mat;
            bottom.parent = rootTransform;
            bottom.enableEdgesRendering();
            bottom.edgesWidth = 2.0;
            bottom.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            this._attachInteractions(bottom, modelId);

            const top = BABYLON.MeshBuilder.CreateBox(`top_${modelId}`, { width: W - 2 * wallT, height: wallT, depth: D }, scene);
            top.position.y = H / 2 - wallT / 2;
            top.material = mat;
            top.parent = rootTransform;
            top.enableEdgesRendering();
            top.edgesWidth = 2.0;
            top.edgesColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1.0);
            this._attachInteractions(top, modelId);

            // Wymiary PMI w przestrzeni 3D
            this._buildPMI3D(scene, rootTransform, W, H, D);
        }

        const placedItem: PlacedExportModel = {
            id: modelId,
            nodeId: node.id,
            nodeName: rawName,
            nodeType: isPart ? 'PART' : 'CONTAINER',
            width: W,
            height: H,
            depth: D,
            thickness: T,
            angleName: angleDef.label,
            showPMI: true,
            position: [posX, posY, posZ],
            rootNode: rootTransform,
        };

        this.placedModels.push(placedItem);
        this.activeModelId = modelId;
        this._notify();
        return modelId;
    }

    private _attachInteractions(mesh: any, modelId: string): void {
        const scene = ContextManager.instance.babylonScene;
        if (!scene) return;

        mesh.actionManager = new BABYLON.ActionManager(scene);
        mesh.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
                this.setActiveModelId(modelId);
            })
        );

        const dragBehavior = new BABYLON.PointerDragBehavior({ dragPlaneNormal: new BABYLON.Vector3(0, 0, 1) });
        dragBehavior.useObjectOrientationForDragging = false;
        mesh.addBehavior(dragBehavior);
    }

    private _buildPMI3D(scene: any, parentNode: any, W: number, H: number, D: number): void {
        const p1 = new BABYLON.Vector3(-W / 2, -H / 2 - 35, D / 2);
        const p2 = new BABYLON.Vector3(W / 2, -H / 2 - 35, D / 2);
        const lines = BABYLON.MeshBuilder.CreateLines('dimWidth', { points: [p1, p2] }, scene);
        lines.color = new BABYLON.Color3(0.15, 0.39, 0.92);
        lines.parent = parentNode;

        const plane = BABYLON.MeshBuilder.CreatePlane('dimWidthText', { width: 90, height: 28 }, scene);
        plane.position = new BABYLON.Vector3(0, -H / 2 - 35, D / 2 + 5);
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        plane.parent = parentNode;

        const dynTex = new BABYLON.DynamicTexture('dtWidth', { width: 256, height: 128 }, scene);
        dynTex.drawText(`${W} mm`, null, 80, 'bold 44px Segoe UI, Arial', '#1e3a8a', '#ffffff', true);
        const planeMat = new BABYLON.StandardMaterial('matDimWidth', scene);
        planeMat.diffuseTexture = dynTex;
        planeMat.specularColor = new BABYLON.Color3(0, 0, 0);
        plane.material = planeMat;
    }

    // ─── Niezależny Obrót Wyłącznie Aktywnego Modela (ViewCube / Pasek) ───

    public rotateActiveModel(faceKey: string): void {
        if (!this.activeModelId) return;
        const scene = ContextManager.instance.babylonScene;
        if (!scene) return;

        const targetNode = scene.getTransformNodeByName(`export_sheet_${this.activeModelId}`);
        if (!targetNode) return;

        const { def: angleDef } = resolveViewAngle(faceKey);

        const animRx = new BABYLON.Animation('animRx', 'rotation.x', 45, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        animRx.setKeys([{ frame: 0, value: targetNode.rotation.x }, { frame: 15, value: angleDef.rx }]);
        const animRy = new BABYLON.Animation('animRy', 'rotation.y', 45, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        animRy.setKeys([{ frame: 0, value: targetNode.rotation.y }, { frame: 15, value: angleDef.ry }]);
        const animRz = new BABYLON.Animation('animRz', 'rotation.z', 45, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        animRz.setKeys([{ frame: 0, value: targetNode.rotation.z }, { frame: 15, value: angleDef.rz }]);

        targetNode.animations = [animRx, animRy, animRz];
        scene.beginAnimation(targetNode, 0, 15, false);

        const found = this.placedModels.find((m) => m.id === this.activeModelId);
        if (found) {
            found.angleName = angleDef.label;
        }
        this._notify();
    }

    public removeModel(id: string): void {
        const scene = ContextManager.instance.babylonScene;
        if (scene) {
            const targetNode = scene.getTransformNodeByName(`export_sheet_${id}`);
            if (targetNode) {
                targetNode.dispose(false, true);
            }
        }
        this.placedModels = this.placedModels.filter((m) => m.id !== id);
        this._pendingPlacedModels = this._pendingPlacedModels.filter((m) => m.id !== id);
        if (this.activeModelId === id) this.activeModelId = null;
        this._notify();
    }

    public clearAllModels(): void {
        const scene = ContextManager.instance.babylonScene;
        if (scene) {
            for (const m of this.placedModels) {
                const targetNode = scene.getTransformNodeByName(`export_sheet_${m.id}`);
                if (targetNode) targetNode.dispose(false, true);
            }
        }
        this.placedModels = [];
        this._pendingPlacedModels = [];
        this.activeModelId = null;
        this._notify();
    }

    /**
     * Serializuje modele arkusza (żywe albo oczekujące na odbudowę).
     * Miniatury / węzły Babylona nie trafiają do pliku.
     */
    public serializePlacedModels(): SerializedPlacedModel[] {
        const source: Array<PlacedExportModel | SerializedPlacedModel> =
            this.placedModels.length > 0 ? this.placedModels : this._pendingPlacedModels;
        return source.map((model) => {
            const { rootNode: _root, ...rest } = model as PlacedExportModel;
            return {
                ...rest,
                position: readModelPosition(model),
            };
        });
    }

    /**
     * Odbudowuje meshe z `_pendingPlacedModels` przez `addModelFromCADNode`.
     * Pomija wpisy bez węzła w drzewie i nic nie wpisuje na listę, gdy nie ma sceny.
     */
    public rebuildPendingModels(document?: ProjectDocument | null): number {
        const pending = this._pendingPlacedModels;
        if (pending.length === 0) return 0;

        const scene = ContextManager.instance.babylonScene;
        const doc = document ?? ContextManager.instance.document;
        if (!scene || !doc || typeof BABYLON === 'undefined') {
            return 0;
        }

        this._pendingPlacedModels = [];
        let restored = 0;
        for (const saved of pending) {
            const node = saved.nodeId ? doc.findNode(saved.nodeId) : null;
            if (!node) {
                console.warn(`E2: pominięto model "${saved.nodeName || saved.id}" — brak węzła ${saved.nodeId}`);
                continue;
            }
            const id = this.addModelFromCADNode(node, saved.angleName || 'front', {
                id: saved.id,
                position: readModelPosition(saved),
            });
            if (id) restored++;
            else this._pendingPlacedModels.push({ ...saved });
        }
        return restored;
    }

    /**
     * Przywraca układ arkusza E2 z pliku projektu.
     * Modele lądują na liście UI dopiero po odbudowie meshy (scena + węzeł CAD).
     */
    public restoreLayout(
        data: {
            paperFormat?: string;
            includePMI?: boolean;
            notes?: string;
            titleBlock?: Partial<TitleBlockInfo>;
            placedModels?: SerializedPlacedModel[];
        } | null,
        document?: ProjectDocument | null,
    ): void {
        this.clearAllModels();
        if (!data) return;
        if (data.paperFormat) this.paperFormat = data.paperFormat as PaperFormat;
        if (typeof data.includePMI === 'boolean') this.includePMI = data.includePMI;
        if (typeof data.notes === 'string') this.notes = data.notes;
        if (data.titleBlock) this.titleBlock = { ...this.titleBlock, ...data.titleBlock };
        this._pendingPlacedModels = Array.isArray(data.placedModels)
            ? data.placedModels.map((model) => ({ ...model }))
            : [];
        if (this.showBounds) {
            this.rebuildPendingModels(document);
        }
        this._notify();
    }

    // ─── Wirtualny Arkusz HUD (Passepartout z Tabelką ISO 7200) ───

    public updatePassepartout(): void {
        if (!this.showBounds) {
            this._removePassepartout();
            return;
        }

        const renderCanvas = document.getElementById('renderCanvas');
        if (!renderCanvas) return;

        if (!this._passepartoutElement) {
            this._passepartoutElement = document.createElement('div');
            this._passepartoutElement.id = 'export-hud-passepartout-v2';
            this._passepartoutElement.style.position = 'absolute';
            this._passepartoutElement.style.inset = '0';
            this._passepartoutElement.style.pointerEvents = 'none';
            this._passepartoutElement.style.zIndex = '8';
            renderCanvas.parentElement?.appendChild(this._passepartoutElement);
        }

        const dims = PAPER_FORMATS[this.paperFormat];
        const rect = renderCanvas.getBoundingClientRect();
        const availableW = rect.width - 40;
        const availableH = rect.height - 40;

        const scale = Math.min(availableW / dims.width, availableH / dims.height);
        const sheetW = dims.width * scale;
        const sheetH = dims.height * scale;

        const left = (rect.width - sheetW) / 2;
        const top = (rect.height - sheetH) / 2;

        this._passepartoutElement.innerHTML = `
            <svg width="100%" height="100%" viewBox="0 0 ${rect.width} ${rect.height}" style="display:block;">
                <defs>
                    <mask id="sheetHoleMaskV2">
                        <rect x="0" y="0" width="${rect.width}" height="${rect.height}" fill="white" />
                        <rect x="${left}" y="${top}" width="${sheetW}" height="${sheetH}" fill="black" />
                    </mask>
                </defs>
                <rect x="0" y="0" width="${rect.width}" height="${rect.height}" fill="rgba(10, 13, 20, 0.85)" mask="url(#sheetHoleMaskV2)" />
                <rect x="${left}" y="${top}" width="${sheetW}" height="${sheetH}" fill="none" stroke="#3b82f6" stroke-width="2" />
                <rect x="${left + MARGIN_LEFT * scale}" y="${top + MARGIN_TOP * scale}" width="${(dims.width - MARGIN_LEFT - MARGIN_RIGHT) * scale}" height="${(dims.height - MARGIN_TOP - MARGIN_BOTTOM) * scale}" fill="none" stroke="#cbd5e1" stroke-width="1" />

                <!-- Tabelka ISO 7200 -->
                <g transform="translate(${left + (dims.width - MARGIN_RIGHT - TITLE_BLOCK_WIDTH) * scale}, ${top + (dims.height - MARGIN_BOTTOM - TITLE_BLOCK_HEIGHT) * scale})">
                    <rect x="0" y="0" width="${TITLE_BLOCK_WIDTH * scale}" height="${TITLE_BLOCK_HEIGHT * scale}" fill="rgba(255, 255, 255, 0.95)" stroke="#0f172a" stroke-width="1.5" />
                    <text x="${6 * scale}" y="${12 * scale}" font-size="${8 * scale}" fill="#0f172a" font-family="'Segoe UI', sans-serif" font-weight="bold">${this.titleBlock.furnitureName || this.titleBlock.projectName}</text>
                    <text x="${6 * scale}" y="${22 * scale}" font-size="${6 * scale}" fill="#64748b" font-family="'Segoe UI', sans-serif">Wykonał: ${this.titleBlock.author} | Data: ${this.titleBlock.date}</text>
                </g>
            </svg>
        `;
    }

    private _removePassepartout(): void {
        if (this._passepartoutElement && this._passepartoutElement.parentElement) {
            this._passepartoutElement.parentElement.removeChild(this._passepartoutElement);
            this._passepartoutElement = null;
        }
    }

    // ─── Druk i Eksport ───

    public async downloadJpgScreenshot(filename = 'Arkusz_CAD_3D.jpg'): Promise<void> {
        const scene = ContextManager.instance.babylonScene;
        const camera = scene?.activeCamera;
        const engine = scene?.getEngine();
        if (!scene || !camera || !engine) return;

        const dataUrl = await BABYLON.Tools.CreateScreenshotAsync(engine, camera, { precision: 2.0 }, 'image/jpeg');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        a.click();
    }

    public printSheet(): void {
        window.print();
    }
}
