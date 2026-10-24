/**
 * SmartPanel Web — C1_CNC CAM Processor
 * 
 * Procesor CAM przygotowujący i optymalizujący operacje CNC przed przekazaniem do postprocesorów.
 */

import {
    CAMProject,
    CAMFeature,
    HoleFeature,
    GrooveFeature,
    ContourFeature,
    PocketFeature,
    CNCOperation,
    CNCMove,
    Tool,
    Vector3D
} from '../dto/cam-dto.js';
import { CLCommand, CLDataProgram } from '../core/cl-data.js';
import { ToolLibrary } from './tool-library.js';
import {
    createVector3D,
    vecDistance,
    vecSub,
    vecNormalize,
    vecScale,
    calculateRadiusOffsetPath,
    generateEffectiveContourPath,
    optimizePath2Opt
} from '../geometry/cnc-geometry-utils.js';
import { MachiningStrategy, StrategyParams } from '../strategies/base-strategy.js';
import { DrillingStrategy } from '../strategies/drilling-strategy.js';
import { ProfilingStrategy } from '../strategies/profiling-strategy.js';
import { PocketingStrategy } from '../strategies/pocketing-strategy.js';

export interface AssignmentIssues {
    unassignedHolesMm: Record<number, number>;
    unassignedGrooves: number;
    unassignedContours: number;
    unassignedPockets: number;
    totalUnassigned: number;
}

export class CAMProcessor {
    private toolLibrary: ToolLibrary;
    private strategies: Map<string, MachiningStrategy> = new Map<string, MachiningStrategy>([
        ['drilling_standard', new DrillingStrategy()],
        ['profiling_25d', new ProfilingStrategy()],
        ['pocketing_concentric', new PocketingStrategy()]
    ]);
    private lastAssignmentIssues: AssignmentIssues = {
        unassignedHolesMm: {},
        unassignedGrooves: 0,
        unassignedContours: 0,
        unassignedPockets: 0,
        totalUnassigned: 0
    };

    public registerStrategy(strategy: MachiningStrategy): void {
        this.strategies.set(strategy.id, strategy);
    }

    public getStrategy(id: string): MachiningStrategy | undefined {
        return this.strategies.get(id);
    }

    constructor(toolLibrary?: ToolLibrary) {
        this.toolLibrary = toolLibrary || new ToolLibrary();
    }

    public getLastAssignmentIssues(): AssignmentIssues {
        return { ...this.lastAssignmentIssues };
    }

    /**
     * Operacje CNC dla symulatora 3D i postprocesorów (CNCOperation[]).
     * Pełna optymalizacja trasy TSP (Nearest Neighbor + 2-Opt) na poziomie pojedynczych operacji i otworów.
     * Uwzględnia wybraną strategię obróbczą (strategyId), aby symulacja i podgląd ścieżek
     * dokładnie odzwierciedlały parametry wybranej strategii.
     */
    public processProject(project: CAMProject, strategyId?: string): CNCOperation[] {
        const effectiveStrategyId = strategyId || project.strategyId;
        const featuresWithTools = this.assignToolsToFeatures(project.features);
        this.collectAssignmentIssues(featuresWithTools);
        const rawOperations = this.createCncOperations(
            featuresWithTools,
            project.wcsOrigin,
            effectiveStrategyId,
            project.strategyParams
        );
        return this.optimizeOperations(rawOperations, project.wcsOrigin);
    }

