/**
 * constraint-store.ts — właściciel listy więzów i ich trwałości.
 *
 * Więzy nie mieszkają w drzewie `CADNode`, bo nie należą do żadnego pojedynczego
 * węzła — wiążą pary węzłów. Trafiają więc do dokumentu jako sekcja rozszerzenia
 * (`extensions.constraints` przez `ProjectDocument.registerExtension`).
 *
 * Rejestracja rozszerzenia MUSI nastąpić przed `document.load()`, bo dokument
 * wypełnia rozszerzenia w trakcie wczytywania — patrz `_loadExtensions`.
 *
 * `conflict`, `residual` i błędy walidacji są stanem wynikowym solvera,
 * nie danymi projektu, więc nie są serializowane.
 */

import type { DocumentExtension, ProjectDocument } from '../A1_core/project-document.js';
import { emptyConstraintResidual, type BindType } from './core/contract.js';
import type { Vec3 } from './core/math3d.js';
import {
    constraintNodeIds,
    makeAnchor,
    makeSolverConstraint,
    type AnchorKind,
    type ConstraintAnchor,
    type SolverConstraint,
} from './constraint-types.js';
import type { ConstraintValidationIssue } from './constraint-validation.js';

export const CONSTRAINT_DOCUMENT_SECTION = 'constraints';
const SCHEMA_VERSION = 1;

export interface ConstraintStoreJSON {
    version: number;
    constraints: Array<{
        id: string;
        bindType: BindType;
        enabled: boolean;
        anchorA: ConstraintAnchor | null;
        anchorB: ConstraintAnchor | null;
        groundPosMm: Vec3 | null;
        groundNormal: Vec3 | null;
        offsetMm: number;
    }>;
}

export type ConstraintChangeListener = () => void;

export class ConstraintStore {
    private static _instance: ConstraintStore | null = null;

    static get instance(): ConstraintStore {
        if (!ConstraintStore._instance) {
            ConstraintStore._instance = new ConstraintStore();
        }
        return ConstraintStore._instance;
    }

    constraints: SolverConstraint[] = [];
    private _issuesById = new Map<string, ConstraintValidationIssue[]>();

    private _listeners: Set<ConstraintChangeListener> = new Set();
    private _nextId = 1;

