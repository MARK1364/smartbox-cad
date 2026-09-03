/**
 * PMI Data Module — TypeScript
 *
 * Model danych wymiarów CAD. Odpowiednik `pmi_data.py` (wymiary + miarki).
 *
 * ZASADY TRWAŁOŚCI (odpowiednik PropertyGroup + SmartID z Blendera):
 * 1. Kotwice opisane są przez `PMIAnchorRef` — stabilne ID węzła dokumentu
 *    plus punkt w jego układzie lokalnym. Nazwy siatek Babylona nie są trwałe.
 * 2. Odsunięcie linii wymiarowej trzymane jest w tym samym układzie lokalnym,
 *    dzięki czemu podąża za obrotem formatki (jak `offset_vec_local`).
 * 3. `distanceMM` i `text` są wartościami pochodnymi — przeliczanymi przy każdym
 *    renderze, nigdy nie traktowanymi jako źródło prawdy.
 */

import { Vec3, v3 } from './dimension-solver';
// Import wyłącznie typu — model danych nie może zależeć od warstwy Babylona.
import type { PMIAnchorRef } from './pmi-id-bridge';
import {
    cadDeltasFromRender,
    significantDeltaAxes,
    shouldShowDeltas,
    measurementPathLength,
} from './pmi-measure';

// ============================================================================
// UNIT FORMATTING
// ============================================================================

export type UnitMode = 'AUTO' | 'METRIC_MM' | 'METRIC_M' | 'IMPERIAL';

/**
 * Formatuje dystans w mm (Babylon units) na string z jednostką.
 * Odpowiednik format_distance() z Pythona.
 */
export function formatDistance(valueMM: number, unitMode: UnitMode = 'AUTO', showUnits = true): string {
    const join = (num: string, u: string) => showUnits ? `${num} ${u}` : num;

    switch (unitMode) {
        case 'METRIC_M':
            return join((valueMM / 1000).toFixed(4), 'm');
        case 'IMPERIAL':
            return join((valueMM / 25.4).toFixed(2), '"');
        case 'METRIC_MM':
        case 'AUTO':
        default:
            return join(valueMM.toFixed(1), 'mm');
    }
}

export function formatMeasureText(p1: Vec3, p2: Vec3, unitMode: UnitMode = 'AUTO', showUnits = true): string {
    const deltas = cadDeltasFromRender(p1, p2);
    const lines = [`L: ${formatDistance(deltas.length, unitMode, showUnits)}`];
    if (shouldShowDeltas(deltas)) {
        for (const axis of significantDeltaAxes(deltas)) {
            const value = axis === 'X' ? deltas.dX : axis === 'Y' ? deltas.dY : deltas.dZ;
            lines.push(`d${axis}: ${formatDistance(value, unitMode, showUnits)}`);
        }
    }
    return lines.join('\n');
}

/** Wartości pochodne miarki — jedno źródło prawdy dla store i resolve. */
export function computeMeasurementDerived(
    p1: Vec3,
    p2: Vec3,
    via: Vec3 | null,
    unitMode: UnitMode,
    showUnits: boolean,
): { distanceMM: number; text: string } {
    const distanceMM = measurementPathLength(p1, p2, via);
    const text = via
        ? `L: ${formatDistance(distanceMM, unitMode, showUnits)}`
        : formatMeasureText(p1, p2, unitMode, showUnits);
    return { distanceMM, text };
}

// ============================================================================
// DATA INTERFACES
// ============================================================================

export type AxisSpace = 'GLOBAL' | 'LOCAL' | 'ALIGNED';
export type MeasureAxisKey = 'AUTO' | 'X' | 'Y' | 'Z';
export type OffsetSpace = 'LOCAL' | 'WORLD';

export interface PMIAnnotation {
    /** Unique ID */
    id: string;
    /** Ścieżka SmartID wymiaru (`dim:<id>`) w globalnym rejestrze. */
    smartIdPath: string;

    /** Trwałe odniesienia do punktów zaczepienia. */
    anchor1: PMIAnchorRef;
    anchor2: PMIAnchorRef;

    /**
     * Wektor odsunięcia linii wymiarowej. Wyrażony w układzie lokalnym węzła
     * kotwicy 1, gdy `offsetSpace === 'LOCAL'`; inaczej w przestrzeni świata.
     */
    offset: Vec3;
    offsetSpace: OffsetSpace;

