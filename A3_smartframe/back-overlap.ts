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
            const kUpper = k.toUpperCase();
            const cleanKUpper = kUpper.replace(/\.\d+(_[+-][XY])$/, '$1').replace(/_\d+(_[+-][XY])$/, '$1');
            const cleanKeyUpper = keyUpper.replace(/\.\d+(_[+-][XY])$/, '$1').replace(/_\d+(_[+-][XY])$/, '$1');
            if ((kUpper === keyUpper || cleanKUpper === keyUpper || kUpper === cleanKeyUpper || cleanKUpper === cleanKeyUpper) && v !== undefined && v !== null && !Number.isNaN(Number(v))) {
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
        return defaultMm + readSurroundingPanelInwardShiftMm(offsets, suffix, 'M_', panelName);
    }

    // 3. Strefa Górna (T / Gora) — izolacja strefy T
    if (pfxUpper.startsWith('T') || nameUpper.startsWith('T_') || nameUpper.startsWith('GORA')) {
        const candidates = [`Gora_Plecy_${suffix}`, `T_Plecy_${suffix}`, `T_BACK_${suffix}`];
        for (const k of candidates) {
            const v = findInOffsets(k);
            if (v !== undefined) return v;
        }
        return defaultMm + readSurroundingPanelInwardShiftMm(offsets, suffix, 'T_', panelName);
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

    return defaultMm + readSurroundingPanelInwardShiftMm(offsets, suffix, zonePrefix, panelName);
}

/**
 * Zwraca przesunięcie sąsiadującej formatki (wieńca dolnego, górnego, boku lewego lub prawego)
 * DO ŚRODKA wnęki korpusu [mm] dla danej krawędzi pleców:
 *  - `-Y` (dół pleców ↔ Wieniec_D): wieniec ma `loc.z = T/2 - shiftZ`, więc ruch w górę (+Z) to `-shiftZ`
 *  - `+Y` (góra pleców ↔ Wieniec_G): wieniec ma `loc.z = H - T/2 + shiftZ`, więc ruch w dół (-Z) to `-shiftZ`
 *  - `-X` (lewo pleców ↔ Bok_L): bok ma `loc.x = -W/2 + T/2 - shiftX`, więc ruch w prawo (+X) to `-shiftX`
 *  - `+X` (prawo pleców ↔ Bok_P): bok ma `loc.x = W/2 - T/2 + shiftX`, więc ruch w lewo (-X) to `-shiftX`
 */
