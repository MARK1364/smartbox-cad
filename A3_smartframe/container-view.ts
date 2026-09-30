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

    _isBlokiContainer(): boolean {
        const gp = this.model?.generatorParams;
        if (!gp) return false;
        if (typeof gp.type === 'string' && gp.type.startsWith('bloki')) return true;
        return gp.boxType != null && gp.boxType !== '';
    }

    _isApplianceContainer(): boolean {
        return this.model?.role === 'APPLIANCE' || this.model?.generatorParams?.type === 'smart_appliance';
    }

    _isHandleContainer(): boolean {
        return this.model?.role === 'SMARTPART_HANDLE' || this.model?.generatorParams?.type === 'smartpart_handle';
    }

    _defaultEdgeColor() {
        if (this._isApplianceContainer()) {
            return new BABYLON.Color4(0.22, 0.74, 0.97, 0.75);
        }
        if (this._isHandleContainer()) {
            return new BABYLON.Color4(0.2, 0.8, 0.4, 0.4);
        }
        if (this._isBlokiContainer()) {
            // Bloki — jasny cyjan (odróżnienie od korpusu SmartFrame)
            return new BABYLON.Color4(0.15, 0.78, 1.0, 0.85);
        }
        // SmartFrame / korpus — klasyczny niebieski
        return new BABYLON.Color4(0.2, 0.5, 1.0, 0.55);
    }

    _defaultEmissiveColor() {
        if (this._isApplianceContainer()) {
            return new BABYLON.Color3(0.22, 0.74, 0.97);
        }
        if (this._isHandleContainer()) {
            return new BABYLON.Color3(0.1, 0.7, 0.3);
        }
        if (this._isBlokiContainer()) {
            return new BABYLON.Color3(0.1, 0.55, 0.95);
        }
        return new BABYLON.Color3(0.2, 0.5, 1.0);
    }

    private _isSelected: boolean = false;

    _buildWireframe() {
        const width = unit.toBabylon(this.model.width);
        const height = unit.toBabylon(this.model.height);
        const depth = unit.toBabylon(this.model.depth);

        let isNew = false;
        if (!this.mesh) {
            const defaultName = this._isApplianceContainer()
                ? 'Appliance'
                : (this._isHandleContainer()
                    ? 'SmartPartHandle'
                    : (this._isBlokiContainer() ? 'Bloki' : 'SmartFrame'));
            this.mesh = BABYLON.MeshBuilder.CreateBox(this.model.name || defaultName, {
                width, height, depth, updatable: true
            }, this.scene);
            
            isNew = true;
            this.material = new BABYLON.StandardMaterial('containerMat_' + this.model.name, this.scene);
            this.material.wireframe = false;
            this.material.emissiveColor = this._defaultEmissiveColor();
            this.material.alpha = 0.0;
            this.material.disableLighting = true;

            this.mesh.material = this.material;
            this.mesh.isPickable = false;
            this.mesh.metadata = {
                type: this._isApplianceContainer() ? 'appliance' : (this._isHandleContainer() ? 'smartpart_handle' : (this._isBlokiContainer() ? 'bloki' : 'container')),
                model: this.model,
            };
            this.rootNode = this.mesh;
        } else {
            const vertexData = BABYLON.VertexData.CreateBox({ width, height, depth });
            vertexData.applyToMesh(this.mesh, true);
        }

        // Przesunięcie wierzchołków:
        // - Dla korpusu/Bloki: podstawa korpusu opiera się o Z=0 (w Babylonie +height/2 w osi Y).
        // - Dla uchwytu SmartPart: stopki opierają się o lico formatki (Z=0 lokalnie), a gabaryt wystaje na zewnątrz o 'depth' w kierunku normalZ.
        if (this._isHandleContainer()) {
            const gp = this.model?.generatorParams || {};
            const normalZ = gp.normalZ ?? -1;
            this.mesh.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, 0, normalZ * depth / 2));
        } else {
            this.mesh.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, height / 2, 0));
        }

        if (typeof this.mesh.refreshBoundingInfo === 'function') {
            this.mesh.refreshBoundingInfo();
        }

        // 2. DOPIERO PO PRZESUNIĘCIU WIERZCHOŁKÓW aktywujemy EdgesRenderer, aby zmapował faktyczne pozycje krawędzi
        if (!isNew) {
            this.mesh.disableEdgesRendering(); // Wymuszamy zrzucenie starego cache'u krawędzi
        }
        
        this.mesh.metadata = {
            type: this._isApplianceContainer() ? 'appliance' : (this._isHandleContainer() ? 'smartpart_handle' : (this._isBlokiContainer() ? 'bloki' : 'container')),
            model: this.model,
        };
        this.mesh.enableEdgesRendering(0.9999);
        this.mesh.edgesWidth = this._isBlokiContainer() ? 2.5 : 2.0;

        if (this._isSelected) {
            this.setSelected(true);
        } else {
            this.mesh.edgesColor = this._defaultEdgeColor();
        }

        // Pozycja z CADNode przez adapter (nie ręcznie z model.position)
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(this.model.id);
        if (cadNode) {
            this._syncAdapter.bind(cadNode, this.rootNode);
        }
    }

    /** Aktualizuje siatkę i pozycję. Adapter zadba o synchronizację _cadNode → mesh. */
    update() {
        const width = unit.toBabylon(this.model.width);
        const height = unit.toBabylon(this.model.height);
        const depth = unit.toBabylon(this.model.depth);
        const c = this as any;
        const gp = this.model?.generatorParams || {};
        const nalDolne = gp.nalDolneMicro ?? 0;
        const orientation = gp.orientation || 'HORIZONTAL';

        if (c._cachedWidth !== width || c._cachedHeight !== height || c._cachedDepth !== depth || c._cachedNalDolne !== nalDolne || c._cachedOrientation !== orientation) {
            this._buildWireframe();
            c._cachedWidth  = width;
            c._cachedHeight = height;
            c._cachedDepth  = depth;
            c._cachedNalDolne = nalDolne;
            c._cachedOrientation = orientation;
        }

        // Zawsze wymuszamy synchronizację adaptera pozycji i rotacji (zarówno przy zmianie geometrii jak i pozycji)
        const doc = ContextManager.instance.document;
        const cadNode = doc?.findNode(this.model.id);
        if (cadNode) {
            cadNode.getWorldMatrix(); // propaguje dirty-flag → trigger adaptera
        }
    }

    setSelected(isSelected: boolean) {
        this._isSelected = isSelected;
        if (!this.material || !this.mesh) return;
        const isSb = this._isBlokiContainer();
        const isHandle = this._isHandleContainer();
        if (isSelected) {
            if (isHandle) {
                this.material.emissiveColor = new BABYLON.Color3(0.15, 0.9, 0.4);
                this.material.alpha = 0.08;
                this.mesh.edgesWidth = 3.0;
                this.mesh.edgesColor = new BABYLON.Color4(0.2, 1.0, 0.4, 1.0);
            } else if (isSb) {
                this.material.emissiveColor = new BABYLON.Color3(0.15, 0.85, 1.0);
                this.material.alpha = 0.12;
                this.mesh.edgesWidth = 4.0;
                this.mesh.edgesColor = new BABYLON.Color4(0.2, 0.9, 1.0, 1.0);
            } else {
                this.material.emissiveColor = new BABYLON.Color3(0.2, 0.9, 0.4);
                this.material.alpha = 0.1;
                this.mesh.edgesWidth = 4.0;
                this.mesh.edgesColor = new BABYLON.Color4(0.2, 1.0, 0.4, 1.0);
            }
        } else {
            this.material.emissiveColor = this._defaultEmissiveColor();
            this.material.alpha = 0.0;
            this.mesh.edgesWidth = isSb ? 2.5 : 2.0;
            this.mesh.edgesColor = this._defaultEdgeColor();
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
