/**
 * Topologia prostopadłościanu — krawędzie i narożniki wyłącznie z topology.ts (SSOT).
 * Nie używać dla płyt z outline2d (tam: polygon-extrusion.ts).
 */
import { KRAWEDZIE, NAROZNIK_WSPOLRZEDNE } from './topology.js';

type Coord = number | 'X' | 'Y' | 'Z';

function resolveCoord(c: Coord, w: number, h: number, t: number, axis: 'x' | 'y' | 'z'): number {
    const hw = w / 2;
    const hh = h / 2;
    const ht = t / 2;
    if (c === 0) {
        if (axis === 'x') return -hw;
        if (axis === 'y') return -hh;
        return -ht;
    }
    if (c === 'X') return hw;
    if (c === 'Y') return hh;
    if (c === 'Z') return ht;
    return 0;
}

export function buildBoxTopology(w: number, h: number, t: number): {
    vertices: number[][];
    edges: Array<{ key: string; points: number[][] }>;
} {
    const vertices = NAROZNIK_WSPOLRZEDNE.map(([cx, cy, cz]) => [
        resolveCoord(cx, w, h, t, 'x'),
        resolveCoord(cy, w, h, t, 'y'),
        resolveCoord(cz, w, h, t, 'z')
    ]);

    const edges = Object.entries(KRAWEDZIE).map(([key, [i, j]]) => ({
        key,
        points: [vertices[i], vertices[j]]
    }));

    return { vertices, edges };
}
