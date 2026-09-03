import React, { useState, useMemo, useEffect } from 'react';
import { GlobalReportsEngineWeb, GlobalProjectSummary, PanelPricingResult, AccessoryPricingResult } from './global-reports-engine';
import { ReportDataNormalizer } from './report-data-normalizer';
import { HtmlReportsGeneratorWeb } from './html-reports-generator';
import { ContextManager } from '../A1_core/context-manager.js';
import { UIController } from '../A1_core/ui-controller.js';

interface ReportsUIProps {
    document?: any;
    /** Payload z podstrony (CAD / JSON) — bez żywego ProjectDocument. */
    initialPayload?: {
        scope?: { type: 'PROJECT' | 'CONTAINER' | 'SMARTBOX' | 'PANEL'; id: string; name: string };
        panels: any[];
        accessories?: any[];
        furnitures?: string[];
        containers?: any[];
    };
    isStandalone?: boolean;
}

interface SelectedTarget {
    type: 'CONTAINER' | 'SMARTBOX' | 'PANEL';
    id: string;
    name: string;
}

export const ReportsUI: React.FC<ReportsUIProps> = ({ document: propDoc, initialPayload, isStandalone = false }) => {
    const engine = useMemo(() => new GlobalReportsEngineWeb(), []);
    const generator = useMemo(() => new HtmlReportsGeneratorWeb(engine), [engine]);

    const [refreshTick, setRefreshTick] = useState(0);
    const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(() => {
        const s = initialPayload?.scope;
        if (!s || s.type === 'PROJECT' || s.id === 'ALL') return null;
        return { type: s.type, id: s.id, name: s.name };
    });
    const [isDragOver, setIsDragOver] = useState(false);

    // ─── Automatyczne Odświeżanie w Czasie Rzeczywistym (Live Sync) ───
    useEffect(() => {
        if (isStandalone || initialPayload) return;
        const triggerUpdate = () => {
            setRefreshTick(t => t + 1);
        };

        const doc = propDoc || ContextManager.instance?.document || (UIController.instance as any)?.document;
        let unsub: any = null;
        if (doc && typeof doc.onDocumentChanged === 'function') {
            unsub = doc.onDocumentChanged(triggerUpdate);
        }

        const eventNames = [
            'smartbox-project-changed',
            'smartframe-updated',
            'material-database-updated',
            'smartbox-properties-update',
            'cad-document-changed',
            'cad-history-executed',
            'cad-dimension-changed',
            'resize'
        ];

        eventNames.forEach((evt) => {
            window.addEventListener(evt, triggerUpdate);
            document.addEventListener(evt, triggerUpdate);
        });

        triggerUpdate();

        return () => {
            if (typeof unsub === 'function') unsub();
            eventNames.forEach((evt) => {
                window.removeEventListener(evt, triggerUpdate);
                document.removeEventListener(evt, triggerUpdate);
            });
        };
    }, [propDoc, isStandalone, initialPayload]);

    // Obsługa upuszczenia węzła CAD z drzewa obiektów
    const applyDroppedNode = (nodeData: any) => {
        if (!nodeData) return;
        const { type, id, name } = nodeData;

        if (type === 'PROJECT' || id === 'ALL' || id === 'root') {
            setSelectedTarget(null);
            return;
        }

        const nodeType: 'CONTAINER' | 'SMARTBOX' | 'PANEL' = 
            type === 'SMARTBOX' ? 'SMARTBOX' : (type === 'PANEL' ? 'PANEL' : 'CONTAINER');

        const targetId = String(id || name);
        const targetName = String(name || id || (nodeType === 'SMARTBOX' ? 'SmartBox' : (nodeType === 'PANEL' ? 'Formatka' : 'Korpus')));

        setSelectedTarget({
            type: nodeType,
            id: targetId,
            name: targetName
        });
    };

    // Nasłuchiwanie na zdarzenie upuszczenia z paska zakładek
    useEffect(() => {
        const handleCustomDrop = (e: any) => {
            if (e.detail) {
                applyDroppedNode(e.detail);
            }
        };
        window.addEventListener('cad-node-dropped-to-reports', handleCustomDrop);
        return () => {
            window.removeEventListener('cad-node-dropped-to-reports', handleCustomDrop);
        };
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDragOver) setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        let nodeData = (window as any).__draggedCadNode;
        if (!nodeData) {
            try {
                const raw = e.dataTransfer.getData('application/cad-node');
                if (raw) nodeData = JSON.parse(raw);
            } catch {}
        }

        if (!nodeData) {
            const rawId = e.dataTransfer.getData('text/plain');
            if (rawId) {
                nodeData = {
                    type: 'CONTAINER',
                    id: rawId,
                    name: rawId
                };
            }
        }

        if (nodeData) {
            applyDroppedNode(nodeData);
        }
    };

    // Surowe dane: payload podstrony albo skan żywego dokumentu CAD
    const projectRawData = useMemo(() => {
        if (initialPayload?.panels) {
            return {
                panels: initialPayload.panels,
                accessories: initialPayload.accessories || [],
                furnitures: initialPayload.furnitures || [],
                containers: initialPayload.containers || [],
            };
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = refreshTick;
        const activeDoc = propDoc || ContextManager.instance?.document || (UIController.instance as any)?.document;
        return ReportDataNormalizer.extractProjectData(activeDoc);
    }, [propDoc, refreshTick, initialPayload]);

    // Przefiltrowane formatki pod kątem wybranego elementu
    const scopedPanels = useMemo(() => {
        if (!selectedTarget) return projectRawData.panels;
        const { type, id, name } = selectedTarget;

        return projectRawData.panels.filter((p) => {
            if (type === 'SMARTBOX') {
                return p.smartbox_id === id || p.smartbox_id === name || (p.part_id && p.part_id === id) || (p.role && p.role.includes(name));
            }
            if (type === 'PANEL') {
                return p.part_id === id || p.node_id === id || p.part_id === name;
            }
            // CONTAINER (Korpus / Szafka)
            return p.container_id === id || p.furniture_name === name || p.furniture_name === id || p.container_id === name;
        });
    }, [projectRawData.panels, selectedTarget]);

    // Przefiltrowane akcesoria/okucia pod kątem wybranego elementu
    const scopedAccessories = useMemo(() => {
        if (!selectedTarget) return projectRawData.accessories;
        const { type, id, name } = selectedTarget;

        if (type === 'PANEL') return [];

        return projectRawData.accessories.filter((a) => {
            if (type === 'SMARTBOX') {
                return a.id === id || a.name.includes(name) || (a.furniture_name && a.furniture_name.includes(name));
            }
            // CONTAINER
            return a.furniture_name === name || a.furniture_name === id;
        });
    }, [projectRawData.accessories, selectedTarget]);

    // Przeliczenie wyceny na żywo dla wybranego zakresu
    const projectData = useMemo(() => {
        const pricedPanels: PanelPricingResult[] = scopedPanels.map(p => engine.calculatePartPricing(p));
        const pricedAccessories: AccessoryPricingResult[] = scopedAccessories.map(a => engine.calculateAccessoryPricing(a));
        const summary: GlobalProjectSummary = engine.calculateGlobalSummary(pricedPanels, pricedAccessories);

        return {
            panels: scopedPanels,
            pricedPanels,
            pricedAccessories,
            summary,
            furnitures: projectRawData.furnitures
        };
    }, [scopedPanels, scopedAccessories, projectRawData.furnitures, engine]);

    const handleOpenFullReport = () => {
        const reportTitle = selectedTarget 
            ? `Wycena: ${selectedTarget.name}` 
            : 'Projekt CAD (Całość)';

        const html = generator.generateFullProjectReport(
            reportTitle,
            projectData.summary,
            projectData.pricedPanels,
            projectData.pricedAccessories
        );
        generator.openHtmlInNewTab(html);
    };

    const targetIcon = selectedTarget?.type === 'SMARTBOX' ? '🗄️' : (selectedTarget?.type === 'PANEL' ? '📄' : '📦');
    const targetTypeLabel = selectedTarget?.type === 'SMARTBOX' ? 'SmartBox' : (selectedTarget?.type === 'PANEL' ? 'Formatka' : 'Korpus');

    return (
        <div 
            style={{ 
                padding: '12px', 
                color: '#f4f4f5', 
                height: '100%', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px', 
                fontSize: '11px',
                position: 'relative'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Nakładka przeciągania na cały panel (Drag Overlay) */}
            {isDragOver && (
                <div style={{
                    position: 'absolute',
                    inset: '8px',
                    backgroundColor: 'rgba(24, 24, 27, 0.95)',
                    border: '2px dashed #38bdf8',
                    borderRadius: '8px',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 25px rgba(56, 189, 248, 0.4)'
                }}>
                    <span style={{ fontSize: '2.4rem' }}>📥</span>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff', textAlign: 'center' }}>
                        Upuść Korpus lub SmartBox tutaj
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#bae6fd' }}>
                        Wycena i raport zostaną natychmiast przeliczone dla tego elementu
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #27272a', paddingBottom: '8px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>Raporty i Wycena</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#71717a' }}>
                        Zestawienie kosztów i materiałów
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span 
                        title="Automatyczne przeliczanie wyceny na żywo" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                    >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                        Live Sync
                    </span>
                    <button
                        onClick={() => setRefreshTick(t => t + 1)}
                        style={{ background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}
                        title="Przelicz ponownie"
                    >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        Odśwież
                    </button>
                </div>
            </div>

            {/* Dedykowana Sekcja Drag & Drop / Zakres Wyceny */}
            <div 
                style={{
                    background: selectedTarget ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255,255,255,0.02)',
                    border: selectedTarget ? '1px solid #38bdf8' : '1px dashed #3f3f46',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                }}
            >
                {!selectedTarget ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📥</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#e4e4e7' }}>
                                Wycena: Cały Projekt
                            </div>
                            <div style={{ fontSize: '10px', color: '#71717a' }}>
                                Przeciągnij Korpus lub SmartBox z lewego drzewa, aby wycenić pojedynczy moduł.
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span style={{ fontSize: '1.4rem' }}>{targetIcon}</span>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '9px', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 600 }}>
                                        {targetTypeLabel}
                                    </div>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {selectedTarget.name}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTarget(null)}
                                title="Powrót do wyceny całego projektu"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid #4b5563',
                                    color: '#e2e8f0',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontSize: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                ✕ Cały projekt
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', fontSize: '10px', color: '#10b981', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '4px' }}>
                            <span>✓ Formatek: <strong>{scopedPanels.length} szt.</strong></span>
                            <span>•</span>
                            <span>Okucia: <strong>{scopedAccessories.reduce((s, a) => s + (a.qty || 0), 0)} szt.</strong></span>
                        </div>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '4px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Koszt Całkowity</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                        {typeof projectData.summary.SUMA_CALKOWITA_PLN === 'number'
                            ? `${projectData.summary.SUMA_CALKOWITA_PLN.toFixed(2)} PLN`
                            : <span style={{ color: '#f87171', fontSize: '11px' }}>{projectData.summary.SUMA_CALKOWITA_PLN}</span>}
                    </div>
                </div>

                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '4px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Zużycie Płyty</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#e4e4e7', marginTop: '2px' }}>
                        {projectData.summary.Calkowite_powierzchnia_m2.toFixed(3)} m²
                    </div>
                </div>

                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '4px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Długość Obrzeży</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#e4e4e7', marginTop: '2px' }}>
                        {projectData.summary.Calkowite_dlugosc_obrzezy_mb.toFixed(2)} mb
                    </div>
                </div>

                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '4px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Liczba Formatek</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#e4e4e7', marginTop: '2px' }}>
                        {projectData.summary.Liczba_elementow} szt.
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div>
                <button
                    onClick={handleOpenFullReport}
                    style={{
                        width: '100%',
                        background: selectedTarget ? 'linear-gradient(135deg, #0284c7, #0ea5e9)' : '#27272a',
                        border: selectedTarget ? 'none' : '1px solid #3f3f46',
                        color: '#f4f4f5',
                        padding: '9px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: selectedTarget ? '0 2px 8px rgba(14, 165, 233, 0.3)' : 'none',
                        transition: 'background 0.15s, border-color 0.15s'
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    {selectedTarget ? `Otwórz Raport: ${selectedTarget.name} (HTML)` : 'Otwórz Pełny Raport Projektu (HTML)'}
                </button>
            </div>

            {/* Furniture summary breakdown */}
            {projectData.summary.furnituresBreakdown.length > 0 && (
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '4px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {selectedTarget ? `Podsumowanie: ${selectedTarget.name}` : 'Podsumowanie per mebel'}
                    </div>
                    {projectData.summary.furnituresBreakdown.map((f, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 0', borderBottom: idx < projectData.summary.furnituresBreakdown.length - 1 ? '1px solid #27272a' : 'none' }}>
                            <span style={{ color: '#d4d4d8' }}>{f.name}</span>
                            <span style={{ fontWeight: 500, color: '#38bdf8' }}>{f.cost.toFixed(2)} PLN</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
