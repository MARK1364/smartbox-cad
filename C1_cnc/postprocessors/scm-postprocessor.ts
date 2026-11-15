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
        this.validateCLDataProgram(program, 'SCMPostprocessor');
        const lines: string[] = [];

        const dims = this.requireWorkpieceDimensions(program, 'SCMPostprocessor');

        lines.push(`H DX=${dims.width.toFixed(1)} DY=${dims.height.toFixed(1)} DZ=${dims.thickness.toFixed(1)} -AB *MM /DEF`);
        lines.push("; Program wygenerowany przez SmartPanel Web CAM (SCM Maestro)");
        lines.push("");

        let currentTool = "1";
        let currentFeed = 1000;

        for (const cmd of program.commands) {
            if (cmd.type === 'TOOL_SELECT') {
                currentTool = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '1' : '1';
            } else if (cmd.type === 'FEDRAT') {
                currentFeed = cmd.feedRate!;
            } else if (cmd.type === 'CYCLE_DRILL' && cmd.point && cmd.drillParams) {
                const pt = cmd.point;
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
                    lines.push(`HBORE X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${zVal.toFixed(3)} DEPTH=${Math.abs(cmd.drillParams.depth).toFixed(3)} SIDE=${side} T=${currentTool} V=${currentFeed}`);
                } else {
                    lines.push(`BORE X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${Math.abs(cmd.drillParams.depth).toFixed(3)} T=${currentTool} V=${currentFeed}`);
                }
            } else if (cmd.type === 'GOTO' && cmd.point) {
                const pt = cmd.point;
                const isRapid = cmd.isRapid || cmd.motion === 'RAPID';
                if (isRapid) {
                    const zVal = Object.is(pt.z, -0) ? 0 : pt.z;
                    lines.push(`FAST X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${zVal.toFixed(3)}`);
                } else {
                    const zDepth = Object.is(-pt.z, -0) ? 0 : -pt.z;
                    lines.push(`ROUT X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${zDepth.toFixed(3)} T=${currentTool} V=${currentFeed}`);
                }
            } else if (cmd.type === 'ARC' && cmd.point && cmd.arcParams) {
                const pt = cmd.point;
                const dir = cmd.arcParams.direction === 'CW' ? 1 : 2;
                const r = cmd.arcParams.radius;
                const zDepth = Object.is(-pt.z, -0) ? 0 : -pt.z;
                lines.push(`ARCP X=${pt.x.toFixed(3)} Y=${pt.y.toFixed(3)} Z=${zDepth.toFixed(3)} R=${r.toFixed(3)} D=${dir} T=${currentTool} V=${currentFeed}`);
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