    /**
     * Jedyne wejście dla postprocesorów: CLDataProgram (ISO 4343 / APT).
     *
     * Budowa idzie tą samą ścieżką co `processProject` (ta sama optymalizacja
     * kolejności i ta sama geometria), tyle że wynik jest neutralną listą
     * komend CL zamiast strukturą specyficzną dla symulatora.
     */
    public buildCLProgram(project: CAMProject, strategyId?: string): CLDataProgram {
        const effectiveStrategyId = strategyId || project.strategyId;
        let strategyCommands: CLCommand[] = [];
        const toolIdsUsed: string[] = [];
        let projectToProcess = project;

        if (effectiveStrategyId && this.strategies.has(effectiveStrategyId)) {
            const strategy = this.strategies.get(effectiveStrategyId)!;
            const featuresWithTools = this.assignToolsToFeatures(project.features);
            const remainingFeatures: CAMFeature[] = [];

            for (const feat of featuresWithTools) {
                const featureType: 'hole' | 'contour' | 'groove' | 'pocket' = ('position' in feat) 
                    ? 'hole' 
                    : (('boundaryPoints' in feat)
                        ? 'pocket'
                        : (('points' in feat) ? 'contour' : 'groove'));

                const isTargetOfStrategy = strategy.targetFeatureTypes.includes(featureType);
                const tool = feat.toolId ? this.toolLibrary.getTool(feat.toolId) : null;

                if (isTargetOfStrategy && tool) {
                    const stratCmds = strategy.generateCLCommands(feat, tool, project.wcsOrigin, project.strategyParams);
                    if (stratCmds.length > 0) {
                        strategyCommands.push(...stratCmds);
                        if (!toolIdsUsed.includes(tool.id)) toolIdsUsed.push(tool.id);
                    } else {
                        remainingFeatures.push(feat);
                    }
                } else {
                    remainingFeatures.push(feat);
                }
            }

            // Jeśli strategia obsłużyła wszystkie cechy, wystarczy zamknąć program komendą STOP
            if (remainingFeatures.length === 0 && strategyCommands.length > 0) {
                strategyCommands.push({ type: 'STOP' });
                return {
                    projectName: project.projectName || 'CAM_PROGRAM',
                    wcsName: project.wcsName || 'G55',
                    wcsOrigin: project.wcsOrigin,
                    commands: strategyCommands,
                    totalLengthMm: 0,
                    estimatedTimeSec: 0,
                    toolIdsUsed,
                    workpieceDimensions: project.workpieceDimensions
                };
            }

            // Pozostałe cechy (np. wpusty i kontury przy wybranej strategii wiercenia) są zachowywane
            projectToProcess = {
                ...project,
                features: remainingFeatures
            };
        }

        const operations = this.processProject(projectToProcess, effectiveStrategyId);
        const commands: CLCommand[] = [...strategyCommands];
        let totalLengthMm = 0;
        let estimatedTimeSec = 0;
        let cursor: Vector3D = createVector3D();
        let activeToolId: string | null = null;
        let activeRpm: number | null = null;
        let activeFeed: number | null = null;

        for (const op of operations) {
            const tool = this.toolLibrary.getTool(op.toolId);
            const p = op.parameters;

            if (!toolIdsUsed.includes(op.toolId)) toolIdsUsed.push(op.toolId);

            // Jedna zmiana narzędzia / wrzeciona / posuwu na grupę — nie przy każdym otworze.
            if (op.toolId !== activeToolId) {
                commands.push({
                    type: 'TOOL_SELECT',
                    toolId: op.toolId,
                    toolDiameter: tool?.diameter,
                    toolName: tool?.name,
                });
                activeToolId = op.toolId;
                activeRpm = null;
                activeFeed = null;
            }
            if (p.spindleRpm !== activeRpm) {
                commands.push({
                    type: 'SPINDL',
                    spindleRpm: p.spindleRpm,
                    spindleDirection: 'CW',
                });
                activeRpm = p.spindleRpm ?? null;
            }
            if (p.feedRate !== activeFeed) {
                commands.push({ type: 'FEDRAT', feedRate: p.feedRate });
                activeFeed = p.feedRate ?? null;
            }

            if (op.type === 'drill') {
                const retractR = p.retractR ?? 5.0;
                // Modalny G81/G83: same CYCLE_DRILL pod rząd — postprocesor emituje
                // pełny cykl raz, potem same XY. Bez zbędnego G1 nad każdym otworem.
                commands.push({
                    type: 'CYCLE_DRILL',
                    point: { x: op.position.x, y: op.position.y, z: op.position.z },
                    drillParams: {
                        depth: p.depth,
                        retractR,
                        type: 'STANDARD',
                        axis: p.axis || { x: 0, y: 0, z: -1 },
                        face: p.face,
                    },
                    toolDiameter: p.diameter,
                });
                totalLengthMm += Math.abs(retractR);
                estimatedTimeSec += Math.abs(p.depth) / Math.max(1, p.feedRate) * 60;
                cursor = { x: op.position.x, y: op.position.y, z: op.position.z + retractR };
                continue;
            }

            // contour / groove: seria GOTO po moves na właściwym poziomie cięcia
            const norm: Vector3D = p.normal || { x: 0, y: 0, z: 1 };
            const normLen = Math.hypot(norm.x, norm.y, norm.z) || 1.0;
            const unitNorm: Vector3D = { x: norm.x / normLen, y: norm.y / normLen, z: norm.z / normLen };
            const targetPos = op.position;
            const surfacePos: Vector3D = p.surfacePoint || { x: targetPos.x, y: targetPos.y, z: p.surfaceZ ?? targetPos.z };
            const clearance = 5.0;

            const safePos: Vector3D = {
                x: surfacePos.x + unitNorm.x * clearance,
                y: surfacePos.y + unitNorm.y * clearance,
                z: surfacePos.z + unitNorm.z * clearance
            };

            commands.push({ type: 'GOTO', point: safePos });
            commands.push({ type: 'GOTO', point: { x: targetPos.x, y: targetPos.y, z: targetPos.z } });
            cursor = { x: targetPos.x, y: targetPos.y, z: targetPos.z };

            for (const move of p.moves || []) {
                if (move.type !== 'line' || !move.endPoint) continue;
                const e = move.endPoint;
                const step = vecDistance(cursor, e);
                commands.push({ type: 'GOTO', point: { x: e.x, y: e.y, z: e.z } });
                totalLengthMm += step;
                estimatedTimeSec += step / Math.max(1, p.feedRate) * 60;
                cursor = { x: e.x, y: e.y, z: e.z };
            }
            // Bezpieczne wycofanie po zakończeniu cięcia konturu/wpustu wzdłuż wektora normalnego
            const exitSafePos: Vector3D = {
                x: cursor.x + unitNorm.x * clearance,
                y: cursor.y + unitNorm.y * clearance,
                z: cursor.z + unitNorm.z * clearance
            };
            commands.push({ type: 'GOTO', point: exitSafePos });
            cursor = exitSafePos;
        }

        commands.push({ type: 'STOP' });

        return {
            projectName: project.projectName,
            wcsName: project.wcsName || 'G55',
            wcsOrigin: project.wcsOrigin,
            commands,
            totalLengthMm: Math.round(totalLengthMm * 1000) / 1000,
            estimatedTimeSec: Math.round(estimatedTimeSec * 100) / 100,
            toolIdsUsed,
            workpieceDimensions: project.workpieceDimensions,
        };
    }

