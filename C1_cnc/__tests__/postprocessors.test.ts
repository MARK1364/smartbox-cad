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
            expect(nc).toContain('G81 X10.000 Y20.000 Z0.000 R5');
            expect(nc).toMatch(/N\d+ X30\.000 Y20\.000/);
            expect(nc).toMatch(/N\d+ X50\.000 Y20\.000/);
            expect(nc).toContain('G81 X100.000 Y100.000 Z0.000 R5');
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
});
