/**
 * PMI Measure Pick — wybór elementów dla narzędzia Pomiar.
 *
 * Logika picka jest oddzielona od narzędzia i renderera, żeby testować
 * priorytety (Ctrl vs bez Ctrl) bez pełnej sceny Babylona.
 */

declare const BABYLON: any;

import { GeometryType } from '../A1_core/geometry-detector.js';
import { Vec3, v3 } from './dimension-solver';
import {
    PMIAnchorRef,
    buildAnchorRef,
    localToWorldFromBrep,
    planeNormalWorldFromMesh,
    resolveBrepGeometryPick,
} from './pmi-id-bridge';
import { EdgeSegmentCandidate } from './pmi-edge-pick.js';
import { MeasureElementKind } from './pmi-measure';
import { ContextManager } from '../A1_core/context-manager';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Pobiera PanelView z meshu na podstawie nodeId.
 */
function getPanelViewFromMesh(mesh: any): any {
    const model = mesh?.metadata?.panelModel;
    if (!model) return null;
    const panelViews = ContextManager.instance.panelViews;
    if (!panelViews) return null;
    const direct = panelViews.get(model) || panelViews.get(model.id);
    if (direct) return direct;
    for (const view of panelViews.values()) {
        if (view?.model?.id === model.id) return view;
    }
    return null;
}

// ============================================================================
// MEASURE ELEMENT PICK
// ============================================================================

export interface MeasureElementPick {
    worldPos: Vec3;
    anchor: PMIAnchorRef;
    mesh: any;
    kind: MeasureElementKind;
    edge: EdgeSegmentCandidate | null;
    planeNormal: Vec3 | null;
}

export interface GeometryDetectionSnapshot {
    hit?: boolean;
    geometryType?: GeometryType;
    pickedPoint?: { x: number; y: number; z: number };
    mesh?: any;
    normal?: { x: number; y: number; z: number };
}

export interface MeasurePickContext {
    scene: any;
    pointerX: number;
    pointerY: number;
    ctrl: boolean;
    vertexSnapPx: number;
    edgeSnapPx: number;
    lastDetection: GeometryDetectionSnapshot | null;
    hoveredSegment?: EdgeSegmentCandidate | null;
}

/**
 * Wybór jest w całości oparty na aktualnym podświetleniu geometrii.
 * Dzięki temu klik zawsze wybiera to, co użytkownik widzi w scenie:
 * narożnik (kula), krawędź (linia) albo płaszczyznę.
 */
export function findMeasureElementPick(ctx: MeasurePickContext): MeasureElementPick | null {
    const { scene, lastDetection, hoveredSegment } = ctx;
    if (!scene) return null;

    if (lastDetection?.hit && lastDetection.pickedPoint && lastDetection.mesh) {
        // === nowa logika: spróbuj najpierw B-rep ===
        const panelView = getPanelViewFromMesh(lastDetection.mesh);
        if (panelView) {
            const fakeHit = {
                pickedMesh: lastDetection.mesh,
                pickedPoint: new BABYLON.Vector3(
                    lastDetection.pickedPoint.x,
                    lastDetection.pickedPoint.y,
                    lastDetection.pickedPoint.z,
                ),
                getNormal: (useWorld?: boolean) => {
                    if (!lastDetection.normal) return null;
                    return new BABYLON.Vector3(lastDetection.normal.x, lastDetection.normal.y, lastDetection.normal.z);
                },
            };
            const brepPick = resolveBrepGeometryPick(scene, fakeHit, panelView);
            if (brepPick) {
                return {
                    worldPos: brepPick.kind === 'EDGE'
                        ? brepPick.anchorRef.pointWorldFallback
                        : brepPick.worldPos,
                    anchor: brepPick.anchorRef,
                    mesh: lastDetection.mesh,
                    kind: mapBrepKindToMeasureKind(brepPick.kind),
                    edge: brepPick.kind === 'EDGE' ? brepEdgeSegment(lastDetection.mesh, brepPick, panelView) : null,
                    planeNormal: brepPick.kind === 'FACE' ? planeNormalWorldFromMesh(lastDetection.mesh) : null,
                };
            }
            return null;
        }
        if (lastDetection.mesh.metadata?.panelModel) return null;

        // Narożnik wybieramy wyłącznie wtedy, gdy highlighter go pokazał.
        // Brak zapasowego skanu wierzchołków — inaczej klik w płaszczyznę
        // mógłby po cichu wybrać narożnik.
        if (lastDetection.geometryType === GeometryType.VERTEX) {
            const worldPos = v3(
                lastDetection.pickedPoint.x,
                lastDetection.pickedPoint.y,
                lastDetection.pickedPoint.z,
            );
            return {
                worldPos,
                anchor: buildAnchorRef(lastDetection.mesh, worldPos),
                mesh: lastDetection.mesh,
                kind: 'vertex',
                edge: null,
                planeNormal: null,
            };
        }

        // Podświetlona płaszczyzna ma pierwszeństwo przed pobliską
        // krawędzią. Klik w ścianę ma pozostać pomiarem płaszczyzny.
        if (lastDetection.geometryType === GeometryType.PLANE) {
            const planeHit = findPlaneHit(lastDetection);
            if (planeHit) return planeHit;
        }

        if (lastDetection.geometryType === GeometryType.EDGE && hoveredSegment) {
            return edgePickToMeasure(hoveredSegment);
        }
    }

    // Brak podświetlonej geometrii: nie wybieramy niczego.
    return null;
}

