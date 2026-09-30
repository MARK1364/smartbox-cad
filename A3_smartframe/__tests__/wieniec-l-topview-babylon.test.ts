import { describe, it, expect } from 'vitest';
import { planCabinet } from '../smartframe-engine.js';
import { computeOutlineCapVertices } from '../../A4_smartpanel/native_core/polygon-extrusion.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { cadToRender, cadMatrixToRenderMatrix } from '../../A1_core/cad-math/coord-system.js';

/** Jak scene-sync: pozycja cadToRender + rotacja P·R·P. Rzut z góry = Babylon (X, Z). */
function outlineTopViewXZ(part: any): { x: number; z: number }[] {
    const outline = part.customProperties.outline2d as number[][];
    const { topPts } = computeOutlineCapVertices(outline, part.dim.x, part.dim.y, part.dim.z);
    const rot = part.lcs?.rotation || [0, 0, 0];
    const qCad = Quat.fromEulerXYZ(
        (rot[0] * Math.PI) / 180,
        (rot[1] * Math.PI) / 180,
        (rot[2] * Math.PI) / 180
    );
    const bPos = cadToRender(new Vec3(part.loc.x, part.loc.y, part.loc.z));
    const rotBab = cadMatrixToRenderMatrix(Mat4.fromQuaternion(qCad));

    return topPts.map(([lx, ly, lz]) => {
        const local = new Vec3(lx, ly, lz);
        const dir = rotBab.transformPoint(local);
        return { x: bPos.x + dir.x, z: bPos.z + dir.z };
    });
}

describe('wieniec L na rzucie z góry (Babylon XZ)', () => {
    const W = 900;
    const D = 900;
    const Ax = 600;
    const Ay = 700;

    it('narożnik L góry = dołu = koniec BOK_L / BOK_P', () => {
        const plan = planCabinet({
            szerokosc_mm: W,
            wysokosc_mm: 720,
            glebokosc_mm: D,
            liczba_stref: 1,
            typ_korpusu: 'korpus_rogowy90',
            glebokosc_boku_lewego_mm: Ax,
            glebokosc_boku_prawego_mm: Ay,
        });

        const top = plan.parts.find(p => p.role === 'TOP_PANEL')!;
        const bot = plan.parts.find(p => p.role === 'BOTTOM_PANEL')!;
        const bokL = plan.parts.find(p => String(p.key).includes('BOK_L'))!;
        const bokP = plan.parts.find(p => String(p.key).includes('BOK_P'))!;

        // BOK w CAD → rzut z góry Babylon XZ = CAD (x,y)
        const bokLInner = cadToRender(
            new Vec3(bokL.loc.x + bokL.dim.x / 2, bokL.loc.y, bokL.loc.z)
        );
        const bokPInner = cadToRender(
            new Vec3(bokP.loc.x, bokP.loc.y - bokP.dim.y / 2, bokP.loc.z)
        );

        const expectX = -W / 2 + Ax;
        const expectZ = D / 2 - Ay; // CAD Y → Babylon Z
        expect(bokLInner.x).toBeCloseTo(expectX, 5);
        expect(bokPInner.z).toBeCloseTo(expectZ, 5);

        const plateW = top.dim.x;
        const plateD = top.dim.y;
        const topOutline = top.customProperties.outline2d as number[][];
        const botOutline = bot.customProperties.outline2d as number[][];
        const topIdx = topOutline.findIndex(
            ([u, v]) => Math.abs(u - Ax) < 0.1 && Math.abs(v - (plateD - Ay)) < 0.1
        );
        // Dół [90,180,0]: lustro U — narożnik L na (plateW−Ax, plateD−Ay)
        const botIdx = botOutline.findIndex(
            ([u, v]) => Math.abs(u - (plateW - Ax)) < 0.1 && Math.abs(v - (plateD - Ay)) < 0.1
        );

        const topPts = outlineTopViewXZ(top);
        const botPts = outlineTopViewXZ(bot);
        const topC = topPts[topIdx];
        const botC = botPts[botIdx];

        // Cały obrys L: góra i dół muszą dać ten sam wielokąt na rzucie XZ
        const topAll = outlineTopViewXZ(top);
        const botAll = outlineTopViewXZ(bot);
        const key = (p: { x: number; z: number }) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
        const topSet = new Set(topAll.map(key));
        const botSet = new Set(botAll.map(key));
        for (const k of topSet) {
            expect(botSet.has(k)).toBe(true);
        }
        expect(topSet.size).toBe(6);
        expect(botSet.size).toBe(6);

        expect(topC.x).toBeCloseTo(expectX, 3);
        expect(topC.z).toBeCloseTo(expectZ, 3);
        expect(botC.x).toBeCloseTo(expectX, 3);
        expect(botC.z).toBeCloseTo(expectZ, 3);
        expect(topC.x).toBeCloseTo(botC.x, 3);
        expect(topC.z).toBeCloseTo(botC.z, 3);

        // Krawędź wcięcia przy BOK_P: do INNER, nie 300 mm do OUTER (W − Ax)
        const bokPTh = bokP.dim.z;
        const toBokPInner = (W / 2 - bokPTh) - expectX;
        expect(toBokPInner).toBeCloseTo(W - Ax - bokPTh, 5);
        expect(Math.abs(toBokPInner - (W - Ax))).toBeGreaterThan(1);
    });
});
