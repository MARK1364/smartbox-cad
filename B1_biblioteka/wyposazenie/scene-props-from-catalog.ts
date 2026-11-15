/**
 * Adapter katalogu wyposażenia sceny (B1_biblioteka/wyposazenie) → pozycje do wstawienia na scenę 3D.
 * Jednostki w JSON: mm ("units": "mm"). Modele 3D (.glb, .gltf, .obj, .stl) służą wyłącznie wizualizacji.
 */

import { getHardwareFileModules } from '../../A1_core/rules-vault.js';

export type ScenePropCategory = 'BATHROOM' | 'LIGHTING' | 'DECOR' | 'APPLIANCE';

export interface ScenePropPartMm {
    id: string;
    name: string;
    widthMm: number;
    heightMm: number;
    depthMm: number;
    xMm: number;
    yMm: number;
    zMm: number;
    colorHex?: string;
}

export interface ScenePropCatalogEntry {
    id: string;
    name: string;
    category: ScenePropCategory;
    width_mm: number;
    depth_mm: number;
    height_mm: number;
    modelPath?: string;
    modelFormat?: 'glb' | 'gltf' | 'obj' | 'stl';
    pngPath?: string;
    parts?: ScenePropPartMm[];
}

const RAW_JSON_MAP: Record<string, any> = getHardwareFileModules('./wyposazenie/');

export function parseScenePropDefinition(raw: any, fallbackId?: string): ScenePropCatalogEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.items && typeof raw.items === 'object' && !raw.mainContainer) {
        return null; // catalog.json obsługiwany osobno, pojedyncze pliki mają mainContainer
    }
    const id = String(raw.id || fallbackId || '').trim();
    if (!id) return null;

    const mc = raw.mainContainer || {};
    const width_mm = Math.max(10, Number(mc.widthMm ?? raw.width_mm ?? 600));
    const depth_mm = Math.max(10, Number(mc.depthMm ?? raw.depth_mm ?? 600));
    const height_mm = Math.max(10, Number(mc.heightMm ?? raw.height_mm ?? 600));

    const modelPath: string | undefined = raw.visual?.model || raw.visual?.glb || raw.visual?.obj || undefined;
    const extMatch = modelPath ? modelPath.toLowerCase().match(/\.(glb|gltf|obj|stl)$/) : null;
    const modelFormat = extMatch ? (extMatch[1] as 'glb' | 'gltf' | 'obj' | 'stl') : undefined;

    const categoryRaw = String(raw.category || 'DECOR').toUpperCase();
    const category: ScenePropCategory =
        categoryRaw === 'BATHROOM' || categoryRaw === 'LIGHTING' || categoryRaw === 'APPLIANCE'
            ? categoryRaw
            : 'DECOR';

    const parts: ScenePropPartMm[] = Array.isArray(raw.parts)
        ? raw.parts.map((p: any, idx: number) => ({
            id: String(p.id || `part_${idx + 1}`),
            name: String(p.name || `Element ${idx + 1}`),
            widthMm: Math.max(2, Number(p.widthMm ?? 100)),
            heightMm: Math.max(2, Number(p.heightMm ?? 100)),
            depthMm: Math.max(2, Number(p.depthMm ?? 100)),
            xMm: Number(p.xMm ?? 0),
            yMm: Number(p.yMm ?? 0),
            zMm: Number(p.zMm ?? 0),
            colorHex: p.colorHex || '#94a3b8',
        }))
        : [];

    return {
        id,
        name: String(raw.name || fallbackId || id),
        category,
        width_mm,
        depth_mm,
        height_mm,
        modelPath,
        modelFormat,
        pngPath: raw.visual?.png || raw.iconDataUrl,
        parts,
    };
}

export function loadScenePropsFromCatalog(): ScenePropCatalogEntry[] {
    const entries: ScenePropCatalogEntry[] = [];
    const seenIds = new Set<string>();

    for (const [filePath, mod] of Object.entries(RAW_JSON_MAP)) {
        if (filePath.endsWith('catalog.json')) continue;
        const data = (mod as any)?.default || mod;
        const baseName = filePath.replace(/^.*[\\/]/, '').replace(/\.json$/i, '');
        const parsed = parseScenePropDefinition(data, baseName);
        if (parsed && !seenIds.has(parsed.id)) {
            seenIds.add(parsed.id);
            entries.push(parsed);
        }
    }

    return entries;
}

