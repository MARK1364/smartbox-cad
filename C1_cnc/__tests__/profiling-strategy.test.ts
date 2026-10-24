import { describe, it, expect } from 'vitest';
import { ProfilingStrategy } from '../strategies/profiling-strategy.js';
import { ContourFeature, Tool } from '../dto/cam-dto.js';
import { createVector3D } from '../geometry/cnc-geometry-utils.js';

describe('ProfilingStrategy — bi-directional Z i SafeZ dla wycięć przelotowych (cutout)', () => {
    const strategy = new ProfilingStrategy();
    const tool: Tool = {
        id: 'mill_8',
        name: 'Frez obwiedniowy ø8',
        type: 'mill',
        diameter: 8,
        parameters: {
            feedRate: 1200,
            spindleRpm: 18000,
            stepDown: 10,
        }
    };

    it('generuje prawidłową ścieżkę dla wycięcia na FACE_Z_PLUS (+Z, z = +9 do z = -9)', () => {
        const contour: ContourFeature = {
            featureId: 'cutout_top',
            objectName: 'Formatka_Test',
            depth: -9, // cel przelotu
            toolId: 'mill_8',
            normal: { x: 0, y: 0, z: 1 },
            points: [
                { x: 50, y: 50, z: 9 },
                { x: 150, y: 50, z: 9 },
                { x: 150, y: 150, z: 9 },
                { x: 50, y: 150, z: 9 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(contour, tool, wcsOrigin);

        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        expect(gotoCmds.length).toBeGreaterThan(4);

        // SafeZ podejścia: z = +9 + 10 = +19
        expect(gotoCmds[0].point?.z).toBe(19);

        // Zagłębienie w stronę Z = -9 (kierunek ujemny)
        const passes = gotoCmds.slice(1, gotoCmds.length - 1);
        const zLevels = [...new Set(passes.map(c => c.point?.z))];
        // Przejście 1 (stepDown 10): 9 - 10 = -1
        // Przejście 2 (dno 18mm): 9 - 18 = -9
        expect(zLevels).toContain(-1);
        expect(zLevels).toContain(-9);

        // Wyjazd końcowy na SafeZ (+19)
        const lastGoto = gotoCmds[gotoCmds.length - 1];
        expect(lastGoto.point?.z).toBe(19);
    });

    it('generuje prawidłową ścieżkę dla wycięcia na FACE_Z_MINUS (-Z, z = -9 do z = +9)', () => {
        const contour: ContourFeature = {
            featureId: 'cutout_bottom',
            objectName: 'Formatka_Test',
            depth: 9, // cel przelotu (przeciwna strona płyty Z = +9)
            toolId: 'mill_8',
            normal: { x: 0, y: 0, z: -1 },
            points: [
                { x: 50, y: 50, z: -9 },
                { x: 150, y: 50, z: -9 },
                { x: 150, y: 150, z: -9 },
                { x: 50, y: 150, z: -9 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(contour, tool, wcsOrigin);

        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        expect(gotoCmds.length).toBeGreaterThan(4);

        // SafeZ podejścia od dołu płyty: z = -9 - 10 = -19 (na zewnątrz dolnej ściany)
        expect(gotoCmds[0].point?.z).toBe(-19);

        // Zagłębienie w górę (kierunek dodatni w głąb płyty w stronę Z = +9)
        const passes = gotoCmds.slice(1, gotoCmds.length - 1);
        const zLevels = [...new Set(passes.map(c => c.point?.z))];
        // Przejście 1 (stepDown 10): -9 + 10 = +1
        // Przejście 2 (dno 18mm): -9 + 18 = +9
        expect(zLevels).toContain(1);
        expect(zLevels).toContain(9);

        // Wyjazd końcowy na SafeZ w dół (-19)
        const lastGoto = gotoCmds[gotoCmds.length - 1];
        expect(lastGoto.point?.z).toBe(-19);
    });

    it('rzuca błąd fail-fast, gdy normalna w WCS nie jest równoległa do globalnej osi Z (obrócony WCS)', () => {
        const contourTilted: ContourFeature = {
            featureId: 'cutout_tilted',
            objectName: 'Formatka_Skos',
            depth: -9,
            toolId: 'mill_8',
            normal: { x: 1, y: 0, z: 0 }, // normalna wzdłuż osi X
            points: [
                { x: 50, y: 50, z: 9 },
                { x: 150, y: 50, z: 9 },
                { x: 150, y: 150, z: 9 },
                { x: 50, y: 150, z: 9 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(contourTilted, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana orientacja w WCS/);
    });

    it('odrzuca nawet małe odchylenie kątowe normalnej (~1.7 stopnia, x = 0.03, z = 0.99955)', () => {
        const contourSmallTilt: ContourFeature = {
            featureId: 'cutout_small_tilt',
            objectName: 'Formatka_Skos',
            depth: -9,
            toolId: 'mill_8',
            normal: { x: 0.03, y: 0, z: Math.sqrt(1 - 0.03 * 0.03) }, // odchylenie ~1.7 st., z > 0.999
            points: [
                { x: 50, y: 50, z: 9 },
                { x: 150, y: 50, z: 9 },
                { x: 150, y: 150, z: 9 },
                { x: 50, y: 150, z: 9 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(contourSmallTilt, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana orientacja w WCS/);
    });

    it('odrzuca kontur bez jawnej normalnej, jeśli punkty nie leżą na stałym poziomie Z w WCS', () => {
        const contourNonPlanar: ContourFeature = {
            featureId: 'cutout_ramp',
            objectName: 'Formatka_Rampa',
            depth: -9,
            toolId: 'mill_8',
            points: [
                { x: 50, y: 50, z: 0 },
                { x: 150, y: 50, z: 2 }, // rampa w Z
                { x: 150, y: 150, z: 4 },
                { x: 50, y: 150, z: 0 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(contourNonPlanar, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana geometria w WCS.*stałego poziomu Z/);
    });

    it('odrzuca rowek z obróconą normalną w WCS', () => {
        const grooveTilted = {
            featureId: 'groove_wall',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 0 },
            depth: 5,
            normal: { x: 0, y: 1, z: 0 } // ścianka boczna Y
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(grooveTilted as any, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana orientacja w WCS dla rowka/);
    });

    it('odrzuca rowek o zmiennym poziomie Z (start.z != end.z)', () => {
        const grooveRamp = {
            featureId: 'groove_ramp',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 10 }, // skos w Z
            depth: 5,
            normal: { x: 0, y: 0, z: 1 }
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(grooveRamp as any, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana geometria w WCS dla rowka.*różne poziomy Z/);
    });

    it('odrzuca normalną o nieprawidłowej długości (zerową [0,0,0] lub niejednostkową [0,0,0.5])', () => {
        const contourZeroNorm: ContourFeature = {
            featureId: 'cutout_zero_norm',
            objectName: 'Formatka_Test',
            depth: -9,
            toolId: 'mill_8',
            normal: { x: 0, y: 0, z: 0 }, // długość 0
            points: [
                { x: 50, y: 50, z: 9 },
                { x: 150, y: 50, z: 9 },
                { x: 150, y: 150, z: 9 },
                { x: 50, y: 150, z: 9 },
            ]
        };

        const contourHalfNorm: ContourFeature = {
            ...contourZeroNorm,
            featureId: 'cutout_half_norm',
            normal: { x: 0, y: 0, z: 0.5 } // długość 0.5 != 1
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(contourZeroNorm, tool, wcsOrigin))
            .toThrowError(/nie jest poprawnym wektorem jednostkowym/);
        expect(() => strategy.generateCLCommands(contourHalfNorm, tool, wcsOrigin))
            .toThrowError(/nie jest poprawnym wektorem jednostkowym/);
    });

    it('odrzuca kontur z niepłaskimi punktami w osi Z nawet gdy podano poprawną normalną [0, 0, 1]', () => {
        const contourRampWithNormal: ContourFeature = {
            featureId: 'cutout_ramp_with_norm',
            objectName: 'Formatka_Rampa',
            depth: -9,
            toolId: 'mill_8',
            normal: { x: 0, y: 0, z: 1 }, // poprawna normalna
            points: [
                { x: 50, y: 50, z: 0 },
                { x: 150, y: 50, z: 2 }, // rampa w Z
                { x: 150, y: 150, z: 4 },
                { x: 50, y: 150, z: 0 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(contourRampWithNormal, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana geometria w WCS.*stałego poziomu Z/);
    });

    it('odrzuca rowek z niejednostkową normalną w WCS', () => {
        const grooveBadNorm = {
            featureId: 'groove_bad_norm',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 0 },
            depth: 5,
            normal: { x: 0, y: 0, z: 0.5 } // długość 0.5 != 1
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(grooveBadNorm as any, tool, wcsOrigin))
            .toThrowError(/nie jest poprawnym wektorem jednostkowym/);
    });
});
