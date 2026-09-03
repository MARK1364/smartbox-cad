/**
 * PMI Measure Tool — lekka miarka.
 *
 * Bez Ctrl + krawędź     → od razu długość krawędzi (1 klik)
 * Bez Ctrl + punkt       → dwa kliknięcia, dystans
 * Ctrl + krawędź × 2   → połączone: suma długości; oddzielone: dystans
 * Ctrl + inne elementy   → najkrótsza droga (narożnik / płaszczyzna / krawędź)
 */

declare const BABYLON: any;

import { BaseState } from '../A1_core/interaction/states/base-state';
import { Intent } from '../A1_core/interaction/interaction-types';
import { BootstrapContext } from '../A1_core/scene-bootstrap';
import { StateMachine } from '../A1_core/interaction/state-machine';
import { UIController } from '../A1_core/ui-controller';
import { Vec3, v3Len, v3Sub } from './dimension-solver';
import { PMIStore, PMIMeasurementInit } from './pmi-data';
import { PMIRenderer } from './pmi-renderer';
import { AddMeasurementCommand, executePMICommand, deleteActiveDimension } from './pmi-commands';
import {
    PMIAnchorRef,
    buildAnchorRef,
    freeAnchorRef,
} from './pmi-id-bridge';
import { PMIGeometryHighlighter } from './pmi-geometry-highlight.js';
import { setSelectionHighlightSuppressed } from '../A1_core/selection-highlight.js';
import {
    MeasureElementPick,
    findMeasureElementPick,
} from './pmi-measure-pick';
import {
    MeasureElement,
    measureTwoEdges,
    projectMeasureElements,
} from './pmi-measure';

export class MeasureTool extends BaseState {
    private renderer: PMIRenderer;
    private phase: 'PICK_P1' | 'PICK_P2' = 'PICK_P1';
    private pick1: MeasureElementPick | null = null;
    private isCtrlPressed = false;
    private geometryHighlighter: PMIGeometryHighlighter | null = null;
    private facePickerWasEnabled = true;
    private pointerObserver: any = null;
    private keyboardObserver: any = null;
    private lastClickTime = 0;
    private static readonly DOUBLE_CLICK_MS = 350;

    constructor(ctx: BootstrapContext, stateMachine: StateMachine, renderer: PMIRenderer) {
        super(ctx, stateMachine);
        this.renderer = renderer;
    }

    public onEnter(): void {
        this.resetPicks();
        this.setUIStatus('Pomiar: kliknij krawędź (długość) lub punkt. Ctrl = punkt / krawędź / płaszczyzna.');

        const scene = this.ctx.viewport.scene;
        this.geometryHighlighter = new PMIGeometryHighlighter(scene);

        if (this.ctx.facePicker) {
            this.facePickerWasEnabled = this.ctx.facePicker.enabled;
            this.ctx.facePicker.enabled = false;
            this.ctx.facePicker.resetAllFaceHighlights();
        }
        setSelectionHighlightSuppressed(true, this.ctx);

        this.pointerObserver = scene.onPointerObservable.add((info: any) => {
            if (info.event) this.isCtrlPressed = !!info.event.ctrlKey;
            if (info.type === BABYLON.PointerEventTypes.POINTERMOVE) this.onMove();
        });
        this.keyboardObserver = scene.onKeyboardObservable.add((info: any) => {
            const event = info.event as KeyboardEvent;
            this.isCtrlPressed = !!event.ctrlKey;
        });

        if (this.ctx.viewport) this.ctx.viewport.suppressDoubleTapZoom = true;
        if (this.ctx.canvas) this.ctx.canvas.style.cursor = 'crosshair';
    }

