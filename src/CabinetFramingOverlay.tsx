/**
 * src/CabinetFramingOverlay.tsx
 *
 * Interaktywny kadr prostokątny do robienia zdjęć/miniatur mebli w 3D.
 * Pozwala użytkownikowi obracać i przybliżać scenę 3D bezpośrednio w kadrze,
 * a następnie wyciąć zrzut ekranu do pliku JPG/WebP dla biblioteki.
 */

import React, { useRef } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';

declare const BABYLON: any;

interface Props {
    open: boolean;
    onCapture: (thumbnailDataUrl: string) => void;
    onCancel: () => void;
}

export function CabinetFramingOverlay({ open, onCapture, onCancel }: Props) {
    const frameBoxRef = useRef<HTMLDivElement>(null);

    if (!open) return null;

    const handleTakeSnapshot = async () => {
        if (!frameBoxRef.current) return;

        // 1. Znajdź główny canvas sceny 3D
        const viewport = ContextManager.instance.viewport;
        const canvas: HTMLCanvasElement | null = viewport?.canvas || document.querySelector('#renderCanvas') || document.querySelector('canvas');
        if (!canvas) {
            alert('Nie znaleziono płótna 3D do wykonania zrzutu.');
            onCancel();
            return;
        }

        const engine = viewport?.engine || (window as any).engine;
        const camera = viewport?.camera || (window as any).camera;

        const canvasRect = canvas.getBoundingClientRect();
        const frameRect = frameBoxRef.current.getBoundingClientRect();

        // 2. Przeliczenie współrzędnych ekranowych na piksele wewnętrzne canvasa
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;

        const cropX = Math.max(0, Math.round((frameRect.left - canvasRect.left) * scaleX));
        const cropY = Math.max(0, Math.round((frameRect.top - canvasRect.top) * scaleY));
        const cropW = Math.min(canvas.width - cropX, Math.round(frameRect.width * scaleX));
        const cropH = Math.min(canvas.height - cropY, Math.round(frameRect.height * scaleY));

        // 3. Obudź silnik renderujący Viewport (Render-on-Demand) i wyrenderuj bieżącą klatkę
        if (viewport?.requestRender) {
            viewport.requestRender(10);
        }
        if (viewport?.scene) {
            viewport.scene.render();
        }

        let fullScreenshotUrl = '';

        // 4. Pobranie zrzutu z Babylon.js lub bezpośrednio z płótna WebGL
        if (typeof BABYLON !== 'undefined' && BABYLON.Tools?.CreateScreenshotAsync && engine && camera) {
            try {
                const bjsPromise = BABYLON.Tools.CreateScreenshotAsync(
                    engine,
                    camera,
                    { width: canvas.width, height: canvas.height },
                    'image/png'
                );
                const timeoutPromise = new Promise<string>((_, reject) => 
                    setTimeout(() => reject(new Error('timeout')), 800)
                );
                fullScreenshotUrl = await Promise.race([bjsPromise, timeoutPromise]);
            } catch (err) {
                console.warn('[CabinetFramingOverlay] Błąd / timeout CreateScreenshotAsync, próba fallback do toDataURL:', err);
                if (BABYLON.Tools?.CreateScreenshotUsingRenderTargetAsync) {
                    try {
                        fullScreenshotUrl = await BABYLON.Tools.CreateScreenshotUsingRenderTargetAsync(
                            engine,
                            camera,
                            { width: canvas.width, height: canvas.height },
                            'image/png'
                        );
                    } catch { /* ignoruj */ }
                }
            }
        }

        if (!fullScreenshotUrl) {
            if (viewport?.scene) {
                viewport.scene.render();
            }
            try {
                fullScreenshotUrl = canvas.toDataURL('image/png', 1.0);
            } catch (err) {
                console.warn('[CabinetFramingOverlay] Błąd canvas.toDataURL:', err);
            }
        }

        if (!fullScreenshotUrl) {
            alert('Nie udało się przechwycić klatki 3D. Upewnij się, że widok 3D jest aktywny.');
            onCancel();
            return;
        }

        if (cropW <= 0 || cropH <= 0) {
            onCapture(fullScreenshotUrl);
            return;
        }

        // 5. Wycięcie kadru prostokąta na ostry, lekki obrazek (360x360 px, JPG)
        const img = new Image();
        img.onload = () => {
            const TARGET_SIZE = 360;
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = TARGET_SIZE;
            cropCanvas.height = TARGET_SIZE;
            const ctx = cropCanvas.getContext('2d');
            if (!ctx) {
                onCapture(fullScreenshotUrl);
                return;
            }

            // Tło w kolorze ciemnego motywu sceny
            ctx.fillStyle = '#18181b';
            ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

            // Rysowanie z przeskalowaniem
            ctx.drawImage(
                img,
                cropX,
                cropY,
                cropW,
                cropH,
                0,
                0,
                TARGET_SIZE,
                TARGET_SIZE
            );

            const finalJpg = cropCanvas.toDataURL('image/jpeg', 0.88);
            onCapture(finalJpg);
        };
        img.onerror = (err) => {
            console.warn('[CabinetFramingOverlay] Błąd przetwarzania kadru, używam pełnego zrzutu:', err);
            onCapture(fullScreenshotUrl);
        };
        img.src = fullScreenshotUrl;
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10000,
                pointerEvents: 'none', // Pozwala myszce manipulować sceną 3D (obrót / zoom mebla)
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none'
            }}
        >
            {/* Pasek informacyjny na górze ekranu */}
            <div
                style={{
                    position: 'absolute',
                    top: '55px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#f8fafc',
                    padding: '8px 18px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                <span style={{ fontSize: '1.1rem' }}>📷</span>
                <span>Ustaw mebel w kadrze myszką (obracaj / przybliżaj), a następnie kliknij <strong>Zapisz kadr</strong>.</span>
            </div>

            {/* Prostokąt kadrowania (Ramka podglądu) */}
            <div
                ref={frameBoxRef}
                style={{
                    width: '320px',
                    height: '320px',
                    position: 'relative',
                    border: '2px solid #38bdf8',
                    borderRadius: '8px',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.3)',
                    pointerEvents: 'none'
                }}
            >
                {/* Narożniki ozdobne wizjera */}
                <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '16px', height: '16px', borderTop: '4px solid #ffffff', borderLeft: '4px solid #ffffff' }} />
                <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '16px', height: '16px', borderTop: '4px solid #ffffff', borderRight: '4px solid #ffffff' }} />
                <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '16px', height: '16px', borderBottom: '4px solid #ffffff', borderLeft: '4px solid #ffffff' }} />
                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '16px', height: '16px', borderBottom: '4px solid #ffffff', borderRight: '4px solid #ffffff' }} />

                {/* Siatka pomocnicza trójpodziału */}
                <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px', borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
                <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px', borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
                <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px', borderTop: '1px dashed rgba(255,255,255,0.2)' }} />
                <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px', borderTop: '1px dashed rgba(255,255,255,0.2)' }} />

                {/* Etykieta wymiaru kadru */}
                <div style={{
                    position: 'absolute',
                    top: '-24px',
                    left: '0',
                    fontSize: '0.72rem',
                    color: '#38bdf8',
                    fontWeight: 600,
                    letterSpacing: '0.5px'
                }}>
                    KADR MINIATURKI (1:1)
                </div>

                {/* Pływający pasek akcji pod prostokątem */}
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        pointerEvents: 'auto',
                        background: '#18181b',
                        padding: '8px 12px',
                        borderRadius: '30px',
                        border: '1px solid #3f3f46',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.6)'
                    }}
                >
                    <button
                        onClick={handleTakeSnapshot}
                        style={{
                            padding: '8px 18px',
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <span style={{ fontSize: '1.1rem' }}>📷</span>
                        <span>Zapisz kadr</span>
                    </button>

                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 14px',
                            background: 'transparent',
                            color: '#a1a1aa',
                            border: '1px solid #3f3f46',
                            borderRadius: '20px',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        ✕ Anuluj
                    </button>
                </div>
            </div>
        </div>
    );
}
