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
    headerExtMin?: { x: number; y: number; z?: number };
    headerExtMax?: { x: number; y: number; z?: number };
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
    const hasThroughTag = /(?:THROUGH|PRZELOT)/i.test(layer);
    const hasBlindDepthTag = /(?:_Z|DEPTH|GLEBOKOSC)[_=-]?\d+/i.test(layer);
    const isThrough = hasThroughTag || (
        depthMatch !== null &&
        typeof panelThicknessMm === 'number' &&
        Number.isFinite(panelThicknessMm) &&
        panelThicknessMm > 0 &&
        !hasBlindDepthTag &&
        depthMatch >= panelThicknessMm - 0.5
    );

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

    let headerExtMin: { x: number; y: number; z?: number } | undefined;
    let headerExtMax: { x: number; y: number; z?: number } | undefined;

    for (let k = 0; k < pairs.length; k++) {
        const pair = pairs[k];

        // Wykrywanie wymiarów z nagłówka ($EXTMIN / $EXTMAX)
        if (pair.code === 9 && pair.value.toUpperCase() === '$EXTMIN') {
            let x = 0, y = 0, z = 0;
            while (k + 1 < pairs.length && pairs[k + 1].code !== 9 && pairs[k + 1].code !== 0) {
                k++;
                if (pairs[k].code === 10) x = parseFloat(pairs[k].value) || 0;
                if (pairs[k].code === 20) y = parseFloat(pairs[k].value) || 0;
                if (pairs[k].code === 30) z = parseFloat(pairs[k].value) || 0;
            }
            headerExtMin = { x, y, z };
            continue;
        }

        if (pair.code === 9 && pair.value.toUpperCase() === '$EXTMAX') {
            let x = 0, y = 0, z = 0;
            while (k + 1 < pairs.length && pairs[k + 1].code !== 9 && pairs[k + 1].code !== 0) {
                k++;
                if (pairs[k].code === 10) x = parseFloat(pairs[k].value) || 0;
                if (pairs[k].code === 20) y = parseFloat(pairs[k].value) || 0;
                if (pairs[k].code === 30) z = parseFloat(pairs[k].value) || 0;
            }
            headerExtMax = { x, y, z };
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
        } else if (rec.type === 'SOLID') {
            // W specyfikacji DXF dla SOLID wierzchołki są ułożone po przekątnej (1, 2, 4, 3)
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
        } else if (rec.type === '3DFACE') {
            // W specyfikacji DXF dla 3DFACE wierzchołki są ułożone sekwencyjnie po obwodzie (1, 2, 3, 4)
            const x1 = findFloat(10), y1 = findFloat(20);
            const x2 = findFloat(11), y2 = findFloat(21);
            const x3 = findFloat(12), y3 = findFloat(22);
            const x4 = findFloat(13), y4 = findFloat(23);
            const isTriangular = (Math.hypot(x3 - x4, y3 - y4) <= 1e-4);
            const vertices: DxfVertex[] = isTriangular
                ? [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }]
                : [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }, { x: x4, y: y4 }];
            entities.push({ type: 'LWPOLYLINE', layer, closed: true, vertices });
        }
    }

    return { entities, layers, headerExtMin, headerExtMax };
}

/**
 * Przetwarza wierzchołki polilinii DXF, interpolując łuki na segmentach z wartością bulge (wybrzuszenie)
 */
