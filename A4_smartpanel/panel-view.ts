/**
 * SmartPanel Web — Panel View
 * 
 * Tworzy wizualną reprezentację płyty jako 6 osobnych meshów (ścian).
 * Każdy mesh ma metadata.faceName do identyfikacji po raycast.
 */

const baseAlpineWhite = { r: 0.94, g: 0.94, b: 0.94 };

// Wszystkie ściany mają bazowy kolor Białego Alpejskiego (W1100 ST9)
const FACE_COLORS: Record<string, { r: number, g: number, b: number }> = {
    FACE_Z_PLUS:  baseAlpineWhite,
    FACE_Z_MINUS: baseAlpineWhite,
    FACE_X_PLUS:  baseAlpineWhite,
    FACE_X_MINUS: baseAlpineWhite,
    FACE_Y_PLUS:  baseAlpineWhite,
    FACE_Y_MINUS: baseAlpineWhite,
    // Legacy aliasy
    front:  baseAlpineWhite,
    back:   baseAlpineWhite,
    left:   baseAlpineWhite,
    right:  baseAlpineWhite,
    top:    baseAlpineWhite,
    bottom: baseAlpineWhite,
    feature: { r: 0.2, g: 0.2, b: 0.2 } // Czarny środek otworu
};

declare const BABYLON: any;

import { IDManager, EntityType } from '../A1_core/id-manager.js';
import { unit } from '../A1_core/unit-system.js';
import { SceneSyncAdapter } from '../A1_core/cad-node/scene-sync-adapter.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { materialDatabase } from '../A7_material/material-database.js';
import { NativePanelBuilder } from './native-panel-builder.js';
import { bindOperationEdge } from '../o1_operacji/operacje-apply.js';
import { dimHandleUv, dragHandleAlongAxis, magnetEdgeIfAtBound } from '../o1_operacji/operacje-placement.js';

export class PanelView {
    scene: any;
    model: any;
    root: any;
    faceMeshes: Record<string, any> = {};
    faceMaterials: Record<string, any> = {};
    _featureMarkers: any[] = [];
    _edgeLines: any[] = [];
    _edgeMeshes: any[] = [];
    _vertexSpheres: any[] = [];
    _lcsNode: any = null;
    _modelChangeHandler: any = null;
    _syncAdapter: SceneSyncAdapter;
    lastWidth: number = 0;
    lastHeight: number = 0;
    lastThickness: number = 0;
    _dimHandleDragging: boolean = false;

    constructor(scene: any, model: any) {
        this.scene = scene;
        this.model = model;

        this.faceMeshes = {};
        this.faceMaterials = {};
        this._syncAdapter = ContextManager.instance.sceneSyncAdapter;

        this.root = new BABYLON.TransformNode(model.name || 'Panel', scene);

        this._rebuildMeshes();
        this._buildLCSNode();

        // Podłącz adapter: CADNode ↔ root (pozycja/rotacja przez adapter, nie ręcznie)
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(this.model.id);
        if (cadNode) {
            this._syncAdapter.bind(cadNode, this.root);
        }

        this._modelChangeHandler = (type, data) => {
            if (type === 'dimensions') {
                this._rebuildMeshes();
                this._updateTransform();
                this._buildLCSNode();
            } else if (type === 'material' || type === 'edgeBanding') {
                this._updateMaterialAppearance();
            } else if (type === 'lcsVisibility') {
                this.setLcsVisible(data?.visible ?? true);
            } else if (type === 'features' || type === 'featureAdded' || type === 'featureRemoved' || type === 'loaded') {
                // Groove/hole zmieniają siatkę (dziura + krawędzie), nie tylko overlay.
                this._rebuildMeshes();
            } else {
                this._updateTransform();
                this.renderFeatures();
            }
        };
        if (typeof this.model?.onChange === 'function') {
            this.model.onChange(this._modelChangeHandler);
        }
    }

    dispose() {
        if (this.model && this._modelChangeHandler && typeof this.model.offChange === 'function') {
            this.model.offChange(this._modelChangeHandler);
        }
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(this.model.id);
        if (cadNode) {
            this._syncAdapter.unbind(cadNode);
        }
        if (this._lcsNode) {
            this._lcsNode.dispose(false, true);
            this._lcsNode = null;
        }
        this._disposeFeatureMarkers();
        this._disposeCurrentMeshes();
        if (this.root) {
            this.root.dispose();
            this.root = null;
        }
    }

    _updateTransform() {
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(this.model.id);
        if (!this.root || !cadNode) return;
        // Adapter synchronizuje localMatrix CADNode → mesh.
        // Wywołanie getWorldMatrix() wymusza propagację dirty-flag kaskadowo.
        cadNode.getWorldMatrix();
        // Adapter subskrybował onWorldMatrixChanged i sam zaktualizuje mesh.
        // Wywołujemy syncLocalToMesh bezpośrednio dla natychmiastowego efektu.
        this._syncAdapter.bind(cadNode, this.root);
    }

    /** Przebudowuje geometrię meshy i renderuje opisy cech po zmianie wymiarów/rowków. */
    rebuildGeometry() {
        this._rebuildMeshes();
        this._updateTransform();
        this.renderFeatures();
        this._buildLCSNode();
    }

