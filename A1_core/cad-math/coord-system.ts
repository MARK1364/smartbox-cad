/**
 * SmartPanel Web — CAD Math: Coord System (Układ Współrzędnych)
 *
 * JEDNO MIEJSCE dla całej konwersji osi między domeną CAD a Babylon.js.
 *
 * Układy współrzędnych:
 *   CAD  (Z-up,  prawoskrętny): X = szerokość, Y = głębokość, Z = wysokość
 *   Babylon (Y-up, lewoskrętny): X = prawo,    Y = góra,      Z = głębokość
 *
 * Konwersja wektorów:
 *   CAD(x, y, z) → Babylon(x, z, y)     [zamiana Y↔Z]
 *   Babylon(x, y, z) → CAD(x, z, y)     [ta sama operacja — symetryczna]
 *
 * UWAGA O SKRĘTNOŚCI:
 *   Zamiana dwóch osi (Y↔Z) odwraca skrętność układu (det macierzy = -1).
 *   Jest to CELOWE — Babylon.js jest lewoskrętny, CAD/CNC/Blender jest prawoskrętny.
 *   Ta macierz to macierz zmiany bazy (nie rotacja), i jej zastosowanie:
 *     M_babylon = P × M_cad × P^T
 *   daje poprawną reprezentację tej samej transformacji w drugim układzie.
 *   Normalne i obroty zachowują się spójnie o ile KONSEKWENTNIE używamy tej konwersji.
 *
 * Zastępuje 6+ rozproszonych miejsc z // CAD Y = 3D Z / CAD Z = 3D Y
 *
 * Zero zależności od Babylon.js, OCCT, DOM.
 */

import { Vec3 } from './vec3.js';
import { Mat4 } from './mat4.js';

// ─── Macierz zmiany bazy (stała) ─────────────────────────────────────────────

/**
 * Macierz zmiany bazy CAD→Babylon (i Babylon→CAD, bo P = P^-1 = P^T).
 *
 * Realizuje zamianę Y↔Z:
 *   CAD X → Babylon X  (bez zmiany)
 *   CAD Y → Babylon Z  (głębokość)
 *   CAD Z → Babylon Y  (góra)
 *
 * Column-major layout (d[col*4 + row]):
 *   col0=[1,0,0,0]  col1=[0,0,1,0]  col2=[0,1,0,0]  col3=[0,0,0,1]
 *
 * det = -1 (zmiana skrętności — to poprawne i oczekiwane).
 * P^T = P^-1 = P  (macierz jest inwolucją — P² = I).
 */
const COORD_CHANGE = new Mat4(new Float64Array([
    // col 0   col 1   col 2   col 3
    1, 0, 0, 0,   // row: X→X
    0, 0, 1, 0,   // row: Y→Z (CAD Y staje się Babylon Z)
    0, 1, 0, 0,   // row: Z→Y (CAD Z staje się Babylon Y)
    0, 0, 0, 1
]));

// ─── Konwersje punktów/wektorów ──────────────────────────────────────────────

/**
 * Konwertuje punkt lub kierunek z układu CAD (Z-up) do Babylon.js (Y-up).
 *
 * @example
 * cadToRender(new Vec3(300, 250, 720))  // → Vec3(300, 720, 250)
 * //                    x    y    z              x    z    y
 */
export function cadToRender(v: Vec3): Vec3 {
    return new Vec3(v.x, v.z, v.y);
}

/**
 * Konwertuje punkt lub kierunek z Babylon.js (Y-up) do układu CAD (Z-up).
 * Operacja symetryczna do cadToRender.
 *
 * @example
 * renderToCAD(new Vec3(300, 720, 250))  // → Vec3(300, 250, 720)
 */
export function renderToCAD(v: Vec3): Vec3 {
    return new Vec3(v.x, v.z, v.y);
}

// ─── Konwersje macierzy ──────────────────────────────────────────────────────

/**
 * Konwertuje macierz TRS z układu CAD (Z-up) do Babylon.js (Y-up).
 *
 * Wzór: M_babylon = P × M_cad × P^T
 * gdzie P = COORD_CHANGE (macierz zmiany bazy, P^T = P^-1 = P).
 *
 * Poprawnie przekształca zarówno rotację jak i translację.
 */
