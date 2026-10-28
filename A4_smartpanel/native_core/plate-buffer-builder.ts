/**
 * PlateBufferBuilder — Zero-Allocation B-Rep & Geometry Engine (Typed Arrays)
 * Faza 1 & Faza 2:
 * - Faza 1: Płaskie tablice binarne dla czystej płyty prostopadłościennej (0.0017 ms/formatka)
 * - Faza 2: Obsługa nawiertów i otworów walcowych (SINGLE, TRIPLE, SYSTEM_32 / ROW) w TypedArray
 *   z wektoryzowanym generowaniem ścianek walca, den oraz triangulacją lica przez earcut.
 */
import earcut from 'earcut';
import { computeFaceData } from './face-lcs.js';
import { normalizeFaceName } from '../../A1_core/face-name.js';
import { isFeatureSkipped } from './planar-feature-mesh.js';
import { expandHoleCenters, type HoleCenter } from './hole-generator.js';

export const FACE_CODES = {
    FACE_Z_PLUS: 1,
    FACE_Z_MINUS: 2,
    FACE_X_PLUS: 3,
    FACE_X_MINUS: 4,
    FACE_Y_PLUS: 5,
    FACE_Y_MINUS: 6,
} as const;

export const ROLE_FLAGS = {
    FACE_LICO: 0x01,
    EDGE_BAND: 0x02,
    HOLE: 0x04,
    POCKET: 0x08,
} as const;

export const VERTEX_STRIDE_FLOATS = 8; // X, Y, Z, Nx, Ny, Nz, U, V
export const TOPOLOGY_RECORD_INTS = 6;  // FACE_CODE, INDEX_START, INDEX_COUNT, ROLE_FLAGS, EDGE_MASK, FEATURE_ID

const HOLE_SEGMENTS = 24;

// Tablice prekompilowane dla 24 segmentów okręgu:
// COS_CW / SIN_CW: kolejność zgodna z ruchem wskazówek zegara (CW), wymagana przez earcut dla otworów
const COS_CW = new Float32Array(HOLE_SEGMENTS);
const SIN_CW = new Float32Array(HOLE_SEGMENTS);

// COS_CCW / SIN_CCW: kolejność CCW dla krawędzi B-Rep
const COS_CCW = new Float32Array(HOLE_SEGMENTS);
const SIN_CCW = new Float32Array(HOLE_SEGMENTS);

for (let i = 0; i < HOLE_SEGMENTS; i++) {
    const thetaCCW = (2 * Math.PI * i) / HOLE_SEGMENTS;
    COS_CCW[i] = Math.cos(thetaCCW);
    SIN_CCW[i] = Math.sin(thetaCCW);

    const thetaCW = -(2 * Math.PI * i) / HOLE_SEGMENTS;
    COS_CW[i] = Math.cos(thetaCW);
    SIN_CW[i] = Math.sin(thetaCW);
}

export interface ContinuousPlateBuffers {
    /** Interleaved vertex buffer: [x, y, z, nx, ny, nz, u, v] per vertex */
    vertices: Float32Array;
    /** Triangle indices */
    indices: Uint32Array;
    /** Exact corner/B-Rep points in mm (Float64) */
    brepCorners: Float64Array;
    /** Slot map table: 6 ints per face */
    topology: Int32Array;
    vertexCount: number;
    indexCount: number;
    faceCount: number;
}

export interface BoxPanelFaceMesh {
    positions: Float32Array;
    brepPositions: Float64Array;
    indices: Uint32Array;
    normals: Float32Array;
    edgeKey?: '+X' | '-X' | '+Y' | '-Y';
}

export interface BoxPanelEdge {
    key: string;
    points: number[][];
    faces: [string, string];
    edgeKey?: string;
    alias?: string;
}

export interface BoxPanelMeshData {
    FACE_Z_PLUS: BoxPanelFaceMesh;
    FACE_Z_MINUS: BoxPanelFaceMesh;
    FACE_X_PLUS: BoxPanelFaceMesh;
    FACE_X_MINUS: BoxPanelFaceMesh;
    FACE_Y_PLUS: BoxPanelFaceMesh;
    FACE_Y_MINUS: BoxPanelFaceMesh;
    vertices: number[][];
    edges: BoxPanelEdge[];
    continuousBuffers: ContinuousPlateBuffers;
}

