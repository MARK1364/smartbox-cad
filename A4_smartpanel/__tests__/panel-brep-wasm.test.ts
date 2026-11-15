import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

let wasmModule: any;

beforeAll(async () => {
    const wasmPath = path.join(ROOT_DIR, 'src', 'wasm', 'panel_brep', 'panel_brep_bg.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);
    wasmModule = await import('../../src/wasm/panel_brep/panel_brep.js');
    await wasmModule.default(wasmBuffer);
});

const W = 500;
const H = 800;
const T = 18;
const mm = (v: number) => Math.round(v * 1_000_000);

type Mesh = { positions: number[]; indices: number[] };

function xyArea(mesh: Mesh | undefined): number {
    if (!mesh || !mesh.positions.length || !mesh.indices.length) return 0;
    let total = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
        const i0 = mesh.indices[i] * 3;
        const i1 = mesh.indices[i + 1] * 3;
        const i2 = mesh.indices[i + 2] * 3;
        const x0 = mesh.positions[i0], y0 = mesh.positions[i0 + 1];
        const x1 = mesh.positions[i1], y1 = mesh.positions[i1 + 1];
        const x2 = mesh.positions[i2], y2 = mesh.positions[i2 + 1];
        total += Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) * 0.5;
    }
    return total;
}

function zLevels(mesh: Mesh | undefined): number[] {
    const levels = new Set<number>();
    for (let i = 2; i < (mesh?.positions.length ?? 0); i += 3) {
        levels.add(Math.round(mesh!.positions[i] * 1000) / 1000);
    }
    return [...levels].sort((a, b) => a - b);
}

function panelInput(features: any[]) {
    return { width_nm: mm(W), height_nm: mm(H), thickness_nm: mm(T), features };
}

function feat(id: string, type: string, params: Record<string, any>, face = 'FACE_Z_PLUS') {
    return { id, type, face, ...params };
}

function assertWatertight(brep: any) {
    expect(brep.topology.degenerate_faces).toBe(0);
    expect(brep.topology.boundary_edges).toBe(0);
    expect(brep.topology.non_manifold_edges).toBe(0);
    expect(brep.topology.watertight).toBe(true);
}

