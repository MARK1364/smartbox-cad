/**
 * tubes-adapter.tsx — moduł DRĄŻEK (blok_tubes)
 * Odpowiednik @@BLENDER/A2_bloki/tubes_1_addon_v1.py
 *
 * Panel UI (TubesSubModule) + mapowanie parametrów na silnik (buildTubesPlan).
 * Bez nawierceń.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateTubesPlan, normalizeTubesParams } from './tubes-engine.js';
import type { ModuleDims } from './base-engine.js';
import type { BlokiPlanResult } from './bloki-types.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import tubesTekstRaw from './tubes_tekst.json';
import type { TubesPlanParams } from './bloki-module-types.js';

const tubesTekst = tubesTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.tubes';

export { buildTubesPlan } from './module-plans.js';

import type { ContainerModel } from '../A1_core/container-model.js';

export function TubesSubModule({ container, triggerUpdate }: { container: ContainerModel, triggerUpdate: (params: Partial<TubesPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};
    const [offsetTop, setOffsetTop] = useState<string | number>(p.odstep_gora_mm ?? 70);
    const [showShelf, setShowShelf] = useState<boolean>(!!p.pokaz_polke);
    const [spaceAboveShelf, setSpaceAboveShelf] = useState<string | number>(p.przestrzen_nad_polka_mm ?? 100);

    useEffect(() => {
        setOffsetTop(p.odstep_gora_mm ?? 70);
        setShowShelf(!!p.pokaz_polke);
        setSpaceAboveShelf(p.przestrzen_nad_polka_mm ?? 100);
    }, [container?.id]);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(tubesTekst, 'offset_top.label', TX_NS)}</span>
                <SmartNumericInput 
                    id="sb-tube-offset-top-input"
                    value={offsetTop} 
                    min={10} max={300} step={0.01} decimals={2} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={(val) => {
                        setOffsetTop(val);
                        triggerUpdate({ odstep_gora_mm: Number(val) });
                    }}
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <input 
                    type="checkbox" 
                    id="sb-tube-show-top-shelf"
                    checked={showShelf}
                    onChange={(e) => {
                        setShowShelf(e.target.checked);
                        triggerUpdate({ pokaz_polke: e.target.checked });
                    }}
                />
                <label htmlFor="sb-tube-show-top-shelf" style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer' }}>{tx(tubesTekst, 'show_shelf.label', TX_NS)}</label>
            </div>

            {showShelf && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '16px' }}>
                    <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{tx(tubesTekst, 'space_above_shelf.label', TX_NS)}</span>
                    <SmartNumericInput 
                        id="sb-tube-space-above-shelf-input"
                        value={spaceAboveShelf} 
                        min={10} max={500} step={0.01} decimals={2} unit="mm"
                        style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                        onChange={(val) => {
                            setSpaceAboveShelf(val);
                            triggerUpdate({ przestrzen_nad_polka_mm: Number(val) });
                        }}
                    />
                </div>
            )}
        </div>
    );
}
