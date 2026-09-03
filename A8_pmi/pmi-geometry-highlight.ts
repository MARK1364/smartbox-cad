/**
 * PMI Geometry Highlight — podświetlanie wykrytej geometrii pod kursorem
 * podczas wymiarowania (narożnik / krawędź / płaszczyzna).
 *
 * Odpowiednik hover_result + draw_geometry z pmi_ui.py / pmi_tool_base.py.
 */

declare const BABYLON: any;

import { DetectionResult, GeometryDetector, GeometryType } from '../A1_core/geometry-detector.js';
import {
    EdgeSegmentCandidate,
    findEdgeSegmentsNearPointer,
    findVerticesNearPointer,
} from './pmi-edge-pick.js';
import { PMIStore } from './pmi-data.js';

/** Identyfikuje odcinek po położeniu, więc pokrywające się krawędzie dają ten sam klucz. */
function segmentKeyOf(segment: EdgeSegmentCandidate): string {
    const q = (n: number) => Math.round(n * 2);
    return `${q(segment.p1World.x)},${q(segment.p1World.y)},${q(segment.p1World.z)}`
        + `|${q(segment.p2World.x)},${q(segment.p2World.y)},${q(segment.p2World.z)}`;
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
    alpha?: number;
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

    /** Nakładka rysowana na wierzchu — krawędź w styku dwóch formatek bywa zasłonięta. */
    private edgeOverlay: any = null;
    private edgeOverlayKey = '';
    private hoveredSegment: EdgeSegmentCandidate | null = null;

    constructor(scene: any) {
        this.scene = scene;
        this.detector = new GeometryDetector(scene);
    }

    /** Etykieta typu geometrii pod kursorem (do paska statusu). */
    public static labelOf(type: GeometryType): string {
        return TYPE_LABEL[type] ?? type;
    }

    /**
     * Wykrywa geometrię pod kursorem i podświetla ją.
     * @returns aktualny wynik detekcji
     */
    public update(pointerX: number, pointerY: number): DetectionResult {
        const result = this.resolveDetection(pointerX, pointerY);
        const segmentKey = this.hoveredSegment ? segmentKeyOf(this.hoveredSegment) : '';

        if (result.mesh === this.hoveredMesh && segmentKey === this.edgeOverlayKey) {
            this.lastDetection = result.hit ? result : null;
            return result;
        }

        this.clearHighlight();

        if (result.hit && result.mesh) {
            this.applyHighlight(result);
            this.hoveredMesh = result.mesh;
        } else {
            this.hoveredMesh = null;
        }

        this.lastDetection = result.hit ? result : null;
        return result;
    }

    /**
     * Detekcja bazowa uzupełniona o krawędzie łapane w pikselach ekranu — bez tego
     * cienkie i pokrywające się krawędzie wymagają trafienia co do piksela.
     */
    private resolveDetection(pointerX: number, pointerY: number): DetectionResult {
        const store = PMIStore.instance;
        const result = this.detector.selectGeometry(pointerX, pointerY, 'AUTO');

        const vertexNear = store.vertexSnapPx > 0
            && findVerticesNearPointer(this.scene, pointerX, pointerY, store.vertexSnapPx).length > 0;
        if (result.hit && result.geometryType === GeometryType.VERTEX && vertexNear) {
            this.hoveredSegment = null;
            return result;
        }

        const edges = findEdgeSegmentsNearPointer(this.scene, pointerX, pointerY, store.edgeSnapPx);
        if (edges.length === 0) {
            this.hoveredSegment = null;
            return result;
        }

        const best = edges[0];
        const planeInterior = result.hit
            && result.geometryType === GeometryType.PLANE
            && best.distPx > Math.min(8, store.edgeSnapPx * 0.45);
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

    /** Rysuje krawędź jako linię nad geometrią, więc widać ją także w styku formatek. */
    private showEdgeOverlay(segment: EdgeSegmentCandidate): void {
        this.showEdgeOverlays([segment]);
    }

    /** Podświetla wiele krawędzi naraz (np. połączony łańcuch Ctrl). */
    public showEdgeOverlays(segments: EdgeSegmentCandidate[]): void {
        this.disposeEdgeOverlay();
        if (!segments.length) return;

        const lines: any[] = [];
        for (const segment of segments) {
            lines.push(
                new BABYLON.Vector3(segment.p1World.x, segment.p1World.y, segment.p1World.z),
                new BABYLON.Vector3(segment.p2World.x, segment.p2World.y, segment.p2World.z),
            );
        }

        this.edgeOverlay = BABYLON.MeshBuilder.CreateLines(
            'pmi_edge_highlight',
            { points: lines },
            this.scene,
        );
        this.edgeOverlay.color = new BABYLON.Color3(1.0, 0.55, 0.05);
        this.edgeOverlay.isPickable = false;
        this.edgeOverlay.renderingGroupId = 3;
        if (this.edgeOverlay.material) {
            this.edgeOverlay.material.disableDepthWrite = true;
            this.edgeOverlay.material.depthFunction = BABYLON.Engine.ALWAYS;
        }
        this.edgeOverlayKey = segments.map(segmentKeyOf).join('|');
    }

    private disposeEdgeOverlay(): void {
        if (this.edgeOverlay) {
            this.edgeOverlay.dispose();
            this.edgeOverlay = null;
        }
        this.edgeOverlayKey = '';
    }

    public clearHighlight(): void {
        this.disposeEdgeOverlay();

        if (!this.hoveredMesh || this.hoveredMesh.isDisposed?.()) {
            this.hoveredMesh = null;
            this.saved = null;
            return;
        }

        const mesh = this.hoveredMesh;
        const saved = this.saved;
        if (!saved) {
            this.hoveredMesh = null;
            return;
        }

        if (saved.kind === GeometryType.VERTEX && mesh.material) {
            mesh.material.alpha = saved.alpha ?? 0;
            if (saved.diffuse) mesh.material.diffuseColor = saved.diffuse;
            if (saved.emissive) mesh.material.emissiveColor = saved.emissive;
        } else if (saved.kind === GeometryType.EDGE) {
            if (mesh.color !== undefined && saved.lineColor) {
                mesh.color = saved.lineColor;
            } else if (mesh.material) {
                if (saved.emissive) mesh.material.emissiveColor = saved.emissive;
                if (saved.diffuse) mesh.material.diffuseColor = saved.diffuse;
            }
        } else if (saved.kind === GeometryType.PLANE && mesh.material) {
            if (saved.emissive) mesh.material.emissiveColor = saved.emissive;
            if (saved.diffuse) mesh.material.diffuseColor = saved.diffuse;
            if (typeof saved.edgesWidth === 'number') mesh.edgesWidth = saved.edgesWidth;
            if (saved.edgesColor) mesh.edgesColor = saved.edgesColor;
        }

        this.hoveredMesh = null;
        this.saved = null;
    }

    public dispose(): void {
        this.clearHighlight();
        this.hoveredSegment = null;
        this.lastDetection = null;
    }

    private applyHighlight(result: DetectionResult): void {
        const mesh = result.mesh;
        if (!mesh || mesh.isDisposed?.()) return;

        if (result.geometryType === GeometryType.VERTEX && mesh.material) {
            this.saved = {
                kind: GeometryType.VERTEX,
                alpha: mesh.material.alpha,
                diffuse: mesh.material.diffuseColor?.clone?.() ?? mesh.material.diffuseColor,
                emissive: mesh.material.emissiveColor?.clone?.() ?? mesh.material.emissiveColor,
            };
            mesh.material.alpha = 1.0;
            mesh.material.diffuseColor = new BABYLON.Color3(1.0, 0.55, 0.05);
            mesh.material.emissiveColor = new BABYLON.Color3(0.85, 0.35, 0.0);
            return;
        }

        if (result.geometryType === GeometryType.EDGE) {
            this.saved = { kind: GeometryType.EDGE };
            if (this.hoveredSegment) this.showEdgeOverlay(this.hoveredSegment);
            if (mesh.color !== undefined) {
                this.saved.lineColor = mesh.color?.clone?.() ?? mesh.color;
                mesh.color = new BABYLON.Color3(1.0, 0.65, 0.1);
            } else if (mesh.material) {
                this.saved.emissive = mesh.material.emissiveColor?.clone?.() ?? mesh.material.emissiveColor;
                this.saved.diffuse = mesh.material.diffuseColor?.clone?.() ?? mesh.material.diffuseColor;
                mesh.material.emissiveColor = new BABYLON.Color3(0.9, 0.45, 0.05);
                mesh.material.diffuseColor = new BABYLON.Color3(1.0, 0.7, 0.15);
            }
            return;
        }

        if (result.geometryType === GeometryType.PLANE && mesh.material) {
            this.saved = {
                kind: GeometryType.PLANE,
                emissive: mesh.material.emissiveColor?.clone?.() ?? mesh.material.emissiveColor,
                diffuse: mesh.material.diffuseColor?.clone?.() ?? mesh.material.diffuseColor,
                edgesWidth: mesh.edgesWidth,
                edgesColor: mesh.edgesColor?.clone?.() ?? mesh.edgesColor,
            };
            mesh.material.emissiveColor = new BABYLON.Color3(0.25, 0.45, 0.95);
            mesh.material.diffuseColor = new BABYLON.Color3(0.35, 0.55, 1.0);
            if (typeof mesh.edgesWidth === 'number') mesh.edgesWidth = 4.0;
            if (mesh.edgesColor) mesh.edgesColor = new BABYLON.Color4(1.0, 0.75, 0.1, 1.0);
        }
    }
}
