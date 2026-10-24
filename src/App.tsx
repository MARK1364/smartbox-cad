import React, { useEffect, useState, useRef, useCallback } from 'react';
import { unit } from '../A1_core/unit-system';
import { UIController, PANEL_DIM_MAX_MM, PANEL_DIM_MIN_MM } from '../A1_core/ui-controller';
import { SmartFrameUI } from '../A3_smartframe/smartframe-ui';
import { ScianyUI } from '../S4_sciany/sciany-ui';
import { BlokiUI } from '../A2_bloki/01_bloki-ui';
import { CabinetLibraryPanel } from './CabinetLibraryPanel';
import { SaveCabinetModal } from './SaveCabinetModal';
import { SSOTUI } from './ssot-ui';
import { PerformanceOptionsModal } from './PerformanceOptionsModal';
import { GoogleDriveModal } from './GoogleDriveModal';
import { SaaSUserBadge } from './saas/ui/SaaSUserBadge';
import { SaaSAuthModal } from './saas/ui/SaaSAuthModal';
import { SaaSProjectsDashboardModal } from './saas/ui/SaaSProjectsDashboardModal';
import { SaaSPaywallModal } from './saas/ui/SaaSPaywallModal';
import { SaaSUpgradeBus } from './saas/saas-upgrade-bus';
import { restoreLicense } from './saas/license-loader';
import { NewProjectModal } from './NewProjectModal';
import { PropertiesPanel } from './PropertiesPanel';
import { FloatingOperationDialog, CAD_OPEN_FLOATING_OPERATION } from './FloatingOperationDialog';
import { CncValidationReportModal } from './module-data/CncValidationReportModal';
import { QuickPickPopup } from './QuickPickPopup';
import { BelkaHierarchyBar } from './BelkaHierarchyBar';
import { MaterialsUI } from '../A7_material/materials-ui';
import { AssignMaterialCommand, SetEdgeBandingCommand } from '../A7_material/material-commands';
import { materialDatabase } from '../A7_material/material-database';
import { MaterialScope } from '../A7_material/material-types';
import { ContextManager } from '../A1_core/context-manager';
import { applyTabSelectionPolicy } from '../A1_core/selection-highlight';
import { toggleDimensionTool, deactivateAllPmiTools } from '../A8_pmi/pmi-tool-activate.js';
import { PMIStore } from '../A8_pmi/pmi-data.js';
import { HandleDimGizmo } from '../A2_bloki/handles/handle-dim-gizmo.js';
import { LanguageSelector } from '../T1_tlumaczenia/LanguageSelector';
import { tx } from '../T1_tlumaczenia/core.js';
import { useLocale } from '../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../T1_tlumaczenia/types.js';
import srcTekstRaw from './src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';
import { useUiRegionEdgeHint } from './use-ui-region-edge-hint';
import { CAMStateStore } from '../C1_cnc/core/cam-state-store';
import { createArcballCameraFactory } from '../C1_cnc/interaction/arcball-camera-session';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput';
import { AssociativeDimInputs } from '../A4_smartpanel/associative-dim-ui';
import { isAssocComplete } from '../A4_smartpanel/associative-dim';
import { PmiTopbarDropdown } from '../A8_pmi/pmi-topbar-dropdown';
import { SolverUI, SOLVER_PANEL_TITLE } from '../S2_solver/solver-ui';
import { ConnectorsUI, CONNECTORS_PANEL_TITLE } from '../C2_connectors/connectors-ui';
import { stopConnectorPick } from '../C2_connectors/connector-picker';
import { OperacjeUI, OPERACJE_PANEL_TITLE, OPERACJE_DRAG_MIME, applyLibraryOperationFromPick, handleLedChannelDrop } from '../o1_operacji';
import { HandleDragController } from '../A2_bloki/handles/handle-controller.js';
import { HangerDragController } from '../A2_bloki/hangers/hanger-controller.js';
import { createSmartPartHandle } from '../A2_bloki/handles/handle-engine.js';
import { FloatingEditHost, openCadEditEntity, closeCadFloatingEdit } from './floating-edit';
import { AgdPanel } from './agd/AgdPanel';
import { createSmartAppliance, createSmartApplianceInDetectedBay } from '../A6_agd';
import { ConnectorVisualizer } from '../C2_connectors/connector-visualizer';
import { isSolverSmartFrameIsolationActive, applyPanelViewSolverVisibility, isSolverTabActive } from '../S2_solver/solver-visibility';
import { ExportUI, ExportEngine } from '../E1_export';
import { Vec3 } from '../A1_core/cad-math/vec3';
import { Quat } from '../A1_core/cad-math/quat';
import { mmToNm } from '../A1_core/cad-math/units';
import { PanelModel } from '../A4_smartpanel/panel-model';
import { CADNode } from '../A1_core/cad-node/cad-node';
import { NodeType } from '../A1_core/cad-node/node-type';
import { AddNodeCommand } from '../A1_core/commands/add-node-command';
import { openCncFromCad, installModuleRefreshBridge } from './module-data/open-modules';
import { CAD_WINDOW_NAME, installCadModuleBridge } from './module-data/session';
import { BlokiBayController } from '../A2_bloki/02_bloki-bay-controller';
import { SmartFrameDragController } from '../A3_smartframe/smartframe-drag-controller';
import { createBlokInDetectedBay, BLOKI_CATEGORY_NAMES } from '../A2_bloki/02_bloki-bay-actions';
import { clearBayHighlight, highlightBayInScene } from '../A2_bloki/02_bloki-bay-visualizer';
import { ModalTransformManager } from '../A1_core/modal-transform';
import { HardwareLoader } from '../B1_biblioteka/hardware-loader';
import {
  useModalTransformState,
  useToolHint,
  useProjectDocument,
  useUIState,
} from './hooks/use-app-document-state';
import { usePanelWidths } from './hooks/use-panel-widths';
import { ViewCube } from './ViewCube';
import { BelkaWidokowa } from './BelkaWidokowa';
import { DrzewoObiektow } from './DrzewoObiektow';
import { PanelEdycji } from './PanelEdycji';

