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
    attachScreenConstantScale,
    measureDiameterAt,
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

const MEASURE_COLOR: Rgba = [1.0, 1.0, 0.0, 1.0];
/** Bazowa wysokość tekstu etykiety miarki w przestrzeni CAD [mm]. */
export const MEASURE_BASE_TEXT_H = 14;

/**
 * Oblicza bazowe wymiary plakietki miarki [mm] na podstawie liczby i długości linii.
 */
export function computeMeasureLabelDimensions(lines: string[]): {
    textHWorld: number;
    planeW: number;
    planeH: number;
} {
    const textHWorld = MEASURE_BASE_TEXT_H;
    const lineH = textHWorld * 0.85;
    const textWWorld = Math.max(...lines.map(l => l.length * textHWorld * 0.55), 14);
    const totalH = lineH * lines.length;
    const padWorld = textHWorld * 0.15;
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

    // Stały, czytelny rozmiar plakietki na ekranie: 38px (1 linia) do max 84px (4 linie)
    const targetScreenH = lineCount <= 1 ? 38 : Math.min(lineCount * 17 + 16, 84);
    const currentScreenH = basePlaneH * pxPerMM;
    return targetScreenH / currentScreenH;
}

/** Kolory delt (linie przerywane XYZ). */
const MEASURE_DELTA_COLOR: Record<'X' | 'Y' | 'Z', Rgba> = {
    X: [1.0, 0.2, 0.2, 0.6],
    Y: [0.2, 1.0, 0.2, 0.6],
    Z: [0.2, 0.4, 1.0, 0.6],
};

/** Kolory tekstu etykiety miarki — L żółte, delty jak osie CAD. */
const MEASURE_TEXT_HEX = {
    L: '#ffff00',
    L_SELECTED: '#ffffff',
    X: '#ff3333',
    Y: '#33ff33',
    Z: '#3366ff',
} as const;

function measureLabelLineColor(line: string, selected: boolean): string {
    if (line.startsWith('dX:')) return MEASURE_TEXT_HEX.X;
    if (line.startsWith('dY:')) return MEASURE_TEXT_HEX.Y;
    if (line.startsWith('dZ:')) return MEASURE_TEXT_HEX.Z;
    return selected ? MEASURE_TEXT_HEX.L_SELECTED : MEASURE_TEXT_HEX.L;
}

