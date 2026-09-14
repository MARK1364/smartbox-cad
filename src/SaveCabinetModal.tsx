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

interface Props {
    open: boolean;
    onClose: () => void;
    projectModel: any;
    onSaved?: (cabinetName: string) => void;
}

export function SaveCabinetModal({ open, onClose, projectModel, onSaved }: Props) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState<CabinetCategory>('dolne');
    const [description, setDescription] = useState('');
    const [downloadJson, setDownloadJson] = useState(true);
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [isFraming, setIsFraming] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const doc = projectModel?.document || projectModel;
    const activeContainer = open && doc ? getActiveContainer(doc) : null;
    const fileInputImgRef = useRef<HTMLInputElement>(null);
    const prevOpenRef = useRef(false);

    // Inicjalizacja pól TYLKO przy otwarciu okna (gdy open przechodzi z false na true)
    useEffect(() => {
        if (open && !prevOpenRef.current) {
            if (activeContainer) {
                const w = Math.round(nmToMm(activeContainer.width));
                const h = Math.round(nmToMm(activeContainer.height));
                const d = Math.round(nmToMm(activeContainer.depth));
                const baseName = activeContainer.name?.replace(/_SB$/, '') || 'Korpus';
                setName(`${baseName} ${w}x${h}x${d}`);
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
                setName('Nowy Korpus');
            }
            setDescription('');
            setThumbnail(null);
            setIsFraming(false);
        }
        prevOpenRef.current = open;
    }, [open]);

    const handleQuickSnapshot = () => {
        const vp = ContextManager.instance.viewport;
        const canvas: HTMLCanvasElement | null = vp?.canvas || document.querySelector('#renderCanvas') || document.querySelector('canvas');
        if (!canvas) {
            setErrorMsg('Nie znaleziono płótna 3D do wykonania zrzutu.');
            return;
        }
        if (vp?.requestRender) {
            vp.requestRender(5);
        }
        if (vp?.scene) {
            vp.scene.render();
        }
        try {
            const size = Math.min(canvas.width, canvas.height);
            const startX = Math.max(0, Math.round((canvas.width - size) / 2));
            const startY = Math.max(0, Math.round((canvas.height - size) / 2));

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 360;
            tempCanvas.height = 360;
            const ctx = tempCanvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#18181b';
                ctx.fillRect(0, 0, 360, 360);
                ctx.drawImage(canvas, startX, startY, size, size, 0, 0, 360, 360);
                const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.88);
                setThumbnail(dataUrl);
            } else {
                setThumbnail(canvas.toDataURL('image/jpeg', 0.88));
            }
            setErrorMsg(null);
        } catch (e) {
            console.warn('[SaveCabinetModal] Błąd szybkiego zrzutu:', e);
            try {
                setThumbnail(canvas.toDataURL('image/jpeg', 0.85));
            } catch { /* ignoruj */ }
        }
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const res = evt.target?.result as string;
            if (res) {
                setThumbnail(res);
                setErrorMsg(null);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    if (!open) return null;

    const handleSave = () => {
        if (!activeContainer) {
            setErrorMsg('Nie znaleziono aktywnego korpusu na scenie. Zaznacz szafkę przed zapisem.');
            return;
        }

        if (!name.trim()) {
            setErrorMsg('Wpisz nazwę dla zapisywanej szafki.');
            return;
        }

        const template = serializeActiveCabinet(doc, {
            name: name.trim(),
            category,
            description: description.trim(),
            thumbnail: thumbnail || undefined
        });

        if (!template) {
            setErrorMsg('Błąd podczas odczytu danych korpusu. Upewnij się, że korpus jest prawidłowy.');
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
                            <span style={{ fontSize: '20px' }}>💾</span>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Zapisz korpus do biblioteki</h3>
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
                                ⚠️ <strong>Brak aktywnego mebla:</strong> Zaznacz na scenie korpus lub jego element, aby go zapisać.
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
                                <span>Wymiary mebla:</span>
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
                                    Zdjęcie / Podgląd mebla:
                                </label>
                                {thumbnail && (
                                    <span style={{ fontSize: '0.74rem', color: '#4ade80', fontWeight: 600 }}>
                                        ✓ Podgląd gotowy do zapisu
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
                                                alt="Podgląd szafki" 
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain'
                                                }} 
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                            <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                                                To zdjęcie będzie dużą ikoną w bibliotece korpusów.
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
                                                    📷 Zmień kadr
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleQuickSnapshot}
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
                                                    ⚡ Szybki zrzut
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
                                                    Usuń
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
                                            <span style={{ fontSize: '1.2rem' }}>📷</span>
                                            <span>Kadruj mebel na scenie (Wizjer 1:1)</span>
                                        </button>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={handleQuickSnapshot}
                                                disabled={!activeContainer}
                                                title="Błyskawiczny zrzut bieżącej pozycji kamery bez przechodzenia do wizjera"
                                                style={{
                                                    padding: '7px 10px',
                                                    background: '#27272a',
                                                    border: '1px solid #3f3f46',
                                                    borderRadius: '6px',
                                                    color: '#cbd5e1',
                                                    fontSize: '0.76rem',
                                                    fontWeight: 500,
                                                    cursor: activeContainer ? 'pointer' : 'not-allowed',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <span>⚡</span> Szybki zrzut (1 klik)
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => fileInputImgRef.current?.click()}
                                                disabled={!activeContainer}
                                                title="Wybierz plik graficzny (JPG/PNG) ze swojego komputera"
                                                style={{
                                                    padding: '7px 10px',
                                                    background: '#27272a',
                                                    border: '1px solid #3f3f46',
                                                    borderRadius: '6px',
                                                    color: '#cbd5e1',
                                                    fontSize: '0.76rem',
                                                    fontWeight: 500,
                                                    cursor: activeContainer ? 'pointer' : 'not-allowed',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <span>📁</span> Plik z dysku
                                            </button>
                                            <input 
                                                type="file" 
                                                ref={fileInputImgRef} 
                                                accept="image/*" 
                                                style={{ display: 'none' }} 
                                                onChange={handleImageFileChange} 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Nazwa */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>
                                Nazwa szafki w katalogu:
                            </label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="np. Szafka dolna 600 3 szuflady"
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
                                Kategoria mebla:
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
                                <option value="dolne">Szafki dolne</option>
                                <option value="gorne">Szafki górne (wiszące)</option>
                                <option value="slupki">Słupki wysokie</option>
                                <option value="inne">Inne korpusy</option>
                            </select>
                        </div>

                        {/* Opis */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#a1a1aa', fontWeight: 500 }}>
                                Krótki opis (opcjonalnie):
                            </label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="np. Korpus pod zlew, fronty z frezem, 2 półki regulowane"
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
                            <span>Pobierz także plik <strong>.json</strong> na dysk komputera</span>
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
                            Anuluj
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
                            <span>💾</span> Zapisz do biblioteki
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
