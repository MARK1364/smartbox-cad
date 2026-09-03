import { Intent } from "../../A1_core/interaction/interaction-types";
import { BaseState } from "../../A1_core/interaction/states/base-state";
import { ContextManager } from "../../A1_core/context-manager";

// Helper do łączenia zaznaczonych krawędzi w jeden spójny profil (polyline)
export const chainEdgeSegments = (edgeSegments: { points: {x: number, y: number, z: number}[] }[]) => {
    if (edgeSegments.length === 0) return [];
    if (edgeSegments.length === 1) return edgeSegments[0].points;

    const distSq = (p1: {x: number, y: number, z: number}, p2: {x: number, y: number, z: number}) => {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z - p2.z;
        return dx * dx + dy * dy + dz * dz;
    };

    const remaining = edgeSegments.map(s => ({ points: [...s.points] }));
    let currentChain = [...remaining.shift()!.points];

    while (remaining.length > 0) {
        const chainEnd = currentChain[currentChain.length - 1];
        const chainStart = currentChain[0];
        let bestIndex = -1;
        let bestMode: 'end-to-start' | 'end-to-end' | 'start-to-start' | 'start-to-end' = 'end-to-start';
        let minDistanceSq = 25.0; // Maksymalna tolerancja przerwy (5mm)

        for (let i = 0; i < remaining.length; i++) {
            const seg = remaining[i].points;
            const segStart = seg[0];
            const segEnd = seg[seg.length - 1];

            const d1 = distSq(chainEnd, segStart);
            if (d1 < minDistanceSq) {
                minDistanceSq = d1;
                bestIndex = i;
                bestMode = 'end-to-start';
            }

            const d2 = distSq(chainEnd, segEnd);
            if (d2 < minDistanceSq) {
                minDistanceSq = d2;
                bestIndex = i;
                bestMode = 'end-to-end';
            }

            const d3 = distSq(chainStart, segEnd);
            if (d3 < minDistanceSq) {
                minDistanceSq = d3;
                bestIndex = i;
                bestMode = 'start-to-end';
            }

            const d4 = distSq(chainStart, segStart);
            if (d4 < minDistanceSq) {
                minDistanceSq = d4;
                bestIndex = i;
                bestMode = 'start-to-start';
            }
        }

        if (bestIndex !== -1) {
            const [nextSeg] = remaining.splice(bestIndex, 1);
            const segPts = [...nextSeg.points];

            if (bestMode === 'end-to-start') {
                const startIdx = distSq(chainEnd, segPts[0]) < 0.01 ? 1 : 0;
                currentChain.push(...segPts.slice(startIdx));
            } else if (bestMode === 'end-to-end') {
                segPts.reverse();
                const startIdx = distSq(chainEnd, segPts[0]) < 0.01 ? 1 : 0;
                currentChain.push(...segPts.slice(startIdx));
            } else if (bestMode === 'start-to-end') {
                const endIdx = distSq(chainStart, segPts[segPts.length - 1]) < 0.01 ? segPts.length - 1 : segPts.length;
                currentChain.unshift(...segPts.slice(0, endIdx));
            } else if (bestMode === 'start-to-start') {
                segPts.reverse();
                const endIdx = distSq(chainStart, segPts[segPts.length - 1]) < 0.01 ? segPts.length - 1 : segPts.length;
                currentChain.unshift(...segPts.slice(0, endIdx));
            }
        } else {
            const unconnected = remaining.shift()!;
            currentChain.push(...unconnected.points);
        }
    }

    return currentChain;
};

export class SelectProfileTool extends BaseState {
    private selectedEdgeSegments: { points: {x: number, y: number, z: number}[] }[] = [];
    private unsubscribePicker: (() => void) | null = null;
    
    // Zdarzenie (callback) powiadamiające CncPanel.tsx o nowym wybranym profilu
    public onProfileConfirmed: ((points: {x: number, y: number, z: number}[]) => void) | null = null;
    
    // Callback do synchronizacji UI np. pokazania menu zatwierdzania
    public onStateActive: ((isActive: boolean, segmentCount: number) => void) | null = null;

    public onEnter(): void {
        super.onEnter();
        this.selectedEdgeSegments = [];
        
        // Wymuszenie trybu wyboru krawędzi
        if (this.ctx.facePicker) {
            this.ctx.facePicker.selectionMode = 'subgeometry';
            this.ctx.facePicker.targetSubgeometryType = 'edge';
        }

        if (this.ctx.ui) {
            this.ctx.ui.setStatus("Wybierz krawędzie profilu. ENTER by zatwierdzić, ESC by wyjść.");
        }
        
        if (this.onStateActive) {
            this.onStateActive(true, 0);
        }

        this.unsubscribePicker = this.ctx.facePicker.onPick((type: string, data: any) => {
            if (type === 'select-edge') {
                let points = data?.points;
                if (!points && data?.mesh?.metadata?.brepPoints) {
                    points = data.mesh.metadata.brepPoints.map((p: number[]) => ({ x: p[0], y: p[1], z: p[2] }));
                } else if (!points && data?.mesh?.metadata?.points) {
                    points = data.mesh.metadata.points;
                }
                
                if (points) {
                    this.selectedEdgeSegments.push({ points });
                }
                
                if (this.ctx.ui) {
                    this.ctx.ui.setStatus(`Zebrano krawędzi: ${this.selectedEdgeSegments.length}`);
                }
                if (this.onStateActive) {
                    this.onStateActive(true, this.selectedEdgeSegments.length);
                }
                // Tutaj w przyszłości można dodać generowanie wizualizacji
            }
        });
    }

    public onExit(): void {
        super.onExit();
        if (this.unsubscribePicker) {
            this.unsubscribePicker();
            this.unsubscribePicker = null;
        }

        // Przywrócenie domyślnego trybu wyboru i czyszczenie podświetleń 3D
        if (this.ctx.facePicker) {
            this.ctx.facePicker.clearSelection();
            this.ctx.facePicker.selectionMode = 'object';
            this.ctx.facePicker.targetSubgeometryType = null;
        }

        this.selectedEdgeSegments = [];
        if (this.ctx.ui) {
            this.ctx.ui.setStatus("Gotowy");
        }
        if (this.onStateActive) {
            this.onStateActive(false, 0);
        }
    }

    public onSelect(intent: Intent): void {
        if (intent.pointerInfo?.event) {
            const pointerX = this.ctx.viewport.scene.pointerX;
            const pointerY = this.ctx.viewport.scene.pointerY;
            this.ctx.facePicker.handlePointerDown(pointerX, pointerY, intent.pointerInfo.event);
        }
    }

    public onConfirm(intent: Intent): void {
        if (this.selectedEdgeSegments.length > 0) {
            const chainedPoints = chainEdgeSegments(this.selectedEdgeSegments);
            if (this.onProfileConfirmed) {
                this.onProfileConfirmed(chainedPoints);
            }
        }
        this.stateMachine.changeState('SELECTION_TOOL');
    }

    public onCancel(intent: Intent): void {
        this.stateMachine.changeState('SELECTION_TOOL');
    }
    
    // Metoda pozwalająca wymusić zatwierdzenie z poziomu UI np. przyciskiem
    public forceConfirm(): void {
        this.onConfirm({ type: "CONFIRM" } as Intent);
    }
    
    // Metoda pozwalająca wymusić anulowanie z poziomu UI
    public forceCancel(): void {
        this.onCancel({ type: "CANCEL" } as Intent);
    }
}
