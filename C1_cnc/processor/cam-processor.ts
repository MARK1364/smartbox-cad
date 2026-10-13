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
    CNCOperation,
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

export interface AssignmentIssues {
    unassignedHolesMm: Record<number, number>;
    unassignedGrooves: number;
    unassignedContours: number;
    totalUnassigned: number;
}

export class CAMProcessor {
    private toolLibrary: ToolLibrary;
    private lastAssignmentIssues: AssignmentIssues = {
        unassignedHolesMm: {},
        unassignedGrooves: 0,
        unassignedContours: 0,
        totalUnassigned: 0
    };

    constructor(toolLibrary?: ToolLibrary) {
        this.toolLibrary = toolLibrary || new ToolLibrary();
    }

    public getLastAssignmentIssues(): AssignmentIssues {
        return { ...this.lastAssignmentIssues };
    }

    /**
     * Operacje CNC dla symulatora 3D i postprocesorów (CNCOperation[]).
     * Pełna optymalizacja trasy TSP (Nearest Neighbor + 2-Opt) na poziomie pojedynczych operacji i otworów.
     */
    public processProject(project: CAMProject): CNCOperation[] {
        const featuresWithTools = this.assignToolsToFeatures(project.features);
        this.collectAssignmentIssues(featuresWithTools);
        const rawOperations = this.createCncOperations(featuresWithTools, project.wcsOrigin);
        return this.optimizeOperations(rawOperations, project.wcsOrigin);
    }

    /**
     * Jedyne wejście dla postprocesorów: CLDataProgram (ISO 4343 / APT).
     *
     * Budowa idzie tą samą ścieżką co `processProject` (ta sama optymalizacja
     * kolejności i ta sama geometria), tyle że wynik jest neutralną listą
     * komend CL zamiast strukturą specyficzną dla symulatora.
     */
    public buildCLProgram(project: CAMProject): CLDataProgram {
        const operations = this.processProject(project);
        const commands: CLCommand[] = [];
        const toolIdsUsed: string[] = [];
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
                    },
                    toolDiameter: p.diameter,
                });
                totalLengthMm += Math.abs(retractR);
                estimatedTimeSec += Math.abs(p.depth) / Math.max(1, p.feedRate) * 60;
                cursor = { x: op.position.x, y: op.position.y, z: op.position.z + retractR };
                continue;
            }

            // contour / groove: seria GOTO po moves.
            const targetZ = op.position.z;
            const safeZ = Math.max(cursor.z, targetZ) + 5;
            commands.push({ type: 'GOTO', point: { x: op.position.x, y: op.position.y, z: safeZ } });
            commands.push({ type: 'GOTO', point: { x: op.position.x, y: op.position.y, z: targetZ } });
            cursor = { x: op.position.x, y: op.position.y, z: targetZ };

            for (const move of p.moves || []) {
                if (move.type !== 'line' || !move.endPoint) continue;
                const e = move.endPoint;
                const step = vecDistance(cursor, e);
                commands.push({ type: 'GOTO', point: { x: e.x, y: e.y, z: e.z } });
                totalLengthMm += step;
                estimatedTimeSec += step / Math.max(1, p.feedRate) * 60;
                cursor = { x: e.x, y: e.y, z: e.z };
            }
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

        for (const feat of features) {
            if (!feat.toolId || !this.toolLibrary.getTool(feat.toolId)) {
                if ('diameter' in feat) {
                    const hole = feat as HoleFeature;
                    const dia = Math.round(hole.diameter * 10) / 10;
                    const count = hole.holeCount || (hole.positions ? hole.positions.length : 1);
                    holesMm[dia] = (holesMm[dia] || 0) + count;
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
            totalUnassigned: totalHoles + unassignedGrooves + unassignedContours
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
    private createCncOperations(features: CAMFeature[], wcsOrigin: Vector3D): CNCOperation[] {
        const operations: CNCOperation[] = [];

        for (const feature of features) {
            if (!feature.toolId) continue;
            const tool = this.toolLibrary.getTool(feature.toolId);
            if (!tool) continue;

            const feed = tool.parameters.feedRate || 1000;
            const rpm = tool.parameters.spindleRpm || 3000;

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
                            retractR: hole.retractR || 5.0
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

                operations.push({
                    type: 'contour',
                    toolId: groove.toolId!,
                    position: s,
                    parameters: {
                        width: groove.width,
                        depth: typeof groove.depth === 'number' && groove.depth !== 0 ? (groove.depth < 0 ? groove.depth : -groove.depth) : -Math.abs(groove.depth),
                        feedRate: feed,
                        spindleRpm: rpm,
                        moves: [
                            { type: 'line', endPoint: e }
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
                            moves
                        }
                    });
                }
            }
        }

        return operations;
    }
}
