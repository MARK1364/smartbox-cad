/**
 * E1_export - export-engine.ts
 * Zarządca stanu eksportu, zrzutów 3D z precyzyjnym kadrowaniem (Cropping),
 * wirtualnego arkusza HUD na scenie 3D (z tabelką ISO 7200) oraz zapisanych arkuszy.
 */

import {
    PaperFormat,
    PAPER_FORMATS,
    ProjectionType,
    TitleBlockInfo,
    SavedExportView,
    BOMRow,
    MARGIN_LEFT,
    MARGIN_RIGHT,
    MARGIN_TOP,
    MARGIN_BOTTOM,
    TITLE_BLOCK_WIDTH,
    TITLE_BLOCK_HEIGHT,
    ExportRenderStyle,
} from './export-types';
import { DrawingSheet } from './drawing-sheet';
import { ContextManager } from '../A1_core/context-manager';
import { PMIStore } from '../A8_pmi/pmi-data';
import { resolveAnchorWorld } from '../A8_pmi/pmi-id-bridge';

declare const BABYLON: any;

const SAVED_VIEWS_STORAGE_KEY = 'smartbox_cad_manual_sheets_v3';

export interface SheetScreenLayout {
    sheetPixelX: number;
    sheetPixelY: number;
    sheetPixelW: number;
    sheetPixelH: number;
    scale: number; // piksele na mm
    framePixelX: number;
    framePixelY: number;
    framePixelW: number;
    framePixelH: number;
    drawPixelX: number;
    drawPixelY: number;
    drawPixelW: number;
    drawPixelH: number;
    tbPixelX: number;
    tbPixelY: number;
    tbPixelW: number;
    tbPixelH: number;
}

export class ExportEngine {
    private static _instance: ExportEngine;

    public paperFormat: PaperFormat = 'A4_LANDSCAPE';
    public projectionType: ProjectionType = 'ORTHO';
    public renderStyle: ExportRenderStyle = 'technical'; // Domyślnie techniczny biały CAD z czarnymi krawędziami
    public showGrid: boolean = false; // Domyślnie wyłączona siatka na arkuszu
    public showBounds: boolean = false; // aktywne WYŁĄCZNIE w module Eksport
    public includeBOM: boolean = false;
    public includePMI: boolean = true;
    public notes: string = '';

    public titleBlock: TitleBlockInfo = {
        projectName: 'Projekt Mebla CAD',
        furnitureName: 'Szafa Korpusowa',
        author: 'SmartBox CAD',
        date: new Date().toISOString().split('T')[0],
        scale: '1:10',
        sheetNumber: '1/1',
        drawingNumber: 'SB-001',
        remarks: '',
    };

    public savedViews: SavedExportView[] = [];
    public previewSvg: string | null = null;
    private _listeners: Set<() => void> = new Set();
    private _passepartoutElement: HTMLElement | null = null;
    private _isOverlayAttached: boolean = false;

    public static get instance(): ExportEngine {
        if (!ExportEngine._instance) {
            ExportEngine._instance = new ExportEngine();
        }
        return ExportEngine._instance;
    }

    public setPreviewSvg(svg: string | null): void {
        this.previewSvg = svg;
        this._notify();
    }

