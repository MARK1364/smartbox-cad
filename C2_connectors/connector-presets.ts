/**
 * Presety narzędzi złączy — reguła + offset + maska + typy na siatce 32 mm.
 * Persystencja w localStorage (narzędzia użytkownika, niezależne od projektu).
 */

import {
    countRulePositions,
    getConnectorDefinition,
    getPlacementRuleDefinition,
    getRulePositionTypes,
} from './connectors-engine.js';
import {
    DEFAULT_FIRST_OFFSET_MM,
    canonicalPlacementRule,
    type ConnectorPreset,
} from './connectors-types.js';

export const CONNECTOR_PRESETS_STORAGE_KEY = 'cad.c2.connectorPresets';

export type ConnectorPresetListener = () => void;

export function normalizePositionsActive(
    placementRule: string,
    mask?: boolean[] | null,
): boolean[] {
    const total = countRulePositions(getPlacementRuleDefinition(placementRule));
    const next = Array(total).fill(true) as boolean[];
    if (!mask?.length) return next;
    for (let i = 0; i < Math.min(mask.length, total); i++) {
        next[i] = mask[i] !== false;
    }
    return next;
}

export function normalizePositionTypes(
    placementRule: string,
    types?: string[] | null,
): string[] {
    const defaults = getRulePositionTypes(placementRule);
    if (!types?.length) return [...defaults];
    return defaults.map((fallback, i) => {
        const t = types[i];
        if (typeof t === 'string' && t && getConnectorDefinition(t)) return t;
        return fallback;
    });
}

export function summarizePresetMask(
    preset: Pick<ConnectorPreset, 'placementRule' | 'positionsActive' | 'positionTypes'>,
): string {
    const types = normalizePositionTypes(preset.placementRule, preset.positionTypes);
    let kolki = 0;
    let konf = 0;
    let mini = 0;
    for (let idx = 0; idx < types.length; idx++) {
        if (preset.positionsActive[idx] === false) continue;
        const t = types[idx];
        if (t.startsWith('kolki')) kolki += 1;
        else if (t.startsWith('konfirmat')) konf += 1;
        else if (t === 'minifix') mini += 1;
    }
    const parts: string[] = [];
    if (kolki) parts.push(`K${kolki}`);
    if (konf) parts.push(`C${konf}`);
    if (mini) parts.push(`M${mini}`);
    return parts.length ? parts.join('+') : '0';
}

function revivePreset(raw: any): ConnectorPreset | null {
    if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
    const placementRule = canonicalPlacementRule(String(raw.placementRule || 'standard_od_lewej'));
    const firstOffsetMm = Number(raw.firstOffsetMm);
    return {
        id: raw.id,
        name: String(raw.name).trim() || 'Preset',
        placementRule,
        firstOffsetMm: Number.isFinite(firstOffsetMm) ? firstOffsetMm : DEFAULT_FIRST_OFFSET_MM,
        positionsActive: normalizePositionsActive(
            placementRule,
            Array.isArray(raw.positionsActive) ? raw.positionsActive.map(Boolean) : null,
        ),
        positionTypes: normalizePositionTypes(
            placementRule,
            Array.isArray(raw.positionTypes) ? raw.positionTypes.map(String) : null,
        ),
    };
}

export class ConnectorPresetStore {
    private static _instance: ConnectorPresetStore | null = null;

    static get instance(): ConnectorPresetStore {
        if (!ConnectorPresetStore._instance) {
            ConnectorPresetStore._instance = new ConnectorPresetStore();
            ConnectorPresetStore._instance.load();
        }
        return ConnectorPresetStore._instance;
    }

    presets: ConnectorPreset[] = [];
    private _nextId = 1;
    private _listeners = new Set<ConnectorPresetListener>();

    onChange(listener: ConnectorPresetListener): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    notifyChanged(): void {
        for (const listener of this._listeners) {
            try {
                listener();
            } catch (err) {
                console.error('ConnectorPresetStore listener error:', err);
            }
        }
    }

    private persist(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(CONNECTOR_PRESETS_STORAGE_KEY, JSON.stringify({
                nextId: this._nextId,
                presets: this.presets,
            }));
        } catch (err) {
            console.warn('[C2] Nie udało się zapisać presetów złączy:', err);
        }
    }

    load(): void {
        if (typeof localStorage === 'undefined') {
            this.presets = [];
            this._nextId = 1;
            return;
        }
        try {
            const raw = localStorage.getItem(CONNECTOR_PRESETS_STORAGE_KEY);
            if (!raw) {
                this.presets = [];
                this._nextId = 1;
                return;
            }
            const data = JSON.parse(raw);
            this.presets = Array.isArray(data?.presets)
                ? data.presets.map(revivePreset).filter((p: ConnectorPreset | null): p is ConnectorPreset => !!p)
                : [];
            this._nextId = Number.isFinite(data?.nextId)
                ? Math.max(1, Number(data.nextId))
                : this.presets.length + 1;
        } catch {
            this.presets = [];
            this._nextId = 1;
        }
    }

    get(id: string): ConnectorPreset | null {
        return this.presets.find((p) => p.id === id) ?? null;
    }

    add(input: Omit<ConnectorPreset, 'id'> & { id?: string }): ConnectorPreset {
        const placementRule = canonicalPlacementRule(input.placementRule);
        const preset: ConnectorPreset = {
            id: input.id || `CP_${this._nextId++}`,
            name: input.name.trim() || 'Preset',
            placementRule,
            firstOffsetMm: Number.isFinite(input.firstOffsetMm)
                ? input.firstOffsetMm
                : DEFAULT_FIRST_OFFSET_MM,
            positionsActive: normalizePositionsActive(placementRule, input.positionsActive),
            positionTypes: normalizePositionTypes(placementRule, input.positionTypes),
        };
        this.presets.push(preset);
        this.persist();
        this.notifyChanged();
        return preset;
    }

    update(id: string, patch: Partial<Omit<ConnectorPreset, 'id'>>): ConnectorPreset | null {
        const preset = this.get(id);
        if (!preset) return null;
        if (typeof patch.name === 'string') preset.name = patch.name.trim() || preset.name;
        if (typeof patch.placementRule === 'string') {
            preset.placementRule = canonicalPlacementRule(patch.placementRule);
        }
        if (patch.firstOffsetMm != null && Number.isFinite(patch.firstOffsetMm)) {
            preset.firstOffsetMm = patch.firstOffsetMm;
        }
        if (patch.positionsActive || patch.placementRule) {
            preset.positionsActive = normalizePositionsActive(
                preset.placementRule,
                patch.positionsActive ?? preset.positionsActive,
            );
        }
        if (patch.positionTypes || patch.placementRule) {
            preset.positionTypes = normalizePositionTypes(
                preset.placementRule,
                patch.positionTypes ?? preset.positionTypes,
            );
        }
        this.persist();
        this.notifyChanged();
        return preset;
    }

    remove(id: string): boolean {
        const index = this.presets.findIndex((p) => p.id === id);
        if (index === -1) return false;
        this.presets.splice(index, 1);
        this.persist();
        this.notifyChanged();
        return true;
    }

    /** Testy / reset. */
    replaceAll(presets: ConnectorPreset[], nextId = 1): void {
        this.presets = presets.map((p) => revivePreset(p)).filter((p): p is ConnectorPreset => !!p);
        this._nextId = Math.max(1, nextId);
        this.persist();
        this.notifyChanged();
    }

    clear(): void {
        this.presets = [];
        this._nextId = 1;
        this.persist();
        this.notifyChanged();
    }
}