    /**
     * Aktualizuje geometrię na podstawie danych z OCCT.
     * @param {Object} meshData Słownik {faceName: {positions, indices, normals}}
     */
    updateMesh(meshData) {
        this._disposeCurrentMeshes();

        for (const [faceName, dataRaw] of Object.entries(meshData)) {
            const data = dataRaw as any;
            if (faceName === 'edges' || faceName === 'vertices') continue;
            if (!data || !data.positions || data.positions.length === 0) continue; // Pomiń puste

            const isFeature = faceName.startsWith('feature_');
            const mesh = new BABYLON.Mesh(`face_${faceName}`, this.scene);
            const vertexData = new BABYLON.VertexData();

            const idMgr = IDManager.getInstance();
            let smartId;
            let metaType = null;
            let fId = null;

            if (isFeature) {
                // faceName np. 'feature_12345_wall' lub 'feature_12345_bottom'
                const rawName = faceName.substring(8); // '12345_wall'
                const lastUnderscore = rawName.lastIndexOf('_');
                let subType = '';
                
                if (lastUnderscore > 0) {
                    fId = rawName.substring(0, lastUnderscore);
                    subType = rawName.substring(lastUnderscore + 1);
                } else {
                    fId = rawName;
                }

                smartId = idMgr.register(EntityType.FEATURE, this.model.smartId.fullPath, fId);
                metaType = 'feature';
            } else {
                smartId = idMgr.register(EntityType.FACE, this.model.smartId.fullPath, faceName, { face: faceName });
                metaType = 'face';
            }

            vertexData.positions = data.positions;
            vertexData.indices = data.indices;

            const normals: number[] = [];
            BABYLON.VertexData.ComputeNormals(data.positions, data.indices, normals);
            vertexData.normals = normals;

            vertexData.applyToMesh(mesh);
            mesh.parent = this.root;
            if (typeof mesh.enableEdgesRendering === 'function') {
                mesh.enableEdgesRendering();
                mesh.edgesWidth = 2.0;
                mesh.edgesColor = new BABYLON.Color4(0.35, 0.30, 0.25, 0.6);
            }

            // Zapewniamy działanie hover'a
            if (isFeature) {
                const subType = faceName.substring(faceName.lastIndexOf('_') + 1);
                mesh.metadata = { type: 'feature', featureId: fId, subType: subType, smartId: smartId, panelModel: this.model };
            } else {
                mesh.metadata = { faceName: faceName, smartId: smartId, panelModel: this.model }; // faceName dla wstecznej kompatybilności w pickerze
            }
            mesh.isPickable = true;

            // Tworzymy lub używamy istniejącego materiału
            let mat = this.faceMaterials[faceName];
            if (!mat) {
                mat = new BABYLON.StandardMaterial(`mat_${faceName}`, this.scene);
                mat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
                mat.specularPower = 64;
                mat.backFaceCulling = false;
                mat.twoSidedLighting = true;
                mat.zOffset = 1.0;
                this.faceMaterials[faceName] = mat;
            }
            
            // ZAWSZE resetujemy kolor bazowy do czystego stanu (zapobiega utrwaleniu koloru zaznaczenia/hovera po rebuildzie)
            if (isFeature) {
                mat.diffuseColor = new BABYLON.Color3(0.20, 0.16, 0.12);
            } else {
                const col = FACE_COLORS[faceName] || baseAlpineWhite;
                mat.diffuseColor = new BABYLON.Color3(col.r, col.g, col.b);
            }
            mat.emissiveColor = BABYLON.Color3.Black();
            mesh.material = mat;
            
            // Zachowujemy oryginalny kolor do resetu po hoverze
            mesh.metadata.baseColor = BABYLON.Color3.Black();
            mesh.metadata.baseDiffuse = mat.diffuseColor.clone();
            
            this.faceMeshes[faceName] = mesh;
        }

        // Przy OCCT usuwamy stare krawędzie
        if (this._edgeLines && Array.isArray(this._edgeLines)) {
            this._edgeLines.forEach(l => l.dispose());
            this._edgeLines = [];
        }
        if (this._edgeMeshes && this._edgeMeshes.length > 0) {
            this._edgeMeshes.forEach(m => m.dispose());
            this._edgeMeshes = [];
        }
        if (this._vertexSpheres && this._vertexSpheres.length > 0) {
            this._vertexSpheres.forEach(s => s.dispose());
            this._vertexSpheres = [];
        }

        // Renderowanie Krawędzi z OCCT
        if (meshData.edges && meshData.edges.length > 0) {
            this._edgeMeshes = [];
            
            for (let i = 0; i < meshData.edges.length; i++) {
                const edgeData = meshData.edges[i];
                // Pętla pobiera punkt i klucz (dla wstecznej kompatybilności starej tablicy fallback na pts)
                const pts = edgeData.points || edgeData;
                const edgeKey = edgeData.key || i.toString();

                const points = pts.map(p => new BABYLON.Vector3(p[0], p[1], p[2]));
                
                // Używamy "Lines" (cienkich linii 1px jak w profesjonalnym CAD) zamiast grubych rurek, 
                // i zwiększamy tolerancję klikania (intersectionThreshold) aby łatwo było w nie trafić
                const edgeMesh = BABYLON.MeshBuilder.CreateLines(`edge_${i}`, { 
                    points: points
                }, this.scene);
                edgeMesh.color = new BABYLON.Color3(0.1, 0.1, 0.1); // Ciemny, elegancki kolor linii CAD
                edgeMesh.intersectionThreshold = 1.5; // Fizyczny margines 1.5mm (zostawia 15mm luzu na formatce 18mm)

                
                edgeMesh.parent = this.root;
                
                const idMgr = IDManager.getInstance();
                const smartId = idMgr.register(EntityType.EDGE, this.model.smartId.fullPath, edgeKey);
                
                edgeMesh.isPickable = true;
                edgeMesh.metadata = { 
                    type: 'edge', 
                    smartId: smartId, 
                    panelModel: this.model,
                    edgeKey: edgeKey,
                    brepPoints: pts, // Dokładne matematyczne punkty B-rep z modelu CAD
                    baseColor: new BABYLON.Color3(0.1, 0.1, 0.1),
                    baseDiffuse: new BABYLON.Color3(0.15, 0.1, 0.05)
                };
                
                this._edgeMeshes.push(edgeMesh);
            }
        }

        // Renderowanie Narożników z OCCT
        if (meshData.vertices && meshData.vertices.length > 0) {
            this._vertexSpheres = [];
            
            for (let i = 0; i < meshData.vertices.length; i++) {
                const p = meshData.vertices[i];
                const sphere = BABYLON.MeshBuilder.CreateSphere(`vertex_${i}`, { diameter: 10 }, this.scene);
                
                const vertMat = new BABYLON.StandardMaterial(`vertexMat_${i}`, this.scene);
                vertMat.diffuseColor = new BABYLON.Color3(1, 0.2, 0.2);
                vertMat.emissiveColor = new BABYLON.Color3(0.5, 0.1, 0.1);
                vertMat.alpha = 0.0; // Półprzezroczysty na hover
                
                const idMgr = IDManager.getInstance();
                const smartId = idMgr.register(EntityType.VERTEX, this.model.smartId.fullPath, i.toString());

                sphere.position = new BABYLON.Vector3(p[0], p[1], p[2]);
                sphere.parent = this.root;
                sphere.material = vertMat;
                sphere.renderingGroupId = 1;
                
                sphere.isPickable = true;
                sphere.metadata = { 
                    type: 'vertex', 
                    smartId: smartId, 
                    panelModel: this.model, 
                    cornerIndex: i,
                    baseColor: new BABYLON.Color3(0.5, 0.1, 0.1),
                    baseDiffuse: new BABYLON.Color3(1, 0.2, 0.2)
                };
                this._vertexSpheres.push(sphere);
            }
        }

        // Odświeżamy markery feature'ów (walce 3D) dla nowej geometrii
        this.renderFeatures();

        // Automatyczne odświeżenie materiałów, dekoru i obrzeży krawędzi
        this._updateMaterialAppearance();

        const vp = ContextManager.instance.viewport;
        if (vp && typeof vp.applyRenderModeToMeshes === 'function') {
            vp.applyRenderModeToMeshes();
        }
    }

