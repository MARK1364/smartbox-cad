/**
 * PMI Geometry Highlight — podświetlanie wykrytej geometrii pod kursorem
 * podczas wymiarowania (narożnik / krawędź / płaszczyzna).
 */

declare const BABYLON: any;

import { DetectionResult, GeometryDetector, GeometryType } from '../A1_core/geometry-detector.js';
import { ContextManager } from '../A1_core/context-manager.js';
import {
    EdgeSegmentCandidate,
    findEdgeSegmentsNearPointer,
    findVerticesNearPointer,
} from './pmi-edge-pick.js';
import { PMIStore } from './pmi-data.js';
import {
    HIGHLIGHT_DIAMETER_PX,
    VERTEX_DIAMETER_PX,
    attachScreenConstantScale,
    worldDiameterForPxAt,
} from './pmi-screen-scale.js';

/** Identyfikuje odcinek po położeniu, więc pokrywające się krawędzie dają ten sam klucz. */
function segmentKeyOf(segment: EdgeSegmentCandidate): string {
    const q = (n: number) => Math.round(n * 2);
    return `${q(segment.p1World.x)},${q(segment.p1World.y)},${q(segment.p1World.z)}->`
        + `${q(segment.p2World.x)},${q(segment.p2World.y)},${q(segment.p2World.z)}`;
}

const TYPE_LABEL: Record<GeometryType, string> = {
    [GeometryType.VERTEX]: 'narożnik',
    [GeometryType.EDGE]: 'krawędź',
    [GeometryType.PLANE]: 'płaszczyzna',
    [GeometryType.FEATURE]: 'cecha',
    [GeometryType.OBJECT]: 'obiekt',
};

interface SavedMeshState {
    kind: GeometryType;
    visibility?: number;
    alpha?: number;
    originalMaterial?: any;
    diffuse?: any;
    emissive?: any;
    lineColor?: any;
    edgesWidth?: number;
    edgesColor?: any;
}

export class PMIGeometryHighlighter {
    private readonly scene: any;
    private readonly detector: GeometryDetector;
    private hoveredMesh: any = null;
    private saved: SavedMeshState | null = null;
    public lastDetection: DetectionResult | null = null;

    /** Nakładki rysowane na wierzchu — krawędzie w styku dwóch formatek. */
    private edgeOverlays: any[] = [];
    private edgeOverlayKey = '';
    private hoveredSegment: EdgeSegmentCandidate | null = null;
    private vertexOverlay: any = null;

    public get currentHoveredSegment(): EdgeSegmentCandidate | null {
        return this.hoveredSegment;
    }

    constructor(scene: any) {
        this.scene = scene;
        this.detector = new GeometryDetector(scene);
    }

    /** Etykieta typu geometrii pod kursorem (do paska statusu). */
    public static labelOf(type: GeometryType): string {
        return TYPE_LABEL[type] ?? type;
    }

    private isSameDetection(prev: DetectionResult | null, curr: DetectionResult, segmentKey: string): boolean {
        if (!prev && !curr.hit) return true;
        if (!prev || !curr) return false;
        if (prev.hit !== curr.hit) return false;
        if (!prev.hit && !curr.hit) return true;
        if (prev.geometryType !== curr.geometryType) return false;
        if (prev.mesh !== curr.mesh) return false;

        switch (curr.geometryType) {
            case GeometryType.VERTEX: {
                const sameIndex = (prev.cornerIndex >= 0 && curr.cornerIndex >= 0)
                    ? prev.cornerIndex === curr.cornerIndex
                    : true;
                if (!sameIndex) return false;
                if (prev.pickedPoint && curr.pickedPoint) {
                    const dx = prev.pickedPoint.x - curr.pickedPoint.x;
                    const dy = prev.pickedPoint.y - curr.pickedPoint.y;
                    const dz = prev.pickedPoint.z - curr.pickedPoint.z;
                    return (dx * dx + dy * dy + dz * dz) < 1e-4;
                }
                return true;
            }
            case GeometryType.EDGE: {
                if (this.edgeOverlays.length === 0) return false;
                if (!segmentKey) return false;
                if (segmentKey === this.edgeOverlayKey) return true;
                // Jeśli aktywny jest zestaw wielu nakładek pomiarowych (np. showEdgeOverlays([pick1, snap])),
                // ruch w obrębie którejkolwiek z tych krawędzi zachowuje aktywny zestaw.
                if (this.edgeOverlayKey.includes(';')) {
                    const activeKeys = this.edgeOverlayKey.split(';');
                    return activeKeys.includes(segmentKey);
                }
                return false;
            }
            case GeometryType.PLANE:
                return prev.faceName === curr.faceName;
            default:
                return true;
        }
    }

