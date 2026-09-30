/**
 * SmartPanel Web — C1_CNC UI OperationsTab (Pełna wersja z wyborem profilu w 3D i edytorem cech)
 * 
 * Zakładka drzewa operacji technologicznych, selekcji konturu z 3D oraz modala edycji cech.
 */

import React, { useState } from 'react';
import { CNCProgramState } from '../../core/cam-state-store.js';
import { ToolLibrary } from '../../processor/tool-library.js';
import { DrillingStrategy } from '../../strategies/drilling-strategy.js';
import { ProfilingStrategy } from '../../strategies/profiling-strategy.js';
import { PocketingStrategy } from '../../strategies/pocketing-strategy.js';
import { CAMFeature, ContourFeature, HoleFeature, GrooveFeature } from '../../dto/cam-dto.js';
import { CNCEngine } from '../../core/cnc-engine.js';
import { ContextManager } from '../../../A1_core/context-manager.js';
import { tx } from '../../../T1_tlumaczenia/core.js';
import { useLocale } from '../../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

declare const BABYLON: any;

interface OperationsTabProps {
    program: CNCProgramState;
    toolLibrary: ToolLibrary;
    isSelectingProfile: boolean;
    onToggleSelectingProfile: () => void;
    onUpdateProgram: (updater: (p: CNCProgramState) => CNCProgramState) => void;
    onGenerateCLData: () => void;
}

