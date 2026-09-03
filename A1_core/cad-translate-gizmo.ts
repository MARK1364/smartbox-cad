/**
 * cad-translate-gizmo.ts — gizmo przesunięcia w osiach CAD (Z-up).
 *
 * Domyślny Babylon PositionGizmo ma Y w górę (zielony). Tutaj:
 *   X czerwony = szerokość
 *   Y zielony  = głębokość (Babylon +Z)
 *   Z niebieski = wysokość / góra (Babylon +Y)
 *
 * Osi świata (updateGizmoRotationToMatchAttachedMesh = false) — jak Creo/SW.
 */

declare const BABYLON: any;

export type CadGizmoDragHandler = () => void;

export class CadTranslateGizmo {
    readonly xGizmo: any;
    /** CAD Y — głębokość (Babylon Z) */
    readonly yGizmo: any;
    /** CAD Z — wysokość / góra (Babylon Y) */
    readonly zGizmo: any;

    private readonly _utilityLayer: any;

    constructor(scene: any) {
        this._utilityLayer = new BABYLON.UtilityLayerRenderer(scene);

        this.xGizmo = new BABYLON.AxisDragGizmo(
            new BABYLON.Vector3(1, 0, 0),
            new BABYLON.Color3(0.92, 0.12, 0.12),
            this._utilityLayer,
        );
        this.yGizmo = new BABYLON.AxisDragGizmo(
            new BABYLON.Vector3(0, 0, 1),
            new BABYLON.Color3(0.12, 0.82, 0.18),
            this._utilityLayer,
        );
        this.zGizmo = new BABYLON.AxisDragGizmo(
            new BABYLON.Vector3(0, 1, 0),
            new BABYLON.Color3(0.1, 0.45, 0.95),
            this._utilityLayer,
        );

        for (const g of [this.xGizmo, this.yGizmo, this.zGizmo]) {
            if (g) {
                g.updateGizmoRotationToMatchAttachedMesh = false;
                g.updateGizmoPositionToMatchAttachedMesh = true;
            }
        }
    }

    get attachedNode(): any {
        return this.xGizmo?.attachedNode ?? null;
    }

    set attachedNode(node: any) {
        for (const g of [this.xGizmo, this.yGizmo, this.zGizmo]) {
            if (g) {
                g.attachedNode = node;
            }
        }
    }

    onDragStart(handler: CadGizmoDragHandler): void {
        for (const g of [this.xGizmo, this.yGizmo, this.zGizmo]) {
            g?.dragBehavior?.onDragStartObservable?.add(handler);
        }
    }

    onDrag(handler: CadGizmoDragHandler): void {
        for (const g of [this.xGizmo, this.yGizmo, this.zGizmo]) {
            g?.dragBehavior?.onDragObservable?.add(handler);
        }
    }

    onDragEnd(handler: CadGizmoDragHandler): void {
        for (const g of [this.xGizmo, this.yGizmo, this.zGizmo]) {
            g?.dragBehavior?.onDragEndObservable?.add(handler);
        }
    }

    setEnabled(enabled: boolean): void {
        for (const g of [this.xGizmo, this.yGizmo, this.zGizmo]) {
            if (g) {
                g.isEnabled = enabled;
            }
        }
    }

    dispose(): void {
        for (const g of [this.xGizmo, this.yGizmo, this.zGizmo]) {
            g?.dispose?.();
        }
        this._utilityLayer?.dispose?.();
    }
}
