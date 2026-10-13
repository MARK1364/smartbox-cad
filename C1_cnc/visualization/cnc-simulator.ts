/**
 * SmartPanel Web — C1_CNC Simulator
 * 
 * Animowany symulator obróbki CNC w czasie rzeczywistym w Babylon.js.
 * Dokładne odwzorowanie maszyny stanów z Blendera (`cnc_simulator.py`):
 *   - MOVE (G0 szybki dojazd na osiach XY na wysokości bezpiecznej SAFE_Z)
 *   - DOWN (G1 zanurzanie wiertła/frezu w materiał)
 *   - CUT  (G1 przejazd roboczy wzdłuż wpustu lub ścieżki konturu/profilu z obsługą wielu odcinków)
 *   - UP   (G0 wycofanie na wysokość bezpieczną SAFE_Z)
 */

import { CNCOperation, Vector3D, Tool } from '../dto/cam-dto.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { CNCToolMeshFactory } from './tool-mesh-factory.js';
import { ContextManager } from '../../A1_core/context-manager.js';

declare const BABYLON: any;

export type SimState = 'MOVE' | 'DOWN' | 'CUT' | 'UP';

export interface SimStatusUpdate {
    statusText: string;
    opIndex: number;
    totalOps: number;
    progressPercent: number;
    state: SimState;
    /** Flaga logiczna: symulacja biegnie. Logika czyta TYLKO to, nigdy statusText. */
    running: boolean;
}

export class CNCSimulator {
    private scene: any;
    private operations: CNCOperation[] = [];
    private toolLibrary: ToolLibrary;
    private toolMesh: any = null;
    private activeToolId: string | null = null;

    private isRunning: boolean = false;
    private isPaused: boolean = false;

    private currentOpIndex: number = 0;
    private currentMoveIndex: number = 0;
    private currentState: SimState = 'MOVE';
    private stateProgress: number = 0.0; // 0.0..1.0
    private speedMultiplier: number = 1.0;

    // Pozycje i kierunki symulacji
    private currentPos: any = null; // Vector3
    private startPos: any = null;   // Vector3
    private endPos: any = null;     // Vector3
    private safeZOffset: number = 25.0; // mm nad powierzchnią (SAFE_Z)
    private initialMoveDist: number = 1.0;
    private currentMoveTotalDist: number = 1.0;

    private animationObserver: any = null;
    private onStatusCallback?: (info: SimStatusUpdate) => void;
    private wcsRootNode: any = null;

    // Throttling raportowania stanu do React UI (ochrona przed spadkami FPS)
    private lastReportedStatusText: string = "";
    private lastReportedOpIndex: number = -1;
    private lastReportedState: SimState = 'MOVE';
    private lastReportedPercent: number = -1;
    private lastReportTime: number = 0;

    constructor(scene: any, toolLibrary?: ToolLibrary) {
        this.scene = scene;
        this.toolLibrary = toolLibrary || new ToolLibrary();
    }

    public setWcsTransform(wcsManager: any, parentNode: any): void {
        if (this.wcsRootNode) {
            this.wcsRootNode.dispose();
            this.wcsRootNode = null;
        }
        if (!wcsManager || !this.scene) return;

        this.wcsRootNode = new BABYLON.TransformNode("Simulator_WCS_Root", this.scene);
        if (parentNode) {
            this.wcsRootNode.parent = parentNode;
        }

        const origin = wcsManager.getOrigin();
        const rot = wcsManager.getRotation();
        const dirs = wcsManager.getDirections();
        
        this.wcsRootNode.position = new BABYLON.Vector3(origin.x, origin.y, origin.z);
        this.wcsRootNode.rotation = new BABYLON.Vector3(
            rot.x * Math.PI / 180,
            rot.y * Math.PI / 180,
            rot.z * Math.PI / 180
        );
        this.wcsRootNode.scaling = new BABYLON.Vector3(dirs.x, dirs.y, dirs.z);
    }

    public loadOperations(operations: CNCOperation[]): void {
        this.stop();
        this.operations = [...operations];
        this.currentOpIndex = 0;
        this.currentMoveIndex = 0;
        this.currentState = 'MOVE';
        this.stateProgress = 0.0;
    }