export function cadMatrixToRenderMatrix(m: Mat4): Mat4 {
    return COORD_CHANGE.multiply(m).multiply(COORD_CHANGE);
}

/**
 * Konwertuje macierz TRS z Babylon.js (Y-up) do układu CAD (Z-up).
 * Ta sama operacja (P jest inwolucją).
 */
export function renderMatrixToCADMatrix(m: Mat4): Mat4 {
    return COORD_CHANGE.multiply(m).multiply(COORD_CHANGE);
}

// ─── Eksport (dla zaawansowanych przypadków) ─────────────────────────────────

export { COORD_CHANGE };

// ─── Stałe osi w układzie CAD ─────────────────────────────────────────────────

/** Oś szerokości (prawo) w układzie CAD = X */
export const CAD_AXIS_WIDTH  = Vec3.UNIT_X;
/** Oś głębokości (przód) w układzie CAD = Y */
export const CAD_AXIS_DEPTH  = Vec3.UNIT_Y;
/** Oś wysokości (góra) w układzie CAD = Z */
export const CAD_AXIS_HEIGHT = Vec3.UNIT_Z;

// ─── Mapowanie osi CAD ↔ Babylon (dla skrótów X/Y/Z w UI i PMI) ─────────────

export type CadAxisKey = 'X' | 'Y' | 'Z' | 'x' | 'y' | 'z';

/**
 * Skrót osi w nomenklaturze CAD → kierunek jednostkowy w przestrzeni Babylon.
 *
 * CAD: X=szerokość, Y=głębokość, Z=wysokość
 * Babylon: X=szerokość, Y=wysokość(CAD Z), Z=głębokość(CAD Y)
 */
export function cadAxisKeyToRenderDirection(key: string): Vec3 {
    switch ((key || 'X').toUpperCase()) {
        case 'Y': return new Vec3(0, 0, 1);  // CAD głębokość → Babylon Z
        case 'Z': return new Vec3(0, 1, 0);  // CAD wysokość → Babylon Y
        default: return new Vec3(1, 0, 0);
    }
}

/** Dominująca oś CAD dla wektora podanego w współrzędnych Babylon. */
export function dominantCadAxisFromRenderDelta(dx: number, dy: number, dz: number): 'X' | 'Y' | 'Z' {
    const ax = Math.abs(dx);
    const ay = Math.abs(dz); // CAD Y = render Z
    const az = Math.abs(dy); // CAD Z = render Y
    if (ax >= ay && ax >= az) return 'X';
    if (ay >= ax && ay >= az) return 'Y';
    return 'Z';
}

/**
 * Ogranicza wektor przesunięcia do jednej osi w układzie CAD (X=szer, Y=głęb, Z=wys).
 * Używane przez modal G i skróty X/Y/Z — nomenklatura CAD/GCS projektu, nie Babylon.
 */
export function lockCadDelta(cadDelta: Vec3, axis: CadAxisKey | 'none'): Vec3 {
    if (axis === 'none') return cadDelta;
    switch (axis.toUpperCase()) {
        case 'X':
            return new Vec3(cadDelta.x, 0, 0);
        case 'Y':
            return new Vec3(0, cadDelta.y, 0);
        case 'Z':
            return new Vec3(0, 0, cadDelta.z);
        default:
            return cadDelta;
    }
}

/** Osie CAD jako kierunki świata wyprowadzone z macierzy Babylon (column-major). */
export function cadAxesFromRenderMatrix(matrixWorld: Float64Array | number[]): Record<'X' | 'Y' | 'Z', Vec3> {
    const colX = new Vec3(matrixWorld[0], matrixWorld[1], matrixWorld[2]);
    const colRenderY = new Vec3(matrixWorld[4], matrixWorld[5], matrixWorld[6]);
    const colRenderZ = new Vec3(matrixWorld[8], matrixWorld[9], matrixWorld[10]);
    const norm = (v: Vec3, fallback: Vec3) => {
        const n = v.normalize();
        return n.length() > 1e-9 ? n : fallback;
    };
    return {
        X: norm(colX, Vec3.UNIT_X),
        Y: norm(colRenderZ, cadAxisKeyToRenderDirection('Y')),
        Z: norm(colRenderY, cadAxisKeyToRenderDirection('Z')),
    };
}
