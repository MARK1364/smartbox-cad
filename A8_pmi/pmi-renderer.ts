/**
 * PMI Renderer — TypeScript / Babylon.js
 *
 * Rysuje wymiary CAD w scenie 3D Babylon.js:
 * - Linie wymiarowe (główna + pomocnicze)
 * - Groty strzałek (triangulated cones)
 * - Etykiety tekstowe w 3D (Billboard DynamicTexture - 100% WebGPU/WebGL2 compatible)
 *
 * WYDAJNOŚĆ: `renderAll()` bywa wołane co klatkę (przeciąganie formatki gizmem),
 * więc siatki i tekstury są aktualizowane w miejscu. Kosztowną `DynamicTexture`
 * przebudowujemy dopiero, gdy zmieni się tekst albo kolor etykiety.
 */

declare const BABYLON: any;

import { Vec3, v3, v3Add, v3Scale, v3Sub, v3Len, v3Dot, v3Cross, v3Normalize } from './dimension-solver';
import { BridgeRenderData, helperSegmentsFromRenderData } from './pmi-bridge';
import { PMIAnnotation, PMIStore, formatDistance, formatMeasureText } from './pmi-data';
import { beginResolveBatch, endResolveBatch } from './pmi-id-bridge';
import { resolvePMIForRender } from './pmi-resolve';
import { measureDeltaSegments, pathLength } from './pmi-measure';
import {
    MEASURE_MAX_PX,
    MEASURE_MIN_PX,
    pixelsPerMMAtScene,
} from './pmi-screen-scale';
import { LABEL_OVERLAP_PAD_PX, resolveLabelOverlaps, ScreenLabel } from './pmi-label-layout';

// ============================================================================
// RENDER CONFIG — CAD Black Theme (Wysoki Kontrast)
// ============================================================================

type Rgba = [number, number, number, number];

const DIM_COLOR_PREVIEW: Rgba = [0.05, 0.45, 0.95, 1.0];   // Niebieski CAD dla podglądu na żywo
const HELPER_COLOR: Rgba = [0.15, 0.15, 0.15, 0.95];     // Linie pomocnicze — ciemne, widoczne
const TEXT_COLOR_PREVIEW = '#0284C7';

const PREVIEW_ID = '__pmi_preview__';
const MEASURE_PREVIEW_ID = '__pmi_measure_preview__';

const MEASURE_COLOR: Rgba = [1.0, 0.55, 0.0, 1.0];
/** Bazowa wysokość tekstu etykiety miarki w przestrzeni CAD [mm]. */
export const MEASURE_BASE_TEXT_H = 20;

/**
 * Oblicza bazowe wymiary plakietki miarki [mm] na podstawie liczby i długości linii.
 */
export function computeMeasureLabelDimensions(lines: string[]): {
    textHWorld: number;
    planeW: number;
    planeH: number;
} {
    const textHWorld = MEASURE_BASE_TEXT_H;
    const lineH = textHWorld * 0.9;
    const textWWorld = Math.max(...lines.map(l => l.length * textHWorld * 0.62), 16);
    const totalH = lineH * lines.length;
    const padWorld = textHWorld * 0.2;
    const planeW = textWWorld + padWorld * 2;
    const planeH = totalH + padWorld * 2;
    return { textHWorld, planeW, planeH };
}

/**
 * Oblicza współczynnik skali 3D, aby etykieta miarki miała optymalną, stabilną
 * wysokość na ekranie [px], zapobiegając rozrastaniu się na pół ekranu przy zoomie.
 */
export function computeMeasureScreenScale(
    basePlaneH: number,
    lineCount: number,
    cameraMode: number, // 0 = perspective, 1 = ortho
    renderH: number,
    orthoH: number,
    distanceToCamera?: number,
    cameraFov?: number,
): number {
    let pxPerMM = 0;
    if (cameraMode === 1) { // ortho
        if (orthoH > 1e-4) {
            pxPerMM = renderH / orthoH;
        }
    } else {
        if (distanceToCamera && distanceToCamera > 1e-4) {
            const fov = cameraFov || 0.8;
            const visibleH = 2 * distanceToCamera * Math.tan(fov / 2);
            if (visibleH > 1e-4) {
                pxPerMM = renderH / visibleH;
            }
        }
    }
    if (pxPerMM <= 1e-5 || basePlaneH <= 0) return 1.0;

    // Stały, czytelny rozmiar plakietki na ekranie: 54px (1 linia) do max 132px (4+ linie)
    const targetScreenH = lineCount <= 1 ? 54 : Math.min(lineCount * 24 + 24, 132);
    const currentScreenH = basePlaneH * pxPerMM;
    return targetScreenH / currentScreenH;
}

/** Kolory delt (linie przerywane XYZ). */
const MEASURE_DELTA_COLOR: Record<'X' | 'Y' | 'Z', Rgba> = {
    X: [1.0, 0.3, 0.3, 0.7],
    Y: [0.3, 1.0, 0.3, 0.7],
    Z: [0.4, 0.62, 1.0, 0.8],
};

/** Kolory tekstu etykiety miarki — na białym tle: L czarne, delty w ciemnych barwach osi. */
const MEASURE_TEXT_HEX = {
    L: '#000000',
    L_SELECTED: '#000000',
    X: '#b21f1f',
    Y: '#1e7a1e',
    Z: '#1f4fbf',
} as const;

function measureLabelLineColor(line: string, selected: boolean): string {
    if (line.startsWith('dX:')) return MEASURE_TEXT_HEX.X;
    if (line.startsWith('dY:')) return MEASURE_TEXT_HEX.Y;
    if (line.startsWith('dZ:')) return MEASURE_TEXT_HEX.Z;
    return selected ? MEASURE_TEXT_HEX.L_SELECTED : MEASURE_TEXT_HEX.L;
}

/** Białe tło pod tekst — czytelność wyniku na dowolnym modelu. */
function paintLabelBackground(ctx: CanvasRenderingContext2D, w: number, h: number, radius = 48): void {
    const pad = 18;
    ctx.save();
    ctx.beginPath();
    const x0 = pad, y0 = pad, x1 = w - pad, y1 = h - pad;
    const r = Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2);
    ctx.moveTo(x0 + r, y0);
    ctx.lineTo(x1 - r, y0);
    ctx.arcTo(x1, y0, x1, y0 + r, r);
    ctx.lineTo(x1, y1 - r);
    ctx.arcTo(x1, y1, x1 - r, y1, r);
    ctx.lineTo(x0 + r, y1);
    ctx.arcTo(x0, y1, x0, y1 - r, r);
    ctx.lineTo(x0, y0 + r);
    ctx.arcTo(x0, y0, x0 + r, y0, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fill();
    ctx.restore();
}