    _disposeCurrentMeshes() {
        for (const mesh of Object.values(this.faceMeshes)) {
            mesh.dispose();
        }
        this.faceMeshes = {};
        if (this._edgeMeshes && this._edgeMeshes.length > 0) {
            this._edgeMeshes.forEach((m) => m.dispose());
            this._edgeMeshes = [];
        }
        if (this._edgeLines && Array.isArray(this._edgeLines)) {
            this._edgeLines.forEach((l) => l.dispose());
            this._edgeLines = [];
        }
        if (this._vertexSpheres && this._vertexSpheres.length > 0) {
            this._vertexSpheres.forEach((s) => s.dispose());
            this._vertexSpheres = [];
        }
        // Nie niszczymy materiałów, użyjemy ich ponownie
    }

    _buildMeshes() {
        const w = unit.toBabylon(this.model.width);
        const h = unit.toBabylon(this.model.height);
        const t = unit.toBabylon(this.model.thickness);

        const faceDefs = {
            front: {
                width: w, height: h,
                position: [0, 0, t / 2],
                rotation: [0, Math.PI, 0]
            },
            back: {
                width: w, height: h,
                position: [0, 0, -t / 2],
                rotation: [0, 0, 0]
            },
            left: {
                width: t, height: h,
                position: [-w / 2, 0, 0],
                rotation: [0, -Math.PI / 2, 0]
            },
            right: {
                width: t, height: h,
                position: [w / 2, 0, 0],
                rotation: [0, Math.PI / 2, 0]
            },
            top: {
                width: w, height: t,
                position: [0, h / 2, 0],
                rotation: [-Math.PI / 2, 0, 0]
            },
            bottom: {
                width: w, height: t,
                position: [0, -h / 2, 0],
                rotation: [Math.PI / 2, 0, 0]
            }
        };

        for (const [name, def] of Object.entries(faceDefs)) {
            // Mesh — płaska płaszczyzna (Plane)
            const mesh = BABYLON.MeshBuilder.CreatePlane(`face_${name}`, {
                width: def.width,
                height: def.height,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE
            }, this.scene);

            mesh.position = new BABYLON.Vector3(...def.position);
            mesh.rotation = new BABYLON.Vector3(...def.rotation);
            mesh.parent = this.root;

            // Register SmartID
            const idMgr = IDManager.getInstance();
            const smartId = idMgr.register(EntityType.FACE, this.model.smartId?.fullPath || this.model.id, name);

            // Materiał
            const mat = new BABYLON.StandardMaterial(`mat_${name}`, this.scene);
            const col = FACE_COLORS[name];
            mat.diffuseColor = new BABYLON.Color3(col.r, col.g, col.b);
            mat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
            mat.specularPower = 64;
            mat.backFaceCulling = false;
            mat.twoSidedLighting = true;
            
            // MAGICZNY TRIK CAD: Z-Offset wypycha ścianę lekko do tyłu w głębi (depth buffer),
            // dzięki czemu krawędzie (linie) na niej leżące zawsze rysują się bez zakrywania i migotania!
            mat.zOffset = 1.0; 

            // Emissive startuje na zero — face-picker będzie to zmieniać
            mesh.actionManager = new BABYLON.ActionManager(this.scene);
            mesh.metadata = { 
                faceName: name,
                smartId: smartId,
                panelModel: this.model
            };
            mesh.isPickable = true;

            mesh.material = mat;

            this.faceMeshes[name] = mesh;
            this.faceMaterials[name] = mat;

            // Krawędzie natywne — BabylonJS EdgesRenderer wykrywa je z geometrii meshy.
            // Zero dodatkowych obliczeń, zero duplikacji współrzędnych.
            mesh.enableEdgesRendering();
            mesh.edgesWidth = 2.0;
            mesh.edgesColor = new BABYLON.Color4(0.35, 0.30, 0.25, 0.6);
        }

        this._updateMaterialAppearance();

        const vp = ContextManager.instance.viewport;
        if (vp && typeof vp.applyRenderModeToMeshes === 'function') {
            vp.applyRenderModeToMeshes();
        }
    }

