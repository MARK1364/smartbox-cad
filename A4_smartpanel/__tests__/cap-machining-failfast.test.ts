import { describe, it, expect, vi } from 'vitest';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { validateFeatureType, validatePanelFeatures } from '../../A1_core/project-schema.js';

describe('walidacja wejściowa typów feature oraz graceful degradation w geometrii', () => {
    it('validateFeatureType rzuca czytelny błąd przy próbie wczytania/użycia typu fillet', () => {
        expect(() => {
            validateFeatureType({ id: 999, type: 'fillet' });
        }).toThrow(/Nieobsługiwany typ feature: "fillet"/);
    });

    it('validatePanelFeatures rzuca czytelny błąd przy próbie wczytania nieznanego typu chamfer', () => {
        expect(() => {
            validatePanelFeatures([
                { id: 1, type: 'hole' },
                { id: 2, type: 'chamfer' }
            ]);
        }).toThrow(/Nieobsługiwany typ feature: "chamfer"/);
    });

    it('validatePanelFeatures akceptuje typy z nowej taksonomii (pocket i cutout)', () => {
        expect(() => {
            validatePanelFeatures([
                { id: 1, type: 'hole' },
                { id: 2, type: 'groove' },
                { id: 3, type: 'pocket' },
                { id: 4, type: 'cutout' }
            ]);
        }).not.toThrow();
    });

    it('buildMeshFromPanel stosuje graceful degradation: ostrzega w konsoli, ale nie wysadza viewportu', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const mesh = buildMeshFromPanel({
            width: mmToNm(300),
            height: mmToNm(200),
            thickness: mmToNm(18),
            role: 'PANEL',
            features: [
                {
                    id: 999,
                    type: 'fillet',
                    face: 'FACE_Z_PLUS',
                    params: { radius: 10 }
                },
                {
                    id: 100,
                    type: 'hole',
                    face: 'FACE_Z_PLUS',
                    params: { u: 50, v: 50, diameter: 15, depth: 10 }
                }
            ]
        });

        // Panel i poprawny otwór są zbudowane (brak czarnego ekranu w 3D)
        expect(mesh).toBeDefined();
        expect(mesh.FACE_Z_PLUS).toBeDefined();
        expect(mesh.edges.some((e: any) => e.key.startsWith('e_hole_100'))).toBe(true);

        // Ostrzeżenie w konsoli zostało zarejestrowane
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Pominięto nieobsługiwany typ feature: "fillet"'));

        warnSpy.mockRestore();
    });
});
