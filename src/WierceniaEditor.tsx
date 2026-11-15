/**
 * Edytor wierceń okuć (wiercenia.html) — podstrona otwierana z Plik → Wiercenia.
 *
 * Źródło prawdy: pliki JSON w B1_biblioteka (zawiasy, szuflady, zawieszki, …).
 * Widok pozwala edytować listy otworów (front / korpus / montaż) bez ręcznego
 * grzebania w JSON-ie, a zakładka „JSON” daje pełną kontrolę nad dowolnym polem.
 *
 * Zapis:
 *   - dev-server Vite (POST /api/hardware) → nadpisuje plik na dysku i odświeża
 *     zaszyfrowany kontener reguł, więc CAD od razu widzi nowe wiercenia,
 *   - brak backendu → pozostaje „Pobierz JSON” i ręczna podmiana pliku.
 */

import React, { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
    fetchHardwareFiles,
    saveHardwareFiles,
    type HardwareFileEntry,
} from './hardware-api-client';

type PathSeg = string | number;
type Tab = 'holes' | 'lengths' | 'fields' | 'json';
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

const CATEGORY_ORDER = [
    'zawiasy',
    'szuflady',
    'zawieszki',
    'polki_akcesoria',
    'drazki',
    'uchwyty',
    'wyposazenie',
    'zlewy',
];

const CATEGORY_LABELS: Record<string, string> = {
    zawiasy: 'Zawiasy',
    szuflady: 'Szuflady',
    zawieszki: 'Zawieszki',
    polki_akcesoria: 'Podpórki półek',
    drazki: 'Drążki',
    uchwyty: 'Uchwyty',
    wyposazenie: 'Wyposażenie',
    zlewy: 'Zlewy',
};

const TYPE_LABELS: Record<string, string> = {
    HINGE: 'Zawias',
    RAIL: 'Prowadnica',
    HANDLE: 'Uchwyt',
    HANGER: 'Zawieszka',
    SHELF_PIN: 'Podpórka',
    TUBE_SOCKET: 'Rozeta',
};

// ─── Operacje na kopii danych ────────────────────────────────────────────────

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function getAt(obj: any, path: PathSeg[]): any {
    let cur = obj;
    for (const key of path) {
        if (cur == null) return undefined;
        cur = cur[key];
    }
    return cur;
}

function setAt(obj: any, path: PathSeg[], value: any): any {
    if (path.length === 0) return value;
    const root = clone(obj);
    let cur = root;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (cur[key] == null || typeof cur[key] !== 'object') {
            cur[key] = typeof path[i + 1] === 'number' ? [] : {};
        }
        cur = cur[key];
    }
    cur[path[path.length - 1]] = value;
    return root;
}

function deleteAt(obj: any, path: PathSeg[]): any {
    if (path.length === 0) return obj;
    const root = clone(obj);
    let cur = root;
    for (let i = 0; i < path.length - 1; i++) {
        cur = cur?.[path[i]];
        if (cur == null || typeof cur !== 'object') return root;
    }
    delete cur[path[path.length - 1]];
    return root;
}

function fileNameOf(path: string): string {
    return path.replace(/^.*\//, '');
}

function categoryOf(path: string): string {
    return path.split('/')[0];
}

function displayNameOf(entry: HardwareFileEntry): string {
    return entry.data?.name || entry.data?.series || entry.data?.id || fileNameOf(entry.path);
}

// ─── Model sekcji machining ──────────────────────────────────────────────────

interface MachiningTarget {
    path: PathSeg[];
    label: string;
    machining: any;
}

function machiningTargets(data: any): MachiningTarget[] {
    const targets: MachiningTarget[] = [];
    if (data?.machining && typeof data.machining === 'object') {
        targets.push({ path: ['machining'], label: 'Okucie główne', machining: data.machining });
    }
    const variants = Array.isArray(data?.variants)
        ? data.variants
        : Array.isArray(data?.warianty)
            ? data.warianty
            : [];
    const variantsKey = Array.isArray(data?.variants) ? 'variants' : 'warianty';
    variants.forEach((variant: any, index: number) => {
        if (variant?.machining && typeof variant.machining === 'object') {
            targets.push({
                path: [variantsKey, index, 'machining'],
                label: variant.name || variant.nazwa || variant.id || variant.id_wariantu || `Wariant ${index + 1}`,
                machining: variant.machining,
            });
        }
    });
    return targets;
}

type HoleKind = 'front' | 'corpus' | 'side';

interface HoleGroup {
    id: string;
    label: string;
    path: PathSeg[];
    kind: HoleKind;
    holes: any[];
}

function holeGroups(machining: any): HoleGroup[] {
    const groups: HoleGroup[] = [];
    if (Array.isArray(machining?.front_holes)) {
        groups.push({ id: 'front_holes', label: 'Otwory we froncie', path: ['front_holes'], kind: 'front', holes: machining.front_holes });
    }
    if (Array.isArray(machining?.corpus_holes)) {
        groups.push({ id: 'corpus_holes', label: 'Otwory w korpusie', path: ['corpus_holes'], kind: 'corpus', holes: machining.corpus_holes });
    }
    if (Array.isArray(machining?.side_mount?.holes)) {
        groups.push({
            id: 'side_mount_holes',
            label: 'Otwory montażowe (bok)',
            path: ['side_mount', 'holes'],
            kind: 'side',
            holes: machining.side_mount.holes,
        });
    }
    return groups;
}

const HOLE_LABELS: Record<string, string> = {
    name: 'Nazwa',
    dia: 'Ø [mm]',
    depth: 'Głęb. [mm]',
    edge_dist: 'Od krawędzi [mm]',
    y_offset: 'Y offset [mm]',
    z_offset: 'Z offset [mm]',
    z_from_bottom: 'Z od dołu [mm]',
    front_dist: 'Od frontu [mm]',
    pos: 'Pozycja [x,y,z]',
    side: 'Strona',
    enabled: 'Aktywny',
};

const BASE_COLUMNS: Record<HoleKind, string[]> = {
    front: ['name', 'dia', 'depth', 'edge_dist', 'y_offset', 'z_from_bottom'],
    corpus: ['name', 'dia', 'depth', 'front_dist', 'z_offset', 'z_from_bottom'],
    side: ['name', 'dia', 'depth', 'pos'],
};

// „object” to zawsze cylinder — nie pokazujemy go w tabeli.
const HIDDEN_HOLE_COLUMNS = new Set(['object']);

const NEW_HOLE: Record<HoleKind, any> = {
    front: { name: 'Nowy_otwor', dia: 3, depth: 10, edge_dist: 31 },
    corpus: { name: 'Nowy_otwor', dia: 5, depth: 12, front_dist: 37 },
    side: { name: 'Nowy_otwor', dia: 3.5, depth: 12, pos: [0, 0, 0] },
};

function columnsFor(kind: HoleKind, rows: any[]): string[] {
    const columns = [...BASE_COLUMNS[kind]];
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        for (const key of Object.keys(row)) {
            if (!columns.includes(key) && !HIDDEN_HOLE_COLUMNS.has(key)) columns.push(key);
        }
    }
    return columns;
}

