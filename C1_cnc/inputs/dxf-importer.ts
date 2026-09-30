/**
 * C1_cnc/inputs/dxf-importer.ts
 * 
 * Uniwersalny importer plików 2D/2.5D DXF dla modułu CAM CNC.
 * Czyta formatki, nawierty i frezowania z plików AutoCAD/DraftSight/SolidWorks/SketchUp/ZwCAD DXF.
 * 
 * Posiada pancerny parser par (code, value) zgodny ze specyfikacją ASCII DXF.
 * Automatycznie dekoduje parametry technologiczne (średnica, głębokość) z nazw warstw
 * (np. "DRILL_D8_Z13", "WIERCENIE_5_G14", "WPUST_W4_Z8", "OBRYS", "OUTLINE", "CIECIE").
 */

import { mmToNm } from '../../A1_core/cad-math/units.js';
import type { CncModulePayload, CncWorkpiece } from '../../src/module-data/types.js';

export interface DxfCircle {
    type: 'CIRCLE';
    layer: string;
    x: number;
    y: number;
    z: number;
    radius: number;
}

export interface DxfLine {
    type: 'LINE';
    layer: string;
    x1: number;
    y1: number;
    z1: number;
    x2: number;
    y2: number;
    z2: number;
}

export interface DxfVertex {
    x: number;
    y: number;
    z?: number;
    bulge?: number;
}

export interface DxfPolyline {
    type: 'LWPOLYLINE' | 'POLYLINE';
    layer: string;
    closed: boolean;
    vertices: DxfVertex[];
}

export interface DxfArc {
    type: 'ARC';
    layer: string;
    x: number;
    y: number;
    z: number;
    radius: number;
    startAngle: number;
    endAngle: number;
}

export type DxfEntity = DxfCircle | DxfLine | DxfPolyline | DxfArc;

export interface DxfParseResult {
    entities: DxfEntity[];
    layers: Set<string>;
    headerExtMin?: { x: number; y: number };
    headerExtMax?: { x: number; y: number };
}

export interface DxfImportOptions {
    /** Grubość przygotówki [mm] — wymagana (fail-fast, bez domyślnego 18 mm). */
    defaultThicknessMm?: number;
    /** Alias legacy (ten sam meaning co defaultThicknessMm). */
    defaultThickness?: number;
    defaultDrillDepthMm?: number;
    defaultGrooveWidthMm?: number;
    defaultGrooveDepthMm?: number;
    normalizeToOrigin?: boolean;
}

const OUTLINE_LAYER_REGEX = /(?:OBRYS|OUTLINE|PANEL|FORMATKA|BORDER|RAMKA|BOM|KONTUR|CI[EĘ]CI[EĘ]|CUT|P[LŁ]YTA|BOARD|ZEWN[EĘ]TRZN)/i;
const DRILL_LAYER_REGEX = /(?:DRILL|WIERCENIE|OTW[OÓ]R|BORE|PUNKT|D\d+)/i;
const GROOVE_LAYER_REGEX = /(?:WPUST|GROOVE|FREZ|ROUT|KIESZE[NŃ]|NUT|CUT|POCKET|KANA[LŁ])/i;

/**
 * Wyciąga liczbę z nazwy warstwy wg wzorca (np. "Z13", "D8", "W4")
 */
function extractNumberFromLayer(layer: string, prefixRegex: RegExp): number | null {
    const match = layer.match(prefixRegex);
    if (!match) return null;
    const val = parseFloat(match[1]);
    return isNaN(val) ? null : val;
}

