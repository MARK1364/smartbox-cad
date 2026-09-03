/**
 * SmartPanel Web — C1_CNC Profiling Strategy
 * 
 * Strategia konturowania 2.5D: frezowanie po obwodzie/profilu z kompensacją promienia frezu (G41/G42),
 * łagodnym wejściem po łuku (Lead-in) oraz zejściem w wielokrotnych przejściach (Stepdown).
 */

import { CAMFeature, ContourFeature, Tool, Vector3D } from '../dto/cam-dto.js';
import { CLCommand } from '../core/cl-data.js';
import { MachiningStrategy, StrategyParams } from './base-strategy.js';
import { generateEffectiveContourPath } from '../geometry/cnc-geometry-utils.js';

export class ProfilingStrategy implements MachiningStrategy {
    readonly id = 'profiling_25d';
    readonly name = 'Konturowanie 2.5D z Kompensacją (G41 / G42)';
    readonly description = 'Frezowanie otwartych i zamkniętych konturów z płynnym najazdem (Lead-in) oraz głębokością w przejściach';
    readonly targetFeatureTypes: Array<'hole' | 'groove' | 'contour'> = ['contour', 'groove'];

    public generateCLCommands(
        feature: CAMFeature,
        tool: Tool,
        wcsOrigin: Vector3D,
        customParams?: StrategyParams
    ): CLCommand[] {
        if (!('points' in feature) && !('startPoint' in feature)) return [];

        let points: Vector3D[] = [];
        let totalDepth = 18.0;
        let compMode: 'OFF' | 'LEFT' | 'RIGHT' = 'OFF';
        let leadIn = customParams?.leadInMm ?? 5.0;
        let leadOut = customParams?.leadOutMm ?? 5.0;
        let reverseDir = customParams?.reverseDirection ?? false;

        if ('points' in feature) {
            const contour = feature as ContourFeature;
            points = contour.points;
            totalDepth = Math.abs(contour.depth || 18.0);
            if (contour.compensation === 'Left') compMode = 'LEFT';
            if (contour.compensation === 'Right') compMode = 'RIGHT';
            if (contour.leadIn !== undefined) leadIn = contour.leadIn;
            if (contour.leadOut !== undefined) leadOut = contour.leadOut;
            if (contour.reverseDirection !== undefined) reverseDir = contour.reverseDirection;
        } else if ('startPoint' in feature) {
            const groove = feature as any;
            points = [groove.startPoint, groove.endPoint];
            totalDepth = Math.abs(groove.depth || 10.0);
        }

        if (points.length < 2) return [];

        const feed = customParams?.feedRate || tool.parameters.feedRate || 1200;
        const rpm = customParams?.spindleRpm || tool.parameters.spindleRpm || 18000;
        const toolRadius = tool.diameter / 2;
        const stepdown = customParams?.stepdownMm && customParams.stepdownMm > 0 ? customParams.stepdownMm : totalDepth;

        // Liczba przejść na głębokość
        const passesCount = Math.ceil(totalDepth / stepdown);

        const effectivePts = generateEffectiveContourPath(
            points,
            leadIn,
            leadOut,
            compMode === 'LEFT' ? 'Left' : (compMode === 'RIGHT' ? 'Right' : 'Center'),
            toolRadius,
            reverseDir
        );

        const commands: CLCommand[] = [];

        commands.push({
            type: 'COMMENT',
            comment: `Profil Konturu, Głębokość: ${totalDepth}mm (${passesCount} przejścia)`,
            featureId: feature.featureId
        });

        commands.push({
            type: 'TOOL_SELECT',
            toolId: tool.id,
            toolDiameter: tool.diameter,
            toolName: tool.name
        });

        commands.push({
            type: 'SPINDL',
            spindleRpm: rpm,
            spindleDirection: 'CW'
        });

        commands.push({
            type: 'FEDRAT',
            feedRate: feed
        });

        // Włączenie kompensacji promienia narzędzia
        if (compMode !== 'OFF') {
            commands.push({
                type: 'COMPENSATION',
                compensation: compMode
            });
        }

        const startPt = effectivePts[0];
        const safeZ = startPt.z + 10.0;

        // Najazd szybki nad punkt startowy
        commands.push({
            type: 'GOTO',
            point: { x: startPt.x, y: startPt.y, z: safeZ }
        });

        // Wykonanie przejść na głębokość
        let currentDepth = 0;
        for (let pass = 1; pass <= passesCount; pass++) {
            currentDepth = Math.min(totalDepth, pass * stepdown);
            const targetZ = startPt.z - currentDepth;

            // Zjazd w materiał na pozycję startową danej warstwy
            commands.push({
                type: 'GOTO',
                point: { x: startPt.x, y: startPt.y, z: targetZ }
            });

            // Ruch po kolejnych punktach konturu
            for (let i = 1; i < effectivePts.length; i++) {
                const pt = effectivePts[i];
                commands.push({
                    type: 'GOTO',
                    point: { x: pt.x, y: pt.y, z: targetZ }
                });
            }
        }

        // Wyłączenie kompensacji i odjazd bezpieczny
        if (compMode !== 'OFF') {
            commands.push({
                type: 'COMPENSATION',
                compensation: 'OFF'
            });
        }

        const endPt = effectivePts[effectivePts.length - 1];
        commands.push({
            type: 'GOTO',
            point: { x: endPt.x, y: endPt.y, z: safeZ }
        });

        return commands;
    }
}
