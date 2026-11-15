import React, { useState } from 'react';
import type { FurnitureCatalogItem } from './platforma-types.js';
import { FurnitureViewer3D } from './FurnitureViewer3D.js';

interface FurnitureDetailModalProps {
    item: FurnitureCatalogItem | null;
    onClose: () => void;
    onAddToScene: (item: FurnitureCatalogItem) => void;
}

export const FurnitureDetailModal: React.FC<FurnitureDetailModalProps> = ({ item, onClose, onAddToScene }) => {
    const [added, setAdded] = useState(false);
    if (!item) return null;

    const { width_mm, height_mm, depth_mm } = item.dimensions;

    const handleAddClick = () => {
        onAddToScene(item);
        setAdded(true);
        setTimeout(() => setAdded(false), 2200);
    };

    const handleDownloadSpec = () => {
        const jsonStr = JSON.stringify(item, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.code}_spec.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="plat-modal-backdrop" onClick={onClose}>
            <div className="plat-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="plat-modal-header">
                    <div>
                        <h3 className="plat-modal-title">{item.name}</h3>
                        <span style={{ fontSize: 12, color: 'var(--plat-text-dim)', fontFamily: 'monospace' }}>
                            Kod katalogowy: {item.code}
                        </span>
                    </div>
                    <button className="plat-modal-close" onClick={onClose} title="Zamknij (Esc)">
                        ✕
                    </button>
                </div>

                <div className="plat-modal-body">
                    <div className="plat-modal-3d-pane">
                        <FurnitureViewer3D item={item} />
                        <div style={{ position: 'absolute', bottom: 12, left: 14, fontSize: 11, color: '#94a3b8', pointerEvents: 'none' }}>
                            Obracaj LPM • Przesuwaj PPM • Zoom kółkiem
                        </div>
                    </div>

                    <div className="plat-modal-details-pane">
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--plat-text-dim)', marginBottom: 8 }}>
                                Wymiary domyślne (w pełni parametryczne)
                            </div>
                            <table className="plat-spec-table">
                                <tbody>
                                    <tr>
                                        <td className="plat-spec-label">Szerokość:</td>
                                        <td className="plat-spec-val">{width_mm} mm</td>
                                    </tr>
                                    <tr>
                                        <td className="plat-spec-label">Wysokość:</td>
                                        <td className="plat-spec-val">{height_mm} mm</td>
                                    </tr>
                                    <tr>
                                        <td className="plat-spec-label">Głębokość:</td>
                                        <td className="plat-spec-val">{depth_mm} mm</td>
                                    </tr>
                                    <tr>
                                        <td className="plat-spec-label">Typ korpusu:</td>
                                        <td className="plat-spec-val">{item.korpusType}</td>
                                    </tr>
                                    {item.drawerCount ? (
                                        <tr>
                                            <td className="plat-spec-label">Liczba szuflad:</td>
                                            <td className="plat-spec-val">{item.drawerCount} szt.</td>
                                        </tr>
                                    ) : null}
                                    {item.doorCount ? (
                                        <tr>
                                            <td className="plat-spec-label">Liczba frontów:</td>
                                            <td className="plat-spec-val">{item.doorCount} szt.</td>
                                        </tr>
                                    ) : null}
                                    {item.shelfCount ? (
                                        <tr>
                                            <td className="plat-spec-label">Liczba półek:</td>
                                            <td className="plat-spec-val">{item.shelfCount} szt.</td>
                                        </tr>
                                    ) : null}
                                    {item.hardwareBrand ? (
                                        <tr>
                                            <td className="plat-spec-label">Okucia:</td>
                                            <td className="plat-spec-val">{item.hardwareBrand}</td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>

                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--plat-text-dim)', marginBottom: 6 }}>
                                Opis technologiczny
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--plat-text-muted)', lineHeight: 1.5 }}>
                                {item.description}
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button
                                className={`plat-btn-add-scene ${added ? 'added' : ''}`}
                                style={{ padding: '12px 18px', fontSize: 14 }}
                                onClick={handleAddClick}
                                title="Wstaw ten mebel natychmiast do otwartej sceny w programie Crevo CAD"
                            >
                                <span>{added ? '✓ Wstawiono mebel do sceny!' : '+ Dodaj do sceny Crevo CAD'}</span>
                            </button>
                            <button
                                className="plat-btn-secondary"
                                onClick={handleDownloadSpec}
                            >
                                Pobierz specyfikację techniczną (JSON)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
