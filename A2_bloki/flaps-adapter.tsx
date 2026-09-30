/**
 * flaps-adapter.tsx — moduł KLAPY (blok_flaps)
 * Odpowiednik @@BLENDER/A2_bloki/flaps_1_addon_v1.py
 *
 * Panel UI (FlapsSubModule) + mapowanie parametrów na silnik (buildFlapsPlan).
 * Nawiercenia prowadników: flaps-drilling-builder.ts, sync w bloki-core.ts.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateFlapsPlan, normalizeFlapsParams } from './flaps-engine.js';
import type { ModuleDims } from './base-engine.js';
import { DEFAULT_HINGE_ID, listByType } from '../B1_biblioteka/index.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import flapsTekstRaw from './flaps_tekst.json';

import flapsRules from './flaps_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import type { FlapsPlanParams } from './bloki-module-types.js';

const flapsTekst = flapsTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.flaps';
const DEFAULT_FLAP_THICKNESS = resolveRuleThicknessMm(flapsRules, ['KLAPA', 'FRONT'], 'front_thickness', 'flaps');

const MIN_HINGE_OFFSET = 50;

function dimToMm(raw: number | undefined): number {
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return 0;
    return nmToMm(Number(raw));
}

function calculateFlapWeightAndLF(opts: {
    sbWidth: number;
    sbHeight: number;
    ovTop: number;
    ovBottom: number;
    ovLeft: number;
    ovRight: number;
    thickness: number;
    density?: number;
}): { weightKg: number; suggestedHinges: number; powerFactorLF: number } {
    const flapW = opts.sbWidth + opts.ovLeft + opts.ovRight;
    const flapH = opts.sbHeight + opts.ovTop + opts.ovBottom;
    const th = opts.thickness || DEFAULT_FLAP_THICKNESS;
    const density = opts.density || 680;

    const volM3 = (flapW * flapH * th) / 1_000_000_000;
    const weightKg = parseFloat((volM3 * density + 0.15).toFixed(2));
    const powerFactorLF = Math.round(flapH * weightKg);
    const suggestedHinges = (flapW >= 600 || weightKg >= 4.5) ? 3 : 2;

    return { weightKg, suggestedHinges, powerFactorLF };
}

import type { ContainerModel } from '../A1_core/container-model.js';

export { buildFlapsPlan } from './module-plans.js';

export function FlapsSubModule({ container, triggerUpdate }: { container: ContainerModel; triggerUpdate: (params: Partial<FlapsPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};

    const [flapType, setFlapType] = useState<'TOP' | 'BOTTOM'>(() => p.kierunek_klapy === 'BOTTOM' ? 'BOTTOM' : 'TOP');
    const [ovTop, setOvTop] = useState<string | number>(p.nalozenie_gora_mm ?? 14);
    const [ovBottom, setOvBottom] = useState<string | number>(p.nalozenie_dol_mm ?? 15);
    const [ovLeft, setOvLeft] = useState<string | number>(p.nalozenie_lewe_mm ?? 16);
    const [ovRight, setOvRight] = useState<string | number>(p.nalozenie_prawe_mm ?? 16);
    const [hingeLeftOffset, setHingeLeftOffset] = useState<number>(Number(p.odsuniecie_zawiasu_lewe_mm ?? 80));
    const [hingeRightOffset, setHingeRightOffset] = useState<number>(Number(p.odsuniecie_zawiasu_prawe_mm ?? 80));
    const getPairedFlapHingeDefault = (side: 'left' | 'right' | 'center', customVal?: string, globalTpl?: string): string => {
        if (customVal) return customVal;
        const base = globalTpl || p.szablon_zawiasu_domyslny || DEFAULT_HINGE_ID;
        if (base === 'BLUM_71B3550' || base === 'BLUM_71T3550') {
            if (side === 'right') return 'BLUM_71T3550';
            return 'BLUM_71B3550';
        }
        return base;
    };

    const [useCenterHinge, setUseCenterHinge] = useState<boolean>(!!p.zawias_srodkowy);
    const [hingeLeftTemplate, setHingeLeftTemplate] = useState<string>(
        getPairedFlapHingeDefault('left', p.szablon_zawiasu_lewy)
    );
    const [hingeRightTemplate, setHingeRightTemplate] = useState<string>(
        getPairedFlapHingeDefault('right', p.szablon_zawiasu_prawy)
    );
    const [hingeCenterTemplate, setHingeCenterTemplate] = useState<string>(
        getPairedFlapHingeDefault('center', p.szablon_zawiasu_srodkowy)
    );

    useEffect(() => {
        setFlapType(p.kierunek_klapy === 'BOTTOM' ? 'BOTTOM' : 'TOP');
        setOvTop(p.nalozenie_gora_mm ?? 14);
        setOvBottom(p.nalozenie_dol_mm ?? 15);
        setOvLeft(p.nalozenie_lewe_mm ?? 16);
        setOvRight(p.nalozenie_prawe_mm ?? 16);
        setHingeLeftOffset(Number(p.odsuniecie_zawiasu_lewe_mm ?? 80));
        setHingeRightOffset(Number(p.odsuniecie_zawiasu_prawe_mm ?? 80));
        setUseCenterHinge(!!p.zawias_srodkowy);
        setHingeLeftTemplate(getPairedFlapHingeDefault('left', p.szablon_zawiasu_lewy));
        setHingeRightTemplate(getPairedFlapHingeDefault('right', p.szablon_zawiasu_prawy));
        setHingeCenterTemplate(getPairedFlapHingeDefault('center', p.szablon_zawiasu_srodkowy));
    }, [container?.id]);

    const clampHinge = (val: number) => Math.max(MIN_HINGE_OFFSET, val);

    const pushUpdate = (patch: Partial<FlapsPlanParams>) => {
        triggerUpdate({
            kierunek_klapy: flapType,
            nalozenie_gora_mm: parseFloat(String(ovTop)) || 0,
            nalozenie_dol_mm: parseFloat(String(ovBottom)) || 0,
            nalozenie_lewe_mm: parseFloat(String(ovLeft)) || 0,
            nalozenie_prawe_mm: parseFloat(String(ovRight)) || 0,
            odsuniecie_zawiasu_lewe_mm: hingeLeftOffset,
            odsuniecie_zawiasu_prawe_mm: hingeRightOffset,
            zawias_srodkowy: useCenterHinge,
            szablon_zawiasu_lewy: hingeLeftTemplate,
            szablon_zawiasu_prawy: hingeRightTemplate,
            szablon_zawiasu_srodkowy: hingeCenterTemplate,
            ...patch
        });
    };

    const hingeList = listByType('HINGE');

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(flapsTekst, 'flap_type.label', TX_NS)}</span>
                <div style={{ display: 'flex', width: '100%', borderRadius: '4px', overflow: 'hidden', border: '1px solid #3f3f46' }}>
                    <button
                        id="sb-flap-type-top"
                        style={{ flex: 1, padding: '5px 0', background: flapType === 'TOP' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: flapType === 'TOP' ? 'bold' : 'normal' }}
                        onClick={() => { setFlapType('TOP'); pushUpdate({ kierunek_klapy: 'TOP' }); }}
                    >
                        {tx(flapsTekst, 'flap_type.items.TOP', TX_NS)}
                    </button>
                    <button
                        id="sb-flap-type-bottom"
                        style={{ flex: 1, padding: '5px 0', background: flapType === 'BOTTOM' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', borderLeft: '1px solid #3f3f46', cursor: 'pointer', fontSize: '12px', fontWeight: flapType === 'BOTTOM' ? 'bold' : 'normal' }}
                        onClick={() => { setFlapType('BOTTOM'); pushUpdate({ kierunek_klapy: 'BOTTOM' }); }}
                    >
                        {tx(flapsTekst, 'flap_type.items.BOTTOM', TX_NS)}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{tx(flapsTekst, 'ov_top.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={ovTop}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvTop(val); pushUpdate({ nalozenie_gora_mm: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{tx(flapsTekst, 'ov_bottom.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={ovBottom}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvBottom(val); pushUpdate({ nalozenie_dol_mm: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{tx(flapsTekst, 'ov_left.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={ovLeft}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvLeft(val); pushUpdate({ nalozenie_lewe_mm: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{tx(flapsTekst, 'ov_right.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={ovRight}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvRight(val); pushUpdate({ nalozenie_prawe_mm: val }); }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px', fontWeight: 'bold' }}>{tx(flapsTekst, 'hinges_section.label', TX_NS)}</span>

                {/* Informacja o wadze i sugerowanej ilości zawiasów / współczynniku LF */}
                {(() => {
                    const sbW = dimToMm(container?.width);
                    const sbH = dimToMm(container?.height);
                    if (sbW <= 0 || sbH <= 0) return null;
                    const info = calculateFlapWeightAndLF({
                        sbWidth: sbW,
                        sbHeight: sbH,
                        ovTop: parseFloat(String(ovTop)) || 0,
                        ovBottom: parseFloat(String(ovBottom)) || 0,
                        ovLeft: parseFloat(String(ovLeft)) || 0,
                        ovRight: parseFloat(String(ovRight)) || 0,
                        thickness: parseFloat(String(p.grubosc_frontu_mm ?? DEFAULT_FLAP_THICKNESS))
                    });
                    return (
                        <div style={{
                            padding: '6px 8px',
                            background: '#141416',
                            border: '1px solid #27272a',
                            borderRadius: '3px',
                            fontSize: '11px',
                            color: '#a1a1aa',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{tx(flapsTekst, 'weight_info.front_weight', TX_NS)} <strong style={{ color: '#f4f4f5' }}>{info.weightKg} kg</strong></span>
                                <span>{tx(flapsTekst, 'weight_info.suggested_hinges', TX_NS)} <strong style={{ color: '#60a5fa' }}>{info.suggestedHinges} {tx(flapsTekst, 'weight_info.unit_pcs', TX_NS)}</strong></span>
                            </div>
                            <div style={{ fontSize: '10px', color: '#71717a' }}>
                                {tx(flapsTekst, 'weight_info.lift_factor', TX_NS)} <span style={{ color: '#93c5fa' }}>{info.powerFactorLF}</span>
                            </div>
                        </div>
                    );
                })()}
                
                {/* Zawias lewy */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#e4e4e7', fontSize: '11px', width: '56px', flexShrink: 0 }}>{tx(flapsTekst, 'hinge_left.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={hingeLeftOffset}
                        step={0.01} decimals={2}
                        unit="mm"
                        min={MIN_HINGE_OFFSET}
                        style={{ width: '52px', padding: '2px 3px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px', flexShrink: 0 }}
                        onChange={(val) => {
                            const clamped = clampHinge(val);
                            setHingeLeftOffset(clamped);
                            pushUpdate({ odsuniecie_zawiasu_lewe_mm: clamped });
                        }}
                    />
                    <select
                        value={hingeLeftTemplate}
                        onChange={(e) => {
                            setHingeLeftTemplate(e.target.value);
                            pushUpdate({ szablon_zawiasu_lewy: e.target.value });
                        }}
                        style={{ flex: 1, minWidth: 0, padding: '2px 3px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', fontSize: '10px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                        {hingeList.map((hw) => (
                            <option key={hw.id} value={hw.id}>
                                [{hw.brand || ''}] {hw.name || hw.id}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Zawias prawy */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#e4e4e7', fontSize: '11px', width: '56px', flexShrink: 0 }}>{tx(flapsTekst, 'hinge_right.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={hingeRightOffset}
                        step={0.01} decimals={2}
                        unit="mm"
                        min={MIN_HINGE_OFFSET}
                        style={{ width: '52px', padding: '2px 3px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px', flexShrink: 0 }}
                        onChange={(val) => {
                            const clamped = clampHinge(val);
                            setHingeRightOffset(clamped);
                            pushUpdate({ odsuniecie_zawiasu_prawe_mm: clamped });
                        }}
                    />
                    <select
                        value={hingeRightTemplate}
                        onChange={(e) => {
                            setHingeRightTemplate(e.target.value);
                            pushUpdate({ szablon_zawiasu_prawy: e.target.value });
                        }}
                        style={{ flex: 1, minWidth: 0, padding: '2px 3px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', fontSize: '10px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                        {hingeList.map((hw) => (
                            <option key={hw.id} value={hw.id}>
                                [{hw.brand || ''}] {hw.name || hw.id}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Zawias środkowy */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                        type="checkbox"
                        id="chk_use_center_hinge"
                        checked={useCenterHinge}
                        onChange={(e) => {
                            setUseCenterHinge(e.target.checked);
                            pushUpdate({ zawias_srodkowy: e.target.checked });
                        }}
                        style={{ margin: 0, cursor: 'pointer' }}
                    />
                    <label htmlFor="chk_use_center_hinge" style={{ color: useCenterHinge ? '#e4e4e7' : '#71717a', fontSize: '11px', cursor: 'pointer', width: '42px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {tx(flapsTekst, 'use_center_hinge.label', TX_NS)}
                    </label>
                    <div style={{ width: '52px', flexShrink: 0 }} />
                    <select
                        disabled={!useCenterHinge}
                        value={hingeCenterTemplate}
                        onChange={(e) => {
                            setHingeCenterTemplate(e.target.value);
                            pushUpdate({ szablon_zawiasu_srodkowy: e.target.value });
                        }}
                        style={{ flex: 1, minWidth: 0, padding: '2px 3px', background: useCenterHinge ? '#18181b' : '#18181b80', border: '1px solid #3f3f46', color: useCenterHinge ? '#fff' : '#71717a', borderRadius: '3px', fontSize: '10px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                        {hingeList.map((hw) => (
                            <option key={hw.id} value={hw.id}>
                                [{hw.brand || ''}] {hw.name || hw.id}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
