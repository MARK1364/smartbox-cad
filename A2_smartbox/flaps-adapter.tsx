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

const MIN_HINGE_OFFSET = 50;

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
        use_center_hinge: !!params.use_center_hinge
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
    const [useCenterHinge, setUseCenterHinge] = useState<boolean>(!!p.use_center_hinge);

    useEffect(() => {
        setFlapType(p.flap_type || 'TOP');
        setOvTop(p.ov_top !== undefined ? p.ov_top : 14);
        setOvBottom(p.ov_bottom !== undefined ? p.ov_bottom : 15);
        setOvLeft(p.ov_left !== undefined ? p.ov_left : 16);
        setOvRight(p.ov_right !== undefined ? p.ov_right : 16);
        setHingeLeftOffset(p.hinge_left_offset !== undefined ? Number(p.hinge_left_offset) : 80);
        setHingeRightOffset(p.hinge_right_offset !== undefined ? Number(p.hinge_right_offset) : 80);
        setUseCenterHinge(!!p.use_center_hinge);
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
            ...patch
        });
    };

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
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvTop(val); pushUpdate({ ov_top: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Nałożenie dół</span>
                    <SmartNumericInput
                        value={ovBottom}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvBottom(val); pushUpdate({ ov_bottom: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Nałożenie lewo</span>
                    <SmartNumericInput
                        value={ovLeft}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvLeft(val); pushUpdate({ ov_left: val }); }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Nałożenie prawo</span>
                    <SmartNumericInput
                        value={ovRight}
                        unit="mm"
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => { setOvRight(val); pushUpdate({ ov_right: val }); }}
                    />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Zawias lewy od krawędzi</span>
                    <SmartNumericInput
                        value={hingeLeftOffset}
                        unit="mm"
                        min={MIN_HINGE_OFFSET}
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            const clamped = clampHinge(val);
                            setHingeLeftOffset(clamped);
                            pushUpdate({ hinge_left_offset: clamped });
                        }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Zawias prawy od krawędzi</span>
                    <SmartNumericInput
                        value={hingeRightOffset}
                        unit="mm"
                        min={MIN_HINGE_OFFSET}
                        style={{ width: '100%', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            const clamped = clampHinge(val);
                            setHingeRightOffset(clamped);
                            pushUpdate({ hinge_right_offset: clamped });
                        }}
                    />
                </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d4d4d8', fontSize: '12px', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={useCenterHinge}
                    onChange={(e) => {
                        setUseCenterHinge(e.target.checked);
                        pushUpdate({ use_center_hinge: e.target.checked });
                    }}
                />
                Środkowy zawias
            </label>
        </div>
    );
}