    constructor() {
        this.loadSavedViews();

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => {
                if (this.showBounds && ContextManager.instance?.activeTab === 'tab-e1-export') {
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

    // ─── Ustawienia Formatu, Stylu i Rzutowania ───

    public setPaperFormat(format: PaperFormat): void {
        this.paperFormat = format;
        this.updatePassepartout();
        this._notify();
    }

    public setRenderStyle(style: ExportRenderStyle): void {
        this.renderStyle = style;
        this.applyVisualSettings();
        this._notify();
    }

    public setShowGrid(visible: boolean): void {
        this.showGrid = visible;
        const viewport = ContextManager.instance?.viewport;
        if (viewport) {
            viewport.toggleGrid(visible);
        }
        this._notify();
    }

    public setProjectionType(type: ProjectionType): void {
        this.projectionType = type;
        const viewport = ContextManager.instance?.viewport;
        if (viewport?.camera && typeof BABYLON !== 'undefined') {
            if (type === 'ORTHO') {
                viewport.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
                if (typeof viewport._updateOrthographicBounds === 'function') {
                    viewport._updateOrthographicBounds();
                }
            } else {
                viewport.camera.mode = BABYLON.Camera.PERSPECTIVE_CAMERA;
                viewport.camera.orthoLeft = null;
                viewport.camera.orthoRight = null;
                viewport.camera.orthoTop = null;
                viewport.camera.orthoBottom = null;
            }
        }
        this._notify();
    }

    public setShowBounds(show: boolean): void {
        this.showBounds = show;
        this.applyVisualSettings();
        this.updatePassepartout();
        this._notify();
    }

    public applyVisualSettings(): void {
        const viewport = ContextManager.instance?.viewport;
        if (!viewport || !viewport.scene) return;

        if (this.showBounds) {
            // Czysto białe tło dla arkusza CAD
            viewport.scene.clearColor = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0);
            // Domyślnie brak siatki podłogowej
            viewport.toggleGrid(this.showGrid);
            // Styl rysunku (np. techniczny krawędziowy CAD)
            this.applyRenderStyleToScene(this.renderStyle);
        } else {
            // Przywrócenie standardowego tła sceny roboczej
            viewport.scene.clearColor = new BABYLON.Color4(0.92, 0.93, 0.95, 1.0);
            viewport.toggleGrid(true);
        }
    }

    public applyRenderStyleToScene(style: ExportRenderStyle): void {
        const viewport = ContextManager.instance?.viewport;
        if (!viewport || !viewport.scene) return;

        const scene = viewport.scene;
        scene.clearColor = new BABYLON.Color4(1.0, 1.0, 1.0, 1.0);

        scene.meshes.forEach((mesh: any) => {
            if (!mesh || mesh.name?.includes('Passepartout') || mesh.name?.includes('grid') || mesh.name?.includes('axis') || mesh.name?.includes('Plane')) return;

            const name = mesh.name || '';
            const isFace = name.startsWith('face_') || mesh.metadata?.faceName;
            const isFeature = mesh.metadata?.type === 'feature' || name.startsWith('hole_') || name.startsWith('pocket_') || name.startsWith('groove_');

            if (isFace || isFeature) {
                if (style === 'technical') {
                    // Techniczny CAD: białe ścianki z wyrazistymi czarnymi krawędziami
                    mesh.visibility = 1.0;
                    mesh.isVisible = true;
                    if (typeof mesh.enableEdgesRendering === 'function') {
                        mesh.enableEdgesRendering(0.95);
                        mesh.edgesWidth = 2.0;
                        mesh.edgesColor = new BABYLON.Color4(0.08, 0.08, 0.08, 1.0);
                    }
                    if (mesh.material) {
                        mesh.material.diffuseColor = new BABYLON.Color3(0.99, 0.99, 0.99);
                        mesh.material.specularColor = new BABYLON.Color3(0.0, 0.0, 0.0);
                        mesh.material.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);
                    }
                } else if (style === 'mono') {
                    // Monochromatyczny: jasnoszary z krawędziami
                    mesh.visibility = 1.0;
                    mesh.isVisible = true;
                    if (typeof mesh.enableEdgesRendering === 'function') {
                        mesh.enableEdgesRendering(0.95);
                        mesh.edgesWidth = 1.8;
                        mesh.edgesColor = new BABYLON.Color4(0.12, 0.12, 0.12, 1.0);
                    }
                    if (mesh.material) {
                        mesh.material.diffuseColor = new BABYLON.Color3(0.88, 0.88, 0.88);
                    }
                } else if (style === 'wireframe') {
                    mesh.visibility = 0.0;
                    if (typeof mesh.enableEdgesRendering === 'function') {
                        mesh.enableEdgesRendering(0.95);
                        mesh.edgesWidth = 2.0;
                        mesh.edgesColor = new BABYLON.Color4(0.05, 0.05, 0.05, 1.0);
                    }
                } else {
                    // Shaded (kolorowy laminat)
                    mesh.visibility = 1.0;
                    mesh.isVisible = true;
                    if (typeof mesh.enableEdgesRendering === 'function') {
                        mesh.enableEdgesRendering(0.95);
                        mesh.edgesWidth = 1.2;
                        mesh.edgesColor = new BABYLON.Color4(0.15, 0.15, 0.15, 0.8);
                    }
                }
            }
        });
    }

    public setIncludeBOM(include: boolean): void {
        this.includeBOM = include;
        this._notify();
    }

    public setIncludePMI(include: boolean): void {
        this.includePMI = include;
        this._notify();
    }

    public setNotes(notes: string): void {
        this.notes = notes;
        this.titleBlock.remarks = notes;
        this.updatePassepartout();
        this._notify();
    }

    public setTitleBlock(info: Partial<TitleBlockInfo>): void {
        this.titleBlock = { ...this.titleBlock, ...info };
        this.updatePassepartout();
        this._notify();
    }

    // ─── Obliczanie Geometrii Wirtualnego Arkusza na Ekranie ───

    public calculateSheetLayout(): SheetScreenLayout {
        const dims = PAPER_FORMATS[this.paperFormat] || PAPER_FORMATS['A4_LANDSCAPE'];
        const paperW = dims.width;
        const paperH = dims.height;
        const sheetAspect = paperW / paperH;

        // Dostępny obszar na ekranie (z uwzględnieniem panelu bocznego po prawej)
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const sidebarW = 346; // szerokość panelu edycji CAD
        const topBarH = 50;   // pasek górny
        const marginX = 30;
        const marginY = 30;

        const usableLeft = marginX;
        const usableTop = topBarH + marginY;
        const usableWidth = Math.max(300, screenW - sidebarW - 2 * marginX);
        const usableHeight = Math.max(300, screenH - topBarH - 2 * marginY);

        let sheetPixelW = usableWidth;
        let sheetPixelH = usableWidth / sheetAspect;

        if (sheetPixelH > usableHeight) {
            sheetPixelH = usableHeight;
            sheetPixelW = usableHeight * sheetAspect;
        }

        const sheetPixelX = usableLeft + (usableWidth - sheetPixelW) / 2;
        const sheetPixelY = usableTop + (usableHeight - sheetPixelH) / 2;
        const scale = sheetPixelW / paperW; // piksele na mm

        // Ramka rysunkowa CAD (margines lewy 20 mm, pozostałe 5 mm)
        const framePixelX = sheetPixelX + MARGIN_LEFT * scale;
        const framePixelY = sheetPixelY + MARGIN_TOP * scale;
        const framePixelW = (paperW - MARGIN_LEFT - MARGIN_RIGHT) * scale;
        const framePixelH = (paperH - MARGIN_TOP - MARGIN_BOTTOM) * scale;

        // Wewnętrzny obszar roboczy (3 mm odsunięcia wewnątrz ramki)
        const imgMargin = 3;
        const drawPixelX = framePixelX + imgMargin * scale;
        const drawPixelY = framePixelY + imgMargin * scale;
        const drawPixelW = framePixelW - 2 * imgMargin * scale;
        const drawPixelH = framePixelH - 2 * imgMargin * scale;

        // Tabelka rysunkowa ISO 7200 w prawym dolnym rogu ramki
        const tbPixelW = TITLE_BLOCK_WIDTH * scale;
        const tbPixelH = TITLE_BLOCK_HEIGHT * scale;
        const tbPixelX = framePixelX + framePixelW - tbPixelW;
        const tbPixelY = framePixelY + framePixelH - tbPixelH;

        return {
            sheetPixelX,
            sheetPixelY,
            sheetPixelW,
            sheetPixelH,
            scale,
            framePixelX,
            framePixelY,
            framePixelW,
            framePixelH,
            drawPixelX,
            drawPixelY,
            drawPixelW,
            drawPixelH,
            tbPixelX,
            tbPixelY,
            tbPixelW,
            tbPixelH,
        };
    }

    // ─── Wirtualny Arkusz na Scenie 3D (HUD Overlay) ───

    public updatePassepartout(): void {
        const isExportTab = ContextManager.instance?.activeTab === 'tab-e1-export';
        if (!this.showBounds || !isExportTab) {
            if (this._passepartoutElement) {
                this._passepartoutElement.remove();
                this._passepartoutElement = null;
            }
            return;
        }

        const layout = this.calculateSheetLayout();
        const dims = PAPER_FORMATS[this.paperFormat] || PAPER_FORMATS['A4_LANDSCAPE'];
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        if (!this._passepartoutElement) {
            this._passepartoutElement = document.createElement('div');
            this._passepartoutElement.id = 'export-virtual-sheet-hud';
            this._passepartoutElement.style.position = 'fixed';
            this._passepartoutElement.style.top = '0';
            this._passepartoutElement.style.left = '0';
            this._passepartoutElement.style.width = '100vw';
            this._passepartoutElement.style.height = '100vh';
            this._passepartoutElement.style.pointerEvents = 'none';
            this._passepartoutElement.style.zIndex = '9';
            document.body.appendChild(this._passepartoutElement);
        }

        const {
            sheetPixelX: sx,
            sheetPixelY: sy,
            sheetPixelW: sw,
            sheetPixelH: sh,
            framePixelX: fx,
            framePixelY: fy,
            framePixelW: fw,
            framePixelH: fh,
            tbPixelX: tbx,
            tbPixelY: tby,
            tbPixelW: tbw,
            tbPixelH: tbh,
            scale,
        } = layout;

        const innerInset = 1.0 * scale; // 1mm odsunięcie wewnętrznej ramki
        const ifx = fx + innerInset;
        const ify = fy + innerInset;
        const ifw = fw - 2 * innerInset;
        const ifh = fh - 2 * innerInset;

        const titleDisplayName = this.titleBlock.furnitureName || this.titleBlock.projectName || 'Mebel CAD';
        const author = this.titleBlock.author || 'SmartBox';
        const dateStr = this.titleBlock.date || '';
        const scaleStr = this.titleBlock.scale || '1:10';
        const drawingNr = this.titleBlock.drawingNumber || 'SB-001';
        const remarks = this.notes || this.titleBlock.remarks || '—';
        const formatLabel = this.paperFormat.split('_')[0];

        // Wygenerowanie czystego kodu SVG dla wirtualnego arkusza
        this._passepartoutElement.innerHTML = `
            <svg width="100%" height="100%" viewBox="0 0 ${winW} ${winH}" style="display:block; width:100vw; height:100vh;">
                <defs>
                    <!-- Maska Passepartout: przyciemnia wszystko poza obszarem arkusza -->
                    <mask id="passepartout-mask">
                        <rect x="0" y="0" width="${winW}" height="${winH}" fill="white" />
                        <rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${sw.toFixed(1)}" height="${sh.toFixed(1)}" fill="black" rx="2" />
                    </mask>
                </defs>

                <!-- Przyciemnione tło passepartout poza arkuszem -->
                <rect x="0" y="0" width="${winW}" height="${winH}" fill="rgba(15, 23, 42, 0.72)" mask="url(#passepartout-mask)" />

                <!-- Biała obwódka formatki papieru -->
                <rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${sw.toFixed(1)}" height="${sh.toFixed(1)}"
                      fill="none" stroke="rgba(255, 255, 255, 0.9)" stroke-width="1.5" stroke-dasharray="6,4" rx="2" />

                <!-- Etykieta formatu u góry arkusza -->
                <g transform="translate(${sx.toFixed(1)}, ${(sy - 8).toFixed(1)})">
                    <rect x="0" y="-18" width="${(dims.label.length * 7 + 100).toFixed(0)}" height="20" fill="rgba(37, 99, 235, 0.9)" rx="4" />
                    <text x="8" y="-4" fill="#ffffff" font-size="11" font-family="'Segoe UI', sans-serif" font-weight="bold">
                        📄 ${dims.label} (${dims.description}) • ${this.projectionType === 'ORTHO' ? 'Ortogonalny CAD' : 'Perspektywa 3D'}
                    </text>
                </g>

                <!-- Podwójna Ramka Rysunkowa CAD -->
                <!-- Ramka zewnętrzna gruba (0.7 mm do skali) -->
                <rect x="${fx.toFixed(1)}" y="${fy.toFixed(1)}" width="${fw.toFixed(1)}" height="${fh.toFixed(1)}"
                      fill="none" stroke="rgba(59, 130, 246, 0.9)" stroke-width="${Math.max(1.5, 0.7 * scale).toFixed(1)}" />

                <!-- Ramka wewnętrzna cienka (0.25 mm do skali) -->
                <rect x="${ifx.toFixed(1)}" y="${ify.toFixed(1)}" width="${ifw.toFixed(1)}" height="${ifh.toFixed(1)}"
                      fill="none" stroke="rgba(96, 165, 250, 0.6)" stroke-width="${Math.max(1, 0.25 * scale).toFixed(1)}" />

                <!-- Wirtualna Tabelka Rysunkowa ISO 7200 na żywo w prawym dolnym rogu -->
                <g transform="translate(${tbx.toFixed(1)}, ${tby.toFixed(1)})">
                    <!-- Półprzezroczyste białe tło tabelki -->
                    <rect x="0" y="0" width="${tbw.toFixed(1)}" height="${tbh.toFixed(1)}"
                          fill="rgba(255, 255, 255, 0.92)" stroke="rgba(30, 41, 59, 0.9)" stroke-width="1.2" />

                    <!-- Podział wierszy tabelki -->
                    <line x1="0" y1="${(12 * scale).toFixed(1)}" x2="${tbw.toFixed(1)}" y2="${(12 * scale).toFixed(1)}" stroke="#cbd5e1" stroke-width="0.8" />
                    <line x1="0" y1="${(21 * scale).toFixed(1)}" x2="${tbw.toFixed(1)}" y2="${(21 * scale).toFixed(1)}" stroke="#cbd5e1" stroke-width="0.8" />
                    <line x1="${(80 * scale).toFixed(1)}" y1="0" x2="${(80 * scale).toFixed(1)}" y2="${tbh.toFixed(1)}" stroke="#cbd5e1" stroke-width="0.8" />
                    <line x1="${(100 * scale).toFixed(1)}" y1="${(21 * scale).toFixed(1)}" x2="${(100 * scale).toFixed(1)}" y2="${tbh.toFixed(1)}" stroke="#cbd5e1" stroke-width="0.8" />

                    <!-- Teksty i dane tabelki -->
                    <text x="4" y="${(4 * scale).toFixed(1)}" font-size="${(1.4 * scale).toFixed(1)}" fill="#64748b" font-family="'Segoe UI', sans-serif">Nazwa projektu / mebla</text>
                    <text x="4" y="${(9.5 * scale).toFixed(1)}" font-size="${(3.2 * scale).toFixed(1)}" fill="#0f172a" font-family="'Segoe UI', sans-serif" font-weight="bold">${titleDisplayName}</text>

                    <text x="${(82 * scale).toFixed(1)}" y="${(4 * scale).toFixed(1)}" font-size="${(1.4 * scale).toFixed(1)}" fill="#64748b" font-family="'Segoe UI', sans-serif">Nr rysunku</text>
                    <text x="${(82 * scale).toFixed(1)}" y="${(9.5 * scale).toFixed(1)}" font-size="${(2.8 * scale).toFixed(1)}" fill="#0f172a" font-family="'Segoe UI', sans-serif" font-weight="bold">${drawingNr}</text>

                    <text x="4" y="${(14.5 * scale).toFixed(1)}" font-size="${(1.3 * scale).toFixed(1)}" fill="#64748b" font-family="'Segoe UI', sans-serif">Wykonał: <tspan fill="#0f172a" font-weight="600">${author}</tspan></text>
                    <text x="${(82 * scale).toFixed(1)}" y="${(14.5 * scale).toFixed(1)}" font-size="${(1.3 * scale).toFixed(1)}" fill="#64748b" font-family="'Segoe UI', sans-serif">Data: <tspan fill="#0f172a" font-weight="600">${dateStr}</tspan></text>

                    <text x="4" y="${(23.5 * scale).toFixed(1)}" font-size="${(1.3 * scale).toFixed(1)}" fill="#64748b" font-family="'Segoe UI', sans-serif">Uwagi: <tspan fill="#0f172a">${remarks}</tspan></text>
                    <text x="${(82 * scale).toFixed(1)}" y="${(23.5 * scale).toFixed(1)}" font-size="${(1.3 * scale).toFixed(1)}" fill="#64748b" font-family="'Segoe UI', sans-serif">Skala: <tspan fill="#0f172a" font-weight="bold">${scaleStr}</tspan></text>
                    <text x="${(102 * scale).toFixed(1)}" y="${(23.5 * scale).toFixed(1)}" font-size="${(1.3 * scale).toFixed(1)}" fill="#64748b" font-family="'Segoe UI', sans-serif">Format: <tspan fill="#0f172a" font-weight="bold">${formatLabel}</tspan></text>

                    <text x="${(tbw - 3).toFixed(1)}" y="${(tbh - 2).toFixed(1)}" font-size="${(1.2 * scale).toFixed(1)}" fill="#94a3b8" text-anchor="end" font-family="'Segoe UI', sans-serif">SmartBox CAD</text>
                </g>
            </svg>
        `;
    }

    // ─── Szybkie Presety Kamery CAD ───

    public setCameraPreset(preset: 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'isometric'): void {
        const viewport = ContextManager.instance?.viewport;
        if (!viewport?.camera) return;

        const cam = viewport.camera;
        switch (preset) {
            case 'front':
                cam.alpha = Math.PI / 2;
                cam.beta = Math.PI / 2;
                break;
            case 'back':
                cam.alpha = -Math.PI / 2;
                cam.beta = Math.PI / 2;
                break;
            case 'top':
                cam.alpha = Math.PI / 2;
                cam.beta = 0.001;
                break;
            case 'bottom':
                cam.alpha = Math.PI / 2;
                cam.beta = Math.PI - 0.001;
                break;
            case 'left':
                cam.alpha = Math.PI;
                cam.beta = Math.PI / 2;
                break;
            case 'right':
                cam.alpha = 0;
                cam.beta = Math.PI / 2;
                break;
            case 'isometric':
                cam.alpha = Math.PI / 4;
                cam.beta = Math.PI / 3;
                break;
        }

        if (typeof viewport._updateOrthographicBounds === 'function') {
            viewport._updateOrthographicBounds();
        }
        this._notify();
    }

    public zoomFit(): void {
        const api = ContextManager.instance?.appAPI;
        if (api && typeof api.zoomFit === 'function') {
            api.zoomFit();
        }
    }

    // ─── Precyzyjne Wycinanie i Przechwytywanie Kadru z Canvasu 3D ───

    public async captureCroppedViewport(sheet: DrawingSheet): Promise<string> {
        const viewport = ContextManager.instance?.viewport;
        if (!viewport || !viewport.canvas) {
            throw new Error('Brak aktywnego widoku 3D.');
        }

        // Ukryj tymczasowo HUD Passepartout, aby nie pojawił się na renderze
        if (this._passepartoutElement) {
            this._passepartoutElement.style.display = 'none';
        }

        try {
            // Wymuś czyste białe tło i wyłączenie siatek podłogowych na zrzucie
            this.applyVisualSettings();

            const canvas = viewport.canvas;
            const engine = viewport.engine;
            const camera = viewport.camera;
            const layout = this.calculateSheetLayout();

            // Przeliczenie współrzędnych ekranowych na fizyczne piksele bufora canvasu
            const rect = canvas.getBoundingClientRect();
            const ratioX = canvas.width / rect.width;
            const ratioY = canvas.height / rect.height;

            // Wycinek odpowiadający dokładnie wewnętrznemu obszarowi roboczemu arkusza
            const cropScreenX = layout.drawPixelX - rect.left;
            const cropScreenY = layout.drawPixelY - rect.top;
            const cropScreenW = layout.drawPixelW;
            const cropScreenH = layout.drawPixelH;

            const cropBufferX = Math.max(0, Math.round(cropScreenX * ratioX));
            const cropBufferY = Math.max(0, Math.round(cropScreenY * ratioY));
            const cropBufferW = Math.min(canvas.width - cropBufferX, Math.round(cropScreenW * ratioX));
            const cropBufferH = Math.min(canvas.height - cropBufferY, Math.round(cropScreenH * ratioY));

            let baseSnapshotUrl = '';

            // Używamy oficjalnej asynchronicznej metody Babylon.js kompatybilnej z WebGPU i WebGL
            if (typeof BABYLON !== 'undefined' && BABYLON.Tools?.CreateScreenshotAsync && engine && camera) {
                try {
                    baseSnapshotUrl = await BABYLON.Tools.CreateScreenshotAsync(
                        engine,
                        camera,
                        { width: canvas.width, height: canvas.height },
                        'image/png'
                    );
                } catch (bjsErr) {
                    console.warn('CreateScreenshotAsync ostrzeżenie, fallback do CreateScreenshotUsingRenderTargetAsync:', bjsErr);
                    if (BABYLON.Tools?.CreateScreenshotUsingRenderTargetAsync) {
                        baseSnapshotUrl = await BABYLON.Tools.CreateScreenshotUsingRenderTargetAsync(
                            engine,
                            camera,
                            { width: canvas.width, height: canvas.height },
                            'image/png'
                        );
                    }
                }
            }

            // Fallback dla WebGL (jeśli CreateScreenshotAsync nie zwrócił danych)
            if (!baseSnapshotUrl) {
                if (viewport.scene) {
                    viewport.scene.render();
                }
                baseSnapshotUrl = canvas.toDataURL('image/png', 1.0);
            }

            if (!baseSnapshotUrl || cropBufferW <= 0 || cropBufferH <= 0) {
                return baseSnapshotUrl || '';
            }

            // Przycinamy zrzut do wewnętrznego obszaru roboczego arkusza
            return new Promise<string>((resolve) => {
                const fullImg = new Image();
                fullImg.onload = () => {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = cropBufferW;
                    tempCanvas.height = cropBufferH;
                    const ctx = tempCanvas.getContext('2d');
                    if (!ctx) {
                        resolve(baseSnapshotUrl);
                        return;
                    }
                    ctx.drawImage(
                        fullImg,
                        cropBufferX,
                        cropBufferY,
                        cropBufferW,
                        cropBufferH,
                        0,
                        0,
                        cropBufferW,
                        cropBufferH
                    );
                    resolve(tempCanvas.toDataURL('image/png', 1.0));
                };
                fullImg.onerror = () => {
                    resolve(baseSnapshotUrl);
                };
                fullImg.src = baseSnapshotUrl;
            });
        } finally {
            if (this._passepartoutElement) {
                this._passepartoutElement.style.display = 'block';
            }
        }
    }

    // ─── Wymiary PMI i Tabela BOM ───

    public projectPMIToSvg(sheet: DrawingSheet): void {
        if (!this.includePMI) return;

        try {
            const store = PMIStore.instance;
            if (!store) return;

            const annotations = (store.annotations || []).filter((a) => a.visible !== false);
            const measurements = (store.measurements || []).filter((m) => m.visible !== false);
            if (annotations.length === 0 && measurements.length === 0) return;

            const area = sheet.getAvailableDrawingArea();
            const viewport = ContextManager.instance?.viewport;
            if (!viewport?.scene || !viewport.camera) return;

            const scene = viewport.scene;
            const camera = viewport.camera;
            const canvas = viewport.canvas;
            if (!canvas) return;

            const layout = this.calculateSheetLayout();
            const rect = canvas.getBoundingClientRect();

            const svgElements: string[] = [];

            const processPoints = (w1: { x: number; y: number; z: number }, w2: { x: number; y: number; z: number }, text: string) => {
                const p1 = new BABYLON.Vector3(w1.x, w1.y, w1.z);
                const p2 = new BABYLON.Vector3(w2.x, w2.y, w2.z);

                const scr1 = BABYLON.Vector3.Project(
                    p1,
                    BABYLON.Matrix.Identity(),
                    scene.getTransformMatrix(),
                    camera.viewport.toGlobal(canvas.width, canvas.height)
                );

                const scr2 = BABYLON.Vector3.Project(
                    p2,
                    BABYLON.Matrix.Identity(),
                    scene.getTransformMatrix(),
                    camera.viewport.toGlobal(canvas.width, canvas.height)
                );

                if (scr1.z > 1.0 || scr2.z > 1.0) return;

                const screenX1 = (scr1.x / canvas.width) * rect.width;
                const screenY1 = (scr1.y / canvas.height) * rect.height;
                const screenX2 = (scr2.x / canvas.width) * rect.width;
                const screenY2 = (scr2.y / canvas.height) * rect.height;

                const relX1 = (screenX1 - (layout.drawPixelX - rect.left)) / layout.drawPixelW;
                const relY1 = (screenY1 - (layout.drawPixelY - rect.top)) / layout.drawPixelH;
                const relX2 = (screenX2 - (layout.drawPixelX - rect.left)) / layout.drawPixelW;
                const relY2 = (screenY2 - (layout.drawPixelY - rect.top)) / layout.drawPixelH;

                if (relX1 < 0 || relX1 > 1 || relY1 < 0 || relY1 > 1) return;

                const svgX1 = area.x + relX1 * area.width;
                const svgY1 = area.y + relY1 * area.height;
                const svgX2 = area.x + relX2 * area.width;
                const svgY2 = area.y + relY2 * area.height;

                const midX = (svgX1 + svgX2) / 2;
                const midY = (svgY1 + svgY2) / 2;

                svgElements.push(
                    `<line x1="${svgX1.toFixed(2)}" y1="${svgY1.toFixed(2)}" x2="${svgX2.toFixed(2)}" y2="${svgY2.toFixed(2)}" stroke="#2563eb" stroke-width="0.35" stroke-dasharray="1,1"/>`
                );
                svgElements.push(
                    `<circle cx="${svgX1.toFixed(2)}" cy="${svgY1.toFixed(2)}" r="0.6" fill="#2563eb"/>`
                );
                svgElements.push(
                    `<circle cx="${svgX2.toFixed(2)}" cy="${svgY2.toFixed(2)}" r="0.6" fill="#2563eb"/>`
                );
                svgElements.push(
                    `<rect x="${(midX - 8).toFixed(2)}" y="${(midY - 2.5).toFixed(2)}" width="16" height="4.5" fill="#ffffff" stroke="#2563eb" stroke-width="0.2" rx="0.5"/>`
                );
                svgElements.push(
                    `<text x="${midX.toFixed(2)}" y="${midY.toFixed(2)}" font-size="2.2" font-weight="bold" fill="#1e293b" text-anchor="middle" dominant-baseline="middle">${text}</text>`
                );
            };

            // Rzutowanie adnotacji
            annotations.forEach((ann) => {
                const w1 = resolveAnchorWorld(scene, ann.anchor1);
                const w2 = resolveAnchorWorld(scene, ann.anchor2);
                if (!w1 || !w2) return;
                const label = ann.text || (ann.distanceMM ? `${ann.distanceMM.toFixed(1)} mm` : '');
                processPoints(w1, w2, label);
            });

            // Rzutowanie miarek
            measurements.forEach((msr) => {
                const w1 = resolveAnchorWorld(scene, msr.anchor1);
                const w2 = resolveAnchorWorld(scene, msr.anchor2);
                if (!w1 || !w2) return;
                const label = msr.text || (msr.distanceMM ? `${msr.distanceMM.toFixed(1)} mm` : '');
                processPoints(w1, w2, label);
            });

            if (svgElements.length > 0) {
                sheet.addSvgOverlay(svgElements.join('\n'));
            }
        } catch (err) {
            console.warn('Błąd podczas rzutowania PMI na arkusz SVG:', err);
        }
    }

    public extractBOMRows(): BOMRow[] {
        const doc = ContextManager.instance?.document;
        if (!doc) return [];

        const rows: BOMRow[] = [];
        const traverse = (node: any) => {
            if (!node) return;
            if (node.type === 'PANEL' || (node.name && node.name.includes('Płyta'))) {
                const params = node.parameters || node.params || {};
                rows.push({
                    name: node.name || 'Formatka',
                    material: node.materialName || params.material || 'Laminat 18mm',
                    length: params.height || params.length || 720,
                    width: params.width || 560,
                    thickness: params.thickness || 18,
                    qty: 1,
                    edge_config: node.edge_config || params.edge_config,
                });
            }
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(traverse);
            }
        };

        if (doc.rootNode) {
            traverse(doc.rootNode);
        }

        return rows;
    }