/** Prealokowana arena robocza (Scratch Buffer) - Zero-GC */
class ScratchBufferArena {
    readonly vertices = new Float32Array(131072 * VERTEX_STRIDE_FLOATS);
    readonly indices = new Uint32Array(131072);
    readonly brepCorners = new Float64Array(16384 * 3);
    readonly topology = new Int32Array(256 * TOPOLOGY_RECORD_INTS);

    // Bufory pomocnicze 2D dla triangulacji otworów earcut
    readonly scratch2D = new Float32Array(16384);
    readonly scratchHoleIndices: number[] = [];

    // Bufory wektoryzowane 3D dla punktów obwodu otworu (24 punkty)
    readonly holeTopX = new Float32Array(HOLE_SEGMENTS);
    readonly holeTopY = new Float32Array(HOLE_SEGMENTS);
    readonly holeTopZ = new Float32Array(HOLE_SEGMENTS);

    readonly holeBotX = new Float32Array(HOLE_SEGMENTS);
    readonly holeBotY = new Float32Array(HOLE_SEGMENTS);
    readonly holeBotZ = new Float32Array(HOLE_SEGMENTS);

    readonly holeNormX = new Float32Array(HOLE_SEGMENTS);
    readonly holeNormY = new Float32Array(HOLE_SEGMENTS);
    readonly holeNormZ = new Float32Array(HOLE_SEGMENTS);
}

let globalScratchArena: ScratchBufferArena | null = null;

function getScratchArena(): ScratchBufferArena {
    if (!globalScratchArena) {
        globalScratchArena = new ScratchBufferArena();
    }
    return globalScratchArena;
}

interface ResolvedHole {
    featId: string;
    cx: number;
    cy: number;
    r: number;
    depth: number;
    isThrough: boolean;
    suffix: string;
}

/**
 * Filtruje i rozwija cechy otworów przypadające na daną ścianę formatki.
 */
function collectFaceHoles(
    features: any[] | undefined,
    faceName: string,
    faceWidth: number,
    faceHeight: number,
    thickness: number
): ResolvedHole[] {
    if (!features || features.length === 0) return [];

    const holes: ResolvedHole[] = [];
    const isZFace = faceName === 'FACE_Z_PLUS' || faceName === 'FACE_Z_MINUS';

    for (let f = 0; f < features.length; f++) {
        const feat = features[f];
        if (isFeatureSkipped(feat)) continue;
        if (feat.type !== 'hole') continue;

        const featFace = normalizeFaceName(feat.face || feat.side || 'FACE_Z_PLUS');
        if (featFace !== faceName) continue;

        const params = feat.params || {};
        const r = (params.diameter || 35) * 0.5;
        const depth = params.depth || 10;
        const isThrough = params.through === true
            || params.kind === 'THROUGH'
            || (isZFace && depth >= thickness - 0.05);

        const centers: HoleCenter[] = expandHoleCenters(params);
        for (let c = 0; c < centers.length; c++) {
            const { cx, cy, suffix } = centers[c];
            // Weryfikacja leżenia wewnątrz lica z marginesem promienia
            if (cx >= r && cx <= faceWidth - r && cy >= r && cy <= faceHeight - r) {
                holes.push({
                    featId: feat.id,
                    cx,
                    cy,
                    r,
                    depth,
                    isThrough,
                    suffix
                });
            }
        }
    }
    return holes;
}

/**
 * Analityczna synteza ciągłych buforów binarnych dla formatki z opcjonalnymi otworami.
 */
