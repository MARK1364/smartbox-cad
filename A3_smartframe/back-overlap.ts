/**
 * Zakładka pleców — JSON (metry). UI/gizmo: mm. Silnik: nm.
 */

import korpusRules from './korpus3_3_rules.json';
import { rulesMToMm, rulesMToNm } from '../A1_core/cad-math/units.js';

const BACK_EDGE_SUFFIX = /_(?:\+X|-X|\+Y|-Y)$/;

export function defaultBackOverlapMm(rules: any = korpusRules): number {
    const raw = rules?.cabinet_construction_rules?.defaults?.back_groove_depth;
    if (raw === undefined || raw === null) return rulesMToMm(0.011);
    return rulesMToMm(raw);
}

/**
 * Domyślna zakładka krawędzi pleców.
 * Rogowy90: 11 mm przy wieńcach/bokach, 0 tylko na styku dwóch pleców w narożniku.
 */
export function defaultBackEdgeOverlapMm(
    paramName: string,
    cabinetType?: string,
    rules?: any
): number {
    const base = defaultBackOverlapMm(rules);
    const t = String(cabinetType || '').toLowerCase();
    if (!t.includes('rogowy90') && !t.includes('rogowy_90')) return base;

    const m = String(paramName || '').match(/_(\+X|-X|\+Y|-Y)$/i);
    if (!m) return base;
    const suf = m[1] as '+X' | '-X' | '+Y' | '-Y';
    const name = String(paramName).replace(/_(\+X|-X|\+Y|-Y)$/i, '').toUpperCase();

    // Narożnik styku PLECY_Y (−X) ↔ PLECY_X (+X w LCS płyty = tył korpusu)
    if ((name.includes('PLECY_Y') || name.includes('BACK_Y')) && suf === '-X') return 0;
    if ((name.includes('PLECY_X') || name.includes('BACK_X')) && suf === '+X') return 0;
    return base;
}

/** @deprecated Użyj defaultBackEdgeOverlapMm — zostawione dla kompatybilności. */
export function defaultBackOverlapForCabinetMm(cabinetType?: string, rules?: any): number {
    return defaultBackOverlapMm(rules);
}

export function defaultBackOverlapNm(rules: any = korpusRules): number {
    const raw = rules?.cabinet_construction_rules?.defaults?.back_groove_depth;
    if (raw === undefined || raw === null) return rulesMToNm(0.011);
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
    rules?: any,
    cabinetType?: string
): number {
    const def = defaultBackEdgeOverlapMm(paramName, cabinetType, rules);
    if (offsets) {
        const v = offsets[paramName];
        if (v !== undefined && v !== null && !Number.isNaN(Number(v))) return Number(v);

        if (role === 'BACK_PANEL' || paramName.toLowerCase().includes('plecy') || paramName.toLowerCase().includes('back')) {
            const m = paramName.match(/_(\+X|-X|\+Y|-Y)$/);
            if (m) {
                const suffix = m[1] as '+X' | '-X' | '+Y' | '-Y';
                const baseName = paramName.replace(/_(\+X|-X|\+Y|-Y)$/, '');
                return readBackEdgeOffset(offsets, baseName, suffix, def);
            }
        }
    }
    if (isBackPanelEdgeParam(paramName, role)) return def;
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

    const findInOffsets = (key: string): number | undefined => {
        if (offsets[key] !== undefined && offsets[key] !== null && !Number.isNaN(Number(offsets[key]))) {
            return Number(offsets[key]);
        }
        const keyUpper = key.toUpperCase();
        for (const [k, v] of Object.entries(offsets)) {
            if (k.toUpperCase() === keyUpper && v !== undefined && v !== null && !Number.isNaN(Number(v))) {
                return Number(v);
            }
        }
        return undefined;
    };

    // 1. Dokładny klucz (np. "Dol_Plecy_-X", "Srodek_Plecy_-X", "Plecy_-X")
    const val1 = findInOffsets(`${panelName}_${suffix}`);
    if (val1 !== undefined) return val1;

    // 1b. Klucz bez prefiksu strefy (np. "PLECY_Y_-X" dla "Dol_Plecy_Y" lub "B_PLECY_Y")
    const cleanName = panelName.replace(/^(?:Dol_|Gora_|Srodek_|B_|M_|T_)/i, '');
    const val1b = findInOffsets(`${cleanName}_${suffix}`);
    if (val1b !== undefined) return val1b;

    const nameUpper = (panelName || '').toUpperCase();
    const pfxUpper = (zonePrefix || '').toUpperCase();

    // 2. Strefa Środkowa (M / Srodek) — izolacja strefy M
    if (pfxUpper.startsWith('M') || nameUpper.startsWith('M_') || nameUpper.startsWith('SRODEK')) {
        const candidates = [`Srodek_Plecy_${suffix}`, `M_Plecy_${suffix}`, `M_BACK_${suffix}`];
        for (const k of candidates) {
            const v = findInOffsets(k);
            if (v !== undefined) return v;
        }
        return defaultMm;
    }

    // 3. Strefa Górna (T / Gora) — izolacja strefy T
    if (pfxUpper.startsWith('T') || nameUpper.startsWith('T_') || nameUpper.startsWith('GORA')) {
        const candidates = [`Gora_Plecy_${suffix}`, `T_Plecy_${suffix}`, `T_BACK_${suffix}`];
        for (const k of candidates) {
            const v = findInOffsets(k);
            if (v !== undefined) return v;
        }
        return defaultMm;
    }

    // 4. Strefa Dolna (B / Dol)
    const bCandidates = [`Dol_Plecy_${suffix}`, `B_Plecy_${suffix}`, `B_BACK_${suffix}`];
    for (const k of bCandidates) {
        const v = findInOffsets(k);
        if (v !== undefined) return v;
    }

    // 5. Ogólne aliasy dla 1-strefowego korpusu (np. "Plecy_-X", "BACK_PANEL_-X")
    const singleZoneAliases = [`Plecy_${suffix}`, `BACK_PANEL_${suffix}`, `BACK_${suffix}`];
    for (const k of singleZoneAliases) {
        const v = findInOffsets(k);
        if (v !== undefined) return v;
    }

    return defaultMm;
}