    // ─── Generowanie Gotowego Arkusza z Przyciętym Kadrem ───

    public async generateCurrentDrawingSheet(): Promise<DrawingSheet> {
        const sheet = new DrawingSheet(this.paperFormat);
        sheet.setProjectInfo({
            ...this.titleBlock,
            remarks: this.notes || this.titleBlock.remarks,
        });

        // 1. Zrzut wyciętego kadru 3D
        const croppedSnapshot = await this.captureCroppedViewport(sheet);
        sheet.setViewportImage(croppedSnapshot);

        // 2. Nakładka PMI (wektorowe wymiary w kadrze)
        if (this.includePMI) {
            this.projectPMIToSvg(sheet);
        }

        // 3. Tabela BOM
        if (this.includeBOM) {
            const bomRows = this.extractBOMRows();
            sheet.setBomData(bomRows);
        }

        return sheet;
    }

    // ─── Zapisane Widoki (Saved Views & Multi-Sheet) ───

    public async saveCurrentViewWithThumbnail(customName?: string, description?: string): Promise<SavedExportView> {
        const viewport = ContextManager.instance?.viewport;
        const cam = viewport?.camera;

        let thumbnail: string | undefined = undefined;
        try {
            const sheet = new DrawingSheet(this.paperFormat);
            thumbnail = await this.captureCroppedViewport(sheet);
        } catch (e) {
            console.warn('Nie udało się przechwycić miniaturki arkusza:', e);
        }

        const newView: SavedExportView = {
            id: 'view_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            name: customName || `Arkusz ${this.savedViews.length + 1}`,
            createdAt: new Date().toISOString(),
            paperFormat: this.paperFormat,
            projectionType: this.projectionType,
            cameraAlpha: cam ? cam.alpha : Math.PI / 4,
            cameraBeta: cam ? cam.beta : Math.PI / 3,
            cameraRadius: cam ? cam.radius : 1500,
            cameraTarget: cam && cam.target ? [cam.target.x, cam.target.y, cam.target.z] : [300, 600, 250],
            notes: this.notes,
            description: description || '',
            thumbnail,
            includeBOM: this.includeBOM,
            includePMI: this.includePMI,
            titleBlock: { ...this.titleBlock },
        };

        this.savedViews.push(newView);
        this.saveSavedViews();
        this._notify();
        return newView;
    }

