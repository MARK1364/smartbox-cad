/**
 * SmartPanel Web — C1_CNC Global Engine
 * 
 * Globalny silnik (Singleton) zarządzający sceną 3D, wizualizacją i symulacją obróbki CNC.
 * Odseparowuje logikę 3D od interfejsu (CncPanel.tsx), co pozwala na otwarcie wielu instancji panelu bez konfliktów na scenie.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { CAMStateStore } from './cam-state-store.js';
import { WcsManager } from '../wcs/wcs-manager.js';
import { WcsRulesMapper, cornerIndexToOriginCorner } from '../wcs/wcs-rules-mapper.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { CAMProcessor } from '../processor/cam-processor.js';
import { CAMVisualizer } from '../visualization/cam-visualizer.js';
import { CNCSimulator } from '../visualization/cnc-simulator.js';
import { GeometryDataExtractor } from '../geometry/geometry-detector.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

export class CNCEngine {
    private static instance: CNCEngine | null = null;
    
    public wcsManager: WcsManager;
    public toolLibrary: ToolLibrary;
    public camProcessor: CAMProcessor;
    public visualizer: CAMVisualizer | null = null;
    public simulator: CNCSimulator | null = null;
    public geometryExtractor: GeometryDataExtractor;

    private unsubscribe: (() => void) | null = null;
    private initializedScene: any = null;
    private lastVisualStateKey: string | null = null;
    private lastFeaturesRef: any = null;
    private lastTargetViewRoot: any = null;

    private constructor() {
        this.wcsManager = new WcsManager('G55');
        this.toolLibrary = new ToolLibrary();
        this.camProcessor = new CAMProcessor(this.toolLibrary);
        this.geometryExtractor = new GeometryDataExtractor();

        // Subskrybuj do globalnego sklepu
        this.unsubscribe = CAMStateStore.getInstance().subscribe((state) => {
            this.handleStateChange(state);
        });
    }

    public static getInstance(): CNCEngine {
        if (!CNCEngine.instance) {
            CNCEngine.instance = new CNCEngine();
        }
        return CNCEngine.instance;
    }

    public initializeIfNeeded(scene: any): void {
        if (!scene) return;
        if (this.initializedScene !== scene) {
            this.initializedScene = scene;
            this.lastVisualStateKey = null;
            this.lastFeaturesRef = null;
            this.lastTargetViewRoot = null;
            
            // Clean up old ones if they existed
            if (this.visualizer) this.visualizer.clear();
            if (this.simulator) this.simulator.stop();
            
            this.visualizer = new CAMVisualizer(scene);
            this.simulator = new CNCSimulator(scene, this.toolLibrary);

            // Podpięcie eventów symulatora do stanu globalnego
            this.simulator.onStatus((info) => {
                const store = CAMStateStore.getInstance();
                const prog = store.getActiveProgram();
                if (prog) {
                    // Strict: stan symulacji po fladze running, nigdy po tekście statusText.
                    store.setSimulationState(
                        info.running && info.progressPercent < 100,
                        undefined,
                        info.statusText,
                        info.progressPercent
                    );
                }
            });
        }

        // (Re-)subskrypcja do store — odporna na HMR 
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = CAMStateStore.getInstance().subscribe((state) => {
            this.handleStateChange(state);
        });

        // Wymuś pierwsze renderowanie z aktualnym stanem
        this.handleStateChange(CAMStateStore.getInstance().getState());
    }

    private handleStateChange(state: any): void {
        if (!this.visualizer) return;

        const activeProg = CAMStateStore.getInstance().getActiveProgram();
        if (!activeProg) {
            this.lastVisualStateKey = null;
            this.lastFeaturesRef = null;
            this.lastTargetViewRoot = null;
            this.visualizer.clear();
            return;
        }

        const panel = activeProg.targetPanel;
        if (!panel) {
            this.lastVisualStateKey = null;
            this.lastFeaturesRef = null;
            this.lastTargetViewRoot = null;
            return;
        }

        const panelViews = ContextManager.instance.panelViews as Map<any, any> | undefined;
        let targetViewRoot: any = null;
        if (panelViews) {
            for (const [keyPanel, view] of panelViews.entries()) {
                // Strict: tożsamość po id / referencji. Nazwy to display, nie biorą udziału w matchowaniu.
                const idMatch = keyPanel.id && panel.id && keyPanel.id === panel.id;
                const refMatch = keyPanel === panel;
                if (idMatch || refMatch) {
                    if (view && view.root) {
                        targetViewRoot = view.root;
                        break;
                    }
                }
            }
        }
        if (!targetViewRoot && panel.meshNode) {
            targetViewRoot = panel.meshNode;
        }
        if (!targetViewRoot && this.initializedScene) {
            // Strict: wiązanie przez jawne CADNode.id w SceneSyncAdapter (id → mesh).
            // Bez skanowania sceny po nazwach — zmiana nazw w warstwie widoku nic tu nie psuje.
            try {
                const ctxMgr = ContextManager.instance as any;
                const doc = ctxMgr?.document;
                const node = panel?.id && doc?.findNode ? doc.findNode(panel.id) : null;
                const mesh = ctxMgr?.sceneSyncAdapter?.getMeshForNodeId?.(node?.id ?? panel?.id) ?? null;
                if (mesh) targetViewRoot = mesh;
            } catch { /* brak wiązania — jak wcześniej, visualizer dostanie null */ }
        }

        const dims = this.getDimensionsMM(panel);
        
        // Rola formatki z pola role. Brak roli = default WCS (bez zgadywania po nazwie).
        const panelRole = panel.role;
        const roleRule = WcsRulesMapper.getRuleForRole(panelRole);
        const rule = roleRule
            ? { ...roleRule, origin_corner: { ...roleRule.origin_corner }, directions: { ...roleRule.directions }, rotation: { ...roleRule.rotation } }
            : {
                origin_corner: { X: '-', Y: '-', Z: '-' },
                directions: { X: '+', Y: '+', Z: '+' },
                rotation: { X: 0, Y: 0, Z: 0 },
            };

        // Origin z JSON roli (korpus3_3_rules.role_overrides.*.wcs_origin_corner).
        // cornerIndex >= 0 dopiero po ręcznym „Zmień naroże WCS” — wtedy nadpisuje JSON.
        if (typeof activeProg.cornerIndex === 'number' && activeProg.cornerIndex >= 0) {
            rule.origin_corner = cornerIndexToOriginCorner(activeProg.cornerIndex);
        }
        this.wcsManager.setRule(rule);

        // Aktualizacja stanu WcsManager z danych w globalnym sklepie
        this.wcsManager.setWcsName(activeProg.wcsName || 'G55');
        this.wcsManager.updateForPanelDimensions(dims.width, dims.height, dims.thickness);
        
        this.wcsManager.setManualRotation({ 
            x: activeProg.wcsRotX || 0, 
            y: activeProg.wcsRotY || 0, 
            z: activeProg.wcsRotZ || 0 
        });
        
        this.wcsManager.setManualOffset({ 
            x: activeProg.wcsOffsetX || 0, 
            y: activeProg.wcsOffsetY || 0, 
            z: activeProg.wcsOffsetZ || 0 
        });

        // Sprawdzenie czy zaszła realna zmiana geometrii formatki, cech obróbczych lub układu WCS.
        // Jeśli zmiana w sklepie dotyczy wyłącznie odtwarzania symulacji (isSimulating, simProgressPercent, itp.),
        // pomijamy kosztowne niszczenie i ponowne budowanie w Babylon.js siatek 3D features i gizma WCS.
        const currentKey = [
            activeProg.id,
            panel?.id || (panel ? 'p_ref' : 'none'),
            dims.width,
            dims.height,
            dims.thickness,
            panelRole || 'none',
            activeProg.cornerIndex,
            activeProg.wcsName,
            activeProg.wcsOffsetX || 0,
            activeProg.wcsOffsetY || 0,
            activeProg.wcsOffsetZ || 0,
            activeProg.wcsRotX || 0,
            activeProg.wcsRotY || 0,
            activeProg.wcsRotZ || 0,
            activeProg.features?.length || 0,
            state.showToolpaths ? 'tp_on' : 'tp_off'
        ].join(':');

        if (
            this.lastVisualStateKey === currentKey &&
            this.lastFeaturesRef === activeProg.features &&
            this.lastTargetViewRoot === targetViewRoot
        ) {
            return;
        }

        this.lastVisualStateKey = currentKey;
        this.lastFeaturesRef = activeProg.features;
        this.lastTargetViewRoot = targetViewRoot;

        // Renderowanie 3D z aktualnego stanu features
        this.visualizer.renderFeatures(activeProg.features || [], this.wcsManager, targetViewRoot);

        // Renderowanie ścieżek narzędzia 3D (G0 Rapid Travel / G1 Cutting)
        if (state.showToolpaths) {
            const operations = this.camProcessor.processProject({
                projectName: activeProg.projectName || 'Program',
                wcsOrigin: this.wcsManager.getOrigin(),
                wcsName: this.wcsManager.getWcsName(),
                features: activeProg.features || [],
                toolAssignments: activeProg.toolAssignments || {},
                postprocessor: activeProg.postprocessor || 'Mach3',
                workpieceDimensions: dims
            });
            this.visualizer.renderToolpaths(operations, this.wcsManager, targetViewRoot);
        } else {
            this.visualizer.clearToolpaths();
        }
    }

    public getDimensionsMM(panel: any): { width: number; height: number; thickness: number } {
        if (!panel) {
            throw new Error('[C1_cnc/CNCEngine] Brak referencji do formatki (panel is null/undefined).');
        }
        if (typeof panel.width !== 'number' || panel.width <= 0 ||
            typeof panel.height !== 'number' || panel.height <= 0 ||
            typeof panel.thickness !== 'number' || panel.thickness <= 0) {
            throw new Error(`[C1_cnc/CNCEngine] Formatka "${panel.id}" nie posiada poprawnych wymiarów fizycznych (W=${panel.width}, H=${panel.height}, T=${panel.thickness}).`);
        }
        return {
            width: nmToMm(panel.width),
            height: nmToMm(panel.height),
            thickness: nmToMm(panel.thickness)
        };
    }

    public startSimulation(speed: number): void {
        if (!this.simulator) return;
        const store = CAMStateStore.getInstance();
        const prog = store.getActiveProgram();
        if (!prog || !prog.targetPanel) return;

        // Sprawdź czy są operacje bez przypisanego narzędzia
        const missingToolFeats = (prog.features || []).filter(f => !f.toolId);
        if (missingToolFeats.length > 0) {
            store.setWarningMessage(`Błąd: Brak przypisanego narzędzia dla ${missingToolFeats.length} operacji! Przypisz narzędzia przed uruchomieniem symulacji.`);
            return;
        }

        store.setWarningMessage(null);

        const panelViews = ContextManager.instance.panelViews as Map<any, any> | undefined;
        let targetViewRoot: any = null;
        if (panelViews && panelViews.has(prog.targetPanel)) {
            const view = panelViews.get(prog.targetPanel);
            if (view && view.root) targetViewRoot = view.root;
        }

        const dims = this.getDimensionsMM(prog.targetPanel);
        this.wcsManager.updateForPanelDimensions(dims.width, dims.height, dims.thickness);
        this.simulator.setWcsTransform(this.wcsManager, targetViewRoot);
        
        // Symulator 3D operuje na CNCOperation[] (nie na CLDataProgram — to inny konsument).
        const operations = this.camProcessor.processProject({
            projectName: prog.projectName || 'Program',
            wcsOrigin: this.wcsManager.getOrigin(),
            wcsName: this.wcsManager.getWcsName(),
            features: prog.features,
            toolAssignments: prog.toolAssignments || {},
            postprocessor: prog.postprocessor || 'Mach3',
            workpieceDimensions: dims
        });

        this.simulator.setSpeed(speed);
        this.simulator.loadOperations(operations);
        this.simulator.start();
        store.setSimulationState(true, speed);
    }

    public pauseSimulation(): void {
        if (this.simulator) this.simulator.stop();
        CAMStateStore.getInstance().setSimulationState(false);
    }

    public stopSimulation(): void {
        if (this.simulator) this.simulator.stop();
        CAMStateStore.getInstance().setSimulationState(false);
    }
}
