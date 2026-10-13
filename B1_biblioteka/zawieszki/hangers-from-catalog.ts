/**
 * Adapter katalogu zawieszek (B1_biblioteka/zawieszki) → HardwareItem.
 * Jednostki w JSON: mm. GLB = tylko viewport.
 */

export interface HangerMountJson {
    from_top_mm?: number;
    from_back_mm?: number;
    from_side_mm?: number;
    pair?: boolean;
    sides?: Array<'L' | 'R'>;
}

export interface HangerVariantJson {
    id: string;
    name?: string;
    art_no?: string;
    widthMm?: number;
    heightMm?: number;
    depthMm?: number;
    mount?: HangerMountJson;
    machining?: {
        side_holes?: Array<{ name?: string; dia?: number; depth?: number; u_mm?: number; v_mm?: number }>;
    };
    visual?: { glb?: string; origin?: string; units?: string; png?: string };
    iconDataUrl?: string;
}

export interface HangerCatalogFile {
    id?: string;
    brand?: string;
    units?: string;
    type?: string;
    name?: string;
    series?: Array<{ id: string; name: string; variants: HangerVariantJson[] }>;
    items?: Record<string, HangerVariantJson & { seriesId?: string; seriesName?: string }>;
    mainContainer?: { widthMm: number; heightMm: number; depthMm: number };
    parts?: any[];
    partBody?: any;
    cuts?: any[];
    iconDataUrl?: string;
    visual?: { glb?: string; origin?: string; units?: string; png?: string };
}

export interface HangerHardwareItem {
    id: string;
    type: 'HANGER';
    name: string;
    brand: string;
    series: string;
    seriesId: string;
    art_no?: string;
    price_id?: string;
    mount: {
        from_top: number;
        from_back: number;
        from_side: number;
        pair: boolean;
        width: number;
        height: number;
        depth: number;
    };
    machining?: HangerVariantJson['machining'];
    visual: { glb: string; origin: string; units: string; png?: string };
    definition?: any;
}

export function isSmartPartDefinition(raw: any): boolean {
    return Boolean(
        raw &&
        typeof raw === 'object' &&
        raw.mainContainer &&
        typeof raw.mainContainer === 'object' &&
        (Array.isArray(raw.parts) || raw.partBody || raw.type === 'CUSTOM' || raw.type === 'HANGER')
    );
}

export function smartPartToHangerItem(raw: any, fileBaseId?: string): HangerHardwareItem | null {
    const id = fileBaseId || raw?.id;
    if (!id) return null;
    const parts = Array.isArray(raw.parts) && raw.parts.length > 0
        ? raw.parts
        : raw.partBody
            ? [raw.partBody]
            : [];
    const firstPart = parts[0] || {};
    const widthMm = Number(firstPart.widthMm) || 20;
    const heightMm = Number(firstPart.heightMm) || 38;
    const depthMm = Number(firstPart.depthMm) || 70;

    const brand = raw.brand || (raw.type === 'CUSTOM' ? 'SmartPart' : 'SmartParts');
    const series = raw.series || 'Własne SmartParts';

    return {
        id,
        type: 'HANGER',
        name: raw.name || fileBaseId || id,
        brand,
        series,
        seriesId: raw.seriesId || 'smartpart_custom',
        art_no: raw.art_no || 'SP',
        price_id: `HANGER_${id}`,
        mount: {
            from_top: Number(raw.mount?.from_top_mm ?? 0),
            from_back: Number(raw.mount?.from_back_mm ?? 0),
            from_side: Number(raw.mount?.from_side_mm ?? 0),
            pair: raw.mount?.pair !== undefined ? Boolean(raw.mount.pair) : (parts.length > 1),
            width: widthMm,
            height: heightMm,
            depth: depthMm,
        },
        visual: {
            glb: raw.visual?.glb || '',
            origin: raw.visual?.origin || 'MOUNT_CORNER',
            units: raw.units || 'mm',
            png: raw.visual?.png || raw.iconDataUrl || '',
        },
        definition: raw,
    };
}

export function hangersFromCatalog(raw: HangerCatalogFile | any, brandFallback = 'Camaro', fileBaseId?: string): HangerHardwareItem[] {
    if (!raw) return [];
    const out: HangerHardwareItem[] = [];
    const brand = raw.brand || (raw.type === 'CUSTOM' ? 'SmartPart' : brandFallback);

    if (Array.isArray(raw.series)) {
        for (const series of raw.series) {
            if (!series?.variants?.length) continue;
            for (const v of series.variants) {
                const item = variantToItem(v, {
                    brand,
                    seriesId: series.id,
                    seriesName: series.name,
                });
                if (item) out.push(item);
            }
        }
    }

    if (raw.items && typeof raw.items === 'object') {
        for (const v of Object.values(raw.items)) {
            const variant = v as HangerVariantJson & { seriesId?: string; seriesName?: string };
            if (!variant?.id) continue;
            if (out.some((x) => x.id === variant.id)) continue;
            const item = variantToItem(variant, {
                brand,
                seriesId: variant.seriesId || 'unknown',
                seriesName: variant.seriesName || variant.seriesId || 'Unknown',
            });
            if (item) out.push(item);
        }
    }

    if (isSmartPartDefinition(raw)) {
        const item = smartPartToHangerItem(raw, fileBaseId);
        if (item && !out.some((x) => x.id === item.id)) {
            out.push(item);
        }
    }

    return out;
}

function variantToItem(
    v: HangerVariantJson,
    meta: { brand: string; seriesId: string; seriesName: string },
): HangerHardwareItem | null {
    if (!v?.id) return null;
    const glb = v.visual?.glb || '';
    const m = v.mount || {};
    return {
        id: v.id,
        type: 'HANGER',
        name: v.name || meta.seriesName,
        brand: meta.brand,
        series: meta.seriesName,
        seriesId: meta.seriesId,
        art_no: v.art_no,
        price_id: `HANGER_${v.id}`,
        mount: {
            from_top: Number.isFinite(Number(m.from_top_mm)) ? Number(m.from_top_mm) : 0,
            from_back: Number.isFinite(Number(m.from_back_mm)) ? Number(m.from_back_mm) : 0,
            from_side: Number.isFinite(Number(m.from_side_mm)) ? Number(m.from_side_mm) : 0,
            pair: m.pair !== false,
            width: Number(v.widthMm) || 20,
            height: Number(v.heightMm) || 38,
            depth: Number(v.depthMm) || 70,
        },
        machining: v.machining,
        visual: {
            glb,
            origin: v.visual?.origin || 'MOUNT_CORNER',
            units: v.visual?.units || 'mm',
            png: v.visual?.png || v.iconDataUrl || '',
        },
    };
}

export function hangerGlbTemplateId(glbOrPath: string | undefined | null): string | null {
    if (!glbOrPath) return null;
    const file = glbOrPath.replace(/^.*[\\/]/, '').replace(/\.glb$/i, '');
    return file || null;
}
