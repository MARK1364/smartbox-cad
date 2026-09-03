/**
 * dividers-adapter.tsx — moduł PRZEGRODY (smartbox_dividers)
 * Odpowiednik @@BLENDER/A2_smartbox/dividers_1_addon_v1.py
 *
 * Panel UI (DividersSubModule) + mapowanie parametrów na silnik (buildDividersPlan).
 * Bez nawierceń.
 */
import React, { useState, useEffect } from 'react';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput.js';
import { DividersEngine, equalBayWidth, resolveDividerLayout } from './dividers-engine.js';
import type { ModuleDims } from './base-engine.js';
import { nmToMm } from '../A1_core/cad-math/units.js';

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
    const fromArray: number[] = p.sectionWidths || p.section_widths || [];
    const next = emptySections();
    for (let i = 0; i < MAX_DIVIDERS; i++) {
        const named = p[`section_${i + 1}_width`];
        let v = fromArray[i] !== undefined ? fromArray[i] : named;
        if (v === undefined) continue;
        v = Number(v);
        if (!Number.isFinite(v)) continue;
        next[i] = v;
    }
    return next;
}

export function buildDividersPlan(params: any, dims: ModuleDims): { parts: any[] } {
    const engine = new DividersEngine();
    const count = Math.max(0, Math.min(MAX_DIVIDERS, Math.round(params.count ?? params.dividerCount ?? 2)));
    return engine.plan({
        width: dims.width,
        height: dims.height,
        depth: dims.depth,
        thickness: params.thickness || 18,
        count,
        spacingMode: params.spacingMode || params.spacing_mode || 'EQUAL',
        sectionWidths: params.sectionWidths || params.section_widths || emptySections()
    });
}

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

export function DividersSubModule({ container, triggerUpdate }: { container: any, triggerUpdate: (params: any) => void }) {
    const p = container?.generatorParams || {};
    const [count, setCount] = useState<number>(Math.min(MAX_DIVIDERS, p.count ?? p.dividerCount ?? 2));
    const [spacingMode, setSpacingMode] = useState<'EQUAL' | 'CUSTOM'>(
        String(p.spacingMode || p.spacing_mode || 'EQUAL').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'EQUAL'
    );
    const [sectionWidths, setSectionWidths] = useState<number[]>(() => readSectionsFromParams(p));

    useEffect(() => {
        const gp = container?.generatorParams || {};
        setCount(Math.min(MAX_DIVIDERS, gp.count ?? gp.dividerCount ?? 2));
        setSpacingMode(String(gp.spacingMode || gp.spacing_mode || 'EQUAL').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'EQUAL');
        setSectionWidths(readSectionsFromParams(gp));
    }, [container?.id]);

    const dims = {
        width: dimToMm(container?.width) || 600,
        height: dimToMm(container?.height) || 720,
        depth: dimToMm(container?.depth) || 500
    };

    const pushUpdate = (patch: Record<string, any>) => {
        triggerUpdate({
            count,
            dividerCount: count,
            spacingMode,
            spacing_mode: spacingMode,
            sectionWidths,
            ...patch
        });
    };

    const layout = resolveDividerLayout({
        count,
        spacingMode,
        sectionWidths,
        thickness: 18
    }, dims);

    return (
        <div className="submodule-box" style={{ background: '#222225', padding: '10px', borderRadius: '4px', border: '1px solid #2d2d30', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={rowStyle}>
                <span style={labelStyle}>Ilość przegród:</span>
                <SmartNumericInput
                    value={count}
                    min={0} max={MAX_DIVIDERS} step={1}
                    style={{ ...inputStyle, width: '120px' }}
                    onChange={(val) => {
                        const n = Math.max(0, Math.min(MAX_DIVIDERS, Math.round(val)));
                        setCount(n);
                        pushUpdate({ count: n, dividerCount: n });
                    }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={labelStyle}>Rozstaw:</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {([
                        ['EQUAL', 'Równy'],
                        ['CUSTOM', 'Własny']
                    ] as const).map(([id, label]) => (
                        <label key={id} style={{ color: '#e4e4e7', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                                type="radio"
                                name="dividerSpacing"
                                checked={spacingMode === id}
                                onChange={() => {
                                    let nextSections = sectionWidths;
                                    if (id === 'CUSTOM' && spacingMode !== 'CUSTOM') {
                                        const eq = equalBayWidth(dims.width, count, 18);
                                        nextSections = emptySections().map((_, i) => (i < count ? eq : 200));
                                        setSectionWidths(nextSections);
                                    }
                                    setSpacingMode(id);
                                    pushUpdate({
                                        spacingMode: id,
                                        spacing_mode: id,
                                        ...(id === 'CUSTOM' ? { sectionWidths: nextSections } : {})
                                    });
                                }}
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>

            {spacingMode === 'CUSTOM' && count > 0 && (
                <div style={{ background: '#1c1c1f', border: '1px solid #2d2d30', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#93c5fd' }}>Szerokości wnęk (przed przegrodą)</div>
                    {Array.from({ length: count }).map((_, i) => (
                        <div key={i} style={rowStyle}>
                            <span style={{ ...labelStyle, fontSize: '11px' }}>Wnęka {i + 1}:</span>
                            <SmartNumericInput
                                value={sectionWidths[i] ?? 200}
                                min={10} step={1} unit="mm"
                                style={{ ...inputStyle, width: '80px', fontSize: '11px' }}
                                onChange={(val) => {
                                    const next = [...sectionWidths];
                                    next[i] = toNum(val, 200);
                                    setSectionWidths(next);
                                    pushUpdate({ sectionWidths: next });
                                }}
                            />
                        </div>
                    ))}
                    <div
                        style={rowStyle}
                        title={layout.lastBayOutOfPanel ? 'Ostatnia wnęka wynika z szerokości SmartBoxa — bez edycji. Wartość ujemna / zbyt mała: wnęki nie mieszczą się w korpusie.' : 'Ostatnia wnęka wynika z szerokości SmartBoxa — bez edycji.'}
                    >
                        <span style={{ ...labelStyle, fontSize: '11px' }}>Wnęka {count + 1}:</span>
                        <SmartNumericInput
                            value={Math.round(layout.lastBay)}
                            step={1} unit="mm"
                            readOnly
                            style={{
                                ...inputStyle,
                                width: '80px',
                                fontSize: '11px',
                                color: layout.lastBayOutOfPanel ? '#f87171' : '#fff',
                                borderColor: layout.lastBayOutOfPanel ? '#7f1d1d' : '#3f3f46',
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
