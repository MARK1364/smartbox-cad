/**
 * Budowa geometrii 3D cech obszarowych (wpusty, kieszenie, wycięcia):
 * siatki dna, ścianek w0..w3, zlicowania L-union i krawędzie B-rep.
 * Wydzielone z planar-features.ts — czysty podział 2D vs 3D.
 */
import earcut from 'earcut';
import { getGrooveParamsMm } from '../../A1_core/groove-params.js';
import { normalizeFaceName } from '../../A1_core/face-name.js';
import { localTo3D, computeFaceData } from './face-lcs.js';
import { appendQuad, emptyMesh, type FaceMeshData } from './face-mesh.js';
import type { CadEdge } from './brep-topology.js';
import { ensureCCW2D, isAxisAlignedRect, isEdgeOnContour } from './planar-features.js';
import { triangulatePolygonsWithHoles } from './cap-triangulation.js';

type FaceData = ReturnType<typeof computeFaceData>;

export function isFeatureSkipped(feat: any): boolean {
    if (!feat) return true;
    if (feat.visible === false || feat.frozen || feat.params?.frozen) return true;
    if (feat.is_assembly_drilling || feat.params?.is_assembly_drilling) return true;
    return false;
}

export function clipIntervals(
    start: number,
    end: number,
    holes: Array<[number, number]>
): Array<[number, number]> {
    let segments: Array<[number, number]> = [[start, end]];
    const EPS = 0.05;

    for (const [h0, h1] of holes) {
        const next: Array<[number, number]> = [];
        for (const [s0, s1] of segments) {
            if (h1 <= s0 + EPS || h0 >= s1 - EPS) {
                next.push([s0, s1]);
                continue;
            }
            if (h0 > s0 + EPS) {
                next.push([s0, h0]);
            }
            if (h1 < s1 - EPS) {
                next.push([h1, s1]);
            }
        }
        segments = next;
    }
    return segments.filter(([s0, s1]) => s1 - s0 > EPS);
}

export interface LGrooveUnion {
    gA: any;
    gB: any;
    polygon: [number, number][];
    innerCorner: [number, number];
    depth: number;
    face: string;
}

export function detectLGrooveUnion(grooves: any[] | undefined, w?: number, h?: number): LGrooveUnion | null {
    if (!grooves || grooves.length < 2) return null;
    const EPS = 0.05;
    for (let i = 0; i < grooves.length; i++) {
        for (let j = i + 1; j < grooves.length; j++) {
            const g1 = grooves[i];
            const g2 = grooves[j];
            if (!g1 || !g2 || isFeatureSkipped(g1) || isFeatureSkipped(g2)) continue;
            if (g1.type !== 'groove' && g1.type !== 'pocket') continue;
            if (g2.type !== 'groove' && g2.type !== 'pocket') continue;

            const face1 = normalizeFaceName(g1.face || g1.side || '');
            const face2 = normalizeFaceName(g2.face || g2.side || '');
            if (face1 !== face2) continue;

            const gp1 = getGrooveParamsMm(g1.params);
            const gp2 = getGrooveParamsMm(g2.params);
            if (Math.abs(gp1.depth - gp2.depth) > EPS) continue;

            const u1_0 = gp1.u, u1_1 = gp1.u + gp1.width;
            const v1_0 = gp1.v, v1_1 = gp1.v + gp1.length;
            const u2_0 = gp2.u, u2_1 = gp2.u + gp2.width;
            const v2_0 = gp2.v, v2_1 = gp2.v + gp2.length;

            const inU0 = Math.max(u1_0, u2_0);
            const inU1 = Math.min(u1_1, u2_1);
            const inV0 = Math.max(v1_0, v2_0);
            const inV1 = Math.min(v1_1, v2_1);

            if (inU1 - inU0 > EPS && inV1 - inV0 > EPS) {
                const is1AlongU = (u1_1 - u1_0) > (v1_1 - v1_0);
                const is2AlongV = (v2_1 - v2_0) > (u2_1 - u2_0);
                const is2AlongU = (u2_1 - u2_0) > (v2_1 - v2_0);
                const is1AlongV = (v1_1 - v1_0) > (u1_1 - u1_0);

                if (!((is1AlongU && is2AlongV) || (is2AlongU && is1AlongV))) continue;

                const gA = is1AlongU ? g1 : g2;
                const gB = is1AlongU ? g2 : g1;
                const gpA = is1AlongU ? gp1 : gp2;
                const gpB = is1AlongU ? gp2 : gp1;

                const uA0 = gpA.u, uA1 = gpA.u + gpA.width;
                const vA0 = gpA.v, vA1 = gpA.v + gpA.length;
                const uB0 = gpB.u, uB1 = gpB.u + gpB.width;
                const vB0 = gpB.v, vB1 = gpB.v + gpB.length;

                const Umin = Math.min(uA0, uB0);
                const Umax = Math.max(uA1, uB1);
                const Vmin = Math.min(vA0, vB0);
                const Vmax = Math.max(vA1, vB1);
                const depth = gpA.depth;

                let polygon: [number, number][] | null = null;
                let innerCorner: [number, number] = [inU0, inV0];

                if (inU1 >= Umax - EPS && inV1 >= Vmax - EPS) {
                    innerCorner = [inU0, inV0];
                    polygon = [
                        [Umin, inV0],
                        [inU0, inV0],
                        [inU0, Vmin],
                        [Umax, Vmin],
                        [Umax, Vmax],
                        [Umin, Vmax]
                    ];
                } else if (inU0 <= Umin + EPS && inV1 >= Vmax - EPS) {
                    innerCorner = [inU1, inV0];
                    polygon = [
                        [Umin, Vmin],
                        [Umin, Vmax],
                        [Umax, Vmax],
                        [Umax, inV0],
                        [inU1, inV0],
                        [inU1, Vmin]
                    ];
                } else if (inU1 >= Umax - EPS && inV0 <= Vmin + EPS) {
                    innerCorner = [inU0, inV1];
                    polygon = [
                        [Umin, Vmin],
                        [Umax, Vmin],
                        [Umax, Vmax],
                        [inU0, Vmax],
                        [inU0, inV1],
                        [Umin, inV1]
                    ];
                } else if (inU0 <= Umin + EPS && inV0 <= Vmin + EPS) {
                    innerCorner = [inU1, inV1];
                    polygon = [
                        [Umin, Vmax],
                        [Umin, Vmin],
                        [Umax, Vmin],
                        [Umax, inV1],
                        [inU1, inV1],
                        [inU1, Vmax]
                    ];
                }

                if (polygon) {
                    if (w !== undefined && h !== undefined) {
                        const isEdgeCorner = (
                            (Math.abs(Umax - w) <= 1 || Math.abs(Umin) <= 1) &&
                            (Math.abs(Vmax - h) <= 1 || Math.abs(Vmin) <= 1)
                        );
                        if (!isEdgeCorner) {
                            continue;
                        }
                    }
                    return { gA, gB, polygon, innerCorner, depth, face: face1 };
                }
            }
        }
    }
    return null;
}

