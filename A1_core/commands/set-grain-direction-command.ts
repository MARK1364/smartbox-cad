/**
 * SmartPanel Web — SetGrainDirectionCommand
 *
 * Odwracalna komenda obrotu kierunku usłojenia (rotate_grain) dla jednej lub wielu formatek.
 * Wspiera pełny cykl Undo / Redo poprzez CommandHistory.
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';

export class SetGrainDirectionCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    private readonly _explicitNextState?: boolean;
    private readonly _oldStates: Map<string, boolean> = new Map();
    private readonly _newStates: Map<string, boolean> = new Map();
    private readonly _panelRefs: Map<string, any> = new Map();

    constructor(
        targetIds: string | string[],
        newRotateGrain?: boolean,
        label?: string,
        panelRefs?: any[]
    ) {
        const ids = (Array.isArray(targetIds) ? targetIds : [targetIds])
            .map(id => String(id || ''))
            .filter(Boolean);

        this.id = `cmd_grain_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.affectedNodeIds = ids;
        this._explicitNextState = newRotateGrain;
        this.timestamp = Date.now();

        if (Array.isArray(panelRefs)) {
            panelRefs.forEach((panel, idx) => {
                if (!panel) return;
                const key = String(panel.id || ids[idx] || `idx_${idx}`);
                this._panelRefs.set(key, panel);
                if (!this.affectedNodeIds.includes(key)) {
                    this.affectedNodeIds.push(key);
                }
                const prev = Boolean(panel.rotate_grain || panel.custom_properties?.rotate_grain);
                this._oldStates.set(key, prev);
                this._newStates.set(key, newRotateGrain !== undefined ? Boolean(newRotateGrain) : !prev);
            });
        }

        this.label = label ?? 'Obrót usłojenia 90°';
    }

    execute(document: ProjectDocument): void {
        const panels = this._resolvePanels(document);
        for (const [key, panel] of panels.entries()) {
            if (!this._oldStates.has(key)) {
                const prev = Boolean(panel.rotate_grain || panel.custom_properties?.rotate_grain);
                this._oldStates.set(key, prev);
            }
            if (!this._newStates.has(key)) {
                const prev = this._oldStates.get(key) ?? false;
                const next = this._explicitNextState !== undefined ? Boolean(this._explicitNextState) : !prev;
                this._newStates.set(key, next);
            }
            const nextState = this._newStates.get(key)!;
            this._applyGrainState(panel, nextState);
        }
        this._notifyDocument(document);
    }

    undo(document: ProjectDocument): void {
        const panels = this._resolvePanels(document);
        for (const [key, panel] of panels.entries()) {
            const prevState = this._oldStates.get(key) ?? false;
            this._applyGrainState(panel, prevState);
        }
        this._notifyDocument(document);
    }

    private _resolvePanels(document: ProjectDocument | null | undefined): Map<string, any> {
        const resolved = new Map<string, any>();

        for (const nodeId of this.affectedNodeIds) {
            const fromDoc = document?.findNode?.(nodeId)?.domainData;
            const panel = fromDoc || this._panelRefs.get(nodeId);
            if (panel) {
                resolved.set(nodeId, panel);
            }
        }

        for (const [key, panel] of this._panelRefs.entries()) {
            if (!resolved.has(key) && panel) {
                resolved.set(key, panel);
            }
        }

        return resolved;
    }

    private _applyGrainState(panel: any, rotateGrain: boolean): void {
        const next = Boolean(rotateGrain);
        if (typeof panel.setRotateGrain === 'function') {
            panel.setRotateGrain(next);
            return;
        }
        panel.rotate_grain = next;
        if (!panel.custom_properties) {
            panel.custom_properties = {};
        }
        panel.custom_properties.rotate_grain = next;
        if (typeof panel._emit === 'function') {
            panel._emit('grainChanged', { rotate_grain: next });
        }
    }

    private _notifyDocument(document: ProjectDocument | null | undefined): void {
        document?.notifyDocumentChanged?.(this.affectedNodeIds);
        document?.emitChange?.('all', this.affectedNodeIds);
        if (typeof globalThis.document !== 'undefined' && typeof globalThis.document.dispatchEvent === 'function') {
            try {
                globalThis.document.dispatchEvent(new CustomEvent('bloki-properties-update', { detail: {} }));
            } catch {
                // ignore in headless test environments without CustomEvent
            }
        }
    }
}

