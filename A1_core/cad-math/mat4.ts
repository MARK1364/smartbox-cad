/**
 * SmartPanel Web — CAD Math: Mat4
 *
 * Macierz 4×4 (Float64Array, column-major) do transformacji w domenie CAD.
 * Zero zależności od Babylon.js, OCCT, DOM.
 *
 * KONWENCJA: column-major, wektory kolumnowe (OpenGL / Babylon.js / glMatrix).
 *
 * Układ pamięci (column-major) — każda kolumna to kolejne 4 elementy:
 *   [ 0  4  8  12 ]   ← wiersz 0 (Xx, Yx, Zx, Tx)
 *   [ 1  5  9  13 ]   ← wiersz 1 (Xy, Yy, Zy, Ty)
 *   [ 2  6  10 14 ]   ← wiersz 2 (Xz, Yz, Zz, Tz)
 *   [ 3  7  11 15 ]   ← wiersz 3 (0,  0,  0,  1 )
 *
 *   Kolumna 0: oś X   = d[0..3]
 *   Kolumna 1: oś Y   = d[4..7]
 *   Kolumna 2: oś Z   = d[8..11]
 *   Kolumna 3: translacja = d[12..15]
 *
 * Mnożenie: this × other (wektory kolumnowe po prawej stronie: v' = M × v).
 */

import { Vec3 } from './vec3.js';
import { Quat } from './quat.js';

export class Mat4 {
    /** Column-major Float64Array, długość 16. */
    readonly data: Float64Array;

    constructor(data?: Float64Array | number[]) {
        if (data) {
            this.data = data instanceof Float64Array ? data : new Float64Array(data);
        } else {
            this.data = new Float64Array(16);
        }
    }

    // ─── Fabryki ─────────────────────────────────────────────

    static identity(): Mat4 {
        const d = new Float64Array(16);
        d[0] = 1; d[5] = 1; d[10] = 1; d[15] = 1;
        return new Mat4(d);
    }

    /**
     * Macierz translacji.
     * d[12]=x, d[13]=y, d[14]=z  (kolumna 3, column-major)
     */
    static fromTranslation(x: number, y: number, z: number): Mat4 {
        const d = new Float64Array(16);
        d[0] = 1; d[5] = 1; d[10] = 1; d[15] = 1;
        d[12] = x; d[13] = y; d[14] = z;
        return new Mat4(d);
    }

    static fromScale(sx: number, sy: number, sz: number): Mat4 {
        const d = new Float64Array(16);
        d[0] = sx; d[5] = sy; d[10] = sz; d[15] = 1;
        return new Mat4(d);
    }

    /**
     * Macierz rotacji z kwaterniona jednostkowego.
     * Kolumny = obrazy osi X, Y, Z po obrocie.
     *
     * Column-major layout:
     *   col0 (d[0..3])  = nowa oś X
     *   col1 (d[4..7])  = nowa oś Y
     *   col2 (d[8..11]) = nowa oś Z
     */
    static fromQuaternion(q: Quat): Mat4 {
        const { x, y, z, w } = q;
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        // column-major: d[col*4 + row]
        return new Mat4(new Float64Array([
            // col 0 (oś X)
            1 - (yy + zz),
            xy + wz,
            xz - wy,
            0,
            // col 1 (oś Y)
            xy - wz,
            1 - (xx + zz),
            yz + wx,
            0,
            // col 2 (oś Z)
            xz + wy,
            yz - wx,
            1 - (xx + yy),
            0,
            // col 3 (translacja = 0)
            0, 0, 0, 1
        ]));
    }

    /**
     * Macierz TRS (Translation × Rotation × Scale).
     * Skala domyślna (1,1,1).
     *
     * Wynik column-major: kolumny osi przeskalowane, translacja w kolumnie 3.
     */
    static fromTRS(
        translation: Vec3,
        rotation: Quat,
        scale: Vec3 = Vec3.ONE
    ): Mat4 {
        const r = Mat4.fromQuaternion(rotation);
        const d = r.data;
        const sx = scale.x, sy = scale.y, sz = scale.z;

        // Skalujemy każdą kolumnę osi przez odpowiednią składową skali.
        // Translacja trafia do kolumny 3 (indeksy 12–14).
        return new Mat4(new Float64Array([
            // col 0
            d[0] * sx,  d[1] * sx,  d[2] * sx,  0,
            // col 1
            d[4] * sy,  d[5] * sy,  d[6] * sy,  0,
            // col 2
            d[8] * sz,  d[9] * sz,  d[10] * sz, 0,
            // col 3
            translation.x, translation.y, translation.z, 1
        ]));
    }

