import React, { useState, useMemo, useEffect } from 'react';
import './smartparts-ui.css';
import {
    SMARTPART_SECTIONS,
    HANDLE_FILTER_NONE,
    HOOK_TYPE_FILTERS,
    HOOK_PRODUCER_FILTERS,
    HOOK_MODEL_FILTERS,
    LIGHT_TYPE_FILTERS,
    LIGHT_PRODUCER_FILTERS,
    SWITCH_TYPE_FILTERS,
    SWITCH_PRODUCER_FILTERS,
    SWITCH_MODEL_FILTERS,
    filterHangerCatalog,
    filterHookCatalog,
    filterLightCatalog,
    filterSwitchCatalog,
    hangerItemToTemplate,
    type SmartPartSection,
    type HangerCatalogItem,
} from './smartparts-catalog.js';
import { HangerDragController } from './hangers/hanger-controller.js';
import { getModuleOpenHandler } from '../A1_core/module-open-port.js';
import {
    deleteHangerFromLibrary,
    subscribeHangerLibrarySync,
} from './hangers/hanger-library-sync.js';
import { HandleCatalogBrowser } from '../A2_bloki/handles/handle-catalog-browser.js';

export function SmartPartsUI(): React.JSX.Element {
    const [section, setSection] = useState<SmartPartSection>('HANDLES');

    const [hangerSearch, setHangerSearch] = useState('');
    const [selectedHangerId, setSelectedHangerId] = useState<string | null>(null);
    const [hangerCatalogTick, setHangerCatalogTick] = useState(0);

    useEffect(() => {
        // Dysk B1 ↔ localStorage Studio — focus okna + eventy odświeżają listę
        return subscribeHangerLibrarySync(() => setHangerCatalogTick((n) => n + 1));
    }, []);

    const [hookTypeFilter, setHookTypeFilter] = useState<string>(HANDLE_FILTER_NONE);
    const [hookProducerFilter, setHookProducerFilter] = useState<string>(HANDLE_FILTER_NONE);
    const [hookModelFilter, setHookModelFilter] = useState<string>(HANDLE_FILTER_NONE);
    const [hookSearch, setHookSearch] = useState('');
    const [selectedHookId, setSelectedHookId] = useState<string | null>(null);

    const [lightTypeFilter, setLightTypeFilter] = useState<string>(HANDLE_FILTER_NONE);
    const [lightProducerFilter, setLightProducerFilter] = useState<string>(HANDLE_FILTER_NONE);
    const [lightSearch, setLightSearch] = useState('');
    const [selectedLightId, setSelectedLightId] = useState<string | null>(null);

    const [switchTypeFilter, setSwitchTypeFilter] = useState<string>(HANDLE_FILTER_NONE);
    const [switchProducerFilter, setSwitchProducerFilter] = useState<string>(HANDLE_FILTER_NONE);
    const [switchModelFilter, setSwitchModelFilter] = useState<string>(HANDLE_FILTER_NONE);
    const [switchSearch, setSwitchSearch] = useState('');
    const [selectedSwitchId, setSelectedSwitchId] = useState<string | null>(null);

    const hangerItems = useMemo(
        () => filterHangerCatalog({ searchQuery: hangerSearch }),
        [hangerSearch, hangerCatalogTick],
    );
    const hookItems = filterHookCatalog({
        hookKind: hookTypeFilter,
        producer: hookProducerFilter,
        model: hookModelFilter,
        searchQuery: hookSearch,
    });
    const lightItems = filterLightCatalog({
        lightKind: lightTypeFilter,
        producer: lightProducerFilter,
        searchQuery: lightSearch,
    });
    const switchItems = filterSwitchCatalog({
        switchKind: switchTypeFilter,
        producer: switchProducerFilter,
        model: switchModelFilter,
        searchQuery: switchSearch,
    });

    const startHangerDrag = (e: React.DragEvent, item: HangerCatalogItem) => {
        const template = hangerItemToTemplate(item);
        try {
            e.dataTransfer.setData('application/smartpart-hanger-template', JSON.stringify(template));
            e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignore */ }
        setSelectedHangerId(item.id);
        HangerDragController.instance.startDrag(template);
    };

    const endHangerDrag = () => {
        HangerDragController.instance.endDrag();
    };

    const thumbIcon = (kind: 'BAR' | 'EDGE' | 'KNOB' | 'HANGER' | 'HOOK' | 'LIGHT' | 'SWITCH') => {
        if (kind === 'HANGER') {
            return (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 8h4v10H4zM16 8h4v10h-4z" />
                    <path d="M6 8V5h12v3" />
                    <path d="M8 12h8" />
                </svg>
            );
        }
        if (kind === 'HOOK') {
            return (
                <svg width="22" height="18" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M5 2v8a4 4 0 0 0 8 0V6" />
                    <circle cx="5" cy="2.5" r="1.2" fill="currentColor" />
                </svg>
            );
        }
        if (kind === 'SWITCH') {
            return (
                <svg width="22" height="18" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="4" y="1" width="10" height="14" rx="2" />
                    <circle cx="9" cy="8" r="2.2" />
                </svg>
            );
        }
        if (kind === 'LIGHT') {
            return (
                <svg width="22" height="18" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <circle cx="9" cy="7" r="3.5" />
                    <path d="M9 1v1.5M9 11.5V13M2.5 7H4M14 7h1.5" />
                </svg>
            );
        }
        if (kind === 'KNOB') {
            return (
                <svg width="22" height="18" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="1" y="1" width="16" height="14" rx="1.5" />
                    <circle cx="12" cy="5.5" r="2.4" fill="currentColor" fillOpacity="0.18" />
                    <circle cx="12" cy="5.5" r="1.1" fill="currentColor" />
                </svg>
            );
        }
        if (kind === 'EDGE') {
            return (
                <svg width="22" height="16" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <rect x="1" y="1" width="16" height="12" rx="1.5" />
                    <path d="M1 3h16" strokeWidth="2" />
                </svg>
            );
        }
        return (
            <svg width="22" height="16" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="1" width="16" height="12" rx="1.5" />
                <path d="M4 7h10" strokeWidth="1.6" />
                <circle cx="5.5" cy="7" r="1.1" fill="currentColor" />
                <circle cx="12.5" cy="7" r="1.1" fill="currentColor" />
            </svg>
        );
    };

    return (
        <div className="smartparts-panel">
            {/* Otwiera Studio 3D w osobnym oknie (jak CNC / nesting) */}
            <button
                type="button"
                className="smartparts-studio-link-btn"
                title="Otwórz SmartParts Studio 3D w osobnym oknie"
                onClick={() => {
                    const open = getModuleOpenHandler()?.openSmartPartsStudio;
                    if (open) open();
                    else window.open('./smartparts.html', 'SmartPanelSmartParts');
                }}
            >
                Otwórz SmartParts Studio 3D
            </button>

            {/* Pod-zakładki jak Płyty / Obrzeża */}
            <div className="smartparts-section-switch">
                {SMARTPART_SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        className={`smartparts-section-btn${section === s.id ? ' is-active' : ''}`}
                        onClick={() => setSection(s.id)}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* ─── UCHWYTY: filtry + katalog ─── */}
            {section === 'HANDLES' && (
                <HandleCatalogBrowser />
            )}

            {/* ─── ZAWIESZKI (Camaro — detekcja wnęki, para L/R) ─── */}
            {section === 'HANGERS' && (
                <>
                    <div className="smartparts-filters">
                        <div className="smartparts-filters-title">Filtry i wyszukiwanie</div>
                        <div className="smartparts-search-wrap">
                            <input
                                type="text"
                                className="smartparts-search"
                                placeholder="Szukaj zawieszki (Camaro…)"
                                value={hangerSearch}
                                onChange={(e) => setHangerSearch(e.target.value)}
                            />
                        </div>
                        <p className="smartparts-hint" style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.75 }}>
                            Camaro = katalog. Własne SP = Studio + pliki B1. ✕ kasuje z listy i z dysku; skasowanie JSON z folderu znika po odświeżeniu/focus.
                            Przeciągnij na wnękę — w drzewie: kontener → Part → otwory. PPM „Edytuj” = formatka ze Studia.
                        </p>
                    </div>
                    <div className="smartparts-list-meta">
                        <span>Znaleziono:</span>
                        <strong>{hangerItems.length}</strong>
                    </div>
                    <div className="smartparts-thumb-list">
                        {hangerItems.map((item) => {
                            const selected = item.id === selectedHangerId;
                            return (
                                <div
                                    key={item.id}
                                    className={`smartparts-thumb-row${selected ? ' is-selected' : ''}`}
                                    draggable={true}
                                    onDragStart={(e) => startHangerDrag(e, item)}
                                    onDragEnd={endHangerDrag}
                                    onClick={() => setSelectedHangerId(item.id)}
                                    title={`${item.name}\nPrzeciągnij na wnękę korpusu`}
                                >
                                    <span className="smartparts-thumb-grip" aria-hidden>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                        </svg>
                                    </span>
                                    <span className="smartparts-thumb-preview">
                                        {item.thumbnailUrl ? (
                                            <img
                                                src={item.thumbnailUrl}
                                                alt={item.name}
                                                className="smartparts-thumb-img"
                                            />
                                        ) : (
                                            thumbIcon('HANGER')
                                        )}
                                    </span>
                                    <span className="smartparts-thumb-text">
                                        <span className="smartparts-thumb-name">{item.name}</span>
                                        <span className="smartparts-thumb-sub">{item.subtitle}</span>
                                    </span>
                                    <span className="smartparts-thumb-badge">{item.badge}</span>
                                    {item.isCustom && (
                                        <button
                                            type="button"
                                            className="smartparts-thumb-delete"
                                            title="Usuń z listy i z dysku (B1 + Studio)"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!window.confirm(
                                                    `Usunąć „${item.name}” z listy SmartParts i plików w B1_biblioteka/zawieszki?`,
                                                )) return;
                                                const res = await deleteHangerFromLibrary(item.id);
                                                if (!res.ok && res.error) {
                                                    console.warn('[SmartParts] delete:', res.error);
                                                }
                                                // też po nazwie (plik ZAW123.json vs id sp:…)
                                                if (item.name && item.name !== item.id) {
                                                    await deleteHangerFromLibrary(item.name);
                                                }
                                                setHangerCatalogTick((n) => n + 1);
                                                if (selectedHangerId === item.id) setSelectedHangerId(null);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ─── WIESZAKI ─── */}
            {section === 'HOOKS' && (
                <>
                    <div className="smartparts-filters">
                        <div className="smartparts-filters-title">Filtry i wyszukiwanie</div>
                        <div className="smartparts-search-wrap">
                            <input
                                type="text"
                                className="smartparts-search"
                                placeholder="Szukaj wieszaka (SINGO, SORIA…)"
                                value={hookSearch}
                                onChange={(e) => setHookSearch(e.target.value)}
                            />
                        </div>
                        <div className="smartparts-filter-grid">
                            <label className="smartparts-tool-select-wrap">
                                <span className="smartparts-tool-select-label">Typ</span>
                                <select
                                    className="smartparts-tool-select"
                                    value={hookTypeFilter}
                                    onChange={(e) => setHookTypeFilter(e.target.value)}
                                >
                                    {HOOK_TYPE_FILTERS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="smartparts-tool-select-wrap">
                                <span className="smartparts-tool-select-label">Producent</span>
                                <select
                                    className="smartparts-tool-select"
                                    value={hookProducerFilter}
                                    onChange={(e) => setHookProducerFilter(e.target.value)}
                                >
                                    {HOOK_PRODUCER_FILTERS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="smartparts-tool-select-wrap">
                                <span className="smartparts-tool-select-label">Model</span>
                                <select
                                    className="smartparts-tool-select"
                                    value={hookModelFilter}
                                    onChange={(e) => setHookModelFilter(e.target.value)}
                                >
                                    {HOOK_MODEL_FILTERS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                    <div className="smartparts-list-meta">
                        <span>Znaleziono:</span>
                        <strong>{hookItems.length}</strong>
                    </div>
                    <div className="smartparts-thumb-list">
                        {hookItems.map((item) => {
                            const selected = item.id === selectedHookId;
                            return (
                                <div
                                    key={item.id}
                                    className={`smartparts-thumb-row is-soon${selected ? ' is-selected' : ''}`}
                                    onClick={() => setSelectedHookId(item.id)}
                                    title="Wstawianie wieszaków — wkrótce"
                                >
                                    <span className="smartparts-thumb-preview">{thumbIcon('HOOK')}</span>
                                    <span className="smartparts-thumb-text">
                                        <span className="smartparts-thumb-name">{item.name}</span>
                                        <span className="smartparts-thumb-sub">{item.subtitle}</span>
                                    </span>
                                    <span className="smartparts-thumb-badge">{item.badge}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ─── LAMPKI ─── */}
            {section === 'LIGHTS' && (
                <>
                    <div className="smartparts-filters">
                        <div className="smartparts-filters-title">Filtry i wyszukiwanie</div>
                        <div className="smartparts-search-wrap">
                            <input
                                type="text"
                                className="smartparts-search"
                                placeholder="Szukaj lampki…"
                                value={lightSearch}
                                onChange={(e) => setLightSearch(e.target.value)}
                            />
                        </div>
                        <div className="smartparts-filter-grid">
                            <label className="smartparts-tool-select-wrap">
                                <span className="smartparts-tool-select-label">Typ</span>
                                <select
                                    className="smartparts-tool-select"
                                    value={lightTypeFilter}
                                    onChange={(e) => setLightTypeFilter(e.target.value)}
                                >
                                    {LIGHT_TYPE_FILTERS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="smartparts-tool-select-wrap">
                                <span className="smartparts-tool-select-label">Producent</span>
                                <select
                                    className="smartparts-tool-select"
                                    value={lightProducerFilter}
                                    onChange={(e) => setLightProducerFilter(e.target.value)}
                                >
                                    {LIGHT_PRODUCER_FILTERS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                    <div className="smartparts-list-meta">
                        <span>Znaleziono:</span>
                        <strong>{lightItems.length}</strong>
                    </div>
                    <div className="smartparts-thumb-list">
                        {lightItems.map((item) => {
                            const selected = item.id === selectedLightId;
                            return (
                                <div
                                    key={item.id}
                                    className={`smartparts-thumb-row is-soon${selected ? ' is-selected' : ''}`}
                                    onClick={() => setSelectedLightId(item.id)}
                                    title="Wstawianie lampek — wkrótce"
                                >
                                    <span className="smartparts-thumb-preview">{thumbIcon('LIGHT')}</span>
                                    <span className="smartparts-thumb-text">
                                        <span className="smartparts-thumb-name">{item.name}</span>
                                        <span className="smartparts-thumb-sub">{item.subtitle}</span>
                                    </span>
                                    <span className="smartparts-thumb-badge">{item.badge}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ─── WŁĄCZNIKI ─── */}
            {section === 'SWITCHES' && (
                <>
                    <div className="smartparts-filters">
                        <div className="smartparts-filters-title">Filtry i wyszukiwanie</div>
                        <div className="smartparts-search-wrap">
                            <input
                                type="text"
                                className="smartparts-search"
                                placeholder="Szukaj włącznika (W01, W05…)"
                                value={switchSearch}
                                onChange={(e) => setSwitchSearch(e.target.value)}
                            />
                        </div>
                        <div className="smartparts-filter-grid">
                            <label className="smartparts-tool-select-wrap">
                                <span className="smartparts-tool-select-label">Typ</span>
                                <select
                                    className="smartparts-tool-select"
                                    value={switchTypeFilter}
                                    onChange={(e) => setSwitchTypeFilter(e.target.value)}
                                >
                                    {SWITCH_TYPE_FILTERS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="smartparts-tool-select-wrap">
                                <span className="smartparts-tool-select-label">Producent</span>
                                <select
                                    className="smartparts-tool-select"
                                    value={switchProducerFilter}
                                    onChange={(e) => setSwitchProducerFilter(e.target.value)}
                                >
                                    {SWITCH_PRODUCER_FILTERS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="smartparts-tool-select-wrap">
                                <span className="smartparts-tool-select-label">Model</span>
                                <select
                                    className="smartparts-tool-select"
                                    value={switchModelFilter}
                                    onChange={(e) => setSwitchModelFilter(e.target.value)}
                                >
                                    {SWITCH_MODEL_FILTERS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>
                    <div className="smartparts-list-meta">
                        <span>Znaleziono:</span>
                        <strong>{switchItems.length}</strong>
                    </div>
                    <div className="smartparts-thumb-list">
                        {switchItems.map((item) => {
                            const selected = item.id === selectedSwitchId;
                            return (
                                <div
                                    key={item.id}
                                    className={`smartparts-thumb-row is-soon${selected ? ' is-selected' : ''}`}
                                    onClick={() => setSelectedSwitchId(item.id)}
                                    title="Wstawianie włączników — wkrótce"
                                >
                                    <span className="smartparts-thumb-preview">{thumbIcon('SWITCH')}</span>
                                    <span className="smartparts-thumb-text">
                                        <span className="smartparts-thumb-name">{item.name}</span>
                                        <span className="smartparts-thumb-sub">{item.subtitle}</span>
                                    </span>
                                    <span className="smartparts-thumb-badge">{item.badge}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
