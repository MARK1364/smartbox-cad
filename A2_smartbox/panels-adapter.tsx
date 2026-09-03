/**
 * panels-adapter.tsx — moduł BLENDY (smartbox_panels)
 * Odpowiednik @@BLENDER/A2_smartbox/panels_1_addon_v1.py
 *
 * Panel UI (PanelsSubModule) + mapowanie parametrów na silnik (buildPanelsPlan).
 * Bez nawierceń. Gabaryt SmartBoxa dla tego modułu liczy smartbox-core na OUTER.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { PanelsEngine, type SidePanelMode } from './panels-engine.js';
import type { ModuleDims } from './base-engine.js';

function toNum(val: string | number | undefined, fallback = 0): number {
    const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
    return Number.isFinite(n) ? n : fallback;
}

function mmParam(v: any, fallback: number): number {
    if (v === undefined || v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function asMode(raw: any): SidePanelMode {
    const m = String(raw || 'FULL').toUpperCase();
    if (m === 'KORPUS_BLENDA_G' || m === 'COKOL_KORPUS' || m === 'KORPUS') return m;
    return 'FULL';
}

export function buildPanelsPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new PanelsEngine();
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness || 18,
        sidePanelMode: asMode(params.sidePanelMode || params.side_panel_mode),
        enableLeft: params.enableLeft !== undefined ? !!params.enableLeft : params.enable_left !== false,
        enableRight: params.enableRight !== undefined ? !!params.enableRight : params.enable_right !== false,
        enableTop: params.enableTop !== undefined ? !!params.enableTop : params.enable_top !== false,
        enableBottom: params.enableBottom !== undefined ? !!params.enableBottom : params.enable_bottom !== false,
        autoDepthLeft: params.autoDepthLeft !== undefined ? !!params.autoDepthLeft : params.override_rear_left !== false,
        autoDepthRight: params.autoDepthRight !== undefined ? !!params.autoDepthRight : params.override_rear_right !== false,
        autoDepthTop: params.autoDepthTop !== undefined ? !!params.autoDepthTop : params.override_rear_top !== false,
        panelDepthLeft: mmParam(params.panelDepthLeft ?? params.panel_depth_left, 100),
        panelDepthRight: mmParam(params.panelDepthRight ?? params.panel_depth_right, 100),
        panelDepthTop: mmParam(params.panelDepthTop ?? params.panel_depth_top, 100),
        plinthHeight: mmParam(params.plinthHeight ?? params.plinth_height, 97),
        plinthRecess: mmParam(params.plinthRecess ?? params.plinth_recess, 20),
        plinthGap: mmParam(params.plinthGap ?? params.plinth_gap, 3)
    });
}

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

export function PanelsSubModule({ container, triggerUpdate }: { container: any, triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};
    const [mode, setMode] = useState<SidePanelMode>(asMode(p.sidePanelMode || p.side_panel_mode));
    const [enableLeft, setEnableLeft] = useState<boolean>(p.enableLeft !== undefined ? !!p.enableLeft : p.enable_left !== false);
    const [enableRight, setEnableRight] = useState<boolean>(p.enableRight !== undefined ? !!p.enableRight : p.enable_right !== false);
    const [enableTop, setEnableTop] = useState<boolean>(p.enableTop !== undefined ? !!p.enableTop : p.enable_top !== false);
    const [enableBottom, setEnableBottom] = useState<boolean>(p.enableBottom !== undefined ? !!p.enableBottom : p.enable_bottom !== false);
    const [autoLeft, setAutoLeft] = useState<boolean>(p.autoDepthLeft !== undefined ? !!p.autoDepthLeft : p.override_rear_left !== false);
    const [autoRight, setAutoRight] = useState<boolean>(p.autoDepthRight !== undefined ? !!p.autoDepthRight : p.override_rear_right !== false);
    const [autoTop, setAutoTop] = useState<boolean>(p.autoDepthTop !== undefined ? !!p.autoDepthTop : p.override_rear_top !== false);
    const [depthLeft, setDepthLeft] = useState<string | number>(mmParam(p.panelDepthLeft ?? p.panel_depth_left, 100));
    const [depthRight, setDepthRight] = useState<string | number>(mmParam(p.panelDepthRight ?? p.panel_depth_right, 100));
    const [depthTop, setDepthTop] = useState<string | number>(mmParam(p.panelDepthTop ?? p.panel_depth_top, 100));
    const [plinthHeight, setPlinthHeight] = useState<string | number>(mmParam(p.plinthHeight ?? p.plinth_height, 97));
    const [plinthRecess, setPlinthRecess] = useState<string | number>(mmParam(p.plinthRecess ?? p.plinth_recess, 20));
    const [plinthGap, setPlinthGap] = useState<string | number>(mmParam(p.plinthGap ?? p.plinth_gap, 3));

    useEffect(() => {
        const gp = container?.generatorParams || {};
        setMode(asMode(gp.sidePanelMode || gp.side_panel_mode));
        setEnableLeft(gp.enableLeft !== undefined ? !!gp.enableLeft : gp.enable_left !== false);
        setEnableRight(gp.enableRight !== undefined ? !!gp.enableRight : gp.enable_right !== false);
        setEnableTop(gp.enableTop !== undefined ? !!gp.enableTop : gp.enable_top !== false);
        setEnableBottom(gp.enableBottom !== undefined ? !!gp.enableBottom : gp.enable_bottom !== false);
        setAutoLeft(gp.autoDepthLeft !== undefined ? !!gp.autoDepthLeft : gp.override_rear_left !== false);
        setAutoRight(gp.autoDepthRight !== undefined ? !!gp.autoDepthRight : gp.override_rear_right !== false);
        setAutoTop(gp.autoDepthTop !== undefined ? !!gp.autoDepthTop : gp.override_rear_top !== false);
        setDepthLeft(mmParam(gp.panelDepthLeft ?? gp.panel_depth_left, 100));
        setDepthRight(mmParam(gp.panelDepthRight ?? gp.panel_depth_right, 100));
        setDepthTop(mmParam(gp.panelDepthTop ?? gp.panel_depth_top, 100));
        setPlinthHeight(mmParam(gp.plinthHeight ?? gp.plinth_height, 97));
        setPlinthRecess(mmParam(gp.plinthRecess ?? gp.plinth_recess, 20));
        setPlinthGap(mmParam(gp.plinthGap ?? gp.plinth_gap, 3));
    }, [container?.id]);

    const pushUpdate = (patch: Record<string, any>) => {
        triggerUpdate({
            sidePanelMode: mode,
            side_panel_mode: mode,
            enableLeft, enable_left: enableLeft,
            enableRight, enable_right: enableRight,
            enableTop, enable_top: enableTop,
            enableBottom, enable_bottom: enableBottom,
            autoDepthLeft: autoLeft, override_rear_left: autoLeft,
            autoDepthRight: autoRight, override_rear_right: autoRight,
            autoDepthTop: autoTop, override_rear_top: autoTop,
            panelDepthLeft: toNum(depthLeft, 100), panel_depth_left: toNum(depthLeft, 100),
            panelDepthRight: toNum(depthRight, 100), panel_depth_right: toNum(depthRight, 100),
            panelDepthTop: toNum(depthTop, 100), panel_depth_top: toNum(depthTop, 100),
            plinthHeight: toNum(plinthHeight, 97), plinth_height: toNum(plinthHeight, 97),
            plinthRecess: toNum(plinthRecess, 20), plinth_recess: toNum(plinthRecess, 20),
            plinthGap: toNum(plinthGap, 3), plinth_gap: toNum(plinthGap, 3),
            ...patch
        });
    };

    const sideRow = (
        label: string,
        enabled: boolean, setEnabled: (v: boolean) => void,
        auto: boolean, setAuto: (v: boolean) => void,
        depth: string | number, setDepth: (v: string | number) => void,
        keys: { enable: string; enableSnake: string; auto: string; autoSnake: string; depth: string; depthSnake: string }
    ) => (
        <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={rowStyle}>
                <label style={chkLabel}>
                    <input type="checkbox" checked={enabled} onChange={(e) => {
                        setEnabled(e.target.checked);
                        pushUpdate({ [keys.enable]: e.target.checked, [keys.enableSnake]: e.target.checked });
                    }} />
                    {label}
                </label>
                {enabled && (
                    <label style={{ ...chkLabel, fontSize: '11px', color: '#a1a1aa' }}>
                        <input type="checkbox" checked={auto} onChange={(e) => {
                            setAuto(e.target.checked);
                            pushUpdate({ [keys.auto]: e.target.checked, [keys.autoSnake]: e.target.checked });
                        }} />
                        Auto
                    </label>
                )}
            </div>
            {enabled && !auto && (
                <div style={rowStyle}>
                    <span style={{ ...labelStyle, fontSize: '11px' }}>Głębokość:</span>
                    <SmartNumericInput
                        value={depth}
                        min={50} step={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            setDepth(val);
                            const n = toNum(val, 100);
                            pushUpdate({ [keys.depth]: n, [keys.depthSnake]: n });
                        }}
                    />
                </div>
            )}
        </div>
    );

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#93c5fd' }}>Na zewnątrz korpusu (OUTER)</div>

            <div style={rowStyle}>
                <span style={labelStyle}>Montaż blend:</span>
                <select
                    value={mode}
                    onChange={(e) => {
                        const next = asMode(e.target.value);
                        setMode(next);
                        pushUpdate({ sidePanelMode: next, side_panel_mode: next });
                    }}
                    style={{ width: '180px', padding: '3px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', fontSize: '12px' }}
                >
                    <option value="FULL">Cokół+korpus+blenda_G</option>
                    <option value="KORPUS_BLENDA_G">Korpus+blenda_G</option>
                    <option value="COKOL_KORPUS">Cokół+Korpus</option>
                    <option value="KORPUS">Korpus</option>
                </select>
            </div>

            {sideRow('Blenda lewa', enableLeft, setEnableLeft, autoLeft, setAutoLeft, depthLeft, setDepthLeft, {
                enable: 'enableLeft', enableSnake: 'enable_left',
                auto: 'autoDepthLeft', autoSnake: 'override_rear_left',
                depth: 'panelDepthLeft', depthSnake: 'panel_depth_left'
            })}
            {sideRow('Blenda prawa', enableRight, setEnableRight, autoRight, setAutoRight, depthRight, setDepthRight, {
                enable: 'enableRight', enableSnake: 'enable_right',
                auto: 'autoDepthRight', autoSnake: 'override_rear_right',
                depth: 'panelDepthRight', depthSnake: 'panel_depth_right'
            })}
            {sideRow('Blenda górna', enableTop, setEnableTop, autoTop, setAutoTop, depthTop, setDepthTop, {
                enable: 'enableTop', enableSnake: 'enable_top',
                auto: 'autoDepthTop', autoSnake: 'override_rear_top',
                depth: 'panelDepthTop', depthSnake: 'panel_depth_top'
            })}

            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={chkLabel}>
                    <input type="checkbox" checked={enableBottom} onChange={(e) => {
                        setEnableBottom(e.target.checked);
                        pushUpdate({ enableBottom: e.target.checked, enable_bottom: e.target.checked });
                    }} />
                    Cokół
                </label>
                {enableBottom && (
                    <>
                        <div style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>Wysokość cokołu:</span>
                            <SmartNumericInput value={plinthHeight} min={50} step={1} unit="mm" style={inputStyle}
                                onChange={(val) => { setPlinthHeight(val); pushUpdate({ plinthHeight: toNum(val, 97), plinth_height: toNum(val, 97) }); }} />
                        </div>
                        <div style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>Cofnięcie cokołu:</span>
                            <SmartNumericInput value={plinthRecess} min={0} step={1} unit="mm" style={inputStyle}
                                onChange={(val) => { setPlinthRecess(val); pushUpdate({ plinthRecess: toNum(val, 20), plinth_recess: toNum(val, 20) }); }} />
                        </div>
                        <div style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>Szczelina cokołu:</span>
                            <SmartNumericInput value={plinthGap} min={0} step={0.5} unit="mm" style={inputStyle}
                                onChange={(val) => { setPlinthGap(val); pushUpdate({ plinthGap: toNum(val, 3), plinth_gap: toNum(val, 3) }); }} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