    _updateMaterialAppearance() {
        const matId = this.model.materialId || this.model.material || this.model.custom_properties?.material;
        const matData = matId ? materialDatabase.getMaterialById(matId) : null;
        
        const baseColor = this.model.color || (matData ? matData.color : baseAlpineWhite);
        const alpha = matData?.isTransparent ? (matData.opacity || 0.45) : 1.0;
        const specularPower = matData?.roughness ? Math.round((1.0 - matData.roughness) * 64) : 48;
        
        const edgeKeyMap: Record<string, string> = {
            'left': '-X',
            'FACE_X_MINUS': '-X',
            'right': '+X',
            'FACE_X_PLUS': '+X',
            'top': '+Y',
            'FACE_Y_PLUS': '+Y',
            'bottom': '-Y',
            'FACE_Y_MINUS': '-Y'
        };

        const eb = this.model.edgeBanding || this.model.custom_properties?.edge_banding || {};

        for (const [faceName, mesh] of Object.entries<any>(this.faceMeshes)) {
            if (!mesh) continue;
            const mat = this.faceMaterials[faceName];
            if (!mat) continue;
            
            const isFeature = faceName.startsWith('feature_') || mesh.metadata?.type === 'feature';
            const edgeKey = edgeKeyMap[faceName];
            const isEdgeFace = !!edgeKey;

            if (isFeature) {
                mat.diffuseColor = new BABYLON.Color3(0.20, 0.16, 0.12);
                mat.alpha = 1.0;
            } else if (isEdgeFace) {
                const edgeSlot = eb[edgeKey];
                const isEdgeBanded = edgeSlot?.active === true || (edgeSlot?.active !== false && edgeSlot?.type_id && edgeSlot.type_id !== 'none');
                
                if (isEdgeBanded) {
                    // Krawędź oklejona (PVC/ABS) — kolor dekoru płyty / obrzeża
                    const edgeColor = edgeSlot.color || baseColor;
                    mat.diffuseColor = new BABYLON.Color3(edgeColor.r, edgeColor.g, edgeColor.b);
                    mat.alpha = alpha;
                    mat.specularPower = 56;
                    mesh.edgesColor = new BABYLON.Color4(0.2, 0.2, 0.2, 0.8);
                } else {
                    // Krawędź nieoklejona (brak obrzeża) — ciemny brązowy surowy rdzeń płyty wiórowej
                    mat.diffuseColor = new BABYLON.Color3(0.32, 0.20, 0.12);
                    mat.alpha = 1.0;
                    mat.specularPower = 4;
                    mesh.edgesColor = new BABYLON.Color4(0.22, 0.14, 0.08, 0.85);
                }
            } else {
                // Płaszczyzny główne płyty (front/back) — Biały Alpejski lub wybrany dekor
                mat.diffuseColor = new BABYLON.Color3(baseColor.r, baseColor.g, baseColor.b);
                mat.alpha = alpha;
                mat.specularPower = specularPower;
                if (matData?.isTransparent) {
                    mat.backFaceCulling = false;
                }
            }
            
            if (mesh.metadata) {
                mesh.metadata.baseDiffuse = mat.diffuseColor.clone();
            }
        }
    }

