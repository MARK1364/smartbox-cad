/**
 * doors-adapter.tsx — moduł DRZWI (smartbox_doors)
 * Odpowiednik @@BLENDER/A2_smartbox/doors_1_addon_v1.py
 *
 * Panel UI (DoorsSubModule) + mapowanie parametrów na silnik (buildDoorsPlan).
 * Nawiercenia zawiasów: doors-drilling-builder.ts, sync w smartbox-core.ts.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { DoorsEngine } from './doors-engine.js';
import type { ModuleDims } from './base-engine.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { DEFAULT_HINGE_ID, hingeFrontHolesMm, listByType } from '../Biblioteki/okucia/index.js';

function toNum(val: string | number | undefined, fallback = 0): number {
    const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
    return Number.isFinite(n) ? n : fallback;
}

function dimToMm(raw: number | undefined): number {
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return 0;
    return nmToMm(Number(raw));
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

export function buildDoorsPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new DoorsEngine();
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.front_thickness || params.thickness || 18,
        doorType: params.door_type || params.doorType || 'LEFT',
        gap: params.gap !== undefined ? params.gap : 4,
        ov_top: params.ov_top !== undefined ? params.ov_top : 14,
        ov_bottom: params.ov_bottom !== undefined ? params.ov_bottom : 15,
        ov_left: params.ov_left !== undefined ? params.ov_left : 16,
        ov_right: params.ov_right !== undefined ? params.ov_right : 16,
        use_hinge_1: params.use_hinge_1,
        hinge_1_pos: params.hinge_1_pos,
        use_hinge_2: params.use_hinge_2,
        hinge_2_pos: params.hinge_2_pos,
        use_hinge_3: params.use_hinge_3,
        hinge_3_pos: params.hinge_3_pos,
        use_hinge_4: params.use_hinge_4,
        hinge_4_pos: params.hinge_4_pos,
        use_hinge_5: params.use_hinge_5,
        hinge_5_pos: params.hinge_5_pos,
        use_hinge_6: params.use_hinge_6,
        hinge_6_pos: params.hinge_6_pos,
        hinge_template: params.hinge_template || params.hingeTemplate || DEFAULT_HINGE_ID
    });
}

export function DoorsSubModule({ container, triggerUpdate }: { container: any, triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};
    
    // Typ drzwi: LEFT, RIGHT, DOUBLE
    const [doorType, setDoorType] = useState<string>(p.door_type || p.doorType || 'LEFT');
    // Szczelina środkowa (tylko dla DOUBLE)
    const [gap, setGap] = useState<number>(p.gap !== undefined ? p.gap : 4);
    
    // Nałożenia frontu
    const [ovTop, setOvTop] = useState<string | number>(p.ov_top !== undefined ? p.ov_top : 14);
    const [ovBottom, setOvBottom] = useState<string | number>(p.ov_bottom !== undefined ? p.ov_bottom : 15);
    const [ovLeft, setOvLeft] = useState<string | number>(p.ov_left !== undefined ? p.ov_left : 16);
    const [ovRight, setOvRight] = useState<string | number>(p.ov_right !== undefined ? p.ov_right : 16);

    // Szablon zawiasów
    const [hingeTemplate, setHingeTemplate] = useState<string>(p.hinge_template || DEFAULT_HINGE_ID);

    // Pozycje i aktywność zawiasów
    const [useHinge1, setUseHinge1] = useState<boolean>(p.use_hinge_1 !== false);
    const [hinge1Pos, setHinge1Pos] = useState<number>(p.hinge_1_pos !== undefined ? p.hinge_1_pos : 120);

    const [useHinge2, setUseHinge2] = useState<boolean>(!!p.use_hinge_2);
    const [hinge2Pos, setHinge2Pos] = useState<number>(p.hinge_2_pos !== undefined ? p.hinge_2_pos : 570);

    const [useHinge3, setUseHinge3] = useState<boolean>(!!p.use_hinge_3);
    const [hinge3Pos, setHinge3Pos] = useState<number>(p.hinge_3_pos !== undefined ? p.hinge_3_pos : 910);

    const [useHinge4, setUseHinge4] = useState<boolean>(!!p.use_hinge_4);
    const [hinge4Pos, setHinge4Pos] = useState<number>(p.hinge_4_pos !== undefined ? p.hinge_4_pos : 1230);

    const [useHinge5, setUseHinge5] = useState<boolean>(!!p.use_hinge_5);
    const [hinge5Pos, setHinge5Pos] = useState<number>(p.hinge_5_pos !== undefined ? p.hinge_5_pos : 1580);

    const [useHinge6, setUseHinge6] = useState<boolean>(p.use_hinge_6 !== false);
    const [hinge6Pos, setHinge6Pos] = useState<number>(p.hinge_6_pos !== undefined ? p.hinge_6_pos : 120);

    useEffect(() => {
        setDoorType(p.door_type || p.doorType || 'LEFT');
        setGap(p.gap !== undefined ? p.gap : 4);
        setOvTop(p.ov_top !== undefined ? p.ov_top : 14);
        setOvBottom(p.ov_bottom !== undefined ? p.ov_bottom : 15);
        setOvLeft(p.ov_left !== undefined ? p.ov_left : 16);
        setOvRight(p.ov_right !== undefined ? p.ov_right : 16);
        setHingeTemplate(p.hinge_template || DEFAULT_HINGE_ID);
        setUseHinge1(p.use_hinge_1 !== false);
        setHinge1Pos(p.hinge_1_pos !== undefined ? p.hinge_1_pos : 120);
        setUseHinge2(!!p.use_hinge_2);
        setHinge2Pos(p.hinge_2_pos !== undefined ? p.hinge_2_pos : 570);
        setUseHinge3(!!p.use_hinge_3);
        setHinge3Pos(p.hinge_3_pos !== undefined ? p.hinge_3_pos : 910);
        setUseHinge4(!!p.use_hinge_4);
        setHinge4Pos(p.hinge_4_pos !== undefined ? p.hinge_4_pos : 1230);
        setUseHinge5(!!p.use_hinge_5);
        setHinge5Pos(p.hinge_5_pos !== undefined ? p.hinge_5_pos : 1580);
        setUseHinge6(p.use_hinge_6 !== false);
        setHinge6Pos(p.hinge_6_pos !== undefined ? p.hinge_6_pos : 120);
    }, [container?.id]);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Typ drzwi */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Typ drzwi:</span>
                <div style={{ display: 'flex', width: '100%', borderRadius: '4px', overflow: 'hidden', border: '1px solid #3f3f46' }}>
                    <button 
                        style={{ flex: 1, padding: '5px 0', background: doorType === 'LEFT' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: doorType === 'LEFT' ? 'bold' : 'normal' }}
                        onClick={() => { setDoorType('LEFT'); triggerUpdate({ door_type: 'LEFT', doorType: 'LEFT' }); }}
                    >
                        Lewe
                    </button>
                    <button 
                        style={{ flex: 1, padding: '5px 0', background: doorType === 'RIGHT' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', borderLeft: '1px solid #3f3f46', borderRight: '1px solid #3f3f46', cursor: 'pointer', fontSize: '12px', fontWeight: doorType === 'RIGHT' ? 'bold' : 'normal' }}
                        onClick={() => { setDoorType('RIGHT'); triggerUpdate({ door_type: 'RIGHT', doorType: 'RIGHT' }); }}
                    >
                        Prawe
                    </button>
                    <button 
                        style={{ flex: 1, padding: '5px 0', background: doorType === 'DOUBLE' ? '#3b82f6' : '#27272a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: doorType === 'DOUBLE' ? 'bold' : 'normal' }}
                        onClick={() => { setDoorType('DOUBLE'); triggerUpdate({ door_type: 'DOUBLE', doorType: 'DOUBLE' }); }}
                    >
                        Podwójne
                    </button>
                </div>
            </div>

            {/* Szczelina środkowa (tylko dla drzwi podwójnych) */}
            {doorType === 'DOUBLE' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>Szczelina (Środek):</span>
                    <SmartNumericInput 
                        value={gap}
                        unit="mm"
                        style={{ width: '80px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setGap(val);
                            triggerUpdate({ gap: val });
                        }}
                    />
                </div>
            )}

            {/* Nałożenia frontu */}
            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⤢</span> Nałożenia frontu:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {/* Góra */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>Góra:</span>
                        <SmartNumericInput 
                            value={ovTop} 
                            unit="mm"
                            onChange={(val) => {
                                setOvTop(val);
                                triggerUpdate({ ov_top: val });
                            }}
                            style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }} 
                        />
                    </div>
                    {/* Lewo */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>Lewo:</span>
                        <SmartNumericInput 
                            value={ovLeft} 
                            unit="mm"
                            onChange={(val) => {
                                setOvLeft(val);
                                triggerUpdate({ ov_left: val });
                            }}
                            style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }} 
                        />
                    </div>
                    {/* Dół */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>Dół:</span>
                        <SmartNumericInput 
                            value={ovBottom} 
                            unit="mm"
                            onChange={(val) => {
                                setOvBottom(val);
                                triggerUpdate({ ov_bottom: val });
                            }}
                            style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }} 
                        />
                    </div>
                    {/* Prawo */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '11px' }}>Prawo:</span>
                        <SmartNumericInput 
                            value={ovRight} 
                            unit="mm"
                            onChange={(val) => {
                                setOvRight(val);
                                triggerUpdate({ ov_right: val });
                            }}
                            style={{ width: '50px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right', fontSize: '11px' }} 
                        />
                    </div>
                </div>
            </div>

            {/* Okucia (Zawiasy) */}
            <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⧉</span> Okucia (Zawiasy):
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '11px' }}>Szablon...</span>
                    <select 
                        value={hingeTemplate} 
                        onChange={(e) => { setHingeTemplate(e.target.value); triggerUpdate({ hinge_template: e.target.value }); }}
                        style={{ width: '180px', padding: '2px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', fontSize: '11px' }}
                    >
                        {listByType('HINGE').map((hw) => (
                            <option key={hw.id} value={hw.id}>[{hw.brand || ''}] {hw.name || hw.id}</option>
                        ))}
                    </select>
                </div>

                {/* Zawiasy 1 do 6 */}
                {(() => {
                    const sbHeight = dimToMm(container?.height);
                    const ovTopMm = toNum(ovTop, 14);
                    const ovBottomMm = toNum(ovBottom, 15);
                    return [
                    { label: 'Poz. Z 1::', active: useHinge1, setActive: setUseHinge1, val: hinge1Pos, setVal: setHinge1Pos, keyActive: 'use_hinge_1', keyPos: 'hinge_1_pos', fromTop: false },
                    { label: 'Poz. Z 2::', active: useHinge2, setActive: setUseHinge2, val: hinge2Pos, setVal: setHinge2Pos, keyActive: 'use_hinge_2', keyPos: 'hinge_2_pos', fromTop: false },
                    { label: 'Poz. Z 3::', active: useHinge3, setActive: setUseHinge3, val: hinge3Pos, setVal: setHinge3Pos, keyActive: 'use_hinge_3', keyPos: 'hinge_3_pos', fromTop: false },
                    { label: 'Poz. Z 4::', active: useHinge4, setActive: setUseHinge4, val: hinge4Pos, setVal: setHinge4Pos, keyActive: 'use_hinge_4', keyPos: 'hinge_4_pos', fromTop: false },
                    { label: 'Poz. Z 5::', active: useHinge5, setActive: setUseHinge5, val: hinge5Pos, setVal: setHinge5Pos, keyActive: 'use_hinge_5', keyPos: 'hinge_5_pos', fromTop: false },
                    { label: 'Poz. Z Góra::', active: useHinge6, setActive: setUseHinge6, val: hinge6Pos, setVal: setHinge6Pos, keyActive: 'use_hinge_6', keyPos: 'hinge_6_pos', fromTop: true },
                ].map((h, i) => {
                    const outOfPanel = h.active && isDoorHingeOutOfPanel({
                        posMm: toNum(h.val, 0),
                        fromTop: h.fromTop,
                        sbHeight,
                        ovTop: ovTopMm,
                        ovBottom: ovBottomMm,
                        hingeId: hingeTemplate
                    });
                    return (
                    <div
                        key={i}
                        title={outOfPanel ? 'Ostrzeżenie: otwór zawiasu wychodzi poza formatkę drzwi' : undefined}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '2px 4px',
                            margin: '0 -4px',
                            borderRadius: '3px',
                            background: outOfPanel ? '#3b1515' : 'transparent',
                            border: outOfPanel ? '1px solid #7f1d1d' : '1px solid transparent'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input 
                                type="checkbox" 
                                id={`chkHinge_${i}`}
                                checked={h.active}
                                onChange={(e) => {
                                    h.setActive(e.target.checked);
                                    triggerUpdate({ [h.keyActive]: e.target.checked });
                                }}
                            />
                            <label
                                htmlFor={`chkHinge_${i}`}
                                style={{
                                    color: outOfPanel ? '#f87171' : (h.active ? '#e4e4e7' : '#71717a'),
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    fontWeight: outOfPanel ? 'bold' : 'normal'
                                }}
                            >
                                {outOfPanel ? '⚠ ' : ''}{h.label}
                            </label>
                        </div>
                        <SmartNumericInput 
                            value={h.val}
                            disabled={!h.active}
                            unit="mm"
                            onChange={(v) => {
                                h.setVal(v);
                                triggerUpdate({ [h.keyPos]: v });
                            }}
                            style={{
                                width: '80px',
                                padding: '2px 4px',
                                background: h.active ? '#18181b' : '#18181b80',
                                border: `1px solid ${outOfPanel ? '#ef4444' : '#3f3f46'}`,
                                color: outOfPanel ? '#fca5a5' : (h.active ? '#fff' : '#71717a'),
                                borderRadius: '3px',
                                textAlign: 'right',
                                fontSize: '11px'
                            }}
                        />
                    </div>
                    );
                });
                })()}
            </div>

        </div>
    );
}
