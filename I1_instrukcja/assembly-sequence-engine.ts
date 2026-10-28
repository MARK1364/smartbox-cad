/**
 * E1_export - assembly-sequence-engine.ts
 * Silnik reguł kolejności montażu (Faza 1 planu Instrukcja Montażu).
 *
 * PURE — zero Babylon / DOM / ContextManager.
 * Wejście: płaski spis części sceny (AssemblyPartRef) + złącza z C2 (AssemblyConnectorRef)
 * + reguły faz (assembly-sequence-rules.json).
 * Wyjście: AssemblyPlan = uporządkowana lista kroków (AssemblyStep) z licznością łączników
 * i kumulatywną widocznością sceny w każdym kroku (inputs do kadrów eksportu).
 */

import type { ExportNodeVisibility } from '../E1_export/export-view-state.js';
import rulesJson from './assembly-sequence-rules.json';

// ─── Wejście ───

export type AssemblyNodeType = 'PART' | 'HARDWARE' | 'OTHER';

/** Spis jednej części sceny — buduje go assembly-scene-adapter.ts z dokumentu. */
export interface AssemblyPartRef {
    nodeId: string;
    /** Nazwa wyświetlana (Bok_L, Polka_1, Zawias 1 (Lewy)...). */
    name: string;
    /** Rola z domainData (LEFT_SIDE_PANEL, FRONT, ...) lub null dla nieznanej. */
    role: string | null;
    nodeType: AssemblyNodeType;
    /** Id kontenera-rodzica (korpus / blok), do którego przypięta jest część. */
    parentId: string | null;
    /** Kod okucia z biblioteki (PODPORKA_FI5, BLUM_71B3550...). */
    hardwareId?: string | null;
    /** Pozycja lokalna [nm] — sortowanie w obrębie fazy. */
    translationNm?: [number, number, number] | null;
}

/** Złącze C2 sprowadzone do liczności łączników na typ (kołki / konfirmat / minifix). */
export interface AssemblyConnectorRef {
    id: string;
    /** parentObjectId / otherObjectId = nodeId rodzica i drugiej formatki. */
    parentObjectId: string;
    otherObjectId: string;
    /** [typ_zlacza]: liczba sztuk w tej grupie. */
    counts: Record<string, number>;
}

export interface AssemblyPhaseDef {
    id: string;
    /** Klucz w assembly_tekst.json (faza.title). */
    label_key: string;
    /** Role przypisane do fazy; "*" = wszystkie niedopasowane wcześniej. */
    roles: string[];
    /** single = krok na część; joint = wszystkie części fazy w jednym kroku. */
    mode?: 'single' | 'joint';
}

export interface AssemblySequenceRules {
    version: number;
    /** Krok 0: sprawdzenie zawartości pakowania. */
    inventory?: { enabled?: boolean; label_key?: string };
    /** Kolejność faz realizuje uniwersalne priorytety montażowe (kołki/mimośrody → boki → plecy → fronty). */
    phases: AssemblyPhaseDef[];
}

export const DEFAULT_ASSEMBLY_RULES = rulesJson as unknown as AssemblySequenceRules;

// ─── Wyjście ───

export interface AssemblyStepAction {
    nodeId: string;
    name: string;
    role: string | null;
    nodeType: AssemblyNodeType;
    /** Kod okucia (zawias / podpórka) — do etykiet kroku. */
    hardwareId?: string | null;
}

export interface AssemblyStep {
    /** Numeracja 1-based (kroku montażu). Inventory = 0. */
    index: number;
    phaseId: string;
    /** Klucz i18n tytułu fazy (assembly_tekst.json). */
    labelKey: string;
    mode: 'single' | 'joint';
    actions: AssemblyStepAction[];
    /** Łącza montowane W TYM kroku: { typ: liczba }. */
    hardwareCounts: Record<string, number>;
    /** Grupy łączników C2 (kołki/konfirmaty) montowane w tym kroku — mesh złącza animowane przez visualizer. */
    connectorGroupIds?: string[];
    /** Węzły pokazywane W TYM kroku (delta widoczności). */
    actionNodeIds: string[];
    /** Kumulatywny stan sceny po tym kroku → SavedExportView.nodeVisibility. */
    visibility: ExportNodeVisibility[];
    /** Opcjonalne nadpisanie kierunku i dystansu odsunięcia dla danej klatki/kroku [mm]. */
    explodeOverride?: {
        dirCad?: [number, number, number];
        distanceMm?: number;
        customStartPositions?: Record<string, [number, number, number]>;
    };
}

export interface AssemblyPlan {
    /** Krok 0: inwentarz zawartości (opcjonalny). */
    inventoryStep: AssemblyStep | null;
    /** Kroki montażu (index 1..N). */
    steps: AssemblyStep[];
    /** Suma wszystkich łączników i okuć w projekcie. */
    totalHardwareCounts: Record<string, number>;
    /** Liczba formatek (PART) objętych planem. */
    partsTotal: number;
    /** Węzły, które trafiły do fazy awaryjnej "*" — sygnał do rozbudowy reguł. */
    fallbackNodeIds: string[];
}

