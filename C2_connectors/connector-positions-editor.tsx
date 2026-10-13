/**
 * Lista siatki 32 mm: aktywny checkbox + typ (kołek / konfirmat / mimośród).
 */

import React from 'react';
import {
    getConnectorTypeKeys,
    getPlacementRuleDefinition,
    shortConnectorTypeLabel,
} from './connectors-engine.js';
import {
    applyFirstHoleOffset,
    isConnectorFromFront,
    ruleEdgeOffsetMm,
} from './connectors-types.js';

export function ConnectorPositionsEditor({
    placementRule,
    firstOffsetMm,
    positionsActive,
    positionTypes,
    onToggle,
    onChangeType,
    disabled = false,
}: {
    placementRule: string;
    firstOffsetMm: number;
    positionsActive: boolean[];
    positionTypes: string[];
    onToggle: (index: number) => void;
    onChangeType: (index: number, type: string) => void;
    disabled?: boolean;
}) {
    const ruleDef = getPlacementRuleDefinition(placementRule);
    const edgeBase = ruleEdgeOffsetMm(ruleDef);
    const typeKeys = getConnectorTypeKeys();
    const sides = ruleDef?.sides ?? [];
    let globalIndex = 0;
    return (
        <div className="c2-positions">
            <div className="c2-positions__hint">Siatka 32 mm — aktywny otwór i typ</div>
            {sides.map((side, si) => (
                <div key={si} className="c2-side">
                    {sides.length > 1 && (
                        <div className="c2-side__label">
                            {isConnectorFromFront(side.direction) ? 'PRZÓD' : 'TYŁ'}
                        </div>
                    )}
                    {side.positions.map((pos) => {
                        const idx = globalIndex++;
                        const on = positionsActive[idx] !== false;
                        const type = positionTypes[idx] || pos.type;
                        const offsetLabel = applyFirstHoleOffset(pos.offset_mm, firstOffsetMm, edgeBase);
                        return (
                            <div
                                key={idx}
                                className={`c2-pos-row ${on ? 'is-on' : 'is-off'}`}
                            >
                                <button
                                    type="button"
                                    className="c2-pos-row__check"
                                    disabled={disabled}
                                    title={on ? 'Wyłącz otwór' : 'Włącz otwór'}
                                    onClick={() => onToggle(idx)}
                                >
                                    <span aria-hidden>{on ? '☑' : '☐'}</span>
                                    <span className="c2-pos-row__off">{offsetLabel} mm</span>
                                </button>
                                <select
                                    className="c2-pos-row__type"
                                    value={type}
                                    disabled={disabled || !on}
                                    onChange={(e) => onChangeType(idx, e.target.value)}
                                    title="Typ złącza na tej pozycji"
                                >
                                    {typeKeys.map((key) => (
                                        <option key={key} value={key}>
                                            {shortConnectorTypeLabel(key)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
