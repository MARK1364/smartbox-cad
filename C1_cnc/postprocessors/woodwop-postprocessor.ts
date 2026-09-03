/**
 * SmartPanel Web — Homag / Weeke WoodWOP Postprocessor
 * 
 * Postprocesor dla maszyn stolarskich Homag / Weeke (format WoodWOP .mpr).
 * Powszechnie stosowany standard w przemyśle meblarskim.
 */

import { Postprocessor } from './base-postprocessor.js';
import { ProcessedCAMProject } from '../dto/cam-dto.js';
import { CLDataProgram } from '../core/cl-data.js';

export class WoodWOPPostprocessor extends Postprocessor {
    public generateNcCode(project: ProcessedCAMProject | CLDataProgram): string {
        const lines: string[] = [];

        const projectName = 'projectName' in project ? project.projectName : 'SmartPanel_CNC';

        lines.push("[HEADER]");
        lines.push("VERSION=4.0");
        lines.push(`FILENAME=${projectName}.mpr`);
        lines.push("TYPE=MPR");
        lines.push("");

        lines.push("[PANEL]");
        lines.push("LPX=600.0");
        lines.push("LPY=720.0");
        lines.push("LPZ=18.0");
        lines.push("");

        lines.push("[VARIABLES]");
        lines.push("");

        lines.push("[MACHINING]");

        if ('commands' in project) {
            const clProgram = project as CLDataProgram;
            let currentTool = "101";

            for (const cmd of clProgram.commands) {
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
        } else {
            const legacy = project as ProcessedCAMProject;
            for (const op of legacy.operations) {
                if (op.type === 'drill') {
                    lines.push("<100 \\DrillingVertical");
                    lines.push(`X=${op.position.x.toFixed(2)}`);
                    lines.push(`Y=${op.position.y.toFixed(2)}`);
                    lines.push(`Z=${Math.abs(op.parameters.depth).toFixed(2)}`);
                    lines.push(`DU=${op.parameters.diameter || 8.0}`);
                    lines.push("");
                } else if (op.type === 'contour' || op.type === 'groove') {
                    lines.push("<101 \\Routing");
                    lines.push(`X=${op.position.x.toFixed(2)}`);
                    lines.push(`Y=${op.position.y.toFixed(2)}`);
                    lines.push(`Z=${Math.abs(op.parameters.depth).toFixed(2)}`);
                    lines.push("");
                }
            }
        }

        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
