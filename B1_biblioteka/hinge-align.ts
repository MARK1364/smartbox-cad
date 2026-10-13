/**
 * Baza orientacji zawiasu na licu frontu (bez Babylon).
 * Model GLB: +X w głąb płyty, ramię prowadnika wzdłuż −Z ku krawędzi zawiasu.
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

/** Kierunek ramienia w przestrzeni lica (= −zDir modelu). */
export function hingeArmDir(axes: HingeAlignAxes): [number, number, number] {
    return neg(axes.zDir);
}

export function resolveHingeAlignAxes(
    uAxis: [number, number, number],
    vAxis: [number, number, number],
    normal: [number, number, number],
    orientation: HingeAlignOrientation | boolean
): HingeAlignAxes {
    const xDir = neg(normal);
    let yDir: [number, number, number];
    let zDir: [number, number, number];

    if (orientation === 'top') {
        yDir = [...uAxis];
        zDir = neg(vAxis);
    } else if (orientation === 'bottom') {
        yDir = neg(uAxis);
        zDir = [...vAxis];
    } else if (orientation === 'left' || orientation === true) {
        yDir = [...vAxis];
        zDir = [...uAxis];
    } else {
        yDir = neg(vAxis);
        zDir = neg(uAxis);
    }

    return { xDir, yDir, zDir };
}

/** det(x,y,z) ≈ 1 dla bazy prawoskrętnej. */
export function hingeAlignHandedness(axes: HingeAlignAxes): number {
    return dot(cross(axes.xDir, axes.yDir), axes.zDir);
}
