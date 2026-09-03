import React from 'react';
import type { ModuleId, ModuleSourceId } from './types';
import { returnToCad } from './session';

interface ModuleSourceBarProps {
    module: ModuleId;
    title: string;
    originLabel?: string;
    onLoadJson?: (text: string, fileName: string) => void;
    onLoadCsv?: (text: string, fileName: string) => void;
    /** Ponowna ekstrakcja z żywego ProjectDocument w CAD (SSOT). */
    onRefreshFromCad?: () => void;
    statusHint?: string;
    jsonAccept?: string;
}

const TITLES: Record<ModuleId, string> = {
    report: 'Raport',
    nesting: 'Nesting',
    cnc: 'CNC',
    draw: 'Rysunek',
};

export function ModuleSourceBar({
    module,
    title,
    originLabel,
    onLoadJson,
    onLoadCsv,
    onRefreshFromCad,
    statusHint,
    jsonAccept = 'application/json,.json',
}: ModuleSourceBarProps) {
    const fileJson = React.useRef<HTMLInputElement>(null);
    const fileCsv = React.useRef<HTMLInputElement>(null);

    return (
        <header
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 14px',
                background: '#111827',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                color: '#e5e7eb',
                fontFamily: 'Inter, Segoe UI, sans-serif',
                fontSize: '13px',
                flexShrink: 0,
            }}
        >
            <a
                href="/"
                onClick={(e) => {
                    e.preventDefault();
                    returnToCad(module);
                }}
                style={{ color: '#93c5fd', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
                ← CAD
            </a>
            <strong style={{ letterSpacing: '0.02em' }}>{title || TITLES[module]}</strong>
            {originLabel && (
                <span style={{ color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {originLabel}
                </span>
            )}
            {statusHint && (
                <span style={{ color: '#6ee7b7', fontSize: '11px', whiteSpace: 'nowrap' }}>{statusHint}</span>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ color: '#6b7280', fontSize: '11px' }}>Źródło danych</span>
            {onRefreshFromCad && (
                <button
                    type="button"
                    onClick={onRefreshFromCad}
                    style={btnStyle}
                    title="Pobierz aktualne dane z ProjectDocument w CAD (SSOT)"
                >
                    Odśwież z CAD
                </button>
            )}
            {onLoadJson && (
                <>
                    <button
                        type="button"
                        onClick={() => fileJson.current?.click()}
                        style={btnStyle}
                        title="Wczytaj JSON (testowe źródło — ten sam kontrakt co CAD)"
                    >
                        JSON
                    </button>
                    <input
                        ref={fileJson}
                        type="file"
                        accept={jsonAccept}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            file.text().then((text) => onLoadJson(text, file.name));
                            e.target.value = '';
                        }}
                    />
                </>
            )}
            {onLoadCsv && (
                <>
                    <button
                        type="button"
                        onClick={() => fileCsv.current?.click()}
                        style={btnStyle}
                        title="Wczytaj listę formatek z CSV"
                    >
                        CSV
                    </button>
                    <input
                        ref={fileCsv}
                        type="file"
                        accept=".csv,text/csv"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            file.text().then((text) => onLoadCsv(text, file.name));
                            e.target.value = '';
                        }}
                    />
                </>
            )}
        </header>
    );
}

const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    color: '#e5e7eb',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 4,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
};

export type { ModuleSourceId };
