/**
 * PMI Commands — TypeScript
 *
 * Operacje na wymiarach wpięte w `CommandHistory`, dzięki czemu dodanie,
 * usunięcie i edycja wymiaru podlegają Ctrl+Z tak samo jak reszta modelu.
 *
 * Adnotacje żyją w `PMIStore`, a nie w drzewie `CADNode`, więc komendy nie
 * modyfikują `ProjectDocument` — parametr `document` jest częścią wspólnego
 * kontraktu `Command` i pozostaje nieużywany.
 */

import { Command } from '../A1_core/commands/command';
import { ContextManager } from '../A1_core/context-manager';
import { Vec3 } from './dimension-solver';
import { AxisSpace, OffsetSpace, PMIAnnotation, PMIAnnotationInit, PMIMeasurement, PMIMeasurementInit, PMIStore } from './pmi-data';
import { registerDimensionSmartId, unregisterDimensionSmartId } from './pmi-id-bridge';

/**
 * Wykonuje komendę PMI przez wspólną historię aplikacji.
 *
 * Gdy historia nie jest jeszcze gotowa (np. testy albo bardzo wczesny start),
 * zmiana i tak zostaje zastosowana — traci jedynie możliwość cofnięcia.
 */
export function executePMICommand(command: Command): void {
    const history = ContextManager.instance.commandHistory;
    if (history) {
        history.execute(command);
        return;
    }
    console.warn('[PMI] Brak CommandHistory — zmiana wykonana poza historią.');
    command.execute(null as any);
}

/** Usuwa aktualnie zaznaczony wymiar lub pomiar. */
export function deleteActiveDimension(store: PMIStore = PMIStore.instance): boolean {
    const mIdx = store.activeMeasurementIndex;
    if (mIdx >= 0 && mIdx < store.measurements.length) {
        executePMICommand(new RemoveMeasurementCommand(store, store.measurements[mIdx].id));
        return true;
    }
    const idx = store.activeIndex;
    if (idx < 0 || idx >= store.annotations.length) return false;
    executePMICommand(new RemoveDimensionCommand(store, store.annotations[idx].id));
    return true;
}

let _commandSeq = 0;

function nextCommandId(kind: string): string {
    _commandSeq += 1;
    return `cmd_pmi_${kind}_${Date.now()}_${_commandSeq}`;
}

/** Węzły dotknięte zmianą — pozwalają UI odświeżyć właściwe fragmenty drzewa. */
function affectedNodesOf(ann: Pick<PMIAnnotation, 'anchor1' | 'anchor2'>): string[] {
    return [ann.anchor1?.nodeId, ann.anchor2?.nodeId].filter((id): id is string => !!id);
}

// ============================================================================
// ADD
// ============================================================================

export class AddDimensionCommand implements Command {
    readonly id = nextCommandId('add');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly store: PMIStore;
    private readonly init: PMIAnnotationInit;
    private created: PMIAnnotation | null = null;

    constructor(store: PMIStore, init: PMIAnnotationInit, label = 'Dodano wymiar') {
        this.store = store;
        this.init = init;
        this.label = label;
        this.affectedNodeIds = affectedNodesOf(init);
    }

    execute(): void {
        // Przy redo odtwarzamy dokładnie ten sam obiekt, żeby zachować ID i SmartID.
        if (this.created) {
            this.store.insertAnnotation(this.created, this.store.annotations.length);
            registerDimensionSmartId(this.created.id, this.created.anchor1);
            return;
        }

        const ann = this.store.addAnnotation(this.init);
        ann.smartIdPath = registerDimensionSmartId(ann.id, ann.anchor1);
        this.created = ann;
    }

    undo(): void {
        if (!this.created) return;
        this.store.removeAnnotation(this.created.id);
        unregisterDimensionSmartId(this.created.smartIdPath);
    }

    get annotation(): PMIAnnotation | null {
        return this.created;
    }
}

// ============================================================================
// REMOVE
// ============================================================================

export class RemoveDimensionCommand implements Command {
    readonly id = nextCommandId('remove');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly store: PMIStore;
    private readonly annotationId: string;
    private removed: PMIAnnotation | null = null;
    private removedIndex = -1;

    constructor(store: PMIStore, annotationId: string, label = 'Usunięto wymiar') {
        const existing = store.getAnnotation(annotationId);
        if (!existing) {
            throw new Error(`RemoveDimensionCommand: wymiar "${annotationId}" nie istnieje.`);
        }
        this.store = store;
        this.annotationId = annotationId;
        this.label = label;
        this.affectedNodeIds = affectedNodesOf(existing);
    }

    execute(): void {
        const result = this.store.removeAnnotation(this.annotationId);
        if (!result) return;
        this.removed = result.annotation;
        this.removedIndex = result.index;
        unregisterDimensionSmartId(result.annotation.smartIdPath);
    }

