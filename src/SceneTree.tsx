/**
 * web/src/SceneTree.tsx
 * Współdzielony, w 100% zsynchronizowany komponent Drzewa Obiektów CAD.
 * Działa identycznie w Scenie Głównej oraz w podstronach Eksport 2 (E2) i Eksport 3 (E3).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectDocument } from '../A1_core/project-document';
import { UIController } from '../A1_core/ui-controller';
import { ContextManager } from '../A1_core/context-manager';
import { CAMStateStore } from '../C1_cnc/core/cam-state-store';
import { DrawingProjectExtractor } from '../E2_export/drawing-project-extractor';
import { CADTreeNode, GrooveFeature2D } from '../E2_export/drawing-types';
import { CAD_TREE_START_RENAME } from './module-data/tree-context-menu';
import { PMIStore } from '../A8_pmi/pmi-data';
import {
  executePMICommand,
  RemoveDimensionCommand,
  RemoveMeasurementCommand,
  SetDimensionAffixesCommand,
  SetDimensionVisibilityCommand,
  SetMeasurementVisibilityCommand,
} from '../A8_pmi/pmi-commands';
import { ConstraintStore } from '../S2_solver/constraint-store';
import { ConstraintHighlightOverlay } from '../S2_solver/constraint-highlight';
import { ConstraintTreeRow } from '../S2_solver/constraint-tree-row';
import { DRZEWO_TAB_EVENT } from '../S2_solver/constraint-pick-flow';
import { ConnectorStore } from '../C2_connectors/connector-store';
import { ConnectorTreeRow } from '../C2_connectors/connector-tree-row';
import { canReparentManualPanel, reparentManualPanel } from '../A1_core/app-commands';
import { CAD_EDIT_LIBRARY_OPERATION } from '../o1_operacji';

export const TREE_ICONS = {
  project: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  part: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    </svg>
  ),
  opsFolder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  tool: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
    </svg>
  ),
  eyeShow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  ),
  eyeHide: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.6 }}>
      <path d="M6 9l6 6 6-6"></path>
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.6 }}>
      <path d="M9 5l7 7-7 7"></path>
    </svg>
  ),
};

export type SceneTreeMode = 'full' | 'draw';
export type TreeTab = 'obiekty' | 'relacje' | 'wymiary' | 'zlacza';

interface SceneTreeProps {
  projectModel?: ProjectDocument | null;
  /** `draw` = to samo drzewo co na scenie, bez narzędzi edycji 3D (usuń, widoczność, CNC, menu). */
  mode?: SceneTreeMode;
  onSelectNode?: (node: CADTreeNode) => void;
}