export default function App({ initialTab }: { initialTab?: string } = {}) {
  const projectModel = useProjectDocument();
  const uiState = useUIState();
  useLocale();
  const activeHint = useToolHint();
  const modalTransformMode = useModalTransformState();
  const {
    treeWidth,
    editPanelWidth,
    isDraggingTree,
    isDraggingEdit,
    startResizeTree,
    startResizeEdit,
    expandEditPanelIfCollapsed,
  } = usePanelWidths();
  const [activeTab, setActiveTabRaw] = useState(initialTab || 'tab-a3-smartframe');

  /**
   * Wszystkie przełączenia zakładek idą przez tę funkcję.
   *
   * `cad-tab-switched` zostaje, bo słuchają go inne moduły — bez konsumenta
   * zdarzenie nic nie kosztuje, a usuwanie go zmieniałoby kontrakt publiczny.
   */
  const setActiveTab = useCallback((tab: string) => {
    if (tab === ContextManager.instance.activeTab) {
      return;
    }
    if (tab !== 'tab-a8-pmi') {
      deactivateAllPmiTools(ContextManager.instance.stateMachine);
      PMIStore.instance.clearAllMeasurements();
      ContextManager.instance.pmiRenderer?.clearPreview?.();
      ContextManager.instance.pmiRenderer?.clearMeasurePreview?.();
      ContextManager.instance.pmiRenderer?.setVisible?.(false);
    }
    HandleDimGizmo.instance.detach();
    setActiveTabRaw(tab);
    ContextManager.instance.activeTab = tab;
    applyTabSelectionPolicy(tab);
    window.dispatchEvent(new CustomEvent('cad-tab-switched', { detail: { tabId: tab } }));
  }, []);

  const handleSwitchTab = useCallback((tab: string) => {
    setActiveTab(tab);
  }, [setActiveTab]);
  const [renderMode, setRenderModeState] = useState('edges');
  const [gridVisible, setGridVisible] = useState(true);
  const [projection, setProjection] = useState('ortho');
  const [lcsVisible, setLcsVisible] = useState(false);
  const [isPanActive, setIsPanActive] = useState(false);
  const [isZoomWindowActive, setIsZoomWindowActive] = useState(false);
  const [zoomBox, setZoomBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const zoomStartRef = useRef<{ startX: number; startY: number } | null>(null);

  useEffect(() => {
    if (!isZoomWindowActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        zoomStartRef.current = null;
        setZoomBox(null);
        setIsZoomWindowActive(false);
        UIController.instance?.setStatus('Gotowe');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isZoomWindowActive]);

  const toggleZoomWindowMode = () => {
    setIsZoomWindowActive((prev) => {
      const next = !prev;
      if (next) {
        UIController.instance?.setStatus(tx(srcTekst, 'app.status_zoom', TX_NS));
      } else {
        zoomStartRef.current = null;
        setZoomBox(null);
        UIController.instance?.setStatus('Gotowe');
      }
      return next;
    });
  };
  const [dropModal, setDropModal] = useState<{
    material: any;
    targetPanel: any;
    x: number;
    y: number;
  } | null>(null);

  const handleApplyDropScope = (scope: MaterialScope) => {
    if (!dropModal) return;
    const doc = ContextManager.instance.document || projectModel;
    if (!doc) return;

    const cmd = new AssignMaterialCommand(dropModal.targetPanel.id, dropModal.material, scope);
    if (doc.history && typeof doc.history.executeCommand === 'function') {
      doc.history.executeCommand(cmd, doc);
    } else {
      cmd.execute(doc);
    }
    setDropModal(null);
  };

  const togglePanMode = () => {
    const vp = ContextManager.instance.viewport;
    if (vp) {
      const nextState = vp.togglePanTool();
      setIsPanActive(nextState);
    }
  };

  const handleTopBarMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('pasek-menu') || (e.target as HTMLElement).classList.contains('menu-left')) {
      const vp = ContextManager.instance.viewport;
      if (vp) {
        vp.setPanToolActive(true);
        setIsPanActive(true);
        const handleMouseUp = () => {
          vp.setPanToolActive(false);
          setIsPanActive(false);
          window.removeEventListener('mouseup', handleMouseUp);
        };
        window.addEventListener('mouseup', handleMouseUp);
      }
    }
  };

  // Stan rozwijanego menu Widok, Podgląd, Projekcja oraz Plik (dropdown)
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
  const [projMenuOpen, setProjMenuOpen] = useState(false);
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [ssotModalOpen, setSsotModalOpen] = useState(false);
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [gdriveModalMode, setGdriveModalMode] = useState<'open' | 'save' | 'settings' | null>(null);
  const [saasAuthModalOpen, setSaasAuthModalOpen] = useState(false);
  const [saasDashboardOpen, setSaasDashboardOpen] = useState(false);
  const [saasPaywallFeature, setSaasPaywallFeature] = useState<string | null>(null);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [saveCabinetModalOpen, setSaveCabinetModalOpen] = useState(false);

  useEffect(() => {
    ContextManager.instance.requestNewProjectDialog = () => {
      setNewProjectModalOpen(true);
    };
    return () => {
      ContextManager.instance.requestNewProjectDialog = null;
    };
  }, []);

  // Brama licencyjna: zagnieżdżone komponenty (np. GCodeTab) proszą o paywall.
  useEffect(() => {
    return SaaSUpgradeBus.setHandler((feature) => {
      setSaasPaywallFeature(feature || tx(srcTekst, 'saas.pro_feature_locked', TX_NS, { name: 'PRO' }));
    });
  }, []);

  // Przywróć zapisaną licencję przy starcie (weryfikacja podpisu + expiry).
  useEffect(() => {
    void restoreLicense();
  }, []);

  const handleNewProjectClick = () => {
    const doc = ContextManager.instance.document || projectModel;
    const hasPanels = doc && typeof doc.getPanels === 'function' && doc.getPanels().length > 0;
    const hasContainers = doc && typeof doc.getContainers === 'function' && doc.getContainers().length > 0;
    const isDirty = doc && typeof doc.isDirty === 'function' ? doc.isDirty() : false;

    if (!isDirty && !hasPanels && !hasContainers) {
      callAPI('forceResetProject');
      return;
    }

    setNewProjectModalOpen(true);
  };

  const handleSaveAndNewProject = async () => {
    const api = ContextManager.instance.appAPI;
    if (api && typeof api.saveProject === 'function') {
      const saved = await api.saveProject();
      if (saved !== false) {
        setNewProjectModalOpen(false);
        if (typeof api.forceResetProject === 'function') {
          api.forceResetProject();
        }
      }
    }
  };

  const handleDiscardAndNewProject = () => {
    setNewProjectModalOpen(false);
    const api = ContextManager.instance.appAPI;
    if (api && typeof api.forceResetProject === 'function') {
      api.forceResetProject();
    }
  };
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const uiRegionHint = useUiRegionEdgeHint();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setFileMenuOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setViewMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ─── Centralne sterowanie selectionMode wg aktywnej zakładki ─────
  // Rejestr modułów: map[tabId] = tryb selekcji (patrz A1_core/selection-mode.ts)
  useEffect(() => {
    const facePicker = ContextManager.instance.facePicker;
    ContextManager.instance.activeTab = activeTab;

    if (activeTab !== 'tab-c2-connectors') {
      stopConnectorPick();
    }

    // Uniwersalna reguła: przejście na inną zakładkę automatycznie wyłącza narzędzia PMI
    deactivateAllPmiTools(ContextManager.instance.stateMachine);

    if (!facePicker) return;

    applyTabSelectionPolicy(activeTab);

    // Poza pipetą więzów — pełna hierarchia podgeometrii (vertex → edge → face).
    if (!ContextManager.instance.activeConstraintPicker) {
      facePicker.targetSubgeometryType = null;
    }

    if (ContextManager.instance.showGizmos) {
      ContextManager.instance.showGizmos();
    }

    if (activeTab === 'tab-e1-export') {
      ExportEngine.instance.setShowBounds(true);
    } else {
      ExportEngine.instance.setShowBounds(false);
    }
  }, [activeTab]);

  // Automatyczna izolacja formatki (wykrywanie CNC tab)
  useEffect(() => {
    const applyIsolation = () => {
      const isCnc = activeTab === 'tab-c1-cnc';
      const solverSmartFrameOnly = isSolverSmartFrameIsolationActive();
      const active = projectModel?.activeEntity;
      const hasActivePanel = active && active.type !== 'container';

      const panelViews = ContextManager.instance.panelViews;
      const containerViews = ContextManager.instance.containerViews;
      const scene = ContextManager.instance.babylonScene;

      const isolate = isCnc;
      const lockedPanel = hasActivePanel ? active : null;

      // CNC: schowaj symbole złączy (kołki/konfirmaty). Lista i otwory w features zostają.
      ConnectorVisualizer.instance.setSymbolsVisible(!isolate);

      if (isCnc) {
          ContextManager.instance.appAPI?.setLcsVisible?.(true);
          setLcsVisible(true);
      }

      // CNC: test arcballa na FORMATCE (cięciwa + pivot). Poza CNC — turntable kamery.
      const vpForRotation = ContextManager.instance.viewport;
      if (vpForRotation) {
          vpForRotation.rotationFactory = isCnc
              ? createArcballCameraFactory(() => {
                    const panel =
                        ContextManager.instance.activePanel ||
                        ContextManager.instance.document?.activeEntity;
                    if (!panel) return null;
                    return ContextManager.instance.panelViews?.get(panel) ?? null;
                })
              : null;
      }

      if (!scene) return;

      const isPanelEqual = (model: any) => {
          if (!lockedPanel || !model) return false;
          if (model === lockedPanel) return true;
          if (model.id && lockedPanel.id && model.id === lockedPanel.id) return true;
          if (model.smartId?.fullPath && lockedPanel.smartId?.fullPath && model.smartId.fullPath === lockedPanel.smartId.fullPath) return true;
          if (model.smartId?.uid && lockedPanel.smartId?.uid && model.smartId.uid === lockedPanel.smartId.uid) return true;
          return false;
      };

      // 1. Ukrywanie obrysu/siatki drucianej szafki (ContainerView), bez wyłączania węzła nadrzędnego
      if (containerViews && containerViews.size > 0) {
          containerViews.forEach((cView) => {
              const containerOn = cView.model?.visible !== false;
              if (cView.rootNode) {
                  try { cView.rootNode.setEnabled(isolate ? true : containerOn); } catch {}
              }
              if (cView.mesh) {
                  try {
                      if (isolate) {
                          cView.mesh.visibility = 0.0;
                          cView.mesh.isVisible = false;
                      } else if (!containerOn) {
                          cView.mesh.visibility = 0.0;
                          cView.mesh.isVisible = false;
                      } else if (solverSmartFrameOnly) {
                          cView.mesh.visibility = 0.5;
                          cView.mesh.isVisible = true;
                      } else {
                          cView.mesh.visibility = 0.5;
                          cView.mesh.isVisible = true;
                      }
                  } catch {}
              }
          });
      }

      const vp = ContextManager.instance.viewport;
            const currentMode = vp?.currentRenderMode || renderMode || 'edges';
      let faceVis = 1.0;
      if (currentMode === 'wireframe') faceVis = 0.0;
      else if (currentMode === 'xray') faceVis = 0.35;

      // 2. Izolowanie widoków domenowych PanelViews (tylko ich siatek 3D, z wyłączeniem LCS)
      if (panelViews && panelViews.size > 0) {
          panelViews.forEach((view, model) => {
              const isTargetPanel = isPanelEqual(model);
              const wireframe = currentMode === 'wireframe';

              if (isSolverTabActive()) {
                  applyPanelViewSolverVisibility(view, model, {
                      smartFrameOnly: solverSmartFrameOnly,
                      faceVis,
                      wireframe,
                  });
                  return;
              }

              const isPanelVisible = model.visible !== false && model.frozen !== true;
              const shouldShow = isolate
                  ? isTargetPanel
                  : isPanelVisible;

              if (view.root) {
                  try {
                      // W trybie izolacji CNC ukrywamy inne elementy.
                      // W trybie standardowym węzeł root (TransformNode) pozostaje aktywny,
                      // dzięki czemu zawiasy/okucia (będące osobnymi bytami) nie znikają po ukryciu skrzydła drzwi!
                      view.root.setEnabled(isolate ? isTargetPanel : true);
                  } catch {}
              }
              if (typeof (view as any).setPanelVisible === 'function') {
                  (view as any).setPanelVisible(shouldShow);
              } else if (view.faceMeshes) {
                  Object.values(view.faceMeshes).forEach((mesh: any) => {
                      if (mesh) {
                          try {
                              mesh.setEnabled(shouldShow);
                              mesh.visibility = shouldShow ? faceVis : 0.0;
                              mesh.isVisible = shouldShow && !wireframe;
                              mesh.isPickable = shouldShow && !wireframe;
                          } catch {}
                      }
                  });
              }
              if (view._featureMarkers && Array.isArray(view._featureMarkers)) {
                  view._featureMarkers.forEach((m: any) => {
                      if (m) {
                          try {
                              const isHw = m.metadata?.type === 'hardware' || m.name?.startsWith('hw_');
                              if (isHw) {
                                  const hwVis = m.metadata?.feature?.visible !== false && m.metadata?.feature?.params?.visible !== false && m.metadata?.visible !== false;
                                  const showHw = isolate ? isTargetPanel : hwVis;
                                  m.setEnabled(showHw);
                                  if ('isVisible' in m) m.isVisible = showHw && !wireframe;
                                  if (m.metadata?.frozen) {
                                      HardwareLoader.instance.setHingeFrozen(m, true);
                                  } else {
                                      HardwareLoader.instance.setHingeFrozen(m, false);
                                  }
                              } else {
                                  m.setEnabled(shouldShow);
                                  m.visibility = shouldShow ? faceVis : 0.0;
                                  m.isVisible = shouldShow && !wireframe;
                              }
                          } catch {}
                      }
                  });
              }
              if (view._edgeMeshes && Array.isArray(view._edgeMeshes)) {
                  const showEdge = shouldShow;
                  view._edgeMeshes.forEach((m: any) => {
                      if (m) {
                          try {
                              m.setEnabled(showEdge);
                              m.visibility = showEdge ? 1.0 : 0.0;
                              m.isVisible = showEdge;
                              m.isPickable = showEdge;
                          } catch {}
                      }
                  });
              }
          });
      }

      if (isolate && ContextManager.instance.hideGizmos) {
          ContextManager.instance.hideGizmos();
      }

      if (scene.activeCamera) {
          scene.activeCamera.lowerBetaLimit = null;
          scene.activeCamera.upperBetaLimit = null;
          scene.activeCamera.allowUpAndDownInputs = true;
          scene.activeCamera.angularSensibilityX = 200;
          scene.activeCamera.angularSensibilityY = 200;
          scene.activeCamera.inertia = 0;
          scene.activeCamera.panningInertia = 0;
      }

      // 3. Izolowanie pozostałych siatek w scenie Babylon.js i obsługa podłogi
      if (scene.meshes) {
          scene.meshes.forEach((mesh: any) => {
              const name = mesh.name || "";
              
              const isGizmoMesh = (
                  name.startsWith('faceGizmoSphere') ||
                  name.startsWith('freeDragSphere') ||
                  name.startsWith('positionGizmo') ||
                  (name.includes('gizmo') && !name.startsWith('WCS_') && !name.startsWith('CAM_') && !name.startsWith('Part_'))
              );

              if (isGizmoMesh && isolate) {
                  mesh.setEnabled(false);
                  mesh.visibility = 0.0;
                  mesh.isVisible = false;
                  return;
              }

              const isConnectorSymbol = (
                  name.startsWith('c2_conn') ||
                  name.startsWith('c2_patch') ||
                  mesh.metadata?.type === 'c2_connector_symbol'
              );
              if (isConnectorSymbol) {
                  const currentMode = (ContextManager.instance as any).viewport?.currentRenderMode || renderMode || 'edges';
                  const showInMode = currentMode === 'wireframe' || currentMode === 'xray';
                  const shouldShow = !isolate && showInMode;
                  mesh.setEnabled(shouldShow);
                  mesh.visibility = shouldShow ? 1.0 : 0.0;
                  mesh.isVisible = shouldShow;
                  return;
              }

              if (name === 'ground' || name.startsWith('gridLines')) {
                  const showGrid = !isolate;
                  mesh.setEnabled(showGrid);
                  mesh.visibility = showGrid ? 0.35 : 0.0;
                  mesh.isVisible = showGrid;
                  return;
              }

              const isDatumPlane = (
                  name === 'FrontPlane' ||
                  name === 'TopPlane' ||
                  name === 'RightPlane' ||
                  mesh.metadata?.type === 'datum_plane'
              );
              if (isDatumPlane) {
                  const showPlanes = !isolate && gridVisible;
                  mesh.setEnabled(showPlanes);
                  mesh.isVisible = showPlanes;
                  // Pick tylko przy aktywnej pipetcie więzów (FACE) — inaczej zasłania formatki
                  const pickingConstraint =
                      Boolean(ContextManager.instance.activeConstraintPicker) &&
                      ContextManager.instance.activeConstraintPicker?.expectedKind === 'FACE';
                  mesh.isPickable = showPlanes && pickingConstraint;
                  return;
              }

              const isCamOrWcsMesh = (
                  name.startsWith('CAM_') ||
                  name.startsWith('WCS_') ||
                  name.startsWith('CNC_') ||
                  name.startsWith('Part_') ||
                  name.startsWith('lbl_')
              );

              if (isCamOrWcsMesh) {
                  mesh.setEnabled(isolate);
                  mesh.visibility = isolate ? 1.0 : 0.0;
                  mesh.isVisible = isolate;
                  return;
              }

              const isContainerMesh = (
                  mesh.metadata?.type === 'container' ||
                  mesh.metadata?.model?.type === 'container' ||
                  name.startsWith('container') ||
                  name.startsWith('SmartFrame') ||
                  name.startsWith('Korpus') ||
                  name.startsWith('Bloki') ||
                  name.startsWith('Szafa')
              );

              if (isContainerMesh) {
                  const containerOn = (mesh.metadata?.model?.visible ?? mesh.metadata?.panelModel?.visible) !== false;
                  mesh.setEnabled(isolate ? true : containerOn);
                  if (isolate || !containerOn) {
                      mesh.visibility = 0.0;
                      mesh.isVisible = false;
                  } else if (solverSmartFrameOnly) {
                      mesh.visibility = 0.5;
                      mesh.isVisible = true;
                  } else {
                      mesh.visibility = 0.5;
                      mesh.isVisible = true;
                  }
                  return;
              }

              const isHwDescendant = name.startsWith('hw_') ||
                  mesh.parent?.name?.startsWith('hw_') ||
                  mesh.metadata?.type === 'hardware' ||
                  (mesh.parent && (mesh.parent as any).metadata?.type === 'hardware');
              if (isHwDescendant) {
                  return;
              }

              if (mesh.metadata?.panelModel || mesh.metadata?.model) {
                  const model = mesh.metadata?.panelModel || mesh.metadata?.model;
                  const belongsToActive = isPanelEqual(model);
                  const isSolverPanelMesh = isSolverTabActive() && (
                      name.startsWith('face_') ||
                      mesh.metadata?.faceName ||
                      mesh.metadata?.type === 'vertex' ||
                      mesh.metadata?.type === 'edge' ||
                      mesh.metadata?.type === 'feature'
                  );

                  let shouldShowMesh = isolate
                      ? belongsToActive
                      : isSolverPanelMesh
                        ? model.visible !== false
                        : solverSmartFrameOnly
                          ? false
                          : model.visible !== false;

                  mesh.setEnabled(shouldShowMesh);
                  const isEdgeMesh = mesh.metadata?.type === 'edge' ||
                      name.startsWith('edge_') ||
                      name.startsWith('lines_');
                  if (isEdgeMesh) {
                      const showEdge = shouldShowMesh;
                      mesh.setEnabled(showEdge);
                      mesh.visibility = showEdge ? 1.0 : 0.0;
                      mesh.isVisible = showEdge;
                      mesh.isPickable = showEdge;
                      return;
                  }
                  const isFaceOrFeat = name.startsWith('face_') || 
                                       mesh.metadata?.faceName || 
                                       mesh.metadata?.type === 'feature' || 
                                       mesh.metadata?.type === 'vertex' ||
                                       name.startsWith('hole_') || 
                                       name.startsWith('pocket_') || 
                                       name.startsWith('groove_');
                  const vis = isFaceOrFeat ? faceVis : 1.0;
                  mesh.visibility = shouldShowMesh ? vis : 0.0;
                  mesh.isVisible = shouldShowMesh && (isFaceOrFeat ? currentMode !== 'wireframe' : true);
                  if (isFaceOrFeat) {
                      mesh.isPickable = shouldShowMesh && currentMode !== 'wireframe';
                  }
              }
          });
      }
    };

    applyIsolation();
    (ContextManager.instance as any).notifyIsolationUpdate = applyIsolation;
    const onSolverVis = () => applyIsolation();
    window.addEventListener('solver-visibility-changed', onSolverVis);
    return () => {
        window.removeEventListener('solver-visibility-changed', onSolverVis);
        if ((ContextManager.instance as any).notifyIsolationUpdate === applyIsolation) {
            (ContextManager.instance as any).notifyIsolationUpdate = null;
        }
    };
  }, [activeTab, projectModel?.activeEntity, renderMode, gridVisible]);

  // Dimensions inputs state
  const [widthVal, setWidthVal] = useState('600');
  const [heightVal, setHeightVal] = useState('720');
  const [thicknessVal, setThicknessVal] = useState('18');

  // Load app.ts once mounted; nazwij okno CAD + mostek zamykania kart CNC/modułów
  useEffect(() => {
    try {
      window.name = CAD_WINDOW_NAME;
    } catch { /* ignore */ }

    const uninstallBridge = installCadModuleBridge();
    const uninstallRefresh = installModuleRefreshBridge();

    if (!(window as any).__cadAppLoading && !(window as any).__cadAppStarted) {
      (window as any).__cadAppLoading = true;
      import('./application/cad-app.ts').then(() => {
        console.log('Core app loaded successfully in React');
      }).catch(err => {
        (window as any).__cadAppLoading = false;
        console.error('Failed to load cad-app.ts:', err);
      });
    }

    return () => {
      uninstallRefresh();
      uninstallBridge();
    };
  }, []);

  // Sync inputs with uiState / activeEntity dimensions
  useEffect(() => {
    if (uiState) {
      setWidthVal(uiState.inputWidthValue || '600');
      setHeightVal(uiState.inputHeightValue || '720');
      setThicknessVal(uiState.inputThicknessValue || '18');
    }
  }, [uiState, projectModel?.activeEntity]);

  // Auto-switch tab when a Blok / AGD / zawieszki-SmartPart is selected.
  useEffect(() => {
    if (ContextManager.instance.activeReferencePicker) return;
    if (ContextManager.instance.activeConstraintPicker) return;
    let active: any = projectModel?.activeEntity;
    const doc = projectModel;
    const isAppliance = (m: any) => {
      if (!m) return false;
      const gt = String(m.generatorParams?.type || '');
      const role = String(m.role || '');
      return role === 'APPLIANCE' || gt === 'smart_appliance' || m.generatorParams?.boxType === 'APPLIANCE';
    };
    // Part / FEATURE zawieszki → grupa nadrzędna (jak Blok); część AGD → kontener AGD
    if (active && doc?.findNode) {
      let node = doc.findNode(active.id);
      const isHangersOrBlok = (m: any) => {
        if (!m || m.type !== 'container') return false;
        if (isAppliance(m)) return false;
        const gt = String(m.generatorParams?.type || '');
        const role = String(m.role || '');
        return gt.startsWith('blok_') || gt.startsWith('bloki') || !!m.generatorParams?.boxType
          || gt === 'smartpart_hangers' || role === 'SMARTPART_HANGERS';
      };
      if (active.type === 'container' && !isHangersOrBlok(active) && !isAppliance(active)) {
        const parent = node?.parent?.domainData;
        if (isAppliance(parent) || isHangersOrBlok(parent)) active = parent;
      }
      while (active && active.type !== 'container' && node?.parent) {
        const parent = node.parent.domainData;
        if (isAppliance(parent) || isHangersOrBlok(parent)) {
          active = parent;
          break;
        }
        node = node.parent;
      }
    }
    const genType = String(active?.generatorParams?.type || '');
    const role = String(active?.role || '');
    const isAgd =
      active &&
      active.type === 'container' &&
      isAppliance(active);
    const isBlok =
      active &&
      active.type === 'container' &&
      !isAgd &&
      (genType.startsWith('blok_') || genType.startsWith('bloki') || !!active.generatorParams?.boxType);
    const isHangersGroup =
      active &&
      active.type === 'container' &&
      (genType === 'smartpart_hangers' || role === 'SMARTPART_HANGERS');
    if (isAgd) {
      deactivateAllPmiTools(ContextManager.instance.stateMachine);
      setActiveTab('tab-agd');
      expandEditPanelIfCollapsed();
    } else if (isBlok || isHangersGroup) {
      deactivateAllPmiTools(ContextManager.instance.stateMachine);
      setActiveTab('tab-a2-bloki');
      expandEditPanelIfCollapsed();
    }
  }, [projectModel?.activeEntity, expandEditPanelIfCollapsed]);

  useEffect(() => {
    // Edycja korpusu = FloatingEditHost (cad-edit-entity / cad-edit-smartframe-korpus) — bez skoku zakładki.
    const onSwitchTab = (e: any) => {
      if (e.detail?.tabId) {
        deactivateAllPmiTools(ContextManager.instance.stateMachine);
        setActiveTab(e.detail.tabId);
        expandEditPanelIfCollapsed();
      }
    };

    window.addEventListener('cad-switch-tab', onSwitchTab as EventListener);

    return () => {
      window.removeEventListener('cad-switch-tab', onSwitchTab as EventListener);
    };
  }, [expandEditPanelIfCollapsed]);

    const handleInputChange = (field: 'width' | 'height' | 'thickness', val: string) => {
    if (!UIController.instance) return;
    let w = parseFloat(field === 'width' ? val : widthVal) || 0;
    let h = parseFloat(field === 'height' ? val : heightVal) || 0;
    let t = parseFloat(field === 'thickness' ? val : thicknessVal) || 0;

    if (field === 'width') setWidthVal(val);
    if (field === 'height') setHeightVal(val);
    if (field === 'thickness') setThicknessVal(val);

    const isContainer = projectModel?.activeEntity?.type === 'container';
    // 0,1–3000 mm.
    if (w < PANEL_DIM_MIN_MM || h < PANEL_DIM_MIN_MM || w > PANEL_DIM_MAX_MM || h > PANEL_DIM_MAX_MM) {
      return;
    }
    if (isContainer && (t < PANEL_DIM_MIN_MM || t > PANEL_DIM_MAX_MM)) return;

    UIController.instance.handleInputChange(w, h, t);
  };

  const forceInputChange = () => {
    if (!UIController.instance) return;
    let w = parseFloat(widthVal) || 600;
    let h = parseFloat(heightVal) || 720;
    let t = parseFloat(thicknessVal) || 18;

    const finalW = Math.max(w, 50);
    const finalH = Math.max(h, 50);
    const finalT = Math.max(t, 3);

    setWidthVal(finalW.toString());
    setHeightVal(finalH.toString());
    setThicknessVal(finalT.toString());

    UIController.instance.handleInputChange(finalW, finalH, finalT);
  };

  const callAPI = (method: string, ...args: any[]) => {
    const api = ContextManager.instance.appAPI;
    if (api && api[method]) {
      api[method](...args);
    } else {
      console.warn(`appAPI.${method} is not available yet.`);
    }
  };

  useEffect(() => {
    if (!ContextManager.instance.blokiBayController) {
      ContextManager.instance.blokiBayController = new BlokiBayController();
    }
    if (!ContextManager.instance.smartFrameDragController) {
      ContextManager.instance.smartFrameDragController = new SmartFrameDragController();
    }

    const handleBayDetected = (bayOrEvt: any) => {
      const bay = bayOrEvt?.detail || bayOrEvt;
      if (!bay) return;
      const ctrl = ContextManager.instance.blokiBayController;
      const optId = ctrl?.pendingBlokType || ctrl?.draggedBlokType || 'EMPTY';
      const doc = ContextManager.instance.document || projectModel;
      if (doc) {
        const scene = ContextManager.instance.viewport?.scene;
        const draggedAppliance = (window as any).__draggedAppliance;
        if (optId === 'APPLIANCE' || draggedAppliance) {
          if (scene) clearBayHighlight(scene);
          const agdNode = createSmartApplianceInDetectedBay(doc, bay, {
            template: draggedAppliance || undefined,
            kind: draggedAppliance?.kind,
            name: draggedAppliance?.name,
            params: draggedAppliance?.defaultParams,
          });
          if (agdNode) {
            (window as any).__draggedAppliance = null;
            if (ctrl) {
              ctrl.setPendingBlokType(null);
              ctrl.endDrag();
            }
            setActiveTab('tab-agd');
            doc.setActiveEntity(agdNode.domainData || agdNode);
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
          }
          return;
        }

        if (optId === 'EMPTY') {
          if (scene) highlightBayInScene(scene, bay);
        } else {
          if (scene) clearBayHighlight(scene);
        }

        const typeMap: Record<string, { type: string; label: string }> = {
          'EMPTY': { type: 'blok_empty', label: '' },
          'SHELVES': { type: 'blok_shelves', label: 'polki' },
          'DRAWERS': { type: 'blok_drawers', label: 'szuflady' },
          'DOORS': { type: 'blok_doors', label: 'drzwi' },
          'SKOSNE_DOORS': { type: 'blok_skosne_drzwi', label: 'drzwi_skosne' },
          'TUBES': { type: 'blok_tubes', label: 'drazek' },
          'SHELF': { type: 'blok_shelf', label: 'wieniec' },
          'DIVIDERS': { type: 'blok_dividers', label: 'przegrody' },
          'FLAPS': { type: 'blok_flaps', label: 'klapy' },
          'PANELS': { type: 'blok_panels', label: 'blendy' },
          'LED_EXTERNAL': { type: 'blok_led_external', label: 'led_podszafkowy' },
          'LED_INTERNAL': { type: 'blok_led_internal', label: 'led_szafowy' }
        };
        const opt = typeMap[optId] || { type: `blok_${optId.toLowerCase()}`, label: optId.toLowerCase() };

        const sbNode = createBlokInDetectedBay(doc, bay, {
          id: optId,
          type: opt.type as any,
          category: (optId === 'PANELS' || optId === 'LED_EXTERNAL') ? 'external' : 'internal',
          label: opt.label,
          icon: '',
          description: ''
        });
        if (sbNode) {
          if (ctrl) {
            ctrl.setPendingBlokType(null);
            ctrl.endDrag(optId === 'EMPTY');
          }
          const model = sbNode.domainData || sbNode;
          doc.setActiveEntity(model);
          const id = model?.id || sbNode.id;
          if (id) openCadEditEntity({ entityId: id, kind: 'blok' });
        }
      }
    };

    const handlePanelDetected = (evt: any) => {
      const surface = evt?.detail?.surface || evt?.detail;
      if (!surface || !surface.panelNode) return;
      const doc = ContextManager.instance.document || projectModel;
      if (doc) {
        const ctrl = ContextManager.instance.blokiBayController;
        const optId = ctrl?.pendingBlokType || ctrl?.draggedBlokType || 'HANDLES';
        if (optId === 'HANDLES') {
          const customParams = evt?.detail?.handleParams || ctrl?.activeHandleTemplate || {};
          const handleNode = createSmartPartHandle(doc, surface.panelNode, customParams, surface);
          if (handleNode) {
            if (ctrl) {
              ctrl.setPendingBlokType(null);
              ctrl.endDrag();
            }
            const model = handleNode.domainData || handleNode;
            doc.setActiveEntity(model);
            const id = model?.id || handleNode.id;
            if (id) openCadEditEntity({ entityId: id, kind: 'smartpart' });
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
            ContextManager.instance.viewport?.requestRender(2);
          }
        }
      }
    };

    window.addEventListener('bloki-bay-detected', handleBayDetected);
    window.addEventListener('bloki-panel-detected', handlePanelDetected);

    return () => {
      window.removeEventListener('bloki-bay-detected', handleBayDetected);
      window.removeEventListener('bloki-panel-detected', handlePanelDetected);
    };
  }, [expandEditPanelIfCollapsed]);

  const selectedPanel = projectModel?.activeEntity;
  const selectedPart = selectedPanel && selectedPanel.type === 'part' ? selectedPanel : null;
  const widthFromPlanes = isAssocComplete(selectedPart?.associativeDims?.width);
  const heightFromPlanes = isAssocComplete(selectedPart?.associativeDims?.height);
  const isFaceSelected = uiState ? uiState.faceKind !== 'none' : uiState;
  const isEdgeSelected = uiState ? uiState.faceKind === 'edge' : uiState;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      
      {/* ─── Pasek menu (Plik, Cofnij…) — nie belka widokowa ── */}
      <div id="pasek-menu" className="pasek-menu" onMouseDown={handleTopBarMouseDown}>
        <div className="menu-left" style={{ display: 'flex', alignItems: 'center' }}>
          <div ref={fileMenuRef} id="topbar-file-menu" className={`menu-item dropdown ${fileMenuOpen ? 'open' : ''}`} style={{ position: 'relative' }}>
            <button 
              type="button"
              className={`menu-btn ${fileMenuOpen ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              onClick={() => {
                setFileMenuOpen(!fileMenuOpen);
                setViewMenuOpen(false);
                setDisplayMenuOpen(false);
                setProjMenuOpen(false);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
              {tx(srcTekst, 'app.menu.file', TX_NS)}
            </button>
            {fileMenuOpen && (
              <div className="dropdown-content">
                <a href="#" id="menuNew" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); handleNewProjectClick(); }}>{tx(srcTekst, 'app.menu.new', TX_NS)}</a>
                <a href="#" id="menuOpen" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('openProject'); }}>{tx(srcTekst, 'app.menu.open', TX_NS)}</a>
                <a href="#" id="menuSave" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('saveProject'); }}>{tx(srcTekst, 'app.menu.save', TX_NS)}</a>
                <a href="#" id="menuSaveAs" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('saveProjectAs'); }}>{tx(srcTekst, 'app.menu.save_as', TX_NS)}</a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="#" id="menuSaveCabinet" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setSaveCabinetModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa' }}>
                  {tx(srcTekst, 'app.menu.save_cabinet', TX_NS)}
                </a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="#" id="menuExportStep" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('exportStep'); }}>{tx(srcTekst, 'app.menu.export_step', TX_NS)}</a>
                <a href="#" id="menuExportStl" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('exportStl'); }}>{tx(srcTekst, 'app.menu.export_stl', TX_NS)}</a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="#" id="menuSaasDashboard" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setSaasDashboardOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                  {tx(srcTekst, 'app.menu.saas_cloud', TX_NS)}
                </a>
                <a href="#" id="menuSaasAuth" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setSaasAuthModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#93c5fd' }}>
                  {tx(srcTekst, 'app.menu.saas_login', TX_NS)}
                </a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="#" id="menuGdriveOpen" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setGdriveModalMode('open'); }}>
                  {tx(srcTekst, 'app.menu.gdrive_open', TX_NS)}
                </a>
                <a href="#" id="menuGdriveSave" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setGdriveModalMode('save'); }}>
                  {tx(srcTekst, 'app.menu.gdrive_save', TX_NS)}
                </a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="#" id="menuPerfOptions" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setPerfModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                  {tx(srcTekst, 'app.menu.perf', TX_NS)}
                </a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
                  <LanguageSelector compact={false} />
                </div>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="cennik.html" target="_blank" id="menuCennik" onClick={() => setFileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
                  {tx(srcTekst, 'app.menu.prices', TX_NS)}
                </a>
                <a href="landing.html" target="_blank" id="menuLanding" onClick={() => setFileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                  {tx(srcTekst, 'app.menu.landing', TX_NS)}
                </a>
              </div>
            )}
          </div>
          <div className="menu-brand" style={{ marginLeft: '10px', marginRight: '6px' }}>{tx(srcTekst, 'app.menu.brand', TX_NS)}</div>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }}></div>

          <button 
            id="btnUndo" 
            className="menu-icon-btn" 
            title={tx(srcTekst, 'app.menu.undo', TX_NS)}
            onClick={() => callAPI('undo')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"></path>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
            </svg>
          </button>
          <button 
            id="btnRedo" 
            className="menu-icon-btn" 
            title={tx(srcTekst, 'app.menu.redo', TX_NS)}
            onClick={() => callAPI('redo')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6"></path>
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
            </svg>
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 10px' }}></div>

          {/* ─── Pasek Narzędzi CAD ─── */}
          <div id="topbar-main-tabs" className="topbar-tools">
            <button 
              id="tab-btn-smartframe"
              data-tab="tab-a3-smartframe"
              className={`topbar-tool-btn ${activeTab === 'tab-a3-smartframe' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a3-smartframe')}
              title={tx(srcTekst, 'app.tabs.frame_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="2.5" width="17" height="19" rx="1" />
                <rect x="6" y="4.5" width="12" height="14" rx="0.5" fill="currentColor" fillOpacity="0.08" />
                <line x1="3.5" y1="18.5" x2="20.5" y2="18.5" />
              </svg>
              <span>{tx(srcTekst, 'app.tabs.frame', TX_NS)}</span>
            </button>

            <button 
              id="tab-btn-bloki"
              data-tab="tab-a2-bloki"
              className={`topbar-tool-btn ${activeTab === 'tab-a2-bloki' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a2-bloki')}
              title={tx(srcTekst, 'app.tabs.box_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="2.5" width="17" height="19" rx="1" />
                <line x1="3.5" y1="18.5" x2="20.5" y2="18.5" />
                <line x1="6" y1="8.5" x2="18" y2="8.5" />
                <line x1="6" y1="13.5" x2="18" y2="13.5" />
                <line x1="12" y1="8.5" x2="12" y2="18.5" />
              </svg>
              <span>{tx(srcTekst, 'app.tabs.box', TX_NS)}</span>
            </button>

            <button 
              id="tab-btn-smartpanel"
              data-tab="tab-a4-smartpanel"
              className={`topbar-tool-btn ${activeTab === 'tab-a4-smartpanel' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a4-smartpanel')}
              title={tx(srcTekst, 'app.tabs.panel_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6L21 11L12 16L3 11Z" fill="currentColor" fillOpacity="0.2" />
                <path d="M3 11v3.5l9 5v-3.5z" fill="currentColor" fillOpacity="0.1" />
                <path d="M12 16v3.5l9-5V11z" fill="currentColor" fillOpacity="0.3" />
                <path d="M12 6l9 5v3.5l-9 5-9-5V11z" />
              </svg>
              <span>Panel</span>
            </button>

            <button 
              id="tab-btn-material"
              data-tab="tab-a7-material"
              className={`topbar-tool-btn ${activeTab === 'tab-a7-material' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a7-material')}
              title={tx(srcTekst, 'app.tabs.materials_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span>{tx(srcTekst, 'app.tabs.materials', TX_NS)}</span>
            </button>

            <button 
              id="tab-btn-biblioteka"
              data-tab="tab-b1-biblioteka"
              className={`topbar-tool-btn ${activeTab === 'tab-b1-biblioteka' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-b1-biblioteka')}
              title={tx(srcTekst, 'app.tabs.library_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="9" y1="6" x2="16" y2="6" />
                <line x1="9" y1="10" x2="16" y2="10" />
              </svg>
              <span>{tx(srcTekst, 'app.tabs.library', TX_NS)}</span>
            </button>

            <button
              id="tab-btn-sciany"
              data-tab="tab-s4-sciany"
              className={`topbar-tool-btn ${activeTab === 'tab-s4-sciany' ? 'active' : ''}`}
              onClick={() => setActiveTab('tab-s4-sciany')}
              title={tx(srcTekst, 'app.tabs.walls_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20V6h4v14H4z" />
                <path d="M10 20V4h4v16h-4z" />
                <path d="M16 20v-8h4v8h-4z" />
                <line x1="3" y1="20" x2="21" y2="20" />
              </svg>
              <span>{tx(srcTekst, 'app.tabs.walls', TX_NS)}</span>
            </button>

            <button
              id="tab-btn-agd"
              data-tab="tab-agd"
              className={`topbar-tool-btn ${activeTab === 'tab-agd' ? 'active' : ''}`}
              onClick={() => setActiveTab('tab-agd')}
              title="Sprzęt AGD (mikrofale, piekarniki)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <rect x="4" y="7" width="11" height="10" rx="1" fill="currentColor" fillOpacity="0.15" />
                <circle cx="18" cy="9" r="1.5" fill="currentColor" />
                <circle cx="18" cy="14" r="1.5" fill="currentColor" />
                <line x1="6" y1="16" x2="13" y2="16" />
              </svg>
              <span>AGD</span>
            </button>

            <button 
              id="tab-btn-solver"
              data-tab="tab-s2-solver"
              className={`topbar-tool-btn ${activeTab === 'tab-s2-solver' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-s2-solver')}
              title={tx(srcTekst, 'app.tabs.relations_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>{tx(srcTekst, 'app.tabs.relations', TX_NS)}</span>
            </button>

            <button
              id="tab-btn-connectors"
              data-tab="tab-c2-connectors"
              className={`topbar-tool-btn ${activeTab === 'tab-c2-connectors' ? 'active' : ''}`}
              onClick={() => setActiveTab('tab-c2-connectors')}
              title={tx(srcTekst, 'app.tabs.joints_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="6" height="16" rx="0.5" />
                <rect x="13" y="14" width="8" height="6" rx="0.5" />
                <line x1="9" y1="8" x2="17" y2="8" />
                <circle cx="13" cy="8" r="1.4" fill="currentColor" />
              </svg>
              <span>{tx(srcTekst, 'app.tabs.joints', TX_NS)}</span>
            </button>

            <button
              id="tab-btn-operacji"
              data-tab="tab-o1-operacji"
              className={`topbar-tool-btn ${activeTab === 'tab-o1-operacji' ? 'active' : ''}`}
              onClick={() => setActiveTab('tab-o1-operacji')}
              title={tx(srcTekst, 'app.tabs.ops_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="1" />
                <rect x="7.5" y="6.5" width="9" height="11" rx="0.5" fill="currentColor" fillOpacity="0.2" />
              </svg>
              <span>{tx(srcTekst, 'app.tabs.ops', TX_NS)}</span>
            </button>

            <PmiTopbarDropdown
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            <button 
              id="tab-btn-export"
              data-tab="tab-e1-export"
              className={`topbar-tool-btn ${activeTab === 'tab-e1-export' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-e1-export')}
              title="Eksport — Rysunki techniczne CAD, formaty A4/A3/A2, rzuty ISO 7200 i arkusze SVG"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Eksport</span>
            </button>
          </div>

          {/* ─── Narzędzia transformacji 3D (G i R) z brązowym tłem ─── */}
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }}></div>
          <div className="topbar-transform-group" title={tx(srcTekst, 'app.tools.transform_title', TX_NS)}>
            <button
              type="button"
              className={`topbar-transform-btn ${modalTransformMode === 'translate' ? 'active' : ''}`}
              onClick={() => ModalTransformManager.instance.toggleTransform('translate')}
              title={tx(srcTekst, 'app.tools.move_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 9 2 12 5 15" />
                <polyline points="9 5 12 2 15 5" />
                <polyline points="15 19 12 22 9 19" />
                <polyline points="19 9 22 12 19 15" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="12" y1="2" x2="12" y2="22" />
              </svg>
              <kbd className="topbar-key-badge">G</kbd>
              <span>{tx(srcTekst, 'app.tools.move', TX_NS)}</span>
            </button>

            <button
              type="button"
              className={`topbar-transform-btn ${modalTransformMode === 'rotate' ? 'active' : ''}`}
              onClick={() => ModalTransformManager.instance.toggleTransform('rotate')}
              title={tx(srcTekst, 'app.tools.rotate_title', TX_NS)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <kbd className="topbar-key-badge">R</kbd>
              <span>{tx(srcTekst, 'app.tools.rotate', TX_NS)}</span>
            </button>
          </div>
        </div>

        {/* ─── Prawa sekcja paska menu: SaaS User Badge & Chmura ─── */}
        <div className="menu-right" style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', paddingRight: '12px', gap: '8px' }}>
          <SaaSUserBadge
            onOpenAuth={() => setSaasAuthModalOpen(true)}
            onOpenDashboard={() => setSaasDashboardOpen(true)}
            onOpenPaywall={() => setSaasPaywallFeature(tx(srcTekst, 'saas.pro_feature_locked', TX_NS, { name: 'SmartPanel Cloud' }))}
          />
        </div>
      </div>



      <DrzewoObiektow
        projectModel={projectModel}
        treeWidth={treeWidth}
        isDraggingTree={isDraggingTree}
        startResizeTree={startResizeTree}
      />

      {/* ─── Belka widokowa (tryb cieniowania, siatka, kamera) ── */}
      <BelkaWidokowa
        renderMode={renderMode}
        projection={projection}
        gridVisible={gridVisible}
        lcsVisible={lcsVisible}
        isPanActive={isPanActive}
        isZoomWindowActive={isZoomWindowActive}
        activeTab={activeTab}
        displayMenuOpen={displayMenuOpen}
        viewMenuOpen={viewMenuOpen}
        projMenuOpen={projMenuOpen}
        infoMenuOpen={infoMenuOpen}
        viewMenuRef={viewMenuRef}
        onDisplayMenuOpenChange={setDisplayMenuOpen}
        onViewMenuOpenChange={setViewMenuOpen}
        onProjMenuOpenChange={setProjMenuOpen}
        onInfoMenuOpenChange={setInfoMenuOpen}
        onRenderModeChange={setRenderModeState}
        onToggleGrid={() => {
          setGridVisible(!gridVisible);
          callAPI('toggleGrid');
        }}
        onToggleLcs={(nextVal) => {
          setLcsVisible(nextVal);
          callAPI('setLcsVisible', nextVal);
        }}
        onProjectionChange={setProjection}
        onTogglePan={togglePanMode}
        onToggleZoomWindow={toggleZoomWindowMode}
        onOpenSSOT={() => setSsotModalOpen(true)}
        callAPI={callAPI}
      />

      <BelkaHierarchyBar projectModel={projectModel} />

      <ViewCube onSetView={(view) => callAPI('setView', view)} />

      {/* ─── Panel edycji (moduły: Korpus, Bloki, Formatka…) ── */}
      <PanelEdycji
        editPanelWidth={editPanelWidth}
        isDraggingEdit={isDraggingEdit}
        startResizeEdit={startResizeEdit}
      >
          {/* Tab 1: A4 SmartPanel */}
        <div className={`tab-content ${activeTab === 'tab-a4-smartpanel' ? 'active' : ''}`} id="tab-a4-smartpanel">
          <div className="panel-header">
            <h2>Formatka</h2>
            <p className="subtitle">Wstawianie i formatki</p>
          </div>
          
          <div className="panel-section">
            <div
              className="panel-drag-card"
              draggable
              onDragStart={(e) => {
                const payload = { width: 720, height: 510, thickness: 18 };
                e.dataTransfer.setData('application/cad-new-panel', JSON.stringify(payload));
                e.dataTransfer.effectAllowed = 'copy';
                (window as any).__draggedNewPanel = payload;
              }}
              onDragEnd={() => {
                (window as any).__draggedNewPanel = null;
              }}
              onClick={() => callAPI('addSmartPanel')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: 'var(--bg-secondary, #252528)',
                border: '1px solid var(--border-color, #3a3a3e)',
                borderRadius: '6px',
                cursor: 'grab',
                transition: 'all 0.15s ease',
                userSelect: 'none',
                marginBottom: '10px'
              }}
              title={tx(srcTekst, 'app.add_panel_title', TX_NS)}
            >
              <span className="hand-icon" title={tx(srcTekst, 'app.add_panel_drag', TX_NS)} style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                  <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                  <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </svg>
              </span>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#f3f4f6' }}>{tx(srcTekst, 'app.add_panel', TX_NS)}</span>
            </div>
          </div>
        </div>

        {/* Tab 2: A2 Bloki */}
        <div 
          className={`tab-content ${activeTab === 'tab-a2-bloki' ? 'active' : ''}`} 
          id="tab-a2-bloki"
          style={{ 
            height: 'auto', 
            display: activeTab === 'tab-a2-bloki' ? 'flex' : 'none', 
            flexDirection: 'column', 
            overflowY: 'visible', 
            overflowX: 'hidden' 
          }}
        >
          <div className="panel-header" style={{ flexShrink: 0, background: '#18181b', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px' }}>
            <h2 style={{ fontSize: '13px', margin: 0, fontWeight: 700, lineHeight: '1.2' }}>Bloki</h2>
          </div>
          <BlokiUI projectModel={projectModel} />
        </div>

        {/* Tab: AGD */}
        <div 
          className={`tab-content ${activeTab === 'tab-agd' ? 'active' : ''}`} 
          id="tab-agd" 
          style={{ height: 'auto', display: activeTab === 'tab-agd' ? 'flex' : 'none', flexDirection: 'column' }}
        >
          <AgdPanel projectModel={projectModel} />
        </div>

        {/* Tab: B1 Biblioteka Korpusów */}
        <div className={`tab-content ${activeTab === 'tab-b1-biblioteka' ? 'active' : ''}`} id="tab-b1-biblioteka" style={{ height: 'auto', display: activeTab === 'tab-b1-biblioteka' ? 'flex' : 'none', flexDirection: 'column' }}>
          <CabinetLibraryPanel 
            projectModel={projectModel} 
            onOpenSaveModal={() => setSaveCabinetModalOpen(true)}
          />
        </div>

        {/* Tab 3: A3 SmartFrame */}
        <div className={`tab-content ${activeTab === 'tab-a3-smartframe' ? 'active' : ''}`} id="tab-a3-smartframe">
          <SmartFrameUI projectModel={projectModel} />
        </div>

        {/* Tab: S4 Ściany */}
        <div
          className={`tab-content ${activeTab === 'tab-s4-sciany' ? 'active' : ''}`}
          id="tab-s4-sciany"
          style={{ height: 'auto', display: activeTab === 'tab-s4-sciany' ? 'flex' : 'none', flexDirection: 'column' }}
        >
          <ScianyUI projectModel={projectModel} />
        </div>

        {/* Tab 4: A7 Material */}
        <div className={`tab-content ${activeTab === 'tab-a7-material' ? 'active' : ''}`} id="tab-a7-material" style={{ height: 'auto', display: activeTab === 'tab-a7-material' ? 'flex' : 'none', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2>{tx(srcTekst, 'app.materials_title', TX_NS)}</h2>
            <p className="subtitle">{tx(srcTekst, 'app.materials_sub', TX_NS)}</p>
          </div>
          <MaterialsUI 
            projectModel={projectModel}
          />
        </div>

        {/* Tab: S2 Solver */}
        <div className={`tab-content ${activeTab === 'tab-s2-solver' ? 'active' : ''}`} id="tab-s2-solver" style={{ height: 'auto', maxHeight: 'calc(100vh - 120px)', display: activeTab === 'tab-s2-solver' ? 'flex' : 'none', flexDirection: 'column', overflowY: 'auto' }}>
          <div className="panel-header">
            <h2>{SOLVER_PANEL_TITLE}</h2>
            <p className="subtitle">{tx(srcTekst, 'app.relations_sub', TX_NS)}</p>
          </div>
          <SolverUI projectModel={projectModel} />
        </div>

        {/* Tab: C2 Connectors */}
        {activeTab === 'tab-c2-connectors' && (
          <div className="tab-content active" id="tab-c2-connectors" style={{ height: 'auto', maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div className="panel-header">
              <h2>{CONNECTORS_PANEL_TITLE}</h2>
              <p className="subtitle">{tx(srcTekst, 'app.joints_sub', TX_NS)}</p>
            </div>
            <ConnectorsUI projectModel={projectModel} />
          </div>
        )}

        {activeTab === 'tab-o1-operacji' && (
          <div className="tab-content active" id="tab-o1-operacji" style={{ height: 'auto', maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div className="panel-header">
              <h2>{OPERACJE_PANEL_TITLE}</h2>
              <p className="subtitle">{tx(srcTekst, 'app.ops_sub', TX_NS)}</p>
            </div>
            <OperacjeUI />
          </div>
        )}

        {/* Tab 8: E1 Export */}
        <div className={`tab-content ${activeTab === 'tab-e1-export' ? 'active' : ''}`} id="tab-e1-export" style={{ height: 'auto', display: activeTab === 'tab-e1-export' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ExportUI />
        </div>
      </PanelEdycji>

      {/* ─── 3D Canvas ─────────────────────────────────── */}
      <canvas 
        id="renderCanvas" 
        style={{ width: '100%', height: '100%', display: 'block' }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          const bayCtrl = ContextManager.instance.blokiBayController;
          if (bayCtrl && (bayCtrl.isDragging || bayCtrl.isBayDrag())) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const scene = ContextManager.instance.viewport?.scene;
            const doc = ContextManager.instance.document || projectModel;
            if (scene && doc) {
              bayCtrl.onPointerMoveOnScene(scene, x, y, doc);
              ContextManager.instance.viewport?.requestRender(2);
            }
            return;
          }
          const frameDragCtrl = ContextManager.instance.smartFrameDragController;
          if (frameDragCtrl && frameDragCtrl.isDragging) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const scene = ContextManager.instance.viewport?.scene;
            if (scene) {
              frameDragCtrl.onPointerMoveOnScene(scene, x, y);
              ContextManager.instance.viewport?.requestRender(2);
            }
            return;
          }
          const wallDragCtrl = (ContextManager.instance as any).smartWallDragController;
          if (wallDragCtrl && wallDragCtrl.isDragging) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const scene = ContextManager.instance.viewport?.scene;
            if (scene) {
              wallDragCtrl.onPointerMoveOnScene(scene, x, y);
              ContextManager.instance.viewport?.requestRender(2);
            }
            return;
          }
          const handleDragCtrl = HandleDragController.instance;
          if (handleDragCtrl && handleDragCtrl.isDragging) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const scene = ContextManager.instance.viewport?.scene;
            const doc = ContextManager.instance.document || projectModel;
            if (scene && doc) {
              handleDragCtrl.onPointerMoveOnScene(scene, x, y, doc);
              ContextManager.instance.viewport?.requestRender(2);
            }
            return;
          }
          const hangerDragCtrl = HangerDragController.instance;
          if (hangerDragCtrl && hangerDragCtrl.isDragging) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const scene = ContextManager.instance.viewport?.scene;
            const doc = ContextManager.instance.document || projectModel;
            if (scene && doc) {
              hangerDragCtrl.onPointerMoveOnScene(scene, x, y, doc);
              ContextManager.instance.viewport?.requestRender(2);
            }
            return;
          }
        }}
        onDragLeave={() => {
          const bayCtrl = ContextManager.instance.blokiBayController;
          if (bayCtrl && (bayCtrl.isDragging || bayCtrl.isBayDrag())) {
            clearBayHighlight();
            ContextManager.instance.viewport?.requestRender(2);
          }
          const frameDragCtrl = ContextManager.instance.smartFrameDragController;
          if (frameDragCtrl && frameDragCtrl.isDragging) {
            frameDragCtrl.endDrag();
            ContextManager.instance.viewport?.requestRender(2);
          }
          const wallDragCtrl = (ContextManager.instance as any).smartWallDragController;
          if (wallDragCtrl && wallDragCtrl.isDragging) {
            wallDragCtrl.endDrag();
            ContextManager.instance.viewport?.requestRender(2);
          }
          const handleDragCtrl = HandleDragController.instance;
          if (handleDragCtrl && handleDragCtrl.isDragging) {
            handleDragCtrl.endDrag();
            ContextManager.instance.viewport?.requestRender(2);
          }
          const hangerDragCtrl = HangerDragController.instance;
          if (hangerDragCtrl && hangerDragCtrl.isDragging) {
            hangerDragCtrl.endDrag();
            ContextManager.instance.viewport?.requestRender(2);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const bayCtrl = ContextManager.instance.blokiBayController;
          if (bayCtrl && (bayCtrl.isDragging || bayCtrl.isBayDrag())) {
            if (bayCtrl.lastDetectedBay || bayCtrl.lastDetectedSurface) {
              bayCtrl.onDropOnScene();
              return;
            } else {
              bayCtrl.endDrag();
            }
          }
          const frameDragCtrl = ContextManager.instance.smartFrameDragController;
          if (frameDragCtrl && frameDragCtrl.isDragging) {
            const doc = ContextManager.instance.document || projectModel;
            const ok = frameDragCtrl.onDropOnScene(doc);
            if (ok) {
              const active = doc?.activeEntity;
              const id = active?.id;
              if (id) {
                openCadEditEntity({ entityId: id, kind: 'korpus' });
              }
              window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
              window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
              ContextManager.instance.viewport?.requestRender(2);
            }
            return;
          }
          const wallDragCtrl = (ContextManager.instance as any).smartWallDragController;
          if (wallDragCtrl && wallDragCtrl.isDragging) {
            const doc = ContextManager.instance.document || projectModel;
            wallDragCtrl.onDropOnScene(doc);
            return;
          }
          const handleDragCtrl = HandleDragController.instance;
          if (handleDragCtrl && handleDragCtrl.isDragging) {
            const doc = ContextManager.instance.document || projectModel;
            const created = handleDragCtrl.onDropOnScene(doc);
            if (created) {
              const model = created.domainData || created;
              doc?.setActiveEntity?.(model);
              const containerId = model?.id || created.id;
              if (containerId) {
                openCadEditEntity({ entityId: containerId, kind: 'smartpart' });
              }
              window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
              window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
              ContextManager.instance.viewport?.requestRender(2);
            }
            return;
          }
          const hangerDragCtrl = HangerDragController.instance;
          if (hangerDragCtrl && hangerDragCtrl.isDragging) {
            const doc = ContextManager.instance.document || projectModel;
            const group = hangerDragCtrl.onDropOnScene(doc);
            if (group) {
              const model = group.domainData || group;
              doc?.setActiveEntity?.(model);
              const containerId = model?.id || group.id;
              if (containerId) {
                openCadEditEntity({ entityId: containerId, kind: 'blok' });
              }
              window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
              window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
              ContextManager.instance.viewport?.requestRender(2);
            }
            return;
          }
          const draggedOperation = (window as any).__draggedCadOperation || (() => {
            try {
              const raw = e.dataTransfer.getData(OPERACJE_DRAG_MIME);
              return raw ? JSON.parse(raw) : null;
            } catch { return null; }
          })();

          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const scene = ContextManager.instance.viewport?.scene;
          if (!scene) return;

          if (draggedOperation && draggedOperation.library_id === 'led_channel') {
            const pick = scene.pick(x, y);
            handleLedChannelDrop(pick, draggedOperation.channelId);
            (window as any).__draggedCadOperation = null;
            return;
          }

          if (draggedOperation && draggedOperation.library_id) {
            const pick = scene.pick(x, y);
            const applied = applyLibraryOperationFromPick(pick, draggedOperation.library_id, {
              insetLMm: draggedOperation.insetLMm,
              insetRMm: draggedOperation.insetRMm,
              insetTMm: draggedOperation.insetTMm,
              insetBMm: draggedOperation.insetBMm,
              through: draggedOperation.through,
              fill: draggedOperation.fill,
              depthMm: draggedOperation.depthMm,
              widthMm: draggedOperation.widthMm,
              heightMm: draggedOperation.heightMm,
              uMm: draggedOperation.uMm,
              vMm: draggedOperation.vMm,
            });
            (window as any).__draggedCadOperation = null;
            if (applied) {
              const panel = pick?.pickedMesh?.metadata?.panelModel;
              if (panel) {
                ContextManager.instance?.document?.setActiveEntity?.(panel);
                window.dispatchEvent(new CustomEvent(CAD_OPEN_FLOATING_OPERATION, {
                  detail: {
                    library_id: draggedOperation.library_id,
                    featureId: applied.id,
                    panelId: panel.id,
                    face: applied.face,
                  },
                }));
              }
            }
            return;
          }

          const draggedAppliance = (window as any).__draggedAppliance || (() => {
            try {
              const raw = e.dataTransfer.getData('application/cad-appliance-template');
              return raw ? JSON.parse(raw) : null;
            } catch { return null; }
          })();

          if (draggedAppliance) {
            const doc = ContextManager.instance.document || projectModel;
            if (doc) {
              const pick = scene.pick(x, y);
              let dropX = 0;
              let dropY = 0;
              let dropZ = 700;

              if (pick && pick.hit && pick.pickedPoint) {
                dropX = pick.pickedPoint.x;
                dropY = pick.pickedPoint.z;
                dropZ = pick.pickedPoint.y;
              } else {
                const ray = scene.createPickingRay(x, y, (window as any).BABYLON?.Matrix?.Identity?.() || (scene.activeCamera?.getWorldMatrix?.() ? scene.activeCamera.getWorldMatrix() : null), scene.activeCamera);
                if (ray && (window as any).BABYLON) {
                  const groundPlane = (window as any).BABYLON.Plane.FromPositionAndNormal(new (window as any).BABYLON.Vector3(0, 0, 0), new (window as any).BABYLON.Vector3(0, 1, 0));
                  const dist = ray.intersectsPlane(groundPlane);
                  if (dist !== null && dist !== undefined) {
                    const hitPoint = ray.origin.add(ray.direction.scale(dist));
                    dropX = hitPoint.x;
                    dropY = hitPoint.z;
                    dropZ = 0;
                  }
                }
              }

              createSmartAppliance({
                kind: draggedAppliance.kind,
                name: draggedAppliance.name,
                position: { x: dropX, y: dropY, z: dropZ },
                params: draggedAppliance.defaultParams,
              }, doc);

              (window as any).__draggedAppliance = null;
              window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
              window.document.dispatchEvent(new CustomEvent('bloki-properties-update'));
            }
            return;
          }

          const draggedNewPanel = (window as any).__draggedNewPanel || (() => {
            try {
              const raw = e.dataTransfer.getData('application/cad-new-panel');
              return raw ? JSON.parse(raw) : null;
            } catch { return null; }
          })();

          if (draggedNewPanel) {
            const doc = ContextManager.instance.document || projectModel;
            if (doc) {
              const ray = scene.createPickingRay(x, y, (window as any).BABYLON?.Matrix?.Identity?.() || (scene.activeCamera?.getWorldMatrix?.() ? scene.activeCamera.getWorldMatrix() : null), scene.activeCamera);
              let dropX = 0;
              let dropZ = 0;
              if (ray && (window as any).BABYLON) {
                const groundPlane = (window as any).BABYLON.Plane.FromPositionAndNormal(new (window as any).BABYLON.Vector3(0, 0, 0), new (window as any).BABYLON.Vector3(0, 1, 0));
                const dist = ray.intersectsPlane(groundPlane);
                if (dist !== null && dist !== undefined) {
                  const hitPoint = ray.origin.add(ray.direction.scale(dist));
                  dropX = hitPoint.x;
                  dropZ = hitPoint.z;
                }
              }
              const pWidth = Number(draggedNewPanel.width) || 720;
              const pHeight = Number(draggedNewPanel.height) || 510;
              const pThickness = Number(draggedNewPanel.thickness) || 18;

              const newPanel = new PanelModel({
                width: mmToNm(pWidth),
                height: mmToNm(pHeight),
                thickness: mmToNm(pThickness),
                name: tx(srcTekst, 'app.manual_panel', TX_NS),
                role: 'MANUAL_PANEL',
                engineManaged: false,
              });

              const pNode = CADNode.create(NodeType.PART, newPanel.name, newPanel.id);
              pNode.domainData = newPanel;
              pNode.setLocalTransform(
                new Vec3(mmToNm(dropX), mmToNm(pHeight / 2), mmToNm(dropZ)),
                Quat.IDENTITY
              );

              const cmdHist = ContextManager.instance.commandHistory;
              if (cmdHist) {
                cmdHist.execute(new AddNodeCommand(doc.rootNode.id, pNode, undefined, tx(srcTekst, 'app.cmd_add_panel', TX_NS)));
              } else {
                doc.addNode(doc.rootNode.id, pNode);
              }
              doc.setActiveEntity(newPanel);
              window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cad-open-floating-panel-edit', {
                  detail: { panelId: newPanel.id }
                }));
              }
              UIController.instance?.setStatus(tx(srcTekst, 'app.status_panel_added', TX_NS, { w: pWidth, h: pHeight }));
            }
            (window as any).__draggedNewPanel = null;
            return;
          }

          const draggedCadNode = (window as any).__draggedCadNode || (() => {
            try {
              const raw = e.dataTransfer.getData('application/cad-node');
              return raw ? JSON.parse(raw) : null;
            } catch { return null; }
          })();

          if (draggedCadNode && (draggedCadNode.nodeId || draggedCadNode.id)) {
            const nodeId = draggedCadNode.nodeId || draggedCadNode.id;
            const doc = ContextManager.instance.document;
            if (doc && (doc as any).duplicateCADNode) {
              const ray = scene.createPickingRay(x, y, (window as any).BABYLON?.Matrix?.Identity?.() || (scene.activeCamera?.getWorldMatrix?.() ? scene.activeCamera.getWorldMatrix() : null), scene.activeCamera);
              let dropX = 300;
              let dropZ = 0;
              if (ray && (window as any).BABYLON) {
                const groundPlane = (window as any).BABYLON.Plane.FromPositionAndNormal(new (window as any).BABYLON.Vector3(0, 0, 0), new (window as any).BABYLON.Vector3(0, 1, 0));
                const dist = ray.intersectsPlane(groundPlane);
                if (dist !== null && dist !== undefined) {
                  const hitPoint = ray.origin.add(ray.direction.scale(dist));
                  dropX = hitPoint.x;
                  dropZ = hitPoint.z;
                }
              }
              const cloned = (doc as any).duplicateCADNode(nodeId, { x: 0, y: 0, z: 0 });
              if (cloned) {
                const { rotation, scale } = cloned.localMatrix.decompose();
                cloned.setLocalTransform(
                  new Vec3(mmToNm(dropX), 0, mmToNm(dropZ)),
                  rotation,
                  scale
                );
                doc.emitChange('structure', [cloned.id]);
                window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
              }
            }
            (window as any).__draggedCadNode = null;
            return;
          }

          const draggedType = (window as any).__draggedType;
          const draggedEdge = (window as any).__draggedEdge;

          const pick = scene.pick(x, y);
          const panel = pick?.pickedMesh?.metadata?.panelModel;
          const faceName = pick?.pickedMesh?.metadata?.faceName || pick?.pickedMesh?.name?.replace('face_', '');

          if (draggedType === 'EDGE_BANDING' || draggedEdge) {
            const edge = draggedEdge || materialDatabase.getEdgeBandingTypes()[0];
            if (!panel || !edge) return;

            const doc = ContextManager.instance.document || UIController.instance?.document;
            const node = doc?.findNode ? doc.findNode(panel.id) : null;
            const nodeId = node ? node.id : panel.id;

            const edgeKeyMap: Record<string, string> = {
              'left': '-X',
              'FACE_X_MINUS': '-X',
              'right': '+X',
              'FACE_X_PLUS': '+X',
              'top': '+Y',
              'FACE_Y_PLUS': '+Y',
              'bottom': '-Y',
              'FACE_Y_MINUS': '-Y'
            };

            const outlineEdgeKey = (pick?.pickedMesh?.metadata as any)?.outlineEdgeKey as string | undefined;
            const targetEdgeKey = edgeKeyMap[faceName] || outlineEdgeKey || 'ALL';
            const isRemoval = edge.id === 'REMOVE_EDGE' || edge.active === false;
            const edgeConfig = isRemoval ? {
              active: false,
              type_id: 'none',
              name: 'Brak',
              thickness_mm: 0
            } : {
              active: true,
              type_id: edge.id,
              name: edge.name,
              thickness_mm: edge.thickness_mm,
              width_mm: edge.width_mm,
              price_per_mb: edge.price_per_mb || 3.50
            };

            const cmd = new SetEdgeBandingCommand(nodeId, targetEdgeKey, edgeConfig, 'SINGLE');
            if (ContextManager.instance.commandHistory) {
              ContextManager.instance.commandHistory.execute(cmd);
            } else if (doc && (doc as any).executeCommand) {
              (doc as any).executeCommand(cmd);
            } else if (doc) {
              cmd.execute(doc);
            }

            (window as any).__draggedEdge = null;
            (window as any).__draggedType = null;
            return;
          }

          const matId = e.dataTransfer.getData('text/plain');
          const mat = (window as any).__draggedMaterial || (matId ? materialDatabase.getMaterialById(matId) : null);
          if (!mat) return;

          if (panel) {
            setDropModal({
              material: mat,
              targetPanel: panel,
              x: Math.min(e.clientX, window.innerWidth - 320),
              y: Math.min(e.clientY, window.innerHeight - 300)
            });
          }
        }}
      ></canvas>

      {/* ─── Nakładka Ramki Powiększającej (Zoom Window Rubberband) ─── */}
      {isZoomWindowActive && (
        <div
          id="zoom-window-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 35,
            cursor: 'crosshair',
            pointerEvents: 'auto',
            userSelect: 'none',
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            const canvas = document.getElementById('renderCanvas');
            const rect = canvas ? canvas.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
            const startX = e.clientX - rect.left;
            const startY = e.clientY - rect.top;
            zoomStartRef.current = { startX, startY };
            setZoomBox({ x1: startX, y1: startY, x2: startX, y2: startY });
          }}
          onPointerMove={(e) => {
            if (!zoomStartRef.current) return;
            e.preventDefault();
            const canvas = document.getElementById('renderCanvas');
            const rect = canvas ? canvas.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
            const currX = e.clientX - rect.left;
            const currY = e.clientY - rect.top;
            setZoomBox({
              x1: zoomStartRef.current.startX,
              y1: zoomStartRef.current.startY,
              x2: currX,
              y2: currY,
            });
          }}
          onPointerUp={(e) => {
            if (!zoomStartRef.current) return;
            e.preventDefault();
            const canvas = document.getElementById('renderCanvas');
            const rect = canvas ? canvas.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
            const currX = e.clientX - rect.left;
            const currY = e.clientY - rect.top;
            const { startX, startY } = zoomStartRef.current;
            zoomStartRef.current = null;
            setZoomBox(null);
            setIsZoomWindowActive(false);
            UIController.instance?.setStatus('Gotowe');

            const width = Math.abs(currX - startX);
            const height = Math.abs(currY - startY);
            if (width > 8 && height > 8) {
              const vp = ContextManager.instance.viewport;
              if (vp && typeof vp.zoomToWindow === 'function') {
                vp.zoomToWindow(startX, startY, currX, currY);
              }
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            zoomStartRef.current = null;
            setZoomBox(null);
            setIsZoomWindowActive(false);
            UIController.instance?.setStatus('Gotowe');
          }}
        >
          {zoomBox && (() => {
            const left = Math.min(zoomBox.x1, zoomBox.x2);
            const top = Math.min(zoomBox.y1, zoomBox.y2);
            const width = Math.abs(zoomBox.x2 - zoomBox.x1);
            const height = Math.abs(zoomBox.y2 - zoomBox.y1);
            if (width < 2 && height < 2) return null;
            return (
              <div
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width,
                  height,
                  border: '2px dashed #38bdf8',
                  backgroundColor: 'rgba(56, 189, 248, 0.18)',
                  boxShadow: '0 0 12px rgba(56, 189, 248, 0.35)',
                  pointerEvents: 'none',
                }}
              />
            );
          })()}
        </div>
      )}

      {uiRegionHint && (
        <div className="scene-ui-region-hint" role="status">
          {uiRegionHint}
        </div>
      )}

      {/* ─── Okno Kontekstowe Wyboru Zasięgu po Przeciągnięciu (Drag & Drop Scope Modal) ─── */}
      {dropModal && (
        <div 
          style={{
            position: 'fixed',
            left: `${dropModal.x}px`,
            top: `${dropModal.y}px`,
            backgroundColor: '#18181b',
            border: '1px solid #3b82f6',
            boxShadow: '0 12px 30px rgba(0,0,0,0.85), 0 0 20px rgba(59,130,246,0.35)',
            borderRadius: '8px',
            padding: '12px',
            zIndex: 100000,
            width: '290px',
            color: '#fff',
            fontFamily: 'Inter, Segoe UI, sans-serif'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setDropModal(null);
            if (e.key === '1') handleApplyDropScope('SINGLE');
            if (e.key === '2') handleApplyDropScope('CONTAINER');
            if (e.key === '3') handleApplyDropScope('BLOKI');
            if (e.key === '4') handleApplyDropScope('PROJECT');
          }}
          tabIndex={0}
          autoFocus
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #27272a', paddingBottom: '6px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa' }}>
              <span>{tx(srcTekst, 'app.apply_material', TX_NS)}</span>
            </div>
            <button 
              onClick={() => setDropModal(null)}
              style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
            >
              ✕
            </button>
          </div>

          {/* Info Card */}
          <div style={{ background: '#222225', padding: '8px', borderRadius: '6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '4px',
              backgroundColor: dropModal.material.hexColor || `rgb(${dropModal.material.color.r * 255}, ${dropModal.material.color.g * 255}, ${dropModal.material.color.b * 255})`,
              backgroundImage: dropModal.material.thumbnail_path ? `url("${dropModal.material.thumbnail_path}")` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid rgba(255,255,255,0.25)',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dropModal.material.name} ({dropModal.material.thickness_mm} mm)
              </div>
              <div style={{ color: '#93c5fd' }}>
                {tx(srcTekst, 'app.drop_panel', TX_NS)} <strong>{dropModal.targetPanel.name || tx(srcTekst, 'app.panel_default', TX_NS)}</strong>
              </div>
            </div>
          </div>

          {/* Scope Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => handleApplyDropScope('SINGLE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '11px',
                textAlign: 'left'
              }}
            >
              <span>🎯 Tylko ta formatka</span>
              <span style={{ opacity: 0.75, fontSize: '10px', background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '3px' }}>[1]</span>
            </button>

            <button
              onClick={() => handleApplyDropScope('CONTAINER')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: '#27272a',
                color: '#e4e4e7',
                border: '1px solid #3f3f46',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '11px',
                textAlign: 'left'
              }}
            >
              <span>{tx(srcTekst, 'app.scope_body', TX_NS)}</span>
              <span style={{ opacity: 0.75, fontSize: '10px', background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '3px' }}>[2]</span>
            </button>

            <button
              onClick={() => handleApplyDropScope('BLOKI')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: '#27272a',
                color: '#e4e4e7',
                border: '1px solid #3f3f46',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '11px',
                textAlign: 'left'
              }}
            >
              <span>{tx(srcTekst, 'app.scope_box', TX_NS)}</span>
              <span style={{ opacity: 0.75, fontSize: '10px', background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '3px' }}>[3]</span>
            </button>

            <button
              onClick={() => handleApplyDropScope('PROJECT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: '#27272a',
                color: '#e4e4e7',
                border: '1px solid #3f3f46',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '11px',
                textAlign: 'left'
              }}
            >
              <span>{tx(srcTekst, 'app.scope_project', TX_NS)}</span>
              <span style={{ opacity: 0.75, fontSize: '10px', background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '3px' }}>[4]</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Panel właściwości (overlay, nie panel edycji) ─── */}
      <PropertiesPanel />

      {/* ─── Status bar ────────────────────────────────── */}
      <div 
        id="statusBar" 
        className={`status-bar ${uiState?.statusBarActive ? 'active' : ''} ${
          uiState?.statusKind === 'error' ? 'status-bar--error' : uiState?.statusKind === 'warning' ? 'status-bar--warning' : ''
        }`}
      >
        <span className="status-dot"></span>
        <span id="statusText">{uiState?.statusText || tx(srcTekst, 'app.status_default', TX_NS)}</span>
      </div>

      {/* ─── Podpowiedzi na dole z lewej (nad paskiem stanu) ─── */}
      {activeHint && (
        <div style={{
          position: 'absolute',
          bottom: '56px',
          left: '16px',
          maxWidth: '560px',
          backgroundColor: 'var(--bg-panel, rgba(20, 20, 24, 0.95))',
          border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
          boxShadow: 'var(--shadow-sm, 0 4px 12px rgba(0,0,0,0.4))',
          color: 'var(--text-main, #e4e4e7)',
          padding: '8px 16px',
          borderRadius: 'var(--radius-sm, 6px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.92rem',
          fontFamily: 'Inter, Segoe UI, sans-serif',
          pointerEvents: 'none',
          backdropFilter: 'blur(12px)'
        }}>
          {activeHint.title && (
            <span style={{ fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>
              {activeHint.title} -
            </span>
          )}
          <span style={{ color: '#d4d4d8', lineHeight: 1.35 }}>{activeHint.description}</span>
          {activeHint.confirmKey && (
            <span style={{ backgroundColor: '#374151', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
              [{activeHint.confirmKey}] {tx(srcTekst, 'app.hint_confirm', TX_NS)}
            </span>
          )}
          {activeHint.cancelKey && (
            <span style={{ backgroundColor: '#374151', color: '#9ca3af', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
              [{activeHint.cancelKey}] Anuluj
            </span>
          )}
        </div>
      )}

      {/* ─── Modal Podglądu JSON SSOT ───────────────────── */}
      {ssotModalOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setSsotModalOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSsotModalOpen(false);
          }}
          tabIndex={0}
        >
          <div 
            style={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              width: 'min(900px, 92vw)',
              height: 'min(680px, 85vh)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 24px rgba(59, 130, 246, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: '#e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>📄</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>JSON SSOT</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Single Source of Truth — aktualne drzewo modelu CAD</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSsotModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
                title="Zamknij (Esc)"
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <SSOTUI projectModel={projectModel} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Opcji Wydajności (GPU / Płynność) ────────── */}
      <PerformanceOptionsModal 
        isOpen={perfModalOpen} 
        onClose={() => setPerfModalOpen(false)} 
      />

      {/* ─── Modal Google Drive (Chmura) ──────────────────────── */}
      <GoogleDriveModal 
        isOpen={gdriveModalMode !== null} 
        initialMode={gdriveModalMode || 'open'} 
        onClose={() => setGdriveModalMode(null)} 
      />

      {/* ─── Modale SaaS (Auth, Dashboard projektów, Paywall) ────── */}
      <SaaSAuthModal
        isOpen={saasAuthModalOpen}
        onClose={() => setSaasAuthModalOpen(false)}
        onSuccess={() => setSaasDashboardOpen(true)}
      />

      <SaaSProjectsDashboardModal
        isOpen={saasDashboardOpen}
        onClose={() => setSaasDashboardOpen(false)}
        onOpenPaywall={() => {
          setSaasDashboardOpen(false);
          setSaasPaywallFeature(tx(srcTekst, 'saas.pro_feature_locked', TX_NS, { name: 'SmartPanel Cloud' }));
        }}
      />

      <SaaSPaywallModal
        isOpen={saasPaywallFeature !== null}
        featureTitle={saasPaywallFeature || undefined}
        onClose={() => setSaasPaywallFeature(null)}
      />

      {/* ─── Modal Nowego Projektu (Zapisz / Nie zapisuj / Anuluj) ─── */}
      <NewProjectModal
        isOpen={newProjectModalOpen}
        isDirty={!!(projectModel?.isDirty?.())}
        projectName={projectModel?.name || 'Projekt'}
        onSaveAndNew={handleSaveAndNewProject}
        onDiscardAndNew={handleDiscardAndNewProject}
        onCancel={() => setNewProjectModalOpen(false)}
      />

      {/* ─── Modal Zapisu Korpusu do Biblioteki ───────────────────── */}
      <SaveCabinetModal
        open={saveCabinetModalOpen}
        onClose={() => setSaveCabinetModalOpen(false)}
        projectModel={projectModel}
      />

      {/* ─── Bottom Console (Hover Info) ───────────────── */}
      <div id="bottomConsole" className="bottom-console">
        <span className="console-prefix">&gt;</span>
        <span id="consoleText" className="console-text">
          {uiState?.consoleText || tx(srcTekst, 'app.console_default', TX_NS)}
        </span>
      </div>

      {/* Okno edycji operacji (pływające, swobodne okno nad sceną 3D) */}
      <FloatingOperationDialog />
      <FloatingEditHost projectModel={projectModel} />

      {/* Modal Weryfikacji i Raportu Rozbieżności CNC (PPM Batch) */}
      <CncValidationReportModal />

      {/* Wybór zakrytych płaszczyzn QuickPick (a'la Solid Edge) */}
      <QuickPickPopup />

    </div>
  );
}
