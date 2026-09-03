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
    const v = offsets?.[paramName];
    if (v !== undefined && v !== null && !Number.isNaN(Number(v))) return Number(v);
    if (isBackPanelEdgeParam(paramName, role)) return defaultBackOverlapMm(rules);
    return 0;
}

export function readBackEdgeOffset(
    offsets: Record<string, number> | undefined,
    panelName: string,
    suffix: '+X' | '-X' | '+Y' | '-Y',
    defaultMm: number = defaultBackOverlapMm()
): number {
    const v = offsets?.[`${panelName}_${suffix}`];
    if (v !== undefined && v !== null && !Number.isNaN(Number(v))) return Number(v);
    return defaultMm;
}
