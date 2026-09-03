/**
 * SmartPanel Web — C1_CNC CAM State Store
 * 
 * Centralny magazyn stanu dla aplikacji CAM (odpowiednik Redux / Zustand w czystym TS z Listenerami).
 * Zarządza aktywnym programem CNC, przypisaniami narzędzi, wybranymi strategiami i stanem symulacji.
 */

import { CAMFeature, Tool, Vector3D } from '../dto/cam-dto.js';
import { CLDataProgram } from './cl-data.js';

export interface CNCProgramState {
    id: string;
    name: string;
    targetPanel: any;
    targetPanelName: string;
    wcsName: string;
    /** -1 = origin z JSON roli; 0..7 = ręcznie wybrane naroże panelu */
    cornerIndex: number;
    postprocessor: string;
    features: CAMFeature[];
    toolAssignments: Record<string, string>; // featureId -> toolId
    wcsOffsetX?: number;
    wcsOffsetY?: number;
    wcsOffsetZ?: number;
    wcsRotX?: number;
    wcsRotY?: number;
    wcsRotZ?: number;
    projectName?: string;
    projectPath?: string;
    isActive?: boolean;
    clDataProgram?: CLDataProgram | null;
}

export type SubTabType = 'wcs' | 'tool' | 'operation' | 'simulate' | 'generate';

export interface CAMStoreState {
    programs: CNCProgramState[];
    activeProgramId: string | null;
    activeSubTab: SubTabType;
    selectedFeatureIds: string[];
    isSimulating: boolean;
    simulationSpeed: number;
    simStatusText: string;
    simProgressPercent: number;
    warningMessage: string | null;
}

type Listener = (state: CAMStoreState) => void;

export class CAMStateStore {
    private static instance: CAMStateStore;
    private state: CAMStoreState = {
        programs: [],
        activeProgramId: null,
        activeSubTab: 'wcs',
        selectedFeatureIds: [],
        isSimulating: false,
        simulationSpeed: 1.0,
        simStatusText: 'Gotowy',
        simProgressPercent: 0,
        warningMessage: null
    };

    private listeners: Set<Listener> = new Set();

    private constructor() {}

    public static getInstance(): CAMStateStore {
        if (!CAMStateStore.instance) {
            CAMStateStore.instance = new CAMStateStore();
        }
        return CAMStateStore.instance;
    }

    public getState(): CAMStoreState {
        return { ...this.state };
    }

    public subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        const stateCopy = this.getState();
        this.listeners.forEach(l => l(stateCopy));
    }

    public setPrograms(programs: CNCProgramState[]): void {
        this.state.programs = [...programs];
        this.notify();
    }

    public setActiveProgramId(id: string | null): void {
        this.state.activeProgramId = id;
        this.notify();
    }

    public getActiveProgram(): CNCProgramState | null {
        if (!this.state.activeProgramId) return null;
        return this.state.programs.find(p => p.id === this.state.activeProgramId) || null;
    }

    public updateActiveProgram(updater: (program: CNCProgramState) => CNCProgramState): void {
        if (!this.state.activeProgramId) return;
        this.state.programs = this.state.programs.map(p => {
            if (p.id === this.state.activeProgramId) {
                return updater({ ...p });
            }
            return p;
        });
        this.notify();
    }

    public setActiveSubTab(subTab: SubTabType): void {
        this.state.activeSubTab = subTab;
        this.notify();
    }

    public setSelectedFeatureIds(ids: string[]): void {
        this.state.selectedFeatureIds = [...ids];
        this.notify();
    }

    public setSimulationState(isSimulating: boolean, speed?: number, statusText?: string, progressPercent?: number): void {
        this.state.isSimulating = isSimulating;
        if (speed !== undefined) this.state.simulationSpeed = speed;
        if (statusText !== undefined) this.state.simStatusText = statusText;
        if (progressPercent !== undefined) this.state.simProgressPercent = progressPercent;
        this.notify();
    }

    public setWarningMessage(msg: string | null): void {
        this.state.warningMessage = msg;
        this.notify();
    }
}
