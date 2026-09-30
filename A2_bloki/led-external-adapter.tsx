/**
 * led-external-adapter.tsx — adapter UI i budowniczy planu dla KANAŁ LED PODSZAFKOWY (blok_led_external)
 */

import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateLedExternalPlan,
    normalizeLedExternalParams
} from './led-external-engine.js';
import type { ModuleDims } from './base-engine.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import ledExternalTekstRaw from './led-external_tekst.json';
import type { LedExternalPlanParams } from './bloki-module-types.js';

const ledExternalTekst = ledExternalTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.led_external';

export { buildLedExternalPlan } from './module-plans.js';

const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
};
const labelStyle: React.CSSProperties = { color: '#d4d4d8', fontSize: '12px' };
const inputStyle: React.CSSProperties = {
    width: '80px',
    padding: '3px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    textAlign: 'right'
};

import type { ContainerModel } from '../A1_core/container-model.js';

export function LedExternalSubModule({ container, triggerUpdate }: { container: ContainerModel; triggerUpdate: (params: Partial<LedExternalPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};

    const [offsetFront, setOffsetFront] = useState<string | number>(p.odsuniecie_od_przodu_mm ?? 50);
    const [grooveW, setGrooveW] = useState<string | number>(p.szerokosc_wpustu_mm ?? 14);
    const [grooveD, setGrooveD] = useState<string | number>(p.glebokosc_wpustu_mm ?? 9);

    useEffect(() => {
        const gp = container?.generatorParams || {};
        setOffsetFront(gp.odsuniecie_od_przodu_mm ?? 50);
        setGrooveW(gp.szerokosc_wpustu_mm ?? 14);
        setGrooveD(gp.glebokosc_wpustu_mm ?? 9);
    }, [container?.id]);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontWeight: 'bold', color: '#60a5fa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #333338', paddingBottom: '4px' }}>
                <span>{tx(ledExternalTekst, 'panel.title', TX_NS)}</span>
            </div>

            <div style={rowStyle}>
                <span style={labelStyle}>{tx(ledExternalTekst, 'offset_front.label', TX_NS)}</span>
                <SmartNumericInput
                    id="sb-led-offset-front-input"
                    value={offsetFront}
                    min={5} max={400} step={1} decimals={1} unit="mm"
                    style={inputStyle}
                    onChange={(val) => {
                        setOffsetFront(val);
                        triggerUpdate({
                            odsuniecie_od_przodu_mm: val,
                            frezuj_boki: true
                        });
                    }}
                />
            </div>

            {/* Parametry rowka */}
            <div style={{ borderTop: '1px solid #333338', paddingTop: '6px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(ledExternalTekst, 'groove.width', TX_NS)}</span>
                    <SmartNumericInput
                        id="sb-led-groove-width-input"
                        value={grooveW}
                        min={5} max={40} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            setGrooveW(val);
                            triggerUpdate({
                                szerokosc_wpustu_mm: val,
                                frezuj_boki: true
                            });
                        }}
                    />
                </div>

                <div style={rowStyle}>
                    <span style={labelStyle}>{tx(ledExternalTekst, 'groove.depth', TX_NS)}</span>
                    <SmartNumericInput
                        id="sb-led-groove-depth-input"
                        value={grooveD}
                        min={2} max={18} step={0.5} decimals={1} unit="mm"
                        style={inputStyle}
                        onChange={(val) => {
                            setGrooveD(val);
                            triggerUpdate({
                                glebokosc_wpustu_mm: val,
                                frezuj_boki: true
                            });
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
