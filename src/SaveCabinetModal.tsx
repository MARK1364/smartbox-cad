/**
 * src/SaveCabinetModal.tsx
 *
 * Modal zapisu zaznaczonego korpusu do biblioteki (oraz opcjonalnie na dysk jako plik .json).
 * Obsługuje interaktywne kadrowanie i robienie zdjęć mebli na scenie 3D.
 */

import React, { useState, useEffect, useRef } from 'react';
import { serializeActiveCabinet } from '../B1_biblioteka/korpusy/cabinet-serializer.js';
import { cabinetLibraryStore } from '../B1_biblioteka/korpusy/cabinet-library-store.js';
import type { CabinetCategory } from '../B1_biblioteka/korpusy/types.js';
import { getActiveContainer } from '../A3_smartframe/smartframe-adapter.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { CabinetFramingOverlay } from './CabinetFramingOverlay.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

interface Props {
    open: boolean;
    onClose: () => void;
    projectModel: any;
    onSaved?: (cabinetName: string) => void;
}

export function SaveCabinetModal({ open, onClose, projectModel, onSaved }: Props) {
    useLocale();
    const [name, setName] = useState('');
    const [category, setCategory] = useState<CabinetCategory>('dolne');
    const [description, setDescription] = useState('');
    const [downloadJson, setDownloadJson] = useState(true);
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [isFraming, setIsFraming] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const doc = projectModel?.document || projectModel;
    const activeContainer = open && doc ? getActiveContainer(doc) : null;
    const prevOpenRef = useRef(false);

    // Inicjalizacja pól TYLKO przy otwarciu okna (gdy open przechodzi z false na true)
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            if (activeContainer) {
                const w = Math.round(nmToMm(activeContainer.width));
                const h = Math.round(nmToMm(activeContainer.height));
                const d = Math.round(nmToMm(activeContainer.depth));
                const baseName = activeContainer.name?.replace(/_SB$/, '') || tx(srcTekst, 'save_cabinet.default_name', TX_NS);
                setName(baseName);
                setErrorMsg(null);

                // Automatyczne dopasowanie kategorii po wysokości
                if (h > 1500) {
                    setCategory('slupki');
                } else if (h < 1000 && d < 400) {
                    setCategory('gorne');
                } else {
                    setCategory('dolne');
                }
            } else {
                setName(tx(srcTekst, 'save_cabinet.default_name', TX_NS));
            }
            setDescription('');
            setThumbnail(null);
            setIsFraming(false);
        }
        prevOpenRef.current = open;
    }, [open]);



    if (!open) return null;

    const handleSave = () => {
        if (!activeContainer) {
            setErrorMsg(tx(srcTekst, 'save_cabinet.err_no_active', TX_NS));
            return;
        }

        if (!name.trim()) {
            setErrorMsg(tx(srcTekst, 'save_cabinet.err_no_name', TX_NS));
            return;
        }

        const template = serializeActiveCabinet(doc, {
            name: name.trim(),
            category,
            description: description.trim(),
            thumbnail: thumbnail || undefined
        });

        if (!template) {
            setErrorMsg(tx(srcTekst, 'save_cabinet.err_read', TX_NS));
            return;
        }

        // 1. Zapis do pamięci podręcznej biblioteki
        cabinetLibraryStore.save(template);

        // 2. Jeśli zaznaczono, pobranie pliku .json na dysk komputera
        if (downloadJson) {
            cabinetLibraryStore.exportToJsonFile(template);
        }

        if (onSaved) onSaved(template.name);
        onClose();
    };

    const wMm = activeContainer ? Math.round(nmToMm(activeContainer.width)) : 0;
    const hMm = activeContainer ? Math.round(nmToMm(activeContainer.height)) : 0;
    const dMm = activeContainer ? Math.round(nmToMm(activeContainer.depth)) : 0;

    return (
        <>
            <CabinetFramingOverlay
                open={open && isFraming}
                onCapture={(dataUrl) => {
                    setThumbnail(dataUrl);
                    setIsFraming(false);
                }}
                onCancel={() => setIsFraming(false)}
            />
            <div 
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(4px)',
                    display: isFraming ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}
                onClick={onClose}
            >
                <div 
                    style={{
                        backgroundColor: '#1c1c1f',
                        border: '1px solid #3f3f46',
                        borderRadius: '10px',
                        width: '100%',
                        maxWidth: '480px',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
                        color: '#f4f4f5',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid #27272a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{tx(srcTekst, 'save_cabinet.title', TX_NS)}</h3>
                        </div>
                        <button 
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#a1a1aa',
                                fontSize: '20px',
                                cursor: 'pointer',
                                padding: '4px 8px'
                            }}
                        >×</button>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '80vh', overflowY: 'auto' }}>
                        {!activeContainer ? (
                            <div style={{
                                padding: '12px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '6px',
                                color: '#fca5a5',
                                fontSize: '0.85rem'
                            }}>
                                <strong>{tx(srcTekst, 'save_cabinet.no_active_title', TX_NS)}</strong> {tx(srcTekst, 'save_cabinet.no_active_body', TX_NS)}
                            </div>
                        ) : (
                            <div style={{
                                padding: '10px 14px',
                                background: '#27272a',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                color: '#cbd5e1'
                            }}>
                                <span>{tx(srcTekst, 'save_cabinet.dims', TX_NS)}</span>
                                <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                                    {wMm} × {hMm} × {dMm} mm
                                </span>
                            </div>
                        )}

                        {errorMsg && (
                            <div style={{
                                padding: '10px 12px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '6px',
                                color: '#fca5a5',
                                fontSize: '0.85rem'
                            }}>
                                {errorMsg}
                            </div>
                        )}

                        {/* Sekcja Miniaturki / Kadrowania */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>
                                    {tx(srcTekst, 'save_cabinet.photo_label', TX_NS)}
                                </label>
                                {thumbnail && (
                                    <span style={{ fontSize: '0.74rem', color: '#4ade80', fontWeight: 600 }}>
                                        ✓ {tx(srcTekst, 'save_cabinet.preview_ready', TX_NS)}
                                    </span>
                                )}
                            </div>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                padding: '12px',
                                background: '#121214',
                                border: thumbnail ? '1px solid #38bdf8' : '1px solid #3f3f46',
                                borderRadius: '8px'
                            }}>
                                {thumbnail ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{
                                            width: '100px',
                                            height: '100px',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            border: '1px solid #38bdf8',
                                            background: '#18181b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <img 
                                                src={thumbnail} 
                                                alt={tx(srcTekst, 'save_cabinet.photo_label', TX_NS)}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain'
                                                }} 
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                            <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                                                {tx(srcTekst, 'save_cabinet.photo_hint', TX_NS)}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsFraming(true)}
                                                    style={{
                                                        padding: '5px 10px',
                                                        background: '#27272a',
                                                        border: '1px solid #3f3f46',
                                                        borderRadius: '5px',
                                                        color: '#e2e8f0',
                                                        fontSize: '0.76rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {tx(srcTekst, 'save_cabinet.change_frame', TX_NS)}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setThumbnail(null)}
                                                    style={{
                                                        padding: '5px 10px',
                                                        background: 'transparent',
                                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                                        borderRadius: '5px',
                                                        color: '#ef4444',
                                                        fontSize: '0.76rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {tx(srcTekst, 'save_cabinet.remove', TX_NS)}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setIsFraming(true)}
                                            disabled={!activeContainer}
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                background: 'rgba(37, 99, 235, 0.15)',
                                                border: '1px dashed #3b82f6',
                                                borderRadius: '6px',
                                                color: '#93c5fd',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                cursor: activeContainer ? 'pointer' : 'not-allowed',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <span>{tx(srcTekst, 'save_cabinet.frame_scene', TX_NS)}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Nazwa */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>
                                {tx(srcTekst, 'save_cabinet.name_label', TX_NS)}
                            </label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={tx(srcTekst, 'save_cabinet.name_placeholder', TX_NS)}
                                disabled={!activeContainer}
                                style={{
                                    padding: '10px 12px',
                                    background: '#121214',
                                    border: '1px solid #3f3f46',
                                    borderRadius: '6px',
                                    color: '#f4f4f5',
                                    fontSize: '0.9rem',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Kategoria */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>
                                {tx(srcTekst, 'save_cabinet.category_label', TX_NS)}
                            </label>
                            <select 
                                value={category}
                                onChange={(e) => setCategory(e.target.value as CabinetCategory)}
                                disabled={!activeContainer}
                                style={{
                                    padding: '10px 12px',
                                    background: '#121214',
                                    border: '1px solid #3f3f46',
                                    borderRadius: '6px',
                                    color: '#f4f4f5',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="dolne">{tx(srcTekst, 'save_cabinet.categories.dolne', TX_NS)}</option>
                                <option value="gorne">{tx(srcTekst, 'save_cabinet.categories.gorne', TX_NS)}</option>
                                <option value="slupki">{tx(srcTekst, 'save_cabinet.categories.slupki', TX_NS)}</option>
                                <option value="inne">{tx(srcTekst, 'save_cabinet.categories.inne', TX_NS)}</option>
                            </select>
                        </div>

                        {/* Opis */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>
                                {tx(srcTekst, 'save_cabinet.desc_label', TX_NS)}
                            </label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={tx(srcTekst, 'save_cabinet.desc_placeholder', TX_NS)}
                                disabled={!activeContainer}
                                rows={2}
                                style={{
                                    padding: '10px 12px',
                                    background: '#121214',
                                    border: '1px solid #3f3f46',
                                    borderRadius: '6px',
                                    color: '#f4f4f5',
                                    fontSize: '0.85rem',
                                    outline: 'none',
                                    resize: 'none'
                                }}
                            />
                        </div>

                        {/* Opcja pobrania pliku .json */}
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '0.85rem',
                            color: '#cbd5e1',
                            cursor: 'pointer',
                            marginTop: '4px'
                        }}>
                            <input 
                                type="checkbox"
                                checked={downloadJson}
                                onChange={(e) => setDownloadJson(e.target.checked)}
                                disabled={!activeContainer}
                                style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                            />
                            <span>{tx(srcTekst, 'save_cabinet.download_json', TX_NS)} <strong>.json</strong> {tx(srcTekst, 'save_cabinet.download_json_suffix', TX_NS)}</span>
                        </label>
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '14px 20px',
                        borderTop: '1px solid #27272a',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        background: '#18181b'
                    }}>
                        <button 
                            onClick={onClose}
                            style={{
                                padding: '8px 16px',
                                background: 'transparent',
                                border: '1px solid #3f3f46',
                                borderRadius: '6px',
                                color: '#a1a1aa',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            {tx(srcTekst, 'save_cabinet.cancel', TX_NS)}
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={!activeContainer}
                            style={{
                                padding: '8px 20px',
                                background: activeContainer ? '#2563eb' : '#3f3f46',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 600,
                                cursor: activeContainer ? 'pointer' : 'not-allowed',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {tx(srcTekst, 'save_cabinet.save', TX_NS)}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
