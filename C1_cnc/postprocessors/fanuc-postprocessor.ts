/**
 * SmartPanel Web — Fanuc Postprocessor
 * 
 * Postprocesor dla sterowników Fanuc CNC (G-kod Fanuc z G43, G21, M30).
 */

import { Postprocessor } from './base-postprocessor.js';
import { ProcessedCAMProject } from '../dto/cam-dto.js';
import { CLDataProgram } from '../core/cl-data.js';

export class FanucPostprocessor extends Postprocessor {
    public generateNcCode(project: ProcessedCAMProject | CLDataProgram): string {
        if ('commands' in project) {
            return this.generateFromCLData(project as CLDataProgram);
        }

        const legacyProject = project as ProcessedCAMProject;
        const lines: string[] = [];

        const safeName = (legacyProject.projectName || 'PROG').replace(/\s+/g, '');
        lines.push(`O${safeName}`);

        const wcs = legacyProject.wcsName || 'G54';
        lines.push(`G90 ${wcs}`);
        lines.push("G21"); // Metryczne

        let currentTool: string | null = null;

        for (const op of legacyProject.operations) {
            const feed = op.parameters.feedRate || 1000;
            const rpm = op.parameters.spindleRpm || 3000;
            const toolParts = (op.toolId || "tool_1").split('_');
            const tNum = toolParts[1] || "1";

            if (op.toolId !== currentTool) {
                if (currentTool !== null) {
                    lines.push("M5");
                }
                lines.push(`T${tNum} M6`);
                lines.push(`G43 Z50.000 H${tNum}`);
                lines.push(`M3 S${rpm}`);
                currentTool = op.toolId;
            }

            if (op.type === 'drill') {
                const pos = op.position;
                const depth = op.parameters.depth;
                lines.push(`G0 X${pos.x.toFixed(3)} Y${pos.y.toFixed(3)}`);
                lines.push("G0 Z5.000");
                const targetZ = pos.z + depth;
                lines.push(`G1 Z${targetZ.toFixed(3)} F${feed}`);
                lines.push("G0 Z50.000");
            } else if (op.type === 'contour' || op.type === 'groove') {
                const startPos = op.position;
                const depth = op.parameters.depth;
                const moves = op.parameters.moves || [];

                lines.push(`G0 X${startPos.x.toFixed(3)} Y${startPos.y.toFixed(3)}`);
                lines.push("G0 Z5.000");
                const targetZ = startPos.z + depth;
                lines.push(`G1 Z${targetZ.toFixed(3)} F${Math.round(feed / 2)}`);

                for (const move of moves) {
                    if (move.type === 'line') {
                        const end = move.endPoint;
                        lines.push(`G1 X${end.x.toFixed(3)} Y${end.y.toFixed(3)} F${feed}`);
                    }
                }
                lines.push("G0 Z50.000");
            }
        }

        lines.push("M5");
        lines.push("G0 Z50.000");
        lines.push("M30");

        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
