/**
 * E3_export - e3-3d-scene-engine.ts
 * Dedykowany silnik sceny 3D (Babylon.js) dla Studia Rysunków CAD E3.
 * Zarządza czystym arkuszem CAD, instancjami modeli 3D, niezależną orientacją (ViewCube)
 * oraz liniami wymiarowymi PMI 3D.
 */

import { E3PaperFormat, E3_PAPER_FORMATS, E3ProjectionAngle, E3LibraryItem, E3TitleBlock } from './e3-library-types';

declare const BABYLON: any;

export interface E3ModelInstance {
    id: string;
    name: string;
    type: 'CONTAINER' | 'PANEL' | 'SMARTBOX' | 'ASSEMBLY';
    transformNode: any;
    rootMesh: any;
    width: number;
    height: number;
    depth: number;
    angle: E3ProjectionAngle;
    pmiNodes: any[];
}

export class E3SceneEngine {
    private static _instance: E3SceneEngine;

    public engine: any = null;
    public scene: any = null;
    public camera: any = null;

    public paperFormat: E3PaperFormat = 'A4_LANDSCAPE';
    public placedModels: E3ModelInstance[] = [];
    public activeModelId: string | null = null;

    public titleBlock: E3TitleBlock = {
        projectName: 'Projekt Mebla CAD',
        furnitureName: 'Korpus Meblowy',
        author: 'SmartBox CAD',
        date: new Date().toISOString().split('T')[0],
        scale: '1:10',
        sheetNumber: '1/1',
        drawingNumber: 'SB-E3-001',
        remarks: '',
    };

    private _listeners: Set<() => void> = new Set();
    private _passepartoutElement: HTMLElement | null = null;

    public static get instance(): E3SceneEngine {
        if (!E3SceneEngine._instance) {
            E3SceneEngine._instance = new E3SceneEngine();
        }
        return E3SceneEngine._instance;
    }

    public subscribe(listener: () => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private _notify(): void {
        this._listeners.forEach((fn) => fn());
    }

    /**
     * Inicjalizuje scenę 3D Babylon.js w elemencie canvas.
     */
    public init(canvas: HTMLCanvasElement): void {
        if (typeof BABYLON === 'undefined') {
            console.error('Babylon.js nie jest załadowany!');
            return;
        }

        if (this.engine) {
            this.engine.dispose();
        }

        this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.clearColor = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0); // Czyste białe tło arkusza

        // Ortogonalna kamera techniczna CAD skierowana prosto na arkusz
        this.camera = new BABYLON.ArcRotateCamera(
            'e3_camera',
            Math.PI / 2,
            0.001, // Widok z góry na płaszczyznę arkusza
            2500,
            new BABYLON.Vector3(0, 0, 0),
            this.scene
        );
        this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        this.camera.attachControl(canvas, false); // MMB do pan/zoom

        this._updateCameraBounds(canvas);

        // Oświetlenie CAD (równomierne, bez głębokich cieni)
        const hemiLight = new BABYLON.HemisphericLight('e3_hemi', new BABYLON.Vector3(0, 1, 0), this.scene);
        hemiLight.intensity = 0.95;
        hemiLight.diffuse = new BABYLON.Color3(1, 1, 1);
        hemiLight.groundColor = new BABYLON.Color3(0.9, 0.9, 0.9);

        const dirLight = new BABYLON.DirectionalLight('e3_dir', new BABYLON.Vector3(0.5, -1, 0.5), this.scene);
        dirLight.intensity = 0.4;

        // Kliknięcie w tło odznacza model
        this.scene.onPointerDown = (evt: any, pickResult: any) => {
            if (pickResult?.hit && pickResult.pickedMesh) {
                const pickedName = pickResult.pickedMesh.name || '';
                const match = this.placedModels.find((m) => pickedName.startsWith(`e3_model_${m.id}`));
                if (match) {
                    this.setActiveModel(match.id);
                }
            } else if (!pickResult?.hit) {
                this.setActiveModel(null);
            }
        };

        // Render loop
        this.engine.runRenderLoop(() => {
            if (this.scene) {
                this.scene.render();
            }
        });

        window.addEventListener('resize', () => {
            if (this.engine && canvas) {
                this.engine.resize();
                this._updateCameraBounds(canvas);
                this.updatePassepartout();
            }
        });

        this.updatePassepartout();
    }

    private _updateCameraBounds(canvas: HTMLCanvasElement): void {
        if (!this.camera || !canvas) return;
        const aspect = canvas.width / canvas.height;
        const zoomExtent = 1200; // mm

        this.camera.orthoLeft = -zoomExtent * aspect;
        this.camera.orthoRight = zoomExtent * aspect;
        this.camera.orthoTop = zoomExtent;
        this.camera.orthoBottom = -zoomExtent;
    }

