/**
 * flaps-adapter.tsx — moduł KLAPY (smartbox_flaps)
 * Odpowiednik @@BLENDER/A2_smartbox/flaps_1_addon_v1.py
 *
 * Panel UI (FlapsSubModule) + mapowanie parametrów na silnik (buildFlapsPlan).
 * Nawiercenia prowadników: flaps-drilling-builder.ts, sync w smartbox-core.ts.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { FlapsEngine } from './flaps-engine.js';
import type { ModuleDims } from './base-engine.js';
import { DEFAULT_HINGE_ID, listByType } from '../B1_biblioteka/index.js';
import { nmToMm } from '../A1_core/cad-math/units.js';

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
    const th = opts.thickness || 18;
    const density = opts.density || 680;

    const volM3 = (flapW * flapH * th) / 1_000_000_000;
    const weightKg = parseFloat((volM3 * density + 0.15).toFixed(2));
    const powerFactorLF = Math.round(flapH * weightKg);
    const suggestedHinges = (flapW >= 600 || weightKg >= 4.5) ? 3 : 2;

    return { weightKg, suggestedHinges, powerFactorLF };
}

export function buildFlapsPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new FlapsEngine();
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.front_thickness || params.thickness || 18,
        flap_type: params.flap_type || params.type || 'TOP',
        ov_top: params.ov_top !== undefined ? params.ov_top : 14,
        ov_bottom: params.ov_bottom !== undefined ? params.ov_bottom : 15,
        ov_left: params.ov_left !== undefined ? params.ov_left : 16,
        ov_right: params.ov_right !== undefined ? params.ov_right : 16,
        hinge_left_offset: params.hinge_left_offset !== undefined ? params.hinge_left_offset : 80,
        hinge_right_offset: params.hinge_right_offset !== undefined ? params.hinge_right_offset : 80,
        use_center_hinge: !!params.use_center_hinge,
        hinge_left_template: params.hinge_left_template || params.hinge_template,
        hinge_right_template: params.hinge_right_template || params.hinge_template,
        hinge_center_template: params.hinge_center_template || params.hinge_template,
        hinge_template: params.hinge_template
    });
}

export function FlapsSubModule({ container, triggerUpdate }: { container: any; triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};

    const [flapType, setFlapType] = useState<string>(p.flap_type || 'TOP');
    const [ovTop, setOvTop] = useState<string | number>(p.ov_top !== undefined ? p.ov_top : 14);
    const [ovBottom, setOvBottom] = useState<string | number>(p.ov_bottom !== undefined ? p.ov_bottom : 15);
    const [ovLeft, setOvLeft] = useState<string | number>(p.ov_left !== undefined ? p.ov_left : 16);
    const [ovRight, setOvRight] = useState<string | number>(p.ov_right !== undefined ? p.ov_right : 16);
    const [hingeLeftOffset, setHingeLeftOffset] = useState<number>(
        p.hinge_left_offset !== undefined ? Number(p.hinge_left_offset) : 80
    );
    const [hingeRightOffset, setHingeRightOffset] = useState<number>(
        p.hinge_right_offset !== undefined ? Number(p.hinge_right_offset) : 80
    );
    const getPairedFlapHingeDefault = (side: 'left' | 'right' | 'center', customVal?: string, globalTpl?: string): string => {
        if (customVal) return customVal;
        const base = globalTpl || p.hinge_template || DEFAULT_HINGE_ID;
        if (base === 'BLUM_71B3550' || base === 'BLUM_71T3550') {
            if (side === 'right') return 'BLUM_71T3550';
            return 'BLUM_71B3550';
        }
        return base;
    };

    const [useCenterHinge, setUseCenterHinge] = useState<boolean>(!!p.use_center_hinge);
    const [hingeLeftTemplate, setHingeLeftTemplate] = useState<string>(
        getPairedFlapHingeDefault('left', p.hinge_left_template || p.hingeLeftTemplate)
    );
    const [hingeRightTemplate, setHingeRightTemplate] = useState<string>(
        getPairedFlapHingeDefault('right', p.hinge_right_template || p.hingeRightTemplate)
    );
    const [hingeCenterTemplate, setHingeCenterTemplate] = useState<string>(
        getPairedFlapHingeDefault('center', p.hinge_center_template || p.hingeCenterTemplate)
    );

    useEffect(() => {
        setFlapType(p.flap_type || 'TOP');
        setOvTop(p.ov_top !== undefined ? p.ov_top : 14);
        setOvBottom(p.ov_bottom !== undefined ? p.ov_bottom : 15);
        setOvLeft(p.ov_left !== undefined ? p.ov_left : 16);
        setOvRight(p.ov_right !== undefined ? p.ov_right : 16);
        setHingeLeftOffset(p.hinge_left_offset !== undefined ? Number(p.hinge_left_offset) : 80);
        setHingeRightOffset(p.hinge_right_offset !== undefined ? Number(p.hinge_right_offset) : 80);
        setUseCenterHinge(!!p.use_center_hinge);
        setHingeLeftTemplate(getPairedFlapHingeDefault('left', p.hinge_left_template || p.hingeLeftTemplate));
        setHingeRightTemplate(getPairedFlapHingeDefault('right', p.hinge_right_template || p.hingeRightTemplate));
        setHingeCenterTemplate(getPairedFlapHingeDefault('center', p.hinge_center_template || p.hingeCenterTemplate));
    }, [container?.id]);

    const clampHinge = (val: number) => Math.max(MIN_HINGE_OFFSET, val);

    const pushUpdate = (patch: Record<string, unknown>) => {
        triggerUpdate({
            flap_type: flapType,
            ov_top: parseFloat(String(ovTop)) || 0,
            ov_bottom: parseFloat(String(ovBottom)) || 0,
            ov_left: parseFloat(String(ovLeft)) || 0,
            ov_right: parseFloat(String(ovRight)) || 0,
            hinge_left_offset: hingeLeftOffset,
            hinge_right_offset: hingeRightOffset,
            use_center_hinge: useCenterHinge,
            hinge_left_template: hingeLeftTemplate,
            hinge_right_template: hingeRightTemplate,
            hinge_center_template: hingeCenterTemplate,
            ...patch
        });
    };

    const hingeList = listByType('HINGE');

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Typ klapy:</span>
                <div style={{ display: 'flex', width: '100%', borderRadius: '4px', overflow: 'hidden', border: '1px solid #3f3f46' }}>
                    <button
                        style={{ flex: 1, padding: '5px 0', background: flapType === 'TOP' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: flapType === 'TOP' ? 'bold' : 'normal' }}
                        onClick={() => { setFlapType('TOP'); pushUpdate({ flap_type: 'TOP' }); }}
                    >
                        Góra
                    </button>
                    <button
                        style={{ flex: 1, padding: '5px 0', background: flapType === 'BOTTOM' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', borderLeft: '1px solid #3f3f46', cursor: 'pointer', fontSize: '12px', fontWeight: flapType === 'BOTTOM' ? 'bold' : 'normal' }}
                        onClick={() => { setFlapType('BOTTOM'); pushUpdate({ flap_type: 'BOTTOM' }); }}
                    >
                        Dół (Barek)
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Nałożenie góra</span>
                    <SmartNumericInput
                        value={ovTop}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvTop(val); pushUpdate({ ov_top: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Nałożenie dół</span>
                    <SmartNumericInput
                        value={ovBottom}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvBottom(val); pushUpdate({ ov_bottom: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Nałożenie lewo</span>
                    <SmartNumericInput
                        value={ovLeft}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvLeft(val); pushUpdate({ ov_left: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Nałożenie prawo</span>
                    <SmartNumericInput
                        value={ovRight}
                        step={0.01} decimals={2}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvRight(val); pushUpdate({ ov_right: val }); }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px', fontWeight: 'bold' }}>Zawiasy</span>

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
                        thickness: parseFloat(String(p.front_thickness || p.thickness || 18))
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
                                <span>Waga frontu: <strong style={{ color: '#f4f4f5' }}>{info.weightKg} kg</strong></span>
                                <span>Sugerowana ilość zawiasów: <strong style={{ color: '#60a5fa' }}>{info.suggestedHinges} szt.</strong></span>
                            </div>
                            <div style={{ fontSize: '10px', color: '#71717a' }}>
                                Współczynnik mocy siłownika (LF): <span style={{ color: '#93c5fa' }}>{info.powerFactorLF}</span>
                            </div>
                        </div>
                    );
                })()}
                
                {/* Zawias lewy */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#e4e4e7', fontSize: '11px', width: '56px', flexShrink: 0 }}>Lewy:</span>
                    <SmartNumericInput
                        value={hingeLeftOffset}
                        step={0.01} decimals={2}
                        unit="mm"
                        min={MIN_HINGE_OFFSET}
                        style={{ width: '52px', padding: '2px 3px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px', flexShrink: 0 }}
                        onChange={(val) => {
                            const clamped = clampHinge(val);
                            setHingeLeftOffset(clamped);
                            pushUpdate({ hinge_left_offset: clamped });
                        }}
                    />
                    <select
                        value={hingeLeftTemplate}
                        onChange={(e) => {
                            setHingeLeftTemplate(e.target.value);
                            pushUpdate({ hinge_left_template: e.target.value });
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
                    <span style={{ color: '#e4e4e7', fontSize: '11px', width: '56px', flexShrink: 0 }}>Prawy:</span>
                    <SmartNumericInput
                        value={hingeRightOffset}
                        step={0.01} decimals={2}
                        unit="mm"
                        min={MIN_HINGE_OFFSET}
                        style={{ width: '52px', padding: '2px 3px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px', flexShrink: 0 }}
                        onChange={(val) => {
                            const clamped = clampHinge(val);
                            setHingeRightOffset(clamped);
                            pushUpdate({ hinge_right_offset: clamped });
                        }}
                    />
                    <select
                        value={hingeRightTemplate}
                        onChange={(e) => {
                            setHingeRightTemplate(e.target.value);
                            pushUpdate({ hinge_right_template: e.target.value });
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
                            pushUpdate({ use_center_hinge: e.target.checked });
                        }}
                        style={{ margin: 0, cursor: 'pointer' }}
                    />
                    <label htmlFor="chk_use_center_hinge" style={{ color: useCenterHinge ? '#e4e4e7' : '#71717a', fontSize: '11px', cursor: 'pointer', width: '42px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        Środek
                    </label>
                    <div style={{ width: '52px', flexShrink: 0 }} />
                    <select
                        disabled={!useCenterHinge}
                        value={hingeCenterTemplate}
                        onChange={(e) => {
                            setHingeCenterTemplate(e.target.value);
                            pushUpdate({ hinge_center_template: e.target.value });
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