function resolveBevelGrooveBounds(
    uRaw: number, vRaw: number, wRaw: number, hRaw: number,
    faceData: FaceData,
    outerContour: number[][],
    bottomContour: number[][] | undefined,
    depth: number,
    t: number
) {
    const EDGE_EPS = 0.05;
    const uMinRaw = Math.min(uRaw, uRaw + wRaw);
    const uMaxRaw = Math.max(uRaw, uRaw + wRaw);
    const vMinRaw = Math.min(vRaw, vRaw + hRaw);
    const vMaxRaw = Math.max(vRaw, vRaw + hRaw);
    if (!bottomContour || bottomContour.length === 0) {
        const u0 = Math.max(0, uMinRaw);
        const u1 = Math.min(faceData.width, uMaxRaw);
        const v0 = Math.max(0, vMinRaw);
        const v1 = Math.min(faceData.height, vMaxRaw);
        const throughU0 = u0 <= EDGE_EPS || isEdgeOnContour([u0, v0], [u0, v1], outerContour);
        const throughU1 = u1 >= faceData.width - EDGE_EPS || isEdgeOnContour([u1, v0], [u1, v1], outerContour);
        const throughV0 = v0 <= EDGE_EPS || isEdgeOnContour([u0, v0], [u1, v0], outerContour);
        const throughV1 = v1 >= faceData.height - EDGE_EPS || isEdgeOnContour([u0, v1], [u1, v1], outerContour);
        return {
            u0_top: u0, u1_top: u1, v0_top: v0, v1_top: v1,
            u0_bot: u0, u1_bot: u1, v0_bot: v0, v1_bot: v1,
            throughU0, throughU1, throughV0, throughV1
        };
    }

    let uMinTop = Infinity, uMaxTop = -Infinity, vMinTop = Infinity, vMaxTop = -Infinity;
    for (const [cu, cv] of outerContour) {
        if (cu < uMinTop) uMinTop = cu;
        if (cu > uMaxTop) uMaxTop = cu;
        if (cv < vMinTop) vMinTop = cv;
        if (cv > vMaxTop) vMaxTop = cv;
    }
    let uMinBot = Infinity, uMaxBot = -Infinity, vMinBot = Infinity, vMaxBot = -Infinity;
    for (const [cu, cv] of bottomContour) {
        if (cu < uMinBot) uMinBot = cu;
        if (cu > uMaxBot) uMaxBot = cu;
        if (cv < vMinBot) vMinBot = cv;
        if (cv > vMaxBot) vMaxBot = cv;
    }

    const s = t > 1e-6 ? Math.max(0, Math.min(1, depth / t)) : 0;
    const uMinD = uMinTop + s * (uMinBot - uMinTop);
    const uMaxD = uMaxTop + s * (uMaxBot - uMaxTop);
    const vMinD = vMinTop + s * (vMinBot - vMinTop);
    const vMaxD = vMaxTop + s * (vMaxBot - vMaxTop);

    const touchesU0 = uMinRaw <= EDGE_EPS || uMinRaw <= uMinTop + EDGE_EPS;
    const touchesU1 = uMaxRaw >= faceData.width - EDGE_EPS || uMaxRaw >= uMaxTop - EDGE_EPS;
    const touchesV0 = vMinRaw <= EDGE_EPS || vMinRaw <= vMinTop + EDGE_EPS;
    const touchesV1 = vMaxRaw >= faceData.height - EDGE_EPS || vMaxRaw >= vMaxTop - EDGE_EPS;

    const u0_top = touchesU0 ? uMinTop : Math.max(uMinTop, uMinRaw);
    const u1_top = touchesU1 ? uMaxTop : Math.min(uMaxTop, uMaxRaw);
    const v0_top = touchesV0 ? vMinTop : Math.max(vMinTop, vMinRaw);
    const v1_top = touchesV1 ? vMaxTop : Math.min(vMaxTop, vMaxRaw);

    const v0Shift = v0_top > faceData.height / 2 ? s * (vMaxBot - vMaxTop) : s * (vMinBot - vMinTop);
    const v1Shift = v1_top > faceData.height / 2 ? s * (vMaxBot - vMaxTop) : s * (vMinBot - vMinTop);
    const u0_bot = touchesU0 ? uMinD : Math.max(uMinD, uMinRaw);
    const u1_bot = touchesU1 ? uMaxD : Math.min(uMaxD, uMaxRaw);
    const v0_bot = touchesV0 ? vMinD : Math.max(vMinD, v0_top + v0Shift);
    const v1_bot = touchesV1 ? vMaxD : Math.min(vMaxD, v1_top + v1Shift);

    return {
        u0_top, u1_top, v0_top, v1_top,
        u0_bot, u1_bot, v0_bot, v1_bot,
        throughU0: touchesU0,
        throughU1: touchesU1,
        throughV0: touchesV0,
        throughV1: touchesV1
    };
}

/**
 * Aksjomat SolidWorks: Żadna operacja CIĘCIA (groove, pocket, cutout, hole)
 * nie ma prawa wygenerować wierzchołka leżącego poza obwiednią bazową formatki (AABB).
 * Jeśli depthOffset był ujemny lub parametry wybiegały poza płytę, asercja zabezpiecza
 * geometrię przed dodaniem materiału i klamruje wierzchołki do granic bazy formatki.
 */
export function assertCutFeatureEnvelope(
    featureKey: string,
    positions: number[],
    w: number,
    h: number,
    t: number,
    eps = 0.05
): void {
    const halfW = w / 2 + eps;
    const halfH = h / 2 + eps;
    const halfT = t / 2 + eps;

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (Math.abs(x) > halfW || Math.abs(y) > halfH || Math.abs(z) > halfT) {
            positions[i] = Math.max(-w / 2, Math.min(w / 2, x));
            positions[i + 1] = Math.max(-h / 2, Math.min(h / 2, y));
            positions[i + 2] = Math.max(-t / 2, Math.min(t / 2, z));
        }
    }
}

/**
 * Aksjomat SolidWorks: Żadna operacja WYCIĄGNIĘCIA / DODANIA MATERIAŁU (additive feature)
 * nie ma prawa zubożyć bazy ani wyciąć w niej pustki (V_base ⊆ V_wynik).
 * Wszystkie wygenerowane wierzchołki dodanego materiału muszą powiększać lub zachowywać
 * przestrzeń bazy, a wektor wyciągnięcia musi być zorientowany na zewnątrz materiału (+n).
 */
