/**
 * Przypadek użycia: synchronizacja widoków Babylon z drzewem ProjectDocument.
 * Wyciągnięte z cad-app.ts — composition root tylko podaje zależności.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import type { GizmoController } from '../../A1_core/gizmo-controller.js';
import { createContainerView, createPanelView, notifyBeforeRebuildGeometry } from '../../A1_core/view-port.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { isCylindricalPart } from '../../A1_core/cad-node/part-shape.js';
import { computePanelFeaturesFingerprint } from '../../A4_smartpanel/panel-view.js';
import { syncSelectionHighlights } from '../../A1_core/selection-highlight.js';
import { HardwareLoader, resolveDrawerGlbTemplateId } from '../../B1_biblioteka/hardware-loader.js';
import { syncHangerMeshesFromDocument } from '../../A2_bloki/hangers/hanger-mesh.js';
import { syncHandleMeshesFromDocument } from '../../A2_bloki/handles/handle-mesh.js';
import { syncSinkMeshesFromDocument } from '../../A6_agd/sinks/sink-mesh.js';
import { syncScenePropMeshesFromDocument } from '../../A6_agd/scene-prop-mesh.js';
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
  const rebuildGeometry = (successMessage = 'Gotowy', rethrowErrors = false) => {
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

      let anyGeometryRebuilt = false;
      for (const panel of currentPanels) {
        const cadNode = ctx.document.findNode(panel.id);
        const parentNode = cadNode?.parent;
        const isParentFrozen = Boolean(parentNode?.frozen || (parentNode?.domainData as any)?.frozen);
        const isPanelFrozen = Boolean(panel.frozen || panel.params?.frozen || cadNode?.frozen || isParentFrozen);
        if (isPanelFrozen) {
          if (panel.frozen || cadNode?.frozen) {
            panel.frozen = true;
            panel.visible = false;
          }
          const existingView = panelViews.get(panel);
          if (existingView) {
            try {
              existingView.dispose();
            } catch {
              /* ignore */
            }
            panelViews.delete(panel);
          }
          continue;
        }

        let view = panelViews.get(panel);
        const isNewView = !view;
        if (!view) {
          view = createPanelView(viewport.scene, panel);
          panelViews.set(panel, view);
        }

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

        const f = panel.features;
        const fCount = f?.length || 0;
        const fp = fCount === 0
          ? '0'
          : `${fCount}_` + f.map((feat: any) => {
            const p = feat.params;
            return p
              ? `${feat.id}_${p.u ?? p.x}_${p.v ?? p.y}_${p.width}_${p.length ?? p.height}_${p.depth}_${p.diameter}`
              : feat.id;
          }).join(';');
        const isDimsDirty =
          view.lastWidth !== panel.width ||
          view.lastHeight !== panel.height ||
          view.lastThickness !== panel.thickness;
        const currentPanelForm = panel.panelForm || 'SOLID';
        const currentTemplateId = panel.frameTemplateId || '';
        const isFormDirty =
          ((view as any).lastPanelForm || 'SOLID') !== currentPanelForm ||
          ((view as any).lastFrameTemplateId || '') !== currentTemplateId;
        const fullFp = computePanelFeaturesFingerprint(panel);
        const isFeaturesDirty = view.lastFeaturesFingerprint !== fullFp;

        const colorKey = panel.color
          ? `${panel.color.r.toFixed(3)}_${panel.color.g.toFixed(3)}_${panel.color.b.toFixed(3)}`
          : (panel.materialId || panel.material || '');
        const isColorDirty = (view as any).lastColorKey !== colorKey;

        if (isNewView || isDimsDirty || isFeaturesDirty || isFormDirty) {
          anyGeometryRebuilt = true;
          if (!isCylindricalPart(panel)) {
            if (panel.width <= 0 || panel.height <= 0 || panel.thickness <= 0) {
              panel.width = Math.max(10_000_000, Math.abs(panel.width) || 10_000_000);
              panel.height = Math.max(10_000_000, Math.abs(panel.height) || 10_000_000);
              panel.thickness = Math.max(1_000_000, Math.abs(panel.thickness) || 18_000_000);
            }
            const meshData = panelBuilder.build(panel);
            view.updateMesh(meshData);
          }
          view.lastWidth = panel.width;
          view.lastHeight = panel.height;
          view.lastThickness = panel.thickness;
          view.lastFeaturesFingerprint = fullFp;
          (view as any).lastPanelForm = currentPanelForm;
          (view as any).lastFrameTemplateId = currentTemplateId;
          (view as any).lastColorKey = colorKey;

          if (isCylindricalPart(panel) && typeof (view as any).renderFeatures === 'function') (view as any).renderFeatures();
        } else if (isColorDirty) {
          (view as any).lastColorKey = colorKey;
          if (typeof (view as any)._updateMaterialAppearance === 'function') {
            (view as any)._updateMaterialAppearance();
          }
        }

        if (view._updateTransform) view._updateTransform();

        const isMeshProxy = Boolean(panel.custom_properties?.isMeshProxy);
        const isPanelVis = panel.visible !== false && !isPanelFrozen && !isMeshProxy;
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
        const isShelfPin =
          hw.hardwareType === 'SHELF_PIN' ||
          hw.role === 'SHELF_PIN';
        const isTube =
          hw.hardwareType === 'TUBE' ||
          hw.role === 'TUBE_ROD' ||
          hw.role === 'HOLDER' ||
          hw.hardwareType === 'TUBE_SOCKET';

        if (!isRail && !isShelfPin && !isTube) continue;

        activeHwIds.add(hwNode.id);
        let containerNode: any = hwNode.parent;
        while (containerNode && containerNode.nodeType !== NodeType.ASSEMBLY && containerNode.nodeType !== NodeType.ROOM) {
          containerNode = containerNode.parent;
        }
        const parentContainer = containerNode?.domainData;
        const containerView = parentContainer ? containerViews.get(parentContainer) : null;
        if (!containerView || !containerView.rootNode) continue;

        const hwId = hw.hardwareId || (isShelfPin ? 'PODPORKA_FI5' : isTube ? (hw.role === 'TUBE_ROD' ? 'DRAZEK_FI25' : 'ROZETA_FI25') : 'BLUM_ANTARO_M_L');
        const hwLoader = HardwareLoader.instance;
        let hwMesh = hardwareViews.get(hwNode.id);

        if (hwMesh && isTube && hw.role === 'TUBE_ROD') {
          const lenMm = hw.dim?.x || hw.params?.length_mm || 500;
          if (hwMesh.metadata?.lengthMm !== lenMm) {
            try { hwMesh.dispose(); } catch { /* ignore */ }
            hwMesh = null;
            hardwareViews.delete(hwNode.id);
          }
        } else if (hwMesh && isRail) {
          const lenMm = hw.dim?.y || hw.params?.lengthMm || 500;
          const corpusHeightMm = hw.params?.corpusHeight || hw.dim?.z || 178;
          const side = hw.side || (hwNode.id?.toLowerCase().includes('_r') ? 'right' : 'left');
          const railId = hw.params?.railId || hw.custom_properties?.library_id || hwId;
          const glbTemplateId = resolveDrawerGlbTemplateId(`${railId} ${hwId}`);
          const expectsGlbDrawerSide = Boolean(glbTemplateId && hwLoader.hasTemplate(glbTemplateId));
          if (
            hwMesh.metadata?.lengthMm !== lenMm ||
            hwMesh.metadata?.corpusHeightMm !== corpusHeightMm ||
            hwMesh.metadata?.side !== side ||
            (hwMesh.metadata?.railId && hwMesh.metadata?.railId !== railId) ||
            Boolean(hwMesh.metadata?.isGlbDrawerSide) !== expectsGlbDrawerSide ||
            (expectsGlbDrawerSide && hwMesh.metadata?.glbTemplateId !== glbTemplateId) ||
            Boolean(hwMesh.metadata?.isInternal) !== Boolean(hw.params?.internal)
          ) {
            try { hwMesh.dispose(); } catch { /* ignore */ }
            hwMesh = null;
            hardwareViews.delete(hwNode.id);
          }
        }

        if (!hwMesh) {
          if (isShelfPin) {
            if (hwLoader.hasTemplate(hwId)) {
              hwMesh = hwLoader.createShelfPinInstance(hwId, viewport.scene, hw.side);
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
                .catch(() => { });
            }
          } else if (isTube) {
            const side = hw.side || (hwNode.id?.toLowerCase().includes('_r') ? 'right' : 'left');
            if (hw.role === 'TUBE_ROD') {
              const len = hw.dim?.x || hw.params?.length_mm || 500;
              const dia = hw.dim?.y || hw.params?.diameter_mm || 25;
              hwMesh = hwLoader.createTubeRodMesh(len, dia, viewport.scene);
            } else {
              const dia = hw.dim?.y || hw.params?.diameter_mm || 45;
              const thick = hw.dim?.x || hw.params?.thickness_mm || 5;
              hwMesh = hwLoader.createTubeSocketMesh(dia, thick, side, viewport.scene);
            }
            if (hwMesh) {
              hwMesh.parent = containerView.rootNode;
              hardwareViews.set(hwNode.id, hwMesh);
            }
          } else if (isRail) {
            const side = hw.side || (hwNode.id?.toLowerCase().includes('_r') ? 'right' : 'left');
            const lenMm = hw.dim?.y || hw.params?.lengthMm || 500;
            const corpusHeightMm = hw.params?.corpusHeight || hw.dim?.z || 178;
            const railId = hw.params?.railId || hw.custom_properties?.library_id || hwId;
            const glbTemplateId = resolveDrawerGlbTemplateId(`${railId} ${hwId}`);
            if (glbTemplateId && !hwLoader.hasTemplate(glbTemplateId)) {
              hwLoader
                .loadTemplate(glbTemplateId, viewport.scene)
                .then(() => {
                  rebuildGeometry();
                  viewport.requestRender(10);
                })
                .catch(() => { });
            }
            hwMesh = hwLoader.createDrawerSideInstance(
              hwId,
              viewport.scene,
              side,
              lenMm,
              corpusHeightMm,
              hw.params?.profile,
              undefined,
              undefined,
              undefined,
              railId,
              Boolean(hw.params?.internal)
            );
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

          if (hw.loc) {
            hwMesh.position.set(hw.loc.x, hw.loc.z, hw.loc.y);
          }

          if (isRail) {
            if (hwMesh.metadata?.isParametricDrawerSide || hwMesh.metadata?.isGlbDrawerSide) {
              hwMesh.rotation.set(0, 0, 0);
              hwMesh.scaling.set(1, 1, 1);
            } else {
              const lenMm = hw.params?.lengthMm || 500;
              const baseScale = hwMesh.metadata?.baseScale || Math.abs(hwMesh.scaling?.y || 1);
              hwMesh.rotation.set(0, Math.PI, 0);

              const scaleX = side === 'right' ? -baseScale : baseScale;
              const scaleZ = lenMm > 0 ? baseScale * (lenMm / 500) : baseScale;
              hwMesh.scaling.set(scaleX, baseScale, scaleZ);
            }
          } else if (isShelfPin) {
            if (hw.rotation) {
              hwMesh.rotation.set(hw.rotation.x, hw.rotation.y, hw.rotation.z);
            } else {
              hwMesh.rotation.set(0, 0, Math.PI / 2);
            }
            const pinDia = Number(hw.params?.diameter_mm || hw.params?.srednica_podporki_mm || 5);
            const pinScale = pinDia > 0 ? pinDia / 5 : 1;
            if (hwMesh.scaling) {
              const signX = hw.side === 'right' ? -1 : 1;
              hwMesh.scaling.set(signX * pinScale, pinScale, pinScale);
            }
          } else if (isTube) {
            hwMesh.rotation.set(0, 0, Math.PI / 2);
          }

          const isParentFrozen = Boolean(hwNode.parent?.frozen || (hwNode.parent?.domainData as any)?.frozen);
          const isHwFrozen = Boolean(hw.frozen || hwNode.frozen || isParentFrozen);
          const isParentVisible = hwNode.parent ? (hwNode.parent.domainData as any)?.visible !== false && hwNode.parent.visible !== false : true;
          const isVisible = hw.visible !== false && parentContainer.visible !== false && !isHwFrozen && isParentVisible;
          hwMesh.setEnabled(isVisible);
          hwLoader.setHardwareFrozen(hwMesh, isHwFrozen);

          const hiddenSubparts: string[] = [
            ...(Array.isArray(hw.hiddenSubparts) ? hw.hiddenSubparts : []),
            ...(Array.isArray(hw.params?.hiddenSubparts) ? hw.params.hiddenSubparts : []),
          ];

          hwMesh.metadata = {
            ...(hwMesh.metadata || {}),
            type: 'hardware',
            hardwareType: hw.hardwareType || (isRail ? 'RAIL' : isShelfPin ? 'SHELF_PIN' : 'TUBE'),
            hardwareId: hwId,
            cadNode: hwNode,
            id: hwNode.id,
            side: side,
            frozen: !!hw.frozen,
            visible: isVisible,
            hiddenSubparts,
          };
          if (typeof hwMesh.getChildMeshes === 'function') {
            for (const child of hwMesh.getChildMeshes()) {
              const subType = child.metadata?.subType;
              const subName = child.metadata?.subName;
              const subId = subType ? `${hwNode.id}_${subType}` : hwNode.id;
              const isSubHidden = Boolean(subType && hiddenSubparts.includes(subType));
              const isChildVisible = isVisible && !isSubHidden;

              child.setEnabled(isChildVisible);
              child.isVisible = isChildVisible;
              child.metadata = {
                ...(child.metadata || {}),
                type: 'hardware',
                subType,
                subName: subName ? `${subName} [${hw.name || hwNode.name}]` : hwNode.name,
                parentHardwareMesh: hwMesh,
                hardwareId: hwId,
                cadNode: hwNode,
                id: subId,
                parentId: hwNode.id,
                visible: isChildVisible,
              };
              if (subType) {
                hardwareViews.set(subId, child);
                activeHwIds.add(subId);
              }
            }
          }
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

      // Uchwyty SmartPart (GLB z B1 / parametryczne)
      try {
        syncHandleMeshesFromDocument(document);
      } catch (err) {
        console.warn('[rebuildGeometry] syncHandleMeshes:', err);
      }

      // Zlewy SmartPart — kołnierz + komora
      try {
        syncSinkMeshesFromDocument(document);
      } catch (err) {
        console.warn('[rebuildGeometry] syncSinkMeshes:', err);
      }

      // Obiekty wyposażenia sceny 3D (.glb, .obj, .stl)
      try {
        syncScenePropMeshesFromDocument(document);
      } catch (err) {
        console.warn('[rebuildGeometry] syncScenePropMeshes:', err);
      }

      syncSelectionHighlights(ctx);

      if (anyGeometryRebuilt && viewport && typeof viewport.applyRenderModeToMeshes === 'function') {
        viewport.applyRenderModeToMeshes();
      }

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
      if (rethrowErrors) {
        throw e;
      }
    }
  };

  return rebuildGeometry;
}