export function readSurroundingPanelInwardShiftMm(
    offsets: Record<string, number> | undefined,
    suffix: '+X' | '-X' | '+Y' | '-Y',
    zonePrefix?: string,
    panelName?: string
): number {
    if (!offsets) return 0;

    const nameUpper = String(panelName || '').toUpperCase();
    // W korpusie narożnym 90° krawędzie boczne PLECY_X / PLECY_Y mają własną semantykę styku w narożniku
    if ((nameUpper.includes('PLECY_X') || nameUpper.includes('BACK_X') || nameUpper.includes('PLECY_Y') || nameUpper.includes('BACK_Y')) &&
        (suffix === '-X' || suffix === '+X')) {
        return 0;
    }

    const findInOffsets = (key: string): number | undefined => {
        if (offsets[key] !== undefined && offsets[key] !== null && !Number.isNaN(Number(offsets[key]))) {
            return Number(offsets[key]);
        }
        const keyUpper = key.toUpperCase();
        for (const [k, v] of Object.entries(offsets)) {
            const kUpper = k.toUpperCase();
            const cleanKUpper = kUpper.replace(/\.\d+(_[+-][XY])$/, '$1').replace(/_\d+(_[+-][XY])$/, '$1');
            const cleanKeyUpper = keyUpper.replace(/\.\d+(_[+-][XY])$/, '$1').replace(/_\d+(_[+-][XY])$/, '$1');
            if ((kUpper === keyUpper || cleanKUpper === keyUpper || kUpper === cleanKeyUpper || cleanKUpper === cleanKeyUpper) && v !== undefined && v !== null && !Number.isNaN(Number(v))) {
                return Number(v);
            }
        }
        return undefined;
    };

    const pfxUpper = String(zonePrefix || '').toUpperCase();
    const isZoneM = pfxUpper.startsWith('M') || nameUpper.startsWith('M_') || nameUpper.startsWith('SRODEK');
    const isZoneT = pfxUpper.startsWith('T') || nameUpper.startsWith('T_') || nameUpper.startsWith('GORA');

    const buildZoneKeys = (stems: string[], shiftSuffix: 'shiftZ' | 'shiftX'): string[] => {
        if (isZoneM) {
            return stems.flatMap(s => [`Srodek_${s}_${shiftSuffix}`, `M_${s}_${shiftSuffix}`]);
        }
        if (isZoneT) {
            return stems.flatMap(s => [`Gora_${s}_${shiftSuffix}`, `T_${s}_${shiftSuffix}`]);
        }
        return [
            ...stems.flatMap(s => [`Dol_${s}_${shiftSuffix}`, `B_${s}_${shiftSuffix}`]),
            ...stems.map(s => `${s}_${shiftSuffix}`)
        ];
    };

    if (suffix === '-Y') {
        const keys = buildZoneKeys(['Wieniec_D', 'WIENIEC_D', 'BOTTOM_PANEL', 'BOTTOM'], 'shiftZ');
        for (const k of keys) {
            const v = findInOffsets(k);
            if (v !== undefined) return -v;
        }
        return 0;
    }
    if (suffix === '+Y') {
        const keys = buildZoneKeys(['Wieniec_G', 'WIENIEC_G', 'TOP_PANEL', 'TOP'], 'shiftZ');
        for (const k of keys) {
            const v = findInOffsets(k);
            if (v !== undefined) return -v;
        }
        return 0;
    }
    if (suffix === '-X') {
        const keys = buildZoneKeys(['Bok_L', 'BOK_L', 'LEFT_SIDE_PANEL', 'SIDE_LEFT'], 'shiftX');
        for (const k of keys) {
            const v = findInOffsets(k);
            if (v !== undefined) return -v;
        }
        return 0;
    }
    if (suffix === '+X') {
        const keys = buildZoneKeys(['Bok_P', 'BOK_P', 'RIGHT_SIDE_PANEL', 'SIDE_RIGHT'], 'shiftX');
        for (const k of keys) {
            const v = findInOffsets(k);
            if (v !== undefined) return -v;
        }
        return 0;
    }
    return 0;
}

function matchPanelShiftToBackEdge(paramName: string): {
    suffix: '+X' | '-X' | '+Y' | '-Y';
    zonePrefix: '' | 'B_' | 'M_' | 'T_';
    backPanelName: string;
} | null {
    if (!paramName) return null;
    const m = paramName.match(/^(?:(Dol_|B_|Srodek_|M_|Gora_|T_))?(.+)_(shiftZ|shiftX)$/i);
    if (!m) return null;

    const rawPfx = (m[1] || '').toUpperCase();
    const stem = (m[2] || '').toUpperCase().replace(/\.\d+$/, '').replace(/_\d+$/, '');
    const shiftKind = (m[3] || '');

    let zonePrefix: '' | 'B_' | 'M_' | 'T_' = '';
    let backPanelName = 'Plecy';
    if (rawPfx === 'M_' || rawPfx === 'SRODEK_') {
        zonePrefix = 'M_';
        backPanelName = 'Srodek_Plecy';
    } else if (rawPfx === 'T_' || rawPfx === 'GORA_') {
        zonePrefix = 'T_';
        backPanelName = 'Gora_Plecy';
    } else if (rawPfx === 'B_' || rawPfx === 'DOL_') {
        zonePrefix = 'B_';
        backPanelName = 'Dol_Plecy';
    }

    if (shiftKind.toLowerCase() === 'shiftz') {
        if (stem === 'WIENIEC_D' || stem === 'BOTTOM_PANEL' || stem === 'BOTTOM') {
            return { suffix: '-Y', zonePrefix, backPanelName };
        }
        if (stem === 'WIENIEC_G' || stem === 'TOP_PANEL' || stem === 'TOP') {
            return { suffix: '+Y', zonePrefix, backPanelName };
        }
    } else if (shiftKind.toLowerCase() === 'shiftx') {
        if (stem === 'BOK_L' || stem === 'LEFT_SIDE_PANEL' || stem === 'SIDE_LEFT') {
            return { suffix: '-X', zonePrefix, backPanelName };
        }
        if (stem === 'BOK_P' || stem === 'RIGHT_SIDE_PANEL' || stem === 'SIDE_RIGHT') {
            return { suffix: '+X', zonePrefix, backPanelName };
        }
    }
    return null;
}

