/**
 * E1_export - assembly-anim.ts
 * DEMO animacji złożenia w scenie Babylon + nagrywanie WebM w rozdzielczości docelowej.
 *
 * Logika (Faza 2 planu Instrukcja Montażu):
 *  1. AssemblyPlan (silnik reguł) → kroki (actionNodeIds, tryb joint/single).
 *  2. Mesh per część = SceneSyncAdapter.getMeshForNodeId(nodeId) (jawne wiązanie CAD→mesh).
 *  3. Kroki grane po kolei: część startuje w pozycji "explodowanej" (offset w górę sceny)
 *     i tweenuje się cubic-in-out do pozycji finałowej; reszta części w tym
 *     czasie jest na pozycjach finałowych / zakryta (według stanu kroków).
 *  4. Animacja dotyka WYŁĄCZNIE renderera — dokument SSOT nienaruszony.
 *  5. Nagrywanie: engine.setSize(W,H) (rozdzielczość docelowa niezależna od okna)
 *     + MediaRecorder(canvas.captureStream) → .webm (VP9/VP8).
 */

import { ContextManager } from '../A1_core/context-manager.js';
import { cadToRender } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { ConnectorStore } from '../C2_connectors/connector-store.js';
import { isDowelConnector, type AssemblyPlan } from './assembly-sequence-engine.js';

declare const BABYLON: any;

// ─── Konfiguracja ───

export interface AssemblyAnimOptions {
    /** Duracja ruchu jednego elementu [ms]. */
    stepMs?: number;
    /** Odstęp między krokami [ms]. */
    gapMs?: number;
    /** Kolejne elementy tego samego kroku startują co `staggerMs` (kaskada) [ms]. */
    staggerMs?: number;
    /** Offset explodowania [mm render]; null = 350. */
    floatMm?: number | null;
    /** Tempo 0.5× / 1× / 2× (dzieli czasy). */
    speed?: number;
    /** Postęp: krok + status. */
    onProgress?: (info: { stepIndex: number; doneSteps: number; totalSteps: number; finished?: boolean }) => void;
}

const DEFAULTS = {
    stepMs: 900,
    gapMs: 400,
    staggerMs: 140,
    floatMm: 350,
    speed: 1,
};

export const ASSEMBLY_FPS = 30;

export interface VideoResolution {
    label: string;
    width: number;
    height: number;
}

export const ASSEMBLY_VIDEO_RESOLUTIONS: VideoResolution[] = [
    { label: '720p (1280×720)', width: 1280, height: 720 },
    { label: '1080p (1920×1080)', width: 1920, height: 1080 },
    { label: '1440p (2560×1440)', width: 2560, height: 1440 },
    { label: '4K (3840×2160)', width: 3840, height: 2160 },
];

// ─── Easing / lerp (pure) ───

