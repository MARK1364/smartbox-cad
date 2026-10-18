/**
 * Wspólny filtr producenta zawiasów (drzwi / klapy).
 * Na dziś aktywny tylko Blum — pozostałe opcje wyszarzane.
 */
import React from 'react';
import {
    DEFAULT_HINGE_BRAND,
    HINGE_BRAND_OPTIONS,
    hingeListLabel,
    listHingesByBrand,
    resolveHingeBrand,
    type HingeCatalogScope,
    type HardwareItem
} from '../B1_biblioteka/index.js';

export { DEFAULT_HINGE_BRAND, hingeListLabel, listHingesByBrand, resolveHingeBrand };
export type { HingeCatalogScope };

const selectStyle: React.CSSProperties = {
    padding: '2px 4px',
    background: '#18181b',
    border: '1px solid #3f3f46',
    color: '#fff',
    borderRadius: '3px',
    fontSize: '11px'
};

export function HingeBrandFilter(props: {
    value: string;
    label: string;
    onChange: (brand: string) => void;
    style?: React.CSSProperties;
}): React.ReactElement {
    const brand = resolveHingeBrand(props.value);
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', ...(props.style || {}) }}>
            <span style={{ color: '#d4d4d8', fontSize: '11px', flexShrink: 0 }}>{props.label}</span>
            <select
                value={brand}
                onChange={(e) => {
                    const next = resolveHingeBrand(e.target.value);
                    if (next !== brand) props.onChange(next);
                }}
                style={{ ...selectStyle, width: '140px', flexShrink: 0 }}
            >
                {HINGE_BRAND_OPTIONS.map((b) => (
                    <option key={b.id} value={b.id} disabled={!b.enabled} style={{ color: b.enabled ? undefined : '#71717a' }}>
                        {b.enabled ? b.id : `${b.id} — wkrótce`}
                    </option>
                ))}
            </select>
        </div>
    );
}

export function hingeOptionsForBrand(brand: string, scope: HingeCatalogScope): HardwareItem[] {
    return listHingesByBrand(resolveHingeBrand(brand), scope);
}

export function firstHingeIdForBrand(brand: string, scope: HingeCatalogScope, fallbackId: string): string {
    const list = hingeOptionsForBrand(brand, scope);
    return list[0]?.id || fallbackId;
}

export function renderHingeSelectOptions(brand: string, scope: HingeCatalogScope): React.ReactNode {
    return hingeOptionsForBrand(brand, scope).map((hw) => (
        <option key={hw.id} value={hw.id}>
            {hingeListLabel(hw)}
        </option>
    ));
}