    public onStatus(cb: (info: SimStatusUpdate) => void): void {
        this.onStatusCallback = cb;
    }

    public setSpeed(multiplier: number): void {
        this.speedMultiplier = Math.max(0.1, Math.min(20.0, multiplier));
    }

    public start(): void {
        if (this.operations.length === 0 || !this.scene) return;

        if (this.isPaused) {
            this.isPaused = false;
            this.isRunning = true;
            (ContextManager.instance as any)?.viewport?.requestRender?.(5);
            return;
        }

        this.stop();
        this.isRunning = true;
        this.isPaused = false;
        this.currentOpIndex = 0;
        this.currentMoveIndex = 0;
        this.currentState = 'MOVE';
        this.stateProgress = 0.0;
        this.lastReportedStatusText = "";
        this.lastReportedOpIndex = -1;
        this.lastReportedState = 'MOVE';
        this.lastReportedPercent = -1;
        this.lastReportTime = 0;

        const firstOp = this.operations[0];
        const p = firstOp.position;
        // W systemie WCS oś pionowa to Z
        this.currentPos = new BABYLON.Vector3(p.x, p.y, p.z + this.safeZOffset);

        this.setupCurrentOperation();

        this.animationObserver = this.scene.onBeforeRenderObservable.add(() => {
            this.updateSimulationFrame();
        });

        (ContextManager.instance as any)?.viewport?.requestRender?.(5);
    }

    public pause(): void {
        this.isPaused = true;
        this.isRunning = false;
        (ContextManager.instance as any)?.viewport?.requestRender?.(2);
    }

    public stop(): void {
        this.isRunning = false;
        this.isPaused = false;
        this.currentOpIndex = 0;
        this.currentMoveIndex = 0;
        this.currentState = 'MOVE';
        this.stateProgress = 0.0;
        this.lastReportedStatusText = "";
        this.lastReportedOpIndex = -1;
        this.lastReportedState = 'MOVE';
        this.lastReportedPercent = -1;
        this.lastReportTime = 0;

        if (this.animationObserver && this.scene) {
            this.scene.onBeforeRenderObservable.remove(this.animationObserver);
            this.animationObserver = null;
        }

        if (this.toolMesh) {
            this.toolMesh.dispose(false, true);
            this.toolMesh = null;
            this.activeToolId = null;
        }

        (ContextManager.instance as any)?.viewport?.requestRender?.(2);

        if (this.onStatusCallback) {
            this.onStatusCallback({
                statusText: "Zatrzymano",
                opIndex: 0,
                totalOps: this.operations.length,
                progressPercent: 0,
                state: 'MOVE',
                running: false
            });
        }
    }

