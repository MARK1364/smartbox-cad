/**
 * SmartPanel Web — CAD Math: Quat (Quaternion)
 *
 * Kwaternion jednostkowy do reprezentacji obrotów w domenie CAD.
 * Zero zależności od Babylon.js, OCCT, DOM.
 *
 * Konwencja: q = (x, y, z, w) gdzie w to część skalarna.
 * Kolejność mnożenia: this × other (right-to-left, jak OpenGL / glMatrix).
 */

import { Vec3 } from './vec3.js';
import type { Mat4 } from './mat4.js';

export class Quat {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;

    static readonly IDENTITY = new Quat(0, 0, 0, 1);

    constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    // ─── Fabryki ─────────────────────────────────────────────

    /**
     * Kwaternion z kątów Eulera XYZ (w radianach).
     * Kolejność aplikacji: najpierw X, potem Y, potem Z (extrinsic).
     * Odpowiada domyślnej kolejności Blendera i CNC.
     */
    static fromEulerXYZ(rx: number, ry: number, rz: number): Quat {
        const cx = Math.cos(rx * 0.5);
        const sx = Math.sin(rx * 0.5);
        const cy = Math.cos(ry * 0.5);
        const sy = Math.sin(ry * 0.5);
        const cz = Math.cos(rz * 0.5);
        const sz = Math.sin(rz * 0.5);

        return new Quat(
            sx * cy * cz + cx * sy * sz,
            cx * sy * cz - sx * cy * sz,
            cx * cy * sz + sx * sy * cz,
            cx * cy * cz - sx * sy * sz
        );
    }

    /**
     * Kwaternion z obrotu o kąt (rad) wokół osi.
     */
    static fromAxisAngle(axis: Vec3, angle: number): Quat {
        const n = axis.normalize();
        const half = angle * 0.5;
        const s = Math.sin(half);
        return new Quat(n.x * s, n.y * s, n.z * s, Math.cos(half));
    }

    /**
     * Kwaternion z macierzy rotacji (górna lewa część Mat4, column-major).
     * d[col*4 + row] — konwencja column-major.
     */
    static fromMat4(m: import('./mat4.js').Mat4): Quat {
        const d = m.data;
        // column-major: element [row][col] = d[col*4 + row]
        const m00 = d[0],  m10 = d[1],  m20 = d[2];   // col 0
        const m01 = d[4],  m11 = d[5],  m21 = d[6];   // col 1
        const m02 = d[8],  m12 = d[9],  m22 = d[10];  // col 2

        const trace = m00 + m11 + m22;
        let x: number, y: number, z: number, w: number;

        if (trace > 0) {
            const s = 0.5 / Math.sqrt(trace + 1.0);
            w = 0.25 / s;
            x = (m21 - m12) * s;
            y = (m02 - m20) * s;
            z = (m10 - m01) * s;
        } else if (m00 > m11 && m00 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
            w = (m21 - m12) / s;
            x = 0.25 * s;
            y = (m01 + m10) / s;
            z = (m02 + m20) / s;
        } else if (m11 > m22) {
            const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
            w = (m02 - m20) / s;
            x = (m01 + m10) / s;
            y = 0.25 * s;
            z = (m12 + m21) / s;
        } else {
            const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
            w = (m10 - m01) / s;
            x = (m02 + m20) / s;
            y = (m12 + m21) / s;
            z = 0.25 * s;
        }

        return new Quat(x, y, z, w).normalize();
    }

    // ─── Operacje ─────────────────────────────────────────────

    multiply(other: Quat): Quat {
        return new Quat(
            this.w * other.x + this.x * other.w + this.y * other.z - this.z * other.y,
            this.w * other.y - this.x * other.z + this.y * other.w + this.z * other.x,
            this.w * other.z + this.x * other.y - this.y * other.x + this.z * other.w,
            this.w * other.w - this.x * other.x - this.y * other.y - this.z * other.z
        );
    }

    inverse(): Quat {
        // Dla kwaterniona jednostkowego: odwrotność = sprzężony
        return new Quat(-this.x, -this.y, -this.z, this.w);
    }

