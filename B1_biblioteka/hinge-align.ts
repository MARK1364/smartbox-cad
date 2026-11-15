/**
 * Baza orientacji zawiasu na licu frontu (bez Babylon).
 * Model GLB (blum zawiasy.glb w przestrzeni instancji):
 *  +Z = w głąb płyty frontu (puszka), −Z = ramię w głąb korpusu, −X = w stronę boczku (prowadnik na płaszczyźnie YZ).
 */

export type HingeAlignOrientation = 'left' | 'right' | 'top' | 'bottom';

export interface HingeAlignAxes {
    xDir: [number, number, number];
    yDir: [number, number, number];
    zDir: [number, number, number];
}

function neg(v: [number, number, number]): [number, number, number] {
    return [-v[0], -v[1], -v[2]];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function dot(a: [number, number, number], b: [number, number, number]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Kierunek do krawędzi boczku / wieńca w przestrzeni lica (= −xDir modelu). */
export function hingeArmDir(axes: HingeAlignAxes): [number, number, number] {
    return neg(axes.xDir);
}

/** Kierunek osi puszki w głąb płyty frontu (= +zDir modelu). */
export function hingeCupDir(axes: HingeAlignAxes): [number, number, number] {
    return axes.zDir;
}

export function resolveHingeAlignAxes(
    uAxis: [number, number, number],
    vAxis: [number, number, number],
    normal: [number, number, number],
    orientation: HingeAlignOrientation | boolean
): HingeAlignAxes {
    const zDir = neg(normal);
    let xDir: [number, number, number];
    let yDir: [number, number, number];

    if (orientation === 'top') {
        xDir = neg(vAxis);
        yDir = neg(uAxis);
    } else if (orientation === 'bottom') {
        xDir = [...vAxis];
        yDir = [...uAxis];
    } else if (orientation === 'left' || orientation === true) {
        xDir = [...uAxis];
        yDir = neg(vAxis);
    } else {
        xDir = neg(uAxis);
        yDir = [...vAxis];
    }

    return { xDir, yDir, zDir };
}

/** det(x,y,z) ≈ 1 dla bazy prawoskrętnej. */
export function hingeAlignHandedness(axes: HingeAlignAxes): number {
    return dot(cross(axes.xDir, axes.yDir), axes.zDir);
}
