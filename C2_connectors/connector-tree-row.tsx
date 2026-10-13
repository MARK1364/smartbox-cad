/**
 * Wiersz złącza w drzewie — lista i edycja pozycji. Panel C2 zostaje przy narzędziach.
 */

import React from 'react';
import {
    getPlacementRuleDefinition,
    getPlacementRuleKeys,
} from './connectors-engine.js';
import { executeConnectorCommand, RemoveConnectorGroupCommand } from './connector-commands.js';
import { applyRuleToGroup } from './connector-picker.js';
import { ConnectorPositionsEditor } from './connector-positions-editor.js';
import { ConnectorStore } from './connector-store.js';
import type { ConnectorGroup } from './connectors-types.js';
import './connectors-ui.css';

interface Props {
    group: ConnectorGroup;
    document: any;
}

export function ConnectorTreeRow({ group: g, document }: Props) {
    const store = ConnectorStore.instance;
    const editing = store.editingGroupId === g.id;
    const ruleKeys = getPlacementRuleKeys();

    const onPaste = () => {
        if (!store.clipboardRule) return;
        store.setPlacementRule(store.clipboardRule);
        store.firstOffsetMm = store.clipboardFirstOffsetMm;
        store.setPositionsActive(store.clipboardPositionsActive);
        store.setPositionTypes(store.clipboardPositionTypes);
        applyRuleToGroup(
            document,
            g.id,
            store.clipboardRule,
            store.clipboardPositionsActive,
            store.clipboardFirstOffsetMm,
            store.clipboardPositionTypes,
        );
    };

    const onTogglePosition = (index: number) => {
        const live = store.get(g.id);
        if (!live) return;
        const next = [...live.positionsActive];
        if (index < next.length) next[index] = !next[index];
        store.updateGroup(g.id, { positionsActive: next });
        store.setPositionsActive(next);
    };

    const onChangeType = (index: number, type: string) => {
        const live = store.get(g.id);
        if (!live) return;
        const next = [...(live.positionTypes?.length ? live.positionTypes : store.positionTypes)];
        if (index < next.length) next[index] = type;
        store.updateGroup(g.id, { positionTypes: next });
        store.setPositionTypes(next);
    };

    const onRegenerate = () => {
        applyRuleToGroup(
            document,
            g.id,
            store.placementRule,
            store.positionsActive,
            store.firstOffsetMm,
            store.positionTypes,
        );
    };

    const parentName = document?.findNode?.(g.parentObjectId)?.name || g.parentObjectId.slice(0, 8);
    const otherName = g.otherObjectId
        ? (document?.findNode?.(g.otherObjectId)?.name || g.otherObjectId.slice(0, 8))
        : '';

    return (
        <div className={`drzewo-zlacz${editing ? ' drzewo-zlacz--open' : ''}`}>
            <div className="tree-node">
                <div
                    className="tree-node-content"
                    onClick={() => store.setEditing(editing ? '' : g.id)}
                >
                    <span className="drzewo-row-kind">Złącze</span>
                    <span className="node-name-text" title={g.name}>{g.name}</span>
                    <span className="drzewo-row-meta">
                        {otherName ? `${parentName} · ${otherName}` : parentName}
                    </span>
                </div>
                <div className="tree-node-actions">
                    <button
                        type="button"
                        className="tree-action-btn"
                        title="Kopiuj regułę"
                        onClick={(e) => {
                            e.stopPropagation();
                            store.copyRuleFrom(g.id);
                        }}
                    >
                        ⧉
                    </button>
                    <button
                        type="button"
                        className="tree-action-btn"
                        title="Wklej regułę"
                        disabled={!store.clipboardRule}
                        onClick={(e) => {
                            e.stopPropagation();
                            onPaste();
                        }}
                    >
                        📋
                    </button>
                    <button
                        type="button"
                        className="tree-action-btn btn-delete"
                        title="Usuń połączenie"
                        onClick={(e) => {
                            e.stopPropagation();
                            executeConnectorCommand(new RemoveConnectorGroupCommand(store, g));
                        }}
                    >
                        🗑
                    </button>
                </div>
            </div>

            {editing && (
                <div className="drzewo-zlacz__edit">
                    <label className="c2-field">
                        <span>Reguła</span>
                        <select
                            value={store.placementRule}
                            onChange={(e) => {
                                store.setPlacementRule(e.target.value);
                            }}
                        >
                            {ruleKeys.map((key) => (
                                <option key={key} value={key}>
                                    {getPlacementRuleDefinition(key)?.name || key}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="c2-field">
                        <span>Pierwszy otwór</span>
                        <span className="c2-field__value">
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={store.firstOffsetMm}
                                onChange={(e) => {
                                    const n = Number(e.target.value);
                                    if (!Number.isFinite(n)) return;
                                    store.firstOffsetMm = n;
                                    store.notifyChanged();
                                }}
                            />
                            <span className="c2-field__unit">mm</span>
                        </span>
                    </label>
                    <ConnectorPositionsEditor
                        placementRule={store.placementRule}
                        firstOffsetMm={store.firstOffsetMm}
                        positionsActive={store.positionsActive}
                        positionTypes={store.positionTypes}
                        onToggle={onTogglePosition}
                        onChangeType={onChangeType}
                    />
                    <button type="button" className="c2-btn c2-btn--primary" onClick={onRegenerate}>
                        Regeneruj
                    </button>
                </div>
            )}
        </div>
    );
}
