import React, { useState, useEffect, useMemo } from 'react';
import type { FurnitureCatalogItem, FurnitureCategory } from './platforma-types.js';
import { getAllPlatformItems, sendFurnitureToCrevoScene } from './platforma-store.js';
import { cabinetLibraryStore } from '../B1_biblioteka/korpusy/cabinet-library-store.js';
import { FurnitureCard } from './FurnitureCard.js';
import { FurnitureDetailModal } from './FurnitureDetailModal.js';

export const PlatformaApp: React.FC = () => {
    const [catalog, setCatalog] = useState<FurnitureCatalogItem[]>(() => getAllPlatformItems());
    const [selectedCategory, setSelectedCategory] = useState<FurnitureCategory | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<FurnitureCatalogItem | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // Automatyczna synchronizacja gdy użytkownik zapisze nowy korpus w programie CAD
    useEffect(() => {
        const unsubscribe = cabinetLibraryStore.subscribe(() => {
            setCatalog(getAllPlatformItems());
        });
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'blok_cabinet_library_v1') {
                setCatalog(getAllPlatformItems());
            }
        };
        window.addEventListener('storage', onStorage);
        return () => {
            unsubscribe();
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    const categories: Array<{ id: FurnitureCategory | 'ALL'; label: string }> = [
        { id: 'ALL', label: 'Wszystkie modele' },
        { id: 'DOLNE', label: 'Szafki dolne' },
        { id: 'WISZACE', label: 'Szafki wiszące' },
        { id: 'SLUPKI', label: 'Słupki wysokie' },
        { id: 'NAROZNE', label: 'Szafki narożne' },
        { id: 'SZAFY', label: 'Szafy i garderoby' },
        { id: 'BIURO_POKOJ', label: 'Komody i biuro' }
    ];

    const filteredItems = useMemo(() => {
        return catalog.filter((item) => {
            if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = item.name.toLowerCase().includes(q);
                const matchCode = item.code.toLowerCase().includes(q);
                const matchDesc = item.description.toLowerCase().includes(q);
                const matchTag = item.tags.some((t) => t.toLowerCase().includes(q));
                if (!matchName && !matchCode && !matchDesc && !matchTag) {
                    return false;
                }
            }
            return true;
        });
    }, [catalog, selectedCategory, searchQuery]);

    const handleAddToScene = (item: FurnitureCatalogItem) => {
        sendFurnitureToCrevoScene(item);
        setToastMsg(`Wysłano "${item.name}" do sceny Crevo CAD!`);
        setTimeout(() => setToastMsg(null), 3500);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Toast powiadomień */}
            {toastMsg && (
                <div style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    background: '#047857',
                    color: '#fff',
                    padding: '12px 20px',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <span>✓</span>
                    <span>{toastMsg}</span>
                </div>
            )}

            {/* Header */}
            <header className="plat-header">
                <a href="#" className="plat-logo">
                    <div className="plat-logo-icon">C</div>
                    <span className="plat-logo-title">Crevo Furniture Platform</span>
                    <span className="plat-logo-badge">CAD Catalog</span>
                </a>

                <div className="plat-header-search">
                    <span className="plat-search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Szukaj mebli (np. szuflady, szafka narożna, słupek AGD)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="plat-header-actions">
                    <a href="index.html" className="plat-btn-cad-link" target="_blank" rel="noreferrer">
                        <span>Otwórz edytor CAD 3D</span>
                        <span>→</span>
                    </a>
                </div>
            </header>

            {/* Layout */}
            <div className="plat-layout">
                {/* Sidebar */}
                <aside className="plat-sidebar">
                    <div>
                        <div className="plat-filter-group-title">Kategorie mebli</div>
                        <div className="plat-category-list">
                            {categories.map((c) => {
                                const count = c.id === 'ALL'
                                    ? catalog.length
                                    : catalog.filter((i) => i.category === c.id).length;
                                return (
                                    <button
                                        key={c.id}
                                        className={`plat-category-btn ${selectedCategory === c.id ? 'active' : ''}`}
                                        onClick={() => setSelectedCategory(c.id)}
                                    >
                                        <span>{c.label}</span>
                                        <span className="plat-category-count">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', padding: '14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd', marginBottom: 4 }}>
                            Dwukierunkowa integracja
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                            1. Zapisane w programie CAD korpusy trafiają od razu na tę platformę.<br/>
                            2. Kliknij <b>+ Do sceny</b>, aby natychmiast wstawić mebel do projektu CAD.
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="plat-main">
                    <div className="plat-main-header">
                        <div>
                            <h1 className="plat-main-title">
                                {categories.find((c) => c.id === selectedCategory)?.label || 'Katalog Mebli'}
                            </h1>
                            <div className="plat-stats-label">
                                Znaleziono {filteredItems.length} z {catalog.length} parametrycznych modeli mebli
                            </div>
                        </div>
                    </div>

                    {filteredItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--plat-text-muted)' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--plat-text)' }}>
                                Nie znaleziono mebli pasujących do kryteriów
                            </div>
                            <div style={{ fontSize: 13, marginTop: 4 }}>
                                Spróbuj wpisać inną frazę lub wybrać inną kategorię w panelu bocznym.
                            </div>
                        </div>
                    ) : (
                        <div className="plat-grid">
                            {filteredItems.map((item) => (
                                <FurnitureCard
                                    key={item.id}
                                    item={item}
                                    onSelect={(selected) => setSelectedItem(selected)}
                                    onAddToScene={handleAddToScene}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Modal podglądu 3D i szczegółów */}
            <FurnitureDetailModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onAddToScene={handleAddToScene}
            />
        </div>
    );
};
