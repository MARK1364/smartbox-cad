/**
 * SmartPanel Web — Context Menu Handler
 * 
 * Obsługuje menu kontekstowe pod prawym przyciskiem myszy na scenie 3D.
 * Rozpoznaje wskazany obiekt 3D i deleguje wyświetlenie do wspólnego SSOT
 * menu kontekstowego (showCadTreeContextMenu), gwarantując identyczny wygląd,
 * układ i zestaw akcji dla sceny 3D, drzewa obiektów oraz paska hierarchii.
 */

import { ContextManager } from './context-manager.js';
import { UIController } from './ui-controller.js';
import { findFacesAlongRay } from './quick-pick/quick-pick-detector.js';
import { openQuickPick } from './quick-pick/quick-pick-events.js';
import { closeCadFloatingEdit } from '../src/floating-edit/cad-edit-entity.js';
import { isDimensionToolActive, getDimensionTool } from '../A8_pmi/pmi-tool-activate.js';
import { isSmartWallContainer } from '../S4_sciany/smartwall-types.js';
import { showCadTreeContextMenu, type TreeContextMenuData } from '../src/module-data/tree-context-menu.js';

export class ContextMenuHandler {
    private isApplianceModel(m: any): boolean {
        if (!m) return false;
        return m.role === 'APPLIANCE' || String(m.generatorParams?.type || '') === 'smart_appliance';
    }

    private isAppliancePartModel(m: any): boolean {
        if (!m) return false;
        const role = String(m.role || '').toUpperCase();
        return role === 'APPLIANCE_FRONT' || role === 'APPLIANCE_CORPUS' || m.custom_properties?.domain === 'appliance_part';
    }

    /** Kontener AGD spod kursora / z inspect (część front/korpus → rodzic). */
    private resolveApplianceTarget(mesh: any, doc: any, inspected: any): any | null {
        const tryId = (id: string | undefined | null) => {
            if (!id || !doc?.findNode) return null;
            const node = doc.findNode(id);
            const model = node?.domainData;
            if (this.isApplianceModel(model)) return model;
            if (this.isAppliancePartModel(model) && node?.parent?.domainData && this.isApplianceModel(node.parent.domainData)) {
                return node.parent.domainData;
            }
            return null;
        };
        const meta = mesh?.metadata;
        const fromMeta = tryId(meta?.nodeId || meta?.modelId || meta?.containerId || meta?.id);
        if (fromMeta) return fromMeta;
        if (inspected?.containerId) {
            const c = tryId(inspected.containerId);
            if (c) return c;
        }
        if (inspected?.panelId) {
            const p = tryId(inspected.panelId);
            if (p) return p;
        }
        return null;
    }

