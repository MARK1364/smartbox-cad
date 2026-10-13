/**
 * Adapter katalogu uchwytów (B1_biblioteka/uchwyty) → HardwareItem / wpisy SmartParts.
 * Jednostki w JSON: mm. GLB = tylko viewport.
 */

export interface HandleVariantJson {
    id: string;
    name?: string;
    holeDistanceMm: number;
    totalLengthMm: number;
    depthMm?: number;
    thicknessMm?: number;
    footDiameterMm?: number;
    drillDiameterMm?: number;
    visual?: { glb?: string; origin?: string; units?: string };
}

export interface HandleSeriesJson {
    id: string;
    name: string;
    handleType?: 'BAR' | 'EDGE' | 'KNOB' | 'PROFILE';
    variants: HandleVariantJson[];
}

export interface HandleCatalogFile {
    id?: string;
    brand?: string;
    units?: string;
    type?: string;
    series?: HandleSeriesJson[];
    items?: Record<string, HandleVariantJson & { seriesId?: string; seriesName?: string; handleType?: string }>;
}

export interface HandleHardwareItem {
    id: string;
    type: 'HANDLE';
    name: string;
    brand: string;
    series: string;
    seriesId: string;
    handleType: 'BAR' | 'EDGE' | 'KNOB' | 'PROFILE';
    art_no?: string;
    price_id?: string;
    mount: {
        hole_distance: number;
        total_length: number;
        depth: number;
        thickness: number;
        foot_diameter: number;
        drill_dia: number;
    };
    visual: { glb: string; origin: string; units: string };
}

/** Normalizuje pliki Rejs.json (series[]) oraz catalog.json (items{}). */
export function handlesFromCatalog(raw: HandleCatalogFile | null | undefined, brandFallback = 'REJS'): HandleHardwareItem[] {
    if (!raw) return [];
    const out: HandleHardwareItem[] = [];
    const brand = raw.brand || brandFallback;

    if (Array.isArray(raw.series)) {
        for (const series of raw.series) {
            if (!series?.variants?.length) continue;
            const handleType = (series.handleType || 'BAR') as HandleHardwareItem['handleType'];
            for (const v of series.variants) {
                const item = variantToItem(v, {
                    brand,
                    seriesId: series.id,
                    seriesName: series.name,
                    handleType,
                });
                if (item) out.push(item);
            }
        }
    }

    if (raw.items && typeof raw.items === 'object') {
        for (const v of Object.values(raw.items)) {
            if (!v?.id) continue;
            if (out.some((x) => x.id === v.id)) continue;
            const item = variantToItem(v, {
                brand,
                seriesId: v.seriesId || 'unknown',
                seriesName: v.seriesName || v.seriesId || 'Unknown',
                handleType: (v.handleType as HandleHardwareItem['handleType']) || 'BAR',
            });
            if (item) out.push(item);
        }
    }

    return out;
}

function variantToItem(
    v: HandleVariantJson,
    meta: { brand: string; seriesId: string; seriesName: string; handleType: HandleHardwareItem['handleType'] },
): HandleHardwareItem | null {
    if (!v?.id) return null;
    const glb = v.visual?.glb;
    if (!glb) return null;
    const cc = Math.max(0, Number(v.holeDistanceMm) || 0);
    const total = Math.max(cc, Number(v.totalLengthMm) || (cc > 0 ? cc + 34 : 30));
    return {
        id: v.id,
        type: 'HANDLE',
        name: v.name || `${meta.seriesName}${cc > 0 ? ` ${cc}` : ''}`.trim(),
        brand: meta.brand,
        series: meta.seriesName,
        seriesId: meta.seriesId,
        handleType: meta.handleType,
        price_id: `HANDLE_${v.id}`,
        mount: {
            hole_distance: cc,
            total_length: total,
            depth: Number(v.depthMm) || 28,
            thickness: Number(v.thicknessMm) || (meta.handleType === 'KNOB' ? 30 : 12),
            foot_diameter: Number(v.footDiameterMm) || 10,
            drill_dia: Number(v.drillDiameterMm) || 4,
        },
        visual: {
            glb,
            origin: v.visual?.origin || 'CC_CENTER',
            units: v.visual?.units || 'mm',
        },
    };
}

/** Id szablonu HardwareLoader = nazwa pliku bez .glb */
export function handleGlbTemplateId(glbOrPath: string | undefined | null): string | null {
    if (!glbOrPath) return null;
    const file = glbOrPath.replace(/^.*[\\/]/, '').replace(/\.glb$/i, '');
    return file || null;
}
