/**
 * SmartPanel Web — Biesse Postprocessor
 * 
 * Postprocesor dla maszyn stolarskich Biesse (BiesseWorks / bSolid - format CIX / ISO).
 */

import { Postprocessor } from './base-postprocessor.js';
import { CLDataProgram } from '../core/cl-data.js';

export class BiessePostprocessor extends Postprocessor {
    public generateNcCode(program: CLDataProgram): string {
        this.validateCLDataProgram(program, 'BiessePostprocessor');
        const lines: string[] = [];

        const dims = this.requireWorkpieceDimensions(program, 'BiessePostprocessor');

        lines.push("BEGIN HEADER");
        lines.push("  TYPE=CIX");
        lines.push("  VERSION=1.0");
        lines.push(`  LPX=${dims.width.toFixed(1)}`);
        lines.push(`  LPY=${dims.height.toFixed(1)}`);
        lines.push(`  LPZ=${dims.thickness.toFixed(1)}`);
        lines.push("END HEADER");
        lines.push("");
        lines.push("BEGIN MAIN");
        lines.push(`  PROJECT=${program.projectName || 'SmartPanel_CNC'}`);

        let currentTool = "1";
        let currentToolDiameter: number | undefined = undefined;
        let currentFeed = 1000;

        for (const cmd of program.commands) {
            if (cmd.type === 'TOOL_SELECT') {
                currentTool = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '1' : '1';
                if (cmd.toolDiameter !== undefined) {
                    currentToolDiameter = cmd.toolDiameter;
                }
            } else if (cmd.type === 'FEDRAT') {
                currentFeed = cmd.feedRate!;
            } else if (cmd.type === 'CYCLE_DRILL' && cmd.point && cmd.drillParams) {
                const pt = cmd.point;
                const dia = cmd.toolDiameter ?? currentToolDiameter;
                if (typeof dia !== 'number' || !Number.isFinite(dia) || dia <= 0) {
                    throw new Error(
                        `[BiessePostprocessor] Brak prawidłowej średnicy narzędzia (toolDiameter) dla cyklu wiercenia CYCLE_DRILL — wymagane jawne toolDiameter w CYCLE_DRILL lub poprzedzającym TOOL_SELECT.`
                    );
                }
                const axis = cmd.drillParams.axis;
                const face = cmd.drillParams.face;
                const isHorizontal = Boolean(
                    (axis && (Math.abs(axis.x) > 0.5 || Math.abs(axis.y) > 0.5)) ||
                    (face && (face.startsWith('FACE_X') || face.startsWith('FACE_Y')))
                );
                if (isHorizontal) {
                    const side = face || (axis
                        ? (Math.abs(axis.x) >= Math.abs(axis.y)
                            ? (axis.x > 0 ? 'FACE_X_MINUS' : 'FACE_X_PLUS')
                            : (axis.y > 0 ? 'FACE_Y_MINUS' : 'FACE_Y_PLUS'))
                        : 'FACE_X_MINUS');
                    const zVal = Object.is(pt.z, -0) ? 0 : pt.z;
                    lines.push(`  BH X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${zVal.toFixed(3)} DEPTH=${Math.abs(cmd.drillParams.depth).toFixed(3)} SIDE=${side} DIA=${dia} T=${currentTool} V=${currentFeed}`);
                } else {
                    lines.push(`  BG X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(cmd.drillParams.depth).toFixed(3)} DIA=${dia} T=${currentTool} V=${currentFeed}`);
                }
            } else if (cmd.type === 'GOTO' && cmd.point) {
                const pt = cmd.point;
                const isRapid = cmd.isRapid || cmd.motion === 'RAPID';
                if (isRapid) {
                    const zVal = Object.is(pt.z, -0) ? 0 : pt.z;
                    lines.push(`  FAST X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${zVal.toFixed(3)}`);
                } else {
                    const zDepth = Object.is(-pt.z, -0) ? 0 : -pt.z;
                    lines.push(`  ROUT X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${zDepth.toFixed(3)} T=${currentTool} V=${currentFeed}`);
                }
            } else if (cmd.type === 'ARC' && cmd.point && cmd.arcParams) {
                const pt = cmd.point;
                const dir = cmd.arcParams.direction === 'CW' ? 'CW' : 'CCW';
                const r = cmd.arcParams.radius;
                const zDepth = Object.is(-pt.z, -0) ? 0 : -pt.z;
                lines.push(`  ARCP X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${zDepth.toFixed(3)} R=${r.toFixed(3)} DIR=${dir} T=${currentTool} V=${currentFeed}`);
            }
        }

        lines.push("END MAIN");
        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
