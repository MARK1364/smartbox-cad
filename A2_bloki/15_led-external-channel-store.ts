/**
 * Magazyn stanu kontenerów kanałów LED (LedChannelStore).
 * Zapewnia pełną asocjacyjność: przy każdej zmianie wymiarów szafek lub przesunięciu
 * automatycznie przelicza zasięg kontenera i aktualizuje frezowania w płytach.
 */

import { ContextManager } from '../A1_core/context-manager.js';
import type { DocumentExtension } from '../A1_core/project-document.js';
import {
    createDefaultLedChannel,
    type LedChannelDefinition,
} from './15_led-external-channel-types.js';
import {
    applyLedChannelToDocument,
    computeLedChannelWorldBox,
    removeLedChannelFromDocument,
    detectCabinetRow,
} from './15_led-external-channel-engine.js';
import { LedChannelPreview } from './15_led-external-channel-preview.js';

export type LedChannelListener = () => void;

export class LedChannelStore implements DocumentExtension {
    private static _instance: LedChannelStore | null = null;
    private _channels: LedChannelDefinition[] = [];
    private _activeChannelId: string | null = null;
    private _listeners: Set<LedChannelListener> = new Set();
    private _isSyncing = false;

    private constructor() {
        this._initEvents();
    }

    static get instance(): LedChannelStore {
        if (!this._instance) {
            this._instance = new LedChannelStore();
        }
        return this._instance;
    }

    private _initEvents(): void {
        const handleDocChange = () => {
            if (this._isSyncing) return;
            this.syncAll();
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('bloki-project-changed', handleDocChange);
            window.addEventListener('bloki-panel-changed', handleDocChange);
            window.addEventListener('solver-visibility-changed', handleDocChange);
        }
    }

