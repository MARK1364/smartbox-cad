/**
 * shelves-adapter.tsx — moduł PÓŁKI (smartbox_shelves)
 * Odpowiednik @@BLENDER/A2_smartbox/shelves_1_addon_v1.py
 *
 * Zawiera panel UI (ShelvesSubModule) oraz mapowanie parametrów kontenera
 * na wejście silnika (buildShelvesPlan) — odpowiednik wygeneruj_polki_logika_v1.
 * Nawiercenia półek: shelves-drilling-builder.ts, sync w smartbox-core.ts.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { ShelvesEngine } from './shelves-engine.js';
import type { ModuleDims } from './base-engine.js';

export function buildShelvesPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new ShelvesEngine();
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        shelfCount: params.shelfCount !== undefined ? params.shelfCount : 3,
        thickness: params.thickness || 18,
        shelfOffsetFront: params.shelfOffsetFront ?? params.offset_front ?? 10,
        shelfOffsetSide: params.shelfOffsetSide ?? params.offset_side ?? 0.5,
        holePattern: params.holePattern,
        frontInset: params.frontInset ?? params.hole_offset_front,
        backInset: params.backInset ?? params.hole_offset_back,
        frontHoles: params.frontHoles === true || params.front_holes_enabled === true,
        frontOffsetX: params.frontOffsetX ?? params.front_holes_offset_x,
        backHoles: params.backHoles === true || params.back_holes_enabled === true,
        backOffsetX: params.backOffsetX ?? params.back_holes_offset_x,
        tripleZOffset: params.tripleZOffset ?? params.triple_z_offset,
        system32Spacing: params.system32Spacing ?? params.system_32_spacing,
        system32StartOffset: params.system32StartOffset ?? params.system_32_start_offset,
        system32HoleCount: params.system32HoleCount ?? params.system_32_hole_count
    });
}

export function ShelvesSubModule({ container, triggerUpdate }: { container: any, triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};
    const [shelfCount, setShelfCount] = useState<number>(p.shelfCount !== undefined ? p.shelfCount : 3);
    const [shelfOffsetFront, setShelfOffsetFront] = useState<string | number>(p.shelfOffsetFront !== undefined ? p.shelfOffsetFront : (p.offset_front !== undefined ? p.offset_front : 10));
    const [shelfOffsetSide, setShelfOffsetSide] = useState<string | number>(p.shelfOffsetSide !== undefined ? p.shelfOffsetSide : (p.offset_side !== undefined ? p.offset_side : 0.5));
    const [frontInset, setFrontInset] = useState<number>(p.frontInset !== undefined ? p.frontInset : 37);
    const [backInset, setBackInset] = useState<number>(p.backInset !== undefined ? p.backInset : 37);
    const [holePattern, setHolePattern] = useState<string>(p.holePattern || 'SINGLE');
    const [tripleZOffset, setTripleZOffset] = useState<number>(p.tripleZOffset !== undefined ? p.tripleZOffset : (p.triple_z_offset || 32));
    const [system32Spacing, setSystem32Spacing] = useState<number>(p.system32Spacing !== undefined ? p.system32Spacing : 32);
    const [system32StartOffset, setSystem32StartOffset] = useState<number>(p.system32StartOffset !== undefined ? p.system32StartOffset : 150);
    const [system32HoleCount, setSystem32HoleCount] = useState<number>(p.system32HoleCount !== undefined ? p.system32HoleCount : 10);
    const [frontHoles, setFrontHoles] = useState<boolean>(p.frontHoles === true || p.front_holes_enabled === true);
    const [frontOffsetX, setFrontOffsetX] = useState<number>(p.frontOffsetX || 0);
    const [backHoles, setBackHoles] = useState<boolean>(p.backHoles === true || p.back_holes_enabled === true);
    const [backOffsetX, setBackOffsetX] = useState<number>(p.backOffsetX || 0);

    useEffect(() => {
        setShelfCount(p.shelfCount !== undefined ? p.shelfCount : 3);
        setShelfOffsetFront(p.shelfOffsetFront !== undefined ? p.shelfOffsetFront : (p.offset_front !== undefined ? p.offset_front : 10));
        setShelfOffsetSide(p.shelfOffsetSide !== undefined ? p.shelfOffsetSide : (p.offset_side !== undefined ? p.offset_side : 0.5));
        setFrontInset(p.frontInset !== undefined ? p.frontInset : 37);
        setBackInset(p.backInset !== undefined ? p.backInset : 37);
        setHolePattern(p.holePattern || 'SINGLE');
        setTripleZOffset(p.tripleZOffset !== undefined ? p.tripleZOffset : (p.triple_z_offset || 32));
        setSystem32Spacing(p.system32Spacing !== undefined ? p.system32Spacing : 32);
        setSystem32StartOffset(p.system32StartOffset !== undefined ? p.system32StartOffset : 150);
        setSystem32HoleCount(p.system32HoleCount !== undefined ? p.system32HoleCount : 10);
        setFrontHoles(p.frontHoles === true || p.front_holes_enabled === true);
        setFrontOffsetX(p.frontOffsetX || 0);
        setBackHoles(p.backHoles === true || p.back_holes_enabled === true);
        setBackOffsetX(p.backOffsetX || 0);
    }, [container?.id]);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Ilość półek:</span>
                <SmartNumericInput 
                    value={shelfCount} 
                    min={0} max={10} step={1}
                    style={{ width: '120px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setShelfCount(val);
                        triggerUpdate({ shelfCount: val });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Odsuń przód:</span>
                <SmartNumericInput 
                    value={shelfOffsetFront} 
                    step={0.5} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setShelfOffsetFront(val);
                        triggerUpdate({ shelfOffsetFront: val });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Odsuń bok:</span>
                <SmartNumericInput 
                    value={shelfOffsetSide} 
                    step={0.5} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setShelfOffsetSide(val);
                        triggerUpdate({ shelfOffsetSide: val });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Ods. boczne przód:</span>
                <SmartNumericInput 
                    value={frontInset}
                    unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setFrontInset(val);
                        triggerUpdate({ frontInset: val });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Ods. boczne tył:</span>
                <SmartNumericInput 
                    value={backInset}
                    unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setBackInset(val);
                        triggerUpdate({ backInset: val });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Wzór otworów:</span>
                <select 
                    value={holePattern}
                    style={{ width: '130px', padding: '3px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px' }}
                    onChange={(e) => {
                        const val = e.target.value;
                        setHolePattern(val);
                        triggerUpdate({ holePattern: val });
                    }}
                >
                    <option value="SINGLE">Pojedynczy otw.</option>
                    <option value="TRIPLE">Potrójny otw.</option>
                    <option value="SYSTEM_32">System 32</option>
                    <option value="NONE">Brak otworów</option>
                </select>
            </div>

            {holePattern === 'TRIPLE' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Rozstaw otw. (góra/dół):</span>
                    <SmartNumericInput 
                        value={tripleZOffset}
                        unit="mm"
                        style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setTripleZOffset(val);
                            triggerUpdate({ tripleZOffset: val });
                        }}
                    />
                </div>
            )}

            {(holePattern === 'SYSTEM_32' || holePattern === 'ROW') && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Rozstaw otw.:</span>
                        <SmartNumericInput 
                            value={system32Spacing}
                            unit="mm"
                            style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                            onChange={(val) => {
                                setSystem32Spacing(val);
                                triggerUpdate({ system32Spacing: val });
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Dystans od dołu:</span>
                        <SmartNumericInput 
                            value={system32StartOffset}
                            unit="mm"
                            style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                            onChange={(val) => {
                                setSystem32StartOffset(val);
                                triggerUpdate({ system32StartOffset: val });
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Ilość otw.:</span>
                        <SmartNumericInput 
                            value={system32HoleCount}
                            min={1} max={100} step={1}
                            style={{ width: '120px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                            onChange={(val) => {
                                setSystem32HoleCount(val);
                                triggerUpdate({ system32HoleCount: val });
                            }}
                        />
                    </div>
                </>
            )}

            {holePattern !== 'NONE' && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <input 
                            type="checkbox" 
                            id="chkFrontHoles"
                            checked={frontHoles}
                            onChange={(e) => {
                                setFrontHoles(e.target.checked);
                                triggerUpdate({ frontHoles: e.target.checked });
                            }}
                        />
                        <label htmlFor="chkFrontHoles" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>Otwory przód</label>
                    </div>

                    {frontHoles && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '16px' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Offset X przód:</span>
                            <SmartNumericInput 
                                value={frontOffsetX}
                                unit="mm"
                                style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                                onChange={(val) => {
                                    setFrontOffsetX(val);
                                    triggerUpdate({ frontOffsetX: val });
                                }}
                            />
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <input 
                            type="checkbox" 
                            id="chkBackHoles"
                            checked={backHoles}
                            onChange={(e) => {
                                setBackHoles(e.target.checked);
                                triggerUpdate({ backHoles: e.target.checked });
                            }}
                        />
                        <label htmlFor="chkBackHoles" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>Otwory tył</label>
                    </div>

                    {backHoles && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '16px' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '11px' }}>Offset X tył:</span>
                            <SmartNumericInput 
                                value={backOffsetX}
                                unit="mm"
                                style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                                onChange={(val) => {
                                    setBackOffsetX(val);
                                    triggerUpdate({ backOffsetX: val });
                                }}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
