/**
 * SmartPanel Web — Fanuc Postprocessor
 * 
 * Postprocesor dla sterowników Fanuc CNC (G-kod Fanuc z G43, G21, M30).
 */

import { Postprocessor } from './base-postprocessor.js';
import { CLDataProgram } from '../core/cl-data.js';

export class FanucPostprocessor extends Postprocessor {
    public generateNcCode(program: CLDataProgram): string {
        this.validateCLDataProgram(program, 'FanucPostprocessor');
        const lines: string[] = [];

        const safeName = (program.projectName || 'PROG').replace(/\s+/g, '');
        lines.push(`O${safeName}`);

        const wcs = program.wcsName || 'G54';
        lines.push(`G90 ${wcs}`);
        lines.push("G21"); // Metryczne
        lines.push("G80 G40 G49"); // Anuluj cykle/kompensacje/przesunięcie narzędzia

        let currentTool: string | null = null;
        let drillCycleActive = false;
        let activeDrillKey: string | null = null;

        const cancelDrill = () => {
            if (!drillCycleActive) return;
            lines.push("G80");
            drillCycleActive = false;
            activeDrillKey = null;
        };

        for (const cmd of program.commands) {
            switch (cmd.type) {
                case 'TOOL_SELECT': {
                    if (currentTool === (cmd.toolId || null)) break;
                    cancelDrill();
                    if (currentTool !== null) lines.push("M5");
                    const toolNum = (cmd.toolId || 'tool_1').split('_')[1] || '1';
                    lines.push(`T${toolNum} M6`);
                    lines.push(`G43 Z50.000 H${toolNum}`);
                    currentTool = cmd.toolId || null;
                    break;
                }
                case 'SPINDL':
                    lines.push(`M3 S${cmd.spindleRpm!}`);
                    break;
                case 'FEDRAT':
                    lines.push(`F${cmd.feedRate!}`);
                    break;
                case 'COMPENSATION':
                    cancelDrill();
                    if (cmd.compensation === 'LEFT') lines.push("G41");
                    else if (cmd.compensation === 'RIGHT') lines.push("G42");
                    else lines.push("G40");
                    break;
                case 'GOTO':
                    cancelDrill();
                    if (cmd.point) {
                        const pt = cmd.point;
                        const g = (cmd.isRapid || cmd.motion === 'RAPID') ? 'G0' : 'G1';
                        lines.push(`${g} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)}`);
                    }
                    break;
                case 'ARC':
                    cancelDrill();
                    if (cmd.point && cmd.arcParams) {
                        const pt = cmd.point;
                        const gCode = cmd.arcParams.direction === 'CW' ? 'G2' : 'G3';
                        if (pt.i !== undefined && pt.j !== undefined) {
                            lines.push(`${gCode} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} I${pt.i.toFixed(3)} J${pt.j.toFixed(3)}`);
                        } else if (cmd.arcParams.radius !== undefined) {
                            lines.push(`${gCode} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${cmd.arcParams.radius.toFixed(3)}`);
                        }
                    }
                    break;
                case 'CYCLE_DRILL':
                    if (cmd.point && cmd.drillParams) {
                        const pt = cmd.point;
                        const p = cmd.drillParams;
                        const isHorizontal = Boolean(
                            (p.axis && (Math.abs(p.axis.x) > 0.5 || Math.abs(p.axis.y) > 0.5)) ||
                            (p.face && (p.face.startsWith('FACE_X') || p.face.startsWith('FACE_Y')))
                        );
                        if (isHorizontal) {
                            throw new Error(`[FanucPostprocessor] Wiercenie poziome ("${p.face || 'axis X/Y'}") nie jest bezpośrednio obsługiwane przez 3-osiowy postprocesor Fanuc (wymaga agregatu kątowego).`);
                        }
                        const isPeck = p.type === 'PECK' && !!p.peckStep;
                        const dirZ = (p.axis && p.axis.z > 0.5) ? 1 : -1;
                        const targetZ = pt.z + dirZ * Math.abs(p.depth);
                        const retractZ = pt.z - dirZ * Math.abs(p.retractR);

                        const drillKey = isPeck
                            ? `G83|${retractZ.toFixed(3)}|${p.peckStep}|${targetZ.toFixed(3)}`
                            : `G81|${retractZ.toFixed(3)}|${targetZ.toFixed(3)}`;

                        if (drillCycleActive && activeDrillKey === drillKey) {
                            lines.push(`X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)}`);
                        } else {
                            if (isPeck) {
                                lines.push(`G83 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${targetZ.toFixed(3)} R${retractZ.toFixed(3)} Q${p.peckStep}`);
                            } else {
                                lines.push(`G81 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${targetZ.toFixed(3)} R${retractZ.toFixed(3)}`);
                            }
                            drillCycleActive = true;
                            activeDrillKey = drillKey;
                        }
                    }
                    break;
                case 'COMMENT':
                    if (cmd.comment) lines.push(`(${cmd.comment})`);
                    break;
                case 'STOP':
                    break;
            }
        }

        cancelDrill();
        lines.push("M5");
        lines.push("G0 Z50.000");
        lines.push("M30");

        return lines.join('\n');
    }

    public getSupportedOperations(): string[] {
        return ['drill', 'mill', 'contour', 'groove'];
    }
}
