/**
 * doors-adapter.tsx — moduł DRZWI (blok_doors)
 * Odpowiednik @@BLENDER/A2_bloki/doors_1_addon_v1.py
 *
 * Panel UI (DoorsSubModule) + mapowanie parametrów na silnik (buildDoorsPlan).
 * Nawiercenia zawiasów: doors-drilling-builder.ts, sync w bloki-core.ts.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateDoorsPlan, normalizeDoorsParams, suggestHingesPerLeaf } from './05_doors-engine.js';
import type { ModuleDims } from './01_base-engine.js';
import type { BlokiPlanResult } from './01_bloki-types.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_HINGE_ID, hingeFrontHolesMm } from '../B1_biblioteka/index.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import doorsTekstRaw from './05_doors_tekst.json';

import doorsRules from './05_doors_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';
import type { DoorsPlanParams } from './01_bloki-module-types.js';
import {
    DEFAULT_HINGE_BRAND,
    firstHingeIdForBrand,
    HingeBrandFilter,
    renderHingeSelectOptions,
    resolveHingeBrand
} from './01_hinge-brand-ui.js';

const doorsTekst = doorsTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.doors';
const DEFAULT_DOOR_THICKNESS = resolveRuleThicknessMm(doorsRules, ['DRZWI_L', 'DRZWI_P', 'FRONT'], 'front_thickness', 'doors');

function toNum(val: string | number | undefined, fallback = 0): number {
    const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
    return Number.isFinite(n) ? n : fallback;
}

function dimToMm(raw: number | undefined): number {
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return 0;
    return nmToMm(Number(raw));
}

function calculateDoorWeightAndHinges(opts: {
    sbWidth: number;
    sbHeight: number;
    doorType: string;
    gap: number;
    ovTop: number;
    ovBottom: number;
    ovLeft: number;
    ovRight: number;
    thickness: number;
    density?: number;
}): { weightKg: number; suggestedHingesPerLeaf: number; isDouble: boolean } {
    const isDouble = normalizeDoorType(opts.doorType) === 'DOUBLE';
    const halfOpening = Math.max(0, (opts.sbWidth - opts.gap) / 2);
    const doorW = isDouble
        ? Math.max(halfOpening + opts.ovLeft, halfOpening + opts.ovRight)
        : opts.sbWidth + opts.ovLeft + opts.ovRight;
    const doorH = opts.sbHeight + opts.ovTop + opts.ovBottom;
    const th = opts.thickness || DEFAULT_DOOR_THICKNESS;
    const density = opts.density || 680;

    const volM3 = (doorW * doorH * th) / 1_000_000_000;
    const weightKg = parseFloat((volM3 * density + 0.15).toFixed(2));

    const singleDoorW = opts.sbWidth + opts.ovLeft + opts.ovRight;
    const singleVolM3 = (singleDoorW * doorH * th) / 1_000_000_000;
    const singleWeightKg = parseFloat((singleVolM3 * density + 0.15).toFixed(2));
    const singleSuggested = suggestHingesPerLeaf(doorH, singleWeightKg);

    const suggestedHingesPerLeaf = isDouble
        ? Math.max(2, Math.round(singleSuggested / 2))
        : singleSuggested;

    return { weightKg, suggestedHingesPerLeaf, isDouble };
}

export function countActiveDoorHingesPerLeaf(p: DoorsPlanParams): number {
    let n = 0;
    for (let i = 1; i <= 6; i++) {
        const key = `uzyj_zawias_${i}` as keyof DoorsPlanParams;
        const defaultOn = i === 1 || i === 6;
        const raw = p[key];
        const on = raw === undefined ? defaultOn : Boolean(raw);
        if (on) n += 1;
    }
    return n;
}

/**
 * Czy puszka fi35 i wkręty montażowe zawiasu wychodzą poza formatkę drzwi.
 * Wzór V taki sam jak w doors-engine.ts (od dolnej krawędzi drzwi, z nałożeniem dołu).
 * Zawias 6 liczony od góry — bez clampowania, żeby UI ostrzegło przy pozycji poza skrzydłem.
 */
