/**
 * Testy jednostkowe postprocesorów meblarskich (WoodWOP, SCM Maestro, Biesse)
 * oraz walidacji wymiarów formatki w C1_cnc.
 */

import { describe, it, expect } from 'vitest';
import { WoodWOPPostprocessor } from '../postprocessors/woodwop-postprocessor.js';
import { SCMPostprocessor } from '../postprocessors/scm-postprocessor.js';
import { BiessePostprocessor } from '../postprocessors/biesse-postprocessor.js';
import { FanucPostprocessor } from '../postprocessors/fanuc-postprocessor.js';
import { Mach3Postprocessor } from '../postprocessors/mach3-postprocessor.js';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import { CNCEngine } from '../core/cnc-engine.js';
import type { CLDataProgram } from '../core/cl-data.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('C1_cnc Postprocessors: CLDataProgram jako jedyne wejście', () => {
    const dummyProgram = (dims?: { width: number; height: number; thickness: number }): CLDataProgram => ({
        projectName: 'Szafka_Plecy_10mm',
        wcsOrigin: { x: 0, y: 0, z: 0 },
        wcsName: 'G55',
        commands: [
            { type: 'TOOL_SELECT', toolId: 'tool_1', toolDiameter: 5, toolName: 'Wiertło 5' },
            { type: 'SPINDL', spindleRpm: 18000, spindleDirection: 'CW' },
            { type: 'FEDRAT', feedRate: 1000 },
            { type: 'GOTO', point: { x: 50, y: 50, z: 5 } },
            {
                type: 'CYCLE_DRILL',
                point: { x: 50, y: 50, z: 0 },
                drillParams: { depth: -10, retractR: 5, type: 'STANDARD' }
            },
            { type: 'STOP' }
        ],
        totalLengthMm: 5,
        estimatedTimeSec: 0.6,
        toolIdsUsed: ['tool_1'],
        workpieceDimensions: dims
    });

    describe('WoodWOPPostprocessor', () => {
        const post = new WoodWOPPostprocessor();

        it('generuje LPX, LPY, LPZ dla pleców 10 mm', () => {
            const project = dummyProgram({ width: 564, height: 716, thickness: 10 });
            const nc = post.generateNcCode(project);

            expect(nc).toContain('LPX=564.0');
            expect(nc).toContain('LPY=716.0');
            expect(nc).toContain('LPZ=10.0');
            expect(nc).not.toContain('LPZ=18.0');
        });

        it('generuje LPX, LPY, LPZ dla blatu 28 mm', () => {
            const project = dummyProgram({ width: 1200, height: 600, thickness: 28 });
            const nc = post.generateNcCode(project);

            expect(nc).toContain('LPX=1200.0');
            expect(nc).toContain('LPY=600.0');
            expect(nc).toContain('LPZ=28.0');
        });

        it('rzuca błąd Fail-Fast przy braku workpieceDimensions', () => {
            const project = dummyProgram(undefined);
            expect(() => post.generateNcCode(project)).toThrow(/brak zdefiniowanych poprawnych wymiarów formatki/i);
        });

        it('rzuca błąd Fail-Fast przy grubości <= 0', () => {
            const project = dummyProgram({ width: 500, height: 400, thickness: 0 });
            expect(() => post.generateNcCode(project)).toThrow(/brak zdefiniowanych poprawnych wymiarów formatki/i);
        });

        it('rozróżnia szybkie pozycjonowanie <103 \\Positioning od frezowania <101 \\Routing z posuwem F', () => {
            const prog: CLDataProgram = {
                projectName: 'WoodWOP_Rapid_Test',
                wcsOrigin: { x: 0, y: 0, z: 0 },
                wcsName: 'G55',
                commands: [
                    { type: 'TOOL_SELECT', toolId: 'tool_101' },
                    { type: 'FEDRAT', feedRate: 2100 },
                    { type: 'GOTO', point: { x: 15, y: 25, z: 10 }, isRapid: true, motion: 'RAPID' },
                    { type: 'GOTO', point: { x: 15, y: 25, z: -8 }, isRapid: false, motion: 'FEED' }
                ],
                totalLengthMm: 50,
                estimatedTimeSec: 2,
                toolIdsUsed: ['tool_101'],
                workpieceDimensions: { width: 500, height: 400, thickness: 18 }
            };
            const nc = post.generateNcCode(prog);
            expect(nc).toContain('<103 \\Positioning');
            expect(nc).toContain('X=15.00');
            expect(nc).toContain('Y=25.00');
            expect(nc).toContain('Z=10.00');

            expect(nc).toContain('<101 \\Routing');
            expect(nc).toContain('X=15.00');
            expect(nc).toContain('Y=25.00');
            expect(nc).toContain('Z=8.00');
            expect(nc).toContain('F=2100');
        });
    });

    describe('SCMPostprocessor', () => {
        const post = new SCMPostprocessor();

        it('generuje nagłówek H DX=... DY=... DZ=... dla płyty 16 mm', () => {
            const project = dummyProgram({ width: 600, height: 720, thickness: 16 });
            const nc = post.generateNcCode(project);

            expect(nc).toContain('H DX=600.0 DY=720.0 DZ=16.0 -AB *MM /DEF');
            expect(nc).not.toContain('DZ=18');
        });

        it('generuje nagłówek H DX=... DY=... DZ=... dla pleców 10 mm', () => {
            const project = dummyProgram({ width: 564, height: 700, thickness: 10 });
            const nc = post.generateNcCode(project);

            expect(nc).toContain('H DX=564.0 DY=700.0 DZ=10.0 -AB *MM /DEF');
        });

        it('rzuca błąd Fail-Fast przy braku workpieceDimensions', () => {
            const project = dummyProgram(undefined);
            expect(() => post.generateNcCode(project)).toThrow(/brak zdefiniowanych poprawnych wymiarów formatki/i);
        });

        it('uwzględnia posuw z komend FEDRAT oraz rozróżnia szybkie pozycjonowanie FAST od frezowania ROUT', () => {
            const prog: CLDataProgram = {
                projectName: 'SCM_Feed_Rapid_Test',
                wcsOrigin: { x: 0, y: 0, z: 0 },
                wcsName: 'G55',
                commands: [
                    { type: 'TOOL_SELECT', toolId: 'tool_1' },
                    { type: 'FEDRAT', feedRate: 2400 },
                    { type: 'GOTO', point: { x: 10, y: 10, z: 10 }, isRapid: true, motion: 'RAPID' },
                    { type: 'GOTO', point: { x: 10, y: 10, z: -5 }, isRapid: false, motion: 'FEED' },
                    { type: 'CYCLE_DRILL', point: { x: 50, y: 50, z: 0 }, drillParams: { depth: -12, retractR: 5, type: 'STANDARD' } }
                ],
                totalLengthMm: 50,
                estimatedTimeSec: 2,
                toolIdsUsed: ['tool_1'],
                workpieceDimensions: { width: 600, height: 720, thickness: 18 }
            };
            const nc = post.generateNcCode(prog);
            expect(nc).toContain('FAST X=10.000 Y=10.000 Z=10.000');
            expect(nc).toContain('ROUT X=10.000 Y=10.000 Z=5.000 T=1 V=2400');
            expect(nc).toContain('BORE X=50.000 Y=50.000 Z=12.000 T=1 V=2400');
        });
    });

    describe('BiessePostprocessor', () => {
        const post = new BiessePostprocessor();

        it('generuje nagłówek CIX z wymiarami formatki LPX/LPY/LPZ', () => {
            const project = dummyProgram({ width: 800, height: 400, thickness: 22 });
            const nc = post.generateNcCode(project);

            expect(nc).toContain('LPX=800.0');
            expect(nc).toContain('LPY=400.0');
            expect(nc).toContain('LPZ=22.0');
        });

        it('rozróżnia szybkie pozycjonowanie FAST od frezowania ROUT z posuwem', () => {
            const prog: CLDataProgram = {
                projectName: 'Biesse_Rapid_Test',
                wcsOrigin: { x: 0, y: 0, z: 0 },
                wcsName: 'G55',
                commands: [
                    { type: 'TOOL_SELECT', toolId: 'tool_2' },
                    { type: 'FEDRAT', feedRate: 1800 },
                    { type: 'GOTO', point: { x: 10, y: 10, z: 10 }, isRapid: true, motion: 'RAPID' },
                    { type: 'GOTO', point: { x: 10, y: 10, z: -5 }, isRapid: false, motion: 'FEED' }
                ],
                totalLengthMm: 50,
                estimatedTimeSec: 2,
                toolIdsUsed: ['tool_2'],
                workpieceDimensions: { width: 800, height: 400, thickness: 22 }
            };
            const nc = post.generateNcCode(prog);
            expect(nc).toContain('FAST X=10.000 Y=10.000 Z=10.000');
            expect(nc).toContain('ROUT X=10.000 Y=10.000 Z=5.000 T=2 V=1800');
        });

        it('rzuca błąd Fail-Fast przy braku workpieceDimensions', () => {
            const project = dummyProgram(undefined);
            expect(() => post.generateNcCode(project)).toThrow(/brak zdefiniowanych poprawnych wymiarów formatki/i);
        });
    });

    describe('FanucPostprocessor', () => {
        const post = new FanucPostprocessor();

        it('generuje nagłówek Fanuc O-/G90/G21 oraz cykl G81', () => {
            const nc = post.generateNcCode(dummyProgram({ width: 600, height: 720, thickness: 18 }));

            expect(nc).toContain('OSzafka_Plecy_10mm');
            expect(nc).toContain('G21');
            expect(nc).toContain('G81');
            expect(nc.trimEnd().endsWith('M30')).toBe(true);
        });
    });

    describe('Mach3Postprocessor', () => {
        const post = new Mach3Postprocessor();

        it('generuje G55, G80 G90 i kończy M2', () => {
            const nc = post.generateNcCode(dummyProgram({ width: 600, height: 720, thickness: 18 }));

            expect(nc.startsWith('G55')).toBe(true);
            expect(nc).toContain('G80 G90');
            expect(nc).toContain('G81');
            expect(nc.trimEnd().endsWith('M2')).toBe(true);
        });

        it('używa modalnego G81: jedno G81 + kolejne XY, jedna zmiana narzędzia na grupę', () => {
            const program: CLDataProgram = {
                projectName: 'Wiercenie',
                wcsOrigin: { x: 0, y: 0, z: 0 },
                wcsName: 'G55',
                commands: [
                    { type: 'TOOL_SELECT', toolId: 'tool_2', toolDiameter: 5 },
                    { type: 'SPINDL', spindleRpm: 3000, spindleDirection: 'CW' },
                    { type: 'FEDRAT', feedRate: 1000 },
                    {
                        type: 'CYCLE_DRILL',
                        point: { x: 10, y: 20, z: 0 },
                        drillParams: { depth: -10, retractR: 5, type: 'STANDARD' }
                    },
                    {
                        type: 'CYCLE_DRILL',
                        point: { x: 30, y: 20, z: 0 },
                        drillParams: { depth: -10, retractR: 5, type: 'STANDARD' }
                    },
                    {
                        type: 'CYCLE_DRILL',
                        point: { x: 50, y: 20, z: 0 },
                        drillParams: { depth: -10, retractR: 5, type: 'STANDARD' }
                    },
                    { type: 'TOOL_SELECT', toolId: 'tool_6', toolDiameter: 8 },
                    { type: 'SPINDL', spindleRpm: 3000, spindleDirection: 'CW' },
                    { type: 'FEDRAT', feedRate: 800 },
                    {
                        type: 'CYCLE_DRILL',
                        point: { x: 100, y: 100, z: 0 },
                        drillParams: { depth: -12, retractR: 5, type: 'STANDARD' }
                    },
                    {
                        type: 'CYCLE_DRILL',
                        point: { x: 120, y: 100, z: 0 },
                        drillParams: { depth: -12, retractR: 5, type: 'STANDARD' }
                    },
                    { type: 'STOP' }
                ],
                totalLengthMm: 50,
                estimatedTimeSec: 1,
                toolIdsUsed: ['tool_2', 'tool_6'],
                workpieceDimensions: { width: 600, height: 720, thickness: 18 }
            };

            const nc = post.generateNcCode(program);

            expect((nc.match(/M6 T/g) || []).length).toBe(2);
            expect((nc.match(/G81/g) || []).length).toBe(2);
            expect(nc).toContain('G81 X10.000 Y20.000 Z-10.000 R5.000');
            expect(nc).toMatch(/N\d+ X30\.000 Y20\.000/);
            expect(nc).toMatch(/N\d+ X50\.000 Y20\.000/);
            expect(nc).toContain('G81 X100.000 Y100.000 Z-12.000 R5.000');
            expect(nc).toMatch(/N\d+ X120\.000 Y100\.000/);
            expect(nc).toContain('G80');
            expect(nc.trimEnd().endsWith('M2')).toBe(true);
        });
    });
});

