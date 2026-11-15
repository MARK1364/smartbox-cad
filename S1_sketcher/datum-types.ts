/**
 * S1_sketcher — datum-types.ts
 *
 * Modele domenowe dla Układu Globalnego (GLC - Global Layout Coordinates),
 * poziomów wysokości (Datum Levels / Sfery Z) oraz płaszczyzn odniesienia.
 *
 * Jednostki:
 * - Wartości domenowe (SSOT): nm (nanometry, np. z_nm)
 * - Wartości pomocnicze UI: mm (np. z_mm)
 */

import { mmToNm } from '../A1_core/cad-math/units.js';

export interface LevelColorTheme {
    name: string;
    hex: string;
    sphereDiffuse: { r: number; g: number; b: number };
    sphereEmissive: { r: number; g: number; b: number };
    planeDiffuse: { r: number; g: number; b: number };
    planeEmissive: { r: number; g: number; b: number };
    edgeColor: { r: number; g: number; b: number; a: number };
}

export const LEVEL_COLOR_THEMES: LevelColorTheme[] = [
    {
        name: 'Błękit / Lazur',
        hex: '#38bdf8',
        sphereDiffuse: { r: 0.14, g: 0.74, b: 0.98 },
        sphereEmissive: { r: 0.08, g: 0.45, b: 0.70 },
        planeDiffuse: { r: 0.14, g: 0.74, b: 0.98 },
        planeEmissive: { r: 0.02, g: 0.12, b: 0.22 },
        edgeColor: { r: 0.14, g: 0.74, b: 0.98, a: 0.65 },
    },
    {
        name: 'Bursztyn / Pomarańcz',
        hex: '#fb923c',
        sphereDiffuse: { r: 0.98, g: 0.55, b: 0.12 },
        sphereEmissive: { r: 0.65, g: 0.30, b: 0.05 },
        planeDiffuse: { r: 0.98, g: 0.55, b: 0.12 },
        planeEmissive: { r: 0.22, g: 0.10, b: 0.02 },
        edgeColor: { r: 0.98, g: 0.55, b: 0.12, a: 0.65 },
    },
    {
        name: 'Szmaragd / Zieleń',
        hex: '#34d399',
        sphereDiffuse: { r: 0.16, g: 0.82, b: 0.48 },
        sphereEmissive: { r: 0.08, g: 0.50, b: 0.25 },
        planeDiffuse: { r: 0.16, g: 0.82, b: 0.48 },
        planeEmissive: { r: 0.02, g: 0.18, b: 0.08 },
        edgeColor: { r: 0.16, g: 0.82, b: 0.48, a: 0.65 },
    },
    {
        name: 'Fiolet / Purpura',
        hex: '#c084fc',
        sphereDiffuse: { r: 0.72, g: 0.38, b: 0.98 },
        sphereEmissive: { r: 0.45, g: 0.18, b: 0.68 },
        planeDiffuse: { r: 0.72, g: 0.38, b: 0.98 },
        planeEmissive: { r: 0.15, g: 0.05, b: 0.22 },
        edgeColor: { r: 0.72, g: 0.38, b: 0.98, a: 0.65 },
    },
    {
        name: 'Koral / Róż CAD',
        hex: '#fb7185',
        sphereDiffuse: { r: 0.96, g: 0.28, b: 0.45 },
        sphereEmissive: { r: 0.60, g: 0.12, b: 0.25 },
        planeDiffuse: { r: 0.96, g: 0.28, b: 0.45 },
        planeEmissive: { r: 0.20, g: 0.03, b: 0.08 },
        edgeColor: { r: 0.96, g: 0.28, b: 0.45, a: 0.65 },
    },
    {
        name: 'Złoto / Żółty CAD',
        hex: '#facc15',
        sphereDiffuse: { r: 0.95, g: 0.82, b: 0.15 },
        sphereEmissive: { r: 0.58, g: 0.48, b: 0.06 },
        planeDiffuse: { r: 0.95, g: 0.82, b: 0.15 },
        planeEmissive: { r: 0.20, g: 0.16, b: 0.02 },
        edgeColor: { r: 0.95, g: 0.82, b: 0.15, a: 0.65 },
    },
    {
        name: 'Indygo / Błękit królewski',
        hex: '#818cf8',
        sphereDiffuse: { r: 0.38, g: 0.52, b: 0.98 },
        sphereEmissive: { r: 0.20, g: 0.30, b: 0.65 },
        planeDiffuse: { r: 0.38, g: 0.52, b: 0.98 },
        planeEmissive: { r: 0.06, g: 0.10, b: 0.22 },
        edgeColor: { r: 0.38, g: 0.52, b: 0.98, a: 0.65 },
    },
    {
        name: 'Teal / Morski',
        hex: '#2dd4bf',
        sphereDiffuse: { r: 0.12, g: 0.85, b: 0.82 },
        sphereEmissive: { r: 0.06, g: 0.52, b: 0.50 },
        planeDiffuse: { r: 0.12, g: 0.85, b: 0.82 },
        planeEmissive: { r: 0.02, g: 0.18, b: 0.17 },
        edgeColor: { r: 0.12, g: 0.85, b: 0.82, a: 0.65 },
    },
];

