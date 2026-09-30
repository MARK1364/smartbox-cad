/**
 * corner-doors-adapter.tsx — Bloki DRZWI NAROŻNE (blok_corner_doors)
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateCornerDoorsPlan,
    normalizeCornerDoorsParams
} from './corner-doors-engine.js';
import type { ModuleDims } from './base-engine.js';
import { DEFAULT_HINGE_ID } from '../B1_biblioteka/index.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import cornerDoorsTekstRaw from './corner-doors_tekst.json';
import type { CornerDoorsPlanParams } from './bloki-module-types.js';

const cornerDoorsTekst = cornerDoorsTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.corner_doors';

/** Jednostronna = obecny układ (fuga + zawiasy). Dwustronna = osobne skrzydła (silnik później). */
export type CornerOtwieranie = 'jednostronna' | 'dwustronna_lewy' | 'dwustronna_prawy';

export function normalizeCornerOtwieranie(val: string | undefined): CornerOtwieranie {
    if (val === 'dwustronna_lewy' || val === 'dwustronna_prawy') return val;
    return 'jednostronna';
}

const OTWIERANIE_IDS: readonly CornerOtwieranie[] = ['jednostronna', 'dwustronna_lewy', 'dwustronna_prawy'] as const;

export { buildCornerDoorsPlan } from './module-plans.js';

import type { ContainerModel } from '../A1_core/container-model.js';

