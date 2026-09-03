/**
 * sync-back-grooves-command.ts
 *
 * Komenda aktualizująca wpusty pod plecy za pomocą czystego buildera (LCS).
 * Zastępuje stary back-groove-resolver.
 */

import { ProjectDocument } from '../project-document.js';
import { Command } from './command.js';
import { buildBackGrooves, PanelState } from '../../A3_smartframe/back-groove-builder.js';
import { mmToNm, nmToMm } from '../cad-math/units.js';
import { Quat } from '../cad-math/quat.js';
import { Mat4 } from '../cad-math/mat4.js';
import { Vec3 } from '../cad-math/vec3.js';
export class SyncBackGroovesCommand implements Command {
    readonly id: string;
    readonly label: string = 'Aktualizacja wpustów pod plecy';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];

    readonly containerId: string;
    
    // Zapisujemy stan 'przed' w momencie wywołania, aby móc cofnąć zmiany
    private oldState: Map<string, any> = new Map();

    constructor(containerId: string) {
        this.id = `cmd_sync_grooves_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.containerId = containerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = []; // Zostanie wypełnione w execute
    }

    execute(document: ProjectDocument): void {
        const cntNode = document.findNode(this.containerId);
        if (!cntNode || cntNode.children.length === 0) return;

        // 1. Zbieramy stan paneli
        const panelStates: PanelState[] = [];
        for (const childNode of cntNode.children) {
            const child = childNode.domainData as any;
            if (child && (child.type === 'panel' || child.type === 'part')) {
                panelStates.push({
                    id: childNode.id,
                    role: child.role,
                    dim_nm: { x: child.width, y: child.height, z: child.thickness },
                    localMatrix: childNode.localMatrix,
                    zonePrefix: child.zonePrefix
                });
                
                // Zapisujemy stary stan na wypadek undo
                if (!this.oldState.has(childNode.id)) {
                    this.oldState.set(childNode.id, {
                        width: child.width,
                        height: child.height,
                        thickness: child.thickness,
                        position: childNode.localMatrix.decompose().translation,
                        features: child.features ? JSON.parse(JSON.stringify(child.features)) : []
                    });
                }
            }
        }

        // Sprawdzamy czy plecy (BACK_PANEL) nie zostały zamrożone/wykluczone przez użytkownika
        const backPanel = cntNode.children.map((c: any) => c.domainData).find((p: any) => p && (p.role === 'BACK_PANEL' || p.name?.includes('Plecy')));
        const isBackPanelDisabled = backPanel && (backPanel.frozen === true || backPanel.visible === false);

        // 2. Wyliczamy nowe intencje z użyciem czystego buildera LCS
        const intents = isBackPanelDisabled ? [] : buildBackGrooves(panelStates);

        // 3. Aplikujemy zmiany i zbieramy listę zmodyfikowanych węzłów
        const changedNodeIds = new Set<string>();

        // Czyścimy nie-zamrożone wpusty pod plecy na panelach obwodowych
        for (const childNode of cntNode.children) {
            const child = childNode.domainData as any;
            if (child && (child.type === 'panel' || child.type === 'part') && child.features) {
                const initialLen = child.features.length;
                child.features = child.features.filter((f: any) => {
                    if (f.frozen || f.params?.frozen) return true; // Zachowaj zamrożone wpusty!
                    return !(f.type === 'groove' && f.params?.isBackGroove) &&
                           !(f.type === 'Machining' && (f.parameters?.template_id === 'WPUST_PLECY' || f.operation === 'Groove'));
                });
                if (child.features.length !== initialLen) {
                    changedNodeIds.add(childNode.id);
                }
            }
        }

        // Aplikujemy wygenerowane intencje
        for (const intent of intents) {
            const node = document.findNode(intent.targetNodeId);
            if (!node || !node.domainData) continue;
            
            const data = node.domainData as any;
            let changed = false;

            if (intent.dimensionsOverride_nm) {
                data.width = intent.dimensionsOverride_nm.width_nm;
                data.height = intent.dimensionsOverride_nm.height_nm;
                data.thickness = intent.dimensionsOverride_nm.thickness_nm;
                changed = true;
            }

            if (intent.positionOverride_nm) {
                const currentPos = node.localMatrix.decompose().translation;
                const newPos = new Vec3(
                    currentPos.x + intent.positionOverride_nm.x_nm,
                    currentPos.y + intent.positionOverride_nm.y_nm,
                    currentPos.z + intent.positionOverride_nm.z_nm
                );
                node.setTranslation(newPos);
                changed = true;
            }

            if (intent.feature) {
                if (!data.features) data.features = [];
                // Jeśli panel ma już zamrożony wpust, nie dodawaj nowego automatycznego wpustu
                const hasFrozenGroove = data.features.some((f: any) => (f.type === 'groove' && f.params?.isBackGroove) && (f.frozen || f.params?.frozen));
                if (!hasFrozenGroove) {
                    data.features.push({
                        id: `feat_${Date.now()}_${Math.floor(Math.random()*10000)}`,
                        type: 'groove',
                        name: 'Wpust',
                        face: intent.feature.face === '+Z' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS',
                        params: {
                            isBackGroove: true,
                            u: nmToMm(intent.feature.params.u_nm),
                            v: nmToMm(intent.feature.params.v_nm),
                            width: nmToMm(intent.feature.params.width_nm),
                            length: nmToMm(intent.feature.params.length_nm),
                            depth: nmToMm(intent.feature.params.depth_nm)
                        }
                    });
                    changed = true;
                }
            }

            if (changed) {
                changedNodeIds.add(intent.targetNodeId);
            }
        }

        const idsArray = Array.from(changedNodeIds);
        this.affectedNodeIds.splice(0, this.affectedNodeIds.length, ...idsArray);

        if (idsArray.length > 0) {
            document.emitChange('features', idsArray);
            document.emitChange('dimensions', idsArray);
        }
    }

    undo(document: ProjectDocument): void {
        for (const [nodeId, state] of this.oldState) {
            const node = document.findNode(nodeId);
            if (!node || !node.domainData) continue;

            const data = node.domainData as any;
            data.width = state.width;
            data.height = state.height;
            data.thickness = state.thickness;
            node.setTranslation(state.position);
            data.features = JSON.parse(JSON.stringify(state.features));
        }

        if (this.affectedNodeIds.length > 0) {
            document.emitChange('features', this.affectedNodeIds);
            document.emitChange('dimensions', this.affectedNodeIds);
        }
    }
}
// Trigger rebuild