    public saveCurrentView(customName?: string): SavedExportView {
        const viewport = ContextManager.instance?.viewport;
        const cam = viewport?.camera;

        const newView: SavedExportView = {
            id: 'view_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            name: customName || `Arkusz ${this.savedViews.length + 1}`,
            createdAt: new Date().toISOString(),
            paperFormat: this.paperFormat,
            projectionType: this.projectionType,
            cameraAlpha: cam ? cam.alpha : Math.PI / 4,
            cameraBeta: cam ? cam.beta : Math.PI / 3,
            cameraRadius: cam ? cam.radius : 1500,
            cameraTarget: cam && cam.target ? [cam.target.x, cam.target.y, cam.target.z] : [300, 600, 250],
            notes: this.notes,
            includeBOM: this.includeBOM,
            includePMI: this.includePMI,
            titleBlock: { ...this.titleBlock },
        };

        this.savedViews.push(newView);
        this.saveSavedViews();
        this._notify();
        return newView;
    }

    /**
     * Automatycznie generuje standardowy zestaw 4 arkuszy rysunkowych CAD (SolidWorks style):
     * 1. Rzut z Przodu (Front View)
     * 2. Rzut z Góry (Top View)
     * 3. Rzut z Boku (Side View)
     * 4. Izometria CAD z Tabelą BOM (Isometric + BOM)
     */
    public clearSavedViews(): void {
        this.savedViews = [];
        this.saveSavedViews();
        this._notify();
    }

