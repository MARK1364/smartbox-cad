/**
 * SmartPanel Web — Base Postprocessor
 * 
 * Klasa abstrakcyjna dla wszystkich postprocesorów CNC. Obsługuje zarówno legacy ProcessedCAMProject, jak i nowy CLDataProgram.
 */

import { ProcessedCAMProject } from '../dto/cam-dto.js';
import { CLDataProgram } from '../core/cl-data.js';

export abstract class Postprocessor {
    abstract generateNcCode(project: ProcessedCAMProject | CLDataProgram): string;
    abstract getSupportedOperations(): string[];

    /**
     * Konwertuje neutralne komendy CLDataProgram bezpośrednio na G-kod ISO.
     */
    protected generateFromCLData(clProgram: CLDataProgram): string {
        const lines: string[] = [];
        let lineNum = 10;
        const getN = () => {
            const res = `N${lineNum}`;
            lineNum += 10;
            return res;
        };

        lines.push(clProgram.wcsName || 'G55');
        lines.push('G80 G90');

        for (const cmd of clProgram.commands) {
            switch (cmd.type) {
                case 'COMMENT':
                    if (cmd.comment) lines.push(`(${cmd.comment})`);
                    break;

                case 'TOOL_SELECT':
                    const toolNum = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '1' : '1';
                    lines.push(`(narzedzie ${cmd.toolName || 'T' + toolNum})`);
                    lines.push(`${getN()} M6 T${toolNum} D${toolNum}`);
                    break;

                case 'SPINDL':
                    lines.push(`${getN()} M3 S${cmd.spindleRpm || 18000}`);
                    break;

                case 'FEDRAT':
                    lines.push(`${getN()} F${cmd.feedRate || 1000}`);
                    break;

                case 'COMPENSATION':
                    if (cmd.compensation === 'LEFT') lines.push(`${getN()} G41`);
                    else if (cmd.compensation === 'RIGHT') lines.push(`${getN()} G42`);
                    else lines.push(`${getN()} G40`);
                    break;

                case 'GOTO':
                    if (cmd.point) {
                        const pt = cmd.point;
                        lines.push(`${getN()} G1 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)}`);
                    }
                    break;

                case 'CYCLE_DRILL':
                    if (cmd.point && cmd.drillParams) {
                        const pt = cmd.point;
                        const p = cmd.drillParams;
                        if (p.type === 'PECK' && p.peckStep) {
                            lines.push(`${getN()} G83 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${p.retractR} Q${p.peckStep}`);
                        } else {
                            lines.push(`${getN()} G81 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${p.retractR}`);
                        }
                    }
                    break;

                case 'STOP':
                    lines.push(`${getN()} M2`);
                    break;
            }
        }

        if (lines[lines.length - 1] !== `${getN()} M2` && !lines.includes('M2')) {
            lines.push(`M2`);
        }

        return lines.join('\n');
    }
}
