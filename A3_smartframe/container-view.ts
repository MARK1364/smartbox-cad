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
        if (typeof gp.type === 'string' && (gp.type.startsWith('blok_') || gp.type.startsWith('bloki'))) return true;
        return gp.boxType != null && gp.boxType !== '';
    }

    _isApplianceContainer(): boolean {
        return this.model?.role === 'APPLIANCE' || this.model?.generatorParams?.type === 'smart_appliance';
    }

    _isHandleContainer(): boolean {
        return this.model?.role === 'SMARTPART_HANDLE' || this.model?.generatorParams?.type === 'smartpart_handle';
    }

    /** Pojedyncza zawieszka — origin = róg montażowy (MOUNT_CORNER). */
    _isHangerContainer(): boolean {
        return this.model?.role === 'SMARTPART_HANGER' || this.model?.generatorParams?.type === 'smartpart_hanger';
    }

    /** Grupa pary zawieszek — gabaryt wnęki (jak Blok). */
    _isHangersGroupContainer(): boolean {
        return this.model?.role === 'SMARTPART_HANGERS' || this.model?.generatorParams?.type === 'smartpart_hangers';
    }

    /** SmartPart ze Studio (kontener / Part) — półprzezroczysty gabaryt jak w Studio. */
    _isStudioSmartPartGhost(): boolean {
        const gp = this.model?.generatorParams || {};
        return Boolean(
            gp.isSmartPart
            || (this._isHangerContainer() && (gp.definition || gp.part))
            || (this._isHangersGroupContainer() && gp.definition)
        );
    }

    _meshMetadataType(): string {
        if (this._isApplianceContainer()) return 'appliance';
        if (this._isHandleContainer()) return 'smartpart_handle';
        if (this._isHangerContainer()) return 'smartpart_hanger';
        if (this._isHangersGroupContainer()) return 'smartpart_hangers';
        if (this._isBlokiContainer()) return 'bloki';
        return 'container';
    }

    _defaultEdgeColor() {
        if (this._isApplianceContainer()) {
            return new BABYLON.Color4(0.22, 0.74, 0.97, 0.75);
        }
        if (this._isHandleContainer() || this._isHangerContainer()) {
            if (this._isStudioSmartPartGhost()) {
                const hex = this.model?.generatorParams?.part?.colorHex;
                if (hex) {
                    try {
                        const c = BABYLON.Color3.FromHexString(hex);
                        return new BABYLON.Color4(c.r, c.g, c.b, 0.9);
                    } catch { /* ignore */ }
                }
                return new BABYLON.Color4(0.22, 0.74, 0.97, 0.9);
            }
            return new BABYLON.Color4(0.2, 0.7, 1.0, 0.45);
        }
        if (this._isBlokiContainer() || this._isHangersGroupContainer()) {
            return new BABYLON.Color4(0.15, 0.78, 1.0, 0.85);
        }
        return new BABYLON.Color4(0.2, 0.5, 1.0, 0.55);
    }

    _defaultEmissiveColor() {
        if (this._isApplianceContainer()) {
            return new BABYLON.Color3(0.22, 0.74, 0.97);
        }
        if (this._isHandleContainer() || this._isHangerContainer()) {
            if (this._isStudioSmartPartGhost()) {
                const hex = this.model?.generatorParams?.part?.colorHex;
                if (hex) {
                    try {
                        return BABYLON.Color3.FromHexString(hex);
                    } catch { /* ignore */ }
                }
                return new BABYLON.Color3(0.22, 0.74, 0.97);
            }
            return new BABYLON.Color3(0.1, 0.55, 0.95);
        }
        if (this._isBlokiContainer() || this._isHangersGroupContainer()) {
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
                    : (this._isHangerContainer()
                        ? 'SmartPartHanger'
                        : (this._isBlokiContainer() || this._isHangersGroupContainer() ? 'Bloki' : 'SmartFrame')));
            this.mesh = BABYLON.MeshBuilder.CreateBox(this.model.name || defaultName, {
                width, height, depth, updatable: true
            }, this.scene);
            
            isNew = true;
            this.material = new BABYLON.StandardMaterial('containerMat_' + this.model.name, this.scene);
            this.material.wireframe = false;
            this.material.emissiveColor = this._defaultEmissiveColor();
            // SmartPart ze Studio: półprzezroczysty kontener/Part (jak w Studio). Inaczej tylko krawędzie.
            this.material.alpha = this._isStudioSmartPartGhost()
                ? (this._isHangersGroupContainer() ? 0.10 : 0.22)
                : 0.0;
            this.material.disableLighting = true;

            this.mesh.material = this.material;
            this.mesh.isPickable = false;
            this.mesh.metadata = {
                type: this._meshMetadataType(),
                nodeId: this.model.id,
                model: this.model,
            };
            this.rootNode = this.mesh;
        } else {
            const vertexData = BABYLON.VertexData.CreateBox({ width, height, depth });
            vertexData.applyToMesh(this.mesh, true);
        }

        // Przesunięcie wierzchołków:
        // - Korpus/Bloki/grupa zawieszek: podstawa o Z=0 (Babylon +height/2 w Y).
        // - Uchwyt: stopki na licu (Z=0), gabaryt na zewnątrz o depth w kierunku normalZ.
        // - Zawieszka MOUNT_CORNER: origin = róg wnęki; ramka w głąb światła (nie w płyty).
        if (this._isHandleContainer()) {
            const gp = this.model?.generatorParams || {};
            const normalZ = gp.normalZ ?? -1;
            this.mesh.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, 0, normalZ * depth / 2));
        } else if (this._isHangerContainer()) {
            const gp = this.model?.generatorParams || {};
            // SmartPart ze Studio: pozycja = ŚRODEK bryły (jak w Studio). Camaro = MOUNT_CORNER.
            if (gp.isSmartPart || gp.mountOrigin === 'CENTER') {
                // CreateBox jest już wycentrowany — bez bake offsetu.
            } else {
                const side = String(gp.side || 'L').toUpperCase();
                // MOUNT_CORNER, osie CAD (po obrocie 90° Z względem starego układu):
                //   width  → X: od boku w głąb; height → Z↓ od wieńca; depth → Y: wzdłuż boku → przód.
                // Mesh Babylon: X=width, Y=height, Z=depth.
                const ox = side === 'R' ? -width / 2 : width / 2;
                const oy = -height / 2;
                const oz = -depth / 2;
                this.mesh.bakeTransformIntoVertices(BABYLON.Matrix.Translation(ox, oy, oz));
            }
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
            type: this._meshMetadataType(),
            model: this.model,
        };
        this.mesh.enableEdgesRendering(0.9999);
        this.mesh.edgesWidth = (this._isBlokiContainer() || this._isHangersGroupContainer()) ? 2.5 : 2.0;

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
        const hangerSide = gp.side || '';

        if (
            c._cachedWidth !== width || c._cachedHeight !== height || c._cachedDepth !== depth
            || c._cachedNalDolne !== nalDolne || c._cachedOrientation !== orientation
            || c._cachedHangerSide !== hangerSide
        ) {
            this._buildWireframe();
            c._cachedWidth  = width;
            c._cachedHeight = height;
            c._cachedDepth  = depth;
            c._cachedNalDolne = nalDolne;
            c._cachedOrientation = orientation;
            c._cachedHangerSide = hangerSide;
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
        const isSb = this._isBlokiContainer() || this._isHangersGroupContainer();
        const isHandle = this._isHandleContainer() || this._isHangerContainer();
        if (isSelected) {
            if (isHandle) {
                // Uchwyty / pojedyncze SP — ten sam niebieski akcent co Bloki
                this.material.emissiveColor = new BABYLON.Color3(0.15, 0.85, 1.0);
                this.material.alpha = 0.08;
                this.mesh.edgesWidth = 3.0;
                this.mesh.edgesColor = new BABYLON.Color4(0.2, 0.9, 1.0, 1.0);
            } else if (isSb) {
                this.material.emissiveColor = new BABYLON.Color3(0.15, 0.85, 1.0);
                this.material.alpha = 0.12;
                this.mesh.edgesWidth = 4.0;
                this.mesh.edgesColor = new BABYLON.Color4(0.2, 0.9, 1.0, 1.0);
            } else {
                this.material.emissiveColor = new BABYLON.Color3(0.15, 0.85, 1.0);
                this.material.alpha = 0.1;
                this.mesh.edgesWidth = 4.0;
                this.mesh.edgesColor = new BABYLON.Color4(0.2, 0.9, 1.0, 1.0);
            }
        } else {
            this.material.emissiveColor = this._defaultEmissiveColor();
            this.material.alpha = this._isStudioSmartPartGhost()
                ? (this._isHangersGroupContainer() ? 0.10 : 0.22)
                : 0.0;
            this.mesh.edgesWidth = isSb ? 2.5 : 2.0;
            this.mesh.edgesColor = this._defaultEdgeColor();
        }
    }

    dispose() {
        // Po RemoveNodeCommand węzeł już nie jest w dokumencie — unbind po id
        if (this.model?.id) {
            this._syncAdapter.unbindById(this.model.id);
        }
        if (this.mesh) {
            try { this.mesh.dispose(false, true); } catch { /* ignore */ }
            this.mesh = null;
        }
        if (this.material) {
            try { this.material.dispose(); } catch { /* ignore */ }
            this.material = null;
        }
        this.rootNode = null;
    }
}
