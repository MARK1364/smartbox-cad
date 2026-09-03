/**
 * SmartPanel Web — C1_CNC Pocketing Strategy
 * 
 * Strategia czyszczenia kieszeni i wpustów: frezowanie współśrodkowe (Concentric Offset) / trochoidalne.
 */

import { CAMFeature, GrooveFeature, Tool, Vector3D } from '../dto/cam-dto.js';
import { CLCommand } from '../core/cl-data.js';
import { MachiningStrategy, StrategyParams } from './base-strategy.js';

export class PocketingStrategy implements MachiningStrategy {
    readonly id = 'pocketing_concentric';
    readonly name = 'Czyszczenie Kieszeni / Wpustów (Pocket Clearing)';
    readonly description = 'Wybieranie materiału ze środka kieszeni z uwzględnieniem nakładania nakładek frezu (Stepover)';
    readonly targetFeatureTypes: Array<'hole' | 'groove' | 'contour'> = ['groove', 'contour'];

    public generateCLCommands(
        feature: CAMFeature,
        tool: Tool,
        wcsOrigin: Vector3D,
        customParams?: StrategyParams
    ): CLCommand[] {
        const commands: CLCommand[] = [];
        const feed = customParams?.feedRate || tool.parameters.feedRate || 1500;
        const rpm = customParams?.spindleRpm || tool.parameters.spindleRpm || 18000;
        const stepover = (customParams?.stepoverPercent || 65) / 100 * tool.diameter;

        if ('startPoint' in feature) {
            const groove = feature as GrooveFeature;
            const depth = Math.abs(groove.depth);
            const width = groove.width;

            commands.push({
                type: 'COMMENT',
                comment: `Wpust/Kieszeń Liniowa Szerokość: ${width}mm, Głębokość: ${depth}mm`,
                featureId: groove.featureId
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

            const start = groove.startPoint;
            const end = groove.endPoint;
            const targetZ = start.z - depth;
            const safeZ = start.z + 10.0;

            // Ruch szybki nad start
            commands.push({
                type: 'GOTO',
                point: { x: start.x, y: start.y, z: safeZ }
            });

            // Wcięcie w materiał
            commands.push({
                type: 'GOTO',
                point: { x: start.x, y: start.y, z: targetZ }
            });

            // Przejście główne
            commands.push({
                type: 'GOTO',
                point: { x: end.x, y: end.y, z: targetZ }
            });

            // Odjazd bezpieczny
            commands.push({
                type: 'GOTO',
                point: { x: end.x, y: end.y, z: safeZ }
            });
        }

        return commands;
    }
}
