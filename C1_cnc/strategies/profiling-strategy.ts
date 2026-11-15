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

import { CAMFeature, ContourFeature, ContourSegment, GrooveFeature, Tool, Vector3D } from '../dto/cam-dto.js';
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
        let normalZ = 1;
        let compMode: 'OFF' | 'LEFT' | 'RIGHT' = 'OFF';
        if (customParams?.leadInMm !== undefined) {
            if (typeof customParams.leadInMm !== 'number' || !Number.isFinite(customParams.leadInMm) || customParams.leadInMm < 0) {
                throw new Error(`[ProfilingStrategy] Parametr najazdu leadInMm musi być skończoną liczbą nieujemną (leadInMm=${customParams.leadInMm}).`);
            }
        }
        if (customParams?.leadOutMm !== undefined) {
            if (typeof customParams.leadOutMm !== 'number' || !Number.isFinite(customParams.leadOutMm) || customParams.leadOutMm < 0) {
                throw new Error(`[ProfilingStrategy] Parametr wyjazdu leadOutMm musi być skończoną liczbą nieujemną (leadOutMm=${customParams.leadOutMm}).`);
            }
        }

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
            const startZ = points[0]?.z ?? 0;
            normalZ = contour.normal ? (contour.normal.z >= 0 ? 1 : -1) : 1;
            if (contour.depth !== undefined && (typeof contour.depth !== 'number' || !Number.isFinite(contour.depth))) {
                throw new Error(`[ProfilingStrategy] Głębokość konturu musi być skończoną liczbą dla "${contour.featureId || 'unknown'}" (depth=${contour.depth}).`);
            }
            const rawDepth = typeof contour.depth === 'number' ? contour.depth : startZ;
            const dirCheck = Math.sign(rawDepth - startZ);
            if (dirCheck !== 0 && dirCheck === -normalZ) {
                targetZ = rawDepth;
                totalDepth = Math.abs(targetZ - startZ);
            } else {
                totalDepth = Math.abs(rawDepth);
                targetZ = startZ - normalZ * totalDepth;
            }
            if (contour.compensation === 'Left') compMode = 'LEFT';
            if (contour.compensation === 'Right') compMode = 'RIGHT';
            if (contour.leadIn !== undefined) {
                if (typeof contour.leadIn !== 'number' || !Number.isFinite(contour.leadIn) || contour.leadIn < 0) {
                    throw new Error(`[ProfilingStrategy] Parametr najazdu konturu leadIn musi być skończoną liczbą nieujemną dla "${contour.featureId || 'unknown'}" (leadIn=${contour.leadIn}).`);
                }
                if (customParams?.leadInMm === undefined) {
                    leadIn = contour.leadIn;
                }
            }
            if (contour.leadOut !== undefined) {
                if (typeof contour.leadOut !== 'number' || !Number.isFinite(contour.leadOut) || contour.leadOut < 0) {
                    throw new Error(`[ProfilingStrategy] Parametr wyjazdu konturu leadOut musi być skończoną liczbą nieujemną dla "${contour.featureId || 'unknown'}" (leadOut=${contour.leadOut}).`);
                }
                if (customParams?.leadOutMm === undefined) {
                    leadOut = contour.leadOut;
                }
            }
            if (contour.reverseDirection !== undefined && customParams?.reverseDirection === undefined) reverseDir = contour.reverseDirection;
            const maxDepthSpan = customParams?.workpieceDimensions?.thickness;
            if (typeof maxDepthSpan === 'number' && Number.isFinite(maxDepthSpan) && maxDepthSpan > 0) {
                if (totalDepth > maxDepthSpan + 5.0 + 1e-4) {
                    throw new Error(`[ProfilingStrategy] Głębokość konturu (${totalDepth}mm) przekracza dopuszczalny limit dla materiału (${maxDepthSpan}mm + 5mm przeboju) dla "${contour.featureId || 'unknown'}".`);
                }
            }
        } else if ('startPoint' in feature) {
            const groove = feature as GrooveFeature;
            if (groove.normal) {
                const isUnitZ = Math.hypot(groove.normal.x, groove.normal.y) <= 1e-4 && Math.abs(Math.abs(groove.normal.z) - 1.0) <= 1e-4;
                if (!isUnitZ) {
                    throw new Error(`[ProfilingStrategy] Nieobsługiwana orientacja w WCS dla rowka: normalna [${groove.normal.x}, ${groove.normal.y}, ${groove.normal.z}] nie jest poprawnym wektorem jednostkowym w osi Z. Obróbka 2.5D wymaga ułożenia formatki w płaszczyźnie XY stołu.`);
                }
            }
            if (groove.startPoint && groove.endPoint && Math.abs(groove.startPoint.z - groove.endPoint.z) > 1e-4) {
                throw new Error(`[ProfilingStrategy] Nieobsługiwana geometria w WCS dla rowka: punkty startu (${groove.startPoint.z}) i końca (${groove.endPoint.z}) mają różne poziomy Z. Obróbka 2.5D wymaga rowków poziomych.`);
            }
            if (typeof groove.depth !== 'number' || !Number.isFinite(groove.depth) || Math.abs(groove.depth) < 1e-4) {
                throw new Error(`[ProfilingStrategy] Głębokość wpustu musi być niezerową liczbą skończoną dla "${groove.featureId || 'unknown'}" (depth=${groove.depth}).`);
            }
            const maxDepthSpan = customParams?.workpieceDimensions?.thickness;
            if (typeof maxDepthSpan === 'number' && Number.isFinite(maxDepthSpan) && maxDepthSpan > 0) {
                if (Math.abs(groove.depth) > maxDepthSpan + 1e-4) {
                    throw new Error(`[ProfilingStrategy] Głębokość wpustu (${Math.abs(groove.depth)}mm) przekracza grubość materiału (${maxDepthSpan}mm) dla "${groove.featureId || 'unknown'}".`);
                }
            }
            if (groove.leadIn !== undefined) {
                if (typeof groove.leadIn !== 'number' || !Number.isFinite(groove.leadIn) || groove.leadIn < 0) {
                    throw new Error(`[ProfilingStrategy] Parametr najazdu wpustu leadIn musi być skończoną liczbą nieujemną dla "${groove.featureId || 'unknown'}" (leadIn=${groove.leadIn}).`);
                }
                if (customParams?.leadInMm === undefined) {
                    leadIn = groove.leadIn;
                }
            }
            if (groove.leadOut !== undefined) {
                if (typeof groove.leadOut !== 'number' || !Number.isFinite(groove.leadOut) || groove.leadOut < 0) {
                    throw new Error(`[ProfilingStrategy] Parametr wyjazdu wpustu leadOut musi być skończoną liczbą nieujemną dla "${groove.featureId || 'unknown'}" (leadOut=${groove.leadOut}).`);
                }
                if (customParams?.leadOutMm === undefined) {
                    leadOut = groove.leadOut;
                }
            }
            if (groove.reverseDirection !== undefined && customParams?.reverseDirection === undefined) {
                reverseDir = groove.reverseDirection;
            }
            points = [groove.startPoint, groove.endPoint];
            totalDepth = Math.abs(groove.depth);
            let normalZ = groove.normal ? (groove.normal.z >= 0 ? 1 : -1) : (groove.face?.includes('MINUS') ? -1 : 1);
            if (groove.flipDepthDirection) {
                normalZ = -normalZ;
            }
            targetZ = (groove.startPoint?.z ?? 0) - normalZ * totalDepth;
        }
        if (customParams?.compensation !== undefined) {
            compMode = customParams.compensation;
        }

        if (points.length < 2) return [];

        const rawFeed = customParams?.feedRate !== undefined ? customParams.feedRate : (tool.parameters?.feedRate ?? 1200);
        const rawRpm = customParams?.spindleRpm !== undefined ? customParams.spindleRpm : (tool.parameters?.spindleRpm ?? 18000);

        if (typeof rawFeed !== 'number' || !Number.isFinite(rawFeed) || rawFeed <= 0) {
            throw new Error(`[ProfilingStrategy] Posuw (feedRate) musi być skończoną liczbą dodatnią (feedRate=${rawFeed}).`);
        }
        if (typeof rawRpm !== 'number' || !Number.isFinite(rawRpm) || rawRpm <= 0) {
            throw new Error(`[ProfilingStrategy] Obroty wrzeciona (spindleRpm) muszą być skończoną liczbą dodatnią (spindleRpm=${rawRpm}).`);
        }
        const feed = rawFeed;
        const rpm = rawRpm;

        if (customParams?.stepdownMm !== undefined) {
            if (typeof customParams.stepdownMm !== 'number' || !Number.isFinite(customParams.stepdownMm) || customParams.stepdownMm <= 0) {
                throw new Error(`[ProfilingStrategy] Krok w dół (stepdownMm) musi być skończoną liczbą dodatnią (stepdownMm=${customParams.stepdownMm}).`);
            }
        }
        if (typeof tool.parameters?.stepDown !== 'undefined' && (!Number.isFinite(tool.parameters.stepDown) || tool.parameters.stepDown <= 0)) {
            throw new Error(`[ProfilingStrategy] Krok w dół narzędzia (stepDown) musi być skończoną liczbą dodatnią dla narzędzia "${tool.id}" (stepDown=${tool.parameters.stepDown}).`);
        }
        const toolRadius = tool.diameter / 2;
        const stepdown = customParams?.stepdownMm && customParams.stepdownMm > 0
            ? customParams.stepdownMm
            : ((tool.parameters?.stepDown && tool.parameters.stepDown > 0)
                ? tool.parameters.stepDown
                : (totalDepth > 0 ? totalDepth : 1));

        // Liczba przejść na głębokość
        const passesCount = totalDepth > 0 ? Math.ceil(totalDepth / stepdown) : 1;

        const rawSegments = ('segments' in feature && Array.isArray((feature as ContourFeature).segments) && (feature as ContourFeature).segments!.length > 0)
            ? (feature as ContourFeature).segments!
            : null;

        let effectiveSegments: ContourSegment[] | null = null;
        if (rawSegments) {
            let segs: ContourSegment[] = reverseDir
                ? [...rawSegments].reverse().map(s =>
                    s.type === 'ARC'
                        ? {
                            ...s,
                            start: { ...s.end },
                            end: { ...s.start },
                            center: { ...s.center },
                            direction: s.direction === 'CW' ? 'CCW' : 'CW'
                        }
                        : {
                            ...s,
                            start: { ...s.end },
                            end: { ...s.start }
                        }
                )
                : rawSegments.map(s =>
                    s.type === 'ARC'
                        ? { ...s, start: { ...s.start }, end: { ...s.end }, center: { ...s.center } }
                        : { ...s, start: { ...s.start }, end: { ...s.end } }
                );

            if (compMode !== 'OFF' && toolRadius > 0.001) {
                const offsetSign = compMode === 'LEFT' ? -1 : 1;
                segs = segs.map(s => {
                    if (s.type === 'LINE') {
                        const dx = s.end.x - s.start.x;
                        const dy = s.end.y - s.start.y;
                        const len = Math.hypot(dx, dy) || 1;
                        const nx = (-dy / len) * offsetSign * toolRadius;
                        const ny = (dx / len) * offsetSign * toolRadius;
                        return {
                            ...s,
                            start: { x: s.start.x + nx, y: s.start.y + ny, z: s.start.z },
                            end: { x: s.end.x + nx, y: s.end.y + ny, z: s.end.z }
                        };
                    }
                    const radialSign = (s.direction === 'CCW' ? -1 : 1) * offsetSign;
                    const newRadius = s.radius + radialSign * toolRadius;
                    if (newRadius <= 1e-4) {
                        throw new Error(`[ProfilingStrategy] Promień narzędzia (${toolRadius}mm) jest zbyt duży dla wewnętrznego łuku konturu o promieniu ${s.radius}mm dla "${feature.featureId || 'unknown'}".`);
                    }
                    const scale = newRadius / s.radius;
                    return {
                        ...s,
                        radius: newRadius,
                        start: {
                            x: s.center.x + (s.start.x - s.center.x) * scale,
                            y: s.center.y + (s.start.y - s.center.y) * scale,
                            z: s.start.z
                        },
                        end: {
                            x: s.center.x + (s.end.x - s.center.x) * scale,
                            y: s.center.y + (s.end.y - s.center.y) * scale,
                            z: s.end.z
                        }
                    };
                });
            }

            if (leadIn > 0 && segs.length > 0) {
                const first = segs[0];
                let tx = 1, ty = 0;
                if (first.type === 'LINE') {
                    const dx = first.end.x - first.start.x;
                    const dy = first.end.y - first.start.y;
                    const len = Math.hypot(dx, dy) || 1;
                    tx = dx / len;
                    ty = dy / len;
                } else {
                    const rx = first.start.x - first.center.x;
                    const ry = first.start.y - first.center.y;
                    const rLen = Math.hypot(rx, ry) || 1;
                    tx = (first.direction === 'CCW' ? -ry : ry) / rLen;
                    ty = (first.direction === 'CCW' ? rx : -rx) / rLen;
                }
                const leadInStart: Vector3D = {
                    x: first.start.x - tx * leadIn,
                    y: first.start.y - ty * leadIn,
                    z: first.start.z
                };
                segs = [{ type: 'LINE', start: leadInStart, end: { ...first.start } }, ...segs];
            }

            if (leadOut > 0 && segs.length > 0) {
                const last = segs[segs.length - 1];
                let tx = 1, ty = 0;
                if (last.type === 'LINE') {
                    const dx = last.end.x - last.start.x;
                    const dy = last.end.y - last.start.y;
                    const len = Math.hypot(dx, dy) || 1;
                    tx = dx / len;
                    ty = dy / len;
                } else {
                    const rx = last.end.x - last.center.x;
                    const ry = last.end.y - last.center.y;
                    const rLen = Math.hypot(rx, ry) || 1;
                    tx = (last.direction === 'CCW' ? -ry : ry) / rLen;
                    ty = (last.direction === 'CCW' ? rx : -rx) / rLen;
                }
                const leadOutEnd: Vector3D = {
                    x: last.end.x + tx * leadOut,
                    y: last.end.y + ty * leadOut,
                    z: last.end.z
                };
                segs = [...segs, { type: 'LINE', start: { ...last.end }, end: leadOutEnd }];
            }

            effectiveSegments = segs;
        }

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

        // Uwaga: kompensacja promienia frezu (toolRadius) jest już wyliczona programowo
        // we współrzędnych środka narzędzia (effectivePts / effectiveSegments), dzięki czemu
        // G-code (Fanuc/Mach3), makra meblowe (WoodWOP/SCM/Biesse) i symulator 3D otrzymują
        // spójny tor bez podwójnego offsetu G41/G42.

        const startPt = effectiveSegments && effectiveSegments.length > 0
            ? effectiveSegments[0].start
            : effectivePts[0];
        const finalEndPt = effectiveSegments && effectiveSegments.length > 0
            ? effectiveSegments[effectiveSegments.length - 1].end
            : effectivePts[effectivePts.length - 1];
        // Kierunek ruchu na głębokość: +1 (w górę, np. FACE_Z_MINUS) lub -1 (w dół, np. FACE_Z_PLUS)
        const dirZ = totalDepth > 0 ? ((targetZ >= startPt.z) ? 1 : -1) : -normalZ;
        // SafeZ leży na zewnątrz od strony powierzchni wejściowej (przeciwnie do kierunku cięcia)
        const safeZ = startPt.z - dirZ * 10.0;

        // Najazd szybki nad punkt startowy
        commands.push({
            type: 'GOTO',
            point: { x: startPt.x, y: startPt.y, z: safeZ },
            isRapid: true,
            motion: 'RAPID'
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

            if (effectiveSegments && effectiveSegments.length > 0) {
                // Ruch po analitycznych segmentach (proste LINE + łuki ARC z G02/G03)
                let curX = startPt.x;
                let curY = startPt.y;
                for (const seg of effectiveSegments) {
                    if (Math.hypot(seg.start.x - curX, seg.start.y - curY) > 1e-3) {
                        commands.push({
                            type: 'GOTO',
                            point: { x: seg.start.x, y: seg.start.y, z: passZ }
                        });
                    }
                    if (seg.type === 'LINE') {
                        commands.push({
                            type: 'GOTO',
                            point: { x: seg.end.x, y: seg.end.y, z: passZ }
                        });
                    } else if (seg.type === 'ARC') {
                        const iVec = seg.center.x - seg.start.x;
                        const jVec = seg.center.y - seg.start.y;
                        commands.push({
                            type: 'ARC',
                            point: {
                                x: seg.end.x,
                                y: seg.end.y,
                                z: passZ,
                                i: iVec,
                                j: jVec
                            },
                            arcParams: {
                                center: seg.center,
                                radius: seg.radius,
                                plane: seg.plane || 'XY',
                                direction: seg.direction
                            }
                        });
                    }
                    curX = seg.end.x;
                    curY = seg.end.y;
                }
            } else {
                // Ruch po kolejnych punktach konturu
                for (let i = 1; i < effectivePts.length; i++) {
                    const pt = effectivePts[i];
                    commands.push({
                        type: 'GOTO',
                        point: { x: pt.x, y: pt.y, z: passZ }
                    });
                }
            }

            // Jeśli przed nami kolejne przejście, wycofaj narzędzie na SafeZ i przejedź nad startPt ruchem szybkim
            if (pass < passesCount) {
                commands.push({
                    type: 'GOTO',
                    point: { x: finalEndPt.x, y: finalEndPt.y, z: safeZ },
                    isRapid: true,
                    motion: 'RAPID'
                });
                const distToStart = Math.hypot(finalEndPt.x - startPt.x, finalEndPt.y - startPt.y);
                if (distToStart > 1e-4) {
                    commands.push({
                        type: 'GOTO',
                        point: { x: startPt.x, y: startPt.y, z: safeZ },
                        isRapid: true,
                        motion: 'RAPID'
                    });
                }
            }
        }

        commands.push({
            type: 'GOTO',
            point: { x: finalEndPt.x, y: finalEndPt.y, z: safeZ },
            isRapid: true,
            motion: 'RAPID'
        });

        return commands;
    }
}
