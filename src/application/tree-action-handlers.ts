/**
 * Akcje z drzewa obiektów (UIController.emitTree → onTreeAction).
 * Composition root tylko rejestruje handler.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { RemoveNodeCommand } from '../../A1_core/commands/remove-node-command.js';
import { collectNodeCleanupCommands } from '../../A1_core/node-cleanup-port.js';
import { isManualPanel } from '../../A4_smartpanel/panel-model.js';
import { showCadTreeContextMenu } from '../module-data/tree-context-menu.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';
import type { BootstrapContext } from './scene-bootstrap.js';
import { getAllContainers, getAllPanels } from './document-queries.js';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

function matchesHardware(feat: any, hwNodeId: string, _hwDomainData?: any): boolean {
  if (!feat) return false;
  const featId = String(feat.id || '').toLowerCase();
  const p = feat.params || {};
  const targetId = String(hwNodeId || '').toLowerCase();

  if (p.hardwareId && (targetId.endsWith(p.hardwareId.toLowerCase()) || targetId.includes(p.hardwareId.toLowerCase()))) {
    return true;
  }

  const hwMatch = targetId.match(/hinge_([a-z]+)_(\d+)/i);
  if (hwMatch) {
    const side = hwMatch[1].toLowerCase();
    const idx = hwMatch[2];
    if (
      featId.includes(`_${side}_${idx}`) ||
      featId.includes(`${side}_${idx}`) ||
      (p.side && p.side.toLowerCase() === side && String(p.hingeIndex) === String(idx))
    ) {
      return true;
    }
  }

  const flapMatch = targetId.match(/hinge_(t[lrc]|b[lrc])/i);
  if (flapMatch) {
    const key = flapMatch[1].toLowerCase();
    if (featId.includes(`_${key}_`) || featId.includes(key) || (p.hingeKey && p.hingeKey.toLowerCase() === key)) {
      return true;
    }
  }

  const drawerMatch = targetId.match(/drawer_(\d+)_rail_([lr])/i);
  if (drawerMatch) {
    const idx = drawerMatch[1];
    const side = drawerMatch[2].toLowerCase();
    if (
      featId.includes(`drawer_${idx}_`) &&
      (featId.includes(`_${side}_`) || featId.includes(`${side}_`) || featId.includes(`front_${side}`))
    ) {
      return true;
    }
  }

  if (featId && (targetId.includes(featId) || featId.includes(targetId))) {
    return true;
  }

  return false;
}

export type RebuildGeometryFn = (successMessage?: string) => void;

export function registerTreeActionHandlers(
  ctx: BootstrapContext,
  rebuildGeometry: RebuildGeometryFn,
): void {
  ctx.ui.onTreeAction((action: string, data: any) => {
    if (action.startsWith('select-')) {
      ContextManager.instance.deactivatePmiToolsIfActive();
    }
    if (action === 'select-part') {
      const panel = getAllPanels(ctx.document).find(
        (p: any) => p.id === data.id || p.smartId?.uid === data.uuid || p.smartId?.uid === data.id,
      );
      if (panel) {
        ctx.document.setActiveEntity(panel);
        ctx.facePicker.clearSelection();
      }
    } else if (action === 'select-container') {
      const container = getAllContainers(ctx.document).find((c: any) => c.id === data.id);
      if (container) {
        ctx.document.setActiveEntity(container);
        ctx.facePicker.clearSelection();
      }
    } else if (action === 'select-hardware') {
      const hwNode =
        ctx.document.findNode(data.id) ||
        (ctx.document.getNodesByType
          ? ctx.document.getNodesByType(NodeType.HARDWARE).find((n: any) => n.id === data.id)
          : null);
      if (hwNode) {
        ctx.document.setActiveEntity(hwNode.domainData || (hwNode as any));
        ctx.facePicker.clearSelection();
      }
    } else if (action === 'select-feature') {
      const panels = getAllPanels(ctx.document);
      const parent = panels.find((p: any) => p.features?.some((f: any) => f.id === data.id));
      if (parent) ctx.document.setActiveEntity(parent);
      const inspected = ctx.propertiesManager.inspectFeature(
        data.id,
        ctx.document,
        ctx.panelViews,
        () => getAllPanels(ctx.document),
        ctx.facePicker,
        (msg: string) => ctx.ui.setStatus(msg),
        true,
      );
      if (inspected && data.openProperties === true) {
        ctx.propertiesManager.showProperties(inspected);
      }
    } else if (action === 'toggle-part-visibility' || action === 'toggle-container-visibility') {
      const entity =
        data.panelRef ||
        getAllPanels(ctx.document).find((p: any) => p.id === data.id || p.smartId?.uid === data.uuid) ||
        getAllContainers(ctx.document).find((c: any) => c.id === data.id);
      if (entity) {
        entity.visible = entity.visible === false ? true : false;
        rebuildGeometry();
        ctx.document.emitChange('all');
      }
    } else if (action === 'show-only') {
      const doc = ctx.document;
      const targetId = String(data.id || data.uuid || '');
      let targetNode = doc.findNode(targetId);
      if (!targetNode) {
        const panel = getAllPanels(doc).find((p: any) => p.id === targetId || p.smartId?.uid === targetId);
        if (panel) targetNode = doc.findNode(panel.id);
      }
      if (!targetNode) {
        const container = getAllContainers(doc).find((c: any) => c.id === targetId);
        if (container) targetNode = doc.findNode(container.id);
      }

      const panels = getAllPanels(doc);
      const containers = getAllContainers(doc);
      const keepIds = new Set<string>();

      const collectDescendants = (node: any) => {
        if (!node) return;
        keepIds.add(node.id);
        const d = node.domainData;
        if (d?.id) keepIds.add(d.id);
        if (d?.smartId?.uid) keepIds.add(d.smartId.uid);
        for (const ch of node.children || []) collectDescendants(ch);
      };

      if (targetNode) {
        collectDescendants(targetNode);
        let walk: any = targetNode.parent;
        while (walk && walk !== doc.rootNode) {
          keepIds.add(walk.id);
          const d = walk.domainData;
          if (d?.id) keepIds.add(d.id);
          walk = walk.parent;
        }
      } else {
        keepIds.add(targetId);
      }

      const keep = (ent: any) =>
        keepIds.has(ent.id) || keepIds.has(ent.smartId?.uid) || (targetNode && ent === targetNode.domainData);

      for (const p of panels) {
        p.visible = keep(p);
      }
      for (const c of containers) {
        c.visible = keep(c);
      }
      const hwNodes = doc.getNodesByType ? doc.getNodesByType(NodeType.HARDWARE) : [];
      for (const hw of hwNodes) {
        if (!hw.domainData) hw.domainData = {} as any;
        (hw.domainData as any).visible = keepIds.has(hw.id);
      }

      rebuildGeometry();
      doc.emitChange('all');
      (ContextManager.instance as any).notifyIsolationUpdate?.();
      ctx.ui.setStatus?.('Pokazano tylko zaznaczony element', true);
    } else if (action === 'show-all') {
      const doc = ctx.document;
      for (const p of getAllPanels(doc)) {
        p.visible = true;
      }
      for (const c of getAllContainers(doc)) {
        c.visible = true;
      }
      const hwNodes = doc.getNodesByType ? doc.getNodesByType(NodeType.HARDWARE) : [];
      for (const hw of hwNodes) {
        if (!hw.domainData) hw.domainData = {} as any;
        (hw.domainData as any).visible = true;
      }
      rebuildGeometry();
      doc.emitChange('all');
      (ContextManager.instance as any).notifyIsolationUpdate?.();
      ctx.ui.setStatus?.('Pokazano cały projekt', true);
    } else if (action === 'toggle-visibility') {
      const panels = getAllPanels(ctx.document);
      for (const panel of panels) {
        if (panel.features) {
          const feature = panel.features.find((f: any) => f.id === data.id);
          if (feature) {
            feature.visible = feature.visible === false ? true : false;
            if (typeof panel.setFeatures === 'function') {
              panel.setFeatures(panel.features);
            } else if (typeof panel._emit === 'function') {
              panel._emit('features', { features: panel.features });
            }
            rebuildGeometry();
            ctx.document.emitChange('all');
            break;
          }
        }
      }
    } else if (action === 'toggle-freeze-feature') {
      const panels = getAllPanels(ctx.document);
      for (const panel of panels) {
        if (panel.features) {
          const feature = panel.features.find((f: any) => f.id === data.id);
          if (feature) {
            const newFrozen = !(feature.frozen || feature.params?.frozen);
            feature.frozen = newFrozen;
            feature.visible = !newFrozen;
            if (feature.params) feature.params.frozen = newFrozen;
            if (typeof panel.setFeatures === 'function') {
              panel.setFeatures(panel.features);
            } else if (typeof panel._emit === 'function') {
              panel._emit('features', { features: panel.features });
            }
            rebuildGeometry(
              newFrozen
                ? tx(srcTekst, 'cadapp.freeze_feature', TX_NS)
                : tx(srcTekst, 'cadapp.unfreeze_feature', TX_NS),
            );
            ctx.document.emitChange('all');
            break;
          }
        }
      }
    } else if (action === 'toggle-hardware-visibility') {
      const doc = ctx.document;
      const hwNode =
        doc.findNode(data.id) ||
        (doc.getNodesByType
          ? doc.getNodesByType(NodeType.HARDWARE).find((n: any) => n.id === data.id)
          : null);
      if (hwNode) {
        const curVis = (hwNode.domainData as any)?.visible !== false;
        if (!hwNode.domainData) hwNode.domainData = {} as any;
        const nextVis = !curVis;
        (hwNode.domainData as any).visible = nextVis;

        const panels = getAllPanels(doc);
        for (const panel of panels) {
          if (panel.features) {
            for (const feat of panel.features) {
              if (matchesHardware(feat, data.id, hwNode.domainData)) {
                feat.visible = nextVis;
                if (feat.params) feat.params.visible = nextVis;
              }
            }
          }
        }
        rebuildGeometry(nextVis ? 'Pokazano okucie' : 'Ukryto okucie');
        ctx.document.emitChange('all');
      }
    } else if (action === 'toggle-freeze-hardware') {
      const doc = ctx.document;
      const hwNode =
        doc.findNode(data.id) ||
        (doc.getNodesByType
          ? doc.getNodesByType(NodeType.HARDWARE).find((n: any) => n.id === data.id)
          : null);
      if (hwNode) {
        const curFrozen = !!(hwNode.domainData as any)?.frozen;
        if (!hwNode.domainData) hwNode.domainData = {} as any;
        const newFrozen = !curFrozen;
        (hwNode.domainData as any).frozen = newFrozen;

        const panels = getAllPanels(doc);
        for (const panel of panels) {
          if (panel.features) {
            for (const feat of panel.features) {
              if (matchesHardware(feat, data.id, hwNode.domainData)) {
                feat.frozen = newFrozen;
                if (feat.params) feat.params.frozen = newFrozen;
              }
            }
          }
        }
        rebuildGeometry(
          newFrozen ? tx(srcTekst, 'cadapp.freeze_hw', TX_NS) : tx(srcTekst, 'cadapp.unfreeze_hw', TX_NS),
        );
        ctx.document.emitChange('all');
      }
    } else if (action === 'toggle-freeze-part') {
      const doc = ctx.document;
      const panel = getAllPanels(doc).find((p: any) => p.id === data.id || p.smartId?.uid === data.uuid);
      if (panel) {
        const newFrozen = !panel.frozen;
        panel.frozen = newFrozen;
        panel.visible = !newFrozen;
        rebuildGeometry(
          newFrozen
            ? tx(srcTekst, 'cadapp.freeze_panel', TX_NS)
            : tx(srcTekst, 'cadapp.unfreeze_panel', TX_NS),
        );
        ctx.document.emitChange('all');
      }
    } else if (action === 'delete-container' || action === 'delete-part') {
      const doc = ctx.document;
      const cmdHist = ContextManager.instance.commandHistory;

      if (action === 'delete-container') {
        const container = getAllContainers(doc).find((c: any) => c.id === data.id);
        if (container) {
          const cadNodeId = container.id;
          if (cmdHist && doc && doc.findNode(cadNodeId)) {
            cmdHist.execute(
              new RemoveNodeCommand(doc, cadNodeId, tx(srcTekst, 'cadapp.remove_container', TX_NS)),
            );
          } else if (doc) {
            const node = doc.findNode(cadNodeId);
            if (node) {
              for (const cmd of collectNodeCleanupCommands(node)) {
                cmd.execute(doc);
              }
            }
            doc.removeNode(cadNodeId);
          }
          rebuildGeometry(tx(srcTekst, 'cadapp.remove_container', TX_NS));
          ctx.document.emitChange('all');
        }
      } else if (action === 'delete-part') {
        const panel = getAllPanels(doc).find((p: any) => p.id === data.id || p.smartId?.uid === data.uuid);
        const panelNode = panel ? doc.findNode(panel.id) : null;
        const isEngineChild = panelNode?.parent?.nodeType === NodeType.ASSEMBLY && !isManualPanel(panel);
        if (panel && panelNode && !isEngineChild) {
          if (cmdHist) {
            cmdHist.execute(
              new RemoveNodeCommand(doc, panel.id, tx(srcTekst, 'cadapp.remove_panel', TX_NS)),
            );
          } else {
            doc.removeNode(panel.id);
          }
          rebuildGeometry(tx(srcTekst, 'cadapp.remove_panel', TX_NS));
          ctx.document.emitChange('all');
        } else {
          console.warn(
            '[SmartFrame] Pojedyncze formatki wewnątrz zespołu SmartFrame nie mogą być usuwane indywidualnie. Aby usunąć mebel, usuń cały kontener SmartFrame.',
          );
        }
      }
    } else if (action === 'delete-feature') {
      const panels = getAllPanels(ctx.document);
      for (const panel of panels) {
        if (panel.features) {
          const idx = panel.features.findIndex((f: any) => f.id === data.id);
          if (idx !== -1) {
            const featureId = data.id;
            if (typeof panel.removeFeature === 'function') {
              panel.removeFeature(featureId);
            } else {
              panel.features.splice(idx, 1);
              if (typeof panel.setFeatures === 'function') {
                panel.setFeatures(panel.features);
              }
            }
            rebuildGeometry(tx(srcTekst, 'cadapp.remove_feature', TX_NS));
            ctx.document.emitChange('all');
            break;
          }
        }
      }
    } else if (
      action === 'rename-part' ||
      action === 'rename-container' ||
      action === 'rename-feature' ||
      action === 'rename-project'
    ) {
      if (action === 'rename-project') {
        ctx.document.name = data.name;
        ctx.document.emitChange('all');
      } else if (action === 'rename-part') {
        const panel = getAllPanels(ctx.document).find(
          (p: any) => p.id === data.id || p.smartId?.uid === data.uuid,
        );
        if (panel) {
          panel.name = data.name;
          ctx.document.emitChange('all');
        }
      } else if (action === 'rename-container') {
        const container = getAllContainers(ctx.document).find((c: any) => c.id === data.id);
        if (container) {
          container.name = data.name;
          ctx.document.emitChange('all');
        }
      } else if (action === 'rename-feature') {
        for (const panel of getAllPanels(ctx.document)) {
          const feature = panel.features?.find((f: any) => f.id === data.id);
          if (feature) {
            feature.name = data.name;
            panel._notify('features');
            break;
          }
        }
      }
    } else if (action === 'contextmenu-tree-node') {
      showCadTreeContextMenu(data);
    }
  });
}
