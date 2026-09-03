/**
 * SmartPanel Web — CAD Math: Vec3
 *
 * Ujednolicony wektor 3D dla domeny CAD.
 * Zero zależności od Babylon.js, OCCT, DOM.
 *
 * Jednostki: zgodne z kontekstem wywołania (zwykle mm w domenie CAD).
 * Kompatybilny z istniejącym Vector3D z cnc-geometry-utils.ts — Vec3
 * może być używany zamiennie wszędzie, gdzie używano { x, y, z }.
 */

export class Vec3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;

    static readonly ZERO = new Vec3(0, 0, 0);
    static readonly ONE  = new Vec3(1, 1, 1);
    static readonly UNIT_X = new Vec3(1, 0, 0);
    static readonly UNIT_Y = new Vec3(0, 1, 0);
    static readonly UNIT_Z = new Vec3(0, 0, 1);

    constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // ─── Fabryki ─────────────────────────────────────────────

    static from(v: { x: number; y: number; z: number }): Vec3 {
        return new Vec3(v.x, v.y, v.z);
    }

    static fromArray(arr: [number, number, number] | number[]): Vec3 {
        return new Vec3(arr[0], arr[1], arr[2]);
    }

    // ─── Operacje podstawowe ─────────────────────────────────

    add(other: Vec3): Vec3 {
        return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    sub(other: Vec3): Vec3 {
        return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    scale(s: number): Vec3 {
        return new Vec3(this.x * s, this.y * s, this.z * s);
    }

    negate(): Vec3 {
        return new Vec3(-this.x, -this.y, -this.z);
    }

    // ─── Algebra wektorowa ───────────────────────────────────

    dot(other: Vec3): number {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    cross(other: Vec3): Vec3 {
        return new Vec3(
            this.y * other.z - this.z * other.y,
            this.z * other.x - this.x * other.z,
            this.x * other.y - this.y * other.x
        );
    }

    lengthSquared(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    length(): number {
        return Math.sqrt(this.lengthSquared());
    }

    normalize(): Vec3 {
        const len = this.length();
        if (len < 1e-10) return Vec3.ZERO;
        return this.scale(1 / len);
    }

    distanceTo(other: Vec3): number {
        return this.sub(other).length();
    }

    distanceSquaredTo(other: Vec3): number {
        return this.sub(other).lengthSquared();
    }

    // ─── Transformacje ───────────────────────────────────────

    /**
     * Transformuje punkt przez macierz 4×4 (stosuje translację).
     * Używać dla pozycji/punktów.
     */
    transformByMat4(m: import('./mat4.js').Mat4): Vec3 {
        return m.transformPoint(this);
    }

    /**
     * Transformuje kierunek przez macierz 4×4 (ignoruje translację).
     * Używać dla normalnych i osi.
     */
    transformDirectionByMat4(m: import('./mat4.js').Mat4): Vec3 {
        return m.transformDirection(this);
    }

    // ─── Porównania ──────────────────────────────────────────

    equals(other: Vec3, eps: number = 1e-9): boolean {
        return (
            Math.abs(this.x - other.x) <= eps &&
            Math.abs(this.y - other.y) <= eps &&
            Math.abs(this.z - other.z) <= eps
        );
    }

    // ─── Konwersja ───────────────────────────────────────────

    clone(): Vec3 {
        return new Vec3(this.x, this.y, this.z);
    }

    toArray(): [number, number, number] {
        return [this.x, this.y, this.z];
    }

    toPlain(): { x: number; y: number; z: number } {
        return { x: this.x, y: this.y, z: this.z };
    }

    toString(): string {
        return `Vec3(${this.x.toFixed(4)}, ${this.y.toFixed(4)}, ${this.z.toFixed(4)})`;
    }
}
