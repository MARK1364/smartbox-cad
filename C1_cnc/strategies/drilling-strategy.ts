/**
 * SmartPanel Web — C1_CNC Drilling Strategy
 * 
 * Strategia wiercenia otworów: cykle bezpośrednie (G81) oraz wiercenie głębokie z łamaniem wióra (G83 Peck Drilling).
 */

import { CAMFeature, HoleFeature, Tool, Vector3D } from '../dto/cam-dto.js';
import { CLCommand } from '../core/cl-data.js';
import { MachiningStrategy, StrategyParams } from './base-strategy.js';

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

        const feed = customParams?.feedRate || tool.parameters.feedRate || 1000;
        const rpm = customParams?.spindleRpm || tool.parameters.spindleRpm || 3000;
        const depth = -Math.abs(hole.depth);
        const retractR = hole.retractR || 5.0;
        const peckStep = customParams?.peckStepMm || 0;

        const commands: CLCommand[] = [];

        const positions = (hole.positions && hole.positions.length > 0) 
            ? hole.positions 
            : [hole.position];

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

        // 3. Wykonaj cykle wiercenia dla wszystkich pozycji w grupie
        for (const pt of positions) {
            const safeZ = pt.z + retractR;
            
            // Najazd nad otwór (wysokość bezpieczna R)
            commands.push({
                type: 'GOTO',
                point: { x: pt.x, y: pt.y, z: safeZ }
            });

            // Wygenerowanie komendy cyklu wiercenia CLData
            commands.push({
                type: 'CYCLE_DRILL',
                point: { x: pt.x, y: pt.y, z: pt.z + depth },
                drillParams: {
                    depth: depth,
                    retractR: retractR,
                    peckStep: peckStep > 0 ? peckStep : undefined,
                    type: peckStep > 0 ? 'PECK' : 'STANDARD'
                },
                featureId: hole.featureId
            });

            // Powrót do punktu bezpiecznego
            commands.push({
                type: 'GOTO',
                point: { x: pt.x, y: pt.y, z: safeZ }
            });
        }

        return commands;
    }
}