    /** Kierunek krawędzi w układzie lokalnym odpowiedniej kotwicy (podpowiedź dla solvera). */
    edgeDir1Local: Vec3 | null;
    edgeDir2Local: Vec3 | null;
    /** Normalna ściany w układzie lokalnym odpowiedniej kotwicy. */
    faceNormal1Local: Vec3 | null;
    faceNormal2Local: Vec3 | null;

    /** Ostatnio przeliczona długość [mm]. Wartość pochodna — patrz nagłówek pliku. */
    distanceMM: number;
    /** Oś wybrana ostatecznie przez bridge (do wyświetlenia w panelu). */
    resolvedAxis: string;

    axisSpace: AxisSpace;
    measureAxisKey: MeasureAxisKey;
    offsetAxisKey: string;

    /** Tekst wyświetlany — pochodna distanceMM oraz prefiksu/sufiksu. */
    text: string;
    textPrefix: string;
    textSuffix: string;

    /** UI state */
    visible: boolean;
    selected: boolean;
}

/** Dane wejściowe do utworzenia adnotacji; reszta pól ma wartości domyślne. */
export type PMIAnnotationInit =
    Pick<PMIAnnotation, 'anchor1' | 'anchor2' | 'offset' | 'offsetSpace' | 'axisSpace' | 'measureAxisKey'>
    & Partial<PMIAnnotation>;

/** Lekka miarka — odcinek + długość + opcjonalne delty, bez linii wymiarowej CAD. */
export interface PMIMeasurement {
    id: string;
    anchor1: PMIAnchorRef;
    anchor2: PMIAnchorRef;
    /** Punkt pośredni łańcucha połączonych krawędzi (Ctrl). */
    viaAnchor?: PMIAnchorRef | null;
    distanceMM: number;
    text: string;
    visible: boolean;
    selected: boolean;
}

export type PMIMeasurementInit =
    Pick<PMIMeasurement, 'anchor1' | 'anchor2'>
    & Partial<PMIMeasurement>;

export interface PMISettingsJSON {
    unitMode: UnitMode;
    showUnits: boolean;
    textSizeMM: number;
    lineWidthMM: number;
    dimColor: [number, number, number, number];
    selectedColor: [number, number, number, number];
    edgeSnapPx?: number;
    vertexSnapPx?: number;
}

export interface PMIStoreJSON {
    version: number;
    settings: PMISettingsJSON;
    annotations: PMIAnnotation[];
    measurements?: PMIMeasurement[];
}

/** Faza narzędzia tworzenia wymiaru — do podpowiedzi w panelu. */
export type PMIToolPhase = 'idle' | 'PICK_P1' | 'PICK_P2' | 'DRAG_OFFSET';

// ============================================================================
// PMI STORE — Singleton managing annotation collection
// ============================================================================

const PMI_FORMAT_VERSION = 1;

export type PMIChangeListener = () => void;

export class PMIStore {
    private static _instance: PMIStore | null = null;

    /** All dimension annotations */
    public annotations: PMIAnnotation[] = [];

    /** Lekkie miarki (pomiar bez linii wymiarowej). */
    public measurements: PMIMeasurement[] = [];

    /** Currently active (selected) annotation index */
    public activeIndex = -1;
    public activeMeasurementIndex = -1;

    /** Global settings */
    public unitMode: UnitMode = 'METRIC_MM';
    public showUnits = true;
    public dimColor: [number, number, number, number] = [0.05, 0.05, 0.05, 1.0];
    public selectedColor: [number, number, number, number] = [1.0, 0.45, 0.0, 1.0];
    public textSizeMM = 14; // world-space text cap height in mm
    public lineWidthMM = 2.0;

    /** Promień chwytania krawędzi w pikselach ekranu. */
    public edgeSnapPx = 14;
    /** Promień chwytania narożnika — mniejszy niż krawędzi, żeby rogi nie kradły kliknięć. */
    public vertexSnapPx = 6;

    /** Wspólne ustawienia narzędzia tworzenia (panel + pasek narzędzi). */
    public toolAxisSpace: AxisSpace = 'GLOBAL';
    public toolMeasureAxis: MeasureAxisKey = 'AUTO';

