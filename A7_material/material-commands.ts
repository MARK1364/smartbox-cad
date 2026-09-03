import { Command } from '../A1_core/commands/command.js';
import { ProjectDocument } from '../A1_core/project-document.js';
import { MaterialItem, MaterialScope } from './material-types.js';
import { mmToNm, nmToMm } from '../A1_core/cad-math/units.js';
import { rebuildSmartFrameContainer } from '../A3_smartframe/smartframe-adapter.js';
import { update_smartbox_core } from '../A2_smartbox/smartbox-core.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { CADNode } from '../A1_core/cad-node/cad-node.js';
import { isContainerModel, isPanelModel } from '../A1_core/domain-data.js';

interface PanelMaterialSnapshot {
    panelId: string;
    materialId: string;
    materialName: string;
    materialCode: string;
    thickness: number; // in nm
    color: { r: number; g: number; b: number; a?: number };
}

export class AssignMaterialCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[] = [];

    private targetNodeId: string;
    private newMaterial: MaterialItem;
    private scope: MaterialScope;
    private previousSnapshots: PanelMaterialSnapshot[] = [];
    private affectedContainerIds: Set<string> = new Set();

    constructor(targetNodeId: string, newMaterial: MaterialItem, scope: MaterialScope = 'SINGLE') {
        this.id = `assign_mat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.label = `Przypisz materiał: ${newMaterial.name} (${scope})`;
        this.timestamp = Date.now();
        this.targetNodeId = targetNodeId;
        this.newMaterial = newMaterial;
        this.scope = scope;
    }

    execute(document: ProjectDocument): void {
        if (!document) return;

        const targetNode = document.findNode(this.targetNodeId);
        if (!targetNode?.domainData || !isPanelModel(targetNode.domainData)) return;

        const targetPanel = targetNode.domainData;
        const targetThNm = targetPanel.thickness || 18_000_000;
        const targetMatId = targetPanel.materialId || targetPanel.material || 'W1100_ST9_18';
        const targetRole = (targetPanel.role || '').toUpperCase();
        const isTargetBack = targetRole === 'BACK_PANEL' || (targetPanel.name && targetPanel.name.toUpperCase().includes('PLECY'));

        const isMatchingSourcePanel = (candidateNode: CADNode): boolean => {
            if (!candidateNode.domainData) return false;
            if (candidateNode.id === targetNode.id) return true;
            const p = candidateNode.domainData;
            if (!isPanelModel(p)) return false;

            const cMatId = p.materialId || p.material || 'W1100_ST9_18';
            const cThNm = p.thickness || 18_000_000;
            const cRole = (p.role || '').toUpperCase();
            const isCandBack = cRole === 'BACK_PANEL' || (p.name && p.name.toUpperCase().includes('PLECY'));

            // Plecy (Back panel) nigdy nie dopasowują się do boku ani wieńca (i odwrotnie)!
            if (isTargetBack !== isCandBack) {
                return false;
            }

            // Grubość wyjściowa musi być zgodna z tolerancją < 1mm
            const thDiff = Math.abs(cThNm - targetThNm);
            if (thDiff > 1_000_000) {
                return false;
            }

            // Materiał wyjściowy musi być zgodny
            if (cMatId !== targetMatId) {
                return false;
            }

            return true;
        };

        // Znajdź wszystkie węzły docelowe wg zasięgu
        const nodesToUpdate: CADNode[] = [];
        this.affectedContainerIds.clear();

        if (this.scope === 'SINGLE') {
            nodesToUpdate.push(targetNode);
            const parentContainer = this.findParentContainerNode(targetNode);
            if (parentContainer) this.affectedContainerIds.add(parentContainer.id);
        } else if (this.scope === 'PROJECT') {
            const collect = (n: CADNode) => {
                if (n.domainData && isMatchingSourcePanel(n)) {
                    nodesToUpdate.push(n);
                    const parent = this.findParentContainerNode(n);
                    if (parent) this.affectedContainerIds.add(parent.id);
                }
                if (n.children) {
                    for (const c of n.children) collect(c);
                }
            };
            collect(document.rootNode);
        } else if (this.scope === 'SMARTBOX') {
            const sbContainer = this.findParentSmartBoxNode(targetNode);
            if (sbContainer) {
                this.affectedContainerIds.add(sbContainer.id);
                const collect = (n: CADNode) => {
                    if (n.domainData && isMatchingSourcePanel(n)) {
                        nodesToUpdate.push(n);
                    }
                    if (n.children) {
                        for (const c of n.children) collect(c);
                    }
                };
                collect(sbContainer);
            } else {
                nodesToUpdate.push(targetNode);
            }
        } else {
            // Scope === 'CONTAINER'
            const mainContainer = this.findParentContainerNode(targetNode);
            if (mainContainer) {
                this.affectedContainerIds.add(mainContainer.id);
                const collect = (n: CADNode) => {
                    if (n.domainData && isMatchingSourcePanel(n)) {
                        nodesToUpdate.push(n);
                    }
                    if (n.children) {
                        for (const c of n.children) collect(c);
                    }
                };
                collect(mainContainer);
            } else {
                nodesToUpdate.push(targetNode);
            }
        }

        // Zapisz migawkę poprzednich stanów (dla Undo)
        this.previousSnapshots = [];
        this.affectedNodeIds.length = 0;

        const newThNm = mmToNm(this.newMaterial.thickness_mm);

        for (const n of nodesToUpdate) {
            const p = n.domainData;
            if (!p || !isPanelModel(p)) continue;
            this.affectedNodeIds.push(n.id);
            this.previousSnapshots.push({
                panelId: n.id,
                materialId: p.materialId || p.material || '',
                materialName: p.materialName || '',
                materialCode: p.materialCode || '',
                thickness: p.thickness || 18_000_000,
                color: p.color ? { ...p.color } : { r: 0.8, g: 0.8, b: 0.8 }
            });

            // Zastosuj nowe właściwości
            p.materialId = this.newMaterial.id;
            p.material = this.newMaterial.id;
            p.materialName = this.newMaterial.name;
            p.materialCode = this.newMaterial.code;
            p.color = { ...this.newMaterial.color };

            if (!p.custom_properties) p.custom_properties = {};
            p.custom_properties.material = this.newMaterial.id;
            p.custom_properties.material_name = this.newMaterial.name;
            p.custom_properties.material_code = this.newMaterial.code;
            p.custom_properties.thickness_mm = this.newMaterial.thickness_mm;

            // Dla formatek wolnostojących (bez kontenera) zmieniamy wymiary od razu
            if (this.affectedContainerIds.size === 0) {
                if (typeof p.setDimensions === 'function') {
                    p.setDimensions(p.width, p.height, newThNm);
                } else {
                    p.thickness = newThNm;
                }
            }

            // Powiadom widok o zmianie materiału
            if (typeof p._emit === 'function') {
                p._emit('material', { material: this.newMaterial });
            }
        }

        // Przelicz powiązane kontenery SmartFrame / SmartBox
        for (const cId of this.affectedContainerIds) {
            const cNode = document.findNode(cId);
            if (cNode?.domainData && isContainerModel(cNode.domainData)) {
                const container = cNode.domainData;
                const pType = (container.generatorParams?.type || '').toLowerCase();
                if (pType.startsWith('smartbox')) {
                    update_smartbox_core(container, document);
                } else {
                    rebuildSmartFrameContainer(container);
                }
            }
        }

        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }

    undo(document: ProjectDocument): void {
        if (!document || this.previousSnapshots.length === 0) return;

        for (const snap of this.previousSnapshots) {
            const node = document.findNode(snap.panelId);
            if (!node?.domainData || !isPanelModel(node.domainData)) continue;

            const p = node.domainData;
            p.materialId = snap.materialId;
            p.material = snap.materialId;
            p.materialName = snap.materialName;
            p.materialCode = snap.materialCode;
            p.color = { ...snap.color };

            const oldThMm = nmToMm(snap.thickness);
            if (!p.custom_properties) p.custom_properties = {};
            p.custom_properties.material = snap.materialId;
            p.custom_properties.material_name = snap.materialName;
            p.custom_properties.material_code = snap.materialCode;
            p.custom_properties.thickness_mm = oldThMm;

            if (this.affectedContainerIds.size === 0) {
                if (typeof p.setDimensions === 'function') {
                    p.setDimensions(p.width, p.height, snap.thickness);
                } else {
                    p.thickness = snap.thickness;
                }
            }

            if (typeof p._emit === 'function') {
                p._emit('material', { material: snap });
            }
        }

        for (const cId of this.affectedContainerIds) {
            const cNode = document.findNode(cId);
            if (cNode?.domainData && isContainerModel(cNode.domainData)) {
                const container = cNode.domainData;
                const pType = (container.generatorParams?.type || '').toLowerCase();
                if (pType.startsWith('smartbox')) {
                    update_smartbox_core(container, document);
                } else {
                    rebuildSmartFrameContainer(container);
                }
            }
        }

        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
    }

    private findParentContainerNode(node: CADNode): CADNode | null {
        let curr = node.parent;
        while (curr) {
            if (curr.domainData && (isContainerModel(curr.domainData) || curr.nodeType === 'ASSEMBLY')) {
                return curr;
            }
            curr = curr.parent;
        }
        const doc = ContextManager.instance.document;
        if (doc && typeof doc.getContainers === 'function') {
            const containers = doc.getContainers();
            for (const cnt of containers) {
                if (cnt.children && cnt.children.some((c: any) => c.id === node.id)) {
                    return cnt;
                }
            }
        }
        return null;
    }

    private findParentSmartBoxNode(node: CADNode): CADNode | null {
        let curr = node.parent;
        while (curr) {
            const d = curr.domainData;
            if (d && isContainerModel(d) && (d.generatorParams?.type?.startsWith('smartbox') || (d as any).boxType)) {
                return curr;
            }
            curr = curr.parent;
        }
        return null;
    }
}

export class SetEdgeBandingCommand implements Command {
    readonly id: string;
    readonly label: string;
    readonly timestamp: number;
    readonly affectedNodeIds: string[] = [];

    private targetNodeId: string;
    private edgeKey: string; // '+X', '-X', '+Y', '-Y' or 'ALL'
    private edgeConfig: any;
    private scope: MaterialScope;
    private previousSnapshots: { panelId: string; edgeBanding: any }[] = [];

    constructor(targetNodeId: string, edgeKey: string, edgeConfig: any, scope: MaterialScope = 'SINGLE') {
        this.id = `set_edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.label = `Ustaw obrzeże: ${edgeKey} (${scope})`;
        this.timestamp = Date.now();
        this.targetNodeId = targetNodeId;
        this.edgeKey = edgeKey;
        this.edgeConfig = edgeConfig;
        this.scope = scope;
    }

    execute(document: ProjectDocument): void {
        if (!document) return;
        const targetNode = document.findNode(this.targetNodeId);
        if (!targetNode || !targetNode.domainData) return;

        const nodesToUpdate: CADNode[] = [];

        if (this.scope === 'SINGLE') {
            nodesToUpdate.push(targetNode);
        } else if (this.scope === 'PROJECT') {
            const collect = (n: CADNode) => {
                if (n.domainData && isPanelModel(n.domainData)) {
                    nodesToUpdate.push(n);
                }
                if (n.children) {
                    for (const c of n.children) collect(c);
                }
            };
            collect(document.rootNode);
        } else {
            // Scope === 'CONTAINER' or 'SMARTBOX'
            let parentContainer = targetNode.parent;
            while (parentContainer && !(parentContainer.domainData && isContainerModel(parentContainer.domainData)) && parentContainer.nodeType !== 'ASSEMBLY') {
                parentContainer = parentContainer.parent;
            }
            if (parentContainer) {
                const collect = (n: CADNode) => {
                    if (n.domainData && isPanelModel(n.domainData)) {
                        nodesToUpdate.push(n);
                    }
                    if (n.children) {
                        for (const c of n.children) collect(c);
                    }
                };
                collect(parentContainer);
            } else {
                nodesToUpdate.push(targetNode);
            }
        }

        this.previousSnapshots = [];
        this.affectedNodeIds.length = 0;

        for (const n of nodesToUpdate) {
            const p = n.domainData;
            if (!p || !isPanelModel(p)) continue;
            this.affectedNodeIds.push(n.id);
            this.previousSnapshots.push({
                panelId: n.id,
                edgeBanding: p.edgeBanding ? JSON.parse(JSON.stringify(p.edgeBanding)) : {}
            });

            if (this.edgeKey === 'ALL') {
                if (this.edgeConfig.active === false) {
                    if (typeof p.clearAllEdgeBanding === 'function') p.clearAllEdgeBanding();
                    else p.edgeBanding = {};
                } else {
                    if (typeof p.setAllEdges === 'function') p.setAllEdges(this.edgeConfig);
                    else p.edgeBanding = { '+X': this.edgeConfig, '-X': this.edgeConfig, '+Y': this.edgeConfig, '-Y': this.edgeConfig };
                }
            } else {
                if (this.edgeConfig.active === false) {
                    if (typeof p.removeEdgeBand === 'function') p.removeEdgeBand(this.edgeKey);
                    else if (p.edgeBanding) p.edgeBanding[this.edgeKey] = { active: false, type_id: 'none' };
                } else {
                    if (typeof p.setEdgeBand === 'function') p.setEdgeBand(this.edgeKey, this.edgeConfig);
                    else {
                        if (!p.edgeBanding) p.edgeBanding = {};
                        p.edgeBanding[this.edgeKey] = { ...this.edgeConfig };
                    }
                }
            }
        }

        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
        window.dispatchEvent(new CustomEvent('smartbox-project-changed'));
    }

    undo(document: ProjectDocument): void {
        if (!document || this.previousSnapshots.length === 0) return;

        for (const snap of this.previousSnapshots) {
            const node = document.findNode(snap.panelId);
            if (!node?.domainData || !isPanelModel(node.domainData)) continue;
            const p = node.domainData;
            if (typeof p.setEdgeBanding === 'function') {
                p.setEdgeBanding(snap.edgeBanding);
            } else {
                p.edgeBanding = { ...snap.edgeBanding };
                if (typeof p._emit === 'function') p._emit('edgeBanding', { edgeBanding: p.edgeBanding });
            }
        }

        if (typeof document.notifyDocumentChanged === 'function') {
            document.notifyDocumentChanged();
        }
        window.dispatchEvent(new CustomEvent('smartbox-project-changed'));
    }
}
