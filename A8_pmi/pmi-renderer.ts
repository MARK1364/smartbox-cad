/**
 * PMI Renderer — TypeScript / Babylon.js
 *
 * Rysuje wymiary CAD w scenie 3D Babylon.js:
 * - Linie wymiarowe (główna + pomocnicze)
 * - Groty strzałek (triangulated cones)
 * - Etykiety tekstowe w 3D (Billboard DynamicTexture - 100% WebGPU/WebGL2 compatible)
 *
 * Odpowiednik pmi_ui.py (GPU draw) + cad_dimension.py (mesh).
 *
 * WYDAJNOŚĆ: `renderAll()` bywa wołane co klatkę (przeciąganie formatki gizmem),
 * więc siatki i tekstury są aktualizowane w miejscu. Kosztowną `DynamicTexture`
 * przebudowujemy dopiero, gdy zmieni się tekst albo kolor etykiety.
 */

declare const BABYLON: any;

import { Vec3, v3, v3Add, v3Scale, v3Sub, v3Len } from './dimension-solver';
import { BridgeRenderData, helperSegmentsFromRenderData } from './pmi-bridge';
import { PMIAnnotation, PMIStore, formatDistance, formatMeasureText } from './pmi-data';
import { beginResolveBatch, endResolveBatch } from './pmi-id-bridge';
import { resolvePMIForRender } from './pmi-resolve';
import { measureDeltaSegments, pathLength } from './pmi-measure';
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
/** Miarki czytamy z daleka — etykieta ~4× większa niż wymiary CAD. */
const MEASURE_LABEL_SCALE = 4;
/** Kolory delt jak w Blenderze `pmi_ui.py` (linie przerywane XYZ). */
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

    constructor(scene: any) {
        this.scene = scene;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

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
                if (!entry.visible || !entry.renderData) {
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
                if (!entry.visible || !entry.renderData) {
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
        annotationId: string | null,
    ): void {
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

        this.updateTextLabel(vis, rd, textColor, annotationId);
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
            );
            if (tube) vis[partsKey].push(tube);
        }
    }

    private createTubeSegment(
        name: string,
        a: Vec3,
        b: Vec3,
        diameterMM: number,
        color: Rgba,
        annotationId: string | null,
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
        if (pickable) {
            tube.metadata = { pmiAnnotationId: annotationId };
        }

        return tube;
    }

    private disposeLineParts(parts: any[]): void {
        for (const part of parts) {
            part?.material?.dispose?.();
            part?.dispose?.();
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
                vis[key].dispose();
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
        if (cone.isPickable) {
            cone.metadata = { ...(cone.metadata || {}), pmiAnnotationId: vis.id };
        }

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
    ): void {
        if (!rd.labelText) {
            this.disposeTextLabel(vis);
            return;
        }

        const text = rd.labelText;
        const textHWorld = Math.max(PMIStore.instance.textSizeMM, 12); // mm
        const charAspect = 0.65;
        const textWWorld = Math.max(text.length * textHWorld * charAspect, 8);

        const cacheKey = `${text}|${textColor}|${textHWorld}`;

        if (vis.textCacheKey !== cacheKey) {
            this.disposeTextLabel(vis);
            this.buildTextLabel(vis, text, textColor, textWWorld, textHWorld, annotationId);
            vis.textCacheKey = cacheKey;
        }

        vis.labelWidth = textWWorld;
        vis.labelHeight = textHWorld;
        if (vis.textPlane && rd.p1DimWorld && rd.p2DimWorld) {
            const mid = v3Scale(v3Add(rd.p1DimWorld, rd.p2DimWorld), 0.5);
            const textOffset = v3Scale(rd.upWorld, rd.arrowWid * 2 + textHWorld * 0.6);
            const textPos = v3Add(mid, textOffset);
            vis.labelPreferredWorld = textPos;
            vis.textPlane.position = new BABYLON.Vector3(textPos.x, textPos.y, textPos.z);
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
        const texWidth = 256;
        const texHeight = 64;

        const dt = new BABYLON.DynamicTexture(`pmi_tex_${vis.id}`, { width: texWidth, height: texHeight }, this.scene, false);
        dt.hasAlpha = true;

        const ctx = dt.getContext();
        ctx.clearRect(0, 0, texWidth, texHeight);

        ctx.font = 'bold 34px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.fillText(text, texWidth / 2, texHeight / 2);
        dt.update();

        const plane = BABYLON.MeshBuilder.CreatePlane(`pmi_lbl_${vis.id}`, {
            width: textWWorld,
            height: textHWorld,
        }, this.scene);

        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        plane.renderingGroupId = 2;
        plane.isPickable = !!annotationId;
        if (annotationId) {
            plane.metadata = { pmiAnnotationId: annotationId };
        }

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

        for (let i = 0; i + 1 < path.length; i++) {
            const tube = this.createTubeSegment(
                `pmi_msr_${vis.id}_line_${i}`,
                path[i],
                path[i + 1],
                measureLineWidth(),
                color,
                null,
            );
            if (tube) {
                if (pickId) {
                    tube.isPickable = true;
                    tube.metadata = { pmiMeasurementId: pickId };
                }
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
        for (const [i, pos] of path.entries()) {
            const sphere = BABYLON.MeshBuilder.CreateSphere(`pmi_msr_${vis.id}_pt_${i}`, {
                diameter: measurePointDiameter(),
                segments: 8,
            }, this.scene);
            sphere.position = this.toB(pos);
            sphere.renderingGroupId = 2;
            sphere.isPickable = !!pickId;
            if (pickId) sphere.metadata = { pmiMeasurementId: pickId };
            const mat = new BABYLON.StandardMaterial(`pmi_msr_${vis.id}_pt_mat_${i}`, this.scene);
            mat.emissiveColor = new BABYLON.Color3(color[0], color[1], color[2]);
            mat.disableLighting = true;
            sphere.material = mat;
            vis.points.push(sphere);
        }
    }

    private updateMeasureDeltas(vis: MeasureVisual, p1: Vec3, p2: Vec3): void {
        for (const line of vis.deltaLines) line?.dispose?.();
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
        const textHWorld = Math.max(store.textSizeMM, 12) * MEASURE_LABEL_SCALE;
        const lineH = textHWorld * 0.85;
        const textWWorld = Math.max(...lines.map(l => l.length * textHWorld * 0.58), 24);
        const totalH = lineH * lines.length;
        const padWorld = textHWorld * 0.42;
        const planeW = textWWorld + padWorld * 2;
        const planeH = totalH + padWorld * 2;
        const cacheKey = `${label}|${accentColor}|${selected}|${planeW.toFixed(0)}|${planeH.toFixed(0)}`;

        if (vis.textCacheKey !== cacheKey) {
            vis.textPlane?.dispose?.();
            vis.textTexture?.dispose?.();
            this.buildMeasureTextLabel(vis, lines, accentColor, planeW, planeH, pickId, selected);
            vis.textCacheKey = cacheKey;
        }

        vis.labelWidth = planeW;
        vis.labelHeight = planeH;
        if (vis.textPlane) {
            const labelPos = isChain && path.length === 3 ? path[1] : v3Scale(v3Add(p1, p2), 0.5);
            const preferred = v3(labelPos.x, labelPos.y + planeH * 0.55, labelPos.z);
            vis.labelPreferredWorld = preferred;
            vis.textPlane.position = new BABYLON.Vector3(preferred.x, preferred.y, preferred.z);
        }
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

    /** Etykieta miarki — badge z tłem (wymiary zostają minimalistyczne). */
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
        const texHeight = Math.max(192, 112 * lines.length);
        const margin = 20;
        const padY = 36;

        const dt = new BABYLON.DynamicTexture(
            `pmi_msr_tex_${vis.id}`,
            { width: texWidth, height: texHeight },
            this.scene,
            false,
        );
        dt.hasAlpha = true;

        const ctx = dt.getContext() as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, texWidth, texHeight);

        const boxX = margin;
        const boxY = margin;
        const boxW = texWidth - margin * 2;
        const boxH = texHeight - margin * 2;

        drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 32);
        ctx.fillStyle = 'rgba(8, 12, 18, 0.94)';
        ctx.fill();

        drawRoundedRect(ctx, boxX + 3, boxY + 3, boxW - 6, boxH - 6, 30);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        drawRoundedRect(ctx, boxX + 4, boxY + 4, boxW - 8, (boxH - 8) * 0.45, 28);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(boxX, boxY, boxW, boxH * 0.5);
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const contentTop = boxY + padY;
        const contentH = boxH - padY * 2;
        const slotH = contentH / lines.length;

        for (let i = 0; i < lines.length; i++) {
            const isMain = i === 0;
            ctx.font = isMain ? 'bold 80px Consolas, monospace' : '56px Consolas, monospace';
            ctx.fillStyle = measureLabelLineColor(lines[i], selected && isMain);
            ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = isMain ? 10 : 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
            ctx.fillText(lines[i], texWidth / 2, contentTop + slotH * (i + 0.5));
        }
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        dt.update();

        const plane = BABYLON.MeshBuilder.CreatePlane(`pmi_msr_lbl_${vis.id}`, {
            width: planeW,
            height: planeH,
        }, this.scene);
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        plane.renderingGroupId = 3;
        plane.isPickable = !!pickId;
        if (pickId) plane.metadata = { pmiMeasurementId: pickId };

        const mat = new BABYLON.StandardMaterial(`pmi_msr_lbl_mat_${vis.id}`, this.scene);
        mat.diffuseTexture = dt;
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.useAlphaFromDiffuseTexture = true;
        if (mat.disableDepthWrite !== undefined) mat.disableDepthWrite = true;
        plane.material = mat;

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
        for (const part of vis.mainLineParts) part?.dispose?.();
        for (const p of vis.points) p?.dispose?.();
        for (const l of vis.deltaLines) l?.dispose?.();
        vis.textPlane?.dispose?.();
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
        if (vis.arrowMesh1) vis.arrowMesh1.dispose();
        if (vis.arrowMesh2) vis.arrowMesh2.dispose();
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

function measureLineWidth(): number {
    return Math.max(PMIStore.instance.lineWidthMM * 3.2, 5.5);
}

function measurePointDiameter(): number {
    return measureLineWidth() * 1.7;
}
