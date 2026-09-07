import React, { useState, useMemo } from 'react';
import { materialDatabase } from './material-database.js';
import { MaterialItem, MaterialFilters } from './material-types.js';

interface Props {
    projectModel: any;
}

export function MaterialsUI({ projectModel: _projectModel }: Props) {
    const [activeSection, setActiveSection] = useState<'PANELS' | 'EDGES'>('PANELS');

    // Filtry płyt
    const [category, setCategory] = useState<string>('Wszystkie');
    const [thickness, setThickness] = useState<string>('Wszystkie');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortMode, setSortMode] = useState<MaterialFilters['sortMode']>('NAME_ASC');

    // Wybrany materiał płyty i obrzeża
    const [selectedMatId, setSelectedMatId] = useState<string>('W1100_ST9_18');
    const [selectedEdgeId, setSelectedEdgeId] = useState<string>('ABS_1x22');

    const categories = useMemo(() => materialDatabase.getCategories(), []);
    const thicknesses = useMemo(() => materialDatabase.getAvailableThicknesses(), []);
    const edgeTypes = useMemo(() => materialDatabase.getEdgeBandingTypes(), []);

    const filteredMaterials = useMemo(() => {
        return materialDatabase.filterMaterials({
            category,
            thickness,
            searchQuery,
            sortMode
        });
    }, [category, thickness, searchQuery, sortMode]);

    const handleSelectMaterial = (mat: MaterialItem) => {
        setSelectedMatId(mat.id);
    };

    const removeEdgeTile = {
        id: 'REMOVE_EDGE',
        name: 'Usuń Obrzeże',
        active: false,
        thickness_mm: 0,
        width_mm: 0,
        price_per_mb: 0
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', overflowY: 'auto', padding: '10px', color: '#f4f4f5', fontSize: '12px' }}>
            {/* Przełącznik pod-zakładek: Płyty / Obrzeża */}
            <div style={{ display: 'flex', background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '2px' }}>
                <button
                    onClick={() => setActiveSection('PANELS')}
                    style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: activeSection === 'PANELS' ? '#27272a' : 'transparent',
                        border: 'none',
                        color: activeSection === 'PANELS' ? '#60a5fa' : '#a1a1aa',
                        fontWeight: activeSection === 'PANELS' ? 600 : 400,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                    🪵 Płyty (Materiały)
                </button>
                <button
                    onClick={() => setActiveSection('EDGES')}
                    style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: activeSection === 'EDGES' ? '#27272a' : 'transparent',
                        border: 'none',
                        color: activeSection === 'EDGES' ? '#60a5fa' : '#a1a1aa',
                        fontWeight: activeSection === 'EDGES' ? 600 : 400,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                    🔲 Obrzeża (Edge Banding)
                </button>
            </div>

            {/* SEKCJA 1: PŁYTY (MATERIAŁY) */}
            {activeSection === 'PANELS' && (
                <>
                    {/* Filtry i wyszukiwarka */}
                    <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontWeight: 'bold', color: '#e4e4e7', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            🔍 Filtry i Wyszukiwanie
                        </div>
                        
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Szukaj dekoru (np. Dąb, H1145, W1100)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ width: '100%', padding: '5px 8px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '11px' }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ color: '#a1a1aa', fontSize: '10px' }}>Kategoria:</span>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    style={{ padding: '3px 4px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px', fontSize: '11px' }}
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ color: '#a1a1aa', fontSize: '10px' }}>Grubość:</span>
                                <select
                                    value={thickness}
                                    onChange={(e) => setThickness(e.target.value)}
                                    style={{ padding: '3px 4px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px', fontSize: '11px' }}
                                >
                                    <option value="Wszystkie">Wszystkie</option>
                                    {thicknesses.map(t => <option key={t} value={t.toString()}>{t} mm</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '10px' }}>Sortowanie:</span>
                            <select
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value as any)}
                                style={{ padding: '3px 6px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px', fontSize: '11px' }}
                            >
                                <option value="NAME_ASC">Nazwa A-Z</option>
                                <option value="NAME_DESC">Nazwa Z-A</option>
                                <option value="CODE_ASC">Kod dekoru</option>
                                <option value="THICKNESS_ASC">Grubość rosnąco</option>
                                <option value="THICKNESS_DESC">Grubość malejąco</option>
                            </select>
                        </div>
                    </div>

                    {/* Lista dekorów płyt */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px', color: '#a1a1aa', fontSize: '11px' }}>
                            <span>Znaleziono materiałów:</span>
                            <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>{filteredMaterials.length}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '380px', overflowY: 'auto' }}>
                            {filteredMaterials.map(mat => {
                                const isSelected = mat.id === selectedMatId;
                                return (
                                    <div
                                        key={mat.id}
                                        draggable={true}
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', mat.id);
                                            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'PANEL_MATERIAL', material: mat }));
                                            (window as any).__draggedMaterial = mat;
                                            (window as any).__draggedType = 'PANEL_MATERIAL';
                                            setSelectedMatId(mat.id);
                                        }}
                                        onClick={() => handleSelectMaterial(mat)}
                                        title="Przeciągnij i upuść na formatkę w 3D!"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '6px 8px',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.2)' : '#1c1c1f',
                                            border: `1px solid ${isSelected ? '#3b82f6' : '#27272a'}`,
                                            borderRadius: '5px',
                                            cursor: 'grab',
                                            transition: 'all 0.15s ease',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <span className="hand-icon" title="Chwyć i przeciągnij na formatkę w 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8', flexShrink: 0 }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                            </svg>
                                        </span>
                                        <div style={{
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '4px',
                                            backgroundColor: mat.hexColor || `rgb(${mat.color.r * 255}, ${mat.color.g * 255}, ${mat.color.b * 255})`,
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            flexShrink: 0
                                        }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#93c5fd' : '#e4e4e7', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {mat.name}
                                            </div>
                                            <div style={{ color: '#71717a', fontSize: '10px' }}>
                                                {mat.code || mat.category}
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '2px 5px',
                                            background: '#27272a',
                                            borderRadius: '3px',
                                            color: '#d4d4d8',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            flexShrink: 0
                                        }}>
                                            {mat.thickness_mm} mm
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* SEKCJA 2: OBRZEŻA (EDGE BANDING) */}
            {activeSection === 'EDGES' && (
                <>
                    {/* Lista typów obrzeży (6 wariantów) + Kafelek Usuń Obrzeże (łącznie 7 przycisków) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {edgeTypes.map(edge => {
                            const isSelected = edge.id === selectedEdgeId;
                            return (
                                <div
                                    key={edge.id}
                                    draggable={true}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', edge.id);
                                        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'EDGE_BANDING', edgeType: edge }));
                                        (window as any).__draggedEdge = edge;
                                        (window as any).__draggedType = 'EDGE_BANDING';
                                        setSelectedEdgeId(edge.id);
                                    }}
                                    onClick={() => setSelectedEdgeId(edge.id)}
                                    title="Przeciągnij na krawędź lub płytę w 3D!"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px',
                                        background: isSelected ? 'rgba(59, 130, 246, 0.2)' : '#27272a',
                                        border: `1px solid ${isSelected ? '#3b82f6' : '#3f3f46'}`,
                                        borderRadius: '5px',
                                        cursor: 'grab',
                                        userSelect: 'none',
                                        transition: 'border-color 0.15s, background 0.15s'
                                    }}
                                >
                                    <span className="hand-icon" title="Chwyć i przeciągnij na krawędź lub formatkę w 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8', flexShrink: 0 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                        </svg>
                                    </span>
                                    <span style={{ fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#93c5fd' : '#e4e4e7', fontSize: '11px', lineHeight: '1.2' }}>
                                        {edge.name}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Dedykowany Kafelek Usuwania Obrzeża o identycznej szerokości */}
                        <div
                            draggable={true}
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', removeEdgeTile.id);
                                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'EDGE_BANDING', edgeType: removeEdgeTile }));
                                (window as any).__draggedEdge = removeEdgeTile;
                                (window as any).__draggedType = 'EDGE_BANDING';
                                setSelectedEdgeId(removeEdgeTile.id);
                            }}
                            onClick={() => setSelectedEdgeId(removeEdgeTile.id)}
                            title="Przeciągnij na krawędź formatki (lub na środek płyty), aby zdjąć okleinę i odsłonić surowy rdzeń."
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px',
                                background: selectedEdgeId === 'REMOVE_EDGE' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.12)',
                                border: `1px dashed ${selectedEdgeId === 'REMOVE_EDGE' ? '#ef4444' : '#b91c1c'}`,
                                borderRadius: '5px',
                                cursor: 'grab',
                                userSelect: 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <span className="hand-icon" title="Chwyć i przeciągnij na krawędź lub formatkę w 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#f87171', flexShrink: 0 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            </span>
                            <span style={{ fontWeight: 600, color: '#fca5a5', fontSize: '11px', lineHeight: '1.2' }}>
                                Usuń Obrzeże
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