export function assertAdditiveFeaturePreservesBase(
    featureKey: string,
    addedPositions: number[],
    baseMinZ: number,
    baseMaxZ: number,
    extrusionDirection: number = 1,
    eps = 0.05
): void {
    if (!addedPositions || addedPositions.length === 0) return;
    for (let i = 2; i < addedPositions.length; i += 3) {
        const z = addedPositions[i];
        if (extrusionDirection > 0) {
            if (z < baseMaxZ - eps) {
                addedPositions[i] = baseMaxZ;
            }
        } else {
            if (z > baseMinZ + eps) {
                addedPositions[i] = baseMinZ;
            }
        }
    }
}

export interface BossExtrudeInput {
    id: string;
    face: string;
    polygon: Array<[number, number]>;
    height: number;
    plateW: number;
    plateH: number;
    plateT: number;
}

export interface BossExtrudeResult {
    topMesh: FaceMeshData;
    wallsMesh: FaceMeshData;
    effectiveHeight: number;
}

/**
 * Aksjomaty SolidWorks dla Wyciągnięcia (Boss-Extrude / Dodanie materiału):
 * 1. Super-Volume Invariant: V_baza ⊆ V_wynik => Vol(V_wynik) >= Vol(V_baza). Nawet przy h < 0 nie wygryza bazy (h_eff = max(0, h)).
 * 2. Normal Vector (+n) & Positive Height: P_nowy = P_lico + h * n, h > 0 => AABB(V_baza) ⊆ AABB(V_wynik).
 * 3. Merge Solids & Face Orientation: Wszystkie nowe ścianki mają normalne na zewnątrz, a ściana styku jest usunięta (brak podwójnej ściany / non-manifold).
 */
export function buildBossExtrudeMesh(input: BossExtrudeInput): BossExtrudeResult {
    const { id, face, polygon, height, plateW, plateH, plateT } = input;
    const faceData = computeFaceData(face, plateW, plateH, plateT);

    // Aksjomat 1 & 2: h >= 0 (jeśli h < 0, klamrujemy do 0 - materiał stapia się z bazą i nie tworzy pustki)
    const effectiveHeight = Math.max(0, height);

    const topMesh = emptyMesh();
    const wallsMesh = emptyMesh();

    if (effectiveHeight <= 0.0001 || !polygon || polygon.length < 3) {
        return { topMesh, wallsMesh, effectiveHeight: 0 };
    }

    // Aksjomat 2: Wierzchołki wierzchu (cap) powstają przez przesunięcie o +h * normal
    // localTo3D z depthOffset = -effectiveHeight daje: faceData.origin + uAxis*u + vAxis*v + normal*effectiveHeight
    const top3D = polygon.map(([u, v]) => localTo3D(faceData, u, v, -effectiveHeight));
    const base3D = polygon.map(([u, v]) => localTo3D(faceData, u, v, 0));

    // Aksjomat 3: Triangulacja wierzchu (top) z orientacją normalnej na zewnątrz (+n)
    const flatCoords = [];
    for (const [u, v] of polygon) {
        flatCoords.push(u, v);
    }
    const triIndices = earcut(flatCoords);

    // Wierzchołki top
    for (const pt of top3D) {
        topMesh.positions.push(pt[0], pt[1], pt[2]);
    }
    topMesh.indices.push(...triIndices);

    // Ścianki boczne (walls) - z normalnymi skierowanymi na zewnątrz wyciągnięcia
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const b0 = base3D[i];
        const b1 = base3D[next];
        const t1 = top3D[next];
        const t0 = top3D[i];

        appendQuad(wallsMesh, b0, b1, t1, t0);
    }

    // Aksjomat 3: Ściana styku (dno na z = 0) NIE JEST GENEROWANA (Merge Solids)

    return { topMesh, wallsMesh, effectiveHeight };
}

/**
 * Sprawdza spełnienie 3 aksjomatów SolidWorks dla Wyciągnięcia (Boss-Extrude):
 * 1. Super-Volume Invariant: Żaden wierzchołek nie cofa się w głąb bazy formatki (brak wycinania pustki).
 * 2. Normal Vector (+n) & Positive Height (h > 0): AABB(V_baza) ⊆ AABB(V_wynik) wzdłuż normalnej lica.
 * 3. Merge Solids: Brak wewnętrznej ścianki styku (brak dna na licu) oraz normalne skierowane na zewnątrz.
 */
export function assertBossExtrudeAxioms(
    result: BossExtrudeResult,
    input: BossExtrudeInput
): void {
    const { topMesh, wallsMesh, effectiveHeight } = result;
    const { face, plateW, plateH, plateT, height } = input;
    const faceData = computeFaceData(face, plateW, plateH, plateT);
    const EPS = 0.05;

    // Aksjomat 1: Niezmiennik super-zbioru
    if (height < 0) {
        if (effectiveHeight !== 0) {
            throw new Error('[Boss-Extrude Axiom 1] Ujemna wysokość h=' + height + ' nie może wygenerować geometrii w głąb bazy formatki!');
        }
    }

    if (effectiveHeight <= 0) {
        return;
    }

    // Aksjomat 2: P_nowy = P_lico + h * n (h > 0)
    for (let i = 0; i < topMesh.positions.length; i += 3) {
        const pt = [topMesh.positions[i], topMesh.positions[i + 1], topMesh.positions[i + 2]];
        const distFromOrigin = (pt[0] - faceData.origin[0]) * faceData.normal[0]
            + (pt[1] - faceData.origin[1]) * faceData.normal[1]
            + (pt[2] - faceData.origin[2]) * faceData.normal[2];

        if (distFromOrigin < -EPS) {
            throw new Error('[Boss-Extrude Axiom 1/2] Wierzchołek (' + pt.join(', ') + ') wycina pustkę w bazie formatki!');
        }
        if (Math.abs(distFromOrigin - effectiveHeight) > EPS) {
            throw new Error('[Boss-Extrude Axiom 2] Wierzchołek wierzchu nie zachowuje wysokości wyciągnięcia h=' + effectiveHeight + '! Otrzymano: ' + distFromOrigin);
        }
    }

    // Aksjomat 3: Eliminacja ścian wewnętrznych (Merge Solids)
    const candidateBottom = (result as Record<string, any>).bottomMesh;
    if (candidateBottom && candidateBottom.positions?.length > 0) {
        throw new Error('[Boss-Extrude Axiom 3] Wykryto ściankę styku (dno wyciągnięcia)! Ściana ta musi zostać usunięta przy Merge Solids, aby uniknąć non-manifold / z-fighting.');
    }

    // Sprawdzenie orientacji normalnych ścianek bocznych
    for (let i = 0; i < wallsMesh.indices.length; i += 3) {
        const i0 = wallsMesh.indices[i] * 3;
        const i1 = wallsMesh.indices[i + 1] * 3;
        const i2 = wallsMesh.indices[i + 2] * 3;
        const v0 = [wallsMesh.positions[i0], wallsMesh.positions[i0 + 1], wallsMesh.positions[i0 + 2]];
        const v1 = [wallsMesh.positions[i1], wallsMesh.positions[i1 + 1], wallsMesh.positions[i1 + 2]];
        const v2 = [wallsMesh.positions[i2], wallsMesh.positions[i2 + 1], wallsMesh.positions[i2 + 2]];

        const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
        const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
        const n = [
            e1[1] * e2[2] - e1[2] * e2[1],
            e1[2] * e2[0] - e1[0] * e2[2],
            e1[0] * e2[1] - e1[1] * e2[0]
        ];
        const len = Math.hypot(n[0], n[1], n[2]);
        if (len > 1e-6) {
            const dotFace = (n[0] * faceData.normal[0] + n[1] * faceData.normal[1] + n[2] * faceData.normal[2]) / len;
            if (Math.abs(dotFace) > 0.05) {
                throw new Error('[Boss-Extrude Axiom 3] Ścianka boczna nie jest prostopadła do lica wyciągnięcia! dot=' + dotFace);
            }
        }
    }
}

