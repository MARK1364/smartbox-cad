/**
 * drawers-adapter.tsx — moduł SZUFLADY (smartbox_drawers)
 * Odpowiednik @@BLENDER/A2_smartbox/drawers_1_addon_v1.py
 *
 * Panel UI (DrawersSubModule) + mapowanie parametrów na silnik (buildDrawersPlan).
 * Dropdowny producenta/długości/systemu z web/Biblioteki/szuflady.json (adapter okucia/).
 * Nawiercenia korpusu: drawers-drilling-builder.ts, sync w smartbox-core.ts.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { DrawersEngine, listRailBrands, listRailLengthsForBrand, listRailSystemsForBrand, resolveDrawerLayout } from './drawers-engine.js';
import type { ModuleDims } from './base-engine.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_RAIL_ID } from '../Biblioteki/okucia/index.js';

const SPACER_THICK_MM = 18;
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

export function buildDrawersPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new DrawersEngine();
    const count = Math.max(0, Math.min(MAX_DRAWERS, Math.round(params.count ?? params.drawerCount ?? 3)));
    const railConfigs: Record<number, { length: string; system: string }> = {};
    const src = params.railConfigs || params.rail_configs || {};
    for (let i = 1; i <= count; i++) {
        const cfg = src[i] || src[String(i)] || {};
        railConfigs[i] = {
            length: String(cfg.length || params.rail_length || '500'),
            system: cfg.system || params.rail_system || DEFAULT_RAIL_ID
        };
    }
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness || 18,
        count,
        frontHeightAuto: params.frontHeightAuto !== undefined ? params.frontHeightAuto : (params.front_height_auto !== false),
        commonGap: params.commonGap ?? params.common_gap ?? 3,
        frontHeights: params.frontHeights || params.front_heights || emptyHeights(),
        individualGaps: params.individualGaps || params.individual_gaps || emptyGaps(),
        ovTop: params.ovTop ?? params.overlap_top ?? params.ov_top ?? 15,
        ovBottom: params.ovBottom ?? params.overlap_bottom ?? params.ov_bottom ?? 15,
        ovLeft: params.ovLeft ?? params.overlap_left ?? params.ov_left ?? 15,
        ovRight: params.ovRight ?? params.overlap_right ?? params.ov_right ?? 15,
        spacerL: params.spacerL ?? (params.enable_spacer_L ? SPACER_THICK_MM : 0),
        spacerR: params.spacerR ?? (params.enable_spacer_R ? SPACER_THICK_MM : 0),
        railConfigs
    });
}

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

export function DrawersSubModule({ container, triggerUpdate }: { container: any, triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};
    const brands = listRailBrands();

    const [count, setCount] = useState<number>(Math.min(MAX_DRAWERS, p.count ?? p.drawerCount ?? 3));
    const [frontHeightAuto, setFrontHeightAuto] = useState<boolean>(p.frontHeightAuto !== undefined ? !!p.frontHeightAuto : p.front_height_auto !== false);
    const [commonGap, setCommonGap] = useState<string | number>(p.commonGap ?? p.common_gap ?? 3);
    const [frontHeights, setFrontHeights] = useState<number[]>(p.frontHeights || p.front_heights || emptyHeights());
    const [individualGaps, setIndividualGaps] = useState<number[]>(p.individualGaps || p.individual_gaps || emptyGaps());
    const [ovTop, setOvTop] = useState<string | number>(p.ovTop ?? p.overlap_top ?? p.ov_top ?? 15);
    const [ovBottom, setOvBottom] = useState<string | number>(p.ovBottom ?? p.overlap_bottom ?? p.ov_bottom ?? 15);
    const [ovLeft, setOvLeft] = useState<string | number>(p.ovLeft ?? p.overlap_left ?? p.ov_left ?? 15);
    const [ovRight, setOvRight] = useState<string | number>(p.ovRight ?? p.overlap_right ?? p.ov_right ?? 15);
    const [spacerL, setSpacerL] = useState<boolean>(!!(p.spacerL > 0 || p.enable_spacer_L));
    const [spacerR, setSpacerR] = useState<boolean>(!!(p.spacerR > 0 || p.enable_spacer_R));
    const [manufacturer, setManufacturer] = useState<string>(p.railManufacturer || p.rail_manufacturer || brands[0] || 'Blum');
    const [railConfigs, setRailConfigs] = useState<Record<number, { length: string; system: string }>>(() => {
        const src = p.railConfigs || p.rail_configs || {};
        const next: Record<number, { length: string; system: string }> = {};
        const systems = listRailSystemsForBrand(p.railManufacturer || p.rail_manufacturer || brands[0] || 'Blum');
        const lengths = listRailLengthsForBrand(p.railManufacturer || p.rail_manufacturer || brands[0] || 'Blum');
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
        setCount(Math.min(MAX_DRAWERS, gp.count ?? gp.drawerCount ?? 3));
        setFrontHeightAuto(gp.frontHeightAuto !== undefined ? !!gp.frontHeightAuto : gp.front_height_auto !== false);
        setCommonGap(gp.commonGap ?? gp.common_gap ?? 3);
        setFrontHeights(gp.frontHeights || gp.front_heights || emptyHeights());
        setIndividualGaps(gp.individualGaps || gp.individual_gaps || emptyGaps());
        setOvTop(gp.ovTop ?? gp.overlap_top ?? gp.ov_top ?? 15);
        setOvBottom(gp.ovBottom ?? gp.overlap_bottom ?? gp.ov_bottom ?? 15);
        setOvLeft(gp.ovLeft ?? gp.overlap_left ?? gp.ov_left ?? 15);
        setOvRight(gp.ovRight ?? gp.overlap_right ?? gp.ov_right ?? 15);
        setSpacerL(!!(gp.spacerL > 0 || gp.enable_spacer_L));
        setSpacerR(!!(gp.spacerR > 0 || gp.enable_spacer_R));
        const brand = gp.railManufacturer || gp.rail_manufacturer || brands[0] || 'Blum';
        setManufacturer(brand);
        const src = gp.railConfigs || gp.rail_configs || {};
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

    const pushUpdate = (patch: Record<string, any>) => {
        triggerUpdate({
            count,
            drawerCount: count,
            frontHeightAuto,
            commonGap: toNum(commonGap, 3),
            frontHeights,
            individualGaps,
            ovTop: toNum(ovTop, 15),
            ovBottom: toNum(ovBottom, 15),
            ovLeft: toNum(ovLeft, 15),
            ovRight: toNum(ovRight, 15),
            enable_spacer_L: spacerL,
            enable_spacer_R: spacerR,
            spacerL: spacerL ? SPACER_THICK_MM : 0,
            spacerR: spacerR ? SPACER_THICK_MM : 0,
            railManufacturer: manufacturer,
            rail_manufacturer: manufacturer,
            railConfigs,
            ...patch
        });
    };

    const layout = resolveDrawerLayout({
        count,
        frontHeightAuto,
        commonGap: toNum(commonGap, 3),
        frontHeights,
        individualGaps,
        ovTop: toNum(ovTop, 15),
        ovBottom: toNum(ovBottom, 15),
        ovLeft: toNum(ovLeft, 15),
        ovRight: toNum(ovRight, 15),
        spacerL: spacerL ? SPACER_THICK_MM : 0,
        spacerR: spacerR ? SPACER_THICK_MM : 0,
        railConfigs
    }, {
        width: dimToMm(container?.width) || 600,
        height: dimToMm(container?.height) || 720,
        depth: dimToMm(container?.depth) || 500
    });

    const setRail = (index: number, patch: Partial<{ length: string; system: string }>) => {
        const next = { ...railConfigs, [index]: { ...railConfigs[index], ...patch } };
        setRailConfigs(next);
        pushUpdate({ railConfigs: next });
    };

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={rowStyle}>
                <span style={labelStyle}>Ilość szuflad:</span>
                <SmartNumericInput
                    value={count}
                    min={1} max={MAX_DRAWERS} step={1}
                    style={{ ...inputStyle, width: '120px' }}
                    onChange={(val) => {
                        const n = Math.max(1, Math.min(MAX_DRAWERS, Math.round(val)));
                        setCount(n);
                        pushUpdate({ count: n, drawerCount: n });
                    }}
                />
            </div>

            <div style={rowStyle}>
                <span style={labelStyle}>Producent prowadnic:</span>
                <select
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
                        pushUpdate({ railManufacturer: brand, rail_manufacturer: brand, railConfigs: next });
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
                        pushUpdate({ frontHeightAuto: e.target.checked });
                    }}
                />
                <label htmlFor="chkFrontAuto" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>Wysokości frontów: Auto</label>
            </div>

            {frontHeightAuto && (
                <div style={rowStyle}>
                    <span style={labelStyle}>Szczelina (wspólna):</span>
                    <SmartNumericInput
                        value={commonGap}
                        min={0} step={0.5} unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            setCommonGap(val);
                            pushUpdate({ commonGap: toNum(val, 3) });
                        }}
                    />
                </div>
            )}

            {!frontHeightAuto && (
                <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>Wysokości frontów</div>
                    {Array.from({ length: count }).map((_, i) => (
                        <React.Fragment key={i}>
                            <div style={rowStyle}>
                                <span style={{ ...labelStyle, fontSize: '11px' }}>Wys. frontu {i + 1}:</span>
                                <SmartNumericInput
                                    value={frontHeights[i] ?? 150}
                                    min={10} step={1} unit="mm"
                                    style={{ ...inputStyle, width: '80px', fontSize: '11px' }}
                                    onChange={(val) => {
                                        const next = [...frontHeights];
                                        next[i] = toNum(val, 150);
                                        setFrontHeights(next);
                                        pushUpdate({ frontHeights: next });
                                    }}
                                />
                            </div>
                            {i < count - 1 && (
                                <div style={rowStyle}>
                                    <span style={{ ...labelStyle, fontSize: '11px' }}>Szczelina {i + 1}:</span>
                                    <SmartNumericInput
                                        value={individualGaps[i] ?? 3}
                                        min={0} step={0.5} unit="mm"
                                        style={{ ...inputStyle, width: '80px', fontSize: '11px' }}
                                        onChange={(val) => {
                                            const next = [...individualGaps];
                                            next[i] = toNum(val, 3);
                                            setIndividualGaps(next);
                                            pushUpdate({ individualGaps: next });
                                        }}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}

            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>Nałożenia frontu</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {([
                        ['Góra', ovTop, setOvTop, 'ovTop'],
                        ['Lewo', ovLeft, setOvLeft, 'ovLeft'],
                        ['Dół', ovBottom, setOvBottom, 'ovBottom'],
                        ['Prawo', ovRight, setOvRight, 'ovRight'],
                    ] as const).map(([label, val, setter, key]) => (
                        <div key={key} style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>{label}:</span>
                            <SmartNumericInput
                                value={val}
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
                    <input type="checkbox" id="chkSpacerL" checked={spacerL} onChange={(e) => { setSpacerL(e.target.checked); pushUpdate({ enable_spacer_L: e.target.checked, spacerL: e.target.checked ? SPACER_THICK_MM : 0 }); }} />
                    <label htmlFor="chkSpacerL" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>Dystans lewy</label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" id="chkSpacerR" checked={spacerR} onChange={(e) => { setSpacerR(e.target.checked); pushUpdate({ enable_spacer_R: e.target.checked, spacerR: e.target.checked ? SPACER_THICK_MM : 0 }); }} />
                    <label htmlFor="chkSpacerR" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>Dystans prawy</label>
                </div>
            </div>

            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>Prowadnice (per szuflada)</div>
                {layout.slots.map((slot) => {
                    const warn = slot.frontOutOfPanel || slot.corpusHolesOutOfPanel;
                    const cfg = railConfigs[slot.index] || { length: lengths[0] || '500', system: fallbackRailSystem(systems) };
                    const title = slot.frontOutOfPanel
                        ? 'Ostrzeżenie: front wychodzi poza formatkę / gabaryt SmartBoxa'
                        : (slot.corpusHolesOutOfPanel ? 'Ostrzeżenie: skrzynka lub otwory korpusu wychodzą poza wysokość SmartBoxa / formatkę boku' : undefined);
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
                                {warn ? '⚠ ' : ''}Szuflada {slot.index}
                                <span style={{ opacity: 0.7, marginLeft: '6px' }}>{Math.round(slot.frontH)} mm</span>
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
                                <span style={{ ...labelStyle, fontSize: '11px' }}>System:</span>
                                <select
                                    value={cfg.system}
                                    style={{ ...selectStyle, width: '160px', fontSize: '11px' }}
                                    onChange={(e) => setRail(slot.index, { system: e.target.value })}
                                >
                                    {systems.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.corpusHeightMm}mm)</option>)}
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
