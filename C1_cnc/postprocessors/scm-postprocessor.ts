/**
 * SmartPanel Web — SCM / Morbidelli Xilog Maestro Postprocessor
 * 
 * Postprocesor dla maszyn stolarskich SCM / Morbidelli (format Xilog Maestro / Xilog Plus .xxl / .pgm).
 * Powszechny standard w fabrykach mebli i zakładach stolarskich.
 */

import { Postprocessor } from './base-postprocessor.js';
import { CLDataProgram } from '../core/cl-data.js';

export class SCMPostprocessor extends Postprocessor {
    public generateNcCode(program: CLDataProgram): string {
        const lines: string[] = [];

        const dims = this.requireWorkpieceDimensions(program, 'SCMPostprocessor');

        lines.push(`H DX=${dims.width.toFixed(1)} DY=${dims.height.toFixed(1)} DZ=${dims.thickness.toFixed(1)} -AB *MM /DEF`);
        lines.push("; Program wygenerowany przez SmartPanel Web CAM (SCM Maestro)");
        lines.push("");

        let currentTool = "1";

        for (const cmd of program.commands) {
            if (cmd.type === 'TOOL_SELECT') {
                currentTool = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '1' : '1';
            } else if (cmd.type === 'CYCLE_DRILL' && cmd.point && cmd.drillParams) {
                const pt = cmd.point;
                lines.push(`BORE X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(cmd.drillParams.depth).toFixed(3)} T=${currentTool} V=1000`);
            } else if (cmd.type === 'GOTO' && cmd.point) {
                const pt = cmd.point;
                lines.push(`ROUT X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(pt.z).toFixed(3)} T=${currentTool} V=1200`);
            } else if (cmd.type === 'ARC' && cmd.point && cmd.arcParams) {
                const pt = cmd.point;
                const dir = cmd.arcParams.direction === 'CW' ? 1 : 2;
                const r = cmd.arcParams.radius;
                lines.push(`ARCP X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(pt.z).toFixed(3)} R=${r.toFixed(3)} D=${dir} T=${currentTool} V=1200`);
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
