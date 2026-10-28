import { describe, it, expect } from 'vitest';
import { buildProfileFrameMesh } from '../native_core/alu-frame-profile.js';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('Ramka / Witryna z Jednolitego Profilu 2D (outline2d z zaokrągleniami r)', () => {
    it('generuje ramiak z profilem 2D i promieniami r (fillet) na zewnątrz i wewnątrz', () => {
        const res = buildProfileFrameMesh({
            w: 600,
            h: 800,
            t: 20,
            pw: 45,
            glassT: 4,
            lipDepth: 8,
            clearance: 1.5,
            fillet_mm: 20,
            inner_fillet_mm: 10
        });

        // 1. Sprawdzamy obecność jednolitej ramy i szkła
        expect(res.alu_frame).toBeDefined();
        expect(res.alu_glass).toBeDefined();

        // 2. Weryfikacja geometrii ramy (pozycje i indeksy)
        expect(res.alu_frame.positions.length).toBeGreaterThan(0);
        expect(res.alu_frame.indices.length).toBeGreaterThan(0);
        expect(res.alu_frame.positions.length % 3).toBe(0);
        expect(res.alu_frame.indices.length % 3).toBe(0);

        // Dzięki zaokrągleniom zewnętrznym (r=20) obrys ma więcej niż 4 narożniki
        // Każdy łuk dodaje punkty dyskretyzacji
        const nPositions = res.alu_frame.positions.length / 3;
        expect(nPositions).toBeGreaterThan(40);

        // 3. Weryfikacja tafli szkła
        expect(res.alu_glass.positions.length).toBeGreaterThan(0);
        expect(res.alu_glass.indices.length).toBeGreaterThan(0);

        // 4. Sprawdzamy krawędzie B-rep (edges)
        expect(res.edges).toBeDefined();
        expect(res.edges.length).toBeGreaterThan(0);

        const edgeAliases = res.edges.map(e => e.alias).filter(Boolean);
        expect(edgeAliases).toContain('dol_przod');
        expect(edgeAliases).toContain('gora_przod');
        expect(edgeAliases).toContain('przod_lewo');
        expect(edgeAliases).toContain('przod_prawo');
        expect(edgeAliases).toContain('inner_dol_przod');
        expect(edgeAliases).toContain('inner_gora_przod');

        // Krawędzie szkła
        const edgeKeys = res.edges.map(e => e.key);
        expect(edgeKeys).toContain('glass_dol');
        expect(edgeKeys).toContain('glass_gora');
    });

    it('buildMeshFromPanel przełącza ramkę ALU_FRAME na profil 2D gdy zadano fillet_mm', () => {
        const panel = {
            width: mmToNm(500),
            height: mmToNm(700),
            thickness: mmToNm(20),
            role: 'FRONT',
            panelForm: 'ALU_FRAME',
            fillet_mm: 15,
            inner_fillet_mm: 6
        };

        const meshData = buildMeshFromPanel(panel);

        // Zwraca jednolity alu_frame z zaokrągleniami oraz szkło
        expect(meshData.alu_frame).toBeDefined();
        expect(meshData.alu_glass).toBeDefined();
        expect(meshData.alu_frame.positions.length).toBeGreaterThan(0);

        // Wierzchołki i krawędzie są obecne
        expect(meshData.edges).toBeDefined();
        expect(meshData.vertices).toBeDefined();
    });

    it('buildMeshFromPanel zachowuje kompatybilność z 4 profilami 45° gdy fillet_mm brak lub 0', () => {
        const panel = {
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: mmToNm(20),
            role: 'FRONT',
            panelForm: 'ALU_FRAME'
        };

        const meshData = buildMeshFromPanel(panel);

        // Tradycyjne 4 profile z uciosami 45°
        expect(meshData.alu_prof_left).toBeDefined();
        expect(meshData.alu_prof_right).toBeDefined();
        expect(meshData.alu_prof_top).toBeDefined();
        expect(meshData.alu_prof_bottom).toBeDefined();
        expect(meshData.alu_glass).toBeDefined();
    });
});
