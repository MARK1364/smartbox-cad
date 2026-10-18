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
} from '../R1_reports/prices-api-client';
import { toCsv, fromCsv } from '../R1_reports/prices-csv';
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
    ok: '#059669',
    err: '#dc2626',
    info: '#d97706',
};

function cloneDb(db: PriceDatabase): PriceDatabase {
    return JSON.parse(JSON.stringify(db ?? {}));
}

function toEntry(value: number | PriceEntry): PriceEntry {
    if (typeof value === 'number') return { price: value };
    return {
        price: Number(value?.price) || 0,
        unit: value?.unit,
        name: value?.name,
        opis: value?.opis,
        brand: value?.brand,
        kategoria: value?.kategoria,
        indeks: value?.indeks,
    };
}

function pruneEntry(entry: PriceEntry): PriceEntry {
    const out: PriceEntry = { price: Number.isFinite(entry.price) ? entry.price : 0 };
    if (entry.unit) out.unit = entry.unit;
    if (entry.name) out.name = entry.name;
    if (entry.opis) out.opis = entry.opis;
    if (entry.brand) out.brand = entry.brand;
    if (entry.kategoria) out.kategoria = entry.kategoria;
    out.indeks = entry.indeks ?? '';
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
    const [kategoriaFilter, setKategoriaFilter] = useState('');
    const [pendingDelete, setPendingDelete] = useState<{ section: PriceSection; key: string; label: string } | null>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

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
        setBrandFilter('');
        setKategoriaFilter('');
        setStatus({ kind: 'info', text: `Dodano pozycję „${key}” — uzupełnij dane na końcu listy.` });
    };

    const requestRemove = (section: PriceSection, key: string) => {
        const entry = toEntry((db[section] || {})[key]);
        setPendingDelete({ section, key, label: entry.name || key });
    };

    const confirmRemove = () => {
        if (!pendingDelete) return;
        const { section, key } = pendingDelete;
        const next = cloneDb(db);
        const block = { ...(next[section] || {}) };
        delete block[key];
        next[section] = block;
        applyDraft(next);
        setPendingDelete(null);
        setStatus({ kind: 'info', text: `Usunięto pozycję „${key}”.` });
    };

    const exportCsv = () => {
        const csv = toCsv(db);
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cennik.csv';
        a.click();
        URL.revokeObjectURL(url);
        setStatus({ kind: 'ok', text: 'Wyeksportowano cennik do pliku cennik.csv.' });
    };

    const importCsv = async (file: File) => {
        try {
            const text = await file.text();
            const parsed = fromCsv(text);
            applyDraft(parsed);
            if (tab === 'json') setJsonText(JSON.stringify(parsed, null, 4));
            setStatus({ kind: 'ok', text: `Zaimportowano CSV: ${file.name} (niezapisane — kliknij „Zapisz”).` });
        } catch (err: any) {
            setStatus({ kind: 'err', text: `Niepoprawny CSV: ${err?.message || err}` });
        }
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
                text: `Zapisano lokalnie (${result.error || 'brak serwera'}).`,
            });
        }
    };

    const sectionEntries = (section: PriceSection) =>
        Object.entries(db[section] || {}) as [string, number | PriceEntry][];

    const kategorie = useMemo(() => {
        if (tab === 'json') return [] as string[];
        const set = new Set<string>();
        for (const [, value] of sectionEntries(tab)) {
            if (typeof value === 'object' && value && value.kategoria) set.add(value.kategoria);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, tab]);

    const marki = useMemo(() => {
        if (tab === 'json') return [] as string[];
        const set = new Set<string>();
        for (const [, value] of sectionEntries(tab)) {
            if (typeof value === 'object' && value && value.brand) set.add(value.brand);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, tab]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Cennik — edytor cen</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                    Źródło: <code>R1_reports/prices.json</code>
                    {serverAvailable === false && ' · tryb offline (localStorage)'}
                </div>
                <div style={{ flex: 1 }} />
                {dirty && <span style={{ fontSize: 12, color: '#d97706' }}>● niezapisane zmiany</span>}
                {tab !== 'json' && (
                    <button style={btnStyle} onClick={() => addEntry(tab)}>+ Dodaj pozycję</button>
                )}
                <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) importCsv(f);
                        e.target.value = '';
                    }}
                />
                <button style={btnStyle} onClick={() => csvInputRef.current?.click()}>Import CSV</button>
                <button style={btnStyle} onClick={exportCsv}>Eksport CSV</button>
                <button style={{ ...btnStyle, ...primaryBtnStyle }} disabled={busy} onClick={save}>Zapisz</button>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '8px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexWrap: 'wrap' }}>
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
                <div style={{ padding: '8px 18px', fontSize: 13, color: STATUS_COLORS[status.kind], borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {status.text}
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 18px' }}>
                {tab === 'json' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
                        {jsonError && <div style={{ color: '#dc2626', fontSize: 13 }}>Błąd JSON: {jsonError}</div>}
                        <textarea
                            spellCheck={false}
                            value={jsonText}
                            onChange={(e) => onJsonChange(e.target.value)}
                            style={{
                                flex: 1,
                                minHeight: 400,
                                width: '100%',
                                background: '#ffffff',
                                color: '#1e293b',
                                border: `1px solid ${jsonError ? '#dc2626' : 'rgba(0,0,0,0.15)'}`,
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
                            <label style={{ fontSize: 12, color: '#64748b' }}>Producent:</label>
                            <select
                                style={{ ...inputStyle, width: 180 }}
                                value={brandFilter}
                                onChange={(e) => setBrandFilter(e.target.value)}
                            >
                                <option value="">Wszyscy</option>
                                {marki.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <label style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>Kategoria:</label>
                            <select
                                style={{ ...inputStyle, width: 180 }}
                                value={kategoriaFilter}
                                onChange={(e) => setKategoriaFilter(e.target.value)}
                            >
                                <option value="">Wszystkie</option>
                                {kategorie.map((k) => (
                                    <option key={k} value={k}>{k}</option>
                                ))}
                            </select>
                            {(brandFilter || kategoriaFilter) && (
                                <button
                                    style={{ ...btnStyle, fontSize: 12 }}
                                    onClick={() => { setBrandFilter(''); setKategoriaFilter(''); }}
                                >
                                    Wyczyść filtry
                                </button>
                            )}
                        </div>
                        <SectionTable
                            section={tab}
                            entries={sectionEntries(tab)}
                            brandFilter={brandFilter}
                            kategoriaFilter={kategoriaFilter}
                            onUpdate={updateEntry}
                            onRename={renameEntry}
                            onAdd={addEntry}
                            onRemove={requestRemove}
                        />
                    </div>
                )}
            </div>

            {pendingDelete && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setPendingDelete(null)}
                >
                    <div
                        style={{
                            width: 380,
                            maxWidth: '90vw',
                            background: '#ffffff',
                            color: '#1e293b',
                            borderRadius: 10,
                            border: '1px solid rgba(0,0,0,0.1)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                            padding: 20,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>
                            ⚠ Usunąć pozycję?
                        </div>
                        <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
                            Klucz: <code style={{ fontFamily: 'Consolas, monospace' }}>{pendingDelete.key}</code>
                        </div>
                        {pendingDelete.label !== pendingDelete.key && (
                            <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
                                Nazwa: {pendingDelete.label}
                            </div>
                        )}
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                            Operacja jest nieodwracalna — potwierdź świadomie.
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                            <button style={btnStyle} onClick={() => setPendingDelete(null)}>Anuluj</button>
                            <button style={{ ...btnStyle, ...dangerConfirmStyle }} onClick={confirmRemove}>Usuń</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface SectionTableProps {
    section: PriceSection;
    entries: [string, number | PriceEntry][];
    brandFilter?: string;
    kategoriaFilter?: string;
    onUpdate: (section: PriceSection, key: string, patch: Partial<PriceEntry>) => void;
    onRename: (section: PriceSection, oldKey: string, newKey: string) => void;
    onAdd: (section: PriceSection) => void;
    onRemove: (section: PriceSection, key: string) => void;
}

function SectionTable({ section, entries, brandFilter, kategoriaFilter, onUpdate, onRename, onAdd, onRemove }: SectionTableProps) {
    const filtered = useMemo(() => {
        const brand = brandFilter?.trim() ?? '';
        const kategoria = kategoriaFilter?.trim() ?? '';
        if (!brand && !kategoria) return entries;
        return entries.filter(([, value]) => {
            const entry = toEntry(value);
            if (kategoria && (entry.kategoria || '') !== kategoria) return false;
            if (brand && (entry.brand || '') !== brand) return false;
            return true;
        });
    }, [entries, brandFilter, kategoriaFilter]);

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid rgba(0,0,0,0.15)' }}>
                    <th style={thStyle}>Klucz</th>
                    <th style={{ ...thStyle, width: 130 }}>Kategoria</th>
                    <th style={{ ...thStyle, width: 110 }}>Indeks</th>
                    <th style={thStyle}>Nazwa</th>
                    <th style={thStyle}>Opis</th>
                    <th style={{ ...thStyle, width: 120 }}>Producent</th>
                    <th style={{ ...thStyle, width: 105 }}>Cena [PLN]</th>
                    <th style={{ ...thStyle, width: 95 }}>Jednostka</th>
                    <th style={{ ...thStyle, width: 50 }} />
                </tr>
            </thead>
            <tbody>
                {filtered.map(([key, value]) => {
                    const entry = toEntry(value);
                    return (
                        <tr key={key} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
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
                                    value={entry.kategoria || ''}
                                    onChange={(e) => onUpdate(section, key, { kategoria: e.target.value })}
                                />
                            </td>
                            <td style={tdStyle}>
                                <input
                                    style={{ ...inputStyle, fontFamily: 'Consolas, monospace' }}
                                    placeholder="—"
                                    value={entry.indeks || ''}
                                    onChange={(e) => onUpdate(section, key, { indeks: e.target.value })}
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
                                    value={entry.opis || ''}
                                    onChange={(e) => onUpdate(section, key, { opis: e.target.value })}
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
                        <td colSpan={9} style={{ ...tdStyle, color: '#64748b' }}>
                            {brandFilter ? 'Brak pozycji pasujących do filtra.' : 'Brak pozycji w tej sekcji.'}
                        </td>
                    </tr>
                )}
            </tbody>
            <tfoot>
                <tr>
                    <td colSpan={9} style={{ padding: '10px 0' }}>
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
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'rgba(0,0,0,0.03)',
    color: '#1e293b',
    cursor: 'pointer',
    fontSize: 13,
};

const primaryBtnStyle: React.CSSProperties = {
    background: '#2563eb',
    borderColor: '#2563eb',
    color: '#ffffff',
    fontWeight: 600,
};

const dangerBtnStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid rgba(248,113,113,0.4)',
    background: 'rgba(248,113,113,0.1)',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: 12,
};

const dangerConfirmStyle: CSSProperties = {
    background: '#dc2626',
    borderColor: '#dc2626',
    color: '#ffffff',
    fontWeight: 600,
};

const tabStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 13,
};

const tabActiveStyle: React.CSSProperties = {
    background: 'rgba(37,99,235,0.10)',
    borderColor: 'rgba(37,99,235,0.45)',
    color: '#1e293b',
    fontWeight: 600,
};

const countBadgeStyle: React.CSSProperties = {
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 10,
    background: 'rgba(0,0,0,0.08)',
    color: '#475569',
};

const thStyle: React.CSSProperties = { padding: '8px 6px', fontWeight: 600 };

const tdStyle: React.CSSProperties = { padding: '4px 6px' };

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid rgba(0,0,0,0.15)',
    background: '#ffffff',
    color: '#1e293b',
    fontSize: 13,
};