/** Prostokątna cecha obszarowa na tym samym licu (do przycinania krawędzi i schodkowania ścianek). */
export interface AreaRect {
    u0: number; u1: number; v0: number; v1: number;
    depth: number;
    through: boolean;
}

const AREA_RECT_EPS = 0.05;

export function collectAreaRects(feats: any[] | undefined, self: any, normFace: string, t: number): AreaRect[] {
    const out: AreaRect[] = [];
    for (const f of feats || []) {
        if (f === self || isFeatureSkipped(f)) continue;
        if (f.type !== 'groove' && f.type !== 'pocket' && f.type !== 'cutout') continue;
        const fFace = normalizeFaceName(f.face || f.side || 'FACE_Z_PLUS');
        if (fFace !== normFace) continue;
        const poly = f.params?.polygon;
        if (Array.isArray(poly) && poly.length >= 3 && !isAxisAlignedRect(poly)) continue;
        const p = getGrooveParamsMm(f.params);
        const through = f.type === 'cutout'
            || f.params?.through === true
            || f.params?.kind === 'THROUGH'
            || (normFace.includes('FACE_Z') && (p.depth || 0) >= t - AREA_RECT_EPS);
        out.push({
            u0: Math.min(p.u, p.u + p.width),
            u1: Math.max(p.u, p.u + p.width),
            v0: Math.min(p.v, p.v + p.length),
            v1: Math.max(p.v, p.v + p.length),
            depth: through ? t : Math.abs(p.depth || 0),
            through
        });
    }
    return out;
}

/** Czy punkt (u,v) leży ściśle we wnętrzu prostokąta. */
function rectContainsStrict(r: AreaRect, u: number, v: number): boolean {
    return u > r.u0 + AREA_RECT_EPS && u < r.u1 - AREA_RECT_EPS
        && v > r.v0 + AREA_RECT_EPS && v < r.v1 - AREA_RECT_EPS;
}

/** Głębokość płytszej kieszeni, w której leży punkt (u,v) — poziom, od którego zaczyna się ścianka wycięcia. */
function shallowFloorDepthAt(rects: AreaRect[], ownDepth: number, u: number, v: number): number {
    let top = 0;
    for (const r of rects) {
        if (r.through || r.depth >= ownDepth - AREA_RECT_EPS) continue;
        if (rectContainsStrict(r, u, v)) top = Math.max(top, r.depth);
    }
    return top;
}

type WallAxis = 'u' | 'v';

function pointOnAxisLine(axis: WallAxis, fixed: number, s: number): [number, number] {
    return axis === 'u' ? [s, fixed] : [fixed, s];
}

/** Dzieli odcinek [a,b] wzdłuż osi na podprzedziały wg granic prostokątów (punkty podziału). */
function splitIntervalByRects(a: number, b: number, axis: WallAxis, rects: AreaRect[]): number[] {
    const pts = new Set<number>([a, b]);
    for (const r of rects) {
        const lo = axis === 'u' ? r.u0 : r.v0;
        const hi = axis === 'u' ? r.u1 : r.v1;
        if (lo > a + AREA_RECT_EPS && lo < b - AREA_RECT_EPS) pts.add(lo);
        if (hi > a + AREA_RECT_EPS && hi < b - AREA_RECT_EPS) pts.add(hi);
    }
    return [...pts].sort((x, y) => x - y);
}

/**
 * Ścianka wycięcia schodkowana wg płytszych kieszeni na tym samym licu:
 * zwraca [a, b, głębokość_góry_mm] — np. rewizja 18 mm w ramce 3 mm ma ściankę 15 mm (3..18) wewnątrz ramki.
 */
export function stepWallPieces(
    a: number, b: number, axis: WallAxis, fixed: number, rects: AreaRect[], ownDepth: number
): Array<[number, number, number]> {
    const pts = splitIntervalByRects(a, b, axis, rects.filter(r => !r.through && r.depth < ownDepth - AREA_RECT_EPS));
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const mid = (pts[i] + pts[i + 1]) / 2;
        const [mu, mv] = pointOnAxisLine(axis, fixed, mid);
        const top = shallowFloorDepthAt(rects, ownDepth, mu, mv);
        const last = out[out.length - 1];
        if (last && Math.abs(last[2] - top) < 1e-6) last[1] = pts[i + 1];
        else out.push([pts[i], pts[i + 1], top]);
    }
    return out;
}

/**
 * Dodaje krawędź osiową przyciętą przez przelotowe wycięcia (`cutRects`) i schodkowaną
 * wg płytszych kieszeni (`stepRects`). Brak przycięcia → oryginalny klucz.
 */