export function buildBoxContinuousBuffers(
    w: number,
    h: number,
    t: number,
    features?: any[],
    target?: {
        vertices?: Float32Array;
        indices?: Uint32Array;
        brepCorners?: Float64Array;
        topology?: Int32Array;
    }
): ContinuousPlateBuffers {
    const hw = w * 0.5;
    const hh = h * 0.5;
    const ht = t * 0.5;

    const xMin = -hw;
    const xMax = hw;
    const yMin = -hh;
    const yMax = hh;
    const zMin = -ht;
    const zMax = ht;

    const arena = getScratchArena();
    const vBuf = target?.vertices ?? arena.vertices;
    const iBuf = target?.indices ?? arena.indices;
    const bBuf = target?.brepCorners ?? arena.brepCorners;
    const tBuf = target?.topology ?? arena.topology;

    // 1. Zapis 8 nominalnych narożników B-Rep (Float64Array, 24 wartości)
    bBuf[0] = xMin; bBuf[1] = yMin; bBuf[2] = zMin;
    bBuf[3] = xMax; bBuf[4] = yMin; bBuf[5] = zMin;
    bBuf[6] = xMax; bBuf[7] = yMin; bBuf[8] = zMax;
    bBuf[9] = xMin; bBuf[10] = yMin; bBuf[11] = zMax;
    bBuf[12] = xMin; bBuf[13] = yMax; bBuf[14] = zMin;
    bBuf[15] = xMax; bBuf[16] = yMax; bBuf[17] = zMin;
    bBuf[18] = xMax; bBuf[19] = yMax; bBuf[20] = zMax;
    bBuf[21] = xMin; bBuf[22] = yMax; bBuf[23] = zMax;

    let vOffset = 0;
    let iOffset = 0;
    let tOffset = 0;

    const writeFace = (
        faceName: string,
        faceCode: number,
        roleFlags: number,
        edgeMask: number
    ) => {
        const fd = computeFaceData(faceName, w, h, t);
        const faceHoles = collectFaceHoles(features, faceName, fd.width, fd.height, t);
        const startIndex = iOffset;

        const origX = fd.origin[0], origY = fd.origin[1], origZ = fd.origin[2];
        const uAxX = fd.uAxis[0], uAxY = fd.uAxis[1], uAxZ = fd.uAxis[2];
        const vAxX = fd.vAxis[0], vAxY = fd.vAxis[1], vAxZ = fd.vAxis[2];
        const nx = fd.normal[0], ny = fd.normal[1], nz = fd.normal[2];

        // Ścieżka szybka: brak otworów na ścianie (prosty quad)
        if (faceHoles.length === 0) {
            const startVert = vOffset / VERTEX_STRIDE_FLOATS;
            const fw = fd.width;
            const fh = fd.height;

            // Narożnik 0: (0, 0)
            vBuf[vOffset++] = origX;
            vBuf[vOffset++] = origY;
            vBuf[vOffset++] = origZ;
            vBuf[vOffset++] = nx; vBuf[vOffset++] = ny; vBuf[vOffset++] = nz;
            vBuf[vOffset++] = 0;  vBuf[vOffset++] = 0;

            // Narożnik 1: (fw, 0)
            vBuf[vOffset++] = origX + uAxX * fw;
            vBuf[vOffset++] = origY + uAxY * fw;
            vBuf[vOffset++] = origZ + uAxZ * fw;
            vBuf[vOffset++] = nx; vBuf[vOffset++] = ny; vBuf[vOffset++] = nz;
            vBuf[vOffset++] = fw; vBuf[vOffset++] = 0;

            // Narożnik 2: (fw, fh)
            vBuf[vOffset++] = origX + uAxX * fw + vAxX * fh;
            vBuf[vOffset++] = origY + uAxY * fw + vAxY * fh;
            vBuf[vOffset++] = origZ + uAxZ * fw + vAxZ * fh;
            vBuf[vOffset++] = nx; vBuf[vOffset++] = ny; vBuf[vOffset++] = nz;
            vBuf[vOffset++] = fw; vBuf[vOffset++] = fh;

            // Narożnik 3: (0, fh)
            vBuf[vOffset++] = origX + vAxX * fh;
            vBuf[vOffset++] = origY + vAxY * fh;
            vBuf[vOffset++] = origZ + vAxZ * fh;
            vBuf[vOffset++] = nx; vBuf[vOffset++] = ny; vBuf[vOffset++] = nz;
            vBuf[vOffset++] = 0;  vBuf[vOffset++] = fh;

            iBuf[iOffset++] = startVert;
            iBuf[iOffset++] = startVert + 1;
            iBuf[iOffset++] = startVert + 2;

            iBuf[iOffset++] = startVert;
            iBuf[iOffset++] = startVert + 2;
            iBuf[iOffset++] = startVert + 3;

            tBuf[tOffset++] = faceCode;
            tBuf[tOffset++] = startIndex;
            tBuf[tOffset++] = 6;
            tBuf[tOffset++] = roleFlags;
            tBuf[tOffset++] = edgeMask;
            tBuf[tOffset++] = 0;
            return;
        }

        // Ścieżka Fazy 2: triangulacja lica z otworami przez earcut na Float32Array
        const scratch2D = arena.scratch2D;
        const scratchHoleIndices = arena.scratchHoleIndices;
        scratchHoleIndices.length = 0;

        // 1. Obrys zewnętrzny lica (CCW w przestrzeni UV)
        scratch2D[0] = 0;        scratch2D[1] = 0;
        scratch2D[2] = fd.width; scratch2D[3] = 0;
        scratch2D[4] = fd.width; scratch2D[5] = fd.height;
        scratch2D[6] = 0;        scratch2D[7] = fd.height;

        let ptr2D = 8;

        for (let h = 0; h < faceHoles.length; h++) {
            const hole = faceHoles[h];
            scratchHoleIndices.push(ptr2D / 2);
            const cx = hole.cx;
            const cy = hole.cy;
            const r = hole.r;

            // Zapis 24 punktów okręgu w kolejności CW (zgodnej z wymaganiami earcut dla otworów)
            for (let s = 0; s < HOLE_SEGMENTS; s++) {
                scratch2D[ptr2D++] = cx + r * COS_CW[s];
                scratch2D[ptr2D++] = cy + r * SIN_CW[s];
            }
        }

        // Triangulacja czapki lica earcutem bezpośrednio z wycinka Float32Array
        const totalVerts2D = ptr2D / 2;
        const earcutIndices = earcut(
            scratch2D.subarray(0, ptr2D),
            scratchHoleIndices,
            2
        );

        const capStartVert = vOffset / VERTEX_STRIDE_FLOATS;

        // Analityczny zapis wierzchołków czapki lica do vBuf (bez alokacji)
        for (let i = 0; i < totalVerts2D; i++) {
            const u = scratch2D[i * 2];
            const v = scratch2D[i * 2 + 1];

            vBuf[vOffset++] = origX + uAxX * u + vAxX * v;
            vBuf[vOffset++] = origY + uAxY * u + vAxY * v;
            vBuf[vOffset++] = origZ + uAxZ * u + vAxZ * v;
            vBuf[vOffset++] = nx;
            vBuf[vOffset++] = ny;
            vBuf[vOffset++] = nz;
            vBuf[vOffset++] = u;
            vBuf[vOffset++] = v;
        }

        // Zapis trójkątów czapki do iBuf
        for (let i = 0; i < earcutIndices.length; i++) {
            iBuf[iOffset++] = capStartVert + earcutIndices[i];
        }

        // 2. Wektoryzowany zapis pobocznicy cylindrów i den otworów (Zero-Allocation)
        const topX = arena.holeTopX;
        const topY = arena.holeTopY;
        const topZ = arena.holeTopZ;
        const botX = arena.holeBotX;
        const botY = arena.holeBotY;
        const botZ = arena.holeBotZ;
        const nWallX = arena.holeNormX;
        const nWallY = arena.holeNormY;
        const nWallZ = arena.holeNormZ;

        for (let h = 0; h < faceHoles.length; h++) {
            const hole = faceHoles[h];
            const cx = hole.cx;
            const cy = hole.cy;
            const r = hole.r;
            const depth = hole.depth;

            // Środek otworu w 3D
            const cTopX = origX + uAxX * cx + vAxX * cy;
            const cTopY = origY + uAxY * cx + vAxY * cy;
            const cTopZ = origZ + uAxZ * cx + vAxZ * cy;

            const cBotX = cTopX - nx * depth;
            const cBotY = cTopY - ny * depth;
            const cBotZ = cTopZ - nz * depth;

            // Prekalkulacja 24 punktów 3D na obwodzie otworu w rejestrach
            for (let s = 0; s < HOLE_SEGMENTS; s++) {
                const cosVal = COS_CW[s] * r;
                const sinVal = SIN_CW[s] * r;

                const dx = uAxX * cosVal + vAxX * sinVal;
                const dy = uAxY * cosVal + vAxY * sinVal;
                const dz = uAxZ * cosVal + vAxZ * sinVal;

                topX[s] = cTopX + dx;
                topY[s] = cTopY + dy;
                topZ[s] = cTopZ + dz;

                botX[s] = cBotX + dx;
                botY[s] = cBotY + dy;
                botZ[s] = cBotZ + dz;

                // Normalna ścianki cylindra (skierowana do wnętrza otworu)
                const len = Math.hypot(dx, dy, dz) || 1;
                nWallX[s] = -dx / len;
                nWallY[s] = -dy / len;
                nWallZ[s] = -dz / len;
            }

            // a) Ścianki boczne cylindra (24 quady = 48 trójkątów)
            for (let s = 0; s < HOLE_SEGMENTS; s++) {
                const nextS = (s + 1) % HOLE_SEGMENTS;
                const quadStartVert = vOffset / VERTEX_STRIDE_FLOATS;

                const wallNx = (nWallX[s] + nWallX[nextS]) * 0.5;
                const wallNy = (nWallY[s] + nWallY[nextS]) * 0.5;
                const wallNz = (nWallZ[s] + nWallZ[nextS]) * 0.5;

                // Vert 0: Top0
                vBuf[vOffset++] = topX[s]; vBuf[vOffset++] = topY[s]; vBuf[vOffset++] = topZ[s];
                vBuf[vOffset++] = wallNx;  vBuf[vOffset++] = wallNy;  vBuf[vOffset++] = wallNz;
                vBuf[vOffset++] = 0;       vBuf[vOffset++] = 0;

                // Vert 1: Top1
                vBuf[vOffset++] = topX[nextS]; vBuf[vOffset++] = topY[nextS]; vBuf[vOffset++] = topZ[nextS];
                vBuf[vOffset++] = wallNx;      vBuf[vOffset++] = wallNy;      vBuf[vOffset++] = wallNz;
                vBuf[vOffset++] = 0;           vBuf[vOffset++] = 0;

                // Vert 2: Bot1
                vBuf[vOffset++] = botX[nextS]; vBuf[vOffset++] = botY[nextS]; vBuf[vOffset++] = botZ[nextS];
                vBuf[vOffset++] = wallNx;      vBuf[vOffset++] = wallNy;      vBuf[vOffset++] = wallNz;
                vBuf[vOffset++] = 0;           vBuf[vOffset++] = 0;

                // Vert 3: Bot0
                vBuf[vOffset++] = botX[s]; vBuf[vOffset++] = botY[s]; vBuf[vOffset++] = botZ[s];
                vBuf[vOffset++] = wallNx;  vBuf[vOffset++] = wallNy;  vBuf[vOffset++] = wallNz;
                vBuf[vOffset++] = 0;       vBuf[vOffset++] = 0;

                // 2 trójkąty ścianki
                iBuf[iOffset++] = quadStartVert;
                iBuf[iOffset++] = quadStartVert + 1;
                iBuf[iOffset++] = quadStartVert + 2;

                iBuf[iOffset++] = quadStartVert;
                iBuf[iOffset++] = quadStartVert + 2;
                iBuf[iOffset++] = quadStartVert + 3;
            }

            // b) Dno otworu ślepego (24 trójkąty wachlarza z normalną przeciwną do lica)
            if (!hole.isThrough) {
                const bottomNx = -nx;
                const bottomNy = -ny;
                const bottomNz = -nz;

                for (let s = 0; s < HOLE_SEGMENTS; s++) {
                    const nextS = (s + 1) % HOLE_SEGMENTS;
                    const triStartVert = vOffset / VERTEX_STRIDE_FLOATS;

                    // Vert 0: Bottom Center
                    vBuf[vOffset++] = cBotX;   vBuf[vOffset++] = cBotY;   vBuf[vOffset++] = cBotZ;
                    vBuf[vOffset++] = bottomNx; vBuf[vOffset++] = bottomNy; vBuf[vOffset++] = bottomNz;
                    vBuf[vOffset++] = cx;      vBuf[vOffset++] = cy;

                    // Vert 1: pBot0
                    vBuf[vOffset++] = botX[s]; vBuf[vOffset++] = botY[s]; vBuf[vOffset++] = botZ[s];
                    vBuf[vOffset++] = bottomNx; vBuf[vOffset++] = bottomNy; vBuf[vOffset++] = bottomNz;
                    vBuf[vOffset++] = 0;       vBuf[vOffset++] = 0;

                    // Vert 2: pBot1
                    vBuf[vOffset++] = botX[nextS]; vBuf[vOffset++] = botY[nextS]; vBuf[vOffset++] = botZ[nextS];
                    vBuf[vOffset++] = bottomNx;    vBuf[vOffset++] = bottomNy;    vBuf[vOffset++] = bottomNz;
                    vBuf[vOffset++] = 0;           vBuf[vOffset++] = 0;

                    iBuf[iOffset++] = triStartVert;
                    iBuf[iOffset++] = triStartVert + 1;
                    iBuf[iOffset++] = triStartVert + 2;
                }
            }
        }

        // Zapis rekordu do tabeli topologii
        tBuf[tOffset++] = faceCode;
        tBuf[tOffset++] = startIndex;
        tBuf[tOffset++] = iOffset - startIndex;
        tBuf[tOffset++] = roleFlags | ROLE_FLAGS.HOLE;
        tBuf[tOffset++] = edgeMask;
        tBuf[tOffset++] = 0;
    };

    // Synteza 6 ścian
    writeFace('FACE_Z_PLUS',  FACE_CODES.FACE_Z_PLUS,  ROLE_FLAGS.FACE_LICO, 0);
    writeFace('FACE_Z_MINUS', FACE_CODES.FACE_Z_MINUS, ROLE_FLAGS.FACE_LICO, 0);
    writeFace('FACE_X_PLUS',  FACE_CODES.FACE_X_PLUS,  ROLE_FLAGS.EDGE_BAND, 0x01);
    writeFace('FACE_X_MINUS', FACE_CODES.FACE_X_MINUS, ROLE_FLAGS.EDGE_BAND, 0x02);
    writeFace('FACE_Y_PLUS',  FACE_CODES.FACE_Y_PLUS,  ROLE_FLAGS.EDGE_BAND, 0x04);
    writeFace('FACE_Y_MINUS', FACE_CODES.FACE_Y_MINUS, ROLE_FLAGS.EDGE_BAND, 0x08);

    const totalVerts = vOffset / VERTEX_STRIDE_FLOATS;
    return {
        vertices: vBuf.subarray(0, vOffset),
        indices: iBuf.subarray(0, iOffset),
        brepCorners: bBuf.subarray(0, 24),
        topology: tBuf.subarray(0, tOffset),
        vertexCount: totalVerts,
        indexCount: iOffset,
        faceCount: 6,
    };
}