    /**
     * Przygotowuje kopie cech. NIE przypisuje automatycznie narzędzi —
     * każda cecha musi mieć jawnie ustawiony toolId przez użytkownika.
     * Cechy bez toolId zostaną pominięte w generowaniu operacji.
     */
    public assignToolsToFeatures(features: CAMFeature[]): CAMFeature[] {
        return features.map(feat => JSON.parse(JSON.stringify(feat)));
    }

    private collectAssignmentIssues(features: CAMFeature[]): void {
        const holesMm: Record<number, number> = {};
        let unassignedGrooves = 0;
        let unassignedContours = 0;
        let unassignedPockets = 0;

        for (const feat of features) {
            if (!feat.toolId || !this.toolLibrary.getTool(feat.toolId)) {
                if ('diameter' in feat) {
                    const hole = feat as HoleFeature;
                    const dia = Math.round(hole.diameter * 10) / 10;
                    const count = hole.holeCount || (hole.positions ? hole.positions.length : 1);
                    holesMm[dia] = (holesMm[dia] || 0) + count;
                } else if ('boundaryPoints' in feat) {
                    unassignedPockets++;
                } else if ('startPoint' in feat) {
                    unassignedGrooves++;
                } else if ('points' in feat) {
                    unassignedContours++;
                }
            }
        }

        const totalHoles = Object.values(holesMm).reduce((a, b) => a + b, 0);
        this.lastAssignmentIssues = {
            unassignedHolesMm: holesMm,
            unassignedGrooves,
            unassignedContours,
            unassignedPockets,
            totalUnassigned: totalHoles + unassignedGrooves + unassignedContours + unassignedPockets
        };
    }

