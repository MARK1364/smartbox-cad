/**
 * dividers-adapter.tsx — moduł PRZEGRODY (blok_dividers)
 * Odpowiednik @@BLENDER/A2_bloki/dividers_1_addon_v1.py
 *
 * Panel UI (DividersSubModule) + mapowanie parametrów na silnik (buildDividersPlan).
 * Bez nawierceń.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { calculateDividersPlan, normalizeDividersParams, equalBayWidth, resolveDividerLayout } from './10_dividers-engine.js';
import type { ModuleDims } from './01_base-engine.js';
import type { BlokiPlanResult } from './01_bloki-types.js';
import { nmToMm } from '../A1_core/cad-math/units.js';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import dividersTekstRaw from './10_dividers_tekst.json';
import type { DividersPlanParams } from './01_bloki-module-types.js';

import dividersRules from './10_dividers_3_rules_V1.json';
import { resolveRuleThicknessMm } from './01_bloki-rules-helper.js';

const dividersTekst = dividersTekstRaw as unknown as ModuleTexts;
const TX_NS = 'bloki.dividers';
const DEFAULT_DIVIDER_THICKNESS = resolveRuleThicknessMm(dividersRules, ['DIVIDERS_1', 'DIVIDER_PLATE'], 'thickness', 'dividers');

const SPACING_IDS = ['EQUAL', 'CUSTOM'] as const;

const MAX_DIVIDERS = 5;

function toNum(val: string | number | undefined, fallback = 0): number {
    const n = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
    return Number.isFinite(n) ? n : fallback;
}

function dimToMm(raw: number | undefined): number {
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) return 0;
    return nmToMm(Number(raw));
}

function emptySections(): number[] {
    return [200, 200, 200, 200, 200];
}

function readSectionsFromParams(p: any): number[] {
    const fromArray: number[] = p.szerokosci_wnek_mm || [];
    const next = emptySections();
    for (let i = 0; i < MAX_DIVIDERS; i++) {
        let v = fromArray[i];
        if (v === undefined) continue;
        v = Number(v);
        if (!Number.isFinite(v)) continue;
        next[i] = v;
    }
    return next;
}

export { buildDividersPlan } from './01_module-plans.js';

const inputStyle: React.CSSProperties = {
    width: '90px',
    padding: '3px 6px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    textAlign: 'right'
};
const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};
const labelStyle: React.CSSProperties = { color: '#d4d4d8', fontSize: '12px' };

import type { ContainerModel } from '../A1_core/container-model.js';

export function DividersSubModule({ container, triggerUpdate }: { container: ContainerModel, triggerUpdate: (params: Partial<DividersPlanParams>) => void }) {
    useLocale();
    const p = container?.generatorParams || {};
    const [count, setCount] = useState<number>(Math.min(MAX_DIVIDERS, p.liczba_przegrod ?? 2));
    const [spacingMode, setSpacingMode] = useState<'EQUAL' | 'CUSTOM'>(
        String(p.tryb_rozstawu || 'EQUAL').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'EQUAL'
    );
    const [sectionWidths, setSectionWidths] = useState<number[]>(() => readSectionsFromParams(p));

    useEffect(() => {
        const gp = container?.generatorParams || {};
        setCount(Math.min(MAX_DIVIDERS, gp.liczba_przegrod ?? 2));
        setSpacingMode(String(gp.tryb_rozstawu || 'EQUAL').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'EQUAL');
        setSectionWidths(readSectionsFromParams(gp));
    }, [container?.id]);

    const dims = {
        width_mm: dimToMm(container?.width) || 600,
        height_mm: dimToMm(container?.height) || 720,
        depth_mm: dimToMm(container?.depth) || 500
    };

    const pushUpdate = (patch: Partial<DividersPlanParams>) => {
        triggerUpdate({
            liczba_przegrod: count,
            tryb_rozstawu: spacingMode,
            szerokosci_wnek_mm: sectionWidths,
            ...patch
        });
    };

    const layout = resolveDividerLayout({
        liczba_przegrod: count,
        tryb_rozstawu: spacingMode,
        szerokosci_wnek_mm: sectionWidths,
        grubosc_przegrody_mm: DEFAULT_DIVIDER_THICKNESS
    }, dims);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={rowStyle}>
                <span style={labelStyle}>{tx(dividersTekst, 'count.label', TX_NS)}</span>
                <SmartNumericInput
                    id="sb-dividers-count-input"
                    value={count}
                    min={0} max={MAX_DIVIDERS} step={1} decimals={0}
                    style={{ ...inputStyle, width: '120px' }}
                    onChange={(val) => {
                        const n = Math.max(0, Math.min(MAX_DIVIDERS, Math.round(val)));
                        setCount(n);
                        pushUpdate({ liczba_przegrod: n });
                    }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={labelStyle}>{tx(dividersTekst, 'spacing_mode.label', TX_NS)}</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {SPACING_IDS.map((id) => (
                        <label key={id} style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                                id={`sb-dividers-spacing-${id.toLowerCase()}`}
                                type="radio"
                                name="dividerSpacing"
                                checked={spacingMode === id}
                                onChange={() => {
                                    let nextSections = sectionWidths;
                                    if (id === 'CUSTOM' && spacingMode !== 'CUSTOM') {
                                        const eq = Math.round(equalBayWidth(dims.width_mm, count, DEFAULT_DIVIDER_THICKNESS) * 100) / 100;
                                        nextSections = emptySections().map((_, i) => (i < count ? eq : 200));
                                        setSectionWidths(nextSections);
                                    }
                                    setSpacingMode(id);
                                    pushUpdate({
                                        tryb_rozstawu: id,
                                        ...(id === 'CUSTOM' ? { szerokosci_wnek_mm: nextSections } : {})
                                    });
                                }}
                            />
                            {tx(dividersTekst, `spacing_mode.items.${id}`, TX_NS)}
                        </label>
                    ))}
                </div>
            </div>

            {spacingMode === 'CUSTOM' && count > 0 && (
                <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>{tx(dividersTekst, 'sections.title', TX_NS)}</div>
                    {Array.from({ length: count }).map((_, i) => (
                        <div key={i} style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(dividersTekst, 'section.label_template', TX_NS, { n: i + 1 })}</span>
                            <SmartNumericInput
                                value={sectionWidths[i] !== undefined ? Math.round(sectionWidths[i] * 100) / 100 : 200}
                                min={10} step={0.01} decimals={2} unit="mm"
                                style={{ ...inputStyle, width: '80px', fontSize: '11px' }}
                                onChange={(val) => {
                                    const next = [...sectionWidths];
                                    next[i] = Math.round(toNum(val, 200) * 100) / 100;
                                    setSectionWidths(next);
                                    pushUpdate({ szerokosci_wnek_mm: next });
                                }}
                            />
                        </div>
                    ))}
                    <div
                        style={rowStyle}
                        title={tx(dividersTekst, layout.ostatnia_wneka_poza_panelem ? 'last_bay.tooltip_error' : 'last_bay.tooltip', TX_NS)}
                    >
                        <span style={{ ...labelStyle, fontSize: '11px' }}>{tx(dividersTekst, 'section.label_template', TX_NS, { n: count + 1 })}</span>
                        <SmartNumericInput
                            value={Math.round(layout.ostatnia_wneka_mm * 100) / 100}
                            step={0.01} decimals={2} unit="mm"
                            readOnly
                            style={{
                                ...inputStyle,
                                width: '80px',
                                fontSize: '11px',
                                color: layout.ostatnia_wneka_poza_panelem ? '#f87171' : '#fff',
                                borderColor: layout.ostatnia_wneka_poza_panelem ? '#7f1d1d' : '#3f3f46',
                                cursor: 'default'
                            }}
                            onChange={() => { /* wynikowa — bez edycji */ }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
