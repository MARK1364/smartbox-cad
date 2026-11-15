/**
 * SmartPanel Web — C1_CNC Drilling Strategy
 * 
 * Strategia wiercenia otworów: cykle bezpośrednie (G81) oraz wiercenie głębokie z łamaniem wióra (G83 Peck Drilling).
 */

import { CAMFeature, HoleFeature, Tool, Vector3D } from '../dto/cam-dto.js';
import { CLCommand } from '../core/cl-data.js';
import { MachiningStrategy, StrategyParams } from './base-strategy.js';
import { MAX_THROUGH_OVERDRILL_MM, MIN_THROUGH_DEPTH_TOLERANCE_MM } from '../geometry/geometry-extractor.js';

export class DrillingStrategy implements MachiningStrategy {
    readonly id = 'drilling_standard';
    readonly name = 'Wiercenie Cykliczne (G81 / G83)';
    readonly description = 'Wiercenie otworów pionowych z opcją głębokiego łamania wióra (Peck Drilling)';
    readonly targetFeatureTypes: Array<'hole' | 'groove' | 'contour'> = ['hole'];

    public generateCLCommands(
        feature: CAMFeature,
        tool: Tool,
        wcsOrigin: Vector3D,
        customParams?: StrategyParams
    ): CLCommand[] {
        if (!('position' in feature)) return [];
        const hole = feature as HoleFeature;

        const feed = customParams?.feedRate !== undefined ? customParams.feedRate : (tool.parameters.feedRate ?? 1000);
        const rpm = customParams?.spindleRpm !== undefined ? customParams.spindleRpm : (tool.parameters.spindleRpm ?? 3000);
        const depth = -Math.abs(hole.depth);
        const retractR = hole.retractR !== undefined ? hole.retractR : 5.0;
        const peckStep = customParams?.peckStepMm !== undefined ? customParams.peckStepMm : 0;

        if (typeof hole.diameter !== 'number' || !Number.isFinite(hole.diameter) || hole.diameter <= 0) {
            throw new Error(`[DrillingStrategy] Średnica otworu musi być skończoną liczbą dodatnią dla otworu "${hole.featureId || 'unknown'}" (diameter=${hole.diameter}).`);
        }
        if (typeof hole.depth !== 'number' || !Number.isFinite(hole.depth) || Math.abs(hole.depth) < 1e-4) {
            throw new Error(`[DrillingStrategy] Głębokość wiercenia musi być niezerową skończoną liczbą dla otworu "${hole.featureId || 'unknown'}" (depth=${hole.depth}).`);
        }
        const wpDims = customParams?.workpieceDimensions;
        if (wpDims &&
            typeof wpDims.width === 'number' && Number.isFinite(wpDims.width) && wpDims.width > 0 &&
            typeof wpDims.height === 'number' && Number.isFinite(wpDims.height) && wpDims.height > 0 &&
            typeof wpDims.thickness === 'number' && Number.isFinite(wpDims.thickness) && wpDims.thickness > 0) {
            const rawAx = hole.panelAxis || hole.axis || { x: 0, y: 0, z: -1 };
            let materialSpan = wpDims.thickness;
            if (hole.face === 'FACE_X_PLUS' || hole.face === 'FACE_X_MINUS') {
                materialSpan = wpDims.width;
            } else if (hole.face === 'FACE_Y_PLUS' || hole.face === 'FACE_Y_MINUS') {
                materialSpan = wpDims.height;
            } else if (hole.face === 'FACE_Z_PLUS' || hole.face === 'FACE_Z_MINUS') {
                materialSpan = wpDims.thickness;
            } else if (Math.abs(rawAx.z) < Math.max(Math.abs(rawAx.x), Math.abs(rawAx.y))) {
                if (hole.panelAxis) {
                    materialSpan = Math.abs(hole.panelAxis.x) >= Math.abs(hole.panelAxis.y) ? wpDims.width : wpDims.height;
                } else {
                    materialSpan = Math.max(wpDims.width, wpDims.height);
                }
            }
            if (hole.through && Math.abs(hole.depth) < materialSpan - MIN_THROUGH_DEPTH_TOLERANCE_MM) {
                throw new Error(
                    `[DrillingStrategy] Otwór przelotowy (through=true) ma głębokość (${Math.abs(hole.depth)} mm) mniejszą niż wymiar materiału (${materialSpan} mm) dla otworu "${hole.featureId || 'unknown'}".`
                );
            }
            const maxBlindDepth = materialSpan - MIN_THROUGH_DEPTH_TOLERANCE_MM;
            if (!hole.through && Math.abs(hole.depth) >= maxBlindDepth - 1e-4) {
                throw new Error(
                    `[DrillingStrategy] Głębokość wiercenia nieprzelotowego (${Math.abs(hole.depth)} mm) przekracza dopuszczalny wymiar materiału (${maxBlindDepth} mm przy grubości w osi=${materialSpan} mm) dla otworu "${hole.featureId || 'unknown'}".`
                );
            }
            const maxAllowedDepth = hole.through ? (materialSpan + MAX_THROUGH_OVERDRILL_MM) : maxBlindDepth;
            if (Math.abs(hole.depth) > maxAllowedDepth + 1e-4) {
                throw new Error(
                    `[DrillingStrategy] Głębokość wiercenia (${Math.abs(hole.depth)} mm) przekracza dopuszczalny wymiar materiału (${maxAllowedDepth} mm, grubość w osi=${materialSpan} mm${hole.through ? `, przebój przelotowy +${MAX_THROUGH_OVERDRILL_MM} mm` : ''}) dla otworu "${hole.featureId || 'unknown'}".`
                );
            }
        }
        if (!Number.isFinite(feed) || feed <= 0) {
            throw new Error(`[DrillingStrategy] Posuw wiercenia musi być skończoną liczbą dodatnią dla otworu "${hole.featureId || 'unknown'}" (feedRate=${feed}).`);
        }
        if (!Number.isFinite(rpm) || rpm <= 0) {
            throw new Error(`[DrillingStrategy] Obroty wrzeciona muszą być skończoną liczbą dodatnią dla otworu "${hole.featureId || 'unknown'}" (spindleRpm=${rpm}).`);
        }
        if (!Number.isFinite(retractR) || retractR <= 0) {
            throw new Error(`[DrillingStrategy] Odskok bezpieczny (retractR) musi być skończoną liczbą dodatnią dla otworu "${hole.featureId || 'unknown'}" (retractR=${retractR}).`);
        }
        if (!Number.isFinite(peckStep) || peckStep < 0) {
            throw new Error(`[DrillingStrategy] Krok wiercenia (peckStep) musi być skończoną liczbą nieujemną dla otworu "${hole.featureId || 'unknown'}" (peckStep=${peckStep}).`);
        }

        const commands: CLCommand[] = [];

        const positions = (hole.positions && hole.positions.length > 0) 
            ? hole.positions 
            : [hole.position];

        for (const pt of positions) {
            if (!pt || typeof pt.x !== 'number' || !Number.isFinite(pt.x) ||
                typeof pt.y !== 'number' || !Number.isFinite(pt.y) ||
                typeof pt.z !== 'number' || !Number.isFinite(pt.z)) {
                throw new Error(`[DrillingStrategy] Pozycja otworu musi mieć skończone współrzędne dla otworu "${hole.featureId || 'unknown'}" (pos=[${pt?.x}, ${pt?.y}, ${pt?.z}]).`);
            }
        }

        // 1. Komentarz
        commands.push({
            type: 'COMMENT',
            comment: positions.length > 1 
                ? `Grupa otworów (${positions.length}x) FI ${hole.diameter}mm, Głębokość: ${hole.depth}mm`
                : `Otwór FI ${hole.diameter}mm, Głębokość: ${hole.depth}mm`,
            featureId: hole.featureId
        });

        // 2. Wybór narzędzia i parametrów skrawania
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

        const rawDepth = Math.abs(hole.depth);
        const rawAxis = hole.axis || { x: 0, y: 0, z: -1 };
        if (
            typeof rawAxis.x !== 'number' || !Number.isFinite(rawAxis.x) ||
            typeof rawAxis.y !== 'number' || !Number.isFinite(rawAxis.y) ||
            typeof rawAxis.z !== 'number' || !Number.isFinite(rawAxis.z)
        ) {
            throw new Error(`[DrillingStrategy] Oś wiercenia musi mieć skończone współrzędne liczbowe dla otworu "${hole.featureId || 'unknown'}" (axis=[${rawAxis?.x}, ${rawAxis?.y}, ${rawAxis?.z}]).`);
        }
        const axisLen = Math.hypot(rawAxis.x, rawAxis.y, rawAxis.z);
        if (!Number.isFinite(axisLen) || axisLen < 1e-6) {
            throw new Error(`[DrillingStrategy] Oś wiercenia nie może być wektorem zerowym ani bliskim zeru dla otworu "${hole.featureId || 'unknown'}".`);
        }
        const dir = { x: rawAxis.x / axisLen, y: rawAxis.y / axisLen, z: rawAxis.z / axisLen };

        // 3. Wykonaj cykle wiercenia dla wszystkich pozycji w grupie
        for (const pt of positions) {
            const approachPoint = {
                x: pt.x - dir.x * retractR,
                y: pt.y - dir.y * retractR,
                z: pt.z - dir.z * retractR
            };
            const bottomPoint = {
                x: pt.x + dir.x * rawDepth,
                y: pt.y + dir.y * rawDepth,
                z: pt.z + dir.z * rawDepth
            };
            
            // Najazd przed otwór (odległość bezpieczna R)
            commands.push({
                type: 'GOTO',
                point: approachPoint,
                isRapid: true,
                motion: 'RAPID'
            });

            // Wygenerowanie komendy cyklu wiercenia CLData (punkt na powierzchni wejściowej formatki)
            commands.push({
                type: 'CYCLE_DRILL',
                point: { x: pt.x, y: pt.y, z: pt.z },
                drillParams: {
                    depth: -rawDepth,
                    retractR: retractR,
                    peckStep: peckStep > 0 ? peckStep : undefined,
                    type: peckStep > 0 ? 'PECK' : 'STANDARD',
                    axis: dir,
                    face: hole.face
                },
                toolDiameter: hole.diameter,
                featureId: hole.featureId
            });

            // Powrót do punktu bezpiecznego
            commands.push({
                type: 'GOTO',
                point: approachPoint,
                isRapid: true,
                motion: 'RAPID'
            });
        }

        return commands;
    }
}
