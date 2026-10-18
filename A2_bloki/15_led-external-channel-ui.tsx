/**
 * Komponent UI do zarządzania parametrycznym Kontenerem Narzędziowym Kanału LED.
 * Zapewnia interaktywne wskazywanie 4 referencji płaszczyzn w 3D (Lewa, Prawa, Dół, Front),
 * parametry profilu oraz podgląd stanu asocjacji.
 */

import React, { useEffect, useState } from 'react';
import { ContextManager } from '../A1_core/context-manager.js';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { planeRefLabel, type AssocPlaneRef } from '../A4_smartpanel/associative-dim.js';
import { LedChannelStore } from './15_led-external-channel-store.js';
import type { LedChannelDefinition } from './15_led-external-channel-types.js';

type SideKey = 'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax';

const inputStyle: React.CSSProperties = {
    width: '74px',
    padding: '4px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '4px',
    textAlign: 'right',
    fontSize: '12px',
};

const slotConfig: Record<SideKey, {
    refKey: keyof Pick<LedChannelDefinition, 'refLeft' | 'refRight' | 'refFront' | 'refBack' | 'refBottom' | 'refTop'>;
    title: string;
    hint: string;
}> = {
    xMin: { refKey: 'refLeft', title: 'Bok Lewy', hint: 'lewą skrajną ścianę (Bok L)' },
    xMax: { refKey: 'refRight', title: 'Bok Prawy', hint: 'prawą skrajną ścianę (Bok P)' },
    yMin: { refKey: 'refFront', title: 'Przód', hint: 'płaszczyznę frontową szafek' },
    yMax: { refKey: 'refBack', title: 'Tył', hint: 'plecy / tył szafek' },
    zMin: { refKey: 'refBottom', title: 'Dół', hint: 'dolną płaszczyznę wieńca (Dół)' },
    zMax: { refKey: 'refTop', title: 'Góra', hint: 'górny wieniec szafek (Góra)' },
};