/** Czy dany kod łącznika to kołek drewniany (wbijany w pierwszy panel/wieniec przed przyłożeniem boczków). */
export function isDowelConnector(type: string): boolean {
    const t = String(type || '').toLowerCase();
    return t.includes('kolk') || t.includes('kolek') || t.includes('kołk') || t.includes('kołek') || t.includes('dowel');
}

// ─── Pomocnicze (pure) ───

function isTuple3(v: unknown): v is [number, number, number] {
    return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function tupleLess(a: [number, number, number], b: [number, number, number]): number {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
}

/** Suma łączników {typ: sztuki} — zero-safety (0/negative/NaN pomijane). */
function addCounts(target: Record<string, number>, source: Record<string, number> | undefined | null): void {
    if (!source) return;
    for (const [k, v] of Object.entries(source)) {
        if (!Number.isFinite(v) || v <= 0) continue;
        target[k] = (target[k] || 0) + v;
    }
}

// ─── Silnik reguł ───

export interface AssemblySequenceInput {
    parts: AssemblyPartRef[];
    connectors?: AssemblyConnectorRef[];
    rules?: AssemblySequenceRules | null;
}

/**
 * Buduje kroki montażu wg reguł:
 *  1. Części przypisywane do faz STRIC po roli (bez zgadywania po nazwach).
 *  2. Sort wewnątrz fazy: kolejność ról w regule → typ węzła (PART przed HARDWARE)
 *     → pozycja translationNm (leksykograficznie lewy/dół przed prawy/górę) → nazwa.
 *  3. Okucia węzłowe (zawias, podpórka, prowadnica) → krok PIERWSZEJ formatki
 *     ich rodzica (bloku); bez dopasowania → ostatni krok planu.
 *  4. Złącza C2 (kołki / konfirmat / minifix) → krok, w którym pojawia się OSTATNI
 *     z dwóch paneli złącza ("najpierw kołki w płycie, potem dołączasz drugą").
 *  5. Widoczność sceny per krok = kumulatywna (zmontowane widoczne, reszta schowana).
 *  6. Nieznane role → faza awaryjna (roles: ["*"]) na końcu; widać je w fallbackNodeIds.
 */
export function buildAssemblySequence(input: AssemblySequenceInput): AssemblyPlan {
    const rules = input.rules && Array.isArray(input.rules.phases) && input.rules.phases.length > 0
        ? input.rules
        : DEFAULT_ASSEMBLY_RULES;
    const parts = (input.parts || []).filter((p) => p && p.nodeId && p.nodeType !== 'OTHER');
    const connectors = input.connectors || [];

    const matchPhases = rules.phases.filter((ph) => !ph.roles.includes('*'));
    const fallbackPhase = rules.phases.find((ph) => ph.roles.includes('*')) || null;

    // 1) Kieruj część do fazy po roli (HARDWARE nie tworzy kroków — dołącza do formatki rodzica).
    const assignment = new Map<string, { phaseIdx: number; roleIdx: number }>();
    const fallbackNodeIds: string[] = [];

    for (const part of parts) {
        if (part.nodeType === 'HARDWARE') continue;
        let placed = false;
        for (let pi = 0; pi < matchPhases.length; pi++) {
            const roles = matchPhases[pi].roles;
            const ri = part.role ? roles.indexOf(part.role) : -1;
            if (ri >= 0) {
                assignment.set(part.nodeId, { phaseIdx: pi, roleIdx: ri });
                placed = true;
                break;
            }
        }
        if (!placed) {
            fallbackNodeIds.push(part.nodeId);
            if (fallbackPhase) {
                assignment.set(part.nodeId, { phaseIdx: matchPhases.length, roleIdx: Infinity });
            }
        }
    }

    // 2) Grupuj per faza + sort (tylko formatki; okucia na ostatnim etapie).
    const partsByPhase = new Map<number, AssemblyPartRef[]>();
    for (const part of parts) {
        if (part.nodeType === 'HARDWARE') continue;
        const a = assignment.get(part.nodeId);
        if (!a) continue;
        const list = partsByPhase.get(a.phaseIdx) || [];
        list.push(part);
        partsByPhase.set(a.phaseIdx, list);
    }

    const buildStepIndex = new Map<string, number>();
    const steps: AssemblyStep[] = [];
    const phaseList = fallbackPhase ? [...matchPhases, fallbackPhase] : matchPhases;

    for (let pi = 0; pi < phaseList.length; pi++) {
        const phase = phaseList[pi];
        const nodes = (partsByPhase.get(pi) || []).slice();
        if (nodes.length === 0) {
            if (pi < matchPhases.length) continue; // faza reguły pusta — przeskocz
            break;
        }

        nodes.sort((a, b) => {
            const ra = a.role ? phase.roles.indexOf(a.role) : Infinity;
            const rb = b.role ? phase.roles.indexOf(b.role) : Infinity;
            if (ra !== rb) return ra - rb;
            if (a.nodeType !== b.nodeType) return a.nodeType === 'PART' ? -1 : 1;
            const ta = a.translationNm;
            const tb = b.translationNm;
            if (isTuple3(ta) && isTuple3(tb)) {
                const c = tupleLess(ta, tb);
                if (c !== 0) return c;
            }
            return a.name.localeCompare(b.name);
        });

        const mode: 'single' | 'joint' = phase.mode === 'joint' ? 'joint' : 'single';
        const groups: AssemblyPartRef[][] = mode === 'joint' ? [nodes] : nodes.map((n) => [n]);

        for (const group of groups) {
            const index = steps.length + 1;
            const actionNodeIds = group.map((n) => n.nodeId);
            for (const n of group) buildStepIndex.set(n.nodeId, index);

            steps.push({
                index,
                phaseId: phase.id,
                labelKey: phase.label_key,
                mode,
                actions: group.map((n) => ({
                    nodeId: n.nodeId,
                    name: n.name,
                    role: n.role,
                    nodeType: n.nodeType,
                    hardwareId: n.hardwareId ?? null,
                })),
                hardwareCounts: {},
                actionNodeIds,
                visibility: [],
            });
        }
    }

    // 3) Okucia węzłowe → krok pierwszej formatki rodzica (bloku).
    for (const hw of parts.filter((p) => p.nodeType === 'HARDWARE')) {
        let idx: number | undefined;
        let found = false;
        for (const panel of parts) {
            if (panel.nodeType !== 'PART' || panel.parentId !== hw.parentId) continue;
            const i = buildStepIndex.get(panel.nodeId);
            if (i != null && (!found || i < idx!)) {
                idx = i;
                found = true;
            }
        }
        if (!found) {
            if (steps.length === 0) continue; // plan pusty — okuce bez kroku
            idx = steps[steps.length - 1].index; // ostatni krok (faza "*" / akcesoria)
        }
        const step = steps.find((s) => s.index === idx);
        if (!step) continue;
        const key = String(hw.hardwareId || hw.name || 'HW');
        step.hardwareCounts[key] = (step.hardwareCounts[key] || 0) + 1;
        buildStepIndex.set(hw.nodeId, idx);
        // Okucie montowane W TYM kroku — widać je w animacji razem z formatki.
        step.actionNodeIds.push(hw.nodeId);
        step.actions.push({
            nodeId: hw.nodeId,
            name: hw.name,
            role: hw.role,
            nodeType: hw.nodeType,
            hardwareId: hw.hardwareId ?? null,
        });
    }

    // 4) Złącza C2:
    // Kołki fi8 wbijamy w wieniec (pierwszy panel styku) przed przyłożeniem boczków.
    // Konfirmaty / minifix / wkręty dociągamy po przyłożeniu boczków (drugi panel styku).
    for (const conn of connectors) {
        const a = buildStepIndex.get(conn.parentObjectId);
        const b = buildStepIndex.get(conn.otherObjectId);
        if (a == null && b == null) continue;
        const minIdx = a != null && b != null ? Math.min(a, b) : (a ?? b)!;
        const maxIdx = a != null && b != null ? Math.max(a, b) : (a ?? b)!;

        for (const [type, count] of Object.entries(conn.counts)) {
            const isDowel = isDowelConnector(type);
            const targetIdx = isDowel ? minIdx : maxIdx;
            const step = steps.find((s) => s.index === targetIdx);
            if (!step) continue;
            step.hardwareCounts[type] = (step.hardwareCounts[type] || 0) + count;
            if (!step.connectorGroupIds) step.connectorGroupIds = [];
            if (!step.connectorGroupIds.includes(conn.id)) step.connectorGroupIds.push(conn.id);
        }
    }

    // 5) Kumulatywna widoczność sceny per krok.
    const visMap = new Map<string, boolean>();
    for (const part of parts) visMap.set(part.nodeId, false);

    for (const step of steps) {
        for (const id of step.actionNodeIds) visMap.set(id, true);
        step.visibility = Array.from(visMap.entries()).map(([nodeId, visible]) => ({ nodeId, visible }));
    }

    // 6) Krok inwentarza (index 0) — wszystko ukryte, tylko lista łączników do sprawdzenia.
    let inventoryStep: AssemblyStep | null = null;
    if (rules.inventory?.enabled !== false && parts.length > 0) {
        const listHardware: Record<string, number> = {};
        for (const s of steps) addCounts(listHardware, s.hardwareCounts);
        inventoryStep = {
            index: 0,
            phaseId: 'inwentarz',
            labelKey: rules.inventory.label_key || 'phase.wyposazenie',
            mode: 'joint',
            actions: [],
            hardwareCounts: listHardware,
            actionNodeIds: [],
            visibility: parts.map((p) => ({ nodeId: p.nodeId, visible: false })),
        };
    }

    const totalHardwareCounts: Record<string, number> = {};
    for (const s of steps) addCounts(totalHardwareCounts, s.hardwareCounts);

    const partsTotal = parts.filter((p) => p.nodeType === 'PART').length;

    return {
        inventoryStep,
        steps,
        totalHardwareCounts,
        partsTotal,
        fallbackNodeIds,
    };
}
