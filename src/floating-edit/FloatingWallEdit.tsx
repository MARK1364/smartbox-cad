/**
 * Formularz edycji SmartWall (skos pod schody, ściana, pokój) w oknie na scenie.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ContextManager } from '../../A1_core/context-manager.js';
import { SmartNumericInput } from '../../A1_core/ui/SmartNumericInput.js';
import {
    SetSmartWallParamsCommand,
    type SmartWallParamsSnapshotMm,
} from '../../S4_sciany/commands/set-smartwall-params-command.js';
import type { SmartWallPreset } from '../../S4_sciany/smartwall-types.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import scianyTekstRaw from '../../S4_sciany/sciany_tekst.json';

const scianyTekst = scianyTekstRaw as unknown as ModuleTexts;
const TX_NS = 'sciany';

const fieldRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
};

const labelStyle: React.CSSProperties = {
    color: '#cbd5e1',
    fontSize: '11px',
    fontWeight: 500,
    flex: '0 0 100px',
};

const numWrapperStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
};

function executeCmd(cmd: { execute: (doc: any) => void }): void {
    const history = ContextManager.instance.commandHistory;
    if (history && typeof history.execute === 'function') {
        history.execute(cmd as any);
    } else {
        const doc = ContextManager.instance.document;
        if (doc) (cmd as any).execute(doc);
    }
}

export function FloatingWallEdit({ container }: { container: any }): React.JSX.Element | null {
    useLocale();

    const [snapshot, setSnapshot] = useState<SmartWallParamsSnapshotMm | null>(null);

    const sync = useCallback(() => {
        if (!container) {
            setSnapshot(null);
            return;
        }
        setSnapshot(SetSmartWallParamsCommand.snapshotFrom(container));
    }, [container]);

    useEffect(() => {
        sync();
        const onChange = () => sync();
        window.document.addEventListener('bloki-project-changed', onChange);
        return () => window.document.removeEventListener('bloki-project-changed', onChange);
    }, [sync]);

    if (!container || !snapshot) return null;

    const commitPatch = (patch: Partial<SmartWallParamsSnapshotMm>) => {
        const before = SetSmartWallParamsCommand.snapshotFrom(container);
        const after = { ...before, ...patch };
        executeCmd(new SetSmartWallParamsCommand(container.id, before, after));
        ContextManager.instance.viewport?.requestRender?.(4);
    };

    const preset: SmartWallPreset = snapshot.preset;
    const isSkos = preset === 'skos';
    const isSingle = preset === 'single';

    // Kąt nachylenia skosu dla podglądu technicznego
    const diffH = Math.abs(snapshot.skosHeightLeft - snapshot.skosHeightRight);
    const angleDeg = snapshot.skosLength > 0 ? (Math.atan2(diffH, snapshot.skosLength) * 180) / Math.PI : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isSkos && (
                <>
                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.single_length', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.skosLength}
                                decimals={0}
                                unit="mm"
                                min={100}
                                max={20000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ skosLength: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.skos_height_left', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.skosHeightLeft}
                                decimals={0}
                                unit="mm"
                                min={10}
                                max={6000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ skosHeightLeft: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.skos_height_right', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.skosHeightRight}
                                decimals={0}
                                unit="mm"
                                min={10}
                                max={6000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ skosHeightRight: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.wall_thickness', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.wallThickness}
                                decimals={0}
                                unit="mm"
                                min={10}
                                max={2000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ wallThickness: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.skos_slant', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <select
                                value={snapshot.skosSlant}
                                onChange={(e) => {
                                    const v = e.target.value === 'top' ? 'top' : 'bottom';
                                    commitPatch({ skosSlant: v });
                                }}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '5px 8px',
                                    border: '1px solid #3f3f46',
                                    borderRadius: 4,
                                    fontSize: '12px',
                                    color: '#f8fafc',
                                    background: '#18181b',
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                <option value="bottom">{tx(scianyTekst, 'params.skos_slant_bottom', TX_NS)}</option>
                                <option value="top">{tx(scianyTekst, 'params.skos_slant_top', TX_NS)}</option>
                            </select>
                        </div>
                    </div>

                    <div
                        style={{
                            padding: '6px 8px',
                            background: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '2px',
                        }}
                    >
                        <span style={{ color: '#94a3b8' }}>Kąt nachylenia skosu</span>
                        <strong style={{ color: '#93c5fd' }}>{angleDeg.toFixed(2)}°</strong>
                    </div>
                </>
            )}

            {isSingle && (
                <>
                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.single_length', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.singleLength ?? 3000}
                                decimals={0}
                                unit="mm"
                                min={100}
                                max={20000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ singleLength: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.wall_height', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.wallHeight}
                                decimals={0}
                                unit="mm"
                                min={100}
                                max={6000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ wallHeight: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.wall_thickness', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.wallThickness}
                                decimals={0}
                                unit="mm"
                                min={20}
                                max={500}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ wallThickness: v })}
                            />
                        </div>
                    </div>
                </>
            )}

            {!isSkos && !isSingle && (
                <>
                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.room_width', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.roomWidth}
                                decimals={0}
                                unit="mm"
                                min={500}
                                max={20000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ roomWidth: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.room_depth', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.roomDepth}
                                decimals={0}
                                unit="mm"
                                min={500}
                                max={20000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ roomDepth: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.wall_height', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.wallHeight}
                                decimals={0}
                                unit="mm"
                                min={100}
                                max={6000}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ wallHeight: v })}
                            />
                        </div>
                    </div>

                    <div style={fieldRow}>
                        <span style={labelStyle}>{tx(scianyTekst, 'params.wall_thickness', TX_NS)}</span>
                        <div style={numWrapperStyle}>
                            <SmartNumericInput
                                value={snapshot.wallThickness}
                                decimals={0}
                                unit="mm"
                                min={20}
                                max={500}
                                style={{ width: '100%' }}
                                onChange={(v) => commitPatch({ wallThickness: v })}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