    /** Kontener nadrzędny (korpus lub blok) dla formatki lub klikniętego mesha. */
    private resolveContainerTarget(mesh: any, doc: any, inspected: any): { id: string; model: any; isBlok: boolean } | null {
        const tryNode = (nodeId: string | undefined | null) => {
            if (!nodeId || !doc?.findNode) return null;
            const node = doc.findNode(nodeId);
            if (!node) return null;
            const selfData = node.domainData;
            if (isSmartWallContainer(selfData) || selfData?.generatorParams?.type === 'smartwall') return null;
            if (node !== doc.root && node.id !== 'root' && (selfData?.type === 'container' || (node.nodeType === 'ASSEMBLY' && (selfData?.is_blok || selfData?.generatorParams || selfData?.type === 'container')))) {
                const isBlok = !!(selfData?.is_blok || selfData?.type === 'bloki' || selfData?.generatorParams?.type?.startsWith?.('bloki') || selfData?.generatorParams?.type?.startsWith?.('blok_') || selfData?.generatorParams?.boxType !== undefined);
                return { id: node.id, model: selfData, isBlok };
            }
            let curr = node.parent;
            while (curr) {
                if (curr === doc.root || curr.id === 'root') break;
                const d = curr.domainData;
                if (isSmartWallContainer(d) || d?.generatorParams?.type === 'smartwall') {
                    curr = curr.parent;
                    continue;
                }
                if (d && (d.type === 'container' || curr.nodeType === 'ASSEMBLY' || d.is_blok || d.generatorParams?.type?.startsWith?.('korpus') || d.generatorParams?.type?.startsWith?.('blok_'))) {
                    const isBlok = !!(d.is_blok || d.type === 'bloki' || d.generatorParams?.type?.startsWith?.('bloki') || d.generatorParams?.type?.startsWith?.('blok_') || d.generatorParams?.boxType !== undefined);
                    return { id: curr.id, model: d, isBlok };
                }
                curr = curr.parent;
            }
            return null;
        };

        if (inspected?.containerId) {
            const c = tryNode(inspected.containerId);
            if (c) return c;
        }
        if (inspected?.panelId) {
            const c = tryNode(inspected.panelId);
            if (c) return c;
        }
        const meta = mesh?.metadata;
        if (meta?.containerId) {
            const c = tryNode(meta.containerId);
            if (c) return c;
        }
        if (meta?.panelId || meta?.nodeId || meta?.modelId || meta?.id) {
            const c = tryNode(meta?.panelId || meta?.nodeId || meta?.modelId || meta?.id);
            if (c) return c;
        }
        return null;
    }

    /** SmartWall (skos pod schody, ściana, pokój) dla formatki lub klikniętego mesha. */
    private resolveWallTarget(mesh: any, doc: any, inspected: any): { id: string; model: any; isSkos: boolean } | null {
        const tryNode = (nodeId: string | undefined | null) => {
            if (!nodeId || !doc?.findNode) return null;
            const node = doc.findNode(nodeId);
            if (!node) return null;
            const selfData = node.domainData;
            if (isSmartWallContainer(selfData)) {
                return { id: node.id, model: selfData, isSkos: selfData.generatorParams?.preset === 'skos' };
            }
            let curr = node.parent;
            while (curr) {
                if (curr === doc.root || curr.id === 'root') break;
                const d = curr.domainData;
                if (isSmartWallContainer(d)) {
                    return { id: curr.id, model: d, isSkos: d.generatorParams?.preset === 'skos' };
                }
                curr = curr.parent;
            }
            return null;
        };

        if (inspected?.containerId) {
            const w = tryNode(inspected.containerId);
            if (w) return w;
        }
        if (inspected?.panelId) {
            const w = tryNode(inspected.panelId);
            if (w) return w;
        }
        const meta = mesh?.metadata;
        if (meta?.containerId) {
            const w = tryNode(meta.containerId);
            if (w) return w;
        }
        if (meta?.panelModel?.id) {
            const w = tryNode(meta.panelModel.id);
            if (w) return w;
        }
        if (meta?.panelId || meta?.nodeId || meta?.modelId || meta?.id) {
            const w = tryNode(meta?.panelId || meta?.nodeId || meta?.modelId || meta?.id);
            if (w) return w;
        }
        return null;
    }

    /** SmartPart (uchwyt / CUSTOM / zawieszki) spod kursora. */
    private resolveSmartPartHandle(mesh: any, doc: any): any | null {
        const meta = mesh?.metadata;
        if (!meta) return null;
        const metaType = String(meta.type || '');
        const nodeId = (meta.nodeId || meta.modelId || meta.id) as string | undefined;
        const node = nodeId ? doc?.findNode?.(nodeId) : null;
        let model = node?.domainData ?? meta.model ?? null;
        // Part zawieszki → grupa nadrzędna (tu są parameters)
        if (model && (model.role === 'SMARTPART_HANGER' || String(model.generatorParams?.type || '') === 'smartpart_hanger')) {
            const groupId = model.generatorParams?.groupId;
            const group = groupId ? doc?.findNode?.(groupId)?.domainData : node?.parent?.domainData;
            if (group) model = group;
        }
        if (!model) return null;
        const role = String(model.role || '');
        const genType = String(model.generatorParams?.type || '').toLowerCase();
        const isSmart =
            role.startsWith('SMARTPART')
            || genType.startsWith('smartpart')
            || model.generatorParams?.partType === 'HANDLE'
            || !!model.generatorParams?.isSmartPart
            || metaType === 'smartpart_handle'
            || metaType.startsWith('smartpart');
        return isSmart ? model : null;
    }

