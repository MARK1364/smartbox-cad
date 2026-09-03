/**
 * Widok 3D (BabylonJS) dla obiektu ContainerModel.
 * Renderuje półprzezroczysty "pusty" sześcian w trybie krawędziowym (Wireframe).
 *
 * Hierarchia:
 *   rootNode (TransformNode/Mesh) — pozycja przez SceneSyncAdapter ← _cadNode
 *     └─ PanelView.root — podpinane do rootNode przez app.ts
 *
 * Transformacja: adapter synchronizuje _cadNode.localMatrix → mesh.position / rotationQuaternion.
 * Babylon liczy worldMatrix sam przez parent-child.
 */

declare const BABYLON: any;
import { SceneSyncAdapter } from '../A1_core/cad-node/scene-sync-adapter.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { unit } from '../A1_core/unit-system.js';

export class ContainerView {
    scene: any;
    model: any;
    rootNode: any = null;
    mesh: any = null;
    material: any = null;
    _syncAdapter: SceneSyncAdapter;

    constructor(scene: any, containerModel: any) {
        this.scene = scene;
        this.model = containerModel;
        this._syncAdapter = ContextManager.instance.sceneSyncAdapter;

        this._buildWireframe();

        (this as any)._cachedWidth  = unit.toBabylon(containerModel.width);
        (this as any)._cachedHeight = unit.toBabylon(containerModel.height);
        (this as any)._cachedDepth  = unit.toBabylon(containerModel.depth);

        // Podłącz adapter: CADNode ↔ rootNode
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(containerModel.id);
        if (cadNode && this.rootNode) {
            this._syncAdapter.bind(cadNode, this.rootNode);
        }
    }

    _buildWireframe() {
        const width = unit.toBabylon(this.model.width);
        const height = unit.toBabylon(this.model.height);
        const depth = unit.toBabylon(this.model.depth);

        let isNew = false;
        if (!this.mesh) {
            this.mesh = BABYLON.MeshBuilder.CreateBox(this.model.name || 'SmartFrame', {
                width, height, depth, updatable: true
            }, this.scene);
            
            isNew = true;
            this.material = new BABYLON.StandardMaterial('containerMat_' + this.model.name, this.scene);
            this.material.wireframe = false;
            this.material.emissiveColor = new BABYLON.Color3(0.2, 0.5, 1.0);
            this.material.alpha = 0.0;
            this.material.disableLighting = true;

            this.mesh.material = this.material;
            this.mesh.isPickable = false;
            this.mesh.metadata = { type: 'container', model: this.model };
            this.rootNode = this.mesh;
        } else {
            const vertexData = BABYLON.VertexData.CreateBox({ width, height, depth });
            vertexData.applyToMesh(this.mesh, true);
        }

        // 1. ZAWSZE najpierw przesuwamy wierzchołki geometrii tak, aby Y=0 było na dole (dopasowanie do Z=0 z CAD)
        this.mesh.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, height / 2, 0));

        // 2. DOPIERO PO PRZESUNIĘCIU WIERZCHOŁKÓW aktywujemy EdgesRenderer, aby zmapował faktyczne pozycje krawędzi
        if (!isNew) {
            this.mesh.disableEdgesRendering(); // Wymuszamy zrzucenie starego cache'u krawędzi
        }
        
        this.mesh.metadata = { type: 'container', model: this.model };
        this.mesh.enableEdgesRendering(0.9999);
        this.mesh.edgesWidth = 2.0;
        this.mesh.edgesColor = new BABYLON.Color4(0.2, 0.5, 1.0, 0.5);

        // Pozycja z CADNode przez adapter (nie ręcznie z model.position)
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(this.model.id);
        if (cadNode) {
            this._syncAdapter.bind(cadNode, this.rootNode);
        }
    }

    /** Aktualizuje siatkę i pozycję. Adapter zadbuje o synchronizację _cadNode → mesh. */
    update() {
        const width = unit.toBabylon(this.model.width);
        const height = unit.toBabylon(this.model.height);
        const depth = unit.toBabylon(this.model.depth);
        const c = this as any;

        if (c._cachedWidth !== width || c._cachedHeight !== height || c._cachedDepth !== depth) {
            this._buildWireframe();
            c._cachedWidth  = width;
            c._cachedHeight = height;
            c._cachedDepth  = depth;
        } else {
            // Wymuszamy synchronizację adaptera (nic nie zmienia jeśli _cadNode nie jest dirty)
            const doc = ContextManager.instance.document;
            const cadNode = doc?.findNode(this.model.id);
            if (cadNode) {
                cadNode.getWorldMatrix(); // propaguje dirty-flag → trigger adaptera
            }
        }
    }

    setSelected(isSelected: boolean) {
        if (!this.material || !this.mesh) return;
        if (isSelected) {
            this.material.emissiveColor = new BABYLON.Color3(0.2, 0.9, 0.4);
            this.material.alpha = 0.1; // Lekka widoczna bryła po zaznaczeniu
            this.mesh.edgesWidth = 4.0;
            this.mesh.edgesColor = new BABYLON.Color4(0.2, 1.0, 0.4, 1.0);
        } else {
            this.material.emissiveColor = new BABYLON.Color3(0.2, 0.5, 1.0);
            this.material.alpha = 0.0;
            this.mesh.edgesWidth = 2.0;
            this.mesh.edgesColor = new BABYLON.Color4(0.2, 0.5, 1.0, 0.5);
        }
    }

    dispose() {
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(this.model.id);
        if (cadNode) {
            this._syncAdapter.unbind(cadNode);
        }
        if (this.mesh) this.mesh.dispose();
        if (this.material) this.material.dispose();
        // rootNode === mesh, już usunięty powyżej
    }
}
