import React, { useState, useMemo } from 'react';
import { materialDatabase } from './material-database.js';
import { MaterialItem, MaterialScope, MaterialFilters } from './material-types.js';

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
    const [selectedEdgeScope, setSelectedEdgeScope] = useState<MaterialScope>('SINGLE');

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
                    {/* Katalog typów obrzeży + Usuwanie */}
                    <div style={{ background: '#18181b', border: '1px solid #27272a', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontWeight: 'bold', color: '#e4e4e7', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            🔲 Biblioteka Obrzeży (Przeciągnij na formatkę w 3D)
                        </div>

                        <div style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: '1.4' }}>
                            💡 <strong>Jak używać:</strong> Przeciągnij wybrany kafelek na <strong>krawędź</strong> formatki (aby okleić jedną krawędź) lub na <strong>środek płyty</strong> (aby okleić 4 krawędzie dookoła).
                        </div>

                        {/* Lista typów obrzeży + kafelek Usuń Obrzeże w tej samej siatce */}
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
                                            flexDirection: 'column',
                                            padding: '8px',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.2)' : '#27272a',
                                            border: `1px solid ${isSelected ? '#3b82f6' : '#3f3f46'}`,
                                            borderRadius: '5px',
                                            cursor: 'grab',
                                            userSelect: 'none',
                                            transition: 'border-color 0.15s, background 0.15s'
                                        }}
                                    >
                                        <div style={{ fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#93c5fd' : '#e4e4e7', fontSize: '11px' }}>
                                            {edge.name}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: '10px', marginTop: '4px' }}>
                                            <span>Grub: {edge.thickness_mm}mm</span>
                                            <span style={{ color: '#38bdf8' }}>{edge.price_per_mb?.toFixed(2)} PLN/mb</span>
                                        </div>
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
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    padding: '8px',
                                    background: selectedEdgeId === 'REMOVE_EDGE' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.12)',
                                    border: `1px dashed ${selectedEdgeId === 'REMOVE_EDGE' ? '#ef4444' : '#b91c1c'}`,
                                    borderRadius: '5px',
                                    cursor: 'grab',
                                    userSelect: 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#fca5a5', fontSize: '11px' }}>
                                    <span>❌</span>
                                    <span>Usuń Obrzeże</span>
                                </div>
                                <div style={{ color: '#f87171', fontSize: '10px', marginTop: '4px' }}>
                                    Zdejmij okleinę
                                </div>
                            </div>
                        </div>

                        {/* Zasięg stosowania */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid #27272a', paddingTop: '8px' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '10px' }}>Zasięg przeciągania:</span>
                            <select
                                value={selectedEdgeScope}
                                onChange={(e) => {
                                    const sc = e.target.value as MaterialScope;
                                    setSelectedEdgeScope(sc);
                                    (window as any).__draggedEdgeScope = sc;
                                }}
                                style={{ padding: '3px 6px', background: '#27272a', border: '1px solid #3f3f46', color: '#fff', borderRadius: '4px', fontSize: '10px' }}
                            >
                                <option value="SINGLE">Pojedyncza formatka</option>
                                <option value="CONTAINER">Cała szafka</option>
                                <option value="PROJECT">Cały projekt</option>
                            </select>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
