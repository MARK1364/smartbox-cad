import React, { useEffect, useState, useRef, useCallback } from 'react';
import { unit } from '../A1_core/unit-system';
import { UIController, PANEL_DIM_MAX_MM, PANEL_DIM_MIN_MM } from '../A1_core/ui-controller';
import { SmartFrameUI } from '../A3_smartframe/smartframe-ui';
import { SmartBoxUI } from '../A2_smartbox/smartbox-ui';
import { SSOTUI } from './ssot-ui';
import { PerformanceOptionsModal } from './PerformanceOptionsModal';
import { GoogleDriveModal } from './GoogleDriveModal';
import { NewProjectModal } from './NewProjectModal';
import { PropertiesPanel } from './PropertiesPanel';
import { FloatingOperationDialog, CAD_OPEN_FLOATING_OPERATION } from './FloatingOperationDialog';
import { BelkaDisplayModeMenu, BelkaProjectionMenu, BelkaInfoMenu } from './BelkaDisplayModeMenu';
import { MaterialsUI } from '../A7_material/materials-ui';
import { AssignMaterialCommand, SetEdgeBandingCommand } from '../A7_material/material-commands';
import { materialDatabase } from '../A7_material/material-database';
import { MaterialScope } from '../A7_material/material-types';
import { ContextManager } from '../A1_core/context-manager';
import { applyTabSelectionPolicy } from '../A1_core/selection-highlight';
import { toggleDimensionTool } from '../A8_pmi/pmi-tool-activate.js';
import { TooltipManager } from '../A1_core/tooltip-manager';
import { useUiRegionEdgeHint } from './use-ui-region-edge-hint';
import { CAMStateStore } from '../C1_cnc/core/cam-state-store';
import { SmartNumericInput } from '../A1_core/ui/SmartNumericInput';
import { AssociativeDimInputs } from '../A4_smartpanel/associative-dim-ui';
import { isAssocComplete } from '../A4_smartpanel/associative-dim';
import { PMIUI } from '../A8_pmi/pmi-ui';
import { SolverUI, SOLVER_PANEL_TITLE } from '../S2_solver/solver-ui';
import { ConnectorsUI, CONNECTORS_PANEL_TITLE } from '../C2_connectors/connectors-ui';
import { stopConnectorPick } from '../C2_connectors/connector-picker';
import { OperacjeUI, OPERACJE_PANEL_TITLE, OPERACJE_DRAG_MIME, applyLibraryOperationFromPick, CAD_EDIT_LIBRARY_OPERATION, featureOperationLabel, featureOperationDetails, isLibraryOperation, isEngineGroove } from '../o1_operacji';
import { ConnectorVisualizer } from '../C2_connectors/connector-visualizer';
import { isSolverSmartFrameIsolationActive, applyPanelViewSolverVisibility, isSolverTabActive } from '../S2_solver/solver-visibility';
import { ExportUI, ExportEngine } from '../E1_export';
import { DrawingProjectExtractor } from '../R2_rys';
import { E3LibraryExtractor } from '../R2_rys';
import { Vec3 } from '../A1_core/cad-math/vec3';
import { Quat } from '../A1_core/cad-math/quat';
import { mmToNm } from '../A1_core/cad-math/units';
import { PanelModel } from '../A4_smartpanel/panel-model';
import { CADNode } from '../A1_core/cad-node/cad-node';
import { NodeType } from '../A1_core/cad-node/node-type';
import { AddNodeCommand } from '../A1_core/commands/add-node-command';
import { SceneTree } from './SceneTree';
import { openCncFromCad, installModuleRefreshBridge } from './module-data/open-modules';
import { CAD_WINDOW_NAME, installCadModuleBridge } from './module-data/session';
import { CAD_TREE_START_RENAME } from './module-data/tree-context-menu';
import { SmartBoxBayController } from '../A2_smartbox/smartbox-bay-controller';
import { SmartFrameDragController } from '../A3_smartframe/smartframe-drag-controller';
import { createSmartBoxInDetectedBay, SMARTBOX_CATEGORY_NAMES } from '../A2_smartbox/smartbox-bay-actions';
import { clearBayHighlight } from '../A2_smartbox/smartbox-bay-visualizer';
import { ModalTransformManager, type ModalTransformMode } from '../A1_core/modal-transform';

function useModalTransformState() {
  const [mode, setMode] = useState<ModalTransformMode>(() => ModalTransformManager.instance.activeMode);

  useEffect(() => {
    const unsub = ModalTransformManager.instance.subscribe((currentMode) => {
      setMode(currentMode);
    });
    return () => {
      unsub();
    };
  }, []);

  return mode;
}

