/**
 * SmartPanel Web — CncValidationReportModal
 * 
 * Modal Alertu i Raportu Rozbieżności CNC (CAD ↔ CAM).
 * Prezentuje wykryte braki (np. nowo dodany kanał LED, nowe nawierty), pozwala na 1-klikniętą
 * synchronizację z regułami maszynowymi oraz pobranie programów na obrabiarkę CNC.
 */

import React, { useState, useEffect } from 'react';
import { CncBatchController, GeneratedCncFile, CncBatchModalState } from './cnc-batch-controller.js';
import { openCncFromCad } from './open-modules.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

export const CncValidationReportModal: React.FC = () => {
    const [state, setState] = useState<CncBatchModalState>(() => CncBatchController.instance.getState());
    const [generatedFiles, setGeneratedFiles] = useState<GeneratedCncFile[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [successNotice, setSuccessNotice] = useState<string | null>(null);
    useLocale();

    useEffect(() => {
        const unsubscribe = CncBatchController.instance.subscribe(s => {
            setState(s);
            if (!s.open) {
                setGeneratedFiles([]);
                setSuccessNotice(null);
            }
        });
        return unsubscribe;
    }, []);

    if (!state.open || !state.scope) return null;

    const report = state.report;
    const panelsWithPrograms = report?.panelReports.filter(p => p.hasProgram) || [];
    const outdatedPanels = panelsWithPrograms.filter(p => !p.isSynced);
    const hasDiscrepancies = outdatedPanels.length > 0;

    const handleAutoSync = () => {
        setIsSyncing(true);
        setSuccessNotice(null);
        setTimeout(() => {
            const updatedReport = CncBatchController.instance.autoSynchronizeCurrentScope();
            setIsSyncing(false);
            if (updatedReport && !updatedReport.hasDiscrepancies) {
                setSuccessNotice(tx(srcTekst, 'cncval.synced', TX_NS));
                const files = CncBatchController.instance.generateFilesForScope(state.postprocessor);
                setGeneratedFiles(files);
            }
        }, 200);
    };

    const handleGenerate = () => {
        const files = CncBatchController.instance.generateFilesForScope(state.postprocessor);
        setGeneratedFiles(files);
        setSuccessNotice(tx(srcTekst, 'cncval.generated', TX_NS, { n: files.length, pp: state.postprocessor }));
    };

    const handleDownloadAll = () => {
        if (generatedFiles.length === 0) {
            handleGenerate();
        }
        CncBatchController.instance.downloadAllFiles(generatedFiles);
    };

    const handleOpenInEditor = (panelId: string, panelName: string) => {
        CncBatchController.instance.closeModal();
        openCncFromCad({ type: 'PANEL', id: panelId, name: panelName });
    };

    const postprocessors = [
        { id: 'WoodWOP', name: 'Homag / Weeke WoodWOP (.mpr)' },
        { id: 'Biesse', name: 'Biesse bSolid / Works (.cix)' },
        { id: 'SCM', name: 'SCM Maestro / Xilog (.xxl)' },
        { id: 'Mach3', name: 'Mach3 / Kimla ISO (.nc)' },
        { id: 'Fanuc', name: 'Fanuc / Haas CNC (.nc)' }
    ];

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
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '850px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                color: '#e4e4e7',
                fontFamily: 'Inter, system-ui, sans-serif'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #27272a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🏭</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f4f4f5' }}>
                                {tx(srcTekst, 'cncval.title', TX_NS)}
                            </h3>
                            <div style={{ fontSize: '0.8rem', color: '#a1a1aa', marginTop: '2px' }}>
                                Zakres: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{state.scope.name}</span> ({state.scope.type})
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => CncBatchController.instance.closeModal()}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#71717a',
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
                    {/* Status Alert Banner */}
                    {panelsWithPrograms.length === 0 ? (
                        <div style={{
                            padding: '14px 16px',
                            background: 'rgba(113, 113, 122, 0.12)',
                            border: '1px solid rgba(113, 113, 122, 0.4)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <span style={{ fontSize: '1.3rem' }}>ℹ️</span>
                            <div>
                                <div style={{ fontWeight: 600, color: '#d4d4d8', fontSize: '0.92rem' }}>
                                    {tx(srcTekst, 'cncval.no_programs', TX_NS)}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#a1a1aa', marginTop: '2px' }}>
                                    {tx(srcTekst, 'cncval.howto', TX_NS)} CNC.
                                </div>
                            </div>
                        </div>
                    ) : hasDiscrepancies ? (
                        <div style={{
                            padding: '14px 16px',
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px'
                        }}>
                            <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                            <div>
                                <div style={{ fontWeight: 600, color: '#fbbf24', fontSize: '0.92rem' }}>
                                    {tx(srcTekst, 'cncval.issues', TX_NS, { n: report?.totalDiscrepancyCount })}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#fde68a', marginTop: '4px', lineHeight: 1.4 }}>
                                    {tx(srcTekst, "cncval.issues_hint_a", TX_NS)} <b>Kanał LED</b>{tx(srcTekst, "cncval.issues_hint_b", TX_NS)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            padding: '14px 16px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <span style={{ fontSize: '1.3rem' }}>✅</span>
                            <div>
                                <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.92rem' }}>
                                    {tx(srcTekst, "cncval.all_ok", TX_NS, { n: panelsWithPrograms.length })}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#a7f3d0', marginTop: '2px' }}>
                                    {tx(srcTekst, "cncval.ready", TX_NS)}
                                </div>
                            </div>
                        </div>
                    )}

                    {successNotice && (
                        <div style={{
                            padding: '10px 14px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            borderRadius: '6px',
                            color: '#7dd3fc',
                            fontSize: '0.85rem'
                        }}>
                            ✓ {successNotice}
                        </div>
                    )}

                    {/* Machine / Postprocessor Selection */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#27272a',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid #3f3f46'
                    }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            Docelowa obrabiarka / Postprocesor:
                        </div>
                        <select
                            value={state.postprocessor}
                            onChange={(e) => CncBatchController.instance.setPostprocessor(e.target.value)}
                            style={{
                                background: '#18181b',
                                border: '1px solid #52525b',
                                color: '#f4f4f5',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                outline: 'none'
                            }}
                        >
                            {postprocessors.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Panels Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: hasDiscrepancies ? '#fbbf24' : '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{hasDiscrepancies ? '⚠️' : '✓'}</span>
                            <span>
                                {hasDiscrepancies
                                    ? tx(srcTekst, 'cncval.outdated_list', TX_NS, { n: outdatedPanels.length })
                                    : tx(srcTekst, 'cncval.all_current', TX_NS, { n: panelsWithPrograms.length })}
                            </span>
                        </div>

                        <div style={{
                            maxHeight: '320px',
                            overflowY: 'auto',
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            background: '#141416'
                        }}>
                            {(hasDiscrepancies ? outdatedPanels : panelsWithPrograms).map((p, idx) => {
                                const hasIssues = !p.isSynced;
                                return (
                                    <div
                                        key={p.panelId || idx}
                                        style={{
                                            padding: '12px 14px',
                                            borderBottom: idx === panelsWithPrograms.length - 1 ? 'none' : '1px solid #27272a',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            background: hasIssues ? 'rgba(239, 68, 68, 0.03)' : 'transparent'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.9rem' }}>
                                                    {hasIssues ? '⚠️' : '✓'}
                                                </span>
                                                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f4f4f5' }}>
                                                    {p.panelName}
                                                </span>
                                                {p.containerName && (
                                                    <span style={{ fontSize: '0.75rem', color: '#71717a', background: '#27272a', padding: '2px 6px', borderRadius: '4px' }}>
                                                        {p.containerName}
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontWeight: 500,
                                                    background: hasIssues ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                                    color: hasIssues ? '#fcd34d' : '#6ee7b7'
                                                }}>
                                                    {hasIssues ? tx(srcTekst, "cncval.issues_n", TX_NS, { n: p.discrepancies.length }) : tx(srcTekst, "cncval.consistent", TX_NS)}
                                                </span>

                                                <button
                                                    onClick={() => handleOpenInEditor(p.panelId, p.panelName)}
                                                    style={{
                                                        background: '#27272a',
                                                        border: '1px solid #3f3f46',
                                                        color: '#38bdf8',
                                                        padding: '3px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={tx(srcTekst, "cncval.open_cnc", TX_NS)}
                                                >
                                                    {tx(srcTekst, "cncval.open_cnc_btn", TX_NS)}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Discrepancies details */}
                                        {p.discrepancies.length > 0 && (
                                            <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {p.discrepancies.map((d, dIdx) => (
                                                    <div key={dIdx} style={{ fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span>•</span>
                                                        <span>{d.description}</span>
                                                        {d.suggestedToolName && (
                                                            <span style={{ color: '#93c5fd', fontSize: '0.75rem', background: '#1e3a8a', padding: '1px 5px', borderRadius: '3px' }}>
                                                                Sugerowane: {d.suggestedToolName}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Generated Files Preview (if generated) */}
                    {generatedFiles.length > 0 && (
                        <div style={{
                            background: '#121214',
                            border: '1px solid #22c55e',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4ade80' }}>
                                    ✓ Wygenerowane programy maszynowe ({generatedFiles.length} szt.):
                                </div>
                                <button
                                    onClick={handleDownloadAll}
                                    style={{
                                        background: '#16a34a',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '5px 12px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    💾 Pobierz wszystkie pliki
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto' }}>
                                {generatedFiles.map((f, i) => (
                                    <div
                                        key={i}
                                        onClick={() => CncBatchController.instance.downloadFile(f)}
                                        style={{
                                            background: '#27272a',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.78rem',
                                            color: '#e4e4e7',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                        title={tx(srcTekst, "cncval.download_file", TX_NS)}
                                    >
                                        <span>📄</span>
                                        <span>{f.filename}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div style={{
                    padding: '14px 20px',
                    borderTop: '1px solid #27272a',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={() => CncBatchController.instance.closeModal()}
                        style={{
                            background: '#27272a',
                            border: '1px solid #3f3f46',
                            color: '#a1a1aa',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        Zamknij
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        {panelsWithPrograms.length === 0 ? null : hasDiscrepancies ? (
                            <button
                                onClick={handleAutoSync}
                                disabled={isSyncing}
                                style={{
                                    background: '#f59e0b',
                                    border: 'none',
                                    color: '#000000',
                                    padding: '8px 18px',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                                }}
                            >
                                <span>{isSyncing ? '⏳ Synchronizowanie...' : '⚡ Zaktualizuj programy i wygeneruj'}</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleDownloadAll}
                                style={{
                                    background: '#0284c7',
                                    border: 'none',
                                    color: '#ffffff',
                                    padding: '8px 18px',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                                }}
                            >
                                <span>💾 Pobierz programy CNC</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
