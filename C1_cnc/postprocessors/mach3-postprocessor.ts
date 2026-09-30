/**
 * SmartPanel Web — Mach3 Postprocessor
 * 
 * Postprocesor dla kontrolerów Mach3 / GRBL.
 * Generuje kod NC z cyklami wiercenia G81/G83 oraz bloki G-kodu z ISO/CLData.
 */

import { Postprocessor } from './base-postprocessor.js';
import { CLDataProgram } from '../core/cl-data.js';

export class Mach3Postprocessor extends Postprocessor {
    private currentLineNumber = 10;
    private lineStep = 10;

    private getN(): string {
        const nStr = `N${this.currentLineNumber}`;
        this.currentLineNumber += this.lineStep;
        return nStr;
    }

    public generateNcCode(program: CLDataProgram): string {
        this.currentLineNumber = 10;

        const wcs = program.wcsName || 'G55';
        const lines: string[] = [wcs, "G80 G90"];

        for (const cmd of program.commands) {
            switch (cmd.type) {
                case 'COMMENT':
                    if (cmd.comment) lines.push(`(${cmd.comment})`);
                    break;
                case 'TOOL_SELECT': {
                    const toolNumber = (cmd.toolId || 'tool_1').split('_')[1] || '1';
                    lines.push(`(narzedzie T${toolNumber})`);
                    lines.push(`${this.getN()} M6 T${toolNumber} D${toolNumber}`);
                    break;
                }
                case 'SPINDL':
                    lines.push(`${this.getN()} M3 S${cmd.spindleRpm || 3000}`);
                    break;
                case 'FEDRAT':
                    lines.push(`${this.getN()} F${cmd.feedRate || 1000}`);
                    break;
                case 'COMPENSATION':
                    if (cmd.compensation === 'LEFT') lines.push(`${this.getN()} G41`);
                    else if (cmd.compensation === 'RIGHT') lines.push(`${this.getN()} G42`);
                    else lines.push(`${this.getN()} G40`);
                    break;
                case 'GOTO':
                    if (cmd.point) {
                        const pt = cmd.point;
                        lines.push(`${this.getN()} G1 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)}`);
                    }
                    break;
                case 'CYCLE_DRILL':
                    if (cmd.point && cmd.drillParams) {
                        const pt = cmd.point;
                        const p = cmd.drillParams;
                        if (p.type === 'PECK' && p.peckStep) {
                            lines.push(`${this.getN()} G83 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${p.retractR} Q${p.peckStep}`);
                        } else {
                            lines.push(`${this.getN()} G81 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${p.retractR}`);
                        }
                    }
                    break;
                case 'STOP':
                    lines.push(`${this.getN()} M2`);
                    break;
            }
        }

        if (!lines.some(l => l.endsWith('M2'))) {
            lines.push(`${this.getN()} M2`);
        }
        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