function isNumericColumn(rows: any[], key: string): boolean {
    return rows.some((row) => typeof row?.[key] === 'number');
}

// ─── Komponenty pól ─────────────────────────────────────────────────────────

function CoordsInput({
    value,
    onCommit,
}: {
    value: any;
    onCommit: (next: number[]) => void;
}) {
    const external = Array.isArray(value) ? value.join(', ') : '';
    const [text, setText] = useState(external);
    useEffect(() => setText(external), [external]);

    const commit = () => {
        const parsed = text
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
            .map(Number)
            .filter((num) => Number.isFinite(num));
        onCommit(parsed);
    };

    return (
        <input
            style={{ ...inputStyle, fontFamily: 'Consolas, monospace' }}
            value={text}
            placeholder="x, y, z"
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
        />
    );
}

/**
 * Uniwersalny edytor wartości pola: tekst, liczba, boolean, tablica, obiekt.
 * Wartość zatwierdzana przy opuszczeniu pola (mniej skoków kursora).
 */
function ValueInput({
    value,
    onCommit,
    placeholder,
}: {
    value: any;
    onCommit: (next: any) => void;
    placeholder?: string;
}) {
    if (typeof value === 'boolean') {
        return (
            <input
                type="checkbox"
                checked={value}
                onChange={(e) => onCommit(e.target.checked)}
            />
        );
    }

    const isArray = Array.isArray(value);
    const isObject = value !== null && typeof value === 'object' && !isArray;
    const external = isArray
        ? value.join(', ')
        : isObject
            ? JSON.stringify(value)
            : value === undefined || value === null
                ? ''
                : String(value);

    const [text, setText] = useState(external);
    useEffect(() => setText(external), [external]);

    const commit = () => {
        const trimmed = text.trim();
        if (isObject) {
            if (!trimmed) {
                onCommit(undefined);
                return;
            }
            try {
                onCommit(JSON.parse(trimmed));
            } catch {
                setText(external); // nie psujemy danych błędnym JSON-em
            }
            return;
        }
        if (isArray) {
            const parts = trimmed ? trimmed.split(',').map((p) => p.trim()).filter(Boolean) : [];
            const numeric = parts.every((p) => Number.isFinite(Number(p)));
            onCommit(numeric ? parts.map(Number) : parts);
            return;
        }
        if (typeof value === 'number') {
            if (!trimmed) {
                onCommit(undefined);
                return;
            }
            const num = Number(trimmed.replace(',', '.'));
            onCommit(Number.isFinite(num) ? num : value);
            return;
        }
        onCommit(text);
    };

    return (
        <input
            style={inputStyle}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
        />
    );
}

// ─── Główny edytor ──────────────────────────────────────────────────────────

