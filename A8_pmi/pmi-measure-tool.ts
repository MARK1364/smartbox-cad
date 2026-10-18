/**
 * PMI Measure Tool — lekka miarka.
 *
 * Bez Ctrl + krawędź     → od razu długość krawędzi (1 klik, single)
 * Multi (2 elementy)     → ZAWSZE z Ctrl przy drugim kliku:
 *   klik P1, potem Ctrl+P2  — albo Ctrl+P1 i Ctrl+P2
 * Ctrl + krawędź × 2     → połączone: suma; oddzielone: dystans
 * Ctrl + inne elementy   → najkrótsza droga (narożnik / płaszczyzna / krawędź)
 */

declare const BABYLON: any;

import { BaseState } from '../A1_core/interaction/states/base-state';
import { Intent } from '../A1_core/interaction/interaction-types';
import type { CadModuleContext } from '../A1_core/cad-module-context.js';
import { StateMachine } from '../A1_core/interaction/state-machine';
import { UIController } from '../A1_core/ui-controller';
import { TooltipManager } from '../A1_core/tooltip-manager.js';
import { tx } from '../T1_tlumaczenia/core.js';
import pmiTekst from './pmi_tekst.json';
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

    constructor(ctx: CadModuleContext, stateMachine: StateMachine, renderer: PMIRenderer) {
        super(ctx, stateMachine);
        this.renderer = renderer;
    }

    private static isMultiKey(e: { ctrlKey?: boolean; metaKey?: boolean; key?: string }): boolean {
        return !!(e.ctrlKey || e.metaKey || e.key === 'Control' || e.key === 'Meta');
    }

    private handleWindowKeyDown = (e: KeyboardEvent) => {
        if (MeasureTool.isMultiKey(e)) {
            this.isCtrlPressed = true;
            this.onMove();
        }
    };

    private handleWindowKeyUp = (e: KeyboardEvent) => {
        if (!e.ctrlKey && !e.metaKey) {
            this.isCtrlPressed = false;
            this.onMove();
        }
    };

    private handleWindowBlur = () => {
        this.isCtrlPressed = false;
    };

    public onEnter(): void {
        this.resetPicks();
        this.setUIStatus(tx(pmiTekst, 'hints.measure_step1_desc', 'pmi'));

        const scene = this.ctx.viewport.scene;
        this.geometryHighlighter = new PMIGeometryHighlighter(scene);

        if (this.ctx.facePicker) {
            this.facePickerWasEnabled = this.ctx.facePicker.enabled;
            this.ctx.facePicker.enabled = false;
            this.ctx.facePicker.resetAllFaceHighlights();
        }
        setSelectionHighlightSuppressed(true, this.ctx);

        this.pointerObserver = scene.onPointerObservable.add((info: any) => {
            // Śledź Ctrl tylko przy MOVE — przy POINTERDOWN isCtrlPressed
            // jest już ustawiony przez onSelect() z intent.pointerInfo.event.ctrlKey.
            if (info.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                if (info.event) {
                    this.isCtrlPressed = !!(info.event.ctrlKey || info.event.metaKey);
                }
                this.onMove();
            }
        });
        this.keyboardObserver = scene.onKeyboardObservable.add((info: any) => {
            const event = info.event as KeyboardEvent;
            this.isCtrlPressed = !!(event.ctrlKey || event.metaKey);
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this.handleWindowKeyDown);
            window.addEventListener('keyup', this.handleWindowKeyUp);
            window.addEventListener('blur', this.handleWindowBlur);
        }

        if (this.ctx.viewport) this.ctx.viewport.suppressDoubleTapZoom = true;
        if (this.ctx.canvas) this.ctx.canvas.style.cursor = 'crosshair';
    }

    public onExit(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', this.handleWindowKeyDown);
            window.removeEventListener('keyup', this.handleWindowKeyUp);
            window.removeEventListener('blur', this.handleWindowBlur);
        }

        this.renderer.clearMeasurePreview();
        PMIStore.instance.clearAllMeasurements();
        TooltipManager.instance?.clearActiveHint();
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
        if (intent.pointerInfo?.event) {
            const ev = intent.pointerInfo.event;
            this.isCtrlPressed = !!(ev.ctrlKey || ev.metaKey);
        }
        this.onLeftClick();
    }

    public onContextMenu(intent: Intent): void {
        this.onCancel(intent);
    }

    public onCancel(_intent: Intent): void {
        this.renderer.clearMeasurePreview();
        if (this.phase === 'PICK_P2') {
            this.resetPicks();
            this.setUIStatus('Szybki pomiar: kliknij krawędź formatki (długość) lub wskaż punkty/elementy.');
        } else {
            TooltipManager.instance?.clearActiveHint();
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
        this.updateHint();
    }

    private updateHint(): void {
        const tm = TooltipManager.instance;
        if (!tm) return;

        if (this.phase === 'PICK_P1') {
            tm.setActiveHint({
                id: 'pmi_measure_step1',
                title: tx(pmiTekst, 'hints.measure_step1_title', 'pmi'),
                description: tx(pmiTekst, 'hints.measure_step1_desc', 'pmi'),
                confirmKey: 'LPM',
                cancelKey: 'Esc',
            });
        } else {
            tm.setActiveHint({
                id: 'pmi_measure_step2',
                title: tx(pmiTekst, 'hints.measure_step2_title', 'pmi'),
                description: tx(pmiTekst, 'hints.measure_step2_desc', 'pmi'),
                confirmKey: 'LPM',
                cancelKey: 'Esc',
            });
        }
    }

    private onMove(): void {
        const scene = this.ctx.viewport.scene;
        if (!scene) return;

        if (this.geometryHighlighter) {
            this.geometryHighlighter.update(scene.pointerX, scene.pointerY);
        }

        const snap = this.findElementPick(false);

        if (this.phase === 'PICK_P1') {
            const hasExisting = PMIStore.instance.measurements.length > 0;
            if (!this.isCtrlPressed && snap?.kind === 'edge' && snap.edge) {
                this.geometryHighlighter?.showEdgeOverlays([snap.edge]);
                if (!hasExisting) {
                    this.renderer.renderMeasurePreview([snap.edge.p1World, snap.edge.p2World]);
                } else {
                    this.renderer.clearMeasurePreview();
                }
                this.ctx.viewport?.requestRender?.(2);
                return;
            }
            this.renderer.clearMeasurePreview();
            this.ctx.viewport?.requestRender?.(2);
            return;
        }

        // PICK_P2: podgląd dystansu tylko przy Ctrl (multi zawsze z Ctrl)
        if (!this.isCtrlPressed || !this.pick1 || !snap) {
            this.renderer.clearMeasurePreview();
            this.ctx.viewport?.requestRender?.(2);
            return;
        }

        if (this.pick1.kind === 'edge' && snap.kind === 'edge' && this.pick1.edge && snap.edge) {
            const result = measureTwoEdges(
                this.pick1.edge.p1World,
                this.pick1.edge.p2World,
                snap.edge.p1World,
                snap.edge.p2World,
            );
            this.geometryHighlighter?.showEdgeOverlays([this.pick1.edge, snap.edge]);
            this.renderer.renderMeasurePreview(result.path);
            this.ctx.viewport?.requestRender?.(2);
            return;
        }

        const projected = projectMeasureElements(toElement(this.pick1), toElement(snap));
        this.renderer.renderMeasurePreview([projected.p1, projected.p2]);
        this.ctx.viewport?.requestRender?.(2);
    }

    private onLeftClick(): void {
        const now = Date.now();
        if (now - this.lastClickTime < MeasureTool.DOUBLE_CLICK_MS) {
            this.lastClickTime = 0;
            this.exitTool();
            return;
        }
        this.lastClickTime = now;

        const snap = this.findElementPick(true);
        if (!snap) return;

        // Bez Ctrl + krawędź w fazie PICK_P1 → od razu zmierz krawędź, ale zapamiętaj jako pick1 dla opcjonalnego Ctrl+P2
        if (this.phase === 'PICK_P1' && !this.isCtrlPressed && snap.kind === 'edge' && snap.edge) {
            this.commitEdge(snap.edge);
            this.pick1 = snap;
            this.phase = 'PICK_P2';
            this.updateHint();
            this.setUIStatus('Długość krawędzi zmierzona. Wskaż kolejny element lub wciśnij Esc.');
            return;
        }

        if (this.phase === 'PICK_P1') {
            this.pick1 = snap;
            this.phase = 'PICK_P2';
            this.updateHint();
            this.setUIStatus(this.statusForSecondPick(snap));
            this.onMove();
            return;
        }

        // Faza PICK_P2:
        // Przy wciśniętym Ctrl: domykamy multi-pomiar (Element 1 -> Element 2)
        if (this.isCtrlPressed) {
            if (this.pick1?.kind === 'edge' && snap.kind === 'edge' && this.pick1.edge && snap.edge) {
                this.commitTwoEdges(this.pick1.edge, snap.edge);
                return;
            }
            this.commitElements(this.pick1!, snap);
            return;
        }

        // Bez Ctrl w fazie PICK_P2:
        // Jeśli kliknięto nową krawędź bez Ctrl → zmierz tę nową krawędź i ustaw jako pick1
        if (snap.kind === 'edge' && snap.edge) {
            this.commitEdge(snap.edge);
            this.pick1 = snap;
            this.phase = 'PICK_P2';
            this.updateHint();
            this.setUIStatus('Długość krawędzi zmierzona. Wskaż kolejny element lub wciśnij Esc.');
            return;
        }

        // Dwa wierzchołki bez Ctrl również domykają odcinek punkt-punkt
        if (this.pick1?.kind === 'vertex' && snap.kind === 'vertex') {
            this.commitElements(this.pick1, snap);
            return;
        }

        // W przeciwnym razie zmiana pierwszego elementu
        this.pick1 = snap;
        this.phase = 'PICK_P2';
        this.updateHint();
        this.renderer.clearMeasurePreview();
        this.setUIStatus(this.statusForSecondPick(snap));
    }

    private findElementPick(updateHighlighter = false): MeasureElementPick | null {
        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const store = PMIStore.instance;
        if (updateHighlighter && this.geometryHighlighter) {
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
            hoveredSegment: this.geometryHighlighter?.currentHoveredSegment ?? null,
        });
    }

    private statusForSecondPick(first: MeasureElementPick): string {
        const names: Record<MeasureElementPick['kind'], string> = {
            point: 'punkt',
            vertex: 'narożnik',
            edge: 'krawędź',
            plane: 'płaszczyzna',
        };
        return `Wskaż drugi element (${names[first.kind]} → …). Kliknij LPM lub przytrzymaj Ctrl.`;
    }

    private commitEdge(edge: NonNullable<MeasureElementPick['edge']>): void {
        PMIStore.instance.clearAllMeasurements();
        executePMICommand(new AddMeasurementCommand(PMIStore.instance, {
            anchor1: buildAnchorRef(edge.mesh, edge.p1World, edge.p1Local, edge.index1),
            anchor2: buildAnchorRef(edge.mesh, edge.p2World, edge.p2Local, edge.index2),
        }));
        this.renderer.clearMeasurePreview();
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

        PMIStore.instance.clearAllMeasurements();
        executePMICommand(new AddMeasurementCommand(PMIStore.instance, init));
        this.renderer.clearMeasurePreview();
        this.resetPicks();
        this.setUIStatus(
            result.mode === 'chain'
                ? 'Suma połączonych krawędzi (szybki podgląd).'
                : 'Dystans między krawędziami (szybki podgląd).',
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

        PMIStore.instance.clearAllMeasurements();
        executePMICommand(new AddMeasurementCommand(PMIStore.instance, {
            anchor1: a.anchor,
            anchor2: b.anchor,
        }));

        this.renderer.clearMeasurePreview();
        this.resetPicks();
        this.setUIStatus('Pomiar (szybki podgląd).');
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