/**
 * Mapuje typ B-rep na MeasureElementKind.
 */
function mapBrepKindToMeasureKind(kind: string): MeasureElementKind {
    switch (kind) {
        case 'VERTEX': return 'vertex';
        case 'EDGE': return 'edge';
        case 'FACE': return 'plane';
        default: return 'vertex';
    }
}

/**
 * Pobiera normalną ściany z danych B-rep.
 */
function brepEdgeSegment(mesh: any, brepPick: { worldPos: Vec3 }, panelView: any): EdgeSegmentCandidate | null {
    const points = mesh?.metadata?.brepPoints;
    if (!Array.isArray(points) || points.length < 2) return null;
    const nodeId = mesh?.metadata?.panelModel?.id;
    if (!nodeId) return null;
    const p1World = localToWorldFromBrep(nodeId, v3(points[0][0], points[0][1], points[0][2]), panelView);
    const p2World = localToWorldFromBrep(nodeId, v3(points[1][0], points[1][1], points[1][2]), panelView);
    if (!p1World || !p2World) return null;
    return {
        mesh,
        p1World,
        p2World,
        p1Local: v3(points[0][0], points[0][1], points[0][2]),
        p2Local: v3(points[1][0], points[1][1], points[1][2]),
        index1: 0,
        index2: 1,
        closestWorld: brepPick.worldPos,
        distPx: 0,
        depth: 0,
    };
}

export function findPlaneHit(
    lastDetection: GeometryDetectionSnapshot | null,
): MeasureElementPick | null {
    if (lastDetection?.hit && lastDetection.geometryType === GeometryType.PLANE
        && lastDetection.pickedPoint && lastDetection.mesh) {
        const worldPos = v3(
            lastDetection.pickedPoint.x,
            lastDetection.pickedPoint.y,
            lastDetection.pickedPoint.z,
        );
        const exactNormal = planeNormalWorldFromMesh(lastDetection.mesh);
        if (!exactNormal) return null;
        return {
            worldPos,
            anchor: buildAnchorRef(lastDetection.mesh, worldPos),
            mesh: lastDetection.mesh,
            kind: 'plane',
            edge: null,
            planeNormal: exactNormal,
        };
    }

    return null;
}

function edgePickToMeasure(edge: EdgeSegmentCandidate): MeasureElementPick {
    return {
        worldPos: edge.closestWorld,
        anchor: buildAnchorRef(edge.mesh, edge.closestWorld),
        mesh: edge.mesh,
        kind: 'edge',
        edge,
        planeNormal: null,
    };
}
