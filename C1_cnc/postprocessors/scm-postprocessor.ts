/**
 * SmartPanel Web — SCM / Morbidelli Xilog Maestro Postprocessor
 * 
 * Postprocesor dla maszyn stolarskich SCM / Morbidelli (format Xilog Maestro / Xilog Plus .xxl / .pgm).
 * Powszechny standard w fabrykach mebli i zakładach stolarskich.
 */

import { Postprocessor } from './base-postprocessor.js';
import { ProcessedCAMProject } from '../dto/cam-dto.js';
import { CLDataProgram } from '../core/cl-data.js';

export class SCMPostprocessor extends Postprocessor {
    public generateNcCode(project: ProcessedCAMProject | CLDataProgram): string {
        const lines: string[] = [];

        lines.push("H DX=600 DY=720 DZ=18 -AB *MM /DEF");
        lines.push("; Program wygenerowany przez SmartPanel Web CAM (SCM Maestro)");
        lines.push("");

        if ('commands' in project) {
            const clProgram = project as CLDataProgram;
            let currentTool = "1";

            for (const cmd of clProgram.commands) {
                if (cmd.type === 'TOOL_SELECT') {
                    currentTool = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '1' : '1';
                } else if (cmd.type === 'CYCLE_DRILL' && cmd.point && cmd.drillParams) {
                    const pt = cmd.point;
                    lines.push(`BORE X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(cmd.drillParams.depth).toFixed(3)} T=${currentTool} V=1000`);
                } else if (cmd.type === 'GOTO' && cmd.point) {
                    const pt = cmd.point;
                    lines.push(`ROUT X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(pt.z).toFixed(3)} T=${currentTool} V=1200`);
                }
            }
        } else {
            const legacy = project as ProcessedCAMProject;
            for (const op of legacy.operations) {
                if (op.type === 'drill') {
                    lines.push(`BORE X=${op.position.x.toFixed(3)} Y=${op.position.y.toFixed(3)} Z=${Math.abs(op.parameters.depth).toFixed(3)} D=${op.parameters.diameter || 8}`);
                } else if (op.type === 'contour' || op.type === 'groove') {
                    lines.push(`ROUT X=${op.position.x.toFixed(3)} Y=${op.position.y.toFixed(3)} Z=${Math.abs(op.parameters.depth).toFixed(3)}`);
                }
            }
        }

        lines.push("");
        lines.push("N PS=1");
        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