function isDoorHingeOutOfPanel(opts: {
    posMm: number;
    fromTop: boolean;
    sbHeight: number;
    ovTop: number;
    ovBottom: number;
    hingeId?: string;
}): boolean {
    const doorH = opts.sbHeight + opts.ovTop + opts.ovBottom;
    if (doorH <= 0) return false;
    const localZ = opts.fromTop ? (opts.sbHeight - opts.posMm) : opts.posMm;
    const vCenter = localZ + opts.ovBottom;
    const frontHoles = hingeFrontHolesMm(opts.hingeId || DEFAULT_HINGE_ID);
    const eps = 0.05;
    return frontHoles.some((h) => {
        const v = vCenter + h.yOffset;
        const r = h.dia / 2;
        return v - r < -eps || v + r > doorH + eps;
    });
}

export { buildDoorsPlan } from './01_module-plans.js';

export function normalizeDoorType(val: string | undefined): 'LEFT' | 'RIGHT' | 'DOUBLE' {
    if (!val) return 'LEFT';
    const u = String(val).toUpperCase();
    if (u === 'SINGLE_LEFT' || u === 'LEFT') return 'LEFT';
    if (u === 'SINGLE_RIGHT' || u === 'RIGHT') return 'RIGHT';
    if (u === 'DOUBLE') return 'DOUBLE';
    return 'LEFT';
}

import type { ContainerModel } from '../A1_core/container-model.js';