    /** Podgląd na żywo — aktualizowany przez DimensionTool. */
    public toolLivePhase: PMIToolPhase = 'idle';
    public toolLiveOffsetAxis = '';
    public toolLiveOffsetSpace: AxisSpace | '' = '';

    private _nextId = 1;
    private _nextMeasureId = 1;
    private _listeners: PMIChangeListener[] = [];
    private _derivedListeners: PMIChangeListener[] = [];
    private _toolLiveListeners: PMIChangeListener[] = [];

    static get instance(): PMIStore {
        if (!PMIStore._instance) PMIStore._instance = new PMIStore();
        return PMIStore._instance;
    }

    private _generateId(): string {
        return `dim_${this._nextId++}`;
    }

    private _generateMeasureId(): string {
        return `msr_${this._nextMeasureId++}`;
    }

    // --- Subscriptions ---

    public onChange(listener: PMIChangeListener): () => void {
        this._listeners.push(listener);
        return () => { this._listeners = this._listeners.filter(l => l !== listener); };
    }

    public notifyChanged(): void {
        this._notify();
    }

    /**
     * Kanał dla wartości pochodnych (przeliczona długość, tekst etykiety).
     *
     * Celowo oddzielony od `onChange`: renderer aktualizuje te pola w trakcie
     * rysowania, a powiadomienie głównym kanałem zleciłoby kolejny render i
     * doprowadziło do zapętlenia.
     */
    public onDerivedChange(listener: PMIChangeListener): () => void {
        this._derivedListeners.push(listener);
        return () => { this._derivedListeners = this._derivedListeners.filter(l => l !== listener); };
    }

    public notifyDerivedChanged(): void {
        for (const l of this._derivedListeners) l();
    }

    /** Podgląd fazy narzędzia / osi odsunięcia (panel PMI). */
    public onToolLiveChange(listener: PMIChangeListener): () => void {
        this._toolLiveListeners.push(listener);
        return () => { this._toolLiveListeners = this._toolLiveListeners.filter(l => l !== listener); };
    }

    public notifyToolLiveChanged(): void {
        for (const l of this._toolLiveListeners) l();
    }

    private _notify(): void {
        for (const l of this._listeners) l();
    }

    // --- CRUD ---

    public addAnnotation(data: PMIAnnotationInit): PMIAnnotation {
        const ann: PMIAnnotation = {
            smartIdPath: '',
            edgeDir1Local: null,
            edgeDir2Local: null,
            faceNormal1Local: null,
            faceNormal2Local: null,
            distanceMM: 0,
            resolvedAxis: 'AUTO',
            offsetAxisKey: '',
            textPrefix: '',
            textSuffix: '',
            visible: true,
            selected: false,
            ...data,
            id: data.id ?? this._generateId(),
            text: '',
        };
        ann.text = this.formatAnnotationText(ann);

        this.annotations.push(ann);
        this.activeIndex = this.annotations.length - 1;
        this._notify();
        return ann;
    }

    /**
     * Wstawia gotową adnotację na wskazaną pozycję — używane przy cofaniu usunięcia,
     * żeby zachować kolejność listy.
     */
    public insertAnnotation(ann: PMIAnnotation, index: number): void {
        const at = Math.max(0, Math.min(index, this.annotations.length));
        this.annotations.splice(at, 0, ann);
        this._syncNextIdWith(ann.id);
        this._notify();
    }

    public removeAnnotation(id: string): { annotation: PMIAnnotation; index: number } | null {
        const index = this.annotations.findIndex(a => a.id === id);
        if (index === -1) return null;

        const [annotation] = this.annotations.splice(index, 1);
        if (this.activeIndex >= this.annotations.length) {
            this.activeIndex = this.annotations.length - 1;
        }
        this._notify();
        return { annotation, index };
    }

    public getAnnotation(id: string): PMIAnnotation | null {
        return this.annotations.find(a => a.id === id) ?? null;
    }

    public clearAll(): PMIAnnotation[] {
        const removed = this.annotations;
        this.annotations = [];
        this.activeIndex = -1;
        this._notify();
        return removed;
    }

    public replaceAll(annotations: PMIAnnotation[]): void {
        this.annotations = annotations;
        this.activeIndex = annotations.length ? 0 : -1;
        for (const ann of annotations) this._syncNextIdWith(ann.id);
        this._notify();
    }

