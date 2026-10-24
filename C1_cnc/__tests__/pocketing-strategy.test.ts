import { describe, it, expect } from 'vitest';
import { PocketingStrategy } from '../strategies/pocketing-strategy.js';
import { CAMProcessor } from '../processor/cam-processor.js';
import { PocketFeature, Tool } from '../dto/cam-dto.js';
import { createVector3D } from '../geometry/cnc-geometry-utils.js';

describe('PocketingStrategy — pełny concentric pocket clearing ze stepover', () => {
    const strategy = new PocketingStrategy();
    const tool: Tool = {
        id: 'endmill_10',
        name: 'Frez prosty ø10',
        type: 'mill',
        diameter: 10,
        parameters: {
            stepoverPercent: 40, // 40% = 4mm
            feedRate: 1500,
            spindleRpm: 18000,
            stepDown: 5,
        }
    };

    it('generuje współśrodkowe pętle czyszczące materiał ze stepover dla kieszeni na FACE_Z_PLUS (+Z)', () => {
        // Kieszeń 100 x 80 na płaszczyźnie Z=0, głębokość 6mm, normalna +Z
        const pocket: PocketFeature = {
            featureId: 'pkt_1',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: 1 },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 80, z: 0 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(pocket, tool, wcsOrigin);

        expect(cmds.length).toBeGreaterThan(10);
        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        expect(gotoCmds.length).toBeGreaterThan(10);

        // Pierwszy ruch to podejście w SafeZ (z = 0 + 10 = +10)
        expect(gotoCmds[0].point?.z).toBe(10);

        // Kolejny ruch to zagłębienie na poziom skrawania Z = 0 - 6 = -6
        expect(gotoCmds[1].point?.z).toBe(-6);

        // Ostatni ruch to wycofanie na SafeZ (z = +10)
        const lastGoto = gotoCmds[gotoCmds.length - 1];
        expect(lastGoto.point?.z).toBe(10);

        // Wszystkie pośrednie punkty frezowania powinny mieć poziom Z = -6
        const cuttingMoves = gotoCmds.slice(1, gotoCmds.length - 1);
        for (const cmd of cuttingMoves) {
            expect(cmd.point?.z).toBe(-6);
        }

        // Weryfikacja nienaruszania ścian bocznych (brak overcut / podcinania ścianek):
        // Dla kieszeni 100 x 80 i frezu ø10 (promień R = 5), środek frezu musi zawsze
        // zachowywać odległość >= R od wszystkich ścian kieszeni: x w [5, 95], y w [5, 75].
        for (const cmd of cuttingMoves) {
            expect(cmd.point!.x).toBeGreaterThanOrEqual(5.0 - 1e-3);
            expect(cmd.point!.x).toBeLessThanOrEqual(95.0 + 1e-3);
            expect(cmd.point!.y).toBeGreaterThanOrEqual(5.0 - 1e-3);
            expect(cmd.point!.y).toBeLessThanOrEqual(75.0 + 1e-3);
        }
    });

    it('poprawnie frezuje kieszeń na ścianie FACE_Z_MINUS (-Z) z zagłębieniem w górę i SafeZ w dół', () => {
        // Ściana dolna formatki: Z = -9mm, głębokość 6mm, normalna [0, 0, -1]
        const pocketMinus: PocketFeature = {
            featureId: 'pkt_minus',
            objectName: 'Formatka_Dol',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: -1 },
            boundaryPoints: [
                { x: 0, y: 0, z: -9 },
                { x: 100, y: 0, z: -9 },
                { x: 100, y: 80, z: -9 },
                { x: 0, y: 80, z: -9 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(pocketMinus, tool, wcsOrigin);

        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        // Podejście SafeZ w kierunku normalnej na zewnątrz: z = -9 + (-1) * 10 = -19
        expect(gotoCmds[0].point?.z).toBe(-19);

        // Zagłębienie robocze w głąb formatki (przeciwnie do normalnej): z = -9 - (-1) * 6 = -3
        expect(gotoCmds[1].point?.z).toBe(-3);

        // Odjazd na SafeZ na zewnątrz: z = -19
        const lastGoto = gotoCmds[gotoCmds.length - 1];
        expect(lastGoto.point?.z).toBe(-19);

        // Wszystkie ruchy skrawające na poziomie Z = -3
        const cuttingMoves = gotoCmds.slice(1, gotoCmds.length - 1);
        for (const cmd of cuttingMoves) {
            expect(cmd.point?.z).toBe(-3);
        }
    });

    it('respektuje parametr stepoverPercent z definicji narzędzia (40% = 4mm)', () => {
        const pocket: PocketFeature = {
            featureId: 'pkt_stepover',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: 1 },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 80, z: 0 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        // Bez przekazywania customParams — strategia musi odczytać 40% z tool.parameters
        const cmds = strategy.generateCLCommands(pocket, tool, wcsOrigin);
        const gotoCmds = cmds.filter(c => c.type === 'GOTO');

        // Sprawdzamy kolejne punkty q0 (dolny lewy róg prostokąta toru) w kolejnych pętlach:
        // Pętla 1: d = 5 (hw = 45, hl = 35) -> q0.x = 5, q0.y = 5
        // Pętla 2: d = 5 + 4 = 9 (hw = 41, hl = 31) -> q0.x = 9, q0.y = 9
        // Pętla 3: d = 9 + 4 = 13 (hw = 37, hl = 27) -> q0.x = 13, q0.y = 13
        const q0XCoordinates = [
            ...new Set(gotoCmds.map(c => Math.round(c.point?.x ?? 0)).filter(x => x >= 5 && x <= 45))
        ].sort((a, b) => a - b);

        // Skok między kolejnymi pętlami musi wynosić dokładnie 4mm (40% z ø10)
        expect(q0XCoordinates).toContain(5);
        expect(q0XCoordinates).toContain(9);
        expect(q0XCoordinates).toContain(13);
        expect(q0XCoordinates).toContain(17);
    });

    it('CAMProcessor poprawnie raportuje unassignedPockets i generuje operację kieszeni', () => {
        const processor = new CAMProcessor();
        const unassignedPocket: PocketFeature = {
            featureId: 'unassigned_pkt',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 6,
            toolId: null, // brak narzędzia
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 80, z: 0 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const project = {
            projectName: 'Test_Project',
            features: [unassignedPocket],
            wcsOrigin: createVector3D(0, 0, 0),
            postprocessor: 'Fanuc',
            toolAssignments: {}
        };

        processor.processProject(project as any);
        const issues = processor.getLastAssignmentIssues();
        expect(issues.unassignedPockets).toBe(1);
        expect(issues.totalUnassigned).toBe(1);
    });

    it('rzuca błąd fail-fast, gdy normalna w WCS nie jest równoległa do globalnej osi Z (obrócony WCS)', () => {
        const pocketTilted: PocketFeature = {
            featureId: 'pkt_tilted',
            objectName: 'Formatka_Skos',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 1, z: 0 }, // normalna wzdłuż osi Y
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 0, z: 80 },
                { x: 0, y: 0, z: 80 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(pocketTilted, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana orientacja w WCS/);
    });

    it('odrzuca nawet małe odchylenie kątowe normalnej kieszeni (~1.7 stopnia, y = 0.03, z = 0.99955)', () => {
        const pocketSmallTilt: PocketFeature = {
            featureId: 'pkt_small_tilt',
            objectName: 'Formatka_Skos',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0.03, z: Math.sqrt(1 - 0.03 * 0.03) },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 80, z: 0 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(pocketSmallTilt, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana orientacja w WCS/);
    });

    it('odrzuca kieszeń bez jawnej normalnej, jeśli punkty nie leżą na stałym poziomie Z w WCS', () => {
        const pocketNonPlanar: PocketFeature = {
            featureId: 'pkt_non_planar',
            objectName: 'Formatka_Rampa',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 5 }, // rampa w Z
                { x: 100, y: 80, z: 5 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(pocketNonPlanar, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana geometria w WCS.*stałego poziomu Z/);
    });

    it('odrzuca rowek z obróconą normalną w WCS w PocketingStrategy', () => {
        const grooveTilted = {
            featureId: 'groove_wall_pkt',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 0 },
            depth: 5,
            width: 8,
            normal: { x: 1, y: 0, z: 0 } // ścianka boczna X
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(grooveTilted as any, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana orientacja w WCS dla rowka/);
    });

    it('odrzuca rowek o zmiennym poziomie Z (start.z != end.z) w PocketingStrategy', () => {
        const grooveRamp = {
            featureId: 'groove_ramp_pkt',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 10 },
            depth: 5,
            width: 8,
            normal: { x: 0, y: 0, z: 1 }
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(grooveRamp as any, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana geometria w WCS dla rowka.*różne poziomy Z/);
    });

    it('odrzuca kieszeń z normalną o nieprawidłowej długości (zerową [0,0,0] lub niejednostkową [0,0,0.5])', () => {
        const pocketZeroNorm: PocketFeature = {
            featureId: 'pkt_zero_norm',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: 0 }, // długość 0
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 80, z: 0 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const pocketHalfNorm: PocketFeature = {
            ...pocketZeroNorm,
            featureId: 'pkt_half_norm',
            normal: { x: 0, y: 0, z: 0.5 } // długość 0.5 != 1
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(pocketZeroNorm, tool, wcsOrigin))
            .toThrowError(/nie jest poprawnym wektorem jednostkowym/);
        expect(() => strategy.generateCLCommands(pocketHalfNorm, tool, wcsOrigin))
            .toThrowError(/nie jest poprawnym wektorem jednostkowym/);
    });

    it('odrzuca kieszeń z niepłaskimi punktami w osi Z nawet gdy podano poprawną normalną [0, 0, 1]', () => {
        const pocketRampWithNormal: PocketFeature = {
            featureId: 'pkt_ramp_with_norm',
            objectName: 'Formatka_Rampa',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: 1 }, // poprawna normalna
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 5 }, // rampa w Z
                { x: 100, y: 80, z: 5 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(pocketRampWithNormal, tool, wcsOrigin))
            .toThrowError(/Nieobsługiwana geometria w WCS.*stałego poziomu Z/);
    });

    it('odrzuca rowek z niejednostkową normalną w WCS w PocketingStrategy', () => {
        const grooveBadNorm = {
            featureId: 'groove_bad_norm_pkt',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 0 },
            depth: 5,
            width: 8,
            normal: { x: 0, y: 0, z: 0.5 } // długość 0.5 != 1
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(grooveBadNorm as any, tool, wcsOrigin))
            .toThrowError(/nie jest poprawnym wektorem jednostkowym/);
    });
});
