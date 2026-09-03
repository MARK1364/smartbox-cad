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
                    store.setSimulationState(
                        info.progressPercent < 100 && !info.statusText.includes("Zatrzymano"), 
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
            this.visualizer.clear();
            return;
        }

        const panel = activeProg.targetPanel;
        if (!panel) return;

        const panelViews = ContextManager.instance.panelViews as Map<any, any> | undefined;
        let targetViewRoot: any = null;
        if (panelViews) {
            for (const [keyPanel, view] of panelViews.entries()) {
                const nameMatch = keyPanel.name && panel.name && keyPanel.name === panel.name;
                const idMatch = keyPanel.id && panel.id && keyPanel.id === panel.id;
                const refMatch = keyPanel === panel;
                if (nameMatch || idMatch || refMatch) {
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
            const meshes = this.initializedScene.meshes;
            for (const m of meshes) {
                if (m.name === panel.name || (panel.id && m.name.includes(panel.id))) {
                    targetViewRoot = m;
                    break;
                }
            }
        }

        const dims = this.getDimensionsMM(panel);
        
        // Pobieranie roli formatki by pobrać regułę
        const panelRole = panel.role || panel.name;
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

        // Renderowanie 3D z aktualnego stanu features
        this.visualizer.renderFeatures(activeProg.features || [], this.wcsManager, targetViewRoot);
    }

    public getDimensionsMM(panel: any) {
        if (!panel) return { width: 600, height: 720, thickness: 18 };
        const w = typeof panel.width === 'number' ? nmToMm(panel.width) : 600;
        const h = typeof panel.height === 'number' ? nmToMm(panel.height) : 720;
        const t = typeof panel.thickness === 'number' ? nmToMm(panel.thickness) : 18;
        return { width: w, height: h, thickness: t };
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

        this.simulator.setWcsTransform(this.wcsManager, targetViewRoot);
        
        const project = this.camProcessor.processProject({
            projectName: prog.projectName || 'Program',
            wcsOrigin: this.wcsManager.getOrigin(),
            wcsName: this.wcsManager.getWcsName(),
            features: prog.features,
            toolAssignments: prog.toolAssignments || {},
            postprocessor: prog.postprocessor || 'Mach3'
        });

        this.simulator.setSpeed(speed);
        this.simulator.loadOperations(project.operations);
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