export function parseDxfLayerParams(layer: string, panelThicknessMm?: number) {
    const isGroove = GROOVE_LAYER_REGEX.test(layer);
    const isDrill = DRILL_LAYER_REGEX.test(layer);

    let depthMatch = extractNumberFromLayer(layer, /(?:Z|G|H|GLEBOKOSC|DEPTH|DP)[_=-]?(\d+(?:\.\d+)?)/i);
    if (depthMatch === null && isGroove) {
        depthMatch = extractNumberFromLayer(layer, /D[_=-]?(\d+(?:\.\d+)?)/i);
    }

    let diaMatch = extractNumberFromLayer(layer, /(?:D|FI|DIA|⌀)[_=-]?(\d+(?:\.\d+)?)/i);
    if (diaMatch === null && isDrill) {
        diaMatch = extractNumberFromLayer(layer, /(?:WIERCENIE|DRILL|OTW[OÓ]R)[_=-]?(\d+(?:\.\d+)?)/i);
    }

    const widthMatch = extractNumberFromLayer(layer, /(?:W|SZER|WIDTH)[_=-]?(\d+(?:\.\d+)?)/i);
    const isThrough = depthMatch !== null &&
        typeof panelThicknessMm === 'number' &&
        Number.isFinite(panelThicknessMm) &&
        panelThicknessMm > 0
        ? depthMatch >= panelThicknessMm - 0.5
        : false;

    return {
        depth: depthMatch,
        diameter: diaMatch,
        width: widthMatch,
        isThrough,
        isOutline: OUTLINE_LAYER_REGEX.test(layer.trim()),
        isDrill,
        isGroove
    };
}

export const parseLayerParams = parseDxfLayerParams;

interface DxfPair {
    code: number;
    value: string;
}

interface DxfRecord {
    type: string;
    pairs: DxfPair[];
}

/**
 * Parsuje plik tekstowy ASCII DXF na obiekty geometryczne.
 * Odporny na brak nagłówków, bloki, różne wielkości liter i nieznane encje.
 */