    public onExit(): void {
        this.renderer.clearMeasurePreview();
        this.geometryHighlighter?.dispose();
        this.geometryHighlighter = null;
        setSelectionHighlightSuppressed(false, this.ctx);
        if (this.ctx.facePicker) this.ctx.facePicker.enabled = this.facePickerWasEnabled;

        const scene = this.ctx.viewport.scene;
        if (this.pointerObserver) scene.onPointerObservable.remove(this.pointerObserver);
        if (this.keyboardObserver) scene.onKeyboardObservable.remove(this.keyboardObserver);
        this.pointerObserver = null;
        this.keyboardObserver = null;
        this.pick1 = null;
        this.setUIStatus('Gotowy');
        if (this.ctx.viewport) this.ctx.viewport.suppressDoubleTapZoom = false;
        if (this.ctx.canvas) this.ctx.canvas.style.cursor = 'default';
    }

    public onSelect(intent: Intent): void {
        if (intent.pointerInfo?.event) this.isCtrlPressed = !!intent.pointerInfo.event.ctrlKey;
        this.onLeftClick();
    }

    public onContextMenu(intent: Intent): void {
        this.onCancel(intent);
    }

    public onCancel(_intent: Intent): void {
        this.renderer.clearMeasurePreview();
        if (this.phase === 'PICK_P2') {
            this.resetPicks();
            this.setUIStatus('Pomiar: kliknij krawędź (długość) lub punkt. Ctrl = punkt / krawędź / płaszczyzna.');
        } else {
            this.exitTool();
        }
    }

