import React, { useEffect, useRef, useState } from 'react';
import { PMIStore } from './pmi-data.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import pmiTekst from './pmi_tekst.json';
import {
    activateDimensionTool,
    activateMeasureTool,
    deactivateDimensionTool,
    getDimensionTool,
    isDimensionToolActive,
    isMeasureToolActive,
    DIMENSION_TOOL_STATE,
    MEASURE_TOOL_STATE,
} from './pmi-tool-activate.js';
import { PMI_EDIT_STATE } from './pmi-viewport-listener.js';
import { PmiSettingsModal } from './pmi-settings-modal.js';
import { closeCadFloatingEdit } from '../src/floating-edit/cad-edit-entity.js';

export interface PmiTopbarDropdownProps {
    activeTab?: string;
    onTabChange?: (tab: string) => void;
}

export function PmiTopbarDropdown({ activeTab, onTabChange }: PmiTopbarDropdownProps = {}) {
    useLocale();
    const store = PMIStore.instance;
    const [isOpen, setIsOpen] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<'NONE' | 'GLOBAL' | 'ALIGNED' | 'MEASURE'>('NONE');
    const containerRef = useRef<HTMLDivElement>(null);

    const activateTab = () => {
        if (onTabChange) {
            onTabChange('tab-a8-pmi');
        } else {
            window.dispatchEvent(new CustomEvent('cad-switch-tab', { detail: { tabId: 'tab-a8-pmi' } }));
        }
    };

    const getStateMachine = () => ContextManager.instance.stateMachine || ContextManager.instance.appAPI?.stateMachine;

    // Synchronizacja stanu aktywnego narzędzia z maszyną stanów
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const updateToolState = () => {
            const sm = getStateMachine();
            if (!sm) return;
            if (isMeasureToolActive(sm)) {
                setActiveTool('MEASURE');
            } else if (isDimensionToolActive(sm)) {
                setActiveTool(store.toolAxisSpace === 'ALIGNED' ? 'ALIGNED' : 'GLOBAL');
            } else {
                setActiveTool('NONE');
            }
        };

        const bind = () => {
            const sm = getStateMachine();
            if (!sm) {
                timer = setTimeout(bind, 100);
                return;
            }
            updateToolState();
            unsubscribe = sm.onStateChange((stateName: string) => {
                if (stateName === MEASURE_TOOL_STATE) {
                    setActiveTool('MEASURE');
                } else if (stateName === DIMENSION_TOOL_STATE || stateName === PMI_EDIT_STATE) {
                    setActiveTool(store.toolAxisSpace === 'ALIGNED' ? 'ALIGNED' : 'GLOBAL');
                } else {
                    setActiveTool('NONE');
                }
            });
        };

        bind();
        return () => {
            unsubscribe?.();
            if (timer) clearTimeout(timer);
        };
    }, [store]);

    // Zamykanie listy rozwijanej po kliknięciu poza komponentem
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectMode = (mode: 'GLOBAL' | 'ALIGNED' | 'MEASURE') => {
        const sm = getStateMachine();
        if (!sm) {
            console.warn('[PmiTopbarDropdown] Brak maszyny stanów');
            setIsOpen(false);
            return;
        }

        if (mode === 'MEASURE') {
            if (isMeasureToolActive(sm)) {
                deactivateDimensionTool(sm);
                setActiveTool('NONE');
                onTabChange?.('tab-a3-smartframe');
            } else {
                closeCadFloatingEdit();
                activateTab();
                ContextManager.instance.pmiRenderer?.setVisible(true);
                activateMeasureTool(sm);
                setActiveTool('MEASURE');
                ContextManager.instance.pmiRenderer?.renderAll(store);
            }
            setIsOpen(false);
            return;
        }

        const isCurrentlyThisMode = isDimensionToolActive(sm) && (
            mode === 'ALIGNED'
                ? store.toolAxisSpace === 'ALIGNED'
                : store.toolAxisSpace !== 'ALIGNED'
        );

        if (isCurrentlyThisMode) {
            deactivateDimensionTool(sm);
            setActiveTool('NONE');
            onTabChange?.('tab-a3-smartframe');
        } else {
            closeCadFloatingEdit();
            activateTab();
            ContextManager.instance.pmiRenderer?.setVisible(true);
            store.toolAxisSpace = mode;
            if (isDimensionToolActive(sm)) {
                getDimensionTool(sm)?.setAxisSpace(mode);
            } else {
                activateDimensionTool(sm);
            }
            setActiveTool(mode);
            ContextManager.instance.pmiRenderer?.renderAll(store);
        }

        setIsOpen(false);
    };

    const isButtonActive = activeTab === 'tab-a8-pmi';

    return (
        <div ref={containerRef} id="topbar-pmi-dropdown" style={{ position: 'relative', display: 'inline-flex' }}>
            <button
                id="tab-btn-pmi"
                type="button"
                className={`topbar-tool-btn ${isButtonActive ? 'active' : ''}`}
                onClick={() => {
                    closeCadFloatingEdit();
                    activateTab();
                    setIsOpen((prev) => !prev);
                }}
                title="Wymiary — Linie wymiarowe 3D i pomiar"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    paddingRight: '6px',
                }}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <line x1="3" y1="4" x2="3" y2="20" />
                    <line x1="21" y1="4" x2="21" y2="20" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <polyline points="7 9 3 12 7 15" />
                    <polyline points="17 9 21 12 17 15" />
                </svg>
                <span>{tx(pmiTekst, 'dropdown.dimensions')}</span>
                <svg
                    viewBox="0 0 24 24"
                    width="10"
                    height="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    style={{ marginLeft: 2, opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        backgroundColor: '#18181b',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '6px',
                        padding: '4px',
                        minWidth: '180px',
                        zIndex: 1200,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                    }}
                >
                    <button
                        type="button"
                        onClick={() => handleSelectMode('GLOBAL')}
                        style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: activeTool === 'GLOBAL' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                            color: activeTool === 'GLOBAL' ? '#93c5fd' : '#e4e4e7',
                            fontWeight: activeTool === 'GLOBAL' ? 600 : 400,
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            transition: 'background 0.12s, color 0.12s',
                        }}
                        onMouseEnter={(e) => {
                            if (activeTool !== 'GLOBAL') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                            if (activeTool !== 'GLOBAL') e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {tx(pmiTekst, 'dropdown.orthogonal')}
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSelectMode('ALIGNED')}
                        style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: activeTool === 'ALIGNED' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                            color: activeTool === 'ALIGNED' ? '#93c5fd' : '#e4e4e7',
                            fontWeight: activeTool === 'ALIGNED' ? 600 : 400,
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            transition: 'background 0.12s, color 0.12s',
                        }}
                        onMouseEnter={(e) => {
                            if (activeTool !== 'ALIGNED') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                            if (activeTool !== 'ALIGNED') e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {tx(pmiTekst, 'dropdown.aligned')}
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSelectMode('MEASURE')}
                        style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: activeTool === 'MEASURE' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                            color: activeTool === 'MEASURE' ? '#93c5fd' : '#e4e4e7',
                            fontWeight: activeTool === 'MEASURE' ? 600 : 400,
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            transition: 'background 0.12s, color 0.12s',
                        }}
                        onMouseEnter={(e) => {
                            if (activeTool !== 'MEASURE') e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                            if (activeTool !== 'MEASURE') e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {tx(pmiTekst, 'dropdown.measure')}
                    </button>

                    <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

                    <button
                        type="button"
                        onClick={() => {
                            setIsOpen(false);
                            setSettingsModalOpen(true);
                        }}
                        style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            color: '#a1a1aa',
                            fontWeight: 400,
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            transition: 'background 0.12s, color 0.12s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#a1a1aa';
                        }}
                    >
                        {tx(pmiTekst, 'dropdown.settings')}
                    </button>
                </div>
            )}

            <PmiSettingsModal
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
            />
        </div>
    );
}