    public selectAnnotation(index: number): void {
        for (const a of this.annotations) a.selected = false;
        for (const m of this.measurements) m.selected = false;
        this.activeMeasurementIndex = -1;
        if (index >= 0 && index < this.annotations.length) {
            this.annotations[index].selected = true;
            this.activeIndex = index;
        } else {
            this.activeIndex = -1;
        }
        this._notify();
    }

    public selectById(id: string): void {
        this.selectAnnotation(this.annotations.findIndex(a => a.id === id));
    }

    public deselectAll(): void {
        for (const a of this.annotations) a.selected = false;
        for (const m of this.measurements) m.selected = false;
        this.activeIndex = -1;
        this.activeMeasurementIndex = -1;
        this._notify();
    }

    public setVisibility(id: string, visible: boolean): void {
        const ann = this.getAnnotation(id);
        if (!ann || ann.visible === visible) return;
        ann.visible = visible;
        this._notify();
    }

    public toggleAllVisibility(): void {
        const allVisible = this.annotations.every(a => a.visible);
        for (const a of this.annotations) a.visible = !allVisible;
        this._notify();
    }

    // --- Measurements (miarka) ---

    public addMeasurement(data: PMIMeasurementInit): PMIMeasurement {
        const item: PMIMeasurement = {
            distanceMM: 0,
            text: '',
            visible: true,
            selected: false,
            ...data,
            id: data.id ?? this._generateMeasureId(),
        };
        this.measurements.push(item);
        this.selectMeasurement(this.measurements.length - 1);
        return item;
    }

    public insertMeasurement(item: PMIMeasurement, index: number): void {
        const at = Math.max(0, Math.min(index, this.measurements.length));
        this.measurements.splice(at, 0, item);
        this._syncMeasureIdWith(item.id);
        this._notify();
    }

    public removeMeasurement(id: string): { measurement: PMIMeasurement; index: number } | null {
        const index = this.measurements.findIndex(m => m.id === id);
        if (index === -1) return null;
        const [measurement] = this.measurements.splice(index, 1);
        if (this.activeMeasurementIndex >= this.measurements.length) {
            this.activeMeasurementIndex = this.measurements.length - 1;
        }
        this._notify();
        return { measurement, index };
    }

    public getMeasurement(id: string): PMIMeasurement | null {
        return this.measurements.find(m => m.id === id) ?? null;
    }

    public clearAllMeasurements(): PMIMeasurement[] {
        const removed = this.measurements;
        this.measurements = [];
        this.activeMeasurementIndex = -1;
        this._notify();
        return removed;
    }

    public replaceAllMeasurements(items: PMIMeasurement[]): void {
        this.measurements = items;
        this.activeMeasurementIndex = items.length ? 0 : -1;
        for (const item of items) this._syncMeasureIdWith(item.id);
        this._notify();
    }

    public selectMeasurement(index: number): void {
        for (const a of this.annotations) a.selected = false;
        for (const m of this.measurements) m.selected = false;
        this.activeIndex = -1;
        if (index >= 0 && index < this.measurements.length) {
            this.measurements[index].selected = true;
            this.activeMeasurementIndex = index;
        } else {
            this.activeMeasurementIndex = -1;
        }
        this._notify();
    }

    public selectMeasurementById(id: string): void {
        this.selectMeasurement(this.measurements.findIndex(m => m.id === id));
    }

    public setMeasurementVisibility(id: string, visible: boolean): void {
        const item = this.getMeasurement(id);
        if (!item || item.visible === visible) return;
        item.visible = visible;
        this._notify();
    }

    public applyMeasurementValue(item: PMIMeasurement, p1: Vec3, p2: Vec3, via: Vec3 | null = null): boolean {
        const derived = computeMeasurementDerived(p1, p2, via, this.unitMode, this.showUnits);
        const changed = Math.abs(item.distanceMM - derived.distanceMM) > 1e-6 || item.text !== derived.text;
        item.distanceMM = derived.distanceMM;
        item.text = derived.text;
        return changed;
    }

    public setOffset(id: string, offset: Vec3, offsetSpace: OffsetSpace): void {
        this.setPlacement(id, { offset, offsetSpace });
    }