    private isLibraryFeature(f: any): boolean {
        return !!f && f.params?.source === 'library' && !!f.params?.library_id;
    }

    /**
     * Operacja biblioteczna (rewizja / przetłoczenie): brązowe gizmo albo formatka z taką operacją.
     */
    private resolveLibraryOperation(
        mesh: any,
        doc: any,
        getAllPanels: () => any[],
        preferredFace?: string | null,
    ): { featureId: string; panelId: string; libraryId: string; face?: string } | null {
        const meta = mesh?.metadata;
        let panel: any = meta?.panelModel || null;
        if (!panel && meta?.panelId) {
            panel = getAllPanels().find((p: any) => p.id === meta.panelId) || null;
        }
        if (!panel && mesh) {
            const mid = meta?.modelId || meta?.smartId || meta?.id;
            if (mid) panel = getAllPanels().find((p: any) => p.id === mid) || null;
            if (!panel) {
                const node = mid ? doc?.findNode?.(mid) : null;
                panel = node?.domainData || null;
            }
        }
        if (!panel?.features?.length) return null;

        const libraryFeats = panel.features.filter((f: any) => this.isLibraryFeature(f));
        if (!libraryFeats.length) return null;

        const faceNorm = preferredFace ? String(preferredFace).toUpperCase() : '';
        const onFace = faceNorm
            ? libraryFeats.find((f: any) => String(f.face || '').toUpperCase() === faceNorm)
            : null;
        const feat = onFace || libraryFeats[0];
        return {
            featureId: String(feat.id),
            panelId: String(panel.id),
            libraryId: String(feat.params.library_id),
            face: feat.face ? String(feat.face) : undefined,
        };
    }