export function DoorsSubModule({ container, triggerUpdate }: { container: ContainerModel, triggerUpdate: (params: Partial<DoorsPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};
    
    // Typ drzwi: LEFT, RIGHT, DOUBLE
    const [doorType, setDoorType] = useState<string>(() => normalizeDoorType(p.rodzaj_drzwi));
    const [gap, setGap] = useState<number>(p.szczelina_mm ?? 4);
    const [ovTop, setOvTop] = useState<string | number>(p.nalozenie_gora_mm ?? 14);
    const [ovBottom, setOvBottom] = useState<string | number>(p.nalozenie_dol_mm ?? 15);
    const [ovLeft, setOvLeft] = useState<string | number>(p.nalozenie_lewe_mm ?? 16);
    const [ovRight, setOvRight] = useState<string | number>(p.nalozenie_prawe_mm ?? 16);

    // Pomocnik naprzemiennego parowania zawiasów (1,3,5 = z hamulcem 71B3550, 2,4,6 = bez hamulca 71T3550)
    const getPairedHingeDefault = (idx: number, customVal?: string, globalTpl?: string): string => {
        if (customVal) return customVal;
        const base = globalTpl || p.domyslny_zawias_id || DEFAULT_HINGE_ID;
        if (base === 'BLUM_71B3550' || base === 'BLUM_71T3550') {
            return (idx % 2 === 1) ? 'BLUM_71B3550' : 'BLUM_71T3550';
        }
        if (base === 'BLUM_79B9550' || base === 'BLUM_79T9550') {
            return (idx % 2 === 1) ? 'BLUM_79B9550' : 'BLUM_79T9550';
        }
        return base;
    };

    // Domyślny szablon zawiasów
    const defaultTemplate = p.domyslny_zawias_id || DEFAULT_HINGE_ID;
    const [hingeBrand, setHingeBrand] = useState<string>(() => resolveHingeBrand(p.producent_zawiasow || DEFAULT_HINGE_BRAND));
    const [hingeTemplate, setHingeTemplate] = useState<string>(defaultTemplate);

    const [useHinge1, setUseHinge1] = useState<boolean>(p.uzyj_zawias_1 !== false);
    const [hinge1Pos, setHinge1Pos] = useState<number>(p.pozycja_zawias_1_mm ?? 120);
    const [hinge1Template, setHinge1Template] = useState<string>(getPairedHingeDefault(1, p.zawias_1_szablon, defaultTemplate));

    const [useHinge2, setUseHinge2] = useState<boolean>(!!p.uzyj_zawias_2);
    const [hinge2Pos, setHinge2Pos] = useState<number>(p.pozycja_zawias_2_mm ?? 570);
    const [hinge2Template, setHinge2Template] = useState<string>(getPairedHingeDefault(2, p.zawias_2_szablon, defaultTemplate));

    const [useHinge3, setUseHinge3] = useState<boolean>(!!p.uzyj_zawias_3);
    const [hinge3Pos, setHinge3Pos] = useState<number>(p.pozycja_zawias_3_mm ?? 910);
    const [hinge3Template, setHinge3Template] = useState<string>(getPairedHingeDefault(3, p.zawias_3_szablon, defaultTemplate));

    const [useHinge4, setUseHinge4] = useState<boolean>(!!p.uzyj_zawias_4);
    const [hinge4Pos, setHinge4Pos] = useState<number>(p.pozycja_zawias_4_mm ?? 1230);
    const [hinge4Template, setHinge4Template] = useState<string>(getPairedHingeDefault(4, p.zawias_4_szablon, defaultTemplate));

    const [useHinge5, setUseHinge5] = useState<boolean>(!!p.uzyj_zawias_5);
    const [hinge5Pos, setHinge5Pos] = useState<number>(p.pozycja_zawias_5_mm ?? 1580);
    const [hinge5Template, setHinge5Template] = useState<string>(getPairedHingeDefault(5, p.zawias_5_szablon, defaultTemplate));

    const [useHinge6, setUseHinge6] = useState<boolean>(p.uzyj_zawias_6 !== false);
    const [hinge6Pos, setHinge6Pos] = useState<number>(p.pozycja_zawias_6_mm ?? 120);
    const [hinge6Template, setHinge6Template] = useState<string>(getPairedHingeDefault(6, p.zawias_6_szablon, defaultTemplate));

    useEffect(() => {
        const defTpl = p.domyslny_zawias_id || DEFAULT_HINGE_ID;
        setDoorType(normalizeDoorType(p.rodzaj_drzwi));
        setGap(p.szczelina_mm ?? 4);
        setOvTop(p.nalozenie_gora_mm ?? 14);
        setOvBottom(p.nalozenie_dol_mm ?? 15);
        setOvLeft(p.nalozenie_lewe_mm ?? 16);
        setOvRight(p.nalozenie_prawe_mm ?? 16);
        setHingeBrand(resolveHingeBrand(p.producent_zawiasow || DEFAULT_HINGE_BRAND));
        setHingeTemplate(defTpl);
        setUseHinge1(p.uzyj_zawias_1 !== false);
        setHinge1Pos(p.pozycja_zawias_1_mm ?? 120);
        setHinge1Template(getPairedHingeDefault(1, p.zawias_1_szablon, defTpl));
        setUseHinge2(!!p.uzyj_zawias_2);
        setHinge2Pos(p.pozycja_zawias_2_mm ?? 570);
        setHinge2Template(getPairedHingeDefault(2, p.zawias_2_szablon, defTpl));
        setUseHinge3(!!p.uzyj_zawias_3);
        setHinge3Pos(p.pozycja_zawias_3_mm ?? 910);
        setHinge3Template(getPairedHingeDefault(3, p.zawias_3_szablon, defTpl));
        setUseHinge4(!!p.uzyj_zawias_4);
        setHinge4Pos(p.pozycja_zawias_4_mm ?? 1230);
        setHinge4Template(getPairedHingeDefault(4, p.zawias_4_szablon, defTpl));
        setUseHinge5(!!p.uzyj_zawias_5);
        setHinge5Pos(p.pozycja_zawias_5_mm ?? 1580);
        setHinge5Template(getPairedHingeDefault(5, p.zawias_5_szablon, defTpl));
        setUseHinge6(p.uzyj_zawias_6 !== false);
        setHinge6Pos(p.pozycja_zawias_6_mm ?? 120);
        setHinge6Template(getPairedHingeDefault(6, p.zawias_6_szablon, defTpl));
    }, [container?.id, p.rodzaj_drzwi]);

    const activeDoor = normalizeDoorType(doorType);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Typ drzwi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(doorsTekst, 'door_type.label', TX_NS)}</span>
                <div style={{ display: 'flex', width: '100%', borderRadius: '4px', overflow: 'hidden', border: '1px solid #3f3f46' }}>
                    <button 
                        style={{ flex: 1, padding: '5px 0', background: activeDoor === 'LEFT' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: activeDoor === 'LEFT' ? 'bold' : 'normal' }}
                        onClick={() => { setDoorType('LEFT'); triggerUpdate({ rodzaj_drzwi: 'LEFT' }); }}
                    >
                        {tx(doorsTekst, 'door_type.items.LEFT', TX_NS)}
                    </button>
                    <button 
                        style={{ flex: 1, padding: '5px 0', background: activeDoor === 'RIGHT' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', borderLeft: '1px solid #3f3f46', borderRight: '1px solid #3f3f46', cursor: 'pointer', fontSize: '12px', fontWeight: activeDoor === 'RIGHT' ? 'bold' : 'normal' }}
                        onClick={() => { setDoorType('RIGHT'); triggerUpdate({ rodzaj_drzwi: 'RIGHT' }); }}
                    >
                        {tx(doorsTekst, 'door_type.items.RIGHT', TX_NS)}
                    </button>
                    <button 
                        style={{ flex: 1, padding: '5px 0', background: activeDoor === 'DOUBLE' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: activeDoor === 'DOUBLE' ? 'bold' : 'normal' }}
                        onClick={() => { setDoorType('DOUBLE'); triggerUpdate({ rodzaj_drzwi: 'DOUBLE' }); }}
                    >
                        {tx(doorsTekst, 'door_type.items.DOUBLE', TX_NS)}
                    </button>
                </div>
            </div>

            {/* Szczelina środkowa (tylko dla drzwi podwójnych) */}
            {doorType === 'DOUBLE' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(doorsTekst, 'gap.label', TX_NS)}</span>
                    <SmartNumericInput 
                        value={gap}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '80px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setGap(val);
                            triggerUpdate({ szczelina_mm: val });
                        }}
                    />
                </div>
            )}

            {/* Nałożenia frontu */}
            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {tx(doorsTekst, 'overlaps.title', TX_NS)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {/* Góra */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>{tx(doorsTekst, 'ov_top.label', TX_NS)}</span>
                        <SmartNumericInput 
                            value={ovTop} 
                            step={0.01} decimals={2}
                            unit="mm"
                            onChange={(val) => {
                                setOvTop(val);
                                triggerUpdate({ nalozenie_gora_mm: val });
                            }}
                            style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }} 
                        />
                    </div>
                    {/* Dół */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>{tx(doorsTekst, 'ov_bottom.label', TX_NS)}</span>
                        <SmartNumericInput 
                            value={ovBottom} 
                            step={0.01} decimals={2}
                            unit="mm"
                            onChange={(val) => {
                                setOvBottom(val);
                                triggerUpdate({ nalozenie_dol_mm: val });
                            }}
                            style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }} 
                        />
                    </div>
                    {/* Lewo */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>{tx(doorsTekst, 'ov_left.label', TX_NS)}</span>
                        <SmartNumericInput 
                            value={ovLeft} 
                            step={0.01} decimals={2}
                            unit="mm"
                            onChange={(val) => {
                                setOvLeft(val);
                                triggerUpdate({ nalozenie_lewe_mm: val });
                            }}
                            style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }} 
                        />
                    </div>
                    {/* Prawo */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>{tx(doorsTekst, 'ov_right.label', TX_NS)}</span>
                        <SmartNumericInput 
                            value={ovRight} 
                            step={0.01} decimals={2}
                            unit="mm"
                            onChange={(val) => {
                                setOvRight(val);
                                triggerUpdate({ nalozenie_prawe_mm: val });
                            }}
                            style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }} 
                        />
                    </div>
                </div>
            </div>

            {/* Okucia (Zawiasy) */}
            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>
                    {tx(doorsTekst, 'hinges.title', TX_NS)}
                </div>

                {/* Informacja o wadze i sugerowanej ilości zawiasów */}
                {(() => {
                    const sbW = dimToMm(container?.width);
                    const sbH = dimToMm(container?.height);
                    if (sbW <= 0 || sbH <= 0) return null;
                    const info = calculateDoorWeightAndHinges({
                        sbWidth: sbW,
                        sbHeight: sbH,
                        doorType: activeDoor,
                        gap: toNum(gap, 4),
                        ovTop: toNum(ovTop, 14),
                        ovBottom: toNum(ovBottom, 15),
                        ovLeft: toNum(ovLeft, 16),
                        ovRight: toNum(ovRight, 16),
                        thickness: toNum(p.grubosc_frontu_mm, DEFAULT_DOOR_THICKNESS)
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
                            gap: '4px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{tx(doorsTekst, info.isDouble ? 'weight_info.leaf_weight' : 'weight_info.front_weight', TX_NS)}</span>
                                <strong style={{ color: '#f4f4f5' }}>{info.weightKg} kg</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{tx(doorsTekst, info.isDouble ? 'weight_info.suggested_hinges_per_leaf' : 'weight_info.suggested_hinges', TX_NS)}</span>
                                <strong style={{ color: '#f4f4f5' }}>{info.suggestedHingesPerLeaf} {tx(doorsTekst, 'weight_info.unit_pcs', TX_NS)}</strong>
                            </div>
                        </div>
                    );
                })()}

                <HingeBrandFilter
                    value={hingeBrand}
                    label={tx(doorsTekst, 'hinge_brand.label', TX_NS)}
                    onChange={(brand) => {
                        setHingeBrand(brand);
                        const newTpl = firstHingeIdForBrand(brand, 'DOORS', DEFAULT_HINGE_ID);
                        setHingeTemplate(newTpl);
                        setHinge1Template(getPairedHingeDefault(1, undefined, newTpl));
                        setHinge2Template(getPairedHingeDefault(2, undefined, newTpl));
                        setHinge3Template(getPairedHingeDefault(3, undefined, newTpl));
                        setHinge4Template(getPairedHingeDefault(4, undefined, newTpl));
                        setHinge5Template(getPairedHingeDefault(5, undefined, newTpl));
                        setHinge6Template(getPairedHingeDefault(6, undefined, newTpl));
                        triggerUpdate({
                            producent_zawiasow: brand,
                            domyslny_zawias_id: newTpl,
                            zawias_1_szablon: undefined,
                            zawias_2_szablon: undefined,
                            zawias_3_szablon: undefined,
                            zawias_4_szablon: undefined,
                            zawias_5_szablon: undefined,
                            zawias_6_szablon: undefined
                        });
                    }}
                />

                {/* Zawiasy 1 do 6 */}
                {(() => {
                    const sbHeight = dimToMm(container?.height);
                    const ovTopMm = toNum(ovTop, 14);
                    const ovBottomMm = toNum(ovBottom, 15);
                    return [
                        { labelKey: 'hinge_row.bottom_label', n: 1, active: useHinge1, setActive: setUseHinge1, val: hinge1Pos, setVal: setHinge1Pos, tpl: hinge1Template, setTpl: setHinge1Template, keyActive: 'uzyj_zawias_1', keyPos: 'pozycja_zawias_1_mm', keyTpl: 'zawias_1_szablon', fromTop: false },
                        { labelKey: 'hinge_row.middle_label', n: 2, active: useHinge2, setActive: setUseHinge2, val: hinge2Pos, setVal: setHinge2Pos, tpl: hinge2Template, setTpl: setHinge2Template, keyActive: 'uzyj_zawias_2', keyPos: 'pozycja_zawias_2_mm', keyTpl: 'zawias_2_szablon', fromTop: false },
                        { labelKey: 'hinge_row.middle_label', n: 3, active: useHinge3, setActive: setUseHinge3, val: hinge3Pos, setVal: setHinge3Pos, tpl: hinge3Template, setTpl: setHinge3Template, keyActive: 'uzyj_zawias_3', keyPos: 'pozycja_zawias_3_mm', keyTpl: 'zawias_3_szablon', fromTop: false },
                        { labelKey: 'hinge_row.middle_label', n: 4, active: useHinge4, setActive: setUseHinge4, val: hinge4Pos, setVal: setHinge4Pos, tpl: hinge4Template, setTpl: setHinge4Template, keyActive: 'uzyj_zawias_4', keyPos: 'pozycja_zawias_4_mm', keyTpl: 'zawias_4_szablon', fromTop: false },
                        { labelKey: 'hinge_row.middle_label', n: 5, active: useHinge5, setActive: setUseHinge5, val: hinge5Pos, setVal: setHinge5Pos, tpl: hinge5Template, setTpl: setHinge5Template, keyActive: 'uzyj_zawias_5', keyPos: 'pozycja_zawias_5_mm', keyTpl: 'zawias_5_szablon', fromTop: false },
                        { labelKey: 'hinge_row.top_label', n: 6, active: useHinge6, setActive: setUseHinge6, val: hinge6Pos, setVal: setHinge6Pos, tpl: hinge6Template, setTpl: setHinge6Template, keyActive: 'uzyj_zawias_6', keyPos: 'pozycja_zawias_6_mm', keyTpl: 'zawias_6_szablon', fromTop: true },
                    ].map((h, i) => {
                        const outOfPanel = h.active && isDoorHingeOutOfPanel({
                            posMm: toNum(h.val, 0),
                            fromTop: h.fromTop,
                            sbHeight,
                            ovTop: ovTopMm,
                            ovBottom: ovBottomMm,
                            hingeId: h.tpl
                        });
                        return (
                            <div
                                key={i}
                                title={outOfPanel ? tx(doorsTekst, 'hinge_out_of_panel.warning', TX_NS) : undefined}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 4px',
                                    margin: '0 -4px',
                                    borderRadius: '3px',
                                    background: outOfPanel ? '#3b1515' : 'transparent',
                                    border: outOfPanel ? '1px solid #7f1d1d' : '1px solid transparent'
                                }}
                            >
                                <input 
                                    type="checkbox" 
                                    id={`chkHinge_${i}`}
                                    checked={h.active}
                                    onChange={(e) => {
                                        h.setActive(e.target.checked);
                                        triggerUpdate({ [h.keyActive]: e.target.checked } as Partial<DoorsPlanParams>);
                                    }}
                                    style={{ margin: 0, cursor: 'pointer' }}
                                />
                                <label
                                    htmlFor={`chkHinge_${i}`}
                                    style={{
                                        color: outOfPanel ? '#f87171' : (h.active ? '#e4e4e7' : '#71717a'),
                                        fontSize: '11px',
                                        cursor: 'pointer',
                                        fontWeight: outOfPanel ? 'bold' : 'normal',
                                        width: '42px',
                                        flexShrink: 0,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {tx(doorsTekst, h.labelKey, TX_NS, { n: h.n })}
                                </label>
                                <SmartNumericInput 
                                    value={h.val}
                                    disabled={!h.active}
                                    step={0.01} decimals={2}
                                    unit="mm"
                                    onChange={(v) => {
                                        h.setVal(v);
                                        triggerUpdate({ [h.keyPos]: v } as Partial<DoorsPlanParams>);
                                    }}
                                    style={{
                                        width: '52px',
                                        padding: '2px 3px',
                                        background: h.active ? '#18181b' : '#18181b80',
                                        border: `1px solid ${outOfPanel ? '#ef4444' : '#3f3f46'}`,
                                        color: outOfPanel ? '#fca5a5' : (h.active ? '#fff' : '#71717a'),
                                        borderRadius: '3px',
                                        textAlign: 'right',
                                        fontSize: '11px',
                                        flexShrink: 0
                                    }}
                                />
                                <select
                                    disabled={!h.active}
                                    value={h.tpl}
                                    onChange={(e) => {
                                        h.setTpl(e.target.value);
                                        triggerUpdate({ [h.keyTpl]: e.target.value } as Partial<DoorsPlanParams>);
                                    }}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        padding: '2px 3px',
                                        background: h.active ? '#18181b' : '#18181b80',
                                        border: '1px solid #3f3f46',
                                        color: h.active ? '#fff' : '#71717a',
                                        borderRadius: '3px',
                                        fontSize: '10px',
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {renderHingeSelectOptions(hingeBrand, 'DOORS')}
                                </select>
                            </div>
                        );
                    });
                })()}
            </div>

        </div>
    );
}
