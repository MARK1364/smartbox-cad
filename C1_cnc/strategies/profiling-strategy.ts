/**
 * SmartPanel Web — C1_CNC Profiling Strategy
 * 
 * Strategia konturowania 2.5D: frezowanie po obwodzie/profilu z kompensacją promienia frezu (G41/G42),
 * łagodnym wejściem po łuku (Lead-in) oraz zejściem w wielokrotnych przejściach (Stepdown).
 * 
 * Założenie architektoniczne:
 * Standard obróbki meblowej 2.5D na 3-osiowym centrum obróbczym — formatka leży płasko w płaszczyźnie XY
 * (normalna formatki równoległa do globalnej osi ±Z: FACE_Z_PLUS lub FACE_Z_MINUS).
 * Obróbka w obróconym przestrzennie WCS wymaga dedykowanej transformacji płaszczyzny pracy (np. G68.2 / PLANE SPATIAL).
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
        let totalDepth = 0;
        let targetZ = 0;
        let compMode: 'OFF' | 'LEFT' | 'RIGHT' = 'OFF';
        let leadIn = customParams?.leadInMm ?? 5.0;
        let leadOut = customParams?.leadOutMm ?? 5.0;
        let reverseDir = customParams?.reverseDirection ?? false;

        if ('points' in feature) {
            const contour = feature as ContourFeature;
            if (contour.normal) {
                const isUnitZ = Math.hypot(contour.normal.x, contour.normal.y) <= 1e-4 && Math.abs(Math.abs(contour.normal.z) - 1.0) <= 1e-4;
                if (!isUnitZ) {
                    throw new Error(`[ProfilingStrategy] Nieobsługiwana orientacja w WCS dla konturu: normalna [${contour.normal.x}, ${contour.normal.y}, ${contour.normal.z}] nie jest poprawnym wektorem jednostkowym w osi Z. Obróbka 2.5D wymaga ułożenia formatki w płaszczyźnie XY stołu.`);
                }
            }
            if (contour.points && contour.points.length > 0) {
                const z0 = contour.points[0].z;
                const isPlanar = contour.points.every(p => Math.abs(p.z - z0) <= 1e-4);
                if (!isPlanar) {
                    throw new Error(`[ProfilingStrategy] Nieobsługiwana geometria w WCS: punkty konturu nie leżą w jednej płaszczyźnie poziomej Z stołu (brak stałego poziomu Z).`);
                }
            }
            points = contour.points;
            targetZ = typeof contour.depth === 'number' ? contour.depth : (points[0]?.z ?? 0);
            const startZ = points[0]?.z ?? targetZ;
            totalDepth = Math.abs(targetZ - startZ);
            if (contour.compensation === 'Left') compMode = 'LEFT';
            if (contour.compensation === 'Right') compMode = 'RIGHT';
            if (contour.leadIn !== undefined) leadIn = contour.leadIn;
            if (contour.leadOut !== undefined) leadOut = contour.leadOut;
            if (contour.reverseDirection !== undefined) reverseDir = contour.reverseDirection;
        } else if ('startPoint' in feature) {
            const groove = feature as any;
            if (groove.normal) {
                const isUnitZ = Math.hypot(groove.normal.x, groove.normal.y) <= 1e-4 && Math.abs(Math.abs(groove.normal.z) - 1.0) <= 1e-4;
                if (!isUnitZ) {
                    throw new Error(`[ProfilingStrategy] Nieobsługiwana orientacja w WCS dla rowka: normalna [${groove.normal.x}, ${groove.normal.y}, ${groove.normal.z}] nie jest poprawnym wektorem jednostkowym w osi Z. Obróbka 2.5D wymaga ułożenia formatki w płaszczyźnie XY stołu.`);
                }
            }
            if (groove.startPoint && groove.endPoint && Math.abs(groove.startPoint.z - groove.endPoint.z) > 1e-4) {
                throw new Error(`[ProfilingStrategy] Nieobsługiwana geometria w WCS dla rowka: punkty startu (${groove.startPoint.z}) i końca (${groove.endPoint.z}) mają różne poziomy Z. Obróbka 2.5D wymaga rowków poziomych.`);
            }
            points = [groove.startPoint, groove.endPoint];
            totalDepth = Math.abs(groove.depth || 10.0);
            targetZ = (groove.startPoint?.z || 0) - totalDepth;
        }

        if (points.length < 2) return [];

        const feed = customParams?.feedRate || tool.parameters.feedRate || 1200;
        const rpm = customParams?.spindleRpm || tool.parameters.spindleRpm || 18000;
        const toolRadius = tool.diameter / 2;
        const stepdown = customParams?.stepdownMm && customParams.stepdownMm > 0
            ? customParams.stepdownMm
            : ((tool.parameters?.stepDown && tool.parameters.stepDown > 0)
                ? tool.parameters.stepDown
                : (totalDepth > 0 ? totalDepth : 1));

        // Liczba przejść na głębokość
        const passesCount = totalDepth > 0 ? Math.ceil(totalDepth / stepdown) : 1;

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
            comment: `Profil Konturu, Poziom Z: ${targetZ}mm (${passesCount} przejść)`,
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
        // Kierunek ruchu na głębokość: +1 (w górę, np. FACE_Z_MINUS) lub -1 (w dół, np. FACE_Z_PLUS)
        const dirZ = (targetZ >= startPt.z) ? 1 : -1;
        // SafeZ leży na zewnątrz od strony powierzchni wejściowej (przeciwnie do kierunku cięcia)
        const safeZ = startPt.z - dirZ * 10.0;

        // Najazd szybki nad punkt startowy
        commands.push({
            type: 'GOTO',
            point: { x: startPt.x, y: startPt.y, z: safeZ }
        });

        // Wykonanie przejść na głębokość
        for (let pass = 1; pass <= passesCount; pass++) {
            const currentDepth = totalDepth > 0 ? Math.min(totalDepth, pass * stepdown) : 0;
            const passZ = totalDepth > 0 ? (startPt.z + dirZ * currentDepth) : targetZ;

            // Zjazd w materiał na pozycję startową danej warstwy
            commands.push({
                type: 'GOTO',
                point: { x: startPt.x, y: startPt.y, z: passZ }
            });

            // Ruch po kolejnych punktach konturu
            for (let i = 1; i < effectivePts.length; i++) {
                const pt = effectivePts[i];
                commands.push({
                    type: 'GOTO',
                    point: { x: pt.x, y: pt.y, z: passZ }
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
