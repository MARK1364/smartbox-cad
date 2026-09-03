/**
 * Komenda wpustów pod plecy. Intent i zapis features wyłącznie w nm (SSOT).
 */

import { ProjectDocument } from '../../A1_core/project-document.js';
import { Command } from '../../A1_core/commands/command.js';
import { buildBackGrooves, PanelState } from '../back-groove-builder.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { defaultBackOverlapMm, readBackEdgeOffset } from '../back-overlap.js';

export class SyncBackGroovesCommand implements Command {
    readonly id: string;
    readonly label: string = 'Aktualizacja wpustów pod plecy';
    readonly timestamp: number;
    readonly affectedNodeIds: string[];
    readonly containerId: string;

    private oldState: Map<string, any> = new Map();

    constructor(containerId: string) {
        this.id = `cmd_sync_grooves_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.containerId = containerId;
        this.timestamp = Date.now();
        this.affectedNodeIds = [];
    }

    execute(document: ProjectDocument): void {
        const cntNode = document.findNode(this.containerId);
        if (!cntNode || cntNode.children.length === 0) return;

        const offsetsMm = ((cntNode.domainData as any)?.generatorParams?.offsets || {}) as Record<string, number>;
        const defaultOverlapMm = defaultBackOverlapMm();

        const panelStates: PanelState[] = [];
        for (const childNode of cntNode.children) {
            const child = childNode.domainData as any;
            if (child && (child.type === 'panel' || child.type === 'part')) {
                const state: PanelState = {
                    id: childNode.id,
                    role: child.role,
                    dim_nm: { x: child.width, y: child.height, z: child.thickness },
                    localMatrix: childNode.localMatrix,
                    zonePrefix: child.zonePrefix
                };
                if (child.role === 'BACK_PANEL') {
                    const panelName = child.name || 'Plecy';
                    state.backMarginsNm = {
                        left: mmToNm(readBackEdgeOffset(offsetsMm, panelName, '-X', defaultOverlapMm)),
                        right: mmToNm(readBackEdgeOffset(offsetsMm, panelName, '+X', defaultOverlapMm)),
                        bottom: mmToNm(readBackEdgeOffset(offsetsMm, panelName, '-Y', defaultOverlapMm)),
                        top: mmToNm(readBackEdgeOffset(offsetsMm, panelName, '+Y', defaultOverlapMm))
                    };
                }
                panelStates.push(state);

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

        const backPanel = cntNode.children.map((c: any) => c.domainData).find((p: any) => p && p.role === 'BACK_PANEL');
        const isBackPanelDisabled = backPanel && (backPanel.frozen === true || backPanel.visible === false);
        const intents = isBackPanelDisabled ? [] : buildBackGrooves(panelStates);

        const changedNodeIds = new Set<string>();

        for (const childNode of cntNode.children) {
            const child = childNode.domainData as any;
            if (child && (child.type === 'panel' || child.type === 'part') && child.features) {
                const initialLen = child.features.length;
                child.features = child.features.filter((f: any) => {
                    if (f.frozen || f.params?.frozen) return true;
                    return !(f.type === 'groove' && f.params?.isBackGroove) &&
                           !(f.type === 'Machining' && (f.parameters?.template_id === 'WPUST_PLECY' || f.operation === 'Groove'));
                });
                if (child.features.length !== initialLen) {
                    changedNodeIds.add(childNode.id);
                }
            }
        }

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
                node.setTranslation(new Vec3(
                    currentPos.x + intent.positionOverride_nm.x_nm,
                    currentPos.y + intent.positionOverride_nm.y_nm,
                    currentPos.z + intent.positionOverride_nm.z_nm
                ));
                changed = true;
            }

            if (intent.feature) {
                if (!data.features) data.features = [];
                const hasFrozenGroove = data.features.some((f: any) => (f.type === 'groove' && f.params?.isBackGroove) && (f.frozen || f.params?.frozen));
                if (!hasFrozenGroove) {
                    const p = intent.feature.params;
                    data.features.push({
                        id: `feat_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                        type: 'groove',
                        name: 'Wpust',
                        face: intent.feature.face === '+Z' ? 'FACE_Z_PLUS' : 'FACE_Z_MINUS',
                        params: {
                            isBackGroove: true,
                            u_nm: p.u_nm,
                            v_nm: p.v_nm,
                            width_nm: p.width_nm,
                            length_nm: p.length_nm,
                            depth_nm: p.depth_nm
                        }
                    });
                    changed = true;
                }
            }

            if (changed) changedNodeIds.add(intent.targetNodeId);
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