export const SceneTree: React.FC<SceneTreeProps> = ({
  projectModel: propModel,
  mode = 'full',
  onSelectNode,
}) => {
  const isDrawMode = mode === 'draw';
  const [treeRoot, setTreeRoot] = useState<CADTreeNode | null>(() => {
    try {
      const tree = DrawingProjectExtractor.instance.extractProjectTree();
      return tree.rootNode;
    } catch {
      return null;
    }
  });

  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [editingNode, setEditingNode] = useState<{ type: string; id: string; panelId?: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [treeTab, setTreeTab] = useState<TreeTab>('obiekty');
  const [listTick, setListTick] = useState(0);
  const [highlightedConstraintId, setHighlightedConstraintId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const affixSnapshot = useRef<{ id: string; prefix: string; suffix: string } | null>(null);

  const refreshTree = useCallback(() => {
    try {
      const tree = DrawingProjectExtractor.instance.extractProjectTree();
      setTreeRoot(tree.rootNode);
    } catch (e) {
      console.warn('SceneTree: błąd odświeżania drzewa:', e);
    }
  }, []);

  useEffect(() => {
    const doc = propModel || ContextManager.instance.document;

    const syncTreeAndSelection = () => {
      refreshTree();
      const active = doc?.activeEntity;
      if (active) {
        setSelectedNodeId(active.id || (active as any).smartId?.uid || null);
      } else {
        setSelectedNodeId(null);
      }
    };

    syncTreeAndSelection();

    let unsubDoc: (() => void) | null = null;
    if (doc) {
      unsubDoc = doc.onDocumentChanged(syncTreeAndSelection);
    }

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('smartbox_cad_sync');
      channel.onmessage = () => {
        syncTreeAndSelection();
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'smartbox_cad_live_project_v1' ||
        e.key === 'smartpanel_project_current_v3' ||
        e.key === 'smartbox_cad_e3_library_v1'
      ) {
        syncTreeAndSelection();
      }
    };

    const handleCustomChange = () => {
      syncTreeAndSelection();
    };

    window.addEventListener('storage', handleStorage);
    window.document.addEventListener('smartbox-project-changed', handleCustomChange);
    window.document.addEventListener('smartpanel-project-changed', handleCustomChange);

    const handlePropsUpdate = (e: any) => {
      if (e.detail && e.detail.featureId) {
        setSelectedFeatureId(e.detail.featureId);
      } else if (e.detail && (e.detail.kind === 'panel' || e.detail.kind === 'container')) {
        setSelectedFeatureId(null);
        setSelectedNodeId(e.detail.panelId || e.detail.containerId || null);
      }
    };
    document.addEventListener('smartbox-properties-update', handlePropsUpdate);

    const handleStartRename = (e: Event) => {
      if (isDrawMode) return;
      const d = (e as CustomEvent).detail || {};
      const type = d.type as string;
      const id = String(d.id || '');
      if (!type || !id) return;
      setEditingNode({ type, id, panelId: d.panelId });
      setEditValue(String(d.name || ''));
    };
    window.addEventListener(CAD_TREE_START_RENAME, handleStartRename);

    return () => {
      if (unsubDoc) unsubDoc();
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
      window.document.removeEventListener('smartbox-project-changed', handleCustomChange);
      window.document.removeEventListener('smartpanel-project-changed', handleCustomChange);
      document.removeEventListener('smartbox-properties-update', handlePropsUpdate);
      window.removeEventListener(CAD_TREE_START_RENAME, handleStartRename);
    };
  }, [propModel, refreshTree, isDrawMode]);

  useEffect(() => {
    if (isDrawMode) return;
    const bump = () => setListTick((t) => t + 1);
    const offPmi = PMIStore.instance.onChange(bump);
    const offPmiDerived = PMIStore.instance.onDerivedChange(bump);
    const offCst = ConstraintStore.instance.onChange(bump);
    const offConn = ConnectorStore.instance.onChange(bump);
    const onTab = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab as TreeTab | undefined;
      if (tab === 'relacje' || tab === 'wymiary' || tab === 'obiekty' || tab === 'zlacza') {
        setTreeTab(tab);
      }
    };
    window.addEventListener(DRZEWO_TAB_EVENT, onTab);
    return () => {
      offPmi();
      offPmiDerived();
      offCst();
      offConn();
      window.removeEventListener(DRZEWO_TAB_EVENT, onTab);
    };
  }, [isDrawMode]);

  const isNodeCollapsed = (nodeId: string, defaultCollapsed: boolean = true) => {
    return collapsedNodes[nodeId] === undefined ? defaultCollapsed : collapsedNodes[nodeId];
  };

  const toggleCollapse = (nodeId: string, e: React.MouseEvent, defaultCollapsed: boolean = true) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const current = prev[nodeId] === undefined ? defaultCollapsed : prev[nodeId];
      return {
        ...prev,
        [nodeId]: !current,
      };
    });
  };

  const finishRename = (save: boolean) => {
    if (isDrawMode || !editingNode || !UIController.instance) return;
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

  const cadDocument = propModel || ContextManager.instance.document;
  void listTick;

  const readDraggedCadNode = () => (window as any).__draggedCadNode as { type?: string; id?: string } | null;

  const canDropManualOn = (targetId: string) => {
    const dragged = readDraggedCadNode();
    if (!dragged?.id || dragged.type !== 'PANEL' || !cadDocument) return false;
    return canReparentManualPanel(cadDocument, dragged.id, targetId);
  };

  const handleTreeDragOver = (e: React.DragEvent, targetId: string) => {
    if (isDrawMode || !canDropManualOn(targetId)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetId !== targetId) setDropTargetId(targetId);
  };

  const handleTreeDrop = (e: React.DragEvent, targetId: string) => {
    if (isDrawMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
    const dragged = readDraggedCadNode();
    if (!dragged?.id || !cadDocument) return;
    if (reparentManualPanel(cadDocument, dragged.id, targetId)) {
      window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
    }
  };
  const pmiStore = PMIStore.instance;
  const constraintStore = ConstraintStore.instance;
  const activeTab: TreeTab = isDrawMode ? 'obiekty' : treeTab;
  const constraintCount = constraintStore.constraints.length;
  const dimensionCount = pmiStore.annotations.length + pmiStore.measurements.length;
  const connectorStore = ConnectorStore.instance;
  const connectorCount = connectorStore.groups.length;

  const highlightConstraint = (id: string) => {
    const overlay = ConstraintHighlightOverlay.instance;
    if (highlightedConstraintId === id) {
      overlay.clear();
      setHighlightedConstraintId(null);
      return;
    }
    overlay.clear();
    overlay.toggle(id);
    setHighlightedConstraintId(id);
  };

  const selectGrooveInTree = (panel: CADTreeNode, g: GrooveFeature2D) => {
    setSelectedFeatureId(g.id);
    setSelectedNodeId(panel.id);
    onSelectNode?.(panel);
    if (isDrawMode) return;
    UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.id });
    UIController.instance?.emitTree('select-feature', { id: g.id, panelId: panel.id });
    if (g.source === 'library' && g.libraryId) {
      window.dispatchEvent(new CustomEvent(CAD_EDIT_LIBRARY_OPERATION, {
        detail: { library_id: g.libraryId, featureId: g.id, panelId: panel.id },
      }));
    }
  };

  const renderFeatures = (panel: CADTreeNode) => {
    const isOpsCollapsed = isNodeCollapsed(panel.id + '_ops', true);
    if (isOpsCollapsed) return null;

    const holes = panel.holes || [];
    const grooves = panel.grooves || [];
    const totalOps = holes.length + grooves.length;

    if (totalOps === 0) {
      return (
        <div style={{ fontSize: '11px', padding: '2px 12px 2px 22px', color: 'var(--text-muted, #64748b)', fontStyle: 'italic' }}>
          Brak operacji
        </div>
      );
    }

    return (
      <div className="tree-children">
        {holes.map((h, idx) => (
          <div key={h.id || `hole_${idx}`} className="tree-node" style={{ opacity: 0.9 }}>
            <div className="tree-node-content">
              <span style={{ width: '10px', display: 'inline-block', flexShrink: 0 }} />
              {TREE_ICONS.tool}
              <span className="node-name-text">Otwór ⌀{h.diameter}x{h.depth}</span>
              <span style={{ opacity: 0.5, fontSize: '10px', marginLeft: '4px' }}>[{h.face || 'FRONT'}]</span>
            </div>
          </div>
        ))}
        {grooves.map((g, idx) => {
          const isSmart = g.source === 'library';
          const isSelected = selectedFeatureId === g.id ? 'selected' : '';
          const label = isSmart ? (g.name || 'Operacja') : (g.name || 'Wpust');
          const details = isSmart
            ? `${Math.round(g.width)}×${Math.round(g.height)}×${Math.round(g.depth)}`
            : `${Math.round(g.width)}×${Math.round(g.depth)}`;
          return (
            <div
              key={g.id || `grv_${idx}`}
              className={`tree-node ${isSelected} ${isSmart ? 'is-smart-op' : 'is-engine-op'}`}
              title={isSmart ? 'Operacja Smart — kliknij, aby edytować' : 'Wpust silnika — sterowany parametrami korpusu'}
            >
              <div
                className="tree-node-content"
                onClick={() => selectGrooveInTree(panel, g)}
              >
                <span style={{ width: '10px', display: 'inline-block', flexShrink: 0 }} />
                {TREE_ICONS.tool}
                <span className="node-name-text">{label}</span>
                <span style={{ opacity: 0.55, fontSize: '10px', marginLeft: '4px' }}>[{details}]</span>
              </div>
              {!isDrawMode && isSmart && (
                <div className="tree-node-actions">
                  <button
                    type="button"
                    className="tree-action-btn btn-delete"
                    title="Usuń operację"
                    onClick={(e) => {
                      e.stopPropagation();
                      UIController.instance?.emitTree('delete-feature', { id: g.id, panelId: panel.id });
                    }}
                  >
                    {TREE_ICONS.trash}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderPanelNode = (panel: CADTreeNode) => {
    const isPanelCollapsed = isNodeCollapsed(panel.id, true);
    const isEditing = editingNode?.type === 'part' && editingNode?.id === panel.id;
    const isSelected = selectedNodeId === panel.id ? 'selected' : '';

    const opCount = (panel.holes?.length || 0) + (panel.grooves?.length || 0);
    const cncPrograms = (CAMStateStore as any)?.instance?.getPrograms ? (CAMStateStore as any).instance.getPrograms(panel.id) : [];
    const cncCount = cncPrograms ? cncPrograms.length : 0;

    return (
      <div key={panel.id} className="tree-children">
        <div
          className={`tree-node ${isSelected}`}
          style={{ cursor: 'grab', opacity: panel.visible === false ? 0.45 : 1 }}
          draggable={!editingNode}
          onDragStart={(e) => {
            e.stopPropagation();
            const payload = {
              type: 'PANEL',
              id: panel.id,
              name: panel.name || 'Formatka',
              raw: panel,
            };
            (window as any).__draggedCadNode = payload;
            try {
              e.dataTransfer.setData('application/cad-node', JSON.stringify(payload));
              e.dataTransfer.setData('application/e3-library-item', JSON.stringify(panel));
              e.dataTransfer.setData('text/plain', panel.id);
              e.dataTransfer.effectAllowed = 'copyMove';
            } catch {}
          }}
          onDragEnd={() => {
            (window as any).__draggedCadNode = null;
            setDropTargetId(null);
          }}
        >
          <div
            className="tree-node-content"
            onClick={() => {
              setSelectedNodeId(panel.id);
              onSelectNode?.(panel);
              if (!isDrawMode) {
                UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.id });
              }
            }}
            onContextMenu={(e) => {
              if (isDrawMode) return;
              e.preventDefault();
              e.stopPropagation();
              UIController.instance?.emitTree('select-part', { id: panel.id, uuid: panel.id });
              UIController.instance?.emitTree('contextmenu-tree-node', {
                type: 'part',
                id: panel.id,
                uuid: panel.id,
                name: panel.name || 'Formatka',
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }}
            onDoubleClick={() => {
              if (isDrawMode) return;
              setEditingNode({ type: 'part', id: panel.id });
              setEditValue(panel.name || 'Formatka');
            }}
          >
            <span className="tree-chevron" onClick={(e) => toggleCollapse(panel.id, e)}>
              {isPanelCollapsed ? TREE_ICONS.chevronRight : TREE_ICONS.chevronDown}
            </span>
            {TREE_ICONS.part}
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                className="node-name-input"
                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none' }}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => finishRename(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishRename(true);
                  if (e.key === 'Escape') finishRename(false);
                }}
                autoFocus
              />
            ) : (
              <span className="node-name-text">{panel.name || 'Formatka'}</span>
            )}
            <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>
              ({panel.width}x{panel.height}x{panel.thickness || panel.depth || 18})
            </span>
          </div>
          {!isDrawMode && (
            <div className="tree-node-actions">
              <button
                className="tree-action-btn btn-toggle-part-vis"
                title="Ukryj/Pokaż"
                onClick={(e) => {
                  e.stopPropagation();
                  UIController.instance?.emitTree('toggle-part-visibility', { id: panel.id, uuid: panel.id });
                }}
              >
                {panel.visible === false ? TREE_ICONS.eyeHide : TREE_ICONS.eyeShow}
              </button>
              <button
                className="tree-action-btn btn-delete"
                title="Usuń formatkę"
                onClick={(e) => {
                  e.stopPropagation();
                  UIController.instance?.emitTree('delete-part', { id: panel.id, uuid: panel.id });
                }}
              >
                {TREE_ICONS.trash}
              </button>
            </div>
          )}
        </div>

        {!isPanelCollapsed && (
          <div className="tree-children">
            {/* Folder: Operacje */}
            <div className="tree-node">
              <div className="tree-node-content">
                <span className="tree-chevron" onClick={(e) => toggleCollapse(panel.id + '_ops', e, true)}>
                  {isNodeCollapsed(panel.id + '_ops', true) ? TREE_ICONS.chevronRight : TREE_ICONS.chevronDown}
                </span>
                {TREE_ICONS.opsFolder}
                <span className="node-name-text">Operacje ({opCount})</span>
              </div>
            </div>
            {!isNodeCollapsed(panel.id + '_ops', true) && renderFeatures(panel)}

            {!isDrawMode && (
              <div className="tree-node">
                <div className="tree-node-content">
                  <span className="tree-chevron" onClick={(e) => toggleCollapse(panel.id + '_cnc', e, true)}>
                    {isNodeCollapsed(panel.id + '_cnc', true) ? TREE_ICONS.chevronRight : TREE_ICONS.chevronDown}
                  </span>
                  <span style={{ fontSize: '13px', marginRight: '4px' }}>⚡</span>
                  <span className="node-name-text">Programy CNC ({cncCount})</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderContainerNode = (container: CADTreeNode) => {
    const isContainerCollapsed = isNodeCollapsed(container.id, true);
    const isSelected = selectedNodeId === container.id ? 'selected' : '';
    const isEditing = editingNode?.type === 'container' && editingNode?.id === container.id;

    return (
      <div key={container.id} className="tree-children">
        <div
          className={`tree-node ${isSelected}`}
          style={{
            cursor: 'grab',
            opacity: container.visible === false ? 0.45 : 1,
            outline: dropTargetId === container.id ? '1px dashed #38bdf8' : undefined,
          }}
          draggable={!editingNode}
          onDragStart={(e) => {
            e.stopPropagation();
            const payload = {
              type: 'CONTAINER',
              id: container.id,
              name: container.name || 'Korpus',
              raw: container,
            };
            (window as any).__draggedCadNode = payload;
            try {
              e.dataTransfer.setData('application/cad-node', JSON.stringify(payload));
              e.dataTransfer.setData('application/e3-library-item', JSON.stringify(container));
              e.dataTransfer.setData('text/plain', container.id);
              e.dataTransfer.effectAllowed = 'copyMove';
            } catch {}
          }}
          onDragEnd={() => {
            (window as any).__draggedCadNode = null;
            setDropTargetId(null);
          }}
          onDragOver={(e) => handleTreeDragOver(e, container.id)}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDropTargetId((id) => (id === container.id ? null : id));
          }}
          onDrop={(e) => handleTreeDrop(e, container.id)}
        >
          <div
            className="tree-node-content"
            onClick={() => {
              setSelectedNodeId(container.id);
              onSelectNode?.(container);
              if (!isDrawMode) {
                UIController.instance?.emitTree('select-container', { id: container.id });
              }
            }}
            onContextMenu={(e) => {
              if (isDrawMode) return;
              e.preventDefault();
              e.stopPropagation();
              UIController.instance?.emitTree('select-container', { id: container.id });
              UIController.instance?.emitTree('contextmenu-tree-node', {
                type: (container.type === 'DRAWERS' || container.type === 'SHELVES' || /smartbox/i.test(container.name || ''))
                  ? 'smartbox'
                  : 'container',
                id: container.id,
                name: container.name || 'Korpus',
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }}
            onDoubleClick={() => {
              if (isDrawMode) return;
              setEditingNode({ type: 'container', id: container.id });
              setEditValue(container.name || 'Korpus');
            }}
          >
            <span className="tree-chevron" onClick={(e) => toggleCollapse(container.id, e, true)}>
              {isContainerCollapsed ? TREE_ICONS.chevronRight : TREE_ICONS.chevronDown}
            </span>
            {TREE_ICONS.project}
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                className="node-name-input"
                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none' }}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => finishRename(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishRename(true);
                  if (e.key === 'Escape') finishRename(false);
                }}
                autoFocus
              />
            ) : (
              <strong className="node-name-text">{container.name || 'Kontener'}</strong>
            )}
            <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>
              ({container.width}x{container.height}x{container.depth})
            </span>
          </div>
          {!isDrawMode && (
            <div className="tree-node-actions">
              <button
                className="tree-action-btn btn-toggle-part-vis"
                title="Ukryj/Pokaż"
                onClick={(e) => {
                  e.stopPropagation();
                  UIController.instance?.emitTree('toggle-container-visibility', { id: container.id });
                }}
              >
                {container.visible === false ? TREE_ICONS.eyeHide : TREE_ICONS.eyeShow}
              </button>
              <button
                className="tree-action-btn btn-delete"
                title="Usuń kontener"
                onClick={(e) => {
                  e.stopPropagation();
                  UIController.instance?.emitTree('delete-container', { id: container.id });
                }}
              >
                {TREE_ICONS.trash}
              </button>
            </div>
          )}
        </div>

        {!isContainerCollapsed &&
          container.children &&
          container.children.map((child: CADTreeNode) => {
            if (child.type === 'CONTAINER' || child.type === 'ASSEMBLY') {
              return renderContainerNode(child);
            }
            return renderPanelNode(child);
          })}
      </div>
    );
  };

  const isProjectCollapsed = isNodeCollapsed('project-root', false);
  const isProjectEditing = editingNode?.type === 'project';

  const renderRelacjeList = () => {
    if (constraintCount === 0) {
      return <div className="drzewo-list-empty">Brak relacji</div>;
    }
    return (
      <div className="tree-root drzewo-relacje">
        {constraintStore.constraints.map((c) => (
          <ConstraintTreeRow
            key={c.id}
            constraint={c}
            document={cadDocument}
            highlighted={highlightedConstraintId === c.id}
            issues={constraintStore.getIssues(c.id)}
            onHighlight={() => highlightConstraint(c.id)}
          />
        ))}
      </div>
    );
  };

  const renderWymiaryList = () => {
    if (dimensionCount === 0) {
      return <div className="drzewo-list-empty">Brak wymiarów</div>;
    }
    return (
      <div className="tree-root">
        {pmiStore.annotations.map((ann) => (
          <div
            key={ann.id}
            className={`tree-node ${ann.selected ? 'selected' : ''}`}
            style={{ opacity: ann.visible === false ? 0.45 : 1 }}
          >
            <div
              className="tree-node-content"
              onClick={() => pmiStore.selectById(ann.id)}
            >
              <span className="drzewo-row-kind">Wymiar</span>
              <span className="node-name-text">{ann.text || 'Wymiar'}</span>
              {ann.selected && (
                <>
                  <input
                    type="text"
                    className="drzewo-wymiar-affix"
                    placeholder="P"
                    title="Prefiks"
                    value={ann.textPrefix}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => {
                      affixSnapshot.current = { id: ann.id, prefix: ann.textPrefix, suffix: ann.textSuffix };
                    }}
                    onChange={(e) => pmiStore.setAffixes(ann.id, e.target.value, ann.textSuffix)}
                    onBlur={() => {
                      const snapshot = affixSnapshot.current;
                      affixSnapshot.current = null;
                      if (!snapshot || snapshot.id !== ann.id) return;
                      const nextPrefix = ann.textPrefix;
                      const nextSuffix = ann.textSuffix;
                      if (snapshot.prefix === nextPrefix && snapshot.suffix === nextSuffix) return;
                      pmiStore.setAffixes(ann.id, snapshot.prefix, snapshot.suffix);
                      executePMICommand(new SetDimensionAffixesCommand(pmiStore, ann.id, nextPrefix, nextSuffix));
                    }}
                  />
                  <input
                    type="text"
                    className="drzewo-wymiar-affix"
                    placeholder="S"
                    title="Sufiks"
                    value={ann.textSuffix}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => {
                      affixSnapshot.current = { id: ann.id, prefix: ann.textPrefix, suffix: ann.textSuffix };
                    }}
                    onChange={(e) => pmiStore.setAffixes(ann.id, ann.textPrefix, e.target.value)}
                    onBlur={() => {
                      const snapshot = affixSnapshot.current;
                      affixSnapshot.current = null;
                      if (!snapshot || snapshot.id !== ann.id) return;
                      const nextPrefix = ann.textPrefix;
                      const nextSuffix = ann.textSuffix;
                      if (snapshot.prefix === nextPrefix && snapshot.suffix === nextSuffix) return;
                      pmiStore.setAffixes(ann.id, snapshot.prefix, snapshot.suffix);
                      executePMICommand(new SetDimensionAffixesCommand(pmiStore, ann.id, nextPrefix, nextSuffix));
                    }}
                  />
                </>
              )}
            </div>
            <div className="tree-node-actions">
              <button
                type="button"
                className="tree-action-btn"
                title="Ukryj/Pokaż"
                onClick={(e) => {
                  e.stopPropagation();
                  executePMICommand(new SetDimensionVisibilityCommand(pmiStore, ann.id, !ann.visible));
                }}
              >
                {ann.visible === false ? TREE_ICONS.eyeHide : TREE_ICONS.eyeShow}
              </button>
              <button
                type="button"
                className="tree-action-btn btn-delete"
                title="Usuń wymiar"
                onClick={(e) => {
                  e.stopPropagation();
                  executePMICommand(new RemoveDimensionCommand(pmiStore, ann.id));
                }}
              >
                {TREE_ICONS.trash}
              </button>
            </div>
          </div>
        ))}
        {pmiStore.measurements.map((item) => (
          <div
            key={item.id}
            className={`tree-node ${item.selected ? 'selected' : ''}`}
            style={{ opacity: item.visible === false ? 0.45 : 1 }}
          >
            <div
              className="tree-node-content"
              onClick={() => pmiStore.selectMeasurementById(item.id)}
            >
              <span className="drzewo-row-kind">Pomiar</span>
              <span className="node-name-text">{item.text || 'Pomiar'}</span>
            </div>
            <div className="tree-node-actions">
              <button
                type="button"
                className="tree-action-btn"
                title="Ukryj/Pokaż"
                onClick={(e) => {
                  e.stopPropagation();
                  executePMICommand(new SetMeasurementVisibilityCommand(pmiStore, item.id, !item.visible));
                }}
              >
                {item.visible === false ? TREE_ICONS.eyeHide : TREE_ICONS.eyeShow}
              </button>
              <button
                type="button"
                className="tree-action-btn btn-delete"
                title="Usuń pomiar"
                onClick={(e) => {
                  e.stopPropagation();
                  executePMICommand(new RemoveMeasurementCommand(pmiStore, item.id));
                }}
              >
                {TREE_ICONS.trash}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderZlaczaList = () => {
    if (connectorCount === 0) {
      return <div className="drzewo-list-empty">Brak złączy</div>;
    }
    return (
      <div className="tree-root drzewo-zlacza">
        {connectorStore.groups.map((g) => (
          <ConnectorTreeRow key={g.id} group={g} document={cadDocument} />
        ))}
      </div>
    );
  };

  return (
    <div className="scene-tree" style={{ height: '100%', overflowY: 'auto' }}>
      {!isDrawMode && (
        <div className="drzewo-tabs" role="tablist" aria-label="Listy drzewa">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'obiekty'}
            className={`drzewo-tab${activeTab === 'obiekty' ? ' active' : ''}`}
            onClick={() => setTreeTab('obiekty')}
          >
            Obiekty
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'relacje'}
            className={`drzewo-tab${activeTab === 'relacje' ? ' active' : ''}`}
            onClick={() => setTreeTab('relacje')}
          >
            Relacje
            <span className="drzewo-tab-count">{constraintCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'wymiary'}
            className={`drzewo-tab${activeTab === 'wymiary' ? ' active' : ''}`}
            onClick={() => setTreeTab('wymiary')}
          >
            Wymiary
            <span className="drzewo-tab-count">{dimensionCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'zlacza'}
            className={`drzewo-tab${activeTab === 'zlacza' ? ' active' : ''}`}
            onClick={() => setTreeTab('zlacza')}
          >
            Złącza
            <span className="drzewo-tab-count">{connectorCount}</span>
          </button>
        </div>
      )}

      {activeTab === 'relacje' && renderRelacjeList()}
      {activeTab === 'wymiary' && renderWymiaryList()}
      {activeTab === 'zlacza' && renderZlaczaList()}
      {activeTab === 'obiekty' && !treeRoot && (
        <div className="drzewo-list-empty">Ładowanie drzewa obiektów...</div>
      )}
      {activeTab === 'obiekty' && treeRoot && (
      <div className="tree-root">
        <div
          className="tree-node"
          id="nodeProject"
          style={{
            cursor: 'grab',
            outline: dropTargetId === 'project-root' ? '1px dashed #38bdf8' : undefined,
          }}
          draggable={!editingNode}
          onDragStart={(e) => {
            e.stopPropagation();
            const payload = {
              type: 'PROJECT',
              id: 'ALL',
              name: treeRoot.name || 'Cały Projekt',
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
            setDropTargetId(null);
          }}
          onDragOver={(e) => handleTreeDragOver(e, 'project-root')}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDropTargetId((id) => (id === 'project-root' ? null : id));
          }}
          onDrop={(e) => handleTreeDrop(e, 'project-root')}
        >
          <div
            className="tree-node-content"
            onClick={() => {
              setSelectedNodeId('project-root');
              onSelectNode?.(treeRoot);
            }}
            onContextMenu={(e) => {
              if (isDrawMode) return;
              e.preventDefault();
              e.stopPropagation();
              UIController.instance?.emitTree('contextmenu-tree-node', {
                type: 'project',
                id: 'root',
                name: treeRoot.name || 'Cały projekt',
                clientX: e.clientX,
                clientY: e.clientY,
              });
            }}
            onDoubleClick={() => {
              if (isDrawMode) return;
              setEditingNode({ type: 'project', id: 'root' });
              setEditValue(treeRoot.name || 'Projekt');
            }}
          >
            <span className="tree-chevron" onClick={(e) => toggleCollapse('project-root', e, false)}>
              {isProjectCollapsed ? TREE_ICONS.chevronRight : TREE_ICONS.chevronDown}
            </span>
            {TREE_ICONS.project}
            {isProjectEditing ? (
              <input
                type="text"
                value={editValue}
                className="node-name-input"
                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3b82f6', outline: 'none' }}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => finishRename(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishRename(true);
                  if (e.key === 'Escape') finishRename(false);
                }}
                autoFocus
              />
            ) : (
              <strong className="node-name-text">{treeRoot.name || 'Projekt WebCAD'}</strong>
            )}
          </div>
        </div>

        {!isProjectCollapsed &&
          treeRoot.children &&
          treeRoot.children.map((child: CADTreeNode) => {
            if (child.type === 'CONTAINER' || child.type === 'ASSEMBLY') {
              return renderContainerNode(child);
            }
            return renderPanelNode(child);
          })}
      </div>
      )}
    </div>
  );
};
