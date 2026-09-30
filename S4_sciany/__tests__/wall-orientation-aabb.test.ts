import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { CreateSmartWallCommand } from '../commands/create-smartwall-command.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Mat4 } from '../../A1_core/cad-math/mat4.js';
import { cadMatrixToRenderMatrix, cadToRender } from '../../A1_core/cad-math/coord-system.js';
import '../../src/application/project-domain.js';

/**
 * AABB w przestrzeni Babylon — jak SceneSync (P·R·P + cadToRender).
 * Mesh lokalny (W,H,T) jest w osiach CAD panelu; wierzchołki nie są osobno zamieniane Y↔Z.
 */
function babylonAabbSize(node: any) {
    const p = node.domainData;
    const { translation, rotation } = node.localMatrix.decompose();
    const hw = nmToMm(p.width) / 2;
    const hh = nmToMm(p.height) / 2;
    const ht = nmToMm(p.thickness) / 2;
    const corners = [
        [-hw, -hh, -ht], [hw, -hh, -ht], [-hw, hh, -ht], [hw, hh, -ht],
        [-hw, -hh, ht], [hw, -hh, ht], [-hw, hh, ht], [hw, hh, ht],
    ];
    const rotBab = cadMatrixToRenderMatrix(Mat4.fromQuaternion(rotation));
    const bPos = cadToRender(new Vec3(
        nmToMm(translation.x),
        nmToMm(translation.y),
        nmToMm(translation.z),
    ));
    const world = corners.map(([x, y, z]) => {
        const dir = rotBab.transformPoint(new Vec3(x, y, z));
        return { x: bPos.x + dir.x, y: bPos.y + dir.y, z: bPos.z + dir.z };
    });
    const xs = world.map((c) => c.x);
    const ys = world.map((c) => c.y);
    const zs = world.map((c) => c.z);
    return {
        x: Math.max(...xs) - Math.min(...xs),
        y: Math.max(...ys) - Math.min(...ys), // Babylon up
        z: Math.max(...zs) - Math.min(...zs),
    };
}

describe('SmartWall Babylon orientation', () => {
    it('FRONT/BACK pionowe w widoku (nie jak podłoga)', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({
            preset: 'rect',
            roomWidth: 4000,
            roomDepth: 3000,
            wallHeight: 2700,
            wallThickness: 100,
        }).execute(doc);

        const parts = doc.getContainers()[0].children.filter((c) => c.nodeType === NodeType.PART);
        const front = parts.find((c) => (c.domainData as any).key === 'WALL_FRONT')!;
        const back = parts.find((c) => (c.domainData as any).key === 'WALL_BACK')!;
        const left = parts.find((c) => (c.domainData as any).key === 'WALL_LEFT')!;
        const right = parts.find((c) => (c.domainData as any).key === 'WALL_RIGHT')!;

        expect((front.domainData as any).lcs.rotation).toEqual([0, 0, 0]);
        expect((back.domainData as any).lcs.rotation).toEqual([180, 0, 0]);

        const f = babylonAabbSize(front);
        const b = babylonAabbSize(back);
        const l = babylonAabbSize(left);
        const r = babylonAabbSize(right);

        // Pion = duży rozmiar w Babylon Y (góra), mała grubość w Z (głębokość) dla F/B
        expect(f.y).toBeGreaterThan(2600);
        expect(f.x).toBeGreaterThan(3900);
        expect(f.z).toBeLessThan(150);

        expect(b.y).toBeGreaterThan(2600);
        expect(b.x).toBeGreaterThan(3900);
        expect(b.z).toBeLessThan(150);

        // Boki: pion w Y, grubość w X
        expect(l.y).toBeGreaterThan(2600);
        expect(l.z).toBeGreaterThan(2900);
        expect(l.x).toBeLessThan(150);

        expect(r.y).toBeGreaterThan(2600);
        expect(r.z).toBeGreaterThan(2900);
        expect(r.x).toBeLessThan(150);
    });

    it('FLOOR leży płasko (5. element pokoju), front do góry', () => {
        const doc = new ProjectDocument();
        new CreateSmartWallCommand({
            preset: 'rect',
            roomWidth: 4000,
            roomDepth: 3000,
            wallHeight: 2700,
            wallThickness: 100,
        }).execute(doc);

        const parts = doc.getContainers()[0].children.filter((c) => c.nodeType === NodeType.PART);
        const floor = parts.find((c) => (c.domainData as any).key === 'FLOOR')!;
        expect(floor).toBeDefined();
        expect((floor.domainData as any).lcs.rotation).toEqual([90, 0, 0]);

        const f = babylonAabbSize(floor);
        // Cienka w pionie (Y Babylon = góra), rozległa w poziomie
        expect(f.y).toBeLessThan(150);
        expect(f.x).toBeGreaterThan(4100);
        expect(f.z).toBeGreaterThan(3100);
    });
});