export function getLevelColorTheme(index: number, hexOverride?: string): LevelColorTheme {
    if (hexOverride) {
        const found = LEVEL_COLOR_THEMES.find(t => t.hex.toLowerCase() === hexOverride.toLowerCase());
        if (found) return found;
    }
    const idx = Math.abs(index) % LEVEL_COLOR_THEMES.length;
    return LEVEL_COLOR_THEMES[idx];
}

export class DatumLevelModel {
    id: string;
    name: string;
    readonly type = 'datum_level';
    z_nm: number;
    isLocked: boolean;
    visiblePlane: boolean;
    visible: boolean;
    color?: string;
    isDefault?: boolean;

    constructor(data: { id: string; name: string; z_nm: number; isLocked?: boolean; visiblePlane?: boolean; visible?: boolean; color?: string; isDefault?: boolean }) {
        this.id = data.id;
        this.name = data.name;
        this.z_nm = data.z_nm;
        this.isLocked = !!data.isLocked;
        this.visiblePlane = Boolean(data.visiblePlane);
        this.visible = data.visible !== false;
        this.color = data.color;
        this.isDefault = Boolean(data.isDefault || data.id === 'datum_level_1' || data.id === 'datum_level_top');
    }

    static fromJSON(raw: any): DatumLevelModel {
        return new DatumLevelModel({
            id: raw.id,
            name: raw.name,
            z_nm: raw.z_nm,
            isLocked: raw.isLocked,
            visiblePlane: Boolean(raw.visiblePlane),
            visible: raw.visible !== false,
            color: raw.color,
            isDefault: Boolean(raw.isDefault || raw.id === 'datum_level_1' || raw.id === 'datum_level_top'),
        });
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            z_nm: this.z_nm,
            isLocked: this.isLocked,
            visiblePlane: this.visiblePlane,
            visible: this.visible,
            color: this.color,
            isDefault: this.isDefault,
        };
    }
}

export class GlcDomainModel {
    id: string;
    name: string;
    readonly type = 'glc_frame';
    showPlanes: boolean;
    showAxisZ: boolean;
    axisZHeight_nm: number;
    visible: boolean;
    isDefault?: boolean;

    constructor(data: { id: string; name: string; showPlanes?: boolean; showAxisZ?: boolean; axisZHeight_nm?: number; visible?: boolean; isDefault?: boolean }) {
        this.id = data.id;
        this.name = data.name;
        this.showPlanes = data.showPlanes !== false;
        this.showAxisZ = data.showAxisZ !== false;
        this.axisZHeight_nm = data.axisZHeight_nm ?? mmToNm(2500);
        this.visible = data.visible !== false;
        this.isDefault = Boolean(data.isDefault || data.id === 'glc_origin');
    }

    static fromJSON(raw: any): GlcDomainModel {
        return new GlcDomainModel({
            id: raw.id,
            name: raw.name,
            showPlanes: raw.showPlanes,
            showAxisZ: raw.showAxisZ,
            axisZHeight_nm: raw.axisZHeight_nm,
            visible: raw.visible !== false,
            isDefault: Boolean(raw.isDefault || raw.id === 'glc_origin'),
        });
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            showPlanes: this.showPlanes,
            showAxisZ: this.showAxisZ,
            axisZHeight_nm: this.axisZHeight_nm,
            visible: this.visible,
            isDefault: this.isDefault,
        };
    }
}

/**
 * Sprawdza, czy węzeł sceny lub model domenowy jest domyślnym elementem bazowym sceny
 * (Układ globalny GLC_FRAME / glc_origin, Płaszczyzna 1 datum_level_1, Góra osi Z datum_level_top).
 * Elementy te nie podlegają usunięciu przez użytkownika.
 */
export function isDefaultDatumNode(idOrNode: { id?: string; domainData?: any; isDefault?: boolean; nodeType?: string } | string | null | undefined): boolean {
    if (!idOrNode) return false;
    const id = typeof idOrNode === 'string' ? idOrNode : idOrNode.id;
    if (id === 'glc_origin' || id === 'datum_level_1' || id === 'datum_level_top') {
        return true;
    }
    if (typeof idOrNode === 'object') {
        if (idOrNode.isDefault) return true;
        if ((idOrNode as any).domainData?.isDefault) return true;
        if (idOrNode.nodeType === 'GLC_FRAME') return true;
    }
    return false;
}

/** Standardowy zestaw poziomów kuchennych (wysokości w mm) */
export interface KitchenLevelPresetItem {
    name: string;
    z_mm: number;
    role?: string;
}

export const DEFAULT_KITCHEN_DATUM_PRESETS: KitchenLevelPresetItem[] = [
    { name: 'Cokół', z_mm: 100, role: 'PLINTH_TOP' },
    { name: 'Korpus dolny', z_mm: 820, role: 'BASE_TOP' },
    { name: 'Wierzch blatu', z_mm: 858, role: 'COUNTERTOP_TOP' },
    { name: 'Dół wiszących', z_mm: 1460, role: 'WALL_BOTTOM' },
    { name: 'Góra wiszących', z_mm: 2180, role: 'WALL_TOP' },
];

export function createDatumLevelData(id: string, name: string, z_mm: number): DatumLevelModel {
    return new DatumLevelModel({
        id,
        name,
        z_nm: mmToNm(z_mm),
        isLocked: false,
        visiblePlane: true,
        visible: true,
    });
}