    /**
     * Optymalizuje kolejność fizycznych operacji CNC:
     * 1. Grupowanie operacji według ID narzędzia (minimalizacja wymian narzędzi).
     * 2. Optymalizacja komiwojażera TSP (Nearest Neighbor + 2-Opt) dla operacji wiercenia i konturowania,
     *    co diametralnie skraca sumaryczną drogę jałową (G0 Rapid Travel) i eliminuje przecinanie się tras.
     */
    public optimizeOperations(operations: CNCOperation[], wcsOrigin: Vector3D = { x: 0, y: 0, z: 0 }): CNCOperation[] {
        if (!operations || operations.length <= 1) return operations ? [...operations] : [];

        // 1. Grupowanie według ID narzędzia
        const byTool: Map<string, CNCOperation[]> = new Map();
        for (const op of operations) {
            const tid = op.toolId || "unassigned";
            if (!byTool.has(tid)) byTool.set(tid, []);
            byTool.get(tid)!.push(op);
        }

        const optimized: CNCOperation[] = [];
        let cursor = { ...wcsOrigin };

        for (const [_, toolOps] of byTool.entries()) {
            const drills = toolOps.filter(o => o.type === 'drill');
            const others = toolOps.filter(o => o.type !== 'drill');

            // 2. Optymalizacja otworów (TSP 2-Opt dla każdego narzędzia wiertarskiego)
            if (drills.length > 0) {
                const optDrills = optimizePath2Opt(drills, d => d.position, cursor);
                optimized.push(...optDrills);
                cursor = { ...optDrills[optDrills.length - 1].position };
            }

            // 3. Optymalizacja frezowania / wpustów (TSP 2-Opt dla frezów)
            if (others.length > 0) {
                const optOthers = optimizePath2Opt(others, o => o.position, cursor);
                optimized.push(...optOthers);
                const lastOther = optOthers[optOthers.length - 1];
                const moves = lastOther.parameters?.moves;
                if (moves && moves.length > 0 && moves[moves.length - 1].endPoint) {
                    cursor = { ...moves[moves.length - 1].endPoint };
                } else {
                    cursor = { ...lastOther.position };
                }
            }
        }

        return optimized;
    }

    /**
     * Optymalizuje kolejność cech CAM: grupowanie według narzędzia + algorytm TSP 2-Opt.
     */
    public optimizeFeatureOrder(features: CAMFeature[]): CAMFeature[] {
        if (!features || features.length === 0) return [];

        const byTool: Map<string, CAMFeature[]> = new Map();
        for (const f of features) {
            const tid = f.toolId || "unassigned";
            if (!byTool.has(tid)) byTool.set(tid, []);
            byTool.get(tid)!.push(f);
        }

        const optimizedAll: CAMFeature[] = [];

        const getPos = (feat: CAMFeature): Vector3D => {
            if ('position' in feat) return feat.position;
            if ('startPoint' in feat) return feat.startPoint;
            if ('boundaryPoints' in feat && feat.boundaryPoints.length > 0) return feat.boundaryPoints[0];
            if ('points' in feat && feat.points.length > 0) return feat.points[0];
            return createVector3D();
        };

        let currentPos = createVector3D(0, 0, 0); // Baza WCS

        for (const [_, group] of byTool.entries()) {
            const optGroup = optimizePath2Opt(group, getPos, currentPos);
            optimizedAll.push(...optGroup);
            if (optGroup.length > 0) {
                currentPos = getPos(optGroup[optGroup.length - 1]);
            }
        }

        return optimizedAll;
    }

