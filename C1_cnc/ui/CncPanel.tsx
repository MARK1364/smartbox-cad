/**
 * SmartPanel Web — C1_CNC React UI Panel (Dokładne odwzorowanie Python / Blender N-Panel)
 * 
 * Przepływ pracy spójny z Pythonowym `cnc_ui.py`:
 *   1. Na sztywno przypisana formatka (lockedPanel) do każdego programu CNC
 *   2. Automatyczne ustawienie punktu obrotu kamery (camera.target) w centrum formatki
 *   3. Przycisk "Widok Prostopadły (View Normal)" do wybranej ściany
 *   4. Przywrócone zaznaczanie subgeometrii (ściany, krawędzie, naroża)
 *   5. Niezawodna izolacja 3D ("Pokaż tylko: [Nazwa Formatki]")
 *   6. Sekcje: WCS | Narzędzie | Operacja | Symulacja | Generuj NC
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WcsManager, retransformFeaturesToWcs } from '../wcs/wcs-manager.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { CAMProcessor } from '../processor/cam-processor.js';
import { GeometryDataExtractor } from '../geometry/geometry-detector.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { TooltipManager } from '../../A1_core/tooltip-manager.js';
import { isExcludedFromProduction } from '../../S4_sciany/smartwall-types.js';
import { Mach3Postprocessor } from '../postprocessors/mach3-postprocessor.js';
import { FanucPostprocessor } from '../postprocessors/fanuc-postprocessor.js';
import { BiessePostprocessor } from '../postprocessors/biesse-postprocessor.js';
import { WoodWOPPostprocessor } from '../postprocessors/woodwop-postprocessor.js';
import { SCMPostprocessor } from '../postprocessors/scm-postprocessor.js';
import { CAMFeature, ContourFeature, Tool } from '../dto/cam-dto.js';
import { CAMVisualizer } from '../visualization/cam-visualizer.js';
import { CNCSimulator } from '../visualization/cnc-simulator.js';
import { WcsRulesMapper, cornerIndexToOriginCorner } from '../wcs/wcs-rules-mapper.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

import { CAMStateStore, CNCProgramState } from '../core/cam-state-store.js';
import { CNCEngine } from '../core/cnc-engine.js';
import { buildDefaultCncProgramForPanel } from '../core/cam-auto-program.js';
import { CreateCncProgramCommand } from '../commands/create-cnc-program-command.js';
import { RemoveCncProgramCommand } from '../commands/remove-cnc-program-command.js';
import { UpdateCncProgramCommand } from '../commands/update-cnc-program-command.js';
import { executeCncCommand } from '../commands/execute-with-history.js';
import { applyProgramActivation } from './cnc-program-activation.js';
import { applyFeatureEdit } from './cnc-feature-edit.js';
import { persistProgramInPanel, recalculateProgramWcsOrThrow } from './cnc-program-persistence.js';
import type { Command } from '../../A1_core/commands/command.js';
import { DrillingStrategy } from '../strategies/drilling-strategy.js';
import { ProfilingStrategy } from '../strategies/profiling-strategy.js';
import { PocketingStrategy } from '../strategies/pocketing-strategy.js';
import { GCodeTab, resolvePostprocessor } from './tabs/GCodeTab.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import { useLocale } from '../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import cncTekstRaw from '../cnc_tekst.json';

const cncTekst = cncTekstRaw as unknown as ModuleTexts;
const TX_NS = 'cnc';

declare const BABYLON: any;

// Helper do bezpiecznego konwertowania wymiarów formatki z nanometrów (nm) na milimetry (mm)
export const getPanelDimensionsMM = (panel: any) => {
    if (!panel) {
        throw new Error('[C1_cnc/CncPanel] Brak referencji do wybranej formatki (panel is null).');
    }
    if (typeof panel.width !== 'number' || !Number.isFinite(panel.width) || panel.width <= 0 ||
        typeof panel.height !== 'number' || !Number.isFinite(panel.height) || panel.height <= 0 ||
        typeof panel.thickness !== 'number' || !Number.isFinite(panel.thickness) || panel.thickness <= 0) {
        throw new Error(`[C1_cnc/CncPanel] Formatka "${panel.id}" nie posiada poprawnych wymiarów fizycznych (W=${panel.width}, H=${panel.height}, T=${panel.thickness}).`);
    }
    return {
        width: nmToMm(panel.width),
        height: nmToMm(panel.height),
        thickness: nmToMm(panel.thickness)
    };
};

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

interface CncPanelProps {
    activePanel?: any;
    scene?: any;
    onClose?: () => void;
    isEmbedded?: boolean;
}

interface CNCProgram {
    id: string;
    name: string;
    targetPanel: any; // Na sztywno przypisana instancja PanelModel
    targetPanelId?: string;
    targetPanelLabel?: string;
    wcsName: string;
    cornerIndex: number;
    wcsOffsetX?: number;
    wcsOffsetY?: number;
    wcsOffsetZ?: number;
    wcsRotX?: number;
    wcsRotY?: number;
    wcsRotZ?: number;
    postprocessor: string;
    strategyId?: string;
    features?: CAMFeature[];
    projectName?: string;
    isActive: boolean;
}

type SubTab = 'wcs' | 'tool' | 'operation' | 'simulate' | 'generate';

export const CncPanel: React.FC<CncPanelProps> = ({ activePanel, scene, onClose, isEmbedded = false }) => {
    // Subskrypcja do globalnego stanu (Zamiast dziesiątek useState)
    const store = CAMStateStore.getInstance();
    const [storeState, setStoreState] = useState(() => store.getState());
    useLocale();

    useEffect(() => {
        const unsubscribe = store.subscribe(setStoreState);
        return () => unsubscribe();
    }, [store]);

    const programs = storeState.programs;
    const activeProgramId = storeState.activeProgramId;
    const currentProgram = store.getActiveProgram();
    const features = currentProgram ? currentProgram.features : [];

    const activeSubTab = storeState.activeSubTab;

    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [showProjectSettings, setShowProjectSettings] = useState(false);
    const [showWcsLayoutEdit, setShowWcsLayoutEdit] = useState(false);
    const [projectPath, setProjectPath] = useState('//');
    const [isSelectingProfile, setIsSelectingProfile] = useState<boolean>(false);
    const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
    const [tempFeatureEdit, setTempFeatureEdit] = useState<any>(null);
    const [isPickingWcsCorner, setIsPickingWcsCorner] = useState<boolean>(false);
    const [toolsList, setToolsList] = useState<Tool[]>([]);
    const [gcodeOutput, setGcodeOutput] = useState<string>('');
    const [selectedSegmentCount, setSelectedSegmentCount] = useState<number>(0);
    const [hoveredFeatureIdx, setHoveredFeatureIdx] = useState<number | null>(null);
    const [pinnedPreviewIdx, setPinnedPreviewIdx] = useState<number | null>(null);

    // Identyfikatorem edytowanej operacji jest featureId; indeks wyliczamy
    // z aktualnej listy, żeby zmiana kolejności nie podmieniła innej cechy.
    const editingFeatureIndex = editingFeatureId === null
        ? -1
        : features.findIndex((f: any) => f.featureId === editingFeatureId);

    useEffect(() => {
        if (editingFeatureId !== null && editingFeatureIndex < 0) {
            setEditingFeatureId(null);
            setTempFeatureEdit(null);
        }
    }, [editingFeatureId, editingFeatureIndex]);

    const isSelectingProfileRef = useRef(false);
    useEffect(() => {
        isSelectingProfileRef.current = isSelectingProfile;
    }, [isSelectingProfile]);

    const activeProgIdRef = useRef(activeProgramId);
    const activeProgramIdRef = activeProgIdRef;
    activeProgIdRef.current = activeProgramId;

    const isPickingWcsCornerRef = useRef(isPickingWcsCorner);
    isPickingWcsCornerRef.current = isPickingWcsCorner;

    // Pobieranie wartości z aktywnego programu (bezpieczne defaulty)
    const wcsName = currentProgram?.wcsName || 'G55';
    const cornerIndex = typeof currentProgram?.cornerIndex === 'number' ? currentProgram.cornerIndex : -1;
    const wcsOffsetX = currentProgram?.wcsOffsetX || 0;
    const wcsOffsetY = currentProgram?.wcsOffsetY || 0;
    const wcsOffsetZ = currentProgram?.wcsOffsetZ || 0;
    const wcsRotX = currentProgram?.wcsRotX || 0;
    const wcsRotY = currentProgram?.wcsRotY || 0;
    const wcsRotZ = currentProgram?.wcsRotZ || 0;
    const projectName = currentProgram?.projectName || 'Program_001';
    const postprocessorName = currentProgram?.postprocessor || 'Mach3';

    // Sprawdzanie czy zaznaczona w drzewie formatka jest prawidłowym pojedynczym panelem
    const effectiveActivePanel = activePanel || ContextManager.instance.activePanel || ContextManager.instance.selectedPanel || (ContextManager.instance.panelViews && ContextManager.instance.panelViews.keys().next().value);
    const isValidFormatka = Boolean(
        effectiveActivePanel
        && effectiveActivePanel.type !== 'container'
        && !isExcludedFromProduction(effectiveActivePanel),
    );
    
    // Formatka docelowa dla wybranego programu CNC jest ZABLOKOWANA na przypisanym obiekcie!
    const lockedPanel = currentProgram ? currentProgram.targetPanel : (isValidFormatka ? effectiveActivePanel : null);
    const defPanelName = tx(cncTekst, 'extractor.panel_default', TX_NS);
    const effectiveTargetPanel = lockedPanel || (isValidFormatka ? effectiveActivePanel : null);
    const targetPanelLabel = effectiveTargetPanel?.name || currentProgram?.targetPanelLabel || (isValidFormatka && activePanel?.name) || null;
    const panelName = lockedPanel ? (lockedPanel.name || defPanelName) : (isValidFormatka && activePanel ? (activePanel.name || defPanelName) : null);

    let panelDimsFormatted = '';
    if (effectiveTargetPanel && typeof effectiveTargetPanel.width === 'number' && effectiveTargetPanel.width > 0) {
        try {
            const w = Math.round(nmToMm(effectiveTargetPanel.width) * 10) / 10;
            const h = Math.round(nmToMm(effectiveTargetPanel.height) * 10) / 10;
            const t = Math.round(nmToMm(effectiveTargetPanel.thickness) * 10) / 10;
            panelDimsFormatted = `${w} × ${h} × ${t} mm`;
        } catch {
            // ignore
        }
    }

    const updateProg = useCallback((updaterOrUpdates: Partial<CNCProgramState> | ((p: CNCProgramState) => CNCProgramState)) => {
        if (!activeProgIdRef.current) return;
        try {
            store.updateActiveProgram(p => {
                const draft = typeof updaterOrUpdates === 'function' ? updaterOrUpdates(p) : { ...p, ...updaterOrUpdates };
                const persistPanel = lockedPanel || effectiveActivePanel;
                const engine = CNCEngine.getInstance();
                const updated = recalculateProgramWcsOrThrow(p, draft, persistPanel, engine.wcsManager);

                // Zapisujemy do formatki docelowej programu (a nie tylko do aktualnie
                // zaznaczonej w drzewie), żeby edycja trafiła do PanelModel.toJSON().
                persistProgramInPanel(persistPanel, updated);
                return updated;
            });
            if (ContextManager.instance.document) {
                ContextManager.instance.document.notifyDocumentChanged();
            }
        } catch (error) {
            console.error('[CncPanel] Błąd aktualizacji bazy WCS programu:', error);
            setWarningMessage(error instanceof Error ? error.message : String(error));
        }
    }, [effectiveActivePanel, lockedPanel, setWarningMessage]);

    // Synchronizacja UI po udanej komendzie: wybieramy program zgodnie z flagą isActive,
    // czyli dokładnie tak samo, jak robi to walidacja zakresu.
    const syncProgramsFromPanel = useCallback((panel: any) => {
        const nextPrograms = Array.isArray(panel?.cncPrograms) ? panel.cncPrograms : [];
        const active = nextPrograms.find((p: any) => p?.isActive);
        // Jedno powiadomienie: lista i aktywne ID zmieniają się atomowo.
        store.setProgramsAndActiveProgram([...nextPrograms], active?.id ?? nextPrograms[0]?.id ?? null);
    }, [store]);

    // Trwałe zmiany programów CNC wymagają historii komend — bez niej nie
    // wykonujemy operacji po cichu, tylko pokazujemy komunikat.
    const runHistoryCommand = useCallback((command: Command): boolean => {
        const history = ContextManager.instance.commandHistory;
        const document = ContextManager.instance.document;
        if (!executeCncCommand(history, document, command)) {
            setWarningMessage(tx(cncTekst, 'warnings.history_unavailable', TX_NS));
            return false;
        }
        setWarningMessage(null);
        return true;
    }, []);

    // Wspólna ścieżka tworzenia programu: zawsze przez komendę historii (Undo/Redo).
    const executeCreateProgram = useCallback((targetPanel: any, newProg: CNCProgramState): boolean => {
        const command = new CreateCncProgramCommand(targetPanel, newProg, {
            onProgramsChanged: syncProgramsFromPanel
        });
        return runHistoryCommand(command);
    }, [runHistoryCommand, syncProgramsFromPanel]);

    const executeRemoveProgram = useCallback((targetPanel: any, programId: string): boolean => {
        const command = new RemoveCncProgramCommand(targetPanel, programId, {
            onProgramsChanged: syncProgramsFromPanel
        });
        return runHistoryCommand(command);
    }, [runHistoryCommand, syncProgramsFromPanel]);

    const updateProgramWithHistory = useCallback((
        updater: (program: CNCProgramState) => CNCProgramState,
    ): boolean => {
        const activeProgram = store.getActiveProgram();
        if (!activeProgram) return false;
        const targetPanel = activeProgram.targetPanel || lockedPanel || effectiveActivePanel;
        const storedProgram = targetPanel?.cncPrograms?.find((program: any) => program?.id === activeProgram.id);
        const before = storedProgram || activeProgram;
        const draft = { ...before };
        const after = updater(draft);
        if (after === draft) return true;
        const command = new UpdateCncProgramCommand(targetPanel, before, after, {
            onProgramsChanged: syncProgramsFromPanel
        });
        return runHistoryCommand(command);
    }, [store, lockedPanel, effectiveActivePanel, runHistoryCommand, syncProgramsFromPanel]);

    // ─── INICJALIZACJA GLOBALNEGO SILNIKA 3D ─────────────────────────
    useEffect(() => {
        const engine = CNCEngine.getInstance();
        const effectiveScene = scene || ContextManager.instance.babylonScene || ContextManager.instance.viewport?.scene;
        if (effectiveScene) {
            engine.initializeIfNeeded(effectiveScene);
        }
        setToolsList(engine.toolLibrary.getAllTools());
    }, [scene]);

    // Synchronizacja programu CNC z zaznaczoną w drzewie formatką (panel.cncPrograms)
    useEffect(() => {
        if (!effectiveActivePanel || effectiveActivePanel.type === 'container') return;

        const panelProgs = Array.isArray(effectiveActivePanel.cncPrograms) ? effectiveActivePanel.cncPrograms : [];
        // Jeśli formatka posiada cechy obróbcze (otwory/wpusty), a nie ma jeszcze programu, utwórz go automatycznie!
        if (panelProgs.length === 0 && effectiveActivePanel.features && effectiveActivePanel.features.length > 0) {
            const autoProg = buildDefaultCncProgramForPanel(effectiveActivePanel);
            if (autoProg) {
                executeCreateProgram(effectiveActivePanel, autoProg);
            }
        }

        syncProgramsFromPanel(effectiveActivePanel);
    }, [effectiveActivePanel, executeCreateProgram, syncProgramsFromPanel]);

    // Ukrywanie gizmo przesuwania CAD podczas pracy w module CNC
    useEffect(() => {
        if (ContextManager.instance.hideGizmos) {
            ContextManager.instance.hideGizmos();
        }
        return () => {
            if (ContextManager.instance.showGizmos) {
                ContextManager.instance.showGizmos();
            }
        };
    }, []);





    // Zatwierdzanie profilu krawędzi wywoływane przez SelectProfileTool
    const handleConfirmProfileFromTool = useCallback((chainedPoints: {x: number, y: number, z: number}[]) => {
        // Konwersja punktów krawędzi z przestrzeni lokalnej formatki do przestrzeni WCS
        const wcsPoints = chainedPoints.map(p => {
            const engine = CNCEngine.getInstance();
            if (engine.wcsManager) {
                return engine.wcsManager.toWcsCoordinates(p);
            }
            return p;
        });

        // Wyliczenie pozycji Z zaznaczonej krawędzi w układzie WCS (zaokrąglone do 2 miejsc po przecinku)
        const initialZ = wcsPoints.length > 0 ? Math.round(wcsPoints[0].z * 100) / 100 : 0;

        const newContourFeat: ContourFeature = {
            featureId: `contour_${Date.now()}`,
            name: tx(cncTekst, 'feature.default_profile', TX_NS, { n: features.length + 1 }),
            points: wcsPoints,
            panelPoints: chainedPoints.map(p => ({ ...p })),
            depth: initialZ,
            objectName: panelName || 'Formatka',
            compensation: 'Center',
            leadIn: 5,
            leadOut: 5
        };

        // Zapis w CAMStateStore
        updateProgramWithHistory(p => ({ ...p, features: [...p.features, newContourFeat] }));

        setIsSelectingProfile(false);
        setSelectedSegmentCount(0);
    }, [features, panelName, updateProgramWithHistory]);

    // Otwarcie narzędzia do profilu (przycisk w UI)
    const handleStartSelectProfile = useCallback(() => {
        const api = ContextManager.instance.appAPI;
        if (api && api.stateMachine) {
            const tool = api.stateMachine.getState('SELECT_PROFILE_TOOL') as any;
            if (tool) {
                tool.onProfileConfirmed = handleConfirmProfileFromTool;
                tool.onStateActive = (isActive: boolean, count: number) => {
                    setIsSelectingProfile(isActive);
                    setSelectedSegmentCount(count);
                };
                api.stateMachine.changeState('SELECT_PROFILE_TOOL');
            }
        }
    }, [handleConfirmProfileFromTool]);

    // Anulowanie z poziomu przycisku w UI (SelectProfileTool zareaguje)
    const handleCancelProfile = useCallback(() => {
        const api = ContextManager.instance.appAPI;
        if (api && api.stateMachine) {
            const tool = api.stateMachine.getState('SELECT_PROFILE_TOOL') as any;
            if (tool) tool.forceCancel();
        }
    }, []);

    // Zatwierdzanie z poziomu przycisku w UI
    const handleConfirmProfileUI = useCallback(() => {
        const api = ContextManager.instance.appAPI;
        if (api && api.stateMachine) {
            const tool = api.stateMachine.getState('SELECT_PROFILE_TOOL') as any;
            if (tool) tool.forceConfirm();
        }
    }, []);

    // Słuchanie zdarzeń interaktywnego klikania geometrii myszą w 3D (Wykrywanie Naroży / Ścian dla WCS i Krawędzi Profilu)
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        let cancelled = false;

        const attach = (attempt = 0) => {
            if (cancelled) return;
            const facePicker = ContextManager.instance.facePicker;
            if (!facePicker) {
                if (attempt < 40) setTimeout(() => attach(attempt + 1), 50);
                return;
            }
            unsubscribe = facePicker.onPick((type: string, data: any) => {
                if (type !== 'select-vertex') return;
                if (!isPickingWcsCornerRef.current) return;
                const idx = data?.cornerIndex;
                if (typeof idx !== 'number' || idx < 0) return;

                setIsPickingWcsCorner(false);
                if (!activeProgramIdRef.current) return;
                // updateProg synchronizuje store + panel.cncPrograms (sam updateActiveProgram gubił naroże)
                updateProg({ cornerIndex: idx });
            });
        };
        attach();

        return () => {
            cancelled = true;
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [updateProg]);

    useEffect(() => {
        const facePicker = ContextManager.instance.facePicker;
        if (!facePicker) return;
        if (isPickingWcsCorner) {
            facePicker.selectionMode = 'subgeometry';
            facePicker.targetSubgeometryType = 'vertex';
            facePicker.setVertexPickPreview?.(true);
        } else {
            if (facePicker.targetSubgeometryType === 'vertex') {
                facePicker.targetSubgeometryType = null;
            }
            facePicker.setVertexPickPreview?.(false);
        }
        return () => {
            if (facePicker.targetSubgeometryType === 'vertex') {
                facePicker.targetSubgeometryType = null;
            }
            facePicker.setVertexPickPreview?.(false);
        };
    }, [isPickingWcsCorner]);

    const moveFeature = useCallback((index: number, direction: number) => {
        updateProgramWithHistory(p => {
            const newFeatures = [...p.features];
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= newFeatures.length) return p;
            
            const temp = newFeatures[index];
            newFeatures[index] = newFeatures[targetIndex];
            newFeatures[targetIndex] = temp;
            return { ...p, features: newFeatures };
        });
    }, [updateProgramWithHistory]);

    const updateFeatureTool = useCallback((index: number, toolId: string) => {
        updateProgramWithHistory(p => {
            const targetFeat = p.features[index];
            if (!targetFeat) return p;
            const currentAssigned = targetFeat.toolId || (targetFeat.featureId ? p.toolAssignments?.[targetFeat.featureId] : undefined) || '';
            if (currentAssigned === toolId && targetFeat.toolId === toolId) return p;
            const newFeatures = [...p.features];
            newFeatures[index] = { ...targetFeat, toolId };
            const nextAssignments = { ...(p.toolAssignments || {}) };
            if (targetFeat.featureId) {
                if (toolId) {
                    nextAssignments[targetFeat.featureId] = toolId;
                } else {
                    delete nextAssignments[targetFeat.featureId];
                }
            }
            return { ...p, features: newFeatures, toolAssignments: nextAssignments };
        });
    }, [updateProgramWithHistory]);

    const deleteFeature = useCallback((index: number) => {
        const succeeded = updateProgramWithHistory(p => {
            if (index < 0 || index >= p.features.length) return p;
            const deletedFeatureId = p.features[index]?.featureId;
            const newFeatures = [...p.features];
            newFeatures.splice(index, 1);
            const nextAssignments = { ...(p.toolAssignments || {}) };
            if (deletedFeatureId) {
                delete nextAssignments[deletedFeatureId];
            }
            return { ...p, features: newFeatures, toolAssignments: nextAssignments };
        });
        if (succeeded && pinnedPreviewIdx === index) {
            setPinnedPreviewIdx(null);
            CNCEngine.getInstance().visualizer?.clearHighlight();
        }
    }, [pinnedPreviewIdx, updateProgramWithHistory]);

    const resolveCurrentPanelView = useCallback(() => {
        const pvs = ContextManager.instance.panelViews as Map<any, any> | undefined;
        if (!pvs || pvs.size === 0) return null;
        if (lockedPanel && pvs.has(lockedPanel)) return pvs.get(lockedPanel);
        if (lockedPanel) {
            for (const [p, v] of pvs.entries()) {
                if (p === lockedPanel || (p?.id && lockedPanel?.id && p.id === lockedPanel.id)) {
                    return v;
                }
            }
        }
        const act = ContextManager.instance.activePanel || ContextManager.instance.selectedPanel;
        if (act && pvs.has(act)) return pvs.get(act);
        if (act) {
            for (const [p, v] of pvs.entries()) {
                if (p === act || (p?.id && act?.id && p.id === act.id)) {
                    return v;
                }
            }
        }
        return pvs.values().next().value || null;
    }, [lockedPanel]);

    const handleFeatureHover = useCallback((feat: any, idx: number) => {
        setHoveredFeatureIdx(idx);
        const engine = CNCEngine.getInstance();
        const view = resolveCurrentPanelView();
        let handled = false;
        if (view && typeof view.highlightFeature === 'function') {
            handled = Boolean(view.highlightFeature(feat, true));
        }
        if (!handled) {
            engine.visualizer?.highlightFeature(feat, view?.root || null);
        } else {
            engine.visualizer?.clearHighlight();
        }
    }, [resolveCurrentPanelView]);

    const handleFeatureLeave = useCallback((_idx: number) => {
        setHoveredFeatureIdx(null);
        const engine = CNCEngine.getInstance();
        const view = resolveCurrentPanelView();
        if (view && typeof view.clearFeatureHighlights === 'function') {
            view.clearFeatureHighlights();
        }
        if (pinnedPreviewIdx !== null) {
            const pinnedFeat = features[pinnedPreviewIdx];
            if (pinnedFeat) {
                let handled = false;
                if (view && typeof view.highlightFeature === 'function') {
                    handled = Boolean(view.highlightFeature(pinnedFeat, true));
                }
                if (!handled) {
                    engine.visualizer?.highlightFeature(pinnedFeat, view?.root || null);
                } else {
                    engine.visualizer?.clearHighlight();
                }
                return;
            }
        }
        engine.visualizer?.clearHighlight();
    }, [pinnedPreviewIdx, features, resolveCurrentPanelView]);

    const handleTogglePinFeature = useCallback((feat: any, idx: number) => {
        const engine = CNCEngine.getInstance();
        const view = resolveCurrentPanelView();

        if (pinnedPreviewIdx === idx) {
            setPinnedPreviewIdx(null);
            if (view && typeof view.clearFeatureHighlights === 'function') {
                view.clearFeatureHighlights();
            }
            engine.visualizer?.clearHighlight();
        } else {
            setPinnedPreviewIdx(idx);
            if (view && typeof view.clearFeatureHighlights === 'function') {
                view.clearFeatureHighlights();
            }
            let handled = false;
            if (view && typeof view.highlightFeature === 'function') {
                handled = Boolean(view.highlightFeature(feat, true));
            }
            if (!handled) {
                engine.visualizer?.highlightFeature(feat, view?.root || null);
            } else {
                engine.visualizer?.clearHighlight();
            }
        }
    }, [pinnedPreviewIdx, resolveCurrentPanelView]);

    // Helper: scala nowe cechy z istniejącymi (deduplikacja po featureId, zachowuje ręczne profile)
    const mergeExtractedFeatures = useCallback((
        existing: CAMFeature[],
        incoming: CAMFeature[]
    ): CAMFeature[] => {
        const result = [...existing];
        for (const feat of incoming) {
            const idx = result.findIndex(f => f.featureId === feat.featureId);
            if (idx !== -1) {
                result[idx] = feat; // aktualizuj istniejącą
            } else {
                result.push(feat); // dodaj nową
            }
        }
        return result;
    }, []);

    // Wykrywanie tylko otworów
    const handleDetectHoles = useCallback(() => {
        if (!lockedPanel) return;
        const engine = CNCEngine.getInstance();
        const res = engine.geometryExtractor.extractPanelFeatures(lockedPanel, engine.wcsManager, 'hole');
        const extracted = res?.features ?? [];
        updateProgramWithHistory(p => ({ ...p, features: mergeExtractedFeatures(p.features, extracted) }));
    }, [lockedPanel, mergeExtractedFeatures, updateProgramWithHistory]);

    // Wykrywanie tylko wpustów
    const handleDetectGrooves = useCallback(() => {
        if (!lockedPanel) return;
        const engine = CNCEngine.getInstance();
        const res = engine.geometryExtractor.extractPanelFeatures(lockedPanel, engine.wcsManager, 'groove');
        const extracted = res?.features ?? [];
        updateProgramWithHistory(p => ({ ...p, features: mergeExtractedFeatures(p.features, extracted) }));
    }, [lockedPanel, mergeExtractedFeatures, updateProgramWithHistory]);

    // Automatyczne ustawianie celności kamery (Camera Pivot Target) na wybraną formatkę
    const focusCameraOnFormatka = useCallback(() => {
        if (!lockedPanel) return;
        const panelViews = ContextManager.instance.panelViews as Map<any, any> | undefined;
        let view: any = null;
        if (panelViews) view = panelViews.get(lockedPanel);

        if (view && view.root && ContextManager.instance.viewport?.scene?.activeCamera) {
            const bbox = view.root.getHierarchyBoundingVectors();
            const center = bbox.max.add(bbox.min).scale(0.5);
            ContextManager.instance.viewport.scene.activeCamera.setTarget(center);
        }
    }, [lockedPanel]);

    // Tworzenie nowego programu CNC przypisanego na sztywno do aktywnej formatki
    const handleCreateProgramForFormatka = () => {
        if (!isValidFormatka || !effectiveActivePanel) {
            setWarningMessage(tx(cncTekst, 'warnings.pick_single_panel', TX_NS));
            return;
        }

        setWarningMessage(null);
        const targetPanel = effectiveActivePanel;
        const existingCount = Array.isArray(targetPanel.cncPrograms) ? targetPanel.cncPrograms.length : 0;

        const tName = targetPanel.name || tx(cncTekst, 'extractor.panel_default', TX_NS);
        const progName = `Program_${tName}_${existingCount + 1}`;
        const newId = `prog_${Date.now()}`;
        const defaultProg = buildDefaultCncProgramForPanel(targetPanel);
        const newProg: CNCProgramState = {
            id: newId,
            name: progName,
            targetPanel: targetPanel,
            targetPanelId: String(targetPanel.id || ''),
            targetPanelLabel: tName,
            wcsName: 'G55',
            // -1 = origin z JSON roli (korpus3_3_rules); >=0 dopiero po picku naroża w 3D
            cornerIndex: -1,
            postprocessor: 'Mach3',
            isActive: true,
            features: defaultProg?.features || [],
            toolAssignments: defaultProg?.toolAssignments || {}
        };

        executeCreateProgram(targetPanel, newProg);
    };

    const handleActivateProgram = (id: string) => {
        // Utrzymujemy jeden aktywny program także w danych formatki,
        // żeby walidacja zakresu i stan UI wskazywały ten sam program.
        if (Array.isArray(effectiveActivePanel?.cncPrograms)) {
            for (const prog of effectiveActivePanel.cncPrograms) {
                prog.isActive = prog.id === id;
            }
            // Lista i aktywne ID w jednej atomowej aktualizacji store'u.
            store.setProgramsAndActiveProgram([...effectiveActivePanel.cncPrograms], id);
        } else {
            store.setActiveProgramId(id);
        }
        activeProgIdRef.current = id;
        const p = programs.find(x => x.id === id);
        if (p) {
            // Jedno wywołanie = jedna spójna rewizja dokumentu.
            applyProgramActivation(updateProg, p);
        }
    };

    const handleDeleteProgram = (id: string) => {
        if (!effectiveActivePanel) return;
        executeRemoveProgram(effectiveActivePanel, id);
    };

    // Generowanie kodu NC z procesora
    const handleGenerateGCode = () => {
        if (!lockedPanel) return;

        if (lockedPanel.frozen === true || lockedPanel.params?.frozen === true) {
            setWarningMessage(tx(cncTekst, 'warnings.panel_frozen_code', TX_NS));
            return;
        }

        const engine = CNCEngine.getInstance();
        const toolAssignments = currentProgram?.toolAssignments || {};
        const preparedFeatures = features.map(f => {
            const assignedId = f.toolId || (f.featureId ? toolAssignments[f.featureId] : undefined) || null;
            return assignedId && f.toolId !== assignedId ? { ...f, toolId: assignedId } : f;
        });

        // Sprawdź czy są operacje bez przypisanego narzędzia
        const missingToolFeats = preparedFeatures.filter(
            f => !f.toolId || !engine.toolLibrary.getTool(f.toolId)
        );
        if (missingToolFeats.length > 0) {
            setWarningMessage(tx(cncTekst, 'warnings.no_tool_code', TX_NS, { n: missingToolFeats.length }));
            return;
        }

        setWarningMessage(null);
        store.setWarningMessage(null);

        const dims = getPanelDimensionsMM(lockedPanel);
        engine.wcsManager.updateForPanelDimensions(dims.width, dims.height, dims.thickness);

        const program = engine.camProcessor.buildCLProgram({
            projectName: projectName,
            wcsOrigin: engine.wcsManager.getOrigin(),
            wcsName: wcsName,
            features: preparedFeatures,
            toolAssignments: toolAssignments,
            postprocessor: postprocessorName,
            strategyId: currentProgram?.strategyId,
            strategyParams: currentProgram?.strategyParams,
            workpieceDimensions: dims
        });

        const post = resolvePostprocessor(postprocessorName);

        const nc = post.generateNcCode(program);
        setGcodeOutput(nc);
    };

    // Kontrola Symulacji 3D
    const handleStartSim = () => {
        const engine = CNCEngine.getInstance();
        if (!engine.simulator || !lockedPanel) return;

        if (lockedPanel.frozen === true || lockedPanel.params?.frozen === true) {
            setWarningMessage(tx(cncTekst, 'warnings.panel_frozen_sim', TX_NS));
            return;
        }

        const toolAssignments = currentProgram?.toolAssignments || {};
        const preparedFeatures = features.map(f => {
            const assignedId = f.toolId || (f.featureId ? toolAssignments[f.featureId] : undefined) || null;
            return assignedId && f.toolId !== assignedId ? { ...f, toolId: assignedId } : f;
        });

        // Sprawdź czy są operacje bez przypisanego narzędzia
        const missingToolFeats = preparedFeatures.filter(
            f => !f.toolId || !engine.toolLibrary.getTool(f.toolId)
        );
        if (missingToolFeats.length > 0) {
            setWarningMessage(tx(cncTekst, 'warnings.no_tool_sim', TX_NS, { n: missingToolFeats.length }));
            return;
        }

        setWarningMessage(null);
        store.setWarningMessage(null);

        engine.startSimulation(storeState.simulationSpeed, lockedPanel);
    };

    const handlePauseSim = () => {
        CNCEngine.getInstance().pauseSimulation();
    };

    const handleStopSim = () => {
        CNCEngine.getInstance().stopSimulation();
    };



    const saveFeatureEdit = () => {
        if (editingFeatureId === null || !tempFeatureEdit) return;
        // Edycja pojedynczej cechy trafia do dokumentu i historii Undo/Redo.
        let updated = false;
        applyFeatureEdit(updater => {
            updated = updateProgramWithHistory(updater);
        }, editingFeatureId, tempFeatureEdit);
        if (!updated) return;
        setEditingFeatureId(null);
        setTempFeatureEdit(null);
    };
    

    const b = {
        bg: '#222225',
        panelBg: '#18181b',
        border: '#2d2d30',
        text: '#d4d4d8',
        subText: '#a1a1aa',
        accentBlue: '#3b82f6',
        accentGreen: '#16a34a',
        accentYellow: '#facc15'
    };

    return (
        <div
            className={isEmbedded ? 'cnc-panel-embedded' : undefined}
            style={isEmbedded ? {
                width: '100%',
                height: '100%',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
            } : {
                background: b.panelBg,
                border: `1px solid ${b.border}`,
                color: b.text,
                borderRadius: '6px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                width: '360px',
                fontFamily: 'sans-serif',
                fontSize: '12px',
                overflow: 'hidden',
            }}
        >
            {!isEmbedded && (
                <div style={{ background: '#27272a', padding: '8px 12px', borderBottom: `1px solid ${b.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: b.accentBlue }}>{tx(cncTekst, 'panel.title', TX_NS)}</span>
                    {onClose && (
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                    )}
                </div>
            )}

            <div
                className={isEmbedded ? 'panel-section cnc-panel-body' : undefined}
                style={isEmbedded ? {
                    padding: '12px 16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    flex: 1,
                    borderBottom: 'none',
                } : {
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    background: '#3b3e40',
                }}
            >
                {/* Wyraźny nagłówek aktywnej formatki CNC */}
                <div
                    style={{
                        background: effectiveTargetPanel
                            ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.45), rgba(15, 23, 42, 0.75))'
                            : 'rgba(39, 39, 42, 0.6)',
                        border: effectiveTargetPanel ? '1px solid #3b82f6' : '1px dashed #64748b',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: effectiveTargetPanel ? '0 2px 10px rgba(59, 130, 246, 0.25)' : 'none',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>🪵</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Formatka CNC
                            </span>
                        </div>
                        {panelDimsFormatted && (
                            <span style={{ fontSize: '11px', color: '#cbd5e1', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 600 }}>
                                {panelDimsFormatted}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Nazwa:</span>
                        <span style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: effectiveTargetPanel ? '#38bdf8' : '#f87171',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            letterSpacing: '0.01em',
                        }}>
                            {targetPanelLabel || (effectiveTargetPanel ? defPanelName : tx(cncTekst, 'ui.no_target_panel', TX_NS))}
                        </span>
                    </div>
                </div>

                <button
                    type="button"
                    className={isEmbedded ? 'btn btn-primary' : undefined}
                    onClick={handleCreateProgramForFormatka}
                    style={isEmbedded ? {
                        width: '100%',
                        justifyContent: 'center',
                        marginBottom: 4,
                    } : {
                        background: '#444444', color: '#dddddd', border: '1px solid #222222', borderRadius: '4px',
                        padding: '6px', fontSize: '11px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                        cursor: 'pointer', outline: 'none',
                    }}
                >
                    <span style={{ fontSize: '12px' }}>{tx(cncTekst, 'panel.create_program', TX_NS)}</span>
                </button>


                {(storeState.warningMessage || warningMessage) && (
                    <div style={{ background: '#451a1a', border: '1px solid #7f1d1d', color: '#fca5a5', padding: '6px', borderRadius: '3px', fontSize: '11px' }}>
                        ⚠️ {storeState.warningMessage || warningMessage}
                    </div>
                )}

                {/* Ustawienia Projektu (Box) */}
                <div style={{ background: '#333333', border: '1px solid #282828', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                        onClick={() => setShowProjectSettings(!showProjectSettings)}
                        style={{ background: '#383838', padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: showProjectSettings ? '1px solid #282828' : 'none' }}
                    >
                        <span style={{ fontWeight: 600, color: '#eeeeee', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {tx(cncTekst, 'project.title', TX_NS)}
                        </span>
                        <span style={{ fontSize: '8px', color: '#aaaaaa' }}>{showProjectSettings ? '▼' : '▶'}</span>
                    </div>

                    {showProjectSettings && (
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#eeeeee', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                                {tx(cncTekst, 'project.program_params', TX_NS)}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '4px', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', color: '#cccccc' }}>{tx(cncTekst, 'project.name', TX_NS)}</label>
                                <input type="text" value={projectName} onChange={e => { updateProg({ projectName: e.target.value, name: e.target.value }); }} style={{ background: '#222', border: '1px solid #111', color: '#eee', padding: '4px', fontSize: '11px', borderRadius: '2px' }} />
                                
                                <label style={{ fontSize: '11px', color: '#cccccc' }}>Postpr...</label>
                                <select value={postprocessorName} onChange={e => { updateProg({ postprocessor: e.target.value }); }} style={{ background: '#333', border: '1px solid #111', color: '#eee', padding: '4px', fontSize: '11px', borderRadius: '2px' }}>
                                    <option value="Mach3">Mach3</option>
                                    <option value="WoodWOP">WoodWOP</option>
                                    <option value="Biesse">Biesse</option>
                                    <option value="SCM">SCM</option>
                                    <option value="Fanuc">Fanuc</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Lista Programów (Aktywny program) */}
                <div style={{ background: '#333333', border: '1px solid #282828', borderRadius: '4px', padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {programs.length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#aaa', padding: '4px', textAlign: 'center' }}>{tx(cncTekst, 'panel.no_programs', TX_NS)}</div>
                    ) : (
                        programs.map(prog => (
                            <div key={prog.id} style={{ display: 'flex', gap: '4px' }}>
                                <div 
                                    onClick={() => handleActivateProgram(prog.id)}
                                    style={{ display: 'flex', alignItems: 'center', background: activeProgramId === prog.id ? '#4f80bd' : '#444', color: '#fff', flex: 1, borderRadius: '3px', padding: '4px 6px', gap: '6px', border: '1px solid #222', cursor: 'pointer' }}
                                >
                                    <input type="checkbox" checked={activeProgramId === prog.id} readOnly style={{ accentColor: '#4f80bd', margin: 0 }} />
                                    <span style={{ fontSize: '11px', flex: 1, textAlign: 'left' }}>{prog.name} ({prog.targetPanelLabel || prog.targetPanelId || ''})</span>
                                </div>
                                <button 
onClick={() => handleDeleteProgram(prog.id)}
style={{ background: '#444', border: '1px solid #222', borderRadius: '3px', padding: '4px 8px', color: '#eee', cursor: 'pointer', fontSize: '11px' }}
title={tx(cncTekst, 'panel.delete', TX_NS)}
>
{tx(cncTekst, 'panel.delete', TX_NS)}
</button>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ fontSize: '11px', color: '#eeeeee', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚙️ Edycja: {programs.find(p => p.id === activeProgramId)?.name || 'Brak'}
                </div>

                {/* OSTRZEŻENIE O ZAMROŻENIU FORMATKI */}
                {lockedPanel && (lockedPanel.frozen === true || lockedPanel.params?.frozen === true) && (
                    <div style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        color: '#7dd3fc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span>❄️</span>
                        <span><strong>{tx(cncTekst, 'panel.frozen_title', TX_NS)}</strong> {tx(cncTekst, 'panel.frozen_body', TX_NS)}</span>
                    </div>
                )}

                {/* TAB GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: 'auto auto', gap: '1px', background: '#222', border: '1px solid #222', borderRadius: '3px', overflow: 'hidden' }}>
                    <button onClick={() => store.setActiveSubTab('wcs')} style={{ gridColumn: '1 / 2', gridRow: '1', background: activeSubTab === 'wcs' ? '#4f80bd' : '#444', color: '#fff', border: 'none', padding: '4px', fontSize: '11px', cursor: 'pointer' }}>{tx(cncTekst, 'tabs.wcs', TX_NS)}</button>
                    <button onClick={() => store.setActiveSubTab('tool')} style={{ gridColumn: '2 / 3', gridRow: '1', background: activeSubTab === 'tool' ? '#4f80bd' : '#444', color: '#fff', border: 'none', padding: '4px', fontSize: '11px', cursor: 'pointer' }}>{tx(cncTekst, 'tabs.tool', TX_NS)}</button>
                    <button onClick={() => store.setActiveSubTab('operation')} style={{ gridColumn: '3 / 4', gridRow: '1', background: activeSubTab === 'operation' ? '#4f80bd' : '#444', color: '#fff', border: 'none', padding: '4px', fontSize: '11px', cursor: 'pointer' }}>{tx(cncTekst, 'tabs.operation', TX_NS)}</button>
                    
                    <button onClick={() => store.setActiveSubTab('simulate')} style={{ gridColumn: '1 / 3', gridRow: '2', background: activeSubTab === 'simulate' ? '#4f80bd' : '#444', color: '#fff', border: 'none', padding: '4px', fontSize: '11px', cursor: 'pointer' }}>{tx(cncTekst, 'tabs.simulate', TX_NS)}</button>
                    <button onClick={() => store.setActiveSubTab('generate')} style={{ gridColumn: '3 / 4', gridRow: '2', background: activeSubTab === 'generate' ? '#4f80bd' : '#444', color: '#fff', border: 'none', padding: '4px', fontSize: '11px', cursor: 'pointer' }}>{tx(cncTekst, 'tabs.generate', TX_NS)}</button>
                </div>

                {/* TAB CONTENT */}
                <div style={{ background: '#333333', border: '1px solid #282828', borderRadius: '4px', display: 'flex', flexDirection: 'column' }}>
                    
                    {/* WCS TAB */}
                    {activeSubTab === 'wcs' && (
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#eeeeee', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                                📍 Konfiguracja WCS
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '6px', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', color: '#cccccc' }}>{tx(cncTekst, 'wcs.name', TX_NS)}</label>
                                <select
                                    value={wcsName}
                                    onChange={e => { updateProg({ wcsName: e.target.value }); }}
                                    style={{
                                        background: 'rgba(0,0,0,0.4)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#f8fafc',
                                        padding: '6px 8px',
                                        fontSize: '11px',
                                        borderRadius: '6px',
                                    }}
                                >
                                    <option value="G54">G54</option>
                                    <option value="G55">G55</option>
                                    <option value="G56">G56</option>
                                    <option value="G57">G57</option>
                                </select>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setIsPickingWcsCorner(!isPickingWcsCorner)}
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '8px 12px',
                                    background: isPickingWcsCorner ? '#d97706' : undefined,
                                    boxShadow: isPickingWcsCorner ? '0 0 0 2px rgba(217,119,6,0.35)' : undefined,
                                }}
                            >
                                {isPickingWcsCorner ? tx(cncTekst, 'panel.pick_wcs_corner', TX_NS) : tx(cncTekst, 'panel.change_wcs_corner', TX_NS)}
                            </button>

                            <div style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
                                <div
                                    onClick={() => setShowWcsLayoutEdit(!showWcsLayoutEdit)}
                                    style={{
                                        padding: '7px 10px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        background: showWcsLayoutEdit ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
                                        borderBottom: showWcsLayoutEdit ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                    }}
                                >
<span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '11px' }}>
{tx(cncTekst, 'panel.layout_edit', TX_NS)}
</span>
                                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>{showWcsLayoutEdit ? '▼' : '▶'}</span>
                                </div>

                                {showWcsLayoutEdit && (
                                    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <div>
                                                <div style={{ fontSize: '11px', color: '#eee', marginBottom: '4px' }}>{tx(cncTekst, 'panel.position', TX_NS)}</div>
                                                <div style={{ background: '#444', borderRadius: '3px', border: '1px solid #222', overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', padding: '2px 6px', borderBottom: '1px solid #222', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '11px', color: '#ccc', width: '20px' }}>X</span>
                                                        <input type="number" step="1" value={wcsOffsetX} onChange={e => { const val = parseFloat(e.target.value) || 0; updateProg({ wcsOffsetX: val }); }} style={{ background: 'transparent', border: 'none', color: '#eee', fontSize: '11px', textAlign: 'right', width: '40px', outline: 'none' }} />
                                                        <span style={{ fontSize: '11px', color: '#ccc', marginLeft: '4px' }}>mm</span>
                                                    </div>
                                                    <div style={{ display: 'flex', padding: '2px 6px', borderBottom: '1px solid #222', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '11px', color: '#ccc', width: '20px' }}>Y</span>
                                                        <input type="number" step="1" value={wcsOffsetY} onChange={e => { const val = parseFloat(e.target.value) || 0; updateProg({ wcsOffsetY: val }); }} style={{ background: 'transparent', border: 'none', color: '#eee', fontSize: '11px', textAlign: 'right', width: '40px', outline: 'none' }} />
                                                        <span style={{ fontSize: '11px', color: '#ccc', marginLeft: '4px' }}>mm</span>
                                                    </div>
                                                    <div style={{ display: 'flex', padding: '2px 6px', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '11px', color: '#ccc', width: '20px' }}>Z</span>
                                                        <input type="number" step="1" value={wcsOffsetZ} onChange={e => { const val = parseFloat(e.target.value) || 0; updateProg({ wcsOffsetZ: val }); }} style={{ background: 'transparent', border: 'none', color: '#eee', fontSize: '11px', textAlign: 'right', width: '40px', outline: 'none' }} />
                                                        <span style={{ fontSize: '11px', color: '#ccc', marginLeft: '4px' }}>mm</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '11px', color: '#eee', marginBottom: '4px' }}>{tx(cncTekst, 'panel.rotation', TX_NS)}</div>
                                                <div style={{ background: '#444', borderRadius: '3px', border: '1px solid #222', overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', padding: '2px 6px', borderBottom: '1px solid #222', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '11px', color: '#ccc', width: '20px' }}>X</span>
                                                        <input type="number" step="1" value={wcsRotX} onChange={e => { const val = parseFloat(e.target.value) || 0; updateProg({ wcsRotX: val }); }} style={{ background: 'transparent', border: 'none', color: '#eee', fontSize: '11px', textAlign: 'right', width: '40px', outline: 'none' }} />
                                                    </div>
                                                    <div style={{ display: 'flex', padding: '2px 6px', borderBottom: '1px solid #222', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '11px', color: '#ccc', width: '20px' }}>Y</span>
                                                        <input type="number" step="1" value={wcsRotY} onChange={e => { const val = parseFloat(e.target.value) || 0; updateProg({ wcsRotY: val }); }} style={{ background: 'transparent', border: 'none', color: '#eee', fontSize: '11px', textAlign: 'right', width: '40px', outline: 'none' }} />
                                                    </div>
                                                    <div style={{ display: 'flex', padding: '2px 6px', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontSize: '11px', color: '#ccc', width: '20px' }}>Z</span>
                                                        <input type="number" step="1" value={wcsRotZ} onChange={e => { const val = parseFloat(e.target.value) || 0; updateProg({ wcsRotZ: val }); }} style={{ background: 'transparent', border: 'none', color: '#eee', fontSize: '11px', textAlign: 'right', width: '40px', outline: 'none' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TOOL TAB */}
                    {activeSubTab === 'tool' && (
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#eeeeee', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                                {tx(cncTekst, 'panel.tools_library', TX_NS)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '150px', overflowY: 'auto' }}>
                                {toolsList.map(t => (
                                    <div key={t.id} style={{ background: '#222', padding: '4px', border: '1px solid #111', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#eee' }}>
                                        <span>{t.name}</span>
                                        <span style={{ color: '#4ade80' }}>FI {t.diameter}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* OPERATION TAB */}
                    {activeSubTab === 'operation' && (
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#eeeeee', borderBottom: '1px solid #444', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🔧 Operacje Obrobkowe
                            </div>
                            
                            <div style={{ display: 'flex', background: '#444', border: '1px solid #222', borderRadius: '3px', overflow: 'hidden' }}>
                                <button onClick={handleDetectHoles} style={{ flex: 1, background: '#444', color: '#eee', border: 'none', borderRight: '1px solid #222', padding: '4px', fontSize: '11px', cursor: 'pointer', textAlign: 'center' }}>🔍 Wykryj cechy (otwory)</button>
                                <button onClick={handleDetectGrooves} style={{ flex: 1, background: '#444', color: '#eee', border: 'none', borderRight: '1px solid #222', padding: '4px', fontSize: '11px', cursor: 'pointer', textAlign: 'center' }}>🔍 Wykryj cechy (wpusty)</button>
                                <button onClick={handleStartSelectProfile} style={{ flex: 1, background: '#444', color: '#eee', border: 'none', borderRight: '1px solid #222', padding: '4px', fontSize: '11px', cursor: 'pointer', textAlign: 'center' }}>➕ Wybierz profil</button>
                                <button
                                    type="button"
                                    onClick={() => updateProgramWithHistory(p => {
                                        if (p.features.length === 0) return p;
                                        return { ...p, features: [] };
                                    })}
                                    title={tx(cncTekst, 'panel.clear_features', TX_NS) || 'Wyczyść wszystkie operacje'}
                                    style={{ background: '#444', color: '#eee', border: 'none', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            </div>

                            {isSelectingProfile && (
                                <div style={{ background: '#27272a', padding: '6px', borderRadius: '4px', border: '1px solid #d97706', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: '10px', textAlign: 'center' }}>
                                        {tx(cncTekst, 'panel.pick_edges', TX_NS, { n: selectedSegmentCount })}
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button onClick={handleConfirmProfileUI} style={{ flex: 1, padding: '4px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '3px', fontWeight: 700, cursor: 'pointer', fontSize: '10px' }}>{tx(cncTekst, 'panel.confirm', TX_NS)}</button>
                                        <button onClick={handleCancelProfile} style={{ flex: 1, padding: '4px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '3px', fontWeight: 600, cursor: 'pointer', fontSize: '10px' }}>{tx(cncTekst, 'panel.cancel', TX_NS)}</button>
                                    </div>
                                </div>
                            )}

                            <div style={{ fontSize: '11px', color: '#eeeeee', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                {tx(cncTekst, 'panel.operations_order', TX_NS)}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '120px', overflowY: 'auto' }}>
                                {features.length === 0 && (
                                    <div style={{ fontSize: '11px', color: '#eeeeee', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{background: '#fff', color: '#000', width: '12px', height: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '2px', fontSize: '9px', fontWeight: 'bold'}}>i</span>
                                        {tx(cncTekst, 'panel.no_operations', TX_NS)}
                                    </div>
                                )}
                                {features.map((feat, idx) => {
                                    const assignedToolId = feat.toolId || (feat.featureId ? currentProgram?.toolAssignments?.[feat.featureId] : undefined) || '';
                                    const isComplete = !!assignedToolId;
                                    const isHovered = hoveredFeatureIdx === idx;
                                    const isPinned = pinnedPreviewIdx === idx;
                                    const isActiveHighlight = isHovered || isPinned;

                                    let rowBg = '#222';
                                    let rowBorder = '1px solid #111';
                                    if (isActiveHighlight) {
                                        rowBg = '#0c2340';
                                        rowBorder = '1px solid #0284c7';
                                    } else if (isComplete) {
                                        rowBg = '#0f2918';
                                        rowBorder = '1px solid #166534';
                                    }

                                    const indexColor = isActiveHighlight ? '#38bdf8' : (isComplete ? '#4ade80' : '#60a5fa');
                                    const isHole = 'diameter' in feat || (feat as any).type === 'hole';
                                    const isGroove = 'startPoint' in feat || (feat as any).type === 'groove';
                                    const count = (feat as any).holeCount || ((feat as any).positions ? (feat as any).positions.length : 1);
                                    const dimText = isHole
                                        ? `Ø${(feat as any).diameter} × ${(feat as any).depth}mm${count > 1 ? ` (${count}×)` : ''}`
                                        : (isGroove ? `szer. ${(feat as any).width} × ${(feat as any).depth}mm` : '');

                                    return (
                                    <div 
                                        key={idx} 
                                        onMouseEnter={() => handleFeatureHover(feat, idx)}
                                        onMouseLeave={() => handleFeatureLeave(idx)}
                                        style={{ 
                                            background: rowBg, 
                                            padding: '4px 6px', 
                                            border: rowBorder, 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '4px', 
                                            fontSize: '11px', 
                                            color: '#eee', 
                                            borderRadius: '3px',
                                            transition: 'background 0.15s ease, border-color 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <button onClick={() => moveFeature(idx, -1)} disabled={idx === 0} style={{ padding: 0, background: 'transparent', border: 'none', color: idx === 0 ? '#555' : '#aaa', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '8px' }}>▲</button>
                                            <button onClick={() => moveFeature(idx, 1)} disabled={idx === features.length - 1} style={{ padding: 0, background: 'transparent', border: 'none', color: idx === features.length - 1 ? '#555' : '#aaa', cursor: idx === features.length - 1 ? 'default' : 'pointer', fontSize: '8px' }}>▼</button>
                                        </div>

                                        {/* Ikonka Oka — podgląd / przypięcie podświetlenia 3D (bez obwódki) */}
                                        <button
                                            type="button"
                                            className="tree-action-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleTogglePinFeature(feat, idx);
                                            }}
                                            title={isPinned ? 'Wyłącz podgląd 3D' : 'Podgląd w 3D'}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: isPinned ? '#38bdf8' : (isActiveHighlight ? '#38bdf8' : '#94a3b8'),
                                                padding: '2px 3px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: (isPinned || isActiveHighlight) ? 1 : 0.6,
                                                transition: 'opacity 0.15s ease, color 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                            onMouseLeave={(e) => {
                                                if (!isPinned && !isActiveHighlight) (e.currentTarget as HTMLElement).style.opacity = '0.6';
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        </button>
                                        
                                        <span style={{ width: '16px', textAlign: 'center', color: indexColor, fontWeight: 'bold' }}>{idx + 1}.</span>
                                        
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }} title={feat.name || (isHole ? tx(cncTekst, 'feature.fallback_hole', TX_NS) : tx(cncTekst, 'feature.fallback_profile', TX_NS))}>
                                                {feat.name || (isHole ? tx(cncTekst, 'feature.fallback_hole', TX_NS) : tx(cncTekst, 'feature.fallback_profile', TX_NS))}
                                            </span>
                                            {dimText && (
                                                <span style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 500, letterSpacing: '0.2px' }}>
                                                    {dimText}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <select 
                                            value={assignedToolId} 
                                            onChange={(e) => updateFeatureTool(idx, e.target.value)}
                                            style={{ background: isComplete ? '#052e16' : '#111', border: `1px solid ${isComplete ? '#166534' : '#333'}`, color: '#eee', padding: '2px', fontSize: '10px', borderRadius: '2px', width: '70px', outline: 'none' }}
                                        >
                                            <option value="">{tx(cncTekst, 'operations.tool_none', TX_NS)}</option>
                                            {toolsList.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        
                                        {/* Ikonka Ołówek / Długopis — edycja operacji (bez obwódki) */}
                                        <button
                                            type="button"
                                            className="tree-action-btn"
                                            onClick={() => {
                                                setEditingFeatureId(feat.featureId);
                                                setTempFeatureEdit(JSON.parse(JSON.stringify(feat)));
                                            }}
                                            title={tx(cncTekst, 'operations.edit', TX_NS)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#94a3b8',
                                                padding: '2px 3px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: 0.6,
                                                transition: 'opacity 0.15s ease, color 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLElement).style.opacity = '1';
                                                (e.currentTarget as HTMLElement).style.color = '#60a5fa';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLElement).style.opacity = '0.6';
                                                (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M12 20h9" />
                                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                            </svg>
                                        </button>

                                        {/* Ikonka Kosz — usuwanie operacji (bez obwódki) */}
                                        <button
                                            type="button"
                                            className="tree-action-btn"
                                            onClick={() => deleteFeature(idx)}
                                            title={tx(cncTekst, 'panel.delete', TX_NS)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#94a3b8',
                                                padding: '2px 3px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: 0.6,
                                                transition: 'opacity 0.15s ease, color 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLElement).style.opacity = '1';
                                                (e.currentTarget as HTMLElement).style.color = '#ef4444';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLElement).style.opacity = '0.6';
                                                (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* SIMULATE TAB */}
                    {activeSubTab === 'simulate' && (
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', color: '#eeeeee', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                                ▶ Symulacja
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={handleStartSim} style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', borderRadius: '2px', padding: '4px', fontSize: '11px', cursor: 'pointer' }}>▶ Start</button>
                                <button onClick={handlePauseSim} style={{ flex: 1, background: '#a88322', color: '#fff', border: 'none', borderRadius: '2px', padding: '4px', fontSize: '11px', cursor: 'pointer' }}>⏸ Pauza</button>
                                <button onClick={handleStopSim} style={{ flex: 1, background: '#a83232', color: '#fff', border: 'none', borderRadius: '2px', padding: '4px', fontSize: '11px', cursor: 'pointer' }}>⏹ Stop</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', background: '#222', padding: '6px', borderRadius: '3px', border: '1px solid #333' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#ccc' }}>
                                    <span>{tx(cncTekst, 'panel.sim_speed', TX_NS)}</span>
                                    <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>{storeState.simulationSpeed.toFixed(1)}x</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.2" 
                                    max="20.0" 
                                    step="0.5" 
                                    value={storeState.simulationSpeed} 
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        store.setSimulationState(storeState.isSimulating, val);
                                        if (CNCEngine.getInstance().simulator) CNCEngine.getInstance().simulator.setSpeed(val);
                                    }}
                                    style={{ width: '100%', accentColor: '#4f80bd', cursor: 'pointer' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#ccc', marginTop: '4px' }}>
                                <span>{storeState.simStatusText}</span>
                                <span>{Math.min(100, Math.max(0, storeState.simProgressPercent)).toFixed(0)}%</span>
                            </div>
                            <div style={{ background: '#111', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ background: '#4f80bd', height: '100%', width: `${Math.min(100, Math.max(0, storeState.simProgressPercent))}%`, transition: 'width 0.15s ease' }} />
                            </div>


                        </div>
                    )}

                    {/* GENERATE TAB */}
                    {activeSubTab === 'generate' && currentProgram && (
                        <GCodeTab 
                            program={currentProgram}
                            onUpdateProgram={updateProg}
                        />
                    )}
                    {activeSubTab === 'generate' && !currentProgram && (
                        <div style={{ padding: '12px', fontSize: '11px', color: '#aaa', textAlign: 'center' }}>
                            {tx(cncTekst, 'panel.no_program_hint', TX_NS)}
                        </div>
                    )}

                </div>
            </div>
{/* MODAL EDYCJI PARAMETRÓW PROFILU / CECHY */}
            {editingFeatureIndex >= 0 && tempFeatureEdit && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
                    <div style={{ background: '#1d1d1d', border: '1px solid #111', width: '380px', color: '#eee', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden' }}>
                        
<div style={{ padding: '8px 12px', borderBottom: '1px solid #333', fontSize: '11px', fontWeight: 600 }}>
{tx(cncTekst, 'operations.settings', TX_NS)}
</div>

                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', color: '#ccc', textAlign: 'right' }}>{tx(cncTekst, 'wcs.name', TX_NS)}</label>
                                <input 
                                    type="text" 
                                    value={tempFeatureEdit.name || `Profil_${editingFeatureIndex + 1}`} 
                                    onChange={e => setTempFeatureEdit({ ...tempFeatureEdit, name: e.target.value })} 
                                    style={{ background: '#222', border: '1px solid #111', color: '#eee', padding: '4px', fontSize: '11px', borderRadius: '3px' }} 
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
<label style={{ fontSize: '11px', color: '#ccc', textAlign: 'right' }}>{tx(cncTekst, 'operations.tool_label', TX_NS)}</label>
<select
value={tempFeatureEdit.toolId || ''}
onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, toolId: e.target.value })}
style={{ background: '#222', border: '1px solid #111', color: '#eee', padding: '4px', fontSize: '11px', borderRadius: '3px' }}
>
<option value="">{tx(cncTekst, 'operations.tool_none', TX_NS)}</option>
                                    {toolsList.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} (FI {t.diameter}mm)</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', color: '#ccc', textAlign: 'right' }}>{tx(cncTekst, 'operations.depth_z', TX_NS)}</label>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    value={tempFeatureEdit.depth ?? 0}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === '' || raw === '-') {
                                            setTempFeatureEdit({ ...tempFeatureEdit, depth: raw as any });
                                        } else {
                                            const val = parseFloat(raw);
                                            setTempFeatureEdit({ ...tempFeatureEdit, depth: isNaN(val) ? 0 : val });
                                        }
                                    }} 
                                    style={{ background: '#333', border: '1px solid #222', color: '#eee', padding: '4px', fontSize: '11px', borderRadius: '3px', textAlign: 'center' }} 
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', color: '#ccc', textAlign: 'right' }}>{tx(cncTekst, 'operations.lead_in', TX_NS)}</label>
                                <input 
                                    type="number" 
                                    value={tempFeatureEdit.leadIn ?? 0}
                                    onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, leadIn: parseFloat(e.target.value) || 0 })} 
                                    style={{ background: '#333', border: '1px solid #222', color: '#eee', padding: '4px', fontSize: '11px', borderRadius: '3px', textAlign: 'center' }} 
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', color: '#ccc', textAlign: 'right' }}>{tx(cncTekst, 'operations.lead_out', TX_NS)}</label>
                                <input 
                                    type="number" 
                                    value={tempFeatureEdit.leadOut ?? 0}
                                    onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, leadOut: parseFloat(e.target.value) || 0 })} 
                                    style={{ background: '#333', border: '1px solid #222', color: '#eee', padding: '4px', fontSize: '11px', borderRadius: '3px', textAlign: 'center' }} 
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                                <div></div>
                                <label style={{ fontSize: '11px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={Boolean(tempFeatureEdit.reverseDirection)}
                                        onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, reverseDirection: e.target.checked })}
                                        style={{ accentColor: '#4f80bd', cursor: 'pointer' }} 
                                    /> {tx(cncTekst, 'operations.reverse_entry', TX_NS)}
                                </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                                <div></div>
                                <label style={{ fontSize: '11px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={Boolean((tempFeatureEdit as any).flipDepthDirection)}
                                        onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, flipDepthDirection: e.target.checked } as any)}
                                        style={{ accentColor: '#4f80bd', cursor: 'pointer' }} 
                                    /> {tx(cncTekst, 'operations.reverse_groove_depth', TX_NS)}
                                </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', alignItems: 'center' }}>
                                <label style={{ fontSize: '11px', color: '#ccc', textAlign: 'right' }}>{tx(cncTekst, 'operations.comp_title', TX_NS)}</label>
                                <select 
                                    value={tempFeatureEdit.compensation || 'Center'}
                                    onChange={(e) => setTempFeatureEdit({ ...tempFeatureEdit, compensation: e.target.value })} 
                                    style={{ background: '#222', border: '1px solid #111', color: '#eee', padding: '4px', fontSize: '11px', borderRadius: '3px' }}
                                >
                                    <option value="Center">{tx(cncTekst, 'operations.comp_none_short', TX_NS)}</option>
<option value="Left">{tx(cncTekst, 'operations.comp_inside', TX_NS)}</option>
<option value="Right">{tx(cncTekst, 'operations.comp_outside', TX_NS)}</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ padding: '8px', display: 'flex', gap: '8px', background: '#222', borderTop: '1px solid #111' }}>
                            <button 
                                onClick={saveFeatureEdit} 
                                style={{ flex: 1, background: '#4f80bd', color: '#fff', border: '1px solid #3b608e', padding: '6px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer', fontWeight: 600 }}
                            >
                                {tx(cncTekst, 'operations.ok', TX_NS)}
                            </button>
                            <button 
                                onClick={() => { setEditingFeatureId(null); setTempFeatureEdit(null); }}
                                style={{ flex: 1, background: '#444', color: '#eee', border: '1px solid #333', padding: '6px', fontSize: '11px', borderRadius: '3px', cursor: 'pointer' }}
                            >
                                {tx(cncTekst, 'operations.cancel', TX_NS)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