export function parseDxfAscii(dxfContent: string): DxfParseResult {
    if (!dxfContent || typeof dxfContent !== 'string') {
        throw new Error('Plik DXF jest pusty.');
    }

    if (dxfContent.startsWith('AutoCAD Binary DXF') || dxfContent.includes('AutoCAD Binary DXF')) {
        throw new Error('Wskazany plik to binarny DXF (AutoCAD Binary DXF). Wyeksportuj go ze swojego programu CAD jako tekstowy ASCII DXF.');
    }

    // Usunięcie ewentualnego znaku UTF-8 BOM
    const cleanContent = dxfContent.replace(/^\uFEFF/, '').trim();
    const rawLines = cleanContent.split(/\r?\n/);
    const pairs: DxfPair[] = [];

    let p = 0;
    const lineCount = rawLines.length;

    while (p < lineCount) {
        const line = rawLines[p].trim();
        if (!line) {
            p++;
            continue;
        }

        const code = parseInt(line, 10);
        if (!isNaN(code) && p + 1 < lineCount) {
            pairs.push({ code, value: rawLines[p + 1].trim() });
            p += 2;
        } else {
            p++;
        }
    }

    // Grupujemy pary na rekordy (każdy rekord zaczyna się od code === 0)
    const records: DxfRecord[] = [];
    let curRecord: DxfRecord | null = null;

    let headerExtMin: { x: number; y: number } | undefined;
    let headerExtMax: { x: number; y: number } | undefined;

    for (let k = 0; k < pairs.length; k++) {
        const pair = pairs[k];

        // Wykrywanie wymiarów z nagłówka ($EXTMIN / $EXTMAX)
        if (pair.code === 9 && pair.value.toUpperCase() === '$EXTMIN') {
            let x = 0, y = 0;
            while (k + 1 < pairs.length && pairs[k + 1].code !== 9 && pairs[k + 1].code !== 0) {
                k++;
                if (pairs[k].code === 10) x = parseFloat(pairs[k].value) || 0;
                if (pairs[k].code === 20) y = parseFloat(pairs[k].value) || 0;
            }
            headerExtMin = { x, y };
            continue;
        }

        if (pair.code === 9 && pair.value.toUpperCase() === '$EXTMAX') {
            let x = 0, y = 0;
            while (k + 1 < pairs.length && pairs[k + 1].code !== 9 && pairs[k + 1].code !== 0) {
                k++;
                if (pairs[k].code === 10) x = parseFloat(pairs[k].value) || 0;
                if (pairs[k].code === 20) y = parseFloat(pairs[k].value) || 0;
            }
            headerExtMax = { x, y };
            continue;
        }

        if (pair.code === 0) {
            if (curRecord) {
                records.push(curRecord);
            }
            curRecord = {
                type: pair.value.toUpperCase(),
                pairs: []
            };
        } else if (curRecord) {
            curRecord.pairs.push(pair);
        }
    }

    if (curRecord) {
        records.push(curRecord);
    }

    const entities: DxfEntity[] = [];
    const layers = new Set<string>();

    let currentSection = '';
    const hasExplicitSections = records.some(r => r.type === 'SECTION');

    for (const rec of records) {
        if (rec.type === 'SECTION') {
            const secNamePair = rec.pairs.find(pr => pr.code === 2);
            currentSection = secNamePair ? secNamePair.value.toUpperCase() : '';
            continue;
        }

        if (rec.type === 'ENDSEC') {
            currentSection = '';
            continue;
        }

        // Jeśli w pliku są sekcje, czytamy z ENTITIES oraz BLOCKS; jeśli brak sekcji, czytamy wszystkie encje
        const shouldParse = !hasExplicitSections || currentSection === 'ENTITIES' || currentSection === 'BLOCKS';
        if (!shouldParse) continue;

        const findVal = (code: number, def = '') => {
            const hit = rec.pairs.find(pr => pr.code === code);
            return hit ? hit.value : def;
        };

        const findFloat = (code: number, def = 0) => {
            const str = findVal(code);
            if (!str) return def;
            const n = parseFloat(str);
            return isNaN(n) ? def : n;
        };

        const layer = findVal(8, '0');
        layers.add(layer);

        if (rec.type === 'CIRCLE') {
            const x = findFloat(10);
            const y = findFloat(20);
            const z = findFloat(30);
            const radius = findFloat(40);
            if (radius > 0) {
                entities.push({ type: 'CIRCLE', layer, x, y, z, radius });
            }
        } else if (rec.type === 'LINE') {
            const x1 = findFloat(10);
            const y1 = findFloat(20);
            const z1 = findFloat(30);
            const x2 = findFloat(11);
            const y2 = findFloat(21);
            const z2 = findFloat(31);
            entities.push({ type: 'LINE', layer, x1, y1, z1, x2, y2, z2 });
        } else if (rec.type === 'LWPOLYLINE') {
            const closedFlag = parseInt(findVal(70, '0'), 10);
            const closed = (closedFlag & 1) === 1;

            const vertices: DxfVertex[] = [];
            let curV: DxfVertex | null = null;

            for (const p of rec.pairs) {
                if (p.code === 10) {
                    if (curV) vertices.push(curV);
                    curV = { x: parseFloat(p.value) || 0, y: 0 };
                } else if (p.code === 20 && curV) {
                    curV.y = parseFloat(p.value) || 0;
                } else if (p.code === 42 && curV) {
                    curV.bulge = parseFloat(p.value) || 0;
                }
            }
            if (curV) vertices.push(curV);

            if (vertices.length > 0) {
                entities.push({ type: 'LWPOLYLINE', layer, closed, vertices });
            }
        } else if (rec.type === 'POLYLINE') {
            const closedFlag = parseInt(findVal(70, '0'), 10);
            const closed = (closedFlag & 1) === 1;
            // Zbieramy wierzchołki jeśli były osadzone w parach
            const vertices: DxfVertex[] = [];
            let curV: DxfVertex | null = null;
            for (const p of rec.pairs) {
                if (p.code === 10) {
                    if (curV) vertices.push(curV);
                    curV = { x: parseFloat(p.value) || 0, y: 0 };
                } else if (p.code === 20 && curV) {
                    curV.y = parseFloat(p.value) || 0;
                }
            }
            if (curV) vertices.push(curV);
            if (vertices.length > 0) {
                entities.push({ type: 'POLYLINE', layer, closed, vertices });
            }
        } else if (rec.type === 'ARC') {
            const x = findFloat(10);
            const y = findFloat(20);
            const z = findFloat(30);
            const radius = findFloat(40);
            const startAngle = findFloat(50, 0);
            const endAngle = findFloat(51, 360);
            if (radius > 0) {
                entities.push({ type: 'ARC', layer, x, y, z, radius, startAngle, endAngle });
            }
        } else if (rec.type === 'SOLID' || rec.type === '3DFACE') {
            // Zamiana 4 naroży SOLIDA na zamkniętą polilinię
            const x1 = findFloat(10), y1 = findFloat(20);
            const x2 = findFloat(11), y2 = findFloat(21);
            const x3 = findFloat(12), y3 = findFloat(22);
            const x4 = findFloat(13), y4 = findFloat(23);
            const vertices: DxfVertex[] = [
                { x: x1, y: y1 },
                { x: x2, y: y2 },
                { x: x4, y: y4 },
                { x: x3, y: y3 }
            ];
            entities.push({ type: 'LWPOLYLINE', layer, closed: true, vertices });
        }
    }

    return { entities, layers, headerExtMin, headerExtMax };
}