/** Wspólne ustawienia ostrej tekstury tekstu (anizotropia + bez mipmap blur). */
function sharpenLabelTexture(dt: any): void {
    try {
        const caps = (dt as any)?.getScene?.()?.getEngine?.()?.getCaps?.();
        const maxAniso = caps?.maxAnisotropy ?? 8;
        dt.anisotropicFilteringLevel = Math.min(8, Math.max(4, maxAniso));
    } catch { /* best-effort */ }
    try {
        const mode = (BABYLON as any)?.Texture?.TRILINEAR_SAMPLINGMODE;
        if (typeof dt.updateSamplingMode === 'function' && typeof mode === 'number') {
            dt.updateSamplingMode(mode);
        }
    } catch { /* best-effort */ }
}

/** Nieoświetlony materiał etykiety — emisja zamiast diffusji = pełna jasność tekstu. */
function makeLabelMaterial(visId: string, dt: any, tag: 'pmi' | 'msr', scene: any): any {
    const mat = new BABYLON.StandardMaterial(`${tag === 'msr' ? 'pmi_msr_lbl_mat_' : 'pmi_lbl_mat_'}${visId}`, scene);
    mat.diffuseTexture = dt;
    try {
        mat.emissiveTexture = dt;
        mat.opacityTexture = dt;
    } catch { /* starsze buildy */ }
    mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;
    if (mat.disableDepthWrite !== undefined && tag === 'msr') mat.disableDepthWrite = true;
    return mat;
}

/** Tolerancja trafienia w cienką linię wymiarową [mm]. */
const DIM_LINE_PICK_THRESHOLD = 12;

function toHexColor(rgba: Rgba): string {
    const channel = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255)
        .toString(16)
        .padStart(2, '0');
    return `#${channel(rgba[0])}${channel(rgba[1])}${channel(rgba[2])}`;
}

// ============================================================================
// DIMENSION VISUAL — one per annotation
// ============================================================================

interface DimVisual {
    id: string;
    dimLineParts: any[];
    helperLineParts: any[];
    arrowMesh1: any;     // Mesh (cone)
    arrowMesh2: any;     // Mesh
    textPlane: any;      // Mesh (Billboard plane)
    textTexture: any;    // DynamicTexture
    /** Ostatnio wypalony tekst i jego kolor — pozwala pominąć odświeżenie tekstury. */
    textCacheKey: string;
    labelPreferredWorld: Vec3 | null;
    labelWidth: number;
    labelHeight: number;
}

interface MeasureVisual {
    id: string;
    mainLineParts: any[];
    deltaLines: any[];
    points: any[];
    textPlane: any;
    textTexture: any;
    textCacheKey: string;
    labelPreferredWorld: Vec3 | null;
    labelWidth: number;
    labelHeight: number;
    basePlaneW?: number;
    basePlaneH?: number;
    lineCount?: number;
    /** Bez delt → rozmiar stały w świecie (jak label wymiaru), a nie stale na ekranie. */
    labelWorldFixed?: boolean;
}

// ============================================================================
// PMI RENDERER
// ============================================================================

export class PMIRenderer {
    private scene: any;
    private visuals: Map<string, DimVisual> = new Map();
    private measureVisuals: Map<string, MeasureVisual> = new Map();
    private previewVisual: DimVisual | null = null;
    private measurePreview: MeasureVisual | null = null;
    private _visible = true;

