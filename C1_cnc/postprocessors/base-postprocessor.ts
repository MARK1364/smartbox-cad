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
        const dims = program?.workpieceDimensions;
        if (
            !dims ||
            typeof dims.width !== 'number' || !Number.isFinite(dims.width) || dims.width <= 0 ||
            typeof dims.height !== 'number' || !Number.isFinite(dims.height) || dims.height <= 0 ||
            typeof dims.thickness !== 'number' || !Number.isFinite(dims.thickness) || dims.thickness <= 0
        ) {
            throw new Error(
                `[${postName}] Brak zdefiniowanych poprawnych wymiarów formatki ` +
                `(workpieceDimensions: W=${dims?.width}, H=${dims?.height}, T=${dims?.thickness}). ` +
                `Postprocesor wymaga LPX, LPY, LPZ.`
            );
        }
        return dims;
    }

    /**
     * Waliduje strukturę i parametry technologiczne CLDataProgram na wejściu postprocesora (fail-fast).
     * Zabezpiecza eksport przed ręcznie zbudowanymi lub uszkodzonymi strukturami CLData omijającymi CAMProcessor.
     */
    protected validateCLDataProgram(program: CLDataProgram, postName = 'Postprocessor'): void {
        if (!program || !Array.isArray(program.commands)) {
            throw new Error(`[${postName}] Nieprawidłowy obiekt CLDataProgram — brak tablicy komend (commands).`);
        }

        if (program.workpieceDimensions !== undefined) {
            this.requireWorkpieceDimensions(program, postName);
        }

        if (program.wcsOrigin !== undefined) {
            const o = program.wcsOrigin;
            if (!o ||
                typeof o.x !== 'number' || !Number.isFinite(o.x) ||
                typeof o.y !== 'number' || !Number.isFinite(o.y) ||
                typeof o.z !== 'number' || !Number.isFinite(o.z)) {
                throw new Error(`[${postName}] Nieprawidłowy punkt wcsOrigin=[${o?.x}, ${o?.y}, ${o?.z}] w CLDataProgram.`);
            }
        }

        for (let i = 0; i < program.commands.length; i++) {
            const cmd = program.commands[i];
            if (!cmd || typeof cmd.type !== 'string') {
                throw new Error(`[${postName}] Uszkodzona komenda CLData na pozycji ${i}.`);
            }

            switch (cmd.type) {
                case 'SPINDL':
                    if (typeof cmd.spindleRpm !== 'number' || !Number.isFinite(cmd.spindleRpm) || cmd.spindleRpm <= 0) {
                        throw new Error(
                            `[${postName}] Nieprawidłowe obroty wrzeciona w komendzie SPINDL (spindleRpm=${cmd.spindleRpm}). Wymagana skończona liczba dodatnia.`
                        );
                    }
                    break;

                case 'FEDRAT':
                    if (typeof cmd.feedRate !== 'number' || !Number.isFinite(cmd.feedRate) || cmd.feedRate <= 0) {
                        throw new Error(
                            `[${postName}] Nieprawidłowy posuw w komendzie FEDRAT (feedRate=${cmd.feedRate}). Wymagana skończona liczba dodatnia.`
                        );
                    }
                    break;

                case 'TOOL_SELECT':
                    if (cmd.toolDiameter !== undefined && (typeof cmd.toolDiameter !== 'number' || !Number.isFinite(cmd.toolDiameter) || cmd.toolDiameter <= 0)) {
                        throw new Error(
                            `[${postName}] Nieprawidłowa średnica narzędzia w komendzie TOOL_SELECT (toolDiameter=${cmd.toolDiameter}). Wymagana skończona liczba dodatnia.`
                        );
                    }
                    break;

                case 'GOTO':
                    if (!cmd.point ||
                        typeof cmd.point.x !== 'number' || !Number.isFinite(cmd.point.x) ||
                        typeof cmd.point.y !== 'number' || !Number.isFinite(cmd.point.y) ||
                        typeof cmd.point.z !== 'number' || !Number.isFinite(cmd.point.z)) {
                        throw new Error(
                            `[${postName}] Nieprawidłowe współrzędne punktu w komendzie GOTO (point=[${cmd.point?.x}, ${cmd.point?.y}, ${cmd.point?.z}]).`
                        );
                    }
                    break;

                case 'ARC':
                    if (!cmd.point ||
                        typeof cmd.point.x !== 'number' || !Number.isFinite(cmd.point.x) ||
                        typeof cmd.point.y !== 'number' || !Number.isFinite(cmd.point.y) ||
                        typeof cmd.point.z !== 'number' || !Number.isFinite(cmd.point.z)) {
                        throw new Error(
                            `[${postName}] Nieprawidłowe współrzędne punktu w komendzie ARC (point=[${cmd.point?.x}, ${cmd.point?.y}, ${cmd.point?.z}]).`
                        );
                    }
                    if (!cmd.arcParams) {
                        throw new Error(`[${postName}] Brak parametrów łuku (arcParams) w komendzie ARC.`);
                    }
                    if (typeof cmd.arcParams.radius !== 'number' || !Number.isFinite(cmd.arcParams.radius) || cmd.arcParams.radius <= 0) {
                        throw new Error(
                            `[${postName}] Nieprawidłowy promień łuku w komendzie ARC (radius=${cmd.arcParams.radius}). Wymagana skończona liczba dodatnia.`
                        );
                    }
                    if ((cmd.point.i !== undefined && (typeof cmd.point.i !== 'number' || !Number.isFinite(cmd.point.i))) ||
                        (cmd.point.j !== undefined && (typeof cmd.point.j !== 'number' || !Number.isFinite(cmd.point.j))) ||
                        (cmd.point.k !== undefined && (typeof cmd.point.k !== 'number' || !Number.isFinite(cmd.point.k)))) {
                        throw new Error(`[${postName}] Nieprawidłowe parametry środka łuku I/J/K w komendzie ARC.`);
                    }
                    break;

                case 'CYCLE_DRILL': {
                    if (!cmd.point ||
                        typeof cmd.point.x !== 'number' || !Number.isFinite(cmd.point.x) ||
                        typeof cmd.point.y !== 'number' || !Number.isFinite(cmd.point.y) ||
                        typeof cmd.point.z !== 'number' || !Number.isFinite(cmd.point.z)) {
                        throw new Error(
                            `[${postName}] Nieprawidłowe współrzędne punktu w komendzie CYCLE_DRILL (point=[${cmd.point?.x}, ${cmd.point?.y}, ${cmd.point?.z}]).`
                        );
                    }
                    if (!cmd.drillParams) {
                        throw new Error(`[${postName}] Brak parametrów wiercenia (drillParams) w komendzie CYCLE_DRILL.`);
                    }
                    const dp = cmd.drillParams;
                    if (typeof dp.depth !== 'number' || !Number.isFinite(dp.depth) || Math.abs(dp.depth) < 1e-4) {
                        throw new Error(
                            `[${postName}] Nieprawidłowa głębokość wiercenia w komendzie CYCLE_DRILL (depth=${dp.depth}). Wymagana niezerowa liczba skończona.`
                        );
                    }
                    if (typeof dp.retractR !== 'number' || !Number.isFinite(dp.retractR) || dp.retractR <= 0) {
                        throw new Error(
                            `[${postName}] Nieprawidłowy odskok bezpieczny w komendzie CYCLE_DRILL (retractR=${dp.retractR}). Wymagana skończona liczba dodatnia.`
                        );
                    }
                    if (dp.peckStep !== undefined && (typeof dp.peckStep !== 'number' || !Number.isFinite(dp.peckStep) || dp.peckStep < 0)) {
                        throw new Error(
                            `[${postName}] Nieprawidłowy krok wiercenia w komendzie CYCLE_DRILL (peckStep=${dp.peckStep}). Wymagana skończona liczba nieujemna.`
                        );
                    }
                    if (dp.type === 'PECK' && (typeof dp.peckStep !== 'number' || !Number.isFinite(dp.peckStep) || dp.peckStep <= 0)) {
                        throw new Error(
                            `[${postName}] Cykl wiercenia głębokiego (PECK / G83) wymaga dodatniego parametru peckStep (peckStep=${dp.peckStep}).`
                        );
                    }
                    if (cmd.toolDiameter !== undefined && (typeof cmd.toolDiameter !== 'number' || !Number.isFinite(cmd.toolDiameter) || cmd.toolDiameter <= 0)) {
                        throw new Error(
                            `[${postName}] Nieprawidłowa średnica narzędzia w komendzie CYCLE_DRILL (toolDiameter=${cmd.toolDiameter}). Wymagana skończona liczba dodatnia.`
                        );
                    }
                    break;
                }
            }
        }
    }

    /**
     * Konwertuje neutralne komendy CLDataProgram bezpośrednio na G-kod ISO.
     */
    protected generateFromCLData(clProgram: CLDataProgram): string {
        this.validateCLDataProgram(clProgram, 'Postprocessor');
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
                    lines.push(`${getN()} M3 S${cmd.spindleRpm!}`);
                    break;

                case 'FEDRAT':
                    lines.push(`${getN()} F${cmd.feedRate!}`);
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
                        const g = (cmd.isRapid || cmd.motion === 'RAPID') ? 'G0' : 'G1';
                        lines.push(`${getN()} ${g} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${pt.z.toFixed(3)}`);
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
                            throw new Error(`[BasePostprocessor] Wiercenie poziome ("${p.face || 'axis X/Y'}") nie jest bezpośrednio obsługiwane przez 3-osiowy postprocesor (wymaga agregatu kątowego).`);
                        }
                        const isPeck = p.type === 'PECK' && !!p.peckStep;
                        const dirZ = (p.axis && p.axis.z > 0.5) ? 1 : -1;
                        const targetZ = pt.z + dirZ * Math.abs(p.depth);
                        const retractZ = pt.z - dirZ * Math.abs(p.retractR);

                        const drillKey = isPeck
                            ? `G83|${retractZ.toFixed(3)}|${p.peckStep}|${targetZ.toFixed(3)}`
                            : `G81|${retractZ.toFixed(3)}|${targetZ.toFixed(3)}`;

                        if (drillCycleActive && activeDrillKey === drillKey) {
                            lines.push(`${getN()} X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)}`);
                        } else {
                            if (isPeck) {
                                lines.push(`${getN()} G83 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${targetZ.toFixed(3)} R${retractZ.toFixed(3)} Q${p.peckStep}`);
                            } else {
                                lines.push(`${getN()} G81 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} Z${targetZ.toFixed(3)} R${retractZ.toFixed(3)}`);
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
