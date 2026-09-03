import { ProjectDocument } from './project-document.js';
import { Viewport } from '../S3_scena/viewport.js';
import { FacePicker } from './face-picker.js';
import { ModalTransformManager } from './modal-transform.js';
import { TooltipManager } from './tooltip-manager.js';

import { SceneSyncAdapter } from './cad-node/scene-sync-adapter.js';

import { CommandHistory } from './commands/command-history.js';
import type { ProjectFileIO } from './project-file-io.js';

export interface IAppAPI {
    addSmartPanel?: () => void;
    addSmartBox?: () => void;
    createNewKorpus?: (params?: any) => void;
    rebuildContainer?: (containerId: string) => void;
    undo?: () => void;
    redo?: () => void;
    newProject?: () => void;
    openProject?: () => void;
    saveProject?: () => void;
    saveProjectAs?: () => void;
    exportStep?: () => void;
    exportStl?: () => void;
    setRenderMode?: (mode: string) => void;
    toggleGrid?: () => void;
    toggleProjection?: () => void;
    zoomFit?: () => void;
    viewNormalToFace?: () => void;
    setView?: (viewName: string) => void;
    setSelectionMode?: (mode: 'object' | 'subgeometry') => void;
    setStatus?: (status: string, highlight?: boolean) => void;
    setLcsVisible?: (visible: boolean) => void;
    [key: string]: any;
}

/**
 * ContextManager
 * Centralny zarządca stanu współdzielonego pomiędzy modułami aplikacji (Singleton).
 * Zastępuje przypisywania do obiektu globalnego `window`.
 */
export class ContextManager {
    private static _instance: ContextManager;

    public document: ProjectDocument | null = null;
    public projectFileIO: ProjectFileIO | null = null;
    public commandHistory: CommandHistory | null = null;
    public viewport: Viewport | null = null;
    public facePicker: FacePicker | null = null;
    public modalTransformManager: ModalTransformManager = ModalTransformManager.instance;
    public gizmoController: any = null;
    public tooltipManager: TooltipManager = TooltipManager.instance;
    public panelViews: Map<any, any> = new Map();
    public containerViews: Map<any, any> = new Map();
    public sceneSyncAdapter: SceneSyncAdapter = new SceneSyncAdapter();
    public smartBoxBayController: any = null;
    
    // Zmienne używane z poziomu Reacta i UI
    public activeTab = 'tab-a4-smartpanel';
    public activeReferencePicker: any = null;
    /** Pipeta więzów S2_solver — aktywna podczas wskazywania slotu A/B. */
    public activeConstraintPicker: any = null;
    public appAPI: IAppAPI | null = null;
    public stateMachine: any = null;
    public pmiRenderer: any = null;
    public lcsVisible: boolean = false;
    public activePanel: any = null;
    public selectedPanel: any = null;
    public korpusRules: any = null;
    public hideGizmos: (() => void) | null = null;
    public showGizmos: (() => void) | null = null;
    public hidePositionGizmo: (() => void) | null = null;

    /** Tymczasowo wyłącza zielone podświetlenie aktywnego korpusu/formatki (np. w trybie PMI). */
    public suppressSelectionHighlight = false;

    private _babylonScene: any = null;

    public get babylonScene(): any {
        return this.viewport ? this.viewport.scene : this._babylonScene;
    }

    public set babylonScene(scene: any) {
        this._babylonScene = scene;
    }

    private constructor() {}

    public static get instance(): ContextManager {
        if (!ContextManager._instance) {
            ContextManager._instance = new ContextManager();
        }
        return ContextManager._instance;
    }
}