    /**
     * Wykrywa geometrię pod kursorem i podświetla ją.
     * @returns aktualny wynik detekcji
     */
    public update(pointerX: number, pointerY: number): DetectionResult {
        const result = this.resolveDetection(pointerX, pointerY);
        const segmentKey = this.hoveredSegment ? segmentKeyOf(this.hoveredSegment) : '';

        if (this.isSameDetection(this.lastDetection, result, segmentKey)) {
            // Zawsze aktualizujemy lastDetection świeżym wynikiem (w tym dokładnym pickedPoint)
            this.lastDetection = result.hit ? result : null;
            return result;
        }

        // Zachowujemy segment nowo wykryty przez resolveDetection przed wyczyszczeniem poprzedniego podświetlenia
        const nextSegment = this.hoveredSegment;

        this.clearHighlight();

        if (result.hit && result.mesh) {
            this.hoveredSegment = nextSegment;
            this.applyHighlight(result);
            this.hoveredMesh = result.mesh;
        } else {
            this.hoveredMesh = null;
            this.hoveredSegment = null;
        }

        this.lastDetection = result.hit ? result : null;
        return result;
    }

    /**
     * Detekcja bazowa z absolutnym priorytetem narożników ekranowych (wierzchołków),
     * a następnie krawędzi i płaszczyzn.
     */
    private resolveDetection(pointerX: number, pointerY: number): DetectionResult {
        const store = PMIStore.instance;
        const vertexSnap = store.vertexSnapPx;
        const vertices = vertexSnap > 0
            ? findVerticesNearPointer(this.scene, pointerX, pointerY, vertexSnap)
            : [];
        const edges = findEdgeSegmentsNearPointer(this.scene, pointerX, pointerY, store.edgeSnapPx);

        if (vertices.length > 0) {
            const bestV = vertices[0];
            this.hoveredSegment = null;
            return {
                hit: true,
                geometryType: GeometryType.VERTEX,
                pickedPoint: { ...bestV.world },
                normal: { x: 0, y: 1, z: 0 },
                faceName: null,
                cornerIndex: bestV.mesh?.metadata?.cornerIndex ?? -1,
                edgeKey: null,
                smartId: bestV.mesh?.metadata?.smartId ?? null,
                panelModel: bestV.mesh?.metadata?.panelModel ?? null,
                mesh: bestV.mesh,
            };
        }

        const result = this.detector.selectGeometry(pointerX, pointerY, 'AUTO');

        if (edges.length === 0) {
            this.hoveredSegment = null;
            return result;
        }

        const best = edges[0];
        const planeInterior = result.hit
            && result.geometryType === GeometryType.PLANE
            && best.distPx > Math.min(18, store.edgeSnapPx * 0.8);
        if (planeInterior) {
            this.hoveredSegment = null;
            return result;
        }

        this.hoveredSegment = best;
        return {
            hit: true,
            geometryType: GeometryType.EDGE,
            pickedPoint: { ...best.closestWorld },
            normal: result.normal ?? { x: 0, y: 1, z: 0 },
            faceName: null,
            cornerIndex: -1,
            edgeKey: best.mesh?.metadata?.edgeKey ?? null,
            smartId: best.mesh?.metadata?.smartId ?? null,
            panelModel: best.mesh?.metadata?.panelModel ?? null,
            mesh: best.mesh,
        };
    }