/** Przyciemniony kolor pod obwódkę tekstu (zamiast czerni). */
function darkenHexForOutline(hex: string, towardBlack = 0.42): string {
    const raw = hex.replace('#', '');
    if (raw.length !== 6) return 'rgba(20, 20, 20, 0.85)';
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const f = Math.max(0, Math.min(1, towardBlack));
    const dr = Math.round(r * f);
    const dg = Math.round(g * f);
    const db = Math.round(b * f);
    return `rgb(${dr},${dg},${db})`;
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
                this.setMeasureVisualVisible(vis, true);
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
        this.resolveOverlappingLabels();
    }

    public clearMeasurePreview(): void {
        if (this.measurePreview) {
            this.disposeMeasureVisual(this.measurePreview);
            this.measurePreview = null;
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

        this.updateSegmentTubes(
            vis,
            'dimLineParts',
            [[rd.p1DimWorld, rd.p2DimWorld]],
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
        this.disposeLineParts(vis[partsKey]);

        for (let i = 0; i < segments.length; i++) {
            const [a, b] = segments[i];
            const tube = this.createTubeSegment(
                `pmi_${vis.id}_${partsKey}_${i}`,
                a,
                b,
                Math.max(diameterMM, partsKey === 'dimLineParts' ? 0.9 : 0.55),
                color,
                annotationId,
                partsKey === 'dimLineParts' ? 'line' : 'helper',
            );
            if (tube) vis[partsKey].push(tube);

            // Dla linii wymiarowej tworzymy niewidoczny, wygodny hitbox ułatwiający chwytanie myszą w 3D
            if (partsKey === 'dimLineParts' && annotationId) {
                const hitbox = this.createTubeSegment(
                    `pmi_${vis.id}_hitbox_${i}`,
                    a,
                    b,
                    18, // 18mm średnicy — łatwe chwytanie
                    [0, 0, 0, 0],
                    annotationId,
                    'line',
                );
                if (hitbox) {
                    hitbox.visibility = 0;
                    hitbox.isVisible = true;
                    hitbox.isPickable = true;
                    vis[partsKey].push(hitbox);
                }
            }
        }
    }

    private createTubeSegment(
        name: string,
        a: Vec3,
        b: Vec3,
        diameterMM: number,
        color: Rgba,
        annotationId: string | null,
        targetPart: 'line' | 'helper' = 'line',
    ): any {
        const aB = this.toB(a);
        const bB = this.toB(b);
        const diff = bB.subtract(aB);
        const len = diff.length();
        if (len < 0.05) return null;

        const diameter = Math.max(diameterMM, 0.55);
        const tube = BABYLON.MeshBuilder.CreateCylinder(name, {
            height: len,
            diameter,
            tessellation: 8,
        }, this.scene);

        tube.position = BABYLON.Vector3.Lerp(aB, bB, 0.5);

        const dir = diff.normalize();
        const yAxis = new BABYLON.Vector3(0, 1, 0);
        const dot = BABYLON.Vector3.Dot(yAxis, dir);
        if (Math.abs(dot) > 0.999) {
            if (dot < 0) {
                tube.rotation.x = Math.PI;
            }
        } else {
            const axis = BABYLON.Vector3.Cross(yAxis, dir).normalize();
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            tube.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
        }

        const mat = new BABYLON.StandardMaterial(`${name}_mat`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(color[0], color[1], color[2]);
        mat.emissiveColor = new BABYLON.Color3(color[0] * 0.35, color[1] * 0.35, color[2] * 0.35);
        mat.disableLighting = true;
        mat.alpha = color[3];
        tube.material = mat;
        tube.renderingGroupId = 2;

        const pickable = !!annotationId;
        tube.isPickable = pickable;
        tube.metadata = {
            ...(tube.metadata || {}),
            isPmiOverlay: true,
            ...(pickable ? { pmiAnnotationId: annotationId, pmiTarget: targetPart } : {}),
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
        vis: DimVisual,
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
        const cacheKey = `${text}|${textColor}|${textHWorld}|${alignToLine}`;

        if (vis.textCacheKey !== cacheKey) {
            this.disposeTextLabel(vis);
            this.buildTextLabel(vis, text, textColor, textWWorld, textHWorld, annotationId);
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
        const texWidth = 1024;
        const texHeight = 256;

        const dt = new BABYLON.DynamicTexture(`pmi_tex_${vis.id}`, { width: texWidth, height: texHeight }, this.scene, false);
        dt.hasAlpha = true;

        const ctx = dt.getContext();
        ctx.clearRect(0, 0, texWidth, texHeight);

        ctx.font = 'bold 136px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(text, texWidth / 2, texHeight / 2);
        dt.update();

        const plane = BABYLON.MeshBuilder.CreatePlane(`pmi_lbl_${vis.id}`, {
            width: textWWorld + 6,
            height: textHWorld + 4,
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

        const mat = new BABYLON.StandardMaterial(`pmi_lbl_mat_${vis.id}`, this.scene);
        mat.diffuseTexture = dt;
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.useAlphaFromDiffuseTexture = true;
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
        this.updateMeasurePoints(vis, path, color, pickId);
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

    private updateMeasurePath(
        vis: MeasureVisual,
        path: Vec3[],
        color: Rgba,
        pickId: string | null,
    ): void {
        for (const part of vis.mainLineParts) part?.dispose?.();
        vis.mainLineParts = [];

        const userMM = measureLineWidth();
        for (let i = 0; i + 1 < path.length; i++) {
            // Środek segmentu: średnica tak, by na ekranie trzymać suwak w ryzach
            // min/max px (daleko: min px żeby było widać, blisko: max px żeby nie był kloc).
            const mid = v3Scale(v3Add(path[i], path[i + 1]), 0.5);
            const baked = measureDiameterAt(this.scene, mid, userMM);
            const tube = this.createTubeSegment(
                `pmi_msr_${vis.id}_line_${i}`,
                path[i],
                path[i + 1],
                baked,
                color,
                null,
            );
            if (tube) {
                if (pickId) {
                    tube.isPickable = true;
                    tube.metadata = { ...(tube.metadata || {}), isPmiOverlay: true, pmiMeasurementId: pickId };
                }
                attachScreenConstantScale(
                    tube,
                    baked,
                    () => measureDiameterAt(this.scene, mid, measureLineWidth()),
                    true,
                );
                vis.mainLineParts.push(tube);
            }
        }
    }

    private updateMeasurePoints(
        vis: MeasureVisual,
        path: Vec3[],
        color: Rgba,
        pickId: string | null,
    ): void {
        for (const p of vis.points) p?.dispose?.();
        vis.points = [];

        let minDist = Infinity;
        for (let i = 0; i + 1 < path.length; i++) {
            const d = v3Len(v3Sub(path[i + 1], path[i]));
            if (d < minDist) minDist = d;
        }
        const baseUserMM = measureLineWidth();

        for (const [i, pos] of path.entries()) {
            const baked = measurePointDiameterAt(this.scene, pos, baseUserMM, minDist);
            const sphere = BABYLON.MeshBuilder.CreateSphere(`pmi_msr_${vis.id}_pt_${i}`, {
                diameter: baked,
                segments: 8,
            }, this.scene);
            sphere.position = this.toB(pos);
            sphere.renderingGroupId = 2;
            sphere.isPickable = !!pickId;
            sphere.metadata = {
                ...(sphere.metadata || {}),
                isPmiOverlay: true,
                ...(pickId ? { pmiMeasurementId: pickId } : {}),
            };
            const mat = new BABYLON.StandardMaterial(`pmi_msr_${vis.id}_pt_mat_${i}`, this.scene);
            mat.emissiveColor = new BABYLON.Color3(color[0], color[1], color[2]);
            mat.disableLighting = true;
            sphere.material = mat;
            attachScreenConstantScale(
                sphere,
                baked,
                () => measurePointDiameterAt(this.scene, pos, measureLineWidth(), minDist),
                false,
            );
            vis.points.push(sphere);
        }
    }

    private updateMeasureDeltas(vis: MeasureVisual, p1: Vec3, p2: Vec3): void {
        for (const line of vis.deltaLines) this.disposeMeshAndMaterial(line);
        vis.deltaLines = [];

        const segs = measureDeltaSegments(p1, p2);
        if (segs.length < 2) return;

        for (const seg of segs) {
            const rgba = MEASURE_DELTA_COLOR[seg.axis];
            const len = v3Len(v3Sub(seg.b, seg.a));
            const dash = Math.max(8, len / 18);
            const gap = Math.max(6, len / 28);
            const line = BABYLON.MeshBuilder.CreateDashedLines(
                `pmi_msr_${vis.id}_d${seg.axis}`,
                {
                    points: [this.toB(seg.a), this.toB(seg.b)],
                    dashSize: dash,
                    gapSize: gap,
                },
                this.scene,
            );
            line.color = new BABYLON.Color3(rgba[0], rgba[1], rgba[2]);
            line.alpha = rgba[3];
            line.isPickable = false;
            line.renderingGroupId = 2;
            line.metadata = {
                ...(line.metadata || {}),
                isPmiOverlay: true,
            };
            vis.deltaLines.push(line);
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

        const dims = computeMeasureLabelDimensions(lines);
        const planeW = dims.planeW;
        const planeH = dims.planeH;
        vis.basePlaneW = planeW;
        vis.basePlaneH = planeH;
        vis.lineCount = lines.length;

        const cacheKey = `${label}|${accentColor}|${selected}|${planeW.toFixed(0)}|${planeH.toFixed(0)}`;

        if (vis.textCacheKey !== cacheKey) {
            vis.textPlane?.dispose?.();
            vis.textTexture?.dispose?.();
            this.buildMeasureTextLabel(vis, lines, accentColor, planeW, planeH, pickId, selected);
            vis.textCacheKey = cacheKey;
        }

        if (vis.textPlane) {
            const labelPos = isChain && path.length === 3 ? path[1] : v3Scale(v3Add(p1, p2), 0.5);
            const scale = this.calculateMeasureScreenScale(labelPos, planeH, lines.length);
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

    /** Etykieta miarki — zoptymalizowana tekstura 1024 px bez narzutu mipmap i anizotropii. */
    private buildMeasureTextLabel(
        vis: MeasureVisual,
        lines: string[],
        accentColor: string,
        planeW: number,
        planeH: number,
        pickId: string | null,
        selected: boolean,
    ): void {
        const texWidth = 1024;
        const texHeight = Math.max(128, 80 * lines.length);

        const dt = new BABYLON.DynamicTexture(
            `pmi_msr_tex_${vis.id}`,
            { width: texWidth, height: texHeight },
            this.scene,
            false,
        );
        dt.hasAlpha = true;

        const ctx = dt.getContext() as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, texWidth, texHeight);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const slotH = texHeight / lines.length;

        for (let i = 0; i < lines.length; i++) {
            const isMain = i === 0;
            ctx.font = isMain ? 'bold 74px Consolas, "Courier New", monospace' : 'bold 54px Consolas, "Courier New", monospace';
            const color = measureLabelLineColor(lines[i], selected && isMain);
            const outline = darkenHexForOutline(color, color === MEASURE_TEXT_HEX.L_SELECTED ? 0.28 : 0.38);
            const x = texWidth / 2;
            const y = slotH * (i + 0.5);

            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.lineWidth = isMain ? 7 : 5;
            ctx.strokeStyle = outline;
            ctx.strokeText(lines[i], x, y);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.fillText(lines[i], x, y);
        }
        dt.update();

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

        const mat = new BABYLON.StandardMaterial(`pmi_msr_lbl_mat_${vis.id}`, this.scene);
        mat.diffuseTexture = dt;
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.useAlphaFromDiffuseTexture = true;
        if (mat.disableDepthWrite !== undefined) mat.disableDepthWrite = true;
        plane.material = mat;

        plane.onBeforeRenderObservable.add(() => {
            if (!plane || plane.isDisposed()) return;
            const currentH = vis.basePlaneH ?? planeH;
            const currentW = vis.basePlaneW ?? planeW;
            const count = vis.lineCount ?? lines.length;
            const pos = vis.labelPreferredWorld || plane.position;
            const scale = this.calculateMeasureScreenScale(pos, currentH, count);
            if (Math.abs(plane.scaling.y - scale) > 1e-4) {
                plane.scaling.set(scale, scale, scale);
                vis.labelWidth = currentW * scale;
                vis.labelHeight = currentH * scale;
            }
        });

        vis.textPlane = plane;
        vis.textTexture = dt;
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
