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
import { MAX_THROUGH_OVERDRILL_MM, MIN_THROUGH_DEPTH_TOLERANCE_MM, isFeatureMachinableInWcs } from '../geometry/geometry-extractor.js';

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

    private resolveStrategy(strategyId?: string): MachiningStrategy | undefined {
        if (strategyId === undefined) return undefined;

        const strategy = this.strategies.get(strategyId);
        if (!strategy) {
            const available = Array.from(this.strategies.keys()).sort().join(', ') || '(brak)';
            throw new Error(`[CAMProcessor] Nieznana strategia "${strategyId}". Dostępne strategie: ${available}.`);
        }

        return strategy;
    }

    private calculateCommandStats(commands: CLCommand[]): { totalLengthMm: number; estimatedTimeSec: number } {
        let totalLengthMm = 0;
        let estimatedTimeSec = 0;
        let feedRate = 1000;
        let cursor: Vector3D | null = null;
        const rapidFeedRate = 10000; // Szybki przejazd G0 (10 000 mm/min = 10 m/min)

        for (const command of commands) {
            if (command.type === 'FEDRAT') {
                if (typeof command.feedRate === 'number' && Number.isFinite(command.feedRate) && command.feedRate > 0) {
                    feedRate = command.feedRate;
                }
                continue;
            }

            if (command.type === 'GOTO' && command.point) {
                if (cursor) {
                    const distance = vecDistance(cursor, command.point);
                    totalLengthMm += distance;
                    const effectiveFeed = (command.isRapid || command.motion === 'RAPID') ? rapidFeedRate : feedRate;
                    estimatedTimeSec += distance / effectiveFeed * 60;
                }
                cursor = command.point;
            } else if (command.type === 'ARC' && command.point && command.arcParams && cursor) {
                const { center, radius, plane, direction } = command.arcParams;
                const axes = plane === 'XY' ? ['x', 'y', 'z'] as const
                    : plane === 'XZ' ? ['x', 'z', 'y'] as const
                    : ['y', 'z', 'x'] as const;
                const [a, b, axial] = axes;
                const startAngle = Math.atan2(cursor[b] - center[b], cursor[a] - center[a]);
                const endAngle = Math.atan2(command.point[b] - center[b], command.point[a] - center[a]);
                const turn = 2 * Math.PI;
                let sweep = direction === 'CCW'
                    ? (endAngle - startAngle + turn) % turn
                    : (startAngle - endAngle + turn) % turn;
                if (sweep <= 1e-6 && radius > 1e-4) {
                    sweep = turn;
                }
                const planarLength = radius * sweep;
                const distance = Math.hypot(planarLength, command.point[axial] - cursor[axial]);
                totalLengthMm += distance;
                estimatedTimeSec += distance / feedRate * 60;
                cursor = command.point;
            } else if (command.type === 'CYCLE_DRILL' && command.drillParams) {
                const depth = Math.abs(command.drillParams.depth);
                const retractR = Math.abs(command.drillParams.retractR || 5);
                totalLengthMm += depth + retractR;
                estimatedTimeSec += (depth / feedRate * 60) + (retractR / rapidFeedRate * 60);
                if (command.point) {
                    cursor = command.point;
                }
            }
        }

        return { totalLengthMm, estimatedTimeSec };
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
        if (Array.isArray(project.features)) {
            for (const f of project.features) {
                this.validateFeature(f, project.workpieceDimensions);
            }
        }
        const effectiveStrategyId = strategyId !== undefined ? strategyId : project.strategyId;
        this.resolveStrategy(effectiveStrategyId);
        const featuresWithTools = this.assignToolsToFeatures(project.features, project.toolAssignments);
        this.collectAssignmentIssues(featuresWithTools);
        const rawOperations = this.createCncOperations(
            featuresWithTools,
            project.wcsOrigin,
            effectiveStrategyId,
            project.strategyParams,
            project.workpieceDimensions
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
        const rawFeatures = project.features || [];
        const hasTopFeatures = rawFeatures.some(f =>
            ('axis' in f && (f as HoleFeature).axis && (f as HoleFeature).axis!.z < -0.1) ||
            ('normal' in f && (f as any).normal && (f as any).normal.z > 0.1)
        );
        const filteredFeatures = hasTopFeatures
            ? rawFeatures.filter(isFeatureMachinableInWcs)
            : rawFeatures;

        const effectiveProject: CAMProject = {
            ...project,
            features: filteredFeatures
        };

        if (Array.isArray(effectiveProject.features)) {
            for (const f of effectiveProject.features) {
                this.validateFeature(f, effectiveProject.workpieceDimensions);
            }
        }
        const effectiveStrategyId = strategyId !== undefined ? strategyId : effectiveProject.strategyId;
        const strategy = this.resolveStrategy(effectiveStrategyId);
        let strategyCommands: CLCommand[] = [];
        const toolIdsUsed: string[] = [];
        let projectToProcess = effectiveProject;

        if (strategy) {
            const featuresWithTools = this.assignToolsToFeatures(effectiveProject.features, effectiveProject.toolAssignments);
            const remainingFeatures: CAMFeature[] = [];
            const effectiveStrategyParams = effectiveProject.workpieceDimensions
                ? { ...(effectiveProject.strategyParams || {}), workpieceDimensions: effectiveProject.workpieceDimensions }
                : effectiveProject.strategyParams;

            for (const feat of featuresWithTools) {
                const featureType: 'hole' | 'contour' | 'groove' | 'pocket' = ('position' in feat) 
                    ? 'hole' 
                    : (('boundaryPoints' in feat)
                        ? 'pocket'
                        : (('points' in feat) ? 'contour' : 'groove'));

                const isTargetOfStrategy = strategy.targetFeatureTypes.includes(featureType);
                if (feat.toolId) {
                    const tool = this.toolLibrary.getTool(feat.toolId);
                    if (!tool) {
                        throw new Error(`[CAMProcessor] Narzędzie "${feat.toolId}" przypisane do cechy "${feat.featureId || 'unknown'}" nie istnieje w bibliotece narzędzi.`);
                    }
                    if (typeof tool.diameter !== 'number' || !Number.isFinite(tool.diameter) || tool.diameter <= 0) {
                        throw new Error(`[CAMProcessor] Średnica narzędzia "${tool.id}" musi być skończoną liczbą dodatnią (diameter=${tool.diameter}).`);
                    }

                    if (isTargetOfStrategy) {
                        const stratCmds = strategy.generateCLCommands(feat, tool, project.wcsOrigin, effectiveStrategyParams);
                        if (stratCmds.length > 0) {
                            strategyCommands.push(...stratCmds);
                            if (!toolIdsUsed.includes(tool.id)) toolIdsUsed.push(tool.id);
                        } else {
                            remainingFeatures.push(feat);
                        }
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
                const stats = this.calculateCommandStats(strategyCommands);
                return {
                    projectName: project.projectName || 'CAM_PROGRAM',
                    wcsName: project.wcsName || 'G55',
                    wcsOrigin: project.wcsOrigin,
                    commands: strategyCommands,
                    totalLengthMm: Math.round(stats.totalLengthMm * 1000) / 1000,
                    estimatedTimeSec: Math.round(stats.estimatedTimeSec * 100) / 100,
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
        let cursor: Vector3D = createVector3D();
        let activeToolId: string | null = null;
        let activeRpm: number | null = null;
        let activeFeed: number | null = null;

        for (const op of operations) {
            const tool = this.toolLibrary.getTool(op.toolId);
            if (!tool) {
                throw new Error(`[CAMProcessor] Narzędzie "${op.toolId}" dla operacji nie istnieje w bibliotece narzędzi.`);
            }
            if (typeof tool.diameter !== 'number' || !Number.isFinite(tool.diameter) || tool.diameter <= 0) {
                throw new Error(`[CAMProcessor] Średnica narzędzia "${tool.id}" musi być skończoną liczbą dodatnią (diameter=${tool.diameter}).`);
            }
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
            if (p.spindleRpm !== activeRpm && typeof p.spindleRpm !== 'undefined') {
                if (!Number.isFinite(p.spindleRpm) || p.spindleRpm <= 0) {
                    throw new Error(`[CAMProcessor] Obroty wrzeciona muszą być skończoną liczbą dodatnią w operacji (spindleRpm=${p.spindleRpm}).`);
                }
                commands.push({
                    type: 'SPINDL',
                    spindleRpm: p.spindleRpm,
                    spindleDirection: 'CW',
                });
                activeRpm = p.spindleRpm ?? null;
            }
            if (p.feedRate !== activeFeed && typeof p.feedRate !== 'undefined') {
                if (!Number.isFinite(p.feedRate) || p.feedRate <= 0) {
                    throw new Error(`[CAMProcessor] Posuw musi być skończoną liczbą dodatnią w operacji (feedRate=${p.feedRate}).`);
                }
                commands.push({ type: 'FEDRAT', feedRate: p.feedRate });
                activeFeed = p.feedRate ?? null;
            }

            if (op.type === 'drill') {
                const retractR = p.retractR ?? 5.0;
                if (!Number.isFinite(retractR) || retractR <= 0) {
                    throw new Error(`[CAMProcessor] Odskok bezpieczny (retractR) musi być skończoną liczbą dodatnią w operacji (retractR=${retractR}).`);
                }
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

            commands.push({ type: 'GOTO', point: safePos, isRapid: true, motion: 'RAPID' });
            commands.push({ type: 'GOTO', point: { x: targetPos.x, y: targetPos.y, z: targetPos.z }, isRapid: false, motion: 'FEED' });
            cursor = { x: targetPos.x, y: targetPos.y, z: targetPos.z };

            for (const move of p.moves || []) {
                if (!move.endPoint) continue;
                const e = move.endPoint;
                if (move.type === 'arc' && move.arcParams) {
                    const iVec = (e as any).i ?? (move.arcParams.center.x - cursor.x);
                    const jVec = (e as any).j ?? (move.arcParams.center.y - cursor.y);
                    commands.push({
                        type: 'ARC',
                        point: { x: e.x, y: e.y, z: e.z, i: iVec, j: jVec },
                        arcParams: move.arcParams,
                        isRapid: false,
                        motion: 'FEED'
                    });
                } else if (move.type === 'line') {
                    commands.push({ type: 'GOTO', point: { x: e.x, y: e.y, z: e.z }, isRapid: false, motion: 'FEED' });
                } else {
                    continue;
                }
                cursor = { x: e.x, y: e.y, z: e.z };
            }
            // Bezpieczne wycofanie po zakończeniu cięcia konturu/wpustu wzdłuż wektora normalnego
            const exitSafePos: Vector3D = {
                x: cursor.x + unitNorm.x * clearance,
                y: cursor.y + unitNorm.y * clearance,
                z: cursor.z + unitNorm.z * clearance
            };
            commands.push({ type: 'GOTO', point: exitSafePos, isRapid: true, motion: 'RAPID' });
            cursor = exitSafePos;
        }

        commands.push({ type: 'STOP' });

        const stats = this.calculateCommandStats(commands);

        return {
            projectName: project.projectName,
            wcsName: project.wcsName || 'G55',
            wcsOrigin: project.wcsOrigin,
            commands,
            totalLengthMm: Math.round(stats.totalLengthMm * 1000) / 1000,
            estimatedTimeSec: Math.round(stats.estimatedTimeSec * 100) / 100,
            toolIdsUsed,
            workpieceDimensions: project.workpieceDimensions,
        };
    }

    /**
     * Przygotowuje kopie cech. NIE przypisuje automatycznie narzędzi —
     * każda cecha musi mieć jawnie ustawiony toolId przez użytkownika.
     * Cechy bez toolId zostaną pominięte w generowaniu operacji.
     */
    public assignToolsToFeatures(features: CAMFeature[], toolAssignments?: Record<string, string>): CAMFeature[] {
        return features.map(feat => {
            const copy = JSON.parse(JSON.stringify(feat));
            const assignedId = copy.toolId || (copy.featureId && toolAssignments ? toolAssignments[copy.featureId] : undefined);
            if (assignedId) {
                copy.toolId = assignedId;
            }
            return copy;
        });
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
     * Waliduje spójność geometryczną cechy na wspólnej ścieżce CAMProcessor (fail-fast).
     */
    private validateFeature(feature: CAMFeature, workpieceDimensions?: { width: number; height: number; thickness: number }): void {
        if (!feature) return;
        if ('position' in feature) {
            const hole = feature as HoleFeature;
            if (typeof hole.diameter !== 'number' || !Number.isFinite(hole.diameter) || hole.diameter <= 0) {
                throw new Error(`[CAMProcessor] Średnica otworu musi być skończoną liczbą dodatnią dla otworu "${hole.featureId || 'unknown'}" (diameter=${hole.diameter}).`);
            }
            if (typeof hole.depth !== 'number' || !Number.isFinite(hole.depth) || Math.abs(hole.depth) < 1e-4) {
                throw new Error(`[CAMProcessor] Głębokość wiercenia musi być niezerową skończoną liczbą dla otworu "${hole.featureId || 'unknown'}" (depth=${hole.depth}).`);
            }
            if (typeof hole.retractR !== 'undefined' && (!Number.isFinite(hole.retractR) || hole.retractR <= 0)) {
                throw new Error(`[CAMProcessor] Odskok bezpieczny (retractR) musi być skończoną liczbą dodatnią dla otworu "${hole.featureId || 'unknown'}" (retractR=${hole.retractR}).`);
            }
            const positions = (hole.positions && hole.positions.length > 0) ? hole.positions : [hole.position];
            for (const pos of positions) {
                if (!pos || typeof pos.x !== 'number' || !Number.isFinite(pos.x) ||
                    typeof pos.y !== 'number' || !Number.isFinite(pos.y) ||
                    typeof pos.z !== 'number' || !Number.isFinite(pos.z)) {
                    throw new Error(`[CAMProcessor] Pozycja otworu musi mieć skończone współrzędne dla otworu "${hole.featureId || 'unknown'}" (pos=[${pos?.x}, ${pos?.y}, ${pos?.z}]).`);
                }
                if (workpieceDimensions &&
                    Number.isFinite(workpieceDimensions.width) && workpieceDimensions.width > 0 &&
                    Number.isFinite(workpieceDimensions.height) && workpieceDimensions.height > 0 &&
                    Number.isFinite(workpieceDimensions.thickness) && workpieceDimensions.thickness > 0) {
                    const maxSpan = Math.max(workpieceDimensions.width, workpieceDimensions.height, workpieceDimensions.thickness);
                    if (Math.abs(pos.x) > maxSpan + 1e-3 || Math.abs(pos.y) > maxSpan + 1e-3 || Math.abs(pos.z) > maxSpan + 1e-3) {
                        throw new Error(`[CAMProcessor] Pozycja otworu [${pos.x}, ${pos.y}, ${pos.z}] wykracza poza wymiary formatki (${workpieceDimensions.width}x${workpieceDimensions.height}x${workpieceDimensions.thickness} mm) dla otworu "${hole.featureId || 'unknown'}".`);
                    }
                }
            }
            if (workpieceDimensions &&
                Number.isFinite(workpieceDimensions.width) && workpieceDimensions.width > 0 &&
                Number.isFinite(workpieceDimensions.height) && workpieceDimensions.height > 0 &&
                Number.isFinite(workpieceDimensions.thickness) && workpieceDimensions.thickness > 0) {
                const panelPts = (hole.panelPositions && hole.panelPositions.length > 0)
                    ? hole.panelPositions
                    : (hole.panelPosition ? [hole.panelPosition] : []);
                const hw = workpieceDimensions.width / 2 + 1e-3;
                const hh = workpieceDimensions.height / 2 + 1e-3;
                const ht = workpieceDimensions.thickness / 2 + 1e-3;
                for (const p of panelPts) {
                    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z) ||
                        Math.abs(p.x) > hw || Math.abs(p.y) > hh || Math.abs(p.z) > ht) {
                        throw new Error(`[CAMProcessor] Lokalna pozycja otworu [${p?.x}, ${p?.y}, ${p?.z}] wykracza poza obrys formatki (${workpieceDimensions.width}x${workpieceDimensions.height}x${workpieceDimensions.thickness} mm) dla otworu "${hole.featureId || 'unknown'}".`);
                    }
                }
            }
            const rawAxis = hole.axis || { x: 0, y: 0, z: -1 };
            if (
                typeof rawAxis.x !== 'number' || !Number.isFinite(rawAxis.x) ||
                typeof rawAxis.y !== 'number' || !Number.isFinite(rawAxis.y) ||
                typeof rawAxis.z !== 'number' || !Number.isFinite(rawAxis.z)
            ) {
                throw new Error(`[CAMProcessor] Oś wiercenia musi mieć skończone współrzędne liczbowe dla otworu "${hole.featureId || 'unknown'}" (axis=[${rawAxis?.x}, ${rawAxis?.y}, ${rawAxis?.z}]).`);
            }
            const axisLen = Math.hypot(rawAxis.x, rawAxis.y, rawAxis.z);
            if (!Number.isFinite(axisLen) || axisLen < 1e-6) {
                throw new Error(`[CAMProcessor] Oś wiercenia nie może być wektorem zerowym ani bliskim zeru dla otworu "${hole.featureId || 'unknown'}".`);
            }
            if (workpieceDimensions &&
                Number.isFinite(workpieceDimensions.width) && workpieceDimensions.width > 0 &&
                Number.isFinite(workpieceDimensions.height) && workpieceDimensions.height > 0 &&
                Number.isFinite(workpieceDimensions.thickness) && workpieceDimensions.thickness > 0) {
                const refAx = hole.panelAxis || rawAxis;
                let materialSpan = workpieceDimensions.thickness;
                if (hole.face === 'FACE_X_PLUS' || hole.face === 'FACE_X_MINUS') {
                    materialSpan = workpieceDimensions.width;
                } else if (hole.face === 'FACE_Y_PLUS' || hole.face === 'FACE_Y_MINUS') {
                    materialSpan = workpieceDimensions.height;
                } else if (hole.face === 'FACE_Z_PLUS' || hole.face === 'FACE_Z_MINUS') {
                    materialSpan = workpieceDimensions.thickness;
                } else if (Math.abs(refAx.z) < Math.max(Math.abs(refAx.x), Math.abs(refAx.y))) {
                    if (hole.panelAxis) {
                        materialSpan = Math.abs(hole.panelAxis.x) >= Math.abs(hole.panelAxis.y)
                            ? workpieceDimensions.width
                            : workpieceDimensions.height;
                    } else {
                        materialSpan = Math.max(workpieceDimensions.width, workpieceDimensions.height);
                    }
                }
                if (hole.through && Math.abs(hole.depth) < materialSpan - MIN_THROUGH_DEPTH_TOLERANCE_MM) {
                    throw new Error(
                        `[CAMProcessor] Otwór przelotowy (through=true) ma głębokość (${Math.abs(hole.depth)} mm) mniejszą niż wymiar materiału (${materialSpan} mm) dla otworu "${hole.featureId || 'unknown'}".`
                    );
                }
                const maxBlindDepth = materialSpan - MIN_THROUGH_DEPTH_TOLERANCE_MM;
                if (!hole.through && Math.abs(hole.depth) >= maxBlindDepth - 1e-4) {
                    throw new Error(
                        `[CAMProcessor] Głębokość wiercenia nieprzelotowego (${Math.abs(hole.depth)} mm) przekracza dopuszczalny wymiar materiału (${maxBlindDepth} mm przy grubości w osi=${materialSpan} mm) dla otworu "${hole.featureId || 'unknown'}".`
                    );
                }
                const maxAllowedDepth = hole.through ? (materialSpan + MAX_THROUGH_OVERDRILL_MM) : maxBlindDepth;
                if (Math.abs(hole.depth) > maxAllowedDepth + 1e-4) {
                    throw new Error(
                        `[CAMProcessor] Głębokość wiercenia (${Math.abs(hole.depth)} mm) przekracza dopuszczalny wymiar materiału (${maxAllowedDepth} mm, grubość w osi=${materialSpan} mm${hole.through ? `, przebój przelotowy +${MAX_THROUGH_OVERDRILL_MM} mm` : ''}) dla otworu "${hole.featureId || 'unknown'}".`
                    );
                }
            }
        } else if ('startPoint' in feature && 'endPoint' in feature) {
            const groove = feature as GrooveFeature;
            const s = groove.startPoint;
            const e = groove.endPoint;
            if (!s || typeof s.x !== 'number' || !Number.isFinite(s.x) ||
                typeof s.y !== 'number' || !Number.isFinite(s.y) ||
                typeof s.z !== 'number' || !Number.isFinite(s.z) ||
                !e || typeof e.x !== 'number' || !Number.isFinite(e.x) ||
                typeof e.y !== 'number' || !Number.isFinite(e.y) ||
                typeof e.z !== 'number' || !Number.isFinite(e.z)) {
                throw new Error(`[CAMProcessor] Punkty końcowe wpustu muszą mieć skończone współrzędne dla wpustu "${groove.featureId || 'unknown'}".`);
            }
            if (typeof groove.depth !== 'undefined') {
                if (typeof groove.depth !== 'number' || !Number.isFinite(groove.depth) || Math.abs(groove.depth) < 1e-4) {
                    throw new Error(`[CAMProcessor] Głębokość wpustu nie może być zerowa ani nieskończona dla wpustu "${groove.featureId || 'unknown'}" (depth=${groove.depth}).`);
                }
                if (workpieceDimensions &&
                    Number.isFinite(workpieceDimensions.width) && workpieceDimensions.width > 0 &&
                    Number.isFinite(workpieceDimensions.height) && workpieceDimensions.height > 0 &&
                    Number.isFinite(workpieceDimensions.thickness) && workpieceDimensions.thickness > 0) {
                    const refN = groove.panelNormal || groove.normal || { x: 0, y: 0, z: 1 };
                    let materialSpan = workpieceDimensions.thickness;
                    if (groove.face === 'FACE_X_PLUS' || groove.face === 'FACE_X_MINUS') {
                        materialSpan = workpieceDimensions.width;
                    } else if (groove.face === 'FACE_Y_PLUS' || groove.face === 'FACE_Y_MINUS') {
                        materialSpan = workpieceDimensions.height;
                    } else if (groove.face === 'FACE_Z_PLUS' || groove.face === 'FACE_Z_MINUS') {
                        materialSpan = workpieceDimensions.thickness;
                    } else if (Math.abs(refN.z) < Math.max(Math.abs(refN.x), Math.abs(refN.y))) {
                        materialSpan = groove.panelNormal
                            ? (Math.abs(groove.panelNormal.x) >= Math.abs(groove.panelNormal.y) ? workpieceDimensions.width : workpieceDimensions.height)
                            : Math.max(workpieceDimensions.width, workpieceDimensions.height);
                    }
                    if (Math.abs(groove.depth) > materialSpan + 1e-4) {
                        throw new Error(`[CAMProcessor] Głębokość wpustu (${Math.abs(groove.depth)} mm) przekracza wymiar materiału (${materialSpan} mm) dla wpustu "${groove.featureId || 'unknown'}".`);
                    }
                }
            }
            if (typeof groove.width !== 'undefined' && (typeof groove.width !== 'number' || !Number.isFinite(groove.width) || groove.width <= 0)) {
                throw new Error(`[CAMProcessor] Szerokość wpustu musi być dodatnią liczbą skończoną dla wpustu "${groove.featureId || 'unknown'}" (width=${groove.width}).`);
            }
            if (groove.normal) {
                const n = groove.normal;
                if (typeof n.x !== 'number' || !Number.isFinite(n.x) ||
                    typeof n.y !== 'number' || !Number.isFinite(n.y) ||
                    typeof n.z !== 'number' || !Number.isFinite(n.z)) {
                    throw new Error(`[CAMProcessor] Normalna wpustu musi mieć skończone współrzędne dla wpustu "${groove.featureId || 'unknown'}".`);
                }
                const nLen = Math.hypot(n.x, n.y, n.z);
                if (!Number.isFinite(nLen) || nLen < 1e-6) {
                    throw new Error(`[CAMProcessor] Normalna wpustu nie może być wektorem zerowym ani bliskim zeru dla wpustu "${groove.featureId || 'unknown'}".`);
                }
            }
        } else if ('points' in feature) {
            const contour = feature as ContourFeature;
            if (!Array.isArray(contour.points) || contour.points.length < 2) {
                throw new Error(`[CAMProcessor] Kontur musi posiadać co najmniej 2 punkty dla "${contour.featureId || 'unknown'}".`);
            }
            for (let i = 0; i < contour.points.length; i++) {
                const pt = contour.points[i];
                if (!pt || typeof pt.x !== 'number' || !Number.isFinite(pt.x) ||
                    typeof pt.y !== 'number' || !Number.isFinite(pt.y) ||
                    typeof pt.z !== 'number' || !Number.isFinite(pt.z)) {
                    throw new Error(`[CAMProcessor] Punkty konturu muszą mieć skończone współrzędne dla "${contour.featureId || 'unknown'}" (punkt[${i}]).`);
                }
            }
            if (typeof contour.depth !== 'undefined' && (typeof contour.depth !== 'number' || !Number.isFinite(contour.depth))) {
                throw new Error(`[CAMProcessor] Głębokość konturu musi być skończoną liczbą dla konturu "${contour.featureId || 'unknown'}" (depth=${contour.depth}).`);
            }
            if (typeof contour.leadIn !== 'undefined' && (typeof contour.leadIn !== 'number' || !Number.isFinite(contour.leadIn) || contour.leadIn < 0)) {
                throw new Error(`[CAMProcessor] Parametr najazdu konturu leadIn musi być skończoną liczbą nieujemną dla "${contour.featureId || 'unknown'}" (leadIn=${contour.leadIn}).`);
            }
            if (typeof contour.leadOut !== 'undefined' && (typeof contour.leadOut !== 'number' || !Number.isFinite(contour.leadOut) || contour.leadOut < 0)) {
                throw new Error(`[CAMProcessor] Parametr wyjazdu konturu leadOut musi być skończoną liczbą nieujemną dla "${contour.featureId || 'unknown'}" (leadOut=${contour.leadOut}).`);
            }
            if (contour.normal) {
                const n = contour.normal;
                if (typeof n.x !== 'number' || !Number.isFinite(n.x) ||
                    typeof n.y !== 'number' || !Number.isFinite(n.y) ||
                    typeof n.z !== 'number' || !Number.isFinite(n.z)) {
                    throw new Error(`[CAMProcessor] Normalna konturu musi mieć skończone współrzędne dla "${contour.featureId || 'unknown'}".`);
                }
                const nLen = Math.hypot(n.x, n.y, n.z);
                if (!Number.isFinite(nLen) || nLen < 1e-6) {
                    throw new Error(`[CAMProcessor] Normalna konturu nie może być wektorem zerowym ani bliskim zeru dla "${contour.featureId || 'unknown'}".`);
                }
            }
        } else if ('boundaryPoints' in feature) {
            const pocket = feature as PocketFeature;
            if (!Array.isArray(pocket.boundaryPoints) || pocket.boundaryPoints.length < 4) {
                throw new Error(`[CAMProcessor] Kieszeń musi posiadać co najmniej 4 punkty obwiedni dla "${pocket.featureId || 'unknown'}".`);
            }
            for (let i = 0; i < pocket.boundaryPoints.length; i++) {
                const pt = pocket.boundaryPoints[i];
                if (!pt || typeof pt.x !== 'number' || !Number.isFinite(pt.x) ||
                    typeof pt.y !== 'number' || !Number.isFinite(pt.y) ||
                    typeof pt.z !== 'number' || !Number.isFinite(pt.z)) {
                    throw new Error(`[CAMProcessor] Punkty kieszeni muszą mieć skończone współrzędne dla "${pocket.featureId || 'unknown'}" (punkt[${i}]).`);
                }
            }
            const pts = pocket.boundaryPoints;
            if (pts.length > 5 || (pts.length === 5 && Math.hypot(pts[4].x - pts[0].x, pts[4].y - pts[0].y, pts[4].z - pts[0].z) > 1e-3)) {
                throw new Error(`[CAMProcessor] Kieszeń "${pocket.featureId || 'unknown'}" musi mieć 4-wierzchołkową obwiednię prostokątną (otrzymano ${pts.length} punktów).`);
            }
            const p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
            const dxU = p1.x - p0.x, dyU = p1.y - p0.y, dzU = p1.z - p0.z;
            const dxV = p3.x - p0.x, dyV = p3.y - p0.y, dzV = p3.z - p0.z;
            const lenU = Math.hypot(dxU, dyU, dzU);
            const lenV = Math.hypot(dxV, dyV, dzV);
            if (lenU <= 1e-4 || lenV <= 1e-4) {
                throw new Error(`[CAMProcessor] Obwiednia kieszeni "${pocket.featureId || 'unknown'}" ma zdegenerowany bok o zerowej długości.`);
            }
            const dotUV = dxU * dxV + dyU * dyV + dzU * dzV;
            if (Math.abs(dotUV) / (lenU * lenV) > 1e-3 ||
                Math.hypot(p2.x - (p1.x + dxV), p2.y - (p1.y + dyV), p2.z - (p1.z + dzV)) > 1e-2) {
                throw new Error(`[CAMProcessor] Obwiednia kieszeni "${pocket.featureId || 'unknown'}" nie tworzy poprawnego prostokąta.`);
            }
            if (typeof pocket.depth !== 'number' || !Number.isFinite(pocket.depth) || Math.abs(pocket.depth) < 1e-4) {
                throw new Error(`[CAMProcessor] Głębokość kieszeni musi być niezerową skończoną liczbą dla kieszeni "${pocket.featureId || 'unknown'}" (depth=${pocket.depth}).`);
            }
            if (workpieceDimensions &&
                Number.isFinite(workpieceDimensions.width) && workpieceDimensions.width > 0 &&
                Number.isFinite(workpieceDimensions.height) && workpieceDimensions.height > 0 &&
                Number.isFinite(workpieceDimensions.thickness) && workpieceDimensions.thickness > 0) {
                const refN = pocket.panelNormal || pocket.normal || { x: 0, y: 0, z: 1 };
                let materialSpan = workpieceDimensions.thickness;
                if (pocket.face === 'FACE_X_PLUS' || pocket.face === 'FACE_X_MINUS') {
                    materialSpan = workpieceDimensions.width;
                } else if (pocket.face === 'FACE_Y_PLUS' || pocket.face === 'FACE_Y_MINUS') {
                    materialSpan = workpieceDimensions.height;
                } else if (pocket.face === 'FACE_Z_PLUS' || pocket.face === 'FACE_Z_MINUS') {
                    materialSpan = workpieceDimensions.thickness;
                } else if (Math.abs(refN.z) < Math.max(Math.abs(refN.x), Math.abs(refN.y))) {
                    materialSpan = pocket.panelNormal
                        ? (Math.abs(pocket.panelNormal.x) >= Math.abs(pocket.panelNormal.y) ? workpieceDimensions.width : workpieceDimensions.height)
                        : Math.max(workpieceDimensions.width, workpieceDimensions.height);
                }
                if (Math.abs(pocket.depth) > materialSpan + 1e-4) {
                    throw new Error(`[CAMProcessor] Głębokość kieszeni (${Math.abs(pocket.depth)} mm) przekracza wymiar materiału (${materialSpan} mm) dla kieszeni "${pocket.featureId || 'unknown'}".`);
                }
            }
            if (pocket.normal) {
                const n = pocket.normal;
                if (typeof n.x !== 'number' || !Number.isFinite(n.x) ||
                    typeof n.y !== 'number' || !Number.isFinite(n.y) ||
                    typeof n.z !== 'number' || !Number.isFinite(n.z)) {
                    throw new Error(`[CAMProcessor] Normalna kieszeni musi mieć skończone współrzędne dla "${pocket.featureId || 'unknown'}".`);
                }
                const nLen = Math.hypot(n.x, n.y, n.z);
                if (!Number.isFinite(nLen) || nLen < 1e-6) {
                    throw new Error(`[CAMProcessor] Normalna kieszeni nie może być wektorem zerowym ani bliskim zeru dla "${pocket.featureId || 'unknown'}".`);
                }
            }
        }
    }

    /**
     * Tworzy ostateczną listę operacji CNCOperation.
     */
    private createCncOperations(
        features: CAMFeature[],
        wcsOrigin: Vector3D,
        strategyId?: string,
        strategyParams?: CAMProject['strategyParams'],
        workpieceDimensions?: { width: number; height: number; thickness: number }
    ): CNCOperation[] {
        const operations: CNCOperation[] = [];
        const strategy = this.resolveStrategy(strategyId) ?? null;
        const effectiveStrategyParams = workpieceDimensions
            ? { ...(strategyParams || {}), workpieceDimensions }
            : strategyParams;

        const hasTopFeatures = features.some(f =>
            ('axis' in f && (f as HoleFeature).axis && (f as HoleFeature).axis!.z < -0.1) ||
            ('normal' in f && (f as any).normal && (f as any).normal.z > 0.1)
        );

        for (const feature of features) {
            if (!feature.toolId) continue;
            // Sprawdzenie kierunku osi Z: jeśli projekt zawiera obróbki górne,
            // cechy z przeciwległej dolnej powierzchni (axis.z > 0.1 / normal.z < -0.1)
            // nie mogą być wycinane z tego samego układu WCS.
            if (hasTopFeatures && !isFeatureMachinableInWcs(feature)) {
                continue;
            }
            const tool = this.toolLibrary.getTool(feature.toolId);
            if (!tool) {
                throw new Error(`[CAMProcessor] Narzędzie "${feature.toolId}" przypisane do cechy "${feature.featureId || 'unknown'}" nie istnieje w bibliotece narzędzi.`);
            }
            if (typeof tool.diameter !== 'number' || !Number.isFinite(tool.diameter) || tool.diameter <= 0) {
                throw new Error(`[CAMProcessor] Średnica narzędzia "${tool.id}" musi być skończoną liczbą dodatnią (diameter=${tool.diameter}).`);
            }

            const isHole = 'position' in feature;
            const isPocket = 'boundaryPoints' in feature;
            const isGroove = 'startPoint' in feature;
            const isContour = 'points' in feature;
            const featureType: 'hole' | 'groove' | 'contour' | 'pocket' = isHole ? 'hole' : (isPocket ? 'pocket' : (isGroove ? 'groove' : 'contour'));

            const isTargetOfStrategy = Boolean(strategy && strategy.targetFeatureTypes.includes(featureType));

            let feed = tool.parameters.feedRate ?? 1000;
            let rpm = tool.parameters.spindleRpm ?? 3000;
            if (!Number.isFinite(feed) || feed <= 0) {
                throw new Error(`[CAMProcessor] Posuw narzędzia musi być skończoną liczbą dodatnią (feedRate=${feed}).`);
            }
            if (!Number.isFinite(rpm) || rpm <= 0) {
                throw new Error(`[CAMProcessor] Obroty wrzeciona muszą być skończoną liczbą dodatnią (spindleRpm=${rpm}).`);
            }

            if (isTargetOfStrategy && strategy) {
                if (strategy.id === 'drilling_standard' && isHole) {
                    feed = tool.parameters.feedRate ?? 1000;
                    rpm = tool.parameters.spindleRpm ?? 3000;
                } else if (strategy.id === 'pocketing_concentric' && (isGroove || isContour || isPocket)) {
                    feed = 1500;
                    rpm = 18000;
                } else if (strategy.id === 'profiling_25d' && (isContour || isGroove)) {
                    feed = 2000;
                    rpm = 18000;
                }

                // Generujemy komendy ze strategii, aby trajektoria w CNCOperation (używana przez symulator i podgląd)
                // była w 100% zgodna z generowanym programem obróbczym CLData.
                const stratCmds = strategy.generateCLCommands(feature, tool, wcsOrigin, effectiveStrategyParams);
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

                    const motionCmds = stratCmds.filter(c => (c.type === 'GOTO' || c.type === 'ARC') && c.point);

                    if (motionCmds.length >= 2) {
                        const approachPoint = motionCmds[0].point!;
                        // Pierwszy i ostatni ruch to podejście/odjazd SafeZ, nie ruchy skrawające.
                        const cuttingCmds = motionCmds.length >= 3 
                            ? motionCmds.slice(1, motionCmds.length - 1) 
                            : motionCmds.slice(1);
                        if (cuttingCmds.length === 0) continue;
                        const cutStart = cuttingCmds[0].point!;
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
                        const moves: CNCMove[] = cuttingCmds.slice(1).map(c =>
                            c.type === 'ARC'
                                ? {
                                    type: 'arc' as const,
                                    endPoint: c.point!,
                                    arcParams: c.arcParams
                                }
                                : {
                                    type: 'line' as const,
                                    endPoint: c.point!
                                }
                        );

                        operations.push({
                            type: isGroove ? 'groove' : (isPocket ? 'pocket' : 'contour'),
                            toolId: tool.id,
                            position: cutStart,
                            parameters: {
                                width: isGroove ? (feature as GrooveFeature).width : (isPocket ? (feature as PocketFeature).width : tool.diameter),
                                depth: typeof (feature as any).depth === 'number' ? (feature as any).depth : 0,
                                approachPoint,
                                retractPoint: motionCmds[motionCmds.length - 1].point!,
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
                this.validateFeature(hole, workpieceDimensions);
                const rawAxis = hole.axis || { x: 0, y: 0, z: -1 };
                const axisLen = Math.hypot(rawAxis.x, rawAxis.y, rawAxis.z);
                const dir: Vector3D = { x: rawAxis.x / axisLen, y: rawAxis.y / axisLen, z: rawAxis.z / axisLen };
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
                            retractR: hole.retractR ?? 5.0,
                            axis: dir,
                            face: hole.face,
                            strategyId: isTargetOfStrategy ? strategy?.id : undefined
                        }
                    });
                }
            } else if ('startPoint' in feature) {
                const groove = feature as GrooveFeature;
                this.validateFeature(groove, workpieceDimensions);
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

                const rawDepth = typeof groove.depth === 'number' ? Math.abs(groove.depth) : 8;

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
                this.validateFeature(contour, workpieceDimensions);
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
                this.validateFeature(pocket, workpieceDimensions);
                if (pocket.boundaryPoints.length >= 4) {
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