    private showVertexOverlay(pos: { x: number; y: number; z: number }): void {
        this.disposeVertexOverlay();
        // Stały rozmiar ekranowy (~10px) zamiast stałych 6mm w świecie.
        const baked = worldDiameterForPxAt(this.scene, pos, VERTEX_DIAMETER_PX, 3.0);
        const sphere = BABYLON.MeshBuilder.CreateSphere(
            'pmi_vertex_highlight',
            { diameter: baked, segments: 10 },
            this.scene,
        );
        sphere.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
        sphere.renderingGroupId = 2;
        sphere.isPickable = false;
        sphere.metadata = { ...(sphere.metadata || {}), isPmiOverlay: true };
        const mat = new BABYLON.StandardMaterial('pmi_vertex_hl_mat', this.scene);
        mat.emissiveColor = new BABYLON.Color3(1.0, 0.55, 0.0);
        mat.diffuseColor = new BABYLON.Color3(1.0, 0.55, 0.0);
        mat.disableLighting = true;
        mat.disableDepthWrite = true;
        sphere.material = mat;
        sphere.alwaysSelectAsActiveMesh = true;
        attachScreenConstantScale(sphere, baked, () => worldDiameterForPxAt(this.scene, pos, VERTEX_DIAMETER_PX, baked), false);
        this.vertexOverlay = sphere;
        try {
            ContextManager.instance?.viewport?.requestRender?.(2);
        } catch { /* ignore */ }
    }

    private disposeVertexOverlay(): void {
        if (this.vertexOverlay) {
            this.vertexOverlay.material?.dispose?.();
            this.vertexOverlay.dispose();
            this.vertexOverlay = null;
        }
    }

    /** Rysuje krawędź jako linię nad geometrią, więc widać ją także w styku formatek. */
    private showEdgeOverlay(segment: EdgeSegmentCandidate): void {
        this.showEdgeOverlays([segment]);
    }

