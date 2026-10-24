/**
 * Formularz edycji korpusu (A3) w oknie na scenie — te same parametry co SmartFrameUI.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { SmartNumericInput } from '../../A1_core/ui/SmartNumericInput.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import {
    applyRealtimeUpdate,
    calcTopHeight,
} from '../../A3_smartframe/smartframe-adapter.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import korpusTekstRaw from '../../A3_smartframe/korpus_tekst.json';

const korpusTekst = korpusTekstRaw as unknown as ModuleTexts;
const TX_NS = 'smartframe.korpus';

type CabinetUiType = 'KORPUS3' | 'KORPUS_ROGOWY1' | 'KORPUS_ROGOWY90' | 'KORPUS_SKOSNY_DACH' | 'KORPUS_SKOSNY_LR_UC';
type BlindSide = 'LEFT' | 'RIGHT';

function engineToUiType(raw: string | undefined): CabinetUiType {
    const t = String(raw || '').toLowerCase();
    if (t.includes('skosny_lr_uc') || t.includes('skosny-lr-uc') || t.includes('skosny_lr') || t.includes('skosny-lr')) return 'KORPUS_SKOSNY_LR_UC';
    if (t.includes('skosny_dach') || t.includes('skosny-dach') || t.includes('skosny')) return 'KORPUS_SKOSNY_DACH';
    if (t.includes('rogowy90') || t.includes('rogowy_90')) return 'KORPUS_ROGOWY90';
    if (t.includes('rogowy')) return 'KORPUS_ROGOWY1';
    return 'KORPUS3';
}

function uiToEngineType(t: CabinetUiType): 'korpus3' | 'korpus_rogowy1' | 'korpus_rogowy90' | 'korpus_skosny_dach' | 'korpus_skosny_lr_uc' {
    if (t === 'KORPUS_SKOSNY_LR_UC') return 'korpus_skosny_lr_uc';
    if (t === 'KORPUS_SKOSNY_DACH') return 'korpus_skosny_dach';
    if (t === 'KORPUS_ROGOWY90') return 'korpus_rogowy90';
    if (t === 'KORPUS_ROGOWY1') return 'korpus_rogowy1';
    return 'korpus3';
}

function InputRow({
    label,
    value,
    min = 0,
    max = 5000,
    onChange,
}: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (v: number) => void;
}): React.JSX.Element {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: '#cbd5e1' }}>{label}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <SmartNumericInput value={value} min={min} max={max} step={1} onChange={onChange} />
                <span style={{ color: '#71717a', fontSize: '10px' }}>mm</span>
            </div>
        </div>
    );
}

export function FloatingKorpusEdit({
    container,
    projectModel,
}: {
    container: any;
    projectModel?: any;
}): React.JSX.Element | null {
    useLocale();
    const [cabinetType, setCabinetType] = useState<CabinetUiType>('KORPUS3');
    const [width, setWidth] = useState(600);
    const [height, setHeight] = useState(2200);
    const [depth, setDepth] = useState(560);
    const [zoneCount, setZoneCount] = useState<1 | 2 | 3>(3);
    const [bottomHeight, setBottomHeight] = useState(500);
    const [middleHeight, setMiddleHeight] = useState(1200);
    const [backOffset, setBackOffset] = useState(3);
    const [blindWidth, setBlindWidth] = useState(400);
    const [blindSide, setBlindSide] = useState<BlindSide>('LEFT');
    const [bokLewy, setBokLewy] = useState(600);
    const [bokPrawy, setBokPrawy] = useState(600);
    const [szerokoscListwy, setSzerokoscListwy] = useState(100);
    const [typListwy, setTypListwy] = useState<'POJEDYNCZA' | 'KATOWA_90'>('POJEDYNCZA');
    const [heightLeft, setHeightLeft] = useState(1000);
    const [heightRight, setHeightRight] = useState(2200);
    const [heightFront, setHeightFront] = useState(2200);
    const [heightBack, setHeightBack] = useState(1000);

    useEffect(() => {
        if (!container) return;
        const p = container.generatorParams || {};
        const type = engineToUiType(p.typ_korpusu || p.type);
        setCabinetType(type);
        const w = nmToMm(container.width);
        const h = nmToMm(container.height);
        const d = nmToMm(container.depth);
        if (Number.isFinite(w)) setWidth(Math.round(w));
        if (Number.isFinite(h)) setHeight(Math.round(h));
        if (Number.isFinite(d)) setDepth(Math.round(d));
        const zc = p.liczba_stref !== undefined ? (Number(p.liczba_stref) as 1 | 2 | 3) : 3;
        setZoneCount(zc);
        if (p.wysokosc_strefy_dolnej_mm !== undefined) setBottomHeight(p.wysokosc_strefy_dolnej_mm);
        if (p.wysokosc_strefy_srodkowej_mm !== undefined) setMiddleHeight(p.wysokosc_strefy_srodkowej_mm);
        const bo = p.cofniecie_plecow_mm ?? p.backOffset;
        if (bo !== undefined) setBackOffset(bo);
        if (p.szerokosc_blendy_mm !== undefined) setBlindWidth(p.szerokosc_blendy_mm);
        if (p.strona_blendy) setBlindSide(p.strona_blendy);
        if (p.glebokosc_boku_lewego_mm !== undefined) setBokLewy(p.glebokosc_boku_lewego_mm);
        if (p.glebokosc_boku_prawego_mm !== undefined) setBokPrawy(p.glebokosc_boku_prawego_mm);
        if (p.szerokosc_listwy_naroznej_mm !== undefined) setSzerokoscListwy(p.szerokosc_listwy_naroznej_mm);
        if (p.typ_listwy_naroznej) setTypListwy(p.typ_listwy_naroznej);
        if (p.wysokosc_lewy_mm !== undefined) setHeightLeft(p.wysokosc_lewy_mm);
        if (p.wysokosc_prawy_mm !== undefined) setHeightRight(p.wysokosc_prawy_mm);
        if (p.wysokosc_przod_mm !== undefined) setHeightFront(p.wysokosc_przod_mm);
        if (p.wysokosc_tyl_mm !== undefined) setHeightBack(p.wysokosc_tyl_mm);
    }, [container, container?.id, container?.generatorParams]);

    const isRogowy1 = cabinetType === 'KORPUS_ROGOWY1';
    const isRogowy90 = cabinetType === 'KORPUS_ROGOWY90';
    const isSkosnyDach = cabinetType === 'KORPUS_SKOSNY_DACH';
    const isSkosnyLrUc = cabinetType === 'KORPUS_SKOSNY_LR_UC';
    const isSkosnyOneZone = isSkosnyDach || isSkosnyLrUc;
    const isCorner = isRogowy1 || isRogowy90;
    const effectiveZoneCount: 1 | 2 | 3 = (isCorner || isSkosnyOneZone) ? 1 : zoneCount;
    const topHeight = calcTopHeight(height, effectiveZoneCount, bottomHeight, middleHeight);

    const triggerRealtime = useCallback((
        w: number, h: number, d: number,
        zc: 1 | 2 | 3, hB: number, hM: number, po: number,
        type: CabinetUiType = cabinetType,
        bw: number = blindWidth,
        bs: BlindSide = blindSide,
        bl: number = bokLewy,
        bp: number = bokPrawy,
        hL: number = heightLeft,
        hR2: number = heightRight,
        hF: number = heightFront,
        hBk: number = heightBack,
        sL: number = szerokoscListwy,
        tL: 'POJEDYNCZA' | 'KATOWA_90' = typListwy,
    ) => {
        const corner = type === 'KORPUS_ROGOWY1' || type === 'KORPUS_ROGOWY90';
        const skosnyLrUc = type === 'KORPUS_SKOSNY_LR_UC';
        const skosnyDach = type === 'KORPUS_SKOSNY_DACH';
        const skosnyH = skosnyLrUc ? Math.max(hL, hR2, h) : skosnyDach ? Math.max(hF, hBk, h) : h;
        const doc = projectModel || ContextManager.instance.document;
        applyRealtimeUpdate(doc, {
            szerokosc_mm: w,
            wysokosc_mm: skosnyH,
            glebokosc_mm: d,
            liczba_stref: (corner || skosnyLrUc || skosnyDach) ? 1 : zc,
            wysokosc_strefy_dolnej_mm: hB,
            wysokosc_strefy_srodkowej_mm: hM,
            cofniecie_plecow_mm: po,
            typ_korpusu: uiToEngineType(type),
            szerokosc_blendy_mm: bw,
            strona_blendy: bs,
            glebokosc_boku_lewego_mm: bl,
            glebokosc_boku_prawego_mm: bp,
            szerokosc_listwy_naroznej_mm: sL,
            typ_listwy_naroznej: tL,
            wysokosc_lewy_mm: hL,
            wysokosc_prawy_mm: hR2,
            wysokosc_przod_mm: hF,
            wysokosc_tyl_mm: hBk,
        }, container);
    }, [
        projectModel, container, cabinetType, blindWidth, blindSide,
        bokLewy, bokPrawy, szerokoscListwy, typListwy, heightLeft, heightRight, heightFront, heightBack,
    ]);

    if (!container) return null;

    return (
        <div>
            <InputRow label={tx(korpusTekst, 'dims.width', TX_NS)} value={width} min={150} max={4000}
                onChange={(v) => {
                    setWidth(v);
                    triggerRealtime(v, height, depth, effectiveZoneCount, bottomHeight, middleHeight, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack);
                }} />
            {!isSkosnyDach && (
                <InputRow label={tx(korpusTekst, 'dims.height', TX_NS)} value={height} min={150} max={4000}
                    onChange={(v) => {
                        setHeight(v);
                        setHeightRight(v);
                        triggerRealtime(width, v, depth, effectiveZoneCount, bottomHeight, middleHeight, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, v, heightFront, heightBack);
                    }} />
            )}
            <InputRow label={tx(korpusTekst, 'dims.depth', TX_NS)} value={depth} min={150} max={4000}
                onChange={(v) => {
                    setDepth(v);
                    triggerRealtime(width, height, v, effectiveZoneCount, bottomHeight, middleHeight, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack);
                }} />

            {isRogowy1 && (
                <>
                    <div style={{ fontSize: '11px', fontWeight: 700, margin: '8px 0 4px', color: '#e4e4e7' }}>
                        {tx(korpusTekst, 'blind.title', TX_NS)}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        {(['LEFT', 'RIGHT'] as BlindSide[]).map((side) => (
                            <button
                                key={side}
                                type="button"
                                onClick={() => {
                                    setBlindSide(side);
                                    triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY1', blindWidth, side, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack);
                                }}
                                style={{
                                    flex: 1,
                                    padding: '7px 8px',
                                    background: blindSide === side ? 'rgba(59, 130, 246, 0.25)' : '#252528',
                                    border: blindSide === side ? '1px solid #3b82f6' : '1px solid #3a3a3e',
                                    borderRadius: '4px',
                                    color: '#ddd',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: blindSide === side ? 700 : 500,
                                }}
                            >
                                {tx(korpusTekst, side === 'LEFT' ? 'blind.side_LEFT' : 'blind.side_RIGHT', TX_NS)}
                            </button>
                        ))}
                    </div>
                    <InputRow label={tx(korpusTekst, 'blind.width', TX_NS)} value={blindWidth} min={50} max={Math.max(50, width - 50)}
                        onChange={(v) => {
                            setBlindWidth(v);
                            triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY1', v, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack);
                        }} />
                </>
            )}

            {isRogowy90 && (
                <>
                    <div style={{ fontSize: '11px', fontWeight: 700, margin: '8px 0 4px', color: '#e4e4e7' }}>
                        {tx(korpusTekst, 'corner90.title', TX_NS)}
                    </div>
                    <InputRow label={tx(korpusTekst, 'corner90.side_left', TX_NS)} value={bokLewy} min={200} max={Math.max(200, width - 50)}
                        onChange={(v) => {
                            setBokLewy(v);
                            triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY90', blindWidth, blindSide, v, bokPrawy, heightLeft, heightRight, heightFront, heightBack, szerokoscListwy, typListwy);
                        }} />
                    <InputRow label={tx(korpusTekst, 'corner90.side_right', TX_NS)} value={bokPrawy} min={200} max={Math.max(200, depth - 50)}
                        onChange={(v) => {
                            setBokPrawy(v);
                            triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY90', blindWidth, blindSide, bokLewy, v, heightLeft, heightRight, heightFront, heightBack, szerokoscListwy, typListwy);
                        }} />
                    <div style={{ fontSize: '10px', color: '#999', margin: '6px 0 2px' }}>
                        {tx(korpusTekst, 'corner90.nailer_type', TX_NS)}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                        {(['POJEDYNCZA', 'KATOWA_90'] as const).map((t) => {
                            const labelKey = t === 'POJEDYNCZA' ? 'corner90.nailer_single' : 'corner90.nailer_corner90';
                            const active = typListwy === t;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        setTypListwy(t);
                                        triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY90', blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack, szerokoscListwy, t);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '4px 6px',
                                        background: active ? 'rgba(59, 130, 246, 0.25)' : '#252528',
                                        border: active ? '1px solid #3b82f6' : '1px solid #3a3a3e',
                                        borderRadius: '4px',
                                        color: '#ddd',
                                        cursor: 'pointer',
                                        fontSize: '10px',
                                        fontWeight: active ? 700 : 500,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {tx(korpusTekst, labelKey, TX_NS)}
                                </button>
                            );
                        })}
                    </div>
                    <InputRow label={tx(korpusTekst, 'corner90.nailer_width', TX_NS)} value={szerokoscListwy} min={20} max={300}
                        onChange={(v) => {
                            setSzerokoscListwy(v);
                            triggerRealtime(width, height, depth, 1, height, 0, backOffset, 'KORPUS_ROGOWY90', blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack, v, typListwy);
                        }} />
                </>
            )}

            {isSkosnyDach && (
                <>
                    <div style={{ fontSize: '11px', fontWeight: 700, margin: '8px 0 4px', color: '#e4e4e7' }}>
                        {tx(korpusTekst, 'skosny_dach.title', TX_NS)}
                    </div>
                    <InputRow label={tx(korpusTekst, 'skosny_dach.height_front', TX_NS)} value={heightFront} min={100} max={4000}
                        onChange={(v) => {
                            setHeightFront(v);
                            const maxH = Math.max(v, heightBack);
                            setHeight(maxH);
                            triggerRealtime(width, maxH, depth, 1, maxH, 0, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, v, heightBack);
                        }} />
                    <InputRow label={tx(korpusTekst, 'skosny_dach.height_back', TX_NS)} value={heightBack} min={100} max={4000}
                        onChange={(v) => {
                            setHeightBack(v);
                            const maxH = Math.max(heightFront, v);
                            setHeight(maxH);
                            triggerRealtime(width, maxH, depth, 1, maxH, 0, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, v);
                        }} />
                    {(() => {
                        const roznica_wysokosci_mm = Math.abs(heightFront - heightBack);
                        const kat_skosu_deg = depth > 0 ? (Math.atan2(roznica_wysokosci_mm, depth) * 180) / Math.PI : 0;
                        const cos_kat_skosu = Math.cos((kat_skosu_deg * Math.PI) / 180);
                        const wieniec_w_pionie_mm = Math.abs(cos_kat_skosu) > 1e-6 ? (18 / cos_kat_skosu).toFixed(1) : '-';
                        return (
                            <div style={{
                                padding: '6px 8px',
                                background: '#1c1c1f',
                                border: '1px solid #2d2d30',
                                borderRadius: '4px',
                                marginTop: '4px',
                                marginBottom: '8px',
                                fontSize: '11px',
                                color: '#a1a1aa',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{tx(korpusTekst, 'skosny.angle', TX_NS)}</span>
                                    <strong style={{ color: '#93c5fd', fontSize: '11px' }}>{kat_skosu_deg.toFixed(2)}°</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{tx(korpusTekst, 'skosny.vertical_thickness', TX_NS)}</span>
                                    <strong style={{ color: '#e4e4e7', fontSize: '11px' }}>{wieniec_w_pionie_mm} mm</strong>
                                </div>
                            </div>
                        );
                    })()}
                </>
            )}

            {isSkosnyLrUc && (
                <>
                    <InputRow label={tx(korpusTekst, 'skosny_lr.height_left', TX_NS)} value={heightLeft} min={100} max={Math.max(100, height - 1)}
                        onChange={(v) => {
                            setHeightLeft(v);
                            triggerRealtime(width, height, depth, 1, height, 0, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, v, height, heightFront, heightBack);
                        }} />
                    {(() => {
                        const roznica_wysokosci_mm = Math.abs(height - heightLeft);
                        const kat_skosu_deg = width > 0 ? (Math.atan2(roznica_wysokosci_mm, width) * 180) / Math.PI : 0;
                        const cos_kat_skosu = Math.cos((kat_skosu_deg * Math.PI) / 180);
                        const wieniec_w_pionie_mm = Math.abs(cos_kat_skosu) > 1e-6 ? (18 / cos_kat_skosu).toFixed(1) : '-';
                        return (
                            <div style={{
                                padding: '6px 8px',
                                background: '#1c1c1f',
                                border: '1px solid #2d2d30',
                                borderRadius: '4px',
                                marginTop: '4px',
                                marginBottom: '8px',
                                fontSize: '11px',
                                color: '#a1a1aa',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{tx(korpusTekst, 'skosny.angle', TX_NS)}</span>
                                    <strong style={{ color: '#93c5fd', fontSize: '11px' }}>{kat_skosu_deg.toFixed(2)}°</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{tx(korpusTekst, 'skosny.vertical_thickness', TX_NS)}</span>
                                    <strong style={{ color: '#e4e4e7', fontSize: '11px' }}>{wieniec_w_pionie_mm} mm</strong>
                                </div>
                            </div>
                        );
                    })()}
                </>
            )}

            {!isCorner && !isSkosnyOneZone && zoneCount >= 2 && (
                <>
                    <div style={{ fontSize: '11px', fontWeight: 700, margin: '8px 0 4px', color: '#e4e4e7' }}>
                        {tx(korpusTekst, 'zones.title', TX_NS)}
                    </div>
                    <InputRow label={tx(korpusTekst, 'zones.bottom', TX_NS)} value={bottomHeight} min={50} max={3000}
                        onChange={(v) => {
                            setBottomHeight(v);
                            triggerRealtime(width, height, depth, effectiveZoneCount, v, middleHeight, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack);
                        }} />
                    {zoneCount === 3 && (
                        <InputRow label={tx(korpusTekst, 'zones.middle', TX_NS)} value={middleHeight} min={50} max={3000}
                            onChange={(v) => {
                                setMiddleHeight(v);
                                triggerRealtime(width, height, depth, effectiveZoneCount, bottomHeight, v, backOffset, cabinetType, blindWidth, blindSide, bokLewy, bokPrawy, heightLeft, heightRight, heightFront, heightBack);
                            }} />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', color: '#cbd5e1' }}>{tx(korpusTekst, 'zones.top', TX_NS)}</label>
                        <span style={{ color: '#71717a', fontSize: '12px' }}>{topHeight} mm</span>
                    </div>
                </>
            )}
        </div>
    );
}