    // ─── Operacje macierzowe ─────────────────────────────────

    /**
     * Mnożenie macierzy: C = this × other  (column-major, v' = C × v).
     *
     * Wzór elementu C[row][col]:
     *   C[row][col] = Σ_k  A[row][k] * B[k][col]
     *
     * W układzie column-major: element [row][col] to d[col*4 + row].
     */
    multiply(other: Mat4): Mat4 {
        const a = this.data;
        const b = other.data;
        const out = new Float64Array(16);

        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    // a[row][k] = a[k*4 + row]
                    // b[k][col] = b[col*4 + k]
                    sum += a[k * 4 + row] * b[col * 4 + k];
                }
                out[col * 4 + row] = sum;
            }
        }
        return new Mat4(out);
    }

    /**
     * Odwrócenie macierzy 4×4 (kofaktory / rozwinięcie Laplace'a).
     * Działa dla macierzy TRS (niesingularnych).
     * Zwraca identity gdy wyznacznik ≈ 0.
     */
    invert(): Mat4 {
        const m = this.data;
        const out = new Float64Array(16);

        // Kofaktory wyznacznika 4×4 (column-major indexing: m[col*4+row])
        const a00 = m[0],  a10 = m[1],  a20 = m[2],  a30 = m[3];
        const a01 = m[4],  a11 = m[5],  a21 = m[6],  a31 = m[7];
        const a02 = m[8],  a12 = m[9],  a22 = m[10], a32 = m[11];
        const a03 = m[12], a13 = m[13], a23 = m[14], a33 = m[15];

        const b00 = a00 * a11 - a10 * a01;
        const b01 = a00 * a21 - a20 * a01;
        const b02 = a00 * a31 - a30 * a01;
        const b03 = a10 * a21 - a20 * a11;
        const b04 = a10 * a31 - a30 * a11;
        const b05 = a20 * a31 - a30 * a21;
        const b06 = a02 * a13 - a12 * a03;
        const b07 = a02 * a23 - a22 * a03;
        const b08 = a02 * a33 - a32 * a03;
        const b09 = a12 * a23 - a22 * a13;
        const b10 = a12 * a33 - a32 * a13;
        const b11 = a22 * a33 - a32 * a23;

        const det =
            b00 * b11 - b01 * b10 + b02 * b09 +
            b03 * b08 - b04 * b07 + b05 * b06;

        if (Math.abs(det) < 1e-15) {
            console.warn('Mat4.invert(): macierz nieodwracalna, zwracam identity.');
            return Mat4.identity();
        }

        const inv = 1 / det;

        out[0]  = ( a11 * b11 - a21 * b10 + a31 * b09) * inv;
        out[1]  = (-a10 * b11 + a20 * b10 - a30 * b09) * inv;
        out[2]  = ( a13 * b05 - a23 * b04 + a33 * b03) * inv;
        out[3]  = (-a12 * b05 + a22 * b04 - a32 * b03) * inv;
        out[4]  = (-a01 * b11 + a21 * b08 - a31 * b07) * inv;
        out[5]  = ( a00 * b11 - a20 * b08 + a30 * b07) * inv;
        out[6]  = (-a03 * b05 + a23 * b02 - a33 * b01) * inv;
        out[7]  = ( a02 * b05 - a22 * b02 + a32 * b01) * inv;
        out[8]  = ( a01 * b10 - a11 * b08 + a31 * b06) * inv;
        out[9]  = (-a00 * b10 + a10 * b08 - a30 * b06) * inv;
        out[10] = ( a03 * b04 - a13 * b02 + a33 * b00) * inv;
        out[11] = (-a02 * b04 + a12 * b02 - a32 * b00) * inv;
        out[12] = (-a01 * b09 + a11 * b07 - a21 * b06) * inv;
        out[13] = ( a00 * b09 - a10 * b07 + a20 * b06) * inv;
        out[14] = (-a03 * b03 + a13 * b01 - a23 * b00) * inv;
        out[15] = ( a02 * b03 - a12 * b01 + a22 * b00) * inv;

        return new Mat4(out);
    }

    /**
     * Transpozycja (zamiana wierszy z kolumnami).
     * Dla macierzy ortogonalnych (czysty obrót) transpose() == invert() — szybsze.
     */
    transpose(): Mat4 {
        const m = this.data;
        return new Mat4(new Float64Array([
            m[0], m[4], m[8],  m[12],
            m[1], m[5], m[9],  m[13],
            m[2], m[6], m[10], m[14],
            m[3], m[7], m[11], m[15]
        ]));
    }

    // ─── Transformacje wektorów ──────────────────────────────

    /**
     * Transformuje punkt: v' = M × [x, y, z, 1]^T
     *
     * Column-major: wynik[row] = Σ_col  M[row][col] * v[col]
     *   M[row][col] = d[col*4 + row]
     */
    transformPoint(v: Vec3): Vec3 {
        const d = this.data;
        const x = v.x, y = v.y, z = v.z;
        // w = d[3]*x + d[7]*y + d[11]*z + d[15]  (zwykle = 1)
        const w = d[3] * x + d[7] * y + d[11] * z + d[15];
        const inv = (w !== 0 && w !== 1) ? 1 / w : 1;
        return new Vec3(
            (d[0] * x + d[4] * y + d[8]  * z + d[12]) * inv,
            (d[1] * x + d[5] * y + d[9]  * z + d[13]) * inv,
            (d[2] * x + d[6] * y + d[10] * z + d[14]) * inv
        );
    }

    /**
     * Transformuje kierunek: v' = M × [x, y, z, 0]^T
     * (ignoruje translację, stosować dla normalnych i osi)
     */
    transformDirection(v: Vec3): Vec3 {
        const d = this.data;
        const x = v.x, y = v.y, z = v.z;
        return new Vec3(
            d[0] * x + d[4] * y + d[8]  * z,
            d[1] * x + d[5] * y + d[9]  * z,
            d[2] * x + d[6] * y + d[10] * z
        );
    }

    // ─── Dekompozycja TRS ─────────────────────────────────────

    /**
     * Rozkłada macierz TRS na składowe Translation, Rotation (Quat), Scale.
     * Zakłada brak nachylenia (shear). Column-major.
     */
    decompose(): { translation: Vec3; rotation: Quat; scale: Vec3 } {
        const d = this.data;

        // Translacja = kolumna 3
        const translation = new Vec3(d[12], d[13], d[14]);

        // Skala = długość kolumn osi (col 0, 1, 2)
        const sx = Math.sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2]);
        const sy = Math.sqrt(d[4]*d[4] + d[5]*d[5] + d[6]*d[6]);
        const sz = Math.sqrt(d[8]*d[8] + d[9]*d[9] + d[10]*d[10]);
        const scale = new Vec3(sx, sy, sz);

        // Macierz czystej rotacji — normalizacja kolumn
        const invSx = sx > 1e-10 ? 1 / sx : 0;
        const invSy = sy > 1e-10 ? 1 / sy : 0;
        const invSz = sz > 1e-10 ? 1 / sz : 0;

        const rm = new Mat4(new Float64Array([
            // col 0
            d[0] * invSx, d[1] * invSx, d[2] * invSx, 0,
            // col 1
            d[4] * invSy, d[5] * invSy, d[6] * invSy, 0,
            // col 2
            d[8] * invSz, d[9] * invSz, d[10] * invSz, 0,
            // col 3
            0, 0, 0, 1
        ]));

        const rotation = Quat.fromMat4(rm);
        return { translation, rotation, scale };
    }

    // ─── Odczyt elementów ─────────────────────────────────────

    /** Translacja (kolumna 3 macierzy column-major). */
    getTranslation(): Vec3 {
        return new Vec3(this.data[12], this.data[13], this.data[14]);
    }

    // ─── Porównania i kopia ───────────────────────────────────

    equals(other: Mat4, eps: number = 1e-9): boolean {
        for (let i = 0; i < 16; i++) {
            if (Math.abs(this.data[i] - other.data[i]) > eps) return false;
        }
        return true;
    }

    clone(): Mat4 {
        return new Mat4(new Float64Array(this.data));
    }

    /**
     * Wyświetla macierz w układzie wierszy (czytelnie dla człowieka).
     * Pamiętaj: pamięć to column-major, ale wyświetlamy transpose.
     */
    toString(): string {
        const d = this.data;
        const fmt = (n: number) => n.toFixed(4).padStart(9);
        // Wyświetlamy wierszami: element[row][col] = d[col*4+row]
        return [
            `[ ${fmt(d[0])} ${fmt(d[4])} ${fmt(d[8])}  ${fmt(d[12])} ]`,
            `[ ${fmt(d[1])} ${fmt(d[5])} ${fmt(d[9])}  ${fmt(d[13])} ]`,
            `[ ${fmt(d[2])} ${fmt(d[6])} ${fmt(d[10])} ${fmt(d[14])} ]`,
            `[ ${fmt(d[3])} ${fmt(d[7])} ${fmt(d[11])} ${fmt(d[15])} ]`
        ].join('\n');
    }
}
