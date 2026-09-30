import { describe, it, expect } from 'vitest';
import { PanelModel } from '../panel-model.js';
import { AluFrameManager } from '../alu-frame-manager.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { NativePanelBuilder } from '../native-panel-builder.js';

describe('SmartPanel — Odmiana Ramki Aluminiowej (Alu Frame)', () => {
    it('poprawnie ładuje szablony profili i szkła z pliku JSON', () => {
        const mgr = AluFrameManager.instance;
        const templates = mgr.getTemplates();
        expect(templates).toBeDefined();
        expect(templates['Z1_BLACK']).toBeDefined();
        expect(templates['Z9_WIDE_BLACK']).toBeDefined();

        const z1 = templates['Z1_BLACK'];
        expect(z1.profile.width_mm).toBe(20);
        expect(z1.profile.depth_mm).toBe(20);
        expect(z1.glass.thickness_mm).toBe(4);
        expect(z1.glass.type).toBe('GRAPHITE_ANTISOL');
    });

    it('wylicza poprawne komponenty (4 profile + tafla szkła) dla formatki 600x720x18 mm', () => {
        const mgr = AluFrameManager.instance;
        const comps = mgr.computeComponents(600, 720, 18, 'Z1_BLACK');

        expect(comps).toHaveLength(5);

        const left = comps.find((c) => c.type === 'profile_left')!;
        const right = comps.find((c) => c.type === 'profile_right')!;
        const top = comps.find((c) => c.type === 'profile_top')!;
        const bottom = comps.find((c) => c.type === 'profile_bottom')!;
        const glass = comps.find((c) => c.type === 'glass')!;

        expect(left).toBeDefined();
        expect(left.lengthMm).toBe(720);
        expect(left.widthMm).toBe(20);
        expect(left.thicknessMm).toBe(20);

        expect(right).toBeDefined();
        expect(right.lengthMm).toBe(720);

        expect(top).toBeDefined();
        expect(top.lengthMm).toBe(600);

        expect(bottom).toBeDefined();
        expect(bottom.lengthMm).toBe(600);

        expect(glass).toBeDefined();
        // W = 600, profil = 20, lip = 8 -> światło w felcu = 600 - 2*(20-8) = 600 - 24 = 576
        // Minus luz 2 * 1.5 = 3 -> 573 mm
        expect(glass.widthMm).toBeCloseTo(573, 1);
        // H = 720, profil = 20, lip = 8 -> 720 - 24 = 696 - 3 = 693 mm
        expect(glass.lengthMm).toBeCloseTo(693, 1);
        expect(glass.thicknessMm).toBe(4);
    });

    it('przełącza postać SmartPanelu: SOLID -> ALU_FRAME -> SOLID', () => {
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Front_1',
            role: 'FRONT'
        });

        expect(panel.panelForm).toBe('SOLID');
        expect(panel.isAluFrame()).toBe(false);
        expect(panel.getFrameComponents()).toEqual([]);

        // Konwersja na ramkę alu
        panel.convertToAluFrame('Z1_BLACK');
        expect(panel.panelForm).toBe('ALU_FRAME');
        expect(panel.isAluFrame()).toBe(true);
        expect(panel.frameTemplateId).toBe('Z1_BLACK');
        expect(nmToMm(panel.thickness)).toBe(20); // profil ma grubość 20 mm

        const comps = panel.getFrameComponents();
        expect(comps).toHaveLength(5);
        expect(comps[0].name).toBe('Profil lewy');
        expect(comps[4].name).toContain('Szkło');

        // Powrót do pełnej formatki
        panel.convertToSolid();
        expect(panel.panelForm).toBe('SOLID');
        expect(panel.isAluFrame()).toBe(false);
        expect(panel.getFrameComponents()).toEqual([]);
    });

    it('poprawnie serializuje i deserializuje postać ramki alu w toJSON / fromJSON', () => {
        const panel = new PanelModel({
            width: mmToNm(400),
            height: mmToNm(800),
            thickness: mmToNm(18),
            name: 'Bok_Lewy_Witryna',
            role: 'LEFT_SIDE_PANEL'
        });

        panel.convertToAluFrame('Z9_WIDE_BLACK');

        const json = panel.toJSON();
        expect(json.panelForm).toBe('ALU_FRAME');
        expect(json.frameTemplateId).toBe('Z9_WIDE_BLACK');

        const restored = PanelModel.fromJSON(json);
        expect(restored.panelForm).toBe('ALU_FRAME');
        expect(restored.frameTemplateId).toBe('Z9_WIDE_BLACK');
        expect(restored.isAluFrame()).toBe(true);
        expect(restored.getFrameComponents()).toHaveLength(5);
    });

    it('generuje autorski B-rep z zacięciami 45° i krawędziami brepPoints dla rysunku 2D', () => {
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(20),
            name: 'Front_Witryna_BRep',
            role: 'FRONT'
        });

        panel.convertToAluFrame('Z1_BLACK');

        // Sprawdzamy wywołanie NativePanelBuilder
        const builder = new NativePanelBuilder();
        const meshData = builder.build(panel);

        // 1. Sprawdzamy obecność siatek 4 profili i szkła
        expect(meshData.alu_prof_left).toBeDefined();
        expect(meshData.alu_prof_right).toBeDefined();
        expect(meshData.alu_prof_top).toBeDefined();
        expect(meshData.alu_prof_bottom).toBeDefined();
        expect(meshData.alu_glass).toBeDefined();

        expect(meshData.alu_prof_left.positions.length).toBeGreaterThan(0);
        expect(meshData.alu_prof_left.indices.length).toBeGreaterThan(0);

        // 2. Sprawdzamy krawędzie B-rep (edges)
        expect(meshData.edges).toBeDefined();
        expect(Array.isArray(meshData.edges)).toBe(true);

        const edgeKeys = meshData.edges.map((e: any) => e.key);
        // Zacięcia narożników pod kątem 45° (przód i tył)
        expect(edgeKeys).toContain('miter_lb_front');
        expect(edgeKeys).toContain('miter_rb_front');
        expect(edgeKeys).toContain('miter_rt_front');
        expect(edgeKeys).toContain('miter_lt_front');
        expect(edgeKeys).toContain('miter_lb_back');
        expect(edgeKeys).toContain('miter_rb_back');
        expect(edgeKeys).toContain('miter_rt_back');
        expect(edgeKeys).toContain('miter_lt_back');

        // Krawędzie obrysu i wewnętrzne światła
        expect(edgeKeys).toContain('dol_przod');
        expect(edgeKeys).toContain('gora_przod');
        expect(edgeKeys).toContain('inner_dol_przod');
        expect(edgeKeys).toContain('inner_gora_przod');
        expect(edgeKeys).toContain('glass_dol');

        // 3. Weryfikacja matematyczna zacięcia 45°: |dx| === |dy| === pw (20mm)
        const miterLbFront = meshData.edges.find((e: any) => e.key === 'miter_lb_front');
        expect(miterLbFront).toBeDefined();
        const [p0, p1] = miterLbFront.points;
        const dx = Math.abs(p1[0] - p0[0]);
        const dy = Math.abs(p1[1] - p0[1]);
        expect(dx).toBeCloseTo(20, 1);
        expect(dy).toBeCloseTo(20, 1);

        // Narożniki B-rep
        expect(meshData.vertices).toBeDefined();
        expect(meshData.vertices.length).toBe(16); // 8 zewn + 8 wewn
    });

    it('wycina otwór / puszkę zawiasu w profilu aluminiowym (np. alu_prof_left)', () => {
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(20),
            name: 'Front_Alu_Zawias',
            role: 'FRONT'
        });

        panel.convertToAluFrame('Z1_BLACK');

        const builder = new NativePanelBuilder();
        const baseMesh = builder.build(panel);
        const baseLeftVerts = baseMesh.alu_prof_left.positions.length;

        // Dodajemy nawiert puszki zawiasu na lewym profilu od tyłu (FACE_Z_MINUS):
        // Szerokość panelu = 600 mm, lewy profil ma x od -300 do -280.
        // W LCS FACE_Z_MINUS: x3D = w/2 - u => dla x3D = -290 mm: u = 590 mm.
        panel.features = [{
            id: 'hinge_cup_left',
            type: 'hole',
            face: 'FACE_Z_MINUS',
            params: {
                u: 590,
                v: 100,
                diameter: 10,
                depth: 8
            }
        }];

        const meshWithHole = builder.build(panel);

        // Profil lewy ma teraz wycięty otwór w ściance oraz wnękę cylindra
        expect(meshWithHole.alu_prof_left.positions.length).toBeGreaterThan(baseLeftVerts);
        expect(meshWithHole.alu_prof_left.indices.length).toBeGreaterThan(baseMesh.alu_prof_left.indices.length);

        // Krawędź otworu obecna w edges
        const edgeKeys = (meshWithHole.edges as any[]).map(e => e.key);
        expect(edgeKeys).toContain('e_hole_hinge_cup_left');

        // Pozostałe profile (prawy, góra, dół) nie zmieniły liczby wierzchołków
        expect(meshWithHole.alu_prof_right.positions.length).toBe(baseMesh.alu_prof_right.positions.length);
    });
});


