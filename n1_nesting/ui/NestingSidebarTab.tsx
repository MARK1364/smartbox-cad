/**
 * Panel boczny modułu Nesting w głównym interfejsie CAD (Nesting C2)
 * Tryb działania:
 * - Wybór zakresu odbywa się WYŁĄCZNIE przez Drag & Drop (przeciągnięcie Korpusu, SmartBoxa lub Formatki z lewego drzewa obiektów)
 * - Automatyczne odświeżanie danych w czasie rzeczywistym przy każdej zmianie w scenie / parametrach CAD
 * - Wybór profilu maszyny (Piła vs CNC)
 * - Podgląd grup materiałowych i natychmiastowe generowanie rozkroju
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
    NestingPart,
    MachineType,
    ContainerScopeInfo,
    SheetConfig
} from '../core/nesting-types';
import { NestingEngine } from '../core/nesting-engine';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer';
import { ContextManager } from '../../A1_core/context-manager';
import { UIController } from '../../A1_core/ui-controller';

interface NestingSidebarTabProps {
    projectModel?: any;
}

interface SelectedTarget {
    type: 'PROJECT' | 'CONTAINER' | 'SMARTBOX' | 'PANEL';
    id: string;
    name: string;
}

export const NestingSidebarTab: React.FC<NestingSidebarTabProps> = ({ projectModel }) => {
    const [machineType, setMachineType] = useState<MachineType>('saw');
    const [selectedTarget, setSelectedTarget] = useState<SelectedTarget | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
    const [isDragOver, setIsDragOver] = useState(false);

    // ─── Automatyczne Odświeżanie w Czasie Rzeczywistym ─────────────
    useEffect(() => {
        const triggerAutoRefresh = () => {
            setLastSyncTime(Date.now());
        };

        // 1. Subskrypcja na zmiany w dokumencie CAD
        const doc = projectModel || ContextManager.instance?.document || UIController.instance?.document || (window as any).CAD_APP?.document;
        let unsubscribeDoc: (() => void) | undefined;
        if (doc && typeof doc.onDocumentChanged === 'function') {
            unsubscribeDoc = doc.onDocumentChanged(triggerAutoRefresh);
        }

        // 2. Subskrypcje na globalne zdarzenia zmian geometrii i SmartBox/SmartFrame
        const eventNames = [
            'smartbox-project-changed',
            'smartframe-updated',
            'material-database-updated',
            'smartbox-properties-update',
            'cad-document-changed',
            'cad-history-executed',
            'cad-dimension-changed',
            'cad-selection-changed'
        ];

        eventNames.forEach((evt) => {
            window.addEventListener(evt, triggerAutoRefresh);
            document.addEventListener(evt, triggerAutoRefresh);
        });

        return () => {
            if (typeof unsubscribeDoc === 'function') unsubscribeDoc();
            eventNames.forEach((evt) => {
                window.removeEventListener(evt, triggerAutoRefresh);
                document.removeEventListener(evt, triggerAutoRefresh);
            });
        };
    }, [projectModel]);

    // Pobranie znormalizowanych danych ze sceny 3D
    const sceneData = useMemo(() => {
        const doc = projectModel || ContextManager.instance?.document || (window as any).CAD_APP?.document;
        const data = ReportDataNormalizer.extractProjectData(doc);
        
        const parts: NestingPart[] = (data?.panels || []).map((p, idx) => ({
            id: p.part_id || `part_${idx}`,
            name: p.role ? `${p.furniture_name} - ${p.role}` : p.part_id,
            width: p.length_mm,
            height: p.width_mm,
            thickness: p.thickness_mm || 18,
            quantity: p.qty || 1,
            canRotate: true,
            material: NestingEngine.resolveMaterialName(p.material),
            containerId: p.container_id,
            smartboxId: p.smartbox_id,
            furnitureName: p.furniture_name
        }));

        const containers: ContainerScopeInfo[] = data?.containers || [];
        return { parts, containers };
    }, [projectModel, lastSyncTime]);

    // Aplikowanie upuszczonego węzła CAD
    const applyDroppedNode = (nodeData: any) => {
        if (!nodeData) return;
        const { type, id, name } = nodeData;

        if (type === 'PROJECT' || id === 'ALL' || id === 'root' || type === 'project' || type === 'root') {
            setSelectedTarget({
                type: 'PROJECT',
                id: 'ALL',
                name: 'Cały Projekt'
            });
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

    // Nasłuchiwanie na zdarzenie cad-node-dropped-to-nesting (np. upuszczenie na ikonę zakładki)
    useEffect(() => {
        const handleCustomDrop = (e: any) => {
            if (e.detail) {
                applyDroppedNode(e.detail);
            }
        };
        window.addEventListener('cad-node-dropped-to-nesting', handleCustomDrop);
        return () => {
            window.removeEventListener('cad-node-dropped-to-nesting', handleCustomDrop);
        };
    }, [sceneData]);

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
                if (rawId === 'ALL' || rawId === 'root') {
                    nodeData = { type: 'PROJECT', id: 'ALL', name: 'Cały Projekt' };
                } else {
                    const matched = sceneData.containers.find(c => c.id === rawId || c.name === rawId);
                    nodeData = {
                        type: matched?.type === 'smartbox' ? 'SMARTBOX' : 'CONTAINER',
                        id: rawId,
                        name: matched?.name || rawId
                    };
                }
            }
        }

        if (nodeData) {
            applyDroppedNode(nodeData);
        }
    };

    // Formatki wyselekcjonowane wyłącznie dla upuszczonego elementu
    const scopedParts = useMemo(() => {
        if (!selectedTarget) return [];
        const { type, id, name } = selectedTarget;

        if (type === 'PROJECT' || id === 'ALL' || id === 'root') {
            return sceneData.parts;
        }

        return sceneData.parts.filter((p) => {
            if (type === 'SMARTBOX') {
                return p.smartboxId === id || (p.name && p.name.includes(name)) || p.id === id;
            }
            if (type === 'PANEL') {
                return p.id === id || (p.sourceNodeId && p.sourceNodeId === id) || p.name === name;
            }
            // CONTAINER (Korpus / Szafka)
            return p.containerId === id || p.furnitureName === name || p.furnitureName === id || p.containerId === name;
        });
    }, [sceneData.parts, selectedTarget]);

    // Grupy materiałowe dla wyselekcjonowanego elementu
    const materialGroups = useMemo(() => {
        const map = new Map<string, { key: string; name: string; thickness: number; label: string; count: number; areaM2: number }>();
        scopedParts.forEach((p) => {
            const key = NestingEngine.getMaterialKey(p);
            const label = NestingEngine.getMaterialLabel(p);
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: p.material || 'Płyta podstawowa',
                    thickness: p.thickness || 18,
                    label,
                    count: 0,
                    areaM2: 0
                });
            }
            const group = map.get(key)!;
            const qty = p.quantity || 1;
            group.count += qty;
            group.areaM2 += (p.width * p.height * qty) / 1000000;
        });
        return Array.from(map.values());
    }, [scopedParts]);

    // Otwarcie podstrony rozkroju w nowej karcie
    const handleOpenNestingSubpage = (materialKey: string = 'ALL') => {
        if (!selectedTarget || scopedParts.length === 0) return;

        const kerf = NestingEngine.getDefaultKerf(machineType);
        const config: SheetConfig = {
            width: 2800,
            height: 2070,
            kerf,
            trimMargin: machineType === 'cnc' ? 15 : 10,
            thickness: 18,
            machineType
        };

        const sessionPayload = {
            parts: scopedParts,
            config,
            selectedMaterial: materialKey,
            scope: selectedTarget.type,
            targetContainerId: selectedTarget.id,
            targetContainerName: selectedTarget.name,
            machineType
        };

        localStorage.setItem('NESTING_SESSION_DATA', JSON.stringify(sessionPayload));
        window.open('/nesting.html', '_blank');
    };

    const targetIcon = selectedTarget?.type === 'PROJECT'
        ? '📁'
        : (selectedTarget?.type === 'SMARTBOX' ? '🗄️' : (selectedTarget?.type === 'PANEL' ? '📄' : '📦'));
    const targetTypeLabel = selectedTarget?.type === 'PROJECT'
        ? 'Cały Projekt'
        : (selectedTarget?.type === 'SMARTBOX' ? 'SmartBox' : (selectedTarget?.type === 'PANEL' ? 'Formatka' : 'Korpus'));

    return (
        <div 
            style={{ 
                padding: '12px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px', 
                height: '100%', 
                overflowY: 'auto',
                position: 'relative'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Nakładka wizualna podczas przeciągania */}
            {isDragOver && (
                <div style={{
                    position: 'absolute',
                    inset: '8px',
                    backgroundColor: 'rgba(30, 27, 75, 0.94)',
                    border: '2px dashed #818cf8',
                    borderRadius: '8px',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 25px rgba(99, 102, 241, 0.5)'
                }}>
                    <span style={{ fontSize: '2.4rem' }}>📥</span>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#ffffff', textAlign: 'center' }}>
                        Upuść Projekt, Korpus lub SmartBox tutaj
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#c7d2fe' }}>
                        Rozkrój zostanie natychmiast utworzony dla wybranego zakresu
                    </div>
                </div>
            )}

            {/* Nagłówek panelu */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Nesting C2</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Rozkrój przeciągniętego elementu</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span 
                        title="Automatyczna synchronizacja ze sceną 3D jest aktywna" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                    >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                        Live Sync
                    </span>
                </div>
            </div>

            {/* 1. Profil Maszyny (Piła vs CNC) */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2d3142', borderRadius: '6px', padding: '8px' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>
                    Profil Maszyny
                </div>
                <div style={{ display: 'flex', background: '#0f1115', border: '1px solid #2d3142', borderRadius: '4px', padding: '2px', gap: '4px' }}>
                    <button
                        type="button"
                        onClick={() => setMachineType('saw')}
                        style={{
                            flex: 1,
                            padding: '6px',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: machineType === 'saw' ? '#6366f1' : 'transparent',
                            color: machineType === 'saw' ? '#fff' : '#94a3b8'
                        }}
                    >
                        🪚 Piła (4mm)
                    </button>
                    <button
                        type="button"
                        onClick={() => setMachineType('cnc')}
                        style={{
                            flex: 1,
                            padding: '6px',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: machineType === 'cnc' ? '#6366f1' : 'transparent',
                            color: machineType === 'cnc' ? '#fff' : '#94a3b8'
                        }}
                    >
                        ⚙️ CNC (10mm)
                    </button>
                </div>
            </div>

            {/* 2. Dedykowana Sekcja Drag & Drop z Drzewa Obiektów */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2d3142', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                    Wybrany element do rozkroju
                </div>

                {!selectedTarget ? (
                    /* Stan pusty – instrukcja przeciągania */
                    <div 
                        style={{
                            border: '2px dashed #3f4354',
                            borderRadius: '6px',
                            padding: '16px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: '10px',
                            background: '#0f1115'
                        }}
                    >
                        <span style={{ fontSize: '2rem' }}>📥</span>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>
                            Przeciągnij Projekt, Korpus lub SmartBox z drzewa
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', maxWidth: '240px', lineHeight: 1.3 }}>
                            Chwyć myszą cały Projekt, szafkę lub moduł SmartBox z drzewa obiektów i upuść tutaj.
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedTarget({ type: 'PROJECT', id: 'ALL', name: 'Cały Projekt' })}
                            style={{
                                marginTop: '4px',
                                background: '#1e293b',
                                border: '1px solid #3b82f6',
                                color: '#38bdf8',
                                borderRadius: '4px',
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            📁 Rozkrój dla całego projektu ({sceneData.parts.reduce((s, p) => s + (p.quantity || 0), 0)} formatek)
                        </button>
                    </div>
                ) : (
                    /* Stan aktywny – karta wybranego obiektu */
                    <div 
                        style={{
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid #6366f1',
                            borderRadius: '6px',
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span style={{ fontSize: '1.5rem' }}>{targetIcon}</span>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '0.72rem', color: '#a5b4fc', textTransform: 'uppercase', fontWeight: 600 }}>
                                        {targetTypeLabel}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {selectedTarget.name}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTarget(null)}
                                title="Odznacz element i przeciągnij inny"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid #4b5563',
                                    color: '#e2e8f0',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer'
                                }}
                            >
                                ✕ Zmień
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '5px 8px', borderRadius: '4px' }}>
                            <span style={{ color: '#94a3b8' }}>Formatki w elemencie:</span>
                            <strong style={{ color: '#10b981' }}>
                                {scopedParts.reduce((s, p) => s + (p.quantity || 0), 0)} szt.
                            </strong>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Lista Wykrytych Materiałów w Przeciągniętym Elemencie */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2d3142', borderRadius: '6px', padding: '10px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                        Materiały elementu ({materialGroups.length})
                    </span>
                    {selectedTarget && (
                        <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>
                            {scopedParts.reduce((s, p) => s + (p.quantity || 0), 0)} formatek
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, maxHeight: '240px' }}>
                    {!selectedTarget ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', padding: '24px 0' }}>
                            Przeciągnij szafkę lub SmartBox z drzewa, aby wyświetlić listę materiałów
                        </div>
                    ) : materialGroups.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', padding: '16px 0' }}>
                            Brak formatek w wybranym elemencie
                        </div>
                    ) : (
                        materialGroups.map((mat) => (
                            <div
                                key={mat.key}
                                style={{
                                    background: '#1a1c23',
                                    border: '1px solid #2d3142',
                                    borderRadius: '5px',
                                    padding: '7px 9px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {mat.label}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px' }}>
                                        {mat.count} szt. • {mat.areaM2.toFixed(2)} m²
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOpenNestingSubpage(mat.key)}
                                    title={`Otwórz rozkrój w nowej karcie tylko dla: ${mat.label}`}
                                    style={{
                                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '5px 9px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    🚀 Rozkrój
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 4. Główny przycisk na dole: Otwórz Rozkrój */}
            <button
                disabled={!selectedTarget || scopedParts.length === 0}
                onClick={() => handleOpenNestingSubpage('ALL')}
                style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '6px',
                    border: 'none',
                    background: (!selectedTarget || scopedParts.length === 0) ? '#3f3f46' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: (!selectedTarget || scopedParts.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: selectedTarget ? '0 2px 10px rgba(99, 102, 241, 0.3)' : 'none'
                }}
            >
                <span>
                    {!selectedTarget
                        ? '📥 Przeciągnij element z drzewa'
                        : `🚀 Rozkrój ${targetTypeLabel}: ${selectedTarget.name} (${scopedParts.reduce((s, p) => s + (p.quantity || 0), 0)} szt.)`}
                </span>
            </button>
        </div>
    );
};
