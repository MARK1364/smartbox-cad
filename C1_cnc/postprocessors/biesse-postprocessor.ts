/**
 * SmartPanel Web — Biesse Postprocessor
 * 
 * Postprocesor dla maszyn stolarskich Biesse (BiesseWorks / bSolid - format CIX / ISO).
 */

import { Postprocessor } from './base-postprocessor.js';
import { ProcessedCAMProject } from '../dto/cam-dto.js';
import { CLDataProgram } from '../core/cl-data.js';

export class BiessePostprocessor extends Postprocessor {
    public generateNcCode(project: ProcessedCAMProject | CLDataProgram): string {
        const lines: string[] = [];

        lines.push("BEGIN HEADER");
        lines.push("  TYPE=CIX");
        lines.push("  VERSION=1.0");
        lines.push("END HEADER");
        lines.push("");
        lines.push("BEGIN MAIN");

        if ('commands' in project) {
            const clProgram = project as CLDataProgram;
            let currentTool = "1";

            for (const cmd of clProgram.commands) {
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
        } else {
            const legacy = project as ProcessedCAMProject;
            lines.push(`  PROJECT=${legacy.projectName || 'SmartPanel_CNC'}`);

            for (const op of legacy.operations) {
                if (op.type === 'drill') {
                    const pos = op.position;
                    const depth = op.parameters.depth;
                    const diameter = op.parameters.diameter || 8.0;

                    lines.push(`  BG X=${pos.x.toFixed(3)} Y=${pos.y.toFixed(3)} Z=${Math.abs(depth).toFixed(3)} DIA=${diameter.toFixed(3)}`);
                } else if (op.type === 'contour' || op.type === 'groove') {
                    const startPos = op.position;
                    const depth = op.parameters.depth;
                    lines.push(`  ROUT X=${startPos.x.toFixed(3)} Y=${startPos.y.toFixed(3)} Z=${Math.abs(depth).toFixed(3)}`);
                }
            }
        }

        lines.push("END MAIN");
        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