describe('WASM Panel B-Rep: Ramka + Rewizja', () => {
    it('Rewizja przecinająca ramkę (v=20..160) schodkuje ściankę (15mm w ramce, 18mm poza)', () => {
        const input = panelInput([
            feat('feat_rewizja', 'cutout', {
                u_mm: 100, v_mm: 20, w_mm: 120, l_mm: 140, depth_mm: T, through: true
            }),
            feat('feat_ramka', 'pocket', {
                u_mm: 60, v_mm: 60, w_mm: W - 120, l_mm: H - 120, depth_mm: 3, through: false
            }),
        ]);

        const result: any = wasmModule.build_panel_mesh(input);

        expect(result).toBeDefined();
        expect(result.FACE_Z_PLUS).toBeDefined();
        expect(result.FACE_Z_MINUS).toBeDefined();
        expect(result.feature_feat_ramka_bottom).toBeDefined();

        // 1. Dno ramki: ma wycięty otwór po rewizji w zakresie u in [100, 220], v in [60, 160]
        const ramkaBottom = result.feature_feat_ramka_bottom;
        const halfW = W / 2;
        const halfH = H / 2;

        for (let i = 0; i < ramkaBottom.indices.length; i += 3) {
            const i0 = ramkaBottom.indices[i] * 3;
            const i1 = ramkaBottom.indices[i + 1] * 3;
            const i2 = ramkaBottom.indices[i + 2] * 3;
            const cx = (ramkaBottom.positions[i0] + ramkaBottom.positions[i1] + ramkaBottom.positions[i2]) / 3;
            const cy = (ramkaBottom.positions[i0 + 1] + ramkaBottom.positions[i1 + 1] + ramkaBottom.positions[i2 + 1]) / 3;

            // X = u - halfW -> u in [100, 220] -> X in [-150, -30]
            // Y = v - halfH -> v in [60, 160]  -> Y in [-340, -240]
            const inHole = cx > -149 && cx < -31 && cy > -339 && cy < -241;
            expect(inHole).toBe(false);
        }

        // 2. Ścianka boczna w3 rewizji (u = 100):
        // W zakresie v=20..60 (poza ramką): góra na Z = +9 (głębokość 0), dół na Z = -9 (głębokość 18) -> wysokość 18mm
        // W zakresie v=60..160 (wewnątrz ramki): góra na Z = +6 (głębokość 3), dół na Z = -9 (głębokość 18) -> wysokość 15mm!
        const w3 = result.feature_feat_rewizja_w3;
        expect(w3).toBeDefined();
        expect(zLevels(w3)).toEqual([-9, 6, 9]);
    });

    it('zachowuje pola lic i dna ramki oraz domyka topologię B-Rep', () => {
        const input = panelInput([
            feat('feat_rewizja', 'cutout', {
                u_mm: 100, v_mm: 20, w_mm: 120, l_mm: 140, depth_mm: T, through: true
            }),
            feat('feat_ramka', 'pocket', {
                u_mm: 60, v_mm: 60, w_mm: W - 120, l_mm: H - 120, depth_mm: 3, through: false
            }),
        ]);

        const result: any = wasmModule.build_panel_mesh(input);
        const brep: any = wasmModule.build_panel_brep(input);

        expect(xyArea(result.FACE_Z_PLUS)).toBeCloseTo(136800, 1);
        expect(xyArea(result.FACE_Z_MINUS)).toBeCloseTo(400000 - 120 * 140, 1);
        expect(xyArea(result.feature_feat_ramka_bottom)).toBeCloseTo(258400 - 120 * 100, 1);
        assertWatertight(brep);
        expect(brep.topology.faces).toBeGreaterThan(10);
        expect(brep.topology.volume).toBeGreaterThan(0);

        // Wszystkie 12 krawędzi nominalnych + krawędzie cech.
        const edgeKeys = new Set(result.edges.map((e: any) => e.key));
        for (const key of [
            'dol_tyl', 'dol_przod', 'gora_tyl', 'gora_przod',
            'tyl_lewo', 'tyl_prawo', 'przod_lewo', 'przod_prawo',
            'dol_lewo', 'dol_prawo', 'gora_lewo', 'gora_prawo',
        ]) {
            expect(edgeKeys.has(key)).toBe(true);
        }
        expect(edgeKeys.has('e_groove_feat_rewizja_t1')).toBe(true);
        expect(edgeKeys.has('e_groove_feat_ramka_t1')).toBe(true);
    });

    it('lustrzanie obsługuje cechy na FACE_Z_MINUS', () => {
        const input = panelInput([
            feat('feat_rewizja', 'cutout', {
                u_mm: 100, v_mm: 20, w_mm: 120, l_mm: 140, depth_mm: T, through: true
            }, 'FACE_Z_MINUS'),
            feat('feat_ramka', 'pocket', {
                u_mm: 60, v_mm: 60, w_mm: W - 120, l_mm: H - 120, depth_mm: 3, through: false
            }, 'FACE_Z_MINUS'),
        ]);

        const result: any = wasmModule.build_panel_mesh(input);
        const brep: any = wasmModule.build_panel_brep(input);

        expect(xyArea(result.FACE_Z_MINUS)).toBeCloseTo(136800, 1);
        expect(xyArea(result.FACE_Z_PLUS)).toBeCloseTo(383200, 1);
        expect(xyArea(result.feature_feat_ramka_bottom)).toBeCloseTo(246400, 1);
        expect(zLevels(result.feature_feat_ramka_bottom)).toEqual([-6]);
        expect(zLevels(result.feature_feat_rewizja_w3)).toEqual([-9, -6, 9]);
        assertWatertight(brep);
    });

    it('tnie analityczne otwory przez i wgłębne oraz zachowuje klucze e_hole_*', () => {
        const input = panelInput([
            feat('h_through', 'hole', {
                u_mm: 100, v_mm: 100, diameter_mm: 35, depth_mm: T, through: true
            }),
            feat('h_blind', 'hole', {
                u_mm: 300, v_mm: 400, diameter_mm: 35, depth_mm: 12.5, through: false
            }),
        ]);

        const result: any = wasmModule.build_panel_mesh(input);
        const brep: any = wasmModule.build_panel_brep(input);
        const r = 17.5;
        const circle = 0.5 * 48 * r * r * Math.sin((2 * Math.PI) / 48);

        expect(xyArea(result.FACE_Z_MINUS)).toBeCloseTo(400000 - circle, 0);
        expect(xyArea(result.FACE_Z_PLUS)).toBeCloseTo(400000 - circle, 0);
        const edgeKeys = new Set(result.edges.map((e: any) => e.key));
        expect(edgeKeys.has('e_hole_h_through')).toBe(true);
        expect(edgeKeys.has('e_hole_h_blind')).toBe(true);
        expect(zLevels(result.FACE_Z_PLUS)).toEqual([-9, -3.5, 9]);
        assertWatertight(brep);
    });

    it('obsługuje zagnieżdżone kieszenie i zachowuje ich dna', () => {
        const input = panelInput([
            feat('p1', 'pocket', { u_mm: 50, v_mm: 50, w_mm: 300, l_mm: 500, depth_mm: 3 }),
            feat('p2', 'pocket', { u_mm: 100, v_mm: 100, w_mm: 200, l_mm: 400, depth_mm: 6 }),
            feat('p3', 'pocket', { u_mm: 150, v_mm: 200, w_mm: 100, l_mm: 200, depth_mm: 9 }),
        ]);

        const result: any = wasmModule.build_panel_mesh(input);
        const brep: any = wasmModule.build_panel_brep(input);

        expect(xyArea(result.feature_p1_bottom)).toBeCloseTo(70000, 1);
        expect(xyArea(result.feature_p2_bottom)).toBeCloseTo(60000, 1);
        expect(xyArea(result.feature_p3_bottom)).toBeCloseTo(20000, 1);
        expect(zLevels(result.feature_p1_bottom)).toEqual([6]);
        expect(zLevels(result.feature_p2_bottom)).toEqual([3]);
        expect(zLevels(result.feature_p3_bottom)).toEqual([0]);
        assertWatertight(brep);
    });

    it('przycina krawędzie ramki w świetle rewizji', () => {
        const input = panelInput([
            feat('feat_rewizja', 'cutout', {
                u_mm: 100, v_mm: 20, w_mm: 120, l_mm: 140, depth_mm: T, through: true
            }),
            feat('feat_ramka', 'pocket', {
                u_mm: 60, v_mm: 60, w_mm: W - 120, l_mm: H - 120, depth_mm: 3, through: false
            }),
        ]);

        const result: any = wasmModule.build_panel_mesh(input);
        const halfW = W / 2;
        const halfH = H / 2;
        const insideHole = result.edges
            .filter((e: any) => e.key.startsWith('e_groove_feat_ramka_') && e.points.length >= 2)
            .filter((e: any) => {
                const mx = (e.points[0][0] + e.points[1][0]) / 2;
                const my = (e.points[0][1] + e.points[1][1]) / 2;
                return mx > 100 - halfW + 1 && mx < 220 - halfW - 1
                    && my > 20 - halfH + 1 && my < 160 - halfH - 1;
            });

        expect(insideHole.length).toBe(0);
    });

    it('buduje wieniec narożny 90st (L-shape outline2d) z wpustem i weryfikuje szczelność B-Rep', () => {
        const lW = 882;
        const lD = 882;
        const arm = 600;
        const outline2d = [
            [0, 0],
            [lW, 0],
            [lW, arm],
            [arm, arm],
            [arm, lD],
            [0, lD],
        ];
        const input = {
            width_nm: mm(lW),
            height_nm: mm(lD),
            thickness_nm: mm(18),
            outline2d,
            features: [
                feat('g_back', 'groove', {
                    face: 'FACE_Z_MINUS',
                    u_mm: 10, v_mm: 10, w_mm: 3, l_mm: 500, depth_mm: 8, through: false
                })
            ]
        };

        const result: any = wasmModule.build_panel_mesh(input);
        const brep: any = wasmModule.build_panel_brep(input);

        const sideKeys = Object.keys(result).filter((k) => k.startsWith('OUTLINE_SIDE_'));
        expect(sideKeys.length).toBe(6);
        expect(result.OUTLINE_SIDE_0.edgeKey).toBeDefined();
        expect(result.feature_g_back_bottom.positions.length).toBeGreaterThan(0);
        assertWatertight(brep);
    });

    it('buduje ramkę aluminiową z zaokrągleniem r (ALU_FRAME PROFILE) oraz uciosem 45°', () => {
        const profiled: any = wasmModule.build_alu_frame_mesh({
            w_mm: 600,
            h_mm: 800,
            t_mm: 20,
            pw_mm: 45,
            glass_t_mm: 4,
            lip_depth_mm: 8,
            clearance_mm: 1.5,
            fillet_mm: 20,
            inner_fillet_mm: 10,
        });
        expect(profiled.alu_frame.positions.length / 3).toBeGreaterThan(40);
        expect(profiled.alu_glass.positions.length).toBeGreaterThan(0);
        expect(profiled.edges.some((e: any) => e.alias === 'dol_przod')).toBe(true);

        const mitered: any = wasmModule.build_alu_frame_mesh({
            w_mm: 600,
            h_mm: 800,
            t_mm: 20,
            pw_mm: 45,
            glass_t_mm: 4,
            lip_depth_mm: 8,
            clearance_mm: 1.5,
        });
        expect(mitered.alu_prof_left.positions.length).toBeGreaterThan(0);
        expect(mitered.alu_prof_right.positions.length).toBeGreaterThan(0);
        expect(mitered.alu_prof_top.positions.length).toBeGreaterThan(0);
        expect(mitered.alu_prof_bottom.positions.length).toBeGreaterThan(0);
        expect(mitered.alu_glass.positions.length).toBeGreaterThan(0);
    });
});
