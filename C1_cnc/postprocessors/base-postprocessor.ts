/**
 * SmartPanel Web — Base Postprocessor
 *
 * Klasa abstrakcyjna dla wszystkich postprocesorów CNC.
 *
 * Wejście jest WYŁĄCZNIE `CLDataProgram` (ISO 4343 / APT) — neutralna
 * reprezentacja ścieżki narzędzia. Zero akceptacji innych formatów.
 */

import { CLDataProgram } from '../core/cl-data.js';

export abstract class Postprocessor {
    abstract generateNcCode(program: CLDataProgram): string;
    abstract getSupportedOperations(): string[];

    /**
     * Wymiary obrabianej formatki w mm — wymagane przez postprocesory CNC.
     * Fail-fast: bez nich nie ma poprawnego G-kodu.
     */
    protected requireWorkpieceDimensions(program: CLDataProgram, postName: string): { width: number; height: number; thickness: number } {
        const dims = program.workpieceDimensions;
        if (!dims || dims.thickness <= 0 || dims.width <= 0 || dims.height <= 0) {
            throw new Error(
                `[${postName}] Brak zdefiniowanych poprawnych wymiarów formatki ` +
                `(workpieceDimensions: W=${dims?.width}, H=${dims?.height}, T=${dims?.thickness}). ` +
                `Postprocesor wymaga LPX, LPY, LPZ.`
            );
        }
        return dims;
    }

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

        let drillCycleActive = false;
        let activeDrillKey: string | null = null;

        const cancelDrill = () => {
            if (!drillCycleActive) return;
            lines.push(`${getN()} G80`);
            drillCycleActive = false;
            activeDrillKey = null;
        };

        for (const cmd of clProgram.commands) {
            switch (cmd.type) {
                case 'COMMENT':
                    if (cmd.comment) lines.push(`(${cmd.comment})`);
                    break;

                case 'TOOL_SELECT': {
                    cancelDrill();
                    const toolNum = cmd.toolId ? cmd.toolId.replace(/[^0-9]/g, '') || '1' : '1';
                    lines.push(`(narzedzie ${cmd.toolName || 'T' + toolNum})`);
                    lines.push(`${getN()} M6 T${toolNum} D${toolNum}`);
                    break;
                }

                case 'SPINDL':
                    lines.push(`${getN()} M3 S${cmd.spindleRpm || 18000}`);
                    break;

                case 'FEDRAT':
                    lines.push(`${getN()} F${cmd.feedRate || 1000}`);
                    break;

                case 'COMPENSATION':
                    cancelDrill();
                    if (cmd.compensation === 'LEFT') lines.push(`${getN()} G41`);
                    else if (cmd.compensation === 'RIGHT') lines.push(`${getN()} G42`);
                    else lines.push(`${getN()} G40`);
                    break;

                case 'GOTO':
                    cancelDrill();
                    if (cmd.point) {
                        const pt = cmd.point;
                        lines.push(`${getN()} G1 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)}`);
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
                            lines.push(`${getN()} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)}`);
                        } else {
                            if (isPeck) {
                                lines.push(`${getN()} G83 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${p.retractR} Q${p.peckStep}`);
                            } else {
                                lines.push(`${getN()} G81 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)} R${p.retractR}`);
                            }
                            drillCycleActive = true;
                            activeDrillKey = drillKey;
                        }
                    }
                    break;

                case 'STOP':
                    cancelDrill();
                    lines.push(`${getN()} M2`);
                    break;
            }
        }

        if (!lines.some(l => l.endsWith('M2') || l === 'M2')) {
            cancelDrill();
            lines.push(`${getN()} M2`);
        }

        return lines.join('\n');
    }
}