    public setPlacement(
        id: string,
        fields: {
            offset?: Vec3;
            offsetSpace?: OffsetSpace;
            axisSpace?: AxisSpace;
            offsetAxisKey?: string;
        },
    ): void {
        const ann = this.getAnnotation(id);
        if (!ann) return;
        if (fields.offset) ann.offset = fields.offset;
        if (fields.offsetSpace) ann.offsetSpace = fields.offsetSpace;
        if (fields.axisSpace) ann.axisSpace = fields.axisSpace;
        if (fields.offsetAxisKey !== undefined) ann.offsetAxisKey = fields.offsetAxisKey;
        this._notify();
    }

    public setAffixes(id: string, prefix: string, suffix: string): void {
        const ann = this.getAnnotation(id);
        if (!ann) return;
        ann.textPrefix = prefix;
        ann.textSuffix = suffix;
        ann.text = this.formatAnnotationText(ann);
        this._notify();
    }

    // --- Text formatting ---

    public formatAnnotationText(ann: PMIAnnotation): string {
        const valueText = formatDistance(ann.distanceMM, this.unitMode, this.showUnits);
        return `${ann.textPrefix}${valueText}${ann.textSuffix}`;
    }

    public updateAllTexts(): void {
        for (const ann of this.annotations) {
            ann.text = this.formatAnnotationText(ann);
        }
        this._notify();
    }

    /**
     * Zapisuje przeliczoną długość i odświeża etykietę.
     * @returns true, jeśli cokolwiek się zmieniło (renderer unika wtedy zbędnej pracy).
     */
    public applyMeasuredValue(ann: PMIAnnotation, distanceMM: number, resolvedAxis: string): boolean {
        const text = `${ann.textPrefix}${formatDistance(distanceMM, this.unitMode, this.showUnits)}${ann.textSuffix}`;
        const changed = Math.abs(ann.distanceMM - distanceMM) > 1e-6
            || ann.text !== text
            || ann.resolvedAxis !== resolvedAxis;

        ann.distanceMM = distanceMM;
        ann.resolvedAxis = resolvedAxis;
        ann.text = text;
        return changed;
    }

    // --- Serialization (sekcja `pmi` w pliku projektu) ---

    public toJSON(): PMIStoreJSON {
        return {
            version: PMI_FORMAT_VERSION,
            settings: {
                unitMode: this.unitMode,
                showUnits: this.showUnits,
                textSizeMM: this.textSizeMM,
                lineWidthMM: this.lineWidthMM,
                dimColor: [...this.dimColor],
                selectedColor: [...this.selectedColor],
                edgeSnapPx: this.edgeSnapPx,
                vertexSnapPx: this.vertexSnapPx,
            },
            annotations: this.annotations.map(a => JSON.parse(JSON.stringify(a))),
            measurements: this.measurements.map(m => JSON.parse(JSON.stringify(m))),
        };
    }

    public fromJSON(data: PMIStoreJSON | null | undefined): void {
        if (!data || !Array.isArray(data.annotations)) {
            this.annotations = [];
            this.measurements = [];
            this.activeIndex = -1;
            this.activeMeasurementIndex = -1;
            this._nextId = 1;
            this._nextMeasureId = 1;
            this._notify();
            return;
        }

        const settings = data.settings;
        if (settings) {
            this.unitMode = settings.unitMode ?? this.unitMode;
            this.showUnits = settings.showUnits ?? this.showUnits;
            this.textSizeMM = settings.textSizeMM ?? this.textSizeMM;
            this.lineWidthMM = settings.lineWidthMM ?? this.lineWidthMM;
            if (settings.dimColor) this.dimColor = [...settings.dimColor];
            if (settings.selectedColor) this.selectedColor = [...settings.selectedColor];
            this.edgeSnapPx = settings.edgeSnapPx ?? this.edgeSnapPx;
            this.vertexSnapPx = settings.vertexSnapPx ?? this.vertexSnapPx;
        }

        this._nextId = 1;
        this._nextMeasureId = 1;
        this.annotations = data.annotations.map(raw => normalizeAnnotation(raw));
        for (const ann of this.annotations) this._syncNextIdWith(ann.id);

        this.measurements = Array.isArray(data.measurements)
            ? data.measurements.map(raw => normalizeMeasurement(raw))
            : [];
        for (const item of this.measurements) this._syncMeasureIdWith(item.id);

        this.activeIndex = -1;
        this.activeMeasurementIndex = -1;
        this._notify();
    }

