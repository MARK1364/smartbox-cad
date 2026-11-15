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
    it('FAIL-FAST: odrzuca niepoprawne lub niefizyczne parametry skrawania w customParams w ProfilingStrategy', () => {
        const contour: ContourFeature = {
            featureId: 'cutout_failfast',
            objectName: 'Formatka_Test',
            depth: -9,
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

        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { feedRate: 0 })).toThrow(/feedRate/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { feedRate: -500 })).toThrow(/feedRate/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { feedRate: NaN })).toThrow(/feedRate/);

        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { spindleRpm: 0 })).toThrow(/spindleRpm/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { spindleRpm: -1000 })).toThrow(/spindleRpm/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { spindleRpm: NaN })).toThrow(/spindleRpm/);

        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { stepdownMm: 0 })).toThrow(/stepdownMm/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { stepdownMm: -2 })).toThrow(/stepdownMm/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { stepdownMm: NaN })).toThrow(/stepdownMm/);
    });
    it('FAIL-FAST: odrzuca niepoprawny stepDown z parametrów narzędzia w ProfilingStrategy', () => {
        const contour: ContourFeature = {
            featureId: 'cutout_step_tool',
            objectName: 'Formatka_Test',
            depth: -9,
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
        const makeTool = (stepDown: any): Tool => ({
            ...tool,
            parameters: { ...tool.parameters, stepDown }
        });

        expect(() => strategy.generateCLCommands(contour, makeTool(0), wcsOrigin)).toThrow(/stepDown/);
        expect(() => strategy.generateCLCommands(contour, makeTool(-5), wcsOrigin)).toThrow(/stepDown/);
        expect(() => strategy.generateCLCommands(contour, makeTool(NaN), wcsOrigin)).toThrow(/stepDown/);
        expect(() => strategy.generateCLCommands(contour, makeTool(Infinity), wcsOrigin)).toThrow(/stepDown/);
    });

    it('wycofuje narzędzie na SafeZ (RAPID) między kolejnymi przejściami wgłębnymi (stepdown)', () => {
        const openContour: ContourFeature = {
            featureId: 'open_cutout',
            objectName: 'Formatka_Test',
            depth: -10,
            toolId: 'mill_8',
            normal: { x: 0, y: 0, z: 1 },
            points: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 }
            ]
        };
        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(openContour, tool, wcsOrigin, { stepdownMm: 5, leadInMm: 0, leadOutMm: 0 });

        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        // Oczekiwana sekwencja:
        // 1. SafeZ nad start (0, 0, 10) [RAPID]
        // 2. Zagłębienie pass 1 (0, 0, -5) [FEED]
        // 3. Ruch roboczy do końca pass 1 (100, 0, -5) [FEED]
        // 4. Bezpieczny odjazd na SafeZ nad punktem końca (100, 0, 10) [RAPID]
        // 5. Przejazd szybki na SafeZ nad punkt startu (0, 0, 10) [RAPID]
        // 6. Zagłębienie pass 2 (0, 0, -10) [FEED]
        // 7. Ruch roboczy do końca pass 2 (100, 0, -10) [FEED]
        // 8. Ostateczny odjazd na SafeZ (100, 0, 10) [RAPID]
        expect(gotoCmds.length).toBe(8);

        // Krok 1: start SafeZ
        expect(gotoCmds[0].point).toEqual({ x: 0, y: 0, z: 10 });
        expect(gotoCmds[0].isRapid).toBe(true);

        // Krok 2: zagłębienie pass 1
        expect(gotoCmds[1].point).toEqual({ x: 0, y: 0, z: -5 });
        expect(gotoCmds[1].isRapid).toBeUndefined();

        // Krok 3: koniec pass 1
        expect(gotoCmds[2].point).toEqual({ x: 100, y: 0, z: -5 });

        // Krok 4: wycofanie na SafeZ na końcu pass 1
        expect(gotoCmds[3].point).toEqual({ x: 100, y: 0, z: 10 });
        expect(gotoCmds[3].isRapid).toBe(true);
        expect(gotoCmds[3].motion).toBe('RAPID');

        // Krok 5: powrót na SafeZ do punktu startu
        expect(gotoCmds[4].point).toEqual({ x: 0, y: 0, z: 10 });
        expect(gotoCmds[4].isRapid).toBe(true);
        expect(gotoCmds[4].motion).toBe('RAPID');

        // Krok 6: zagłębienie pass 2
        expect(gotoCmds[5].point).toEqual({ x: 0, y: 0, z: -10 });
        expect(gotoCmds[5].isRapid).toBeUndefined();

        // Krok 7: koniec pass 2
        expect(gotoCmds[6].point).toEqual({ x: 100, y: 0, z: -10 });

        // Krok 8: finalny odjazd
        expect(gotoCmds[7].point).toEqual({ x: 100, y: 0, z: 10 });
        expect(gotoCmds[7].isRapid).toBe(true);
        expect(gotoCmds[7].motion).toBe('RAPID');
    });

    it('dla konturu zamkniętego wycofuje pionowo na SafeZ między przejściami bez duplikowania ruchu w XY', () => {
        const closedContour: ContourFeature = {
            featureId: 'closed_cutout',
            objectName: 'Formatka_Test',
            depth: -10,
            toolId: 'mill_8',
            normal: { x: 0, y: 0, z: 1 },
            points: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 100, z: 0 },
                { x: 0, y: 0, z: 0 }
            ]
        };
        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(closedContour, tool, wcsOrigin, { stepdownMm: 5, leadInMm: 0, leadOutMm: 0 });

        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        // Między przejściami powinien być dokładnie 1 ruch odjazdu na SafeZ (bo startPt == endPt)
        // 1. SafeZ (0,0,10)
        // 2. pass 1 plunge (0,0,-5)
        // 3. (100,0,-5)
        // 4. (100,100,-5)
        // 5. (0,0,-5)
        // 6. SafeZ retract (0,0,10) [RAPID]
        // 7. pass 2 plunge (0,0,-10)
        // 8. (100,0,-10)
        // 9. (100,100,-10)
        // 10. (0,0,-10)
        // 11. Final SafeZ (0,0,10) [RAPID]
        expect(gotoCmds.length).toBe(11);
        expect(gotoCmds[5].point).toEqual({ x: 0, y: 0, z: 10 });
        expect(gotoCmds[5].isRapid).toBe(true);
        expect(gotoCmds[5].motion).toBe('RAPID');
        expect(gotoCmds[6].point).toEqual({ x: 0, y: 0, z: -10 });
    });
    it('FAIL-FAST: odrzuca niepoprawne leadIn i leadOut (ujemne, NaN, Infinity) w ProfilingStrategy', () => {
        const contour: ContourFeature = {
            featureId: 'contour_test_leadin',
            objectName: 'Formatka_Test',
            depth: -10,
            toolId: 'mill_8',
            normal: { x: 0, y: 0, z: 1 },
            points: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
            ]
        };
        const wcsOrigin = createVector3D(0, 0, 0);

        // Niepoprawny leadInMm w customParams
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { leadInMm: -1 })).toThrow(/leadInMm/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { leadInMm: NaN })).toThrow(/leadInMm/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { leadInMm: Infinity })).toThrow(/leadInMm/);

        // Niepoprawny leadOutMm w customParams
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { leadOutMm: -1 })).toThrow(/leadOutMm/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { leadOutMm: NaN })).toThrow(/leadOutMm/);
        expect(() => strategy.generateCLCommands(contour, tool, wcsOrigin, { leadOutMm: Infinity })).toThrow(/leadOutMm/);

        // Niepoprawny leadIn w ContourFeature
        const badLeadInContour = { ...contour, leadIn: -5 };
        expect(() => strategy.generateCLCommands(badLeadInContour, tool, wcsOrigin)).toThrow(/leadIn/);
        const nanLeadInContour = { ...contour, leadIn: NaN };
        expect(() => strategy.generateCLCommands(nanLeadInContour, tool, wcsOrigin)).toThrow(/leadIn/);

        // Niepoprawny leadOut w ContourFeature
        const badLeadOutContour = { ...contour, leadOut: -5 };
        expect(() => strategy.generateCLCommands(badLeadOutContour, tool, wcsOrigin)).toThrow(/leadOut/);
        const nanLeadOutContour = { ...contour, leadOut: NaN };
        expect(() => strategy.generateCLCommands(nanLeadOutContour, tool, wcsOrigin)).toThrow(/leadOut/);
    });

    it('poprawnie obrabia wpust (GrooveFeature) na dolnej ścianie FACE_Z_MINUS (-Z) i odrzuca zerową/NaN głębokość', () => {
        const wcsOrigin = createVector3D(0, 0, 0);
        const grooveBottom = {
            featureId: 'groove_bottom_z_minus',
            objectName: 'Formatka_Test',
            face: 'FACE_Z_MINUS',
            normal: { x: 0, y: 0, z: -1 },
            width: 8,
            depth: 6,
            startPoint: { x: 20, y: 20, z: -9 },
            endPoint: { x: 120, y: 20, z: -9 },
            leadIn: 0,
            leadOut: 0
        };

        const cmds = strategy.generateCLCommands(grooveBottom as any, tool, wcsOrigin, { leadInMm: 0, leadOutMm: 0 });
        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        // SafeZ od spodu płyty: -9 - 10 = -19
        expect(gotoCmds[0].point?.z).toBe(-19);
        // Zagłębienie w głąb materiału (+Z): -9 + 6 = -3
        expect(gotoCmds[1].point?.z).toBe(-3);
        expect(gotoCmds[2].point?.z).toBe(-3);
        expect(gotoCmds[gotoCmds.length - 1].point?.z).toBe(-19);

        // Zerowa i NaN głębokość wpustu są odrzucane zamiast maskowania przez 10.0 mm
        expect(() => strategy.generateCLCommands({ ...grooveBottom, depth: 0 } as any, tool, wcsOrigin)).toThrow(/depth/);
        expect(() => strategy.generateCLCommands({ ...grooveBottom, depth: NaN } as any, tool, wcsOrigin)).toThrow(/depth/);
    });

    it('generateEffectiveContourPath zachowuje szczelność zamkniętego konturu przy kompensacji Left/Right', async () => {
        const { generateEffectiveContourPath } = await import('../geometry/cnc-geometry-utils.js');
        // Zamknięty prostokąt 100x80 (pierwszy punkt równy ostatniemu)
        const closedRect = [
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
            { x: 100, y: 80, z: 0 },
            { x: 0, y: 80, z: 0 },
            { x: 0, y: 0, z: 0 }
        ];

        const offsetPath = generateEffectiveContourPath(closedRect, 0, 0, 'Left', 5);
        expect(offsetPath.length).toBe(5);
        // Pierwszy i ostatni punkt muszą się idealnie pokrywać (brak rozszczelnienia na styku)
        expect(offsetPath[0].x).toBeCloseTo(offsetPath[4].x, 3);
        expect(offsetPath[0].y).toBeCloseTo(offsetPath[4].y, 3);
        expect(offsetPath[0].z).toBeCloseTo(offsetPath[4].z, 3);
    });

    it('prawidłowo zagłębia kontur w głąb materiału, gdy podano dodatnią głębokość skrawania (depth=12) na powierzchni Z=0', () => {
        const contour: ContourFeature = {
            featureId: 'contour_depth_positive',
            objectName: 'Formatka_Test',
            depth: 12, // dodatnia głębokość skrawania
            toolId: 'mill_8',
            normal: { x: 0, y: 0, z: 1 }, // ściana górna (+Z)
            points: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 }
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(contour, tool, wcsOrigin);
        const gotoCmds = cmds.filter(c => c.type === 'GOTO');

        // SafeZ nad materiałem: Z = +10
        expect(gotoCmds[0].point?.z).toBe(10);
        // Zagłębienie w dół w materiał do Z = -12
        const passCmd = gotoCmds.find(c => c.point?.z === -12);
        expect(passCmd).toBeDefined();
    });

    it('odrzuca niepoprawną głębokość konturu (NaN, Infinity)', () => {
        const badContour: any = {
            featureId: 'contour_nan',
            objectName: 'Formatka_Test',
            depth: NaN,
            toolId: 'mill_8',
            points: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 }
            ]
        };
        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(badContour, tool, wcsOrigin)).toThrow(/Głębokość konturu musi być skończoną liczbą/);
    });
});
