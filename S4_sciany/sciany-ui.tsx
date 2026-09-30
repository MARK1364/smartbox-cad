/**
 * S4_sciany — UI: SmartWall (kontener + PART, podłoga jako 5. element pokoju).
 * Tylko drag&drop na scenę 3D (klik NIC nie wstawia).
 * Karty: Pokój □ + Ściana. Teksty z sciany_tekst.json (pl/en/de).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { SetSmartWallParamsCommand } from './commands/set-smartwall-params-command.js';
import { SMARTWALL_DRAG_MIME, isSmartWallContainer, type SmartWallDragPayload, type SmartWallPreset } from './smartwall-types.js';
import { SmartWallDragController } from './smartwall-drag-controller.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import scianyTekstRaw from './sciany_tekst.json';

const scianyTekst = scianyTekstRaw as unknown as ModuleTexts;
const TX_NS = 'sciany';

interface Props {
    projectModel?: any;
}

function executeCmd(cmd: { execute: (doc: any) => void }): void {
    const history = ContextManager.instance.commandHistory;
    if (history && typeof history.execute === 'function') {
        history.execute(cmd as any);
    } else {
        const doc = ContextManager.instance.document;
        if (doc) (cmd as any).execute(doc);
    }
}

function getActiveSmartWall(): any | null {
    const doc = ContextManager.instance.document;
    const entity = (doc as any)?.activeEntity || (ContextManager.instance as any).activeEntity;
    if (entity && isSmartWallContainer(entity)) return entity;
    const node = (doc as any)?.activeNode;
    if (node?.domainData && isSmartWallContainer(node.domainData)) return node.domainData;
    // PART zaznaczony → rodzic SmartWall
    if (node?.parent?.domainData && isSmartWallContainer(node.parent.domainData)) {
        return node.parent.domainData;
    }
    return null;
}

function getDragController(): SmartWallDragController {
    if (!ContextManager.instance.smartWallDragController) {
        ContextManager.instance.smartWallDragController = new SmartWallDragController();
    }
    return ContextManager.instance.smartWallDragController;
}

const HAND_ICON = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
);

function CardIcon({ kind }: { kind: 'rect' | 'single' | 'skos' }) {
    const stroke = '#c9c2b4';
    if (kind === 'rect') {
        return (
            <svg width="34" height="30" viewBox="0 0 34 30" fill="none" stroke={stroke} strokeWidth="2">
                <rect x="3" y="6" width="28" height="18" rx="1" />
                <rect x="7" y="10" width="20" height="10" fill="#e8e2d2" fillOpacity="0.12" strokeDasharray="2 2" strokeWidth="1" />
            </svg>
        );
    }
    if (kind === 'skos') {
        return (
            <svg width="34" height="30" viewBox="0 0 34 30" fill="none" stroke={stroke} strokeWidth="2">
                <path d="M4 24 L4 8 L30 18 L30 24 Z" />
                <line x1="4" y1="24" x2="30" y2="24" strokeWidth="1.5" />
            </svg>
        );
    }
    return (
        <svg width="34" height="30" viewBox="0 0 34 30" fill="none" stroke={stroke} strokeWidth="2">
            <line x1="4" y1="15" x2="30" y2="15" strokeWidth="3" />
            <line x1="4" y1="11" x2="4" y2="19" strokeWidth="1.5" />
            <line x1="30" y1="11" x2="30" y2="19" strokeWidth="1.5" />
        </svg>
    );
}

const SECTION_STYLE: React.CSSProperties = {
    background: '#202023',
    border: '1px solid #333338',
    borderRadius: 8,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
};

const CARD_STYLE: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 4px 10px',
    background: 'var(--bg-secondary, #252528)',
    border: '1px solid var(--border-color, #3a3a3e)',
    borderRadius: 6,
    cursor: 'grab',
    transition: 'border-color 0.15s ease, transform 0.15s ease',
    userSelect: 'none',
};

export function ScianyUI(_props: Props) {
    useLocale();

    // Aktywny SmartWall — parametry pojawiają się dopiero po upuszczeniu
    // karty na scenę i zaznaczeniu elementu (pokoju / ściany).
    const [activeName, setActiveName] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState<SmartWallPreset>('rect');
    const [roomWidth, setRoomWidth] = useState(4000);
    const [roomDepth, setRoomDepth] = useState(3000);
    const [wallHeight, setWallHeight] = useState(2700);
    const [wallThickness, setWallThickness] = useState(100);
    const [singleLength, setSingleLength] = useState(3000);
    const [skosLength, setSkosLength] = useState(2000);
    const [skosHeightLeft, setSkosHeightLeft] = useState(1800);
    const [skosHeightRight, setSkosHeightRight] = useState(900);
    const [skosSlant, setSkosSlant] = useState<'top' | 'bottom'>('bottom');

    const syncFromActive = useCallback(() => {
        const sw = getActiveSmartWall();
        if (!sw) {
            setActiveName(null);
            return;
        }
        setActiveName(sw.name);
        const snap = SetSmartWallParamsCommand.snapshotFrom(sw);
        setActivePreset(snap.preset);
        setRoomWidth(snap.roomWidth);
        setRoomDepth(snap.roomDepth);
        setWallHeight(snap.wallHeight);
        setWallThickness(snap.wallThickness);
        if (snap.singleLength != null) setSingleLength(snap.singleLength);
        setSkosLength(snap.skosLength);
        setSkosHeightLeft(snap.skosHeightLeft);
        setSkosHeightRight(snap.skosHeightRight);
        setSkosSlant(snap.skosSlant);
    }, []);

    useEffect(() => {
        syncFromActive();
        const onChange = () => syncFromActive();
        window.document.addEventListener('bloki-project-changed', onChange);
        return () => window.document.removeEventListener('bloki-project-changed', onChange);
    }, [syncFromActive]);

    const commitDims = (patch: Partial<{ roomWidth: number; roomDepth: number; wallHeight: number; wallThickness: number; singleLength: number; skosLength: number; skosHeightLeft: number; skosHeightRight: number; skosSlant: 'top' | 'bottom' }>) => {
        const sw = getActiveSmartWall();
        if (!sw) return;
        const before = SetSmartWallParamsCommand.snapshotFrom(sw);
        const after = {
            ...before,
            roomWidth: patch.roomWidth ?? before.roomWidth,
            roomDepth: patch.roomDepth ?? before.roomDepth,
            wallHeight: patch.wallHeight ?? before.wallHeight,
            wallThickness: patch.wallThickness ?? before.wallThickness,
            singleLength: patch.singleLength ?? before.singleLength,
            skosLength: patch.skosLength ?? before.skosLength,
            skosHeightLeft: patch.skosHeightLeft ?? before.skosHeightLeft,
            skosHeightRight: patch.skosHeightRight ?? before.skosHeightRight,
            skosSlant: patch.skosSlant ?? before.skosSlant,
        };
        executeCmd(new SetSmartWallParamsCommand(sw.id, before, after));
    };

    /** Domyślne wymiary wstawianego elementu [mm] — edycja dopiero po upuszczeniu. */
    const buildPayload = (kind: 'rect' | 'single' | 'skos'): SmartWallDragPayload => {
        if (kind === 'rect') {
            return { preset: 'rect', name: 'Pokój □', roomWidth: 4000, roomDepth: 3000, wallHeight: 2700, wallThickness: 100 };
        }
        if (kind === 'skos') {
            return { preset: 'skos', name: 'Skos', skosLength: 2000, skosHeightLeft: 1800, skosHeightRight: 900, wallThickness: 500, skosSlant: 'bottom' };
        }
        return { preset: 'single', name: 'Ściana', singleLength: 3000, wallHeight: 2700, wallThickness: 100 };
    };

    const handleDragStart = (kind: 'rect' | 'single' | 'skos', e: React.DragEvent) => {
        const payload = buildPayload(kind);
        getDragController().startDrag(payload);
        try {
            e.dataTransfer.setData(SMARTWALL_DRAG_MIME, JSON.stringify(payload));
            e.dataTransfer.effectAllowed = 'copy';
        } catch { /* ignoruj */ }
    };

    const handleDragEnd = () => {
        getDragController().endDrag();
    };

    const cards: { kind: 'rect' | 'single' | 'skos'; labelKey: string; titleKey: string }[] = [
        { kind: 'rect', labelKey: 'cards.rect.label', titleKey: 'cards.rect.title' },
        { kind: 'single', labelKey: 'cards.single.label', titleKey: 'cards.single.title' },
        { kind: 'skos', labelKey: 'cards.skos.label', titleKey: 'cards.skos.title' },
    ];

    const renderField = (label: string, field: React.ReactNode) => (
        <div className="input-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: '0 0 92px', fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>{label}</span>
            <div style={{ flex: 1, minWidth: 0 }}>{field}</div>
        </div>
    );

    const numStyle: React.CSSProperties = { width: '100%' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, overflow: 'auto' }}>
            <div className="panel-header" style={{ padding: 0 }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>{tx(scianyTekst, 'panel.title', TX_NS)}</h2>
                <p className="subtitle" style={{ margin: '4px 0 0' }}>
                    {tx(scianyTekst, 'panel.subtitle', TX_NS)}
                </p>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #ddd)' }}>
                {tx(scianyTekst, 'cards.add_title', TX_NS)}
            </div>
            <div style={{ fontSize: 11, color: '#71717a' }}>{tx(scianyTekst, 'cards.hint_status', TX_NS)}</div>

            {/* Tylko drag&drop — brak onClick, klik nic nie wstawia. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {cards.map((c) => (
                    <div
                        key={c.kind}
                        className="smartwall-drag-card"
                        draggable
                        onDragStart={(e) => handleDragStart(c.kind, e)}
                        onDragEnd={handleDragEnd}
                        title={tx(scianyTekst, c.titleKey, TX_NS)}
                        style={CARD_STYLE}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#a8a29e';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color, #3a3a3e)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <CardIcon kind={c.kind} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6 }}>
                            <span className="hand-icon" title={tx(scianyTekst, 'cards.drag_hint', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#d6cfae' }}>
                                {HAND_ICON}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary, #aaa)' }}>
                                {tx(scianyTekst, c.labelKey, TX_NS)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div style={SECTION_STYLE}>
                <div style={{ fontSize: 11, color: '#a1a1aa' }}>
                    {tx(scianyTekst, 'params.active', TX_NS)}{' '}
                    <strong style={{ color: '#fafafa' }}>{activeName || '—'}</strong>
                </div>
                {!activeName && (
                    <div style={{ fontSize: 11, color: '#71717a' }}>
                        {tx(scianyTekst, 'params.empty_hint', TX_NS)}
                    </div>
                )}
                {activeName && activePreset === 'single' && (
                    <>
                        {renderField(tx(scianyTekst, 'params.single_length', TX_NS), (
                            <SmartNumericInput
                                value={singleLength}
                                decimals={0}
                                unit="mm"
                                min={100}
                                max={20000}
                                style={numStyle}
                                onChange={(v) => {
                                    setSingleLength(v);
                                    commitDims({ singleLength: v });
                                }}
                            />
                        ))}
                        {renderField(tx(scianyTekst, 'params.wall_height', TX_NS), (
                            <SmartNumericInput
                                value={wallHeight}
                                decimals={0}
                                unit="mm"
                                min={100}
                                max={6000}
                                style={numStyle}
                                onChange={(v) => {
                                    setWallHeight(v);
                                    commitDims({ wallHeight: v });
                                }}
                            />
                        ))}
                        {renderField(tx(scianyTekst, 'params.wall_thickness', TX_NS), (
                            <SmartNumericInput
                                value={wallThickness}
                                decimals={0}
                                unit="mm"
                                min={20}
                                max={500}
                                style={numStyle}
                                onChange={(v) => {
                                    setWallThickness(v);
                                    commitDims({ wallThickness: v });
                                }}
                            />
                        ))}
                    </>
                )}
                {activeName && activePreset === 'skos' && (
                    <>
                        {renderField(tx(scianyTekst, 'params.single_length', TX_NS), (
                            <SmartNumericInput
                                value={skosLength}
                                decimals={0}
                                unit="mm"
                                min={100}
                                max={20000}
                                style={numStyle}
                                onChange={(v) => {
                                    setSkosLength(v);
                                    commitDims({ skosLength: v });
                                }}
                            />
                        ))}
                        {renderField(tx(scianyTekst, 'params.skos_height_left', TX_NS), (
                            <SmartNumericInput
                                value={skosHeightLeft}
                                decimals={0}
                                unit="mm"
                                min={10}
                                max={6000}
                                style={numStyle}
                                onChange={(v) => {
                                    setSkosHeightLeft(v);
                                    commitDims({ skosHeightLeft: v });
                                }}
                            />
                        ))}
                        {renderField(tx(scianyTekst, 'params.skos_height_right', TX_NS), (
                            <SmartNumericInput
                                value={skosHeightRight}
                                decimals={0}
                                unit="mm"
                                min={10}
                                max={6000}
                                style={numStyle}
                                onChange={(v) => {
                                    setSkosHeightRight(v);
                                    commitDims({ skosHeightRight: v });
                                }}
                            />
                        ))}
                        {renderField(tx(scianyTekst, 'params.skos_slant', TX_NS), (
                            <select
                                value={skosSlant}
                                onChange={(e) => {
                                    const v = e.target.value === 'top' ? 'top' : 'bottom';
                                    setSkosSlant(v);
                                    commitDims({ skosSlant: v });
                                }}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '6px 10px',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: 6,
                                    fontSize: '0.85rem',
                                    color: '#f8fafc',
                                    background: 'rgba(0, 0, 0, 0.4)',
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                <option value="bottom">{tx(scianyTekst, 'params.skos_slant_bottom', TX_NS)}</option>
                                <option value="top">{tx(scianyTekst, 'params.skos_slant_top', TX_NS)}</option>
                            </select>
                        ))}
                        {renderField(tx(scianyTekst, 'params.wall_thickness', TX_NS), (
                            <SmartNumericInput
                                value={wallThickness}
                                decimals={0}
                                unit="mm"
                                min={10}
                                max={500}
                                style={numStyle}
                                onChange={(v) => {
                                    setWallThickness(v);
                                    commitDims({ wallThickness: v });
                                }}
                            />
                        ))}
                    </>
                )}
                {activeName && activePreset !== 'single' && activePreset !== 'skos' && (
                    <>
                        {renderField(tx(scianyTekst, 'params.room_width', TX_NS), (
                            <SmartNumericInput
                                value={roomWidth}
                                decimals={0}
                                unit="mm"
                                min={500}
                                max={20000}
                                style={numStyle}
                                onChange={(v) => {
                                    setRoomWidth(v);
                                    commitDims({ roomWidth: v });
                                }}
                            />
                        ))}
                        {renderField(tx(scianyTekst, 'params.room_depth', TX_NS), (
                            <SmartNumericInput
                                value={roomDepth}
                                decimals={0}
                                unit="mm"
                                min={500}
                                max={20000}
                                style={numStyle}
                                onChange={(v) => {
                                    setRoomDepth(v);
                                    commitDims({ roomDepth: v });
                                }}
                            />
                        ))}
                        {renderField(tx(scianyTekst, 'params.wall_height', TX_NS), (
                            <SmartNumericInput
                                value={wallHeight}
                                decimals={0}
                                unit="mm"
                                min={100}
                                max={6000}
                                style={numStyle}
                                onChange={(v) => {
                                    setWallHeight(v);
                                    commitDims({ wallHeight: v });
                                }}
                            />
                        ))}
                        {renderField(tx(scianyTekst, 'params.wall_thickness', TX_NS), (
                            <SmartNumericInput
                                value={wallThickness}
                                decimals={0}
                                unit="mm"
                                min={20}
                                max={500}
                                style={numStyle}
                                onChange={(v) => {
                                    setWallThickness(v);
                                    commitDims({ wallThickness: v });
                                }}
                            />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