/**
 * Zwraca listę encji DXF (helper)
 */
export function parseDxf(dxfContent: string): DxfEntity[] {
    return parseDxfAscii(dxfContent).entities;
}

/**
 * Główny konwerter: przekształca treść DXF na uniwersalny CncModulePayload
 */
export function importDxfToWorkpiece(
    dxfContent: string,
    fileName: string,
    options: DxfImportOptions = {}
): CncModulePayload {
    const defaultThickness = options.defaultThicknessMm ?? options.defaultThickness;
    if (typeof defaultThickness !== 'number' || !Number.isFinite(defaultThickness) || defaultThickness <= 0) {
        throw new Error(
            '[C1_cnc/dxf-importer] Wymagane defaultThicknessMm (> 0). ' +
            'Zabronione jest ciche domyślne 18 mm — podaj grubość przygotówki z UI lub opcji importu.'
        );
    }
    const defaultDrillDepth = options.defaultDrillDepthMm ?? 13;
    const defaultGrooveWidth = options.defaultGrooveWidthMm ?? 4;
    const defaultGrooveDepth = options.defaultGrooveDepthMm ?? 8;
    const normalize = options.normalizeToOrigin ?? true;

    const parsed = parseDxfAscii(dxfContent);
    const { entities } = parsed;

    if (entities.length === 0) {
        throw new Error('Plik DXF nie zawiera żadnych obsługiwanych elementów geometrycznych (okręgi, linie, polilinie, łuki). Upewnij się, że plik nie jest pusty.');
    }

    // 1. Wyznaczenie obrysu / gabarytów formatki
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // A. Szukamy zamkniętej polilinii na warstwie typu OBRYS/PANEL/FORMATKA/CIECIE
    let outlinePolyline: DxfPolyline | null = null;
    for (const ent of entities) {
        if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices.length >= 3) {
            const lp = parseDxfLayerParams(ent.layer, defaultThickness);
            if (lp.isOutline) {
                outlinePolyline = ent;
                break;
            }
        }
    }

    // B. Jeśli brak, szukamy największej zamkniętej polilinii na dowolnej warstwie
    if (!outlinePolyline) {
        let maxBboxArea = 0;
        for (const ent of entities) {
            if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.closed && ent.vertices.length >= 4) {
                let pxMin = Infinity, pyMin = Infinity, pxMax = -Infinity, pyMax = -Infinity;
                for (const v of ent.vertices) {
                    if (v.x < pxMin) pxMin = v.x;
                    if (v.x > pxMax) pxMax = v.x;
                    if (v.y < pyMin) pyMin = v.y;
                    if (v.y > pyMax) pyMax = v.y;
                }
                const area = (pxMax - pxMin) * (pyMax - pyMin);
                if (area > maxBboxArea && (pxMax - pxMin) >= 50 && (pyMax - pyMin) >= 50) {
                    maxBboxArea = area;
                    outlinePolyline = ent;
                }
            }
        }
    }

    if (outlinePolyline) {
        for (const v of outlinePolyline.vertices) {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        }
    } else {
        // C. Fallback: Bounding box wszystkich elementów
        for (const ent of entities) {
            if (ent.type === 'CIRCLE') {
                if (ent.x - ent.radius < minX) minX = ent.x - ent.radius;
                if (ent.x + ent.radius > maxX) maxX = ent.x + ent.radius;
                if (ent.y - ent.radius < minY) minY = ent.y - ent.radius;
                if (ent.y + ent.radius > maxY) maxY = ent.y + ent.radius;
            } else if (ent.type === 'LINE') {
                if (ent.x1 < minX) minX = ent.x1;
                if (ent.x2 < minX) minX = ent.x2;
                if (ent.x1 > maxX) maxX = ent.x1;
                if (ent.x2 > maxX) maxX = ent.x2;
                if (ent.y1 < minY) minY = ent.y1;
                if (ent.y2 < minY) minY = ent.y2;
                if (ent.y1 > maxY) maxY = ent.y1;
                if (ent.y2 > maxY) maxY = ent.y2;
            } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                for (const v of ent.vertices) {
                    if (v.x < minX) minX = v.x;
                    if (v.x > maxX) maxX = v.x;
                    if (v.y < minY) minY = v.y;
                    if (v.y > maxY) maxY = v.y;
                }
            } else if (ent.type === 'ARC') {
                if (ent.x - ent.radius < minX) minX = ent.x - ent.radius;
                if (ent.x + ent.radius > maxX) maxX = ent.x + ent.radius;
                if (ent.y - ent.radius < minY) minY = ent.y - ent.radius;
                if (ent.y + ent.radius > maxY) maxY = ent.y + ent.radius;
            }
        }
    }

    if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX || minY >= maxY) {
        throw new Error(
            `[C1_cnc/dxf-importer] Nie udało się wyznaczyć gabarytów formatki z pliku "${fileName}". ` +
            `DXF musi zawierać geometrię z dodatnim bounding boxem (zabronione domyślne 600×720 mm).`
        );
    }

    const widthMm = Math.max(10, Math.round(maxX - minX));
    const heightMm = Math.max(10, Math.round(maxY - minY));
    const offsetX = normalize ? minX : 0;
    const offsetY = normalize ? minY : 0;

    // 2. Ekstrakcja cech CAD (features)
    const features: any[] = [];
    let featureIndex = 1;

    for (const ent of entities) {
        const lp = parseDxfLayerParams(ent.layer, defaultThickness);

        // Pomijamy główną polilinię obrysu
        if (ent === outlinePolyline) continue;

        if (ent.type === 'CIRCLE') {
            const dia = lp.diameter ?? Math.round(ent.radius * 2 * 10) / 10;
            const depth = lp.depth ?? (lp.isThrough ? defaultThickness : defaultDrillDepth);
            const x = Math.round((ent.x - offsetX) * 10) / 10;
            const y = Math.round((ent.y - offsetY) * 10) / 10;

            features.push({
                id: `hole_dxf_${featureIndex++}`,
                type: 'hole',
                face: 'FACE_Z_PLUS',
                name: `Otwór ⌀${dia}x${depth}`,
                params: {
                    diameter: dia,
                    depth,
                    u: x,
                    v: y,
                    x,
                    y,
                    through: depth >= defaultThickness - 0.5
                }
            });
        } else if (ent.type === 'LINE') {
            if (lp.isOutline) continue;

            const x1 = Math.round((ent.x1 - offsetX) * 10) / 10;
            const y1 = Math.round((ent.y1 - offsetY) * 10) / 10;
            const x2 = Math.round((ent.x2 - offsetX) * 10) / 10;
            const y2 = Math.round((ent.y2 - offsetY) * 10) / 10;

            // Jeśli linia leży dokładnie na krawędzi obrysu formatki, traktujemy ją jako obrys płyty (nie wpust)
            const isBoundaryLine = !lp.isGroove && (
                (Math.abs(y1) < 0.5 && Math.abs(y2) < 0.5) ||
                (Math.abs(y1 - heightMm) < 0.5 && Math.abs(y2 - heightMm) < 0.5) ||
                (Math.abs(x1) < 0.5 && Math.abs(x2) < 0.5) ||
                (Math.abs(x1 - widthMm) < 0.5 && Math.abs(x2 - widthMm) < 0.5)
            );
            if (isBoundaryLine) continue;

            const width = lp.width ?? defaultGrooveWidth;
            const depth = lp.depth ?? defaultGrooveDepth;

            features.push({
                id: `groove_dxf_${featureIndex++}`,
                type: 'groove',
                face: 'FACE_Z_PLUS',
                name: `Wpust_${featureIndex - 1}`,
                params: {
                    width,
                    depth,
                    u: x1,
                    v: y1,
                    x1,
                    y1,
                    x2,
                    y2,
                    startPoint: { x: x1, y: y1, z: 0 },
                    endPoint: { x: x2, y: y2, z: 0 }
                }
            });
        } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
            if (lp.isOutline && ent.vertices.length >= 3) continue;

            const depth = lp.depth ?? defaultThickness;
            const points = ent.vertices.map(v => ({
                x: Math.round((v.x - offsetX) * 10) / 10,
                y: Math.round((v.y - offsetY) * 10) / 10,
                z: 0
            }));

            features.push({
                id: `contour_dxf_${featureIndex++}`,
                type: 'contour',
                face: 'FACE_Z_PLUS',
                name: `Profil_${featureIndex - 1}`,
                params: {
                    depth,
                    points,
                    closed: ent.closed
                }
            });
        }
    }

    const workpieceId = `dxf_${Date.now()}`;
    const cleanName = fileName.replace(/\.dxf$/i, '') || 'Formatka_DXF';

    const workpiece: CncWorkpiece = {
        id: workpieceId,
        name: cleanName,
        type: 'panel',
        role: 'PANEL',
        color: { r: 0.70, g: 0.72, b: 0.75 },
        width: mmToNm(widthMm),
        height: mmToNm(heightMm),
        thickness: mmToNm(defaultThickness),
        features
    };

    return {
        meta: {
            module: 'cnc',
            sourceId: 'dxf',
            loadedAt: new Date().toISOString(),
            originLabel: `DXF · ${fileName} (${widthMm}×${heightMm}×${defaultThickness} mm)`,
        },
        scope: {
            type: 'PANEL',
            id: workpieceId,
            name: cleanName
        },
        workpiece
    };
}

