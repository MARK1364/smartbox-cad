/**
 * SmartPanel Web — Biesse Postprocessor
 * 
 * Postprocesor dla maszyn stolarskich Biesse (BiesseWorks / bSolid - format CIX / ISO).
 */

import { Postprocessor } from './base-postprocessor.js';
import { CLDataProgram } from '../core/cl-data.js';

export class BiessePostprocessor extends Postprocessor {
    public generateNcCode(program: CLDataProgram): string {
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

        for (const cmd of program.commands) {
            if (cmd.type === 'TOOL_SELECT') {
                currentTool = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '1' : '1';
            } else if (cmd.type === 'CYCLE_DRILL' && cmd.point && cmd.drillParams) {
                const pt = cmd.point;
                lines.push(`  BG X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(cmd.drillParams.depth).toFixed(3)} DIA=${cmd.toolDiameter || 8} T=${currentTool}`);
            } else if (cmd.type === 'GOTO' && cmd.point) {
                const pt = cmd.point;
                lines.push(`  ROUT X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(pt.z).toFixed(3)} T=${currentTool}`);
            }
        }

        lines.push("END MAIN");
        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