export function WierceniaEditor() {
    const [files, setFiles] = useState<HardwareFileEntry[] | null>(null);
    const [drafts, setDrafts] = useState<Record<string, any>>({});
    const [baselines, setBaselines] = useState<Record<string, string>>({});
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [category, setCategory] = useState<string>('zawiasy');
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<Tab>('holes');
    const [targetIndex, setTargetIndex] = useState(0);
    const [jsonText, setJsonText] = useState('{}');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState(false);
    const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            const loaded = await fetchHardwareFiles();
            if (!alive) return;
            if (!loaded || loaded.length === 0) {
                setFiles([]);
                setServerAvailable(false);
                setStatus({
                    kind: 'info',
                    text: 'Brak połączenia z dev-serwerem. Uruchom start.bat (Vite), aby edytować i zapisywać pliki B1_biblioteka. Bez serwera możesz tylko przeglądać/pobrać dane.',
                });
                return;
            }
            const nextDrafts: Record<string, any> = {};
            const nextBaselines: Record<string, string> = {};
            for (const entry of loaded) {
                nextDrafts[entry.path] = entry.data;
                nextBaselines[entry.path] = JSON.stringify(entry.data);
            }
            setFiles(loaded);
            setDrafts(nextDrafts);
            setBaselines(nextBaselines);
            setServerAvailable(true);
            const preferred = loaded.find((f) => f.path.startsWith('zawiasy/')) || loaded[0];
            setSelectedPath(preferred.path);
            setCategory(categoryOf(preferred.path));
        })();
        return () => {
            alive = false;
        };
    }, []);

    const currentData = selectedPath ? drafts[selectedPath] : null;

    const dirtyPaths = useMemo(
        () => Object.keys(drafts).filter((path) => JSON.stringify(drafts[path]) !== baselines[path]),
        [drafts, baselines]
    );

    const dirty = !!selectedPath && dirtyPaths.includes(selectedPath);

    useEffect(() => {
        setTargetIndex(0);
        setTab('holes');
        setStatus(null);
    }, [selectedPath]);

    useEffect(() => {
        if (tab !== 'json') return;
        setJsonText(currentData ? JSON.stringify(currentData, null, 2) : '{}');
        setJsonError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPath, tab]);

    const updateCurrent = (next: any) => {
        if (!selectedPath) return;
        setDrafts((prev) => ({ ...prev, [selectedPath]: next }));
    };

    const updateAt = (path: PathSeg[], value: any) => {
        if (!currentData) return;
        updateCurrent(value === undefined ? deleteAt(currentData, path) : setAt(currentData, path, value));
    };

    const updateField = (prefix: PathSeg[], key: string | number, value: any) => {
        updateAt([...prefix, key], value);
    };

    // ─── Lista plików ───────────────────────────────────────────────────────

    const categories = useMemo(() => {
        const present = new Set((files || []).map((f) => categoryOf(f.path)));
        const ordered = CATEGORY_ORDER.filter((cat) => present.has(cat));
        const extra = Array.from(present).filter((cat) => !CATEGORY_ORDER.includes(cat)).sort();
        return [...ordered, ...extra];
    }, [files]);

    useEffect(() => {
        if (!files || files.length === 0) return;
        if (categories.includes(category)) return;
        setCategory(categories[0] || 'zawiasy');
    }, [categories, category, files]);

    const visibleItems = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return (files || []).filter((entry) => {
            if (categoryOf(entry.path) !== category) return false;
            if (!needle) return true;
            const haystack = [
                entry.path,
                entry.data?.id,
                entry.data?.name,
                entry.data?.brand,
                entry.data?.series,
                entry.data?.type,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(needle);
        });
    }, [files, category, search]);

    // ─── Zapis / pobieranie ─────────────────────────────────────────────────

    const savePaths = async (paths: string[]) => {
        if (!paths.length) return;
        setBusy(true);
        const payload = paths.map((path) => ({ path, data: drafts[path] }));
        const result = await saveHardwareFiles(payload);
        setBusy(false);
        if (!result.ok) {
            setStatus({
                kind: 'err',
                text: `Nie udało się zapisać: ${result.error || 'brak serwera'}. Użyj „Pobierz JSON” i podmień plik ręcznie.`,
            });
            return;
        }
        setServerAvailable(true);
        setBaselines((prev) => {
            const next = { ...prev };
            for (const path of paths) next[path] = JSON.stringify(drafts[path]);
            return next;
        });
        if (result.vaultUpdated === false) {
            setStatus({
                kind: 'info',
                text: `Zapisano ${paths.length} plik(ów), ale nie udało się odświeżyć reguł CAD: ${result.vaultError || 'nieznany błąd'}. Uruchom „npm run build:vault”.`,
            });
        } else {
            setStatus({
                kind: 'ok',
                text: `Zapisano ${paths.length} plik(ów) i odświeżono reguły CAD. Kopia poprzedniej wersji: *.backup.json.`,
            });
        }
    };

    const saveCurrent = () => {
        if (selectedPath) savePaths([selectedPath]);
    };

    const saveAll = () => {
        if (dirtyPaths.length) savePaths(dirtyPaths);
    };

    const downloadCurrent = () => {
        if (!selectedPath || !currentData) return;
        const blob = new Blob([JSON.stringify(currentData, null, 2) + '\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileNameOf(selectedPath);
        anchor.click();
        URL.revokeObjectURL(url);
        setStatus({ kind: 'info', text: `Pobrano ${fileNameOf(selectedPath)} — podmień plik w B1_biblioteka/${selectedPath.split('/').slice(0, -1).join('/')}/.` });
    };

    const resetCurrent = () => {
        if (!selectedPath || !baselines[selectedPath]) return;
        try {
            const restored = JSON.parse(baselines[selectedPath]);
            setDrafts((prev) => ({ ...prev, [selectedPath]: restored }));
            setStatus({ kind: 'info', text: 'Przywrócono ostatnio wczytaną/zapisaną wersję tego pliku.' });
        } catch {
            /* ignore */
        }
    };

    // ─── Widok pozycji ──────────────────────────────────────────────────────

    const targets = useMemo(() => (currentData ? machiningTargets(currentData) : []), [currentData]);
    const activeTarget = targets[Math.min(targetIndex, Math.max(targets.length - 1, 0))];
    const groups = activeTarget ? holeGroups(activeTarget.machining) : [];
    const holeCount = targets.reduce(
        (sum, target) => sum + (Array.isArray(target.machining?.front_holes) ? target.machining.front_holes.length : 0)
            + (Array.isArray(target.machining?.corpus_holes) ? target.machining.corpus_holes.length : 0)
            + (Array.isArray(target.machining?.side_mount?.holes) ? target.machining.side_mount.holes.length : 0),
        0
    );

    const activeVariantPath = activeTarget ? activeTarget.path.slice(0, -1) : null;
    const activeLengths = currentData && activeVariantPath
        ? getAt(currentData, [...activeVariantPath, 'lengths'])
        : undefined;
    const hasLengths = !!currentData && targets.some((target) => {
        const lengths = getAt(currentData, [...target.path.slice(0, -1), 'lengths']);
        return !!lengths && typeof lengths === 'object' && !Array.isArray(lengths) && Object.keys(lengths).length > 0;
    });

    const selectedEntry = (files || []).find((entry) => entry.path === selectedPath) || null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Wiercenia — edytor okuć</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                    Źródło: <code>B1_biblioteka/</code>
                    {serverAvailable === false && ' · brak dev-serwera (tylko podgląd)'}
                </div>
                <div style={{ flex: 1 }} />
                {dirtyPaths.length > 0 && (
                    <span style={{ fontSize: 12, color: '#d97706' }}>● niezapisane: {dirtyPaths.length}</span>
                )}
                <button style={btnStyle} disabled={!selectedPath || !dirty} onClick={resetCurrent}>Przywróć</button>
                <button style={btnStyle} disabled={!selectedPath} onClick={downloadCurrent}>Pobierz JSON</button>
                <button style={{ ...btnStyle, ...primaryBtnStyle }} disabled={busy || !dirty} onClick={saveCurrent}>
                    {busy ? 'Zapisywanie…' : 'Zapisz'}
                </button>
                <button style={{ ...btnStyle, ...primaryBtnStyle }} disabled={busy || dirtyPaths.length === 0} onClick={saveAll}>
                    Zapisz wszystko ({dirtyPaths.length})
                </button>
            </div>

            <div style={{ display: 'flex', gap: 4, padding: '8px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexWrap: 'wrap' }}>
                {categories.map((cat) => {
                    const count = (files || []).filter((entry) => categoryOf(entry.path) === cat).length;
                    return (
                        <button
                            key={cat}
                            style={{ ...tabStyle, ...(category === cat ? tabActiveStyle : {}) }}
                            onClick={() => setCategory(cat)}
                        >
                            {CATEGORY_LABELS[cat] || cat}
                            <span style={countBadgeStyle}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {status && (
                <div style={{ padding: '8px 18px', fontSize: 13, color: STATUS_COLORS[status.kind], borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {status.text}
                </div>
            )}

            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                {/* Lista okuć */}
                <div style={{ width: 300, borderRight: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ padding: 10 }}>
                        <input
                            style={inputStyle}
                            value={search}
                            placeholder="Szukaj: nazwa, id, producent…"
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 12px' }}>
                        {visibleItems.map((entry) => {
                            const active = entry.path === selectedPath;
                            const itemDirty = dirtyPaths.includes(entry.path);
                            return (
                                <button
                                    key={entry.path}
                                    onClick={() => setSelectedPath(entry.path)}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 10px',
                                        marginBottom: 4,
                                        borderRadius: 6,
                                        border: `1px solid ${active ? 'rgba(37,99,235,0.45)' : 'transparent'}`,
                                        background: active ? 'rgba(37,99,235,0.08)' : 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: '#1e293b', display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayNameOf(entry)}</span>
                                        {itemDirty && <span style={{ color: '#d97706' }}>●</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        <span>{entry.data?.id || fileNameOf(entry.path)}</span>
                                        {entry.data?.brand && <span>· {entry.data.brand}</span>}
                                        {entry.data?.type && <span>· {TYPE_LABELS[entry.data.type] || entry.data.type}</span>}
                                    </div>
                                </button>
                            );
                        })}
                        {files === null && <div style={{ fontSize: 12, color: '#64748b', padding: 8 }}>Wczytywanie…</div>}
                        {files !== null && visibleItems.length === 0 && (
                            <div style={{ fontSize: 12, color: '#64748b', padding: 8 }}>Brak pozycji w tej kategorii.</div>
                        )}
                    </div>
                </div>

                {/* Szczegóły */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    {!selectedPath || !currentData ? (
                        <div style={{ padding: 24, color: '#64748b', fontSize: 13 }}>
                            {serverAvailable === false
                                ? 'Uruchom start.bat, aby edytor wczytał listy wierceń z B1_biblioteka.'
                                : 'Wybierz okucie z listy po lewej stronie.'}
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: '12px 18px 6px', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 15, fontWeight: 700 }}>{displayNameOf(selectedEntry || { path: selectedPath, data: currentData })}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>
                                    <code>{selectedPath}</code>
                                    {currentData.type && <> · {TYPE_LABELS[currentData.type] || currentData.type}</>}
                                    {' · '}{holeCount} otworów
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 4, padding: '6px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexWrap: 'wrap' }}>
                                <button style={{ ...tabStyle, ...(tab === 'holes' ? tabActiveStyle : {}) }} onClick={() => setTab('holes')}>
                                    Wiercenia
                                </button>
                                {hasLengths && (
                                    <button style={{ ...tabStyle, ...(tab === 'lengths' ? tabActiveStyle : {}) }} onClick={() => setTab('lengths')}>
                                        Prowadnice
                                    </button>
                                )}
                                <button style={{ ...tabStyle, ...(tab === 'fields' ? tabActiveStyle : {}) }} onClick={() => setTab('fields')}>
                                    Pola / montaż
                                </button>
                                <button style={{ ...tabStyle, ...(tab === 'json' ? tabActiveStyle : {}) }} onClick={() => setTab('json')}>
                                    JSON (pełna kontrola)
                                </button>
                            </div>

                            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 18px 24px' }}>
                                {tab === 'holes' && (
                                    <HolesTab
                                        targets={targets}
                                        targetIndex={targetIndex}
                                        onTargetChange={setTargetIndex}
                                        activeTarget={activeTarget}
                                        groups={groups}
                                        onGroupChange={(group, rows) => {
                                            if (!activeTarget) return;
                                            updateCurrent(setAt(currentData, [...activeTarget.path, ...group.path], rows));
                                        }}
                                        onFormulaChange={(key, value) => {
                                            if (!activeTarget) return;
                                            updateField(activeTarget.path, key, value);
                                        }}
                                    />
                                )}

                                {tab === 'lengths' && (
                                    <LengthsTab
                                        targets={targets}
                                        targetIndex={targetIndex}
                                        onTargetChange={setTargetIndex}
                                        activeTarget={activeTarget}
                                        lengths={activeLengths}
                                        lengthsPath={activeVariantPath ? [...activeVariantPath, 'lengths'] : []}
                                        onPatch={updateAt}
                                    />
                                )}

                                {tab === 'fields' && (
                                    <FieldsTab data={currentData} onChangeField={updateField} />
                                )}

                                {tab === 'json' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                            Edytujesz cały plik. Po poprawnej zmianie dane trafiają do szkicu — zapisz przyciskiem u góry.
                                        </div>
                                        {jsonError && <div style={{ color: '#dc2626', fontSize: 13 }}>Błąd JSON: {jsonError}</div>}
                                        <textarea
                                            spellCheck={false}
                                            value={jsonText}
                                            onChange={(e) => {
                                                const text = e.target.value;
                                                setJsonText(text);
                                                try {
                                                    const parsed = JSON.parse(text);
                                                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                                                        throw new Error('Główny element musi być obiektem.');
                                                    }
                                                    updateCurrent(parsed);
                                                    setJsonError(null);
                                                } catch (err: any) {
                                                    setJsonError(String(err?.message || err));
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                minHeight: 420,
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
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Zakładka „Prowadnice” (szuflady) ───────────────────────────────────────

function LengthsTab({
    targets,
    targetIndex,
    onTargetChange,
    activeTarget,
    lengths,
    lengthsPath,
    onPatch,
}: {
    targets: MachiningTarget[];
    targetIndex: number;
    onTargetChange: (index: number) => void;
    activeTarget: MachiningTarget | undefined;
    lengths: any;
    lengthsPath: PathSeg[];
    onPatch: (path: PathSeg[], value: any) => void;
}) {
    const [newLength, setNewLength] = useState('');

    if (targets.length === 0) {
        return (
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                Ten plik nie ma wariantów z tabelą długości.
            </div>
        );
    }

    const isVariantTarget = !!activeTarget && activeTarget.path.length >= 3 && activeTarget.path[0] === 'variants';
    if (!isVariantTarget) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                    Tabela prowadnic jest dostępna dla wariantów szuflad. Wybierz wariant poniżej.
                </div>
                <select
                    style={{ ...inputStyle, width: 320 }}
                    value={Math.min(targetIndex, targets.length - 1)}
                    onChange={(e) => onTargetChange(Number(e.target.value))}
                >
                    {targets.map((target, index) => (
                        <option key={index} value={index}>{target.label}</option>
                    ))}
                </select>
            </div>
        );
    }

    const rows = lengths && typeof lengths === 'object' && !Array.isArray(lengths)
        ? Object.keys(lengths)
            .filter((key) => lengths[key] && typeof lengths[key] === 'object')
            .sort((a, b) => Number(a) - Number(b))
        : [];
    // Zawsze pokazujemy O1–O5; O5 jest zapasowy (puste pole = brak otworu).
    const holeCount = Math.max(5, ...rows.map((key) => (Array.isArray(lengths[key]?.x_positions) ? lengths[key].x_positions.length : 0)));

    const isHoleEnabled = (key: string, index: number): boolean => {
        const flags = lengths[key]?.holes_enabled;
        return !Array.isArray(flags) || flags[index] !== false;
    };

    const toggleHole = (key: string, index: number, enabled: boolean) => {
        const flags = Array.isArray(lengths[key]?.holes_enabled) ? lengths[key].holes_enabled : [];
        const positions = Array.isArray(lengths[key]?.x_positions) ? lengths[key].x_positions : [];
        // Zapisujemy jawną flagę true/false dla każdego otworu (O1–O5).
        const count = Math.max(holeCount, flags.length, positions.length, index + 1);
        const next = Array.from({ length: count }, (_, i) => flags[i] !== false);
        next[index] = enabled;
        onPatch([...lengthsPath, key, 'holes_enabled'], next);
    };

    const patchX = (key: string, index: number, value: any) => {
        const current = Array.isArray(lengths[key]?.x_positions) ? [...lengths[key].x_positions] : [];
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
            // Wyczyszczenie ostatniego pola (np. O5) usuwa zbędną pozycję.
            if (current.length > 1 && index === current.length - 1) {
                current.pop();
                onPatch([...lengthsPath, key, 'x_positions'], current);
            }
            return;
        }
        while (current.length <= index) current.push(0);
        current[index] = numeric;
        onPatch([...lengthsPath, key, 'x_positions'], current);
    };

    const addLength = () => {
        const key = newLength.trim().replace(',', '.');
        if (!/^\d+(\.\d+)?$/.test(key) || lengths?.[key]) return;
        const templateKey = rows[0];
        const template = templateKey
            ? clone(lengths[templateKey])
            : { z_offset: 54, x_positions: [37, 69, 197, 229] };
        onPatch([...lengthsPath, key], template);
        setNewLength('');
    };

    const removeLength = (key: string) => {
        if (!window.confirm(`Usunąć długość ${key} mm?`)) return;
        onPatch([...lengthsPath, key], undefined);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {targets.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, color: '#64748b' }}>Wariant / zestaw:</label>
                    <select
                        style={{ ...inputStyle, width: 320 }}
                        value={Math.min(targetIndex, targets.length - 1)}
                        onChange={(e) => onTargetChange(Number(e.target.value))}
                    >
                        {targets.map((target, index) => (
                            <option key={index} value={index}>{target.label}</option>
                        ))}
                    </select>
                </div>
            )}

            <div style={{ fontSize: 12, color: '#64748b', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.6 }}>
                <strong>Jak czytać tabelę:</strong> jeden wiersz = jedna długość prowadnicy.
                {' '}<strong>Wysokość rzędu</strong> liczona jest od dołu szuflady (np. Merivo: 54 mm),
                a <strong>O1–O5</strong> to odległości otworów od krawędzi frontu boku (O5 zapasowy).
                {' '}Przy każdym otworze (także pustym O5) jest flaga <strong>true/false</strong> — odznaczenie
                <strong> wyłącza wiercenie</strong>, ale zostawia pozycję w tabeli.
                {' '}Zmiany trafiają bezpośrednio do wiercenia (<code>x_positions</code> / <code>z_offset</code>).
            </div>

            <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#ffffff', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Prowadnice — {activeTarget?.label || 'wariant'}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{rows.length} długości · {holeCount} otworów w rzędzie</div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <input
                        style={{ ...inputStyle, width: 120 }}
                        value={newLength}
                        placeholder="np. 350"
                        onChange={(e) => setNewLength(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') addLength();
                        }}
                    />
                    <button style={btnStyle} onClick={addLength}>+ Długość</button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
                                <th style={{ ...thStyle, width: 110 }}>Długość [mm]</th>
                                <th style={{ ...thStyle, minWidth: 130 }}>Wysokość rzędu od dołu [mm]</th>
                                {Array.from({ length: holeCount }, (_, index) => (
                                    <th key={index} style={{ ...thStyle, minWidth: 76 }} title="Odległość od frontu boku">O{index + 1} [mm]</th>
                                ))}
                                <th style={{ ...thStyle, width: 46 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((key) => (
                                <tr key={key} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{key}</td>
                                    <td style={tdStyle}>
                                        <ValueInput
                                            value={typeof lengths[key]?.z_offset === 'number' ? lengths[key].z_offset : undefined}
                                            onCommit={(value) => {
                                                if (typeof value === 'number' && Number.isFinite(value)) {
                                                    onPatch([...lengthsPath, key, 'z_offset'], value);
                                                }
                                            }}
                                            placeholder="—"
                                        />
                                    </td>
                                    {Array.from({ length: holeCount }, (_, index) => {
                                        const value = lengths[key]?.x_positions?.[index];
                                        const hasValue = typeof value === 'number';
                                        const enabled = isHoleEnabled(key, index);
                                        return (
                                            <td key={index} style={tdStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={enabled}
                                                        title={enabled ? 'Otwór aktywny — kliknij, aby wyłączyć' : 'Otwór wyłączony — kliknij, aby włączyć'}
                                                        onChange={(e) => toggleHole(key, index, e.target.checked)}
                                                        style={{ accentColor: '#2563eb', cursor: 'pointer', margin: 0 }}
                                                    />
                                                    <div style={{ flex: 1, minWidth: 0, opacity: hasValue && !enabled ? 0.4 : 1 }}>
                                                        <ValueInput
                                                            value={hasValue ? value : undefined}
                                                            onCommit={(next) => patchX(key, index, next)}
                                                            placeholder="—"
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <button style={dangerBtnStyle} title="Usuń długość" onClick={() => removeLength(key)}>✕</button>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={holeCount + 3} style={{ ...tdStyle, color: '#64748b' }}>
                                        Ten wariant nie ma jeszcze tabeli długości. Dodaj pierwszą długość powyżej.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Zakładka „Wiercenia” ───────────────────────────────────────────────────

function HolesTab({
    targets,
    targetIndex,
    onTargetChange,
    activeTarget,
    groups,
    onGroupChange,
    onFormulaChange,
}: {
    targets: MachiningTarget[];
    targetIndex: number;
    onTargetChange: (index: number) => void;
    activeTarget: MachiningTarget | undefined;
    groups: HoleGroup[];
    onGroupChange: (group: HoleGroup, rows: any[]) => void;
    onFormulaChange: (key: string, value: any) => void;
}) {
    if (targets.length === 0) {
        return (
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                Ten plik nie ma sekcji <code>machining</code> z listą otworów.
                <br />
                Użyj zakładki <strong>JSON (pełna kontrola)</strong>, aby dodać ją ręcznie, albo wybierz inne okucie.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {targets.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 12, color: '#64748b' }}>Wariant / zestaw:</label>
                    <select
                        style={{ ...inputStyle, width: 320 }}
                        value={Math.min(targetIndex, targets.length - 1)}
                        onChange={(e) => onTargetChange(Number(e.target.value))}
                    >
                        {targets.map((target, index) => (
                            <option key={index} value={index}>{target.label}</option>
                        ))}
                    </select>
                </div>
            )}

            <div style={{ fontSize: 12, color: '#64748b', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 8, padding: '8px 10px', lineHeight: 1.6 }}>
                <strong>Jak czytać kolumny:</strong> <code>dia</code> = średnica wiertła, <code>depth</code> = głębokość,
                {' '}<code>edge_dist</code> = odległość od krawędzi frontu, <code>front_dist</code> = odległość od frontu korpusu,
                {' '}<code>z_from_bottom</code> = wysokość od dolnej krawędzi. Wartości w milimetrach (mm).
                {' '}Przy szufladach: <code>side</code> = L/P (lewa/prawa strona), <code>enabled</code> = czy otwór jest wiercony.
            </div>

            {groups.map((group) => (
                <HoleTable
                    key={group.id}
                    group={group}
                    onChange={(rows) => onGroupChange(group, rows)}
                />
            ))}

            {activeTarget && (activeTarget.machining?.front_holes_formula !== undefined
                || activeTarget.machining?.front_edge_formula !== undefined
                || activeTarget.machining?.front_edge_offset_base !== undefined) && (
                <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: 12, background: '#ffffff' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Formuły (zaawansowane)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 8, alignItems: 'center', maxWidth: 720 }}>
                        {['front_holes_formula', 'front_edge_formula', 'front_edge_offset_base'].map((key) => {
                            const value = activeTarget.machining?.[key];
                            if (value === undefined) return null;
                            return (
                                <React.Fragment key={key}>
                                    <label style={{ fontSize: 12, color: '#64748b' }}><code>{key}</code></label>
                                    <ValueInput value={value} onCommit={(next) => onFormulaChange(key, next)} />
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function HoleTable({ group, onChange }: { group: HoleGroup; onChange: (rows: any[]) => void }) {
    const rows = group.holes;
    const columns = columnsFor(group.kind, rows);

    const patchRow = (index: number, key: string, value: any) => {
        const next = rows.map((row, rowIndex) => (rowIndex === index ? patchValue(row, key, value) : row));
        onChange(next);
    };

    const removeRow = (index: number) => {
        onChange(rows.filter((_, rowIndex) => rowIndex !== index));
    };

    const addRow = () => {
        const base = clone(NEW_HOLE[group.kind]);
        if (rows.length > 0) {
            for (const key of Object.keys(rows[0] || {})) {
                if (base[key] === undefined && typeof rows[0][key] !== 'object') base[key] = rows[0][key];
            }
        }
        onChange([...rows, base]);
    };

    return (
        <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#ffffff', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{group.label}</div>
                <span style={countBadgeStyle}>{rows.length}</span>
                <div style={{ flex: 1 }} />
                <button style={btnStyle} onClick={addRow}>+ Dodaj otwór</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
                            <th style={{ ...thStyle, width: 34 }}>#</th>
                            {columns.map((key) => (
                                <th key={key} style={thStyle}>{HOLE_LABELS[key] || key}</th>
                            ))}
                            <th style={{ ...thStyle, width: 46 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={rowIndex} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                <td style={{ ...tdStyle, color: '#94a3b8', textAlign: 'center' }}>{rowIndex + 1}</td>
                                {columns.map((key) => (
                                    <td key={key} style={{ ...tdStyle, minWidth: key === 'name' || key === 'object' ? 170 : key === 'pos' ? 120 : 88 }}>
                                        <HoleCell
                                            keyName={key}
                                            row={row}
                                            rows={rows}
                                            onChange={(value) => patchRow(rowIndex, key, value)}
                                        />
                                    </td>
                                ))}
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <button style={dangerBtnStyle} title="Usuń otwór" onClick={() => removeRow(rowIndex)}>✕</button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={columns.length + 2} style={{ ...tdStyle, color: '#64748b' }}>
                                    Brak otworów w tej grupie. Kliknij „+ Dodaj otwór”.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function patchValue(row: any, key: string, value: any): any {
    const next = { ...row };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return next;
}

function HoleCell({
    keyName,
    row,
    rows,
    onChange,
}: {
    keyName: string;
    row: any;
    rows: any[];
    onChange: (value: any) => void;
}) {
    const value = row?.[keyName];

    if (keyName === 'pos') {
        return <CoordsInput value={value} onCommit={onChange} />;
    }
    if (keyName === 'side') {
        return (
            <select
                style={inputStyle}
                value={value === 'L' || value === 'R' ? value : ''}
                onChange={(e) => onChange(e.target.value || undefined)}
            >
                <option value="">L + P</option>
                <option value="L">Lewa (L)</option>
                <option value="R">Prawa (P)</option>
            </select>
        );
    }
    if (keyName === 'enabled') {
        return (
            <input
                type="checkbox"
                checked={value !== false}
                title="Czy wiercić ten otwór"
                onChange={(e) => onChange(e.target.checked)}
            />
        );
    }
    if (keyName === 'name' || keyName === 'object' || typeof value === 'string') {
        return <ValueInput value={typeof value === 'string' ? value : ''} onCommit={onChange} placeholder="—" />;
    }
    if (typeof value === 'number' || isNumericColumn(rows, keyName)) {
        return <ValueInput value={typeof value === 'number' ? value : undefined} onCommit={onChange} placeholder="—" />;
    }
    if (value && typeof value === 'object') {
        return <ValueInput value={value} onCommit={onChange} placeholder="—" />;
    }
    return <ValueInput value={value} onCommit={onChange} placeholder="—" />;
}

// ─── Zakładka „Pola / montaż” ───────────────────────────────────────────────

const TOP_FIELDS = [
    'id',
    'name',
    'brand',
    'series',
    'type',
    'units',
    'construction',
    'price_id',
    'art_no',
    'machining_template_id',
    'mount_type',
];

const GROUP_FIELDS = ['mount', 'drill', 'dimensions', 'panels', 'visual', 'front_holes'];

function FieldsTab({
    data,
    onChangeField,
}: {
    data: any;
    onChangeField: (prefix: PathSeg[], key: string, value: any) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#ffffff', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13, fontWeight: 700 }}>
                    Dane podstawowe
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                        {TOP_FIELDS.map((key) => {
                            const value = data?.[key];
                            if (value === undefined) return null;
                            return (
                                <tr key={key} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                    <td style={{ ...tdStyle, width: 220, color: '#64748b' }}><code>{key}</code></td>
                                    <td style={tdStyle}>
                                        <ValueInput value={value} onCommit={(next) => onChangeField([], key, next)} />
                                    </td>
                                </tr>
                            );
                        })}
                        <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            <td style={{ ...tdStyle, width: 220, color: '#64748b' }}><code>usable_in</code></td>
                            <td style={tdStyle}>
                                <ValueInput
                                    value={data?.usable_in}
                                    onCommit={(next) => onChangeField([], 'usable_in', next)}
                                    placeholder="np. DOORS, FLAPS"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {GROUP_FIELDS.map((groupKey) => {
                const group = data?.[groupKey];
                if (!group || typeof group !== 'object' || Array.isArray(group)) return null;
                return (
                    <div key={groupKey} style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, background: '#ffffff', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13, fontWeight: 700 }}>
                            <code>{groupKey}</code>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <tbody>
                                {Object.entries(group).map(([key, value]) => (
                                    <tr key={key} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                        <td style={{ ...tdStyle, width: 220, color: '#64748b' }}><code>{key}</code></td>
                                        <td style={tdStyle}>
                                            <ValueInput value={value} onCommit={(next) => onChangeField([groupKey], key, next)} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Style ──────────────────────────────────────────────────────────────────

const btnStyle: CSSProperties = {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid rgba(0,0,0,0.15)',
    background: 'rgba(0,0,0,0.03)',
    color: '#1e293b',
    cursor: 'pointer',
    fontSize: 13,
};

const primaryBtnStyle: CSSProperties = {
    background: '#2563eb',
    border: '1px solid #2563eb',
    color: '#ffffff',
    fontWeight: 600,
};

const dangerBtnStyle: CSSProperties = {
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid rgba(248,113,113,0.4)',
    background: 'rgba(248,113,113,0.1)',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: 12,
};

const tabStyle: CSSProperties = {
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

const tabActiveStyle: CSSProperties = {
    background: 'rgba(37,99,235,0.10)',
    border: '1px solid rgba(37,99,235,0.45)',
    color: '#1e293b',
    fontWeight: 600,
};

const countBadgeStyle: CSSProperties = {
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 10,
    background: 'rgba(0,0,0,0.08)',
    color: '#475569',
};

const thStyle: CSSProperties = { padding: '8px 6px', fontWeight: 600 };

const tdStyle: CSSProperties = { padding: '4px 6px' };

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid rgba(0,0,0,0.15)',
    background: '#ffffff',
    color: '#1e293b',
    fontSize: 13,
};
