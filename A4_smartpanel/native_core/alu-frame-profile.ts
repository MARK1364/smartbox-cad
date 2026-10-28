import earcut from 'earcut';
import { discretizePolygonWithFillets } from '../../A1_core/cad-math/arc2d.js';
import { computePolygonSignedArea, ensureCCW } from './polygon-extrusion.js';

export interface ProfileFrameOptions {
    w: number;
    h: number;
    t: number;
    pw: number;
    glassT: number;
    lipDepth: number;
    clearance: number;
    fillet_mm?: number;
    inner_fillet_mm?: number;
    features?: any[];
}

export interface ProfileFrameResult {
    alu_frame: { positions: number[]; indices: number[] };
    alu_glass: { positions: number[]; indices: number[] };
    edges: Array<{ key: string; points: number[][]; alias?: string }>;
    vertices: number[][];
}

/**
 * Buduje ramkę (ramiak / witrynę) z jednolitego profilu 2D (outline2d)
 * z obsługą analitycznych promieni narożników (fillet r) na zewnątrz i wewnątrz.
 */
export function buildProfileFrameMesh(opts: ProfileFrameOptions): ProfileFrameResult {
    const { w, h, t, pw, glassT, lipDepth, clearance, fillet_mm, inner_fillet_mm } = opts;

    const hw = w / 2;
    const hh = h / 2;
    const ht = t / 2;

    const rExt = Math.min(Math.min(hw - 0.5, hh - 0.5), Math.max(0, fillet_mm || 0));
    const defaultRInt = rExt > pw ? rExt - pw : 0;
    const rInt = inner_fillet_mm !== undefined
        ? Math.min(Math.min(hw - pw - 0.5, hh - pw - 0.5), Math.max(0, inner_fillet_mm))
        : defaultRInt;

    // 1. Zewnętrzny i wewnętrzny bazowy obrys 4-punktowy CCW
    const outerBase: Array<[number, number]> = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh]
    ];

    const innerBase: Array<[number, number]> = [
        [-hw + pw, -hh + pw],
        [hw - pw, -hh + pw],
        [hw - pw, hh - pw],
        [-hw + pw, hh - pw]
    ];

    const outerPts = rExt > 0.05
        ? discretizePolygonWithFillets(outerBase, rExt)
        : outerBase;

    const innerPts = rInt > 0.05
        ? discretizePolygonWithFillets(innerBase, rInt)
        : innerBase;

    const outerCCW = ensureCCW(outerPts);
    // Otwór dla earcut musi mieć orientację CW
    const innerCW = computePolygonSignedArea(innerPts) > 0 ? [...innerPts].reverse() : innerPts;
    const innerCCW = ensureCCW(innerPts);

    // 2. Triangulacja lic przedniego (Z+) i tylnego (Z-)
    const flatVerts: number[] = [];
    for (const [x, y] of outerCCW) flatVerts.push(x, y);
    const holeIdx = outerCCW.length;
    for (const [x, y] of innerCW) flatVerts.push(x, y);

    const tris = earcut(flatVerts, [holeIdx], 2);

    const framePositions: number[] = [];
    const frameIndices: number[] = [];

    const addTriangle = (pA: number[], pB: number[], pC: number[]) => {
        const base = framePositions.length / 3;
        framePositions.push(...pA, ...pB, ...pC);
        frameIndices.push(base, base + 1, base + 2);
    };

    const addQuad = (pA: number[], pB: number[], pC: number[], pD: number[]) => {
        const base = framePositions.length / 3;
        framePositions.push(...pA, ...pB, ...pC, ...pD);
        frameIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    // Lico przednie (Z = +ht, normalna +Z)
    const nTotalVerts = outerCCW.length + innerCW.length;
    const frontVerts: number[][] = [];
    for (let i = 0; i < nTotalVerts; i++) {
        frontVerts.push([flatVerts[i * 2], flatVerts[i * 2 + 1], ht]);
    }
    for (let i = 0; i < tris.length; i += 3) {
        const i0 = tris[i];
        const i1 = tris[i + 1];
        const i2 = tris[i + 2];
        addTriangle(frontVerts[i0], frontVerts[i1], frontVerts[i2]);
    }

    // Lico tylne (Z = -ht, normalna -Z)
    const backVerts: number[][] = [];
    for (let i = 0; i < nTotalVerts; i++) {
        backVerts.push([flatVerts[i * 2], flatVerts[i * 2 + 1], -ht]);
    }
    for (let i = 0; i < tris.length; i += 3) {
        const i0 = tris[i];
        const i1 = tris[i + 1];
        const i2 = tris[i + 2];
        addTriangle(backVerts[i0], backVerts[i2], backVerts[i1]);
    }

    // 3. Ściany boczne zewnętrzne (normalna na zewnątrz)
    const nOuter = outerCCW.length;
    for (let i = 0; i < nOuter; i++) {
        const next = (i + 1) % nOuter;
        const p0 = outerCCW[i];
        const p1 = outerCCW[next];
        const A = [p0[0], p0[1], ht];
        const B = [p1[0], p1[1], ht];
        const C = [p1[0], p1[1], -ht];
        const D = [p0[0], p0[1], -ht];
        addQuad(A, D, C, B);
    }

    // 4. Ściany boczne wewnętrzne otworu (normalna do wewnątrz otworu)
    const nInner = innerCCW.length;
    for (let i = 0; i < nInner; i++) {
        const next = (i + 1) % nInner;
        const q0 = innerCCW[i];
        const q1 = innerCCW[next];
        const A = [q0[0], q0[1], ht];
        const B = [q1[0], q1[1], ht];
        const C = [q1[0], q1[1], -ht];
        const D = [q0[0], q0[1], -ht];
        addQuad(A, D, C, B);
    }

    // 5. Tafla szkła (alu_glass)
    const gw = Math.max(10, w - 2 * (pw - lipDepth) - 2 * clearance);
    const gh = Math.max(10, h - 2 * (pw - lipDepth) - 2 * clearance);
    const halfGW = gw / 2;
    const halfGH = gh / 2;
    const halfGlassT = glassT / 2;
    const glassFillet = Math.max(0, rInt + lipDepth - clearance);

    const glassBase: Array<[number, number]> = [
        [-halfGW, -halfGH],
        [halfGW, -halfGH],
        [halfGW, halfGH],
        [-halfGW, halfGH]
    ];
    const glassPts = glassFillet > 0.05
        ? discretizePolygonWithFillets(glassBase, glassFillet)
        : glassBase;
    const glassCCW = ensureCCW(glassPts);

    const glassFlat: number[] = [];
    for (const [gx, gy] of glassCCW) glassFlat.push(gx, gy);
    const glassTris = earcut(glassFlat, [], 2);

    const glassPositions: number[] = [];
    const glassIndices: number[] = [];

    const addGlassTri = (pA: number[], pB: number[], pC: number[]) => {
        const base = glassPositions.length / 3;
        glassPositions.push(...pA, ...pB, ...pC);
        glassIndices.push(base, base + 1, base + 2);
    };
    const addGlassQuad = (pA: number[], pB: number[], pC: number[], pD: number[]) => {
        const base = glassPositions.length / 3;
        glassPositions.push(...pA, ...pB, ...pC, ...pD);
        glassIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    const gFront: number[][] = glassCCW.map(([gx, gy]) => [gx, gy, halfGlassT]);
    const gBack: number[][] = glassCCW.map(([gx, gy]) => [gx, gy, -halfGlassT]);

    for (let i = 0; i < glassTris.length; i += 3) {
        addGlassTri(gFront[glassTris[i]], gFront[glassTris[i + 1]], gFront[glassTris[i + 2]]);
        addGlassTri(gBack[glassTris[i]], gBack[glassTris[i + 2]], gBack[glassTris[i + 1]]);
    }

    const nGlass = glassCCW.length;
    for (let i = 0; i < nGlass; i++) {
        const next = (i + 1) % nGlass;
        const A = [glassCCW[i][0], glassCCW[i][1], halfGlassT];
        const B = [glassCCW[next][0], glassCCW[next][1], halfGlassT];
        const C = [glassCCW[next][0], glassCCW[next][1], -halfGlassT];
        const D = [glassCCW[i][0], glassCCW[i][1], -halfGlassT];
        addGlassQuad(A, D, C, B);
    }

    // 6. Krawędzie B-rep (edges)
    const edges: Array<{ key: string; points: number[][]; alias?: string }> = [];

    // Zewnętrzne krawędzie obrysu
    for (let i = 0; i < nOuter; i++) {
        const next = (i + 1) % nOuter;
        const p0 = outerCCW[i];
        const p1 = outerCCW[next];
        edges.push({
            key: `frame_outer_top_${i}`,
            points: [[p0[0], p0[1], ht], [p1[0], p1[1], ht]],
            alias: i === 0 ? 'dol_przod' : i === 1 ? 'przod_prawo' : i === 2 ? 'gora_przod' : 'przod_lewo'
        });
        edges.push({
            key: `frame_outer_bot_${i}`,
            points: [[p0[0], p0[1], -ht], [p1[0], p1[1], -ht]],
            alias: i === 0 ? 'dol_tyl' : i === 1 ? 'tyl_prawo' : i === 2 ? 'gora_tyl' : 'tyl_lewo'
        });
        edges.push({
            key: `frame_outer_v_${i}`,
            points: [[p0[0], p0[1], -ht], [p0[0], p0[1], ht]]
        });
    }

    // Wewnętrzne krawędzie światła ramy
    for (let i = 0; i < nInner; i++) {
        const next = (i + 1) % nInner;
        const q0 = innerCCW[i];
        const q1 = innerCCW[next];
        edges.push({
            key: `frame_inner_top_${i}`,
            points: [[q0[0], q0[1], ht], [q1[0], q1[1], ht]],
            alias: i === 0 ? 'inner_dol_przod' : i === 2 ? 'inner_gora_przod' : undefined
        });
        edges.push({
            key: `frame_inner_bot_${i}`,
            points: [[q0[0], q0[1], -ht], [q1[0], q1[1], -ht]],
            alias: i === 0 ? 'inner_dol_tyl' : i === 2 ? 'inner_gora_tyl' : undefined
        });
    }

    // Krawędzie szkła
    edges.push(
        { key: 'glass_dol', points: [[-halfGW, -halfGH, halfGlassT], [halfGW, -halfGH, halfGlassT]] },
        { key: 'glass_gora', points: [[-halfGW, halfGH, halfGlassT], [halfGW, halfGH, halfGlassT]] },
        { key: 'glass_lewo', points: [[-halfGW, -halfGH, halfGlassT], [-halfGW, halfGH, halfGlassT]] },
        { key: 'glass_prawo', points: [[halfGW, -halfGH, halfGlassT], [halfGW, halfGH, halfGlassT]] }
    );

    const vertices: number[][] = [
        [-hw, -hh, -ht], [hw, -hh, -ht], [hw, hh, -ht], [-hw, hh, -ht],
        [-hw, -hh, ht], [hw, -hh, ht], [hw, hh, ht], [-hw, hh, ht],
        [-hw + pw, -hh + pw, -ht], [hw - pw, -hh + pw, -ht], [hw - pw, hh - pw, -ht], [-hw + pw, hh - pw, -ht],
        [-hw + pw, -hh + pw, ht], [hw - pw, -hh + pw, ht], [hw - pw, hh - pw, ht], [-hw + pw, hh - pw, ht]
    ];

    return {
        alu_frame: { positions: framePositions, indices: frameIndices },
        alu_glass: { positions: glassPositions, indices: glassIndices },
        edges,
        vertices
    };
}