export interface DxfMetadataSummary {
    widthMm: number;
    heightMm: number;
    /** Grubość zasugerowana z warstw Z…; null gdy DXF nie podaje zaufanej wartości. */
    suggestedThicknessMm: number | null;
    holesCount: number;
    groovesCount: number;
    contoursCount: number;
    layers: string[];
}

/**
 * Błyskawiczna analiza DXF bez pełnego tworzenia workpiece — do modala przygotówki (grubość Z)
 */
export function inspectDxf(dxfContent: string): DxfMetadataSummary {
    const parsed = parseDxfAscii(dxfContent);
    const { entities, layers } = parsed;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let outlinePolyline: DxfPolyline | null = null;

    for (const ent of entities) {
        if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices.length >= 3) {
            const lp = parseDxfLayerParams(ent.layer);
            if (lp.isOutline) {
                outlinePolyline = ent;
                break;
            }
        }
    }

    if (!outlinePolyline) {
        let maxBboxArea = 0;
        for (const ent of entities) {
            if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.closed && ent.vertices.length >= 4) {
                let pxMin = Infinity, pyMin = Infinity, pxMax = -Infinity, pyMax = -Infinity;
                for (const v of ent.vertices) {
                    if (v.x < pxMin) pxMin = v.x;
                    if (v.x > pxMax) pxMax = v.x;
                    if (v.y < pyMin) pyMin = v.y;
                    if (v.y > pyMax) pyMax = v.y;
                }
                const area = (pxMax - pxMin) * (pyMax - pyMin);
                if (area > maxBboxArea && (pxMax - pxMin) >= 50 && (pyMax - pyMin) >= 50) {
                    maxBboxArea = area;
                    outlinePolyline = ent;
                }
            }
        }
    }

    if (outlinePolyline) {
        for (const v of outlinePolyline.vertices) {
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
        }
    } else {
        for (const ent of entities) {
            if (ent.type === 'CIRCLE') {
                if (ent.x - ent.radius < minX) minX = ent.x - ent.radius;
                if (ent.x + ent.radius > maxX) maxX = ent.x + ent.radius;
                if (ent.y - ent.radius < minY) minY = ent.y - ent.radius;
                if (ent.y + ent.radius > maxY) maxY = ent.y + ent.radius;
            } else if (ent.type === 'LINE') {
                if (ent.x1 < minX) minX = ent.x1;
                if (ent.x2 < minX) minX = ent.x2;
                if (ent.x1 > maxX) maxX = ent.x1;
                if (ent.x2 > maxX) maxX = ent.x2;
                if (ent.y1 < minY) minY = ent.y1;
                if (ent.y2 < minY) minY = ent.y2;
                if (ent.y1 > maxY) maxY = ent.y1;
                if (ent.y2 > maxY) maxY = ent.y2;
            } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                for (const v of ent.vertices) {
                    if (v.x < minX) minX = v.x;
                    if (v.x > maxX) maxX = v.x;
                    if (v.y < minY) minY = v.y;
                    if (v.y > maxY) maxY = v.y;
                }
            } else if (ent.type === 'ARC') {
                if (ent.x - ent.radius < minX) minX = ent.x - ent.radius;
                if (ent.x + ent.radius > maxX) maxX = ent.x + ent.radius;
                if (ent.y - ent.radius < minY) minY = ent.y - ent.radius;
                if (ent.y + ent.radius > maxY) maxY = ent.y + ent.radius;
            }
        }
    }

    if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX || minY >= maxY) {
        throw new Error(
            '[C1_cnc/dxf-importer] inspectDxf: nie udało się wyznaczyć gabarytów formatki z DXF ' +
            '(zabronione domyślne 600×720 mm).'
        );
    }

    const widthMm = Math.max(10, Math.round(maxX - minX));
    const heightMm = Math.max(10, Math.round(maxY - minY));

    let holesCount = 0;
    let groovesCount = 0;
    let contoursCount = 0;
    let suggestedThicknessMm: number | null = null;

    for (const ent of entities) {
        const lp = parseDxfLayerParams(ent.layer);
        if (lp.depth && lp.depth >= 3 && lp.depth <= 50) {
            suggestedThicknessMm = lp.depth;
        }

        if (ent === outlinePolyline) continue;

        if (ent.type === 'CIRCLE') {
            holesCount++;
        } else if (ent.type === 'LINE') {
            const x1 = ent.x1 - minX;
            const y1 = ent.y1 - minY;
            const x2 = ent.x2 - minX;
            const y2 = ent.y2 - minY;
            const isBoundaryLine = !lp.isGroove && (
                (Math.abs(y1) < 0.5 && Math.abs(y2) < 0.5) ||
                (Math.abs(y1 - heightMm) < 0.5 && Math.abs(y2 - heightMm) < 0.5) ||
                (Math.abs(x1) < 0.5 && Math.abs(x2) < 0.5) ||
                (Math.abs(x1 - widthMm) < 0.5 && Math.abs(x2 - widthMm) < 0.5)
            );
            if (!isBoundaryLine) {
                groovesCount++;
            }
        } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
            if (!lp.isOutline) contoursCount++;
        }
    }

    return {
        widthMm,
        heightMm,
        suggestedThicknessMm,
        holesCount,
        groovesCount,
        contoursCount,
        layers: Array.from(layers)
    };
}
