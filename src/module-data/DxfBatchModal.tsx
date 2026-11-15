/**
 * SmartPanel Web — DxfBatchModal
 * 
 * Modal zatwierdzenia masowego eksportu do DXF i kart technologicznych HTML
 * dla poziomu korpusu lub całego projektu.
 */

import React, { useState, useEffect } from 'react';
import { DxfBatchController, type DxfBatchModalState } from './dxf-batch-controller.js';

export const DxfBatchModal: React.FC = () => {
    const [state, setState] = useState<DxfBatchModalState>(() => DxfBatchController.instance.getState());

    useEffect(() => {
        const unsubscribe = DxfBatchController.instance.subscribe(s => setState(s));
        return () => { unsubscribe(); };
    }, []);

    if (!state.open || !state.scope) {
        return null;
    }

    const selectedCount = state.panels.filter(p => p.selected).length;
    const allSelected = state.panels.length > 0 && selectedCount === state.panels.length;
    const isCorpus = state.scope.type === 'CONTAINER' || state.scope.type === 'BLOKI';

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: '#131b2e',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '820px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
                color: '#f8fafc',
                fontFamily: 'Inter, system-ui, sans-serif'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📐</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                                Rysunki Techniczne i Eksport DXF
                            </h3>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                                Zakres: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{state.scope.name}</span> ({isCorpus ? 'Korpus' : 'Projekt'})
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => DxfBatchController.instance.closeModal()}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            padding: '4px 8px',
                            borderRadius: '4px'
                        }}
                        title="Zamknij"
                    >
                        ✕
                    </button>
                </div>

                {/* Body Content */}
                <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                        padding: '12px 16px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.86rem',
                        color: '#94a3b8',
                        lineHeight: 1.5
                    }}>
                        Dla wszystkich wybranych formatek zostanie wygenerowany interaktywny <strong style={{ color: '#ffffff' }}>rysunek techniczny</strong> ze zwymiarowanymi otworami od bazy odniesienia, rowkami, wycięciami i okleinowaniem oraz możliwością pobrania plików <strong style={{ color: '#38bdf8' }}>AutoCAD DXF</strong>.
                    </div>

                    {/* Tabela formatek */}
                    <div style={{
                        background: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: '#0f172a',
                            borderBottom: '1px solid #1e293b',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: '#94a3b8'
                        }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(e) => DxfBatchController.instance.selectAll(e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                />
                                Formatki do zatwierdzenia ({selectedCount} / {state.panels.length})
                            </label>
                        </div>

                        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#0f172a', color: '#64748b', borderBottom: '1px solid #1e293b' }}>
                                        <th style={{ padding: '8px 12px', width: '36px' }}></th>
                                        <th style={{ padding: '8px 12px' }}>Formatka</th>
                                        <th style={{ padding: '8px 12px' }}>Rola</th>
                                        <th style={{ padding: '8px 12px' }}>Wymiary (W × H × T)</th>
                                        <th style={{ padding: '8px 12px' }}>Otwory</th>
                                        <th style={{ padding: '8px 12px' }}>Korpus</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {state.panels.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                                                Brak formatek w wybranym zakresie
                                            </td>
                                        </tr>
                                    ) : (
                                        state.panels.map((p, idx) => (
                                            <tr
                                                key={p.id}
                                                style={{
                                                    borderBottom: '1px solid #1e293b',
                                                    background: p.selected ? 'rgba(56, 189, 248, 0.04)' : 'transparent',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => DxfBatchController.instance.toggleSelect(p.id)}
                                            >
                                                <td style={{ padding: '8px 12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={p.selected}
                                                        onChange={() => DxfBatchController.instance.toggleSelect(p.id)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#f8fafc' }}>
                                                    {idx + 1}. {p.name}
                                                </td>
                                                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                                                    {p.role}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontFamily: 'Consolas, monospace' }}>
                                                    {p.width} × {p.height} × {p.thickness} mm
                                                </td>
                                                <td style={{ padding: '8px 12px', color: p.holesCount > 0 ? '#4ade80' : '#64748b', fontWeight: p.holesCount > 0 ? 600 : 400 }}>
                                                    {p.holesCount > 0 ? `${p.holesCount} szt.` : '0'}
                                                </td>
                                                <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                                                    {p.containerName || '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#0f172a',
                    borderBottomLeftRadius: '12px',
                    borderBottomRightRadius: '12px'
                }}>
                    <button
                        onClick={() => DxfBatchController.instance.closeModal()}
                        style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 500
                        }}
                    >
                        Anuluj
                    </button>

                    <button
                        onClick={() => DxfBatchController.instance.confirmAndExport()}
                        disabled={selectedCount === 0}
                        style={{
                            background: selectedCount > 0 ? '#0284c7' : '#334155',
                            color: selectedCount > 0 ? '#ffffff' : '#64748b',
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: '6px',
                            cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: selectedCount > 0 ? '0 4px 12px rgba(2, 132, 199, 0.4)' : 'none'
                        }}
                    >
                        <span>📄 Generuj rysunki techniczne ({selectedCount} {selectedCount === 1 ? 'formatka' : 'formatek'})</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
