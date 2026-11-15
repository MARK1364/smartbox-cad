import React, { useState } from 'react';
import type { FurnitureCatalogItem } from './platforma-types.js';

interface FurnitureCardProps {
    item: FurnitureCatalogItem;
    onSelect: (item: FurnitureCatalogItem) => void;
    onAddToScene: (item: FurnitureCatalogItem) => void;
}

export const FurnitureCard: React.FC<FurnitureCardProps> = ({ item, onSelect, onAddToScene }) => {
    const { width_mm, height_mm, depth_mm } = item.dimensions;
    const [added, setAdded] = useState(false);

    const handleAddClick = () => {
        onAddToScene(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 2200);
    };

    // Renderuje zgrabną, symboliczną ikonę 3D/izometryczną mebla
    const renderFurnitureSvg = () => {
        if (item.thumbnailSvg) {
            return (
                <img
                    src={item.thumbnailSvg}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                />
            );
        }

        const isTall = height_mm > 1200;
        const isCorner = item.category === 'NAROZNE';
        const isUpper = item.category === 'WISZACE';

        if (isCorner) {
            return (
                <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="currentColor">
                    <polygon points="50,15 85,35 50,55 15,35" fill="rgba(59, 130, 246, 0.12)" stroke="#60a5fa" strokeWidth="2" />
                    <polygon points="15,35 50,55 50,85 15,65" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />
                    <polygon points="50,55 85,35 85,65 50,85" fill="rgba(59, 130, 246, 0.25)" stroke="#2563eb" strokeWidth="2" />
                    <line x1="50" y1="55" x2="50" y2="85" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>
            );
        }

        if (isTall) {
            return (
                <svg width="100" height="130" viewBox="0 0 80 120" fill="none" stroke="currentColor">
                    <polygon points="40,10 70,25 40,40 10,25" fill="rgba(59, 130, 246, 0.12)" stroke="#60a5fa" strokeWidth="2" />
                    <polygon points="10,25 40,40 40,110 10,95" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />
                    <polygon points="40,40 70,25 70,95 40,110" fill="rgba(59, 130, 246, 0.25)" stroke="#2563eb" strokeWidth="2" />
                    <line x1="10" y1="50" x2="40" y2="65" stroke="#93c5fd" strokeWidth="1.5" />
                    <line x1="40" y1="65" x2="70" y2="50" stroke="#93c5fd" strokeWidth="1.5" />
                    <line x1="10" y1="75" x2="40" y2="90" stroke="#93c5fd" strokeWidth="1.5" />
                    <line x1="40" y1="90" x2="70" y2="75" stroke="#93c5fd" strokeWidth="1.5" />
                </svg>
            );
        }

        // Standardowy korpus dolny / szafka
        return (
            <svg width="120" height="110" viewBox="0 0 100 90" fill="none" stroke="currentColor">
                <polygon points="50,10 85,28 50,46 15,28" fill="rgba(59, 130, 246, 0.15)" stroke="#60a5fa" strokeWidth="2" />
                <polygon points="15,28 50,46 50,82 15,64" fill="rgba(59, 130, 246, 0.22)" stroke="#3b82f6" strokeWidth="2" />
                <polygon points="50,46 85,28 85,64 50,82" fill="rgba(59, 130, 246, 0.28)" stroke="#2563eb" strokeWidth="2" />
                {item.drawerCount && item.drawerCount > 0 ? (
                    <>
                        <line x1="50" y1="58" x2="85" y2="40" stroke="#93c5fd" strokeWidth="1.5" />
                        <line x1="50" y1="70" x2="85" y2="52" stroke="#93c5fd" strokeWidth="1.5" />
                    </>
                ) : null}
                {isUpper ? (
                    <circle cx="50" cy="18" r="3" fill="#fbbf24" stroke="none" />
                ) : null}
            </svg>
        );
    };

    return (
        <div className="plat-card">
            <div className="plat-card-thumb-wrap" onClick={() => onSelect(item)} title="Kliknij, aby otworzyć szczegóły i podgląd 3D">
                {renderFurnitureSvg()}
                <span className="plat-card-code">{item.code}</span>
            </div>

            <div className="plat-card-body">
                <div className="plat-card-name" onClick={() => onSelect(item)}>
                    {item.name}
                </div>
                <div className="plat-card-dims">
                    <span>{width_mm} × {height_mm} × {depth_mm} mm</span>
                </div>
                <div className="plat-card-desc">
                    {item.description}
                </div>

                <div className="plat-card-actions">
                    <button
                        className="plat-btn-secondary"
                        onClick={() => onSelect(item)}
                        title="Otwórz podgląd 3D i specyfikację"
                    >
                        Szczegóły
                    </button>
                    <button
                        className={`plat-btn-add-scene ${added ? 'added' : ''}`}
                        onClick={handleAddClick}
                        title="Dodaj ten mebel do otwartej sceny programu Crevo CAD"
                    >
                        {added ? '✓ Dodano!' : '+ Do sceny'}
                    </button>
                </div>
            </div>
        </div>
    );
};