    _rebuildMeshes() {
        const isCylinder = this.model?.role === 'TUBE_ROD' || 
                           this.model?.role === 'HOLDER' || 
                           this.model?.custom_properties?.shape === 'CYLINDER' || 
                           String(this.model?.name || '').toLowerCase().includes('drazek') || 
                           String(this.model?.name || '').toLowerCase().includes('uchwyt') || 
                           String(this.model?.name || '').toLowerCase().includes('rozeta');

        if (isCylinder) {
            this._disposeCurrentMeshes();
            this._disposeFeatureMarkers();
            
            const isRod = this.model.role === 'TUBE_ROD' || String(this.model.name || '').toLowerCase().includes('drazek');
            const wMm = unit.toBabylon(this.model.width);
            const hMm = unit.toBabylon(this.model.height);
            
            const len = wMm > 0 ? wMm : 600;
            const dia = hMm > 0 ? hMm : (isRod ? 25 : 42);
            
            const cylinderMesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder_${this.model.id}`, {
                height: len,
                diameter: dia,
                tessellation: 32
            }, this.scene);
            
            cylinderMesh.rotation.z = Math.PI / 2;
            cylinderMesh.parent = this.root;
            
            if (typeof cylinderMesh.enableEdgesRendering === 'function') {
                cylinderMesh.enableEdgesRendering();
                cylinderMesh.edgesWidth = 1.5;
                cylinderMesh.edgesColor = new BABYLON.Color4(0.2, 0.2, 0.2, 0.8);
            }
            
            const mat = new BABYLON.StandardMaterial(`mat_cyl_${this.model.id}`, this.scene);
            mat.diffuseColor = new BABYLON.Color3(0.85, 0.85, 0.88);
            mat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
            cylinderMesh.material = mat;
            
            const idMgr = IDManager.getInstance();
            const smartId = idMgr.register(EntityType.FACE, this.model.smartId?.fullPath || this.model.id, 'cylinder_body');
            cylinderMesh.metadata = { type: 'face', smartId, panelModel: this.model };
            
            this.faceMeshes['cylinder_body'] = cylinderMesh;
            this.faceMaterials['cylinder_body'] = mat;
            return;
        }

        try {
            const ctxBuilder = (ContextManager.instance as any)?.panelBuilder;
            const builder = (ctxBuilder && typeof ctxBuilder.build === 'function')
                ? ctxBuilder
                : new NativePanelBuilder();
            const meshData = builder.build(this.model);
            if (meshData) {
                this.updateMesh(meshData);
                return;
            }
        } catch (err) {
            console.warn('PanelView: native remesh failed, fallback planes', err);
        }
        this._disposeCurrentMeshes();
        this._disposeFeatureMarkers();
        this._buildMeshes();
        this.renderFeatures();
    }

    /**
     * Zwraca listę meshów ścian (do ray castingu).
     */
    getPickableMeshes() {
        return Object.values(this.faceMeshes);
    }

    /**
     * Zwraca materiał ściany.
     */
    getMaterial(faceName) {
        return this.faceMaterials[faceName] || null;
    }

    /**
     * Zwraca oryginalny kolor ściany.
     */
    getBaseColor(faceName) {
        const c = FACE_COLORS[faceName];
        return c ? new BABYLON.Color3(c.r, c.g, c.b) : null;
    }

    /**
     * Podświetla lub wygasza wybraną krawędź formatki w 3D (używane m.in. przez drzewo obiektów na hover).
     */
    highlightEdgeFace(edgeKey: string, highlight: boolean) {
        const edgeFaceMap: Record<string, string[]> = {
            '+X': ['right', 'FACE_X_PLUS'],
            '-X': ['left', 'FACE_X_MINUS'],
            '+Y': ['top', 'FACE_Y_PLUS'],
            '-Y': ['bottom', 'FACE_Y_MINUS']
        };
        const targets = edgeFaceMap[edgeKey] || [];
        for (const face of targets) {
            const mesh = this.faceMeshes[face];
            const mat = this.faceMaterials[face];
            if (!mesh || !mat) continue;
            if (highlight) {
                mat.emissiveColor = new BABYLON.Color3(0.2, 0.4, 0.9);
                mesh.edgesColor = new BABYLON.Color4(0.3, 0.7, 1.0, 1.0);
                mesh.edgesWidth = 4.0;
            } else {
                mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
                mesh.edgesWidth = 2.0;
                this._updateMaterialAppearance();
            }
        }
    }

    // ─── Feature visualization ───────────────────────

    /**
     * Renderuje wszystkie features z modelu na powierzchni płyty.
     */
    renderFeatures() {
        if (this._dimHandleDragging) return;
        // Dispose old feature markers
        this._disposeFeatureMarkers();

        if (!this._featureMarkers) {
            this._featureMarkers = [];
        }

        for (const feature of (this.model.features || [])) {
            if (feature.visible === false || feature.frozen === true || feature.params?.frozen === true) continue;
            if (feature.is_assembly_drilling || feature.params?.is_assembly_drilling) continue;
            switch (feature.type) {
                case 'hole':
                    this._renderHole(feature);
                    break;
                case 'pocket':
                    this._renderPocket(feature);
                    break;
                case 'groove':
                    this._renderGroove(feature);
                    break;
                case 'point':
                    this._renderPoint(feature);
                    break;
            }
        }

        const vp = ContextManager.instance.viewport;
        if (vp && typeof vp.applyRenderModeToMeshes === 'function') {
            vp.applyRenderModeToMeshes();
        }
    }

    _renderHole(feature) {
        const faceName = feature.face || (feature.side ? feature.side : 'back');
        let faceData;
        try {
            faceData = this.model.getFace(faceName);
        } catch {
            faceData = this.model.getFace('back');
        }

        const params = feature.params || {};
        const u = params.u !== undefined ? params.u : (feature.loc?.x || 0);
        const v = params.v !== undefined ? params.v : (feature.loc?.y || 0);
        const holeDia = params.diameter || feature.dim?.x || 5;
        const holeDepth = params.depth || feature.dim?.z || 12;
        const radius = holeDia / 2;

        const clearance = params.clearance || 0;

        // Pozycja 3D na ścianie lub z położenia lokalnego
        let pos;
        if (feature.params && feature.params.u !== undefined) {
            pos = this._facePoint(faceData, u, v, 0.5 + clearance);
        } else if (feature.loc) {
            pos = new BABYLON.Vector3(feature.loc.x, feature.loc.y, feature.loc.z);
        } else {
            pos = this._facePoint(faceData, u, v, 0.5 + clearance);
        }


        // Okrąg — ring (torus o promieniu dopasowanym do średnicy otworu)
        const circle = BABYLON.MeshBuilder.CreateTorus(`hole_ring_${feature.id}`, {
            diameter: holeDia,
            thickness: Math.min(1.5, holeDia * 0.2),
            tessellation: 32
        }, this.scene);
        circle.position = pos;
        this._orientToFace(circle, faceData);

        const mat = new BABYLON.StandardMaterial(`hole_mat_${feature.id}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.95, 0.3, 0.1);
        mat.emissiveColor = new BABYLON.Color3(0.6, 0.15, 0.05);
        mat.backFaceCulling = false;
        circle.material = mat;
        circle.isPickable = true;
        circle.parent = this.root;
        this._featureMarkers.push(circle);

        // Cylinder reprezentujący czarny walec otworu (symbole walce CAD)
        const cyl = BABYLON.MeshBuilder.CreateCylinder(`hole_cyl_${feature.id}`, {
            diameter: holeDia,
            height: holeDepth,
            tessellation: 32
        }, this.scene);
        
        if (feature.params && feature.params.u !== undefined) {
            // W głąb płyty (−normal), jak mesh_builder.localTo3D. +normal wystawiał walec
            // na zewnątrz (np. z boczka w stronę wieńca).
            cyl.position = this._facePoint(faceData, u, v, -(holeDepth / 2) + clearance);
            this._orientToFace(cyl, faceData);
        } else {
            cyl.position = pos;
        }

        const cylMat = new BABYLON.StandardMaterial(`hole_cyl_mat_${feature.id}`, this.scene);
        cylMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);
        cylMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.15);
        cylMat.alpha = 0.9;
        cylMat.backFaceCulling = false;
        cyl.material = cylMat;
        cyl.isPickable = true;
        cyl.parent = this.root;
        this._featureMarkers.push(cyl);

        // Krzyżyk w środku otworu
        const crossSize = Math.max(1, radius * 0.7);
        const crossLines = [
            [
                this._facePoint(faceData, u - crossSize, v, 0.6 + clearance),
                this._facePoint(faceData, u + crossSize, v, 0.6 + clearance)
            ],
            [
                this._facePoint(faceData, u, v - crossSize, 0.6 + clearance),
                this._facePoint(faceData, u, v + crossSize, 0.6 + clearance)
            ]
        ];
        const cross = BABYLON.MeshBuilder.CreateLineSystem(`hole_cross_${feature.id}`, { lines: crossLines }, this.scene);
        cross.color = new BABYLON.Color3(1, 0.5, 0.1);
        cross.isPickable = false;
        cross.parent = this.root;
        this._featureMarkers.push(cross);
    }

    _renderPocket(feature) {
        const faceData = this.model.getFace(feature.face);
        const { u, v, width, height } = feature.params;
        const w = width || 100;
        const h = height || 100;

        // Prostokątny obrys kieszeni
        const halfW = w / 2;
        const halfH = h / 2;
        const lines = [[
            this._facePoint(faceData, u - halfW, v - halfH, 0.5),
            this._facePoint(faceData, u + halfW, v - halfH, 0.5),
            this._facePoint(faceData, u + halfW, v + halfH, 0.5),
            this._facePoint(faceData, u - halfW, v + halfH, 0.5),
            this._facePoint(faceData, u - halfW, v - halfH, 0.5)
        ]];
        const rect = BABYLON.MeshBuilder.CreateLineSystem(`pocket_${feature.id}`, {
            lines
        }, this.scene);
        rect.color = new BABYLON.Color3(0.2, 0.6, 1);
        rect.isPickable = false;
        rect.parent = this.root;
        this._featureMarkers.push(rect);
    }

    _renderEdgeDimLines(feature, faceData, u, v, w, len, grooveMesh) {
        const params = feature.params || {};
        const faceW = faceData.width;
        const faceH = faceData.height;
        const rect = { u, v, width: w, length: len };
        const uEdge = params.u_edge || 'FACE_X_MINUS';
        const vEdge = params.v_edge || 'FACE_Y_MINUS';
        const midU = u + w / 2;
        const midV = v + len / 2;
        const uEnd = dimHandleUv(feature.face, 'u', rect, uEdge, vEdge, faceW, faceH);
        const vEnd = dimHandleUv(feature.face, 'v', rect, uEdge, vEdge, faceW, faceH);
        const offset = 0.6;
        const centerPos = this._facePoint(faceData, midU, midV, offset);
        const uEndPos = this._facePoint(faceData, uEnd.u, uEnd.v, offset);
        const vEndPos = this._facePoint(faceData, vEnd.u, vEnd.v, offset);

        const lineU = this._createDimLine(`op_dim_u_${feature.id}`, centerPos, uEndPos);
        const lineV = this._createDimLine(`op_dim_v_${feature.id}`, centerPos, vEndPos);
        const lines = { u: lineU, v: lineV };

        const live = { u: { ...uEnd }, v: { ...vEnd } };
        const handleU = this._createDimSnapHandle(feature, faceData, 'u', uEndPos);
        const handleV = this._createDimSnapHandle(feature, faceData, 'v', vEndPos);
        this._wireDimSnapHandle(handleU, feature, faceData, 'u', rect, lines, live, offset, grooveMesh);
        this._wireDimSnapHandle(handleV, feature, faceData, 'v', rect, lines, live, offset, grooveMesh);
    }

    _createDimLine(name, p0, p1) {
        const len = BABYLON.Vector3.Distance(p0, p1);
        const dashSize = Math.max(6, Math.min(12, len / 12));
        const gapSize = dashSize * 0.7;
        const line = BABYLON.MeshBuilder.CreateDashedLines(name, {
            points: [p0, p1],
            dashSize,
            gapSize,
            updatable: true,
        }, this.scene);
        line.color = new BABYLON.Color3(0.25, 0.78, 0.92);
        line.isPickable = false;
        line.parent = this.root;
        line.metadata = { dashSize, gapSize };
        this._featureMarkers.push(line);
        return line;
    }

    _createDimSnapHandle(feature, faceData, slot, endPos) {
        const handle = BABYLON.MeshBuilder.CreateSphere(`groove_dim_handle_${feature.id}_${slot}`, {
            diameter: 10,
        }, this.scene);
        handle.parent = this.root;
        handle.position.copyFrom(endPos);
        handle.renderingGroupId = 1;
        const mat = new BABYLON.StandardMaterial(`groove_dim_handle_mat_${feature.id}_${slot}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.2, 0.85, 1);
        mat.emissiveColor = new BABYLON.Color3(0.12, 0.55, 0.75);
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        mat.disableDepthWrite = true;
        handle.material = mat;
        handle.isPickable = true;
        handle.metadata = {
            type: 'edge-dim-handle',
            slot,
            library_id: feature.params?.library_id,
            featureId: feature.id,
            face: feature.face,
            panelModel: this.model,
        };
        handle.actionManager = new BABYLON.ActionManager(this.scene);
        handle.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPointerOverTrigger,
            () => {
                handle.scaling.setAll(1.28);
                if (this.scene.getEngine()?.getRenderingCanvas()) {
                    this.scene.getEngine().getRenderingCanvas().style.cursor = 'grab';
                }
            },
        ));
        handle.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
            BABYLON.ActionManager.OnPointerOutTrigger,
            () => {
                if (!this._dimHandleDragging) handle.scaling.setAll(1);
                if (this.scene.getEngine()?.getRenderingCanvas() && !this._dimHandleDragging) {
                    this.scene.getEngine().getRenderingCanvas().style.cursor = '';
                }
            },
        ));
        this._featureMarkers.push(handle);
        return handle;
    }

    _worldToFaceUv(faceData, worldPos) {
        this.root.computeWorldMatrix(true);
        const inv = this.root.getWorldMatrix().clone().invert();
        const local = BABYLON.Vector3.TransformCoordinates(worldPos, inv);
        const [ox, oy, oz] = faceData.origin;
        const dx = local.x - ox;
        const dy = local.y - oy;
        const dz = local.z - oz;
        const [ux, uy, uz] = faceData.uAxis;
        const [vx, vy, vz] = faceData.vAxis;
        return {
            u: dx * ux + dy * uy + dz * uz,
            v: dx * vx + dy * vy + dz * vz,
        };
    }

    _updateDimLine(lineMesh, p0, p1) {
        const dashSize = lineMesh.metadata?.dashSize || 8;
        const gapSize = lineMesh.metadata?.gapSize || 6;
        BABYLON.MeshBuilder.CreateDashedLines(null, {
            points: [p0, p1],
            dashSize,
            gapSize,
            instance: lineMesh,
        });
    }

    _wireDimSnapHandle(handle, feature, faceData, slot, rect, lines, live, offset, grooveMesh) {
        void lines;
        void grooveMesh;
        void live;
        this.root.computeWorldMatrix(true);
        const startNormal = BABYLON.Vector3.TransformNormal(
            new BABYLON.Vector3(...faceData.normal),
            this.root.getWorldMatrix(),
        ).normalize();
        const drag = new BABYLON.PointerDragBehavior({ dragPlaneNormal: startNormal });
        drag.useObjectOrientationForDragging = false;
        drag.moveAttached = false;
        drag.updateDragPlane = false;

        const originalEdge = slot === 'u'
            ? (feature.params.u_edge || 'FACE_X_MINUS')
            : (feature.params.v_edge || 'FACE_Y_MINUS');
        let pendingEdge = originalEdge;
        const idleColor = new BABYLON.Color3(0.12, 0.55, 0.75);
        const hotColor = new BABYLON.Color3(1, 0.92, 0.35);
        const origin = faceData.origin;
        const uAxis = faceData.uAxis;
        const vAxis = faceData.vAxis;
        let invWorld = null;
        let dragPlane = null;

        const uvFromWorld = (worldPos) => {
            const local = BABYLON.Vector3.TransformCoordinates(worldPos, invWorld);
            const dx = local.x - origin[0];
            const dy = local.y - origin[1];
            const dz = local.z - origin[2];
            return {
                u: dx * uAxis[0] + dy * uAxis[1] + dz * uAxis[2],
                v: dx * vAxis[0] + dy * vAxis[1] + dz * vAxis[2],
            };
        };

        const worldOnFace = (fallback) => {
            const cam = this.scene.activeCamera;
            if (cam && dragPlane) {
                const ray = this.scene.createPickingRay(
                    this.scene.pointerX,
                    this.scene.pointerY,
                    BABYLON.Matrix.Identity(),
                    cam,
                );
                const dist = ray.intersectsPlane(dragPlane);
                if (typeof dist === 'number') {
                    return ray.origin.add(ray.direction.scale(dist));
                }
            }
            return fallback;
        };

        const poseFromWorld = (worldPos) => {
            if (!invWorld || !worldPos) return;
            const uv = uvFromWorld(worldPos);
            const along = dragHandleAlongAxis(slot, uv.u, uv.v, rect, faceData.width, faceData.height);
            handle.position.copyFrom(this._facePoint(faceData, along.handleU, along.handleV, offset));
            const mag = magnetEdgeIfAtBound(
                feature.face, slot, along.handleU, along.handleV, faceData.width, faceData.height,
            );
            pendingEdge = (slot === 'u' ? mag?.uEdge : mag?.vEdge) || originalEdge;
            handle.material.emissiveColor = pendingEdge !== originalEdge ? hotColor : idleColor;
        };

        drag.onDragStartObservable.add(() => {
            this._dimHandleDragging = true;
            pendingEdge = originalEdge;
            handle.scaling.setAll(1.28);
            const canvas = this.scene.getEngine()?.getRenderingCanvas();
            if (canvas) canvas.style.cursor = 'grabbing';
            ContextManager.instance.viewport?.camera?.detachControl?.();
            this.root.computeWorldMatrix(true);
            const wm = this.root.getWorldMatrix();
            invWorld = wm.clone().invert();
            const n = BABYLON.Vector3.TransformNormal(
                new BABYLON.Vector3(...faceData.normal),
                wm,
            ).normalize();
            if (drag.options) drag.options.dragPlaneNormal = n;
            const worldOrigin = BABYLON.Vector3.TransformCoordinates(
                new BABYLON.Vector3(...faceData.origin),
                wm,
            );
            dragPlane = BABYLON.Plane.FromPositionAndNormal(worldOrigin, n);
        });

        drag.onDragObservable.add((ev) => {
            poseFromWorld(worldOnFace(ev?.dragPlanePoint));
        });

        drag.onDragEndObservable.add(() => {
            const canvas = this.scene.getEngine()?.getRenderingCanvas();
            if (canvas) canvas.style.cursor = '';
            const vp = ContextManager.instance.viewport;
            vp?.camera?.attachControl?.(vp.canvas, true);
            this._dimHandleDragging = false;
            const libraryId = feature.params?.library_id;
            if (pendingEdge && pendingEdge !== originalEdge && libraryId) {
                const built = bindOperationEdge(this.model, libraryId, pendingEdge, slot, feature.face);
                if (built) return;
            }
            this.renderFeatures();
        });

        handle.addBehavior(drag);
    }

    _renderPoint(feature) {
        const faceData = this.model.getFace(feature.face);
        const { u, v } = feature.params;

        const sphere = BABYLON.MeshBuilder.CreateSphere(`point_${feature.id}`, {
            diameter: 5
        }, this.scene);
        sphere.position = this._facePoint(faceData, u, v, 0.5);
        const mat = new BABYLON.StandardMaterial(`point_mat_${feature.id}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.15, 0.5, 1);
        mat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.6);
        sphere.material = mat;
        sphere.isPickable = false;
        sphere.parent = this.root;
        this._featureMarkers.push(sphere);
    }

    _renderGroove(feature) {
        const faceData = this.model.getFace(feature.face || 'FACE_Z_PLUS');
        const params = feature.params || {};
        const u = params.u || 0;
        const v = params.v || 0;
        const w = params.width || 3;
        const len = params.length || params.height || 600;

        const lines = [[
            this._facePoint(faceData, u, v, 0.5),
            this._facePoint(faceData, u + w, v, 0.5),
            this._facePoint(faceData, u + w, v + len, 0.5),
            this._facePoint(faceData, u, v + len, 0.5),
            this._facePoint(faceData, u, v, 0.5)
        ]];
        const rect = BABYLON.MeshBuilder.CreateLineSystem(`groove_${feature.id}`, {
            lines,
            updatable: true,
        }, this.scene);
        rect.color = new BABYLON.Color3(0.95, 0.45, 0.1);
        rect.isPickable = false;
        rect.parent = this.root;
        this._featureMarkers.push(rect);

        if (params.placement === 'edge_dims') {
            this._renderEdgeDimLines(feature, faceData, u, v, w, len, rect);
        }
    }

    /**
     * Oblicza punkt 3D na ścianie z lokalnych współrzędnych UV.
     */
    _facePoint(faceData, u, v, normalOffset) {
        const { origin, uAxis, vAxis, normal } = faceData;
        const ox = origin[0];
        const oy = origin[1];
        const oz = origin[2];
        return new BABYLON.Vector3(
            ox + uAxis[0] * u + vAxis[0] * v + normal[0] * normalOffset,
            oy + uAxis[1] * u + vAxis[1] * v + normal[1] * normalOffset,
            oz + uAxis[2] * u + vAxis[2] * v + normal[2] * normalOffset
        );
    }

    /**
     * Orientuje mesh tak, żeby leżał na powierzchni ściany.
     * Torus/Disc w Babylon domyślnie leżą w XZ (Y-up jest osią otworu).
     * Obracamy Y-up → normal ściany za pomocą kwaterniona.
     */
    _orientToFace(mesh, faceData) {
        const normal = new BABYLON.Vector3(...faceData.normal);
        const defaultUp = new BABYLON.Vector3(0, 1, 0);

        const dot = BABYLON.Vector3.Dot(defaultUp, normal);

        if (dot > 0.999) {
            // Normal == Y-up — bez rotacji
            mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
        } else if (dot < -0.999) {
            // Normal == -Y — obrót 180° wokół X
            mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
                new BABYLON.Vector3(1, 0, 0), Math.PI
            );
        } else {
            // Oś obrotu = cross(Y-up, normal), kąt = acos(dot)
            const axis = BABYLON.Vector3.Cross(defaultUp, normal).normalize();
            const angle = Math.acos(dot);
            mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
        }
    }

    _disposeFeatureMarkers() {
        if (this._featureMarkers) {
            for (const m of this._featureMarkers) {
                if (m.material) m.material.dispose();
                m.dispose();
            }
            this._featureMarkers = [];
        }
    }

    /**
     * Buduje natywny 3D wizualny układ LCS (Local Coordinate System) z osiami X/Y/Z i Pivotem w centrum formatki.
     */
    _buildLCSNode() {
        if (this._lcsNode) {
            this._lcsNode.dispose(false, true);
            this._lcsNode = null;
        }

        if (!this.model || this.model.lcsVisible === false) return;

        this._lcsNode = new BABYLON.TransformNode("LCS_Root", this.scene);
        this._lcsNode.parent = this.root;
        this._lcsNode.position = new BABYLON.Vector3(0, 0, 0); // Natywny Pivot (0,0,0) w środku formatki

        const axesLength = 120;
        const thickness = 3.5;

        const createAxis = (name: string, color: any, dir: 'X' | 'Y' | 'Z', hexColor: string) => {
            const mat = new BABYLON.StandardMaterial(name + "_Mat", this.scene);
            mat.diffuseColor = color;
            mat.emissiveColor = color;
            mat.alpha = 1.0;
            mat.disableDepthWrite = true;
            mat.backFaceCulling = false;

            const cylPos = BABYLON.MeshBuilder.CreateCylinder(name + "_pos", { height: axesLength, diameter: thickness, tessellation: 16 }, this.scene);
            cylPos.material = mat;
            cylPos.renderingGroupId = 2;

            const cylNeg = BABYLON.MeshBuilder.CreateCylinder(name + "_neg", { height: axesLength, diameter: thickness, tessellation: 16 }, this.scene);
            cylNeg.material = mat;
            cylNeg.renderingGroupId = 2;

            if (dir === 'X') {
                cylPos.rotation.z = -Math.PI / 2; cylPos.position.x = axesLength / 2;
                cylNeg.rotation.z = -Math.PI / 2; cylNeg.position.x = -axesLength / 2;
            } else if (dir === 'Z') {
                cylPos.rotation.x = Math.PI / 2; cylPos.position.z = axesLength / 2;
                cylNeg.rotation.x = Math.PI / 2; cylNeg.position.z = -axesLength / 2;
            } else {
                cylPos.position.y = axesLength / 2;
                cylNeg.position.y = -axesLength / 2;
            }
            cylPos.parent = this._lcsNode;
            cylNeg.parent = this._lcsNode;

            const cone = BABYLON.MeshBuilder.CreateCylinder(name + "_head", { height: 16, diameterTop: 0, diameterBottom: thickness * 3.5, tessellation: 16 }, this.scene);
            cone.material = mat;
            cone.renderingGroupId = 2;
            if (dir === 'X') { cone.rotation.z = -Math.PI / 2; cone.position.x = axesLength; }
            else if (dir === 'Z') { cone.rotation.x = Math.PI / 2; cone.position.z = axesLength; }
            else { cone.position.y = axesLength; }
            cone.parent = this._lcsNode;

            const makeLabel = (text: string, posOffset: any) => {
                const plane = BABYLON.MeshBuilder.CreatePlane("lbl_" + text, { size: 18 }, this.scene);
                plane.position = posOffset;
                plane.parent = this._lcsNode;
                plane.renderingGroupId = 2;
                plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
                const dt = new BABYLON.DynamicTexture("dt_" + text, { width: 64, height: 64 }, this.scene, false);
                dt.hasAlpha = true;
                dt.drawText(text, null, 42, "bold 36px Arial", hexColor, "transparent", true);
                const matText = new BABYLON.StandardMaterial("matText_" + text, this.scene);
                matText.diffuseTexture = dt;
                matText.emissiveColor = new BABYLON.Color3(1, 1, 1);
                matText.disableDepthWrite = true;
                matText.backFaceCulling = false;
                plane.material = matText;
            };

            const lblDist = axesLength + 14;
            if (dir === 'X') {
                makeLabel("+X_LCS", new BABYLON.Vector3(lblDist, 0, 0));
                makeLabel("-X_LCS", new BABYLON.Vector3(-lblDist, 0, 0));
            } else if (dir === 'Y') {
                makeLabel("+Y_LCS", new BABYLON.Vector3(0, lblDist, 0));
                makeLabel("-Y_LCS", new BABYLON.Vector3(0, -lblDist, 0));
            } else if (dir === 'Z') {
                makeLabel("+Z_LCS", new BABYLON.Vector3(0, 0, lblDist));
                makeLabel("-Z_LCS", new BABYLON.Vector3(0, 0, -lblDist));
            }
        };

        createAxis("LCS_X", new BABYLON.Color3(1.0, 0.1, 0.1), 'X', "#ff2222");
        createAxis("LCS_Y", new BABYLON.Color3(0.1, 0.9, 0.1), 'Y', "#22ff22");
        createAxis("LCS_Z", new BABYLON.Color3(0.1, 0.4, 1.0), 'Z', "#2266ff");
    }

    /**
     * Włącza lub wyłącza widoczność natywnego układu LCS dla tej formatki.
     */
    setLcsVisible(visible: boolean) {
        if (this.model) this.model.lcsVisible = visible;
        if (this._lcsNode) {
            this._lcsNode.setEnabled(visible);
        } else if (visible) {
            this._buildLCSNode();
        }
    }

    /**
     * Aktywuje lub dezaktywuje wizualne podświetlenie (np. z drzewa obiektów).
     */
    setSelected(isSelected: boolean) {
        if (!this.faceMeshes) return;
        for (const faceName in this.faceMeshes) {
            const mesh = this.faceMeshes[faceName];
            if (isSelected) {
                mesh.renderOutline = true;
                mesh.outlineColor = new BABYLON.Color3(0.2, 1.0, 0.4);
                mesh.outlineWidth = 1.5;
            } else {
                mesh.renderOutline = false;
            }
        }
    }
}

