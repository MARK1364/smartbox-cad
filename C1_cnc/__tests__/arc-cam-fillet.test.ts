import { describe, it, expect } from 'vitest';
import { ProfilingStrategy } from '../strategies/profiling-strategy.js';
import { ContourFeature, ContourSegment, Tool } from '../dto/cam-dto.js';
import { createVector3D } from '../geometry/cnc-geometry-utils.js';
import { buildPolygonSegmentsWithFillets } from '../../A1_core/cad-math/arc2d.js';
import { FanucPostprocessor } from '../postprocessors/fanuc-postprocessor.js';
import { Mach3Postprocessor } from '../postprocessors/mach3-postprocessor.js';
import { BiessePostprocessor } from '../postprocessors/biesse-postprocessor.js';
import { SCMPostprocessor } from '../postprocessors/scm-postprocessor.js';
import { WoodWOPPostprocessor } from '../postprocessors/woodwop-postprocessor.js';
import { CLDataProgram } from '../core/cl-data.js';

describe('Faza 5: Analityczne Łuki CAM (Fillet / Chamfer) i generowanie G02/G03', () => {
    const strategy = new ProfilingStrategy();
    const tool: Tool = {
        id: 'tool_1',
        name: 'Frez konturowy ø10',
        type: 'mill',
        diameter: 10,
        parameters: {
            feedRate: 1500,
            spindleRpm: 18000,
            stepDown: 18,
        }
    };

    it('generuje polecenia CLCommand typu ARC dla zaokrąglonego narożnika', () => {
        // Obrys 600x400 z zaokrągleniami 4 rogów R=50mm
        const rect: Array<[number, number]> = [
            [0, 0],
            [600, 0],
            [600, 400],
            [0, 400]
        ];
        const segs2d = buildPolygonSegmentsWithFillets(rect, 50);

        const segments: ContourSegment[] = segs2d.map(s => {
            if (s.type === 'LINE') {
                return {
                    type: 'LINE',
                    start: { x: s.start[0], y: s.start[1], z: 9 },
                    end: { x: s.end[0], y: s.end[1], z: 9 }
                };
            }
            return {
                type: 'ARC',
                start: { x: s.arc.start[0], y: s.arc.start[1], z: 9 },
                end: { x: s.arc.end[0], y: s.arc.end[1], z: 9 },
                center: { x: s.arc.center[0], y: s.arc.center[1], z: 9 },
                radius: s.arc.radius,
                direction: s.arc.direction,
                plane: 'XY'
            };
        });

        const contour: ContourFeature = {
            featureId: 'blat_zaokraglony',
            objectName: 'Blat_R50',
            depth: -9,
            toolId: 'tool_1',
            normal: { x: 0, y: 0, z: 1 },
            points: segments.map(s => s.start),
            segments
        };

        const wcsOrigin = createVector3D(0, 0, 0);
        const cmds = strategy.generateCLCommands(contour, tool, wcsOrigin);

        const arcCmds = cmds.filter(c => c.type === 'ARC');
        expect(arcCmds.length).toBe(4);

        for (const arc of arcCmds) {
            expect(arc.arcParams).toBeDefined();
            expect(arc.arcParams?.radius).toBeCloseTo(50, 1);
            expect(arc.point?.i).toBeDefined();
            expect(arc.point?.j).toBeDefined();
        }

        const program: CLDataProgram = {
            projectName: 'Blat_Zaokraglony',
            wcsName: 'G54',
            wcsOrigin,
            workpieceDimensions: { width: 600, height: 400, thickness: 18 },
            totalLengthMm: 2000,
            estimatedTimeSec: 60,
            toolIdsUsed: ['tool_1'],
            commands: cmds
        };

        // 1. Fanuc Postprocessor: emisja G2 / G3 z parametrami I, J
        const fanuc = new FanucPostprocessor();
        const fanucCode = fanuc.generateNcCode(program);
        expect(fanucCode).toMatch(/G[23]\s+X.+Y.+I.+J.+/);

        // 2. Mach3 Postprocessor: emisja G2 / G3
        const mach3 = new Mach3Postprocessor();
        const mach3Code = mach3.generateNcCode(program);
        expect(mach3Code).toMatch(/G[23]\s+X.+Y.+I.+J.+/);

        // 3. Biesse Postprocessor: emisja ARCP
        const biesse = new BiessePostprocessor();
        const biesseCode = biesse.generateNcCode(program);
        expect(biesseCode).toContain('ARCP');
        expect(biesseCode).toContain('R=50.000');

        // 4. SCM Maestro Postprocessor: emisja ARCP
        const scm = new SCMPostprocessor();
        const scmCode = scm.generateNcCode(program);
        expect(scmCode).toContain('ARCP');
        expect(scmCode).toContain('R=50.000');

        // 5. WoodWOP Postprocessor: emisja <102 \RoutingArc
        const woodwop = new WoodWOPPostprocessor();
        const woodwopCode = woodwop.generateNcCode(program);
        expect(woodwopCode).toContain('<102 \\RoutingArc');
        expect(woodwopCode).toContain('R=50.00');
    });
});