// Hook to observe TooltipManager active tool hints
function useToolHint() {
  const [activeHint, setActiveHint] = useState<any>(null);

  useEffect(() => {
    setActiveHint(TooltipManager.instance.activeHint);
    const unsubscribe = TooltipManager.instance.onChange((hint) => {
      setActiveHint(hint ? { ...hint } : null);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return activeHint;
}
// Helper hook to trigger re-renders when project document updates
function useProjectDocument() {
  const [tick, setTick] = useState(0);
  const [projectModel, setProjectModel] = useState<any>(null);

  useEffect(() => {
    const checkInstance = () => {
      const model = UIController.instance?.document;
      if (model) {
        setProjectModel(model);
        const listener = () => setTick(t => t + 1);
        const unsubscribe = model.onDocumentChanged(listener);
        // Initial sync
        setTick(t => t + 1);
        return () => {
          if (typeof unsubscribe === 'function') unsubscribe();
        };
      } else {
        setTimeout(checkInstance, 50);
      }
    };
    checkInstance();
  }, []);

  return projectModel;
}

// Hook to observe UIController state changes (status text, console, selected face)
function useUIState() {
  const [uiState, setUiState] = useState<any>(null);

  useEffect(() => {
    const checkInstance = () => {
      const controller = UIController.instance;
      if (controller) {
        setUiState({ ...controller.state });
        controller.onStateChange = () => {
          setUiState({ ...controller.state });
        };
      } else {
        setTimeout(checkInstance, 50);
      }
    };
    checkInstance();
  }, []);

  return uiState;
}

export default function App({ initialTab }: { initialTab?: string } = {}) {
  const projectModel = useProjectDocument();
  const uiState = useUIState();
  const activeHint = useToolHint();
  const modalTransformMode = useModalTransformState();
  const [activeTab, setActiveTab] = useState(initialTab || 'tab-a3-smartframe');
  const [renderMode, setRenderModeState] = useState('edges');
  const [gridVisible, setGridVisible] = useState(true);
  const [projection, setProjection] = useState('ortho');
  const [lcsVisible, setLcsVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<{ type: string; id: any; panelId?: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isPanActive, setIsPanActive] = useState(false);
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
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);

  useEffect(() => {
    ContextManager.instance.requestNewProjectDialog = () => {
      setNewProjectModalOpen(true);
    };
    return () => {
      ContextManager.instance.requestNewProjectDialog = null;
    };
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

  // ─── Szerokości paneli (Drzewo obiektów i Panel edycji) z pamięcią w localStorage ───
  const TREE_MIN_CONTENT_WIDTH = 280;
  const EDIT_MIN_CONTENT_WIDTH = 340;
  const COLLAPSED_PANEL_WIDTH = 32;
  const COLLAPSE_SNAP_THRESHOLD = 75;

  const lastTreeWidthRef = useRef<number>(280);
  const lastEditWidthRef = useRef<number>(340);

  const [treeWidth, setTreeWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cad_tree_panel_width');
      const last = localStorage.getItem('cad_last_tree_width');
      if (last) {
        const lVal = parseInt(last, 10);
        if (!isNaN(lVal) && lVal >= 160) lastTreeWidthRef.current = lVal;
      }
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) {
          if (val <= 48) return COLLAPSED_PANEL_WIDTH;
          if (val >= 100 && val <= 900) return val;
        }
      }
    } catch {}
    return 280;
  });

  const [editPanelWidth, setEditPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cad_edit_panel_width');
      const last = localStorage.getItem('cad_last_edit_width');
      if (last) {
        const lVal = parseInt(last, 10);
        if (!isNaN(lVal) && lVal >= 200) lastEditWidthRef.current = lVal;
      }
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) {
          if (val <= 48) return COLLAPSED_PANEL_WIDTH;
          if (val >= 100 && val <= 1000) return val;
        }
      }
    } catch {}
    return 340;
  });

  const [isDraggingTree, setIsDraggingTree] = useState(false);
  const [isDraggingEdit, setIsDraggingEdit] = useState(false);

  const startResizeTree = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingTree(true);
    const startX = e.clientX;
    const startW = treeWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (moveEv: PointerEvent) => {
      const delta = moveEv.clientX - startX;
      const maxW = Math.floor(window.innerWidth * 0.45);
      const rawW = startW + delta;
      const newW = rawW < COLLAPSE_SNAP_THRESHOLD ? COLLAPSED_PANEL_WIDTH : Math.max(COLLAPSED_PANEL_WIDTH, Math.min(maxW, rawW));
      setTreeWidth(newW);
    };

    const onPointerUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsDraggingTree(false);

      const dragDistance = Math.abs(upEv.clientX - startX);
      if (dragDistance < 4) {
        // Kliknięcie w krawędź / gizmo bez przeciągania -> toggle zwiń / rozwiń
        if (treeWidth <= 48) {
          const restored = lastTreeWidthRef.current || 280;
          setTreeWidth(restored);
          try { localStorage.setItem('cad_tree_panel_width', String(restored)); } catch {}
        } else {
          lastTreeWidthRef.current = treeWidth;
          try { localStorage.setItem('cad_last_tree_width', String(treeWidth)); } catch {}
          setTreeWidth(COLLAPSED_PANEL_WIDTH);
          try { localStorage.setItem('cad_tree_panel_width', String(COLLAPSED_PANEL_WIDTH)); } catch {}
        }
        return;
      }

      // Zakończone przeciąganie
      const finalDelta = upEv.clientX - startX;
      const maxW = Math.floor(window.innerWidth * 0.45);
      const rawW = startW + finalDelta;
      const finalW = rawW < COLLAPSE_SNAP_THRESHOLD ? COLLAPSED_PANEL_WIDTH : Math.max(COLLAPSED_PANEL_WIDTH, Math.min(maxW, rawW));
      setTreeWidth(finalW);
      if (finalW > 48) {
        lastTreeWidthRef.current = finalW;
        try { localStorage.setItem('cad_last_tree_width', String(finalW)); } catch {}
      }
      try {
        localStorage.setItem('cad_tree_panel_width', String(finalW));
      } catch {}
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [treeWidth]);

  const startResizeEdit = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEdit(true);
    const startX = e.clientX;
    const startW = editPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (moveEv: PointerEvent) => {
      const delta = startX - moveEv.clientX;
      const maxW = Math.floor(window.innerWidth * 0.5);
      const rawW = startW + delta;
      const newW = rawW < COLLAPSE_SNAP_THRESHOLD ? COLLAPSED_PANEL_WIDTH : Math.max(COLLAPSED_PANEL_WIDTH, Math.min(maxW, rawW));
      setEditPanelWidth(newW);
    };

    const onPointerUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsDraggingEdit(false);

      const dragDistance = Math.abs(startX - upEv.clientX);
      if (dragDistance < 4) {
        // Kliknięcie w krawędź / gizmo bez przeciągania -> toggle zwiń / rozwiń
        if (editPanelWidth <= 48) {
          const restored = lastEditWidthRef.current || 340;
          setEditPanelWidth(restored);
          try { localStorage.setItem('cad_edit_panel_width', String(restored)); } catch {}
        } else {
          lastEditWidthRef.current = editPanelWidth;
          try { localStorage.setItem('cad_last_edit_width', String(editPanelWidth)); } catch {}
          setEditPanelWidth(COLLAPSED_PANEL_WIDTH);
          try { localStorage.setItem('cad_edit_panel_width', String(COLLAPSED_PANEL_WIDTH)); } catch {}
        }
        return;
      }

      // Zakończone przeciąganie
      const finalDelta = startX - upEv.clientX;
      const maxW = Math.floor(window.innerWidth * 0.5);
      const rawW = startW + finalDelta;
      const finalW = rawW < COLLAPSE_SNAP_THRESHOLD ? COLLAPSED_PANEL_WIDTH : Math.max(COLLAPSED_PANEL_WIDTH, Math.min(maxW, rawW));
      setEditPanelWidth(finalW);
      if (finalW > 48) {
        lastEditWidthRef.current = finalW;
        try { localStorage.setItem('cad_last_edit_width', String(finalW)); } catch {}
      }
      try {
        localStorage.setItem('cad_edit_panel_width', String(finalW));
      } catch {}
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [editPanelWidth]);

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

              const shouldShow = isolate
                  ? isTargetPanel
                  : model.visible !== false;

              if (view.root) {
                  try { view.root.setEnabled(shouldShow); } catch {}
              }
              if (view.faceMeshes) {
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
                              m.setEnabled(shouldShow);
                              m.visibility = shouldShow ? faceVis : 0.0;
                              m.isVisible = shouldShow && !wireframe;
                          } catch {}
                      }
                  });
              }
              if (view._edgeMeshes && Array.isArray(view._edgeMeshes)) {
                  const showEdge = shouldShow && currentMode !== 'shaded';
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
                  name.startsWith('SmartBox') ||
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
                      const showEdge = shouldShowMesh && currentMode !== 'shaded';
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

  // Collapsible nodes state
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

    import('../A1_core/app.ts').then(() => {
      console.log('Core app loaded successfully in React');
    }).catch(err => {
      console.error('Failed to load core app.ts:', err);
    });

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

  // Auto-switch tab when a SmartBox is selected
  useEffect(() => {
    if (ContextManager.instance.activeReferencePicker) return;
    if (ContextManager.instance.activeConstraintPicker) return;
    const active = projectModel?.activeEntity;
    if (active && active.type === 'container' && active.generatorParams?.type?.startsWith('smartbox')) {
      setActiveTab('tab-a2-smartbox');
    }
  }, [projectModel?.activeEntity]);

  useEffect(() => {
    const onEditOp = () => setActiveTab('tab-o1-operacji');
    const onEditSmartFrame = () => setActiveTab('tab-a3-smartframe');
    const onSwitchTab = (e: any) => {
      if (e.detail?.tabId) setActiveTab(e.detail.tabId);
    };

    window.addEventListener(CAD_EDIT_LIBRARY_OPERATION, onEditOp);
    window.addEventListener('cad-edit-smartframe-korpus', onEditSmartFrame);
    window.addEventListener('cad-switch-tab', onSwitchTab as EventListener);

    return () => {
      window.removeEventListener(CAD_EDIT_LIBRARY_OPERATION, onEditOp);
      window.removeEventListener('cad-edit-smartframe-korpus', onEditSmartFrame);
      window.removeEventListener('cad-switch-tab', onSwitchTab as EventListener);
    };
  }, []);

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

  // SVGs for toolbar and tree nodes
  const icons = {
    project: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
    part: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>,
    opsFolder: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
    tool: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>,
    eyeShow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
    eyeHide: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>,
    trash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
    chevronDown: <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.6 }}><path d="M6 9l6 6 6-6"></path></svg>,
    chevronRight: <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.6 }}><path d="M9 5l7 7-7 7"></path></svg>
  };

  // Hierarchy Node Inline Renaming Finished
  const finishRename = (save: boolean) => {
    if (!editingNode || !UIController.instance) return;
    if (save && editValue.trim()) {
      const newName = editValue.trim();
      if (editingNode.type === 'project') {
        UIController.instance.emitTree('rename-project', { name: newName });
      } else if (editingNode.type === 'part') {
        UIController.instance.emitTree('rename-part', { id: editingNode.id, uuid: editingNode.id, name: newName });
      } else if (editingNode.type === 'container') {
        UIController.instance.emitTree('rename-container', { id: editingNode.id, name: newName });
      } else if (editingNode.type === 'feature') {
        UIController.instance.emitTree('rename-feature', { id: editingNode.id, name: newName });
      }
    }
    setEditingNode(null);
  };

  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  useEffect(() => {
    const handlePropsUpdate = (e: any) => {
      if (e.detail && e.detail.featureId) {
        setSelectedFeatureId(e.detail.featureId);
      } else if (e.detail && e.detail.kind === 'panel') {
        setSelectedFeatureId(null);
      }
    };
    document.addEventListener('smartbox-properties-update', handlePropsUpdate);
    const handleStartRename = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (!d.type || !d.id) return;
      setEditingNode({ type: d.type, id: d.id, panelId: d.panelId });
      setEditValue(String(d.name || ''));
    };
    window.addEventListener(CAD_TREE_START_RENAME, handleStartRename);

    if (!ContextManager.instance.smartBoxBayController) {
      ContextManager.instance.smartBoxBayController = new SmartBoxBayController();
    }
    if (!ContextManager.instance.smartFrameDragController) {
      ContextManager.instance.smartFrameDragController = new SmartFrameDragController();
    }

    const handleBayDetected = (bayOrEvt: any) => {
      const bay = bayOrEvt?.detail || bayOrEvt;
      if (!bay) return;
      const ctrl = ContextManager.instance.smartBoxBayController;
      const optId = ctrl?.pendingSmartBoxType || ctrl?.draggedSmartBoxType || 'EMPTY';
      const doc = ContextManager.instance.document || projectModel;
      if (doc) {
        const scene = ContextManager.instance.viewport?.scene;
        if (scene) clearBayHighlight(scene);

        const typeMap: Record<string, { type: string; label: string }> = {
          'EMPTY': { type: 'smartbox_empty', label: '' },
          'SHELVES': { type: 'smartbox_shelves', label: 'polki' },
          'DRAWERS': { type: 'smartbox_drawers', label: 'szuflady' },
          'DOORS': { type: 'smartbox_doors', label: 'drzwi' },
          'TUBES': { type: 'smartbox_tubes', label: 'drazek' },
          'SHELF': { type: 'smartbox_shelf', label: 'wieniec' },
          'DIVIDERS': { type: 'smartbox_dividers', label: 'przegrody' },
          'FLAPS': { type: 'smartbox_flaps', label: 'klapy' },
          'PANELS': { type: 'smartbox_panels', label: 'blendy' }
        };
        const opt = typeMap[optId] || { type: `smartbox_${optId.toLowerCase()}`, label: optId.toLowerCase() };

        const sbNode = createSmartBoxInDetectedBay(doc, bay, {
          id: optId,
          type: opt.type,
          category: optId === 'PANELS' ? 'external' : 'internal',
          label: opt.label,
          icon: '',
          description: ''
        });
        if (sbNode) {
          if (ctrl) {
            ctrl.setPendingSmartBoxType(null);
            ctrl.endDrag();
          }
          setActiveTab('tab-a2-smartbox');
          doc.setActiveEntity(sbNode.domainData || sbNode);
        }
      }
    };

    window.addEventListener('smartbox-bay-detected', handleBayDetected);

    return () => {
      document.removeEventListener('smartbox-properties-update', handlePropsUpdate);
      window.removeEventListener(CAD_TREE_START_RENAME, handleStartRename);
      window.removeEventListener('smartbox-bay-detected', handleBayDetected);
    };
  }, []);

  // Render tree helper
  const renderTree = () => {
    if (!projectModel) return null;

    const renderFeatures = (features: any[], panelId: string) => {
      const isOpsCollapsed = collapsedNodes[panelId + '_ops'] === true;
      if (isOpsCollapsed) return null;

      if (!features || features.length === 0) {
        return (
          <div style={{ fontSize: '11px', padding: '2px 12px 2px 22px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Brak operacji
          </div>
        );
      }

      // Grupowanie otworów o tej samej średnicy i głębokości
      const displayItems: Array<{
        isGroup: boolean;
        features: any[];
        primary: any;
      }> = [];

      const processedHoleIds = new Set<string>();

      for (let i = 0; i < features.length; i++) {
        const f = features[i];
        if (processedHoleIds.has(f.id)) continue;
        // Otwory rzutowane na boki korpusu — tylko scena 3D, nie drzewo (drzewo = operacje pod półką)
        if (f.params?.isShelfDrilling || f.params?.isDoorDrilling || f.params?.isDrawerDrilling) continue;

        const isHole = f.type?.toLowerCase() === 'hole' || f.type === 'drill';
        if (!isHole) {
          displayItems.push({ isGroup: false, features: [f], primary: f });
          continue;
        }

        const dia = f.params?.diameter || f.dim?.x || 5;
        const dep = f.params?.depth || f.dim?.z || 12;

        const matchingHoles = features.filter((other, otherIdx) => {
          if (otherIdx < i) return false;
          const otherIsHole = other.type?.toLowerCase() === 'hole' || other.type === 'drill';
          if (!otherIsHole) return false;
          const otherDia = other.params?.diameter || other.dim?.x || 5;
          const otherDep = other.params?.depth || other.dim?.z || 12;
          return dia === otherDia && dep === otherDep;
        });

        if (matchingHoles.length > 1) {
          for (const mh of matchingHoles) processedHoleIds.add(mh.id);
          displayItems.push({ isGroup: true, features: matchingHoles, primary: matchingHoles[0] });
        } else {
          displayItems.push({ isGroup: false, features: [f], primary: f });
        }
      }

      return displayItems.map(item => {
        const f = item.primary;
        const count = item.features.length;
        const isVisible = item.features.some(feat => feat.visible !== false);
        const isEditing = !item.isGroup && editingNode?.type === 'feature' && editingNode?.id === f.id;
        const isSelected = item.features.some(feat => selectedFeatureId === feat.id) ? 'selected' : '';
        const dia = f.params?.diameter || f.dim?.x || 5;
        const dep = f.params?.depth || f.dim?.z || 12;
        
        let defaultName = f.type === 'fillet' ? 'Zaokrąglenie' : (f.type?.toLowerCase() === 'hole' ? 'Otwór' : f.type);
        if (f.params?.source === 'library') {
          defaultName = f.name || f.params.library_id || 'Operacja';
        }
        if (item.isGroup) {
          defaultName = `Otwory (${count}x)`;
        }
        const name = item.isGroup ? `Otwory (${count}x)` : (f.name || defaultName);
        const details = f.params?.source === 'library'
          ? `${Math.round(f.params?.width || 0)}×${Math.round(f.params?.length || 0)}×${Math.round(f.params?.depth || 0)}`
          : (f.type === 'fillet' ? `R${f.params?.radius || 0}` : `⌀${dia}x${dep}`);
        const isFrozen = item.features.every(feat => feat.frozen || feat.params?.frozen);
        const isLibraryOp = item.features.some(feat => feat.params?.source === 'library');
        const isAuto = !isLibraryOp && item.features.some(feat => feat.params?.isBackGroove || feat.is_smartbox_child || feat.is_assembly_drilling || feat.params?.isShelfDrilling || feat.params?.isDoorDrilling || feat.params?.isDrawerDrilling || feat.params?.isConnectorDrilling || feat.params?.template_id || feat.type === 'groove');

        return (
          <div key={item.isGroup ? `grp_${f.id}_${count}` : f.id} className={`tree-node ${isSelected}`} style={{ opacity: isVisible ? (isFrozen ? 0.85 : 1) : 0.6 }}>
            <div 
              className="tree-node-content"
              onClick={() => {
                for (const feat of item.features) {
                  UIController.instance?.emitTree('select-feature', { id: feat.id, panelId: panelId });
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                UIController.instance?.emitTree('select-feature', { id: f.id, panelId: panelId });
                UIController.instance?.emitTree('contextmenu-tree-node', {
                  type: 'feature',
                  id: f.id,
                  clientX: e.clientX,
                  clientY: e.clientY
                });
              }}
              onDoubleClick={() => {
                if (!item.isGroup) {
                  setEditingNode({ type: 'feature', id: f.id, panelId: panelId });
                  setEditValue(name);
                }
              }}
            >
              {/* Spacer instead of chevron to align icon */}
              <span style={{ width: '10px', display: 'inline-block', flexShrink: 0 }} />
              {icons.tool}
              {isEditing ? (
                <input
                  type="text"
                  value={editValue}
                  className="node-name-input"
                  style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none' }}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => finishRename(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') finishRename(true);
                    if (e.key === 'Escape') finishRename(false);
                  }}
                  autoFocus
                />
              ) : (
                <span className="node-name-text">{name}</span>
              )}
              <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>[{details}]</span>
            </div>
            <div className="tree-node-actions">
              {isAuto && (
                <button 
                  className="tree-action-btn btn-freeze" 
                  title={isFrozen ? "Zamrożona obróbka (kliknij aby odmrozić)" : "Zamroź obróbkę (kliknij aby zablokować)"}
                  style={{ 
                    color: isFrozen ? '#38bdf8' : '#ffffff', 
                    opacity: isFrozen ? 1 : 0.4,
                    fontSize: '12px',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    for (const feat of item.features) {
                      UIController.instance?.emitTree('toggle-freeze-feature', { id: feat.id, panelId: panelId });
                    }
                  }}
                >
                  ❄️
                </button>
              )}
              <button 
                className="tree-action-btn btn-toggle-vis" 
                title="Ukryj/Pokaż"
                onClick={(e) => {
                  e.stopPropagation();
                  for (const feat of item.features) {
                    UIController.instance?.emitTree('toggle-visibility', { id: feat.id, panelId: panelId });
                  }
                }}
              >
                {isVisible ? icons.eyeShow : icons.eyeHide}
              </button>
              {!isAuto && (
                <button 
                  className="tree-action-btn btn-delete" 
                  title="Usuń"
                  onClick={(e) => {
                    e.stopPropagation();
                    for (const feat of item.features) {
                      UIController.instance?.emitTree('delete-feature', { id: feat.id, panelId: panelId });
                    }
                  }}
                >
                  {icons.trash}
                </button>
              )}
            </div>
          </div>
        );
      });
    };

    const renderPanelNode = (panel: any) => {
      const partVisible = panel.visible !== false;
      const isSelected = projectModel.activeEntity === panel ? 'selected' : '';
      const panelUid = panel.smartId?.uid || panel.id;
      const isEditing = editingNode?.type === 'part' && editingNode?.id === panelUid;
      const isPanelCollapsed = !collapsedNodes[panelUid];

      return (
        <div key={panel.smartId?.fullPath || panel.name + Math.random()} className="tree-children">
          <div 
            className={`tree-node ${isSelected}`} 
            style={{ opacity: partVisible ? 1 : 0.6, cursor: 'grab' }}
            draggable={!editingNode}
            onDragStart={(e) => {
              e.stopPropagation();
              const payload = {
                type: 'PANEL',
                id: panel.id,
                uid: panel.smartId?.uid || panel.id,
                name: panel.name || 'Formatka',
                raw: panel
              };
              (window as any).__draggedCadNode = payload;
              try {
                e.dataTransfer.setData('application/cad-node', JSON.stringify(payload));
                e.dataTransfer.setData('text/plain', panel.smartId?.uid || panel.id);
                e.dataTransfer.effectAllowed = 'copyMove';
              } catch {}
            }}
            onDragEnd={() => {
              (window as any).__draggedCadNode = null;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const matId = e.dataTransfer.getData('text/plain');
              const mat = (window as any).__draggedMaterial || (matId ? materialDatabase.getMaterialById(matId) : null);
              if (mat && panel) {
                setDropModal({
                  material: mat,
                  targetPanel: panel,
                  x: Math.min(e.clientX, window.innerWidth - 320),
                  y: Math.min(e.clientY, window.innerHeight - 300)
                });
              }
            }}
          >
            <div 
              className="tree-node-content"
              onClick={() => UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.smartId?.uid || panel.id })}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.smartId?.uid || panel.id });
                UIController.instance?.emitTree('contextmenu-tree-node', {
                  type: 'part',
                  id: panel.smartId?.uid || panel.id || panel.name,
                  uuid: panel.smartId?.uid,
                  panelRef: panel,
                  clientX: e.clientX,
                  clientY: e.clientY
                });
              }}
              onDoubleClick={() => {
                setEditingNode({ type: 'part', id: panelUid });
                setEditValue(panel.name || 'Płyta');
              }}
            >
              <span className="tree-chevron" onClick={(e) => toggleCollapse(panelUid, e)}>
                {isPanelCollapsed ? icons.chevronRight : icons.chevronDown}
              </span>
              {icons.part}
              {isEditing ? (
                <input
                  type="text"
                  value={editValue}
                  className="node-name-input"
                  style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none' }}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => finishRename(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') finishRename(true);
                    if (e.key === 'Escape') finishRename(false);
                  }}
                  autoFocus
                />
              ) : (
                <strong className="node-name-text">{panel.name || 'Płyta'}</strong>
              )}
              <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>
                ({unit.toMM(panel.width)}x{unit.toMM(panel.height)}x{unit.toMM(panel.thickness)})
              </span>
              {panel.cncPrograms && panel.cncPrograms.length > 0 && (
                <span title="Formatka posiada utworzone programy CNC" style={{ marginLeft: '6px', backgroundColor: '#1e3a8a', color: '#93c5fd', padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, border: '1px solid #3b82f6' }}>
                  ⚙️ CNC ({panel.cncPrograms.length})
                </span>
              )}
            </div>
            <div className="tree-node-actions">
              <button 
                className="tree-action-btn btn-freeze-part" 
                title={panel.frozen ? "Zamrożona formatka (kliknij aby odmrozić)" : "Zamroź formatkę (zablokuj przed automatycznym przeliczaniem)"}
                style={{ 
                  color: panel.frozen ? '#38bdf8' : '#ffffff', 
                  opacity: panel.frozen ? 1 : 0.4,
                  fontSize: '12px',
                  transition: 'all 0.15s ease'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  UIController.instance?.emitTree('toggle-freeze-part', { id: panel.id, uuid: panel.smartId?.uid });
                }}
              >
                ❄️
              </button>
              <button 
                className="tree-action-btn btn-duplicate-part" 
                title="Utwórz kopię 3D formatki na scenie"
                onClick={(e) => {
                  e.stopPropagation();
                  const doc = ContextManager.instance.document;
                  if (doc && (doc as any).duplicateCADNode) {
                    (doc as any).duplicateCADNode(panel.id, { x: 200, y: 0, z: 0 });
                    window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
                  }
                }}
              >
                📋
              </button>
              <button 
                className="tree-action-btn btn-toggle-part-vis" 
                title="Ukryj/Pokaż"
                onClick={(e) => {
                  e.stopPropagation();
                  UIController.instance?.emitTree('toggle-part-visibility', { id: panel.smartId?.uid || panel.id || panel.name, uuid: panel.smartId?.uid, panelRef: panel });
                }}
              >
                {partVisible ? icons.eyeShow : icons.eyeHide}
              </button>
            </div>
          </div>
          
          {!isPanelCollapsed && (
            <div className="tree-children">
              <div className="tree-node">
                <div 
                  className="tree-node-content"
                  onClick={(e) => {
                    UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.smartId?.uid || panel.id });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.smartId?.uid || panel.id });
                    UIController.instance?.emitTree('contextmenu-tree-node', {
                      type: 'folder',
                      id: panel.id,
                      clientX: e.clientX,
                      clientY: e.clientY
                    });
                  }}
                >
                  <span className="tree-chevron" onClick={(e) => toggleCollapse(panelUid + '_ops', e)}>
                    {collapsedNodes[panelUid + '_ops'] ? icons.chevronRight : icons.chevronDown}
                  </span>
                  {icons.opsFolder}
                  <strong>Operacje CAD</strong>
                </div>
              </div>
              <div className="tree-children">
                {renderFeatures(panel.features, panelUid)}
              </div>

              {panel.cncPrograms && panel.cncPrograms.length > 0 && (
                <div style={{ marginTop: '2px' }}>
                  <div className="tree-node">
                    <div 
                      className="tree-node-content"
                      onClick={(e) => toggleCollapse(panelUid + '_cnc', e)}
                    >
                      <span className="tree-chevron" onClick={(e) => toggleCollapse(panelUid + '_cnc', e)}>
                        {collapsedNodes[panelUid + '_cnc'] ? icons.chevronRight : icons.chevronDown}
                      </span>
                      <span style={{ marginRight: '6px', fontSize: '12px' }}>⚙️</span>
                      <strong style={{ color: '#93c5fd' }}>Programy CNC ({panel.cncPrograms.length})</strong>
                    </div>
                  </div>
                  {!collapsedNodes[panelUid + '_cnc'] && (
                    <div className="tree-children">
                      {panel.cncPrograms.map((prog: any, idx: number) => (
                        <div key={prog.id || idx} className="tree-node">
                          <div 
                            className="tree-node-content"
                            style={{ paddingLeft: '24px', cursor: 'pointer', color: '#e0f2fe' }}
                            onClick={() => {
                              UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.smartId?.uid || panel.id });
                              const store = CAMStateStore.getInstance();
                              store.setPrograms(panel.cncPrograms || []);
                              store.setActiveProgramId(prog.id);
                              openCncFromCad({
                                type: 'PANEL',
                                id: panel.id || panel.smartId?.uid,
                                name: panel.name || 'Formatka',
                              });
                            }}
                          >
                            <span style={{ marginRight: '6px', color: '#60a5fa' }}>📄</span>
                            <strong>Program {prog.name || `00${idx+1}`}</strong>
                            <span style={{ color: '#94a3b8', fontSize: '10px', marginLeft: '6px' }}>({prog.wcsName || 'G55'})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 🔲 Obrzeża Krawędzi */}
              {(() => {
                const eb = panel.edgeBanding || panel.custom_properties?.edge_banding || {};
                const edgeList = [
                  { key: '+Y', name: 'Górna (+Y)' },
                  { key: '-Y', name: 'Dolna / Przód (-Y)' },
                  { key: '-X', name: 'Lewa (-X)' },
                  { key: '+X', name: 'Prawa (+X)' }
                ];
                const activeCount = edgeList.filter(e => {
                  const s = eb[e.key];
                  return s?.active === true || (s?.active !== false && s?.type_id && s.type_id !== 'none');
                }).length;

                const isEbCollapsed = !!collapsedNodes[panelUid + '_eb'];
                const pv = ContextManager.instance.panelViews?.get(panel);

                return (
                  <div style={{ marginTop: '2px' }}>
                    <div className="tree-node">
                      <div 
                        className="tree-node-content"
                        onClick={(e) => toggleCollapse(panelUid + '_eb', e)}
                      >
                        <span className="tree-chevron" onClick={(e) => toggleCollapse(panelUid + '_eb', e)}>
                          {isEbCollapsed ? icons.chevronRight : icons.chevronDown}
                        </span>
                        <span style={{ marginRight: '6px', fontSize: '12px' }}>🔲</span>
                        <strong style={{ color: activeCount > 0 ? '#4ade80' : '#a1a1aa' }}>
                          Obrzeża ({activeCount}/4)
                        </strong>
                      </div>
                    </div>
                    {!isEbCollapsed && (
                      <div className="tree-children">
                        {edgeList.map(({ key, name }) => {
                          const slot = eb[key];
                          const isBanded = slot?.active === true || (slot?.active !== false && slot?.type_id && slot.type_id !== 'none');
                          const edgeTitle = isBanded ? (slot.name || slot.type_id || 'ABS 0.8x22') : 'Brak (surowy rdzeń)';

                          return (
                            <div 
                              key={key} 
                              className="tree-node"
                              onMouseEnter={() => pv?.highlightEdgeFace?.(key, true)}
                              onMouseLeave={() => pv?.highlightEdgeFace?.(key, false)}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const draggedEdge = (window as any).__draggedEdge || materialDatabase.getEdgeBandingTypes()[0];
                                const doc = ContextManager.instance.document || UIController.instance?.document;
                                const cmd = new SetEdgeBandingCommand(panel.id, key, {
                                  active: true,
                                  type_id: draggedEdge.id,
                                  name: draggedEdge.name,
                                  thickness_mm: draggedEdge.thickness_mm,
                                  width_mm: draggedEdge.width_mm,
                                  price_per_mb: draggedEdge.price_per_mb || 3.50
                                }, 'SINGLE');
                                if (ContextManager.instance.commandHistory) {
                                  ContextManager.instance.commandHistory.execute(cmd);
                                } else if (doc && (doc as any).executeCommand) {
                                  (doc as any).executeCommand(cmd);
                                } else if (doc) {
                                  cmd.execute(doc);
                                }
                              }}
                            >
                              <div 
                                className="tree-node-content"
                                style={{ paddingLeft: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                                onClick={() => {
                                  UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.smartId?.uid || panel.id });
                                  setActiveTab('tab-a7-material');
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                  <span style={{ fontSize: '10px', color: isBanded ? '#4ade80' : '#71717a' }}>
                                    {isBanded ? '🟩' : '⬜'}
                                  </span>
                                  <strong style={{ fontSize: '11px', color: isBanded ? '#e4e4e7' : '#71717a' }}>
                                    {name}:
                                  </strong>
                                  <span style={{ fontSize: '10px', color: isBanded ? '#38bdf8' : '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {edgeTitle}
                                  </span>
                                </div>

                                <div className="tree-node-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {isBanded ? (
                                    <button
                                      className="tree-action-btn btn-delete"
                                      title="Usuń to obrzeże"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const doc = ContextManager.instance.document || UIController.instance?.document;
                                        const cmd = new SetEdgeBandingCommand(panel.id, key, { active: false, type_id: 'none' }, 'SINGLE');
                                        if (ContextManager.instance.commandHistory) {
                                          ContextManager.instance.commandHistory.execute(cmd);
                                        } else if (doc && (doc as any).executeCommand) {
                                          (doc as any).executeCommand(cmd);
                                        } else if (doc) {
                                          cmd.execute(doc);
                                        }
                                      }}
                                    >
                                      ✕
                                    </button>
                                  ) : (
                                    <button
                                      className="tree-action-btn"
                                      title="Dodaj obrzeże"
                                      style={{ color: '#60a5fa', fontSize: '11px' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const defaultEdge = materialDatabase.getEdgeBandingTypes()[0];
                                        const doc = ContextManager.instance.document || UIController.instance?.document;
                                        const cmd = new SetEdgeBandingCommand(panel.id, key, {
                                          active: true,
                                          type_id: defaultEdge.id,
                                          name: defaultEdge.name,
                                          thickness_mm: defaultEdge.thickness_mm,
                                          width_mm: defaultEdge.width_mm,
                                          price_per_mb: defaultEdge.price_per_mb || 3.50
                                        }, 'SINGLE');
                                        if (ContextManager.instance.commandHistory) {
                                          ContextManager.instance.commandHistory.execute(cmd);
                                        } else if (doc && (doc as any).executeCommand) {
                                          (doc as any).executeCommand(cmd);
                                        } else if (doc) {
                                          cmd.execute(doc);
                                        }
                                      }}
                                    >
                                      ➕
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      );
    };

    const renderContainerNode = (container: any) => {
      const containerVisible = container.visible !== false;
      const isSelected = projectModel.activeEntity === container ? 'selected' : '';
      const isContainerCollapsed = !collapsedNodes[container.id];
      const isSmartBox = container.generatorParams?.type?.startsWith('smartbox') || 
                         container.generatorParams?.boxType !== undefined || 
                         container.is_smartbox || 
                         container.type === 'smartbox' || 
                         (container.name && String(container.name).toLowerCase().includes('smartbox')) ||
                         (container.name && String(container.name).endsWith('_SB'));

      return (
        <div key={container.id} className="tree-children">
          <div 
            className={`tree-node ${isSelected}`} 
            style={{ opacity: containerVisible ? 1 : 0.6, cursor: 'grab' }}
            draggable={!editingNode}
            onDragStart={(e) => {
              e.stopPropagation();
              const payload = {
                type: isSmartBox ? 'SMARTBOX' : 'CONTAINER',
                id: container.id,
                name: container.name || (isSmartBox ? 'SmartBox' : 'Korpus'),
                raw: container
              };
              (window as any).__draggedCadNode = payload;
              try {
                e.dataTransfer.setData('application/cad-node', JSON.stringify(payload));
                e.dataTransfer.setData('text/plain', container.id);
                e.dataTransfer.effectAllowed = 'copyMove';
              } catch {}
            }}
            onDragEnd={() => {
              (window as any).__draggedCadNode = null;
            }}
          >
            <div 
              className="tree-node-content"
              onClick={() => UIController.instance?.emitTree('select-container', { id: container.id })}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                UIController.instance?.emitTree('select-container', { id: container.id });
                UIController.instance?.emitTree('contextmenu-tree-node', {
                  type: isSmartBox ? 'smartbox' : 'container',
                  id: container.id,
                  name: container.name || (isSmartBox ? 'SmartBox' : 'Korpus'),
                  clientX: e.clientX,
                  clientY: e.clientY
                });
              }}
            >
              <span className="tree-chevron" onClick={(e) => toggleCollapse(container.id, e)}>
                {isContainerCollapsed ? icons.chevronRight : icons.chevronDown}
              </span>
              {icons.project}
              <strong className="node-name-text">{container.name || 'Kontener'}</strong>
              <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>
                ({unit.toMM(container.width)}x{unit.toMM(container.height)}x{unit.toMM(container.depth)})
              </span>
            </div>
            <div className="tree-node-actions">
              <button 
                className="tree-action-btn btn-duplicate-part" 
                title="Utwórz kopię 3D korpusu na scenie"
                onClick={(e) => {
                  e.stopPropagation();
                  const doc = ContextManager.instance.document;
                  if (doc && (doc as any).duplicateCADNode) {
                    (doc as any).duplicateCADNode(container.id, { x: 300, y: 0, z: 0 });
                    window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
                  }
                }}
              >
                📋
              </button>
              <button 
                className="tree-action-btn btn-toggle-part-vis" 
                title="Ukryj/Pokaż"
                onClick={(e) => {
                  e.stopPropagation();
                  UIController.instance?.emitTree('toggle-container-visibility', { id: container.id });
                }}
              >
                {containerVisible ? icons.eyeShow : icons.eyeHide}
              </button>
              <button 
                className="tree-action-btn btn-delete" 
                title="Usuń kontener"
                onClick={(e) => {
                  e.stopPropagation();
                  UIController.instance?.emitTree('delete-container', { id: container.id });
                }}
              >
                {icons.trash}
              </button>
            </div>
          </div>
          {!isContainerCollapsed && (() => {
            const containerNode = projectModel?.findNode(container.id);
            if (!containerNode) return null;
            return containerNode.children.map((childNode: any) => {
              const child = childNode.domainData;
              if (!child) return null;
              if (childNode.nodeType === 'ASSEMBLY' || child.type === 'container') return renderContainerNode(child);
              return renderPanelNode(child);
            });
          })()}
        </div>
      );
    };

    const isProjectEditing = editingNode?.type === 'project';
    const isProjectCollapsed = !!collapsedNodes['project-root'];

    return (
      <div className="tree-root">
        <div 
          className="tree-node" 
          id="nodeProject"
          style={{ cursor: 'grab' }}
          draggable={!editingNode}
          onDragStart={(e) => {
            e.stopPropagation();
            const payload = {
              type: 'PROJECT',
              id: 'ALL',
              name: projectModel?.name || 'Cały Projekt'
            };
            (window as any).__draggedCadNode = payload;
            try {
              e.dataTransfer.setData('application/cad-node', JSON.stringify(payload));
              e.dataTransfer.setData('text/plain', 'ALL');
              e.dataTransfer.effectAllowed = 'copyMove';
            } catch {}
          }}
          onDragEnd={() => {
            (window as any).__draggedCadNode = null;
          }}
        >
          <div 
            className="tree-node-content"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              UIController.instance?.emitTree('contextmenu-tree-node', {
                type: 'project',
                id: 'root',
                clientX: e.clientX,
                clientY: e.clientY
              });
            }}
            onDoubleClick={() => {
              setEditingNode({ type: 'project', id: 'root' });
              setEditValue(projectModel?.name || 'Projekt');
            }}
          >
            <span className="tree-chevron" onClick={(e) => toggleCollapse('project-root', e)}>
              {isProjectCollapsed ? icons.chevronRight : icons.chevronDown}
            </span>
            {icons.project}
            {isProjectEditing ? (
              <input
                type="text"
                value={editValue}
                className="node-name-input"
                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none' }}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => finishRename(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') finishRename(true);
                  if (e.key === 'Escape') finishRename(false);
                }}
                autoFocus
              />
            ) : (
              <strong className="node-name-text">{projectModel?.name || 'Projekt'}</strong>
            )}
          </div>
        </div>
        {!isProjectCollapsed && projectModel?.rootNode?.children.map((childNode: any) => {
          const entity = childNode.domainData;
          if (!entity) return null;
          if (childNode.nodeType === 'ASSEMBLY' || entity.type === 'container') return renderContainerNode(entity);
          return renderPanelNode(entity);
        })}
      </div>
    );
  };

  const selectedPanel = projectModel?.activeEntity;
  const selectedPart = selectedPanel && selectedPanel.type === 'part' ? selectedPanel : null;
  const widthFromPlanes = isAssocComplete(selectedPart?.associativeDims?.width);
  const heightFromPlanes = isAssocComplete(selectedPart?.associativeDims?.height);
  const isFaceSelected = uiState && !uiState.faceInfoHtml.includes('Kliknij element');
  const isEdgeSelected = uiState && uiState.faceInfoHtml.includes('Krawędź');

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      
      {/* ─── Pasek menu (Plik, Cofnij…) — nie belka widokowa ── */}
      <div id="pasek-menu" className="pasek-menu" onMouseDown={handleTopBarMouseDown}>
        <div className="menu-left" style={{ display: 'flex', alignItems: 'center' }}>
          <div ref={fileMenuRef} className={`menu-item dropdown ${fileMenuOpen ? 'open' : ''}`} style={{ position: 'relative' }}>
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
              Plik
            </button>
            {fileMenuOpen && (
              <div className="dropdown-content">
                <a href="#" id="menuNew" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); handleNewProjectClick(); }}>Nowy projekt</a>
                <a href="#" id="menuOpen" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('openProject'); }}>Otwórz...</a>
                <a href="#" id="menuSave" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('saveProject'); }}>Zapisz</a>
                <a href="#" id="menuSaveAs" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('saveProjectAs'); }}>Zapisz jako...</a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="#" id="menuExportStep" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('exportStep'); }}>Eksport do STEP</a>
                <a href="#" id="menuExportStl" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); callAPI('exportStl'); }}>Eksport do STL</a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="#" id="menuGdriveOpen" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setGdriveModalMode('open'); }}>
                  Otwórz z Google Drive...
                </a>
                <a href="#" id="menuGdriveSave" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setGdriveModalMode('save'); }}>
                  Zapisz na Google Drive...
                </a>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }}></div>
                <a href="#" id="menuPerfOptions" onClick={(e) => { e.preventDefault(); setFileMenuOpen(false); setPerfModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#93c5fd' }}>
                  <span style={{ fontSize: '13px' }}>⚙️</span> Opcje wydajności (GPU)...
                </a>
              </div>
            )}
          </div>
          <div className="menu-brand" style={{ marginLeft: '10px', marginRight: '6px' }}>SmartPanel CAD 3D</div>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }}></div>

          <button 
            id="btnUndo" 
            className="menu-icon-btn" 
            title="Cofnij (Ctrl+Z)"
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
            title="Ponów (Ctrl+Y)"
            onClick={() => callAPI('redo')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6"></path>
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path>
            </svg>
          </button>

          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 10px' }}></div>

          {/* ─── Pasek Narzędzi CAD ─── */}
          <div className="topbar-tools">
            <button 
              className={`topbar-tool-btn ${activeTab === 'tab-a3-smartframe' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a3-smartframe')}
              title="SmartFrame — Prosty korpus szafy i mebla"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="2.5" width="17" height="19" rx="1" />
                <rect x="6" y="4.5" width="12" height="14" rx="0.5" fill="currentColor" fillOpacity="0.08" />
                <line x1="3.5" y1="18.5" x2="20.5" y2="18.5" />
              </svg>
              <span>Korpus</span>
            </button>

            <button 
              className={`topbar-tool-btn ${activeTab === 'tab-a2-smartbox' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a2-smartbox')}
              title="SmartBox — Korpus z półkami i przegrodami (konfigurator wnętrz)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="2.5" width="17" height="19" rx="1" />
                <line x1="3.5" y1="18.5" x2="20.5" y2="18.5" />
                <line x1="6" y1="8.5" x2="18" y2="8.5" />
                <line x1="6" y1="13.5" x2="18" y2="13.5" />
                <line x1="12" y1="8.5" x2="12" y2="18.5" />
              </svg>
              <span>SmartBox</span>
            </button>

            <button 
              className={`topbar-tool-btn ${activeTab === 'tab-a4-smartpanel' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a4-smartpanel')}
              title="SmartPanel — Płaska formatka / płyta meblowa"
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
              className={`topbar-tool-btn ${activeTab === 'tab-s2-solver' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-s2-solver')}
              title="Relacje — Więzy geometryczne i relacje 3D"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>Relacje</span>
            </button>

            <button 
              className={`topbar-tool-btn ${activeTab === 'tab-a7-material' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a7-material')}
              title="Materiały — Dekory płyt, obrzeża i wycena"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span>Materiały</span>
            </button>

            <button
              className={`topbar-tool-btn ${activeTab === 'tab-c2-connectors' ? 'active' : ''}`}
              onClick={() => setActiveTab('tab-c2-connectors')}
              title="Złącza — Kołki, konfirmaty i minifix na styku płaszczyzn (wieniec–bok)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="6" height="16" rx="0.5" />
                <rect x="13" y="14" width="8" height="6" rx="0.5" />
                <line x1="9" y1="8" x2="17" y2="8" />
                <circle cx="13" cy="8" r="1.4" fill="currentColor" />
              </svg>
              <span>Złącza</span>
            </button>

            <button
              className={`topbar-tool-btn ${activeTab === 'tab-o1-operacji' ? 'active' : ''}`}
              onClick={() => setActiveTab('tab-o1-operacji')}
              title="Operacje — ramka, przetłoczenie, szkło, rewizja na formatce"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="1" />
                <rect x="7.5" y="6.5" width="9" height="11" rx="0.5" fill="currentColor" fillOpacity="0.2" />
              </svg>
              <span>Operacje</span>
            </button>

            <button 
              className={`topbar-tool-btn ${activeTab === 'tab-a8-pmi' ? 'active' : ''}`} 
              onClick={() => setActiveTab('tab-a8-pmi')}
              title="Wymiary — Linie wymiarowe 3D i koty (PMI)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="4" x2="3" y2="20" />
                <line x1="21" y1="4" x2="21" y2="20" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <polyline points="7 9 3 12 7 15" />
                <polyline points="17 9 21 12 17 15" />
              </svg>
              <span>Wymiary</span>
            </button>

            <button 
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

            <button 
              className="topbar-tool-btn"
              onClick={() => {
                const doc = ContextManager.instance.document;
                if (doc) {
                  try {
                    const json = doc.serialize();
                    localStorage.setItem('smartpanel_project_current_v3', JSON.stringify(json));
                  } catch (e) {
                    console.warn('Błąd zapisu projektu do storage:', e);
                  }
                }
                DrawingProjectExtractor.instance.syncLiveSceneTree();
                E3LibraryExtractor.instance.syncLibrary();
                window.open(new URL('./e3_drawing.html', window.location.href).href, '_blank');
              }}
              title="Rys 2D — Otwórz dedykowaną podstronę CAD (w nowej karcie)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              <span>Rys 2D</span>
            </button>
          </div>

          {/* ─── Narzędzia transformacji 3D (G i R) z brązowym tłem ─── */}
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }}></div>
          <div className="topbar-transform-group" title="Narzędzia transformacji 3D (Blender-style)">
            <button
              type="button"
              className={`topbar-transform-btn ${modalTransformMode === 'translate' ? 'active' : ''}`}
              onClick={() => ModalTransformManager.instance.toggleTransform('translate')}
              title="Przesuń obiekt w przestrzeni 3D (skrót klawiszowy: G)"
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
              <span>Przesuń</span>
            </button>

            <button
              type="button"
              className={`topbar-transform-btn ${modalTransformMode === 'rotate' ? 'active' : ''}`}
              onClick={() => ModalTransformManager.instance.toggleTransform('rotate')}
              title="Obróć obiekt w przestrzeni 3D wokół osi (skrót klawiszowy: R)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <kbd className="topbar-key-badge">R</kbd>
              <span>Obróć</span>
            </button>
          </div>
        </div>
      </div>



      {/* ─── Drzewo obiektów ──────────────────────────── */}
      <div
        id="drzewo-obiektow"
        className={`drzewo-obiektow ${treeWidth <= 48 ? 'is-collapsed' : ''}`}
        aria-label="Drzewo obiektów"
        data-ui-name="Drzewo obiektów"
        style={{ width: `${treeWidth}px` }}
      >
        {/* Sztywny kontener wewnętrzny — nie ulega deformacji/ściskaniu poniżej 280px, tylko jest ucinany */}
        <div 
          className="panel-inner-content"
          style={{
            minWidth: `${TREE_MIN_CONTENT_WIDTH}px`,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            opacity: treeWidth <= 48 ? 0 : 1,
            pointerEvents: treeWidth <= 48 ? 'none' : 'auto',
            transition: isDraggingTree ? 'none' : 'opacity 0.15s ease',
          }}
        >
          <div className="panel-header" style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <h2 style={{ fontSize: '0.9rem', margin: 0, color: '#e2e8f0' }}>Drzewo obiektów</h2>
          </div>
          <div 
            className="panel-section" 
            style={{ padding: '6px', overflowY: 'auto', flex: 1, minHeight: 0 }}
            onContextMenu={(e) => {
              e.preventDefault();
              UIController.instance?.emitTree('contextmenu-tree-bg', {
                clientX: e.clientX,
                clientY: e.clientY
              });
            }}
          >
            <SceneTree projectModel={projectModel} />
          </div>
        </div>

        {/* Gizmo zmiany szerokości (prawa krawędź) / kliknij aby zwinąć/rozwinąć */}
        <div
          className={`panel-resize-handle panel-resize-handle--left-panel ${isDraggingTree ? 'is-dragging' : ''} ${treeWidth <= 48 ? 'is-collapsed' : ''}`}
          onPointerDown={startResizeTree}
          title={treeWidth <= 48 ? 'Kliknij lub przeciągnij, aby rozwinąć drzewo obiektów' : 'Przeciągnij krawędź lub kliknij, aby schować drzewo obiektów'}
        >
          <div className="panel-resize-gizmo">
            <div className="panel-resize-gizmo-dot" />
          </div>
        </div>
      </div>

      {/* ─── Belka widokowa (tryb cieniowania, siatka, kamera) ── */}
      <div
        id="belka-widokowa"
        className="belka-widokowa"
        aria-label="Belka widokowa"
        data-ui-name="Belka widokowa"
      >
        <BelkaDisplayModeMenu
          mode={renderMode}
          open={displayMenuOpen}
          onOpenChange={(next) => {
            setDisplayMenuOpen(next);
            if (next) {
              setViewMenuOpen(false);
              setProjMenuOpen(false);
              setInfoMenuOpen(false);
            }
          }}
          onChange={(m) => {
            setRenderModeState(m);
            callAPI('setRenderMode', m);
          }}
        />
        <span className="tool-separator"></span>
        <div ref={viewMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button 
            className={`tool-btn ${viewMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setViewMenuOpen(!viewMenuOpen);
              setDisplayMenuOpen(false);
              setProjMenuOpen(false);
              setInfoMenuOpen(false);
            }}
            title="Podgląd - włącz/wyłącz elementy graficzne"
          >
            {icons.eyeShow}
            <span>Podgląd</span>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: '2px', opacity: 0.8 }}><path d="M6 9l6 6 6-6"></path></svg>
          </button>
          
          {viewMenuOpen && (
            <div className="view-dropdown-content" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '8px 12px',
              minWidth: '150px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={gridVisible} 
                  onChange={() => {
                    setGridVisible(!gridVisible);
                    callAPI('toggleGrid');
                  }}
                  style={{ cursor: 'pointer' }}
                />
                Siatka i płaszczyzny
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#e2e8f0', fontSize: '0.8rem', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={lcsVisible} 
                  onChange={() => {
                    const nextVal = !lcsVisible;
                    setLcsVisible(nextVal);
                    callAPI('setLcsVisible', nextVal);
                  }}
                  style={{ cursor: 'pointer' }}
                />
                LCS
              </label>
            </div>
          )}
        </div>
        <BelkaProjectionMenu
          mode={projection}
          open={projMenuOpen}
          onOpenChange={(next) => {
            setProjMenuOpen(next);
            if (next) {
              setViewMenuOpen(false);
              setDisplayMenuOpen(false);
              setInfoMenuOpen(false);
            }
          }}
          onChange={(next) => {
            if (next === projection) return;
            setProjection(next);
            callAPI('toggleProjection');
          }}
        />
        <button 
          className={`tool-btn ${isPanActive ? 'active' : ''}`} 
          id="toolPan" 
          onClick={togglePanMode}
          title="Przesuwanie widoku (Pan) — możesz też przytrzymać mały boczny przycisk myszy lub kółko z Shift"
        >✋ Przesuń</button>
        <button 
          className="tool-btn" 
          id="toolDimension" 
          onClick={() => {
            const sm = ContextManager.instance.appAPI?.stateMachine || (ContextManager.instance as any).stateMachine;
            if (sm) {
              setActiveTab('tab-a8-pmi');
              toggleDimensionTool(sm);
            }
          }}
          title="Wymiarowanie CAD — tworzenie wymiaru (ustawienia w panelu PMI)"
        >📏 Wymiaruj</button>
        <span className="tool-separator"></span>
        <BelkaInfoMenu
          open={infoMenuOpen}
          onOpenChange={(next) => {
            setInfoMenuOpen(next);
            if (next) {
              setViewMenuOpen(false);
              setDisplayMenuOpen(false);
              setProjMenuOpen(false);
            }
          }}
          onToggleInspector={() => {
            if ((window as any).toggleInspector) {
              (window as any).toggleInspector();
            } else if (UIController.instance?.viewport) {
              UIController.instance.viewport.toggleInspector();
            }
          }}
          onDumpSceneTree={() => {
            let res = '';
            if ((window as any).debugCADSceneTree) {
              res = (window as any).debugCADSceneTree();
            } else if (ContextManager.instance?.sceneSyncAdapter) {
              res = ContextManager.instance.sceneSyncAdapter.debugDumpTrees();
            }
            alert("🌳 Drzewo Sceny CAD & Babylon zostało wypisane w Konsoli (F12)!\n\nFragment wyniku:\n" + (res ? res.substring(0, 400) + '...' : 'Gotowe'));
          }}
          onOpenSSOT={() => setSsotModalOpen(true)}
        />

        {activeTab === 'tab-e1-export' && (
          <>
            <span className="tool-separator"></span>
            <button
              className="tool-btn"
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '4px',
              }}
              onClick={async () => {
                try {
                  const sheet = await ExportEngine.instance.generateCurrentDrawingSheet();
                  ExportEngine.instance.setPreviewSvg(sheet.toSvgString());
                } catch (e: any) {
                  alert(`Błąd generowania podglądu: ${e?.message || e}`);
                }
              }}
              title="Otwórz pełny podgląd arkusza rysunkowego CAD (ze stemplem ISO i tabelą)"
            >
              🔍 Szybki Podgląd
            </button>
            <button
              className="tool-btn"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              onClick={async () => {
                try {
                  const sheet = await ExportEngine.instance.generateCurrentDrawingSheet();
                  await sheet.printOrSavePdf();
                } catch (e: any) {
                  alert(`Błąd druku: ${e?.message || e}`);
                }
              }}
              title="Drukuj arkusz lub zapisz do PDF w skali 1:1"
            >
              🖨️ Drukuj / PDF
            </button>
            <button
              className="tool-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={async () => {
                try {
                  const sheet = await ExportEngine.instance.generateCurrentDrawingSheet();
                  await sheet.downloadRaster(`Arkusz_CAD_${ExportEngine.instance.paperFormat}.jpg`, 'image/jpeg');
                } catch (e: any) {
                  alert(`Błąd pobierania JPG: ${e?.message || e}`);
                }
              }}
              title="Pobierz wysokiej jakości raster JPG (300 DPI)"
            >
              🖼️ JPG
            </button>
            <button
              className="tool-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={async () => {
                try {
                  const sheet = await ExportEngine.instance.generateCurrentDrawingSheet();
                  sheet.downloadSvg(`Arkusz_CAD_${ExportEngine.instance.paperFormat}.svg`);
                } catch (e: any) {
                  alert(`Błąd pobierania SVG: ${e?.message || e}`);
                }
              }}
              title="Pobierz wektorowy plik CAD SVG"
            >
              📐 SVG
            </button>
          </>
        )}
      </div>

      {/* ─── Interactive View Cube Widget ──────────────── */}
      <div id="view-cube-container" className="view-cube-container">
        <div id="view-cube-wrapper" className="view-cube-wrapper">
          <div className="cube-face face-front" onClick={() => callAPI('setView', 'front')}>PRZÓD</div>
          <div className="cube-face face-back" onClick={() => callAPI('setView', 'back')}>TYŁ</div>
          <div className="cube-face face-left" onClick={() => callAPI('setView', 'left')}>LEWY</div>
          <div className="cube-face face-right" onClick={() => callAPI('setView', 'right')}>PRAWY</div>
          <div className="cube-face face-top" onClick={() => callAPI('setView', 'top')}>GÓRA</div>
          <div className="cube-face face-bottom" onClick={() => callAPI('setView', 'bottom')}>DÓŁ</div>
        </div>
      </div>

      {/* ─── Panel edycji (moduły: Korpus, SmartBox, Formatka…) ── */}
      <div
        id="panel-edycji"
        className={`panel-edycji ${editPanelWidth <= 48 ? 'is-collapsed' : ''}`}
        aria-label="Panel edycji"
        data-ui-name="Panel edycji"
        style={{ width: `${editPanelWidth}px` }}
      >
        {/* Gizmo zmiany szerokości (lewa krawędź) / kliknij aby zwinąć/rozwinąć */}
        <div
          className={`panel-resize-handle panel-resize-handle--right-panel ${isDraggingEdit ? 'is-dragging' : ''} ${editPanelWidth <= 48 ? 'is-collapsed' : ''}`}
          onPointerDown={startResizeEdit}
          title={editPanelWidth <= 48 ? 'Kliknij lub przeciągnij, aby rozwinąć panel edycji' : 'Przeciągnij krawędź lub kliknij, aby schować panel edycji'}
        >
          <div className="panel-resize-gizmo">
            <div className="panel-resize-gizmo-dot" />
          </div>
        </div>

        {/* Sztywny kontener wewnętrzny — nie ulega deformacji/ściskaniu poniżej 340px, tylko jest ucinany */}
        <div 
          className="panel-inner-content"
          style={{
            minWidth: `${EDIT_MIN_CONTENT_WIDTH}px`,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            opacity: editPanelWidth <= 48 ? 0 : 1,
            pointerEvents: editPanelWidth <= 48 ? 'none' : 'auto',
            transition: isDraggingEdit ? 'none' : 'opacity 0.15s ease',
          }}
        >
          {/* Nagłówek podpisany tak jak drzewo obiektów */}
          <div className="panel-header" style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <h2 style={{ fontSize: '0.9rem', margin: 0, color: '#e2e8f0' }}>Panel edycji</h2>
          </div>

          {/* Tab 1: A4 SmartPanel */}
        <div className={`tab-content ${activeTab === 'tab-a4-smartpanel' ? 'active' : ''}`} id="tab-a4-smartpanel">
          <div className="panel-header">
            <h2>SmartPanel</h2>
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
              title="Kliknij lub przeciągnij na scenę 3D, aby wstawić formatkę (720x510x18 mm)"
            >
              <span className="hand-icon" title="Chwyć i przeciągnij na scenę 3D" style={{ opacity: 0.9, display: 'inline-flex', alignItems: 'center', color: '#38bdf8' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                  <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                  <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </svg>
              </span>
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#f3f4f6' }}>Dodaj formatkę</span>
            </div>
          </div>
        </div>

        {/* Tab 2: A2 SmartBox */}
        <div className={`tab-content ${activeTab === 'tab-a2-smartbox' ? 'active' : ''}`} id="tab-a2-smartbox">
          <div className="panel-header">
            <h2>SmartBox</h2>
            <p className="subtitle">Konfigurator wnętrz</p>
          </div>
          <SmartBoxUI projectModel={projectModel} />
        </div>

        {/* Tab 3: A3 SmartFrame */}
        <div className={`tab-content ${activeTab === 'tab-a3-smartframe' ? 'active' : ''}`} id="tab-a3-smartframe">
          <SmartFrameUI projectModel={projectModel} />
        </div>

        {/* Tab 4: A7 Material */}
        <div className={`tab-content ${activeTab === 'tab-a7-material' ? 'active' : ''}`} id="tab-a7-material" style={{ height: 'calc(100% - 40px)', display: activeTab === 'tab-a7-material' ? 'flex' : 'none', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2>Materiały</h2>
            <p className="subtitle">Wycena i obrzeża</p>
          </div>
          <MaterialsUI 
            projectModel={projectModel}
          />
        </div>

        {/* Tab: S2 Solver */}
        <div className={`tab-content ${activeTab === 'tab-s2-solver' ? 'active' : ''}`} id="tab-s2-solver" style={{ height: 'calc(100% - 40px)', display: activeTab === 'tab-s2-solver' ? 'flex' : 'none', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2>{SOLVER_PANEL_TITLE}</h2>
            <p className="subtitle">Wiązania</p>
          </div>
          <SolverUI projectModel={projectModel} />
        </div>

        {/* Tab: C2 Connectors */}
        {activeTab === 'tab-c2-connectors' && (
          <div className="tab-content active" id="tab-c2-connectors" style={{ height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <h2>{CONNECTORS_PANEL_TITLE}</h2>
              <p className="subtitle">Styk płaszczyzn</p>
            </div>
            <ConnectorsUI projectModel={projectModel} />
          </div>
        )}

        {activeTab === 'tab-o1-operacji' && (
          <div className="tab-content active" id="tab-o1-operacji" style={{ height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header">
              <h2>{OPERACJE_PANEL_TITLE}</h2>
              <p className="subtitle">Wcięcia na płycie</p>
            </div>
            <OperacjeUI />
          </div>
        )}

        {/* Tab 7: A8 PMI */}
        <div className={`tab-content ${activeTab === 'tab-a8-pmi' ? 'active' : ''}`} id="tab-a8-pmi" style={{ height: 'calc(100% - 40px)', display: activeTab === 'tab-a8-pmi' ? 'flex' : 'none', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2>Wymiary</h2>
            <p className="subtitle">Wymiarowanie CAD</p>
          </div>
          <PMIUI />
        </div>

        {/* Tab 8: E1 Export */}
        <div className={`tab-content ${activeTab === 'tab-e1-export' ? 'active' : ''}`} id="tab-e1-export" style={{ height: 'calc(100% - 40px)', display: activeTab === 'tab-e1-export' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ExportUI />
        </div>
      </div>
    </div>

      {/* ─── 3D Canvas ─────────────────────────────────── */}
      <canvas 
        id="renderCanvas" 
        style={{ width: '100%', height: '100%', display: 'block' }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          const bayCtrl = ContextManager.instance.smartBoxBayController;
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
        }}
        onDragLeave={() => {
          const bayCtrl = ContextManager.instance.smartBoxBayController;
          if (bayCtrl && (bayCtrl.isDragging || bayCtrl.isBayDrag())) {
            clearBayHighlight();
            ContextManager.instance.viewport?.requestRender(2);
          }
          const frameDragCtrl = ContextManager.instance.smartFrameDragController;
          if (frameDragCtrl && frameDragCtrl.isDragging) {
            frameDragCtrl.endDrag();
            ContextManager.instance.viewport?.requestRender(2);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const bayCtrl = ContextManager.instance.smartBoxBayController;
          if (bayCtrl && (bayCtrl.isDragging || bayCtrl.isBayDrag())) {
            bayCtrl.onDropOnScene();
            return;
          }
          const frameDragCtrl = ContextManager.instance.smartFrameDragController;
          if (frameDragCtrl && frameDragCtrl.isDragging) {
            const doc = ContextManager.instance.document || projectModel;
            frameDragCtrl.onDropOnScene(doc);
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
                name: 'Formatka ręczna',
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
                cmdHist.execute(new AddNodeCommand(doc.rootNode.id, pNode, undefined, 'Wstawiono formatkę ręczną'));
              } else {
                doc.addNode(doc.rootNode.id, pNode);
              }
              doc.setActiveEntity(newPanel);
              window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cad-open-floating-panel-edit', {
                  detail: { panelId: newPanel.id }
                }));
              }
              UIController.instance?.setStatus(`Wstawiono formatkę (${pWidth}×${pHeight} mm) na scenę`);
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
                  new Vec3(dropX * 1000000, 0, dropZ * 1000000),
                  rotation,
                  scale
                );
                doc.emitChange('structure', [cloned.id]);
                window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
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

            const targetEdgeKey = edgeKeyMap[faceName] || 'ALL';
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
            if (e.key === '3') handleApplyDropScope('SMARTBOX');
            if (e.key === '4') handleApplyDropScope('PROJECT');
          }}
          tabIndex={0}
          autoFocus
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #27272a', paddingBottom: '6px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: '#60a5fa' }}>
              <span>🎨</span> Zastosuj Materiał
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
              border: '1px solid rgba(255,255,255,0.2)',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dropModal.material.name} ({dropModal.material.thickness_mm} mm)
              </div>
              <div style={{ color: '#93c5fd' }}>
                Formatka: <strong>{dropModal.targetPanel.name || 'Płyta'}</strong>
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
              <span>📦 Cały korpus / szafka</span>
              <span style={{ opacity: 0.75, fontSize: '10px', background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: '3px' }}>[2]</span>
            </button>

            <button
              onClick={() => handleApplyDropScope('SMARTBOX')}
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
              <span>🗄️ Wnętrze SmartBox</span>
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
              <span>🌐 Cały projekt (globalnie)</span>
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
          uiState?.statusText?.includes('nie będzie realizowana') ? 'status-bar--error' : ''
        }`}
      >
        <span className="status-dot"></span>
        <span id="statusText">{uiState?.statusText || 'Ładowanie...'}</span>
      </div>

      {/* ─── Blender-style Tooltip & Status Bar Hint Overlay ─── */}
      {activeHint && (
        <div style={{
          position: 'absolute',
          bottom: '36px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(24, 24, 24, 0.95)',
          border: '1px solid #f59e0b',
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          color: '#ffffff',
          padding: '6px 14px',
          borderRadius: '20px',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '11px',
          fontFamily: 'Inter, Segoe UI, sans-serif',
          pointerEvents: 'none'
        }}>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>💡 {activeHint.title}:</span>
          <span style={{ color: '#e5e7eb' }}>{activeHint.description}</span>
          {activeHint.confirmKey && (
            <span style={{ backgroundColor: '#d97706', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '10px' }}>
              [{activeHint.confirmKey}] Zatwierdź
            </span>
          )}
          {activeHint.cancelKey && (
            <span style={{ backgroundColor: '#374151', color: '#9ca3af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, fontSize: '10px' }}>
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

      {/* ─── Modal Nowego Projektu (Zapisz / Nie zapisuj / Anuluj) ─── */}
      <NewProjectModal
        isOpen={newProjectModalOpen}
        isDirty={!!(projectModel?.isDirty?.())}
        projectName={projectModel?.name || 'Projekt'}
        onSaveAndNew={handleSaveAndNewProject}
        onDiscardAndNew={handleDiscardAndNewProject}
        onCancel={() => setNewProjectModalOpen(false)}
      />

      {/* ─── Bottom Console (Hover Info) ───────────────── */}
      <div id="bottomConsole" className="bottom-console">
        <span className="console-prefix">&gt;</span>
        <span id="consoleText" className="console-text">
          {uiState?.consoleText || 'Gotowy. Najedź na element.'}
        </span>
      </div>

      {/* Okno edycji operacji (pływające, swobodne okno nad sceną 3D) */}
      <FloatingOperationDialog />
      
    </div>
  );
}