    private exitTool(): void {
        this.resetPicks();
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    public onDelete(_intent: Intent): void {
        deleteActiveDimension();
    }

    private resetPicks(): void {
        this.phase = 'PICK_P1';
        this.pick1 = null;
        this.renderer.clearMeasurePreview();
    }

    private onMove(): void {
        const scene = this.ctx.viewport.scene;
        if (!scene) return;

        if (this.geometryHighlighter) {
            this.geometryHighlighter.update(scene.pointerX, scene.pointerY);
        }

        const snap = this.findElementPick();

        if (this.phase === 'PICK_P1') {
            if (!this.isCtrlPressed && snap?.edge) {
                this.geometryHighlighter?.showEdgeOverlays([snap.edge]);
                this.renderer.renderMeasurePreview([snap.edge.p1World, snap.edge.p2World]);
                return;
            }
            this.renderer.clearMeasurePreview();
            return;
        }

        if (!this.pick1 || !snap) return;

        if (this.pick1.kind === 'edge' && snap.kind === 'edge' && this.pick1.edge && snap.edge) {
            const result = measureTwoEdges(
                this.pick1.edge.p1World,
                this.pick1.edge.p2World,
                snap.edge.p1World,
                snap.edge.p2World,
            );
            this.geometryHighlighter?.showEdgeOverlays([this.pick1.edge, snap.edge]);
            this.renderer.renderMeasurePreview(result.path);
            return;
        }

        const projected = projectMeasureElements(toElement(this.pick1), toElement(snap));
        this.renderer.renderMeasurePreview([projected.p1, projected.p2]);
    }

    private onLeftClick(): void {
        const now = Date.now();
        if (now - this.lastClickTime < MeasureTool.DOUBLE_CLICK_MS) {
            this.lastClickTime = 0;
            this.exitTool();
            return;
        }
        this.lastClickTime = now;

        const snap = this.findElementPick();
        if (!snap) return;

        // Bez Ctrl + krawędź → od razu długość
        if (!this.isCtrlPressed && snap.edge && this.phase === 'PICK_P1') {
            this.commitEdge(snap.edge);
            return;
        }

        if (this.phase === 'PICK_P1') {
            this.pick1 = snap;
            this.phase = 'PICK_P2';
            this.setUIStatus(this.statusForSecondPick(snap));
            return;
        }

        if (this.pick1?.kind === 'edge' && snap.kind === 'edge' && this.pick1.edge && snap.edge) {
            this.commitTwoEdges(this.pick1.edge, snap.edge);
            return;
        }

        this.commitElements(this.pick1!, snap);
    }

    private statusForSecondPick(first: MeasureElementPick): string {
        const names: Record<MeasureElementPick['kind'], string> = {
            point: 'punkt',
            vertex: 'narożnik',
            edge: 'krawędź',
            plane: 'płaszczyzna',
        };
        return `Ctrl: drugi element (${names[first.kind]} → punkt / krawędź / płaszczyzna).`;
    }

    private commitEdge(edge: NonNullable<MeasureElementPick['edge']>): void {
        executePMICommand(new AddMeasurementCommand(PMIStore.instance, {
            anchor1: buildAnchorRef(edge.mesh, edge.p1World, edge.p1Local, edge.index1),
            anchor2: buildAnchorRef(edge.mesh, edge.p2World, edge.p2Local, edge.index2),
        }));
        this.renderer.clearMeasurePreview();
        this.resetPicks();
        this.setUIStatus('Długość krawędzi zapisana. Kliknij kolejną krawędź lub punkt.');
    }

    private commitTwoEdges(
        e1: NonNullable<MeasureElementPick['edge']>,
        e2: NonNullable<MeasureElementPick['edge']>,
    ): void {
        const result = measureTwoEdges(e1.p1World, e1.p2World, e2.p1World, e2.p2World);
        const path = result.path;
        const start = path[0];
        const end = path[path.length - 1];

        const init: PMIMeasurementInit = {
            anchor1: reanchorAt(e1.mesh, start),
            anchor2: reanchorAt(e2.mesh, end),
        };

        if (result.mode === 'chain' && result.junction) {
            init.viaAnchor = freeAnchorRef(result.junction);
        }

        executePMICommand(new AddMeasurementCommand(PMIStore.instance, init));
        this.renderer.clearMeasurePreview();
        this.resetPicks();
        this.setUIStatus(
            result.mode === 'chain'
                ? 'Suma połączonych krawędzi zapisana.'
                : 'Dystans między krawędziami zapisany.',
        );
    }

    private commitElements(raw1: MeasureElementPick, raw2: MeasureElementPick): void {
        const projected = projectMeasureElements(toElement(raw1), toElement(raw2));
        const a = reanchorPick(raw1, projected.p1);
        const b = reanchorPick(raw2, projected.p2);

        if (v3Len(v3Sub(b.worldPos, a.worldPos)) < 0.05) {
            this.setUIStatus('Punkty zbyt blisko — wskaż drugi element.');
            return;
        }

        executePMICommand(new AddMeasurementCommand(PMIStore.instance, {
            anchor1: a.anchor,
            anchor2: b.anchor,
        }));

        this.renderer.clearMeasurePreview();
        this.resetPicks();
        this.setUIStatus('Pomiar dodany.');
    }

    private findElementPick(): MeasureElementPick | null {
        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const store = PMIStore.instance;
        if (this.geometryHighlighter) {
            this.geometryHighlighter.update(scene.pointerX, scene.pointerY);
        }

        return findMeasureElementPick({
            scene,
            pointerX: scene.pointerX,
            pointerY: scene.pointerY,
            ctrl: this.isCtrlPressed,
            vertexSnapPx: store.vertexSnapPx,
            edgeSnapPx: store.edgeSnapPx,
            lastDetection: this.geometryHighlighter?.lastDetection ?? null,
        });
    }

    private setUIStatus(text: string): void {
        if (UIController.instance && typeof UIController.instance.setStatus === 'function') {
            UIController.instance.setStatus(text);
        }
    }
}

function toElement(pick: MeasureElementPick): MeasureElement {
    return {
        kind: pick.kind,
        worldPos: pick.worldPos,
        edgeA: pick.edge?.p1World ?? null,
        edgeB: pick.edge?.p2World ?? null,
        planeOrigin: pick.kind === 'plane' ? pick.worldPos : null,
        planeNormal: pick.planeNormal,
    };
}

function reanchorPick(pick: MeasureElementPick, worldPos: Vec3): MeasureElementPick {
    return {
        ...pick,
        worldPos,
        anchor: pick.mesh ? buildAnchorRef(pick.mesh, worldPos) : freeAnchorRef(worldPos),
    };
}

function reanchorAt(mesh: any, worldPos: Vec3): PMIAnchorRef {
    return mesh ? buildAnchorRef(mesh, worldPos) : freeAnchorRef(worldPos);
}
