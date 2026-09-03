/**
 * PropertiesPanel — Dedykowany komponent React dla panelu właściwości obiektów 3D
 * 
 * Wzorowany na:
 *   - Blender N-Panel (zakładki Item / Object Properties / Custom Properties)
 *   - SolidWorks Property Manager
 * 
 * Zakładki:
 *   1. Item — Transformacja: Location (X,Y,Z), Rotation (X,Y,Z), Dimensions
 *   2. Properties — Parametry specyficzne: ⌀, głębokość, ściana, UV (otwory); W×H×T (płyty)
 *   3. Custom — Pary klucz-wartość definiowane przez użytkownika
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PropertiesManager, PropertiesData, CustomProperty } from '../A1_core/properties';
import { ContextManager } from '../A1_core/context-manager';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput';
import { isPanelModel } from '../A1_core/domain-data';
import { updateLibraryOperationParams } from '../o1_operacji';

type TabName = 'item' | 'properties' | 'custom';

export const PropertiesPanel: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [data, setData] = useState<PropertiesData | null>(null);
    const [activeTab, setActiveTab] = useState<TabName>('properties');

    // Custom property editing state
    const [newPropKey, setNewPropKey] = useState('');
    const [newPropValue, setNewPropValue] = useState('');

    // ─── Event listeners ───
    useEffect(() => {
        const handleUpdate = (e: any) => {
            if (e.detail) {
                setData(e.detail as PropertiesData);
                setVisible(true);
            }
        };

        const handleToggle = () => {
            setVisible(prev => !prev);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'n' || e.key === 'N') && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                setVisible(prev => !prev);
            }
        };

        document.addEventListener('smartbox-properties-update', handleUpdate);
        document.addEventListener('smartbox-toggle-item-panel', handleToggle);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('smartbox-properties-update', handleUpdate);
            document.removeEventListener('smartbox-toggle-item-panel', handleToggle);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // ─── Custom Properties handlers ───
    const handleAddCustomProp = useCallback(() => {
        if (!newPropKey.trim() || !data?.featureId) return;
        const objectId = data.featureId || data.name;
        PropertiesManager.instance.addCustomProperty(objectId, newPropKey.trim(), newPropValue.trim());
        setNewPropKey('');
        setNewPropValue('');
    }, [newPropKey, newPropValue, data]);

    const handleRemoveCustomProp = useCallback((key: string) => {
        if (!data) return;
        const objectId = data.featureId || data.name;
        PropertiesManager.instance.removeCustomProperty(objectId, key);
    }, [data]);

    const handleUpdateCustomProp = useCallback((key: string, value: string) => {
        if (!data) return;
        const objectId = data.featureId || data.name;
        PropertiesManager.instance.updateCustomProperty(objectId, key, value);
    }, [data]);

    const refreshInspect = useCallback(() => {
        if (!data?.featureId) return;
        const doc = ContextManager.instance.document;
        if (!doc) return;
        PropertiesManager.instance.inspectFeature(
            data.featureId,
            doc,
            ContextManager.instance.panelViews,
            () => (typeof doc.getPanels === 'function' ? doc.getPanels().map((item: any) => item.domainData || item) : []),
            undefined,
            undefined,
            true,
        );
    }, [data]);

    const applyGrooveEdit = useCallback((overrides: {
        frameWMm?: number;
        frameHMm?: number;
        widthMm?: number;
        heightMm?: number;
        uMm?: number;
        vMm?: number;
        depthMm?: number;
    }) => {
        if (!data?.grooveProps?.libraryId || !data.panelId) return;
        const doc = ContextManager.instance.document;
        const node = doc?.findNode(data.panelId);
        const panel = node?.domainData;
        if (!panel || !isPanelModel(panel)) return;
        updateLibraryOperationParams(panel, data.grooveProps.libraryId, overrides, data.grooveProps.face);
        refreshInspect();
    }, [data, refreshInspect]);

    if (!visible || !data) return null;

    // ─── Tab icons ───
    const tabIcons: Record<TabName, React.ReactNode> = {
        item: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
        ),
        properties: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
        ),
        custom: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
        )
    };

    const tabLabels: Record<TabName, string> = {
        item: 'Item',
        properties: 'Properties',
        custom: 'Custom'
    };

    return (
        <div className="blender-item-panel">
            {/* ─── Header ─── */}
            <div className="item-panel-header">
                <span>📊 Właściwości</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <kbd>N</kbd>
                    <button className="item-panel-close" onClick={() => setVisible(false)}>×</button>
                </div>
            </div>

            {/* ─── Tabs ─── */}
            <div className="props-tabs">
                {(['item', 'properties', 'custom'] as TabName[]).map(tab => (
                    <button
                        key={tab}
                        className={`props-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        title={tabLabels[tab]}
                    >
                        {tabIcons[tab]}
                        <span>{tabLabels[tab]}</span>
                    </button>
                ))}
            </div>

            {/* ─── Title row ─── */}
            <div className="item-panel-body">
                <div className="item-row-title">
                    <strong style={{ color: '#60a5fa', fontSize: '0.9rem' }}>{data.name}</strong>
                    <span className="item-type-badge">{data.objectType}</span>
                </div>

                {data.parentName && (
                    <div className="item-field">
                        <label>Rodzic:</label>
                        <span style={{ color: '#cbd5e1' }}>{data.parentName}</span>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════ */}
                {/* TAB: Item — Transformacja                      */}
                {/* ═══════════════════════════════════════════════ */}
                {activeTab === 'item' && (
                    <>
                        <div className="item-section-divider">Pozycja lokalna (Location)</div>
                        <div className="item-xyz-grid">
                            <div><span style={{ color: '#ef4444' }}>X:</span> {data.transform.loc.x ?? 0} mm</div>
                            <div><span style={{ color: '#22c55e' }}>Y:</span> {data.transform.loc.y ?? 0} mm</div>
                            <div><span style={{ color: '#3b82f6' }}>Z:</span> {data.transform.loc.z ?? 0} mm</div>
                        </div>

                        <div className="item-section-divider">Pozycja w scenie (World)</div>
                        <div className="item-xyz-grid">
                            <div><span style={{ color: '#ef4444' }}>X:</span> {data.transform.worldLoc.x} mm</div>
                            <div><span style={{ color: '#22c55e' }}>Y:</span> {data.transform.worldLoc.y} mm</div>
                            <div><span style={{ color: '#3b82f6' }}>Z:</span> {data.transform.worldLoc.z} mm</div>
                        </div>

                        {data.transform.rot && (
                            <>
                                <div className="item-section-divider">Obrót (Rotation)</div>
                                <div className="item-xyz-grid">
                                    <div><span style={{ color: '#ef4444' }}>X:</span> {data.transform.rot.x}°</div>
                                    <div><span style={{ color: '#22c55e' }}>Y:</span> {data.transform.rot.y}°</div>
                                    <div><span style={{ color: '#3b82f6' }}>Z:</span> {data.transform.rot.z}°</div>
                                </div>
                            </>
                        )}

                        {data.transform.scale && (
                            <>
                                <div className="item-section-divider">Skala (Scale)</div>
                                <div className="item-xyz-grid">
                                    <div><span style={{ color: '#ef4444' }}>X:</span> {data.transform.scale.x}</div>
                                    <div><span style={{ color: '#22c55e' }}>Y:</span> {data.transform.scale.y}</div>
                                    <div><span style={{ color: '#3b82f6' }}>Z:</span> {data.transform.scale.z}</div>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* ═══════════════════════════════════════════════ */}
                {/* TAB: Properties — Parametry specyficzne         */}
                {/* ═══════════════════════════════════════════════ */}
                {activeTab === 'properties' && (
                    <>
                        {data.kind === 'hole' && data.holeProps && (
                            <>
                                <div className="item-section-divider">Parametry otworu</div>
                                <div className="item-field">
                                    <label>Średnica (⌀):</label>
                                    <span className="item-highlight">{data.holeProps.diameter} mm</span>
                                </div>
                                <div className="item-field">
                                    <label>Głębokość:</label>
                                    <span className="item-highlight">{data.holeProps.depth} mm</span>
                                </div>
                                <div className="item-field">
                                    <label>Ściana (Face):</label>
                                    <span style={{ color: '#60a5fa' }}>{data.holeProps.face}</span>
                                </div>
                                <div className="item-section-divider">Współrzędne UV</div>
                                <div className="item-field">
                                    <label>U (poziomo):</label>
                                    <span>{data.holeProps.u} mm</span>
                                </div>
                                <div className="item-field">
                                    <label>V (pionowo):</label>
                                    <span>{data.holeProps.v} mm</span>
                                </div>
                            </>
                        )}

                        {data.kind === 'panel' && data.panelProps && (
                            <>
                                <div className="item-section-divider">Wymiary płyty</div>
                                <div className="item-field">
                                    <label>Szerokość (W):</label>
                                    <span className="item-highlight">{data.panelProps.width} mm</span>
                                </div>
                                <div className="item-field">
                                    <label>Grubość (T):</label>
                                    <span className="item-highlight">{data.panelProps.thickness} mm</span>
                                </div>
                                <div className="item-field">
                                    <label>Wysokość (H):</label>
                                    <span className="item-highlight">{data.panelProps.height} mm</span>
                                </div>
                            </>
                        )}

                        {data.kind === 'container' && data.containerProps && (
                            <>
                                <div className="item-section-divider">Gabaryty kontenera</div>
                                <div className="item-field">
                                    <label>Szerokość (W):</label>
                                    <span className="item-highlight">{data.containerProps.width} mm</span>
                                </div>
                                <div className="item-field">
                                    <label>Wysokość (H):</label>
                                    <span className="item-highlight">{data.containerProps.height} mm</span>
                                </div>
                                <div className="item-field">
                                    <label>Głębokość (D):</label>
                                    <span className="item-highlight">{data.containerProps.depth} mm</span>
                                </div>
                                {data.containerProps.panelCount !== undefined && (
                                    <div className="item-field">
                                        <label>Liczba płyt:</label>
                                        <span>{data.containerProps.panelCount}</span>
                                    </div>
                                )}
                            </>
                        )}

                        {data.kind === 'groove' && data.grooveProps && (
                            <>
                                <div className="item-section-divider">
                                    {data.grooveProps.editable ? 'Operacja Smart' : 'Wpust silnika'}
                                </div>
                                {!data.grooveProps.editable && (
                                    <div style={{ color: '#71717a', fontSize: '0.78rem', padding: '4px 0 8px' }}>
                                        Sterowany parametrami korpusu — bez edycji ręcznej.
                                    </div>
                                )}
                                {data.grooveProps.editable && data.grooveProps.placement === 'edge_dims' ? (
                                    <>
                                        <div className="item-field">
                                            <label>Szerokość:</label>
                                            <SmartNumericInput
                                                value={data.grooveProps.width || 120}
                                                min={1}
                                                max={2000}
                                                step={1}
                                                unit="mm"
                                                onChange={(val) => applyGrooveEdit({
                                                    widthMm: val,
                                                    heightMm: data.grooveProps!.length,
                                                    uMm: data.grooveProps!.uRef,
                                                    vMm: data.grooveProps!.vRef,
                                                })}
                                            />
                                        </div>
                                        <div className="item-field">
                                            <label>Wysokość:</label>
                                            <SmartNumericInput
                                                value={data.grooveProps.length || 80}
                                                min={1}
                                                max={2000}
                                                step={1}
                                                unit="mm"
                                                onChange={(val) => applyGrooveEdit({
                                                    widthMm: data.grooveProps!.width,
                                                    heightMm: val,
                                                    uMm: data.grooveProps!.uRef,
                                                    vMm: data.grooveProps!.vRef,
                                                })}
                                            />
                                        </div>
                                        <div className="item-field">
                                            <label>Od krawędzi (szer.):</label>
                                            <SmartNumericInput
                                                value={data.grooveProps.uRef ?? 0}
                                                min={0}
                                                max={2000}
                                                step={1}
                                                unit="mm"
                                                onChange={(val) => applyGrooveEdit({
                                                    widthMm: data.grooveProps!.width,
                                                    heightMm: data.grooveProps!.length,
                                                    uMm: val,
                                                    vMm: data.grooveProps!.vRef,
                                                })}
                                            />
                                        </div>
                                        <div className="item-field">
                                            <label>Od krawędzi (wys.):</label>
                                            <SmartNumericInput
                                                value={data.grooveProps.vRef ?? 0}
                                                min={0}
                                                max={2000}
                                                step={1}
                                                unit="mm"
                                                onChange={(val) => applyGrooveEdit({
                                                    widthMm: data.grooveProps!.width,
                                                    heightMm: data.grooveProps!.length,
                                                    uMm: data.grooveProps!.uRef,
                                                    vMm: val,
                                                })}
                                            />
                                        </div>
                                    </>
                                ) : data.grooveProps.editable ? (
                                    <>
                                        <div className="item-field">
                                            <label>Szerokość ramki:</label>
                                            <SmartNumericInput
                                                value={data.grooveProps.frameMm || 60}
                                                min={1}
                                                max={500}
                                                step={1}
                                                unit="mm"
                                                onChange={(val) => applyGrooveEdit({
                                                    frameWMm: val,
                                                    frameHMm: data.grooveProps!.frameHMm || val,
                                                    depthMm: data.grooveProps!.depth,
                                                })}
                                            />
                                        </div>
                                        <div className="item-field">
                                            <label>Wysokość ramki:</label>
                                            <SmartNumericInput
                                                value={data.grooveProps.frameHMm || data.grooveProps.frameMm || 60}
                                                min={1}
                                                max={500}
                                                step={1}
                                                unit="mm"
                                                onChange={(val) => applyGrooveEdit({
                                                    frameWMm: data.grooveProps!.frameMm || val,
                                                    frameHMm: val,
                                                    depthMm: data.grooveProps!.depth,
                                                })}
                                            />
                                        </div>
                                        <div className="item-field">
                                            <label>Głębokość:</label>
                                            <SmartNumericInput
                                                value={data.grooveProps.depth}
                                                min={0.1}
                                                max={50}
                                                step={0.1}
                                                unit="mm"
                                                disabled={!!data.grooveProps.through}
                                                onChange={(val) => applyGrooveEdit({
                                                    frameWMm: data.grooveProps!.frameMm,
                                                    frameHMm: data.grooveProps!.frameHMm,
                                                    depthMm: val,
                                                })}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="item-field">
                                            <label>Szerokość:</label>
                                            <span className="item-highlight">{data.grooveProps.width} mm</span>
                                        </div>
                                        <div className="item-field">
                                            <label>Głębokość:</label>
                                            <span className="item-highlight">{data.grooveProps.depth} mm</span>
                                        </div>
                                    </>
                                )}
                                <div className="item-field">
                                    <label>Ściana:</label>
                                    <span style={{ color: '#60a5fa' }}>{data.grooveProps.face}</span>
                                </div>
                            </>
                        )}

                        {data.kind === 'fillet' && (
                            <>
                                <div className="item-section-divider">Parametry zaokrąglenia</div>
                                <div className="item-field">
                                    <label>Typ:</label>
                                    <span>Zaokrąglenie krawędzi (Fillet)</span>
                                </div>
                            </>
                        )}

                        {data.kind === 'unknown' && (
                            <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.78rem', padding: '8px 0' }}>
                                Brak szczegółowych parametrów dla tego obiektu.
                            </div>
                        )}
                    </>
                )}

                {/* ═══════════════════════════════════════════════ */}
                {/* TAB: Custom — Właściwości użytkownika           */}
                {/* ═══════════════════════════════════════════════ */}
                {activeTab === 'custom' && (
                    <>
                        <div className="item-section-divider">Custom Properties</div>

                        {data.customProperties.length === 0 && (
                            <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.78rem', padding: '4px 0' }}>
                                Brak zdefiniowanych właściwości.
                            </div>
                        )}

                        {data.customProperties.map((cp: CustomProperty) => (
                            <div key={cp.key} className="custom-prop-row">
                                <span className="custom-prop-key">{cp.key}</span>
                                <input
                                    className="custom-prop-value"
                                    type={cp.type === 'number' ? 'number' : 'text'}
                                    value={cp.value}
                                    onChange={(e) => handleUpdateCustomProp(cp.key, e.target.value)}
                                />
                                <button
                                    className="custom-prop-delete"
                                    onClick={() => handleRemoveCustomProp(cp.key)}
                                    title="Usuń"
                                >×</button>
                            </div>
                        ))}

                        <div className="item-section-divider" style={{ marginTop: '10px' }}>Dodaj nową</div>
                        <div className="custom-prop-add-row">
                            <input
                                className="custom-prop-input"
                                type="text"
                                placeholder="Klucz"
                                value={newPropKey}
                                onChange={(e) => setNewPropKey(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomProp(); }}
                            />
                            <input
                                className="custom-prop-input"
                                type="text"
                                placeholder="Wartość"
                                value={newPropValue}
                                onChange={(e) => setNewPropValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomProp(); }}
                            />
                            <button
                                className="custom-prop-add-btn"
                                onClick={handleAddCustomProp}
                                disabled={!newPropKey.trim()}
                                title="Dodaj właściwość"
                            >+</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PropertiesPanel;