    /**
     * Tworzy ostateczną listę operacji CNCOperation.
     */
    private createCncOperations(
        features: CAMFeature[],
        wcsOrigin: Vector3D,
        strategyId?: string,
        strategyParams?: CAMProject['strategyParams']
    ): CNCOperation[] {
        const operations: CNCOperation[] = [];
        const strategy = strategyId ? this.strategies.get(strategyId) : null;

        for (const feature of features) {
            if (!feature.toolId) continue;
            const tool = this.toolLibrary.getTool(feature.toolId);
            if (!tool) continue;

            const isHole = 'position' in feature;
            const isPocket = 'boundaryPoints' in feature;
            const isGroove = 'startPoint' in feature;
            const isContour = 'points' in feature;
            const featureType: 'hole' | 'groove' | 'contour' | 'pocket' = isHole ? 'hole' : (isPocket ? 'pocket' : (isGroove ? 'groove' : 'contour'));

            const isTargetOfStrategy = Boolean(strategy && strategy.targetFeatureTypes.includes(featureType));

            let feed = tool.parameters.feedRate || 1000;
            let rpm = tool.parameters.spindleRpm || 3000;

            if (isTargetOfStrategy && strategy) {
                if (strategy.id === 'drilling_standard' && isHole) {
                    feed = tool.parameters.feedRate || 1000;
                    rpm = tool.parameters.spindleRpm || 3000;
                } else if (strategy.id === 'pocketing_concentric' && (isGroove || isContour || isPocket)) {
                    feed = 1500;
                    rpm = 18000;
                } else if (strategy.id === 'profiling_25d' && (isContour || isGroove)) {
                    feed = 2000;
                    rpm = 18000;
                }

                // Generujemy komendy ze strategii, aby trajektoria w CNCOperation (używana przez symulator i podgląd)
                // była w 100% zgodna z generowanym programem obróbczym CLData.
                const stratCmds = strategy.generateCLCommands(feature, tool, wcsOrigin, strategyParams);
                if (stratCmds.length > 0) {
                    const drillCmds = stratCmds.filter(c => c.type === 'CYCLE_DRILL');
                    if (drillCmds.length > 0 && isHole) {
                        const hole = feature as HoleFeature;
                        const positions = (hole.positions && hole.positions.length > 0) ? hole.positions : [hole.position];
                        drillCmds.forEach((dCmd, idx) => {
                            const surfacePos = positions[idx] || hole.position;
                            operations.push({
                                type: 'drill',
                                toolId: hole.toolId!,
                                position: { x: surfacePos.x, y: surfacePos.y, z: surfacePos.z },
                                parameters: {
                                    diameter: hole.diameter,
                                    depth: dCmd.drillParams?.depth ?? -Math.abs(hole.depth),
                                    feedRate: feed,
                                    spindleRpm: rpm,
                                    retractR: dCmd.drillParams?.retractR ?? hole.retractR ?? 5.0,
                                    axis: dCmd.drillParams?.axis ?? hole.axis ?? { x: 0, y: 0, z: -1 },
                                    face: dCmd.drillParams?.face ?? hole.face,
                                    strategyId: strategy.id,
                                    peckStep: dCmd.drillParams?.peckStep
                                }
                            });
                        });
                        continue;
                    }

                    const gotoPoints = stratCmds
                        .filter(c => c.type === 'GOTO' && c.point)
                        .map(c => c.point!);

                    if (gotoPoints.length >= 2) {
                        const approachPoint = gotoPoints[0];
                        // Pierwszy i ostatni GOTO to podejście/odjazd SafeZ, nie ruchy skrawające.
                        const cuttingPoints = gotoPoints.length >= 3 
                            ? gotoPoints.slice(1, gotoPoints.length - 1) 
                            : gotoPoints.slice(1);
                        if (cuttingPoints.length === 0) continue;
                        const cutStart = cuttingPoints[0];
                        const surfaceSource = isGroove
                            ? (feature as GrooveFeature).startPoint
                            : (isPocket
                                ? (feature as PocketFeature).boundaryPoints[0]
                                : (feature as ContourFeature).points[0]);
                        const surfacePoint = {
                            x: cutStart.x,
                            y: cutStart.y,
                            z: surfaceSource?.z ?? cutStart.z
                        };
                        const moves: CNCMove[] = cuttingPoints.slice(1).map(pt => ({
                            type: 'line' as const,
                            endPoint: pt
                        }));

                        operations.push({
                            type: isGroove ? 'groove' : (isPocket ? 'pocket' : 'contour'),
                            toolId: tool.id,
                            position: cutStart,
                            parameters: {
                                width: isGroove ? (feature as GrooveFeature).width : (isPocket ? (feature as PocketFeature).width : tool.diameter),
                                depth: typeof (feature as any).depth === 'number' ? (feature as any).depth : 0,
                                approachPoint,
                                retractPoint: gotoPoints[gotoPoints.length - 1],
                                surfacePoint,
                                surfaceZ: surfacePoint.z,
                                normal: (feature as any).normal || { x: 0, y: 0, z: 1 },
                                face: (feature as any).face,
                                feedRate: feed,
                                spindleRpm: rpm,
                                strategyId: strategy.id,
                                moves
                            }
                        });
                        continue;
                    }
                }
            }

            if ('position' in feature) {
                const hole = feature as HoleFeature;
                const positions = (hole.positions && hole.positions.length > 0) ? hole.positions : [hole.position];
                
                for (const pos of positions) {
                    operations.push({
                        type: 'drill',
                        toolId: hole.toolId!,
                        position: {
                            x: pos.x,
                            y: pos.y,
                            z: pos.z
                        },
                        parameters: {
                            diameter: hole.diameter,
                            depth: -Math.abs(hole.depth),
                            feedRate: feed,
                            spindleRpm: rpm,
                            retractR: hole.retractR || 5.0,
                            axis: hole.axis || { x: 0, y: 0, z: -1 },
                            face: hole.face,
                            strategyId: isTargetOfStrategy ? strategy?.id : undefined
                        }
                    });
                }
            } else if ('startPoint' in feature) {
                const groove = feature as GrooveFeature;
                let s = {
                    x: groove.startPoint.x,
                    y: groove.startPoint.y,
                    z: groove.startPoint.z
                };
                let e = {
                    x: groove.endPoint.x,
                    y: groove.endPoint.y,
                    z: groove.endPoint.z
                };

                if (groove.reverseDirection) {
                    const temp = s;
                    s = e;
                    e = temp;
                }

                const dx = e.x - s.x;
                const dy = e.y - s.y;
                const dz = e.z - s.z;
                const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (len > 0) {
                    const nx = dx / len;
                    const ny = dy / len;
                    const nz = dz / len;

                    const leadIn = groove.leadIn || 0;
                    const leadOut = groove.leadOut || 0;

                    s.x -= nx * leadIn;
                    s.y -= ny * leadIn;
                    s.z -= nz * leadIn;

                    e.x += nx * leadOut;
                    e.y += ny * leadOut;
                    e.z += nz * leadOut;
                }

                const rawDepth = typeof groove.depth === 'number' && groove.depth !== 0 ? Math.abs(groove.depth) : 8;

                let norm = groove.normal;
                if (!norm && groove.face) {
                    if (groove.face === 'FACE_Z_MINUS') norm = { x: 0, y: 0, z: -1 };
                    else if (groove.face === 'FACE_X_PLUS') norm = { x: 1, y: 0, z: 0 };
                    else if (groove.face === 'FACE_X_MINUS') norm = { x: -1, y: 0, z: 0 };
                    else if (groove.face === 'FACE_Y_PLUS') norm = { x: 0, y: 1, z: 0 };
                    else if (groove.face === 'FACE_Y_MINUS') norm = { x: 0, y: -1, z: 0 };
                    else norm = { x: 0, y: 0, z: 1 };
                }
                if (!norm) {
                    norm = { x: 0, y: 0, z: 1 };
                }
                const normLen = Math.hypot(norm.x, norm.y, norm.z);
                const unitNorm: Vector3D = normLen > 1e-6 
                    ? { x: norm.x / normLen, y: norm.y / normLen, z: norm.z / normLen } 
                    : { x: 0, y: 0, z: 1 };

                const depthSign = groove.flipDepthDirection ? 1 : -1;
                const cutOffset = {
                    x: depthSign * unitNorm.x * rawDepth,
                    y: depthSign * unitNorm.y * rawDepth,
                    z: depthSign * unitNorm.z * rawDepth
                };

                const cutStart = {
                    x: s.x + cutOffset.x,
                    y: s.y + cutOffset.y,
                    z: s.z + cutOffset.z
                };
                const cutEnd = {
                    x: e.x + cutOffset.x,
                    y: e.y + cutOffset.y,
                    z: e.z + cutOffset.z
                };

                operations.push({
                    type: 'groove',
                    toolId: groove.toolId!,
                    position: cutStart,
                    parameters: {
                        width: groove.width,
                        depth: unitNorm.z < -0.8 ? rawDepth : -rawDepth,
                        surfacePoint: { x: s.x, y: s.y, z: s.z },
                        surfaceZ: s.z,
                        normal: unitNorm,
                        face: groove.face,
                        feedRate: feed,
                        spindleRpm: rpm,
                        strategyId: isTargetOfStrategy ? strategy?.id : undefined,
                        moves: [
                            { type: 'line', endPoint: cutEnd }
                        ]
                    }
                });
            } else if ('points' in feature) {
                const contour = feature as ContourFeature;
                if (contour.points.length >= 2) {
                    const toolRadius = tool.diameter / 2;
                    const effectivePts = generateEffectiveContourPath(
                        contour.points,
                        contour.leadIn || 0,
                        contour.leadOut || 0,
                        contour.compensation || 'Center',
                        toolRadius,
                        contour.reverseDirection || false
                    );

                    // Poziom Z profilu: jeśli podano contour.depth, używamy jej jako bezwzględnej wysokości Z w WCS.
                    // W przeciwnym razie zachowujemy Z z punktów (np. ze wskazanej krawędzi 3D).
                    const targetZ = typeof contour.depth === 'number' ? contour.depth : (effectivePts[0].z || 0);

                    const start = {
                        x: effectivePts[0].x,
                        y: effectivePts[0].y,
                        z: targetZ
                    };
                    const moves = effectivePts.slice(1).map(pt => ({
                        type: 'line' as const,
                        endPoint: {
                            x: pt.x,
                            y: pt.y,
                            z: typeof contour.depth === 'number' ? targetZ : pt.z
                        }
                    }));

                    operations.push({
                        type: 'contour',
                        toolId: contour.toolId!,
                        position: start,
                        parameters: {
                            width: tool.diameter,
                            depth: 0, // Z jest już bezpośrednio w position.z i moves.endPoint.z
                            feedRate: feed,
                            spindleRpm: rpm,
                            strategyId: isTargetOfStrategy ? strategy?.id : undefined,
                            moves
                        }
                    });
                }
            } else if ('boundaryPoints' in feature) {
                const pocket = feature as PocketFeature;
                if (pocket.boundaryPoints.length >= 3) {
                    const start = pocket.boundaryPoints[0];
                    const moves: CNCMove[] = pocket.boundaryPoints.slice(1).map(pt => ({
                        type: 'line' as const,
                        endPoint: { x: pt.x, y: pt.y, z: pt.z }
                    }));
                    moves.push({
                        type: 'line' as const,
                        endPoint: { x: start.x, y: start.y, z: start.z }
                    });
                    operations.push({
                        type: 'pocket',
                        toolId: pocket.toolId!,
                        position: start,
                        parameters: {
                            width: pocket.width,
                            depth: pocket.depth,
                            feedRate: feed,
                            spindleRpm: rpm,
                            surfacePoint: start,
                            normal: pocket.normal || { x: 0, y: 0, z: 1 },
                            face: pocket.face,
                            strategyId: isTargetOfStrategy ? strategy?.id : undefined,
                            moves
                        }
                    });
                }
            }
        }

        return operations;
    }
}
