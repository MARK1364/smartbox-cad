/**
 * skosne-doors-adapter.tsx — moduł DRZWI SKOŚNE (blok_skosne_drzwi)
 *
 * Panel UI (SkosneDoorsSubModule) + mapowanie parametrów na silnik (buildSkosneDoorsPlan).
 * Nawiercenia zawiasów: skosne-doors-drilling-builder.ts, sync w pluginie.
 *
 * Kluczowa różnica wobec doors-adapter: `rodzaj_drzwi` NIE jest dowolnym wyborem.
 * Zawias musi leżeć na krawędzi pionowej trapezu, więc wybór strony zawiasu
 * jest dozwolony tylko wtedy, gdy ta strona jest wyższa. UI blokuje drugą opcję
 * i pokazuje spadek + kąt, żeby geometria była czytelna przed wygenerowaniem.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { normalizeSkosneDoorsParams } from './skosne-doors-engine.js';
import { suggestHingesPerLeaf } from './doors-engine.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_HINGE_ID, hingeFrontHolesMm } from '../B1_biblioteka/index.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import skosneDoorsTekstRaw from './skosne-doors_tekst.json';
import skosneDoorsRules from './skosne-doors_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import type { ContainerModel } from '../A1_core/container-model.js';
import type { SkosneDoorType, SkosneDoorsPlanParams } from './bloki-module-types.js';
import { ContextManager } from '../A1_core/context-manager.js';
import {
    DEFAULT_HINGE_BRAND,
    firstHingeIdForBrand,
    HingeBrandFilter,
    renderHingeSelectOptions,
    resolveHingeBrand
} from './hinge-brand-ui.js';

export { buildSkosneDoorsPlan } from './module-plans.js';

const skosneTekst = skosneDoorsTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.skosne_doors';
const DEFAULT_DOOR_THICKNESS = resolveRuleThicknessMm(
    skosneDoorsRules,
    ['DRZWI_SKOSNE', 'FRONT'],
    'front_thickness',
    'skosne_doors'
);

export function normalizeSkosneDoorType(val: string | undefined): SkosneDoorType {
    return String(val ?? 'LEFT').toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
}

function dimToMm(raw: number | undefined): number {
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return 0;
    return nmToMm(Number(raw));
}

/** Czy podana strona zawiasu jest dopuszczalna dla kąta dachu (zawias na krawędzi pionowej). */
export function isHingeSideAllowed(
    side: SkosneDoorType,
    dach_kat_deg: number | undefined
): boolean {
    if (dach_kat_deg === undefined || dach_kat_deg === 0) return true;
    return side === 'LEFT' ? dach_kat_deg <= 0 : dach_kat_deg >= 0;
}

/** Odczytuje kąt wieńca górnego (dachu) z korpusu rodzica. */
export function resolveCarcassRoofAngle(containerId?: string): number | undefined {
    if (!containerId) return undefined;
    const doc = ContextManager.instance.document;
    if (!doc) return undefined;
    const node = doc.findNode(containerId);
    const parentNode = node?.parent;
    if (!parentNode?.children) return undefined;
    const topPanel = parentNode.children.find(
        (c: any) => String(c.domainData?.role || '').toUpperCase() === 'TOP_PANEL'
    );
    if (!topPanel) return undefined;
    const rotZ = (topPanel?.domainData as any)?.lcs?.rotation?.[2];
    if (rotZ === undefined || !Number.isFinite(Number(rotZ))) return undefined;
    return -Number(rotZ);
}

/** Odczytuje grubości wieńca dolnego i górnego z paneli korpusu rodzica. */
export function resolveCarcassRails(containerId?: string): { tBot?: number; tTop?: number } {
    if (!containerId) return {};
    const doc = ContextManager.instance.document;
    if (!doc) return {};
    const node = doc.findNode(containerId);
    const parentNode = node?.parent;
    if (!parentNode?.children) return {};
    const findThickness = (role: string): number | undefined => {
        const panel = parentNode.children.find(
            (c: any) => String(c.domainData?.role || '').toUpperCase() === role
        );
        const thNm = (panel?.domainData as any)?.thickness;
        return thNm != null && Number.isFinite(Number(thNm)) ? nmToMm(thNm) : undefined;
    };
    return {
        tBot: findThickness('BOTTOM_PANEL'),
        tTop: findThickness('TOP_PANEL')
    };
}

