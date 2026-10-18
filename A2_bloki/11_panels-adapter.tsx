/**
 * panels-adapter.tsx — moduł BLENDY (blok_panels)
 * Odpowiednik @@BLENDER/A2_bloki/panels_1_addon_v1.py
 *
 * Panel UI (PanelsSubModule) + mapowanie parametrów na silnik (buildPanelsPlan).
 * Bez nawierceń. Gabaryt Bloku dla tego modułu liczy bloki-core na OUTER.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculatePanelsPlan, normalizePanelsParams, type SidePanelMode } from './11_panels-engine.js';
import type { ModuleDims } from './01_base-engine.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import panelsTekstRaw from './11_panels_tekst.json';
import type { PanelsPlanParams } from './01_bloki-module-types.js';

const panelsTekst = panelsTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.panels';

function toNum(val: string | number | undefined, fallback = 0): number {
    const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
    return Number.isFinite(n) ? n : fallback;
}

function mmParam(v: unknown, fallback: number): number {
    if (v === undefined || v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function asMode(raw: unknown): SidePanelMode {
    const m = String(raw || 'FULL').toUpperCase();
    if (m === 'KORPUS_BLENDA_G' || m === 'COKOL_KORPUS' || m === 'KORPUS') return m;
    return 'FULL';
}

export { buildPanelsPlan } from './01_module-plans.js';

const inputStyle: React.CSSProperties = {
    width: '80px',
    padding: '3px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    textAlign: 'right'
};
const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
};
const labelStyle: React.CSSProperties = { color: '#d4d4d8', fontSize: '12px' };
const chkLabel: React.CSSProperties = { color: '#e4e4e7', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };

import type { ContainerModel } from '../A1_core/container-model.js';

export function PanelsSubModule({ container, triggerUpdate }: { container: ContainerModel, triggerUpdate: (params: Partial<PanelsPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};
    const [mode, setMode] = useState<SidePanelMode>(asMode(p.tryb_paneli_bocznych));
    const [enableLeft, setEnableLeft] = useState<boolean>(p.wlacz_lewy !== undefined ? !!p.wlacz_lewy : true);
    const [enableRight, setEnableRight] = useState<boolean>(p.wlacz_prawy !== undefined ? !!p.wlacz_prawy : true);
    const [enableTop, setEnableTop] = useState<boolean>(p.wlacz_gorny !== undefined ? !!p.wlacz_gorny : true);
    const [enableBottom, setEnableBottom] = useState<boolean>(p.wlacz_dolny !== undefined ? !!p.wlacz_dolny : true);
    const [autoLeft, setAutoLeft] = useState<boolean>(p.auto_glebokosc_lewy !== undefined ? !!p.auto_glebokosc_lewy : true);
    const [autoRight, setAutoRight] = useState<boolean>(p.auto_glebokosc_prawy !== undefined ? !!p.auto_glebokosc_prawy : true);
    const [autoTop, setAutoTop] = useState<boolean>(p.auto_glebokosc_gorny !== undefined ? !!p.auto_glebokosc_gorny : true);
    const [depthLeft, setDepthLeft] = useState<string | number>(mmParam(p.glebokosc_blendy_lewa_mm, 100));
    const [depthRight, setDepthRight] = useState<string | number>(mmParam(p.glebokosc_blendy_prawa_mm, 100));
    const [depthTop, setDepthTop] = useState<string | number>(mmParam(p.glebokosc_blendy_gora_mm, 100));
    const [plinthHeight, setPlinthHeight] = useState<string | number>(mmParam(p.wysokosc_cokolu_mm, 97));
    const [plinthRecess, setPlinthRecess] = useState<string | number>(mmParam(p.cofniecie_cokolu_mm, 20));
    const [plinthGap, setPlinthGap] = useState<string | number>(mmParam(p.szczelina_cokolu_mm, 3));

    useEffect(() => {
        const gp = container?.generatorParams || {};
        setMode(asMode(gp.tryb_paneli_bocznych));
        setEnableLeft(gp.wlacz_lewy !== undefined ? !!gp.wlacz_lewy : true);
        setEnableRight(gp.wlacz_prawy !== undefined ? !!gp.wlacz_prawy : true);
        setEnableTop(gp.wlacz_gorny !== undefined ? !!gp.wlacz_gorny : true);
        setEnableBottom(gp.wlacz_dolny !== undefined ? !!gp.wlacz_dolny : true);
        setAutoLeft(gp.auto_glebokosc_lewy !== undefined ? !!gp.auto_glebokosc_lewy : true);
        setAutoRight(gp.auto_glebokosc_prawy !== undefined ? !!gp.auto_glebokosc_prawy : true);
        setAutoTop(gp.auto_glebokosc_gorny !== undefined ? !!gp.auto_glebokosc_gorny : true);
        setDepthLeft(mmParam(gp.glebokosc_blendy_lewa_mm, 100));
        setDepthRight(mmParam(gp.glebokosc_blendy_prawa_mm, 100));
        setDepthTop(mmParam(gp.glebokosc_blendy_gora_mm, 100));
        setPlinthHeight(mmParam(gp.wysokosc_cokolu_mm, 97));
        setPlinthRecess(mmParam(gp.cofniecie_cokolu_mm, 20));
        setPlinthGap(mmParam(gp.szczelina_cokolu_mm, 3));
    }, [container?.id]);

    const pushUpdate = (patch: Partial<PanelsPlanParams>) => {
        triggerUpdate({
            tryb_paneli_bocznych: mode,
            wlacz_lewy: enableLeft,
            wlacz_prawy: enableRight,
            wlacz_gorny: enableTop,
            wlacz_dolny: enableBottom,
            auto_glebokosc_lewy: autoLeft,
            auto_glebokosc_prawy: autoRight,
            auto_glebokosc_gorny: autoTop,
            glebokosc_blendy_lewa_mm: toNum(depthLeft, 100),
            glebokosc_blendy_prawa_mm: toNum(depthRight, 100),
            glebokosc_blendy_gora_mm: toNum(depthTop, 100),
            wysokosc_cokolu_mm: toNum(plinthHeight, 97),
            cofniecie_cokolu_mm: toNum(plinthRecess, 20),
            szczelina_cokolu_mm: toNum(plinthGap, 3),
            ...patch
        });
    };

    const sideRow = (
        label: string,
        enabled: boolean, setEnabled: (v: boolean) => void,
        auto: boolean, setAuto: (v: boolean) => void,
        depth: string | number, setDepth: (v: string | number) => void,
        keys: { enable: keyof PanelsPlanParams; auto: keyof PanelsPlanParams; depth: keyof PanelsPlanParams }
    ) => (
        <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={rowStyle}>
                <label style={chkLabel}>
                    <input type="checkbox" checked={enabled} onChange={(e) => {
                        setEnabled(e.target.checked);
                        pushUpdate({ [keys.enable]: e.target.checked } as Partial<PanelsPlanParams>);
                    }} />
                    {label}
                </label>
                {enabled && (
                    <label style={{ ...chkLabel, fontSize: '11px', color: '#a1a1aa' }}>
                        <input type="checkbox" checked={auto} onChange={(e) => {
                            setAuto(e.target.checked);
                            pushUpdate({ [keys.auto]: e.target.checked } as Partial<PanelsPlanParams>);
                        }} />
                        {tx(panelsTekst, 'side.auto', TX_NS)}
                    </label>
                )}
            </div>
            {enabled && !auto && (
                <div style={rowStyle}>
                    <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(panelsTekst, 'side.depth', TX_NS)}</span>
                    <SmartNumericInput
                        value={depth}
                        min={10} step={0.01} decimals={2} unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            setDepth(val);
                            const n = toNum(val, 100);
                            pushUpdate({ [keys.depth]: n } as Partial<PanelsPlanParams>);
                        }}
                    />
                </div>
            )}
        </div>
    );

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#93c5fd' }}>{tx(panelsTekst, 'outer_note', TX_NS)}</div>

            <div style={rowStyle}>
                <span style={labelStyle}>{tx(panelsTekst, 'side_panel_mode.label', TX_NS)}</span>
                <select
                    id="sb-panel-mode-select"
                    value={mode}
                    onChange={(e) => {
                        const next = asMode(e.target.value);
                        setMode(next);
                        pushUpdate({ tryb_paneli_bocznych: next });
                    }}
                    style={{ width: '180px', padding: '3px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', fontSize: '12px' }}
                >
                    <option value="FULL">{tx(panelsTekst, 'side_panel_mode.items.FULL', TX_NS)}</option>
                    <option value="KORPUS_BLENDA_G">{tx(panelsTekst, 'side_panel_mode.items.KORPUS_BLENDA_G', TX_NS)}</option>
                    <option value="COKOL_KORPUS">{tx(panelsTekst, 'side_panel_mode.items.COKOL_KORPUS', TX_NS)}</option>
                    <option value="KORPUS">{tx(panelsTekst, 'side_panel_mode.items.KORPUS', TX_NS)}</option>
                </select>
            </div>

            {sideRow(tx(panelsTekst, 'side.left', TX_NS), enableLeft, setEnableLeft, autoLeft, setAutoLeft, depthLeft, setDepthLeft, {
                enable: 'wlacz_lewy',
                auto: 'auto_glebokosc_lewy',
                depth: 'glebokosc_blendy_lewa_mm'
            })}
            {sideRow(tx(panelsTekst, 'side.right', TX_NS), enableRight, setEnableRight, autoRight, setAutoRight, depthRight, setDepthRight, {
                enable: 'wlacz_prawy',
                auto: 'auto_glebokosc_prawy',
                depth: 'glebokosc_blendy_prawa_mm'
            })}
            {sideRow(tx(panelsTekst, 'side.top', TX_NS), enableTop, setEnableTop, autoTop, setAutoTop, depthTop, setDepthTop, {
                enable: 'wlacz_gorny',
                auto: 'auto_glebokosc_gorny',
                depth: 'glebokosc_blendy_gora_mm'
            })}

            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={chkLabel}>
                    <input type="checkbox" checked={enableBottom} onChange={(e) => {
                        setEnableBottom(e.target.checked);
                        pushUpdate({ wlacz_dolny: e.target.checked });
                    }} />
                    {tx(panelsTekst, 'plinth.enable', TX_NS)}
                </label>
                {enableBottom && (
                    <>
                        <div style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(panelsTekst, 'plinth.height', TX_NS)}</span>
                            <SmartNumericInput value={plinthHeight} min={50} step={0.01} decimals={2} unit="mm" style={inputStyle}
                                onChange={(val) => { setPlinthHeight(val); pushUpdate({ wysokosc_cokolu_mm: toNum(val, 97) }); }} />
                        </div>
                        <div style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(panelsTekst, 'plinth.recess', TX_NS)}</span>
                            <SmartNumericInput value={plinthRecess} min={0} step={0.01} decimals={2} unit="mm" style={inputStyle}
                                onChange={(val) => { setPlinthRecess(val); pushUpdate({ cofniecie_cokolu_mm: toNum(val, 20) }); }} />
                        </div>
                        <div style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(panelsTekst, 'plinth.gap', TX_NS)}</span>
                            <SmartNumericInput value={plinthGap} min={0} step={0.01} decimals={2} unit="mm" style={inputStyle}
                                onChange={(val) => { setPlinthGap(val); pushUpdate({ szczelina_cokolu_mm: toNum(val, 3) }); }} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
