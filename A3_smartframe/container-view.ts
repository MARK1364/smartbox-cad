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
import { resolveDetectedBay } from '../A2_bloki/02_bloki-bay-detector.js';

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
        const B = typeof BABYLON !== 'undefined' ? BABYLON : (globalThis as any).BABYLON;
        if (!B) return null;
        if (this._isApplianceContainer()) {
            return new B.Color4(0.22, 0.74, 0.97, 0.75);
        }
        if (this._isHandleContainer() || this._isHangerContainer()) {
            if (this._isStudioSmartPartGhost()) {
                const hex = this.model?.generatorParams?.part?.colorHex;
                if (hex) {
                    try {
                        const c = B.Color3.FromHexString(hex);
                        return new B.Color4(c.r, c.g, c.b, 0.9);
                    } catch { /* ignore */ }
                }
                return new B.Color4(0.22, 0.74, 0.97, 0.9);
            }
            return new B.Color4(0.2, 0.7, 1.0, 0.45);
        }
        if (this._isBlokiContainer() || this._isHangersGroupContainer()) {
            return new B.Color4(0.15, 0.78, 1.0, 0.85);
        }
        return new B.Color4(0.2, 0.5, 1.0, 0.55);
    }

    _defaultEmissiveColor() {
        const B = typeof BABYLON !== 'undefined' ? BABYLON : (globalThis as any).BABYLON;
        if (!B) return null;
        if (this._isApplianceContainer()) {
            return new B.Color3(0.22, 0.74, 0.97);
        }
        if (this._isHandleContainer() || this._isHangerContainer()) {
            if (this._isStudioSmartPartGhost()) {
                const hex = this.model?.generatorParams?.part?.colorHex;
                if (hex) {
                    try {
                        return B.Color3.FromHexString(hex);
                    } catch { /* ignore */ }
                }
                return new B.Color3(0.22, 0.74, 0.97);
            }
            return new B.Color3(0.1, 0.55, 0.95);
        }
        if (this._isBlokiContainer() || this._isHangersGroupContainer()) {
            return new B.Color3(0.1, 0.55, 0.95);
        }
        return new B.Color3(0.2, 0.5, 1.0);
    }

    _getSlopedInfo(): {
        isSloped: boolean;
        yTopLeft: number;
        yTopRight: number;
        yTopFront?: number;
        yTopBack?: number;
    } | null {
        const gp = this.model?.generatorParams;
        if (!gp) return null;

        const defaultHeight = unit.toBabylon(this.model.height);

        // 1. Sprawdzenie detectedBay (dla bloków wstawionych do wnęki)
        const bay = resolveDetectedBay(gp);
        if (bay) {
            const roofAngleDeg = bay.roofAngleDeg ?? bay.boundary?.top?.slopeAngleDeg ?? gp.boundary?.top?.slopeAngleDeg;
            const hasLRSlope = (roofAngleDeg !== undefined && Math.abs(roofAngleDeg) > 0.05)
                || (bay.heightLeftMm !== undefined && bay.heightRightMm !== undefined && Math.abs(bay.heightLeftMm - bay.heightRightMm) > 1);

            if (hasLRSlope) {
                let hLeft = bay.heightLeftMm;
                let hRight = bay.heightRightMm;
                if (hLeft === undefined || hRight === undefined) {
                    const bw = Math.max(1, bay.boundsMm?.width ?? unit.toBabylon(this.model.width));
                    const tanBeta = Math.tan(((roofAngleDeg || 0) * Math.PI) / 180);
                    const bh = Math.max(1, bay.boundsMm?.height ?? defaultHeight);
                    hLeft = tanBeta >= 0 ? Math.max(10, bh - bw * tanBeta) : bh;
                    hRight = tanBeta >= 0 ? bh : Math.max(10, bh - bw * Math.abs(tanBeta));
                }
                return {
                    isSloped: true,
                    yTopLeft: hLeft,
                    yTopRight: hRight
                };
            }

            if (bay.heightFrontMm !== undefined && bay.heightBackMm !== undefined && Math.abs(bay.heightFrontMm - bay.heightBackMm) > 1) {
                return {
                    isSloped: true,
                    yTopLeft: bay.heightFrontMm,
                    yTopRight: bay.heightFrontMm,
                    yTopFront: bay.heightFrontMm,
                    yTopBack: bay.heightBackMm
                };
            }
        }

        // 2. Bezpośrednie parametry skosu na generatorParams bloku (np. drzwi skośne)
        if (gp.dach_kat_deg !== undefined && Math.abs(Number(gp.dach_kat_deg)) > 0.05) {
            const bw = unit.toBabylon(this.model.width);
            const bh = defaultHeight;
            const betaDeg = Number(gp.dach_kat_deg);
            const tanBeta = Math.tan((betaDeg * Math.PI) / 180);
            const rodzaj = gp.rodzaj_drzwi;
            let hLeft: number;
            let hRight: number;
            if (rodzaj === 'RIGHT' || betaDeg > 0) {
                hRight = bh;
                hLeft = Math.max(10, bh - bw * Math.abs(tanBeta));
            } else {
                hLeft = bh;
                hRight = Math.max(10, bh - bw * Math.abs(tanBeta));
            }
            return {
                isSloped: true,
                yTopLeft: hLeft,
                yTopRight: hRight
            };
        }

        // 3. Szafka skośna (korpus_skosny / korpus_skosny_lr)
        const cabType = String(gp.typ_korpusu || gp.type || '').toLowerCase();
        if (cabType.includes('skosny')) {
            if (gp.wysokosc_lewy_mm != null && gp.wysokosc_prawy_mm != null && Math.abs(gp.wysokosc_lewy_mm - gp.wysokosc_prawy_mm) > 1) {
                return {
                    isSloped: true,
                    yTopLeft: Number(gp.wysokosc_lewy_mm),
                    yTopRight: Number(gp.wysokosc_prawy_mm)
                };
            }
            if (gp.wysokosc_przod_mm != null && gp.wysokosc_tyl_mm != null && Math.abs(gp.wysokosc_przod_mm - gp.wysokosc_tyl_mm) > 1) {
                const hFront = Number(gp.wysokosc_przod_mm);
                const hBack = Number(gp.wysokosc_tyl_mm);
                return {
                    isSloped: true,
                    yTopLeft: hFront,
                    yTopRight: hFront,
                    yTopFront: hFront,
                    yTopBack: hBack
                };
            }
        }

        return null;
    }

    _createSlopedVertexData(width: number, depth: number, slopeInfo: { yTopLeft: number; yTopRight: number; yTopFront?: number; yTopBack?: number }) {
        const x0 = -width / 2;
        const x1 = width / 2;
        const z0 = -depth / 2;
        const z1 = depth / 2;

        const yTop0 = slopeInfo.yTopFront !== undefined ? slopeInfo.yTopFront : slopeInfo.yTopLeft;
        const yTop1 = slopeInfo.yTopFront !== undefined ? slopeInfo.yTopFront : slopeInfo.yTopRight;
        const yTop2 = slopeInfo.yTopBack !== undefined ? slopeInfo.yTopBack : slopeInfo.yTopRight;
        const yTop3 = slopeInfo.yTopBack !== undefined ? slopeInfo.yTopBack : slopeInfo.yTopLeft;

        const positions = [
            x0, 0, z0,      // 0 (front-left-bottom)
            x1, 0, z0,      // 1 (front-right-bottom)
            x1, yTop1, z0,  // 2 (front-right-top)
            x0, yTop0, z0,  // 3 (front-left-top)
            x0, 0, z1,      // 4 (back-left-bottom)
            x1, 0, z1,      // 5 (back-right-bottom)
            x1, yTop2, z1,  // 6 (back-right-top)
            x0, yTop3, z1   // 7 (back-left-top)
        ];

        const indices = [
            0, 3, 2, 0, 2, 1, // Front (-Z)
            4, 5, 6, 4, 6, 7, // Back (+Z)
            4, 7, 3, 4, 3, 0, // Left (-X)
            1, 2, 6, 1, 6, 5, // Right (+X)
            4, 0, 1, 4, 1, 5, // Bottom (-Y)
            3, 7, 6, 3, 6, 2  // Top (+Y skośne)
        ];

        const B = typeof BABYLON !== 'undefined' ? BABYLON : (globalThis as any).BABYLON;
        if (!B) return null;

        const vertexData = new B.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        const normals: number[] = [];
        if (typeof B.VertexData?.ComputeNormals === 'function') {
            B.VertexData.ComputeNormals(positions, indices, normals);
            vertexData.normals = normals;
        }
        return vertexData;
    }

    private _isSelected: boolean = false;

    _buildWireframe() {
        const B = typeof BABYLON !== 'undefined' ? BABYLON : (globalThis as any).BABYLON;
        if (!this.scene || !B) return;

        const width = unit.toBabylon(this.model.width);
        const height = unit.toBabylon(this.model.height);
        const depth = unit.toBabylon(this.model.depth);
        const slopeInfo = this._getSlopedInfo();

        let isNew = false;
        if (!this.mesh) {
            const defaultName = this._isApplianceContainer()
                ? 'Appliance'
                : (this._isHandleContainer()
                    ? 'SmartPartHandle'
                    : (this._isHangerContainer()
                        ? 'SmartPartHanger'
                        : (this._isBlokiContainer() || this._isHangersGroupContainer() ? 'Bloki' : 'SmartFrame')));

            if (slopeInfo) {
                this.mesh = new B.Mesh(this.model.name || defaultName, this.scene);
                const vertexData = this._createSlopedVertexData(width, depth, slopeInfo);
                if (vertexData) vertexData.applyToMesh(this.mesh, true);
            } else {
                this.mesh = B.MeshBuilder.CreateBox(this.model.name || defaultName, {
                    width, height, depth, updatable: true
                }, this.scene);
            }
            
            isNew = true;
            this.material = new B.StandardMaterial('containerMat_' + this.model.name, this.scene);
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
            if (slopeInfo) {
                const vertexData = this._createSlopedVertexData(width, depth, slopeInfo);
                if (vertexData) vertexData.applyToMesh(this.mesh, true);
            } else {
                const vertexData = B.VertexData.CreateBox({ width, height, depth });
                vertexData.applyToMesh(this.mesh, true);
            }
        }

        // Przesunięcie wierzchołków:
        // - Dla brył skośnych: wierzchołki mają już podstawę w Y=0 (nie przesuwamy w Y).
        // - Korpus/Bloki/grupa zawieszek standardowe: podstawa o Z=0 (Babylon +height/2 w Y).
        // - Uchwyt: stopki na licu (Z=0), gabaryt na zewnątrz o depth w kierunku normalZ.
        // - Zawieszka MOUNT_CORNER: origin = róg wnęki; ramka w głąb światła (nie w płyty).
        if (slopeInfo) {
            // Sloped mesh ma podstawę już w Y=0 — nie wymaga bake Translation(0, height / 2, 0)
        } else if (this._isHandleContainer()) {
            const gp = this.model?.generatorParams || {};
            const normalZ = gp.normalZ ?? -1;
            this.mesh.bakeTransformIntoVertices(B.Matrix.Translation(0, 0, normalZ * depth / 2));
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
                this.mesh.bakeTransformIntoVertices(B.Matrix.Translation(ox, oy, oz));
            }
        } else {
            this.mesh.bakeTransformIntoVertices(B.Matrix.Translation(0, height / 2, 0));
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

        const slopeInfo = this._getSlopedInfo();
        const slopeKey = slopeInfo
            ? `${slopeInfo.yTopLeft}_${slopeInfo.yTopRight}_${slopeInfo.yTopFront ?? ''}_${slopeInfo.yTopBack ?? ''}`
            : '';

        if (
            c._cachedWidth !== width || c._cachedHeight !== height || c._cachedDepth !== depth
            || c._cachedNalDolne !== nalDolne || c._cachedOrientation !== orientation
            || c._cachedHangerSide !== hangerSide || c._cachedSlopeKey !== slopeKey
        ) {
            this._buildWireframe();
            c._cachedWidth  = width;
            c._cachedHeight = height;
            c._cachedDepth  = depth;
            c._cachedNalDolne = nalDolne;
            c._cachedOrientation = orientation;
            c._cachedHangerSide = hangerSide;
            c._cachedSlopeKey = slopeKey;
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
