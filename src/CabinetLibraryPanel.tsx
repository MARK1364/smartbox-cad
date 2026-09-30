/**
 * src/CabinetLibraryPanel.tsx
 *
 * Widok Biblioteki Gotowych Korpusów otwierany w prawym Panelu Edycji.
 * Umożliwia przeglądanie, filtrowanie, przeciąganie na scenę 3D (Drag & Drop),
 * wstawianie jednym kliknięciem oraz import/eksport plików .json na dysk.
 */

import React, { useState, useEffect, useRef } from 'react';
import { cabinetLibraryStore } from '../B1_biblioteka/korpusy/cabinet-library-store.js';
import { instantiateCabinetTemplate } from '../B1_biblioteka/korpusy/cabinet-instantiator.js';
import type { CabinetCategory, CabinetTemplate } from '../B1_biblioteka/korpusy/types.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { SmartFrameDragController } from '../A3_smartframe/smartframe-drag-controller.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

const CATEGORY_TABS = [
    { id: 'all', labelKey: 'lib.tabs.all' },
    { id: 'dolne', labelKey: 'lib.tabs.dolne' },
    { id: 'gorne', labelKey: 'lib.tabs.gorne' },
    { id: 'slupki', labelKey: 'lib.tabs.slupki' },
    { id: 'inne', labelKey: 'lib.tabs.inne' },
] as const;

const CATEGORY_BADGE_KEYS: Record<string, string> = {
    dolne: 'save_cabinet.categories.dolne',
    gorne: 'save_cabinet.categories.gorne',
    slupki: 'save_cabinet.categories.slupki',
    inne: 'save_cabinet.categories.inne',
};

interface Props {
    projectModel: any;
    onOpenSaveModal?: () => void;
}