    undo(): void {
        if (!this.removed) return;
        this.store.insertAnnotation(this.removed, this.removedIndex);
        this.removed.smartIdPath = registerDimensionSmartId(this.removed.id, this.removed.anchor1);
    }
}

// ============================================================================
// CLEAR ALL
// ============================================================================

export class ClearDimensionsCommand implements Command {
    readonly id = nextCommandId('clear');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[] = [];

    private readonly store: PMIStore;
    private removed: PMIAnnotation[] = [];

    constructor(store: PMIStore, label = 'Usunięto wszystkie wymiary') {
        this.store = store;
        this.label = label;
    }

    execute(): void {
        this.removed = this.store.clearAll();
        for (const ann of this.removed) unregisterDimensionSmartId(ann.smartIdPath);
    }

    undo(): void {
        this.store.replaceAll(this.removed);
        for (const ann of this.removed) {
            ann.smartIdPath = registerDimensionSmartId(ann.id, ann.anchor1);
        }
    }
}

// ============================================================================
// EDIT OFFSET
// ============================================================================

export class SetDimensionOffsetCommand implements Command {
    readonly id = nextCommandId('offset');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly store: PMIStore;
    private readonly annotationId: string;
    private readonly nextOffset: Vec3;
    private readonly nextSpace: OffsetSpace;
    private readonly nextAxisSpace: AxisSpace;
    private readonly nextOffsetAxisKey: string;
    private readonly prevOffset: Vec3;
    private readonly prevSpace: OffsetSpace;
    private readonly prevAxisSpace: AxisSpace;
    private readonly prevOffsetAxisKey: string;

    constructor(
        store: PMIStore,
        annotationId: string,
        nextOffset: Vec3,
        nextSpace: OffsetSpace,
        extras?: { axisSpace?: AxisSpace; offsetAxisKey?: string },
        label = 'Zmieniono odsunięcie wymiaru',
    ) {
        const existing = store.getAnnotation(annotationId);
        if (!existing) {
            throw new Error(`SetDimensionOffsetCommand: wymiar "${annotationId}" nie istnieje.`);
        }
        this.store = store;
        this.annotationId = annotationId;
        this.nextOffset = nextOffset;
        this.nextSpace = nextSpace;
        this.nextAxisSpace = extras?.axisSpace ?? existing.axisSpace;
        this.nextOffsetAxisKey = extras?.offsetAxisKey ?? existing.offsetAxisKey;
        this.prevOffset = existing.offset;
        this.prevSpace = existing.offsetSpace;
        this.prevAxisSpace = existing.axisSpace;
        this.prevOffsetAxisKey = existing.offsetAxisKey;
        this.label = label;
        this.affectedNodeIds = affectedNodesOf(existing);
    }

    execute(): void {
        this.store.setPlacement(this.annotationId, {
            offset: this.nextOffset,
            offsetSpace: this.nextSpace,
            axisSpace: this.nextAxisSpace,
            offsetAxisKey: this.nextOffsetAxisKey,
        });
    }

    undo(): void {
        this.store.setPlacement(this.annotationId, {
            offset: this.prevOffset,
            offsetSpace: this.prevSpace,
            axisSpace: this.prevAxisSpace,
            offsetAxisKey: this.prevOffsetAxisKey,
        });
    }
}

// ============================================================================
// EDIT TEXT AFFIXES
// ============================================================================

export class SetDimensionAffixesCommand implements Command {
    readonly id = nextCommandId('affix');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly store: PMIStore;
    private readonly annotationId: string;
    private readonly nextPrefix: string;
    private readonly nextSuffix: string;
    private readonly prevPrefix: string;
    private readonly prevSuffix: string;

    constructor(
        store: PMIStore,
        annotationId: string,
        nextPrefix: string,
        nextSuffix: string,
        label = 'Zmieniono opis wymiaru',
    ) {
        const existing = store.getAnnotation(annotationId);
        if (!existing) {
            throw new Error(`SetDimensionAffixesCommand: wymiar "${annotationId}" nie istnieje.`);
        }
        this.store = store;
        this.annotationId = annotationId;
        this.nextPrefix = nextPrefix;
        this.nextSuffix = nextSuffix;
        this.prevPrefix = existing.textPrefix;
        this.prevSuffix = existing.textSuffix;
        this.label = label;
        this.affectedNodeIds = affectedNodesOf(existing);
    }

    execute(): void {
        this.store.setAffixes(this.annotationId, this.nextPrefix, this.nextSuffix);
    }

    undo(): void {
        this.store.setAffixes(this.annotationId, this.prevPrefix, this.prevSuffix);
    }
}

// ============================================================================
// VISIBILITY
// ============================================================================