export const OperationsTab: React.FC<OperationsTabProps> = ({
    program,
    toolLibrary,
    isSelectingProfile,
    onToggleSelectingProfile,
    onUpdateProgram,
    onGenerateCLData
}) => {
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>('profiling_25d');
    const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
    const [tempFeatureEdit, setTempFeatureEdit] = useState<any>(null);
    const [hoveredFeatureIdx, setHoveredFeatureIdx] = useState<number | null>(null);
    const [pinnedPreviewIdx, setPinnedPreviewIdx] = useState<number | null>(null);
    useLocale();

    const tools = toolLibrary.getAllTools();
    const strategies = [new DrillingStrategy(), new ProfilingStrategy(), new PocketingStrategy()];

    const handleToolAssign = (featureId: string, toolId: string) => {
        onUpdateProgram(p => ({
            ...p,
            toolAssignments: { ...p.toolAssignments, [featureId]: toolId },
            features: p.features.map(f => f.featureId === featureId ? { ...f, toolId } : f)
        }));
    };

    const handleOpenEditModal = (idx: number) => {
        const feat = program.features[idx];
        setEditingFeatureIndex(idx);
        setTempFeatureEdit(JSON.parse(JSON.stringify(feat)));
    };

    const handleSaveEditModal = () => {
        if (editingFeatureIndex === null || !tempFeatureEdit) return;
        onUpdateProgram(p => {
            const updated = [...p.features];
            updated[editingFeatureIndex] = tempFeatureEdit;
            return { ...p, features: updated };
        });
        setEditingFeatureIndex(null);
        setTempFeatureEdit(null);
    };

    const handleDeleteFeature = (idx: number) => {
        onUpdateProgram(p => ({
            ...p,
            features: p.features.filter((_, i) => i !== idx)
        }));
        if (pinnedPreviewIdx === idx) {
            setPinnedPreviewIdx(null);
            const pvs = ContextManager.instance.panelViews as Map<any, any> | undefined;
            const targetPanel = program.targetPanel;
            const view = pvs && targetPanel ? pvs.get(targetPanel) : null;
            if (view && typeof view.clearFeatureHighlights === 'function') {
                view.clearFeatureHighlights();
            }
            CNCEngine.getInstance().visualizer?.clearHighlight();
        }
    };

    const resolveCurrentPanelView = () => {
        const pvs = ContextManager.instance.panelViews as Map<any, any> | undefined;
        if (!pvs || pvs.size === 0) return null;
        const targetPanel = program.targetPanel;
        if (targetPanel && pvs.has(targetPanel)) return pvs.get(targetPanel);
        if (targetPanel) {
            for (const [p, v] of pvs.entries()) {
                if (p === targetPanel || (p?.id && targetPanel?.id && p.id === targetPanel.id)) {
                    return v;
                }
            }
        }
        const act = ContextManager.instance.activePanel || ContextManager.instance.selectedPanel;
        if (act && pvs.has(act)) return pvs.get(act);
        if (act) {
            for (const [p, v] of pvs.entries()) {
                if (p === act || (p?.id && act?.id && p.id === act.id)) {
                    return v;
                }
            }
        }
        return pvs.values().next().value || null;
    };

    const handleFeatureHover = (feat: any, idx: number) => {
        setHoveredFeatureIdx(idx);
        const engine = CNCEngine.getInstance();
        const view = resolveCurrentPanelView();
        let handled = false;
        if (view && typeof view.highlightFeature === 'function') {
            handled = Boolean(view.highlightFeature(feat, true));
        }
        if (!handled) {
            engine.visualizer?.highlightFeature(feat, view?.root || null);
        } else {
            engine.visualizer?.clearHighlight();
        }
    };

    const handleFeatureLeave = (_idx: number) => {
        setHoveredFeatureIdx(null);
        const engine = CNCEngine.getInstance();
        const view = resolveCurrentPanelView();
        if (view && typeof view.clearFeatureHighlights === 'function') {
            view.clearFeatureHighlights();
        }
        if (pinnedPreviewIdx !== null) {
            const pinnedFeat = program.features[pinnedPreviewIdx];
            if (pinnedFeat) {
                let handled = false;
                if (view && typeof view.highlightFeature === 'function') {
                    handled = Boolean(view.highlightFeature(pinnedFeat, true));
                }
                if (!handled) {
                    engine.visualizer?.highlightFeature(pinnedFeat, view?.root || null);
                } else {
                    engine.visualizer?.clearHighlight();
                }
                return;
            }
        }
        engine.visualizer?.clearHighlight();
    };

    const handleTogglePinFeature = (feat: any, idx: number) => {
        const engine = CNCEngine.getInstance();
        const view = resolveCurrentPanelView();

        if (pinnedPreviewIdx === idx) {
            setPinnedPreviewIdx(null);
            if (view && typeof view.clearFeatureHighlights === 'function') {
                view.clearFeatureHighlights();
            }
            engine.visualizer?.clearHighlight();
        } else {
            setPinnedPreviewIdx(idx);
            if (view && typeof view.clearFeatureHighlights === 'function') {
                view.clearFeatureHighlights();
            }
            let handled = false;
            if (view && typeof view.highlightFeature === 'function') {
                handled = Boolean(view.highlightFeature(feat, true));
            }
            if (!handled) {
                engine.visualizer?.highlightFeature(feat, view?.root || null);
            } else {
                engine.visualizer?.clearHighlight();
            }
        }
    };

    return (
        <div className="cnc-subtab-content p-3 space-y-4 text-sm text-gray-200">
            <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-green-400">{tx(cncTekst, 'operations.title', TX_NS)}</h4>
                    <span className="text-xs bg-gray-900 text-gray-300 px-2 py-0.5 rounded">
                        {tx(cncTekst, 'operations.feature_count', TX_NS)} {program.features.length}
                    </span>
                </div>

                {/* Przycisk aktywacji wyboru krawędzi profilu w 3D */}
                <button
                    onClick={onToggleSelectingProfile}
                    className={`w-full py-2 px-3 rounded font-semibold text-xs transition ${isSelectingProfile ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                >
                    {isSelectingProfile ? tx(cncTekst, 'operations.pick_profile_building', TX_NS) : tx(cncTekst, 'operations.pick_profile', TX_NS)}
                </button>

                {program.features.length === 0 ? (
                    <div className="text-xs text-gray-400 p-3 text-center border border-dashed border-gray-700 rounded">
                        {tx(cncTekst, 'operations.no_features', TX_NS)}
                    </div>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {program.features.map((feat, idx) => {
                            const isHole = 'diameter' in feat;
                            const isGroove = 'startPoint' in feat;
                            const hole = isHole ? (feat as HoleFeature) : null;
                            const count = hole?.holeCount || (hole?.positions ? hole.positions.length : 1);
                            const dimBadge = isHole
                                ? `Ø${hole.diameter} × ${hole.depth} mm${count > 1 ? ` (${count}×)` : ''}`
                                : (isGroove ? `szer. ${(feat as any).width} × ${(feat as any).depth} mm` : '');

                            const featType = isHole
                                ? (count > 1 ? tx(cncTekst, 'operations.type_drilling_multi', TX_NS, { n: count }) : tx(cncTekst, 'operations.type_drilling', TX_NS))
                                : (isGroove ? tx(cncTekst, 'operations.type_groove', TX_NS) : tx(cncTekst, 'operations.type_contour', TX_NS));
                            const assignedToolId = feat.toolId || program.toolAssignments[feat.featureId] || '';

                            const isHovered = hoveredFeatureIdx === idx;
                            const isPinned = pinnedPreviewIdx === idx;
                            const isActiveHighlight = isHovered || isPinned;

                            return (
                                <div 
                                    key={feat.featureId || idx} 
                                    onMouseEnter={() => handleFeatureHover(feat, idx)}
                                    onMouseLeave={() => handleFeatureLeave(idx)}
                                    className={`p-2.5 rounded border text-xs space-y-1.5 transition-colors ${
                                        isActiveHighlight
                                            ? 'bg-blue-950/80 border-blue-500 shadow-md shadow-blue-950/50'
                                            : (assignedToolId ? 'bg-gray-900 border-green-800/80' : 'bg-gray-900 border-gray-700')
                                    }`}
                                >
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            {/* Przycisk Oka — podgląd w 3D (bez obwódki) */}
                                            <button
                                                type="button"
                                                className="tree-action-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTogglePinFeature(feat, idx);
                                                }}
                                                title={isPinned ? 'Wyłącz podgląd 3D' : 'Podgląd w 3D'}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: isPinned ? '#38bdf8' : (isActiveHighlight ? '#38bdf8' : '#94a3b8'),
                                                    padding: '2px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: (isPinned || isActiveHighlight) ? 1 : 0.6,
                                                    transition: 'opacity 0.15s ease, color 0.15s ease'
                                                }}
                                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                                onMouseLeave={(e) => {
                                                    if (!isPinned && !isActiveHighlight) (e.currentTarget as HTMLElement).style.opacity = '0.6';
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            </button>

                                            <div className="flex flex-col min-w-0">
                                                <span className="font-semibold text-blue-300 truncate">
                                                    #{idx + 1} [{featType}] {feat.name || feat.featureId}
                                                </span>
                                                {dimBadge && (
                                                    <span className="text-[10px] text-sky-400 font-medium">
                                                        {dimBadge}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {/* Ołówek / Długopis (bez obwódki) */}
                                            <button
                                                type="button"
                                                className="tree-action-btn"
                                                onClick={() => handleOpenEditModal(idx)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#94a3b8',
                                                    padding: '2px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: 0.6,
                                                    transition: 'opacity 0.15s ease, color 0.15s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    (e.currentTarget as HTMLElement).style.opacity = '1';
                                                    (e.currentTarget as HTMLElement).style.color = '#60a5fa';
                                                }}
                                                onMouseLeave={(e) => {
                                                    (e.currentTarget as HTMLElement).style.opacity = '0.6';
                                                    (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                                                }}
                                                title={tx(cncTekst, 'operations.edit', TX_NS)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M12 20h9" />
                                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                                </svg>
                                            </button>

                                            {/* Kosz (bez obwódki) */}
                                            <button
                                                type="button"
                                                className="tree-action-btn"
                                                onClick={() => handleDeleteFeature(idx)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#94a3b8',
                                                    padding: '2px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    opacity: 0.6,
                                                    transition: 'opacity 0.15s ease, color 0.15s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    (e.currentTarget as HTMLElement).style.opacity = '1';
                                                    (e.currentTarget as HTMLElement).style.color = '#ef4444';
                                                }}
                                                onMouseLeave={(e) => {
                                                    (e.currentTarget as HTMLElement).style.opacity = '0.6';
                                                    (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                                                }}
                                                title={tx(cncTekst, 'panel.delete', TX_NS)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        <span className="text-gray-400 text-xs">{tx(cncTekst, 'operations.tool', TX_NS)}</span>
                                        <select
                                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-white"
                                            value={assignedToolId}
                                            onChange={(e) => handleToolAssign(feat.featureId, e.target.value)}
                                        >
                                            <option value="">{tx(cncTekst, 'operations.pick_tool', TX_NS)}</option>
                                            {tools.map(t => (
                                                <option key={t.id} value={t.id}>
                                                    [{t.id}] {t.name} (FI {t.diameter}mm)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-2">
                <h4 className="font-semibold text-purple-400">{tx(cncTekst, 'operations.strategy_title', TX_NS)}</h4>
                <select
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-xs"
                    value={selectedStrategyId}
                    onChange={(e) => setSelectedStrategyId(e.target.value)}
                >
                    {strategies.map(s => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>

                <button
                    onClick={onGenerateCLData}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-3 rounded text-xs transition"
                >
                    {tx(cncTekst, 'operations.recalc', TX_NS)}
                </button>
            </div>

            {/* Modal edycji właściwości operacji */}
            {editingFeatureIndex !== null && tempFeatureEdit && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700 text-white p-4 rounded-lg w-96 space-y-3 shadow-2xl">
                        <h4 className="font-bold text-sm text-blue-400 border-b border-gray-800 pb-2">
                            {tx(cncTekst, 'operations.edit_title', TX_NS, { n: editingFeatureIndex + 1 })}
                        </h4>

                        <div className="space-y-2 text-xs">
                            <div>
                                <label className="block text-gray-400 mb-1">{tx(cncTekst, 'operations.depth', TX_NS)}</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                    value={tempFeatureEdit.depth ?? ''}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === '' || raw === '-') {
                                            setTempFeatureEdit({ ...tempFeatureEdit, depth: raw as any });
                                        } else {
                                            const val = parseFloat(raw);
                                            setTempFeatureEdit({ ...tempFeatureEdit, depth: isNaN(val) ? 0 : val });
                                        }
                                    }}
                                />
                            </div>

                            {'diameter' in tempFeatureEdit && (
                                <div>
                                    <label className="block text-gray-400 mb-1">{tx(cncTekst, 'operations.hole_dia', TX_NS)}</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                        value={tempFeatureEdit.diameter || 8}
                                        onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, diameter: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            )}

                            {('points' in tempFeatureEdit || 'startPoint' in tempFeatureEdit) && (
                                <>
                                    <div className="mb-2">
                                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="form-checkbox text-blue-500 bg-gray-800 border-gray-700 rounded"
                                                checked={tempFeatureEdit.reverseDirection || false}
                                                onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, reverseDirection: e.target.checked })}
                                            />
                                            {tx(cncTekst, 'operations.reverse_dir', TX_NS)}
                                        </label>
                                    </div>

                                    {'points' in tempFeatureEdit && (
                                        <div>
                                            <label className="block text-gray-400 mb-1">{tx(cncTekst, 'operations.comp_title', TX_NS)}</label>
                                            <select
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
                                                value={tempFeatureEdit.compensation || 'Center'}
                                                onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, compensation: e.target.value })}
                                            >
                                                <option value="Center">{tx(cncTekst, 'operations.comp_none', TX_NS)}</option>
                                                <option value="Left">{tx(cncTekst, 'operations.comp_left', TX_NS)}</option>
                                                <option value="Right">{tx(cncTekst, 'operations.comp_right', TX_NS)}</option>
                                            </select>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div>
                                            <label className="block text-gray-400 mb-1">Lead-In (mm):</label>
                                            <input
                                                type="number"
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                                value={tempFeatureEdit.leadIn ?? 5}
                                                onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, leadIn: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 mb-1">Lead-Out (mm):</label>
                                            <input
                                                type="number"
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white font-mono"
                                                value={tempFeatureEdit.leadOut ?? 5}
                                                onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, leadOut: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-800">
                            <button
                                onClick={handleSaveEditModal}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-1.5 px-3 rounded text-xs"
                            >
                                {tx(cncTekst, 'operations.save', TX_NS)}
                            </button>
                            <button
                                onClick={() => { setEditingFeatureIndex(null); setTempFeatureEdit(null); }}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-1.5 px-3 rounded text-xs"
                            >
                                {tx(cncTekst, 'operations.cancel', TX_NS)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