export const LedChannelUI: React.FC = () => {
    const store = LedChannelStore.instance;
    const [tick, setTick] = useState(0);
    const [isRefsOpen, setIsRefsOpen] = useState(false);
    const [pickingSlot, setPickingSlot] = useState<SideKey | null>(null);

    useEffect(() => {
        const unsub = store.subscribe(() => setTick((t) => t + 1));
        return () => {
            unsub();
            if (ContextManager.instance.activeReferencePicker?.source?.startsWith('led-channel-')) {
                delete ContextManager.instance.activeReferencePicker;
            }
        };
    }, [store]);

    void tick;

    const channel: LedChannelDefinition = store.getOrCreateDefault();
    const offsets = channel.offsets || {};
    const disabledRefs = channel.disabledReferences || {};

    const stopPick = () => {
        setPickingSlot(null);
        delete ContextManager.instance.activeReferencePicker;
        const picker = ContextManager.instance.facePicker as any;
        if (picker?.resetAllFaceHighlights) picker.resetAllFaceHighlights();
        else if (picker?.clearSelection) picker.clearSelection();
        ContextManager.instance.appAPI?.setSelectionMode?.('object');
        ContextManager.instance.appAPI?.setStatus?.('Gotowy');
    };

    const startPick = (sideKey: SideKey) => {
        if (pickingSlot === sideKey) {
            stopPick();
            return;
        }

        const config = slotConfig[sideKey];
        const picker = ContextManager.instance.facePicker as any;
        if (picker?.resetAllFaceHighlights) picker.resetAllFaceHighlights();
        else if (picker?.clearSelection) picker.clearSelection();

        setPickingSlot(sideKey);
        ContextManager.instance.appAPI?.setSelectionMode?.('subgeometry');
        ContextManager.instance.appAPI?.setStatus?.(
            `Wskaż w 3D ${config.hint}…`,
            true,
        );

        ContextManager.instance.activeReferencePicker = {
            source: `led-channel-${channel.id}-${sideKey}`,
            onSelect: (refData: { nodeId?: string; face?: string; panelModel?: any; partKey?: string }) => {
                const nodeId = refData.nodeId || refData.panelModel?.id;
                const face = refData.face;
                if (!nodeId || !face) return;

                const ref: AssocPlaneRef = {
                    nodeId,
                    face,
                    label: refData.panelModel?.name || refData.partKey || nodeId,
                };

                const updatedDisabled = { ...(channel.disabledReferences || {}), [sideKey]: false };
                store.updateChannel(channel.id, {
                    [config.refKey]: ref,
                    disabledReferences: updatedDisabled,
                });
                stopPick();
            },
        };
    };

    const handleClearOrRestoreRef = (sideKey: SideKey) => {
        const config = slotConfig[sideKey];
        const isDisabled = !!disabledRefs[sideKey];
        const updatedDisabled = { ...disabledRefs, [sideKey]: !isDisabled };

        if (isDisabled) {
            // Przywróć
            store.updateChannel(channel.id, { disabledReferences: updatedDisabled });
        } else {
            // Wyłącz / wyczyść
            store.updateChannel(channel.id, {
                [config.refKey]: null,
                disabledReferences: updatedDisabled,
            });
        }
    };

    const handleOffsetChange = (sideKey: SideKey, rawVal: string) => {
        const val = parseFloat(rawVal) || 0;
        const newOffsets = { ...offsets, [sideKey]: val };
        const patch: Partial<LedChannelDefinition> = { offsets: newOffsets };
        if (sideKey === 'yMin') {
            patch.offsetFromFrontMm = val;
        }
        store.updateChannel(channel.id, patch);
    };

    const applyPreset = (w: number, d: number) => {
        store.updateChannel(channel.id, {
            grooveWidthMm: w,
            grooveDepthMm: d,
        });
    };

    const renderRefSlot = (sideKey: SideKey, defaultName: string) => {
        const config = slotConfig[sideKey];
        const ref = channel[config.refKey] as AssocPlaneRef | null | undefined;
        const isCustom = Boolean(ref);
        const isDisabled = Boolean(disabledRefs[sideKey]);
        const isPicking = pickingSlot === sideKey;

        let labelText = defaultName;
        if (isPicking) labelText = 'Wskaż w 3D...';
        else if (isDisabled) labelText = 'Brak (wskaż w 3D)';
        else if (ref) labelText = planeRefLabel(ref);

        return (
            <div
                key={sideKey}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: '#16191f',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: isPicking ? '1px solid #eab308' : (isDisabled ? '1px dashed #71717a' : '1px solid #272a30'),
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                        {defaultName}
                    </span>
                    {isCustom && <span style={{ fontSize: '9px', color: '#60a5fa', fontStyle: 'italic' }}>custom</span>}
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => startPick(sideKey)}
                        style={{
                            flex: 1,
                            padding: '4px 8px',
                            background: isPicking ? '#eab308' : (isDisabled ? '#1f242d' : '#222730'),
                            border: '1px solid #3b4252',
                            color: isPicking ? '#000' : (isDisabled ? '#facc15' : '#fff'),
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: isPicking ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                        title={`Kliknij, aby wskazać ${defaultName} w 3D`}
                    >
                        {labelText}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleClearOrRestoreRef(sideKey)}
                        title={isDisabled ? 'Przywróć domyślne odniesienie' : 'Wyłącz odniesienie'}
                        style={{
                            padding: '4px 8px',
                            background: '#222730',
                            border: '1px solid #3b4252',
                            color: isDisabled ? '#4ade80' : '#ef4444',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                        }}
                    >
                        {isDisabled ? '↺' : '✕'}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span style={{ color: '#8c93a0', fontSize: '11px' }}>Offset:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="number"
                            value={offsets[sideKey] !== undefined ? offsets[sideKey] : 0}
                            onChange={(e) => handleOffsetChange(sideKey, e.target.value)}
                            onBlur={(e) => {
                                const v = parseFloat(e.target.value) || 0;
                                handleOffsetChange(sideKey, String(v));
                            }}
                            style={{
                                width: '55px',
                                padding: '2px 4px',
                                background: '#121418',
                                border: '1px solid #3b4252',
                                color: '#fff',
                                borderRadius: '3px',
                                textAlign: 'right',
                                fontSize: '11px',
                            }}
                        />
                        <span style={{ color: '#8c93a0', fontSize: '10px' }}>mm</span>
                    </div>
                </div>
            </div>
        );
    };

    const isComplete = Boolean(channel.refLeft && channel.refRight && channel.refBottom && channel.refFront);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
                className={`ref-walls-accordion ${isRefsOpen ? 'is-open' : ''}`}
                style={{
                    borderRadius: '6px',
                    overflow: 'hidden',
                    ...(isRefsOpen ? { borderColor: 'rgba(59, 130, 246, 0.55)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.15)' } : {}),
                }}
            >
                <div
                    id="sb-accordion-refs"
                    onClick={() => setIsRefsOpen(!isRefsOpen)}
                    style={{
                        background: '#3b82f6',
                        padding: '8px 10px',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        userSelect: 'none',
                    }}
                >
                    <span>Ściany odniesienia</span>
                    <span style={{ fontSize: '12px', color: '#93c5fd' }}>
                        {isRefsOpen ? '▲' : '▼'}
                    </span>
                </div>

                {isRefsOpen && (
                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Odniesienia
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {renderRefSlot('xMin', 'Bok Lewy')}
                            {renderRefSlot('xMax', 'Bok Prawy')}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {renderRefSlot('yMin', 'Przód')}
                            {renderRefSlot('yMax', 'Tył')}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {renderRefSlot('zMin', 'Dół')}
                            {renderRefSlot('zMax', 'Góra')}
                        </div>
                    </div>
                )}
            </div>

            {/* Parametry profilu LED */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#18181b', padding: '10px', borderRadius: '6px', border: '1px solid #27272a' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Wymiary profilu i frezowania
                </span>

                {/* Szybkie presety */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                        type="button"
                        onClick={() => applyPreset(14, 9)}
                        style={{
                            flex: 1,
                            padding: '3px 4px',
                            background: channel.grooveWidthMm === 14 && channel.grooveDepthMm === 9 ? '#2563eb' : '#27272a',
                            border: '1px solid #3f3f46',
                            color: '#eee',
                            borderRadius: '3px',
                            fontSize: '10px',
                            cursor: 'pointer',
                        }}
                    >
                        14×9 mm
                    </button>
                    <button
                        type="button"
                        onClick={() => applyPreset(12, 6)}
                        style={{
                            flex: 1,
                            padding: '3px 4px',
                            background: channel.grooveWidthMm === 12 && channel.grooveDepthMm === 6 ? '#2563eb' : '#27272a',
                            border: '1px solid #3f3f46',
                            color: '#eee',
                            borderRadius: '3px',
                            fontSize: '10px',
                            cursor: 'pointer',
                        }}
                    >
                        12×6 mm
                    </button>
                    <button
                        type="button"
                        onClick={() => applyPreset(18, 12)}
                        style={{
                            flex: 1,
                            padding: '3px 4px',
                            background: channel.grooveWidthMm === 18 && channel.grooveDepthMm === 12 ? '#2563eb' : '#27272a',
                            border: '1px solid #3f3f46',
                            color: '#eee',
                            borderRadius: '3px',
                            fontSize: '10px',
                            cursor: 'pointer',
                        }}
                    >
                        18×12 mm
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Od frontu:</span>
                    <SmartNumericInput
                        value={channel.offsetFromFrontMm}
                        min={0}
                        max={600}
                        step={1}
                        unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            store.updateChannel(channel.id, {
                                offsetFromFrontMm: val,
                                offsets: { ...offsets, yMin: val },
                            });
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Szerokość (W):</span>
                    <SmartNumericInput
                        value={channel.grooveWidthMm}
                        min={1}
                        max={50}
                        step={0.5}
                        unit="mm"
                        style={inputStyle}
                        onChange={(val) => store.updateChannel(channel.id, { grooveWidthMm: val })}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Głębokość (D):</span>
                    <SmartNumericInput
                        value={channel.grooveDepthMm}
                        min={1}
                        max={30}
                        step={0.5}
                        unit="mm"
                        style={inputStyle}
                        onChange={(val) => store.updateChannel(channel.id, { grooveDepthMm: val })}
                    />
                </div>

                {/* Opcja podcinania boków */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: '#e2e8f0', marginTop: '4px' }}>
                    <input
                        type="checkbox"
                        checked={channel.cutSides}
                        onChange={(e) => store.updateChannel(channel.id, { cutSides: e.target.checked })}
                        style={{ accentColor: '#3b82f6' }}
                    />
                    Podcinaj boki korpusów (przelot profilu)
                </label>
            </div>
        </div>
    );
};