export function SkosneDoorsSubModule({ container, triggerUpdate }: {
    container: ContainerModel;
    triggerUpdate: (params: Partial<SkosneDoorsPlanParams>) => void;
}) {
    useLocale();
    const p = container?.generatorParams || {};

    const [roofAngleDeg, setRoofAngleDeg] = useState<number | undefined>(() => {
        if (p.dach_kat_deg !== undefined) return p.dach_kat_deg;
        return resolveCarcassRoofAngle(container?.id);
    });

    const [doorType, setDoorType] = useState<string>(() => {
        if (p.rodzaj_drzwi) return normalizeSkosneDoorType(p.rodzaj_drzwi);
        const angle = p.dach_kat_deg ?? resolveCarcassRoofAngle(container?.id);
        if (angle !== undefined) return angle >= 0 ? 'RIGHT' : 'LEFT';
        return 'LEFT';
    });

    const [ovTop, setOvTop] = useState<string | number>(p.nalozenie_gora_mm ?? 14);
    const [ovBottom, setOvBottom] = useState<string | number>(p.nalozenie_dol_mm ?? 15);
    const [ovLeft, setOvLeft] = useState<string | number>(p.nalozenie_lewe_mm ?? 16);
    const [ovRight, setOvRight] = useState<string | number>(p.nalozenie_prawe_mm ?? 16);

    const getPairedHingeDefault = (idx: number, customVal?: string, globalTpl?: string): string => {
        if (customVal) return customVal;
        const base = globalTpl || p.domyslny_zawias_id || DEFAULT_HINGE_ID;
        if (base === 'BLUM_71B3550' || base === 'BLUM_71T3550') return (idx % 2 === 1) ? 'BLUM_71B3550' : 'BLUM_71T3550';
        if (base === 'BLUM_79B9550' || base === 'BLUM_79T9550') return (idx % 2 === 1) ? 'BLUM_79B9550' : 'BLUM_79T9550';
        return base;
    };

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
        setDoorType(normalizeSkosneDoorType(p.rodzaj_drzwi));

        let curAngle = p.dach_kat_deg;
        if (curAngle === undefined) {
            curAngle = resolveCarcassRoofAngle(container?.id);
            if (curAngle !== undefined) {
                triggerUpdate({ dach_kat_deg: curAngle });
            }
        }
        setRoofAngleDeg(curAngle);

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
    }, [container?.id, p.dach_kat_deg]);

    const activeDoor = normalizeSkosneDoorType(doorType);

    const sbWidth = dimToMm(container?.width);
    const sbDepth = dimToMm(container?.depth);
    const sbHeight = dimToMm(container?.height);
    const leafWidth = sbWidth + Number(ovLeft) + Number(ovRight);

    const leftAllowed = isHingeSideAllowed('LEFT', roofAngleDeg);
    const rightAllowed = isHingeSideAllowed('RIGHT', roofAngleDeg);
    const hingeSideValid = isHingeSideAllowed(activeDoor, roofAngleDeg);

    const errorBox = (text: string) => (
        <div style={{
            padding: '5px 7px',
            background: '#2a1414',
            border: '1px solid #7f1d1d',
            borderRadius: '3px',
            fontSize: '10px',
            color: '#fca5a5'
        }}>
            {text}
        </div>
    );

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Strona zawiasu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(skosneTekst, 'door_type.label', TX_NS)}</span>
                <div style={{ display: 'flex', width: '100%', borderRadius: '4px', overflow: 'hidden', border: '1px solid #3f3f46' }}>
                    {(['LEFT', 'RIGHT'] as const).map((side) => {
                        const allowed = side === 'LEFT' ? leftAllowed : rightAllowed;
                        const isActive = activeDoor === side;
                        return (
                            <button
                                key={side}
                                disabled={!allowed}
                                title={!allowed ? tx(skosneTekst, 'skos.error.hinge_on_slanted_edge', TX_NS) : undefined}
                                style={{
                                    flex: 1,
                                    padding: '5px 0',
                                    background: isActive ? '#3b82f6' : '#27272a',
                                    color: allowed ? '#fff' : '#52525b',
                                    border: 'none',
                                    borderLeft: side === 'RIGHT' ? '1px solid #3f3f46' : 'none',
                                    cursor: allowed ? 'pointer' : 'not-allowed',
                                    fontSize: '12px',
                                    fontWeight: isActive ? 'bold' : 'normal'
                                }}
                                onClick={() => { setDoorType(side); triggerUpdate({ rodzaj_drzwi: side }); }}
                            >
                                {tx(skosneTekst, `door_type.items.${side}`, TX_NS)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Skos korpusu */}
            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>
                    {tx(skosneTekst, 'skos.title', TX_NS)}
                </div>

                {roofAngleDeg === undefined && errorBox(tx(skosneTekst, 'skos.error.top_rail_missing', TX_NS))}
                {!hingeSideValid && errorBox(tx(skosneTekst, 'skos.error.hinge_on_slanted_edge', TX_NS))}

                {roofAngleDeg !== undefined && (
                    <div style={{
                        padding: '5px 7px', background: '#141416', border: '1px solid #27272a',
                        borderRadius: '3px', fontSize: '10px', color: '#a1a1aa',
                        display: 'flex', flexDirection: 'column', gap: '3px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{tx(skosneTekst, 'skos.angle', TX_NS)}</span>
                            <strong style={{ color: '#e4e4e7' }}>{roofAngleDeg.toFixed(2)}°</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{tx(skosneTekst, 'skos.vertical_edge', TX_NS)}</span>
                            <strong style={{ color: '#60a5fa' }}>
                                {activeDoor === 'LEFT' ? tx(skosneTekst, 'door_type.items.LEFT', TX_NS) : tx(skosneTekst, 'door_type.items.RIGHT', TX_NS)}
                            </strong>
                        </div>
                    </div>
                )}
            </div>

            {/* Nałożenia frontu */}
            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>
                    {tx(skosneTekst, 'overlaps.title', TX_NS)}
                </div>
                <div style={{ fontSize: '10px', color: '#71717a', lineHeight: 1.35 }}>
                    {tx(skosneTekst, 'overlaps.top_along_slope', TX_NS)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {([
                        { key: 'ov_top.label', val: ovTop, set: setOvTop, param: 'nalozenie_gora_mm' },
                        { key: 'ov_left.label', val: ovLeft, set: setOvLeft, param: 'nalozenie_lewe_mm' },
                        { key: 'ov_bottom.label', val: ovBottom, set: setOvBottom, param: 'nalozenie_dol_mm' },
                        { key: 'ov_right.label', val: ovRight, set: setOvRight, param: 'nalozenie_prawe_mm' }
                    ] as const).map((row) => (
                        <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#d4d4d8', fontSize: '11px' }}>{tx(skosneTekst, row.key, TX_NS)}</span>
                            <SmartNumericInput
                                value={row.val}
                                step={0.01} decimals={2} unit="mm"
                                onChange={(val) => { row.set(val); triggerUpdate({ [row.param]: val } as Partial<SkosneDoorsPlanParams>); }}
                                style={{ width: '70px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Okucia */}
            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>
                    {tx(skosneTekst, 'hinges.title', TX_NS)}
                </div>

                {(() => {
                    if (roofAngleDeg === undefined || leafWidth <= 0) return null;
                    const betaRad = (roofAngleDeg * Math.PI) / 180;
                    const cosBeta = Math.cos(betaRad);
                    const leafCenterH = sbHeight + Number(ovBottom) + Number(ovTop) * cosBeta;
                    const thickness = Number(p.grubosc_frontu_mm) || DEFAULT_DOOR_THICKNESS;
                    const volM3 = (leafCenterH * leafWidth * thickness) / 1_000_000_000;
                    const weightKg = parseFloat((volM3 * 680 + 0.15).toFixed(2));
                    const suggested = suggestHingesPerLeaf(leafCenterH, weightKg);
                    const activePerLeaf = [useHinge1, useHinge2, useHinge3, useHinge4, useHinge5, useHinge6]
                        .filter(Boolean).length;

                    return (
                        <div style={{
                            padding: '6px 8px', background: '#141416', border: '1px solid #27272a',
                            borderRadius: '3px', fontSize: '11px', color: '#a1a1aa',
                            display: 'flex', flexDirection: 'column', gap: '4px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    {tx(skosneTekst, 'weight_info.front_weight', TX_NS)} <strong style={{ color: '#f4f4f5' }}>{weightKg} kg</strong>
                                </span>
                                <span>
                                    {tx(skosneTekst, 'weight_info.suggested_hinges', TX_NS)}{' '}
                                    <strong style={{ color: '#60a5fa' }}>{suggested} {tx(skosneTekst, 'weight_info.unit_pcs', TX_NS)}</strong>
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#71717a' }}>
                                <span>
                                    {tx(skosneTekst, 'weight_info.active_hinges', TX_NS)}{' '}
                                    <strong style={{ color: '#e4e4e7' }}>{activePerLeaf} {tx(skosneTekst, 'weight_info.unit_pcs', TX_NS)}</strong>
                                </span>
                            </div>
                        </div>
                    );
                })()}

                <HingeBrandFilter
                    value={hingeBrand}
                    label={tx(skosneTekst, 'hinge_brand.label', TX_NS)}
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '11px' }}>{tx(skosneTekst, 'hinge_template.label', TX_NS)}</span>
                    <select
                        value={hingeTemplate}
                        onChange={(e) => {
                            const newTpl = e.target.value;
                            setHingeTemplate(newTpl);
                            if (!p.zawias_1_szablon) setHinge1Template(getPairedHingeDefault(1, undefined, newTpl));
                            if (!p.zawias_2_szablon) setHinge2Template(getPairedHingeDefault(2, undefined, newTpl));
                            if (!p.zawias_3_szablon) setHinge3Template(getPairedHingeDefault(3, undefined, newTpl));
                            if (!p.zawias_4_szablon) setHinge4Template(getPairedHingeDefault(4, undefined, newTpl));
                            if (!p.zawias_5_szablon) setHinge5Template(getPairedHingeDefault(5, undefined, newTpl));
                            if (!p.zawias_6_szablon) setHinge6Template(getPairedHingeDefault(6, undefined, newTpl));
                            triggerUpdate({ domyslny_zawias_id: newTpl, producent_zawiasow: hingeBrand });
                        }}
                        style={{ width: '180px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', fontSize: '11px' }}
                    >
                        {renderHingeSelectOptions(hingeBrand, 'DOORS')}
                    </select>
                </div>

                {(() => {
                    const betaRad = roofAngleDeg !== undefined ? (roofAngleDeg * Math.PI) / 180 : 0;
                    const tanBeta = Math.tan(betaRad);
                    const cosBeta = Math.cos(betaRad);
                    const xL = -sbWidth / 2 - Number(ovLeft);
                    const xP = +sbWidth / 2 + Number(ovRight);
                    const hL = sbHeight + xL * tanBeta + Number(ovBottom) + Number(ovTop) * cosBeta;
                    const hR = sbHeight + xP * tanBeta + Number(ovBottom) + Number(ovTop) * cosBeta;
                    const leafHeightMax = roofAngleDeg === undefined ? 0 : Math.max(hL, hR);
                    const rows = [
                        { labelKey: 'hinge_row.bottom_label', n: 1, active: useHinge1, setActive: setUseHinge1, val: hinge1Pos, setVal: setHinge1Pos, tpl: hinge1Template, setTpl: setHinge1Template, keyActive: 'uzyj_zawias_1', keyPos: 'pozycja_zawias_1_mm', keyTpl: 'zawias_1_szablon', fromTop: false },
                        { labelKey: 'hinge_row.middle_label', n: 2, active: useHinge2, setActive: setUseHinge2, val: hinge2Pos, setVal: setHinge2Pos, tpl: hinge2Template, setTpl: setHinge2Template, keyActive: 'uzyj_zawias_2', keyPos: 'pozycja_zawias_2_mm', keyTpl: 'zawias_2_szablon', fromTop: false },
                        { labelKey: 'hinge_row.middle_label', n: 3, active: useHinge3, setActive: setUseHinge3, val: hinge3Pos, setVal: setHinge3Pos, tpl: hinge3Template, setTpl: setHinge3Template, keyActive: 'uzyj_zawias_3', keyPos: 'pozycja_zawias_3_mm', keyTpl: 'zawias_3_szablon', fromTop: false },
                        { labelKey: 'hinge_row.middle_label', n: 4, active: useHinge4, setActive: setUseHinge4, val: hinge4Pos, setVal: setHinge4Pos, tpl: hinge4Template, setTpl: setHinge4Template, keyActive: 'uzyj_zawias_4', keyPos: 'pozycja_zawias_4_mm', keyTpl: 'zawias_4_szablon', fromTop: false },
                        { labelKey: 'hinge_row.middle_label', n: 5, active: useHinge5, setActive: setUseHinge5, val: hinge5Pos, setVal: setHinge5Pos, tpl: hinge5Template, setTpl: setHinge5Template, keyActive: 'uzyj_zawias_5', keyPos: 'pozycja_zawias_5_mm', keyTpl: 'zawias_5_szablon', fromTop: false },
                        { labelKey: 'hinge_row.top_label', n: 6, active: useHinge6, setActive: setUseHinge6, val: hinge6Pos, setVal: setHinge6Pos, tpl: hinge6Template, setTpl: setHinge6Template, keyActive: 'uzyj_zawias_6', keyPos: 'pozycja_zawias_6_mm', keyTpl: 'zawias_6_szablon', fromTop: true }
                    ];
                    return rows.map((h, i) => {
                        const pos = Number(h.val) || 0;
                        const localZ = h.fromTop ? (leafHeightMax - pos) : pos;
                        const vCenter = localZ + Number(ovBottom);
                        const eps = 0.05;
                        const outOfPanel = h.active && leafHeightMax > 0 && hingeFrontHolesMm(h.tpl).some((hole) => {
                            const v = vCenter + hole.yOffset;
                            return v - hole.dia / 2 < -eps || v + hole.dia / 2 > leafHeightMax + eps;
                        });
                        return (
                            <div
                                key={i}
                                title={outOfPanel ? tx(skosneTekst, 'hinge_out_of_panel.warning', TX_NS) : undefined}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '2px 4px', margin: '0 -4px', borderRadius: '3px',
                                    background: outOfPanel ? '#3b1515' : 'transparent',
                                    border: outOfPanel ? '1px solid #7f1d1d' : '1px solid transparent'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    id={`chkSkosneHinge_${i}`}
                                    checked={h.active}
                                    onChange={(e) => {
                                        h.setActive(e.target.checked);
                                        triggerUpdate({ [h.keyActive]: e.target.checked } as Partial<SkosneDoorsPlanParams>);
                                    }}
                                    style={{ margin: 0, cursor: 'pointer' }}
                                />
                                <label
                                    htmlFor={`chkSkosneHinge_${i}`}
                                    style={{
                                        color: outOfPanel ? '#f87171' : (h.active ? '#e4e4e7' : '#71717a'),
                                        fontSize: '11px', cursor: 'pointer',
                                        fontWeight: outOfPanel ? 'bold' : 'normal',
                                        width: '42px', flexShrink: 0, whiteSpace: 'nowrap'
                                    }}
                                >
                                    {tx(skosneTekst, h.labelKey, TX_NS, { n: h.n })}
                                </label>
                                <SmartNumericInput
                                    value={h.val}
                                    disabled={!h.active}
                                    step={0.01} decimals={2} unit="mm"
                                    onChange={(v) => { h.setVal(v); triggerUpdate({ [h.keyPos]: v } as Partial<SkosneDoorsPlanParams>); }}
                                    style={{
                                        width: '66px', padding: '2px 3px',
                                        background: '#18181b',
                                        border: `1px solid ${outOfPanel ? '#ef4444' : '#3f3f46'}`,
                                        color: outOfPanel ? '#fca5a5' : (h.active ? '#fff' : '#71717a'),
                                        borderRadius: '3px', textAlign: 'right', fontSize: '11px', flexShrink: 0
                                    }}
                                />
                                <select
                                    disabled={!h.active}
                                    value={h.tpl}
                                    onChange={(e) => { h.setTpl(e.target.value); triggerUpdate({ [h.keyTpl]: e.target.value } as Partial<SkosneDoorsPlanParams>); }}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '2px 3px',
                                        background: h.active ? '#18181b' : '#18181b80',
                                        border: '1px solid #3f3f46',
                                        color: h.active ? '#fff' : '#71717a',
                                        borderRadius: '3px', fontSize: '10px',
                                        textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
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