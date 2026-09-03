/**
 * PMI Dimension Tool — TypeScript / Babylon.js
 *
 * Narzędzie interaktywne do wymiarowania CAD.
 *
 * Wspiera 2 tryby pracy:
 * 1. KLIKNIĘCIE KRAWĘDZI (Edge-based):
 *    Kliknięcie w krawędź formatki (lub blisko brzegu ściany) natychmiast
 *    ustala oba punkty odcinka (p1, p2) i przechodzi do przeciągania
 *    odsunięcia (DRAG_OFFSET). Ruch myszy wyciąga linię wymiarową i pomocnicze!
 *    LMB zatwierdza wymiar na scenie.
 *    W fazie odsunięcia widać jednocześnie osie GLOBAL (ciągłe) i LOCAL
 *    (przerywane). Kierunek wybiera się najazdem na prowadnicę.
 *
 * 2. KLIKNIĘCIE PUNKT-DO-PUNKTU (Point-to-point):
 *    Kliknięcie w wierzchołek lub punkt ściany -> wybór punktu 1 -> wybór punktu 2
 *    -> przeciągnięcie odsunięcia -> LMB zatwierdza.
 *
 * SKRÓTY (odpowiednik modalu z `pmi_tool_base.py`):
 *   X / Y / Z              — wymuszenie osi odsunięcia
 *   Shift + X / Y / Z      — zablokowanie osi pomiaru
 *   Enter / LMB            — zatwierdzenie
 *   Esc / RMB              — krok wstecz, a z pustego stanu wyjście z narzędzia
 */

declare const BABYLON: any;

import { BaseState } from '../A1_core/interaction/states/base-state';
import { Intent } from '../A1_core/interaction/interaction-types';
import { BootstrapContext } from '../A1_core/scene-bootstrap';
import { StateMachine } from '../A1_core/interaction/state-machine';
import { Vec3, v3, v3Copy, v3Sub, v3Normalize, v3Len } from './dimension-solver';
import { getRenderData, resolveMeasureAxis } from './pmi-bridge';
import { axisVectorWorld, beginOffsetDragState, computeOffsetFromPointer } from './pmi-drag';
import { PMIAxisGuides, axisGuideOrigin, buildOffsetGuideCandidates, estimateGuideLength, guideCandidateId } from './pmi-axis-guides.js';
import { pickOffsetGuide, createWorldToScreen } from './pmi-axis-guide-pick.js';
import { PMIStore, formatDistance, AxisSpace, MeasureAxisKey } from './pmi-data';
import { PMIRenderer } from './pmi-renderer';
import { AddDimensionCommand, executePMICommand, deleteActiveDimension } from './pmi-commands';
import {
    PMIAnchorRef,
    buildAnchorRef,
    directionToLocal,
    freeAnchorRef,
    getWorldMatrixArray,
    meshLocalToRootLocal,
    snapToNearestEdgeEndpoint,
    snapWorldPointToPanelGeometry,
    tryBuildEdgeAnchorsFromRootPoints,
} from './pmi-id-bridge';
import { storeOffsetFromWorld } from './pmi-resolve';
import { UIController } from '../A1_core/ui-controller';
import { DetectionResult, GeometryType } from '../A1_core/geometry-detector.js';
import { PMIGeometryHighlighter } from './pmi-geometry-highlight.js';
import { setSelectionHighlightSuppressed } from '../A1_core/selection-highlight.js';
import { findEdgeSegmentsNearPointer, findVerticesNearPointer } from './pmi-edge-pick.js';

// ============================================================================
// TYPES
// ============================================================================

type ToolPhase = 'PICK_P1' | 'PICK_P2' | 'DRAG_OFFSET';

interface PickPoint {
    worldPos: Vec3;
    anchor: PMIAnchorRef;
    edgeDirWorld: Vec3 | null;
    faceNormalWorld: Vec3 | null;
    meshMatrix: number[] | null;
}

interface DetectedEdge {
    p1: PickPoint;
    p2: PickPoint;
}

const AXIS_KEYS = ['X', 'Y', 'Z'] as const;

// ============================================================================
// DIMENSION TOOL
// ============================================================================

export class DimensionTool extends BaseState {
    private phase: ToolPhase = 'PICK_P1';
    private renderer: PMIRenderer;

    private pick1: PickPoint | null = null;
    private pick2: PickPoint | null = null;
    private currentOffset: Vec3 = v3(0, 0, 0);
    private currentAxisSpace: AxisSpace = 'GLOBAL';
    private currentMeasureAxisKey: MeasureAxisKey = 'AUTO';
    private currentOffsetAxisKey: string = '';
    private stickyGuideId: string | null = null;

    /** Kotwica drag offsetu (odpowiednik `_drag_start_hit_world` / `_free_drag_bias_world`). */
    private dragStartHitWorld: Vec3 | null = null;
    private dragStartOffsetWorld: Vec3 = v3(0, 0, 0);
    private freeDragBiasWorld: Vec3 = v3(0, 0, 0);

    /** Czy oś pomiaru została wskazana ręcznie (Shift+X/Y/Z) — blokuje autodetekcję. */
    private measureAxisLocked = false;

    private lastClickTime = 0;
    private static readonly DOUBLE_CLICK_MS = 350;

    /** Ctrl = precyzyjny wybór narożnika / krawędzi / płaszczyzny (jak w Blenderze). */
    private isCtrlPressed = false;

    private geometryHighlighter: PMIGeometryHighlighter | null = null;
    private facePickerWasEnabled = true;

    // Babylon observers
    private pointerObserver: any = null;
    private keyboardObserver: any = null;

    // Visual snap indicator & live preview
    private liveGuideLine: any = null;
    private axisGuides: PMIAxisGuides | null = null;

    constructor(ctx: BootstrapContext, stateMachine: StateMachine, renderer: PMIRenderer) {
        super(ctx, stateMachine);
        this.renderer = renderer;
    }

    // ========================================================================
    // STATE LIFECYCLE
    // ========================================================================