    public replaceSavedViews(views: SavedExportView[]): void {
        this.savedViews = Array.isArray(views)
            ? views.map((view) => ({
                ...view,
                titleBlock: { ...(view.titleBlock || {}) },
                cameraTarget: (view.cameraTarget ? [...view.cameraTarget] : [0, 0, 0]) as [number, number, number],
            }))
            : [];
        this.saveSavedViews();
        this._notify();
    }

    public duplicateSavedView(id: string): SavedExportView | null {
        const view = this.savedViews.find((v) => v.id === id);
        if (!view) return null;

        const copy: SavedExportView = {
            ...JSON.parse(JSON.stringify(view)),
            id: 'view_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            name: `${view.name} (Kopia)`,
            createdAt: new Date().toISOString(),
        };

        this.savedViews.push(copy);
        this.saveSavedViews();
        this._notify();
        return copy;
    }

    public applySavedView(view: SavedExportView): void {
        this.paperFormat = view.paperFormat;
        this.projectionType = view.projectionType;
        this.notes = view.notes;
        this.includeBOM = view.includeBOM;
        this.includePMI = view.includePMI;
        if (view.titleBlock) {
            this.titleBlock = { ...this.titleBlock, ...view.titleBlock };
        }

        const viewport = ContextManager.instance?.viewport;
        if (viewport?.camera) {
            const cam = viewport.camera;
            cam.alpha = view.cameraAlpha;
            cam.beta = view.cameraBeta;
            cam.radius = view.cameraRadius;
            if (view.cameraTarget) {
                cam.target = new BABYLON.Vector3(view.cameraTarget[0], view.cameraTarget[1], view.cameraTarget[2]);
            }
            this.setProjectionType(view.projectionType);
        }

        this.updatePassepartout();
        this._notify();
    }