export function CabinetLibraryPanel({ projectModel, onOpenSaveModal }: Props) {
    useLocale();
    const [templates, setTemplates] = useState<CabinetTemplate[]>(() => cabinetLibraryStore.getAll());
    const [selectedCategory, setSelectedCategory] = useState<CabinetCategory | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusNotice, setStatusNotice] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsub = cabinetLibraryStore.subscribe(() => {
            setTemplates(cabinetLibraryStore.getAll());
        });
        return unsub;
    }, []);

    const showNotice = (msg: string) => {
        setStatusNotice(msg);
        setTimeout(() => setStatusNotice(null), 3500);
    };

    const getDragController = (): SmartFrameDragController => {
        if (!ContextManager.instance.smartFrameDragController) {
            ContextManager.instance.smartFrameDragController = new SmartFrameDragController();
        }
        return ContextManager.instance.smartFrameDragController;
    };

    // Filtrowanie po kategorii i szukanej frazie
    const filteredTemplates = templates.filter((t) => {
        if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = t.name.toLowerCase().includes(q);
            const matchDims = `${t.dimensions.szerokosc_mm}x${t.dimensions.wysokosc_mm}x${t.dimensions.glebokosc_mm}`.includes(q);
            const matchDesc = (t.description || '').toLowerCase().includes(q);
            if (!matchName && !matchDims && !matchDesc) return false;
        }
        return true;
    });

    const handleDragStart = (template: CabinetTemplate, e: React.DragEvent) => {
        const dragCtrl = getDragController();
        dragCtrl.startDragTemplate(template);
        try {
            e.dataTransfer.setData('application/cad-cabinet-template', JSON.stringify(template));
            e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignoruj */ }
    };

    const handleDragEnd = () => {
        const dragCtrl = getDragController();
        dragCtrl.endDrag();
    };

    const handleInsertClick = (template: CabinetTemplate) => {
        const doc = projectModel?.document || ContextManager.instance.document;
        if (!doc) return;

        // Wyliczenie pozycji obok istniejących szafek
        const containers = typeof doc.getContainers === 'function' ? doc.getContainers() : [];
        let nextX = 0;
        if (containers.length > 0) {
            // Pozycja odsunięta o szerokość ostatniego mebla
            const last = containers[containers.length - 1];
            const lastNode = doc.findNode(last.id);
            if (lastNode?.transform?.position) {
                const posX = Math.round(nmToMm(lastNode.transform.position.x));
                const lastW = Math.round(nmToMm(last.width));
                nextX = posX + lastW + 50; // odstęp 50mm
            }
        }

        const node = instantiateCabinetTemplate({
            template,
            position: { x: nextX, y: 0, z: 0 }
        }, doc);

        if (node) {
            showNotice(tx(srcTekst, 'lib.inserted', TX_NS, { name: template.name }));
        }
    };

    const handleDelete = (id: string, name: string) => {
        if (window.confirm(tx(srcTekst, 'lib.confirm_delete', TX_NS, { name }))) {
            cabinetLibraryStore.remove(id);
            showNotice(tx(srcTekst, 'lib.deleted', TX_NS, { name }));
        }
    };

    const handleExportSingle = (template: CabinetTemplate) => {
        cabinetLibraryStore.exportToJsonFile(template);
        showNotice(tx(srcTekst, 'lib.downloaded', TX_NS, { name: template.name }));
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const res = cabinetLibraryStore.importFromJson(content);
                if (res.success) {
                    showNotice(tx(srcTekst, 'lib.imported', TX_NS, { n: res.count }));
                } else {
                    alert(tx(srcTekst, 'lib.import_error', TX_NS, { error: res.error }));
                }
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflowY: 'auto',
            padding: '12px 14px',
            gap: '12px',
            color: '#e2e8f0'
        }}>
            {/* Nagłówek i opis */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                        {tx(srcTekst, 'lib.title', TX_NS)}
                    </h3>
                </div>
            </div>

            {statusNotice && (
                <div style={{
                    padding: '8px 12px',
                    background: 'rgba(37, 99, 235, 0.2)',
                    border: '1px solid rgba(37, 99, 235, 0.4)',
                    borderRadius: '6px',
                    color: '#93c5fd',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <span>✓</span> {statusNotice}
                </div>
            )}

            {/* Pasek głównych akcji */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {onOpenSaveModal && (
                    <button
                        onClick={onOpenSaveModal}
                        title={tx(srcTekst, 'lib.save_selected_title', TX_NS)}
                        style={{
                            padding: '8px 10px',
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'background 0.15s ease'
                        }}
                    >
                        {tx(srcTekst, 'lib.save_selected', TX_NS)}
                    </button>
                )}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    title={tx(srcTekst, 'lib.load_from_disk_title', TX_NS)}
                    style={{
                        padding: '8px 10px',
                        background: '#27272a',
                        color: '#cbd5e1',
                        border: '1px solid #3f3f46',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                        {tx(srcTekst, 'lib.load_from_disk', TX_NS)}
                    </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    onChange={handleFileInputChange} 
                />
            </div>

            {/* Wyszukiwarka */}
            <div>
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tx(srcTekst, 'lib.search_placeholder', TX_NS)}
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '7px 10px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        fontSize: '0.8rem',
                        outline: 'none'
                    }}
                />
            </div>

            {/* Zakładki kategorii */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                {CATEGORY_TABS.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id as any)}
                        style={{
                            padding: '4px 10px',
                            background: selectedCategory === cat.id ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                            color: selectedCategory === cat.id ? '#ffffff' : '#94a3b8',
                            border: '1px solid',
                            borderColor: selectedCategory === cat.id ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                            borderRadius: '14px',
                            fontSize: '0.75rem',
                            fontWeight: selectedCategory === cat.id ? 600 : 400,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tx(srcTekst, cat.labelKey, TX_NS)}
                    </button>
                ))}
            </div>

            {/* Siatka 2 kolumn kafelków szafek */}
            {filteredTemplates.length === 0 ? (
                <div style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.8rem',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px dashed #334155',
                    marginTop: '4px'
                }}>
                    {tx(srcTekst, 'lib.empty_title', TX_NS)}<br />
                    {tx(srcTekst, 'lib.empty_hint', TX_NS)} <strong>{tx(srcTekst, 'lib.empty_action', TX_NS)}</strong>!
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '8px',
                    marginTop: '4px'
                }}>
                    {filteredTemplates.map((template) => {
                        const w = template.dimensions.szerokosc_mm;
                        const h = template.dimensions.wysokosc_mm;
                        const d = template.dimensions.glebokosc_mm;

                        return (
                            <div
                                key={template.id}
                                draggable
                                onDragStart={(e) => handleDragStart(template, e)}
                                onDragEnd={handleDragEnd}
                                title={`${template.name} (${w}×${h}×${d} mm) - ${tx(srcTekst, 'lib.card_drag_title', TX_NS)}`}
                                style={{
                                    height: '148px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    background: '#121214',
                                    border: '1px solid #27272a',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    transition: 'border-color 0.15s ease, transform 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = '#38bdf8';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = '#27272a';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                {/* Pełne tło: Zdjęcie miniatury lub wektorowy korpus 3D */}
                                {template.thumbnail ? (
                                    <img 
                                        src={template.thumbnail} 
                                        alt={template.name}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            background: '#141416'
                                        }} 
                                    />
                                ) : (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        background: 'radial-gradient(ellipse at center, #27272a 0%, #0f1013 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <svg width="48" height="48" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#38bdf8', opacity: 0.85 }}>
                                            <path d="M14 20 L32 10 L50 20 L32 30 Z" fill="#1e293b" />
                                            <path d="M14 20 L14 46 L32 56 L32 30 Z" fill="#0f172a" />
                                            <path d="M50 20 L50 46 L32 56 L32 30 Z" fill="#1e293b" />
                                            <line x1="14" y1="33" x2="32" y2="43" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />
                                            <line x1="32" y1="43" x2="50" y2="33" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />
                                        </svg>
                                    </div>
                                )}

                                {/* Pasek górny na tle obrazka: Kategoria (lewo) + Przyciski akcji (prawo) */}
                                <div style={{
                                    position: 'relative',
                                    zIndex: 2,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '5px'
                                }}>
                                    {/* Kategoria jako miniaturowy badge */}
                                    <span style={{
                                        fontSize: '0.60rem',
                                        padding: '1px 5px',
                                        background: 'rgba(0, 0, 0, 0.75)',
                                        backdropFilter: 'blur(4px)',
                                        borderRadius: '3px',
                                        color: '#38bdf8',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        border: '1px solid rgba(56, 189, 248, 0.3)'
                                    }}>
                                        {tx(srcTekst, CATEGORY_BADGE_KEYS[template.category] || 'save_cabinet.categories.inne', TX_NS)}
                                    </span>

                                    {/* Pływające akcje: Pobierz JSON, Usuń */}
                                    <div 
                                        style={{ display: 'flex', gap: '3px' }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={() => handleExportSingle(template)}
                                            title={tx(srcTekst, 'lib.download_json', TX_NS)}
                                            style={{
                                                width: 'auto',
                                                height: '22px',
                                                padding: '0 5px',
                                                background: 'rgba(0, 0, 0, 0.75)',
                                                backdropFilter: 'blur(4px)',
                                                color: '#cbd5e1',
                                                border: '1px solid #3f3f46',
                                                borderRadius: '3px',
                                                fontSize: '0.68rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {tx(srcTekst, 'lib.download_short', TX_NS)}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(template.id, template.name)}
                                            title={tx(srcTekst, 'lib.delete_from_lib', TX_NS)}
                                            style={{
                                                height: '22px',
                                                background: 'rgba(0, 0, 0, 0.75)',
                                                backdropFilter: 'blur(4px)',
                                                color: '#ef4444',
                                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                                borderRadius: '3px',
                                                fontSize: '0.68rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '0 4px',
                                                width: 'auto'
                                            }}
                                        >
                                            {tx(srcTekst, 'lib.delete_short', TX_NS)}
                                        </button>
                                    </div>
                                </div>

                                {/* Pasek dolny na tle obrazka: Nazwa + Wymiary + Łapka */}
                                <div style={{
                                    position: 'relative',
                                    zIndex: 2,
                                    marginTop: 'auto',
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 65%, transparent 100%)',
                                    padding: '12px 6px 4px 6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1px'
                                }}>
                                    <div style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 600,
                                        color: '#f8fafc',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        lineHeight: 1.2
                                    }}>
                                        {template.name}
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <span style={{
                                            fontSize: '0.68rem',
                                            color: '#38bdf8',
                                            fontWeight: 600
                                        }}>
                                            {w}×{h}×{d}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Dolny pasek narzędzi biblioteki */}
            <div style={{
                marginTop: 'auto',
                paddingTop: '12px',
                borderTop: '1px solid #27272a',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.72rem',
                color: '#64748b'
            }}>
                <span>{tx(srcTekst, 'lib.total', TX_NS, { n: templates.length })}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => cabinetLibraryStore.exportAllToJsonFile()}
                        title={tx(srcTekst, 'lib.export_all_title', TX_NS)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            textDecoration: 'underline'
                        }}
                    >
                        {tx(srcTekst, 'lib.export_all', TX_NS)}
                    </button>
                    <button
                        onClick={() => {
                            if (window.confirm(tx(srcTekst, 'lib.confirm_reset', TX_NS))) {
                                cabinetLibraryStore.resetToDefaults();
                                showNotice(tx(srcTekst, 'lib.reset_done', TX_NS));
                            }
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontSize: '0.72rem'
                        }}
                    >
                        {tx(srcTekst, 'lib.reset', TX_NS)}
                    </button>
                </div>
            </div>
        </div>
    );
}
