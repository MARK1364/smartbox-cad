/**
 * Wiersz złącza w drzewie — lista i edycja pozycji. Panel C2 zostaje przy narzędziach.
 */

import React, { useMemo } from 'react';
import { ConnectorsEngine } from './connectors-engine.js';
import { executeConnectorCommand, RemoveConnectorGroupCommand } from './connector-commands.js';
import { applyRuleToGroup } from './connector-picker.js';
import { ConnectorStore } from './connector-store.js';
import {
    applyFirstHoleOffset,
    isConnectorFromFront,
    ruleEdgeOffsetMm,
    type ConnectorGroup,
} from './connectors-types.js';
import './connectors-ui.css';

interface Props {
    group: ConnectorGroup;
    document: any;
}

export function ConnectorTreeRow({ group: g, document }: Props) {
    const store = ConnectorStore.instance;
    const engine = useMemo(() => new ConnectorsEngine(), []);
    const editing = store.editingGroupId === g.id;
    const ruleKeys = engine.getPlacementRuleKeys();

    const onPaste = () => {
        if (!store.clipboardRule) return;
        store.placementRule = store.clipboardRule;
        store.firstOffsetMm = store.clipboardFirstOffsetMm;
        applyRuleToGroup(document, g.id, store.clipboardRule, undefined, store.clipboardFirstOffsetMm);
    };

    const onTogglePosition = (index: number) => {
        const live = store.get(g.id);
        if (!live) return;
        const next = [...live.positionsActive];
        if (index < next.length) next[index] = !next[index];
        store.updateGroup(g.id, { positionsActive: next });
    };

    const onRegenerate = () => {
        applyRuleToGroup(
            document,
            g.id,
            store.placementRule,
            store.get(g.id)?.positionsActive,
            store.firstOffsetMm,
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
                                store.placementRule = e.target.value;
                                store.notifyChanged();
                            }}
                        >
                            {ruleKeys.map((key) => (
                                <option key={key} value={key}>
                                    {engine.getPlacementRuleDefinition(key)?.name || key}
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
                    <ConnectorPositions
                        group={store.get(g.id) ?? g}
                        engine={engine}
                        onToggle={onTogglePosition}
                    />
                    <button type="button" className="c2-btn c2-btn--primary" onClick={onRegenerate}>
                        Regeneruj
                    </button>
                </div>
            )}
        </div>
    );
}

function ConnectorPositions({
    group,
    engine,
    onToggle,
}: {
    group: ConnectorGroup;
    engine: ConnectorsEngine;
    onToggle: (index: number) => void;
}) {
    const store = ConnectorStore.instance;
    const ruleDef = engine.getPlacementRuleDefinition(store.placementRule);
    const edgeBase = ruleEdgeOffsetMm(ruleDef);
    const sides = ruleDef?.sides ?? [];
    let globalIndex = 0;
    return (
        <>
            {sides.map((side, si) => (
                <div key={si} className="c2-side">
                    {sides.length > 1 && (
                        <div className="c2-side__label">
                            {isConnectorFromFront(side.direction) ? 'PRZÓD' : 'TYŁ'}
                        </div>
                    )}
                    {side.positions.map((pos) => {
                        const idx = globalIndex++;
                        const on = group.positionsActive[idx] !== false;
                        const def = engine.getConnectorDefinition(pos.type);
                        const name = (def?.name || pos.type)
                            .replace('Kołek ', 'Kolek ')
                            .replace('Konfirmat ', 'Konf ');
                        return (
                            <button
                                key={idx}
                                type="button"
                                className={`c2-pos ${on ? 'is-on' : 'is-off'}`}
                                onClick={() => onToggle(idx)}
                            >
                                <span className="c2-pos__check">{on ? '☑' : '☐'}</span>
                                <span className="c2-pos__off">
                                    {String(applyFirstHoleOffset(pos.offset_mm, store.firstOffsetMm, edgeBase)).padStart(3, ' ')}mm
                                </span>
                                <span>{name}</span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </>
    );
}