    /** Utrzymuje licznik ID powyżej wartości wczytanych, żeby uniknąć kolizji. */
    private _syncNextIdWith(id: string): void {
        const match = /^dim_(\d+)$/.exec(id);
        if (!match) return;
        const num = Number(match[1]);
        if (Number.isFinite(num) && num >= this._nextId) {
            this._nextId = num + 1;
        }
    }

    private _syncMeasureIdWith(id: string): void {
        const match = /^msr_(\d+)$/.exec(id);
        if (!match) return;
        const num = Number(match[1]);
        if (Number.isFinite(num) && num >= this._nextMeasureId) {
            this._nextMeasureId = num + 1;
        }
    }
}

// ============================================================================
// NORMALIZATION
// ============================================================================

function readVec(raw: any, fallback: Vec3 | null): Vec3 | null {
    if (!raw || typeof raw !== 'object') return fallback;
    const { x, y, z } = raw;
    if ([x, y, z].every(n => typeof n === 'number' && Number.isFinite(n))) return v3(x, y, z);
    return fallback;
}

function normalizeAnchor(raw: any): PMIAnchorRef {
    const pointLocal = readVec(raw?.pointLocal, v3(0, 0, 0))!;
    return {
        nodeId: typeof raw?.nodeId === 'string' ? raw.nodeId : '',
        smartIdPath: typeof raw?.smartIdPath === 'string' ? raw.smartIdPath : '',
        kind: raw?.kind ?? 'FREE',
        subKey: typeof raw?.subKey === 'string' ? raw.subKey : '',
        subIndex: typeof raw?.subIndex === 'number' ? raw.subIndex : -1,
        pointLocal,
        pointWorldFallback: readVec(raw?.pointWorldFallback, pointLocal)!,
    };
}

/**
 * Domyka wczytaną adnotację do pełnego kształtu — plik projektu mógł powstać
 * we wcześniejszej wersji schematu.
 */
function normalizeAnnotation(raw: any): PMIAnnotation {
    return {
        id: typeof raw?.id === 'string' ? raw.id : `dim_${Date.now()}`,
        smartIdPath: typeof raw?.smartIdPath === 'string' ? raw.smartIdPath : '',
        anchor1: normalizeAnchor(raw?.anchor1),
        anchor2: normalizeAnchor(raw?.anchor2),
        offset: readVec(raw?.offset, v3(0, 0, 30))!,
        offsetSpace: raw?.offsetSpace === 'WORLD' ? 'WORLD' : 'LOCAL',
        edgeDir1Local: readVec(raw?.edgeDir1Local, null),
        edgeDir2Local: readVec(raw?.edgeDir2Local, null),
        faceNormal1Local: readVec(raw?.faceNormal1Local, null),
        faceNormal2Local: readVec(raw?.faceNormal2Local, null),
        distanceMM: typeof raw?.distanceMM === 'number' ? raw.distanceMM : 0,
        resolvedAxis: typeof raw?.resolvedAxis === 'string' ? raw.resolvedAxis : 'AUTO',
        axisSpace: raw?.axisSpace === 'LOCAL' || raw?.axisSpace === 'ALIGNED' ? raw.axisSpace : 'GLOBAL',
        measureAxisKey: ['AUTO', 'X', 'Y', 'Z'].includes(raw?.measureAxisKey) ? raw.measureAxisKey : 'AUTO',
        offsetAxisKey: typeof raw?.offsetAxisKey === 'string' ? raw.offsetAxisKey : '',
        text: typeof raw?.text === 'string' ? raw.text : '',
        textPrefix: typeof raw?.textPrefix === 'string' ? raw.textPrefix : '',
        textSuffix: typeof raw?.textSuffix === 'string' ? raw.textSuffix : '',
        visible: raw?.visible !== false,
        selected: false,
    };
}

function normalizeMeasurement(raw: any): PMIMeasurement {
    return {
        id: typeof raw?.id === 'string' ? raw.id : `msr_${Date.now()}`,
        anchor1: normalizeAnchor(raw?.anchor1),
        anchor2: normalizeAnchor(raw?.anchor2),
        viaAnchor: raw?.viaAnchor ? normalizeAnchor(raw.viaAnchor) : null,
        distanceMM: typeof raw?.distanceMM === 'number' ? raw.distanceMM : 0,
        text: typeof raw?.text === 'string' ? raw.text : '',
        visible: raw?.visible !== false,
        selected: false,
    };
}