export function pushClippedAxisEdge(
    out: CadEdge[], key: string, faceData: FaceData,
    axis: WallAxis, fixed: number, a: number, b: number,
    baseDepth: number, stepRects: AreaRect[], cutRects: AreaRect[], ownDepth: number
): void {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const pts = splitIntervalByRects(lo, hi, axis, [...cutRects, ...stepRects]);
    const pieces: Array<[number, number, number]> = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const mid = (pts[i] + pts[i + 1]) / 2;
        const [mu, mv] = pointOnAxisLine(axis, fixed, mid);
        if (cutRects.some(r => rectContainsStrict(r, mu, mv))) continue;
        const depth = baseDepth > 0 ? baseDepth : shallowFloorDepthAt(stepRects, ownDepth, mu, mv);
        pieces.push([pts[i], pts[i + 1], depth]);
    }
    const untouched = pieces.length === 1 && Math.abs(pieces[0][0] - lo) < 1e-9 && Math.abs(pieces[0][1] - hi) < 1e-9;
    pieces.forEach(([pa, pb, d], i) => {
        const [au, av] = pointOnAxisLine(axis, fixed, pa);
        const [bu, bv] = pointOnAxisLine(axis, fixed, pb);
        const pA = localTo3D(faceData, au, av, d);
        const pB = localTo3D(faceData, bu, bv, d);
        const reversed = a > b;
        out.push({ key: untouched ? key : `${key}_seg${i + 1}`, points: reversed ? [pB, pA] : [pA, pB] });
    });
}

