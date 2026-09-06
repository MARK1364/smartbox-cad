/**
 * E3_export - export-ui.tsx
 * Główny interfejs użytkownika modułu Eksportu 3 (E3_export) w SmartPanel Web.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ExportEngineV3 } from './export-engine';
import { PaperFormat, PAPER_FORMATS, SavedExportView } from './export-types';

export const ExportUIv3: React.FC = () => {
    const engine = useMemo(() => ExportEngineV3.instance, []);
    const [, setTick] = useState(0);

    const [isGenerating, setIsGenerating] = useState(false);
    const [previewZoom, setPreviewZoom] = useState(1);
    const [showTitleBlockSettings, setShowTitleBlockSettings] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const previewSvg = engine.previewSvg;
    const setPreviewSvg = (svg: string | null) => engine.setPreviewSvg(svg);

    useEffect(() => {
        engine.setShowBounds(true);
        engine.updatePassepartout();

        const unsubscribe = engine.subscribe(() => {
            setTick((t) => t + 1);
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && engine.previewSvg) {
                engine.setPreviewSvg(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            unsubscribe();
            window.removeEventListener('keydown', handleKeyDown);
            engine.setShowBounds(false);
        };
    }, [engine]);

    const showTemporaryStatus = (msg: string) => {
        setStatusMessage(msg);
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const handleDownloadSvg = async () => {
        setIsGenerating(true);
        try {
            const sheet = await engine.generateCurrentDrawingSheet();
            const svgContent = sheet.generateSvg();
            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Arkusz_E3_${engine.paperFormat}.svg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showTemporaryStatus('Pobrano plik arkusza SVG!');
        } catch (err: any) {
            alert(`Błąd podczas pobierania SVG: ${err?.message || err}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadJpg = async () => {
        setIsGenerating(true);
        try {
            const sheet = await engine.generateCurrentDrawingSheet();
            await sheet.downloadJpg();
            showTemporaryStatus('Pobrano wysokiej jakości obraz JPG (300 DPI)!');
        } catch (err: any) {
            alert(`Błąd podczas pobierania JPG: ${err?.message || err}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrintPdf = async () => {
        setIsGenerating(true);
        try {
            const sheet = await engine.generateCurrentDrawingSheet();
            sheet.printSvg();
        } catch (err: any) {
            alert(`Błąd podczas przygotowania do druku: ${err?.message || err}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveCurrentView = async () => {
        setIsGenerating(true);
        try {
            const view = await engine.saveCurrentViewWithThumbnail();
            showTemporaryStatus(`Zapisano arkusz: ${view.name}`);
        } catch (e: any) {
            alert(`Błąd zapisu arkusza: ${e?.message || e}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrintMultiSheet = async () => {
        if (engine.savedViews.length === 0) {
            alert('Brak arkuszy do druku!');
            return;
        }
        setIsGenerating(true);
        try {
            await engine.printAllSheetsMultiPage();
        } catch (e: any) {
            alert(`Błąd druku wielostronicowego: ${e?.message || e}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePreviewSavedView = async (view: SavedExportView) => {
        setIsGenerating(true);
        try {
            engine.applySavedView(view);
            const sheet = await engine.generateCurrentDrawingSheet();
            setPreviewSvg(sheet.generateSvg());
            setPreviewZoom(1);
        } catch (e: any) {
            alert(`Błąd podglądu arkusza: ${e?.message || e}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleBatchExport = async () => {
        if (engine.savedViews.length === 0) {
            alert('Brak arkuszy do eksportu!');
            return;
        }
        setIsGenerating(true);
        try {
            const count = await engine.batchExportAllViews();
            showTemporaryStatus(`Wyeksportowano i pobrano ${count} arkuszy SVG!`);
        } catch (err: any) {
            alert(`Błąd podczas eksportu: ${err?.message || err}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="export-panel-container">
            {/* Header */}
            <div className="panel-header" style={{ padding: '16px 18px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Eksport 3 (E3)
                    </h2>
                    <span className="export-badge-pill" style={{ background: '#0284c7' }}>Nowy Moduł</span>
                </div>
                <p className="subtitle" style={{ marginTop: '4px' }}>
                    Nowa koncepcja eksportu i generowania dokumentacji CAD
                </p>
            </div>

            {statusMessage && (
                <div className="export-status-toast">
                    <span>✓ {statusMessage}</span>
                </div>
            )}

            <div className="export-panel-scrollable">
                {/* ─── Sekcja: Otwórz Dedykowane Studio E3 ─── */}
                <div className="panel-section" style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '12px' }}>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            import('./e3-library-extractor').then(({ E3LibraryExtractor }) => {
                                E3LibraryExtractor.instance.syncLibrary();
                                window.open('/e3_drawing.html', '_blank');
                            });
                        }}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '12px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                            cursor: 'pointer',
                        }}
                        title="Otwórz pełne Studio Rysunków Technicznych E3 w nowej karcie"
                    >
                        <span>📐</span>
                        Otwórz Studio Rysunków E3
                    </button>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 0 0', textAlign: 'center' }}>
                        Biblioteka obiektów, czysty arkusz, niezależne rzuty i wymiary PMI
                    </p>
                </div>

                {/* ─── Sekcja 1: Ustawienia Arkusza ─── */}
                <div className="panel-section">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        Format Arkusza i Kadrowanie
                    </h3>

                    <div className="input-row" style={{ marginTop: '6px', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Format arkuszy:</label>
                        <select
                            value={engine.paperFormat}
                            onChange={(e) => engine.setPaperFormat(e.target.value as PaperFormat)}
                            style={{ flex: 1 }}
                        >
                            {(Object.keys(PAPER_FORMATS) as PaperFormat[]).map((fmt) => {
                                const info = PAPER_FORMATS[fmt];
                                return (
                                    <option key={fmt} value={fmt}>
                                        {info.label} ({info.description})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label className="export-checkbox-label">
                            <input
                                type="checkbox"
                                checked={engine.showBounds}
                                onChange={(e) => engine.setShowBounds(e.target.checked)}
                            />
                            <span>Pokaż wirtualny arkusz CAD na scenie (Passepartout)</span>
                        </label>
                        <label className="export-checkbox-label">
                            <input
                                type="checkbox"
                                checked={engine.showGrid}
                                onChange={(e) => engine.setShowGrid(e.target.checked)}
                            />
                            <span>Pokaż siatkę podłogową i osie</span>
                        </label>
                        <label className="export-checkbox-label">
                            <input
                                type="checkbox"
                                checked={engine.includePMI}
                                onChange={(e) => engine.setIncludePMI(e.target.checked)}
                            />
                            <span>Dołącz linie wymiarowe 3D (PMI)</span>
                        </label>
                        <label className="export-checkbox-label">
                            <input
                                type="checkbox"
                                checked={engine.includeBOM}
                                onChange={(e) => engine.setIncludeBOM(e.target.checked)}
                            />
                            <span>Dołącz tabelę formatek (BOM)</span>
                        </label>
                    </div>

                    <div style={{ marginTop: '12px' }}>
                        <button
                            type="button"
                            className="export-collapsible-btn"
                            onClick={() => setShowTitleBlockSettings(!showTitleBlockSettings)}
                        >
                            <span>Stempel i Metadane ISO 7200</span>
                            <span style={{ fontSize: '11px' }}>{showTitleBlockSettings ? '▲' : '▼'}</span>
                        </button>

                        {showTitleBlockSettings && (
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
                                    <label>Skala:</label>
                                    <input
                                        type="text"
                                        value={engine.titleBlock.scale}
                                        onChange={(e) => engine.setTitleBlock({ scale: e.target.value })}
                                        placeholder="np. 1:10"
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
                                <div className="input-row">
                                    <label>Uwagi:</label>
                                    <input
                                        type="text"
                                        value={engine.notes}
                                        onChange={(e) => engine.setNotes(e.target.value)}
                                        placeholder="Dodatkowe notatki"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Sekcja 2: Menedżer Arkuszy Rysunkowych ─── */}
                <div className="panel-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            Arkusze Rysunkowe ({engine.savedViews.length})
                        </h3>
                        {engine.savedViews.length > 0 && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                    width: 'auto',
                                    padding: '3px 8px',
                                    fontSize: '0.72rem',
                                    color: '#f87171',
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                }}
                                onClick={() => {
                                    if (confirm('Czy na pewno chcesz usunąć wszystkie zapisane arkusze?')) {
                                        engine.clearSavedViews();
                                        showTemporaryStatus('Wyczyszczono listę arkuszy!');
                                    }
                                }}
                                title="Usuń wszystkie zapisane arkusze z pamięci"
                            >
                                ✕ Wyczyść wszystko
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '9px 12px',
                                fontSize: '0.82rem',
                                background: '#2563eb',
                            }}
                            disabled={isGenerating}
                            onClick={handleSaveCurrentView}
                            title="Zapisz obecny kadr 3D jako Arkusz"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            + Zapisz bieżący kadr jako Arkusz
                        </button>
                    </div>

                    {engine.savedViews.length === 0 ? (
                        <div className="export-empty-views">
                            Brak zapisanych arkuszy.<br />
                            Ustaw dowolny kadr mebla w oknie 3D i kliknij <strong>„+ Zapisz bieżący kadr jako Arkusz”</strong>.
                        </div>
                    ) : (
                        <div className="export-views-list">
                            {engine.savedViews.map((view, idx) => (
                                <div key={view.id} className="export-sheet-card">
                                    <div
                                        className="export-sheet-thumb-box"
                                        onClick={() => engine.applySavedView(view)}
                                        title="Kliknij, aby aktywować ten arkusz na scenie 3D"
                                    >
                                        {view.thumbnail ? (
                                            <img src={view.thumbnail} alt={view.name} className="export-sheet-thumb-img" />
                                        ) : (
                                            <div className="export-sheet-thumb-placeholder">
                                                <span>#{idx + 1}</span>
                                            </div>
                                        )}
                                        <span className="export-sheet-index-tag">#{idx + 1}</span>
                                    </div>

                                    <div className="export-sheet-content">
                                        <div className="export-sheet-header-row">
                                            <input
                                                type="text"
                                                className="export-sheet-name-input"
                                                value={view.name}
                                                onChange={(e) => engine.renameSavedView(view.id, e.target.value)}
                                                title="Kliknij, aby edytować nazwę arkusza"
                                            />
                                            <button
                                                type="button"
                                                className="export-sheet-trash-btn"
                                                onClick={() => engine.deleteSavedView(view.id)}
                                                title="Usuń ten arkusz"
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    <line x1="10" y1="11" x2="10" y2="17" />
                                                    <line x1="14" y1="11" x2="14" y2="17" />
                                                </svg>
                                            </button>
                                        </div>

                                        <div className="export-sheet-tags-row">
                                            <select
                                                className="export-sheet-format-select"
                                                value={view.paperFormat}
                                                onChange={(e) => engine.updateSavedViewFormat(view.id, e.target.value as PaperFormat)}
                                                title="Zmień format tego arkusza"
                                            >
                                                {(Object.keys(PAPER_FORMATS) as PaperFormat[]).map((fmt) => {
                                                    const info = PAPER_FORMATS[fmt];
                                                    return (
                                                        <option key={fmt} value={fmt}>
                                                            {info.label} ({info.description})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {view.includePMI && (
                                                <span className="export-sheet-tag pmi" title="Zawiera linie wymiarowe 3D">
                                                    PMI
                                                </span>
                                            )}
                                            {view.includeBOM && (
                                                <span className="export-sheet-tag bom" title="Zawiera tabelę formatek">
                                                    BOM
                                                </span>
                                            )}
                                        </div>

                                        <div className="export-sheet-btn-bar">
                                            <button
                                                type="button"
                                                className="export-mini-btn"
                                                onClick={() => handlePreviewSavedView(view)}
                                                title="Podgląd powiększony tego arkusza"
                                            >
                                                Podgląd
                                            </button>
                                            <button
                                                type="button"
                                                className="export-mini-btn print-btn"
                                                onClick={async () => {
                                                    engine.applySavedView(view);
                                                    const sheet = await engine.generateCurrentDrawingSheet();
                                                    sheet.printSvg();
                                                }}
                                                title="Drukuj ten arkusz do PDF"
                                            >
                                                Drukuj
                                            </button>
                                            <button
                                                type="button"
                                                className="export-mini-btn"
                                                onClick={async () => {
                                                    engine.applySavedView(view);
                                                    const sheet = await engine.generateCurrentDrawingSheet();
                                                    await sheet.downloadJpg(`${view.name}.jpg`);
                                                }}
                                                title="Pobierz JPG"
                                            >
                                                JPG
                                            </button>
                                            <button
                                                type="button"
                                                className="export-mini-btn"
                                                onClick={async () => {
                                                    engine.applySavedView(view);
                                                    const sheet = await engine.generateCurrentDrawingSheet();
                                                    const svg = sheet.generateSvg();
                                                    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `${view.name}.svg`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                    URL.revokeObjectURL(url);
                                                }}
                                                title="Pobierz SVG"
                                            >
                                                SVG
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        background: 'linear-gradient(135deg, #059669, #047857)',
                                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                                    }}
                                    disabled={isGenerating}
                                    onClick={handlePrintMultiSheet}
                                    title="Wydrukuj całą dokumentację"
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="6 9 6 2 18 2 18 9" />
                                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                        <rect x="6" y="14" width="12" height="8" />
                                    </svg>
                                    Drukuj Całą Dokumentację ({engine.savedViews.length} arkuszy)
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        borderColor: 'rgba(59, 130, 246, 0.4)',
                                        color: '#60a5fa',
                                    }}
                                    disabled={isGenerating}
                                    onClick={handleBatchExport}
                                    title="Pobierz wszystkie arkusze jako osobne pliki SVG"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                        <line x1="6" y1="6" x2="6.01" y2="6" />
                                        <line x1="6" y1="18" x2="6.01" y2="18" />
                                    </svg>
                                    Pobierz wszystkie arkusze (SVG)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal podglądu powiększonego */}
            {previewSvg && createPortal(
                <div className="export-modal-backdrop" onClick={() => setPreviewSvg(null)}>
                    <div className="export-modal-window" onClick={(e) => e.stopPropagation()}>
                        <div className="export-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{
                                        width: 'auto',
                                        padding: '6px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.82rem',
                                        fontWeight: 600,
                                        borderColor: 'rgba(255, 255, 255, 0.25)',
                                        color: '#f1f5f9',
                                        background: 'rgba(255, 255, 255, 0.08)',
                                    }}
                                    onClick={() => setPreviewSvg(null)}
                                    title="Zamknij podgląd (Esc)"
                                >
                                    ← Wróć do sceny 3D (Esc)
                                </button>
                                <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#f8fafc' }}>
                                    Podgląd Arkusza CAD E3
                                </span>
                                <span className="export-badge-pill">
                                    {engine.paperFormat.replace('_', ' ')}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 0, 0, 0.3)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <button
                                    type="button"
                                    className="export-modal-zoom-btn"
                                    onClick={() => setPreviewZoom((z) => Math.max(0.4, z - 0.2))}
                                    title="Oddal"
                                >
                                    −
                                </button>
                                <span style={{ fontSize: '12px', minWidth: '45px', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
                                    {(previewZoom * 100).toFixed(0)}%
                                </span>
                                <button
                                    type="button"
                                    className="export-modal-zoom-btn"
                                    onClick={() => setPreviewZoom((z) => Math.min(2.5, z + 0.2))}
                                    title="Przybliż"
                                >
                                    +
                                </button>
                                <button
                                    type="button"
                                    className="export-modal-zoom-btn"
                                    onClick={() => setPreviewZoom(1)}
                                    title="Resetuj zoom (100%)"
                                >
                                    1:1
                                </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ width: 'auto', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600, color: '#60a5fa', borderColor: 'rgba(59, 130, 246, 0.4)' }}
                                    onClick={handleDownloadJpg}
                                    title="Pobierz JPG (300 DPI)"
                                >
                                    🖼️ Pobierz JPG
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ width: 'auto', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600, color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                                    onClick={handlePrintPdf}
                                    title="Drukuj PDF"
                                >
                                    🖨️ Drukuj / PDF
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ width: 'auto', padding: '6px 16px', fontSize: '0.82rem', background: '#2563eb' }}
                                    onClick={handleDownloadSvg}
                                    title="Pobierz SVG"
                                >
                                    📐 Pobierz SVG
                                </button>

                                <button
                                    type="button"
                                    className="export-modal-close-btn"
                                    onClick={() => setPreviewSvg(null)}
                                    title="Zamknij podgląd (Esc)"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="export-modal-body">
                            <div
                                className="export-svg-container"
                                style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center' }}
                                dangerouslySetInnerHTML={{ __html: previewSvg }}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