    conjugate(): Quat {
        return new Quat(-this.x, -this.y, -this.z, this.w);
    }

    lengthSquared(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    }

    length(): number {
        return Math.sqrt(this.lengthSquared());
    }

    normalize(): Quat {
        const len = this.length();
        if (len < 1e-10) return Quat.IDENTITY;
        const inv = 1 / len;
        return new Quat(this.x * inv, this.y * inv, this.z * inv, this.w * inv);
    }

    /** Obrót wektora przez kwaternion: q * v * q^-1 */
    rotateVec3(v: Vec3): Vec3 {
        // Efektywna formuła Rodriguesa
        const qv = new Vec3(this.x, this.y, this.z);
        const t = qv.cross(v).scale(2);
        return v.add(t.scale(this.w)).add(qv.cross(t));
    }

    /**
     * Konwersja do kątów Eulera XYZ (w radianach).
     * Używać tylko do wyświetlenia w UI — przechowuj zawsze jako Quat.
     */
    toEulerXYZ(): { x: number; y: number; z: number } {
        const { x, y, z, w } = this;

        // Roll (X)
        const sinr_cosp = 2 * (w * x + y * z);
        const cosr_cosp = 1 - 2 * (x * x + y * y);
        const rx = Math.atan2(sinr_cosp, cosr_cosp);

        // Pitch (Y) — clamp dla gimbal lock
        const sinp = 2 * (w * y - z * x);
        const ry = Math.abs(sinp) >= 1
            ? Math.sign(sinp) * (Math.PI / 2)
            : Math.asin(sinp);

        // Yaw (Z)
        const siny_cosp = 2 * (w * z + x * y);
        const cosy_cosp = 1 - 2 * (y * y + z * z);
        const rz = Math.atan2(siny_cosp, cosy_cosp);

        return { x: rx, y: ry, z: rz };
    }

    // ─── Slerp ───────────────────────────────────────────────

    /** Sferyczna interpolacja liniowa */
    slerp(other: Quat, t: number): Quat {
        let dot = this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;

        // Flip jeśli kąt > 180°
        let ox = other.x, oy = other.y, oz = other.z, ow = other.w;
        if (dot < 0) {
            dot = -dot;
            ox = -ox; oy = -oy; oz = -oz; ow = -ow;
        }

        if (dot > 0.9995) {
            // Prawie identyczne — interpolacja liniowa
            return new Quat(
                this.x + t * (ox - this.x),
                this.y + t * (oy - this.y),
                this.z + t * (oz - this.z),
                this.w + t * (ow - this.w)
            ).normalize();
        }

        const theta0 = Math.acos(dot);
        const theta = theta0 * t;
        const sinTheta = Math.sin(theta);
        const sinTheta0 = Math.sin(theta0);

        const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
        const s1 = sinTheta / sinTheta0;

        return new Quat(
            s0 * this.x + s1 * ox,
            s0 * this.y + s1 * oy,
            s0 * this.z + s1 * oz,
            s0 * this.w + s1 * ow
        );
    }

    // ─── Porównania i konwersja ───────────────────────────────

    equals(other: Quat, eps: number = 1e-9): boolean {
        return (
            Math.abs(this.x - other.x) <= eps &&
            Math.abs(this.y - other.y) <= eps &&
            Math.abs(this.z - other.z) <= eps &&
            Math.abs(this.w - other.w) <= eps
        );
    }

    clone(): Quat {
        return new Quat(this.x, this.y, this.z, this.w);
    }

    toArray(): [number, number, number, number] {
        return [this.x, this.y, this.z, this.w];
    }

    toPlain(): { x: number; y: number; z: number; w: number } {
        return { x: this.x, y: this.y, z: this.z, w: this.w };
    }

    toString(): string {
        return `Quat(${this.x.toFixed(4)}, ${this.y.toFixed(4)}, ${this.z.toFixed(4)}, ${this.w.toFixed(4)})`;
    }
}
