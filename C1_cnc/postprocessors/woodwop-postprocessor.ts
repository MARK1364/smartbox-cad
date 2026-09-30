/**
 * SmartPanel Web — Homag / Weeke WoodWOP Postprocessor
 * 
 * Postprocesor dla maszyn stolarskich Homag / Weeke (format WoodWOP .mpr).
 * Powszechnie stosowany standard w przemyśle meblarskim.
 */

import { Postprocessor } from './base-postprocessor.js';
import { CLDataProgram } from '../core/cl-data.js';

export class WoodWOPPostprocessor extends Postprocessor {
    public generateNcCode(program: CLDataProgram): string {
        const lines: string[] = [];

        lines.push("[HEADER]");
        lines.push("VERSION=4.0");
        lines.push(`FILENAME=${program.projectName}.mpr`);
        lines.push("TYPE=MPR");
        lines.push("");

        const dims = this.requireWorkpieceDimensions(program, 'WoodWOPPostprocessor');

        lines.push("[PANEL]");
        lines.push(`LPX=${dims.width.toFixed(1)}`);
        lines.push(`LPY=${dims.height.toFixed(1)}`);
        lines.push(`LPZ=${dims.thickness.toFixed(1)}`);
        lines.push("");

        lines.push("[VARIABLES]");
        lines.push("");

        lines.push("[MACHINING]");

        let currentTool = "101";

        for (const cmd of program.commands) {
            if (cmd.type === 'TOOL_SELECT') {
                currentTool = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '101' : '101';
            } else if (cmd.type === 'CYCLE_DRILL' && cmd.point && cmd.drillParams) {
                const pt = cmd.point;
                lines.push("<100 \\DrillingVertical");
                lines.push(`X=${pt.x.toFixed(2)}`);
                lines.push(`Y=${pt.y.toFixed(2)}`);
                lines.push(`Z=${Math.abs(cmd.drillParams.depth).toFixed(2)}`);
                lines.push(`TOOL=${currentTool}`);
                lines.push(`MODE=THROUGH`);
                lines.push("");
            } else if (cmd.type === 'GOTO' && cmd.point) {
                const pt = cmd.point;
                lines.push("<101 \\Routing");
                lines.push(`X=${pt.x.toFixed(2)}`);
                lines.push(`Y=${pt.y.toFixed(2)}`);
                lines.push(`Z=${Math.abs(pt.z).toFixed(2)}`);
                lines.push(`TOOL=${currentTool}`);
                lines.push("");
            }
        }

        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
