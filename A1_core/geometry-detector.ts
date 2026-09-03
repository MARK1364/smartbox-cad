/**
 * SmartPanel Web — A1_Core Geometry Detector
 * 
 * Odpowiednik modułu `A1_core.geometry_detector` z Blendera w języku TypeScript / Babylon.js.
 * Służy do automatycznego wykrywania geometrii 3D (naroży, krawędzi, płaszczyzn) pod kursorem myszy
 * i przyciągania do nich bazy WCS oraz narzędzi CAD.
 */

declare const BABYLON: any;

export enum GeometryType {
    VERTEX = 'vertex',
    EDGE = 'edge',
    PLANE = 'plane',
    FEATURE = 'feature',
    OBJECT = 'object'
}

export interface DetectionResult {
    hit: boolean;
    geometryType: GeometryType;
    pickedPoint: { x: number; y: number; z: number } | null;
    normal: { x: number; y: number; z: number } | null;
    faceName: string | null;
    cornerIndex: number;
    edgeKey: string | null;
    smartId: any;
    panelModel: any;
    mesh: any;
}

export class GeometryDetector {
    private scene: any;

    constructor(scene: any) {
        this.scene = scene;
    }

    /**
     * Główna funkcja detekcji geometrii pod kursorem myszy (odpowiednik select_geometry z Blendera).
     */
    public selectGeometry(pointerX: number, pointerY: number, mode: 'AUTO' | 'VERTEX' | 'EDGE' | 'PLANE' = 'AUTO'): DetectionResult {
        if (!this.scene) {
            return this.createEmptyResult();
        }

        // 1. Priorytetowy MultiPick dla małych obiektów (naroża, krawędzie, cechy CAM)
        const hits = this.scene.multiPick(
            pointerX,
            pointerY,
            (mesh: any) => mesh && mesh.isEnabled() && mesh.metadata && (mesh.metadata.type || mesh.metadata.faceName)
        );

        if (hits && hits.length > 0) {
            const validHits = hits.filter((h: any) => h.hit && h.pickedMesh);
            
            if (mode === 'AUTO' || mode === 'VERTEX') {
                const vertexHit = validHits.find((h: any) => h.pickedMesh.metadata.type === 'vertex');
                if (vertexHit) {
                    const mesh = vertexHit.pickedMesh;
                    return {
                        hit: true,
                        geometryType: GeometryType.VERTEX,
                        pickedPoint: vertexHit.pickedPoint ? { x: vertexHit.pickedPoint.x, y: vertexHit.pickedPoint.y, z: vertexHit.pickedPoint.z } : null,
                        normal: { x: 0, y: 0, z: 1 },
                        faceName: null,
                        cornerIndex: mesh.metadata.cornerIndex ?? -1,
                        edgeKey: null,
                        smartId: mesh.metadata.smartId,
                        panelModel: mesh.metadata.panelModel,
                        mesh: mesh
                    };
                }
            }

            if (mode === 'AUTO' || mode === 'EDGE') {
                const edgeHit = validHits.find((h: any) => h.pickedMesh.metadata.type === 'edge');
                if (edgeHit) {
                    const mesh = edgeHit.pickedMesh;
                    return {
                        hit: true,
                        geometryType: GeometryType.EDGE,
                        pickedPoint: edgeHit.pickedPoint ? { x: edgeHit.pickedPoint.x, y: edgeHit.pickedPoint.y, z: edgeHit.pickedPoint.z } : null,
                        normal: { x: 0, y: 1, z: 0 },
                        faceName: null,
                        cornerIndex: -1,
                        edgeKey: mesh.metadata.edgeKey || null,
                        smartId: mesh.metadata.smartId,
                        panelModel: mesh.metadata.panelModel,
                        mesh: mesh
                    };
                }

                const featureHit = validHits.find((h: any) => h.pickedMesh.metadata.type === 'feature');
                if (featureHit) {
                    const mesh = featureHit.pickedMesh;
                    return {
                        hit: true,
                        geometryType: GeometryType.FEATURE,
                        pickedPoint: featureHit.pickedPoint ? { x: featureHit.pickedPoint.x, y: featureHit.pickedPoint.y, z: featureHit.pickedPoint.z } : null,
                        normal: { x: 0, y: 1, z: 0 },
                        faceName: null,
                        cornerIndex: -1,
                        edgeKey: null,
                        smartId: mesh.metadata.smartId,
                        panelModel: mesh.metadata.panelModel,
                        mesh: mesh
                    };
                }
            }
        }

        // 2. Fallback dla płaszczyzn (ścianek 3D formatki)
        const faceHits = this.scene.multiPick(
            pointerX,
            pointerY,
            (mesh: any) => mesh && mesh.isEnabled() && mesh.metadata && mesh.metadata.faceName
        );

        if (faceHits && faceHits.length > 0) {
            const validHits = faceHits.filter((h: any) => h.hit && h.pickedMesh);
            if (validHits.length > 0) {
                validHits.sort((a: any, b: any) => a.distance - b.distance);
                const planeHit = validHits[0];
                const mesh = planeHit.pickedMesh;
                const norm = planeHit.getNormal(true) || new BABYLON.Vector3(0, 0, 1);
                return {
                    hit: true,
                    geometryType: GeometryType.PLANE,
                    pickedPoint: planeHit.pickedPoint ? { x: planeHit.pickedPoint.x, y: planeHit.pickedPoint.y, z: planeHit.pickedPoint.z } : null,
                    normal: { x: norm.x, y: norm.y, z: norm.z },
                    faceName: mesh.metadata.faceName || null,
                    cornerIndex: -1,
                    edgeKey: null,
                    smartId: mesh.metadata.smartId,
                    panelModel: mesh.metadata.panelModel,
                    mesh: mesh
                };
            }
        }

        return this.createEmptyResult();
    }

    private createEmptyResult(): DetectionResult {
        return {
            hit: false,
            geometryType: GeometryType.OBJECT,
            pickedPoint: null,
            normal: null,
            faceName: null,
            cornerIndex: -1,
            edgeKey: null,
            smartId: null,
            panelModel: null,
            mesh: null
        };
    }
}
