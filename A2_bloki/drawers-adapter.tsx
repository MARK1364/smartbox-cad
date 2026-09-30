/**
 * drawers-adapter.tsx — moduł SZUFLADY (blok_drawers)
 * Odpowiednik @@BLENDER/A2_bloki/drawers_1_addon_v1.py
 *
 * Panel UI (DrawersSubModule) + mapowanie parametrów na silnik (buildDrawersPlan).
 * Dropdowny producenta/długości/systemu z web/Biblioteki/szuflady.json (adapter okucia/).
 * Nawiercenia korpusu: drawers-drilling-builder.ts, sync w bloki-core.ts.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateDrawersPlan, normalizeDrawersParams, listRailBrands, listRailLengthsForBrand, listRailSystemsForBrand, resolveDrawerLayout } from './drawers-engine.js';
import type { ModuleDims } from './base-engine.js';
import type { BlokiPlanResult } from './bloki-types.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_RAIL_ID } from '../B1_biblioteka/index.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import drawersTekstRaw from './drawers_tekst.json';

import drawersRules from './drawers_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import type { DrawersPlanParams } from './bloki-module-types.js';

const drawersTekst = drawersTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.drawers';

const SPACER_THICK_MM = resolveRuleThicknessMm(drawersRules, ['SPACER_L', 'SPACER_R', 'SPACER'], 'spacer_thickness', 'drawers');
const MAX_DRAWERS = 5;

function fallbackRailSystem(systems: { id: string }[]): string {
    return systems.find((s) => s.id === DEFAULT_RAIL_ID)?.id || systems[0]?.id || DEFAULT_RAIL_ID;
}

function toNum(val: string | number | undefined, fallback = 0): number {
    const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
    return Number.isFinite(n) ? n : fallback;
}

function dimToMm(raw: number | undefined): number {
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return 0;
    return nmToMm(Number(raw));
}

function emptyHeights(): number[] {
    return [150, 150, 150, 150, 150];
}
function emptyGaps(): number[] {
    return [3, 3, 3, 3];
}

export { buildDrawersPlan } from './module-plans.js';

const inputStyle: React.CSSProperties = {
    width: '90px',
    padding: '3px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    textAlign: 'right'
};
const selectStyle: React.CSSProperties = {
    width: '160px',
    padding: '3px 4px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    fontSize: '12px'
};
const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};
const labelStyle: React.CSSProperties = { color: '#d4d4d8', fontSize: '12px' };

import type { ContainerModel } from '../A1_core/container-model.js';

export function DrawersSubModule({ container, triggerUpdate }: { container: ContainerModel, triggerUpdate: (params: Partial<DrawersPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};
    const brands = listRailBrands();

    const [count, setCount] = useState<number>(Math.min(MAX_DRAWERS, p.liczba_szuflad ?? 3));
    const [frontHeightAuto, setFrontHeightAuto] = useState<boolean>(p.auto_wysokosc_frontu !== undefined ? !!p.auto_wysokosc_frontu : true);
    const [commonGap, setCommonGap] = useState<string | number>(p.szczelina_wspolna_mm ?? 3);
    const [frontHeights, setFrontHeights] = useState<number[]>(p.wysokosci_frontow_mm || emptyHeights());
    const [individualGaps, setIndividualGaps] = useState<number[]>(p.szczeliny_indywidualne_mm || emptyGaps());
    const [ovTop, setOvTop] = useState<string | number>(p.nalozenie_gora_mm ?? 15);
    const [ovBottom, setOvBottom] = useState<string | number>(p.nalozenie_dol_mm ?? 15);
    const [ovLeft, setOvLeft] = useState<string | number>(p.nalozenie_lewe_mm ?? 15);
    const [ovRight, setOvRight] = useState<string | number>(p.nalozenie_prawe_mm ?? 15);
    const [spacerL, setSpacerL] = useState<boolean>((p.dystans_lewy_mm ?? 0) > 0);
    const [spacerR, setSpacerR] = useState<boolean>((p.dystans_prawy_mm ?? 0) > 0);
    const [manufacturer, setManufacturer] = useState<string>(p.producent_prowadnic || brands[0] || 'Blum');
    const [railConfigs, setRailConfigs] = useState<Record<number, { length: string; system: string }>>(() => {
        const src = p.konfiguracje_prowadnic || {};
        const next: Record<number, { length: string; system: string }> = {};
        const systems = listRailSystemsForBrand(p.producent_prowadnic || brands[0] || 'Blum');
        const lengths = listRailLengthsForBrand(p.producent_prowadnic || brands[0] || 'Blum');
        for (let i = 1; i <= MAX_DRAWERS; i++) {
            const cfg = src[i] || src[String(i)] || {};
            next[i] = {
                length: String(cfg.length || lengths[0] || '500'),
                system: cfg.system || fallbackRailSystem(systems)
            };
        }
        return next;
    });

    useEffect(() => {
        const gp = container?.generatorParams || {};
        setCount(Math.min(MAX_DRAWERS, gp.liczba_szuflad ?? 3));
        setFrontHeightAuto(gp.auto_wysokosc_frontu !== undefined ? !!gp.auto_wysokosc_frontu : true);
        setCommonGap(gp.szczelina_wspolna_mm ?? 3);
        setFrontHeights(gp.wysokosci_frontow_mm || emptyHeights());
        setIndividualGaps(gp.szczeliny_indywidualne_mm || emptyGaps());
        setOvTop(gp.nalozenie_gora_mm ?? 15);
        setOvBottom(gp.nalozenie_dol_mm ?? 15);
        setOvLeft(gp.nalozenie_lewe_mm ?? 15);
        setOvRight(gp.nalozenie_prawe_mm ?? 15);
        setSpacerL((gp.dystans_lewy_mm ?? 0) > 0);
        setSpacerR((gp.dystans_prawy_mm ?? 0) > 0);
        const brand = gp.producent_prowadnic || brands[0] || 'Blum';
        setManufacturer(brand);
        const src = gp.konfiguracje_prowadnic || {};
        const sys = listRailSystemsForBrand(brand);
        const len = listRailLengthsForBrand(brand);
        const next: Record<number, { length: string; system: string }> = {};
        for (let i = 1; i <= MAX_DRAWERS; i++) {
            const cfg = src[i] || src[String(i)] || {};
            next[i] = {
                length: String(cfg.length || len[0] || '500'),
                system: cfg.system || fallbackRailSystem(sys)
            };
        }
        setRailConfigs(next);
    }, [container?.id]);

    const systems = listRailSystemsForBrand(manufacturer);
    const lengths = listRailLengthsForBrand(manufacturer);

    const pushUpdate = (patch: Partial<DrawersPlanParams>) => {
        triggerUpdate({
            liczba_szuflad: count,
            auto_wysokosc_frontu: frontHeightAuto,
            szczelina_wspolna_mm: toNum(commonGap, 3),
            wysokosci_frontow_mm: frontHeights,
            szczeliny_indywidualne_mm: individualGaps,
            nalozenie_gora_mm: toNum(ovTop, 15),
            nalozenie_dol_mm: toNum(ovBottom, 15),
            nalozenie_lewe_mm: toNum(ovLeft, 15),
            nalozenie_prawe_mm: toNum(ovRight, 15),
            dystans_lewy_mm: spacerL ? SPACER_THICK_MM : 0,
            dystans_prawy_mm: spacerR ? SPACER_THICK_MM : 0,
            producent_prowadnic: manufacturer,
            konfiguracje_prowadnic: railConfigs,
            ...patch
        });
    };

    const layout = resolveDrawerLayout({
        liczba_szuflad: count,
        auto_wysokosc_frontu: frontHeightAuto,
        szczelina_wspolna_mm: toNum(commonGap, 3),
        wysokosci_frontow_mm: frontHeights,
        szczeliny_indywidualne_mm: individualGaps,
        nalozenie_gora_mm: toNum(ovTop, 15),
        nalozenie_dol_mm: toNum(ovBottom, 15),
        nalozenie_lewe_mm: toNum(ovLeft, 15),
        nalozenie_prawe_mm: toNum(ovRight, 15),
        dystans_lewy_mm: spacerL ? SPACER_THICK_MM : 0,
        dystans_prawy_mm: spacerR ? SPACER_THICK_MM : 0,
        konfiguracje_prowadnic: railConfigs
    }, {
        width_mm: dimToMm(container?.width) || 600,
        height_mm: dimToMm(container?.height) || 720,
        depth_mm: dimToMm(container?.depth) || 500
    });

    const setRail = (index: number, patch: Partial<{ length: string; system: string }>) => {
        const next = { ...railConfigs, [index]: { ...railConfigs[index], ...patch } };
        setRailConfigs(next);
        pushUpdate({ konfiguracje_prowadnic: next });
    };

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={rowStyle}>
                <span style={labelStyle}>{tx(drawersTekst, 'count.label', TX_NS)}</span>
                <SmartNumericInput
                    id="sb-drawer-count-input"
                    value={count}
                    min={1} max={MAX_DRAWERS} step={1} decimals={0}
                    style={{ ...inputStyle, width: '120px' }}
                    onChange={(val) => {
                        const n = Math.max(1, Math.min(MAX_DRAWERS, Math.round(val)));
                        setCount(n);
                        pushUpdate({ liczba_szuflad: n });
                    }}
                />
            </div>

            <div style={rowStyle}>
                <span style={labelStyle}>{tx(drawersTekst, 'rail_manufacturer.label', TX_NS)}</span>
                <select
                    id="sb-drawer-brand-select"
                    value={manufacturer}
                    style={selectStyle}
                    onChange={(e) => {
                        const brand = e.target.value;
                        setManufacturer(brand);
                        const sys = listRailSystemsForBrand(brand);
                        const len = listRailLengthsForBrand(brand);
                        const next: Record<number, { length: string; system: string }> = {};
                        for (let i = 1; i <= MAX_DRAWERS; i++) {
                            next[i] = {
                                system: sys[0]?.id || railConfigs[i]?.system,
                                length: len[0] || railConfigs[i]?.length || '500'
                            };
                        }
                        setRailConfigs(next);
                        pushUpdate({ producent_prowadnic: brand, konfiguracje_prowadnic: next });
                    }}
                >
                    {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                    type="checkbox"
                    id="chkFrontAuto"
                    checked={frontHeightAuto}
                    onChange={(e) => {
                        setFrontHeightAuto(e.target.checked);
                        pushUpdate({ auto_wysokosc_frontu: e.target.checked });
                    }}
                />
                <label htmlFor="chkFrontAuto" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>{tx(drawersTekst, 'front_height_auto.label', TX_NS)}</label>
            </div>

            {frontHeightAuto && (
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(drawersTekst, 'common_gap.label', TX_NS)}</span>
                    <SmartNumericInput
                        value={commonGap}
                        min={0} step={0.01} decimals={2} unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            setCommonGap(val);
                            pushUpdate({ szczelina_wspolna_mm: toNum(val, 3) });
                        }}
                    />
                </div>
            )}

            {!frontHeightAuto && (
                <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>{tx(drawersTekst, 'front_heights.title', TX_NS)}</div>
                    {Array.from({ length: count }).map((_, i) => (
                        <React.Fragment key={i}>
                            <div style={rowStyle}>
                                <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(drawersTekst, 'front_height.label_template', TX_NS, { n: i + 1 })}</span>
                                <SmartNumericInput
                                    value={frontHeights[i] ?? 150}
                                    min={10} step={0.01} decimals={2} unit="mm"
                                    style={{ ...inputStyle, width: '80px', fontSize: '11px' }}
                                    onChange={(val) => {
                                        const next = [...frontHeights];
                                        next[i] = toNum(val, 150);
                                        setFrontHeights(next);
                                        pushUpdate({ wysokosci_frontow_mm: next });
                                    }}
                                />
                            </div>
                            {i < count - 1 && (
                                <div style={rowStyle}>
                                    <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(drawersTekst, 'gap.label_template', TX_NS, { n: i + 1 })}</span>
                                    <SmartNumericInput
                                        value={individualGaps[i] ?? 3}
                                        min={0} step={0.01} decimals={2} unit="mm"
                                        style={{ ...inputStyle, width: '80px', fontSize: '11px' }}
                                        onChange={(val) => {
                                            const next = [...individualGaps];
                                            next[i] = toNum(val, 3);
                                            setIndividualGaps(next);
                                            pushUpdate({ szczeliny_indywidualne_mm: next });
                                        }}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}

            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>{tx(drawersTekst, 'overlaps.title', TX_NS)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {([
                        ['overlap_top', ovTop, setOvTop, 'nalozenie_gora_mm'],
                        ['overlap_left', ovLeft, setOvLeft, 'nalozenie_lewe_mm'],
                        ['overlap_bottom', ovBottom, setOvBottom, 'nalozenie_dol_mm'],
                        ['overlap_right', ovRight, setOvRight, 'nalozenie_prawe_mm'],
                    ] as const).map(([labelKey, val, setter, key]) => (
                        <div key={key} style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(drawersTekst, `${labelKey}.label`, TX_NS)}:</span>
                            <SmartNumericInput
                                value={val}
                                step={0.01}
                                decimals={2}
                                unit="mm"
                                style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }}
                                onChange={(v) => {
                                    setter(v);
                                    pushUpdate({ [key]: toNum(v, 15) });
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" id="chkSpacerL" checked={spacerL} onChange={(e) => { setSpacerL(e.target.checked); pushUpdate({ dystans_lewy_mm: e.target.checked ? SPACER_THICK_MM : 0 }); }} />
                    <label htmlFor="chkSpacerL" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>{tx(drawersTekst, 'spacer_left.label', TX_NS)}</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" id="chkSpacerR" checked={spacerR} onChange={(e) => { setSpacerR(e.target.checked); pushUpdate({ dystans_prawy_mm: e.target.checked ? SPACER_THICK_MM : 0 }); }} />
                    <label htmlFor="chkSpacerR" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>{tx(drawersTekst, 'spacer_right.label', TX_NS)}</label>
                </div>
            </div>

            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>{tx(drawersTekst, 'rails.title', TX_NS)}</div>
                {layout.slots.map((slot) => {
                    const warn = slot.frontOutOfPanel || slot.corpusHolesOutOfPanel;
                    const cfg = railConfigs[slot.index] || { length: lengths[0] || '500', system: fallbackRailSystem(systems) };
                    const title = slot.frontOutOfPanel
                        ? tx(drawersTekst, 'warnings.front_out_of_panel', TX_NS)
                        : (slot.corpusHolesOutOfPanel ? tx(drawersTekst, 'warnings.corpus_holes_out_of_panel', TX_NS) : undefined);
                    return (
                        <div
                            key={slot.index}
                            title={title}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                padding: '6px',
                                borderRadius: '3px',
                                background: warn ? '#3b1515' : '#18181b',
                                border: warn ? '1px solid #7f1d1d' : '1px solid #27272a'
                            }}
                        >
                            <div style={{ color: warn ? '#f87171' : '#e4e4e7', fontSize: '11px', fontWeight: warn ? 'bold' : 'normal' }}>
                                {tx(drawersTekst, 'drawer.slot_label', TX_NS, { n: slot.index })}
                                <span style={{ opacity: 0.7, marginLeft: '6px' }}>{Math.round(slot.frontH * 100) / 100} mm</span>
                            </div>
                            <div style={rowStyle}>
                                <span style={{ ...labelStyle, fontSize: '11px' }}>Długość:</span>
                                <select
                                    value={cfg.length}
                                    style={{ ...selectStyle, width: '110px', fontSize: '11px' }}
                                    onChange={(e) => setRail(slot.index, { length: e.target.value })}
                                >
                                    {lengths.map((l) => <option key={l} value={l}>{l} mm</option>)}
                                </select>
                            </div>
                            <div style={rowStyle}>
                                <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(drawersTekst, 'rail_system.label', TX_NS)}</span>
                                <select
                                    value={cfg.system}
                                    style={{ ...selectStyle, width: '160px', fontSize: '11px' }}
                                    onChange={(e) => setRail(slot.index, { system: e.target.value })}
                                >
                                    {(() => {
                                        const seriesMap = new Map<string, typeof systems>();
                                        for (const s of systems) {
                                            const key = s.series || 'Inne';
                                            if (!seriesMap.has(key)) seriesMap.set(key, []);
                                            seriesMap.get(key)!.push(s);
                                        }
                                        return Array.from(seriesMap.entries()).map(([ser, sysList]) => (
                                            <optgroup key={ser} label={ser}>
                                                {sysList.map((s) => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.corpusHeightMm}mm)</option>
                                                ))}
                                            </optgroup>
                                        ));
                                    })()}
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
