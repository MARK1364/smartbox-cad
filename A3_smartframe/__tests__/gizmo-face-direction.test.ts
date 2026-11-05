/**
 * Kontrakt kierunku gizm krawędzi korpusu: kula na ścianie FACE_* formatki musi sterować
 * offsetem, który przesuwa DOKŁADNIE tę stronę (nie przeciwną) i w tym samym znaku, w którym
 * użytkownik ciągnie (na zewnątrz = +). Chroni przed zamianą lewej/prawej krawędzi i znaków shift.
 *
 * Konwencja lokalna meshu: X = szerokość, Y = grubość (FACE_Z_*), Z = wysokość 2D (FACE_Y_*).
 */
import { describe, it, expect } from 'vitest';
import { planCabinet, applyLcsMapping } from '../smartframe-engine.js';
import { Quat } from '../../A1_core/cad-math/quat';
import { korpusOffsetGizmoHandler } from '../korpus-offset-gizmo.js';

type V3 = [number, number, number];

function rot(q: any, v: V3): V3 {
    const [x, y, z] = v;
    const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x);
    return [
        x + q.w * tx + (q.y * tz - q.z * ty),
        y + q.w * ty + (q.z * tx - q.x * tz),
        z + q.w * tz + (q.x * ty - q.y * tx)
    ];
}

function worldBox(part: any) {
    const m = applyLcsMapping(part.dim, part.lcs);
    const r = part.lcs?.rotation ?? [0, 0, 0];
    const q = Quat.fromEulerXYZ(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180);
    const loc = [part.loc.x, part.loc.y, part.loc.z];
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const p = rot(q, [sx * m.x / 2, sy * m.z / 2, sz * m.y / 2]);
        for (let i = 0; i < 3; i++) {
            mn[i] = Math.min(mn[i], p[i] + loc[i]);
            mx[i] = Math.max(mx[i], p[i] + loc[i]);
        }
    }
    return { mn, mx, q };
}

const BASE = { szerokosc_mm: 1000, wysokosc_mm: 750, glebokosc_mm: 600, liczba_stref: 1 } as any;
const LOCAL_NORMAL: Record<string, V3> = {
    FACE_X_PLUS: [1, 0, 0], FACE_X_MINUS: [-1, 0, 0],
    FACE_Y_PLUS: [0, 0, 1], FACE_Y_MINUS: [0, 0, -1]
};
const PANEL_ROLES = ['LEFT_SIDE_PANEL', 'RIGHT_SIDE_PANEL', 'BOTTOM_PANEL', 'TOP_PANEL'];

describe('gizmo krawędzi korpusu — kierunek i znak', () => {
    const base = planCabinet({ ...BASE }).parts as any[];

    for (const role of PANEL_ROLES) {
        it(`${role}: kula na ścianie przesuwa właśnie tę krawędź na zewnątrz (+10 → rośnie ta strona)`, () => {
            const part = base.find(p => p.role === role)!;
            const b0 = worldBox(part);
            const faceMap = korpusOffsetGizmoHandler.getFaceMapping(role, undefined) as Record<string, string>;
            for (const [face, key] of Object.entries(faceMap)) {
                const n = LOCAL_NORMAL[face];
                if (!n) continue;
                const wn = rot(b0.q, n).map(Math.round);
                const axis = wn.findIndex(v => v !== 0);
                const out = wn[axis];
                const trial = planCabinet({ ...BASE, offsets: { [`${part.name}_${key}`]: 10 } }).parts as any[];
                const b1 = worldBox(trial.find(p => p.key === part.key));
                const moveMax = b1.mx[axis] - b0.mx[axis];
                const moveMin = b1.mn[axis] - b0.mn[axis];
                if (out > 0) {
                    expect(moveMax, `${role} ${face}→${key}`).toBeCloseTo(10);
                    expect(moveMin, `${role} ${face}→${key} (przeciwna strona stoi)`).toBeCloseTo(0);
                } else {
                    expect(moveMin, `${role} ${face}→${key}`).toBeCloseTo(-10);
                    expect(moveMax, `${role} ${face}→${key} (przeciwna strona stoi)`).toBeCloseTo(0);
                }
            }
        });

        it(`${role}: znak kuli środkowej (shift) = kierunek ruchu płyty`, () => {
            const part = base.find(p => p.role === role)!;
            const spec: any = korpusOffsetGizmoHandler.getShift(role);
            const ax = ['X', 'Y', 'Z'].indexOf(spec.cadAxis);
            const b0 = worldBox(part);
            const trial = planCabinet({ ...BASE, offsets: { [`${part.name}_${spec.paramSuffix}`]: 10 } }).parts as any[];
            const b1 = worldBox(trial.find(p => p.key === part.key));
            const centerMove = ((b1.mn[ax] + b1.mx[ax]) - (b0.mn[ax] + b0.mx[ax])) / 2;
            // użytkownik ciągnie o d → wartość = sign * d, więc +10 ma przesunąć płytę o sign * 10
            expect(centerMove).toBeCloseTo(spec.sign * 10);
        });
    }

    it('lewy bok: dodatni shiftX NIE jest zamieniony z prawym (lewy -X na zewnątrz, prawy +X na zewnątrz)', () => {
        const l = (planCabinet({ ...BASE, offsets: { Bok_L_shiftX: 10 } }).parts as any[]).find(p => p.role === 'LEFT_SIDE_PANEL');
        const r = (planCabinet({ ...BASE, offsets: { Bok_P_shiftX: 10 } }).parts as any[]).find(p => p.role === 'RIGHT_SIDE_PANEL');
        const l0 = base.find(p => p.role === 'LEFT_SIDE_PANEL');
        const r0 = base.find(p => p.role === 'RIGHT_SIDE_PANEL');
        expect(l.loc.x - l0.loc.x).toBeCloseTo(-10);
        expect(r.loc.x - r0.loc.x).toBeCloseTo(10);
    });
});