    public setPaperFormat(format: E3PaperFormat): void {
        this.paperFormat = format;
        this.updatePassepartout();
        this._notify();
    }

    public setActiveModel(id: string | null): void {
        this.activeModelId = id;
        for (const m of this.placedModels) {
            const isSelected = m.id === id;
            if (m.rootMesh && m.rootMesh.getChildMeshes) {
                for (const mesh of m.rootMesh.getChildMeshes()) {
                    if (mesh.enableEdgesRendering) {
                        mesh.edgesColor = isSelected
                            ? new BABYLON.Color4(0.14, 0.51, 0.96, 1.0) // Błękitne krawędzie dla aktywnego
                            : new BABYLON.Color4(0.08, 0.08, 0.08, 1.0); // Czarne krawędzie CAD
                        mesh.edgesWidth = isSelected ? 3.0 : 2.0;
                    }
                }
            }
        }
        this._notify();
    }

    /**
     * Dodaje rzeczywisty model 3D (bryłę z formatek) na płaszczyznę arkusza.
     */
    public addModel3DFromItem(item: E3LibraryItem, angle: E3ProjectionAngle = 'front'): E3ModelInstance {
        if (!this.scene) {
            throw new Error('Scena 3D nie jest zainicjalizowana!');
        }

        const modelId = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const transformNode = new BABYLON.TransformNode(`e3_node_${modelId}`, this.scene);

        // Pozycja początkowa na arkuszu
        const count = this.placedModels.length;
        const posX = -400 + (count % 2) * 800;
        const posY = 300 - Math.floor(count / 2) * 600;
        transformNode.position = new BABYLON.Vector3(posX, 0, posY);

        const isContainer = item.type === 'CONTAINER' || item.type === 'SMARTBOX' || (item.children && item.children.length > 0);
        const meshes: any[] = [];
        const pmiNodes: any[] = [];

        // Biały techniczny materiał CAD
        const mat = new BABYLON.StandardMaterial(`e3_mat_${modelId}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.98, 0.98, 0.98);
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        mat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);

        const w = item.width || 800;
        const h = item.height || 720;
        const d = item.depth || 560;
        const thick = 18; // grubość ścianki 18mm

        if (isContainer) {
            // Budujemy bryłę mebla korpusowego (Bok Lewy, Bok Prawy, Wieniec Dolny, Wieniec Górny, Plecy)
            // 1. Bok Lewy
            const meshLeft = BABYLON.MeshBuilder.CreateBox(`e3_model_${modelId}_bl`, { width: thick, height: h, depth: d }, this.scene);
            meshLeft.position = new BABYLON.Vector3(-w / 2 + thick / 2, h / 2, 0);
            meshLeft.parent = transformNode;
            meshLeft.material = mat;
            meshes.push(meshLeft);

            // 2. Bok Prawy
            const meshRight = BABYLON.MeshBuilder.CreateBox(`e3_model_${modelId}_bp`, { width: thick, height: h, depth: d }, this.scene);
            meshRight.position = new BABYLON.Vector3(w / 2 - thick / 2, h / 2, 0);
            meshRight.parent = transformNode;
            meshRight.material = mat;
            meshes.push(meshRight);

            // 3. Wieniec Dolny
            const meshBottom = BABYLON.MeshBuilder.CreateBox(`e3_model_${modelId}_wd`, { width: w - 2 * thick, height: thick, depth: d }, this.scene);
            meshBottom.position = new BABYLON.Vector3(0, thick / 2, 0);
            meshBottom.parent = transformNode;
            meshBottom.material = mat;
            meshes.push(meshBottom);

            // 4. Wieniec Górny
            const meshTop = BABYLON.MeshBuilder.CreateBox(`e3_model_${modelId}_wg`, { width: w - 2 * thick, height: thick, depth: d }, this.scene);
            meshTop.position = new BABYLON.Vector3(0, h - thick / 2, 0);
            meshTop.parent = transformNode;
            meshTop.material = mat;
            meshes.push(meshTop);

            // 5. Plecy (HDF 3mm)
            const meshBack = BABYLON.MeshBuilder.CreateBox(`e3_model_${modelId}_plecy`, { width: w - 2 * thick, height: h - 2 * thick, depth: 3 }, this.scene);
            meshBack.position = new BABYLON.Vector3(0, h / 2, -d / 2 + 1.5);
            meshBack.parent = transformNode;
            meshBack.material = mat;
            meshes.push(meshBack);
        } else {
            // Pojedyncza formatka 3D
            const panelMesh = BABYLON.MeshBuilder.CreateBox(`e3_model_${modelId}_panel`, { width: w, height: h, depth: d }, this.scene);
            panelMesh.position = new BABYLON.Vector3(0, h / 2, 0);
            panelMesh.parent = transformNode;
            panelMesh.material = mat;
            meshes.push(panelMesh);
        }

        // Włącz wyraziste krawędzie techniczne CAD dla każdej siatki
        for (const m of meshes) {
            if (m.enableEdgesRendering) {
                m.enableEdgesRendering(0.95);
                m.edgesWidth = 2.0;
                m.edgesColor = new BABYLON.Color4(0.08, 0.08, 0.08, 1.0);
            }
        }

        // ─── Tworzenie Linii Wymiarowych PMI 3D ───
        const dimOffset = 60;

        // Wymiar Szerokości (X)
        const p1X = new BABYLON.Vector3(-w / 2, -dimOffset, d / 2 + 10);
        const p2X = new BABYLON.Vector3(w / 2, -dimOffset, d / 2 + 10);
        const lineX = BABYLON.MeshBuilder.CreateLines(`e3_pmi_${modelId}_x`, {
            points: [p1X, p2X],
        }, this.scene);
        lineX.color = new BABYLON.Color3(0.14, 0.45, 0.95);
        lineX.parent = transformNode;
        pmiNodes.push(lineX);

        // Wymiar Wysokości (Y)
        const p1Y = new BABYLON.Vector3(w / 2 + dimOffset, 0, d / 2 + 10);
        const p2Y = new BABYLON.Vector3(w / 2 + dimOffset, h, d / 2 + 10);
        const lineY = BABYLON.MeshBuilder.CreateLines(`e3_pmi_${modelId}_y`, {
            points: [p1Y, p2Y],
        }, this.scene);
        lineY.color = new BABYLON.Color3(0.14, 0.45, 0.95);
        lineY.parent = transformNode;
        pmiNodes.push(lineY);

        // Narzędzie do przesuwania myszą 3D na płaszczyźnie arkusza
        const pointerDrag = new BABYLON.PointerDragBehavior({
            dragPlaneNormal: new BABYLON.Vector3(0, 1, 0), // Płaszczyzna arkusza XZ
        });
        pointerDrag.useObjectOrientationForDragging = false;
        pointerDrag.onDragStartObservable.add(() => {
            this.setActiveModel(modelId);
        });
        transformNode.addBehavior(pointerDrag);

        const instance: E3ModelInstance = {
            id: modelId,
            name: item.name || 'Model 3D',
            type: item.type,
            transformNode,
            rootMesh: meshes[0],
            width: w,
            height: h,
            depth: d,
            angle,
            pmiNodes,
        };

        this.placedModels.push(instance);
        this.setActiveModel(modelId);
        this.rotateModelToAngle(modelId, angle);

        this._notify();
        return instance;
    }

    /**
     * Obraca wskazany model 3D do zadanego kąta rzutu (Przód, Góra, Prawy, Lewy, Izometria).
     */
    public rotateModelToAngle(modelId: string, angle: E3ProjectionAngle): void {
        const model = this.placedModels.find((m) => m.id === modelId);
        if (!model || !model.transformNode) return;

        model.angle = angle;
        const node = model.transformNode;

        switch (angle) {
            case 'front':
                node.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); // Kładziemy przodem do kamery
                break;
            case 'top':
                node.rotation = new BABYLON.Vector3(0, 0, 0); // Widok z góry
                break;
            case 'right':
                node.rotation = new BABYLON.Vector3(Math.PI / 2, -Math.PI / 2, 0); // Prawa strona
                break;
            case 'left':
                node.rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI / 2, 0); // Lewa strona
                break;
            case 'back':
                node.rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI, 0); // Tył
                break;
            case 'isometric':
                node.rotation = new BABYLON.Vector3(Math.PI / 3, Math.PI / 4, 0); // Aksonometria 3D
                break;
        }

        this._notify();
    }

    /**
     * Obrót aktywnego zaznaczonego modelu (sterowany Kostką Widoków lub górną belką).
     */
    public rotateActiveModel(angle: E3ProjectionAngle): void {
        if (this.activeModelId) {
            this.rotateModelToAngle(this.activeModelId, angle);
        } else if (this.placedModels.length > 0) {
            this.rotateModelToAngle(this.placedModels[0].id, angle);
        }
    }

    public removeModel(modelId: string): void {
        const model = this.placedModels.find((m) => m.id === modelId);
        if (model) {
            if (model.transformNode) {
                model.transformNode.dispose();
            }
            this.placedModels = this.placedModels.filter((m) => m.id !== modelId);
            if (this.activeModelId === modelId) {
                this.activeModelId = this.placedModels[0]?.id || null;
            }
            this._notify();
        }
    }

    public clearAllModels(): void {
        for (const m of this.placedModels) {
            if (m.transformNode) {
                m.transformNode.dispose();
            }
        }
        this.placedModels = [];
        this.activeModelId = null;
        this._notify();
    }

    // ─── Wirtualny Arkusz CAD HUD (Podwójna Ramka i ISO 7200) ───

    public updatePassepartout(): void {
        const dims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        if (!this._passepartoutElement) {
            this._passepartoutElement = document.createElement('div');
            this._passepartoutElement.id = 'e3-sheet-passepartout-hud';
            this._passepartoutElement.style.position = 'fixed';
            this._passepartoutElement.style.top = '0';
            this._passepartoutElement.style.left = '320px'; // za lewym panelem
            this._passepartoutElement.style.right = '0';
            this._passepartoutElement.style.bottom = '0';
            this._passepartoutElement.style.pointerEvents = 'none';
            this._passepartoutElement.style.zIndex = '5';
            document.body.appendChild(this._passepartoutElement);
        }

        const areaW = winW - 320;
        const areaH = winH;

        // Obliczanie proporcji arkusza
        const sheetAspect = dims.width / dims.height;
        let sheetW = areaW * 0.9;
        let sheetH = sheetW / sheetAspect;

        if (sheetH > areaH * 0.88) {
            sheetH = areaH * 0.88;
            sheetW = sheetH * sheetAspect;
        }

        const sx = (areaW - sheetW) / 2;
        const sy = (areaH - sheetH) / 2;
        const scale = sheetW / dims.width;

        const fx = sx + 20 * scale;
        const fy = sy + 5 * scale;
        const fw = (dims.width - 25) * scale;
        const fh = (dims.height - 10) * scale;

        const tbW = 120 * scale;
        const tbH = 30 * scale;
        const tbx = fx + fw - tbW;
        const tby = fy + fh - tbH;

        const titleDisplayName = this.titleBlock.furnitureName || this.titleBlock.projectName || 'Mebel CAD';

        this._passepartoutElement.innerHTML = `
            <svg width="100%" height="100%" viewBox="0 0 ${areaW} ${areaH}" style="display:block; width:100%; height:100%;">
                <defs>
                    <mask id="e3-passepartout-mask">
                        <rect x="0" y="0" width="${areaW}" height="${areaH}" fill="white" />
                        <rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${sheetW.toFixed(1)}" height="${sheetH.toFixed(1)}" fill="black" rx="2" />
                    </mask>
                </defs>

                <!-- Przyciemnienie poza arkuszem -->
                <rect x="0" y="0" width="${areaW}" height="${areaH}" fill="rgba(15, 23, 42, 0.72)" mask="url(#e3-passepartout-mask)" />

                <!-- Biała ramka obwodu arkusza -->
                <rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${sheetW.toFixed(1)}" height="${sheetH.toFixed(1)}"
                      fill="none" stroke="rgba(255, 255, 255, 0.9)" stroke-width="1.5" stroke-dasharray="6,4" rx="2" />

                <!-- Etykieta Formatki -->
                <g transform="translate(${sx.toFixed(1)}, ${(sy - 6).toFixed(1)})">
                    <rect x="0" y="-18" width="220" height="20" fill="rgba(37, 99, 235, 0.95)" rx="4" />
                    <text x="8" y="-4" fill="#ffffff" font-size="11" font-family="'Segoe UI', sans-serif" font-weight="bold">
                        📄 ${dims.label} (${dims.description}) • Studio E3
                    </text>
                </g>

                <!-- Podwójna Ramka CAD -->
                <rect x="${fx.toFixed(1)}" y="${fy.toFixed(1)}" width="${fw.toFixed(1)}" height="${fh.toFixed(1)}"
                      fill="none" stroke="#1e293b" stroke-width="1.8" />
                <rect x="${(fx + 2).toFixed(1)}" y="${(fy + 2).toFixed(1)}" width="${(fw - 4).toFixed(1)}" height="${(fh - 4).toFixed(1)}"
                      fill="none" stroke="#64748b" stroke-width="0.8" />

                <!-- Stempel ISO 7200 -->
                <g transform="translate(${tbx.toFixed(1)}, ${tby.toFixed(1)})">
                    <rect x="0" y="0" width="${tbW.toFixed(1)}" height="${tbH.toFixed(1)}" fill="rgba(255,255,255,0.95)" stroke="#0f172a" stroke-width="1.2" />
                    <line x1="0" y1="${(12 * scale).toFixed(1)}" x2="${tbW.toFixed(1)}" y2="${(12 * scale).toFixed(1)}" stroke="#cbd5e1" stroke-width="0.8" />
                    <line x1="${(80 * scale).toFixed(1)}" y1="0" x2="${(80 * scale).toFixed(1)}" y2="${tbH.toFixed(1)}" stroke="#cbd5e1" stroke-width="0.8" />

                    <text x="4" y="${(4 * scale).toFixed(1)}" font-size="${(1.4 * scale).toFixed(1)}" fill="#64748b">Nazwa projektu / mebla</text>
                    <text x="4" y="${(9.5 * scale).toFixed(1)}" font-size="${(3.2 * scale).toFixed(1)}" fill="#0f172a" font-weight="bold">${titleDisplayName}</text>
                    <text x="${(82 * scale).toFixed(1)}" y="${(4 * scale).toFixed(1)}" font-size="${(1.4 * scale).toFixed(1)}" fill="#64748b">Nr rysunku</text>
                    <text x="${(82 * scale).toFixed(1)}" y="${(9.5 * scale).toFixed(1)}" font-size="${(2.8 * scale).toFixed(1)}" fill="#0f172a" font-weight="bold">${this.titleBlock.drawingNumber}</text>

                    <text x="4" y="${(18 * scale).toFixed(1)}" font-size="${(1.3 * scale).toFixed(1)}" fill="#64748b">Wykonał: <tspan fill="#0f172a" font-weight="600">${this.titleBlock.author}</tspan></text>
                    <text x="${(82 * scale).toFixed(1)}" y="${(18 * scale).toFixed(1)}" font-size="${(1.3 * scale).toFixed(1)}" fill="#64748b">Data: <tspan fill="#0f172a" font-weight="600">${this.titleBlock.date}</tspan></text>

                    <text x="${(tbW - 3).toFixed(1)}" y="${(tbH - 2).toFixed(1)}" font-size="${(1.2 * scale).toFixed(1)}" fill="#94a3b8" text-anchor="end">SmartBox CAD E3</text>
                </g>
            </svg>
        `;
    }

    // ─── Eksport (Drukuj PDF, JPG) ───

    public async downloadJpgScreenshot(): Promise<void> {
        if (!this.engine || !this.scene || !this.camera) return;

        const canvas = this.engine.getRenderingCanvas();
        if (!canvas) return;

        try {
            if (this._passepartoutElement) this._passepartoutElement.style.display = 'none';
            this.scene.render();

            let base64 = '';
            if (BABYLON.Tools?.CreateScreenshotAsync) {
                base64 = await BABYLON.Tools.CreateScreenshotAsync(this.engine, this.camera, { width: canvas.width, height: canvas.height }, 'image/jpeg');
            } else {
                base64 = canvas.toDataURL('image/jpeg', 0.95);
            }

            const a = document.createElement('a');
            a.href = base64;
            a.download = `Arkusz_CAD_E3_${this.paperFormat}_${new Date().toISOString().split('T')[0]}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } finally {
            if (this._passepartoutElement) this._passepartoutElement.style.display = 'block';
        }
    }