    public deleteSavedView(id: string): void {
        this.savedViews = this.savedViews.filter((v) => v.id !== id);
        this.saveSavedViews();
        this._notify();
    }

    public renameSavedView(id: string, newName: string): void {
        const view = this.savedViews.find((v) => v.id === id);
        if (view) {
            view.name = newName;
            this.saveSavedViews();
            this._notify();
        }
    }

    public updateSavedViewFormat(id: string, newFormat: PaperFormat): void {
        const view = this.savedViews.find((v) => v.id === id);
        if (view) {
            view.paperFormat = newFormat;
            this.paperFormat = newFormat;
            this.updatePassepartout();
            this.saveSavedViews();
            this._notify();
        }
    }

    public async printAllSheetsMultiPage(): Promise<void> {
        if (this.savedViews.length === 0) return;

        const sheets: DrawingSheet[] = [];
        for (let i = 0; i < this.savedViews.length; i++) {
            const view = this.savedViews[i];
            this.applySavedView(view);
            await new Promise((r) => setTimeout(r, 200));

            const sheet = await this.generateCurrentDrawingSheet();
            sheet.setProjectInfo({
                sheetNumber: `${i + 1}/${this.savedViews.length}`,
            });
            sheets.push(sheet);
        }

        DrawingSheet.printMultiSheet(sheets);
    }