/**
 * Zapisuje offset w `offsets` i jeśli zmieniany parametr jest przesunięciem (shiftZ/shiftX)
 * wieńca lub boku, automatycznie przelicza odpowiadający margines pleców (`Plecy_-Y`, `+Y`, `-X`, `+X`),
 * tak aby plecy zachowały swoją fizyczną długość w przestrzeni i docięły przesuniętą formatkę.
 */
export function applyKorpusOffsetWithBackMarginSync(
    offsets: Record<string, number>,
    paramName: string,
    newValue: number,
    rules?: any,
    cabinetType?: string
): void {
    const match = matchPanelShiftToBackEdge(paramName);
    if (!match) {
        offsets[paramName] = newValue;
        return;
    }

    const { suffix, zonePrefix, backPanelName } = match;
    const defMm = defaultBackEdgeOverlapMm(`${backPanelName}_${suffix}`, cabinetType, rules);
    const oldInward = readSurroundingPanelInwardShiftMm(offsets, suffix, zonePrefix, backPanelName);
    const oldOverlap = readBackEdgeOffset(offsets, backPanelName, suffix, defMm, zonePrefix);

    offsets[paramName] = newValue;

    const newInward = readSurroundingPanelInwardShiftMm(offsets, suffix, zonePrefix, backPanelName);
    const deltaInward = newInward - oldInward;
    if (Math.abs(deltaInward) <= 1e-9) return;

    const newOverlap = Math.round((oldOverlap + deltaInward) * 100) / 100;

    // Aktualizuj istniejące klucze tej krawędzi pleców w danej strefie, jeśli były już zapisane
    const targetCandidates = zonePrefix === 'M_'
        ? [`Srodek_Plecy_${suffix}`, `M_Plecy_${suffix}`, `M_BACK_${suffix}`]
        : zonePrefix === 'T_'
        ? [`Gora_Plecy_${suffix}`, `T_Plecy_${suffix}`, `T_BACK_${suffix}`]
        : [
            `Dol_Plecy_${suffix}`, `B_Plecy_${suffix}`, `B_BACK_${suffix}`,
            `Plecy_${suffix}`, `BACK_PANEL_${suffix}`, `BACK_${suffix}`,
            ...(suffix === '-Y' || suffix === '+Y'
                ? [`PLECY_Y_${suffix}`, `B_PLECY_Y_${suffix}`, `Dol_Plecy_Y_${suffix}`, `PLECY_X_${suffix}`, `B_PLECY_X_${suffix}`, `Dol_Plecy_X_${suffix}`]
                : [])
        ];

    let updatedAny = false;
    for (const existingKey of Object.keys(offsets)) {
        if (targetCandidates.some(c => c.toUpperCase() === existingKey.toUpperCase())) {
            offsets[existingKey] = newOverlap;
            updatedAny = true;
        }
    }
    if (!updatedAny) {
        offsets[`${backPanelName}_${suffix}`] = newOverlap;
        const isRogowy90 = String(cabinetType || '').toLowerCase().includes('rogowy90') || String(cabinetType || '').toLowerCase().includes('rogowy_90');
        if (isRogowy90 && (suffix === '-Y' || suffix === '+Y')) {
            offsets[`PLECY_Y_${suffix}`] = newOverlap;
            offsets[`PLECY_X_${suffix}`] = newOverlap;
        }
    }
}
