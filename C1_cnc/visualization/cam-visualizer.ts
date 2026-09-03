/**
 * SmartPanel Web — C1_CNC CAM Visualizer
 * 
 * Wizualizator 3D w Babylon.js tworzący profesjonalne reprezentacje cech obróbczych (otwory, wpusty, kontury) 
 * oraz trójwymiarowe gizmo układu bazy WCS (strzałki RGB X/Y/Z z kulką centralną) przyklejane do wierzchołka formatki.
 */

import { HoleFeature, GrooveFeature, ContourFeature, CAMFeature, Vector3D, Tool } from '../dto/cam-dto.js';
import { CNCToolMeshFactory } from './tool-mesh-factory.js';
import { generateEffectiveContourPath } from '../geometry/cnc-geometry-utils.js';

declare const BABYLON: any;

export class CAMVisualizer {
    private scene: any;
    private camRootNode: any = null;
    private wcsGizmoNode: any = null;
    private partAxesNode: any = null;
    private worldMeshes: any[] = [];

    constructor(scene: any) {
        this.scene = scene;
        this.initRootNodes();
    }

    private initRootNodes(): void {
        if (!this.scene) return;
        this.clear();

        this.camRootNode = new BABYLON.TransformNode("CAM_Visualizer_Root", this.scene);
        this.wcsGizmoNode = new BABYLON.TransformNode("CAM_WCS_Gizmo_Root", this.scene);
    }

    public clear(): void {
        if (this.camRootNode) {
            this.camRootNode.dispose(false, true);
            this.camRootNode = null;
        }
        if (this.wcsGizmoNode) {
            this.wcsGizmoNode.dispose(false, true);
            this.wcsGizmoNode = null;
        }
        if (this.partAxesNode) {
            this.partAxesNode.dispose(false, true);
            this.partAxesNode = null;
        }
        if (this.worldMeshes) {
            for (const mesh of this.worldMeshes) {
                if (mesh && !mesh.isDisposed()) mesh.dispose();
            }
            this.worldMeshes = [];
        }
    }

