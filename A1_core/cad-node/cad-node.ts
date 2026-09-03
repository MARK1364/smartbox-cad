/**
 * SmartPanel Web — CADNode
 *
 * Rdzeń domenowego drzewa CAD. Reprezentuje węzeł hierarchii:
 *   ROOM → ASSEMBLY → PART → FEATURE
 *
 * Kluczone właściwości:
 *  - Transformacje przechowywane jako macierz 4×4 (nie kąty Eulera).
 *  - worldMatrix obliczana lazy z kaskadą dirty-flag.
 *  - Zero zależności od Babylon.js, OCCT, DOM.
 *  - domainData: opcjonalne dane domenowe (ContainerModel, PanelModel itp.)
 *    przechowywane przez referencję — CADNode nie wie co to jest.
 */

import { Mat4 } from '../cad-math/mat4.js';
import { Quat } from '../cad-math/quat.js';
import { Vec3 } from '../cad-math/vec3.js';
import { NodeType } from './node-type.js';
import type { DomainData } from '../domain-data.js';

// ─── Typy pomocnicze ──────────────────────────────────────────────────────────

/** Callback subskrybentu zmiany worldMatrix. */
export type WorldMatrixChangedCallback = (node: CADNode, worldMatrix: Mat4) => void;

// ─── CADNode ──────────────────────────────────────────────────────────────────

export class CADNode {
    // === Identyfikacja ===
    readonly id: string;
    name: string;
    readonly nodeType: NodeType;

    // === Drzewo ===
    private _parent: CADNode | null = null;
    private _children: CADNode[] = [];

    // === Transformacja lokalna (LCS) ===
    /** Single Source of Truth dla pozycji/rotacji/skali w przestrzeni rodzica. */
    private _localMatrix: Mat4;

    // === Cache worldMatrix ===
    private _worldMatrix: Mat4;
    private _worldMatrixDirty: boolean = true;

    // === Dane domenowe ===
    /**
     * Dane domenowe węzła: korpus (ContainerModel) lub formatka (PanelModel).
     */
    domainData: DomainData | null = null;

    // === Eventy ===
    private _worldMatrixListeners: Set<WorldMatrixChangedCallback> = new Set();

    // ─── Konstruktor ──────────────────────────────────────────

    constructor(id: string, name: string, nodeType: NodeType) {
        this.id = id;
        this.name = name;
        this.nodeType = nodeType;
        this._localMatrix = Mat4.identity();
        this._worldMatrix = Mat4.identity();
    }

    // ─── Fabryki ──────────────────────────────────────────────