export function CornerDoorsSubModule({
    container,
    triggerUpdate
}: {
    container: ContainerModel;
    triggerUpdate: (params: Partial<CornerDoorsPlanParams>, immediate?: boolean) => void;
}) {
    const p = container?.generatorParams || {};
    useLocale();
    const [otwieranie, setOtwieranie] = useState<CornerOtwieranie>(() => normalizeCornerOtwieranie(p.otwieranie));
    const [szcz_srodkowa, setSzczSrodkowa] = useState<number>(p.szczelina_srodkowa_mm ?? 8);
    const [ovTop, setOvTop] = useState<string | number>(p.nalozenie_gora_mm ?? 14);
    const [ovBottom, setOvBottom] = useState<string | number>(p.nalozenie_dol_mm ?? 15);
    const [nalozenie_prawe, setNalozeniePrawe] = useState<string | number>(p.nalozenie_prawe_mm ?? 16);
    const [nalozenie_lewe, setNalozenieLewe] = useState<string | number>(p.nalozenie_lewe_mm ?? 16);

    const missingParams: string[] = [];
    if (p.szczelina_srodkowa_mm === undefined) missingParams.push('szczelina_srodkowa_mm');
    if (p.nalozenie_gora_mm === undefined) missingParams.push('nalozenie_gora_mm');
    if (p.nalozenie_dol_mm === undefined) missingParams.push('nalozenie_dol_mm');
    if (p.nalozenie_lewe_mm === undefined) missingParams.push('nalozenie_lewe_mm');
    if (p.nalozenie_prawe_mm === undefined) missingParams.push('nalozenie_prawe_mm');
    if (p.grubosc_frontu_mm === undefined) missingParams.push('grubosc_frontu_mm');

    useEffect(() => {
        if (missingParams.length > 0) {
            console.warn(
                `[corner-doors] Brak generatorParams: ${missingParams.join(', ')} — silnik nie podstawia; ustaw w panelu lub wstaw ponownie drzwi narożne.`
            );
        }
    }, [container?.id, missingParams.join(',')]);

    useEffect(() => {
        setOtwieranie(normalizeCornerOtwieranie(p.otwieranie));
        setSzczSrodkowa(p.szczelina_srodkowa_mm ?? 8);
        setOvTop(p.nalozenie_gora_mm ?? 14);
        setOvBottom(p.nalozenie_dol_mm ?? 15);
        setNalozeniePrawe(p.nalozenie_prawe_mm ?? 16);
        setNalozenieLewe(p.nalozenie_lewe_mm ?? 16);
    }, [
        container?.id,
        p.otwieranie,
        p.szczelina_srodkowa_mm,
        p.nalozenie_gora_mm,
        p.nalozenie_dol_mm,
        p.nalozenie_prawe_mm,
        p.nalozenie_lewe_mm
    ]);

    const activeOtw = normalizeCornerOtwieranie(otwieranie);

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
                gap: '10px'
            }}
        >
            {missingParams.length > 0 && (
                <div style={{ fontSize: '11px', color: '#f87171', lineHeight: 1.35 }}>
                    {tx(cornerDoorsTekst, 'missing_params.box', TX_NS, { keys: missingParams.join(', ') })}
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(cornerDoorsTekst, 'otwieranie.label', TX_NS)}</span>
                <div style={{ display: 'flex', width: '100%', borderRadius: '4px', overflow: 'hidden', border: '1px solid #3f3f46' }}>
                    {OTWIERANIE_IDS.map((id, i) => (
                        <button
                            key={id}
                            type="button"
                            style={{
                                flex: 1,
                                padding: '5px 2px',
                                background: activeOtw === id ? '#3b82f6' : '#27272a',
                                color: '#fff',
                                border: 'none',
                                borderLeft: i > 0 ? '1px solid #3f3f46' : 'none',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: activeOtw === id ? 'bold' : 'normal',
                            }}
                            onClick={() => {
                                setOtwieranie(id);
                                triggerUpdate({ otwieranie: id });
                            }}
                        >
                            {tx(cornerDoorsTekst, `otwieranie.items.${id}`, TX_NS)}
                        </button>
                    ))}
                </div>
                <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                    {tx(cornerDoorsTekst, `otwieranie.hint.${activeOtw}`, TX_NS)}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(cornerDoorsTekst, 'szcz_srodkowa.label', TX_NS)}</span>
                <SmartNumericInput
                    value={szcz_srodkowa}
                    step={0.01}
                    decimals={2}
                    unit="mm"
                    style={{
                        width: '80px',
                        padding: '3px 6px',
                        background: '#18181b',
                        border: '1px solid #3f3f46',
                        color: '#fff',
                        borderRadius: '3px',
                        textAlign: 'right'
                    }}
                    onChange={(val) => {
                        setSzczSrodkowa(val);
                        triggerUpdate({ szczelina_srodkowa_mm: val });
                    }}
                />
            </div>

            <div
                style={{
                    background: '#1c1c1f',
                    border: '1px solid #2d2d30',
                    borderRadius: '4px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                }}
            >
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>{tx(cornerDoorsTekst, 'overlaps.title', TX_NS)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {(
                        [
                            ['ov_top', ovTop, setOvTop, 'nalozenie_gora_mm'],
                            ['ov_bottom', ovBottom, setOvBottom, 'nalozenie_dol_mm'],
                            ['nalozenie_lewe', nalozenie_lewe, setNalozenieLewe, 'nalozenie_lewe_mm'],
                            ['nalozenie_prawe', nalozenie_prawe, setNalozeniePrawe, 'nalozenie_prawe_mm']
                        ] as const
                    ).map(([labelKey, val, setVal, canonKey]) => (
                        <div key={canonKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#d4d4d8', fontSize: '11px' }}>{tx(cornerDoorsTekst, `${labelKey}.label`, TX_NS)}:</span>
                            <SmartNumericInput
                                value={val}
                                step={0.01}
                                decimals={2}
                                unit="mm"
                                onChange={(v) => {
                                    setVal(v);
                                    triggerUpdate({ [canonKey]: v });
                                }}
                                style={{
                                    width: '50px',
                                    padding: '2px 4px',
                                    background: '#18181b',
                                    border: '1px solid #3f3f46',
                                    color: '#fff',
                                    borderRadius: '3px',
                                    textAlign: 'right',
                                    fontSize: '11px'
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
