/**
 * led-internal-adapter.tsx — adapter UI i budowniczy planu dla KANAŁ LED WEWNĘTRZNY (blok_led_internal)
 */

import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateLedInternalPlan,
    normalizeLedInternalParams
} from './led-internal-engine.js';
import type { ModuleDims } from './base-engine.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import ledInternalTekstRaw from './led-internal_tekst.json';
import type { LedInternalPlanParams, LedInternalVariant } from './bloki-module-types.js';

const ledInternalTekst = ledInternalTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.led_internal';

export { buildLedInternalPlan } from './module-plans.js';

const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
};
const labelStyle: React.CSSProperties = { color: '#d4d4d8', fontSize: '12px' };
const inputStyle: React.CSSProperties = {
    width: '80px',
    padding: '3px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    textAlign: 'right'
};

import type { ContainerModel } from '../A1_core/container-model.js';

export function LedInternalSubModule({ container, triggerUpdate }: { container: ContainerModel; triggerUpdate: (params: Partial<LedInternalPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};

    const [offsetLeft, setOffsetLeft] = useState<string | number>(p.odsuniecie_od_przodu_lewe_mm ?? 50);
    const [offsetRight, setOffsetRight] = useState<string | number>(p.odsuniecie_od_przodu_prawe_mm ?? 150);
    const [offsetBack, setOffsetBack] = useState<string | number>(p.odsuniecie_tyl_od_srodka_mm ?? 125);
    const [grooveW, setGrooveW] = useState<string | number>(p.szerokosc_wpustu_mm ?? 14);
    const [grooveD, setGrooveD] = useState<string | number>(p.glebokosc_wpustu_mm ?? 9);

    const variantHint = String(p.wariant_led || '');
    const [hasLeft, setHasLeft] = useState<boolean>(
        p.profil_lewy !== undefined ? !!p.profil_lewy : (variantHint.includes('LEFT') || variantHint.includes('BOTH') || variantHint.includes('SIDES') || !variantHint)
    );
    const [hasRight, setHasRight] = useState<boolean>(
        p.profil_prawy !== undefined ? !!p.profil_prawy : (variantHint.includes('RIGHT') || variantHint.includes('BOTH') || variantHint.includes('SIDES') || !variantHint)
    );
    const [hasBack, setHasBack] = useState<boolean>(
        p.profil_tyl !== undefined ? !!p.profil_tyl : variantHint.includes('BACK')
    );

    useEffect(() => {
        const gp = container?.generatorParams || {};
        const v = String(gp.wariant_led || '');
        setOffsetLeft(gp.odsuniecie_od_przodu_lewe_mm ?? 50);
        setOffsetRight(gp.odsuniecie_od_przodu_prawe_mm ?? 150);
        setOffsetBack(gp.odsuniecie_tyl_od_srodka_mm ?? 125);
        setGrooveW(gp.szerokosc_wpustu_mm ?? 14);
        setGrooveD(gp.glebokosc_wpustu_mm ?? 9);
        setHasLeft(gp.profil_lewy !== undefined ? !!gp.profil_lewy : (v.includes('LEFT') || v.includes('BOTH') || v.includes('SIDES') || !v));
        setHasRight(gp.profil_prawy !== undefined ? !!gp.profil_prawy : (v.includes('RIGHT') || v.includes('BOTH') || v.includes('SIDES') || !v));
        setHasBack(gp.profil_tyl !== undefined ? !!gp.profil_tyl : v.includes('BACK'));
    }, [container?.id]);

    const deriveVariant = (l: boolean, r: boolean, b: boolean): LedInternalVariant => {
        if (l && r && b) return 'VERTICAL_SIDES_AND_BACK';
        if (l && r) return 'VERTICAL_BOTH_SIDES';
        if (l && b) return 'VERTICAL_SIDES_AND_BACK';
        if (r && b) return 'VERTICAL_SIDES_AND_BACK';
        if (l) return 'VERTICAL_LEFT_SIDE';
        if (r) return 'VERTICAL_RIGHT_SIDE';
        if (b) return 'VERTICAL_BACK';
        return 'VERTICAL_BOTH_SIDES';
    };

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontWeight: 'bold', color: '#60a5fa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #333338', paddingBottom: '4px' }}>
                <span>{tx(ledInternalTekst, 'panel.title', TX_NS)}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 1. LED Lewy (Checkbox) */}
                <div style={{ ...rowStyle, opacity: hasLeft ? 1 : 0.55 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            id={`sb-led-chk-left-${container?.id || 'default'}`}
                            checked={hasLeft}
                            onChange={(e) => {
                                const next = e.target.checked;
                                setHasLeft(next);
                                triggerUpdate({
                                    profil_lewy: next,
                                    wariant_led: deriveVariant(next, hasRight, hasBack),
                                    odsuniecie_od_przodu_lewe_mm: Number(offsetLeft),
                                    odsuniecie_od_przodu_prawe_mm: Number(offsetRight)
                                });
                            }}
                            style={{ margin: 0, cursor: 'pointer' }}
                        />
                        <span style={{ ...labelStyle, fontWeight: hasLeft ? 600 : 400, color: hasLeft ? '#fff' : '#a1a1aa' }}>
                            {tx(ledInternalTekst, 'led_left.label', TX_NS)}
                        </span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <SmartNumericInput
                            id="sb-led-offset-left-input"
                            value={offsetLeft}
                            disabled={!hasLeft}
                            min={5} max={400} step={1} decimals={1} unit="mm"
                            style={inputStyle}
                            onChange={(val) => {
                                setOffsetLeft(val);
                                triggerUpdate({
                                    odsuniecie_od_przodu_lewe_mm: val,
                                    odsuniecie_od_przodu_prawe_mm: Number(offsetRight)
                                });
                            }}
                        />
                        <span style={{ fontSize: '10px', color: '#71717a', minWidth: '48px' }}>{tx(ledInternalTekst, 'offset_from_front.hint', TX_NS)}</span>
                    </div>
                </div>

                {/* 2. LED Prawy (Checkbox) */}
                <div style={{ ...rowStyle, opacity: hasRight ? 1 : 0.55 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            id={`sb-led-chk-right-${container?.id || 'default'}`}
                            checked={hasRight}
                            onChange={(e) => {
                                const next = e.target.checked;
                                setHasRight(next);
                                triggerUpdate({
                                    profil_prawy: next,
                                    wariant_led: deriveVariant(hasLeft, next, hasBack),
                                    odsuniecie_od_przodu_lewe_mm: Number(offsetLeft),
                                    odsuniecie_od_przodu_prawe_mm: Number(offsetRight)
                                });
                            }}
                            style={{ margin: 0, cursor: 'pointer' }}
                        />
                        <span style={{ ...labelStyle, fontWeight: hasRight ? 600 : 400, color: hasRight ? '#fff' : '#a1a1aa' }}>
                            {tx(ledInternalTekst, 'led_right.label', TX_NS)}
                        </span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <SmartNumericInput
                            id="sb-led-offset-right-input"
                            value={offsetRight}
                            disabled={!hasRight}
                            min={5} max={400} step={1} decimals={1} unit="mm"
                            style={inputStyle}
                            onChange={(val) => {
                                setOffsetRight(val);
                                triggerUpdate({
                                    odsuniecie_od_przodu_prawe_mm: val,
                                    odsuniecie_od_przodu_lewe_mm: Number(offsetLeft)
                                });
                            }}
                        />
                        <span style={{ fontSize: '10px', color: '#71717a', minWidth: '48px' }}>{tx(ledInternalTekst, 'offset_from_front.hint', TX_NS)}</span>
                    </div>
                </div>

                {/* 3. LED Plecy (Checkbox) */}
                <div style={{ ...rowStyle, opacity: hasBack ? 1 : 0.55 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} title={tx(ledInternalTekst, 'led_back.tooltip', TX_NS)}>
                        <input
                            type="checkbox"
                            id={`sb-led-chk-back-${container?.id || 'default'}`}
                            checked={hasBack}
                            onChange={(e) => {
                                const next = e.target.checked;
                                setHasBack(next);
                                triggerUpdate({
                                    profil_tyl: next,
                                    wariant_led: deriveVariant(hasLeft, hasRight, next),
                                    odsuniecie_tyl_od_srodka_mm: Number(offsetBack)
                                });
                            }}
                            style={{ margin: 0, cursor: 'pointer' }}
                        />
                        <span style={{ ...labelStyle, fontWeight: hasBack ? 600 : 400, color: hasBack ? '#fff' : '#a1a1aa' }}>
                            {tx(ledInternalTekst, 'led_back.label', TX_NS)}
                        </span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <SmartNumericInput
                            id="sb-led-offset-back-input"
                            value={offsetBack}
                            disabled={!hasBack}
                            min={-500} max={500} step={1} decimals={1} unit="mm"
                            style={inputStyle}
                            onChange={(val) => {
                                setOffsetBack(val);
                                triggerUpdate({
                                    odsuniecie_tyl_od_srodka_mm: val
                                });
                            }}
                        />
                        <span style={{ fontSize: '10px', color: '#71717a', minWidth: '48px' }}>{tx(ledInternalTekst, 'offset_center.hint', TX_NS)}</span>
                    </div>
                </div>
            </div>

            {/* Parametry rowka */}
            <div style={{ borderTop: '1px solid #333338', paddingTop: '6px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(ledInternalTekst, 'groove.width', TX_NS)}</span>
                    <SmartNumericInput
                        id="sb-led-groove-width-input"
                        value={grooveW}
                        min={5} max={40} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            setGrooveW(val);
                            triggerUpdate({
                                szerokosc_wpustu_mm: val
                            });
                        }}
                    />
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(ledInternalTekst, 'groove.depth', TX_NS)}</span>
                    <SmartNumericInput
                        id="sb-led-groove-depth-input"
                        value={grooveD}
                        min={2} max={18} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            setGrooveD(val);
                            triggerUpdate({
                                glebokosc_wpustu_mm: val
                            });
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
