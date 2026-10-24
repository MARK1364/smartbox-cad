/**
 * SmartPanel Web — C1_CNC Pocketing Strategy
 * 
 * Strategia czyszczenia kieszeni i wpustów: frezowanie współśrodkowe (Concentric Offset) / trochoidalne.
 * 
 * Założenie architektoniczne:
 * Standard obróbki meblowej 2.5D na 3-osiowym centrum obróbczym — formatka leży płasko w płaszczyźnie XY
 * (normalna formatki równoległa do globalnej osi ±Z: FACE_Z_PLUS lub FACE_Z_MINUS).
 * Obróbka w obróconym przestrzennie WCS wymaga dedykowanej transformacji płaszczyzny pracy (np. G68.2 / PLANE SPATIAL).
 */

import { CAMFeature, GrooveFeature, PocketFeature, Tool, Vector3D } from '../dto/cam-dto.js';
import { CLCommand } from '../core/cl-data.js';
import { MachiningStrategy, StrategyParams } from './base-strategy.js';

export class PocketingStrategy implements MachiningStrategy {
    readonly id = 'pocketing_concentric';
    readonly name = 'Czyszczenie Kieszeni / Wpustów (Pocket Clearing)';
    readonly description = 'Wybieranie materiału ze środka kieszeni z uwzględnieniem nakładania nakładek frezu (Stepover)';
    readonly targetFeatureTypes: Array<'hole' | 'groove' | 'contour' | 'pocket'> = ['pocket', 'groove'];

