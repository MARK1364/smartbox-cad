/**
 * A5_smartparts / led — led-channel-apply.ts
 * Aplikacja wpustów LED do formatki i aktualizacja meshy (Imperative Shell).
 *
 * Iteruje po panelach w dokumencie CAD, aplikuje wyliczone cechy wpustów
 * i wywołuje odświeżenie geometrii NativePanelBuilder.
 */

import { ContextManager } from '../../A1_core/context-manager.js';
import type { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { NativePanelBuilder } from '../../A4_smartpanel/native-panel-builder.js';
import { LED_CHANNEL_SOURCE, type LedChannelDefinition } from './led-channel-types.js';
import {
    computeLedChannelWorldBox,
    calculatePanelLedGroove,
} from './led-channel-math.js';

export function rebuildMesh(panel: PanelModel): void {
    const views = ContextManager.instance?.panelViews;
    let view = views?.get(panel);
    if (!view && views) {
        for (const [m, v] of views) {
            if (m === panel || m?.id === panel.id) {
                view = v;
                break;
            }
        }
    }
    if (view && typeof view.updateMesh === 'function') {
        const builder = new NativePanelBuilder();
        view.updateMesh(builder.build(panel));
        ContextManager.instance.viewport?.applyRenderModeToMeshes?.();
    }
}

/**
 * Aplikuje wycięcia z kontenera LED do wszystkich przeciętych formatek w dokumencie.
 */
export function applyLedChannelToDocument(doc: any, def: LedChannelDefinition): number {
    if (!doc) return 0;
    const box = computeLedChannelWorldBox(doc, def);
    const panelNodes = typeof doc.getPanels === 'function' ? doc.getPanels() : [];
    let affectedCount = 0;

    for (const node of panelNodes) {
        const panel: PanelModel = node.domainData || node;
        if (!panel || !panel.features) continue;

        // Usuń stare cechy tego kanału z formatki
        const initialLen = panel.features.length;
        panel.features = panel.features.filter((f: any) => !(
            f.params?.source === LED_CHANNEL_SOURCE && f.params?.channel_id === def.id
        ));
        let changed = panel.features.length !== initialLen;

        // Jeśli tryb to 'single' (tylko wskazana szafka), pomijaj formatki spoza wskazanego korpusu
        if (def.scope === 'single' && def.refBottom?.nodeId) {
            const getParentContainerId = (n: any) => {
                let curr = n;
                while (curr && curr.id !== doc.rootNode?.id) {
                    if (curr.domainData?.type === 'container' || curr.domainData?.generatorParams) return curr.id;
                    curr = curr.parent;
                }
                return null;
            };
            const targetRefNode = doc.findNode(def.refBottom.nodeId);
            const targetCabId = targetRefNode ? getParentContainerId(targetRefNode) : null;
            const currentCabId = getParentContainerId(node);
            if (targetCabId && currentCabId && targetCabId !== currentCabId) {
                if (changed) rebuildMesh(panel);
                continue;
            }
        }

        if (!box) {
            if (changed) rebuildMesh(panel);
            continue;
        }

        const grooveFeature = calculatePanelLedGroove(node, panel, box, def);

        if (grooveFeature) {
            panel.features.push(grooveFeature);
            rebuildMesh(panel);
            affectedCount++;
        } else if (changed) {
            rebuildMesh(panel);
        }
    }

    if (affectedCount > 0) {
        doc.emitChange?.('features');
    }
    return affectedCount;
}

/**
 * Usuwa wycięcia wskazanego kontenera LED ze wszystkich formatek.
 */
export function removeLedChannelFromDocument(doc: any, channelId: string): void {
    if (!doc) return;
    const panelNodes = typeof doc.getPanels === 'function' ? doc.getPanels() : [];
    for (const node of panelNodes) {
        const panel: PanelModel = node.domainData || node;
        if (!panel || !panel.features) continue;
        const initialLen = panel.features.length;
        panel.features = panel.features.filter((f: any) => !(
            f.params?.source === LED_CHANNEL_SOURCE && f.params?.channel_id === channelId
        ));
        if (panel.features.length !== initialLen) {
            rebuildMesh(panel);
        }
    }
    doc.emitChange?.('features');
}