describe('C1_cnc CAMProcessor: CLDataProgram z operacji', () => {
    it('buildCLProgram składa komendy z cech z narzędziem', async () => {
        const { CAMProcessor } = await import('../processor/cam-processor.js');
        const processor = new CAMProcessor();

        const program = processor.buildCLProgram({
            projectName: 'Test',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G55',
            features: [
                {
                    type: 'hole',
                    position: { x: 100, y: 50, z: 0 },
                    diameter: 5,
                    depth: -10,
                    toolId: 'tool_2_drill_5'
                } as any
            ],
            toolAssignments: {},
            postprocessor: 'Mach3',
            workpieceDimensions: { width: 600, height: 720, thickness: 18 }
        });

        expect(program.commands.some(c => c.type === 'CYCLE_DRILL')).toBe(true);
        expect(program.commands.some(c => c.type === 'TOOL_SELECT')).toBe(true);
        expect(program.commands[program.commands.length - 1].type).toBe('STOP');
        expect(program.toolIdsUsed).toEqual(['tool_2_drill_5']);
        expect(program.totalLengthMm).toBeGreaterThan(0);
        expect(program.workpieceDimensions?.thickness).toBe(18);
    });

    it('buildCLProgram emituje TOOL_SELECT tylko przy zmianie narzędzia', async () => {
        const { CAMProcessor } = await import('../processor/cam-processor.js');
        const { ToolLibrary } = await import('../processor/tool-library.js');
        const library = new ToolLibrary();
        const tools = library.getAllTools();
        const drillTool = tools.find(t => t.type === 'drill') || tools[0];
        expect(drillTool).toBeTruthy();

        const processor = new CAMProcessor(library);
        const program = processor.buildCLProgram({
            projectName: 'Grupowanie',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G55',
            features: [
                {
                    type: 'hole',
                    position: { x: 10, y: 10, z: 0 },
                    positions: [
                        { x: 10, y: 10, z: 0 },
                        { x: 40, y: 10, z: 0 },
                        { x: 70, y: 10, z: 0 }
                    ],
                    diameter: drillTool.diameter,
                    depth: -10,
                    toolId: drillTool.id
                } as any
            ],
            toolAssignments: {},
            postprocessor: 'Mach3',
            workpieceDimensions: { width: 600, height: 720, thickness: 18 }
        });

        const toolSelects = program.commands.filter(c => c.type === 'TOOL_SELECT');
        const drills = program.commands.filter(c => c.type === 'CYCLE_DRILL');
        expect(toolSelects).toHaveLength(1);
        expect(drills).toHaveLength(3);
        expect(program.commands.filter(c => c.type === 'GOTO')).toHaveLength(0);
    });

    it('cecha bez narzędzia jest pomijana (fail-fast przez raport przypisań)', async () => {
        const { CAMProcessor } = await import('../processor/cam-processor.js');
        const processor = new CAMProcessor();

        const program = processor.buildCLProgram({
            projectName: 'BezNarzędzia',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G55',
            features: [
                { type: 'hole', position: { x: 10, y: 10, z: 0 }, diameter: 5, depth: -10 } as any
            ],
            toolAssignments: {},
            postprocessor: 'Mach3',
            workpieceDimensions: { width: 600, height: 720, thickness: 18 }
        });

        expect(program.commands).toHaveLength(1); // samo STOP
        expect(program.commands[0].type).toBe('STOP');
        expect(processor.getLastAssignmentIssues().totalUnassigned).toBe(1);
    });
});

