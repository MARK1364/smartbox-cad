/**
 * SmartPanel Web — Mach3 Postprocessor
 * 
 * Postprocesor dla kontrolerów Mach3 / GRBL.
 * Generuje kod NC z modalnymi cyklami wiercenia G81/G83 oraz bloki G-kodu z ISO/CLData.
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

        let drillCycleActive = false;
        let activeDrillKey: string | null = null;

        const cancelDrill = () => {
            if (!drillCycleActive) return;
            lines.push(`${this.getN()} G80`);
            drillCycleActive = false;
            activeDrillKey = null;
        };

        for (const cmd of program.commands) {
            switch (cmd.type) {
                case 'COMMENT':
                    if (cmd.comment) lines.push(`(${cmd.comment})`);
                    break;
                case 'TOOL_SELECT': {
                    cancelDrill();
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
                    cancelDrill();
                    if (cmd.compensation === 'LEFT') lines.push(`${this.getN()} G41`);
                    else if (cmd.compensation === 'RIGHT') lines.push(`${this.getN()} G42`);
                    else lines.push(`${this.getN()} G40`);
                    break;
                case 'GOTO':
                    cancelDrill();
                    if (cmd.point) {
                        const pt = cmd.point;
                        lines.push(`${this.getN()} G1 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)}`);
                    }
                    break;
                case 'ARC':
                    cancelDrill();
                    if (cmd.point && cmd.arcParams) {
                        const pt = cmd.point;
                        const gCode = cmd.arcParams.direction === 'CW' ? 'G2' : 'G3';
                        if (pt.i !== undefined && pt.j !== undefined) {
                            lines.push(`${this.getN()} ${gCode} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} I${pt.i.toFixed(3)} J${pt.j.toFixed(3)}`);
                        } else if (cmd.arcParams.radius !== undefined) {
                            lines.push(`${this.getN()} ${gCode} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${cmd.arcParams.radius.toFixed(3)}`);
                        }
                    }
                    break;
                case 'CYCLE_DRILL':
                    if (cmd.point && cmd.drillParams) {
                        const pt = cmd.point;
                        const p = cmd.drillParams;
                        const isPeck = p.type === 'PECK' && !!p.peckStep;
                        const drillKey = isPeck
                            ? `G83|${p.retractR}|${p.peckStep}|${pt.z.toFixed(3)}`
                            : `G81|${p.retractR}|${pt.z.toFixed(3)}`;

                        if (drillCycleActive && activeDrillKey === drillKey) {
                            // Modalny cykl: kolejne otwory = same XY
                            lines.push(`${this.getN()} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)}`);
                        } else {
                            if (isPeck) {
                                lines.push(
                                    `${this.getN()} G83 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${p.retractR} Q${p.peckStep}`
                                );
                            } else {
                                lines.push(
                                    `${this.getN()} G81 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${p.retractR}`
                                );
                            }
                            drillCycleActive = true;
                            activeDrillKey = drillKey;
                        }
                    }
                    break;
                case 'STOP':
                    cancelDrill();
                    lines.push(`${this.getN()} M2`);
                    break;
            }
        }

        if (!lines.some(l => l.endsWith('M2'))) {
            cancelDrill();
            lines.push(`${this.getN()} M2`);
        }
        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
