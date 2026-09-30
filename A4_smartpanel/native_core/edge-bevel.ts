/**
 * Pochylenie boku formatki wokół długości krawędzi.
 * Kąt 0° = cięcie proste (ścianka ⊥ lica).
 * Domyślnie (cutAnchor Z+): kąt dodatni cofa Z− do środka; lico Z+ zostaje nominalne.
 * cutAnchor Z−: lico Z− (zewnętrzne) nominalne, skrócenie od strony Z+ (wewnętrznej).
 * LCS i grubość płyty bez zmian.
 */

export type EdgeKey = '+X' | '-X' | '+Y' | '-Y';

export type CutAnchor = 'Z_PLUS' | 'Z_MINUS';

export type EdgeCutAngles = Record<EdgeKey, number>;

export interface EdgeCutSpec {
    angle: number;
    anchor: CutAnchor;
}

export type EdgeCutConfig = Record<EdgeKey, EdgeCutSpec>;

const EDGE_KEYS: EdgeKey[] = ['+X', '-X', '+Y', '-Y'];

function defaultSpec(): EdgeCutSpec {
    return { angle: 0, anchor: 'Z_PLUS' };
}

function parseAnchor(raw: unknown): CutAnchor {
    // Kanonicznie Z_PLUS / Z_MINUS. `OUTER` i `FACE_Z_MINUS` to wycofane aliasy.
    const s = String(raw || '').toUpperCase();
    if (s === 'Z_MINUS') return 'Z_MINUS';
    if (s === 'Z_PLUS' || s === '') return 'Z_PLUS';
    throw new Error(
        `Niekanoniczny cutAnchor obrzeża: "${String(raw)}". Dozwolone: Z_PLUS, Z_MINUS.`
    );
}

export function readEdgeCutConfig(edgeBanding: Record<string, any> | null | undefined): EdgeCutConfig {
    const out: EdgeCutConfig = {
        '+X': defaultSpec(),
        '-X': defaultSpec(),
        '+Y': defaultSpec(),
        '-Y': defaultSpec(),
    };
    if (!edgeBanding) return out;
    for (const key of EDGE_KEYS) {
        const raw = edgeBanding[key]?.cutAngle;
        const deg = Number(raw);
        out[key].angle = Number.isFinite(deg) ? deg : 0;
        out[key].anchor = parseAnchor(edgeBanding[key]?.cutAnchor);
    }
    return out;
}

export function readEdgeCutAngles(edgeBanding: Record<string, any> | null | undefined): EdgeCutAngles {
    const cfg = readEdgeCutConfig(edgeBanding);
    return {
        '+X': cfg['+X'].angle,
        '-X': cfg['-X'].angle,
        '+Y': cfg['+Y'].angle,
        '-Y': cfg['-Y'].angle,
    };
}

export function hasEdgeCut(angles: EdgeCutAngles): boolean {
    return EDGE_KEYS.some((k) => Math.abs(angles[k]) > 0.05);
}

export function hasEdgeCutConfig(config: EdgeCutConfig): boolean {
    return EDGE_KEYS.some((k) => Math.abs(config[k].angle) > 0.05);
}

/** Cofnięcie [mm] w głąb płyty (grubość · tan kąt). */
export function bevelInsetMm(thickness: number, angleDeg: number): number {
    return thickness * Math.tan((angleDeg * Math.PI) / 180);
}

export interface BeveledBox {
    /** Narożniki Z+ (po cięciu). CCW od (−X,−Y). */
    top: number[][];
    /** Narożniki Z− (po cięciu). */
    bottom: number[][];
    edges: Array<{ key: string; points: number[][] }>;
    sides: Record<EdgeKey, { positions: number[]; indices: number[] }>;
}

function isLegacyAngles(input: EdgeCutConfig | EdgeCutAngles): input is EdgeCutAngles {
    return typeof (input as EdgeCutAngles)['+X'] === 'number';
}

function normalizeConfig(input: EdgeCutConfig | EdgeCutAngles): EdgeCutConfig {
    if (!isLegacyAngles(input)) return input;
    const out: EdgeCutConfig = {
        '+X': defaultSpec(),
        '-X': defaultSpec(),
        '+Y': defaultSpec(),
        '-Y': defaultSpec(),
    };
    for (const key of EDGE_KEYS) {
        out[key].angle = input[key] || 0;
    }
    return out;
}

