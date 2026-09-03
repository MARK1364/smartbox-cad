/**
 * E2_export - export-ui-v2.tsx
 * Panel boczny modułu Eksport 2 zintegrowany z żywą sceną 3D:
 * - Lista modeli umieszczonych na arkuszu 3D z opcją niezależnego obrotu,
 * - Wybór formatu papieru i stempla ISO 7200,
 * - Przyciski eksportu (Drukuj PDF, JPG 300 DPI, Wyczyść).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ExportEngineV2 } from './export-engine-v2';
import { PaperFormat, PAPER_FORMATS } from './export-types';

export const ExportUIv2: React.FC = () => {
    const engine = useMemo(() => ExportEngineV2.instance, []);
    const [, setTick] = useState(0);
    const [showTitleBlock, setShowTitleBlock] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        engine.setShowBounds(true);
        const unsubscribe = engine.subscribe(() => setTick((t) => t + 1));
        return () => {
            unsubscribe();
            engine.setShowBounds(false);
        };
    }, [engine]);

    const showToast = (msg: string) => {
        setStatusMessage(msg);
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handlePrint = () => {
        engine.printSheet();
    };

    const handleDownloadJpg = async () => {
        try {
            await engine.downloadJpgScreenshot();
            showToast('Pobrano raster JPG 300 DPI!');
        } catch (e: any) {
            alert('Błąd eksportu JPG: ' + e?.message || e);
        }
    };

    const handleClear = () => {
        if (confirm('Czy na pewno chcesz usunąć wszystkie modele z arkusza?')) {
            engine.clearAllModels();
            showToast('Wyczyszczono arkusz');
        }
    };

    return (
        <div className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
            {statusMessage && <div className="export-status-toast">{statusMessage}</div>}

            <div className="export-ui-container">
                {/* ─── Baner informacyjny Drag & Drop ─── */}
                <div
                    style={{
                        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(16, 185, 129, 0.15))',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        marginBottom: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🌳 Żywa Biblioteka Modeli 3D
                        </span>
                        <span style={{ fontSize: '0.65rem', background: '#2563eb', color: '#fff', padding: '2px 5px', borderRadius: '3px', fontWeight: 600 }}>
                            DRAG & DROP
                        </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#cbd5e1', lineHeight: '1.3' }}>
                        Przeciągnij dowolny element z <strong>Drzewa Obiektu</strong> po lewej stronie na arkusz 3D. Możesz upuścić go <strong>wielokrotnie</strong> i każdy ustawić pod innym kątem!
                    </div>
                </div>

                {/* ─── Modele na Arkuszu ─── */}
                <div className="panel-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📋 Modele na Arkuszu ({engine.placedModels.length})
                        </h3>
                        {engine.placedModels.length > 0 && (
                            <button
                                onClick={handleClear}
                                style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                                Wyczyść arkusz
                            </button>
                        )}
                    </div>

                    {engine.placedModels.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(15, 23, 42, 0.5)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '4px', color: '#94a3b8', fontSize: '0.75rem' }}>
                            Arkusz jest czysty.<br />
                            Chwyć element z drzewa po lewej stronie i upuść tutaj!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {engine.placedModels.map((m, idx) => {
                                const isActive = engine.activeModelId === m.id;
                                return (
                                    <div
                                        key={m.id}
                                        onClick={() => engine.setActiveModelId(m.id)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px',
                                            padding: '8px',
                                            borderRadius: '5px',
                                            background: isActive ? 'rgba(37, 99, 235, 0.25)' : '#1e293b',
                                            border: `1px solid ${isActive ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>{m.nodeType === 'PART' ? '🪵' : '📦'}</span>
                                                <strong style={{ color: isActive ? '#93c5fd' : '#f1f5f9' }}>
                                                    {m.nodeName} (#{idx + 1})
                                                </strong>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    engine.removeModel(m.id);
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}
                                                title="Usuń ten model z arkusza"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Szybkie przyciski rzutów dla tego konkretnego modelu */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                                            {[
                                                { key: 'front', label: 'Przód' },
                                                { key: 'top', label: 'Góra' },
                                                { key: 'left', label: 'Bok L' },
                                                { key: 'right', label: 'Bok P' },
                                                { key: 'isometric', label: 'Izometria' },
                                            ].map((ang) => (
                                                <button
                                                    key={ang.key}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        engine.setActiveModelId(m.id);
                                                        engine.rotateActiveModel(ang.key);
                                                    }}
                                                    style={{
                                                        flex: 1,
                                                        padding: '2px 4px',
                                                        borderRadius: '3px',
                                                        fontSize: '9px',
                                                        fontWeight: m.angleName === ang.label ? 700 : 400,
                                                        background: m.angleName === ang.label ? '#2563eb' : '#0f172a',
                                                        color: m.angleName === ang.label ? '#fff' : '#94a3b8',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    {ang.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ─── Format Arkusza Papieru ─── */}
                <div className="panel-section">
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📐 Format Arkusza
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.8rem', color: '#94a3b8', width: '90px' }}>Papier:</label>
                        <select
                            value={engine.paperFormat}
                            onChange={(e) => engine.setPaperFormat(e.target.value as PaperFormat)}
                            style={{
                                flex: 1,
                                padding: '5px 8px',
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '4px',
                                color: '#f8fafc',
                                fontSize: '0.8rem',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            {(Object.keys(PAPER_FORMATS) as PaperFormat[]).map((fmt) => (
                                <option key={fmt} value={fmt}>
                                    {PAPER_FORMATS[fmt].label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Stempel ISO 7200 */}
                    <button
                        type="button"
                        className="export-collapsible-btn"
                        onClick={() => setShowTitleBlock(!showTitleBlock)}
                        style={{ marginTop: '4px' }}
                    >
                        <span>Stempel i Metadane ISO 7200</span>
                        <span style={{ fontSize: '11px' }}>{showTitleBlock ? '▲' : '▼'}</span>
                    </button>

                    {showTitleBlock && (
                        <div className="export-titleblock-box">
                            <div className="input-row">
                                <label>Projekt:</label>
                                <input
                                    type="text"
                                    value={engine.titleBlock.projectName}
                                    onChange={(e) => engine.setTitleBlock({ projectName: e.target.value })}
                                    placeholder="Nazwa projektu"
                                />
                            </div>
                            <div className="input-row">
                                <label>Mebel:</label>
                                <input
                                    type="text"
                                    value={engine.titleBlock.furnitureName}
                                    onChange={(e) => engine.setTitleBlock({ furnitureName: e.target.value })}
                                    placeholder="Nazwa mebla"
                                />
                            </div>
                            <div className="input-row">
                                <label>Wykonał:</label>
                                <input
                                    type="text"
                                    value={engine.titleBlock.author}
                                    onChange={(e) => engine.setTitleBlock({ author: e.target.value })}
                                    placeholder="Autor"
                                />
                            </div>
                            <div className="input-row">
                                <label>Nr rysunku:</label>
                                <input
                                    type="text"
                                    value={engine.titleBlock.drawingNumber}
                                    onChange={(e) => engine.setTitleBlock({ drawingNumber: e.target.value })}
                                    placeholder="SB-001"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Przyciski Eksportu ─── */}
                <div className="panel-section" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handlePrint}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '10px 12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #059669, #047857)',
                        }}
                    >
                        🖨️ Drukuj / Zapisz do PDF
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleDownloadJpg}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 10px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                        }}
                    >
                        🖼️ Pobierz Obraz JPG (300 DPI)
                    </button>
                </div>
            </div>
        </div>
    );
};