    /**
     * Rysuje gizmo WCS w wybranym narożniku formatki (parentNode = view.root z 3D scene).
     */
    public renderWcsGizmo(wcsManager: any, parentNode: any = null, panelObj: any = null): void {
        if (!this.scene) return;
        if (this.wcsGizmoNode) this.wcsGizmoNode.dispose(false, true);

        const origin = wcsManager.getOrigin();
        const wcsName = wcsManager.getWcsName();
        this.wcsGizmoNode = new BABYLON.TransformNode(`WCS_${wcsName}`, this.scene);
        
        // Przyklejanie układu WCS do 3D TransformNode formatki (jak parent w Blenderze)
        if (parentNode) {
            this.wcsGizmoNode.parent = parentNode;
        }

        // Pozycja lokalna narożnika względem formatki
        this.wcsGizmoNode.position = new BABYLON.Vector3(origin.x, origin.y, origin.z);

        // Aplikacja rotacji z reguł (zamiana stopni na radiany)
        const rot = wcsManager.getRotation();
        this.wcsGizmoNode.rotation = new BABYLON.Vector3(
            rot.x * Math.PI / 180,
            rot.y * Math.PI / 180,
            rot.z * Math.PI / 180
        );

        this.wcsGizmoNode.scaling = new BABYLON.Vector3(1, 1, 1);
        const dirs = wcsManager.getDirections();

        const arrowLength = 90;
        const thickness = 3.0;

        // Centralna złocista kulka punktu zerowego WCS (Origin)
        const originSphere = BABYLON.MeshBuilder.CreateSphere("WCS_Origin_Sphere", {
            diameter: 12,
            segments: 16
        }, this.scene);
        const originMat = new BABYLON.StandardMaterial("WCS_Origin_Mat", this.scene);
        originMat.diffuseColor = new BABYLON.Color3(1.0, 0.84, 0.0); // Gold
        originMat.emissiveColor = new BABYLON.Color3(0.5, 0.42, 0.0);
        originMat.specularColor = new BABYLON.Color3(1, 1, 1);
        originMat.backFaceCulling = false;
        originSphere.material = originMat;
        originSphere.parent = this.wcsGizmoNode;

        const createArrow = (name: string, color: any, dir: 'X' | 'Y' | 'Z', sign: number) => {
            const mat = new BABYLON.StandardMaterial(`${name}_Mat`, this.scene);
            mat.diffuseColor = color;
            mat.emissiveColor = color.scale(0.6);
            mat.specularPower = 32;
            mat.backFaceCulling = false;

            const cylinder = BABYLON.MeshBuilder.CreateCylinder(name, {
                height: arrowLength,
                diameter: thickness,
                tessellation: 16
            }, this.scene);
            cylinder.material = mat;

            if (dir === 'X') {
                cylinder.rotation.z = sign < 0 ? Math.PI / 2 : -Math.PI / 2;
                cylinder.position.x = (arrowLength / 2) * sign;
            } else if (dir === 'Z') {
                cylinder.rotation.x = sign < 0 ? -Math.PI / 2 : Math.PI / 2;
                cylinder.position.z = (arrowLength / 2) * sign;
            } else {
                cylinder.position.y = (arrowLength / 2) * sign;
                if (sign < 0) cylinder.rotation.z = Math.PI;
            }
            cylinder.parent = this.wcsGizmoNode;

            const cone = BABYLON.MeshBuilder.CreateCylinder(`${name}_head`, {
                height: 18,
                diameterTop: 0,
                diameterBottom: thickness * 3.2,
                tessellation: 16
            }, this.scene);
            cone.material = mat;
            cone.position.y = arrowLength / 2 + 9;
            cone.parent = cylinder;
        };

        // Oś X (Czerwona), Oś Y (Zielona), Oś Z (Niebieska)
        createArrow("WCS_X", new BABYLON.Color3(0.95, 0.25, 0.25), 'X', dirs.x);
        createArrow("WCS_Y", new BABYLON.Color3(0.25, 0.85, 0.25), 'Y', dirs.y);
        createArrow("WCS_Z", new BABYLON.Color3(0.25, 0.45, 0.95), 'Z', dirs.z);

        // --- NATYWNY UKŁAD WSPÓŁRZĘDNYCH SAMEJ FORMATKI ---
        // Usunięto wymuszanie setLcsVisible(true) - widoczność jest teraz sterowana globalnie
    }

