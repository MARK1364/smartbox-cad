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

        const rawFeed = customParams?.feedRate !== undefined ? customParams.feedRate : (tool.parameters?.feedRate ?? 1500);
        const rawRpm = customParams?.spindleRpm !== undefined ? customParams.spindleRpm : (tool.parameters?.spindleRpm ?? 18000);

        if (typeof rawFeed !== 'number' || !Number.isFinite(rawFeed) || rawFeed <= 0) {
            throw new Error(`[PocketingStrategy] Posuw (feedRate) musi być skończoną liczbą dodatnią (feedRate=${rawFeed}).`);
        }
        if (typeof rawRpm !== 'number' || !Number.isFinite(rawRpm) || rawRpm <= 0) {
            throw new Error(`[PocketingStrategy] Obroty wrzeciona (spindleRpm) muszą być skończoną liczbą dodatnią (spindleRpm=${rawRpm}).`);
        }
        const feed = rawFeed;
        const rpm = rawRpm;

        if (customParams?.stepdownMm !== undefined) {
            if (typeof customParams.stepdownMm !== 'number' || !Number.isFinite(customParams.stepdownMm) || customParams.stepdownMm <= 0) {
                throw new Error(`[PocketingStrategy] Krok w dół (stepdownMm) musi być skończoną liczbą dodatnią (stepdownMm=${customParams.stepdownMm}).`);
            }
        }
        if (tool.parameters?.stepDown !== undefined) {
            if (typeof tool.parameters.stepDown !== 'number' || !Number.isFinite(tool.parameters.stepDown) || tool.parameters.stepDown <= 0) {
                throw new Error(`[PocketingStrategy] Krok wgłębny narzędzia (stepDown) musi być skończoną liczbą dodatnią (stepDown=${tool.parameters.stepDown}).`);
            }
        }

        const rawStepoverPercent = customParams?.stepoverPercent ?? tool.parameters?.stepoverPercent ?? 65;
        if (typeof rawStepoverPercent !== 'number' || !Number.isFinite(rawStepoverPercent) || rawStepoverPercent <= 0 || rawStepoverPercent > 100) {
            throw new Error(`[PocketingStrategy] Procent nakładania (stepoverPercent) musi być liczbą z zakresu (0, 100] (stepoverPercent=${rawStepoverPercent}).`);
        }
        const stepover = (rawStepoverPercent / 100) * tool.diameter;

        if ('boundaryPoints' in feature) {
            const pocket = feature as PocketFeature;
            if (!Array.isArray(pocket.boundaryPoints) || pocket.boundaryPoints.length < 4) {
                throw new Error(`[PocketingStrategy] Kieszeń musi posiadać co najmniej 4 punkty obwiedni dla "${pocket.featureId || 'unknown'}".`);
            }
            if (typeof pocket.depth !== 'number' || !Number.isFinite(pocket.depth) || Math.abs(pocket.depth) < 1e-4) {
                throw new Error(`[PocketingStrategy] Głębokość kieszeni musi być niezerową skończoną liczbą dla kieszeni "${pocket.featureId || 'unknown'}" (depth=${pocket.depth}).`);
            }
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

            const pts = pocket.boundaryPoints;
            if (pts.length > 5 || (pts.length === 5 && Math.hypot(pts[4].x - pts[0].x, pts[4].y - pts[0].y, pts[4].z - pts[0].z) > 1e-3)) {
                throw new Error(`[PocketingStrategy] Kieszeń "${pocket.featureId || 'unknown'}" musi mieć 4-wierzchołkową obwiednię prostokątną (otrzymano ${pts.length} punktów).`);
            }
            const p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
            const dxU = p1.x - p0.x, dyU = p1.y - p0.y, dzU = p1.z - p0.z;
            const dxV = p3.x - p0.x, dyV = p3.y - p0.y, dzV = p3.z - p0.z;
            const geomLenU = Math.hypot(dxU, dyU, dzU);
            const geomLenV = Math.hypot(dxV, dyV, dzV);
            if (geomLenU <= 1e-4 || geomLenV <= 1e-4) {
                throw new Error(`[PocketingStrategy] Obwiednia kieszeni "${pocket.featureId || 'unknown'}" nie jest prostokątem (zdegenerowany bok o zerowej długości).`);
            }
            const dotUV = dxU * dxV + dyU * dyV + dzU * dzV;
            if (Math.abs(dotUV) / (geomLenU * geomLenV) > 1e-3 ||
                Math.hypot(p2.x - (p1.x + dxV), p2.y - (p1.y + dyV), p2.z - (p1.z + dzV)) > 1e-2) {
                throw new Error(`[PocketingStrategy] Obwiednia kieszeni "${pocket.featureId || 'unknown'}" nie jest prostokątem.`);
            }

            const depth = Math.abs(pocket.depth);
            const maxDepthSpan = customParams?.workpieceDimensions?.thickness;
            if (typeof maxDepthSpan === 'number' && Number.isFinite(maxDepthSpan) && maxDepthSpan > 0) {
                if (depth > maxDepthSpan + 1e-4) {
                    throw new Error(`[PocketingStrategy] Głębokość kieszeni (${depth}mm) przekracza grubość materiału (${maxDepthSpan}mm) dla "${pocket.featureId || 'unknown'}".`);
                }
            }
            const width = pocket.width || geomLenU;
            const length = pocket.length || geomLenV;

            if (tool.diameter > geomLenU + 1e-4 || tool.diameter > geomLenV + 1e-4) {
                throw new Error(`[PocketingStrategy] Średnica frezu (${tool.diameter} mm) przekracza wymiary kieszeni (${geomLenU}x${geomLenV} mm) dla "${pocket.featureId || 'unknown'}".`);
            }

            const stepdown = (customParams?.stepdownMm && customParams.stepdownMm > 0)
                ? customParams.stepdownMm
                : ((tool.parameters?.stepDown && tool.parameters.stepDown > 0) ? tool.parameters.stepDown : depth);
            const passesCount = Math.max(1, Math.ceil(depth / stepdown));

            commands.push({
                type: 'COMMENT',
                comment: `Kieszeń Powierzchniowa W: ${width}mm, L: ${length}mm, Głębokość: ${depth}mm (${passesCount} przejść)`,
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

            const norm = pocket.normal || { x: 0, y: 0, z: 1 };
            const normLen = Math.hypot(norm.x, norm.y, norm.z) || 1.0;
            const unitNorm: Vector3D = {
                x: norm.x / normLen,
                y: norm.y / normLen,
                z: norm.z / normLen
            };

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

                for (let passIndex = 1; passIndex <= passesCount; passIndex++) {
                    const passDepth = Math.min(depth, passIndex * stepdown);
                    const toCut = (p: Vector3D): Vector3D => ({
                        x: p.x - unitNorm.x * passDepth,
                        y: p.y - unitNorm.y * passDepth,
                        z: p.z - unitNorm.z * passDepth
                    });

                    // Generowanie koncentrycznych pętli od zewnątrz do wewnątrz
                    let d = toolRadius;
                    const maxD = Math.min(lenU / 2, lenV / 2);

                    let isFirstPointInPass = true;

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

                        if (isFirstPointInPass) {
                            commands.push({
                                type: 'GOTO',
                                point: toSafe(surfQ0),
                                isRapid: true,
                                motion: 'RAPID'
                            });
                            commands.push({
                                type: 'GOTO',
                                point: q0
                            });
                            isFirstPointInPass = false;
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

                        d += effectiveStepover;
                    }

                    const centerCutPoint = toCut(center);
                    commands.push({
                        type: 'GOTO',
                        point: centerCutPoint
                    });

                    commands.push({
                        type: 'GOTO',
                        point: toSafe(center),
                        isRapid: true,
                        motion: 'RAPID'
                    });
                }
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
            if (typeof groove.depth !== 'number' || !Number.isFinite(groove.depth) || Math.abs(groove.depth) < 1e-4) {
                throw new Error(`[PocketingStrategy] Głębokość wpustu musi być niezerową liczbą skończoną dla "${groove.featureId || 'unknown'}" (depth=${groove.depth}).`);
            }
            if (typeof groove.width !== 'number' || !Number.isFinite(groove.width) || groove.width <= 0) {
                throw new Error(`[PocketingStrategy] Szerokość wpustu musi być dodatnią liczbą skończoną dla "${groove.featureId || 'unknown'}" (width=${groove.width}).`);
            }
            const maxDepthSpan = customParams?.workpieceDimensions?.thickness;
            if (typeof maxDepthSpan === 'number' && Number.isFinite(maxDepthSpan) && maxDepthSpan > 0) {
                if (Math.abs(groove.depth) > maxDepthSpan + 1e-4) {
                    throw new Error(`[PocketingStrategy] Głębokość wpustu (${Math.abs(groove.depth)}mm) przekracza grubość materiału (${maxDepthSpan}mm) dla "${groove.featureId || 'unknown'}".`);
                }
            }
            const depth = Math.abs(groove.depth);
            const width = groove.width;
            const effectiveToolWidth = (tool.type === 'groove' && typeof tool.parameters?.thickness === 'number' && Number.isFinite(tool.parameters.thickness) && tool.parameters.thickness > 0)
                ? tool.parameters.thickness
                : tool.diameter;
            if (effectiveToolWidth > width + 1e-4) {
                throw new Error(`[PocketingStrategy] Szerokość robocza narzędzia (${effectiveToolWidth}mm) przekracza szerokość wpustu (${width}mm) dla "${groove.featureId || 'unknown'}".`);
            }

            const grooveStepdown = (customParams?.stepdownMm && customParams.stepdownMm > 0)
                ? customParams.stepdownMm
                : ((tool.parameters?.stepDown && tool.parameters.stepDown > 0)
                    ? tool.parameters.stepDown
                    : depth);
            const passesCount = Math.max(1, Math.ceil(depth / grooveStepdown));

            commands.push({
                type: 'COMMENT',
                comment: `Wpust/Kieszeń Liniowa Szerokość: ${width}mm, Głębokość: ${depth}mm (${passesCount} przejść)`,
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

            const start = groove.reverseDirection ? groove.endPoint : groove.startPoint;
            const end = groove.reverseDirection ? groove.startPoint : groove.endPoint;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const segLen = Math.hypot(dx, dy);
            if (segLen <= 1e-4) {
                throw new Error(`[PocketingStrategy] Punkty startu i końca wpustu pokrywają się dla "${groove.featureId || 'unknown'}".`);
            }
            const px = -dy / segLen;
            const py = dx / segLen;
            const maxLateralOffset = Math.max(0, (width - effectiveToolWidth) / 2);
            const lateralOffsets: number[] = [];
            if (maxLateralOffset <= 1e-4) {
                lateralOffsets.push(0);
            } else {
                const effectiveStepover = Math.max(stepover, 0.5);
                const lateralSteps = Math.max(1, Math.ceil((2 * maxLateralOffset) / effectiveStepover));
                for (let i = 0; i <= lateralSteps; i++) {
                    lateralOffsets.push(-maxLateralOffset + (2 * maxLateralOffset) * (i / lateralSteps));
                }
            }

            const norm = groove.normal || (groove.face?.includes('MINUS') ? { x: 0, y: 0, z: -1 } : { x: 0, y: 0, z: 1 });
            const normLen = Math.hypot(norm.x, norm.y, norm.z) || 1.0;
            const signFlip = groove.flipDepthDirection ? -1 : 1;
            const unitNorm: Vector3D = {
                x: (norm.x / normLen) * signFlip,
                y: (norm.y / normLen) * signFlip,
                z: (norm.z / normLen) * signFlip
            };

            for (let passIndex = 1; passIndex <= passesCount; passIndex++) {
                const passDepth = Math.min(depth, passIndex * grooveStepdown);
                const firstOffset = lateralOffsets[0];
                const lastOffset = lateralOffsets[lateralOffsets.length - 1];
                const firstStart: Vector3D = {
                    x: start.x + px * firstOffset,
                    y: start.y + py * firstOffset,
                    z: start.z
                };
                const startSafe: Vector3D = {
                    x: firstStart.x + unitNorm.x * 10.0,
                    y: firstStart.y + unitNorm.y * 10.0,
                    z: firstStart.z + unitNorm.z * 10.0
                };

                // Ruch szybki nad start warstwy
                commands.push({
                    type: 'GOTO',
                    point: startSafe,
                    isRapid: true,
                    motion: 'RAPID'
                });

                let lastExitBase: Vector3D = end;
                for (let li = 0; li < lateralOffsets.length; li++) {
                    const latOff = lateralOffsets[li];
                    const rev = li % 2 === 1;
                    const pA = rev ? end : start;
                    const pB = rev ? start : end;
                    const cutStart: Vector3D = {
                        x: pA.x + px * latOff - unitNorm.x * passDepth,
                        y: pA.y + py * latOff - unitNorm.y * passDepth,
                        z: pA.z - unitNorm.z * passDepth
                    };
                    const cutEnd: Vector3D = {
                        x: pB.x + px * latOff - unitNorm.x * passDepth,
                        y: pB.y + py * latOff - unitNorm.y * passDepth,
                        z: pB.z - unitNorm.z * passDepth
                    };
                    commands.push({
                        type: 'GOTO',
                        point: cutStart
                    });
                    commands.push({
                        type: 'GOTO',
                        point: cutEnd
                    });
                    lastExitBase = {
                        x: pB.x + px * lastOffset,
                        y: pB.y + py * lastOffset,
                        z: pB.z
                    };
                }

                const endSafe: Vector3D = {
                    x: lastExitBase.x + unitNorm.x * 10.0,
                    y: lastExitBase.y + unitNorm.y * 10.0,
                    z: lastExitBase.z + unitNorm.z * 10.0
                };
                // Odjazd bezpieczny
                commands.push({
                    type: 'GOTO',
                    point: endSafe,
                    isRapid: true,
                    motion: 'RAPID'
                });
            }
        }

        return commands;
    }
}
