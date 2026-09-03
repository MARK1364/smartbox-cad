/**
 * SmartPanel Web — Mach3 Postprocessor
 * 
 * Postprocesor dla kontrolerów Mach3 / GRBL.
 * Generuje kod NC z cyklami wiercenia G81/G83 oraz bloki G-kodu z ISO/CLData.
 */

import { Postprocessor } from './base-postprocessor.js';
import { ProcessedCAMProject, CNCOperation } from '../dto/cam-dto.js';
import { CLDataProgram } from '../core/cl-data.js';

export class Mach3Postprocessor extends Postprocessor {
    private currentLineNumber = 10;
    private lineStep = 10;

    private getN(): string {
        const nStr = `N${this.currentLineNumber}`;
        this.currentLineNumber += this.lineStep;
        return nStr;
    }

    public generateNcCode(project: ProcessedCAMProject | CLDataProgram): string {
        if ('commands' in project) {
            return this.generateFromCLData(project as CLDataProgram);
        }

        const legacyProject = project as ProcessedCAMProject;
        this.currentLineNumber = 10;
        const lines: string[] = [];

        const wcs = legacyProject.wcsName || 'G55';
        lines.push(wcs);
        lines.push("G80 G90");

        let currentTool: string | null = null;
        let inDrillCycle = false;

        for (const op of legacyProject.operations) {
            const toolParts = (op.toolId || "tool_1").split('_');
            const toolNumber = toolParts[1] || "1";

            const feed = op.parameters.feedRate || 1000;
            const rpm = op.parameters.spindleRpm || 3000;

            if (op.toolId !== currentTool) {
                if (inDrillCycle) {
                    lines.push(`${this.getN()} G80`);
                    inDrillCycle = false;
                }
                lines.push(`(narzedzie T${toolNumber})`);
                lines.push(`${this.getN()} M6 T${toolNumber} D${toolNumber}`);
                lines.push(`${this.getN()} M3 S${rpm} T${toolNumber}`);
                currentTool = op.toolId;
            }

            if (op.type === 'drill') {
                const pos = op.position;
                const depth = op.parameters.depth;
                const targetZ = pos.z + depth;
                const retractR = op.parameters.retractR || 5.0;

                if (!inDrillCycle) {
                    lines.push(`${this.getN()} G81 X${pos.x.toFixed(3)} Y${pos.y.toFixed(3)} Z${targetZ.toFixed(3)} R${retractR} F${feed}`);
                    inDrillCycle = true;
                } else {
                    lines.push(`${this.getN()} X${pos.x.toFixed(3)} Y${pos.y.toFixed(3)}`);
                }
            } else {
                if (inDrillCycle) {
                    lines.push(`${this.getN()} G80`);
                    inDrillCycle = false;
                }

                if (op.type === 'contour' || op.type === 'groove') {
                    this.generateContourOperation(lines, op, feed);
                }
            }
        }

        if (inDrillCycle) {
            lines.push(`${this.getN()} G80`);
        }

        lines.push(`${this.getN()} M2`);
        return lines.join('\n');
    }

    private generateContourOperation(lines: string[], op: CNCOperation, feed: number): void {
        const startPos = op.position;
        const depth = op.parameters.depth;
        const moves = op.parameters.moves || [];

        lines.push(`${this.getN()} G0 X${startPos.x.toFixed(3)} Y${startPos.y.toFixed(3)}`);
        lines.push(`${this.getN()} G0 Z5.000`);
        const targetZ = startPos.z + depth;
        lines.push(`${this.getN()} G1 Z${targetZ.toFixed(3)} F${Math.round(feed / 2)}`);

        for (const move of moves) {
            if (move.type === 'line') {
                const end = move.endPoint;
                lines.push(`${this.getN()} G1 X${end.x.toFixed(3)} Y${end.y.toFixed(3)} F${feed}`);
            }
        }

        lines.push(`${this.getN()} G0 Z20.000`);
        lines.push(`${this.getN()} G0`);
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
