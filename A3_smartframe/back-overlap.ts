/**
 * Zakładka pleców — JSON (metry). UI/gizmo: mm. Silnik: nm.
 */

import korpusRules from './korpus3_3_rules.json';
import { rulesMToMm, rulesMToNm } from '../A1_core/cad-math/units.js';

const BACK_EDGE_SUFFIX = /_(?:\+X|-X|\+Y|-Y)$/;

export function defaultBackOverlapMm(rules: any = korpusRules): number {
    const raw = rules?.cabinet_construction_rules?.defaults?.back_groove_depth;
    return rulesMToMm(raw);
}

export function defaultBackOverlapNm(rules: any = korpusRules): number {
    const raw = rules?.cabinet_construction_rules?.defaults?.back_groove_depth;
    return rulesMToNm(raw);
}

export function isBackPanelEdgeParam(paramName: string, role?: string): boolean {
    if (role !== 'BACK_PANEL' || !paramName || paramName.includes('shift')) return false;
    return BACK_EDGE_SUFFIX.test(paramName);
}

export function readOffsetMm(
    offsets: Record<string, number> | undefined,
    paramName: string,
    role?: string,
    rules?: any
): number {
    if (offsets) {
        const v = offsets[paramName];
        if (v !== undefined && v !== null && !Number.isNaN(Number(v))) return Number(v);

        if (role === 'BACK_PANEL' || paramName.toLowerCase().includes('plecy') || paramName.toLowerCase().includes('back')) {
            const m = paramName.match(/_(\+X|-X|\+Y|-Y)$/);
            if (m) {
                const suffix = m[1] as '+X' | '-X' | '+Y' | '-Y';
                const baseName = paramName.replace(/_(\+X|-X|\+Y|-Y)$/, '');
                return readBackEdgeOffset(offsets, baseName, suffix, defaultBackOverlapMm(rules));
            }
        }
    }
    if (isBackPanelEdgeParam(paramName, role)) return defaultBackOverlapMm(rules);
    return 0;
}

export function readBackEdgeOffset(
    offsets: Record<string, number> | undefined,
    panelName: string,
    suffix: '+X' | '-X' | '+Y' | '-Y',
    defaultMm: number = defaultBackOverlapMm(),
    zonePrefix?: string
): number {
    if (!offsets) return defaultMm;

    // 1. Dokładny klucz (np. "Dol_Plecy_-X", "Srodek_Plecy_-X", "Plecy_-X")
    const directKey = `${panelName}_${suffix}`;
    if (offsets[directKey] !== undefined && offsets[directKey] !== null && !Number.isNaN(Number(offsets[directKey]))) {
        return Number(offsets[directKey]);
    }

    const nameUpper = (panelName || '').toUpperCase();
    const pfxUpper = (zonePrefix || '').toUpperCase();

    // 2. Strefa Środkowa (M / Srodek) — izolacja strefy M
    if (pfxUpper.startsWith('M') || nameUpper.startsWith('M_') || nameUpper.startsWith('SRODEK')) {
        const candidates = [`Srodek_Plecy_${suffix}`, `M_Plecy_${suffix}`, `M_BACK_${suffix}`];
        for (const k of candidates) {
            if (offsets[k] !== undefined && offsets[k] !== null && !Number.isNaN(Number(offsets[k]))) {
                return Number(offsets[k]);
            }
        }
        return defaultMm;
    }

    // 3. Strefa Górna (T / Gora) — izolacja strefy T
    if (pfxUpper.startsWith('T') || nameUpper.startsWith('T_') || nameUpper.startsWith('GORA')) {
        const candidates = [`Gora_Plecy_${suffix}`, `T_Plecy_${suffix}`, `T_BACK_${suffix}`];
        for (const k of candidates) {
            if (offsets[k] !== undefined && offsets[k] !== null && !Number.isNaN(Number(offsets[k]))) {
                return Number(offsets[k]);
            }
        }
        return defaultMm;
    }

    // 4. Strefa Dolna (B / Dol)
    const bCandidates = [`Dol_Plecy_${suffix}`, `B_Plecy_${suffix}`, `B_BACK_${suffix}`];
    for (const k of bCandidates) {
        if (offsets[k] !== undefined && offsets[k] !== null && !Number.isNaN(Number(offsets[k]))) {
            return Number(offsets[k]);
        }
    }

    // 5. Ogólne aliasy dla 1-strefowego korpusu (np. "Plecy_-X", "BACK_PANEL_-X")
    const singleZoneAliases = [`Plecy_${suffix}`, `BACK_PANEL_${suffix}`, `BACK_${suffix}`];
    for (const k of singleZoneAliases) {
        if (offsets[k] !== undefined && offsets[k] !== null && !Number.isNaN(Number(offsets[k]))) {
            return Number(offsets[k]);
        }
    }

    return defaultMm;
}
