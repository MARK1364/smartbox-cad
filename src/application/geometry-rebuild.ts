/**
 * Przypadek użycia: synchronizacja widoków Babylon z drzewem ProjectDocument.
 * Wyciągnięte z cad-app.ts — composition root tylko podaje zależności.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import type { GizmoController } from '../../A1_core/gizmo-controller.js';
import { createContainerView, createPanelView, notifyBeforeRebuildGeometry } from '../../A1_core/view-port.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { isCylindricalPart } from '../../A1_core/cad-node/part-shape.js';
import { syncSelectionHighlights } from '../../A1_core/selection-highlight.js';
import { HardwareLoader } from '../../B1_biblioteka/hardware-loader.js';
import { syncHangerMeshesFromDocument } from '../../A5_smartparts/hangers/hanger-mesh.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';
import type { BootstrapContext } from './scene-bootstrap.js';
import { getAllContainers, getAllPanels } from './document-queries.js';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

export interface GeometryRebuildDeps {
  getContext: () => BootstrapContext | null | undefined;
  getGizmoController: () => GizmoController | null | undefined;
}

export function createRebuildGeometry(deps: GeometryRebuildDeps) {
  const rebuildGeometry = (successMessage = 'Gotowy') => {
    const ctx = deps.getContext();
    if (!ctx) return;
    const gizmoCtrl = deps.getGizmoController();
    const { document, viewport, panelViews, containerViews, panelBuilder, ui } = ctx;

    ui.setStatus('Aktualizowanie modelu...', true);
    try {
      const currentContainers = getAllContainers(document);

      notifyBeforeRebuildGeometry(document, currentContainers);

      const currentContainerIds = new Set(currentContainers.map((c) => c.id));
      for (const [container, view] of containerViews) {
        if (!currentContainerIds.has(container.id)) {
          view.dispose();
          containerViews.delete(container);
        }
      }

      const currentPanels = getAllPanels(document);
      const currentPanelIds = new Set(currentPanels.map((p) => p.smartId?.fullPath || p.id));

      for (const [panel, view] of panelViews) {
        const pid = panel.smartId?.fullPath || panel.id;
        if (pid && !currentPanelIds.has(pid)) {
          view.dispose();
          panelViews.delete(panel);
        }
      }

      const globalLcsVisible = ContextManager.instance.lcsVisible !== false;
      for (const panel of currentPanels) {
        if (typeof panel.setLcsVisible === 'function') {
          panel.setLcsVisible(globalLcsVisible);
        }
      }

      for (const container of currentContainers) {
        let view = containerViews.get(container);
        if (!view) {
          view = createContainerView(viewport.scene, container);
          containerViews.set(container, view);
        }
        view.update();
        if (view.rootNode) {
          view.rootNode.setEnabled(container.visible !== false);
        }
      }

      for (const panel of currentPanels) {
        let view = panelViews.get(panel);
        if (!view) {
          view = createPanelView(viewport.scene, panel);
          panelViews.set(panel, view);
        }

        const cadNode = ctx.document.findNode(panel.id);
        const parentNode = cadNode?.parent;
        if (parentNode && parentNode.domainData) {
          const parentContainer = parentNode.domainData;
          const containerView = containerViews.get(parentContainer);

          if (containerView && containerView.rootNode && view.root) {
            if (view.root.parent !== containerView.rootNode) {
              view.root.setParent
                ? view.root.setParent(containerView.rootNode)
                : (view.root.parent = containerView.rootNode);
            }
          }
          if (typeof view._updateTransform === 'function') view._updateTransform();
        } else {
          if (view.root && view.root.parent) view.root.parent = null;
        }

        if (!isCylindricalPart(panel)) {
          const meshData = panelBuilder.build(panel);
          view.updateMesh(meshData);
        }
        view.lastWidth = panel.width;
        view.lastHeight = panel.height;
        view.lastThickness = panel.thickness;

        if (typeof (view as any).renderFeatures === 'function') (view as any).renderFeatures();
        if (view._updateTransform) view._updateTransform();

        const isPanelVis = panel.visible !== false;
        if (typeof (view as any).setPanelVisible === 'function') {
          (view as any).setPanelVisible(isPanelVis);
        } else if (view.root) {
          view.root.setEnabled(isPanelVis);
        }
      }

      const hardwareViews = ContextManager.instance.hardwareViews;
      const allHwNodes = (
        document.getNodesByType ? document.getNodesByType(NodeType.HARDWARE) : []
      ) as any[];
      const activeHwIds = new Set<string>();

      for (const hwNode of allHwNodes) {
        const hw = hwNode.domainData;
        if (!hw) continue;
        const isRail =
          hw.hardwareType === 'RAIL' ||
          hw.role === 'PROWADNICA' ||
          hw.role?.includes('RAIL') ||
          hw.custom_properties?.shape === 'RAIL';
        if (!isRail) continue;

        activeHwIds.add(hwNode.id);
        const parentContainer = hwNode.parent?.domainData;
        const containerView = parentContainer ? containerViews.get(parentContainer) : null;
        if (!containerView || !containerView.rootNode) continue;

        const hwId = hw.hardwareId || 'BLUM_ANTARO_M_L';
        const hwLoader = HardwareLoader.instance;
        let hwMesh = hardwareViews.get(hwNode.id);

        if (!hwMesh) {
          if (
            hwLoader.hasTemplate(hwId) ||
            hwLoader.hasTemplate('BLUM_ANTARO_M_L') ||
            hwLoader.hasTemplate('Antaro M 500')
          ) {
            hwMesh = hwLoader.createDrawerSideInstance(hwId, viewport.scene, hw.side);
            if (hwMesh) {
              hwMesh.parent = containerView.rootNode;
              hardwareViews.set(hwNode.id, hwMesh);
            }
          } else {
            hwLoader
              .loadTemplate(hwId, viewport.scene)
              .then(() => {
                rebuildGeometry();
                viewport.requestRender(10);
              })
              .catch((err: any) => {
                console.error('[App] Błąd ładowania okucia:', err);
              });
          }
        }

        if (hwMesh) {
          if (hwMesh.parent !== containerView.rootNode) {
            hwMesh.parent = containerView.rootNode;
          }
          const side = hw.side || (hwNode.id?.toLowerCase().includes('_r') ? 'right' : 'left');
          const lenMm = hw.params?.lengthMm || 500;
          const baseScale = hwMesh.metadata?.baseScale || Math.abs(hwMesh.scaling?.y || 1);

          if (hw.loc) {
            hwMesh.position.set(hw.loc.x, hw.loc.z, hw.loc.y);
          }
          hwMesh.rotation.set(0, Math.PI, 0);

          const scaleX = side === 'right' ? -baseScale : baseScale;
          const scaleZ = lenMm > 0 ? baseScale * (lenMm / 500) : baseScale;
          hwMesh.scaling.set(scaleX, baseScale, scaleZ);

          const isVisible = hw.visible !== false && parentContainer.visible !== false;
          hwMesh.setEnabled(isVisible);
          hwLoader.setHardwareFrozen(hwMesh, !!hw.frozen);
          hwMesh.metadata = {
            type: 'hardware',
            hardwareType: hw.hardwareType || 'RAIL',
            hardwareId: hwId,
            cadNode: hwNode,
            id: hwNode.id,
            side: side,
            baseScale: baseScale,
            frozen: !!hw.frozen,
            visible: isVisible,
          };
        }
      }

      for (const [hwId, mesh] of hardwareViews) {
        if (!activeHwIds.has(hwId)) {
          try {
            mesh.dispose();
          } catch {
            /* ignore */
          }
          hardwareViews.delete(hwId);
        }
      }

      // Zawieszki / SmartPart Studio — półprzezroczyste Party + cuts (po ContainerView)
      try {
        syncHangerMeshesFromDocument(document);
      } catch (err) {
        console.warn('[rebuildGeometry] syncHangerMeshes:', err);
      }

      syncSelectionHighlights(ctx);

      ui.refreshFeatures();
      ui.setStatus(successMessage, true);
      if (gizmoCtrl) gizmoCtrl.updateFaceGizmo();

      (ContextManager.instance as any).pmiSync?.refreshNow?.();

      if ((ContextManager.instance as any).activeTab === 'tab-c1-cnc') {
        const activeEntity = ctx.document?.activeEntity;
        const lockedPanel = activeEntity && activeEntity.type !== 'container' ? activeEntity : null;
        if (lockedPanel) {
          const isTarget = (m: any) => {
            if (!m) return false;
            if (m === lockedPanel) return true;
            if (m.id && lockedPanel.id && m.id === lockedPanel.id) return true;
            if (
              (m as any).smartId?.fullPath &&
              (lockedPanel as any).smartId?.fullPath &&
              (m as any).smartId.fullPath === (lockedPanel as any).smartId.fullPath
            ) {
              return true;
            }
            if (
              (m as any).smartId?.uid &&
              (lockedPanel as any).smartId?.uid &&
              (m as any).smartId.uid === (lockedPanel as any).smartId.uid
            ) {
              return true;
            }
            return false;
          };
          containerViews.forEach((cView) => {
            if (cView.mesh) {
              try {
                cView.mesh.visibility = 0.0;
                cView.mesh.isVisible = false;
              } catch {
                /* ignore */
              }
            }
          });
          panelViews.forEach((view, model) => {
            const shouldShow = isTarget(model);
            if (view.root) {
              try {
                view.root.setEnabled(shouldShow);
              } catch {
                /* ignore */
              }
            }
          });
        }
      }
      if (typeof (ContextManager.instance as any).notifyIsolationUpdate === 'function') {
        try {
          (ContextManager.instance as any).notifyIsolationUpdate();
        } catch {
          /* ignore */
        }
      }
      if (viewport && typeof viewport.requestRender === 'function') {
        viewport.requestRender(10);
      }
    } catch (e: any) {
      console.error(e);
      ui.setStatus(tx(srcTekst, 'cadapp.geom_error', TX_NS), true, 'error');
    }
  };

  return rebuildGeometry;
}