describe('C1_cnc Fail-Fast walidacja wymiarów płyty', () => {
    const extractor = new GeometryDataExtractor();

    it('extractor rzuca błąd gdy panel nie posiada grubości (thickness undefined lub 0)', () => {
        const invalidPanel = {
            id: 'p1',
            name: 'Płyta bez grubości',
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: 0,
            features: []
        };

        expect(() => extractor.extractPanelFeatures(invalidPanel)).toThrow(/nie posiada poprawnych wymiarów fizycznych/i);
    });

    it('CNCEngine.getDimensionsMM rzuca błąd przy braku formatki lub niepoprawnych wymiarach', () => {
        const engine = CNCEngine.getInstance();
        expect(() => engine.getDimensionsMM(null)).toThrow(/brak referencji do formatki/i);

        const invalidPanel = {
            name: 'Płyta testowa',
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: -5
        };
        expect(() => engine.getDimensionsMM(invalidPanel)).toThrow(/nie posiada poprawnych wymiarów fizycznych/i);
    });

    it('CNCEngine.getDimensionsMM poprawnie konwertuje wymiary nm na mm', () => {
        const engine = CNCEngine.getInstance();
        const validPanel = {
            name: 'Bok Prawy',
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(16)
        };
        const dims = engine.getDimensionsMM(validPanel);
        expect(dims.width).toBe(600);
        expect(dims.height).toBe(720);
        expect(dims.thickness).toBe(16);
    });

    it('resolvePostprocessor używa domyślnego Mach3 tylko przy pustym polu, a odrzuca nieznaną nazwę', async () => {
        const { resolvePostprocessor } = await import('../ui/tabs/GCodeTab.js');
        expect(resolvePostprocessor(undefined)).toBeInstanceOf(Mach3Postprocessor);
        expect(resolvePostprocessor('')).toBeInstanceOf(Mach3Postprocessor);
        expect(resolvePostprocessor('WoodWOP')).toBeInstanceOf(WoodWOPPostprocessor);
        expect(() => resolvePostprocessor('UnknownCNC')).toThrow(/Nieobsługiwany postprocesor "UnknownCNC"/);
    });

    it('FAIL-FAST: postprocesory odrzucają workpieceDimensions zawierające NaN lub Infinity', () => {
        const posts = [
            new WoodWOPPostprocessor(),
            new SCMPostprocessor(),
            new BiessePostprocessor(),
            new Mach3Postprocessor(),
            new FanucPostprocessor()
        ];

        const invalidDimsList = [
            { width: NaN, height: 600, thickness: 18 },
            { width: 600, height: Infinity, thickness: 18 },
            { width: 600, height: 600, thickness: NaN },
            { width: 600, height: 600, thickness: Infinity },
            { width: -Infinity, height: 600, thickness: 18 }
        ];

        for (const post of posts) {
            for (const badDims of invalidDimsList) {
                const prog: CLDataProgram = {
                    projectName: 'Bad_Dims',
                    wcsOrigin: { x: 0, y: 0, z: 0 },
                    wcsName: 'G55',
                    commands: [{ type: 'STOP' }],
                    totalLengthMm: 0,
                    estimatedTimeSec: 0,
                    toolIdsUsed: [],
                    workpieceDimensions: badDims
                };
                expect(() => post.generateNcCode(prog)).toThrow(/wymiarów formatki/);
            }
        }
    });

    it('FAIL-FAST: postprocesory odrzucają jawnie niepoprawne spindleRpm, feedRate oraz parametry CYCLE_DRILL zamiast maskować je wartościami domyślnymi', () => {
        const posts = [
            new Mach3Postprocessor(),
            new FanucPostprocessor(),
            new WoodWOPPostprocessor(),
            new SCMPostprocessor(),
            new BiessePostprocessor()
        ];
        const validDims = { width: 600, height: 400, thickness: 18 };

        const makeProg = (commands: any[]): CLDataProgram => ({
            projectName: 'Bad_Params_CL',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G55',
            commands,
            totalLengthMm: 10,
            estimatedTimeSec: 1,
            toolIdsUsed: ['tool_1'],
            workpieceDimensions: validDims
        });

        for (const post of posts) {
            // Nieprawidłowe spindleRpm: 0, NaN, -500, Infinity
            for (const badRpm of [0, NaN, -500, Infinity]) {
                expect(() => post.generateNcCode(makeProg([
                    { type: 'SPINDL', spindleRpm: badRpm, spindleDirection: 'CW' }
                ]))).toThrow(/spindleRpm/);
            }

            // Nieprawidłowy feedRate: 0, NaN, -100, Infinity
            for (const badFeed of [0, NaN, -100, Infinity]) {
                expect(() => post.generateNcCode(makeProg([
                    { type: 'FEDRAT', feedRate: badFeed }
                ]))).toThrow(/feedRate/);
            }

            // Nieprawidłowe parametry CYCLE_DRILL: depth=0/NaN, retractR=0/NaN, PECK bez dodatniego peckStep, toolDiameter=0
            expect(() => post.generateNcCode(makeProg([
                { type: 'CYCLE_DRILL', point: { x: 10, y: 10, z: 0 }, drillParams: { depth: 0, retractR: 5, type: 'STANDARD' } }
            ]))).toThrow(/depth/);

            expect(() => post.generateNcCode(makeProg([
                { type: 'CYCLE_DRILL', point: { x: 10, y: 10, z: 0 }, drillParams: { depth: NaN, retractR: 5, type: 'STANDARD' } }
            ]))).toThrow(/depth/);

            expect(() => post.generateNcCode(makeProg([
                { type: 'CYCLE_DRILL', point: { x: 10, y: 10, z: 0 }, drillParams: { depth: -12, retractR: 0, type: 'STANDARD' } }
            ]))).toThrow(/retractR/);

            expect(() => post.generateNcCode(makeProg([
                { type: 'CYCLE_DRILL', point: { x: 10, y: 10, z: 0 }, drillParams: { depth: -12, retractR: NaN, type: 'STANDARD' } }
            ]))).toThrow(/retractR/);

            expect(() => post.generateNcCode(makeProg([
                { type: 'CYCLE_DRILL', point: { x: 10, y: 10, z: 0 }, drillParams: { depth: -12, retractR: 5, peckStep: 0, type: 'PECK' } }
            ]))).toThrow(/peckStep/);

            expect(() => post.generateNcCode(makeProg([
                { type: 'CYCLE_DRILL', point: { x: 10, y: 10, z: 0 }, drillParams: { depth: -12, retractR: 5, type: 'STANDARD' }, toolDiameter: 0 }
            ]))).toThrow(/toolDiameter/);

            // Nieprawidłowy lub brakujący promień łuku w komendzie ARC (np. radius: undefined, 0, NaN)
            for (const badRadius of [undefined, 0, -5, NaN, Infinity]) {
                expect(() => post.generateNcCode(makeProg([
                    {
                        type: 'ARC',
                        point: { x: 20, y: 20, z: -5 },
                        arcParams: { center: { x: 10, y: 10, z: -5 }, radius: badRadius as any, plane: 'XY', direction: 'CW' }
                    }
                ]))).toThrow(/radius/);
            }
        }

        // BiessePostprocessor nie podstawia domyślnej średnicy 8 mm, gdy brakuje toolDiameter zarówno w TOOL_SELECT, jak i w CYCLE_DRILL
        const biesse = new BiessePostprocessor();
        expect(() => biesse.generateNcCode(makeProg([
            { type: 'TOOL_SELECT', toolId: 'tool_1' },
            { type: 'CYCLE_DRILL', point: { x: 10, y: 10, z: 0 }, drillParams: { depth: -12, retractR: 5, type: 'STANDARD' } }
        ]))).toThrow(/toolDiameter/);
    });

    it('WoodWOP, SCM i Biesse rozróżniają wiercenie poziome od pionowego oraz nie sklejają +Z i -Z przez Math.abs', () => {
        const horizProg: CLDataProgram = {
            projectName: 'Horiz_And_SignedZ_Test',
            wcsOrigin: { x: 0, y: 0, z: 0 },
            wcsName: 'G55',
            workpieceDimensions: { width: 600, height: 400, thickness: 18 },
            totalLengthMm: 100,
            estimatedTimeSec: 5,
            toolIdsUsed: ['tool_1'],
            commands: [
                { type: 'TOOL_SELECT', toolId: 'tool_1', toolDiameter: 8 },
                { type: 'FEDRAT', feedRate: 1500 },
                {
                    type: 'CYCLE_DRILL',
                    point: { x: 0, y: 100, z: -9 },
                    drillParams: { depth: -30, retractR: 5, type: 'STANDARD', axis: { x: 1, y: 0, z: 0 }, face: 'FACE_X_MINUS' },
                    toolDiameter: 8
                },
                { type: 'GOTO', point: { x: 20, y: 20, z: -15 }, isRapid: true, motion: 'RAPID' },
                { type: 'GOTO', point: { x: 20, y: 20, z: 10 }, isRapid: false, motion: 'FEED' },
                { type: 'GOTO', point: { x: 20, y: 20, z: -10 }, isRapid: false, motion: 'FEED' }
            ]
        };

        const woodwopNc = new WoodWOPPostprocessor().generateNcCode(horizProg);
        expect(woodwopNc).toContain('<104 \\DrillingHorizontal');
        expect(woodwopNc).toContain('SIDE=FACE_X_MINUS');
        expect(woodwopNc).toContain('Z=-15.00');
        expect(woodwopNc).toContain('Z=-10.00');
        expect(woodwopNc).toContain('Z=10.00');

        const scmNc = new SCMPostprocessor().generateNcCode(horizProg);
        expect(scmNc).toContain('HBORE X=0.000 Y=100.000 Z=-9.000 DEPTH=30.000 SIDE=FACE_X_MINUS');
        expect(scmNc).toContain('FAST X=20.000 Y=20.000 Z=-15.000');
        expect(scmNc).toContain('ROUT X=20.000 Y=20.000 Z=-10.000');
        expect(scmNc).toContain('ROUT X=20.000 Y=20.000 Z=10.000');

        const biesseNc = new BiessePostprocessor().generateNcCode(horizProg);
        expect(biesseNc).toContain('BH X=0.000 Y=100.000 Z=-9.000 DEPTH=30.000 SIDE=FACE_X_MINUS DIA=8');
        expect(biesseNc).toContain('FAST X=20.000 Y=20.000 Z=-15.000');
        expect(biesseNc).toContain('ROUT X=20.000 Y=20.000 Z=-10.000');
        expect(biesseNc).toContain('ROUT X=20.000 Y=20.000 Z=10.000');

        // Postprocesory 3-osiowe (Mach3, Fanuc) bez agregatu kątowego rzucają Fail-Fast przy wierceniu poziomym
        expect(() => new Mach3Postprocessor().generateNcCode(horizProg)).toThrowError(/Wiercenie poziome/);
        expect(() => new FanucPostprocessor().generateNcCode(horizProg)).toThrowError(/Wiercenie poziome/);
    });

    it('sanitizeFileName czyści znaki niedozwolone w nazwach plików OS', async () => {
        const { sanitizeFileName } = await import('../ui/tabs/GCodeTab.js');
        expect(sanitizeFileName('Bok Lewy / Szafa 1')).toBe('Bok Lewy _ Szafa 1');
        expect(sanitizeFileName('Półka: 600x400 *nowa*?')).toBe('Półka_ 600x400 _nowa__');
        expect(sanitizeFileName('Element <1> | "Test"')).toBe('Element _1_ _ _Test_');
        expect(sanitizeFileName('   ')).toBe('program');
        expect(sanitizeFileName('')).toBe('program');
    });
});
