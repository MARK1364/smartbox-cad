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
        this.validateCLDataProgram(program, 'WoodWOPPostprocessor');
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
        let currentFeed = 1000;

        for (const cmd of program.commands) {
            if (cmd.type === 'TOOL_SELECT') {
                currentTool = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '101' : '101';
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
                    lines.push("<104 \\DrillingHorizontal");
                    lines.push(`X=${pt.x.toFixed(2)}`);
                    lines.push(`Y=${pt.y.toFixed(2)}`);
                    lines.push(`Z=${(Object.is(pt.z, -0) ? 0 : pt.z).toFixed(2)}`);
                    lines.push(`DEPTH=${Math.abs(cmd.drillParams.depth).toFixed(2)}`);
                    lines.push(`SIDE=${side}`);
                    lines.push(`TOOL=${currentTool}`);
                    lines.push(`F=${currentFeed}`);
                    lines.push("");
                } else {
                    const isThrough = Math.abs(cmd.drillParams.depth) >= dims.thickness - 0.51;
                    lines.push("<100 \\DrillingVertical");
                    lines.push(`X=${pt.x.toFixed(2)}`);
                    lines.push(`Y=${pt.y.toFixed(2)}`);
                    lines.push(`Z=${Math.abs(cmd.drillParams.depth).toFixed(2)}`);
                    lines.push(`TOOL=${currentTool}`);
                    lines.push(`F=${currentFeed}`);
                    lines.push(`MODE=${isThrough ? 'THROUGH' : 'BLIND'}`);
                    lines.push("");
                }
            } else if (cmd.type === 'GOTO' && cmd.point) {
                const pt = cmd.point;
                const isRapid = cmd.isRapid || cmd.motion === 'RAPID';
                if (isRapid) {
                    const zVal = Object.is(pt.z, -0) ? 0 : pt.z;
                    lines.push("<103 \\Positioning");
                    lines.push(`X=${pt.x.toFixed(2)}`);
                    lines.push(`Y=${pt.y.toFixed(2)}`);
                    lines.push(`Z=${zVal.toFixed(2)}`);
                    lines.push("");
                } else {
                    const zDepth = Object.is(-pt.z, -0) ? 0 : -pt.z;
                    lines.push("<101 \\Routing");
                    lines.push(`X=${pt.x.toFixed(2)}`);
                    lines.push(`Y=${pt.y.toFixed(2)}`);
                    lines.push(`Z=${zDepth.toFixed(2)}`);
                    lines.push(`TOOL=${currentTool}`);
                    lines.push(`F=${currentFeed}`);
                    lines.push("");
                }
            } else if (cmd.type === 'ARC' && cmd.point && cmd.arcParams) {
                const pt = cmd.point;
                const zDepth = Object.is(-pt.z, -0) ? 0 : -pt.z;
                lines.push("<102 \\RoutingArc");
                lines.push(`X=${pt.x.toFixed(2)}`);
                lines.push(`Y=${pt.y.toFixed(2)}`);
                lines.push(`Z=${zDepth.toFixed(2)}`);
                lines.push(`R=${cmd.arcParams.radius.toFixed(2)}`);
                lines.push(`DIR=${cmd.arcParams.direction === 'CW' ? '0' : '1'}`);
                lines.push(`TOOL=${currentTool}`);
                lines.push(`F=${currentFeed}`);
                lines.push("");
            }
        }

        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