function collectPiercingHolesForBottom(
    feats: any[],
    selfFeat: any,
    selfDepth: number,
    faceData: FaceData,
    holes2D?: number[][][]
): number[][][] {
    const piercing: number[][][] = [];
    for (const f of feats) {
        if (f === selfFeat || isFeatureSkipped(f)) continue;
        if (f.type !== 'groove' && f.type !== 'pocket' && f.type !== 'cutout') continue;
        const p = getGrooveParamsMm(f.params);
        const isThrough = f.type === 'cutout' || f.params?.through === true || f.params?.kind === 'THROUGH';
        const fDepth = isThrough ? Infinity : Math.abs(p.depth ?? 0);
        if (fDepth <= selfDepth + 0.05) continue;
        if (Array.isArray(f.params?.polygon) && f.params.polygon.length >= 3) {
            piercing.push(f.params.polygon);
        } else {
            const u0 = Math.max(0, p.u);
            const u1 = Math.min(faceData.width, p.u + p.width);
            const v0 = Math.max(0, p.v);
            const v1 = Math.min(faceData.height, p.v + p.length);
            if (u1 - u0 > 0.05 && v1 - v0 > 0.05) {
                piercing.push([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
            }
        }
    }
    if (holes2D && holes2D.length > 0) {
        for (const h of holes2D) {
            if (h.length >= 3) piercing.push(h);
        }
    }
    return piercing;
}

/** Siatki B-rep cechy obszarowej: `feature_<id>_bottom` oraz ścianki `_w0.._w3` → `featureMeshes`. */
export function buildAreaFeatureMeshes(feat: any, ctx: {
    faceData: FaceData;
    outerContour: number[][];
    bottomContour?: number[][];
    feats: any[];
    holes2D?: number[][][];
    lUnion: LGrooveUnion | null;
    t: number;
    featureMeshes: Record<string, FaceMeshData>;
}): void {
    const { faceData, outerContour, bottomContour, feats, holes2D, lUnion, t, featureMeshes } = ctx;
    if (lUnion && (feat === lUnion.gA || feat === lUnion.gB)) {
        if (feat === lUnion.gB) return;
        const fidA = String(lUnion.gA.id || lUnion.gA.type || 'groove_L');
        const depth = lUnion.depth;

        // 1. Dno L (triangulacja earcut)
        const flat = lUnion.polygon.flat();
        const triIndices = earcut(flat, [], 2);
        const bottom = emptyMesh();
        for (const [u, v] of lUnion.polygon) {
            bottom.positions.push(...localTo3D(faceData, u, v, depth));
        }
        bottom.indices.push(...triIndices);
        featureMeshes[`feature_${fidA}_bottom`] = bottom;

        // 2. Ścianki pionowe tylko dla krawędzi wewnętrznych
        const w0 = emptyMesh();
        for (let k = 0; k < lUnion.polygon.length; k++) {
            const pA = lUnion.polygon[k];
            const pB = lUnion.polygon[(k + 1) % lUnion.polygon.length];
            if (!isEdgeOnContour(pA, pB, outerContour)) {
                appendQuad(
                    w0,
                    localTo3D(faceData, pA[0], pA[1], 0),
                    localTo3D(faceData, pB[0], pB[1], 0),
                    localTo3D(faceData, pB[0], pB[1], depth),
                    localTo3D(faceData, pA[0], pA[1], depth)
                );
            }
        }
        if (w0.positions.length > 0) {
            featureMeshes[`feature_${fidA}_w0`] = w0;
        }
        for (const k of [`feature_${fidA}_bottom`, `feature_${fidA}_w0`]) {
            if (featureMeshes[k]?.positions) {
                assertCutFeatureEnvelope(k, featureMeshes[k].positions, faceData.width, faceData.height, t);
            }
        }
        return;
    }
    const gp = getGrooveParamsMm(feat.params);
    const uRaw = gp.u;
    const vRaw = gp.v;
    const wRaw = gp.width;
    const hRaw = gp.length;
    let depth = Math.max(0, Math.min(t, Math.abs(gp.depth ?? 0)));

    const fid = String(feat.id || feat.type || 'area_feature');
    const isGrooveThrough = feat.type === 'cutout'
        || feat.params?.through === true
        || feat.params?.kind === 'THROUGH'
        || (String(feat.face || '').includes('FACE_Z') && depth >= t - 0.05);

    if (isGrooveThrough) {
        depth = t;
    } else if (depth <= 0.001) {
        return;
    }

    const customPoly: Array<[number, number]> | undefined = Array.isArray(feat.params?.polygon) && feat.params.polygon.length >= 3
        ? ensureCCW2D(feat.params.polygon) as Array<[number, number]>
        : undefined;

    if (customPoly) {
        const w0 = emptyMesh();
        for (let k = 0; k < customPoly.length; k++) {
            const pA = customPoly[k];
            const pB = customPoly[(k + 1) % customPoly.length];
            if (!isEdgeOnContour(pA, pB, outerContour)) {
                appendQuad(
                    w0,
                    localTo3D(faceData, pA[0], pA[1], 0),
                    localTo3D(faceData, pB[0], pB[1], 0),
                    localTo3D(faceData, pB[0], pB[1], depth),
                    localTo3D(faceData, pA[0], pA[1], depth)
                );
            }
        }
        if (w0.positions.length > 0) {
            featureMeshes[`feature_${fid}_w0`] = w0;
        }
        if (!isGrooveThrough) {
            const bottom = emptyMesh();
            const piercingHoles = collectPiercingHolesForBottom(feats, feat, depth, faceData, holes2D);
            triangulatePolygonsWithHoles([customPoly], piercingHoles, faceData, depth, bottom);
            featureMeshes[`feature_${fid}_bottom`] = bottom;
        }
        for (const k of [`feature_${fid}_bottom`, `feature_${fid}_w0`]) {
            if (featureMeshes[k]?.positions) {
                assertCutFeatureEnvelope(k, featureMeshes[k].positions, faceData.width, faceData.height, t);
            }
        }
        return;
    }

    const EDGE_EPS = 0.05;
    const {
        u0_top: u0, u1_top: u1, v0_top: v0, v1_top: v1,
        u0_bot, u1_bot, v0_bot, v1_bot,
        throughU0, throughU1, throughV0, throughV1
    } = resolveBevelGrooveBounds(uRaw, vRaw, wRaw, hRaw, faceData, outerContour, bottomContour, depth, t);

    if (u1 <= u0 || v1 <= v0 || u1_bot <= u0_bot || v1_bot <= v0_bot) return;

    // Otwór wlotu wpustu dostarcza collectExtraHoles2D (opts.extraHoles) — drugi,
    // pokrywający się kontur rozsypuje earcut i czapka gubi wielkie połacie.

    // Inne wpusty/kieszenie na tym licu o tej samej lub większej głębokości (np. prostopadły wpust w narożniku L)
    const otherGrooves = feats
        .filter((f: any) => f !== feat && (f.type === 'groove' || f.type === 'pocket' || f.type === 'cutout'))
        .map((f: any) => {
            const p = getGrooveParamsMm(f.params);
            return {
                id: String(f.id || f.type || ''),
                u0: Math.max(0, p.u),
                u1: Math.min(faceData.width, p.u + p.width),
                v0: Math.max(0, p.v),
                v1: Math.min(faceData.height, p.v + p.length),
                depth: p.depth || 0
            };
        });

    if (!isGrooveThrough) {
        const bottom = emptyMesh();
        // Sprawdzamy czy wcześniejszy wpust nie pokrył już wspólnego narożnika
        let botU0 = u0_bot;
        let botU1 = u1_bot;
        let botV0 = v0_bot;
        let botV1 = v1_bot;
        for (const o of otherGrooves) {
            if (Math.abs(o.depth - depth) < 0.05) {
                const inU0 = Math.max(u0, o.u0);
                const inU1 = Math.min(u1, o.u1);
                const inV0 = Math.max(v0, o.v0);
                const inV1 = Math.min(v1, o.v1);
                if (inU1 - inU0 > 0.05 && inV1 - inV0 > 0.05) {
                    // Jeśli ten wpust jest wzdłuż V (dłuższy w V niż w U), a drugi wzdłuż U:
                    // ustępujemy narożnik drugiemu wpustowi, skracając dno w V
                    if ((v1 - v0) > (u1 - u0)) {
                        if (Math.abs(inV1 - v1) < 0.05) botV1 = Math.min(botV1, inV0);
                        else if (Math.abs(inV0 - v0) < 0.05) botV0 = Math.max(botV0, inV1);
                    }
                }
            }
        }
        const piercingHoles = collectPiercingHolesForBottom(feats, feat, depth, faceData, holes2D);
        if (piercingHoles.length > 0) {
            const botRect = [[botU0, botV0], [botU1, botV0], [botU1, botV1], [botU0, botV1]];
            triangulatePolygonsWithHoles([botRect], piercingHoles, faceData, depth, bottom);
        } else {
            const p00_d_bot = localTo3D(faceData, botU0, botV0, depth);
            const p10_d_bot = localTo3D(faceData, botU1, botV0, depth);
            const p11_d_bot = localTo3D(faceData, botU1, botV1, depth);
            const p01_d_bot = localTo3D(faceData, botU0, botV1, depth);
            appendQuad(bottom, p00_d_bot, p10_d_bot, p11_d_bot, p01_d_bot);
        }
        featureMeshes[`feature_${fid}_bottom`] = bottom;
    }

    // Ścianki współpłaszczyznowe z zewnętrznymi licami (przelot U/V) = „cienkie
    // płaszczyzny” — nie rysuj; otwór i tak wycina collectExtraHoles2D lub leży na obrysie formatki.
    // Ponadto odcinamy fragmenty ścianek, które wchodzą w światło innego wpustu (np. w narożniku L).
    // w0: na linii v = v0, u in [u0, u1]
    const holesW0: Array<[number, number]> = [];
    for (const o of otherGrooves) {
        if (o.depth >= depth - EDGE_EPS && v0 >= o.v0 - EDGE_EPS && v0 < o.v1 - EDGE_EPS) {
            const hU0 = Math.max(u0, o.u0);
            const hU1 = Math.min(u1, o.u1);
            if (hU1 - hU0 > EDGE_EPS) holesW0.push([hU0, hU1]);
        }
    }
    const areaRects = collectAreaRects(feats, feat, normalizeFaceName(feat.face || feat.side || 'FACE_Z_PLUS'), t);
    const segsW0 = clipIntervals(u0, u1, holesW0)
        .flatMap(([a, b]) => stepWallPieces(a, b, 'u', v0, areaRects, depth));
    const w0 = emptyMesh();
    for (const [su0, su1, topD] of segsW0) {
        if (!throughV0) {
            const su0_bot = Math.abs(su0 - u0) <= EDGE_EPS ? u0_bot : su0;
            const su1_bot = Math.abs(su1 - u1) <= EDGE_EPS ? u1_bot : su1;
            appendQuad(
                w0,
                localTo3D(faceData, su0, v0, topD),
                localTo3D(faceData, su1, v0, topD),
                localTo3D(faceData, su1_bot, v0_bot, depth),
                localTo3D(faceData, su0_bot, v0_bot, depth)
            );
        }
    }
    if (w0.positions.length > 0) {
        featureMeshes[`feature_${fid}_w0`] = w0;
    }

    // w2: na linii v = v1, u in [u0, u1]
    const holesW2: Array<[number, number]> = [];
    for (const o of otherGrooves) {
        if (o.depth >= depth - EDGE_EPS && v1 > o.v0 + EDGE_EPS && v1 <= o.v1 + EDGE_EPS) {
            const hU0 = Math.max(u0, o.u0);
            const hU1 = Math.min(u1, o.u1);
            if (hU1 - hU0 > EDGE_EPS) holesW2.push([hU0, hU1]);
        }
    }
    const segsW2 = clipIntervals(u0, u1, holesW2)
        .flatMap(([a, b]) => stepWallPieces(a, b, 'u', v1, areaRects, depth));
    const w2 = emptyMesh();
    for (const [su0, su1, topD] of segsW2) {
        if (!throughV1) {
            const su0_bot = Math.abs(su0 - u0) <= EDGE_EPS ? u0_bot : su0;
            const su1_bot = Math.abs(su1 - u1) <= EDGE_EPS ? u1_bot : su1;
            appendQuad(
                w2,
                localTo3D(faceData, su1, v1, topD),
                localTo3D(faceData, su0, v1, topD),
                localTo3D(faceData, su0_bot, v1_bot, depth),
                localTo3D(faceData, su1_bot, v1_bot, depth)
            );
        }
    }
    if (w2.positions.length > 0) {
        featureMeshes[`feature_${fid}_w2`] = w2;
    }

    // w3: na linii u = u0, v in [v0, v1]
    const holesW3: Array<[number, number]> = [];
    for (const o of otherGrooves) {
        if (o.depth >= depth - EDGE_EPS && u0 >= o.u0 - EDGE_EPS && u0 < o.u1 - EDGE_EPS) {
            const hV0 = Math.max(v0, o.v0);
            const hV1 = Math.min(v1, o.v1);
            if (hV1 - hV0 > EDGE_EPS) holesW3.push([hV0, hV1]);
        }
    }
    const segsW3 = clipIntervals(v0, v1, holesW3)
        .flatMap(([a, b]) => stepWallPieces(a, b, 'v', u0, areaRects, depth));
    const w3 = emptyMesh();
    for (const [sv0, sv1, topD] of segsW3) {
        if (!throughU0) {
            const sv0_bot = Math.abs(sv0 - v0) <= EDGE_EPS ? v0_bot : sv0;
            const sv1_bot = Math.abs(sv1 - v1) <= EDGE_EPS ? v1_bot : sv1;
            appendQuad(
                w3,
                localTo3D(faceData, u0, sv1, topD),
                localTo3D(faceData, u0, sv0, topD),
                localTo3D(faceData, u0_bot, sv0_bot, depth),
                localTo3D(faceData, u0_bot, sv1_bot, depth)
            );
        }
    }
    if (w3.positions.length > 0) {
        featureMeshes[`feature_${fid}_w3`] = w3;
    }

    // w1: na linii u = u1, v in [v0, v1]
    const holesW1: Array<[number, number]> = [];
    for (const o of otherGrooves) {
        if (o.depth >= depth - EDGE_EPS && u1 > o.u0 + EDGE_EPS && u1 <= o.u1 + EDGE_EPS) {
            const hV0 = Math.max(v0, o.v0);
            const hV1 = Math.min(v1, o.v1);
            if (hV1 - hV0 > EDGE_EPS) holesW1.push([hV0, hV1]);
        }
    }
    const segsW1 = clipIntervals(v0, v1, holesW1)
        .flatMap(([a, b]) => stepWallPieces(a, b, 'v', u1, areaRects, depth));
    const w1 = emptyMesh();
    for (const [sv0, sv1, topD] of segsW1) {
        if (!throughU1) {
            const sv0_bot = Math.abs(sv0 - v0) <= EDGE_EPS ? v0_bot : sv0;
            const sv1_bot = Math.abs(sv1 - v1) <= EDGE_EPS ? v1_bot : sv1;
            appendQuad(
                w1,
                localTo3D(faceData, u1, sv0, topD),
                localTo3D(faceData, u1, sv1, topD),
                localTo3D(faceData, u1_bot, sv1_bot, depth),
                localTo3D(faceData, u1_bot, sv0_bot, depth)
            );
        }
    }
    if (w1.positions.length > 0) {
        featureMeshes[`feature_${fid}_w1`] = w1;
    }

    const featureMeshKeys = [
        `feature_${fid}_bottom`,
        `feature_${fid}_w0`,
        `feature_${fid}_w1`,
        `feature_${fid}_w2`,
        `feature_${fid}_w3`,
    ];
    if (!bottomContour) {
        for (const k of featureMeshKeys) {
            if (featureMeshes[k]?.positions) {
                assertCutFeatureEnvelope(k, featureMeshes[k].positions, faceData.width, faceData.height, t);
            }
        }
    }
}

/** Krawędzie B-rep cechy obszarowej (`e_groove_<id>_tN`, `_bN`, `_vN`, `_v_corner`, `_v_mouth_N`). */
export function appendAreaFeatureEdges(featureEdges: CadEdge[], feat: any, ctx: {
    faceData: FaceData;
    faceContour: number[][];
    bottomContour?: number[][];
    lUnion: LGrooveUnion | null;
    normFace: string;
    t: number;
    feats?: any[];
}): void {
    const { faceData, faceContour, bottomContour, lUnion, normFace, t } = ctx;
    if (lUnion && (feat === lUnion.gA || feat === lUnion.gB)) {
        if (feat === lUnion.gB) return;
        const fidA = String(lUnion.gA.id || lUnion.gA.type || 'groove_L');
        const depth = lUnion.depth;
        const isLThrough = depth >= t - 0.05;

        for (let k = 0; k < lUnion.polygon.length; k++) {
            const pA = lUnion.polygon[k];
            const pB = lUnion.polygon[(k + 1) % lUnion.polygon.length];
            const pA_0 = localTo3D(faceData, pA[0], pA[1], 0);
            const pB_0 = localTo3D(faceData, pB[0], pB[1], 0);
            const pA_d = localTo3D(faceData, pA[0], pA[1], depth);
            const pB_d = localTo3D(faceData, pB[0], pB[1], depth);

            const onContour = isEdgeOnContour(pA, pB, faceContour);
            if (!onContour) {
                featureEdges.push({ key: `e_groove_${fidA}_t${k + 1}`, points: [pA_0, pB_0] });
            }

            if (!isLThrough || !onContour) {
                featureEdges.push({ key: `e_groove_${fidA}_b${k + 1}`, points: [pA_d, pB_d] });
            }
        }

        // Krawędź pionowa w narożniku wewnętrznym
        const pCorner_0 = localTo3D(faceData, lUnion.innerCorner[0], lUnion.innerCorner[1], 0);
        const pCorner_d = localTo3D(faceData, lUnion.innerCorner[0], lUnion.innerCorner[1], depth);
        featureEdges.push({ key: `e_groove_${fidA}_v_corner`, points: [pCorner_0, pCorner_d] });

        // Krawędzie pionowe: styk ścianki z obrysem (mouth) oraz narożnik dwóch ścianek
        // (rowek U odsunięty od krawędzi — wszystkie narożniki poza wewnętrznym).
        for (let k = 0; k < lUnion.polygon.length; k++) {
            const pA = lUnion.polygon[k];
            const pPrev = lUnion.polygon[(k + lUnion.polygon.length - 1) % lUnion.polygon.length];
            const pNext = lUnion.polygon[(k + 1) % lUnion.polygon.length];
            const isPrevOnContour = isEdgeOnContour(pPrev, pA, faceContour);
            const isNextOnContour = isEdgeOnContour(pA, pNext, faceContour);
            const isInner = Math.abs(pA[0] - lUnion.innerCorner[0]) <= 0.05
                && Math.abs(pA[1] - lUnion.innerCorner[1]) <= 0.05;
            const pA_0 = localTo3D(faceData, pA[0], pA[1], 0);
            const pA_d = localTo3D(faceData, pA[0], pA[1], depth);
            if (isPrevOnContour !== isNextOnContour) {
                featureEdges.push({ key: `e_groove_${fidA}_v_mouth_${k}`, points: [pA_0, pA_d] });
            } else if (!isPrevOnContour && !isNextOnContour && !isInner) {
                featureEdges.push({ key: `e_groove_${fidA}_v_wall_${k}`, points: [pA_0, pA_d] });
            }
        }
        return;
    }
    const gp = getGrooveParamsMm(feat.params);
    const u0 = gp.u;
    const v0 = gp.v;
    const gw = gp.width;
    const gh = gp.length;
    let depth = gp.depth;

    const isGrooveThrough = feat.type === 'cutout'
        || feat.params?.through === true
        || feat.params?.kind === 'THROUGH'
        || (normFace.includes('FACE_Z') && depth >= t - 0.05);

    if (isGrooveThrough && (depth <= 0 || depth < t - 0.05)) {
        depth = t;
    }

    const customPoly: Array<[number, number]> | undefined =
        Array.isArray(feat.params?.polygon) && feat.params.polygon.length >= 3 && !isAxisAlignedRect(feat.params.polygon)
            ? feat.params.polygon
            : undefined;

    if (customPoly) {
        const m = customPoly.length;
        for (let k = 0; k < m; k++) {
            const pA = customPoly[k];
            const pB = customPoly[(k + 1) % m];
            const pA_0 = localTo3D(faceData, pA[0], pA[1], 0);
            const pB_0 = localTo3D(faceData, pB[0], pB[1], 0);
            const pA_d = localTo3D(faceData, pA[0], pA[1], depth);
            const pB_d = localTo3D(faceData, pB[0], pB[1], depth);

            const onContour = isEdgeOnContour(pA, pB, faceContour);
            if (!onContour) {
                featureEdges.push({ key: `e_groove_${feat.id}_t${k + 1}`, points: [pA_0, pB_0] });
            }
            if (!isGrooveThrough || !onContour) {
                featureEdges.push({ key: `e_groove_${feat.id}_b${k + 1}`, points: [pA_d, pB_d] });
            }
        }
        for (let k = 0; k < m; k++) {
            const pPrev = customPoly[(k - 1 + m) % m];
            const pA = customPoly[k];
            const pNext = customPoly[(k + 1) % m];
            const prevOnContour = isEdgeOnContour(pPrev, pA, faceContour);
            const nextOnContour = isEdgeOnContour(pA, pNext, faceContour);
            if (!(prevOnContour && nextOnContour)) {
                const pA_0 = localTo3D(faceData, pA[0], pA[1], 0);
                const pA_d = localTo3D(faceData, pA[0], pA[1], depth);
                featureEdges.push({ key: `e_groove_${feat.id}_v${k + 1}`, points: [pA_0, pA_d] });
            }
        }
        return;
    }

    const {
        u0_top, u1_top, v0_top, v1_top,
        u0_bot, u1_bot, v0_bot, v1_bot,
        throughU0, throughU1, throughV0, throughV1
    } = resolveBevelGrooveBounds(u0, v0, gw, gh, faceData, faceContour, bottomContour, depth, t);

    const allRects = collectAreaRects(ctx.feats, feat, normFace, t);
    // Ramka (płytka) traci krawędzie w świetle przelotowych wycięć; wycięcie schodkuje górę w płytszych kieszeniach.
    const cutRects = isGrooveThrough ? [] : allRects.filter(r => r.through);
    const stepRects = allRects.filter(r => !r.through);
    const edgeKey = (n: string) => `e_groove_${feat.id}_${n}`;

    if (!throughV0) pushClippedAxisEdge(featureEdges, edgeKey('t1'), faceData, 'u', v0_top, u0_top, u1_top, 0, stepRects, cutRects, depth);
    if (!throughU1) pushClippedAxisEdge(featureEdges, edgeKey('t2'), faceData, 'v', u1_top, v0_top, v1_top, 0, stepRects, cutRects, depth);
    if (!throughV1) pushClippedAxisEdge(featureEdges, edgeKey('t3'), faceData, 'u', v1_top, u1_top, u0_top, 0, stepRects, cutRects, depth);
    if (!throughU0) pushClippedAxisEdge(featureEdges, edgeKey('t4'), faceData, 'v', u0_top, v1_top, v0_top, 0, stepRects, cutRects, depth);

    if (!isGrooveThrough || !throughV0) pushClippedAxisEdge(featureEdges, edgeKey('b1'), faceData, 'u', v0_bot, u0_bot, u1_bot, depth, [], cutRects, depth);
    if (!isGrooveThrough || !throughU1) pushClippedAxisEdge(featureEdges, edgeKey('b2'), faceData, 'v', u1_bot, v0_bot, v1_bot, depth, [], cutRects, depth);
    if (!isGrooveThrough || !throughV1) pushClippedAxisEdge(featureEdges, edgeKey('b3'), faceData, 'u', v1_bot, u1_bot, u0_bot, depth, [], cutRects, depth);
    if (!isGrooveThrough || !throughU0) pushClippedAxisEdge(featureEdges, edgeKey('b4'), faceData, 'v', u0_bot, v1_bot, v0_bot, depth, [], cutRects, depth);

    // Krawędzie pionowe cechy istnieją wtedy, gdy przynajmniej jedna ścianka dochodzi do tego narożnika.
    // Zlicowane (współpłaszczyznowe) krawędzie są centralnie rozpuszczane przez dissolveCoplanarEdges (brep-topology.ts).
    const pushVertical = (n: string, uT: number, vT: number, uB: number, vB: number) => {
        if (cutRects.some(r => rectContainsStrict(r, uT, vT))) return;
        const topD = shallowFloorDepthAt(stepRects, depth, uT, vT);
        if (topD >= depth - AREA_RECT_EPS) return;
        featureEdges.push({ key: edgeKey(n), points: [localTo3D(faceData, uT, vT, topD), localTo3D(faceData, uB, vB, depth)] });
    };
    if (!(throughU0 && throughV0)) pushVertical('v1', u0_top, v0_top, u0_bot, v0_bot);
    if (!(throughU1 && throughV0)) pushVertical('v2', u1_top, v0_top, u1_bot, v0_bot);
    if (!(throughU1 && throughV1)) pushVertical('v3', u1_top, v1_top, u1_bot, v1_bot);
    if (!(throughU0 && throughV1)) pushVertical('v4', u0_top, v1_top, u0_bot, v1_bot);
}

