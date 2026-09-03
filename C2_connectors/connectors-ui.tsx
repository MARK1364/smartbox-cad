/**
 * Panel C2 — narzędzia złączy. Lista połączeń jest w drzewie (zakładka Złącza).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { ConnectorsEngine } from './connectors-engine.js';
import {
    confirmConnectorPick,
    getConnectorPickCount,
    isConnectorPickActive,
    startConnectorPick,
    stopConnectorPick,
} from './connector-picker.js';
import { ConnectorStore } from './connector-store.js';
import { DRZEWO_TAB_EVENT } from '../S2_solver/constraint-pick-flow.js';
import './connectors-ui.css';

export const CONNECTORS_PANEL_TITLE = 'Zarządzanie Złączami';

interface Props {
    projectModel: any;
}

function openDrzewoZlaczaTab() {
    window.dispatchEvent(new CustomEvent(DRZEWO_TAB_EVENT, { detail: { tab: 'zlacza' } }));
}

export function ConnectorsUI({ projectModel }: Props) {
    const store = ConnectorStore.instance;
    const engine = new ConnectorsEngine();
    const [tick, setTick] = useState(0);
    const [picking, setPicking] = useState(false);

    const document = projectModel?.document ?? projectModel ?? ContextManager.instance.document;

    useEffect(() => {
        const bump = () => {
            setTick((t) => t + 1);
            setPicking(isConnectorPickActive());
        };
        const offStore = store.onChange(bump);
        const offDoc = document?.onDocumentChanged?.(bump);
        const poll = window.setInterval(() => {
            const now = isConnectorPickActive();
            setPicking((prev) => (prev === now ? prev : now));
        }, 200);
        return () => {
            offStore();
            if (typeof offDoc === 'function') offDoc();
            window.clearInterval(poll);
            stopConnectorPick();
        };
    }, [document, store]);

    void tick;
    const refresh = useCallback(() => setTick((t) => t + 1), []);

    const ruleKeys = engine.getPlacementRuleKeys();
    const pickCount = getConnectorPickCount();

    const onTogglePick = () => {
        if (isConnectorPickActive()) {
            stopConnectorPick();
            setPicking(false);
        } else {
            startConnectorPick();
            setPicking(true);
            openDrzewoZlaczaTab();
        }
        refresh();
    };

    const onConfirm = () => {
        confirmConnectorPick();
        setPicking(false);
        openDrzewoZlaczaTab();
        refresh();
    };

    return (
        <div className="c2-panel">
            <div className="c2-box">
                <div className="c2-box__title">Ustawienia Złącz</div>
                <label className="c2-field">
                    <span>Reguła:</span>
                    <select
                        value={store.placementRule}
                        onChange={(e) => {
                            store.placementRule = e.target.value;
                            store.notifyChanged();
                            refresh();
                        }}
                        disabled={picking}
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
                            disabled={picking}
                            onChange={(e) => {
                                const n = Number(e.target.value);
                                if (!Number.isFinite(n)) return;
                                store.firstOffsetMm = n;
                                store.notifyChanged();
                                refresh();
                            }}
                        />
                        <span className="c2-field__unit">mm</span>
                    </span>
                </label>
                <button
                    type="button"
                    className={`c2-btn c2-btn--primary${picking ? ' is-active' : ''}`}
                    onClick={onTogglePick}
                    aria-pressed={picking}
                    title={picking
                        ? 'Wyłącz, aby zaznaczać formatki (wejście do CNC)'
                        : 'Włącz, aby wskazywać płaszczyzny styku'}
                >
                    Wstaw połączenia
                </button>
                {picking && (
                    <div className="c2-multi">
                        <div className="c2-multi__title">TRYB PŁASZCZYZN AKTYWNY</div>
                        {pickCount > 0 && <div>Dodano połączeń: {pickCount}</div>}
                        <button type="button" className="c2-btn c2-btn--primary" onClick={onConfirm}>
                            ZATWIERDŹ ({pickCount})
                        </button>
                    </div>
                )}
            </div>
            <p className="c2-tools-hint">
                Wpisy lądują w drzewie obiektów — zakładka Złącza.
            </p>
        </div>
    );
}
