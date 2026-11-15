import { ProjectDocument } from './project-document.js';
import { FacePicker } from './face-picker.js';
import { ModalTransformManager } from './modal-transform.js';
import { TooltipManager } from './tooltip-manager.js';

import { SceneSyncAdapter } from './cad-node/scene-sync-adapter.js';

import { CommandHistory } from './commands/command-history.js';
import type { ProjectFileIO } from './project-file-io.js';
import { deactivateAllPmiTools } from '../A8_pmi/pmi-tool-activate.js';
import { PMIStore } from '../A8_pmi/pmi-data.js';

export interface IAppAPI {
    addSmartPanel?: () => void;
    createNewKorpus?: (params?: any) => void;
    rebuildContainer?: (containerId: string) => void;
    undo?: () => void;
    redo?: () => void;
    newProject?: () => void;
    forceResetProject?: () => void;
    openProject?: () => void;
    loadProjectData?: (data: any, status?: string) => void;
    saveProject?: () => Promise<boolean> | void;
    saveProjectAs?: () => Promise<boolean> | void;
    exportStep?: () => void;
    exportStl?: () => void;
    setRenderMode?: (mode: string) => void;
    toggleGrid?: () => void;
    toggleProjection?: () => void;
    zoomFit?: () => void;
    setView?: (viewName: string) => void;
    setSelectionMode?: (mode: 'object' | 'subgeometry') => void;
    setStatus?: (status: string, highlight?: boolean, kind?: 'info' | 'error') => void;
    setLcsVisible?: (visible: boolean) => void;
    setPmiVisible?: (visible: boolean) => void;
    setEdgeBandingVisible?: (visible: boolean) => void;
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
    /** Viewport Babylon (S3) — typed `any`, żeby A1 nie zależało od S3_scena. */
    public viewport: any = null;
    public facePicker: FacePicker | null = null;
    public modalTransformManager: ModalTransformManager = ModalTransformManager.instance;
    public gizmoController: any = null;
    public tooltipManager: TooltipManager = TooltipManager.instance;
    public panelViews: Map<any, any> = new Map();
    public containerViews: Map<any, any> = new Map();
    public hardwareViews: Map<any, any> = new Map();
    public sceneSyncAdapter: SceneSyncAdapter = new SceneSyncAdapter();
    public blokiBayController: any = null;
    public smartFrameDragController: any = null;
    public smartWallDragController: any = null;
    public solverController: any = null;
    
    // Zmienne używane z poziomu Reacta i UI
    private _activeTab = 'tab-a3-smartframe';

    public get activeTab(): string {
        return this._activeTab;
    }

    public set activeTab(tab: string) {
        this._activeTab = tab;
        if (tab !== 'tab-a8-pmi') {
            this.deactivatePmiToolsIfActive();
        }
        this.syncPmiVisibility();
    }

    /** Globalny przełącznik widoczności wymiarów PMI w belce widokowej (Podgląd -> PMI). */
    public pmiVisible: boolean = true;

    /** Ustawiane przez ExportEngine - opcja "Dołącz linie wymiarowe". */
    public exportIncludesPmi = true;

    public setPmiVisible(visible: boolean): void {
        this.pmiVisible = visible;
        this.syncPmiVisibility();
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('cad-pmi-visibility-changed', { detail: { visible } }));
        }
    }

    /** Wymiary są widoczne globalnie gdy pmiVisible=true (oraz w Eksporcie zgodnie z exportIncludesPmi), z zachowaniem widoczności szczegółowej w drzewie. */
    public syncPmiVisibility(): void {
        const show = this._activeTab === 'tab-e1-export'
            ? (this.pmiVisible && this.exportIncludesPmi)
            : this.pmiVisible;
        this.pmiRenderer?.setVisible?.(show);
        if (show) this.pmiRenderer?.renderAll?.(PMIStore.instance);
    }

    /** Uniwersalne wyjście z narzędzi PMI i powrót do SELECTION_TOOL. */
    public deactivatePmiToolsIfActive(): void {
        deactivateAllPmiTools(this.stateMachine);
        this.pmiRenderer?.clearPreview?.();
        this.pmiRenderer?.clearMeasurePreview?.();
        this.syncPmiVisibility();
    }

    public activeReferencePicker: any = null;
    /** Pipeta więzów S2_solver — aktywna podczas wskazywania slotu A/B. */
    public activeConstraintPicker: any = null;
    public appAPI: IAppAPI | null = null;
    public requestNewProjectDialog: (() => void) | null = null;
    public stateMachine: any = null;
    public pmiRenderer: any = null;
    public lcsVisible: boolean = false;
    /** Przełącznik podświetlania oklejonych obrzeży w menu Podgląd -> Obrzeża. */
    public edgeBandingVisible: boolean = false;

    public setEdgeBandingVisible(visible: boolean): void {
        this.edgeBandingVisible = visible;
        if (this.panelViews && this.panelViews.size > 0) {
            this.panelViews.forEach((pv: any) => {
                if (typeof pv?._updateMaterialAppearance === 'function') {
                    pv._updateMaterialAppearance();
                }
            });
        }
        this.viewport?.requestRender?.(3);
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('cad-edge-banding-visibility-changed', { detail: { visible } }));
        }
    }
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