/**
 * Buduje geometrię formatki z opcjonalnymi nawiertami/otworami walcowymi,
 * zwracając widoki siatek ścian i krawędzie B-rep zgodne z NativePanelBuilder/PanelView.
 */
export function buildBoxPanelMeshData(
    w: number,
    h: number,
    t: number,
    features?: any[]
): BoxPanelMeshData {
    const buffers = buildBoxContinuousBuffers(w, h, t, features);

    const hw = w * 0.5;
    const hh = h * 0.5;
    const ht = t * 0.5;

    const xMin = -hw;
    const xMax = hw;
    const yMin = -hh;
    const yMax = hh;
    const zMin = -ht;
    const zMax = ht;

    const p0 = [xMin, yMin, zMin]; // 0: tyl_dol_lewo
    const p1 = [xMax, yMin, zMin]; // 1: tyl_dol_prawo
    const p2 = [xMax, yMin, zMax]; // 2: przod_dol_prawo
    const p3 = [xMin, yMin, zMax]; // 3: przod_dol_lewo
    const p4 = [xMin, yMax, zMin]; // 4: tyl_gora_lewo
    const p5 = [xMax, yMax, zMin]; // 5: tyl_gora_prawo
    const p6 = [xMax, yMax, zMax]; // 6: przod_gora_prawo
    const p7 = [xMin, yMax, zMax]; // 7: przod_gora_lewo

    // 12 krawędzi nominalnych formatki prostopadłościennej
    const edges: BoxPanelEdge[] = [
        { key: 'dol_tyl',     points: [p0, p1], faces: ['FACE_Y_MINUS', 'FACE_Z_MINUS'], alias: 'dol_tyl' },
        { key: 'dol_przod',   points: [p3, p2], faces: ['FACE_Y_MINUS', 'FACE_Z_PLUS'],  alias: 'dol_przod' },
        { key: 'gora_tyl',    points: [p4, p5], faces: ['FACE_Y_PLUS',  'FACE_Z_MINUS'], alias: 'gora_tyl' },
        { key: 'gora_przod',  points: [p7, p6], faces: ['FACE_Y_PLUS',  'FACE_Z_PLUS'],  alias: 'gora_przod' },
        { key: 'tyl_lewo',    points: [p0, p4], faces: ['FACE_Z_MINUS', 'FACE_X_MINUS'], alias: 'tyl_lewo' },
        { key: 'tyl_prawo',   points: [p1, p5], faces: ['FACE_Z_MINUS', 'FACE_X_PLUS'],  alias: 'tyl_prawo' },
        { key: 'przod_lewo',  points: [p3, p7], faces: ['FACE_Z_PLUS',  'FACE_X_MINUS'], alias: 'przod_lewo' },
        { key: 'przod_prawo', points: [p2, p6], faces: ['FACE_Z_PLUS',  'FACE_X_PLUS'],  alias: 'przod_prawo' },
        { key: 'dol_lewo',    points: [p0, p3], faces: ['FACE_Y_MINUS', 'FACE_X_MINUS'], alias: 'dol_lewo' },
        { key: 'dol_prawo',   points: [p1, p2], faces: ['FACE_Y_MINUS', 'FACE_X_PLUS'],  alias: 'dol_prawo' },
        { key: 'gora_lewo',   points: [p4, p7], faces: ['FACE_Y_PLUS',  'FACE_X_MINUS'], alias: 'gora_lewo' },
        { key: 'gora_prawo',  points: [p5, p6], faces: ['FACE_Y_PLUS',  'FACE_X_PLUS'],  alias: 'gora_prawo' },
    ];

    // Ekstrakcja siatek poszczególnych ścian z ciągłych buforów
    const extractFaceMesh = (
        faceName: string,
        faceIndex: number,
        edgeKey?: '+X' | '-X' | '+Y' | '-Y'
    ): BoxPanelFaceMesh => {
        const topOffset = faceIndex * TOPOLOGY_RECORD_INTS;
        const indexStart = buffers.topology[topOffset + 1];
        const indexCount = buffers.topology[topOffset + 2];

        // Wyciągamy podindeksy danej ściany
        const rawIndices = buffers.indices.subarray(indexStart, indexStart + indexCount);

        let minV = Infinity;
        let maxV = -Infinity;
        for (let i = 0; i < indexCount; i++) {
            const v = rawIndices[i];
            if (v < minV) minV = v;
            if (v > maxV) maxV = v;
        }

        const faceVertCount = (maxV >= minV) ? (maxV - minV + 1) : 0;
        const positions = new Float32Array(faceVertCount * 3);
        const brepPositions = new Float64Array(faceVertCount * 3);
        const normals = new Float32Array(faceVertCount * 3);
        const remappedIndices = new Uint32Array(indexCount);

        for (let i = 0; i < faceVertCount; i++) {
            const globalV = minV + i;
            const srcOffset = globalV * VERTEX_STRIDE_FLOATS;
            const dstOffset = i * 3;

            const px = buffers.vertices[srcOffset];
            const py = buffers.vertices[srcOffset + 1];
            const pz = buffers.vertices[srcOffset + 2];

            positions[dstOffset]     = px;
            positions[dstOffset + 1] = py;
            positions[dstOffset + 2] = pz;

            brepPositions[dstOffset]     = px;
            brepPositions[dstOffset + 1] = py;
            brepPositions[dstOffset + 2] = pz;

            normals[dstOffset]     = buffers.vertices[srcOffset + 3];
            normals[dstOffset + 1] = buffers.vertices[srcOffset + 4];
            normals[dstOffset + 2] = buffers.vertices[srcOffset + 5];
        }

        for (let i = 0; i < indexCount; i++) {
            remappedIndices[i] = rawIndices[i] - minV;
        }

        return {
            positions,
            brepPositions,
            indices: remappedIndices,
            normals,
            edgeKey,
        };
    };

    // Krawędzie B-rep okręgów nawiertów (e_hole_${id}${suffix})
    if (features && features.length > 0) {
        const faceNames = ['FACE_Z_PLUS', 'FACE_Z_MINUS', 'FACE_X_PLUS', 'FACE_X_MINUS', 'FACE_Y_PLUS', 'FACE_Y_MINUS'];
        for (let fn = 0; fn < faceNames.length; fn++) {
            const faceName = faceNames[fn];
            const fd = computeFaceData(faceName, w, h, t);
            const faceHoles = collectFaceHoles(features, faceName, fd.width, fd.height, t);

            const origX = fd.origin[0], origY = fd.origin[1], origZ = fd.origin[2];
            const uAxX = fd.uAxis[0], uAxY = fd.uAxis[1], uAxZ = fd.uAxis[2];
            const vAxX = fd.vAxis[0], vAxY = fd.vAxis[1], vAxZ = fd.vAxis[2];

            for (let h = 0; h < faceHoles.length; h++) {
                const hole = faceHoles[h];
                const circlePts: number[][] = [];
                const cx = hole.cx;
                const cy = hole.cy;
                const r = hole.r;

                const cTopX = origX + uAxX * cx + vAxX * cy;
                const cTopY = origY + uAxY * cx + vAxY * cy;
                const cTopZ = origZ + uAxZ * cx + vAxZ * cy;

                for (let s = 0; s <= HOLE_SEGMENTS; s++) {
                    const idx = s % HOLE_SEGMENTS;
                    const cosVal = COS_CCW[idx] * r;
                    const sinVal = SIN_CCW[idx] * r;

                    circlePts.push([
                        cTopX + uAxX * cosVal + vAxX * sinVal,
                        cTopY + uAxY * cosVal + vAxY * sinVal,
                        cTopZ + uAxZ * cosVal + vAxZ * sinVal
                    ]);
                }

                edges.push({
                    key: `e_hole_${hole.featId}${hole.suffix}`,
                    points: circlePts,
                    faces: [faceName, faceName],
                });
            }
        }
    }

    return {
        FACE_Z_PLUS:  extractFaceMesh('FACE_Z_PLUS',  0),
        FACE_Z_MINUS: extractFaceMesh('FACE_Z_MINUS', 1),
        FACE_X_PLUS:  extractFaceMesh('FACE_X_PLUS',  2, '+X'),
        FACE_X_MINUS: extractFaceMesh('FACE_X_MINUS', 3, '-X'),
        FACE_Y_PLUS:  extractFaceMesh('FACE_Y_PLUS',  4, '+Y'),
        FACE_Y_MINUS: extractFaceMesh('FACE_Y_MINUS', 5, '-Y'),
        vertices: [p0, p1, p2, p3, p4, p5, p6, p7],
        edges,
        continuousBuffers: buffers,
    };
}