    static create(nodeType: NodeType, name: string = '', id?: string): CADNode {
        const nodeId = id ?? `${nodeType}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        return new CADNode(nodeId, name || nodeType, nodeType);
    }

    // ─── Drzewo — gettery ─────────────────────────────────────

    get parent(): CADNode | null {
        return this._parent;
    }

    get children(): readonly CADNode[] {
        return this._children;
    }

    get childCount(): number {
        return this._children.length;
    }

    // ─── Drzewo — operacje ────────────────────────────────────

    /**
     * Dodaje węzeł potomny.
     * Automatycznie odpina dziecko od poprzedniego rodzica (jeśli ma).
     */
    addChild(child: CADNode): void {
        if (child === this) {
            throw new Error('CADNode.addChild: cannot add node as its own child.');
        }
        if (child._parent === this) return;

        // Detekcja cyklu: sprawdź czy `this` jest już potomkiem `child`
        // (np. A.addChild(B) gdy B.addChild(A) już było — nieskończona rekurencja)
        let ancestor: CADNode | null = this._parent;
        while (ancestor !== null) {
            if (ancestor === child) {
                throw new Error(
                    `CADNode.addChild: cycle detected — "${child.id}" is already an ancestor of "${this.id}".`
                );
            }
            ancestor = ancestor._parent;
        }

        child._parent?._detachChild(child);
        child._parent = this;
        this._children.push(child);
        child._invalidateWorldMatrix();
    }

    /**
     * Usuwa węzeł potomny.
     * Po usunięciu dziecko staje się korzeniem (parent = null).
     */
    removeChild(child: CADNode): void {
        const idx = this._children.indexOf(child);
        if (idx === -1) return;
        this._detachChild(child);
    }

    /** Odpina węzeł od rodzica (jeśli ma). */
    detach(): void {
        this._parent?.removeChild(this);
    }

    private _detachChild(child: CADNode): void {
        const idx = this._children.indexOf(child);
        if (idx === -1) return;
        this._children.splice(idx, 1);
        child._parent = null;
        // worldMatrix dziecka = jego localMatrix (brak rodzica)
        child._invalidateWorldMatrix();
    }

    // ─── Transformacja lokalna ────────────────────────────────

    get localMatrix(): Mat4 {
        return this._localMatrix;
    }

    /**
     * Ustawia lokalną transformację przez komponenty TRS.
     * Wywołuje kaskadę dirty-flag w dół drzewa i powiadamia listenery (np. SceneSyncAdapter).
     */
    setLocalTransform(translation: Vec3, rotation: Quat, scale?: Vec3): void {
        this._localMatrix = Mat4.fromTRS(translation, rotation, scale);
        this._invalidateWorldMatrix();
        this._recomputeWorldMatrixRecursive();
    }

    /**
     * Bezpośrednie ustawienie lokalnej macierzy (np. po operacji na gizmo).
     */
    setLocalMatrix(m: Mat4): void {
        this._localMatrix = m;
        this._invalidateWorldMatrix();
        this._recomputeWorldMatrixRecursive();
    }

    private _recomputeWorldMatrixRecursive(): void {
        this.getWorldMatrix();
        for (const child of this._children) {
            child._recomputeWorldMatrixRecursive();
        }
    }

    /**
     * Ustawia tylko translację, zachowując rotację i skalę.
     */
    setTranslation(t: Vec3): void {
        const { rotation, scale } = this._localMatrix.decompose();
        this.setLocalTransform(t, rotation, scale);
    }

    /**
     * Ustawia tylko rotację, zachowując translację i skalę.
     */
    setRotation(q: Quat): void {
        const { translation, scale } = this._localMatrix.decompose();
        this.setLocalTransform(translation, q, scale);
    }

    // ─── WorldMatrix — lazy cache ─────────────────────────────

    /**
     * Zwraca macierz świata (WCS). Oblicza ją jeśli dirty.
     * worldMatrix = parent.worldMatrix × localMatrix
     */
    getWorldMatrix(): Mat4 {
        if (this._worldMatrixDirty) {
            this._worldMatrix = this._parent
                ? this._parent.getWorldMatrix().multiply(this._localMatrix)
                : this._localMatrix.clone();
            this._worldMatrixDirty = false;
            this._notifyWorldMatrixChanged();
        }
        return this._worldMatrix;
    }

    /**
     * Kaskada dirty-flag: oznacza ten węzeł i wszystkie potomki jako nieaktualne.
     * Efektywna dzięki early-exit gdy już dirty.
     */
    private _invalidateWorldMatrix(): void {
        if (this._worldMatrixDirty) return; // Już oznaczone — potomki też są dirty
        this._worldMatrixDirty = true;
        for (const child of this._children) {
            child._invalidateWorldMatrix();
        }
    }

    // ─── Eventy ──────────────────────────────────────────────

    /**
     * Subskrybuje zmiany worldMatrix.
     * Callback wywoływany po lazy recompute (przy getWorldMatrix()).
     * @returns funkcja do anulowania subskrypcji
     */
    onWorldMatrixChanged(callback: WorldMatrixChangedCallback): () => void {
        this._worldMatrixListeners.add(callback);
        return () => this._worldMatrixListeners.delete(callback);
    }

    private _notifyWorldMatrixChanged(): void {
        if (this._worldMatrixListeners.size === 0) return;
        const wm = this._worldMatrix;
        for (const cb of this._worldMatrixListeners) {
            try { cb(this, wm); } catch (e) {
                console.error('CADNode worldMatrix listener error:', e);
            }
        }
    }

    // ─── Wyszukiwanie w drzewie ───────────────────────────────

    /**
     * Zwraca wszystkich potomków (DFS) danego typu.
     * Nie zwraca samego węzła nawet jeśli typ się zgadza.
     */
    findByType(type: NodeType): CADNode[] {
        const result: CADNode[] = [];
        this._collectByType(type, result);
        return result;
    }

    private _collectByType(type: NodeType, acc: CADNode[]): void {
        for (const child of this._children) {
            if (child.nodeType === type) acc.push(child);
            child._collectByType(type, acc);
        }
    }

    /**
     * Zwraca wszystkich potomków (DFS), niezależnie od typu.
     */
    findAll(): CADNode[] {
        const result: CADNode[] = [];
        this._collectAll(result);
        return result;
    }

    private _collectAll(acc: CADNode[]): void {
        for (const child of this._children) {
            acc.push(child);
            child._collectAll(acc);
        }
    }

    /**
     * Szuka węzła po ID w całym poddrzewie (wliczając ten węzeł).
     */
    findById(id: string): CADNode | null {
        if (this.id === id) return this;
        for (const child of this._children) {
            const found = child.findById(id);
            if (found) return found;
        }
        return null;
    }

    // ─── Util — transformacja lokalna→globalna i odwrotna ─────

    /**
     * Przelicza punkt z lokalnego LCS węzła do globalnego WCS.
     */
    localToWorld(localPoint: Vec3): Vec3 {
        return this.getWorldMatrix().transformPoint(localPoint);
    }

    /**
     * Przelicza punkt z globalnego WCS do lokalnego LCS węzła.
     */
    worldToLocal(worldPoint: Vec3): Vec3 {
        return this.getWorldMatrix().invert().transformPoint(worldPoint);
    }

    // ─── Serializacja (uproszczona) ───────────────────────────

    toJSON(): object {
        const { translation, rotation, scale } = this._localMatrix.decompose();
        return {
            id: this.id,
            name: this.name,
            nodeType: this.nodeType,
            localTransform: {
                translation: translation.toPlain(),
                rotation: rotation.toPlain(),
                scale: scale.toPlain()
            },
            children: this._children.map(c => c.toJSON())
        };
    }

    toString(): string {
        return `CADNode(${this.nodeType} "${this.name}" id=${this.id} children=${this._children.length})`;
    }
}
