import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../smartframe-adapter.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { cadToRender, cadMatrixToRenderMatrix } from '../../A1_core/cad-math/coord-system.js';
import { computeOutlineCapVertices, buildPolygonPanelTopology } from '../../A4_smartpanel/native_core/polygon-extrusion.js';
import { ContainerModel } from '../../A1_core/container-model.js';

function pointInTri(
    px: number, py: number,
    ax: number, ay: number, bx: number, by: number, cx: number, cy: number
) {
    const v0x = cx - ax, v0y = cy - ay;
    const v1x = bx - ax, v1y = by - ay;
    const v2x = px - ax, v2y = py - ay;
    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    const den = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(den) < 1e-18) return false;
    const inv = 1 / den;
    const u = (dot11 * dot02 - dot01 * dot12) * inv;
    const v = (dot00 * dot12 - dot01 * dot02) * inv;
    return u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6;
}

function faceCoversXZ(
    positions: number[],
    indices: number[],
    toXZ: (x: number, y: number, z: number) => { x: number; z: number },
    x: number,
    z: number
) {
    for (let t = 0; t < indices.length; t += 3) {
        const ia = indices[t] * 3, ib = indices[t + 1] * 3, ic = indices[t + 2] * 3;
        const a = toXZ(positions[ia], positions[ia + 1], positions[ia + 2]);
        const b = toXZ(positions[ib], positions[ib + 1], positions[ib + 2]);
        const c = toXZ(positions[ic], positions[ic + 1], positions[ic + 2]);
        if (pointInTri(x, z, a.x, a.z, b.x, b.z, c.x, c.z)) return true;
    }
    return false;
}

function meshToWorldXZ(node: any, localX: number, localY: number, localZ: number) {
    const { translation, rotation } = node.localMatrix.decompose();
    const tMm = new Vec3(nmToMm(translation.x), nmToMm(translation.y), nmToMm(translation.z));
    const bPos = cadToRender(tMm);
    const rotBab = cadMatrixToRenderMatrix(Mat4.fromQuaternion(rotation));
    const dir = rotBab.transformPoint(new Vec3(localX, localY, localZ));
    return { x: bPos.x + dir.x, z: bPos.z + dir.z };
}

describe('wieniec L po applyPlan â€” rzut z gĂłry', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
    });

    it('otwĂłr L gĂłry i doĹ‚u w tym samym miejscu; krawÄ™dĹş przy BOK_P = reszta do INNER, nie 300 mm', () => {
        const W = 900, D = 900, Ax = 600, Ay = 600;
        const cabinet = doc.createAssembly({ name: 'Rogowy90' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_rogowy90',
            liczba_stref: 1,
            glebokosc_boku_lewego_mm: Ax,
            glebokosc_boku_prawego_mm: Ay
        };
        runEngineAndApply(cabinet, W, 720, D, 1, 0, 0, 0);

        const cntNode = doc.findNode(cabinet.id)!;
        const topNode = cntNode.children.find((c: any) => c.domainData?.role === 'TOP_PANEL')!;
        const botNode = cntNode.children.find((c: any) => c.domainData?.role === 'BOTTOM_PANEL')!;
        const bokP = cntNode.children.find((c: any) =>
            String(c.domainData?.key || c.name || '').toUpperCase().includes('BOK_P')
        )!;
        expect(topNode).toBeDefined();
        expect(botNode).toBeDefined();

        const top = topNode.domainData as any;
        const bot = botNode.domainData as any;
        const topOutline = top.custom_properties?.outline2d;
        const botOutline = bot.custom_properties?.outline2d;
        expect(topOutline?.length).toBe(6);
        expect(botOutline?.length).toBe(6);

        const topW = nmToMm(top.width);
        const topH = nmToMm(top.height);
        const topT = nmToMm(top.thickness);
        const botW = nmToMm(bot.width);
        const botH = nmToMm(bot.height);
        const botT = nmToMm(bot.thickness);

        const topMesh = buildPolygonPanelTopology({
            outline2d: topOutline, plateW: topW, plateD: topH, thickness: topT
        });
        const botMesh = buildPolygonPanelTopology({
            outline2d: botOutline, plateW: botW, plateD: botH, thickness: botT
        });

        const topToXZ = (x: number, y: number, z: number) => meshToWorldXZ(topNode, x, y, z);
        const botToXZ = (x: number, y: number, z: number) => meshToWorldXZ(botNode, x, y, z);

        const innerX = -W / 2 + Ax;
        const innerZ = D / 2 - Ay;
        const bokPData = bokP.domainData as any;
        const bokPTh = nmToMm(bokPData?.thickness || bokPData?.dim?.z || 18_000_000);
        const bokPInnerX = W / 2 - bokPTh;
        const notchLen = bokPInnerX - innerX;

        expect(notchLen).toBeCloseTo(W - Ax - bokPTh, 3);
        expect(notchLen).not.toBeCloseTo(W - Ax, 0);

        const holeX = (innerX + bokPInnerX) / 2;
        const holeZ = (-D / 2 + innerZ) / 2;

        const topVisible = topMesh.FACE_Z_MINUS;
        const botVisible = botMesh.FACE_Z_PLUS;
        expect(faceCoversXZ(topVisible.positions, topVisible.indices, topToXZ, holeX, holeZ)).toBe(false);
        expect(faceCoversXZ(botVisible.positions, botVisible.indices, botToXZ, holeX, holeZ)).toBe(false);

        const solidX = -W / 2 + 40;
        const solidZ = -D / 2 + 40;
        expect(faceCoversXZ(topVisible.positions, topVisible.indices, topToXZ, solidX, solidZ)).toBe(true);
        expect(faceCoversXZ(botVisible.positions, botVisible.indices, botToXZ, solidX, solidZ)).toBe(true);

        const topCaps = computeOutlineCapVertices(topOutline, topW, topH, topT);
        const botCaps = computeOutlineCapVertices(botOutline, botW, botH, botT);
        const keyOf = (p: { x: number; z: number }) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
        const topSet = new Set(topCaps.bottomPts.map(([x, y, z]) => keyOf(topToXZ(x, y, z))));
        const botSet = new Set(botCaps.topPts.map(([x, y, z]) => keyOf(botToXZ(x, y, z))));
        for (const k of topSet) {
            expect(botSet.has(k), `gĂłra ${k} nie ma pary na dole; dĂłĹ‚=${[...botSet].join(' | ')}`).toBe(true);
        }

        const { translation: bokT } = bokP.localMatrix.decompose();
        const bokMm = new Vec3(nmToMm(bokT.x), nmToMm(bokT.y), nmToMm(bokT.z));
        expect(bokMm.x).toBeGreaterThan(0);
        expect(innerZ).toBeCloseTo(D / 2 - Ay, 5);
    });
});