    onChange(listener: ConstraintChangeListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    notifyChanged(): void {
        for (const listener of this._listeners) {
            try {
                listener();
            } catch (err) {
                console.error('ConstraintStore listener error:', err);
            }
        }
    }

    private _generateId(): string {
        return `cst_${Date.now().toString(36)}_${this._nextId++}`;
    }

    add(init: Partial<SolverConstraint> & { bindType: BindType }): SolverConstraint {
        const constraint = makeSolverConstraint({ id: this._generateId(), ...init });
        this.constraints.push(constraint);
        this.notifyChanged();
        return constraint;
    }

    get(id: string): SolverConstraint | null {
        return this.constraints.find((c) => c.id === id) ?? null;
    }

    remove(id: string): boolean {
        const index = this.constraints.findIndex((c) => c.id === id);
        if (index === -1) {
            return false;
        }
        this.constraints.splice(index, 1);
        this._issuesById.delete(id);
        this.notifyChanged();
        return true;
    }

    update(id: string, patch: Partial<SolverConstraint>): boolean {
        const constraint = this.get(id);
        if (!constraint) {
            return false;
        }
        Object.assign(constraint, patch);
        this.notifyChanged();
        return true;
    }

    setAnchor(id: string, slot: 'A' | 'B', anchor: ConstraintAnchor | null): boolean {
        return this.update(id, slot === 'A' ? { anchorA: anchor } : { anchorB: anchor });
    }

    clear(): void {
        if (this.constraints.length === 0 && this._issuesById.size === 0) {
            return;
        }
        this.constraints = [];
        this._issuesById.clear();
        this.notifyChanged();
    }

    /**
     * Usuwa więzy odwołujące się do węzłów, których już nie ma w dokumencie —
     * odpowiednik pythonowego `auto_cleanup_dead_binds`. W Blenderze działało to
     * na handlerze co 0,5 s; tutaj wywołuje to kontroler po zmianach struktury.
     * @returns liczba usuniętych więzów
     */
    pruneMissingNodes(existingNodeIds: Set<string>): number {
        const kept = this.constraints.filter((c) => {
            const ids = constraintNodeIds(c);
            if (ids.length === 0) {
                return true;
            }
            return ids.every((nodeId) => existingNodeIds.has(nodeId));
        });

        const removed = this.constraints.length - kept.length;
        if (removed > 0) {
            this.constraints = kept;
            const keptIds = new Set(kept.map((c) => c.id));
            for (const id of [...this._issuesById.keys()]) {
                if (!keptIds.has(id)) {
                    this._issuesById.delete(id);
                }
            }
            this.notifyChanged();
        }
        return removed;
    }

    getIssues(constraintId: string): ConstraintValidationIssue[] {
        return this._issuesById.get(constraintId) ?? [];
    }

    setValidationIssues(issues: ConstraintValidationIssue[]): void {
        const next = new Map<string, ConstraintValidationIssue[]>();
        for (const issue of issues) {
            if (!issue.constraintId) {
                continue;
            }
            const list = next.get(issue.constraintId) ?? [];
            list.push(issue);
            next.set(issue.constraintId, list);
        }
        if (issueMapsEqual(this._issuesById, next)) {
            return;
        }
        this._issuesById = next;
        this.notifyChanged();
    }

    /** Zeruje stan wynikowy solvera na wszystkich więzach. */
    resetSolveResults(): void {
        for (const constraint of this.constraints) {
            constraint.conflict = false;
            constraint.residual = emptyConstraintResidual();
        }
    }

    toJSON(): ConstraintStoreJSON {
        return {
            version: SCHEMA_VERSION,
            constraints: this.constraints.map((c) => ({
                id: c.id,
                bindType: c.bindType,
                enabled: c.enabled,
                anchorA: c.anchorA ? { ...c.anchorA } : null,
                anchorB: c.anchorB ? { ...c.anchorB } : null,
                groundPosMm: c.groundPosMm ? [...c.groundPosMm] : null,
                groundNormal: c.groundNormal ? [...c.groundNormal] : null,
                offsetMm: c.offsetMm,
            })),
        };
    }

    fromJSON(data: ConstraintStoreJSON | null | undefined): void {
        this._issuesById.clear();
        if (!data || !Array.isArray(data.constraints)) {
            this.constraints = [];
            this.notifyChanged();
            return;
        }

        if (data.version !== SCHEMA_VERSION) {
            console.warn(
                `ConstraintStore: nieznana wersja schematu ${data.version} (obsługiwana: ${SCHEMA_VERSION}). Więzy pominięte.`,
            );
            this.constraints = [];
            this.notifyChanged();
            return;
        }

        this.constraints = data.constraints.map((raw) =>
            makeSolverConstraint({
                id: raw.id,
                bindType: raw.bindType,
                enabled: raw.enabled ?? true,
                anchorA: reviveAnchor(raw.anchorA),
                anchorB: reviveAnchor(raw.anchorB),
                groundPosMm: reviveVec3(raw.groundPosMm),
                groundNormal: reviveVec3(raw.groundNormal),
                offsetMm: raw.offsetMm ?? 0,
            }),
        );
        this.notifyChanged();
    }

    /** Podłącza store do dokumentu jako sekcję serializacji. */
    attachTo(document: ProjectDocument): () => void {
        const extension: DocumentExtension = {
            serialize: () => this.toJSON(),
            load: (data) => this.fromJSON(data),
        };
        return document.registerExtension(CONSTRAINT_DOCUMENT_SECTION, extension);
    }
}

function reviveAnchor(raw: ConstraintAnchor | null | undefined): ConstraintAnchor | null {
    if (!raw || typeof raw.nodeId !== 'string' || !raw.nodeId) {
        return null;
    }
    return makeAnchor({
        nodeId: raw.nodeId,
        kind: (raw.kind ?? 'OBJECT') as AnchorKind,
        faceName: raw.faceName ?? '',
        cornerIndex: typeof raw.cornerIndex === 'number' ? raw.cornerIndex : -1,
        sourceNodeId: typeof raw.sourceNodeId === 'string' && raw.sourceNodeId ? raw.sourceNodeId : undefined,
        localPointMm: reviveVec3(raw.localPointMm) ?? undefined,
        localNormalMm: reviveVec3(raw.localNormalMm) ?? undefined,
    });
}

function reviveVec3(raw: Vec3 | null | undefined): Vec3 | null {
    if (!Array.isArray(raw) || raw.length !== 3 || !raw.every((n) => Number.isFinite(n))) {
        return null;
    }
    return [raw[0], raw[1], raw[2]];
}

function issueMapsEqual(
    a: Map<string, ConstraintValidationIssue[]>,
    b: Map<string, ConstraintValidationIssue[]>,
): boolean {
    if (a.size !== b.size) {
        return false;
    }
    for (const [id, list] of b) {
        const prev = a.get(id);
        if (!prev || prev.length !== list.length) {
            return false;
        }
        for (let i = 0; i < list.length; i++) {
            if (
                prev[i].code !== list[i].code ||
                prev[i].message !== list[i].message ||
                prev[i].severity !== list[i].severity
            ) {
                return false;
            }
        }
    }
    return true;
}