    public async batchExportAllViews(): Promise<number> {
        if (this.savedViews.length === 0) return 0;

        let count = 0;
        for (let i = 0; i < this.savedViews.length; i++) {
            const view = this.savedViews[i];
            this.applySavedView(view);
            await new Promise((r) => setTimeout(r, 200));

            const sheet = await this.generateCurrentDrawingSheet();
            sheet.setProjectInfo({
                sheetNumber: `${i + 1}/${this.savedViews.length}`,
            });
            const safeName = view.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            sheet.downloadSvg(`Arkusz_${i + 1}_${safeName}.svg`);
            count++;
        }
        return count;
    }

    private loadSavedViews(): void {
        try {
            // Usuwamy stare klucze jeśli istniały w przeglądarce
            localStorage.removeItem('smartbox_cad_export_saved_views');
            localStorage.removeItem('smartbox_cad_export_saved_views_v1');
            localStorage.removeItem('smartbox_cad_manual_sheets_v2');
            const raw = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
            if (raw) {
                this.savedViews = JSON.parse(raw);
            } else {
                this.savedViews = [];
            }
        } catch (e) {
            console.warn('Nie udało się wczytać zapisanych arkuszy:', e);
            this.savedViews = [];
        }
    }

    private saveSavedViews(): void {
        try {
            localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(this.savedViews));
        } catch (e) {
            console.warn('Nie udało się zapisać arkuszy do localStorage:', e);
        }
    }
}