    /** Podświetla krawędzie naraz — wyrazista linia CAD + nakładka tubowa na renderingGroupId 2. */
    public showEdgeOverlays(segments: EdgeSegmentCandidate[]): void {
        const key = segments.map(segmentKeyOf).join(';');
        if (key === this.edgeOverlayKey && this.edgeOverlays.length > 0) {
            return;
        }

        this.disposeEdgeOverlay();
        if (!segments.length) return;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const p1 = new BABYLON.Vector3(segment.p1World.x, segment.p1World.y, segment.p1World.z);
            const p2 = new BABYLON.Vector3(segment.p2World.x, segment.p2World.y, segment.p2World.z);
            if (BABYLON.Vector3.Distance(p1, p2) < 0.1) continue;

            // 1. Wyrazista linia overlay (CreateLines) — widoczna bezpośrednio na obrysie formatki
            const line = BABYLON.MeshBuilder.CreateLines(
                `pmi_edge_hl_line_${i}`,
                { points: [p1, p2] },
                this.scene,
            );
            line.color = new BABYLON.Color3(1.0, 0.55, 0.0);
            line.renderingGroupId = 2;
            line.isPickable = false;
            line.metadata = { ...(line.metadata || {}), isPmiOverlay: true };
            this.edgeOverlays.push(line);

            // 2. Gruby cylinder overlay — stała średnica na ekranie (HIGHLIGHT_DIAMETER_PX)
            const mid = BABYLON.Vector3.Lerp(p1, p2, 0.5);
            const midPos = { x: mid.x, y: mid.y, z: mid.z };
            const baked = worldDiameterForPxAt(this.scene, midPos, HIGHLIGHT_DIAMETER_PX, 1.2);
            const len = BABYLON.Vector3.Distance(p1, p2);
            const tube = BABYLON.MeshBuilder.CreateCylinder(
                `pmi_edge_hl_tube_${i}`,
                { height: len, diameter: baked, tessellation: 8 },
                this.scene,
            );
            tube.position = mid.clone();
            const diff = p2.subtract(p1);
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
            tube.renderingGroupId = 2;
            tube.isPickable = false;
            tube.metadata = { ...(tube.metadata || {}), isPmiOverlay: true };

            const mat = new BABYLON.StandardMaterial(`pmi_edge_hl_mat_${i}`, this.scene);
            mat.emissiveColor = new BABYLON.Color3(1.0, 0.55, 0.0);
            mat.diffuseColor = new BABYLON.Color3(1.0, 0.55, 0.0);
            mat.disableLighting = true;
            mat.alpha = 0.85;
            tube.material = mat;

            attachScreenConstantScale(
                tube,
                baked,
                () => worldDiameterForPxAt(this.scene, midPos, HIGHLIGHT_DIAMETER_PX, baked),
                true,
            );

            this.edgeOverlays.push(tube);
        }
        this.edgeOverlayKey = segments.map(segmentKeyOf).join(';');
        try {
            ContextManager.instance?.viewport?.requestRender?.(2);
        } catch { /* ignore */ }
    }

    private disposeEdgeOverlay(): void {
        for (const overlay of this.edgeOverlays) {
            overlay.material?.dispose?.();
            overlay.dispose?.();
        }
        this.edgeOverlays = [];
        this.edgeOverlayKey = '';
    }

    public clearHighlight(): void {
        const hadOverlays = this.edgeOverlays.length > 0 || this.vertexOverlay !== null;
        const hadState = this.hoveredMesh !== null || this.saved !== null || this.lastDetection !== null;

        this.disposeEdgeOverlay();
        this.disposeVertexOverlay();

        if (!hadOverlays && !hadState) {
            return;
        }

        const mesh = this.hoveredMesh;
        const saved = this.saved;

        this.hoveredMesh = null;
        this.saved = null;
        this.hoveredSegment = null;
        this.lastDetection = null;

        if (mesh && !mesh.isDisposed?.() && saved) {
            if (saved.kind === GeometryType.VERTEX) {
                if (saved.visibility !== undefined) mesh.visibility = saved.visibility;
                if (mesh.material) {
                    if (saved.alpha !== undefined) mesh.material.alpha = saved.alpha;
                    if (saved.diffuse) mesh.material.diffuseColor = saved.diffuse;
                    if (saved.emissive) mesh.material.emissiveColor = saved.emissive;
                }
            } else if (saved.kind === GeometryType.EDGE) {
                // Krawędź jest czystym overlayem (overlay-only) — brak mutacji mesh.color ani mesh.material
            } else if (saved.kind === GeometryType.PLANE && mesh.material) {
                if (saved.originalMaterial) {
                    if (mesh.material !== saved.originalMaterial) {
                        mesh.material.dispose?.();
                        mesh.material = saved.originalMaterial;
                    }
                }
                if (typeof saved.edgesWidth === 'number') mesh.edgesWidth = saved.edgesWidth;
                if (saved.edgesColor) mesh.edgesColor = saved.edgesColor;
            }
        }

        try {
            ContextManager.instance?.viewport?.requestRender?.(2);
        } catch { /* ignore */ }
    }

    public dispose(): void {
        this.clearHighlight();
    }

    private applyHighlight(result: DetectionResult): void {
        const mesh = result.mesh;
        if (!mesh || mesh.isDisposed?.()) return;

        if (result.geometryType === GeometryType.VERTEX) {
            this.saved = { kind: GeometryType.VERTEX };
            if (result.pickedPoint) {
                this.showVertexOverlay(result.pickedPoint);
            }
            return;
        }

        if (result.geometryType === GeometryType.EDGE) {
            // Kontrakt overlay-only: nie mutujemy mesh.color ani materiału bazowego formatki.
            // Rysowany jest wyłącznie wyrazisty overlay (linia + cylinder) w renderingGroupId 2.
            this.saved = { kind: GeometryType.EDGE };
            if (this.hoveredSegment) {
                this.showEdgeOverlay(this.hoveredSegment);
            }
            try {
                ContextManager.instance?.viewport?.requestRender?.(2);
            } catch { /* ignore */ }
            return;
        }

        if (result.geometryType === GeometryType.PLANE && mesh.material) {
            const originalMaterial = mesh.material;
            this.saved = {
                kind: GeometryType.PLANE,
                originalMaterial,
                edgesWidth: mesh.edgesWidth,
                edgesColor: mesh.edgesColor?.clone?.() ?? mesh.edgesColor,
            };
            if (typeof originalMaterial.clone === 'function') {
                const hlMat = originalMaterial.clone('pmi_plane_highlight_mat');
                hlMat.emissiveColor = new BABYLON.Color3(0.25, 0.45, 0.95);
                hlMat.diffuseColor = new BABYLON.Color3(0.35, 0.55, 1.0);
                mesh.material = hlMat;
            } else {
                const hlMat = new BABYLON.StandardMaterial('pmi_plane_highlight_mat', this.scene);
                hlMat.emissiveColor = new BABYLON.Color3(0.25, 0.45, 0.95);
                hlMat.diffuseColor = new BABYLON.Color3(0.35, 0.55, 1.0);
                mesh.material = hlMat;
            }
            if (mesh.edgesColor) mesh.edgesColor = new BABYLON.Color4(1.0, 0.75, 0.1, 1.0);
            try {
                ContextManager.instance?.viewport?.requestRender?.(2);
            } catch { /* ignore */ }
        }
    }
}