    subscribe(listener: LedChannelListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    private _notify(): void {
        for (const l of this._listeners) {
            try {
                l();
            } catch (err) {
                console.error('LedChannelStore notify error:', err);
            }
        }
    }

    get channels(): readonly LedChannelDefinition[] {
        return this._channels;
    }

    get activeChannel(): LedChannelDefinition | null {
        if (!this._activeChannelId) {
            return this._channels[0] || null;
        }
        return this._channels.find((c) => c.id === this._activeChannelId) || this._channels[0] || null;
    }

    setActiveChannelId(id: string | null): void {
        this._activeChannelId = id;
        this._notify();
    }

    /**
     * Pobiera lub tworzy domyślny kanał LED (gdy lista jest pusta).
     */
    getOrCreateDefault(): LedChannelDefinition {
        if (this._channels.length === 0) {
            const def = createDefaultLedChannel();
            this._channels.push(def);
            this._activeChannelId = def.id;
            this._notify();
            return def;
        }
        return this.activeChannel || this._channels[0];
    }

    addChannel(name?: string): LedChannelDefinition {
        const def = createDefaultLedChannel();
        if (name) def.name = name;
        this._channels.push(def);
        this._activeChannelId = def.id;
        this.syncChannel(def);
        this._notify();
        return def;
    }

    updateChannel(id: string, updates: Partial<LedChannelDefinition>): void {
        const idx = this._channels.findIndex((c) => c.id === id);
        if (idx === -1) return;
        this._channels[idx] = { ...this._channels[idx], ...updates };
        const updated = this._channels[idx];
        this.syncChannel(updated);
        this._notify();
    }

    removeChannel(id: string): void {
        const doc = ContextManager.instance?.document;
        removeLedChannelFromDocument(doc, id);
        LedChannelPreview.remove(id);
        this._channels = this._channels.filter((c) => c.id !== id);
        if (this._activeChannelId === id) {
            this._activeChannelId = this._channels[0]?.id || null;
        }
        this._notify();
    }

    deleteChannel(id: string): void {
        this.removeChannel(id);
        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }

    toggleVisibility(id: string): void {
        const ch = this._channels.find((c) => c.id === id);
        if (!ch) return;
        const nextVis = ch.visible === false ? true : false;
        this.updateChannel(id, { visible: nextVis });
        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }

    toggleFreeze(id: string): void {
        const ch = this._channels.find((c) => c.id === id);
        if (!ch) return;
        const nextFrozen = !ch.frozen;
        this.updateChannel(id, { frozen: nextFrozen });
        if (typeof window !== 'undefined') {
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
        }
    }

    /**
     * Przelicza i aplikuje wskazany kanał LED do formatek oraz odświeża podgląd 3D.
     */
    syncChannel(def: LedChannelDefinition): void {
        const doc = ContextManager.instance?.document;
        if (!doc) return;

        this._isSyncing = true;
        try {
            const isVisible = def.visible !== false && def.enabled;
            if (!isVisible) {
                removeLedChannelFromDocument(doc, def.id);
                LedChannelPreview.remove(def.id);
            } else {
                const box = computeLedChannelWorldBox(doc, def);
                LedChannelPreview.update(def.id, box);
                applyLedChannelToDocument(doc, def);
            }
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * Asocjacyjna synchronizacja wszystkich kanałów (np. po zmianie szerokości korpusu).
     */
    syncAll(): void {
        const doc = ContextManager.instance?.document;
        if (!doc) return;

        this._isSyncing = true;
        try {
            for (const ch of this._channels) {
                if (ch.frozen) continue; // Zamrożony kanał nie jest automatycznie modyfikowany
                const isVisible = ch.visible !== false && ch.enabled;
                if (!isVisible) {
                    removeLedChannelFromDocument(doc, ch.id);
                    LedChannelPreview.remove(ch.id);
                } else {
                    const box = computeLedChannelWorldBox(doc, ch);
                    LedChannelPreview.update(ch.id, box);
                    applyLedChannelToDocument(doc, ch);
                }
            }
        } finally {
            this._isSyncing = false;
        }
    }

    // ─── DocumentExtension (Serializacja w ProjectDocument) ───

    serialize(): any {
        return {
            version: 1,
            channels: JSON.parse(JSON.stringify(this._channels)),
            activeChannelId: this._activeChannelId,
        };
    }

    load(data: any): void {
        if (!data || !Array.isArray(data.channels)) {
            this._channels = [];
            this._activeChannelId = null;
            LedChannelPreview.clearAll();
            this._notify();
            return;
        }
        this._channels = data.channels;
        this._activeChannelId = data.activeChannelId || this._channels[0]?.id || null;
        this.syncAll();
        this._notify();
    }
}

/**
 * Zatrzymuje asystenta / kreator wskazywania referencji kanału LED.
 */
export function stopGuidedLedPick(): void {
    if (ContextManager.instance.activeReferencePicker?.source?.startsWith('led-guided-')) {
        delete ContextManager.instance.activeReferencePicker;
    }
    const picker = ContextManager.instance.facePicker as any;
    if (picker?.resetAllFaceHighlights) picker.resetAllFaceHighlights();
    else if (picker?.clearSelection) picker.clearSelection();
    ContextManager.instance.appAPI?.setSelectionMode?.('object');
    ContextManager.instance.appAPI?.setStatus?.('Gotowy');
}

/**
 * Asystent krok-po-kroku konfiguracji kanału LED:
 * 1. Spód wieńca ('bottom')
 * 2. Czoło/płaszczyzna frontowa ('front')
 * 3. Lewy skrajny bok ('left')
 * 4. Prawy skrajny bok ('right') -> finalizacja i wycięcie kanału.
 */
export function startGuidedLedPick(
    channelId: string,
    step: 'bottom' | 'front' | 'left' | 'right' = 'bottom',
    onComplete?: () => void,
): void {
    const store = LedChannelStore.instance;
    const ch = store.channels.find((c) => c.id === channelId) || store.getOrCreateDefault();

    const picker = ContextManager.instance.facePicker as any;
    if (picker?.resetAllFaceHighlights) picker.resetAllFaceHighlights();
    else if (picker?.clearSelection) picker.clearSelection();

    ContextManager.instance.appAPI?.setSelectionMode?.('subgeometry');

    const stepConfig = {
        bottom: {
            title: 'Krok 1/4: Wskaż w 3D spód wieńca (Dół)',
            field: 'refBottom' as const,
            next: 'front' as const,
        },
        front: {
            title: 'Krok 2/4: Wskaż w 3D płaszczyznę frontową / czoło (Przód)',
            field: 'refFront' as const,
            next: 'left' as const,
        },
        left: {
            title: 'Krok 3/4: Wskaż w 3D lewy skrajny bok (Bok L)',
            field: 'refLeft' as const,
            next: 'right' as const,
        },
        right: {
            title: 'Krok 4/4: Wskaż w 3D prawy skrajny bok (Bok P)',
            field: 'refRight' as const,
            next: null,
        },
    }[step];

    ContextManager.instance.appAPI?.setStatus?.(stepConfig.title, true);

    ContextManager.instance.activeReferencePicker = {
        source: `led-guided-${ch.id}-${step}`,
        onSelect: (refData: { nodeId?: string; face?: string; panelModel?: any; partKey?: string }) => {
            const nodeId = refData.nodeId || refData.panelModel?.id;
            const face = refData.face || 'FACE_Z_MINUS';
            if (!nodeId) return;

            const label = refData.panelModel?.name || refData.partKey || nodeId;
            const ref = {
                nodeId,
                face,
                label,
            };

            store.updateChannel(ch.id, { [stepConfig.field]: ref });

            if (stepConfig.next) {
                // Przejdź do kolejnego kroku sekwencji
                startGuidedLedPick(ch.id, stepConfig.next, onComplete);
            } else {
                stopGuidedLedPick();
                ContextManager.instance.appAPI?.setStatus?.('✅ LED zewnętrzny (kanał) został poprawnie skonfigurowany!', false);
                onComplete?.();
            }
        },
    };
}

/**
 * Obsługa upuszczenia (Drag & Drop) karty kanału LED na płytę wieńca w scenie 3D.
 * PEŁNY AUTOMAT: Wykrywa szafkę i cały rząd sąsiednich szafek wiszących (o tym samym dnie i froncie),
 * natychmiast wyznacza skrajne boki, przód i spód oraz frezuje ciągły wpust LED przez cały rząd!
 */
export function handleLedChannelDrop(pick: any, channelId?: string): boolean {
    const md = pick?.pickedMesh?.metadata || pick?.pickedMesh?.parent?.metadata;
    const panel = md?.panelModel;
    if (!panel) return false;

    const doc = ContextManager.instance.document;
    const store = LedChannelStore.instance;
    const ch = channelId
        ? (store.channels.find((c) => c.id === channelId) || store.getOrCreateDefault())
        : store.getOrCreateDefault();

    // 1. Próba automatycznej detekcji rzędu szafek
    const row = detectCabinetRow(doc, panel.id);

    if (row) {
        store.updateChannel(ch.id, {
            refLeft: row.refLeft,
            refRight: row.refRight,
            refBottom: row.refBottom,
            refFront: row.refFront,
            refTop: row.refTop,
            refBack: row.refBack,
            scope: 'row',
            rowCabinetIds: row.cabinetIds,
            rowCabinetCount: row.cabinetCount,
            detectedWidthMm: row.totalWidthMm,
        });

        const msg = row.cabinetCount > 1
            ? `✅ Wykryto rząd ${row.cabinetCount} szafek (${Math.round(row.totalWidthMm)} mm) — kanał LED wygenerowany automatycznie!`
            : `✅ Wykryto szafkę (${Math.round(row.totalWidthMm)} mm) — kanał LED wygenerowany automatycznie!`;
        ContextManager.instance.appAPI?.setStatus?.(msg, false);
        return true;
    }

    // Fallback: pojedyncza formatka
    const rawFace = md?.faceName || 'FACE_Z_MINUS';
    const refBottom = {
        nodeId: panel.id,
        face: rawFace,
        label: panel.name || 'Wieniec Dolny',
    };
    store.updateChannel(ch.id, { refBottom });
    startGuidedLedPick(ch.id, 'front');
    return true;
}