    public onEnter(): void {
        console.log('[DimensionTool] Aktywacja narzędzia wymiarowania');

        const store = PMIStore.instance;
        this.currentAxisSpace = store.toolAxisSpace === 'ALIGNED' ? 'ALIGNED' : 'GLOBAL';
        this.currentMeasureAxisKey = store.toolMeasureAxis;
        this.measureAxisLocked = store.toolMeasureAxis !== 'AUTO';
        this.resetPicks();

        this.setUIStatus('Wymiarowanie: krawędź (1 klik) lub punkt 1. Ctrl = narożnik/krawędź/płaszczyzna.');

        const scene = this.ctx.viewport.scene;
        this.geometryHighlighter = new PMIGeometryHighlighter(scene);

        if (this.ctx.facePicker) {
            this.facePickerWasEnabled = this.ctx.facePicker.enabled;
            this.ctx.facePicker.enabled = false;
            this.ctx.facePicker.resetAllFaceHighlights();
        }
        setSelectionHighlightSuppressed(true, this.ctx);

        // Rejestracja wyłącznie POINTERMOVE do płynnego śledzenia kursora i podglądu na żywo
        this.pointerObserver = scene.onPointerObservable.add((pointerInfo: any) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                this.onPointerMove();
            }
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                this.isCtrlPressed = !!pointerInfo.event?.ctrlKey;
            }
        });

        this.keyboardObserver = scene.onKeyboardObservable.add((keyboardInfo: any) => {
            const event = keyboardInfo.event as KeyboardEvent;
            if (keyboardInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.isCtrlPressed = !!event.ctrlKey;
                this.onKeyDown(event);
            } else if (keyboardInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
                this.isCtrlPressed = !!event.ctrlKey;
            }
        });

        if (this.ctx.viewport) this.ctx.viewport.suppressDoubleTapZoom = true;
        if (this.ctx.canvas) {
            this.ctx.canvas.style.cursor = 'crosshair';
        }
    }

    public onExit(): void {
        console.log('[DimensionTool] Dezaktywacja narzędzia wymiarowania');

        const scene = this.ctx.viewport.scene;
        if (this.pointerObserver) {
            scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }
        if (this.keyboardObserver) {
            scene.onKeyboardObservable.remove(this.keyboardObserver);
            this.keyboardObserver = null;
        }

        this.geometryHighlighter?.dispose();
        this.geometryHighlighter = null;
        this.disposeAxisGuides();

        setSelectionHighlightSuppressed(false, this.ctx);

        if (this.ctx.facePicker) {
            this.ctx.facePicker.enabled = this.facePickerWasEnabled;
        }

        this.disposeLiveGuideLine();
        this.renderer.clearPreview();

        this.setUIStatus('Gotowy');
        this.syncToolLiveState('idle');

        if (this.ctx.viewport) this.ctx.viewport.suppressDoubleTapZoom = false;
        if (this.ctx.canvas) {
            this.ctx.canvas.style.cursor = 'default';
        }
    }

    private resetPicks(): void {
        this.phase = 'PICK_P1';
        this.pick1 = null;
        this.pick2 = null;
        this.currentOffset = v3(0, 0, 0);
        this.currentOffsetAxisKey = '';
        this.stickyGuideId = null;
        if (this.currentAxisSpace !== 'ALIGNED') this.currentAxisSpace = 'GLOBAL';
        this.disposeAxisGuides();
        this.syncToolLiveState('PICK_P1');
    }

    private syncToolLiveState(phase?: ToolPhase | 'idle'): void {
        const store = PMIStore.instance;
        store.toolLivePhase = phase ?? this.phase;
        store.toolLiveOffsetAxis = this.currentOffsetAxisKey;
        store.toolLiveOffsetSpace = this.currentOffsetAxisKey
            ? (this.currentAxisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL')
            : '';
        store.notifyToolLiveChanged();
    }

    // ========================================================================
    // INTENT HANDLING
    // ========================================================================

    public onSelect(_intent: Intent): void {
        this.onLeftClick();
    }

    public onContextMenu(intent: Intent): void {
        this.onCancel(intent);
    }

    public onCancel(_intent: Intent): void {
        this.renderer.clearPreview();
        this.disposeLiveGuideLine();

        if (this.phase === 'DRAG_OFFSET' || this.phase === 'PICK_P2') {
            this.resetPicks();
            this.setUIStatus('Wymiarowanie: krawędź (1 klik) lub punkt 1. Ctrl = narożnik/krawędź/płaszczyzna.');
        } else {
            this.stateMachine.changeState('SELECTION_TOOL');
        }
    }

    public onConfirm(_intent: Intent): void {
        if (this.phase === 'DRAG_OFFSET') {
            this.commitDimension();
        }
    }

    public onDelete(_intent: Intent): void {
        deleteActiveDimension();
    }

    // ========================================================================
    // KEYBOARD — osie odsunięcia i pomiaru
    // ========================================================================

    private onKeyDown(event: KeyboardEvent): void {
        const key = (event.key || '').toUpperCase();
        if (!AXIS_KEYS.includes(key as typeof AXIS_KEYS[number])) return;

        event.preventDefault?.();

        if (event.shiftKey) {
            // Shift+oś: zablokowanie osi pomiaru; ponowne wciśnięcie zdejmuje blokadę.
            if (this.measureAxisLocked && this.currentMeasureAxisKey === key) {
                this.measureAxisLocked = false;
                this.currentMeasureAxisKey = 'AUTO';
                this.setUIStatus('Oś pomiaru: automatyczna');
            } else {
                this.measureAxisLocked = true;
                this.currentMeasureAxisKey = key as MeasureAxisKey;
                this.setUIStatus(`Oś pomiaru zablokowana: ${key}`);
            }
        } else {
            // Sama oś: wymuszenie kierunku odsunięcia w aktualnie aktywnej ramie (G lub L).
            if (this.currentOffsetAxisKey === key && this.stickyGuideId) {
                this.currentOffsetAxisKey = '';
                this.stickyGuideId = null;
                this.setUIStatus('Oś odsunięcia: automatyczna');
            } else {
                const space = this.currentAxisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL';
                this.currentAxisSpace = space;
                this.currentOffsetAxisKey = key;
                this.stickyGuideId = guideCandidateId(space, key);
                this.setUIStatus(`Oś odsunięcia: ${space === 'LOCAL' ? 'L' : 'G'}:${key}`);
            }
        }

        if (this.phase === 'DRAG_OFFSET') {
            this.updatePreview();
        }
        this.syncToolLiveState();
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    private onLeftClick(): void {
        const now = Date.now();
        if (now - this.lastClickTime < DimensionTool.DOUBLE_CLICK_MS) {
            this.lastClickTime = 0;
            this.renderer.clearPreview();
            this.disposeLiveGuideLine();
            this.resetPicks();
            this.stateMachine.changeState('SELECTION_TOOL');
            return;
        }
        this.lastClickTime = now;

        if (this.phase === 'DRAG_OFFSET') {
            // Drugie kliknięcie: zatwierdzenie wyciągniętego wymiaru
            this.commitDimension();
            return;
        }

        if (this.phase === 'PICK_P1') {
            // Krawędź pod kursorem ma pierwszeństwo przed snapem do punktu — inaczej
            // klik obok linii uciekał do najbliższego narożnika ściany.
            if (!this.isCtrlPressed && !this.isVertexUnderCursor()) {
                const detectedEdge = this.findDetectedEdge();
                if (detectedEdge) {
                    this.pick1 = detectedEdge.p1;
                    this.pick2 = detectedEdge.p2;
                    this.beginOffsetDrag();
                    console.log('[DimensionTool] Wykryto krawędź -> Przejście do DRAG_OFFSET');
                    return;
                }
            }

            const snap = this.isCtrlPressed
                ? this.findStructuredSnapPoint()
                : this.findSnapPoint();
            if (snap) {
                this.pick1 = snap;
                this.phase = 'PICK_P2';
                this.syncToolLiveState();
                this.setUIStatus(this.isCtrlPressed
                    ? 'Ctrl: wybierz drugi element (narożnik / krawędź / płaszczyzna)'
                    : 'Wymiarowanie: Wskaż punkt 2 (LMB)');
                return;
            }

            if (this.isCtrlPressed) {
                this.setUIStatus('Ctrl: wskaż narożnik, krawędź OCCT lub ścianę formatki');
            } else {
                this.setUIStatus('Wymiarowanie: wskaż punkt 1 (potem możesz wcisnąć Ctrl do multiwyboru)');
            }
            return;
        }

        if (this.phase === 'PICK_P2') {
            const snap = this.isCtrlPressed
                ? this.findStructuredSnapPoint()
                : this.findSnapPoint();
            if (snap) {
                this.pick2 = snap;
                this.disposeLiveGuideLine();
                this.beginOffsetDrag();
            } else if (this.isCtrlPressed) {
                this.setUIStatus('Ctrl: wybierz drugi element (narożnik / krawędź / płaszczyzna)');
            }
        }
    }

    private beginOffsetDrag(): void {
        this.autoDetectAxis();
        this.phase = 'DRAG_OFFSET';
        this.syncToolLiveState();

        const scene = this.ctx.viewport.scene;
        if (this.pick1 && this.pick2 && scene) {
            const anchor = beginOffsetDragState(scene, this.pick1.worldPos, this.pick2.worldPos, v3(0, 0, 0));
            this.dragStartHitWorld = anchor.dragStartHitWorld;
            this.dragStartOffsetWorld = anchor.dragStartOffsetWorld;
            this.freeDragBiasWorld = anchor.freeDragBiasWorld;
            this.currentOffset = v3Copy(anchor.dragStartOffsetWorld);
        } else {
            this.dragStartHitWorld = null;
            this.dragStartOffsetWorld = v3(0, 0, 0);
            this.freeDragBiasWorld = v3(0, 0, 0);
            this.currentOffset = v3(0, 0, 0);
        }

        this.updateOffsetFromMouse();
        this.setUIStatus('Przesuń mysz wzdłuż linii ciągłej (GLOBAL) lub przerywanej (LOCAL). LMB zatwierdza, X/Y/Z: oś, Shift+X/Y/Z: pomiar, ESC: anuluj.');
    }

    private onPointerMove(): void {
        const scene = this.ctx.viewport.scene;
        if (scene && this.geometryHighlighter) {
            const detection = this.geometryHighlighter.update(scene.pointerX, scene.pointerY);
            this.updateHoverStatus(detection);
        }

        // 1. Podgląd linii od P1 do kursora w fazie PICK_P2
        if (this.phase === 'PICK_P2' && this.pick1) {
            const snap = this.isCtrlPressed
                ? this.findStructuredSnapPoint()
                : this.findSnapPoint();
            if (snap) this.updateLiveGuideLine(this.pick1.worldPos, snap.worldPos);
        }

        // 2. Dynamiczne wyciąganie wymiaru w fazie DRAG_OFFSET
        if (this.phase === 'DRAG_OFFSET' && this.pick1 && this.pick2) {
            this.updateOffsetFromMouse();
        }
    }

    private updateHoverStatus(detection: DetectionResult): void {
        if (this.phase === 'DRAG_OFFSET') return;

        if (!detection.hit) {
            if (this.phase === 'PICK_P1') {
                this.setUIStatus(this.isCtrlPressed
                    ? 'Ctrl: wskaż narożnik, krawędź lub płaszczyznę'
                    : 'Wymiarowanie: krawędź (1 klik) lub punkt 1. Ctrl = precyzyjny element.');
            } else if (this.phase === 'PICK_P2') {
                this.setUIStatus(this.isCtrlPressed
                    ? 'Ctrl: wybierz drugi element (narożnik / krawędź / płaszczyzna)'
                    : 'Wymiarowanie: Wskaż punkt 2 (LMB)');
            }
            return;
        }

        const label = PMIGeometryHighlighter.labelOf(detection.geometryType);
        if (this.phase === 'PICK_P1') {
            this.setUIStatus(`Wykryto: ${label} — kliknij LMB (punkt 1)`);
        } else if (this.phase === 'PICK_P2') {
            this.setUIStatus(`Wykryto: ${label} — kliknij LMB (punkt 2)`);
        }
    }

    /** Zamienia wynik detektora geometrii na punkt wymiarowania. */
    private pickPointFromDetection(result: DetectionResult): PickPoint | null {
        if (!result.hit || !result.mesh || !result.pickedPoint) return null;

        const fakeHit = {
            pickedMesh: result.mesh,
            pickedPoint: new BABYLON.Vector3(
                result.pickedPoint.x,
                result.pickedPoint.y,
                result.pickedPoint.z,
            ),
            getNormal: (useWorld?: boolean) => {
                if (!result.normal) return null;
                return new BABYLON.Vector3(result.normal.x, result.normal.y, result.normal.z);
            },
        };
        return this.createPickPointFromHit(fakeHit);
    }

    // ========================================================================
    // EDGE DETECTION (1-Click Edge Pull)
    // ========================================================================

    private distPointToSegment3D(pt: any, p1: any, p2: any): number {
        const v = p2.subtract(p1);
        const w = pt.subtract(p1);
        const c1 = BABYLON.Vector3.Dot(w, v);
        if (c1 <= 0) return BABYLON.Vector3.Distance(pt, p1);
        const c2 = BABYLON.Vector3.Dot(v, v);
        if (c2 <= c1) return BABYLON.Vector3.Distance(pt, p2);
        const b = c1 / c2;
        const pb = p1.add(v.scale(b));
        return BABYLON.Vector3.Distance(pt, pb);
    }

    private distPointToSegment2D(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const vx = x2 - x1;
        const vy = y2 - y1;
        const wx = px - x1;
        const wy = py - y1;
        const c1 = wx * vx + wy * vy;
        if (c1 <= 0) return Math.hypot(px - x1, py - y1);
        const c2 = vx * vx + vy * vy;
        if (c2 <= c1) return Math.hypot(px - x2, py - y2);
        const b = c1 / c2;
        const bx = x1 + b * vx;
        const by = y1 + b * vy;
        return Math.hypot(px - bx, py - by);
    }

    /**
     * Tolerancyjne pickowanie cienkiej podgeometrii (edge/vertex) w promieniu kilku px.
     * Stabilizuje klik, gdy krawędzie nakładają się ekranowo lub są bardzo cienkie.
     */
    private pickSubHitsWithTolerance(typeFilter: Array<'edge' | 'vertex'>, radiusPx: number): any[] {
        const scene = this.ctx.viewport.scene;
        if (!scene) return [];

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;
        const samples = [
            [0, 0],
            [radiusPx, 0], [-radiusPx, 0], [0, radiusPx], [0, -radiusPx],
            [Math.round(radiusPx * 0.7), Math.round(radiusPx * 0.7)],
            [Math.round(radiusPx * 0.7), -Math.round(radiusPx * 0.7)],
            [-Math.round(radiusPx * 0.7), Math.round(radiusPx * 0.7)],
            [-Math.round(radiusPx * 0.7), -Math.round(radiusPx * 0.7)],
        ];

        const bestByMesh = new Map<any, { hit: any; score: number }>();
        for (const [dx, dy] of samples) {
            const hits = scene.multiPick(
                pointerX + dx,
                pointerY + dy,
                (m: any) => m && m.isEnabled() && m.metadata && typeFilter.includes(m.metadata.type),
            );
            if (!hits || hits.length === 0) continue;

            for (const h of hits) {
                if (!h?.hit || !h?.pickedMesh) continue;
                const mesh = h.pickedMesh;
                // Lekko premiujemy próbki bliżej centrum kursora.
                const sampleDist = Math.hypot(dx, dy);
                const rayDist = Number.isFinite(h.distance) ? h.distance : 0;
                const score = sampleDist * 2 + rayDist;
                const curr = bestByMesh.get(mesh);
                if (!curr || score < curr.score) bestByMesh.set(mesh, { hit: h, score });
            }
        }

        return Array.from(bestByMesh.values())
            .sort((a, b) => a.score - b.score)
            .map((x) => x.hit);
    }

    /** Narożnik ma pierwszeństwo przed krawędzią tylko w swoim (mniejszym) promieniu. */
    private isVertexUnderCursor(): boolean {
        const scene = this.ctx.viewport.scene;
        const radiusPx = PMIStore.instance.vertexSnapPx;
        if (!scene || radiusPx <= 0) return false;
        return findVerticesNearPointer(scene, scene.pointerX, scene.pointerY, radiusPx).length > 0;
    }

    private findDetectedEdge(): DetectedEdge | null {
        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;

        // A. Krawędź fizyczna — wybór po odległości na ekranie. Działa też dla
        //    krawędzi leżących dokładnie na sobie (bierzemy bliższą kamerze).
        const edgeSnapPx = PMIStore.instance.edgeSnapPx;
        const edgeCandidates = findEdgeSegmentsNearPointer(
            scene,
            pointerX,
            pointerY,
            this.isCtrlPressed ? edgeSnapPx + 4 : edgeSnapPx,
        );

        if (edgeCandidates.length > 0) {
            const best = edgeCandidates[0];
            const mesh = best.mesh;
            const edgeDir = v3Normalize(v3Sub(best.p2World, best.p1World));
            const matArray = getWorldMatrixArray(mesh.parent || mesh);

            const d1 = v3Len(v3Sub(best.closestWorld, best.p1World));
            const d2 = v3Len(v3Sub(best.closestWorld, best.p2World));
            const nearFirst = d1 <= d2;

            const near = {
                worldPos: nearFirst ? best.p1World : best.p2World,
                anchor: buildAnchorRef(
                    mesh,
                    nearFirst ? best.p1World : best.p2World,
                    nearFirst ? best.p1Local : best.p2Local,
                    nearFirst ? best.index1 : best.index2,
                ),
                edgeDirWorld: edgeDir,
                faceNormalWorld: null,
                meshMatrix: matArray,
            };
            const far = {
                worldPos: nearFirst ? best.p2World : best.p1World,
                anchor: buildAnchorRef(
                    mesh,
                    nearFirst ? best.p2World : best.p1World,
                    nearFirst ? best.p2Local : best.p1Local,
                    nearFirst ? best.index2 : best.index1,
                ),
                edgeDirWorld: edgeDir,
                faceNormalWorld: null,
                meshMatrix: matArray,
            };

            return { p1: near, p2: far };
        }

        // B. Krawędź na ścianie formatki (Native Panel Face Plane)
        const faceHits = scene.multiPick(
            pointerX,
            pointerY,
            (m: any) => m && m.isEnabled() && m.metadata && m.metadata.faceName,
        );

        if (faceHits && faceHits.length > 0) {
            const valid = faceHits.filter((h: any) => h.hit && h.pickedMesh && h.pickedPoint);
            if (valid.length > 0) {
                type EdgeCandidate = {
                    hit: any;
                    mesh: any;
                    lp1: any;
                    lp2: any;
                    d3: number;
                    dPx: number;
                };
                let best: EdgeCandidate | null = null;

                for (const hit of valid) {
                    const mesh = hit.pickedMesh;
                    const hitWorld = hit.pickedPoint;
                    const boundingInfo = mesh.getBoundingInfo();
                    const bb = boundingInfo.boundingBox;
                    const min = bb.minimum;
                    const max = bb.maximum;
                    const spanX = max.x - min.x;
                    const spanY = max.y - min.y;
                    const spanZ = max.z - min.z;

                    const invMatrix = mesh.getWorldMatrix().clone().invert();
                    const localHit = BABYLON.Vector3.TransformCoordinates(hitWorld, invMatrix);

                    const candidateSegments: [any, any][] = [];
                    if (spanZ < 1.0) {
                        const z = (min.z + max.z) / 2;
                        candidateSegments.push([new BABYLON.Vector3(min.x, min.y, z), new BABYLON.Vector3(min.x, max.y, z)]);
                        candidateSegments.push([new BABYLON.Vector3(max.x, min.y, z), new BABYLON.Vector3(max.x, max.y, z)]);
                        candidateSegments.push([new BABYLON.Vector3(min.x, min.y, z), new BABYLON.Vector3(max.x, min.y, z)]);
                        candidateSegments.push([new BABYLON.Vector3(min.x, max.y, z), new BABYLON.Vector3(max.x, max.y, z)]);
                    } else if (spanX < 1.0) {
                        const x = (min.x + max.x) / 2;
                        candidateSegments.push([new BABYLON.Vector3(x, min.y, min.z), new BABYLON.Vector3(x, max.y, min.z)]);
                        candidateSegments.push([new BABYLON.Vector3(x, min.y, max.z), new BABYLON.Vector3(x, max.y, max.z)]);
                        candidateSegments.push([new BABYLON.Vector3(x, min.y, min.z), new BABYLON.Vector3(x, min.y, max.z)]);
                        candidateSegments.push([new BABYLON.Vector3(x, max.y, min.z), new BABYLON.Vector3(x, max.y, max.z)]);
                    } else if (spanY < 1.0) {
                        const y = (min.y + max.y) / 2;
                        candidateSegments.push([new BABYLON.Vector3(min.x, y, min.z), new BABYLON.Vector3(min.x, y, max.z)]);
                        candidateSegments.push([new BABYLON.Vector3(max.x, y, min.z), new BABYLON.Vector3(max.x, y, max.z)]);
                        candidateSegments.push([new BABYLON.Vector3(min.x, y, min.z), new BABYLON.Vector3(max.x, y, min.z)]);
                        candidateSegments.push([new BABYLON.Vector3(min.x, y, max.z), new BABYLON.Vector3(max.x, y, max.z)]);
                    }
                    if (candidateSegments.length === 0) continue;

                    for (const [p1, p2] of candidateSegments) {
                        const d3 = this.distPointToSegment3D(localHit, p1, p2);
                        const wm = mesh.getWorldMatrix();
                        const wp1 = BABYLON.Vector3.TransformCoordinates(p1, wm);
                        const wp2 = BABYLON.Vector3.TransformCoordinates(p2, wm);
                        const sp1 = BABYLON.Vector3.Project(
                            wp1,
                            BABYLON.Matrix.Identity(),
                            scene.getTransformMatrix(),
                            scene.activeCamera.viewport.toGlobal(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight()),
                        );
                        const sp2 = BABYLON.Vector3.Project(
                            wp2,
                            BABYLON.Matrix.Identity(),
                            scene.getTransformMatrix(),
                            scene.activeCamera.viewport.toGlobal(scene.getEngine().getRenderWidth(), scene.getEngine().getRenderHeight()),
                        );
                        const dPx = this.distPointToSegment2D(pointerX, pointerY, sp1.x, sp1.y, sp2.x, sp2.y);

                        // Preferujemy segment najbliższy kursora na ekranie, a potem lokalnie w 3D.
                        if (!best || dPx < best.dPx || (Math.abs(dPx - best.dPx) < 0.5 && d3 < best.d3)) {
                            best = { hit, mesh, lp1: p1, lp2: p2, d3, dPx };
                        }
                    }
                }

                // Stały próg ekranowy: krawędź musi być naprawdę pod kursorem.
                const edgeSnapPx = this.isCtrlPressed ? 18 : 14;
                if (best && best.dPx <= edgeSnapPx) {
                    const mesh = best.mesh;
                    const hit = best.hit;
                    const hitWorld = hit.pickedPoint;
                    const lp1 = best.lp1;
                    const lp2 = best.lp2;
                    const wm = mesh.getWorldMatrix();
                    const wp1BV = BABYLON.Vector3.TransformCoordinates(lp1, wm);
                    const wp2BV = BABYLON.Vector3.TransformCoordinates(lp2, wm);

                    const p1World = v3(wp1BV.x, wp1BV.y, wp1BV.z);
                    const p2World = v3(wp2BV.x, wp2BV.y, wp2BV.z);
                    const edgeDir = v3Normalize(v3Sub(p2World, p1World));

                    const norm = hit.getNormal ? hit.getNormal(true) : null;
                    const faceNormal = norm ? v3(norm.x, norm.y, norm.z) : null;
                    const matArray = getWorldMatrixArray(mesh.parent || mesh);

                    const rp1 = meshLocalToRootLocal(mesh, v3(lp1.x, lp1.y, lp1.z));
                    const rp2 = meshLocalToRootLocal(mesh, v3(lp2.x, lp2.y, lp2.z));
                    const edgeAnchors = tryBuildEdgeAnchorsFromRootPoints(
                        scene,
                        mesh,
                        rp1,
                        rp2,
                        p1World,
                        p2World,
                    );

                    const click = v3(hitWorld.x, hitWorld.y, hitWorld.z);

                    if (edgeAnchors) {
                        const dA = v3Len(v3Sub(click, edgeAnchors.p1World));
                        const dB = v3Len(v3Sub(click, edgeAnchors.p2World));
                        const nearFirst = dA <= dB;
                        const edgeDirResolved = v3Normalize(v3Sub(edgeAnchors.p2World, edgeAnchors.p1World));
                        const pNear = {
                            worldPos: nearFirst ? edgeAnchors.p1World : edgeAnchors.p2World,
                            anchor: nearFirst ? edgeAnchors.anchor1 : edgeAnchors.anchor2,
                            edgeDirWorld: edgeDirResolved,
                            faceNormalWorld: faceNormal,
                            meshMatrix: matArray,
                        };
                        const pFar = {
                            worldPos: nearFirst ? edgeAnchors.p2World : edgeAnchors.p1World,
                            anchor: nearFirst ? edgeAnchors.anchor2 : edgeAnchors.anchor1,
                            edgeDirWorld: edgeDirResolved,
                            faceNormalWorld: faceNormal,
                            meshMatrix: matArray,
                        };
                        return { p1: pNear, p2: pFar };
                    }

                    const d1 = v3Len(v3Sub(click, p1World));
                    const d2 = v3Len(v3Sub(click, p2World));
                    const nearFirst = d1 <= d2;
                    const a1 = buildAnchorRef(mesh, p1World, v3(lp1.x, lp1.y, lp1.z));
                    const a2 = buildAnchorRef(mesh, p2World, v3(lp2.x, lp2.y, lp2.z));
                    return {
                        p1: {
                            worldPos: nearFirst ? p1World : p2World,
                            anchor: nearFirst ? a1 : a2,
                            edgeDirWorld: edgeDir,
                            faceNormalWorld: faceNormal,
                            meshMatrix: matArray,
                        },
                        p2: {
                            worldPos: nearFirst ? p2World : p1World,
                            anchor: nearFirst ? a2 : a1,
                            edgeDirWorld: edgeDir,
                            faceNormalWorld: faceNormal,
                            meshMatrix: matArray,
                        },
                    };
                }
            }
        }

        return null;
    }

    // ========================================================================
    // POINT SNAPPING
    // ========================================================================

    /**
     * Tryb Ctrl: tylko narożniki, krawędzie OCCT i ściany (z przyciąganiem do rogu/krawędzi).
     * Bez dowolnego punktu w pustce ani swobodnego kliku w ścianę.
     */
    private findStructuredSnapPoint(): PickPoint | null {
        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const detection = this.geometryHighlighter?.lastDetection;
        if (detection?.hit) {
            if (detection.geometryType === GeometryType.PLANE) {
                const mesh = detection.mesh;
                const worldPos = v3(
                    detection.pickedPoint!.x,
                    detection.pickedPoint!.y,
                    detection.pickedPoint!.z,
                );
                const snapped = snapWorldPointToPanelGeometry(scene, mesh, worldPos, 1e6);
                if (snapped) {
                    const faceNormalWorld = detection.normal
                        ? v3(detection.normal.x, detection.normal.y, detection.normal.z)
                        : null;
                    return {
                        worldPos: snapped.worldPos,
                        anchor: snapped.anchor,
                        edgeDirWorld: null,
                        faceNormalWorld,
                        meshMatrix: getWorldMatrixArray(mesh.parent || mesh),
                    };
                }
            }
            const fromDetection = this.pickPointFromDetection(detection);
            if (fromDetection) return fromDetection;
        }

        return this.findStructuredSnapPointLegacy();
    }

    /** Zapasowa ścieżka pickowania (gdy detektor nie zwrócił trafienia w tej klatce). */
    private findStructuredSnapPointLegacy(): PickPoint | null {
        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;

        const subHits = this.pickSubHitsWithTolerance(['vertex', 'edge'], this.isCtrlPressed ? 16 : 12);

        if (subHits && subHits.length > 0) {
            const valid = subHits.filter((h: any) => h.hit && h.pickedMesh);
            if (valid.length > 0) {
                valid.sort((a: any, b: any) => a.distance - b.distance);
                const vHit = valid.find((h: any) => h.pickedMesh.metadata.type === 'vertex');
                const hit = vHit || valid[0];
                return this.createPickPointFromHit(hit);
            }
        }

        const faceHits = scene.multiPick(
            pointerX,
            pointerY,
            (m: any) => m && m.isEnabled() && m.metadata && m.metadata.faceName,
        );

        if (faceHits && faceHits.length > 0) {
            const valid = faceHits.filter((h: any) => h.hit && h.pickedMesh && h.pickedPoint);
            if (valid.length > 0) {
                valid.sort((a: any, b: any) => a.distance - b.distance);
                const hit = valid[0];
                const mesh = hit.pickedMesh;
                const worldPos = v3(hit.pickedPoint.x, hit.pickedPoint.y, hit.pickedPoint.z);
                const snapped = snapWorldPointToPanelGeometry(scene, mesh, worldPos, 1e6);
                if (snapped) {
                    const norm = hit.getNormal ? hit.getNormal(true) : null;
                    const faceNormalWorld = norm ? v3(norm.x, norm.y, norm.z) : null;
                    return {
                        worldPos: snapped.worldPos,
                        anchor: snapped.anchor,
                        edgeDirWorld: null,
                        faceNormalWorld,
                        meshMatrix: getWorldMatrixArray(mesh.parent || mesh),
                    };
                }
                // Płaszczyzna bez bliskiego narożnika — kotwica FACE na ścianie.
                return this.createPickPointFromHit(hit);
            }
        }

        return null;
    }

    private findSnapPoint(): PickPoint | null {
        const detection = this.geometryHighlighter?.lastDetection;
        if (detection?.hit) {
            const fromDetection = this.pickPointFromDetection(detection);
            if (fromDetection) return fromDetection;
        }

        const scene = this.ctx.viewport.scene;
        if (!scene) return null;

        const pointerX = scene.pointerX;
        const pointerY = scene.pointerY;

        // 1. Wierzchołki i Krawędzie
        const subHits = this.pickSubHitsWithTolerance(['vertex', 'edge'], this.isCtrlPressed ? 16 : 12);

        if (subHits && subHits.length > 0) {
            const valid = subHits.filter((h: any) => h.hit && h.pickedMesh);
            if (valid.length > 0) {
                valid.sort((a: any, b: any) => a.distance - b.distance);
                const vHit = valid.find((h: any) => h.pickedMesh.metadata.type === 'vertex');
                const hit = vHit || valid[0];
                return this.createPickPointFromHit(hit);
            }
        }

        // 2. Ściany formatki
        const faceHits = scene.multiPick(
            pointerX,
            pointerY,
            (m: any) => m && m.isEnabled() && m.metadata && m.metadata.faceName,
        );

        if (faceHits && faceHits.length > 0) {
            const valid = faceHits.filter((h: any) => h.hit && h.pickedMesh && h.pickedPoint);
            if (valid.length > 0) {
                valid.sort((a: any, b: any) => a.distance - b.distance);
                return this.createPickPointFromHit(valid[0]);
            }
        }

        // 3. Dowolny obiekt 3D w scenie
        const generalHit = scene.pick(pointerX, pointerY, (m: any) => m && m.isPickable && !m.name.startsWith('pmi_'));
        if (generalHit && generalHit.hit && generalHit.pickedMesh && generalHit.pickedPoint) {
            return this.createPickPointFromHit(generalHit);
        }

        return null;
    }

    private createPickPointFromHit(hit: any): PickPoint | null {
        if (!hit.pickedPoint) return null;

        const mesh = hit.pickedMesh;
        let worldPos = v3(hit.pickedPoint.x, hit.pickedPoint.y, hit.pickedPoint.z);

        // Narożnik przyciągamy do jego dokładnej pozycji, a nie do miejsca
        // trafienia w kulkę markera.
        let localOverride: Vec3 | null = null;
        if (mesh?.metadata?.type === 'vertex' && mesh.position) {
            localOverride = v3(mesh.position.x, mesh.position.y, mesh.position.z);
            const snapped = mesh.getAbsolutePosition?.();
            if (snapped) worldPos = v3(snapped.x, snapped.y, snapped.z);
        }

        if (mesh?.metadata?.type === 'edge') {
            const snappedEnd = snapToNearestEdgeEndpoint(mesh, worldPos);
            if (snappedEnd) {
                const p0 = mesh.metadata.brepPoints[0];
                const p1 = mesh.metadata.brepPoints[1];
                const edgeDirWorld = v3Normalize(v3Sub(
                    v3(p1[0], p1[1], p1[2]),
                    v3(p0[0], p0[1], p0[2]),
                ));
                const norm = hit.getNormal ? hit.getNormal(true) : null;
                return {
                    worldPos: snappedEnd.worldPos,
                    anchor: snappedEnd.anchor,
                    edgeDirWorld,
                    faceNormalWorld: norm ? v3(norm.x, norm.y, norm.z) : null,
                    meshMatrix: getWorldMatrixArray(mesh.parent || mesh),
                };
            }
        }

        if (mesh?.metadata?.faceName) {
            const scene = this.ctx.viewport.scene;
            const snapped = scene ? snapWorldPointToPanelGeometry(scene, mesh, worldPos, 1e6) : null;
            if (snapped) {
                const norm = hit.getNormal ? hit.getNormal(true) : null;
                const faceNormalWorld = norm ? v3(norm.x, norm.y, norm.z) : null;
                return {
                    worldPos: snapped.worldPos,
                    anchor: snapped.anchor,
                    edgeDirWorld: null,
                    faceNormalWorld,
                    meshMatrix: getWorldMatrixArray(mesh.parent || mesh),
                };
            }
        }

        const anchor = mesh ? buildAnchorRef(mesh, worldPos, localOverride) : freeAnchorRef(worldPos);
        const meshMatrix = mesh ? getWorldMatrixArray(mesh.parent || mesh) : null;

        let edgeDirWorld: Vec3 | null = null;
        if (mesh?.metadata?.type === 'edge' && mesh.metadata.brepPoints && mesh.metadata.brepPoints.length >= 2) {
            const p0 = mesh.metadata.brepPoints[0];
            const p1 = mesh.metadata.brepPoints[1];
            edgeDirWorld = v3Normalize(v3Sub(v3(p1[0], p1[1], p1[2]), v3(p0[0], p0[1], p0[2])));
        }

        const norm = hit.getNormal ? hit.getNormal(true) : null;
        const faceNormalWorld = norm ? v3(norm.x, norm.y, norm.z) : null;

        return { worldPos, anchor, edgeDirWorld, faceNormalWorld, meshMatrix };
    }

    // ========================================================================
    // AXIS DETECTION
    // ========================================================================

    private autoDetectAxis(): void {
        if (this.measureAxisLocked) return;
        // Bez blokady oś rozstrzyga bridge na podstawie dominującej składowej odcinka.
        this.currentMeasureAxisKey = 'AUTO';
    }

    /** Aktualnie obowiązująca oś pomiaru i długość — to samo źródło co renderer. */
    private currentMeasurement(): { lengthMM: number; axisKey: string } | null {
        if (!this.pick1 || !this.pick2) return null;

        const measure = resolveMeasureAxis({
            axisSpace: this.currentAxisSpace,
            matrixWorld: this.pick1.meshMatrix,
            measureAxisKey: this.currentMeasureAxisKey,
            anchor1World: this.pick1.worldPos,
            anchor2World: this.pick2.worldPos,
            faceNormal1World: this.pick1.faceNormalWorld,
            faceNormal2World: this.pick2.faceNormalWorld,
        });
        return measure ? { lengthMM: measure.lengthMM, axisKey: measure.measureAxisKey } : null;
    }

    // ========================================================================
    // OFFSET CALCULATION (Mouse Drag)
    // ========================================================================

    private updateOffsetFromMouse(): void {
        if (!this.pick1 || !this.pick2) return;

        this.applyHoveredOffsetGuide();

        const offset = computeOffsetFromPointer({
            scene: this.ctx.viewport.scene,
            anchor1World: this.pick1.worldPos,
            anchor2World: this.pick2.worldPos,
            axisConstraintWorld: axisVectorWorld(
                this.currentOffsetAxisKey,
                this.currentAxisSpace,
                this.pick1.meshMatrix,
            ),
            dragStartHitWorld: this.dragStartHitWorld,
            dragStartOffsetWorld: this.dragStartOffsetWorld,
            freeDragBiasWorld: this.freeDragBiasWorld,
        });

        if (offset) this.currentOffset = offset;

        this.updatePreview();
        this.syncToolLiveState();
    }

    private applyHoveredOffsetGuide(): void {
        if (this.currentAxisSpace === 'ALIGNED' || !this.pick1 || !this.pick2) return;

        const scene = this.ctx.viewport.scene;
        const origin = axisGuideOrigin(this.pick1.worldPos, this.pick2.worldPos);
        const candidates = buildOffsetGuideCandidates({
            origin,
            length: estimateGuideLength(scene, origin),
            localMatrix: localMatrixFromPicks(this.pick1, this.pick2),
            measureDirWorld: v3Sub(this.pick2.worldPos, this.pick1.worldPos),
        });

        const project = createWorldToScreen(scene);
        if (!project) return;

        const hit = pickOffsetGuide(candidates, scene.pointerX, scene.pointerY, project, {
            stickyId: this.stickyGuideId,
        });
        if (!hit) return;

        this.stickyGuideId = hit.candidate.id;
        this.currentAxisSpace = hit.candidate.space;
        this.currentOffsetAxisKey = hit.candidate.axisKey;
    }

    // ========================================================================
    // PREVIEW & LIVE GUIDES
    // ========================================================================

    private updatePreview(): void {
        if (!this.pick1 || !this.pick2) return;

        const store = PMIStore.instance;
        const measurement = this.currentMeasurement();
        const labelText = formatDistance(
            measurement?.lengthMM ?? 0,
            store.unitMode,
            store.showUnits,
        );

        const rd = getRenderData({
            axisSpace: this.currentAxisSpace,
            matrixWorld: this.pick1.meshMatrix,
            measureAxisKey: this.currentMeasureAxisKey,
            offsetAxisKey: this.currentOffsetAxisKey,
            offsetWorld: this.currentOffset,
            anchor1World: this.pick1.worldPos,
            anchor2World: this.pick2.worldPos,
            edgeDir1World: this.pick1.edgeDirWorld,
            edgeDir2World: this.pick2.edgeDirWorld,
            faceNormal1World: this.pick1.faceNormalWorld,
            faceNormal2World: this.pick2.faceNormalWorld,
            worldThickness: store.lineWidthMM,
            fontSizeWorld: store.textSizeMM,
            labelText,
        });

        this.renderer.renderPreview(rd);
        this.updateAxisGuides();
    }

    private updateAxisGuides(): void {
        if (this.phase !== 'DRAG_OFFSET' || !this.pick1 || !this.pick2) {
            this.disposeAxisGuides();
            return;
        }

        const scene = this.ctx.viewport.scene;
        if (!scene) return;

        if (this.currentAxisSpace === 'ALIGNED') {
            this.disposeAxisGuides();
            return;
        }

        if (!this.axisGuides) {
            this.axisGuides = new PMIAxisGuides(scene);
        }

        const origin = axisGuideOrigin(this.pick1.worldPos, this.pick2.worldPos);
        const candidates = buildOffsetGuideCandidates({
            origin,
            length: estimateGuideLength(scene, origin),
            localMatrix: localMatrixFromPicks(this.pick1, this.pick2),
            measureDirWorld: v3Sub(this.pick2.worldPos, this.pick1.worldPos),
        });
        const activeId = this.stickyGuideId
            || (this.currentOffsetAxisKey
                ? guideCandidateId(this.currentAxisSpace === 'LOCAL' ? 'LOCAL' : 'GLOBAL', this.currentOffsetAxisKey as 'X' | 'Y' | 'Z')
                : null);

        this.axisGuides.update(candidates, activeId);
    }

    private disposeAxisGuides(): void {
        this.axisGuides?.dispose();
        this.axisGuides = null;
    }

    private updateLiveGuideLine(p1: Vec3, p2: Vec3): void {
        this.disposeLiveGuideLine();

        const scene = this.ctx.viewport.scene;
        this.liveGuideLine = BABYLON.MeshBuilder.CreateLines(
            'pmi_guide_line',
            {
                points: [
                    new BABYLON.Vector3(p1.x, p1.y, p1.z),
                    new BABYLON.Vector3(p2.x, p2.y, p2.z),
                ],
            },
            scene,
        );
        this.liveGuideLine.color = new BABYLON.Color3(0.2, 0.8, 1.0);
        this.liveGuideLine.isPickable = false;
        this.liveGuideLine.renderingGroupId = 2;
    }

    private disposeLiveGuideLine(): void {
        if (this.liveGuideLine) {
            this.liveGuideLine.dispose();
            this.liveGuideLine = null;
        }
    }

    private setUIStatus(text: string): void {
        if (UIController.instance && typeof UIController.instance.setStatus === 'function') {
            UIController.instance.setStatus(text);
        }
    }

    // ========================================================================
    // COMMIT DIMENSION
    // ========================================================================

    private commitDimension(): void {
        if (!this.pick1 || !this.pick2) return;

        const scene = this.ctx.viewport.scene;
        const store = PMIStore.instance;

        // Offset i podpowiedzi kierunkowe zapisujemy w układzie lokalnym kotwicy,
        // żeby wymiar przetrwał obrót i przesunięcie formatki.
        const { offset, offsetSpace } = storeOffsetFromWorld(scene, this.pick1.anchor, this.currentOffset);

        const init = {
            anchor1: this.pick1.anchor,
            anchor2: this.pick2.anchor,
            offset,
            offsetSpace,
            axisSpace: this.currentAxisSpace,
            measureAxisKey: this.currentMeasureAxisKey,
            offsetAxisKey: this.currentOffsetAxisKey,
            edgeDir1Local: directionToLocal(scene, this.pick1.anchor, this.pick1.edgeDirWorld),
            edgeDir2Local: directionToLocal(scene, this.pick2.anchor, this.pick2.edgeDirWorld),
            faceNormal1Local: directionToLocal(scene, this.pick1.anchor, this.pick1.faceNormalWorld),
            faceNormal2Local: directionToLocal(scene, this.pick2.anchor, this.pick2.faceNormalWorld),
        };

        executePMICommand(new AddDimensionCommand(store, init));

        this.renderer.clearPreview();

        const measurement = this.currentMeasurement();
        console.log(`[DimensionTool] Wymiar zatwierdzony: ${formatDistance(measurement?.lengthMM ?? 0, store.unitMode, store.showUnits)}`);

        this.resetPicks();
        this.setUIStatus('Wymiar dodany! Kliknij kolejną krawędź lub punkt (Ctrl = precyzyjny element).');
    }

    // ========================================================================
    // PUBLIC CONFIG (panel PMI)
    // ========================================================================

    public setAxisSpace(space: AxisSpace): void {
        this.currentAxisSpace = space === 'ALIGNED' ? 'ALIGNED' : (space === 'LOCAL' ? 'LOCAL' : 'GLOBAL');
        PMIStore.instance.toolAxisSpace = space === 'ALIGNED' ? 'ALIGNED' : 'GLOBAL';
        if (space === 'ALIGNED') {
            this.stickyGuideId = null;
            this.disposeAxisGuides();
        }
        if (this.phase === 'DRAG_OFFSET') this.updatePreview();
    }

    public getAxisSpace(): AxisSpace {
        return this.currentAxisSpace;
    }

    public setMeasureAxis(axis: MeasureAxisKey): void {
        this.currentMeasureAxisKey = axis;
        this.measureAxisLocked = axis !== 'AUTO';
        PMIStore.instance.toolMeasureAxis = axis;
        if (this.phase === 'DRAG_OFFSET') this.updatePreview();
    }

    public getMeasureAxis(): MeasureAxisKey {
        return this.currentMeasureAxisKey;
    }

    public getPhase(): ToolPhase {
        return this.phase;
    }

    public getOffsetAxisKey(): string {
        return this.currentOffsetAxisKey;
    }
}

function localMatrixFromPicks(p1: PickPoint, p2: PickPoint): number[] | null {
    const id1 = p1.anchor?.nodeId || '';
    const id2 = p2.anchor?.nodeId || '';
    if (id1 && id2 && id1 !== id2) return null;
    if (id1 && p1.meshMatrix) return p1.meshMatrix;
    if (id2 && p2.meshMatrix) return p2.meshMatrix;
    return null;
}
