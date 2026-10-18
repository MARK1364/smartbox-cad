/**
 * Edytor cennika (cennik.html) — podstrona otwierana z Plik → Cennik.
 *
 * Źródło prawdy: R1_reports/prices.json. Zapis:
 *   - dev-server Vite (POST /api/prices) → nadpisuje plik na dysku,
 *   - brak backendu → zapis w localStorage (PriceStore) + eksport pliku.
 * Każdy zapis rozgłasza zmianę do otwartych okien CAD/raport (PriceStore).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { priceStore } from '../R1_reports/price-store';
import {
    fetchPricesFromServer,
    savePricesToServer,
    resetPricesOnServer,
} from '../R1_reports/prices-api-client';
import {
    PRICE_SECTIONS,
    validatePriceDatabase,
    type PriceDatabase,
    type PriceEntry,
    type PriceSection,
} from '../R1_reports/prices-validate';

const SECTION_LABELS: Record<PriceSection, string> = {
    prices_materials: 'Materiały',
    prices_services: 'Usługi',
    prices_hardware: 'Okucia',
};

type Tab = PriceSection | 'json';
type StatusKind = 'ok' | 'err' | 'info';
interface Status {
    kind: StatusKind;
    text: string;
}

const STATUS_COLORS: Record<StatusKind, string> = {
    ok: '#34d399',
    err: '#f87171',
    info: '#fbbf24',
};

function cloneDb(db: PriceDatabase): PriceDatabase {
    return JSON.parse(JSON.stringify(db ?? {}));
}

function toEntry(value: number | PriceEntry): PriceEntry {
    if (typeof value === 'number') return { price: value };
    return { price: Number(value?.price) || 0, unit: value?.unit, name: value?.name, brand: value?.brand };
}

function pruneEntry(entry: PriceEntry): PriceEntry {
    const out: PriceEntry = { price: Number.isFinite(entry.price) ? entry.price : 0 };
    if (entry.unit) out.unit = entry.unit;
    if (entry.name) out.name = entry.name;
    if (entry.brand) out.brand = entry.brand;
    return out;
}

export function CennikEditor() {
    const [db, setDb] = useState<PriceDatabase>({});
    const [baseline, setBaseline] = useState<string>('');
    const [tab, setTab] = useState<Tab>('prices_hardware');
    const [jsonText, setJsonText] = useState<string>('{}');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState(false);
    const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
    const [brandFilter, setBrandFilter] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const applyDraft = useCallback((next: PriceDatabase, newBaseline?: string | null) => {
        setDb(next);
        if (newBaseline !== undefined) setBaseline(newBaseline ?? JSON.stringify(next));
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            const fromServer = await fetchPricesFromServer();
            if (!alive) return;
            if (fromServer) {
                priceStore.applyPrices(fromServer);
                applyDraft(fromServer, JSON.stringify(fromServer));
                setServerAvailable(true);
            } else {
                const current = cloneDb(priceStore.prices);
                applyDraft(current, JSON.stringify(current));
                setServerAvailable(false);
                setStatus({
                    kind: 'info',
                    text: 'Brak dev-serwera zapisu — zmiany zapiszą się w tej przeglądarce (localStorage). Użyj „Pobierz JSON”, aby podmienić plik R1_reports/prices.json.',
                });
            }
        })();
        return () => {
            alive = false;
        };
    }, [applyDraft]);

    const dirty = useMemo(() => JSON.stringify(db) !== baseline, [db, baseline]);

    const switchTab = (next: Tab) => {
        if (next === 'json') {
            setJsonText(JSON.stringify(db, null, 4));
            setJsonError(null);
        }
        setTab(next);
    };

    const updateEntry = (section: PriceSection, key: string, patch: Partial<PriceEntry>) => {
        const next = cloneDb(db);
        const block = { ...(next[section] || {}) };
        const merged = { ...toEntry(block[key]), ...patch };
        const wasNumber = typeof block[key] === 'number';
        if (wasNumber && !merged.unit && !merged.name) {
            block[key] = merged.price;
        } else {
            block[key] = pruneEntry(merged);
        }
        next[section] = block;
        applyDraft(next);
    };

    const renameEntry = (section: PriceSection, oldKey: string, rawNew: string) => {
        const newKey = rawNew.trim();
        if (!newKey || newKey === oldKey) return;
        const next = cloneDb(db);
        const block = next[section] || {};
        if (Object.prototype.hasOwnProperty.call(block, newKey)) return;
        const rebuilt: Record<string, number | PriceEntry> = {};
        for (const [k, v] of Object.entries(block)) {
            rebuilt[k === oldKey ? newKey : k] = v;
        }
        next[section] = rebuilt;
        applyDraft(next);
    };

    const addEntry = (section: PriceSection) => {
        const next = cloneDb(db);
        const block = { ...(next[section] || {}) };
        let i = 1;
        let key = 'NOWA_POZYCJA';
        while (Object.prototype.hasOwnProperty.call(block, key)) key = `NOWA_POZYCJA_${++i}`;
        block[key] = { price: 0 };
        next[section] = block;
        applyDraft(next);
    };

    const removeEntry = (section: PriceSection, key: string) => {
        const next = cloneDb(db);
        const block = { ...(next[section] || {}) };
        delete block[key];
        next[section] = block;
        applyDraft(next);
    };

    const onJsonChange = (text: string) => {
        setJsonText(text);
        try {
            const parsed = JSON.parse(text);
            validatePriceDatabase(parsed);
            setDb(parsed);
            setJsonError(null);
        } catch (err: any) {
            setJsonError(String(err?.message || err));
        }
    };

    const save = async () => {
        try {
            validatePriceDatabase(db);
        } catch (err: any) {
            setStatus({ kind: 'err', text: String(err?.message || err) });
            return;
        }
        setBusy(true);
        const result = await savePricesToServer(db);
        setBusy(false);
        priceStore.setPrices(db);
        setBaseline(JSON.stringify(db));
        if (result.ok) {
            setServerAvailable(true);
            setStatus({ kind: 'ok', text: 'Zapisano cennik do R1_reports/prices.json.' });
        } else {
            setServerAvailable(false);
            setStatus({
                kind: 'info',
                text: `Zapisano lokalnie (${result.error || 'brak serwera'}). Użyj „Pobierz JSON”, aby podmienić plik w repozytorium.`,
            });
        }
    };

    const reset = async () => {
        setBusy(true);
        const result = await resetPricesOnServer();
        setBusy(false);
        priceStore.reset();
        let next: PriceDatabase;
        if (result.ok && result.prices) {
            next = cloneDb(result.prices);
            priceStore.applyPrices(next);
            setStatus({ kind: 'ok', text: 'Przywrócono domyślny cennik (plik prices.default.json).' });
        } else {
            next = cloneDb(priceStore.defaults());
            setStatus({ kind: 'info', text: 'Przywrócono ceny domyślne tej przeglądarki.' });
        }
        applyDraft(next, JSON.stringify(next));
        if (tab === 'json') setJsonText(JSON.stringify(next, null, 4));
    };

    const reloadFromServer = async () => {
        const fromServer = await fetchPricesFromServer();
        if (fromServer) {
            priceStore.applyPrices(fromServer);
            applyDraft(fromServer, JSON.stringify(fromServer));
            if (tab === 'json') setJsonText(JSON.stringify(fromServer, null, 4));
            setServerAvailable(true);
            setStatus({ kind: 'ok', text: 'Wczytano cennik z pliku.' });
        } else {
            setStatus({ kind: 'err', text: 'Nie udało się wczytać pliku cennika (brak serwera).' });
        }
    };

    const download = () => {
        const blob = new Blob([JSON.stringify(db, null, 4) + '\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prices.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const importFile = async (file: File) => {
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            validatePriceDatabase(parsed);
            applyDraft(parsed);
            if (tab === 'json') setJsonText(JSON.stringify(parsed, null, 4));
            setStatus({ kind: 'ok', text: `Wczytano plik: ${file.name}` });
        } catch (err: any) {
            setStatus({ kind: 'err', text: `Niepoprawny plik: ${err?.message || err}` });
        }
    };

    const sectionEntries = (section: PriceSection) =>
        Object.entries(db[section] || {}) as [string, number | PriceEntry][];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1115' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Cennik — edytor cen</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Źródło: <code>R1_reports/prices.json</code>
                    {serverAvailable === false && ' · tryb offline (localStorage)'}
                </div>
                <div style={{ flex: 1 }} />
                {dirty && <span style={{ fontSize: 12, color: '#fbbf24' }}>● niezapisane zmiany</span>}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) importFile(f);
                        e.target.value = '';
                    }}
                />
                <button style={btnStyle} disabled={busy} onClick={reloadFromServer}>Odśwież z pliku</button>
                <button style={btnStyle} disabled={busy} onClick={() => fileInputRef.current?.click()}>Wczytaj JSON</button>
                <button style={btnStyle} onClick={download}>Pobierz JSON</button>
                <button style={btnStyle} disabled={busy} onClick={reset}>Przywróć domyślne</button>
                <button style={{ ...btnStyle, ...primaryBtnStyle }} disabled={busy} onClick={save}>Zapisz</button>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '8px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
                {PRICE_SECTIONS.map((section) => (
                    <button
                        key={section}
                        style={{ ...tabStyle, ...(tab === section ? tabActiveStyle : {}) }}
                        onClick={() => switchTab(section)}
                    >
                        {SECTION_LABELS[section]}
                        <span style={countBadgeStyle}>{sectionEntries(section).length}</span>
                    </button>
                ))}
                <button
                    style={{ ...tabStyle, ...(tab === 'json' ? tabActiveStyle : {}) }}
                    onClick={() => switchTab('json')}
                >
                    JSON (całość)
                </button>
            </div>

            {status && (
                <div style={{ padding: '8px 18px', fontSize: 13, color: STATUS_COLORS[status.kind], borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {status.text}
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 18px' }}>
                {tab === 'json' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
                        {jsonError && <div style={{ color: '#f87171', fontSize: 13 }}>Błąd JSON: {jsonError}</div>}
                        <textarea
                            spellCheck={false}
                            value={jsonText}
                            onChange={(e) => onJsonChange(e.target.value)}
                            style={{
                                flex: 1,
                                minHeight: 400,
                                width: '100%',
                                background: '#0b0d11',
                                color: '#e2e8f0',
                                border: `1px solid ${jsonError ? '#f87171' : 'rgba(255,255,255,0.12)'}`,
                                borderRadius: 8,
                                padding: 12,
                                fontFamily: 'Consolas, monospace',
                                fontSize: 13,
                                lineHeight: 1.5,
                                resize: 'vertical',
                            }}
                        />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <label style={{ fontSize: 12, color: '#94a3b8' }}>Filtr producenta:</label>
                            <input
                                style={{ ...inputStyle, width: 220 }}
                                placeholder="np. Klocki Polski"
                                value={brandFilter}
                                onChange={(e) => setBrandFilter(e.target.value)}
                            />
                            {brandFilter && (
                                <button style={{ ...btnStyle, fontSize: 12 }} onClick={() => setBrandFilter('')}>Wyczyść</button>
                            )}
                        </div>
                        <SectionTable
                            section={tab}
                            entries={sectionEntries(tab)}
                            brandFilter={brandFilter}
                            onUpdate={updateEntry}
                            onRename={renameEntry}
                            onAdd={addEntry}
                            onRemove={removeEntry}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

interface SectionTableProps {
    section: PriceSection;
    entries: [string, number | PriceEntry][];
    brandFilter?: string;
    onUpdate: (section: PriceSection, key: string, patch: Partial<PriceEntry>) => void;
    onRename: (section: PriceSection, oldKey: string, newKey: string) => void;
    onAdd: (section: PriceSection) => void;
    onRemove: (section: PriceSection, key: string) => void;
}

function SectionTable({ section, entries, brandFilter, onUpdate, onRename, onAdd, onRemove }: SectionTableProps) {
    const filtered = useMemo(() => {
        if (!brandFilter?.trim()) return entries;
        const q = brandFilter.trim().toLowerCase();
        return entries.filter(([, value]) => {
            const entry = toEntry(value);
            return (entry.brand || '').toLowerCase().includes(q);
        });
    }, [entries, brandFilter]);

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
                <tr style={{ textAlign: 'left', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                    <th style={thStyle}>Klucz</th>
                    <th style={thStyle}>Nazwa (wyświetlana)</th>
                    <th style={{ ...thStyle, width: 140 }}>Producent</th>
                    <th style={{ ...thStyle, width: 120 }}>Cena [PLN]</th>
                    <th style={{ ...thStyle, width: 110 }}>Jednostka</th>
                    <th style={{ ...thStyle, width: 50 }} />
                </tr>
            </thead>
            <tbody>
                {filtered.map(([key, value]) => {
                    const entry = toEntry(value);
                    return (
                        <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={tdStyle}>
                                <input
                                    style={{ ...inputStyle, fontFamily: 'Consolas, monospace' }}
                                    value={key}
                                    onChange={(e) => onRename(section, key, e.target.value)}
                                />
                            </td>
                            <td style={tdStyle}>
                                <input
                                    style={inputStyle}
                                    placeholder="—"
                                    value={entry.name || ''}
                                    onChange={(e) => onUpdate(section, key, { name: e.target.value })}
                                />
                            </td>
                            <td style={tdStyle}>
                                <input
                                    style={inputStyle}
                                    placeholder="—"
                                    value={entry.brand || ''}
                                    onChange={(e) => onUpdate(section, key, { brand: e.target.value })}
                                />
                            </td>
                            <td style={tdStyle}>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    style={inputStyle}
                                    value={Number.isFinite(entry.price) ? entry.price : 0}
                                    onChange={(e) => onUpdate(section, key, { price: e.target.value === '' ? 0 : Number(e.target.value) })}
                                />
                            </td>
                            <td style={tdStyle}>
                                <input
                                    style={inputStyle}
                                    placeholder="szt"
                                    value={entry.unit || ''}
                                    onChange={(e) => onUpdate(section, key, { unit: e.target.value })}
                                />
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                <button style={dangerBtnStyle} title="Usuń pozycję" onClick={() => onRemove(section, key)}>✕</button>
                            </td>
                        </tr>
                    );
                })}
                {filtered.length === 0 && (
                    <tr>
                        <td colSpan={6} style={{ ...tdStyle, color: '#64748b' }}>
                            {brandFilter ? 'Brak pozycji pasujących do filtra.' : 'Brak pozycji w tej sekcji.'}
                        </td>
                    </tr>
                )}
            </tbody>
            <tfoot>
                <tr>
                    <td colSpan={6} style={{ padding: '10px 0' }}>
                        <button style={btnStyle} onClick={() => onAdd(section)}>+ Dodaj pozycję</button>
                    </td>
                </tr>
            </tfoot>
        </table>
    );
}

const btnStyle: CSSProperties = {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.04)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 13,
};

const primaryBtnStyle: React.CSSProperties = {
    background: '#2563eb',
    borderColor: '#2563eb',
    fontWeight: 600,
};

const dangerBtnStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid rgba(248,113,113,0.4)',
    background: 'rgba(248,113,113,0.1)',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: 12,
};

const tabStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 13,
};

const tabActiveStyle: React.CSSProperties = {
    background: 'rgba(96,165,250,0.12)',
    borderColor: 'rgba(96,165,250,0.4)',
    color: '#e2e8f0',
    fontWeight: 600,
};

const countBadgeStyle: React.CSSProperties = {
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.1)',
    color: '#cbd5e1',
};

const thStyle: React.CSSProperties = { padding: '8px 6px', fontWeight: 600 };

const tdStyle: React.CSSProperties = { padding: '4px 6px' };

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#0b0d11',
    color: '#e2e8f0',
    fontSize: 13,
};