export function animEaseCubicInOut(t: number): number {
    const x = Math.min(1, Math.max(0, t));
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function animLerp3(
    a: [number, number, number],
    b: [number, number, number],
    t: number,
): [number, number, number] {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ─── Kierunki exploda (pure, CAD mm) ───
// Konwencja CAD (jak w C2_connectors): −Y = przód mebla, +Y = tył, Z = pion.
// Zasady montażu demo:
//  - wieńce: dno znika w DÓŁ (−Z), wieniec górny w GÓRĘ (+Z),
//  - ścianki boczne: lewy z LEWEJ (−X), prawy z PRAWEJ (+X),
//  - plecy: do TYŁU (+Y), fronty: do PRZODU (−Y),
//  - wszystko WEWNĄTRZ (półki, działki, wkładki): wysuwa się DO PRZODU (−Y),
//    jak szuflada wysuwana z korpusu.

export const EXPLODE_DEFAULT_DIR = [0, -1, 0] as [number, number, number];

const EXPLODE_ROLE_DIRS: Record<string, [number, number, number]> = {
    // Pion (Z) — pierwsza kolejność:
    TOP_PANEL: [0, 0, 1],
    BOTTOM_PANEL: [0, 0, -1],
    // Boki:
    LEFT_SIDE_PANEL: [-1, 0, 0],
    RIGHT_SIDE_PANEL: [1, 0, 0],
    // Tył / przód:
    BACK_PANEL: [0, 1, 0],
    FRONT: [0, -1, 0],
    FRONT_PANEL: [0, -1, 0],
    FLAP: [0, -1, 0],
};

/** Jednostkowy kierunek exploda w CAD [mm] dla roli; nieznane roli = do przodu (−Y). */
export function explodeDirForRole(role: string | null | undefined): [number, number, number] {
    if (!role) return [...EXPLODE_DEFAULT_DIR] as [number, number, number];
    return [...(EXPLODE_ROLE_DIRS[role] || EXPLODE_DEFAULT_DIR)] as [number, number, number];
}

// ─── Player ───

interface MeshBinding {
    root: any; // mesh / TransformNode części (SceneSyncAdapter) lub instancja złącza C2
    finalPosition: [number, number, number];
    startPosition: [number, number, number];
    /** null = zwykła część (zawsze widoczna po restore); instancja złącza pamięta stan pierwotny. */
    initialVisible?: boolean | null;
}

export class AssemblyAnimPlayer {
    private _plan: AssemblyPlan;
    private _opts: Required<AssemblyAnimOptions>;
    private _bindings = new Map<string, MeshBinding>();
    private _originalFinalPositions = new Map<string, [number, number, number]>();
    /** stepIndex → klucze bindingów meshe-instancji złącza C2 (kołki w pierwszym kroku, konfirmaty w drugim). */
    private _connectorKeysByStep = new Map<number, string[]>();
    private _cancelToken = { cancelled: false };
    private _busy = false;
    private _bindingsDirty = true;

    constructor(plan: AssemblyPlan, options: AssemblyAnimOptions = {}) {
        this._plan = plan;
        this._opts = {
            stepMs: options.stepMs ?? DEFAULTS.stepMs,
            gapMs: options.gapMs ?? DEFAULTS.gapMs,
            staggerMs: options.staggerMs ?? DEFAULTS.staggerMs,
            floatMm: options.floatMm ?? DEFAULTS.floatMm,
            speed: options.speed && options.speed > 0 ? options.speed : 1,
            onProgress: options.onProgress ?? (() => { }),
        };
    }

    public get isPlaying(): boolean {
        return this._busy;
    }

    /** Mapa nodeId → mesh (SceneSyncAdapter). Bez meshe = część pomijana w animacji. */
    private _collectBindings(): number {
        this._bindings.clear();
        this._connectorKeysByStep.clear();
        const adapter = ContextManager.instance?.sceneSyncAdapter;
        if (!adapter?.getMeshForNodeId) return 0;
        const defaultFloatMm = Math.max(60, this._opts.floatMm);
        for (const step of this._plan.steps) {
            // Kierunek kroku: rola pierwszej FORMATKI w kroku (okuca dziedziczą po niej).
            const firstPart = step.actions.find((a) => a.nodeType === 'PART') || null;
            const dirCad = step.explodeOverride?.dirCad ?? explodeDirForRole(firstPart?.role ?? null);
            const floatMm = step.explodeOverride?.distanceMm ?? defaultFloatMm;
            const dirRender = cadToRender(new Vec3(dirCad[0], dirCad[1], dirCad[2]));
            for (const nodeId of step.actionNodeIds) {
                if (this._bindings.has(nodeId)) continue;
                const mesh = adapter.getMeshForNodeId(nodeId);
                if (!mesh?.position) continue;
                let final = this._originalFinalPositions.get(nodeId);
                if (!final) {
                    final = [mesh.position.x, mesh.position.y, mesh.position.z];
                    this._originalFinalPositions.set(nodeId, final);
                }
                const customStart = step.explodeOverride?.customStartPositions?.[nodeId];
                const startPos: [number, number, number] = customStart
                    ? [customStart[0], customStart[1], customStart[2]]
                    : [
                        final[0] + dirRender.x * floatMm,
                        final[1] + dirRender.y * floatMm,
                        final[2] + dirRender.z * floatMm,
                    ];
                this._bindings.set(nodeId, {
                    root: mesh,
                    finalPosition: final,
                    startPosition: startPos,
                });
            }
        }
        let xMin = Infinity;
        let xMax = -Infinity;
        for (const [, item] of this._bindings) {
            if (item.finalPosition[0] < xMin) xMin = item.finalPosition[0];
            if (item.finalPosition[0] > xMax) xMax = item.finalPosition[0];
        }
        const xCenter = isFinite(xMin) && isFinite(xMax) ? (xMin + xMax) / 2 : 0;

        this._collectConnectorBindings(defaultFloatMm, xCenter);
        return this._bindings.size;
    }

    public invalidateBindings(): void {
        this._bindingsDirty = true;
    }

    private _ensureBindings(): number {
        if (this._bindingsDirty || this._bindings.size === 0) {
            this._collectBindings();
            this._bindingsDirty = false;
        }
        return this._bindings.size;
    }

    /**
     * Kołki/konfirmaty z C2: meshe-instancje z ConnectorVisualizer (metadata `c2Connector`).
     * Kołki fi8 montujemy w pierwszym panelu (wieniec) przed przyłożeniem boczków.
     * Konfirmaty/minifix montujemy w drugim panelu (boczki) po ich przyłożeniu.
     *
     * Kierunek ruchu:
     *  - złącza prawego boku wchodzą Z PRAWEJ DO ŚRODKA (startują z +X),
     *  - złącza lewego boku wchodzą Z LEWEJ DO ŚRODKA (startują z -X).
     */
    private _collectConnectorBindings(floatMm: number, xCenter = 0): void {
        this._connectorKeysByStep.clear();
        const section = this._viewport?.scene?.meshes;
        if (!Array.isArray(section) || section.length === 0) return; // scena nie gotowa

        // 1. Zmapuj panele na ich indeksy kroków w planie
        const panelToStep = new Map<string, number>();
        for (const step of this._plan.steps) {
            for (const id of step.actionNodeIds) {
                panelToStep.set(id, step.index);
            }
        }

        // 2. Wyznacz kroki minStepIdx (wieniec / pierwszy panel) i maxStepIdx (boczek / drugi panel)
        const groupSteps = new Map<string, { minStepIdx: number; maxStepIdx: number }>();
        for (const grp of ConnectorStore.instance?.groups || []) {
            const sA = panelToStep.get(grp.parentObjectId);
            const sB = panelToStep.get(grp.otherObjectId);
            if (sA != null && sB != null) {
                groupSteps.set(grp.id, {
                    minStepIdx: Math.min(sA, sB),
                    maxStepIdx: Math.max(sA, sB),
                });
            } else if (sA != null || sB != null) {
                const s = sA ?? sB!;
                groupSteps.set(grp.id, { minStepIdx: s, maxStepIdx: s });
            }
        }

        // 3. Przypisz każdy mesh złącza do JEGO JEDYNEGO właściwego kroku:
        // Kołek fi8 -> WYŁĄCZNIE krok pierwszego panelu (wieniec).
        // Konfirmat/minifix -> WYŁĄCZNIE krok drugiego panelu (boczek).
        for (let i = 0; i < section.length; i++) {
            const mesh = section[i];
            const meta = mesh?.metadata;
            if (meta?.type === 'c2_connector_symbol' && meta.c2Connector?.groupId) {
                if (typeof mesh.isDisposed === 'function' && mesh.isDisposed()) continue;
                if (!mesh.position) continue;
                const cc = meta.c2Connector;
                const gid = cc.groupId;
                const connType = cc.connectorType || '';
                const isDowel = isDowelConnector(connType);

                const gStep = groupSteps.get(gid);
                let targetStepIdx: number | null = null;
                if (gStep) {
                    targetStepIdx = isDowel ? gStep.minStepIdx : gStep.maxStepIdx;
                } else {
                    // Fallback jeśli grupy brak w store (np. test bez store): dopasuj po hardwareCounts
                    const match = this._plan.steps.find((s) => {
                        const hasGrp = (s as any).connectorGroupIds?.includes(gid);
                        if (!hasGrp) return false;
                        const count = s.hardwareCounts?.[connType] || 0;
                        return isDowel ? (count > 0) : (count > 0 || !isDowel);
                    });
                    targetStepIdx = match?.index ?? null;
                }

                if (targetStepIdx == null) continue;

                // Stabilny klucz per segment fizycznej instancji (bez zmiennego indeksu `i` z tablicy meshes)
                const segTag = cc.segment || (i % 2 === 0 ? 'face' : 'edge');
                const baseKey = `c2:${gid}#${cc.instanceIndex ?? 0}`;
                const key = `${baseKey}_${segTag}`;

                let final = this._originalFinalPositions.get(key);
                if (!final) {
                    final = [mesh.position.x, mesh.position.y, mesh.position.z];
                    this._originalFinalPositions.set(key, final);
                }

                // Złącza dla prawego boku (po prawej stronie mebla) wchodzą Z PRAWEJ DO ŚRODKA (startują z +X).
                // Złącza dla lewego boku (po lewej stronie mebla) wchodzą Z LEWEJ DO ŚRODKA (startują z -X).
                const isRightSide = final[0] >= xCenter;
                const dirX = isRightSide ? 1 : -1;

                const initialVisible =
                    (typeof mesh.isEnabled === 'function' ? mesh.isEnabled() : true)
                    && mesh.isVisible !== false;

                this._bindings.set(key, {
                    root: mesh,
                    finalPosition: final,
                    startPosition: [
                        final[0] + dirX * floatMm,
                        final[1],
                        final[2],
                    ],
                    initialVisible,
                });

                let stepKeys = this._connectorKeysByStep.get(targetStepIdx);
                if (!stepKeys) {
                    stepKeys = [];
                    this._connectorKeysByStep.set(targetStepIdx, stepKeys);
                }
                if (!stepKeys.includes(key)) {
                    stepKeys.push(key);
                }
            }
        }
    }

    private _setVisible(binding: MeshBinding, visible: boolean, isRestoring = false): void {
        // W trakcie animacji lub edycji kroku złącza powinny być widoczne (widać wsuwanie).
        // Tylko przy pełnym przywróceniu mebla (restore) wracamy do domyślnego stanu widoczności złącza.
        const target = isRestoring && typeof binding.initialVisible === 'boolean'
            ? binding.initialVisible
            : visible;
        try {
            binding.root.setEnabled(target);
            if (binding.root.isVisible !== undefined) {
                binding.root.isVisible = target;
            }
        } catch { /* mesh usunięty — ignoruj */ }
    }

    private _requestRender(frames = 2): void {
        this._viewport?.requestRender?.(frames);
    }

    private get _viewport(): any {
        return ContextManager.instance?.viewport ?? null;
    }

    public hasMeshes(): number {
        return this._ensureBindings();
    }

    /** Przywróć scenę: wszystko widoczne, pozycje finałowe. */
    public restore(): void {
        this._ensureBindings();
        for (const [, item] of this._bindings) {
            this._setVisible(item, true, true);
            try {
                item.root.position.set(item.finalPosition[0], item.finalPosition[1], item.finalPosition[2]);
            } catch { /* ignore */ }
        }
        this._requestRender(4);
    }

    /**
     * Pokazuje scenę w stanie wybranego kroku (dla podglądu i edycji klatek).
     * @param stepIndex Indeks kroku:
     *   - < 0: pełny mebel złożony (restore)
     *   - 0: inwentarz (krok 0) — wszystkie ukryte
     *   - >= 1: kroki wcześniejsze złożone, bieżący w pozycji explodowanej (lerp), przyszłe ukryte
     * @param explodeRatio 1 = pełne odsunięcie, 0 = wpasowany w pozycję docelową
     */
    public showStep(stepIndex: number, explodeRatio = 1): void {
        this.stop();
        this._ensureBindings();
        if (this._bindings.size === 0 || !this._viewport) return;

        if (stepIndex < 0) {
            this.restore();
            return;
        }

        if (stepIndex === 0) {
            for (const [, item] of this._bindings) {
                this._setVisible(item, false);
            }
            this._requestRender(4);
            return;
        }

        const currentStep = this._plan.steps.find((s) => s.index === stepIndex);
        const currentIds = new Set(currentStep?.actionNodeIds || []);
        if (currentStep) {
            for (const key of this._connectorKeysByStep.get(currentStep.index) || []) {
                currentIds.add(key);
            }
        }

        const priorIds = new Set<string>();
        for (const s of this._plan.steps) {
            if (s.index < stepIndex) {
                for (const id of s.actionNodeIds) priorIds.add(id);
                for (const key of this._connectorKeysByStep.get(s.index) || []) {
                    priorIds.add(key);
                }
            }
        }

        const ratio = Math.max(0, Math.min(1, explodeRatio));
        for (const [id, item] of this._bindings) {
            if (currentIds.has(id)) {
                this._setVisible(item, true);
                const pos = animLerp3(item.startPosition, item.finalPosition, 1 - ratio);
                try {
                    item.root.position.set(pos[0], pos[1], pos[2]);
                } catch { /* ignore */ }
            } else if (priorIds.has(id)) {
                this._setVisible(item, true);
                try {
                    item.root.position.set(item.finalPosition[0], item.finalPosition[1], item.finalPosition[2]);
                } catch { /* ignore */ }
            } else {
                this._setVisible(item, false);
            }
        }
        this._requestRender(4);
    }

    /**
     * Zmienia parametry odsunięcia (kierunek CAD, dystans w mm) dla danego kroku.
     */
    public setStepExplode(
        stepIndex: number,
        dirCad: [number, number, number] | null,
        distanceMm: number | null,
    ): void {
        const step = this._plan.steps.find((s) => s.index === stepIndex);
        if (!step) return;
        step.explodeOverride = {
            ...step.explodeOverride,
            ...(dirCad ? { dirCad } : {}),
            ...(typeof distanceMm === 'number' ? { distanceMm } : {}),
        };
        if (dirCad || typeof distanceMm === 'number') {
            if (step.explodeOverride.customStartPositions) {
                delete step.explodeOverride.customStartPositions;
            }
        }
        this.invalidateBindings();
        this.showStep(stepIndex, 1);
    }

    /**
     * Zapisuje bieżące pozycje meshy ze sceny (ustawione np. gizmami G/R)
     * jako własną klatkę startową dla tego kroku.
     */
    public captureCurrentPositionsAsKeyframe(stepIndex: number): boolean {
        const step = this._plan.steps.find((s) => s.index === stepIndex);
        if (!step) return false;
        const custom: Record<string, [number, number, number]> = {};
        let savedCount = 0;
        for (const nodeId of step.actionNodeIds) {
            const item = this._bindings.get(nodeId);
            if (item?.root?.position) {
                custom[nodeId] = [item.root.position.x, item.root.position.y, item.root.position.z];
                savedCount++;
            }
        }
        if (savedCount === 0) return false;
        step.explodeOverride = {
            ...step.explodeOverride,
            customStartPositions: custom,
        };
        this.invalidateBindings();
        this.showStep(stepIndex, 1);
        return true;
    }

    /** Przerwij obecne odtwarzanie. */
    public stop(): void {
        this._cancelToken.cancelled = true;
    }

    /**
     * Odtwórz całość: kroki 1..N po kolei. Resolves:
     *  true  = do grania do końca,
     *  false = przerwane stop().
     * Po zakończeniu scena = mebel złożony (restore()).
     */
    public async play(): Promise<boolean> {
        if (this._busy) return false;
        const count = this._collectBindings();
        if (count === 0 || !this._viewport) return false;
        this._busy = true;
        this._cancelToken = { cancelled: false };
        const token = this._cancelToken;
        const scale = 1 / this._opts.speed;

        try {
            try { this._viewport.scene?.stopAnimation?.(); } catch { /* ignore */ }

            // Stan startowy: wszystko ukryte.
            for (const [, item] of this._bindings) this._setVisible(item, false);
            this._requestRender(3);

            const totalSteps = this._plan.steps.length;
            let actualStep = 0;

            for (const step of this._plan.steps) {
                if (token.cancelled) break;
                actualStep = step.index;

                const segs: { item: MeshBinding; startMs: number; endMs: number; isConnector?: boolean }[] = [];

                // 1. Formatki kroku — ruszają jako pierwsze
                const partIds = Array.from(new Set(step.actionNodeIds));
                let partEndMs = 0;
                partIds.forEach((nodeId, i) => {
                    const item = this._bindings.get(nodeId);
                    if (!item) return;
                    this._setVisible(item, true);
                    try {
                        item.root.position.set(item.startPosition[0], item.startPosition[1], item.startPosition[2]);
                    } catch { /* ignore */ }
                    const startMs = i * this._opts.staggerMs * scale;
                    const endMs = startMs + this._opts.stepMs * scale;
                    if (endMs > partEndMs) partEndMs = endMs;
                    segs.push({ item, startMs, endMs, isConnector: false });
                });

                // 2. Złącza C2 (kołki / konfirmaty) — wchodzą po przyłożeniu formatek kroku.
                // Obie połówki (segment 'face' i 'edge') każdego fizycznego złącza poruszają się w 100% zsynchronizowane!
                const connKeys = this._connectorKeysByStep.get(step.index) || [];
                const connGroups = new Map<string, string[]>();
                for (const key of connKeys) {
                    const baseKey = key.replace(/_(face|edge)$/, '');
                    const list = connGroups.get(baseKey) || [];
                    list.push(key);
                    connGroups.set(baseKey, list);
                }

                // Złącza startują po ostatecznym usadowieniu płyt formatki
                const connBaseStartMs = partIds.length > 0 ? partEndMs : 0;
                const connDurationMs = Math.min(500 * scale, this._opts.stepMs * scale * 0.7);

                let connIdx = 0;
                for (const [, segmentKeys] of connGroups) {
                    const startMs = connBaseStartMs + connIdx * this._opts.staggerMs * scale;
                    const endMs = startMs + connDurationMs;
                    for (const segKey of segmentKeys) {
                        const item = this._bindings.get(segKey);
                        if (!item) continue;
                        // Ukryj łącznik na początku kroku — pojawi się w locie dopiero w swoim startMs
                        this._setVisible(item, false);
                        try {
                            item.root.position.set(item.startPosition[0], item.startPosition[1], item.startPosition[2]);
                        } catch { /* ignore */ }
                        segs.push({ item, startMs, endMs, isConnector: true });
                    }
                    connIdx++;
                }
                this._requestRender(3);
                this._opts.onProgress({ stepIndex: actualStep, doneSteps: actualStep, totalSteps });

                if (segs.length === 0) continue;

                // Tween rAF formatki kroku (kaskada zawarta w startMs) + gap.
                const stepEnded = await this._runStep(segs, token);
                if (!stepEnded) break;

                await delay(this._opts.gapMs * scale, token);
            }

            const finished = !token.cancelled;
            this.restore();
            this._opts.onProgress({ stepIndex: -1, doneSteps: totalSteps, totalSteps, finished });
            return finished;
        } finally {
            this._busy = false;
        }
    }

    /** Pętla rAF tweenu formatki kroku; false = anulowana. */
    private async _runStep(
        segs: { item: MeshBinding; startMs: number; endMs: number; isConnector?: boolean }[],
        token: { cancelled: boolean },
    ): Promise<boolean> {
        const lastEnd = Math.max(...segs.map((s) => s.endMs));
        const t0 = performance.now();
        await new Promise<void>((resolve) => {
            const tick = () => {
                if (token.cancelled) { resolve(); return; }
                const elapsed = performance.now() - t0;
                for (const seg of segs) {
                    if (seg.isConnector) {
                        if (elapsed < seg.startMs) {
                            this._setVisible(seg.item, false);
                            continue;
                        }
                        this._setVisible(seg.item, true);
                    }
                    const t = animEaseCubicInOut(
                        (elapsed - seg.startMs) / Math.max(1, seg.endMs - seg.startMs),
                    );
                    const pos = animLerp3(seg.item.startPosition, seg.item.finalPosition, t);
                    try {
                        seg.item.root.position.set(pos[0], pos[1], pos[2]);
                    } catch { /* ignore */ }
                }
                this._requestRender(2);
                if (elapsed >= lastEnd) { resolve(); return; }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
        // dociągnij wszystkie do finałowej pozycji
        for (const seg of segs) {
            this._setVisible(seg.item, true);
            try {
                seg.item.root.position.set(seg.item.finalPosition[0], seg.item.finalPosition[1], seg.item.finalPosition[2]);
            } catch { /* ignore */ }
        }
        this._requestRender(3);
        return !token.cancelled;
    }
}

function delay(ms: number, token: { cancelled: boolean }): Promise<void> {
    return new Promise((resolve) => {
        const deadline = performance.now() + ms;
        const tick = () => {
            if (token.cancelled || performance.now() >= deadline) { resolve(); return; }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

// ─── Nagrywarka WebM w rozdzielczości docelowej ───

export interface RecordingResult {
    ok: boolean;
    blob: Blob | null;
    width: number;
    height: number;
    error?: string;
}

/**
 * Ustawia rozdzielczość renderu Babylon na width×height (niezależnie od okna CSS),
 * nagrywa podczas `task` przez MediaRecorder, na końcu przywraca rozmiar.
 */
export async function recordViewportVideo(
    width: number,
    height: number,
    fps: number,
    task: () => Promise<void>,
): Promise<RecordingResult> {
    const viewport = ContextManager.instance?.viewport;
    const engine = viewport?.engine;
    const canvas: HTMLCanvasElement | undefined = viewport?.canvas;
    if (!engine || !canvas) {
        return { ok: false, blob: null, width, height, error: 'Brak widoku 3D.' };
    }

    const prevW = engine.getRenderWidth?.() ?? canvas.width;
    const prevH = engine.getRenderHeight?.() ?? canvas.height;

    try {
        engine.setSize(width, height);
        if (typeof (canvas as any).captureStream !== 'function') {
            return { ok: false, blob: null, width, height, error: 'Brak captureStream w tej przeglądarce.' };
        }
        const stream = (canvas as any).captureStream(fps) as MediaStream;
        const mimeType = pickWebmMimeType();
        const recorder = new MediaRecorder(stream, {
            mimeType: mimeType || undefined,
            videoBitsPerSecond: bitrateFor(width, height, fps),
        });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.start(250);

        try {
            await task();
        } finally {
            const stopped = new Promise<void>((resolve) => {
                if (!recorder) resolve();
                else recorder.onstop = () => resolve();
            });
            await new Promise((r) => setTimeout(r, 150)); // margines na ostatnią klatkę
            try { recorder.stop(); } catch { /* już stop */ }
            await stopped;
            stream.getTracks().forEach((t) => t.stop());
        }

        const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
        return { ok: blob.size > 0, blob, width, height };
    } catch (err: any) {
        return { ok: false, blob: null, width, height, error: String(err?.message || err) };
    } finally {
        try { engine.setSize(prevW, prevH); } catch { /* ignore */ }
        viewport.requestRender?.(4);
    }
}

function pickWebmMimeType(): string {
    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    if (typeof MediaRecorder === 'undefined') return '';
    for (const mime of candidates) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return '';
}

/** ~0.09 bit/px/frame → 1080p30 ≈ 5.6 Mbps, 4K30 ≈ 22 Mbps (clamp 3..80 Mbps). */
function bitrateFor(width: number, height: number, fps: number): number {
    return Math.min(80_000_000, Math.max(3_000_000, Math.round(width * height * fps * 0.09)));
}

/** Zapisz wynik nagrywania jako .webm. */
export function downloadRecording(result: RecordingResult, baseName: string = 'Instrukcja_montazu'): void {
    if (!result.ok || !result.blob) return;
    try {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_${result.width}x${result.height}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch (err) {
        console.error('[assembly-anim] download failed:', err);
    }
}