    /**
     * Rysuje podgląd 3D cech CAM przydzielonych do narożnika formatki.
     */
    public renderFeatures(features: CAMFeature[], wcsManager: any, parentNode: any = null): void {
        if (!this.scene) return;
        if (this.camRootNode) this.camRootNode.dispose(false, true);
        if (this.worldMeshes) {
            for (const mesh of this.worldMeshes) {
                if (mesh && !mesh.isDisposed()) mesh.dispose();
            }
            this.worldMeshes = [];
        }

        this.camRootNode = new BABYLON.TransformNode("CAM_Features_Root", this.scene);
        if (parentNode) {
            this.camRootNode.parent = parentNode;
        }
        
        if (wcsManager) {
            this.renderWcsGizmo(wcsManager, parentNode);
            
            const dirs = wcsManager.getDirections();
            this.camRootNode.parent = this.wcsGizmoNode;
            this.camRootNode.position = new BABYLON.Vector3(0, 0, 0);
            this.camRootNode.rotation = new BABYLON.Vector3(0, 0, 0);
            this.camRootNode.scaling = new BABYLON.Vector3(dirs.x, dirs.y, dirs.z);
        } else {
            this.camRootNode.position = new BABYLON.Vector3(0, 0, 0);
            if (this.wcsGizmoNode) this.wcsGizmoNode.dispose(false, true);
        }

        const holeMat = new BABYLON.StandardMaterial("CAM_Hole_Mat", this.scene);
        holeMat.diffuseColor = new BABYLON.Color3(1.0, 0.5, 0.0);
        holeMat.emissiveColor = new BABYLON.Color3(0.3, 0.15, 0.0);
        holeMat.alpha = 0.65;

        const grooveMat = new BABYLON.StandardMaterial("CAM_Groove_Mat", this.scene);
        grooveMat.diffuseColor = new BABYLON.Color3(0.0, 0.8, 1.0);
        grooveMat.emissiveColor = new BABYLON.Color3(0.0, 0.25, 0.35);
        grooveMat.alpha = 0.55;

        const profileMat = new BABYLON.StandardMaterial("CAM_Profile_Mat", this.scene);
        profileMat.diffuseColor = new BABYLON.Color3(0.0, 0.75, 0.95); // Seledynowy / niebieski CAD
        profileMat.emissiveColor = new BABYLON.Color3(0.0, 0.4, 0.6); // Subtelny stały blask 3D
        profileMat.alpha = 0.85;

        for (const feature of features) {
            if ('position' in feature) {
                // Otwór / Grupa otworów
                const hole = feature as HoleFeature;
                const positions = (hole.positions && hole.positions.length > 0) ? hole.positions : [hole.position];
                
                for (let pIdx = 0; pIdx < positions.length; pIdx++) {
                    const pt = positions[pIdx];
                    const cyl = BABYLON.MeshBuilder.CreateCylinder(`Hole_${hole.featureId}_${pIdx}`, {
                        diameter: hole.diameter,
                        height: hole.depth,
                        tessellation: 24
                    }, this.scene);
                    cyl.rotation.x = Math.PI / 2;
                    cyl.material = holeMat;
                    cyl.position = new BABYLON.Vector3(pt.x, pt.y, pt.z - hole.depth / 2);
                    cyl.parent = this.camRootNode;
                }

            } else if ('startPoint' in feature) {
                // Wpust
                const groove = feature as GrooveFeature;
                let s = { ...groove.startPoint };
                let e = { ...groove.endPoint };

                if (groove.reverseDirection) {
                    const temp = s;
                    s = e;
                    e = temp;
                }

                const dx = e.x - s.x;
                const dy = e.y - s.y;
                const dz = e.z - s.z;
                const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (len > 0) {
                    const nx = dx / len;
                    const ny = dy / len;
                    const nz = dz / len;

                    const leadIn = groove.leadIn || 0;
                    const leadOut = groove.leadOut || 0;

                    s.x -= nx * leadIn;
                    s.y -= ny * leadIn;
                    s.z -= nz * leadIn;

                    e.x += nx * leadOut;
                    e.y += ny * leadOut;
                    e.z += nz * leadOut;
                }

                const p1 = new BABYLON.Vector3(s.x, s.y, s.z);
                const p2 = new BABYLON.Vector3(e.x, e.y, e.z);
                const drawnLen = BABYLON.Vector3.Distance(p1, p2);

                const box = BABYLON.MeshBuilder.CreateBox(`Groove_${groove.featureId}`, {
                    width: drawnLen || 10,
                    height: groove.width || 4,
                    depth: groove.depth || 8
                }, this.scene);
                box.material = grooveMat;
                
                const center = BABYLON.Vector3.Center(p1, p2);
                center.z += (groove.flipDepthDirection ? (groove.depth || 8) / 2 : -(groove.depth || 8) / 2);
                box.position = center;
                
                const dir = p2.subtract(p1);
                box.rotation.z = Math.atan2(dir.y, dir.x);
                box.parent = this.camRootNode;
            } else if ('points' in feature && Array.isArray((feature as any).points) && (feature as any).points.length > 0) {
                // Stała ścieżka profilu na formatce z uwzględnieniem Wejścia (Lead-In), Wyjścia (Lead-Out) oraz Kompensacji
                const contour = feature as ContourFeature;
                // Wartość Z jest dokładnie tą wyliczoną lub podaną przez użytkownika w oknie (np. 0 dla wierzchu, -18 dla spodu)
                const targetZ = typeof contour.depth === 'number' ? contour.depth : (contour.points[0]?.z || 0);
                const pointsWithZ = contour.points.map((p: any) => ({
                    ...p,
                    z: targetZ
                }));

                const toolRadius = 0;
                const effectivePts = generateEffectiveContourPath(
                    pointsWithZ,
                    contour.leadIn || 0,
                    contour.leadOut || 0,
                    contour.compensation || 'Center',
                    toolRadius,
                    contour.reverseDirection || false
                );

                const pts = effectivePts.map((p: any) => new BABYLON.Vector3(p.x, p.y, p.z));
                if (pts.length >= 2) {
                    const tube = BABYLON.MeshBuilder.CreateTube(`Profile_${(feature as any).featureId || Math.random()}`, {
                        path: pts,
                        radius: 1.2,
                        tessellation: 8,
                        cap: BABYLON.Mesh.CAP_ALL
                    }, this.scene);
                    tube.material = profileMat;
                    tube.parent = this.camRootNode; // Punkty są w przestrzeni lokalnej zera WCS
                    if (!this.worldMeshes) this.worldMeshes = [];
                    this.worldMeshes.push(tube);

                    // Mała jaskrawozielona sfera w punkcie startowym wejścia narzędzia (Start / Lead-In)
                    const startSphere = BABYLON.MeshBuilder.CreateSphere(`ProfileStart_${(feature as any).featureId || Math.random()}`, {
                        diameter: 5.0,
                        segments: 16
                    }, this.scene);
                    const startMat = new BABYLON.StandardMaterial("ProfileStart_Mat", this.scene);
                    startMat.diffuseColor = new BABYLON.Color3(0.1, 1.0, 0.4); // Jaskrawy zielony
                    startMat.emissiveColor = new BABYLON.Color3(0.0, 0.8, 0.3);
                    startSphere.material = startMat;
                    startSphere.position = pts[0];
                    startSphere.parent = this.camRootNode;
                    this.worldMeshes.push(startSphere);
                }
            }
        }
    }