function processPolylineVertices(
    vertices: DxfVertex[],
    closed: boolean,
    offsetX: number,
    offsetY: number
): { points: { x: number; y: number; z: number }[]; segments: any[] } {
    const segments: any[] = [];
    const points: { x: number; y: number; z: number }[] = [];

    if (!vertices || vertices.length === 0) {
        return { points, segments };
    }

    const n = vertices.length;
    const count = closed ? n : n - 1;

    for (let i = 0; i < count; i++) {
        const vCurr = vertices[i];
        const vNext = vertices[(i + 1) % n];

        const p0 = {
            x: Math.round((vCurr.x - offsetX) * 10) / 10,
            y: Math.round((vCurr.y - offsetY) * 10) / 10,
            z: 0
        };
        const p1 = {
            x: Math.round((vNext.x - offsetX) * 10) / 10,
            y: Math.round((vNext.y - offsetY) * 10) / 10,
            z: 0
        };

        if (i === 0) {
            points.push(p0);
        }

        const bulge = vCurr.bulge || 0;
        if (Math.abs(bulge) > 1e-4) {
            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 1e-4) {
                const theta = 4 * Math.atan(bulge);
                const radius = Math.abs((dist * (1 + bulge * bulge)) / (4 * bulge));
                const h = (dist * (1 - bulge * bulge)) / (4 * bulge);
                const midX = (p0.x + p1.x) / 2;
                const midY = (p0.y + p1.y) / 2;
                const cx = midX - (dy / dist) * h;
                const cy = midY + (dx / dist) * h;

                const dir = bulge > 0 ? 'CCW' : 'CW';
                segments.push({
                    type: 'ARC',
                    start: { ...p0 },
                    end: { ...p1 },
                    center: {
                        x: Math.round(cx * 10) / 10,
                        y: Math.round(cy * 10) / 10,
                        z: 0
                    },
                    radius: Math.round(radius * 10) / 10,
                    direction: dir,
                    plane: 'XY'
                });

                const startAngle = Math.atan2(p0.y - cy, p0.x - cx);
                const sweepAngle = dir === 'CCW' ? Math.abs(theta) : -Math.abs(theta);
                const numSteps = Math.max(4, Math.ceil((Math.abs(sweepAngle) * 180 / Math.PI) / 15));

                for (let s = 1; s <= numSteps; s++) {
                    const angle = startAngle + sweepAngle * (s / numSteps);
                    points.push({
                        x: Math.round((cx + radius * Math.cos(angle)) * 10) / 10,
                        y: Math.round((cy + radius * Math.sin(angle)) * 10) / 10,
                        z: 0
                    });
                }
                continue;
            }
        }

        segments.push({
            type: 'LINE',
            start: { ...p0 },
            end: { ...p1 }
        });
        points.push(p1);
    }

    if (!closed && count === 0 && vertices.length === 1) {
        points.push({
            x: Math.round((vertices[0].x - offsetX) * 10) / 10,
            y: Math.round((vertices[0].y - offsetY) * 10) / 10,
            z: 0
        });
    }

    return { points, segments };
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
    const summary = inspectDxf(dxfContent);
    const defaultThickness = options.defaultThicknessMm ?? options.defaultThickness ?? summary.suggestedThicknessMm;
    if (typeof defaultThickness !== 'number' || !Number.isFinite(defaultThickness) || defaultThickness <= 0) {
        throw new Error(
            '[C1_cnc/dxf-importer] Wymagane defaultThicknessMm (> 0). ' +
            'Zabronione jest ciche domyślne 18 mm — podaj grubość przygotówki z UI lub opcji importu.'
        );
    }
    if (options.defaultDrillDepthMm !== undefined && (!Number.isFinite(options.defaultDrillDepthMm) || options.defaultDrillDepthMm <= 0)) {
        throw new Error(`[C1_cnc/dxf-importer] defaultDrillDepthMm musi być skończoną liczbą dodatnią (${options.defaultDrillDepthMm}).`);
    }
    if (options.defaultGrooveWidthMm !== undefined && (!Number.isFinite(options.defaultGrooveWidthMm) || options.defaultGrooveWidthMm <= 0)) {
        throw new Error(`[C1_cnc/dxf-importer] defaultGrooveWidthMm musi być skończoną liczbą dodatnią (${options.defaultGrooveWidthMm}).`);
    }
    if (options.defaultGrooveDepthMm !== undefined && (!Number.isFinite(options.defaultGrooveDepthMm) || options.defaultGrooveDepthMm <= 0)) {
        throw new Error(`[C1_cnc/dxf-importer] defaultGrooveDepthMm musi być skończoną liczbą dodatnią (${options.defaultGrooveDepthMm}).`);
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
            const hasBlindDepthTag = /(?:_Z|DEPTH|GLEBOKOSC)[_=-]?\d+/i.test(ent.layer);
            const isThrough = lp.isThrough || (!hasBlindDepthTag && depth >= defaultThickness - 0.5);

            features.push({
                id: `hole_dxf_${featureIndex++}`,
                type: 'hole',
                face: 'FACE_Z_PLUS',
                name: isThrough ? `Otwór przelotowy ⌀${dia}` : `Otwór ⌀${dia}x${depth}`,
                params: {
                    diameter: dia,
                    depth,
                    u: x,
                    v: y,
                    x,
                    y,
                    through: isThrough
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
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            const len = Math.round(Math.hypot(x2 - x1, y2 - y1) * 10) / 10;

            // Konwencja cechy CAD: prostokąt u,v + width (wzdłuż U) + length (wzdłuż V).
            let u: number, v: number, boxWidth: number, boxLength: number;
            if (dx >= dy) {
                // Poziomy wpust: rozpiętość wzdłuż U, szerokość frezu wzdłuż V
                u = Math.min(x1, x2);
                v = (y1 + y2) / 2 - width / 2;
                boxWidth = len;
                boxLength = width;
            } else {
                // Pionowy wpust: szerokość frezu wzdłuż U, rozpiętość wzdłuż V
                u = (x1 + x2) / 2 - width / 2;
                v = Math.min(y1, y2);
                boxWidth = width;
                boxLength = len;
            }

            features.push({
                id: `groove_dxf_${featureIndex++}`,
                type: 'groove',
                face: 'FACE_Z_PLUS',
                name: `Wpust_${featureIndex - 1}`,
                params: {
                    width: boxWidth,
                    depth,
                    u: Math.round(u * 10) / 10,
                    v: Math.round(v * 10) / 10,
                    length: boxLength,
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
            // Pomijamy prostokątny obrys wpustu na warstwie wpustu, aby nie tworzyć zdublowanego profilu
            if (lp.isGroove && ent.closed && ent.vertices.length === 4) continue;
            // Pomijamy pomocnicze linie obrysu rowka (_OUTLINE lub _BOUNDARY)
            if (/(?:_OUTLINE|_BOUNDARY)$/i.test(ent.layer)) continue;

            const depth = lp.depth ?? defaultThickness;
            const { points, segments } = processPolylineVertices(ent.vertices, ent.closed, offsetX, offsetY);

            features.push({
                id: `contour_dxf_${featureIndex++}`,
                type: 'contour',
                face: 'FACE_Z_PLUS',
                name: `Profil_${featureIndex - 1}`,
                params: {
                    depth,
                    points,
                    segments: segments.length > 0 ? segments : undefined,
                    closed: ent.closed
                }
            });
        } else if (ent.type === 'ARC') {
            if (lp.isOutline) continue;
            if (/(?:_OUTLINE|_BOUNDARY)$/i.test(ent.layer)) continue;

            const depth = lp.depth ?? defaultThickness;
            const cx = Math.round((ent.x - offsetX) * 10) / 10;
            const cy = Math.round((ent.y - offsetY) * 10) / 10;
            const r = Math.round(ent.radius * 10) / 10;
            const startRad = (ent.startAngle * Math.PI) / 180;
            const endRad = (ent.endAngle * Math.PI) / 180;
            const sx = Math.round((cx + r * Math.cos(startRad)) * 10) / 10;
            const sy = Math.round((cy + r * Math.sin(startRad)) * 10) / 10;
            const ex = Math.round((cx + r * Math.cos(endRad)) * 10) / 10;
            const ey = Math.round((cy + r * Math.sin(endRad)) * 10) / 10;

            let sweepDeg = ent.endAngle - ent.startAngle;
            while (sweepDeg <= 0) sweepDeg += 360;
            const sweepRad = (sweepDeg * Math.PI) / 180;
            const numSteps = Math.max(8, Math.ceil(sweepDeg / 15));
            const arcPoints: { x: number; y: number; z: number }[] = [];
            for (let s = 0; s <= numSteps; s++) {
                const a = startRad + sweepRad * (s / numSteps);
                arcPoints.push({
                    x: Math.round((cx + r * Math.cos(a)) * 10) / 10,
                    y: Math.round((cy + r * Math.sin(a)) * 10) / 10,
                    z: 0
                });
            }

            const arcSegment = {
                type: 'ARC' as const,
                start: { x: sx, y: sy, z: 0 },
                end: { x: ex, y: ey, z: 0 },
                center: { x: cx, y: cy, z: 0 },
                radius: r,
                direction: 'CCW' as const,
                plane: 'XY' as const
            };

            features.push({
                id: `contour_dxf_${featureIndex++}`,
                type: 'contour',
                face: 'FACE_Z_PLUS',
                name: `Luk_${featureIndex - 1}`,
                params: {
                    depth,
                    points: arcPoints,
                    segments: [arcSegment],
                    closed: false
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

    if (parsed.headerExtMax?.z && parsed.headerExtMax.z > 0) {
        const minZ = parsed.headerExtMin?.z || 0;
        const th = parsed.headerExtMax.z - minZ;
        if (th >= 2 && th <= 100) {
            suggestedThicknessMm = Math.round(th * 10) / 10;
        }
    }

    if (!suggestedThicknessMm) {
        for (const l of layers) {
            const m = l.match(/(?:PANEL|FORMATKA|PLYTA|BOARD|OUTLINE|OBRYS|THICKNESS|GRUBO[SŚ][CĆ]|_T)[_=-]?(\d+(?:\.\d+)?)/i);
            if (m) {
                const val = parseFloat(m[1]);
                if (val >= 3 && val <= 60) {
                    suggestedThicknessMm = val;
                    break;
                }
            }
        }
    }

    for (const ent of entities) {
        const lp = parseDxfLayerParams(ent.layer);

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
        } else if (ent.type === 'ARC') {
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
