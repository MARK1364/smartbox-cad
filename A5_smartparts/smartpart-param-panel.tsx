/**
 * A5_smartparts — smartpart-param-panel.tsx
 * Ogólny panel edycji SmartParta generowany z `parameters` pakietu JSON.
 *
 * Komponent jest czysto prezentacyjny (kontrolowany): nie dotyka sceny ani dokumentu.
 * Zmianę wartości zgłasza przez `onChange`; przeliczenie geometrii robi
 * `resolveSmartPartParams` (studio/smartpart-params.ts) po stronie wywołującego.
 *
 * Typy: `number` (mm), `list`, `check` (boolean / zamrożenie).
 */

import React from 'react';
import type { SmartPartParameter, SmartPartParamValues } from '../S5_studio/index.js';
import './smartparts-ui.css';

export interface SmartPartParamPanelProps {
    parameters: SmartPartParameter[];
    values: SmartPartParamValues;
    onChange: (next: SmartPartParamValues) => void;
}

function clampToParam(
    p: Extract<SmartPartParameter, { type: 'number' }>,
    v: number,
): number {
    let x = Number.isFinite(v) ? v : p.default_mm;
    if (p.min_mm !== undefined) x = Math.max(p.min_mm, x);
    if (p.max_mm !== undefined) x = Math.min(p.max_mm, x);
    return x;
}

export function SmartPartParamPanel({
    parameters,
    values,
    onChange,
}: SmartPartParamPanelProps): React.JSX.Element | null {
    if (!parameters || parameters.length === 0) return null;

    const set = (key: string, value: number | string | boolean) =>
        onChange({ ...values, [key]: value });

    return (
        <div className="smartparts-edit-compact">
            {parameters.map((p) => {
                const label = p.label || p.key;
                if (p.type === 'list') {
                    const current = String(values[p.key] ?? p.default);
                    return (
                        <div key={p.key} className="smartparts-edit-row">
                            <span className="smartparts-edit-label">{label}</span>
                            <select
                                className="smartparts-edit-select"
                                value={current}
                                onChange={(e) => set(p.key, e.target.value)}
                            >
                                {p.options.map((o) => (
                                    <option key={o.key} value={o.key}>{o.label || o.key}</option>
                                ))}
                            </select>
                        </div>
                    );
                }
                if (p.type === 'check') {
                    const checked = values[p.key] === true || (values[p.key] === undefined && p.default === true);
                    return (
                        <div key={p.key} className="smartparts-edit-row">
                            <span className="smartparts-edit-label">{label}</span>
                            <input
                                type="checkbox"
                                className="smartparts-edit-check"
                                checked={checked}
                                onChange={(e) => set(p.key, e.target.checked)}
                            />
                        </div>
                    );
                }
                const num = Number(values[p.key] ?? p.default_mm);
                return (
                    <div key={p.key} className="smartparts-edit-row">
                        <span className="smartparts-edit-label">{label}</span>
                        <input
                            type="number"
                            className="smartparts-edit-num"
                            min={p.min_mm}
                            max={p.max_mm}
                            step={1}
                            value={num}
                            onChange={(e) => set(p.key, clampToParam(p, parseFloat(e.target.value)))}
                        />
                        <span className="smartparts-edit-unit">mm</span>
                    </div>
                );
            })}
        </div>
    );
}
