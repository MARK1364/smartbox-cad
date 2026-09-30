/**
 * shelf-adapter.tsx — moduł WIENIEC (blok_shelf)
 * Odpowiednik @@BLENDER/A2_bloki/shelf_1_addon_v1.py
 *
 * Panel UI (ShelfSubModule) + mapowanie parametrów na silnik (buildShelfPlan).
 * Wieniec nie ma nawierceń — machining_library w shelf_3_rules_V1.json jest puste.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateShelfPlan, normalizeShelfParams } from './shelf-engine.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import type { ModuleDims } from './base-engine.js';
import type { BlokiPlanResult } from './bloki-types.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import shelfRules from './shelf_3_rules_V1.json';
import { resolveRuleThicknessMm } from './bloki-rules-helper.js';
import type { ShelfPlanParams } from './bloki-module-types.js';
import shelfTekstRaw from './shelf_tekst.json';

const shelfTekst = shelfTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.shelf';
const DEFAULT_SHELF_THICKNESS = resolveRuleThicknessMm(shelfRules, ['SHELF', 'SHELF_BOARD'], 'thickness', 'shelf');

function getContainerHeightMm(container: any): number {
    // container.height to model CAD w nm. Kanoniczny params ma height_mm.
    const rawMm = Number(container?.generatorParams?.height_mm);
    if (Number.isFinite(rawMm) && rawMm > 0) return rawMm;
    const rawNm = Number(container?.height);
    if (!Number.isFinite(rawNm) || rawNm <= 0) return 720;
    return nmToMm(rawNm);
}

import type { ContainerModel } from '../A1_core/container-model.js';

export { buildShelfPlan } from './module-plans.js';

export function ShelfSubModule({ container, triggerUpdate }: { container: ContainerModel, triggerUpdate: (params: Partial<ShelfPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};
    const containerHeight = getContainerHeightMm(container);
    const thickness = p.grubosc_wienca_mm !== undefined ? Number(p.grubosc_wienca_mm) : DEFAULT_SHELF_THICKNESS;

    const round2 = (v: number) => Math.round(v * 100) / 100;

    const initBottom = p.odstep_dol_mm !== undefined ? Number(p.odstep_dol_mm) : 100;
    const initTop = p.odstep_gora_mm !== undefined ? Number(p.odstep_gora_mm) : Math.max(0, round2(containerHeight - initBottom - thickness));

    const [offsetBottom, setOffsetBottom] = useState<string | number>(initBottom);
    const [offsetTop, setOffsetTop] = useState<string | number>(initTop);

    useEffect(() => {
        const curP = container?.generatorParams || {};
        const h = getContainerHeightMm(container);
        const th = curP.grubosc_wienca_mm !== undefined ? Number(curP.grubosc_wienca_mm) : DEFAULT_SHELF_THICKNESS;
        const ref = curP.baza_odniesienia || (curP.odstep_gora_mm !== undefined && curP.odstep_dol_mm === undefined ? 'top' : 'bottom');

        if (ref === 'top' && curP.odstep_gora_mm !== undefined) {
            const topVal = Number(curP.odstep_gora_mm ?? 100);
            setOffsetTop(topVal);
            setOffsetBottom(Math.max(0, round2(h - topVal - th)));
        } else {
            const btmVal = Number(curP.odstep_dol_mm ?? 100);
            setOffsetBottom(btmVal);
            setOffsetTop(Math.max(0, round2(h - btmVal - th)));
        }
    }, [container?.id, container?.height, container?.generatorParams?.height]);

    const handleBottomChange = (val: number) => {
        setOffsetBottom(val);
        const calcTop = Math.max(0, round2(containerHeight - val - thickness));
        setOffsetTop(calcTop);
        triggerUpdate({
            baza_odniesienia: 'bottom',
            odstep_dol_mm: val,
            odstep_gora_mm: calcTop,
        });
    };

    const handleTopChange = (val: number) => {
        setOffsetTop(val);
        const calcBottom = Math.max(0, round2(containerHeight - val - thickness));
        setOffsetBottom(calcBottom);
        triggerUpdate({
            baza_odniesienia: 'top',
            odstep_gora_mm: val,
            odstep_dol_mm: calcBottom,
        });
    };

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelfTekst, 'offset_bottom.label', TX_NS)}</span>
                <SmartNumericInput 
                    id="sb-single-shelf-bottom-input"
                    value={offsetBottom} 
                    min={0} step={0.01} decimals={2} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={handleBottomChange}
                />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#d4d4d8', fontSize: '12px' }}>{tx(shelfTekst, 'offset_top.label', TX_NS)}</span>
                <SmartNumericInput 
                    id="sb-single-shelf-top-input"
                    value={offsetTop} 
                    min={0} step={0.01} decimals={2} unit="mm"
                    style={{ width: '90px', padding: '3px 6px', background: '#18181b', border: '1px solid #3f3f46', color: '#fff', borderRadius: '3px', textAlign: 'right' }}
                    onChange={handleTopChange}
                />
            </div>
        </div>
    );
}