    /**
     * Tymczasowa funkcja rysująca fioletowe kule we WSZYSTKICH piwotach formatek na scenie.
     * Pomaga zwizualizować, gdzie technicznie znajduje się punkt (0,0,0) każdej płyty.
     */
    public renderAllPivots(panelViews: Map<any, any>): void {
        if (!this.scene) return;
        
        // Czystka poprzednich
        if ((this as any).allPivotsRoot) {
            (this as any).allPivotsRoot.dispose(false, true);
        }
        
        const root = new BABYLON.TransformNode("All_Pivots_Root", this.scene);
        (this as any).allPivotsRoot = root;
        
        const mat = new BABYLON.StandardMaterial("All_Pivots_Mat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0, 1); // Fuksja / Magenta
        mat.emissiveColor = new BABYLON.Color3(1, 0.2, 1);
        mat.alpha = 0.8;
        
        panelViews.forEach((view, panelObj) => {
            if (view && view.root) {
                // Generujemy kulę dokładnie w lokalnym punkcie (0,0,0) korzenia widoku formatki
                const sphere = BABYLON.MeshBuilder.CreateSphere("pivot_" + panelObj.name, { diameter: 20 }, this.scene);
                sphere.material = mat;
                sphere.parent = view.root;
                sphere.position = new BABYLON.Vector3(0, 0, 0); 
            }
        });
    }

    private highlightRootNode: any = null;

    /**
     * Podświetla wybraną ścieżkę / operację obróbczą w 3D neonowym światłem po najechaniu na nazwę w interfejsie.
     */
    public highlightFeature(feature: any, parentNode: any = null): void {
        if (!this.scene || !feature) return;
        this.clearHighlight();

        this.highlightRootNode = new BABYLON.TransformNode("CAM_Feature_Highlight_Root", this.scene);
        // Uwaga: Jeśli ścieżka ma punkty w przestrzeni świata (World 3D), nie parentujemy węzła, aby uniknąć podwójnej transformacji!
        const isWorldPath = Boolean(feature.points && Array.isArray(feature.points) && feature.points.length > 0);
        if (parentNode && !isWorldPath) {
            this.highlightRootNode.parent = parentNode;
        }

        const mat = new BABYLON.StandardMaterial("CAM_Highlight_Mat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.0, 1.0, 0.9); // Jaskrawy Neon Cyjan / Turkus
        mat.emissiveColor = new BABYLON.Color3(0.0, 1.0, 0.9); // MOCNE ŚWIATŁO EMISYJNE W 3D
        mat.specularColor = new BABYLON.Color3(1, 1, 1);
        mat.backFaceCulling = false;

        if (feature.points && Array.isArray(feature.points) && feature.points.length > 0) {
            // Profil krawędzi / contour path (elegancka linia podświetlenia 1.8mm)
            const pathPoints = feature.points.map((p: any) => new BABYLON.Vector3(p.x, p.y, p.z));
            
            let highlightMesh: any;
            if (pathPoints.length === 1) {
                // Pojedynczy punkt krawędzi -> Rysujemy świecącą rurkę-kulę wokół krawędzi
                highlightMesh = BABYLON.MeshBuilder.CreateSphere("Highlight_Point", { diameter: 10 }, this.scene);
                highlightMesh.position = pathPoints[0];
            } else {
                highlightMesh = BABYLON.MeshBuilder.CreateTube("Highlight_Path", {
                    path: pathPoints,
                    radius: 1.8,
                    tessellation: 12,
                    cap: BABYLON.Mesh.CAP_ALL
                }, this.scene);
            }
            highlightMesh.material = mat;
            highlightMesh.parent = this.highlightRootNode;
        } else if ('position' in feature || feature.type === 'hole') {
            // Otwór / Grupa otworów -> Świecący pierścień / walec dla każdego punktu
            const diam = feature.diameter || feature.params?.diameter || 5;
            const depth = feature.depth || feature.params?.depth || 12;
            const positions = (feature.positions && feature.positions.length > 0)
                ? feature.positions
                : [feature.position || { x: feature.params?.u || 0, y: feature.params?.v || 0, z: 0 }];

            for (let idx = 0; idx < positions.length; idx++) {
                const pos = positions[idx];
                const cyl = BABYLON.MeshBuilder.CreateCylinder(`Highlight_Hole_${idx}`, {
                    diameter: diam + 3,
                    height: depth + 3,
                    tessellation: 24
                }, this.scene);
                cyl.rotation.x = Math.PI / 2;
                cyl.material = mat;
                cyl.position = new BABYLON.Vector3(pos.x, pos.y, pos.z - depth / 2);
                cyl.parent = this.highlightRootNode;
            }
        } else if ('startPoint' in feature || feature.type === 'groove') {
            // Wpust
            const p1 = feature.startPoint || { x: 0, y: 0, z: 0 };
            const p2 = feature.endPoint || { x: 100, y: 0, z: 0 };
            const line = BABYLON.MeshBuilder.CreateTube("Highlight_Groove", {
                path: [new BABYLON.Vector3(p1.x, p1.y, p1.z), new BABYLON.Vector3(p2.x, p2.y, p2.z)],
                radius: 4.0,
                tessellation: 12
            }, this.scene);
            line.material = mat;
            line.parent = this.highlightRootNode;
        }
    }

    private previewToolNode: any = null;

    /**
     * Wyświetla statyczny podgląd 3D wybranego narzędzia na scenie.
     */
    public showToolPreview(tool: Tool, position?: Vector3D, parentNode?: any): void {
        if (!this.scene || !tool) return;
        this.clearToolPreview();

        this.previewToolNode = CNCToolMeshFactory.createToolMesh(tool, this.scene);
        if (this.previewToolNode) {
            if (parentNode) {
                this.previewToolNode.parent = parentNode;
            }
            this.previewToolNode.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
            
            if (position) {
                this.previewToolNode.position = new BABYLON.Vector3(position.x, position.y, position.z + 15);
            } else {
                this.previewToolNode.position = new BABYLON.Vector3(0, 0, 15);
            }
        }
    }

    public clearToolPreview(): void {
        if (this.previewToolNode) {
            this.previewToolNode.dispose(false, true);
            this.previewToolNode = null;
        }
    }

    public clearHighlight(): void {
        if (this.highlightRootNode) {
            this.highlightRootNode.dispose(false, true);
            this.highlightRootNode = null;
        }
    }
}
