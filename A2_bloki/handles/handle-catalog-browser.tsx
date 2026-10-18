/**
 * A2_bloki / handles — handle-catalog-browser.tsx
 * Przeglądarka katalogu uchwytów (Typ, Producent, Model, C-C, Kolor).
 * Używana w Bloki (FORMATKA) oraz w zakładce SmartParts.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
    HANDLE_FILTER_NONE,
    listHandleTypeFilterOptions,
    listHandleProducerFilterOptions,
    listHandleModelFilterOptions,
    listHandleSizeFilterOptions,
    filterHandleCatalog,
    handleItemToTemplate,
    type HandleCatalogItem,
    type HandleTypeFilter,
    type HandleProducerFilter,
    type HandleModelFilter,
    type HandleSizeFilter,
} from '../01_smartparts-catalog.js';
import {
    HANDLE_COLOR_OPTIONS,
    DEFAULT_HANDLE_COLOR_ID,
    resolveHandleColor,
    type HandleColorId,
    type HandleParamsMm,
    type HandleTemplateItem,
} from './handle-types.js';
import { HandleDragController } from './handle-controller.js';
import { ContextManager } from '../../A1_core/context-manager.js';

export function handleTemplateToParams(t: HandleTemplateItem): Partial<HandleParamsMm> {
    return {
        totalLengthMm: t.totalLengthMm,
        holeDistanceMm: t.holeDistanceMm,
        depthMm: t.depthMm,
        thicknessMm: t.thicknessMm,
        orientation: t.defaultOrientation || 'HORIZONTAL',
        placementPreset: t.defaultPreset || 'CENTER',
        glbModelPath: t.glbModelPath,
        seriesId: t.defaultSeriesId,
        producerId: t.producerId,
        colorId: t.colorId,
        color: t.color,
    };
}

export interface HandleCatalogBrowserProps {
    onSelectHandle?: (item: HandleCatalogItem, template: HandleTemplateItem) => void;
    compact?: boolean;
}

export function HandleCatalogBrowser({ onSelectHandle, compact }: HandleCatalogBrowserProps): React.JSX.Element {
    const [handleTypeFilter, setHandleTypeFilter] = useState<HandleTypeFilter>('BAR');
    const [handleProducerFilter, setHandleProducerFilter] = useState<HandleProducerFilter>('rejs');
    const [handleModelFilter, setHandleModelFilter] = useState<HandleModelFilter>('easy');
    const [handleSizeFilter, setHandleSizeFilter] = useState<HandleSizeFilter>(HANDLE_FILTER_NONE);
    const [handleColorFilter, setHandleColorFilter] = useState<HandleColorId>(DEFAULT_HANDLE_COLOR_ID);
    const [handleSearch, setHandleSearch] = useState('');
    const [selectedHandleId, setSelectedHandleId] = useState<string | null>(null);

    const handleTypeOptions = useMemo(
        () => listHandleTypeFilterOptions({
            producer: handleProducerFilter,
            model: handleModelFilter,
            sizeMm: handleSizeFilter,
        }, handleTypeFilter),
        [handleProducerFilter, handleModelFilter, handleSizeFilter, handleTypeFilter],
    );
    const handleProducerOptions = useMemo(
        () => listHandleProducerFilterOptions({
            type: handleTypeFilter,
            model: handleModelFilter,
            sizeMm: handleSizeFilter,
        }, handleProducerFilter),
        [handleTypeFilter, handleModelFilter, handleSizeFilter, handleProducerFilter],
    );
    const handleModelOptions = useMemo(
        () => listHandleModelFilterOptions({
            type: handleTypeFilter,
            producer: handleProducerFilter,
            sizeMm: handleSizeFilter,
        }, handleModelFilter),
        [handleTypeFilter, handleProducerFilter, handleSizeFilter, handleModelFilter],
    );
    const handleSizeOptions = useMemo(
        () => listHandleSizeFilterOptions({
            type: handleTypeFilter,
            producer: handleProducerFilter,
            model: handleModelFilter,
        }, handleSizeFilter),
        [handleTypeFilter, handleProducerFilter, handleModelFilter, handleSizeFilter],
    );

    const handleItems = useMemo(() => filterHandleCatalog({
        type: handleTypeFilter,
        producer: handleProducerFilter,
        model: handleModelFilter,
        sizeMm: handleSizeFilter,
        searchQuery: handleSearch,
    }), [handleTypeFilter, handleProducerFilter, handleModelFilter, handleSizeFilter, handleSearch]);

    // Ustaw domyślny aktywny szablon po załadowaniu lub zmianie filtrów
    useEffect(() => {
        const item = (selectedHandleId ? handleItems.find(i => i.id === selectedHandleId) : null) || handleItems[0];
        if (item) {
            const { id: colorId, color } = resolveHandleColor(handleColorFilter);
            const template = handleItemToTemplate(item, { colorId, color });
            const params = handleTemplateToParams(template);
            ContextManager.instance?.blokiBayController?.setActiveHandleTemplate(params);
        }
    }, [handleItems, selectedHandleId, handleColorFilter]);

    const buildTemplate = (item: HandleCatalogItem) => {
        const { id: colorId, color } = resolveHandleColor(handleColorFilter);
        return handleItemToTemplate(item, { colorId, color });
    };

    const handleSelect = (item: HandleCatalogItem) => {
        setSelectedHandleId(item.id);
        const template = buildTemplate(item);
        const params = handleTemplateToParams(template);
        ContextManager.instance?.blokiBayController?.setActiveHandleTemplate(params);
        if (onSelectHandle) {
            onSelectHandle(item, template);
        }
    };

    const startHandleDrag = (e: React.DragEvent, item: HandleCatalogItem) => {
        const template = buildTemplate(item);
        try {
            e.dataTransfer.setData('application/smartpart-handle-template', JSON.stringify(template));
            e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignore */ }
        setSelectedHandleId(item.id);
        const params = handleTemplateToParams(template);
        ContextManager.instance?.blokiBayController?.setActiveHandleTemplate(params);
        ContextManager.instance?.blokiBayController?.startDrag('HANDLES');
        HandleDragController.instance.startDrag(template);
        if (onSelectHandle) {
            onSelectHandle(item, template);
        }
    };

    const endHandleDrag = () => {
        HandleDragController.instance.endDrag();
    };

    const thumbIcon = (kind: 'BAR' | 'EDGE' | 'KNOB') => {
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
        <div className={`smartparts-catalog-browser${compact ? ' is-compact' : ''}`}>
            <div className="smartparts-filters">
                <div className="smartparts-filters-title">Filtry i wyszukiwanie uchwytów</div>
                <div className="smartparts-search-wrap">
                    <input
                        type="text"
                        className="smartparts-search"
                        placeholder="Szukaj (Easy, 160, Tytano…)"
                        value={handleSearch}
                        onChange={(e) => setHandleSearch(e.target.value)}
                    />
                    {handleSearch ? (
                        <button type="button" className="smartparts-search-clear" onClick={() => setHandleSearch('')}>✕</button>
                    ) : null}
                </div>
                <div className="smartparts-filter-grid">
                    <label className="smartparts-tool-select-wrap">
                        <span className="smartparts-tool-select-label">Typ</span>
                        <select
                            className="smartparts-tool-select"
                            value={handleTypeFilter}
                            onChange={(e) => {
                                const next = e.target.value as HandleTypeFilter;
                                setHandleTypeFilter(next);
                                setHandleModelFilter(HANDLE_FILTER_NONE);
                                setHandleSizeFilter(HANDLE_FILTER_NONE);
                            }}
                        >
                            {handleTypeOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="smartparts-tool-select-wrap">
                        <span className="smartparts-tool-select-label">Producent</span>
                        <select
                            className="smartparts-tool-select"
                            value={handleProducerFilter}
                            onChange={(e) => setHandleProducerFilter(e.target.value as HandleProducerFilter)}
                        >
                            {handleProducerOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="smartparts-tool-select-wrap">
                        <span className="smartparts-tool-select-label">Model</span>
                        <select
                            className="smartparts-tool-select"
                            value={handleModelFilter}
                            onChange={(e) => setHandleModelFilter(e.target.value as HandleModelFilter)}
                        >
                            {handleModelOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="smartparts-tool-select-wrap">
                        <span className="smartparts-tool-select-label">Rozmiar</span>
                        <select
                            className="smartparts-tool-select"
                            value={handleSizeFilter === HANDLE_FILTER_NONE ? HANDLE_FILTER_NONE : String(handleSizeFilter)}
                            onChange={(e) => {
                                const v = e.target.value;
                                setHandleSizeFilter(v === HANDLE_FILTER_NONE ? HANDLE_FILTER_NONE : Number(v));
                            }}
                        >
                            {handleSizeOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="smartparts-tool-select-wrap">
                        <span className="smartparts-tool-select-label">Kolor</span>
                        <select
                            className="smartparts-tool-select"
                            value={handleColorFilter}
                            onChange={(e) => setHandleColorFilter(e.target.value as HandleColorId)}
                        >
                            {HANDLE_COLOR_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className="smartparts-list-meta">
                <span>Znaleziono:</span>
                <strong>{handleItems.length}</strong>
            </div>
            <div className="smartparts-thumb-list" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {handleItems.map((item) => {
                    const selected = item.id === selectedHandleId;
                    return (
                        <div
                            key={item.id}
                            className={`smartparts-thumb-row${selected ? ' is-selected' : ''}`}
                            draggable={true}
                            onDragStart={(e) => startHandleDrag(e, item)}
                            onDragEnd={endHandleDrag}
                            onClick={() => handleSelect(item)}
                            title={`${item.name}\nPrzeciągnij na front lub kliknij, aby wybrać`}
                        >
                            <span className="smartparts-thumb-grip" title="Przeciągnij na formatkę w 3D" aria-hidden>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span className="smartparts-thumb-preview">
                                {thumbIcon(
                                    item.type === 'KNOB' ? 'KNOB'
                                        : item.type === 'EDGE' ? 'EDGE'
                                            : 'BAR',
                                )}
                            </span>
                            <span className="smartparts-thumb-text">
                                <span className="smartparts-thumb-name">{item.name}</span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
