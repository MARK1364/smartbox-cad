/**
 * ConnectorStore — grupy złączy w extensions.connectors (jak ConstraintStore).
 */

import type { DocumentExtension, ProjectDocument } from '../A1_core/project-document.js';
import {
    CONNECTORS_DOCUMENT_SECTION,
    CONNECTORS_SCHEMA_VERSION,
    DEFAULT_FIRST_OFFSET_MM,
    LEGACY_SYMMETRY2_FIRST_OFFSET_MM,
    LEGACY_SYMMETRY2_RULE,
    canonicalPlacementRule,
    normalizeConnectorSide,
    type ConnectorGroup,
    type ConnectorInstance,
    type Vec3Tuple,
} from './connectors-types.js';

export interface ConnectorStoreJSON {
    version: number;
    nextId: number;
    groups: ConnectorGroup[];
    clipboardRule?: string;
    clipboardFirstOffsetMm?: number;
}

function parseFirstOffsetMm(raw: unknown, fallback: number): number {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

export type ConnectorChangeListener = () => void;

function isTuple(raw: unknown): raw is Vec3Tuple {
    return Array.isArray(raw) && raw.length === 3 && raw.every((n) => Number.isFinite(n));
}

function reviveGroup(raw: any): ConnectorGroup | null {
    if (!raw || typeof raw.id !== 'string' || typeof raw.parentObjectId !== 'string') {
        return null;
    }
    const verts = Array.isArray(raw.faceVertsLocalMm)
        ? raw.faceVertsLocalMm.filter(isTuple)
        : [];
    const connectors: ConnectorInstance[] = Array.isArray(raw.connectors)
        ? raw.connectors.filter((c: any) => c && typeof c.type === 'string' && isTuple(c.positionLocalMm)).map((c: any) => ({
            type: c.type,
            index: Number(c.index) || 0,
            offsetMm: Number(c.offsetMm) || 0,
            side: normalizeConnectorSide(String(c.side ?? 'front')),
            positionLocalMm: c.positionLocalMm as Vec3Tuple,
            normalLocalMm: isTuple(c.normalLocalMm) ? c.normalLocalMm : [0, 1, 0],
            diameterMm: Number(c.diameterMm) || 8,
            lengthMm: Number(c.lengthMm) || 35,
        }))
        : [];
    const rawRule = String(raw.placementRule || 'standard_od_lewej');
    const legacy2 = rawRule === LEGACY_SYMMETRY2_RULE;
    return {
        id: raw.id,
        name: String(raw.name || raw.id),
        parentObjectId: raw.parentObjectId,
        otherObjectId: String(raw.otherObjectId || ''),
        faceName: String(raw.faceName || ''),
        placementRule: canonicalPlacementRule(rawRule),
        firstOffsetMm: parseFirstOffsetMm(
            raw.firstOffsetMm,
            legacy2 ? LEGACY_SYMMETRY2_FIRST_OFFSET_MM : DEFAULT_FIRST_OFFSET_MM,
        ),
        positionsActive: Array.isArray(raw.positionsActive) ? raw.positionsActive.map(Boolean) : [],
        faceVertsLocalMm: verts,
        faceNormalLocalMm: isTuple(raw.faceNormalLocalMm) ? raw.faceNormalLocalMm : [0, 1, 0],
        connectors,
    };
}

export class ConnectorStore {
    private static _instance: ConnectorStore | null = null;

    static get instance(): ConnectorStore {
        if (!ConnectorStore._instance) {
            ConnectorStore._instance = new ConnectorStore();
        }
        return ConnectorStore._instance;
    }

    groups: ConnectorGroup[] = [];
    clipboardRule = '';
    clipboardFirstOffsetMm = DEFAULT_FIRST_OFFSET_MM;
    editingGroupId = '';
    placementRule = 'standard_od_lewej';
    firstOffsetMm = DEFAULT_FIRST_OFFSET_MM;
    private _nextId = 1;
    private _listeners = new Set<ConnectorChangeListener>();

    onChange(listener: ConnectorChangeListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    notifyChanged(): void {
        for (const listener of this._listeners) {
            try {
                listener();
            } catch (err) {
                console.error('ConnectorStore listener error:', err);
            }
        }
    }

    nextGroupId(): string {
        const id = `CONN_${this._nextId}`;
        this._nextId += 1;
        return id;
    }

    addGroup(group: ConnectorGroup): ConnectorGroup {
        this.groups.push(group);
        this.notifyChanged();
        return group;
    }

    get(id: string): ConnectorGroup | null {
        return this.groups.find((g) => g.id === id) ?? null;
    }

    updateGroup(id: string, patch: Partial<ConnectorGroup>): boolean {
        const group = this.get(id);
        if (!group) return false;
        Object.assign(group, patch);
        this.notifyChanged();
        return true;
    }

    removeGroup(id: string): boolean {
        const index = this.groups.findIndex((g) => g.id === id);
        if (index === -1) return false;
        this.groups.splice(index, 1);
        if (this.editingGroupId === id) this.editingGroupId = '';
        this.notifyChanged();
        return true;
    }

    replaceGroup(id: string, next: ConnectorGroup): boolean {
        const index = this.groups.findIndex((g) => g.id === id);
        if (index === -1) return false;
        this.groups[index] = next;
        this.notifyChanged();
        return true;
    }

    setEditing(id: string): void {
        this.editingGroupId = id;
        const group = this.get(id);
        if (group) {
            this.placementRule = group.placementRule;
            this.firstOffsetMm = group.firstOffsetMm ?? DEFAULT_FIRST_OFFSET_MM;
        }
        this.notifyChanged();
    }

    copyRuleFrom(id: string): boolean {
        const group = this.get(id);
        if (!group) return false;
        this.clipboardRule = group.placementRule;
        this.clipboardFirstOffsetMm = group.firstOffsetMm ?? DEFAULT_FIRST_OFFSET_MM;
        this.notifyChanged();
        return true;
    }

    pruneMissingNodes(existingIds: Set<string>): number {
        const kept = this.groups.filter((g) => existingIds.has(g.parentObjectId));
        const removed = this.groups.length - kept.length;
        if (removed > 0) {
            this.groups = kept;
            if (this.editingGroupId && !this.groups.some((g) => g.id === this.editingGroupId)) {
                this.editingGroupId = '';
            }
            this.notifyChanged();
        }
        return removed;
    }

    clear(): void {
        this.groups = [];
        this.clipboardRule = '';
        this.clipboardFirstOffsetMm = DEFAULT_FIRST_OFFSET_MM;
        this.editingGroupId = '';
        this.placementRule = 'standard_od_lewej';
        this.firstOffsetMm = DEFAULT_FIRST_OFFSET_MM;
        this._nextId = 1;
        this.notifyChanged();
    }

    toJSON(): ConnectorStoreJSON {
        return {
            version: CONNECTORS_SCHEMA_VERSION,
            nextId: this._nextId,
            groups: this.groups.map((g) => ({
                ...g,
                faceVertsLocalMm: g.faceVertsLocalMm.map((v) => [...v] as Vec3Tuple),
                faceNormalLocalMm: [...g.faceNormalLocalMm] as Vec3Tuple,
                positionsActive: [...g.positionsActive],
                connectors: g.connectors.map((c) => ({ ...c, positionLocalMm: [...c.positionLocalMm] as Vec3Tuple, normalLocalMm: [...c.normalLocalMm] as Vec3Tuple })),
            })),
            clipboardRule: this.clipboardRule,
            clipboardFirstOffsetMm: this.clipboardFirstOffsetMm,
        };
    }

    fromJSON(data: ConnectorStoreJSON | null | undefined): void {
        if (!data || !Array.isArray(data.groups)) {
            this.groups = [];
            this.clipboardRule = '';
            this.clipboardFirstOffsetMm = DEFAULT_FIRST_OFFSET_MM;
            this.editingGroupId = '';
            this.firstOffsetMm = DEFAULT_FIRST_OFFSET_MM;
            this._nextId = 1;
            this.notifyChanged();
            return;
        }
        if (data.version !== CONNECTORS_SCHEMA_VERSION) {
            console.warn(`ConnectorStore: nieznana wersja ${data.version}.`);
            this.groups = [];
            this.notifyChanged();
            return;
        }
        this.groups = data.groups.map(reviveGroup).filter((g): g is ConnectorGroup => !!g);
        this.clipboardRule = typeof data.clipboardRule === 'string' ? data.clipboardRule : '';
        this.clipboardFirstOffsetMm = parseFirstOffsetMm(data.clipboardFirstOffsetMm, DEFAULT_FIRST_OFFSET_MM);
        this._nextId = Number.isFinite(data.nextId) ? Math.max(1, data.nextId) : this.groups.length + 1;
        this.editingGroupId = '';
        this.notifyChanged();
    }

    attachTo(document: ProjectDocument): () => void {
        const extension: DocumentExtension = {
            serialize: () => this.toJSON(),
            load: (data) => this.fromJSON(data),
        };
        return document.registerExtension(CONNECTORS_DOCUMENT_SECTION, extension);
    }
}