    public generateCLCommands(
        feature: CAMFeature,
        tool: Tool,
        wcsOrigin: Vector3D,
        customParams?: StrategyParams
    ): CLCommand[] {
        const commands: CLCommand[] = [];
        const feed = customParams?.feedRate || tool.parameters?.feedRate || 1500;
        const rpm = customParams?.spindleRpm || tool.parameters?.spindleRpm || 18000;
        const stepoverPercent = customParams?.stepoverPercent 
            ?? tool.parameters?.stepoverPercent 
            ?? 65;
        const stepover = (stepoverPercent / 100) * tool.diameter;

        if ('boundaryPoints' in feature) {
            const pocket = feature as PocketFeature;
            if (pocket.normal) {
                const isUnitZ = Math.hypot(pocket.normal.x, pocket.normal.y) <= 1e-4 && Math.abs(Math.abs(pocket.normal.z) - 1.0) <= 1e-4;
                if (!isUnitZ) {
                    throw new Error(`[PocketingStrategy] Nieobsługiwana orientacja w WCS: normalna [${pocket.normal.x}, ${pocket.normal.y}, ${pocket.normal.z}] nie jest poprawnym wektorem jednostkowym w osi Z. Obróbka 2.5D wymaga ułożenia formatki w płaszczyźnie XY stołu.`);
                }
            }
            if (pocket.boundaryPoints && pocket.boundaryPoints.length > 0) {
                const z0 = pocket.boundaryPoints[0].z;
                const isPlanar = pocket.boundaryPoints.every(p => Math.abs(p.z - z0) <= 1e-4);
                if (!isPlanar) {
                    throw new Error(`[PocketingStrategy] Nieobsługiwana geometria w WCS: punkty kieszeni nie leżą w jednej płaszczyźnie poziomej Z stołu (brak stałego poziomu Z).`);
                }
            }
            const depth = Math.abs(pocket.depth);
            const width = pocket.width;
            const length = pocket.length;

            commands.push({
                type: 'COMMENT',
                comment: `Kieszeń Powierzchniowa W: ${width}mm, L: ${length}mm, Głębokość: ${depth}mm`,
                featureId: pocket.featureId
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

            const pts = pocket.boundaryPoints;
            const norm = pocket.normal || { x: 0, y: 0, z: 1 };
            const normLen = Math.hypot(norm.x, norm.y, norm.z) || 1.0;
            const unitNorm: Vector3D = {
                x: norm.x / normLen,
                y: norm.y / normLen,
                z: norm.z / normLen
            };

            const toCut = (p: Vector3D): Vector3D => ({
                x: p.x - unitNorm.x * depth,
                y: p.y - unitNorm.y * depth,
                z: p.z - unitNorm.z * depth
            });

            const toSafe = (p: Vector3D): Vector3D => ({
                x: p.x + unitNorm.x * 10.0,
                y: p.y + unitNorm.y * 10.0,
                z: p.z + unitNorm.z * 10.0
            });

            if (pts.length >= 4) {
                const p0 = pts[0];
                const p1 = pts[1];
                const p3 = pts[3];

                const dxU = p1.x - p0.x;
                const dyU = p1.y - p0.y;
                const dzU = p1.z - p0.z;
                const lenU = Math.hypot(dxU, dyU, dzU) || width;

                const dxV = p3.x - p0.x;
                const dyV = p3.y - p0.y;
                const dzV = p3.z - p0.z;
                const lenV = Math.hypot(dxV, dyV, dzV) || length;

                const uAxis = {
                    x: lenU > 1e-6 ? dxU / lenU : 1,
                    y: lenU > 1e-6 ? dyU / lenU : 0,
                    z: lenU > 1e-6 ? dzU / lenU : 0,
                };
                const vAxis = {
                    x: lenV > 1e-6 ? dxV / lenV : 0,
                    y: lenV > 1e-6 ? dyV / lenV : 1,
                    z: lenV > 1e-6 ? dzV / lenV : 0,
                };

                const center = {
                    x: p0.x + uAxis.x * (lenU / 2) + vAxis.x * (lenV / 2),
                    y: p0.y + uAxis.y * (lenU / 2) + vAxis.y * (lenV / 2),
                    z: p0.z + uAxis.z * (lenU / 2) + vAxis.z * (lenV / 2),
                };

                const toolRadius = Math.max(1, tool.diameter / 2);
                const effectiveStepover = Math.max(0.5, stepover);

                // Generowanie koncentrycznych pętli od zewnątrz do wewnątrz
                let d = toolRadius;
                const maxD = Math.min(lenU / 2, lenV / 2);

                let isFirstPoint = true;
                let lastPoint: Vector3D = toCut(center);

                while (d <= maxD) {
                    const hw = Math.max(0, lenU / 2 - d);
                    const hl = Math.max(0, lenV / 2 - d);

                    const surfQ0: Vector3D = {
                        x: center.x - uAxis.x * hw - vAxis.x * hl,
                        y: center.y - uAxis.y * hw - vAxis.y * hl,
                        z: center.z - uAxis.z * hw - vAxis.z * hl
                    };
                    const surfQ1: Vector3D = {
                        x: center.x + uAxis.x * hw - vAxis.x * hl,
                        y: center.y + uAxis.y * hw - vAxis.y * hl,
                        z: center.z + uAxis.z * hw - vAxis.z * hl
                    };
                    const surfQ2: Vector3D = {
                        x: center.x + uAxis.x * hw + vAxis.x * hl,
                        y: center.y + uAxis.y * hw + vAxis.y * hl,
                        z: center.z + uAxis.z * hw + vAxis.z * hl
                    };
                    const surfQ3: Vector3D = {
                        x: center.x - uAxis.x * hw + vAxis.x * hl,
                        y: center.y - uAxis.y * hw + vAxis.y * hl,
                        z: center.z - uAxis.z * hw + vAxis.z * hl
                    };

                    const q0 = toCut(surfQ0);
                    const q1 = toCut(surfQ1);
                    const q2 = toCut(surfQ2);
                    const q3 = toCut(surfQ3);

                    if (isFirstPoint) {
                        commands.push({
                            type: 'GOTO',
                            point: toSafe(surfQ0)
                        });
                        commands.push({
                            type: 'GOTO',
                            point: q0
                        });
                        isFirstPoint = false;
                    } else {
                        commands.push({
                            type: 'GOTO',
                            point: q0
                        });
                    }

                    commands.push({ type: 'GOTO', point: q1 });
                    commands.push({ type: 'GOTO', point: q2 });
                    commands.push({ type: 'GOTO', point: q3 });
                    commands.push({ type: 'GOTO', point: q0 });

                    lastPoint = q0;
                    d += effectiveStepover;
                }

                const centerCutPoint = toCut(center);
                commands.push({
                    type: 'GOTO',
                    point: centerCutPoint
                });
                lastPoint = centerCutPoint;

                commands.push({
                    type: 'GOTO',
                    point: toSafe(center)
                });
            }
        } else if ('startPoint' in feature) {
            const groove = feature as GrooveFeature;
            if (groove.normal) {
                const isUnitZ = Math.hypot(groove.normal.x, groove.normal.y) <= 1e-4 && Math.abs(Math.abs(groove.normal.z) - 1.0) <= 1e-4;
                if (!isUnitZ) {
                    throw new Error(`[PocketingStrategy] Nieobsługiwana orientacja w WCS dla rowka: normalna [${groove.normal.x}, ${groove.normal.y}, ${groove.normal.z}] nie jest poprawnym wektorem jednostkowym w osi Z. Obróbka 2.5D wymaga ułożenia formatki w płaszczyźnie XY stołu.`);
                }
            }
            if (groove.startPoint && groove.endPoint && Math.abs(groove.startPoint.z - groove.endPoint.z) > 1e-4) {
                throw new Error(`[PocketingStrategy] Nieobsługiwana geometria w WCS dla rowka: punkty startu (${groove.startPoint.z}) i końca (${groove.endPoint.z}) mają różne poziomy Z. Obróbka 2.5D wymaga rowków poziomych.`);
            }
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
            const norm = groove.normal || { x: 0, y: 0, z: 1 };
            const normLen = Math.hypot(norm.x, norm.y, norm.z) || 1.0;
            const unitNorm: Vector3D = { x: norm.x / normLen, y: norm.y / normLen, z: norm.z / normLen };

            const startCut: Vector3D = {
                x: start.x - unitNorm.x * depth,
                y: start.y - unitNorm.y * depth,
                z: start.z - unitNorm.z * depth
            };
            const startSafe: Vector3D = {
                x: start.x + unitNorm.x * 10.0,
                y: start.y + unitNorm.y * 10.0,
                z: start.z + unitNorm.z * 10.0
            };
            const endCut: Vector3D = {
                x: end.x - unitNorm.x * depth,
                y: end.y - unitNorm.y * depth,
                z: end.z - unitNorm.z * depth
            };
            const endSafe: Vector3D = {
                x: end.x + unitNorm.x * 10.0,
                y: end.y + unitNorm.y * 10.0,
                z: end.z + unitNorm.z * 10.0
            };

            // Ruch szybki nad start
            commands.push({
                type: 'GOTO',
                point: startSafe
            });

            // Wcięcie w materiał
            commands.push({
                type: 'GOTO',
                point: startCut
            });

            // Przejście główne
            commands.push({
                type: 'GOTO',
                point: endCut
            });

            // Odjazd bezpieczny
            commands.push({
                type: 'GOTO',
                point: endSafe
            });
        }

        return commands;
    }
}