    public async printSheet(): Promise<void> {
        if (!this.engine || !this.scene || !this.camera) return;

        const canvas = this.engine.getRenderingCanvas();
        if (!canvas) return;

        try {
            if (this._passepartoutElement) this._passepartoutElement.style.display = 'none';
            this.scene.render();

            let base64 = '';
            if (BABYLON.Tools?.CreateScreenshotAsync) {
                base64 = await BABYLON.Tools.CreateScreenshotAsync(this.engine, this.camera, { width: canvas.width, height: canvas.height }, 'image/png');
            } else {
                base64 = canvas.toDataURL('image/png', 1.0);
            }

            const dims = E3_PAPER_FORMATS[this.paperFormat] || E3_PAPER_FORMATS['A4_LANDSCAPE'];
            const printWin = window.open('', '_blank');
            if (!printWin) return;

            printWin.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Drukuj Dokumentację CAD E3 - SmartBox</title>
                    <style>
                        @page { size: ${dims.width}mm ${dims.height}mm; margin: 0; }
                        body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: #ffffff; }
                        img { width: 100vw; height: 100vh; object-fit: contain; }
                    </style>
                </head>
                <body>
                    <img src="${base64}" />
                    <script>window.onload = () => window.print();</script>
                </body>
                </html>
            `);
            printWin.document.close();
        } finally {
            if (this._passepartoutElement) this._passepartoutElement.style.display = 'block';
        }
    }
}
