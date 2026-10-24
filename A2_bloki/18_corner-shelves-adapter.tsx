/**
 * 18_corner-shelves-adapter.tsx — moduł PÓŁKI NAROŻNE (blok_corner_shelves)
 *
 * Panel UI (CornerShelvesSubModule) oraz mapowanie parametrów kontenera
 * na wejście silnika.
 */

import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import cornerShelvesTekstRaw from './18_corner-shelves_tekst.json';
import type { CornerShelvesPlanParams, ShelfHolePattern } from './01_bloki-module-types.js';
import type { ContainerModel } from '../A1_core/container-model.js';

const cornerShelvesTekst = cornerShelvesTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.corner_shelves';

export { buildCornerShelvesPlan } from './01_module-plans.js';

export function CornerShelvesSubModule({
    container,
    triggerUpdate
}: {
    container: ContainerModel;
    triggerUpdate: (params: Partial<CornerShelvesPlanParams>) => void;
}) {
    useLocale();
    const p = container?.generatorParams || {};
    const [shelfCount, setShelfCount] = useState<number>(p.liczba_polek ?? 1);
    const [shelfOffsetFront, setShelfOffsetFront] = useState<string | number>(p.odsuniecie_przod_mm ?? 0);
    const [shelfOffsetSide, setShelfOffsetSide] = useState<string | number>(p.luz_boczny_mm ?? 0);
    const [frontInset, setFrontInset] = useState<number>(p.odstep_otworow_przod_mm ?? 40);
    const [backInset, setBackInset] = useState<number>(p.odstep_otworow_tyl_mm ?? 40);
    const [holePattern, setHolePattern] = useState<string>(p.wzor_nawiercen || 'SINGLE');
    const [tripleZOffset, setTripleZOffset] = useState<number>(p.rozstaw_potrojny_z_mm ?? 32);
    const [system32Spacing, setSystem32Spacing] = useState<number>(p.rozstaw_system32_mm ?? 32);
    const [system32StartOffset, setSystem32StartOffset] = useState<number>(p.start_system32_z_mm ?? 150);
    const [system32HoleCount, setSystem32HoleCount] = useState<number>(p.liczba_otworow_system32 ?? 10);
    const [cutoutNailer, setCutoutNailer] = useState<boolean>(p.wyciecie_listwa_narozna !== false);
    const [nailerClearance, setNailerClearance] = useState<string | number>(p.listwa_narozna_luz_mm ?? 1);

    useEffect(() => {
        const gp = container?.generatorParams || {};
        setShelfCount(gp.liczba_polek ?? 1);
        setShelfOffsetFront(gp.odsuniecie_przod_mm ?? 0);
        setShelfOffsetSide(gp.luz_boczny_mm ?? 0);
        setFrontInset(gp.odstep_otworow_przod_mm ?? 40);
        setBackInset(gp.odstep_otworow_tyl_mm ?? 40);
        setHolePattern(gp.wzor_nawiercen || 'SINGLE');
        setTripleZOffset(gp.rozstaw_potrojny_z_mm ?? 32);
        setSystem32Spacing(gp.rozstaw_system32_mm ?? 32);
        setSystem32StartOffset(gp.start_system32_z_mm ?? 150);
        setSystem32HoleCount(gp.liczba_otworow_system32 ?? 10);
        setCutoutNailer(gp.wyciecie_listwa_narozna !== false);
        setNailerClearance(gp.listwa_narozna_luz_mm ?? 1);
    }, [container?.id, container?.generatorParams]);

    return (
        <div
            className="submodule-box"
            style={{
                background: '#222225',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #2d2d30',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }}
        >
            {/* Liczba półek */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                    {tx(cornerShelvesTekst, 'shelf_count.label', TX_NS)}
                </span>
                <SmartNumericInput
                    id="corner-shelves-count-input"
                    value={shelfCount}
                    min={1}
                    max={10}
                    step={1}
                    decimals={0}
                    style={{
                        width: '100px',
                        padding: '3px 6px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#fff',
                        borderRadius: '3px',
                        textAlign: 'right'
                    }}
                    onChange={(val) => {
                        setShelfCount(val);
                        triggerUpdate({ liczba_polek: val });
                    }}
                />
            </div>

            {/* Odsunięcie od frontu */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                    style={{ color: '#d4d4d8', fontSize: '12px' }}
                    title={tx(cornerShelvesTekst, 'shelf_offset_front.tooltip', TX_NS)}
                >
                    {tx(cornerShelvesTekst, 'shelf_offset_front.label', TX_NS)}
                </span>
                <SmartNumericInput
                    value={shelfOffsetFront}
                    step={1}
                    decimals={1}
                    unit="mm"
                    style={{
                        width: '100px',
                        padding: '3px 6px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#fff',
                        borderRadius: '3px',
                        textAlign: 'right'
                    }}
                    onChange={(val) => {
                        setShelfOffsetFront(val);
                        triggerUpdate({ odsuniecie_przod_mm: Number(val) });
                    }}
                />
            </div>

            {/* Luz boczny */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                    style={{ color: '#d4d4d8', fontSize: '12px' }}
                    title={tx(cornerShelvesTekst, 'shelf_offset_side.tooltip', TX_NS)}
                >
                    {tx(cornerShelvesTekst, 'shelf_offset_side.label', TX_NS)}
                </span>
                <SmartNumericInput
                    value={shelfOffsetSide}
                    step={0.5}
                    decimals={1}
                    unit="mm"
                    style={{
                        width: '100px',
                        padding: '3px 6px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#fff',
                        borderRadius: '3px',
                        textAlign: 'right'
                    }}
                    onChange={(val) => {
                        setShelfOffsetSide(val);
                        triggerUpdate({ luz_boczny_mm: Number(val) });
                    }}
                />
            </div>

            {/* Odsunięcie otworów przód */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                    {tx(cornerShelvesTekst, 'hole_offset_front.label', TX_NS)}
                </span>
                <SmartNumericInput
                    value={frontInset}
                    step={1}
                    decimals={1}
                    unit="mm"
                    style={{
                        width: '100px',
                        padding: '3px 6px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#fff',
                        borderRadius: '3px',
                        textAlign: 'right'
                    }}
                    onChange={(val) => {
                        setFrontInset(val);
                        triggerUpdate({ odstep_otworow_przod_mm: val });
                    }}
                />
            </div>

            {/* Odsunięcie otworów tył */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                    {tx(cornerShelvesTekst, 'hole_offset_back.label', TX_NS)}
                </span>
                <SmartNumericInput
                    value={backInset}
                    step={1}
                    decimals={1}
                    unit="mm"
                    style={{
                        width: '100px',
                        padding: '3px 6px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#fff',
                        borderRadius: '3px',
                        textAlign: 'right'
                    }}
                    onChange={(val) => {
                        setBackInset(val);
                        triggerUpdate({ odstep_otworow_tyl_mm: val });
                    }}
                />
            </div>

            {/* Wzór nawierceń pod podpórki */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                    {tx(cornerShelvesTekst, 'hole_pattern.label', TX_NS)}
                </span>
                <select
                    value={holePattern}
                    onChange={(e) => {
                        const val = e.target.value as ShelfHolePattern;
                        setHolePattern(val);
                        triggerUpdate({ wzor_nawiercen: val });
                    }}
                    style={{
                        width: '100px',
                        padding: '3px 6px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#fff',
                        borderRadius: '3px',
                        fontSize: '11px'
                    }}
                >
                    <option value="SINGLE">{tx(cornerShelvesTekst, 'hole_pattern.items.SINGLE', TX_NS)}</option>
                    <option value="TRIPLE">{tx(cornerShelvesTekst, 'hole_pattern.items.TRIPLE', TX_NS)}</option>
                    <option value="SYSTEM_32">{tx(cornerShelvesTekst, 'hole_pattern.items.SYSTEM_32', TX_NS)}</option>
                    <option value="NONE">{tx(cornerShelvesTekst, 'hole_pattern.items.NONE', TX_NS)}</option>
                </select>
            </div>

            {/* Parametry dla TRIPLE */}
            {holePattern === 'TRIPLE' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                        {tx(cornerShelvesTekst, 'triple_z_offset.label', TX_NS)}
                    </span>
                    <SmartNumericInput
                        value={tripleZOffset}
                        step={1}
                        decimals={1}
                        unit="mm"
                        style={{
                            width: '100px',
                            padding: '3px 6px',
                            background: '#18181b',
                            border: '1px solid #3f3f46',
                            color: '#fff',
                            borderRadius: '3px',
                            textAlign: 'right'
                        }}
                        onChange={(val) => {
                            setTripleZOffset(val);
                            triggerUpdate({ rozstaw_potrojny_z_mm: val });
                        }}
                    />
                </div>
            )}

            {/* Parametry dla SYSTEM_32 / ROW */}
            {(holePattern === 'SYSTEM_32' || holePattern === 'ROW') && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                            {tx(cornerShelvesTekst, 'system_32_spacing.label', TX_NS)}
                        </span>
                        <SmartNumericInput
                            value={system32Spacing}
                            step={1}
                            decimals={1}
                            unit="mm"
                            style={{
                                width: '100px',
                                padding: '3px 6px',
                                background: '#18181b',
                                border: '1px solid #3f3f46',
                                color: '#fff',
                                borderRadius: '3px',
                                textAlign: 'right'
                            }}
                            onChange={(val) => {
                                setSystem32Spacing(val);
                                triggerUpdate({ rozstaw_system32_mm: val });
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                            {tx(cornerShelvesTekst, 'system_32_start_offset.label', TX_NS)}
                        </span>
                        <SmartNumericInput
                            value={system32StartOffset}
                            step={1}
                            decimals={1}
                            unit="mm"
                            style={{
                                width: '100px',
                                padding: '3px 6px',
                                background: '#18181b',
                                border: '1px solid #3f3f46',
                                color: '#fff',
                                borderRadius: '3px',
                                textAlign: 'right'
                            }}
                            onChange={(val) => {
                                setSystem32StartOffset(val);
                                triggerUpdate({ start_system32_z_mm: val });
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                            {tx(cornerShelvesTekst, 'system_32_hole_count.label', TX_NS)}
                        </span>
                        <SmartNumericInput
                            value={system32HoleCount}
                            min={1}
                            max={100}
                            step={1}
                            decimals={0}
                            style={{
                                width: '100px',
                                padding: '3px 6px',
                                background: '#18181b',
                                border: '1px solid #3f3f46',
                                color: '#fff',
                                borderRadius: '3px',
                                textAlign: 'right'
                            }}
                            onChange={(val) => {
                                setSystem32HoleCount(val);
                                triggerUpdate({ liczba_otworow_system32: val });
                            }}
                        />
                    </div>
                </>
            )}

            {/* Wcięcie na listwę narożną */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid #2d2d30' }}>
                <span
                    style={{ color: '#d4d4d8', fontSize: '12px' }}
                    title={tx(cornerShelvesTekst, 'nailer_cutout.tooltip', TX_NS)}
                >
                    {tx(cornerShelvesTekst, 'nailer_cutout.label', TX_NS)}
                </span>
                <input
                    type="checkbox"
                    checked={cutoutNailer}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                    onChange={(e) => {
                        const val = e.target.checked;
                        setCutoutNailer(val);
                        triggerUpdate({ wyciecie_listwa_narozna: val });
                    }}
                />
            </div>

            {cutoutNailer && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d4d4d8', fontSize: '12px' }}>
                        {tx(cornerShelvesTekst, 'nailer_clearance.label', TX_NS)}
                    </span>
                    <SmartNumericInput
                        value={nailerClearance}
                        min={0}
                        step={0.5}
                        decimals={1}
                        unit="mm"
                        style={{
                            width: '100px',
                            padding: '3px 6px',
                            background: '#18181b',
                            border: '1px solid #3f3f46',
                            color: '#fff',
                            borderRadius: '3px',
                            textAlign: 'right'
                        }}
                        onChange={(val) => {
                            setNailerClearance(val);
                            triggerUpdate({ listwa_narozna_luz_mm: Number(val) });
                        }}
                    />
                </div>
            )}
        </div>
    );
}