    constructor(scene: any) {
        this.scene = scene;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    public get visible(): boolean {
        return this._visible;
    }

    /**
     * Przełącza widoczność wszystkich siatek wymiarów i pomiarów w scenie 3D.
     */
    public setVisible(v: boolean): void {
        this._visible = v;
        for (const vis of this.visuals.values()) {
            this.setVisualVisible(vis, v);
        }
        for (const vis of this.measureVisuals.values()) {
            this.setMeasureVisualVisible(vis, v);
        }
        if (!v) {
            this.clearPreview();
        }
    }

    /**
     * Przelicza i rysuje wszystkie zatwierdzone wymiary.
     *
     * Kotwice są rozwiązywane od nowa przy każdym przebiegu, więc wymiary
     * podążają za formatkami, a etykiety pokazują aktualną długość.
     */
    public renderAll(store: PMIStore): void {
        if (!this.scene) return;

        beginResolveBatch();
        try {
            const frame = resolvePMIForRender(this.scene, store);

            const currentIds = new Set(store.annotations.map(a => a.id));
            for (const [id, vis] of this.visuals) {
                if (!currentIds.has(id)) {
                    this.disposeVisual(vis);
                    this.visuals.delete(id);
                }
            }

            for (const entry of frame.annotations) {
                if (!entry.visible || !entry.renderData || !this._visible) {
                    const vis = this.visuals.get(entry.id);
                    if (vis) this.setVisualVisible(vis, false);
                    continue;
                }
                const ann = store.getAnnotation(entry.id);
                if (ann) this.renderAnnotation(ann, entry.renderData, store);
            }

            const currentMeasureIds = new Set(store.measurements.map(m => m.id));
            for (const [id, vis] of this.measureVisuals) {
                if (!currentMeasureIds.has(id)) {
                    this.disposeMeasureVisual(vis);
                    this.measureVisuals.delete(id);
                }
            }

            for (const entry of frame.measurements) {
                if (!entry.visible || !entry.renderData || !this._visible) {
                    const vis = this.measureVisuals.get(entry.id);
                    if (vis) this.setMeasureVisualVisible(vis, false);
                    continue;
                }

                let vis = this.measureVisuals.get(entry.id);
                if (!vis) {
                    vis = this.createMeasureVisual(entry.id);
                    this.measureVisuals.set(entry.id, vis);
                }
                this.updateMeasureVisual(
                    vis,
                    entry.renderData.path,
                    store,
                    entry.id,
                    entry.selected,
                    entry.renderData.labelText,
                );
                this.setMeasureVisualVisible(vis, !this.measurePreview && this._visible);
            }

            if (frame.derivedChanged) store.notifyDerivedChanged();

            this.resolveOverlappingLabels();
        } finally {
            endResolveBatch();
        }
    }

    /**
     * Show live preview during drag (cyan color, no commit).
     */
    public renderPreview(renderData: BridgeRenderData | null): void {
        if (!this.scene) return;

        if (!renderData) {
            this.clearPreview();
            return;
        }

        if (!this.previewVisual) {
            this.previewVisual = this.createVisual(PREVIEW_ID);
        }

        this.updateVisualFromRenderData(
            this.previewVisual,
            renderData,
            DIM_COLOR_PREVIEW,
            TEXT_COLOR_PREVIEW,
            null,
        );
        this.resolveOverlappingLabels();
    }

    public clearPreview(): void {
        if (this.previewVisual) {
            this.disposeVisual(this.previewVisual);
            this.previewVisual = null;
        }
        this.clearMeasurePreview();
    }

    public renderMeasurePreview(path: Vec3[] | null, store: PMIStore = PMIStore.instance): void {
        if (!this.scene || !path || path.length < 2 || pathLength(path) < 0.05) {
            this.clearMeasurePreview();
            return;
        }
        if (!this.measurePreview) {
            this.measurePreview = this.createMeasureVisual(MEASURE_PREVIEW_ID);
        }
        this.updateMeasureVisual(this.measurePreview, path, store, null, false);
        this.setMeasureVisualVisible(this.measurePreview, true);

        // SSOT: Nigdy nie mogą być dwie różne etykiety w tym samym czasie.
        // Gdy aktywny jest podgląd (preview), ukrywamy zatwierdzone pomiary ze store.
        for (const vis of this.measureVisuals.values()) {
            this.setMeasureVisualVisible(vis, false);
        }

        this.resolveOverlappingLabels();
    }

    public clearMeasurePreview(): void {
        if (this.measurePreview) {
            this.disposeMeasureVisual(this.measurePreview);
            this.measurePreview = null;
        }
        if (this._visible) {
            for (const vis of this.measureVisuals.values()) {
                this.setMeasureVisualVisible(vis, true);
            }
        }
    }

    public dispose(): void {
        for (const vis of this.visuals.values()) {
            this.disposeVisual(vis);
        }
        this.visuals.clear();
        for (const vis of this.measureVisuals.values()) {
            this.disposeMeasureVisual(vis);
        }
        this.measureVisuals.clear();
        this.clearPreview();
    }

    // ========================================================================
    // RENDER SINGLE ANNOTATION
    // ========================================================================

    private renderAnnotation(ann: PMIAnnotation, rd: BridgeRenderData, store: PMIStore): void {
        let vis = this.visuals.get(ann.id);
        if (!vis) {
            vis = this.createVisual(ann.id);
            this.visuals.set(ann.id, vis);
        }

        const color = ann.selected ? store.selectedColor : store.dimColor;
        this.updateVisualFromRenderData(vis, rd, color, toHexColor(color), ann.id);
        this.setVisualVisible(vis, true);
    }

    // ========================================================================
    // VISUAL CREATION / UPDATE
    // ========================================================================

    private createVisual(id: string): DimVisual {
        return {
            id,
            dimLineParts: [],
            helperLineParts: [],
            arrowMesh1: null,
            arrowMesh2: null,
            textPlane: null,
            textTexture: null,
            textCacheKey: '',
            labelPreferredWorld: null,
            labelWidth: 0,
            labelHeight: 0,
        };
    }

    private updateVisualFromRenderData(
        vis: DimVisual,
        rd: BridgeRenderData,
        lineColor: Rgba,
        textColor: string,
        annOrId: PMIAnnotation | string | null,
    ): void {
        const annotationId = typeof annOrId === 'string' ? annOrId : (annOrId?.id ?? null);
        const ann = typeof annOrId === 'object' && annOrId !== null
            ? annOrId
            : (annotationId ? PMIStore.instance.getAnnotation(annotationId) : null);

        // Linia wymiarowa kończy się u podstawy grotów (solver przycina o arrowLen),
        // więc stożek nie jest zakrywany czubkiem linii.
        const dimLineA = rd.dimLineP1World ?? rd.p1DimWorld;
        const dimLineB = rd.dimLineP2World ?? rd.p2DimWorld;
        this.updateSegmentTubes(
            vis,
            'dimLineParts',
            [[dimLineA, dimLineB]],
            lineColor,
            rd.thickMain,
            annotationId,
        );

        const helperSegs = helperSegmentsFromRenderData(rd);
        this.updateSegmentTubes(
            vis,
            'helperLineParts',
            helperSegs,
            HELPER_COLOR,
            rd.thickHelper,
            annotationId,
        );

        this.updateArrow(vis, 'arrowMesh1', rd.p1DimWorld, rd.fwdWorld, rd.arrowLen, rd.arrowWid, rd.arrowsOutside, lineColor);
        this.updateArrow(vis, 'arrowMesh2', rd.p2DimWorld, rd.fwdWorld, rd.arrowLen, rd.arrowWid, rd.arrowsOutside, lineColor, true);

        this.updateTextLabel(vis, rd, textColor, annotationId, ann);
    }

    // ========================================================================
    // TUBE SEGMENTS (ISO: linia wymiarowa grubsza od pomocniczej)
    // ========================================================================

    private updateSegmentTubes(
        vis: DimVisual,
        partsKey: 'dimLineParts' | 'helperLineParts',
        segments: [Vec3, Vec3][],
        color: Rgba,
        diameterMM: number,
        annotationId: string | null,
    ): void {
        const parts = vis[partsKey];
        const isDimLine = partsKey === 'dimLineParts';
        const hasHitbox = isDimLine && !!annotationId;

        let partIdx = 0;
        for (let i = 0; i < segments.length; i++) {
            const [a, b] = segments[i];
            const tubeDiam = Math.max(diameterMM, isDimLine ? 0.9 : 0.55);
            const tube = this.updateOrCreateTubeSegment(
                parts[partIdx] ?? null,
                `pmi_${vis.id}_${partsKey}_${i}`,
                a,
                b,
                tubeDiam,
                color,
                annotationId,
                isDimLine ? 'line' : 'helper',
                false,
            );
            if (tube) {
                parts[partIdx] = tube;
                partIdx++;
            }

            // Dla linii wymiarowej tworzymy niewidoczny, wygodny hitbox ułatwiający chwytanie myszą w 3D
            if (hasHitbox) {
                const hitbox = this.updateOrCreateTubeSegment(
                    parts[partIdx] ?? null,
                    `pmi_${vis.id}_hitbox_${i}`,
                    a,
                    b,
                    18, // 18mm średnicy — łatwe chwytanie
                    [0, 0, 0, 0],
                    annotationId,
                    'line',
                    true,
                );
                if (hitbox) {
                    parts[partIdx] = hitbox;
                    partIdx++;
                }
            }
        }

        while (parts.length > partIdx) {
            const excess = parts.pop();
            this.disposeMeshAndMaterial(excess);
        }
    }

    private updateOrCreateTubeSegment(
        existingTube: any | null,
        name: string,
        a: Vec3,
        b: Vec3,
        diameterMM: number,
        color: Rgba,
        annotationId: string | null,
        targetPart: 'line' | 'helper' = 'line',
        isHitbox = false,
    ): any {
        const aB = this.toB(a);
        const bB = this.toB(b);
        const diff = bB.subtract(aB);
        const len = diff.length();
        if (len < 0.05) {
            if (existingTube) {
                existingTube.isVisible = false;
                existingTube.isPickable = false;
            }
            return existingTube;
        }

        const diameter = Math.max(diameterMM, isHitbox ? 18 : 0.55);
        let tube = existingTube;
        if (!tube || tube.isDisposed?.()) {
            tube = BABYLON.MeshBuilder.CreateCylinder(name, {
                height: 1,
                diameter: 1,
                tessellation: 8,
            }, this.scene);
            const mat = new BABYLON.StandardMaterial(`${name}_mat`, this.scene);
            mat.disableLighting = true;
            tube.material = mat;
            tube.renderingGroupId = 2;
        }

        tube.isVisible = true;
        tube.position = BABYLON.Vector3.Lerp(aB, bB, 0.5);
        tube.scaling = new BABYLON.Vector3(diameter, len, diameter);

        const dir = diff.normalize();
        const yAxis = new BABYLON.Vector3(0, 1, 0);
        const dot = BABYLON.Vector3.Dot(yAxis, dir);
        if (Math.abs(dot) > 0.999) {
            tube.rotationQuaternion = null;
            tube.rotation = new BABYLON.Vector3(dot < 0 ? Math.PI : 0, 0, 0);
        } else {
            const axis = BABYLON.Vector3.Cross(yAxis, dir).normalize();
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            tube.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
        }

        if (tube.material) {
            tube.material.diffuseColor = new BABYLON.Color3(color[0], color[1], color[2]);
            tube.material.emissiveColor = new BABYLON.Color3(color[0] * 0.35, color[1] * 0.35, color[2] * 0.35);
            tube.material.alpha = color[3];
        }

        if (isHitbox) {
            tube.visibility = 0;
            tube.isPickable = true;
        } else {
            tube.visibility = 1;
            tube.isPickable = !!annotationId;
        }

        tube.metadata = {
            ...(tube.metadata || {}),
            isPmiOverlay: true,
            ...(annotationId ? { pmiAnnotationId: annotationId, pmiTarget: targetPart } : {}),
        };

        return tube;
    }

    private disposeMeshAndMaterial(mesh: any): void {
        if (!mesh) return;
        mesh.material?.dispose?.();
        mesh.dispose?.();
    }

    private disposeLineParts(parts: any[]): void {
        for (const part of parts) {
            this.disposeMeshAndMaterial(part);
        }
        parts.length = 0;
    }

    // ========================================================================
    // ARROWS (triangulated cones)
    // ========================================================================

    private updateArrow(
        vis: any,
        key: 'arrowMesh1' | 'arrowMesh2',
        tipWorld: Vec3,
        fwdWorld: Vec3,
        arrowLen: number,
        arrowWid: number,
        arrowsOutside: boolean,
        color: Rgba,
        flipDirection = false,
    ): void {
        if (arrowLen < 0.1) {
            if (vis[key]) {
                this.disposeMeshAndMaterial(vis[key]);
                vis[key] = null;
            }
            return;
        }

        let dir = flipDirection ? v3Scale(fwdWorld, -1) : fwdWorld;
        // ISO 129: groty od środka na zewnątrz (ostrze przy linii pomocniczej).
        // `dir` to kierunek od podstawy stożka do ostrza — przy trybie wewnątrz
        // musi iść od środka odcinka ku końcowi. Obecny fwd przy p1 wskazuje
        // do środka, więc odwracamy; przy strzałkach na zewnątrz zostaje.
        if (!arrowsOutside) dir = v3Scale(dir, -1);

        const base = v3Sub(tipWorld, v3Scale(dir, arrowLen));
        const diameter = Math.max(arrowWid * 2.5, 6);

        // Stożek budowany jest raz w rozmiarze jednostkowym, a dopasowywany skalą —
        // dzięki temu zmiana długości grotu nie wymaga odtwarzania siatki.
        if (!vis[key]) {
            vis[key] = BABYLON.MeshBuilder.CreateCylinder(`pmi_${vis.id}_${key}`, {
                height: 1,
                diameterTop: 0,
                diameterBottom: 1,
                tessellation: 16,
            }, this.scene);

            const mat = new BABYLON.StandardMaterial(`pmi_${vis.id}_${key}_mat`, this.scene);
            mat.disableLighting = true;
            mat.backFaceCulling = false;
            vis[key].material = mat;
            vis[key].isPickable = false;
            vis[key].renderingGroupId = 2;
        }

        const cone = vis[key];
        cone.scaling = new BABYLON.Vector3(diameter, arrowLen, diameter);
        cone.isPickable = !!vis.id && vis.id !== PREVIEW_ID;
        cone.metadata = {
            ...(cone.metadata || {}),
            isPmiOverlay: true,
            ...(cone.isPickable ? { pmiAnnotationId: vis.id } : {}),
        };

        const mid = v3Scale(v3Add(tipWorld, base), 0.5);
        cone.position = new BABYLON.Vector3(mid.x, mid.y, mid.z);
        cone.rotation = new BABYLON.Vector3(0, 0, 0);
        cone.lookAt(new BABYLON.Vector3(tipWorld.x, tipWorld.y, tipWorld.z));
        cone.rotation.x += Math.PI / 2;

        const babylonColor = new BABYLON.Color3(color[0], color[1], color[2]);
        cone.material.diffuseColor = babylonColor;
        cone.material.emissiveColor = babylonColor;
    }

    // ========================================================================
    // 3D BILLBOARD TEXT LABELS (DynamicTexture on Plane)
    // ========================================================================

    private updateTextLabel(
        vis: DimVisual,
        rd: BridgeRenderData,
        textColor: string,
        annotationId: string | null,
        ann: PMIAnnotation | null = null,
    ): void {
        if (!rd.labelText) {
            this.disposeTextLabel(vis);
            return;
        }

        const text = rd.labelText;
        const textHWorld = Math.max(PMIStore.instance.textSizeMM, 12); // mm
        const charAspect = 0.65;
        const textWWorld = Math.max(text.length * textHWorld * charAspect, 8);

        const alignToLine = !!PMIStore.instance.alignTextToLine;
        // Wynik na białym tle — tekst zawsze czarny (kolor wymiaru widoczny na liniach).
        const labelColor = '#000000';
        const cacheKey = `${text}|${labelColor}|${textHWorld}|${alignToLine}`;

        if (vis.textCacheKey !== cacheKey) {
            this.disposeTextLabel(vis);
            this.buildTextLabel(vis, text, labelColor, textWWorld, textHWorld, annotationId);
            vis.textCacheKey = cacheKey;
        }

        vis.labelWidth = textWWorld;
        vis.labelHeight = textHWorld;
        if (vis.textPlane && rd.p1DimWorld && rd.p2DimWorld) {
            const mid = v3Scale(v3Add(rd.p1DimWorld, rd.p2DimWorld), 0.5);
            const shiftMM = ann?.textShiftMM ?? (annotationId ? PMIStore.instance.getAnnotation(annotationId)?.textShiftMM ?? 0 : 0);
            const shiftAlongLine = v3Scale(v3Normalize(rd.fwdWorld), shiftMM);
            const midShifted = v3Add(mid, shiftAlongLine);

            if (alignToLine) {
                vis.textPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
                let fwd = v3Normalize(rd.fwdWorld);
                let up = v3Normalize(rd.upWorld);
                let side = v3Cross(fwd, up);
                if (v3Len(side) < 1e-6) {
                    side = v3(0, 0, 1);
                } else {
                    side = v3Normalize(side);
                }

                const camera = this.scene?.activeCamera;
                if (camera) {
                    const camPos = (camera as any).globalPosition ?? camera.position;
                    if (camPos) {
                        const toCam = v3Normalize(v3Sub(v3(camPos.x, camPos.y, camPos.z), midShifted));
                        // Babylon CreatePlane front face has normal (0, 0, -1) in local coords.
                        // When axis3 = side, front normal in world is -side.
                        // We want front face (-side) to face toward camera: dot(-side, toCam) > 0 <=> dot(side, toCam) < 0.
                        if (v3Dot(side, toCam) > 0) {
                            side = v3Scale(side, -1);
                            fwd = v3Scale(fwd, -1);
                        }
                    }

                    // Oblicz osie ekranowe kamery w przestrzeni świata
                    let camUp = v3(0, 1, 0);
                    let camRight = v3(1, 0, 0);
                    try {
                        const viewMat = camera.getViewMatrix();
                        if (viewMat) {
                            const invView = viewMat.clone().invert();
                            camRight = v3Normalize(v3(invView.m[0], invView.m[1], invView.m[2]));
                            camUp = v3Normalize(v3(invView.m[4], invView.m[5], invView.m[6]));
                        }
                    } catch {
                        if (camera.upVector) {
                            camUp = v3Normalize(v3(camera.upVector.x, camera.upVector.y, camera.upVector.z));
                        }
                    }

                    const dotUp = v3Dot(up, camUp);
                    const dotFwdUp = v3Dot(fwd, camUp);

                    // Jeśli wektor góry tekstu celuje w dół ekranu lub linia pionowa czyta się od góry do dołu:
                    // obracamy o 180° w płaszczyźnie wymiaru (odwracamy fwd i up), aby tekst był czytany poprawnie (od lewej do prawej, od dołu do góry)
                    if (dotUp < -0.15 || (Math.abs(dotUp) <= 0.15 && dotFwdUp < -0.15)) {
                        up = v3Scale(up, -1);
                        fwd = v3Scale(fwd, -1);
                    }
                }

                const textOffset = v3Scale(up, rd.arrowWid * 1.5 + textHWorld * 0.55);
                const textPos = v3Add(midShifted, textOffset);
                vis.labelPreferredWorld = textPos;
                vis.textPlane.position = new BABYLON.Vector3(textPos.x, textPos.y, textPos.z);

                const axis1 = new BABYLON.Vector3(fwd.x, fwd.y, fwd.z);
                const axis2 = new BABYLON.Vector3(up.x, up.y, up.z);
                const axis3 = new BABYLON.Vector3(side.x, side.y, side.z);
                vis.textPlane.rotationQuaternion = null;
                vis.textPlane.rotation = BABYLON.Vector3.RotationFromAxis(axis1, axis2, axis3);
            } else {
                const textOffset = v3Scale(rd.upWorld, rd.arrowWid * 2 + textHWorld * 0.6);
                const textPos = v3Add(midShifted, textOffset);
                vis.labelPreferredWorld = textPos;
                vis.textPlane.position = new BABYLON.Vector3(textPos.x, textPos.y, textPos.z);

                vis.textPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
                vis.textPlane.rotationQuaternion = null;
                vis.textPlane.rotation = new BABYLON.Vector3(0, 0, 0);
            }
        }
    }

    private buildTextLabel(
        vis: DimVisual,
        text: string,
        textColor: string,
        textWWorld: number,
        textHWorld: number,
        annotationId: string | null,
    ): void {
        // Tekstura dopasowana proporcją do płaszczyzny — brak zniekształceń tekstu.
        const planeW = textWWorld + 6;
        const planeH = textHWorld + 4;
        const density = 8; // px/mm — 256px na 32mm wysokości = ostre przy typowym zoomie
        const texWidth = Math.max(256, Math.min(4096, Math.round(planeW * density)));
        const texHeight = Math.max(128, Math.min(1024, Math.round(planeH * density)));

        const dt = new BABYLON.DynamicTexture(`pmi_tex_${vis.id}`, { width: texWidth, height: texHeight }, this.scene, false);
        dt.hasAlpha = true;
        sharpenLabelTexture(dt);

        const ctx = dt.getContext();
        ctx.clearRect(0, 0, texWidth, texHeight);
        paintLabelBackground(ctx, texWidth, texHeight, Math.round(texHeight * 0.16));

        const fontPx = Math.round(texHeight * 0.62);
        ctx.font = `bold ${fontPx}px Consolas, "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(text, texWidth / 2, texHeight / 2);
        dt.update();

        const plane = BABYLON.MeshBuilder.CreatePlane(`pmi_lbl_${vis.id}`, {
            width: planeW,
            height: planeH,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        }, this.scene);

        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        plane.renderingGroupId = 2;
        plane.isPickable = !!annotationId;
        plane.metadata = {
            ...(plane.metadata || {}),
            isPmiOverlay: true,
            ...(annotationId ? { pmiAnnotationId: annotationId, pmiTarget: 'text' } : {}),
        };

        const mat = makeLabelMaterial(vis.id, dt, 'pmi', this.scene);
        plane.material = mat;

        vis.textPlane = plane;
        vis.textTexture = dt;
    }

    private disposeTextLabel(vis: DimVisual): void {
        if (vis.textPlane) {
            vis.textPlane.dispose();
            vis.textPlane = null;
        }
        if (vis.textTexture) {
            vis.textTexture.dispose();
            vis.textTexture = null;
        }
        vis.textCacheKey = '';
        vis.labelPreferredWorld = null;
        vis.labelWidth = 0;
        vis.labelHeight = 0;
    }

    // ========================================================================
    // MEASUREMENTS (miarka)
    // ========================================================================

    private createMeasureVisual(id: string): MeasureVisual {
        return {
            id,
            mainLineParts: [],
            deltaLines: [],
            points: [],
            textPlane: null,
            textTexture: null,
            textCacheKey: '',
            labelPreferredWorld: null,
            labelWidth: 0,
            labelHeight: 0,
        };
    }

    private updateMeasureVisual(
        vis: MeasureVisual,
        path: Vec3[],
        store: PMIStore,
        pickId: string | null,
        selected: boolean,
        labelText?: string,
    ): void {
        const color = selected ? store.selectedColor : MEASURE_COLOR;
        this.updateMeasurePath(vis, path, color, pickId);
        const p1 = path[0];
        const p2 = path[path.length - 1];
        if (path.length === 2) {
            this.updateMeasureDeltas(vis, p1, p2);
        } else {
            for (const line of vis.deltaLines) line?.dispose?.();
            vis.deltaLines = [];
        }
        this.updateMeasureLabel(vis, path, store, pickId, selected, labelText);
    }

    /**
     * Linia pomiaru — stała grubość w świecie, ale celowo węższa niż linia
     * wymiaru (suwak `lineWidthMM` skalowany o połowę).
     */
    private updateMeasurePath(
        vis: MeasureVisual,
        path: Vec3[],
        color: Rgba,
        pickId: string | null,
    ): void {
        const parts = vis.mainLineParts;
        const widthMM = Math.max(PMIStore.instance.lineWidthMM * 0.5, 0.6);
        const segCount = Math.max(0, path.length - 1);

        let partIdx = 0;
        for (let i = 0; i < segCount; i++) {
            const tube = this.updateOrCreateTubeSegment(
                parts[partIdx] ?? null,
                `pmi_msr_${vis.id}_line_${i}`,
                path[i],
                path[i + 1],
                widthMM,
                color,
                pickId,
                'line',
                false,
            );
            if (tube) {
                if (pickId) {
                    tube.isPickable = true;
                    tube.metadata = { ...(tube.metadata || {}), isPmiOverlay: true, pmiMeasurementId: pickId };
                }
                parts[partIdx] = tube;
                partIdx++;
            }
        }

        while (parts.length > partIdx) {
            const excess = parts.pop();
            this.disposeMeshAndMaterial(excess);
        }
    }

    private updateMeasureDeltas(vis: MeasureVisual, p1: Vec3, p2: Vec3): void {
        const segs = measureDeltaSegments(p1, p2);
        if (segs.length < 2) {
            for (const line of vis.deltaLines) this.disposeMeshAndMaterial(line);
            vis.deltaLines = [];
            return;
        }

        let idx = 0;
        for (const seg of segs) {
            const rgba = MEASURE_DELTA_COLOR[seg.axis];
            const len = v3Len(v3Sub(seg.b, seg.a));
            const dash = Math.max(8, len / 18);
            const gap = Math.max(6, len / 28);
            const existing = vis.deltaLines[idx];
            const hasExisting = existing && !existing.isDisposed?.();

            const line = BABYLON.MeshBuilder.CreateDashedLines(
                `pmi_msr_${vis.id}_d${seg.axis}`,
                {
                    points: [this.toB(seg.a), this.toB(seg.b)],
                    dashSize: dash,
                    gapSize: gap,
                    ...(hasExisting ? { instance: existing } : {}),
                },
                this.scene,
            );
            if (!hasExisting) {
                line.isPickable = false;
                line.renderingGroupId = 2;
                line.metadata = {
                    ...(line.metadata || {}),
                    isPmiOverlay: true,
                };
            }
            line.color = new BABYLON.Color3(rgba[0], rgba[1], rgba[2]);
            line.alpha = rgba[3];
            vis.deltaLines[idx] = line;
            idx++;
        }

        while (vis.deltaLines.length > idx) {
            const excess = vis.deltaLines.pop();
            this.disposeMeshAndMaterial(excess);
        }
    }

    private updateMeasureLabel(
        vis: MeasureVisual,
        path: Vec3[],
        store: PMIStore,
        pickId: string | null,
        selected: boolean,
        labelText?: string,
    ): void {
        const p1 = path[0];
        const p2 = path[path.length - 1];
        const isChain = path.length > 2;
        const label = labelText ?? (isChain
            ? `L: ${formatDistance(pathLength(path), store.unitMode, store.showUnits)}`
            : formatMeasureText(p1, p2, store.unitMode, store.showUnits));
        const accentColor = selected ? toHexColor(store.selectedColor) : toHexColor(MEASURE_COLOR);
        const lines = label.split('\n');

        // Bez delt (1 linia) → rozmiar i styl jak label wymiaru: stały w świecie.
        const worldFixed = lines.length === 1;
        let planeW: number;
        let planeH: number;
        if (worldFixed) {
            const textHWorld = Math.max(store.textSizeMM, 12);
            planeH = textHWorld + 4;
            planeW = Math.max(lines[0].length * textHWorld * 0.65, 8) + 6;
        } else {
            const dims = computeMeasureLabelDimensions(lines);
            planeW = dims.planeW;
            planeH = dims.planeH;
        }
        vis.basePlaneW = planeW;
        vis.basePlaneH = planeH;
        vis.labelWorldFixed = worldFixed;

        const cacheKey = `${label}|${accentColor}|${selected}|${planeW.toFixed(0)}|${planeH.toFixed(0)}|${worldFixed ? 1 : 0}`;

        if (vis.textCacheKey !== cacheKey) {
            this.updateOrCreateMeasureTextLabel(vis, lines, accentColor, planeW, planeH, pickId, selected);
            vis.textCacheKey = cacheKey;
        }

        if (vis.textPlane) {
            const labelPos = isChain && path.length === 3 ? path[1] : v3Scale(v3Add(p1, p2), 0.5);
            const scale = worldFixed
                ? this.computeWorldFixedLabelScale(labelPos, planeH)
                : this.calculateMeasureScreenScale(labelPos, planeH, lines.length);
            vis.textPlane.scaling.set(scale, scale, scale);

            const effectiveH = planeH * scale;
            const effectiveW = planeW * scale;
            vis.labelWidth = effectiveW;
            vis.labelHeight = effectiveH;

            const preferred = v3(labelPos.x, labelPos.y + effectiveH * 0.65, labelPos.z);
            vis.labelPreferredWorld = preferred;
            vis.textPlane.position = new BABYLON.Vector3(preferred.x, preferred.y, preferred.z);
        }
    }

    /**
     * Skala dla etykiety „stałej w świecie" (bez delt): bazowo 1.0, ale przy
     * dużym zbliżeniu/oddaleniu ograniczana, by nie zajmowała pół ekranu ani nie znikła.
     */
    private computeWorldFixedLabelScale(worldPos: Vec3, basePlaneH: number): number {
        const pxPerMM = pixelsPerMMAtScene(this.scene, worldPos);
        if (!Number.isFinite(pxPerMM) || pxPerMM <= 1e-6 || basePlaneH <= 0) return 1;
        const screenH = basePlaneH * pxPerMM;
        const MAX_PX = 46;
        const MIN_PX = 16;
        if (screenH > MAX_PX) return MAX_PX / screenH;
        if (screenH < MIN_PX) return MIN_PX / screenH;
        return 1;
    }

    private calculateMeasureScreenScale(worldPos: Vec3, basePlaneH: number, lineCount: number): number {
        const camera = this.scene?.activeCamera;
        const engine = this.scene?.getEngine?.();
        if (!camera || !engine || basePlaneH <= 0) return 1.0;

        const isOrtho = camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        const renderH = engine.getRenderHeight ? engine.getRenderHeight() : 1080;
        const orthoH = isOrtho ? Math.abs((camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0)) : 0;

        let dist = 0;
        if (!isOrtho) {
            const camPos = camera.globalPosition || camera.position;
            if (camPos) {
                dist = Math.hypot(camPos.x - worldPos.x, camPos.y - worldPos.y, camPos.z - worldPos.z);
            }
        }

        return computeMeasureScreenScale(
            basePlaneH,
            lineCount,
            isOrtho ? 1 : 0,
            renderH,
            orthoH > 1e-4 ? orthoH : (camera.radius ? camera.radius * 1.3 : 0),
            dist,
            camera.fov,
        );
    }

    /**
     * Nakładające się billboardy rozsuwamy na ekranie, potem wracamy do świata.
     * Zawsze start od pozycji preferowanej — bez dryfu klatka po klatce.
     */
    private resolveOverlappingLabels(): void {
        const camera = this.scene?.activeCamera;
        const engine = this.scene?.getEngine?.();
        if (!camera || !engine) return;

        const slots = this.collectLabelSlots();
        if (slots.length < 2) return;

        const renderW = engine.getRenderWidth();
        const renderH = engine.getRenderHeight();
        const viewport = camera.viewport.toGlobal(renderW, renderH);
        const transform = this.scene.getTransformMatrix();
        const identity = BABYLON.Matrix.Identity();
        const camRight = this.cameraAxis(camera, 'right');
        const camUp = this.cameraAxis(camera, 'up');

        const projected: ScreenLabel[] = [];
        const worldById = new Map<string, { preferred: Vec3; mmPerPx: number }>();

        for (const slot of slots) {
            const screen = this.projectWorldToScreen(slot.preferred, identity, transform, viewport);
            if (!screen) continue;
            const pxPerMM = this.pixelsPerWorldMM(slot.preferred, camRight, identity, transform, viewport);
            if (pxPerMM < 1e-6) continue;
            worldById.set(slot.id, { preferred: slot.preferred, mmPerPx: 1 / pxPerMM });
            projected.push({
                id: slot.id,
                x: screen.x,
                y: screen.y,
                w: slot.w * pxPerMM,
                h: slot.h * pxPerMM,
            });
        }

        if (projected.length < 2) return;

        const resolved = resolveLabelOverlaps(projected, LABEL_OVERLAP_PAD_PX);
        const slotById = new Map(slots.map(s => [s.id, s]));

        for (const label of resolved) {
            const slot = slotById.get(label.id);
            const world = worldById.get(label.id);
            const original = projected.find(p => p.id === label.id);
            if (!slot?.plane || !world || !original) continue;

            const dxPx = label.x - original.x;
            const dyPx = label.y - original.y;
            if (Math.abs(dxPx) < 0.5 && Math.abs(dyPx) < 0.5) continue;

            const pos = v3Add(
                world.preferred,
                v3Add(
                    v3Scale(camRight, dxPx * world.mmPerPx),
                    v3Scale(camUp, -dyPx * world.mmPerPx),
                ),
            );
            slot.plane.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
        }
    }

    private collectLabelSlots(): Array<{
        id: string;
        plane: any;
        preferred: Vec3;
        w: number;
        h: number;
    }> {
        const slots: Array<{ id: string; plane: any; preferred: Vec3; w: number; h: number }> = [];
        const add = (vis: DimVisual | MeasureVisual | null) => {
            if (!vis?.textPlane || vis.textPlane.isDisposed?.()) return;
            if (vis.textPlane.isEnabled && vis.textPlane.isEnabled() === false) return;
            if (!vis.labelPreferredWorld || vis.labelWidth <= 0 || vis.labelHeight <= 0) return;
            slots.push({
                id: vis.id,
                plane: vis.textPlane,
                preferred: vis.labelPreferredWorld,
                w: vis.labelWidth,
                h: vis.labelHeight,
            });
        };
        for (const vis of this.visuals.values()) add(vis);
        add(this.previewVisual);
        for (const vis of this.measureVisuals.values()) add(vis);
        add(this.measurePreview);
        return slots;
    }

    private cameraAxis(camera: any, which: 'right' | 'up'): Vec3 {
        const local = which === 'right'
            ? new BABYLON.Vector3(1, 0, 0)
            : new BABYLON.Vector3(0, 1, 0);
        const dir = camera.getDirection ? camera.getDirection(local) : local;
        return v3(dir.x, dir.y, dir.z);
    }

    private projectWorldToScreen(
        world: Vec3,
        worldMatrix: any,
        transform: any,
        viewport: any,
    ): { x: number; y: number } | null {
        const projected = BABYLON.Vector3.Project(
            new BABYLON.Vector3(world.x, world.y, world.z),
            worldMatrix,
            transform,
            viewport,
        );
        if (!projected || projected.z < 0 || projected.z > 1) return null;
        return { x: projected.x, y: projected.y };
    }

    private pixelsPerWorldMM(
        world: Vec3,
        camRight: Vec3,
        worldMatrix: any,
        transform: any,
        viewport: any,
    ): number {
        const a = this.projectWorldToScreen(world, worldMatrix, transform, viewport);
        const b = this.projectWorldToScreen(
            v3Add(world, camRight),
            worldMatrix,
            transform,
            viewport,
        );
        if (!a || !b) return 0;
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    /**
     * Etykieta miarki — tekstura proporcjonalna do płaszczyzny (bez zniekształceń),
     * wysoka gęstość pikseli na linię dla ostrości, tło + outline dla czytelności.
     */
    private updateOrCreateMeasureTextLabel(
        vis: MeasureVisual,
        lines: string[],
        accentColor: string,
        planeW: number,
        planeH: number,
        pickId: string | null,
        selected: boolean,
    ): void {
        // ~300 px na linię — gwarantuje ostrość, a texW nadąża za proporcją płaszczyzny.
        const slotPx = 300;
        let texHeight = Math.round(slotPx * lines.length);
        let texWidth = Math.round(texHeight * (planeW / Math.max(planeH, 1e-3)));
        // Zabezpieczenie rozmiaru tekstury.
        if (texWidth > 4096) { texHeight = Math.round(texHeight * (4096 / texWidth)); texWidth = 4096; }
        if (texWidth < 256) texWidth = 256;
        texHeight = Math.max(128, texHeight);

        const previousLineCount = vis.lineCount ?? 0;
        const canReuse = vis.textTexture && !vis.textTexture.isDisposed?.()
            && vis.textPlane && !vis.textPlane.isDisposed?.()
            && previousLineCount === lines.length;

        let dt = vis.textTexture;
        if (!canReuse || !dt) {
            vis.textPlane?.dispose?.();
            vis.textTexture?.dispose?.();

            dt = new BABYLON.DynamicTexture(
                `pmi_msr_tex_${vis.id}`,
                { width: texWidth, height: texHeight },
                this.scene,
                false,
            );
            dt.hasAlpha = true;
            sharpenLabelTexture(dt);
            vis.textTexture = dt;
        }

        const ctx = dt.getContext() as CanvasRenderingContext2D;
        const currentSize = dt.getSize ? dt.getSize() : { width: texWidth, height: texHeight };
        const drawW = currentSize.width || texWidth;
        const drawH = currentSize.height || texHeight;
        ctx.clearRect(0, 0, drawW, drawH);
        paintLabelBackground(ctx, drawW, drawH, Math.round(drawH * 0.12));

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const slotH = drawH / lines.length;

        for (let i = 0; i < lines.length; i++) {
            const isMain = i === 0;
            const fontPx = Math.round(slotH * (isMain ? 0.72 : 0.6));
            ctx.font = `bold ${fontPx}px Consolas, "Courier New", monospace`;
            const color = measureLabelLineColor(lines[i], selected && isMain);
            const x = drawW / 2;
            const y = slotH * (i + 0.5);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.fillText(lines[i], x, y);
        }
        dt.update();

        if (!canReuse || !vis.textPlane) {
            const plane = BABYLON.MeshBuilder.CreatePlane(`pmi_msr_lbl_${vis.id}`, {
                width: planeW,
                height: planeH,
            }, this.scene);
            plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
            plane.renderingGroupId = 3;
            plane.isPickable = !!pickId;
            plane.metadata = {
                ...(plane.metadata || {}),
                isPmiOverlay: true,
                ...(pickId ? { pmiMeasurementId: pickId } : {}),
            };

            const mat = makeLabelMaterial(vis.id, dt, 'msr', this.scene);
            plane.material = mat;

            plane.onBeforeRenderObservable.add(() => {
                if (!plane || plane.isDisposed()) return;
                const currentH = vis.basePlaneH ?? planeH;
                const currentW = vis.basePlaneW ?? planeW;
                const count = vis.lineCount ?? lines.length;
                // Bez delt: stały rozmiar w świecie (jak label wymiaru), ale z clampem ekranowym.
                const scale = vis.labelWorldFixed
                    ? this.computeWorldFixedLabelScale(vis.labelPreferredWorld || plane.position, currentH)
                    : this.calculateMeasureScreenScale(vis.labelPreferredWorld || plane.position, currentH, count);
                if (Math.abs(plane.scaling.y - scale) > 1e-4) {
                    plane.scaling.set(scale, scale, scale);
                    vis.labelWidth = currentW * scale;
                    vis.labelHeight = currentH * scale;
                }
            });

            vis.textPlane = plane;
        }

        vis.lineCount = lines.length;
    }

    private setMeasureVisualVisible(vis: MeasureVisual, visible: boolean): void {
        for (const part of vis.mainLineParts) part?.setEnabled?.(visible);
        for (const p of vis.points) p?.setEnabled?.(visible);
        for (const l of vis.deltaLines) l?.setEnabled?.(visible);
        vis.textPlane?.setEnabled?.(visible);
    }

    private disposeMeasureVisual(vis: MeasureVisual): void {
        for (const part of vis.mainLineParts) this.disposeMeshAndMaterial(part);
        for (const p of vis.points) this.disposeMeshAndMaterial(p);
        for (const l of vis.deltaLines) this.disposeMeshAndMaterial(l);
        this.disposeMeshAndMaterial(vis.textPlane);
        vis.textTexture?.dispose?.();
        vis.mainLineParts = [];
        vis.points = [];
        vis.deltaLines = [];
        vis.textPlane = null;
        vis.textTexture = null;
        vis.textCacheKey = '';
        vis.labelPreferredWorld = null;
        vis.labelWidth = 0;
        vis.labelHeight = 0;
        vis.basePlaneW = 0;
        vis.basePlaneH = 0;
        vis.lineCount = 0;
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    private toB(v: Vec3): any {
        return new BABYLON.Vector3(v.x, v.y, v.z);
    }

    private setVisualVisible(vis: DimVisual, visible: boolean): void {
        for (const part of vis.dimLineParts) part?.setEnabled?.(visible);
        for (const part of vis.helperLineParts) part?.setEnabled?.(visible);
        if (vis.arrowMesh1) vis.arrowMesh1.setEnabled(visible);
        if (vis.arrowMesh2) vis.arrowMesh2.setEnabled(visible);
        if (vis.textPlane) vis.textPlane.setEnabled(visible);
    }

    private disposeVisual(vis: DimVisual): void {
        this.disposeLineParts(vis.dimLineParts);
        this.disposeLineParts(vis.helperLineParts);
        this.disposeMeshAndMaterial(vis.arrowMesh1);
        this.disposeMeshAndMaterial(vis.arrowMesh2);
        vis.arrowMesh1 = null;
        vis.arrowMesh2 = null;
        this.disposeTextLabel(vis);
    }
}

function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
): void {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export function measureLineWidth(): number {
    return Math.max(0.5, PMIStore.instance.lineWidthMM);
}

export function measurePointDiameter(minDist?: number): number {
    const base = Math.max(1.6, measureLineWidth() * 1.3);
    if (minDist !== undefined && Number.isFinite(minDist) && minDist > 0) {
        // Przy bliskich pomiarach nie pozwalamy na nachodzenie sfer na siebie:
        // średnica nie przekracza 28% odległości między punktami (z min 0.35 mm).
        return Math.max(0.35, Math.min(base, minDist * 0.28));
    }
    return base;
}

/**
 * Średnica punktu pomiaru ze stałym rozmiarem ekranowym (jak pro CAD).
 * Łączy trzy ograniczenia: suwak użytkownika (przez clamp px), brak nachodzenia
 * (cap 28% minDist) oraz widoczność z daleka (nigdy poniżej minPx).
 */
export function measurePointDiameterAt(scene: any, worldPos: Vec3, userMM: number, minDist?: number): number {
    const pxPerMM = pixelsPerMMAtScene(scene, worldPos);
    const base = Math.max(1.6, Math.max(0.5, userMM) * 1.3);
    if (!Number.isFinite(pxPerMM) || pxPerMM <= 1e-6) {
        return measurePointDiameter(minDist);
    }
    const minMM = MEASURE_MIN_PX / pxPerMM;
    const maxMM = MEASURE_MAX_PX / pxPerMM;
    const clamped = Math.min(Math.max(base, minMM), maxMM);
    if (minDist !== undefined && Number.isFinite(minDist) && minDist > 0) {
        const cap = Math.max(0.35, minDist * 0.28);
        // Punkty bliżej niż rozdzielczość ekranu i tak się zleją — wtedy
        // priorytet ma widoczność (minMM), nie kurczenie do sub-piksela.
        if (cap < minMM) return minMM;
        return Math.min(clamped, cap);
    }
    return clamped;
}