export class SetDimensionVisibilityCommand implements Command {
    readonly id = nextCommandId('visibility');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly store: PMIStore;
    private readonly annotationId: string;
    private readonly nextVisible: boolean;
    private readonly prevVisible: boolean;

    constructor(store: PMIStore, annotationId: string, nextVisible: boolean) {
        const existing = store.getAnnotation(annotationId);
        if (!existing) {
            throw new Error(`SetDimensionVisibilityCommand: wymiar "${annotationId}" nie istnieje.`);
        }
        this.store = store;
        this.annotationId = annotationId;
        this.nextVisible = nextVisible;
        this.prevVisible = existing.visible;
        this.label = nextVisible ? 'Pokazano wymiar' : 'Ukryto wymiar';
        this.affectedNodeIds = affectedNodesOf(existing);
    }

    execute(): void {
        this.store.setVisibility(this.annotationId, this.nextVisible);
    }

    undo(): void {
        this.store.setVisibility(this.annotationId, this.prevVisible);
    }
}

function affectedNodesOfMeasurement(item: Pick<PMIMeasurement, 'anchor1' | 'anchor2'>): string[] {
    return [item.anchor1?.nodeId, item.anchor2?.nodeId].filter((id): id is string => !!id);
}

export class AddMeasurementCommand implements Command {
    readonly id = nextCommandId('add_msr');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly store: PMIStore;
    private readonly init: PMIMeasurementInit;
    private created: PMIMeasurement | null = null;

    constructor(store: PMIStore, init: PMIMeasurementInit, label = 'Dodano pomiar') {
        this.store = store;
        this.init = init;
        this.label = label;
        this.affectedNodeIds = affectedNodesOfMeasurement(init);
    }

    execute(): void {
        if (this.created) {
            this.store.insertMeasurement(this.created, this.store.measurements.length);
            return;
        }
        this.created = this.store.addMeasurement(this.init);
    }

    undo(): void {
        if (!this.created) return;
        this.store.removeMeasurement(this.created.id);
    }

    get measurement(): PMIMeasurement | null {
        return this.created;
    }
}

export class RemoveMeasurementCommand implements Command {
    readonly id = nextCommandId('remove_msr');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly store: PMIStore;
    private readonly measurementId: string;
    private removed: PMIMeasurement | null = null;
    private removedIndex = -1;

    constructor(store: PMIStore, measurementId: string, label = 'Usunięto pomiar') {
        const existing = store.getMeasurement(measurementId);
        if (!existing) {
            throw new Error(`RemoveMeasurementCommand: pomiar "${measurementId}" nie istnieje.`);
        }
        this.store = store;
        this.measurementId = measurementId;
        this.label = label;
        this.affectedNodeIds = affectedNodesOfMeasurement(existing);
    }

    execute(): void {
        const result = this.store.removeMeasurement(this.measurementId);
        if (!result) return;
        this.removed = result.measurement;
        this.removedIndex = result.index;
    }

    undo(): void {
        if (!this.removed) return;
        this.store.insertMeasurement(this.removed, this.removedIndex);
    }
}

export class ClearMeasurementsCommand implements Command {
    readonly id = nextCommandId('clear_msr');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[] = [];

    private readonly store: PMIStore;
    private removed: PMIMeasurement[] = [];

    constructor(store: PMIStore, label = 'Usunięto wszystkie pomiary') {
        this.store = store;
        this.label = label;
    }

    execute(): void {
        this.removed = this.store.clearAllMeasurements();
    }

    undo(): void {
        this.store.replaceAllMeasurements(this.removed);
    }
}

export class SetMeasurementVisibilityCommand implements Command {
    readonly id = nextCommandId('vis_msr');
    readonly label: string;
    readonly timestamp = Date.now();
    readonly affectedNodeIds: string[];

    private readonly store: PMIStore;
    private readonly measurementId: string;
    private readonly nextVisible: boolean;
    private readonly prevVisible: boolean;

    constructor(store: PMIStore, measurementId: string, nextVisible: boolean) {
        const existing = store.getMeasurement(measurementId);
        if (!existing) {
            throw new Error(`SetMeasurementVisibilityCommand: pomiar "${measurementId}" nie istnieje.`);
        }
        this.store = store;
        this.measurementId = measurementId;
        this.nextVisible = nextVisible;
        this.prevVisible = existing.visible;
        this.label = nextVisible ? 'Pokazano pomiar' : 'Ukryto pomiar';
        this.affectedNodeIds = affectedNodesOfMeasurement(existing);
    }

    execute(): void {
        this.store.setMeasurementVisibility(this.measurementId, this.nextVisible);
    }

    undo(): void {
        this.store.setMeasurementVisibility(this.measurementId, this.prevVisible);
    }
}
