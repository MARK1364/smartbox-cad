/**
 * PMI Measure Pick — wybór elementów dla narzędzia Pomiar.
 *
 * Logika picka jest oddzielona od narzędzia i renderera, żeby testować
 * priorytety (Ctrl vs bez Ctrl) bez pełnej sceny Babylona.
 */

import { GeometryType } from '../A1_core/geometry-detector.js';
import { Vec3, v3 } from './dimension-solver';
import {
    PMIAnchorRef,
    buildAnchorRef,
    snapWorldPointToPanelGeometry,
} from './pmi-id-bridge';
import {
    EdgeSegmentCandidate,
    findEdgeSegmentsNearPointer,
    findVerticesNearPointer,
} from './pmi-edge-pick.js';
import { MeasureElementKind } from './pmi-measure';

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
}

/**
 * Ctrl: narożnik → krawędź (tylko przy rimie) → płaszczyzna.
 * Bez Ctrl: krawędź ma pierwszeństwo (szybka długość).
 */
export function findMeasureElementPick(ctx: MeasurePickContext): MeasureElementPick | null {
    const { scene, pointerX, pointerY, ctrl, vertexSnapPx, edgeSnapPx, lastDetection } = ctx;
    if (!scene) return null;

    const vertices = findVerticesNearPointer(scene, pointerX, pointerY, vertexSnapPx);
    const edges = findEdgeSegmentsNearPointer(
        scene,
        pointerX,
        pointerY,
        ctrl ? edgeSnapPx + 4 : edgeSnapPx,
    );
    const planeHit = findPlaneHit(scene, pointerX, pointerY, lastDetection);

    if (ctrl) {
        if (vertices.length > 0) return vertexPickToMeasure(vertices[0]);

        const onFaceInterior = !!planeHit && (!edges.length || edges[0].distPx > Math.min(8, edgeSnapPx * 0.45));
        if (onFaceInterior && planeHit) return planeHit;

        if (edges.length > 0) return edgePickToMeasure(edges[0]);
        if (planeHit) return planeHit;
        if (lastDetection?.hit && lastDetection.geometryType === GeometryType.VERTEX
            && lastDetection.pickedPoint && lastDetection.mesh) {
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
        return fallbackPointPick(scene, pointerX, pointerY);
    }

    if (edges.length > 0) return edgePickToMeasure(edges[0]);
    if (vertices.length > 0) return vertexPickToMeasure(vertices[0]);
    return fallbackPointPick(scene, pointerX, pointerY);
}

export function findPlaneHit(
    scene: any,
    pointerX: number,
    pointerY: number,
    lastDetection: GeometryDetectionSnapshot | null,
): MeasureElementPick | null {
    if (!scene) return null;

    if (lastDetection?.hit && lastDetection.geometryType === GeometryType.PLANE
        && lastDetection.pickedPoint && lastDetection.mesh && lastDetection.normal) {
        const worldPos = v3(
            lastDetection.pickedPoint.x,
            lastDetection.pickedPoint.y,
            lastDetection.pickedPoint.z,
        );
        const snapped = snapWorldPointToPanelGeometry(scene, lastDetection.mesh, worldPos, 1e6);
        const pos = snapped?.worldPos ?? worldPos;
        return {
            worldPos: pos,
            anchor: snapped?.anchor ?? buildAnchorRef(lastDetection.mesh, pos),
            mesh: lastDetection.mesh,
            kind: 'plane',
            edge: null,
            planeNormal: v3(lastDetection.normal.x, lastDetection.normal.y, lastDetection.normal.z),
        };
    }

    const hits = scene.multiPick?.(
        pointerX,
        pointerY,
        (m: any) => m && m.isEnabled() && m.metadata && m.metadata.faceName,
    );
    if (!hits || hits.length === 0) return null;
    const valid = hits.filter((h: any) => h.hit && h.pickedMesh && h.pickedPoint);
    if (!valid.length) return null;
    valid.sort((a: any, b: any) => a.distance - b.distance);
    const hit = valid[0];
    const worldPos = v3(hit.pickedPoint.x, hit.pickedPoint.y, hit.pickedPoint.z);
    const snapped = snapWorldPointToPanelGeometry(scene, hit.pickedMesh, worldPos, 1e6);
    const pos = snapped?.worldPos ?? worldPos;
    const norm = hit.getNormal ? hit.getNormal(true) : null;
    if (!norm) return null;
    return {
        worldPos: pos,
        anchor: snapped?.anchor ?? buildAnchorRef(hit.pickedMesh, pos),
        mesh: hit.pickedMesh,
        kind: 'plane',
        edge: null,
        planeNormal: v3(norm.x, norm.y, norm.z),
    };
}

function fallbackPointPick(scene: any, pointerX: number, pointerY: number): MeasureElementPick | null {
    const hit = scene.pick(pointerX, pointerY, (m: any) => m && m.isPickable && !m.name?.startsWith('pmi_'));
    if (hit?.hit && hit.pickedMesh && hit.pickedPoint) {
        const worldPos = v3(hit.pickedPoint.x, hit.pickedPoint.y, hit.pickedPoint.z);
        return {
            worldPos,
            anchor: buildAnchorRef(hit.pickedMesh, worldPos),
            mesh: hit.pickedMesh,
            kind: 'point',
            edge: null,
            planeNormal: null,
        };
    }
    return null;
}

function vertexPickToMeasure(v: { mesh: any; world: Vec3 }): MeasureElementPick {
    return {
        worldPos: v.world,
        anchor: buildAnchorRef(v.mesh, v.world),
        mesh: v.mesh,
        kind: 'vertex',
        edge: null,
        planeNormal: null,
    };
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
