import { describe, it, expect } from 'vitest';
import { buildPolygonPanelTopology } from '../native_core/polygon-extrusion.js';

function pointInTri(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
    const v0x = cx - ax, v0y = cy - ay;
    const v1x = bx - ax, v1y = by - ay;
    const v2x = px - ax, v2y = py - ay;
    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    const inv = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * inv;
    const v = (dot00 * dot12 - dot01 * dot02) * inv;
    return u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6;
}

function xyFromPositions(pos: number[], i: number) {
    return { x: pos[i * 3], y: pos[i * 3 + 1] };
}

function faceCoversXY(face: { positions: number[]; indices: number[] }, x: number, y: number) {
    const { positions: p, indices } = face;
    for (let t = 0; t < indices.length; t += 3) {
        const a = xyFromPositions(p, indices[t]);
        const b = xyFromPositions(p, indices[t + 1]);
        const c = xyFromPositions(p, indices[t + 2]);
        if (pointInTri(x, y, a.x, a.y, b.x, b.y, c.x, c.y)) return true;
    }
    return false;
}

describe('L cap nie wypełnia wcięcia', () => {
    const plateW = 882;
    const plateD = 882;
    const armU = 600;
    const outlineTop = [
        [0, 0],
        [armU, 0],
        [armU, plateD - 600],
        [plateW, plateD - 600],
        [plateW, plateD],
        [0, plateD],
    ];

    it('otwór L (u>armU, v małe) pusty na PLUS i MINUS — ten sam XY', () => {
        const mesh = buildPolygonPanelTopology({
            outline2d: outlineTop,
            plateW,
            plateD,
            thickness: 18,
        });
        // lokalnie: x = -W/2+u, y = -D/2+v
        const holeX = -plateW / 2 + armU + 50; // w wcięciu
        const holeY = -plateD / 2 + 50;
        const solidX = -plateW / 2 + 50; // ramię przy −X
        const solidY = -plateD / 2 + 50;

        expect(faceCoversXY(mesh.FACE_Z_PLUS, solidX, solidY)).toBe(true);
        expect(faceCoversXY(mesh.FACE_Z_MINUS, solidX, solidY)).toBe(true);
        expect(faceCoversXY(mesh.FACE_Z_PLUS, holeX, holeY)).toBe(false);
        expect(faceCoversXY(mesh.FACE_Z_MINUS, holeX, holeY)).toBe(false);
    });
});
