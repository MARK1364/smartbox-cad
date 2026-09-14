/**
 * SmartPanel Web — QuickPick Popup
 * 
 * Pływające, nowoczesne okno dialogowe wyboru zakrytych płaszczyzn pod kursorem myszy (a'la Solid Edge QuickPick).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CAD_OPEN_QUICK_PICK, CAD_CLOSE_QUICK_PICK } from '../A1_core/quick-pick/quick-pick-events.js';
import type { QuickPickRequest, QuickPickCandidate } from '../A1_core/quick-pick/quick-pick-types.js';
import { QuickPickPreview } from '../A1_core/quick-pick/quick-pick-preview.js';

export const QuickPickPopup: React.FC = () => {
    const [request, setRequest] = useState<QuickPickRequest | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Otwieranie / Zamykanie przez zdarzenia
    useEffect(() => {
        const handleOpen = (e: any) => {
            const req = e.detail as QuickPickRequest;
            if (!req || !req.candidates || req.candidates.length === 0) return;
            setRequest(req);
            setSelectedIndex(0);
            // Podgląd pierwszej płaszczyzny
            QuickPickPreview.instance.highlightCandidate(req.candidates[0], req.candidates);
        };

        const handleClose = () => {
            QuickPickPreview.instance.clear();
            setRequest(null);
        };

        window.addEventListener(CAD_OPEN_QUICK_PICK, handleOpen);
        window.addEventListener(CAD_CLOSE_QUICK_PICK, handleClose);

        return () => {
            window.removeEventListener(CAD_OPEN_QUICK_PICK, handleOpen);
            window.removeEventListener(CAD_CLOSE_QUICK_PICK, handleClose);
            QuickPickPreview.instance.clear();
        };
    }, []);

    const handleSelect = useCallback((candidate: QuickPickCandidate) => {
        QuickPickPreview.instance.clear();
        if (request) {
            request.onSelect(candidate);
        }
        setRequest(null);
    }, [request]);

    const handleClose = useCallback(() => {
        QuickPickPreview.instance.clear();
        if (request?.onCancel) {
            request.onCancel();
        }
        setRequest(null);
    }, [request]);

    // Obsługa klawiatury (strzałki, enter, esc)
    useEffect(() => {
        if (!request) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                handleClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => {
                    const next = (prev + 1) % request.candidates.length;
                    QuickPickPreview.instance.highlightCandidate(request.candidates[next], request.candidates);
                    return next;
                });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => {
                    const next = (prev - 1 + request.candidates.length) % request.candidates.length;
                    QuickPickPreview.instance.highlightCandidate(request.candidates[next], request.candidates);
                    return next;
                });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const chosen = request.candidates[selectedIndex];
                if (chosen) {
                    handleSelect(chosen);
                }
            }
        };

        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [request, selectedIndex, handleSelect, handleClose]);

    // Zamknięcie po kliknięciu poza oknem
    useEffect(() => {
        if (!request) return;

        const onMouseDownOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };

        // Opóźniamy nasłuch, aby kliknięcie otwierające nie zamknęło natychmiast
        const timer = setTimeout(() => {
            window.addEventListener('mousedown', onMouseDownOutside);
        }, 50);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('mousedown', onMouseDownOutside);
        };
    }, [request, handleClose]);

    if (!request || request.candidates.length === 0) {
        return null;
    }

    // Inteligentne pozycjonowanie w granicach ekranu
    const popupWidth = 210;
    const estimatedHeight = Math.min(380, 46 + request.candidates.length * 32);
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

    let posX = request.screenX + 16;
    let posY = request.screenY - 20;

    if (posX + popupWidth > winW - 16) {
        posX = Math.max(16, request.screenX - popupWidth - 16);
    }
    if (posY + estimatedHeight > winH - 24) {
        posY = Math.max(24, winH - estimatedHeight - 24);
    }

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                left: `${posX}px`,
                top: `${posY}px`,
                width: `${popupWidth}px`,
                maxHeight: '400px',
                zIndex: 99999,
                background: 'rgba(18, 18, 24, 0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                color: '#f4f4f5',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontSize: '12px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                userSelect: 'none',
                animation: 'quickpick-fade-in 0.12s ease-out',
            }}
        >
            {/* Nagłówek */}
            <div
                style={{
                    padding: '6px 10px',
                    background: 'rgba(28, 28, 35, 0.9)',
                    borderBottom: '1px solid #27272a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#06b6d4', fontSize: '13px', lineHeight: 1 }}>☷</span>
                    <span style={{ fontWeight: 600, fontSize: '11px', color: '#e4e4e7' }}>
                        Wybór płaszczyzny
                    </span>
                    <span
                        style={{
                            fontSize: '9px',
                            background: 'rgba(6, 182, 212, 0.15)',
                            color: '#22d3ee',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: 600,
                        }}
                    >
                        {request.candidates.length}
                    </span>
                </div>
                <button
                    onClick={handleClose}
                    title="Zamknij (Esc)"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        fontSize: '12px',
                        lineHeight: 1,
                        borderRadius: '4px',
                        transition: 'color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#a1a1aa';
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Czysta, minimalistyczna lista warstw */}
            <div
                style={{
                    overflowY: 'auto',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    maxHeight: '320px',
                }}
            >
                {request.candidates.map((candidate, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                        <div
                            key={`${candidate.panelName}:${candidate.faceName}:${idx}`}
                            onClick={() => handleSelect(candidate)}
                            onMouseEnter={() => {
                                setSelectedIndex(idx);
                                QuickPickPreview.instance.highlightCandidate(candidate, request.candidates);
                            }}
                            style={{
                                padding: '5px 8px',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                background: isSelected
                                    ? 'rgba(6, 182, 212, 0.2)'
                                    : 'transparent',
                                border: isSelected
                                    ? '1px solid #06b6d4'
                                    : '1px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'background 0.1s, border-color 0.1s',
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    width: '16px',
                                    height: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '3px',
                                    background: isSelected ? '#06b6d4' : 'rgba(255, 255, 255, 0.08)',
                                    color: isSelected ? '#000' : '#a1a1aa',
                                    flexShrink: 0,
                                }}
                            >
                                {idx + 1}
                            </span>

                            <span
                                style={{
                                    fontWeight: isSelected ? 600 : 400,
                                    color: isSelected ? '#ffffff' : '#d4d4d8',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontSize: '11px',
                                    flex: 1,
                                }}
                            >
                                {candidate.panelName || `Element ${idx + 1}`}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Dyskretna stopka */}
            <div
                style={{
                    padding: '4px 8px',
                    background: 'rgba(20, 20, 26, 0.9)',
                    borderTop: '1px solid #27272a',
                    fontSize: '9px',
                    color: '#71717a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <span>↑↓ wybór</span>
                <span>↵ Enter</span>
                <span>Esc</span>
            </div>
        </div>
    );
};
