/**
 * Wspólny shell pływającego okna edycji na scenie (nagłówek + drag + Esc).
 * Start: obok panelu edycji, wyśrodkowane w pionie na scenie.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { computeFloatBesideEditPanel } from './float-position.js';

export interface FloatingEditShellProps {
    title: string;
    subtitle?: string;
    width?: number;
    maxHeight?: string;
    onClose: () => void;
    children: React.ReactNode;
}

export function FloatingEditShell({
    title,
    subtitle,
    width = 300,
    maxHeight = 'min(75vh, 560px)',
    onClose,
    children,
}: FloatingEditShellProps): React.JSX.Element {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState<{ x: number; y: number }>(() =>
        computeFloatBesideEditPanel(width, 320),
    );
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const placedRef = useRef(false);

    // Przy otwarciu / zmianie treści — obok panelu edycji, środek sceny w pionie
    useLayoutEffect(() => {
        placedRef.current = false;
        const el = rootRef.current;
        if (!el) return;
        const h = el.getBoundingClientRect().height || 320;
        setPos(computeFloatBesideEditPanel(width, h));
        placedRef.current = true;
    }, [width, title]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        isDraggingRef.current = true;
        dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        const onMove = (ev: MouseEvent) => {
            if (!isDraggingRef.current) return;
            setPos({
                x: Math.max(10, Math.min(window.innerWidth - 200, ev.clientX - dragOffsetRef.current.x)),
                y: Math.max(10, Math.min(window.innerHeight - 120, ev.clientY - dragOffsetRef.current.y)),
            });
        };
        const onUp = () => {
            isDraggingRef.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [pos.x, pos.y]);

    return (
        <div
            ref={rootRef}
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${width}px`,
                maxHeight,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(24, 24, 27, 0.96)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                borderRadius: '8px',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65), 0 0 16px rgba(59, 130, 246, 0.2)',
                zIndex: 10000,
                color: '#f4f4f5',
                fontSize: '12px',
                userSelect: 'none',
                overflow: 'hidden',
            }}
        >
            <div
                onMouseDown={handleMouseDown}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'grab',
                    flexShrink: 0,
                }}
            >
                <strong
                    style={{
                        fontSize: '12px',
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                    }}
                >
                    {title}
                </strong>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#a1a1aa',
                        fontSize: '16px',
                        lineHeight: 1,
                        cursor: 'pointer',
                        padding: '0 4px',
                        flexShrink: 0,
                    }}
                    title="Zamknij"
                >
                    ✕
                </button>
            </div>
            {subtitle ? (
                <div
                    style={{
                        padding: '6px 12px',
                        background: 'rgba(0,0,0,0.2)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '11px',
                        color: '#94a3b8',
                        flexShrink: 0,
                    }}
                >
                    {subtitle}
                </div>
            ) : null}
            <div style={{ padding: '8px 10px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {children}
            </div>
        </div>
    );
}