    private setupCurrentOperation(): void {
        if (this.currentOpIndex >= this.operations.length) {
            this.stop();
            return;
        }

        const op = this.operations[this.currentOpIndex];
        const toolId = op.toolId;

        // Przełączenie siatki narzędzia 3D jeśli zmieniło się ID narzędzia
        if (toolId !== this.activeToolId || !this.toolMesh) {
            if (this.toolMesh) this.toolMesh.dispose(false, true);
            let tool = this.toolLibrary.getTool(toolId);
            if (!tool) {
                // Fallback dla narzędzia z parametrów operacji
                tool = {
                    id: toolId || 'tool_4_mill_8',
                    name: 'Frez fi 8 mm',
                    diameter: op.parameters?.diameter || 8.0,
                    type: op.type === 'groove' ? 'groove' : (op.type === 'contour' ? 'mill' : 'drill'),
                    parameters: { feedRate: op.parameters?.feedRate || 1200, spindleRpm: 6000 }
                };
            }
            this.toolMesh = CNCToolMeshFactory.createToolMesh(tool, this.scene);
            if (this.wcsRootNode) {
                this.toolMesh.parent = this.wcsRootNode;
            }
            this.activeToolId = toolId;
        }

        this.currentMoveIndex = 0;
        const pos = op.position;

        if (op.type === 'groove' || op.type === 'contour') {
            const depth = Math.abs(op.parameters?.depth || 0.0);
            const moves = op.parameters?.moves;
            if (moves && moves.length > 0) {
                const endP = moves[0].endPoint;
                this.startPos = new BABYLON.Vector3(pos.x, pos.y, pos.z - depth);
                this.endPos = new BABYLON.Vector3(endP.x, endP.y, endP.z - depth);
            } else {
                this.startPos = new BABYLON.Vector3(pos.x, pos.y, pos.z - depth);
                this.endPos = new BABYLON.Vector3(pos.x + 50, pos.y, pos.z - depth);
            }

            // Dopasowanie orientacji piły/frezu do kierunku pierwszego odcinka cięcia
            if (this.toolMesh && op.type === 'groove') {
                const cutDir = this.endPos.subtract(this.startPos).normalize();
                const angle = Math.atan2(cutDir.y, cutDir.x); // Ścieżka XY
                this.toolMesh.rotation = new BABYLON.Vector3(Math.PI / 2, angle, 0);
            } else if (this.toolMesh) {
                this.toolMesh.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); // Frez palcowy (Z-up)
            }
        } else {
            // Otwór / Wiercenie
            const depth = Math.abs(op.parameters?.depth || 10.0);
            this.startPos = new BABYLON.Vector3(pos.x, pos.y, pos.z);
            this.endPos = new BABYLON.Vector3(pos.x, pos.y, pos.z - depth);
            if (this.toolMesh) {
                this.toolMesh.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0); // Wiertło (Z-up)
            }
        }

        const targetPosXY = new BABYLON.Vector3(this.startPos.x, this.startPos.y, this.startPos.z + this.safeZOffset);
        if (this.currentPos) {
            this.initialMoveDist = Math.max(0.001, BABYLON.Vector3.Distance(this.currentPos, targetPosXY));
        } else {
            this.currentPos = targetPosXY.clone();
            this.initialMoveDist = 1.0;
        }
        if (op.type === 'groove' || op.type === 'contour') {
            this.currentMoveTotalDist = Math.max(0.001, BABYLON.Vector3.Distance(this.startPos, this.endPos));
        }
    }

    private updateSimulationFrame(): void {
        if (!this.isRunning || this.isPaused || this.operations.length === 0) return;

        // Wymuś odświeżenie klatki w trybie Render-on-Demand, aby animacja 3D szła gładko 60/120 FPS
        (ContextManager.instance as any)?.viewport?.requestRender?.(2);

        const dt = (this.scene.getEngine().getDeltaTime() / 1000.0) * this.speedMultiplier; // sekundy
        const targetOp = this.operations[this.currentOpIndex];
        const isHole = targetOp.type === 'drill';
        const depth = Math.abs(targetOp.parameters?.depth || 10.0);

        let statusText = "";

        if (this.currentState === 'MOVE') {
            // --- STAN 1: DOJAZD RAPID (G0) na wysokości bezpiecznej SAFE_Z ---
            statusText = `Dojazd (G0): Operacja ${this.currentOpIndex + 1}/${this.operations.length}`;
            const targetPosXY = new BABYLON.Vector3(this.startPos.x, this.startPos.y, this.startPos.z + this.safeZOffset);
            const dist = BABYLON.Vector3.Distance(this.currentPos, targetPosXY);

            const moveSpeed = 200.0; // mm/s
            const step = moveSpeed * dt;

            if (dist <= step) {
                this.currentPos = targetPosXY;
                this.currentState = 'DOWN';
                this.stateProgress = 0.0;
            } else {
                const dir = targetPosXY.subtract(this.currentPos).normalize();
                this.currentPos = this.currentPos.add(dir.scale(step));
            }

        } else if (this.currentState === 'DOWN') {
            // --- STAN 2: WJAZD Z-IN (G1) w głąb materiału na głębokość cięcia ---
            const opTypeLabel = targetOp.type === 'contour' ? 'Frezowanie' : (targetOp.type === 'groove' ? 'Cięcie' : 'Wiercenie');
            statusText = `${opTypeLabel} (Zanurzanie): ${this.currentOpIndex + 1}/${this.operations.length}`;
            const plungeSpeed = 40.0; // mm/s
            const targetZ = isHole ? this.endPos.z : this.startPos.z;
            const startZ = this.startPos.z + this.safeZOffset;
            const totalZDist = startZ - targetZ;
            
            this.stateProgress += (plungeSpeed * dt) / totalZDist;

            if (this.stateProgress >= 1.0) {
                this.stateProgress = 1.0;
                if (!isHole) {
                    this.currentState = 'CUT';
                    const cutTargetPos = new BABYLON.Vector3(this.endPos.x, this.endPos.y, this.endPos.z);
                    this.currentMoveTotalDist = Math.max(0.001, BABYLON.Vector3.Distance(this.currentPos, cutTargetPos));
                } else {
                    this.currentState = 'UP';
                }
            }

            const currentZ = startZ - (totalZDist * this.stateProgress);
            this.currentPos.x = this.startPos.x;
            this.currentPos.y = this.startPos.y;
            this.currentPos.z = currentZ;

        } else if (this.currentState === 'CUT') {
            // --- STAN 3: PRZEJAZD ROBOCZY FREZEM / PIŁĄ (G1) wzdłuż odcinków ścieżki ---
            const moves = targetOp.parameters?.moves || [];
            const moveCount = moves.length || 1;
            statusText = `Frezowanie po ścieżce (Odcinek ${this.currentMoveIndex + 1}/${moveCount}): Op ${this.currentOpIndex + 1}`;

            const cutTargetPos = new BABYLON.Vector3(this.endPos.x, this.endPos.y, this.endPos.z);

            const cutSpeed = (targetOp.parameters?.feedRate || 1200) / 60.0; // mm/min -> mm/s
            const dist = BABYLON.Vector3.Distance(this.currentPos, cutTargetPos);
            const step = cutSpeed * dt;

            if (dist <= step) {
                this.currentPos = cutTargetPos;

                // Sprawdzamy czy są kolejne połączone odcinki konturu w tej samej ścieżce
                if (this.currentMoveIndex < moves.length - 1) {
                    this.currentMoveIndex++;
                    this.startPos = this.endPos.clone();
                    const nextMove = moves[this.currentMoveIndex];
                    const cutDepth = Math.abs(targetOp.parameters?.depth || 0);
                    this.endPos = new BABYLON.Vector3(nextMove.endPoint.x, nextMove.endPoint.y, nextMove.endPoint.z - cutDepth);
                    this.currentMoveTotalDist = Math.max(0.001, BABYLON.Vector3.Distance(this.startPos, this.endPos));

                    // Obrót tarczy/frezu dla nowego odcinka
                    if (this.toolMesh && targetOp.type === 'groove') {
                        const cutDir = this.endPos.subtract(this.startPos).normalize();
                        const angle = Math.atan2(cutDir.y, cutDir.x);
                        this.toolMesh.rotation = new BABYLON.Vector3(Math.PI / 2, angle, 0);
                    }
                    // Pozostajemy w stanie 'CUT' bez wycofywania narzędzia!
                } else {
                    // Osiągnięto koniec całej ścieżki konturu -> przejście do wycofania UP
                    this.currentState = 'UP';
                    this.stateProgress = 1.0;
                }
            } else {
                const dir = cutTargetPos.subtract(this.currentPos).normalize();
                this.currentPos = this.currentPos.add(dir.scale(step));
            }

        } else if (this.currentState === 'UP') {
            // --- STAN 4: WYCOFANIE RETRACT (G0) do SAFE_Z po zakończeniu całej ścieżki ---
            statusText = `Wycofanie (G0): Operacja ${this.currentOpIndex + 1}/${this.operations.length}`;
            const retractSpeed = 150.0; // mm/s
            const baseZ = this.endPos.z;
            const retractZ = (isHole ? this.startPos.z : this.endPos.z) + this.safeZOffset;
            const totalZDist = retractZ - baseZ;

            this.stateProgress -= (retractSpeed * dt) / totalZDist;

            if (this.stateProgress <= 0.0) {
                this.stateProgress = 0.0;
                this.currentOpIndex++;

                if (this.currentOpIndex >= this.operations.length) {
                    this.stop();
                    if (this.onStatusCallback) {
                        this.onStatusCallback({
                            statusText: "Symulacja Zakończona",
                            opIndex: this.operations.length,
                            totalOps: this.operations.length,
                            progressPercent: 100,
                            state: 'UP',
                            running: false
                        });
                    }
                    return;
                } else {
                    this.currentState = 'MOVE';
                    this.setupCurrentOperation();
                }
            } else {
                const currentZ = retractZ - (totalZDist * this.stateProgress);
                const baseX = !isHole ? this.endPos.x : this.startPos.x;
                const baseY = !isHole ? this.endPos.y : this.startPos.y;

                this.currentPos.x = baseX;
                this.currentPos.y = baseY;
                this.currentPos.z = currentZ;
            }
        }

        // Aktualizacja pozycji siatki 3D narzędzia na scenie
        if (this.toolMesh) {
            this.toolMesh.position = this.currentPos;
        }

        // Raportowanie stanu do interfejsu React (zoptymalizowany throttling, aby nie paraliżować Reacta)
        if (this.onStatusCallback) {
            const now = performance.now();
            let opFraction = 0;
            if (isHole) {
                if (this.currentState === 'MOVE') {
                    const targetPosXY = new BABYLON.Vector3(this.startPos.x, this.startPos.y, this.startPos.z + this.safeZOffset);
                    const d = BABYLON.Vector3.Distance(this.currentPos, targetPosXY);
                    const frac = Math.max(0, 1.0 - (d / Math.max(1, this.initialMoveDist)));
                    opFraction = frac * 0.15;
                } else if (this.currentState === 'DOWN') {
                    opFraction = 0.15 + Math.min(1.0, Math.max(0, this.stateProgress)) * 0.70;
                } else if (this.currentState === 'UP') {
                    opFraction = 0.85 + (1.0 - Math.min(1.0, Math.max(0, this.stateProgress))) * 0.15;
                }
            } else {
                if (this.currentState === 'MOVE') {
                    const targetPosXY = new BABYLON.Vector3(this.startPos.x, this.startPos.y, this.startPos.z + this.safeZOffset);
                    const d = BABYLON.Vector3.Distance(this.currentPos, targetPosXY);
                    const frac = Math.max(0, 1.0 - (d / Math.max(1, this.initialMoveDist)));
                    opFraction = frac * 0.10;
                } else if (this.currentState === 'DOWN') {
                    opFraction = 0.10 + Math.min(1.0, Math.max(0, this.stateProgress)) * 0.10;
                } else if (this.currentState === 'CUT') {
                    const moves = targetOp.parameters?.moves || [];
                    const moveCount = Math.max(1, moves.length);
                    const cutTargetPos = new BABYLON.Vector3(this.endPos.x, this.endPos.y, this.endPos.z);
                    const d = BABYLON.Vector3.Distance(this.currentPos, cutTargetPos);
                    const moveFrac = Math.max(0, 1.0 - (d / Math.max(1, this.currentMoveTotalDist)));
                    const overallCutFrac = (this.currentMoveIndex + moveFrac) / moveCount;
                    opFraction = 0.20 + Math.min(1.0, overallCutFrac) * 0.70;
                } else if (this.currentState === 'UP') {
                    opFraction = 0.90 + (1.0 - Math.min(1.0, Math.max(0, this.stateProgress))) * 0.10;
                }
            }

            const totalProgress = (this.currentOpIndex + opFraction) / Math.max(1, this.operations.length);
            const currentPercent = Math.min(99, Math.max(0, Math.round(totalProgress * 100)));
            const stateChanged = this.currentState !== this.lastReportedState;
            const opChanged = this.currentOpIndex !== this.lastReportedOpIndex;
            const textChanged = statusText !== this.lastReportedStatusText;
            const timePassed = (now - this.lastReportTime) >= 80; // max ~12 FPS dla React UI
            const percentChanged = currentPercent !== this.lastReportedPercent;

            if (stateChanged || opChanged || (timePassed && (percentChanged || textChanged))) {
                this.lastReportedState = this.currentState;
                this.lastReportedOpIndex = this.currentOpIndex;
                this.lastReportedStatusText = statusText;
                this.lastReportedPercent = currentPercent;
                this.lastReportTime = now;

                this.onStatusCallback({
                    statusText,
                    opIndex: this.currentOpIndex,
                    totalOps: this.operations.length,
                    progressPercent: currentPercent,
                    state: this.currentState,
                    running: true
                });
            }
        }
    }
}