    public init(
        canvas: HTMLCanvasElement,
        _contextMenu: any,
        propertiesManager: any,
        getAllPanels: () => any[],
        _applyUndo: () => void,
        _applyRedo: () => void,
    ): void {
        const viewport = ContextManager.instance.viewport;
        const doc = ContextManager.instance.document;
        const facePicker = ContextManager.instance.facePicker;

        if (!canvas || !viewport || !doc || !facePicker) return;

        canvas.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();

            // Zamknij otwarte okna edycji pływającej natychmiast po kliknięciu PPM
            closeCadFloatingEdit();

            // Jeśli użytkownik właśnie zakończył przesuwanie kamery PPM (SolidWorks pan gesture) - zablokuj otwarcie menu
            if (viewport.shouldSuppressContextMenu && viewport.shouldSuppressContextMenu()) {
                return;
            }

            // Gdy aktywne jest narzędzie wymiarowania (PMI) — PPM otwiera dedykowane menu kierunku osi / skosu
            const sm = ContextManager.instance.stateMachine;
            if (sm && isDimensionToolActive(sm)) {
                const dimTool = getDimensionTool(sm);
                if (dimTool) {
                    dimTool.openContextMenu(e.clientX, e.clientY);
                    return;
                }
            }

            const isPickingConstraint = !!ContextManager.instance.activeConstraintPicker;
            const isPickingRef = !!ContextManager.instance.activeReferencePicker;

            // Gdy aktywna jest pipeta więzów / relacji — PPM natychmiast wyzwala QuickPick (Solid Edge style)!
            if (isPickingConstraint || isPickingRef) {
                const candidates = findFacesAlongRay(viewport.scene, viewport.scene.pointerX, viewport.scene.pointerY);
                if (candidates.length > 0) {
                    openQuickPick({
                        screenX: e.clientX,
                        screenY: e.clientY,
                        candidates,
                        onSelect: (candidate) => {
                            facePicker.selectFaceExplicit(
                                candidate.mesh,
                                candidate.worldPoint,
                                candidate.smartId,
                                candidate.panelModel,
                                candidate.worldNormal
                            );
                        }
                    });
                    return;
                }
            }

            const generalPick = viewport.scene.pick(
                viewport.scene.pointerX,
                viewport.scene.pointerY
            );
            const pickedMesh = (generalPick && generalPick.hit) ? generalPick.pickedMesh : null;

            const pickResult = viewport.scene.pick(
                viewport.scene.pointerX,
                viewport.scene.pointerY,
                (mesh: any) => mesh.metadata && mesh.metadata.faceName
            );

            const clickedFaceMesh = (pickResult && pickResult.hit) ? pickResult.pickedMesh : null;
            const clickedFaceName = clickedFaceMesh ? clickedFaceMesh.metadata.faceName : null;

            if (clickedFaceMesh && clickedFaceName) {
                facePicker.selectedFace = clickedFaceMesh;
                facePicker.selectedFaces.clear();
                facePicker.selectedFaces.add(clickedFaceMesh);
            } else {
                if (facePicker.selectionMode === 'object') {
                    facePicker.selectedFace = null;
                    facePicker.selectedFaces.clear();
                }
            }

            const quickPickCandidates = findFacesAlongRay(viewport.scene, viewport.scene.pointerX, viewport.scene.pointerY);

            let inspected: any = null;
            if (pickedMesh) {
                inspected = propertiesManager?.inspectMesh?.(pickedMesh, doc, ContextManager.instance.panelViews, getAllPanels, false);
            }

            const smartPart = this.resolveSmartPartHandle(pickedMesh, doc);
            let libraryOp: any = null;
            if (!smartPart) {
                libraryOp = this.resolveLibraryOperation(
                    pickedMesh,
                    doc,
                    getAllPanels,
                    clickedFaceName,
                );
            }

            const applianceTarget = this.resolveApplianceTarget(pickedMesh, doc, inspected);
            const wallTarget = this.resolveWallTarget(pickedMesh, doc, inspected);
            const containerTarget = this.resolveContainerTarget(pickedMesh, doc, inspected);

            let data: TreeContextMenuData;

            if (libraryOp) {
                const panelNode = doc.findNode?.(libraryOp.panelId);
                const panel = panelNode?.domainData;
                if (panel) {
                    doc.setActiveEntity?.(panel);
                    UIController.instance?.emitTree?.('select-part', { id: libraryOp.panelId, uuid: libraryOp.panelId });
                }
                UIController.instance?.emitTree?.('select-feature', {
                    id: libraryOp.featureId,
                    panelId: libraryOp.panelId,
                    face: libraryOp.face,
                    openProperties: false,
                });
                data = {
                    type: 'feature',
                    id: libraryOp.featureId,
                    panelId: libraryOp.panelId,
                    libraryId: libraryOp.libraryId,
                    face: libraryOp.face,
                    isSmart: true,
                    source: 'library',
                    clientX: e.clientX,
                    clientY: e.clientY,
                    quickPickCandidates: quickPickCandidates.length > 1 ? quickPickCandidates : undefined,
                };
            } else if (smartPart) {
                doc.setActiveEntity?.(smartPart);
                UIController.instance?.emitTree?.('select-container', { id: smartPart.id });
                data = {
                    type: 'smartpart',
                    id: smartPart.id,
                    name: smartPart.name,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    quickPickCandidates: quickPickCandidates.length > 1 ? quickPickCandidates : undefined,
                };
            } else if (applianceTarget) {
                doc.setActiveEntity?.(applianceTarget);
                UIController.instance?.emitTree?.('select-container', { id: applianceTarget.id });
                data = {
                    type: 'agd',
                    id: applianceTarget.id,
                    name: applianceTarget.name,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    quickPickCandidates: quickPickCandidates.length > 1 ? quickPickCandidates : undefined,
                };
            } else if (wallTarget) {
                const wNode = doc.findNode?.(wallTarget.id);
                if (wNode?.domainData) doc.setActiveEntity?.(wNode.domainData);
                UIController.instance?.emitTree?.('select-container', { id: wallTarget.id });
                data = {
                    type: 'wall',
                    id: wallTarget.id,
                    name: wallTarget.model?.name,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    quickPickCandidates: quickPickCandidates.length > 1 ? quickPickCandidates : undefined,
                };
            } else if (pickedMesh?.metadata?.type === 'hardware' || inspected?.hardwareId) {
                const hwId = pickedMesh?.metadata?.id || inspected?.id || inspected?.hardwareId;
                UIController.instance?.emitTree?.('select-hardware', { id: hwId });
                data = {
                    type: 'hardware',
                    id: hwId,
                    name: pickedMesh?.metadata?.name || inspected?.name,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    quickPickCandidates: quickPickCandidates.length > 1 ? quickPickCandidates : undefined,
                };
            } else if (inspected?.holeProps || inspected?.grooveProps || inspected?.kind === 'feature') {
                const featId = inspected.id;
                const parentPanelId = inspected.parentPanelId || inspected.panelId;
                UIController.instance?.emitTree?.('select-feature', {
                    id: featId,
                    panelId: parentPanelId,
                    face: inspected.face,
                    openProperties: false,
                });
                data = {
                    type: 'feature',
                    id: featId,
                    panelId: parentPanelId,
                    face: inspected.face,
                    isSmart: false,
                    source: 'engine',
                    frozen: inspected.frozen || inspected.params?.frozen,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    quickPickCandidates: quickPickCandidates.length > 1 ? quickPickCandidates : undefined,
                };
            } else {
                // Sprawdź formatkę (panel)
                const panel = pickedMesh?.metadata?.panelModel
                    || (inspected?.panelId ? (doc.findNode?.(inspected.panelId)?.domainData || getAllPanels().find((p: any) => p.id === inspected.panelId)) : null)
                    || (pickedMesh?.metadata?.panelId ? (doc.findNode?.(pickedMesh.metadata.panelId)?.domainData || getAllPanels().find((p: any) => p.id === pickedMesh.metadata.panelId)) : null)
                    || (pickedMesh?.metadata?.id ? (doc.findNode?.(pickedMesh.metadata.id)?.domainData || getAllPanels().find((p: any) => p.id === pickedMesh.metadata.id)) : null);

                if (panel) {
                    doc.setActiveEntity?.(panel);
                    UIController.instance?.emitTree?.('select-part', { id: panel.id, uuid: panel.id });
                    data = {
                        type: 'part',
                        id: panel.id,
                        uuid: panel.id,
                        name: panel.name,
                        isManual: (panel as any).engineManaged === false,
                        frozen: !!(panel as any).frozen,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        quickPickCandidates: quickPickCandidates.length > 1 ? quickPickCandidates : undefined,
                    };
                } else if (containerTarget) {
                    const cNode = doc.findNode?.(containerTarget.id);
                    if (cNode?.domainData) doc.setActiveEntity?.(cNode.domainData);
                    UIController.instance?.emitTree?.('select-container', { id: containerTarget.id });
                    data = {
                        type: containerTarget.isBlok ? 'bloki' : 'container',
                        id: containerTarget.id,
                        name: containerTarget.model?.name,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        quickPickCandidates: quickPickCandidates.length > 1 ? quickPickCandidates : undefined,
                    };
                } else {
                    // Puste miejsce (tło sceny / podłoga)
                    data = {
                        type: 'project',
                        id: 'root',
                        name: 'Projekt',
                        clientX: e.clientX,
                        clientY: e.clientY,
                    };
                }
            }

            showCadTreeContextMenu(data);
        });
    }
}
