/**
 * shelves-adapter.tsx — moduł PÓŁKI (blok_shelves)
 * Odpowiednik @@BLENDER/A2_bloki/shelves_1_addon_v1.py
 *
 * Zawiera panel UI (ShelvesSubModule) oraz mapowanie parametrów kontenera
 * na wejście silnika (buildShelvesPlan) — odpowiednik wygeneruj_polki_logika_v1.
 * Nawiercenia półek: shelves-drilling-builder.ts, sync w bloki-core.ts.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateShelvesPlan, normalizeShelvesParams, equalShelfBottomZ } from './04_shelves-engine.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import type { ModuleDims } from './01_base-engine.js';
import type { BlokiPlanResult } from './01_bloki-types.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import shelvesTekstRaw from './04_shelves_tekst.json';
import type { ShelfHolePattern, ShelvesPlanParams } from './01_bloki-module-types.js';

const shelvesTekst = shelvesTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.shelves';

import type { ContainerModel } from '../A1_core/container-model.js';

export { buildShelvesPlan } from './01_module-plans.js';

export function ShelvesSubModule({ container, triggerUpdate }: { container: ContainerModel, triggerUpdate: (params: Partial<ShelvesPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};
    const totalH_mm = container?.height 
        ? nmToMm(container.height) 
        : ((container as any)?.domainData?.height ? nmToMm((container as any).domainData.height) : 720);
    const thickness_mm = p.grubosc_polki_mm ?? 18;

    const getEqualPositions = (count: number, totalH: number, thick: number): number[] => {
        if (count <= 0) return [];
        return Array.from({ length: count }, (_, idx) =>
            Number(equalShelfBottomZ(totalH, count, thick, idx + 1).toFixed(1))
        );
    };

    const [shelfCount, setShelfCount] = useState<number>(p.liczba_polek ?? 3);
    const [positionMode, setPositionMode] = useState<'equal' | 'manual'>(() =>
        Array.isArray(p.pozycje_polek_z_mm) && p.pozycje_polek_z_mm.length === (p.liczba_polek ?? 3) ? 'manual' : 'equal'
    );
    const [shelfPositions, setShelfPositions] = useState<number[]>(() => {
        const arr = p.pozycje_polek_z_mm;
        if (Array.isArray(arr) && arr.length === (p.liczba_polek ?? 3)) {
            return arr;
        }
        return getEqualPositions(p.liczba_polek ?? 3, totalH_mm, thickness_mm);
    });
    const [shelfOffsetFront, setShelfOffsetFront] = useState<string | number>(p.odsuniecie_przod_mm ?? 10);
    const [shelfOffsetSide, setShelfOffsetSide] = useState<string | number>(p.luz_boczny_mm ?? 0.5);
    const [frontInset, setFrontInset] = useState<number>(p.odstep_otworow_przod_mm ?? 40);
    const [backInset, setBackInset] = useState<number>(p.odstep_otworow_tyl_mm ?? 40);
    const [pinDiameter, setPinDiameter] = useState<number>(p.srednica_podporki_mm ?? 5);
    const [holePattern, setHolePattern] = useState<string>(p.wzor_nawiercen || 'SINGLE');
    const [tripleZOffset, setTripleZOffset] = useState<number>(p.rozstaw_potrojny_z_mm ?? 32);
    const [system32Spacing, setSystem32Spacing] = useState<number>(p.rozstaw_system32_mm ?? 32);
    const [system32StartOffset, setSystem32StartOffset] = useState<number>(p.start_system32_z_mm ?? 150);
    const [system32HoleCount, setSystem32HoleCount] = useState<number>(p.liczba_otworow_system32 ?? 10);
    const [frontHoles, setFrontHoles] = useState<boolean>(p.otwory_przod_aktywne === true);
    const [frontOffsetX, setFrontOffsetX] = useState<number>(p.przesuniecie_otworow_przod_x_mm ?? 0);
    const [backHoles, setBackHoles] = useState<boolean>(p.otwory_tyl_aktywne === true);
    const [backOffsetX, setBackOffsetX] = useState<number>(p.przesuniecie_otworow_tyl_x_mm ?? 0);

    useEffect(() => {
        const gp = container?.generatorParams || {};
        const count = gp.liczba_polek ?? 3;
        const thick = gp.grubosc_polki_mm ?? 18;
        setShelfCount(count);
        if (Array.isArray(gp.pozycje_polek_z_mm) && gp.pozycje_polek_z_mm.length === count) {
            setPositionMode('manual');
            setShelfPositions(gp.pozycje_polek_z_mm);
        } else {
            setPositionMode('equal');
            setShelfPositions(getEqualPositions(count, totalH_mm, thick));
        }
        setShelfOffsetFront(gp.odsuniecie_przod_mm ?? 10);
        setShelfOffsetSide(gp.luz_boczny_mm ?? 0.5);
        setFrontInset(gp.odstep_otworow_przod_mm ?? 40);
        setBackInset(gp.odstep_otworow_tyl_mm ?? 40);
        setPinDiameter(gp.srednica_podporki_mm ?? 5);
        setHolePattern(gp.wzor_nawiercen || 'SINGLE');
        setTripleZOffset(gp.rozstaw_potrojny_z_mm ?? 32);
        setSystem32Spacing(gp.rozstaw_system32_mm ?? 32);
        setSystem32StartOffset(gp.start_system32_z_mm ?? 150);
        setSystem32HoleCount(gp.liczba_otworow_system32 ?? 10);
        setFrontHoles(gp.otwory_przod_aktywne === true);
        setFrontOffsetX(gp.przesuniecie_otworow_przod_x_mm ?? 0);
        setBackHoles(gp.otwory_tyl_aktywne === true);
        setBackOffsetX(gp.przesuniecie_otworow_tyl_x_mm ?? 0);
    }, [container?.id, container?.height, p.pozycje_polek_z_mm, p.liczba_polek]);

    const handlePositionChange = (index: number, val: number) => {
        const updated = [...shelfPositions];
        updated[index] = val;
        setPositionMode('manual');
        setShelfPositions(updated);
        triggerUpdate({ pozycje_polek_z_mm: updated });
    };

    const handleModeChange = (mode: 'equal' | 'manual') => {
        setPositionMode(mode);
        if (mode === 'equal') {
            const equalArr = getEqualPositions(shelfCount, totalH_mm, thickness_mm);
            setShelfPositions(equalArr);
            triggerUpdate({ pozycje_polek_z_mm: undefined });
        } else {
            triggerUpdate({ pozycje_polek_z_mm: shelfPositions });
        }
    };

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'shelf_count.label', TX_NS)}</span>
                <SmartNumericInput 
                    id="sb-shelves-count-input"
                    value={shelfCount} 
                    min={0} max={10} step={1} decimals={0}
                    style={{ width: '120px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setShelfCount(val);
                        setPositionMode('equal');
                        const newEqual = getEqualPositions(val, totalH_mm, thickness_mm);
                        setShelfPositions(newEqual);
                        triggerUpdate({ liczba_polek: val, pozycje_polek_z_mm: undefined });
                    }}
                />
            </div>

            {shelfCount > 0 && (
                <>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '4px',
                        marginBottom: '2px',
                    }}>
                        <div style={{ flex: 1, height: '1px', background: '#3f3f46' }} />
                        <span style={{ color: '#93c5fd', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                            {tx(shelvesTekst, 'shelf_positions_bar.label', TX_NS)}
                        </span>
                        <div style={{ flex: 1, height: '1px', background: '#3f3f46' }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '10px', padding: '2px 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#d4d4d8', fontSize: '12px', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name={`shelf-pos-mode-${container?.id || 'default'}`}
                                checked={positionMode === 'equal'}
                                onChange={() => handleModeChange('equal')}
                            />
                            {tx(shelvesTekst, 'shelf_positions.mode_equal', TX_NS)}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#d4d4d8', fontSize: '12px', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name={`shelf-pos-mode-${container?.id || 'default'}`}
                                checked={positionMode === 'manual'}
                                onChange={() => handleModeChange('manual')}
                            />
                            {tx(shelvesTekst, 'shelf_positions.mode_manual', TX_NS)}
                        </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#1c1c1f', padding: '6px 8px', borderRadius: '4px', border: '1px solid #2e2e33' }}>
                        {shelfPositions.map((pos, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: '#d4d4d8', fontSize: '11px' }}>
                                    {tx(shelvesTekst, 'shelf_positions.shelf_n', TX_NS, { n: idx + 1 })}
                                </span>
                                <SmartNumericInput
                                    value={pos}
                                    step={1}
                                    decimals={1}
                                    unit="mm"
                                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                                    onChange={(val) => handlePositionChange(idx, val)}
                                />
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '6px',
                marginBottom: '2px',
            }}>
                <div style={{ flex: 1, height: '1px', background: '#3f3f46' }} />
                <span style={{ color: '#93c5fd', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                    {tx(shelvesTekst, 'params_bar.label', TX_NS)}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#3f3f46' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'shelf_offset_front.label', TX_NS)}</span>
                <SmartNumericInput 
                    value={shelfOffsetFront} 
                    step={1} decimals={2} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setShelfOffsetFront(val);
                        triggerUpdate({ odsuniecie_przod_mm: Number(val) });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'shelf_offset_side.label', TX_NS)}</span>
                <SmartNumericInput 
                    value={shelfOffsetSide} 
                    step={1} decimals={2} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setShelfOffsetSide(val);
                        triggerUpdate({ luz_boczny_mm: Number(val) });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'hole_offset_front.label', TX_NS)}</span>
                <SmartNumericInput 
                    value={frontInset} 
                    step={1} decimals={2} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setFrontInset(val);
                        triggerUpdate({ odstep_otworow_przod_mm: val });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'hole_offset_back.label', TX_NS)}</span>
                <SmartNumericInput 
                    value={backInset} 
                    step={1} decimals={2} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setBackInset(val);
                        triggerUpdate({ odstep_otworow_tyl_mm: val });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'pin_diameter.label', TX_NS)}</span>
                <SmartNumericInput 
                    value={pinDiameter} 
                    min={1} max={20} step={1} decimals={1} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setPinDiameter(val);
                        triggerUpdate({ srednica_podporki_mm: Number(val) });
                    }}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'hole_pattern.label', TX_NS)}</span>
                <select 
                    value={holePattern}
                    style={{ width: '130px', padding: '3px 4px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px' }}
                    onChange={(e) => {
                        const val = e.target.value as ShelfHolePattern;
                        setHolePattern(val);
                        triggerUpdate({ wzor_nawiercen: val });
                    }}
                >
                    <option value="SINGLE">{tx(shelvesTekst, 'hole_pattern.items.SINGLE', TX_NS)}</option>
                    <option value="TRIPLE">{tx(shelvesTekst, 'hole_pattern.items.TRIPLE', TX_NS)}</option>
                    <option value="SYSTEM_32">{tx(shelvesTekst, 'hole_pattern.items.SYSTEM_32', TX_NS)}</option>
                    <option value="NONE">{tx(shelvesTekst, 'hole_pattern.items.NONE', TX_NS)}</option>
                </select>
            </div>

            {holePattern === 'TRIPLE' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'triple_z_offset.label', TX_NS)}</span>
                    <SmartNumericInput 
                        value={tripleZOffset}
                        step={1} decimals={2} unit="mm"
                        style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setTripleZOffset(val);
                            triggerUpdate({ rozstaw_potrojny_z_mm: val });
                        }}
                    />
                </div>
            )}

            {(holePattern === 'SYSTEM_32' || holePattern === 'ROW') && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'system_32_spacing.label', TX_NS)}</span>
                        <SmartNumericInput 
                            value={system32Spacing}
                            step={1} decimals={2} unit="mm"
                            style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                            onChange={(val) => {
                                setSystem32Spacing(val);
                                triggerUpdate({ rozstaw_system32_mm: val });
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'system_32_start_offset.label', TX_NS)}</span>
                        <SmartNumericInput 
                            value={system32StartOffset}
                            step={1} decimals={2} unit="mm"
                            style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                            onChange={(val) => {
                                setSystem32StartOffset(val);
                                triggerUpdate({ start_system32_z_mm: val });
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelvesTekst, 'system_32_hole_count.label', TX_NS)}</span>
                        <SmartNumericInput 
                            value={system32HoleCount}
                            min={1} max={100} step={1} decimals={0}
                            style={{ width: '120px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                            onChange={(val) => {
                                setSystem32HoleCount(val);
                                triggerUpdate({ liczba_otworow_system32: val });
                            }}
                        />
                    </div>
                </>
            )}

            {holePattern !== 'NONE' && (
                <>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '6px',
                        marginBottom: '2px',
                    }}>
                        <div style={{ flex: 1, height: '1px', background: '#3f3f46' }} />
                        <span style={{ color: '#93c5fd', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                            {tx(shelvesTekst, 'holes_bar.label', TX_NS)}
                        </span>
                        <div style={{ flex: 1, height: '1px', background: '#3f3f46' }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <input 
                            type="checkbox" 
                            id="chkFrontHoles"
                            checked={frontHoles}
                            onChange={(e) => {
                                setFrontHoles(e.target.checked);
                                triggerUpdate({ otwory_przod_aktywne: e.target.checked });
                            }}
                        />
                        <label htmlFor="chkFrontHoles" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>{tx(shelvesTekst, 'front_holes.label', TX_NS)}</label>
                    </div>

                    {frontHoles && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '16px' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{tx(shelvesTekst, 'front_offset_x.label', TX_NS)}</span>
                            <SmartNumericInput 
                                value={frontOffsetX}
                                step={1} decimals={2}
                                unit="mm"
                                style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                                onChange={(val) => {
                                    setFrontOffsetX(val);
                                    triggerUpdate({ przesuniecie_otworow_przod_x_mm: val });
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
                                triggerUpdate({ otwory_tyl_aktywne: e.target.checked });
                            }}
                        />
                        <label htmlFor="chkBackHoles" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>{tx(shelvesTekst, 'back_holes.label', TX_NS)}</label>
                    </div>

                    {backHoles && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '16px' }}>
                            <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{tx(shelvesTekst, 'back_offset_x.label', TX_NS)}</span>
                            <SmartNumericInput 
                                value={backOffsetX}
                                step={1} decimals={2}
                                unit="mm"
                                style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                                onChange={(val) => {
                                    setBackOffsetX(val);
                                    triggerUpdate({ przesuniecie_otworow_tyl_x_mm: val });
                                }}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
