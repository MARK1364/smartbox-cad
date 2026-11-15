import { describe, it, expect } from 'vitest';
import { PocketingStrategy } from '../strategies/pocketing-strategy.js';
import { CAMProcessor } from '../processor/cam-processor.js';
import { ToolLibrary } from '../processor/tool-library.js';
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
            stepDown: 10,
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
            width: 10,
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
            width: 10,
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
            width: 10,
            normal: { x: 0, y: 0, z: 0.5 } // długość 0.5 != 1
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        expect(() => strategy.generateCLCommands(grooveBadNorm as any, tool, wcsOrigin))
            .toThrowError(/nie jest poprawnym wektorem jednostkowym/);
    });
    it('dzieli głęboką kieszeń na bezpieczne przejścia wgłębne (stepdown) z customParams', () => {
        const pocket: PocketFeature = {
            featureId: 'pkt_multistep',
            objectName: 'Formatka_Deep',
            width: 100,
            length: 80,
            depth: 12,
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
        const cmds = strategy.generateCLCommands(pocket, tool, wcsOrigin, { stepdownMm: 5 });

        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        const cuttingMoves = gotoCmds.filter(c => c.point && c.point.z < 0);
        const zLevels = [...new Set(cuttingMoves.map(c => c.point?.z))].sort((a, b) => b - a);

        expect(zLevels).toEqual([-5, -10, -12]);
        expect(cmds.some(c => c.type === 'COMMENT' && c.comment?.includes('3 przejść'))).toBe(true);
    });

    it('dzieli kieszeń na przejścia wgłębne w oparciu o stepDown z definicji narzędzia', () => {
        const pocket: PocketFeature = {
            featureId: 'pkt_tool_stepdown',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 8,
            toolId: 'endmill_step3',
            normal: { x: 0, y: 0, z: 1 },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 80, z: 0 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const toolWithSmallStep: Tool = {
            ...tool,
            parameters: {
                ...tool.parameters,
                stepDown: 3
            }
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(pocket, toolWithSmallStep, wcsOrigin);

        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        const cuttingMoves = gotoCmds.filter(c => c.point && c.point.z < 0);
        const zLevels = [...new Set(cuttingMoves.map(c => c.point?.z))].sort((a, b) => b - a);

        expect(zLevels).toEqual([-3, -6, -8]);
    });

    it('dzieli wpust na przejścia wgłębne w oparciu o stepdown', () => {
        const groove = {
            featureId: 'groove_multistep',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 0 },
            depth: 10,
            width: 10,
            normal: { x: 0, y: 0, z: 1 }
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(groove as any, tool, wcsOrigin, { stepdownMm: 4 });

        const gotoCmds = cmds.filter(c => c.type === 'GOTO');
        const cuttingMoves = gotoCmds.filter(c => c.point && c.point.z < 0);
        const zLevels = [...new Set(cuttingMoves.map(c => c.point?.z))].sort((a, b) => b - a);

        expect(zLevels).toEqual([-4, -8, -10]);
        expect(cmds.some(c => c.type === 'COMMENT' && c.comment?.includes('3 przejść'))).toBe(true);
    });

    it('FAIL-FAST: odrzuca niepoprawne lub niefizyczne parametry skrawania w customParams', () => {
        const pocket: PocketFeature = {
            featureId: 'pkt_failfast_params',
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

        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { feedRate: 0 })).toThrow(/feedRate/);
        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { feedRate: -500 })).toThrow(/feedRate/);
        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { feedRate: NaN })).toThrow(/feedRate/);

        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { spindleRpm: 0 })).toThrow(/spindleRpm/);
        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { spindleRpm: -1000 })).toThrow(/spindleRpm/);
        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { spindleRpm: NaN })).toThrow(/spindleRpm/);

        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { stepdownMm: 0 })).toThrow(/stepdownMm/);
        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { stepdownMm: -2 })).toThrow(/stepdownMm/);
        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { stepdownMm: NaN })).toThrow(/stepdownMm/);

        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { stepoverPercent: 0 })).toThrow(/stepoverPercent/);
        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { stepoverPercent: 120 })).toThrow(/stepoverPercent/);
        expect(() => strategy.generateCLCommands(pocket, tool, wcsOrigin, { stepoverPercent: NaN })).toThrow(/stepoverPercent/);
    });
    it('FAIL-FAST: odrzuca kieszeń, której wymiary są mniejsze niż średnica frezu', () => {
        // Kieszeń 8x8 mm, frez ø10 mm — narzędzie nie mieści się w kieszeni
        const smallPocket: PocketFeature = {
            featureId: 'pkt_too_small',
            objectName: 'Formatka_Test',
            width: 8,
            length: 8,
            depth: 5,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: 1 },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 8, y: 0, z: 0 },
                { x: 8, y: 8, z: 0 },
                { x: 0, y: 8, z: 0 },
            ]
        };
        const wcsOrigin = createVector3D(0, 0, 0);

        expect(() => strategy.generateCLCommands(smallPocket, tool, wcsOrigin))
            .toThrow(/przekracza wymiary kieszeni/);
    });

    it('FAIL-FAST: odrzuca niepoprawny stepDown z parametrów narzędzia w PocketingStrategy i ToolLibrary', () => {
        const pocket: PocketFeature = {
            featureId: 'pkt_test_tool_stepdown',
            objectName: 'Formatka_Test',
            width: 50,
            length: 50,
            depth: 6,
            toolId: 'endmill_bad_step',
            normal: { x: 0, y: 0, z: 1 },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 50, y: 0, z: 0 },
                { x: 50, y: 50, z: 0 },
                { x: 0, y: 50, z: 0 },
            ]
        };
        const wcsOrigin = createVector3D(0, 0, 0);

        const makeTool = (stepDown: any): Tool => ({
            ...tool,
            parameters: { ...tool.parameters, stepDown }
        });

        expect(() => strategy.generateCLCommands(pocket, makeTool(0), wcsOrigin)).toThrow(/stepDown/);
        expect(() => strategy.generateCLCommands(pocket, makeTool(-3), wcsOrigin)).toThrow(/stepDown/);
        expect(() => strategy.generateCLCommands(pocket, makeTool(NaN), wcsOrigin)).toThrow(/stepDown/);
        expect(() => strategy.generateCLCommands(pocket, makeTool(Infinity), wcsOrigin)).toThrow(/stepDown/);

        expect(() => ToolLibrary.validateTool(makeTool(0))).toThrow(/stepDown/);
        expect(() => ToolLibrary.validateTool(makeTool(-2))).toThrow(/stepDown/);
        expect(() => ToolLibrary.validateTool(makeTool(NaN))).toThrow(/stepDown/);
        expect(() => ToolLibrary.validateTool(makeTool(Infinity))).toThrow(/stepDown/);
    });
    it('FAIL-FAST: odrzuca kieszeń z mniej niż 4 punktami obwiedni', () => {
        const pocket3Pts: PocketFeature = {
            featureId: 'pkt_3pts',
            objectName: 'Formatka_Test',
            width: 50,
            length: 50,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: 1 },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 50, y: 0, z: 0 },
                { x: 50, y: 50, z: 0 },
            ]
        };
        const wcsOrigin = createVector3D(0, 0, 0);

        expect(() => strategy.generateCLCommands(pocket3Pts, tool, wcsOrigin))
            .toThrow(/Kieszeń musi posiadać co najmniej 4 punkty obwiedni/);
    });

    it('FAIL-FAST: odrzuca nieprostokątną obwiednię kieszeni (np. trapez, przesunięty punkt p2 lub >4 niezależnych wierzchołków)', () => {
        const wcsOrigin = createVector3D(0, 0, 0);

        // Punkt p2 przesunięty (trapez zamiast prostokąta)
        const pocketTrapezoid: PocketFeature = {
            featureId: 'pkt_trapezoid',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: 1 },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 80, y: 80, z: 0 }, // p2 nie domyka prostokąta 100x80
                { x: 0, y: 80, z: 0 },
            ]
        };
        expect(() => strategy.generateCLCommands(pocketTrapezoid, tool, wcsOrigin))
            .toThrow(/nie jest prostokątem/);

        // Równoległobok nieprostokątny (p0->p1 i p0->p3 nie są prostopadłe)
        const pocketSkewed: PocketFeature = {
            featureId: 'pkt_skewed',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 6,
            toolId: 'endmill_10',
            normal: { x: 0, y: 0, z: 1 },
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 120, y: 80, z: 0 },
                { x: 20, y: 80, z: 0 },
            ]
        };
        expect(() => strategy.generateCLCommands(pocketSkewed, tool, wcsOrigin))
            .toThrow(/nie jest prostokątem/);

        // Wielokąt 5-punktowy (niezamknięty na p0)
        const pocketPentagon: PocketFeature = {
            featureId: 'pkt_pentagon',
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
                { x: 50, y: 90, z: 0 },
                { x: 0, y: 80, z: 0 },
            ]
        };
        expect(() => strategy.generateCLCommands(pocketPentagon, tool, wcsOrigin))
            .toThrow(/obwiednię prostokątną/);

        // FAIL-FAST: odrzuca wpust, gdy średnica narzędzia przekracza szerokość wpustu
        const narrowGroove = {
            featureId: 'groove_too_narrow',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 0 },
            depth: 6,
            width: 8,
            normal: { x: 0, y: 0, z: 1 }
        };
        expect(() => strategy.generateCLCommands(narrowGroove as any, tool, wcsOrigin))
            .toThrow(/przekracza szerokość wpustu/);

        // Szeroki wpust 18 mm obrabiany frezem ø10 mm -> wieloprzejściowe wybieranie poprzeczne od Y=-4 do Y=+4
        const wideGroove = {
            featureId: 'groove_wide_18',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 100, y: 0, z: 0 },
            depth: 6,
            width: 18,
            normal: { x: 0, y: 0, z: 1 }
        };
        const cmds = strategy.generateCLCommands(wideGroove as any, tool, wcsOrigin);
        const cuttingY = cmds
            .filter(c => c.type === 'GOTO' && c.point && c.point.z === -6)
            .map(c => c.point!.y);
        expect(Math.min(...cuttingY)).toBeCloseTo(-4, 3);
        expect(Math.max(...cuttingY)).toBeCloseTo(4, 3);
    });

    it('MachiningRuleEngine i cam-auto-program automatycznie dobierają frez dla PocketFeature', async () => {
        const { MachiningRuleEngine } = await import('../rules/machining-rule-engine.js');
        const { ToolLibrary } = await import('../processor/tool-library.js');
        const toolLib = new ToolLibrary();
        const ruleEngine = new MachiningRuleEngine();

        const pocket: PocketFeature = {
            featureId: 'pkt_auto_rule',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 6,
            boundaryPoints: [
                { x: 0, y: 0, z: 0 },
                { x: 100, y: 0, z: 0 },
                { x: 100, y: 80, z: 0 },
                { x: 0, y: 80, z: 0 },
            ]
        };

        const res = ruleEngine.resolveFeatureMachining(pocket, toolLib);
        expect(res).not.toBeNull();
        expect(res?.strategyId).toBe('pocketing');
        expect(res?.tool).toBeDefined();
        expect(res?.tool?.type).toBe('mill');

        // findBestMillTool z ograniczeniem średnicy
        const bestMillSmall = toolLib.findBestMillTool(8);
        expect(bestMillSmall).not.toBeNull();
        expect(bestMillSmall!.diameter).toBeLessThanOrEqual(8);
    });

    it('DrillingStrategy generuje CYCLE_DRILL z punktem wejścia na powierzchni płyty, a nie dnem otworu', async () => {
        const { DrillingStrategy } = await import('../strategies/drilling-strategy.js');
        const strat = new DrillingStrategy();
        const drillTool = {
            id: 'drill_8',
            name: 'Wiertło 8mm',
            type: 'drill' as const,
            diameter: 8,
            parameters: { feedRate: 1000, spindleRpm: 3000 }
        };

        const holeFeature = {
            featureId: 'hole_test_entry_pt',
            diameter: 8,
            depth: 13,
            position: { x: 50, y: 120, z: 0 },
            face: 'FACE_Z_PLUS',
            axis: { x: 0, y: 0, z: -1 },
            objectName: 'Formatka'
        };

        const cmds = strat.generateCLCommands(holeFeature as any, drillTool, { x: 0, y: 0, z: 0 });
        const drillCmd = cmds.find(c => c.type === 'CYCLE_DRILL');
        expect(drillCmd).toBeDefined();
        // Punkt w CYCLE_DRILL to współrzędna wejścia na powierzchni Z=0
        expect(drillCmd?.point).toEqual({ x: 50, y: 120, z: 0 });
        expect(drillCmd?.drillParams?.depth).toBe(-13);
    });

    it('PocketingStrategy odrzuca kieszeń o głębokości przekraczającej grubość materiału', () => {
        const pocketTooDeep: PocketFeature = {
            featureId: 'pkt_too_deep',
            objectName: 'Formatka_Test',
            width: 100,
            length: 80,
            depth: 25, // 25mm w materiale 18mm
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
        expect(() => strategy.generateCLCommands(pocketTooDeep, tool, wcsOrigin, {
            workpieceDimensions: { width: 600, height: 800, thickness: 18 }
        })).toThrow(/Głębokość kieszeni \(25mm\) przekracza grubość materiału \(18mm\)/);
    });
});