function applyXEdge(
    top: number[][],
    bottom: number[][],
    hx: number,
    edge: '+X' | '-X',
    inset: number,
    anchor: CutAnchor
): void {
    if (Math.abs(inset) < 1e-9) return;
    const indices = edge === '+X' ? [1, 2] : [0, 3];
    const xNom = edge === '+X' ? hx : -hx;
    const pull = edge === '+X' ? -inset : inset;
    for (const i of indices) {
        if (anchor === 'Z_PLUS') {
            top[i][0] = xNom;
            bottom[i][0] = xNom + pull;
        } else {
            bottom[i][0] = xNom;
            top[i][0] = xNom + pull;
        }
    }
}

function applyYEdge(
    top: number[][],
    bottom: number[][],
    hy: number,
    edge: '+Y' | '-Y',
    inset: number,
    anchor: CutAnchor
): void {
    if (Math.abs(inset) < 1e-9) return;
    const indices = edge === '+Y' ? [2, 3] : [0, 1];
    const yNom = edge === '+Y' ? hy : -hy;
    const pull = edge === '+Y' ? -inset : inset;
    for (const i of indices) {
        if (anchor === 'Z_PLUS') {
            top[i][1] = yNom;
            bottom[i][1] = yNom + pull;
        } else {
            bottom[i][1] = yNom;
            top[i][1] = yNom + pull;
        }
    }
}

/**
 * Prostopadłościan z pochylonymi bokami. Współrzędne wycentrowane.
 * top[i] ↔ bottom[i]: 0 (−X−Y), 1 (+X−Y), 2 (+X+Y), 3 (−X+Y).
 */
export function buildBeveledBox(w: number, h: number, t: number, config: EdgeCutConfig | EdgeCutAngles): BeveledBox {
    const cfg = normalizeConfig(config);
    const hx = w / 2;
    const hy = h / 2;
    const hz = t / 2;

    const top = [
        [-hx, -hy, hz],
        [hx, -hy, hz],
        [hx, hy, hz],
        [-hx, hy, hz],
    ];
    const bottom = [
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [hx, hy, -hz],
        [-hx, hy, -hz],
    ];

    applyXEdge(top, bottom, hx, '+X', bevelInsetMm(t, cfg['+X'].angle), cfg['+X'].anchor);
    applyXEdge(top, bottom, hx, '-X', bevelInsetMm(t, cfg['-X'].angle), cfg['-X'].anchor);
    applyYEdge(top, bottom, hy, '+Y', bevelInsetMm(t, cfg['+Y'].angle), cfg['+Y'].anchor);
    applyYEdge(top, bottom, hy, '-Y', bevelInsetMm(t, cfg['-Y'].angle), cfg['-Y'].anchor);

    const quad = (a: number[], b: number[], c: number[], d: number[]) => ({
        positions: [...a, ...b, ...c, ...d],
        indices: [0, 1, 2, 0, 2, 3],
    });

    const sides: BeveledBox['sides'] = {
        '+X': quad(top[1], top[2], bottom[2], bottom[1]),
        '-X': quad(top[0], bottom[0], bottom[3], top[3]),
        '+Y': quad(top[3], bottom[3], bottom[2], top[2]),
        '-Y': quad(top[0], top[1], bottom[1], bottom[0]),
    };

    const edges: BeveledBox['edges'] = [];
    const pairs: Array<[string, number, number]> = [
        ['top_0', 0, 1],
        ['top_1', 1, 2],
        ['top_2', 2, 3],
        ['top_3', 3, 0],
        ['bot_0', 0, 1],
        ['bot_1', 1, 2],
        ['bot_2', 2, 3],
        ['bot_3', 3, 0],
    ];
    for (const [key, i, j] of pairs) {
        const src = key.startsWith('top') ? top : bottom;
        edges.push({ key, points: [src[i], src[j]] });
    }
    for (let i = 0; i < 4; i++) {
        edges.push({ key: `vert_${i}`, points: [top[i], bottom[i]] });
    }

    return { top, bottom, edges, sides };
}
