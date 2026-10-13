/**
 * Panel C2 — narzędzia złączy. Lista połączeń jest w drzewie (zakładka Złącza).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { TooltipManager } from '../A1_core/tooltip-manager.js';
import { getPlacementRuleDefinition, getPlacementRuleKeys } from './connectors-engine.js';
import {
    isConnectorPickActive,
    startConnectorPick,
    stopConnectorPick,
} from './connector-picker.js';
import {
    ConnectorPresetStore,
    summarizePresetMask,
} from './connector-presets.js';
import { ConnectorStore } from './connector-store.js';
import { ConnectorPositionsEditor } from './connector-positions-editor.js';
import type { ConnectorPreset } from './connectors-types.js';
import { DRZEWO_TAB_EVENT } from '../S2_solver/constraint-pick-flow.js';
import './connectors-ui.css';

export const CONNECTORS_PANEL_TITLE = 'Zarządzanie Złączami';

const IDLE_HINT_ID = 'c2_connectors_idle';

interface Props {
    projectModel: any;
}

function openDrzewoZlaczaTab() {
    window.dispatchEvent(new CustomEvent(DRZEWO_TAB_EVENT, { detail: { tab: 'zlacza' } }));
}

function showIdleHint() {
    TooltipManager.instance.setActiveHint({
        id: IDLE_HINT_ID,
        title: 'Złącza',
        description: 'Kliknij preset na liście, potem płaszczyznę styku na scenie.',
        category: 'general',
    });
}

function clearOwnHint() {
    const id = TooltipManager.instance.activeHint?.id;
    if (id === IDLE_HINT_ID || id === 'c2_connectors_pick') {
        TooltipManager.instance.clearActiveHint();
    }
}

export function ConnectorsUI({ projectModel }: Props) {
    const store = ConnectorStore.instance;
    const presetStore = ConnectorPresetStore.instance;
    const [tick, setTick] = useState(0);
    const [picking, setPicking] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [editorOpen, setEditorOpen] = useState(false);

    const document = projectModel?.document ?? projectModel ?? ContextManager.instance.document;

    useEffect(() => {
        const bump = () => {
            setTick((t) => t + 1);
            setPicking(isConnectorPickActive());
        };
        const offStore = store.onChange(bump);
        const offPresets = presetStore.onChange(bump);
        const offDoc = document?.onDocumentChanged?.(bump);
        const poll = window.setInterval(() => {
            const now = isConnectorPickActive();
            setPicking((prev) => (prev === now ? prev : now));
        }, 200);
        return () => {
            offStore();
            offPresets();
            if (typeof offDoc === 'function') offDoc();
            window.clearInterval(poll);
            stopConnectorPick();
            clearOwnHint();
        };
    }, [document, store, presetStore]);

    // Podpowiedź na scenie (TooltipManager) — nie w panelu.
    useEffect(() => {
        if (picking) return;
        showIdleHint();
        return () => {
            if (TooltipManager.instance.activeHint?.id === IDLE_HINT_ID) {
                TooltipManager.instance.clearActiveHint();
            }
        };
    }, [picking]);

    void tick;
    const refresh = useCallback(() => setTick((t) => t + 1), []);

    const ruleKeys = getPlacementRuleKeys();
    const presets = presetStore.presets;
    const activeCount = store.positionsActive.filter((on) => on !== false).length;

    const activatePresetTool = (preset: ConnectorPreset) => {
        // Ponowne kliknięcie aktywnego presetu kończy wstawianie.
        if (picking && store.activePresetId === preset.id) {
            stopConnectorPick();
            setPicking(false);
            refresh();
            return;
        }
        store.applyPreset(preset);
        if (!isConnectorPickActive()) {
            startConnectorPick();
            setPicking(true);
            openDrzewoZlaczaTab();
        }
        refresh();
    };

    const onSavePreset = () => {
        const name = presetName.trim()
            || getPlacementRuleDefinition(store.placementRule)?.name
            || 'Preset';
        const preset = presetStore.add({
            name,
            placementRule: store.placementRule,
            firstOffsetMm: store.firstOffsetMm,
            positionsActive: store.positionsActive,
            positionTypes: store.positionTypes,
        });
        store.activePresetId = preset.id;
        setPresetName('');
        setEditorOpen(false);
        store.notifyChanged();
        refresh();
    };

    return (
        <div className="c2-panel">
            <div className="c2-box">
                <button
                    type="button"
                    className="c2-box__head"
                    onClick={() => setEditorOpen((v) => !v)}
                    aria-expanded={editorOpen}
                >
                    <span className={`c2-box__chevron${editorOpen ? ' is-open' : ''}`} aria-hidden />
                    <span className="c2-box__title">+ Nowy preset</span>
                </button>

                {editorOpen && (
                    <div className="c2-box__body">
                        <label className="c2-field">
                            <span>Nazwa</span>
                            <input
                                type="text"
                                className="c2-field__text"
                                placeholder="np. Od przodu 3K+2C"
                                value={presetName}
                                disabled={picking}
                                onChange={(e) => setPresetName(e.target.value)}
                            />
                        </label>
                        <label className="c2-field">
                            <span>Reguła:</span>
                            <select
                                value={store.placementRule}
                                onChange={(e) => {
                                    store.setPlacementRule(e.target.value);
                                    store.activePresetId = '';
                                    refresh();
                                }}
                                disabled={picking}
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
                                    disabled={picking}
                                    onChange={(e) => {
                                        const n = Number(e.target.value);
                                        if (!Number.isFinite(n)) return;
                                        store.firstOffsetMm = n;
                                        store.activePresetId = '';
                                        store.notifyChanged();
                                        refresh();
                                    }}
                                />
                                <span className="c2-field__unit">mm</span>
                            </span>
                        </label>

                        <div className="c2-box__subtitle">
                            Pozycje siatki ({activeCount} aktywnych)
                        </div>
                        <ConnectorPositionsEditor
                            placementRule={store.placementRule}
                            firstOffsetMm={store.firstOffsetMm}
                            positionsActive={store.positionsActive}
                            positionTypes={store.positionTypes}
                            disabled={picking}
                            onToggle={(index) => {
                                store.togglePosition(index);
                                store.activePresetId = '';
                                refresh();
                            }}
                            onChangeType={(index, type) => {
                                store.setPositionType(index, type);
                                store.activePresetId = '';
                                refresh();
                            }}
                        />

                        <button
                            type="button"
                            className="c2-btn c2-btn--primary"
                            disabled={picking}
                            onClick={onSavePreset}
                        >
                            Zapisz preset
                        </button>
                    </div>
                )}
            </div>

            <div className="c2-box">
                <div className="c2-box__title">Presety</div>
                {presets.length === 0 ? (
                    <p className="c2-empty">Brak presetów — otwórz „Nowy preset” (+).</p>
                ) : (
                    <div className="c2-preset-tools">
                        {presets.map((preset) => {
                            const active = store.activePresetId === preset.id;
                            const ruleName = getPlacementRuleDefinition(preset.placementRule)?.name || preset.placementRule;
                            return (
                                <div
                                    key={preset.id}
                                    className={`c2-preset-tool${active ? ' is-active' : ''}${picking && active ? ' is-picking' : ''}`}
                                    title={`${preset.name}\n${ruleName} · ${preset.firstOffsetMm} mm · ${summarizePresetMask(preset)}\nKliknij, aby wstawiać złącza`}
                                    onClick={() => activatePresetTool(preset)}
                                >
                                    <span className="c2-preset-tool__body">
                                        <span className="c2-preset-tool__name">{preset.name}</span>
                                        <span className="c2-preset-tool__meta">
                                            {ruleName} · {summarizePresetMask(preset)} · {preset.firstOffsetMm} mm
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        className="c2-preset-tool__del"
                                        title="Usuń preset"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (store.activePresetId === preset.id) {
                                                store.activePresetId = '';
                                                if (picking) {
                                                    stopConnectorPick();
                                                    setPicking(false);
                                                }
                                            }
                                            presetStore.remove(preset.id);
                                            refresh();
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </div>
    );
}
