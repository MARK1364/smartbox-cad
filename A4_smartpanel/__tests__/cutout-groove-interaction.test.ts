import { describe, it, expect } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('Cutout & Groove interaction (e.g. Hangers on Side Panel with Back Groove)', () => {
    it('przycina wpust kolidujący z wycięciem brzegowym i zachowuje pełne ścianki wycięcia', () => {
        // Formatka 600x720x18 (bok szafki)
        // Wpust pod plecy: u = 13..16, v = 7..713, depth = 11
        // Wycięcie pod listwę zawieszki (cutout): u = -4..16, v = 602..702, depth = 20, through = true
        const panelData = {
            role: 'SIDE_PANEL',
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            features: [
                {
                    id: 'feat_back_groove_panel_1',
                    type: 'groove',
                    name: 'Wpust',
                    face: 'FACE_Z_PLUS',
                    params: {
                        isBackGroove: true,
                        u: 13,
                        v: 7,
                        width: 3,
                        length: 706,
                        depth: 11,
                        u_nm: mmToNm(13),
                        v_nm: mmToNm(7),
                        width_nm: mmToNm(3),
                        length_nm: mmToNm(706),
                        depth_nm: mmToNm(11)
                    }
                },
                {
                    id: 'feat_hanger_notch',
                    type: 'cutout',
                    face: 'FACE_Z_PLUS',
                    name: 'Wcięcie zawieszki',
                    params: {
                        u: -4,
                        v: 602,
                        width: 20,
                        length: 100,
                        depth: 20,
                        through: true,
                        polygon: [
                            [-4, 602],
                            [16, 602],
                            [16, 702],
                            [-4, 702]
                        ]
                    }
                }
            ]
        };

        const mesh = buildMeshFromPanel(panelData);

        // 1. Dno wpustu kończy się na v = 602 (Y = -360 + 602 = 242)
        const bottom = mesh.feature_feat_back_groove_panel_1_bottom;
        expect(bottom).toBeDefined();
        // Sprawdzamy Y max w dnie wpustu — musi wynosić 242 (nie 353 jak przed poprawką)
        const yCoords = [bottom.positions[1], bottom.positions[4], bottom.positions[7], bottom.positions[10]];
        const maxY = Math.max(...yCoords);
        expect(maxY).toBeCloseTo(242, 1);

        // 2. Ścianka boczna wcięcia (u = 16) ma pełną wysokość płyty 18 mm (od Z = -9 do +9)
        const side5 = mesh.OUTLINE_SIDE_5;
        expect(side5).toBeDefined();
        const zValues = [side5.positions[2], side5.positions[5], side5.positions[8], side5.positions[11]];
        expect(Math.max(...zValues)).toBeCloseTo(9, 1);
        expect(Math.min(...zValues)).toBeCloseTo(-9, 1);

        // 3. Lico FACE_Z_PLUS trianguluje się poprawnie (trójkąty istnieją)
        const fzPlus = mesh.FACE_Z_PLUS;
        expect(fzPlus.indices.length).toBeGreaterThan(0);

        // 4. Brak zbędnych krawędzi pionowych na zlicowanej płaszczyźnie X = -284 (u = 16) w zakresie Z od +9 do -2
        const edges = (mesh.edges || []) as Array<{ key: string; points: number[][] }>;
        const redundantEdges = edges.filter(e => {
            const p0 = e.points[0], p1 = e.points[1];
            if (!p0 || !p1) return false;
            const isAtX = Math.abs(p0[0] - (-284)) < 0.1 && Math.abs(p1[0] - (-284)) < 0.1;
            const isAtY = (Math.abs(p0[1] - 242) < 0.1 && Math.abs(p1[1] - 242) < 0.1) ||
                          (Math.abs(p0[1] - 342) < 0.1 && Math.abs(p1[1] - 342) < 0.1);
            const isVert = Math.abs(p0[2] - p1[2]) > 0.1;
            const touchesUpper = Math.max(p0[2], p1[2]) > 0.0;
            return isAtX && isAtY && isVert && touchesUpper;
        });
        expect(redundantEdges.length).toBe(0);
    });
});
