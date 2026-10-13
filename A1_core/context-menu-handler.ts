/**
 * SmartPanel Web — Context Menu Handler
 * 
 * Obsługuje menu kontekstowe pod prawym przyciskiem myszy (3D oraz na drzewie obiektu).
 */

import { ContextManager } from './context-manager.js';
import { UIController } from './ui-controller.js';
import { getModuleOpenHandler } from './module-open-port.js';
import { findFacesAlongRay } from './quick-pick/quick-pick-detector.js';
import { openQuickPick } from './quick-pick/quick-pick-events.js';
import { openCadEditEntity } from '../src/floating-edit/cad-edit-entity.js';
import { isDimensionToolActive, getDimensionTool } from '../A8_pmi/pmi-tool-activate.js';

export class ContextMenuHandler {
    private svgIcons = {
        quickPick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>',
        properties: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
        undo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>',
        redo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path></svg>',
        eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
        eyeOff: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
        freeze: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/></svg>',
        trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        cnc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v5"/><path d="M9 7h6v4a3 3 0 0 1-6 0V7z"/><path d="M12 14v4"/><path d="M10 21l2-3 2 3h-4z"/></svg>',
        edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    };

    private lastInspectedData: any = null;
    private _lastPickedMesh: any = null;
    private _lastSmartPart: any = null;
    private _lastAppliance: any = null;
    /** Ręczna formatka SmartPanel (engineManaged === false) — jedyna z bezpośrednią edycją. */
    private _lastManualPanelId: string | null = null;
    /** Operacja biblioteczna spod kursora / na klikniętej formatce. */
    private _lastLibraryOp: {
        featureId: string;
        panelId: string;
        libraryId: string;
        face?: string;
    } | null = null;
    /** Kontener nadrzędny (korpus lub blok) dla klikniętej formatki / mesha. */
    private _lastContainer: { id: string; model: any; isBlok: boolean } | null = null;
    private _lastClientX: number = 0;
    private _lastClientY: number = 0;

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
            let node = doc.findNode(nodeId);
            if (!node) return null;
            const selfData = node.domainData;
            if (node !== doc.root && node.id !== 'root' && (selfData?.type === 'container' || (node.nodeType === 'ASSEMBLY' && (selfData?.is_blok || selfData?.generatorParams || selfData?.type === 'container')))) {
                const isBlok = !!(selfData?.is_blok || selfData?.type === 'bloki' || selfData?.generatorParams?.type?.startsWith?.('bloki') || selfData?.generatorParams?.type?.startsWith?.('blok_') || selfData?.generatorParams?.boxType !== undefined);
                return { id: node.id, model: selfData, isBlok };
            }
            let curr = node.parent;
            while (curr) {
                if (curr === doc.root || curr.id === 'root') break;
                const d = curr.domainData;
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
     * Ręczna formatka SmartPanel (engineManaged === false).
     * Formatki silnikowe z korpusów / bloków zwracają null — te edytuje się
     * przez „Edytuj korpus” / „Edytuj blok”.
     */
    private resolveManualPanel(
        panelId: string | undefined | null,
        pickedMesh: any,
        doc: any,
        getAllPanels: () => any[],
    ): any | null {
        if (!panelId) return null;
        const fromMesh = pickedMesh?.metadata?.panelModel;
        if (fromMesh && String(fromMesh.id) === String(panelId)) {
            return (fromMesh as any).engineManaged === false ? fromMesh : null;
        }
        let panel: any = null;
        try {
            const all = getAllPanels();
            panel = all.find((p: any) => p?.id === panelId) || null;
        } catch { panel = null; }
        if (!panel && doc?.findNode) {
            panel = doc.findNode(panelId)?.domainData || null;
        }
        if (!panel) return null;
        return (panel as any).engineManaged === false ? panel : null;
    }

    /**
     * Operacja biblioteczna (rewizja / przetłoczenie): brązowe gizmo albo formatka z taką operacją.
     * Preferuje gizmo pod kursorem, potem feature na wskazanej ścianie, potem pierwszą na panelu.
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
        if (!panel && this.lastInspectedData?.panelId) {
            panel = getAllPanels().find((p: any) => p.id === this.lastInspectedData.panelId) || null;
        }
        if (!panel && mesh) {
            // PanelView root / face mesh — id formatki w metadata
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

    public init(canvas: HTMLCanvasElement, contextMenu: any, propertiesManager: any, getAllPanels: () => any[], applyUndo: () => void, applyRedo: () => void): void {
        const viewport = ContextManager.instance.viewport;
        const doc = ContextManager.instance.document;
        const facePicker = ContextManager.instance.facePicker;
        const canUndo = () => !!ContextManager.instance.commandHistory?.canUndo;
        const canRedo = () => !!ContextManager.instance.commandHistory?.canRedo;

        if (!canvas || !viewport || !doc || !facePicker) return;

        canvas.addEventListener('contextmenu', (e: MouseEvent) => {
            e.preventDefault();

            // Jeśli użytkownik właśnie zakończył przesuwanie kamery PPM (SolidWorks pan gesture) - zablokuj otwarcie menu
            if (viewport.shouldSuppressContextMenu && viewport.shouldSuppressContextMenu()) {
                return;
            }

            this._lastClientX = e.clientX;
            this._lastClientY = e.clientY;

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

            const items: any[] = [];
            this.lastInspectedData = null;
            this._lastSmartPart = null;
            this._lastAppliance = null;
            this._lastManualPanelId = null;
            this._lastLibraryOp = null;
            this._lastContainer = null;

            const generalPick = viewport.scene.pick(
                viewport.scene.pointerX,
                viewport.scene.pointerY
            );
            const pickedMesh = (generalPick && generalPick.hit) ? generalPick.pickedMesh : null;
            this._lastPickedMesh = pickedMesh;
            this._lastSmartPart = this.resolveSmartPartHandle(pickedMesh, doc);

            const pickResult = viewport.scene.pick(
                viewport.scene.pointerX,
                viewport.scene.pointerY,
                (mesh: any) => mesh.metadata && mesh.metadata.faceName
            );

            const clickedFaceMesh = (pickResult && pickResult.hit) ? pickResult.pickedMesh : null;
            const clickedFaceName = clickedFaceMesh ? clickedFaceMesh.metadata.faceName : null;

            if (pickedMesh) {
                this.lastInspectedData = propertiesManager.inspectMesh(pickedMesh, doc, ContextManager.instance.panelViews, getAllPanels, false);
                const panel = pickedMesh.metadata?.panelModel
                    || (this.lastInspectedData?.panelId ? (doc.findNode?.(this.lastInspectedData.panelId)?.domainData || getAllPanels().find((p: any) => p.id === this.lastInspectedData.panelId)) : null);
                if (panel) {
                    doc.setActiveEntity?.(panel);
                }
            }

            // Operacja na formacie — jak SmartPart: Edytuj → okno pływające.
            if (!this._lastSmartPart) {
                this._lastLibraryOp = this.resolveLibraryOperation(
                    pickedMesh,
                    doc,
                    getAllPanels,
                    clickedFaceName,
                );
            }

            // Edycje jako przyciski obok siebie (toolbar)
            const applianceTarget = this.resolveApplianceTarget(pickedMesh, doc, this.lastInspectedData);
            this._lastContainer = this.resolveContainerTarget(pickedMesh, doc, this.lastInspectedData);

            const editTools: any[] = [];

            // Opcja edycji formatki („Formatka”) TYLKO dla ręcznych ze SmartPanel
            // (engineManaged === false). Silnikowe z korpusu/bloku → przez Edytuj korpus/blok.
            const manualPanel = this.resolveManualPanel(
                this.lastInspectedData?.panelId,
                pickedMesh,
                doc,
                getAllPanels,
            );
            if (manualPanel) {
                this._lastManualPanelId = String(manualPanel.id || this.lastInspectedData.panelId);
                editTools.push({
                    label: 'Edytuj formatkę',
                    caption: 'Formatka',
                    icon: this.svgIcons.edit,
                    action: 'edit-panel',
                });
            }

            if (this._lastContainer) {
                editTools.push({
                    label: this._lastContainer.isBlok ? 'Edytuj blok' : 'Edytuj korpus',
                    caption: this._lastContainer.isBlok ? 'Blok' : 'Korpus',
                    icon: this.svgIcons.edit,
                    action: this._lastContainer.isBlok ? 'edit-bloki' : 'edit-korpus',
                });
            }

            if (this._lastLibraryOp) {
                editTools.push({
                    label: 'Edytuj operację',
                    caption: 'Operacja',
                    icon: this.svgIcons.edit,
                    action: 'edit-operation',
                });
            }

            if (this._lastSmartPart) {
                editTools.push({
                    label: 'Edytuj SmartPart',
                    caption: 'SmartPart',
                    icon: this.svgIcons.edit,
                    action: 'edit-smartpart',
                });
            } else if (applianceTarget) {
                this._lastAppliance = applianceTarget;
                editTools.push({
                    label: 'Edytuj AGD',
                    caption: 'AGD',
                    icon: this.svgIcons.edit,
                    action: 'edit-agd',
                });
            }

            if (editTools.length > 0) {
                items.push({
                    section: 'Edycja',
                    toolbar: editTools,
                });
                items.push({ separator: true });
            }

            const quickPickCandidates = findFacesAlongRay(viewport.scene, viewport.scene.pointerX, viewport.scene.pointerY);
            if (quickPickCandidates.length > 1) {
                // Krótka nazwa: Wybierz zakrytą = wybór zakrytej płaszczyzny pod kursorem
                items.push({
                    section: 'Wybór 3D',
                    toolbar: [{
                        label: `Wybierz zakrytą — inne płaszczyzny pod kursorem (${quickPickCandidates.length})`,
                        caption: `Wybierz zakrytą · ${quickPickCandidates.length}`,
                        icon: this.svgIcons.quickPick,
                        action: 'open-quick-pick',
                    }],
                });
                items.push({ separator: true });
            }

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


            const isComponent = !!(
                this.lastInspectedData?.panelId ||
                this.lastInspectedData?.containerId ||
                this.lastInspectedData?.kind === 'feature' ||
                this.lastInspectedData?.holeProps ||
                this.lastInspectedData?.grooveProps ||
                pickedMesh?.metadata?.type === 'hardware' ||
                this.lastInspectedData?.hardwareId
            );

            if (isComponent) {
                let isFrozen = false;
                if (this.lastInspectedData?.panelId) {
                    const p = getAllPanels().find((x: any) => x.id === this.lastInspectedData.panelId);
                    isFrozen = !!p?.frozen;
                } else if (this.lastInspectedData?.holeProps || this.lastInspectedData?.grooveProps || this.lastInspectedData?.kind === 'feature') {
                    isFrozen = !!(this.lastInspectedData.frozen || this.lastInspectedData.params?.frozen);
                } else if (pickedMesh?.metadata?.type === 'hardware') {
                    isFrozen = !!pickedMesh.metadata.frozen;
                }

                // Kategoria OBIEKT: Właściwości, Zamroź / Odmroź, Usuń
                const objectTools: any[] = [];
                if (this.lastInspectedData) {
                    objectTools.push({
                        label: 'Właściwości',
                        caption: 'Właściwości',
                        icon: this.svgIcons.properties,
                        action: 'open-properties',
                    });
                }
                objectTools.push({
                    label: isFrozen ? 'Odmroź' : 'Zamroź',
                    caption: isFrozen ? 'Odmroź' : 'Zamroź',
                    icon: this.svgIcons.freeze,
                    action: 'toggle-freeze',
                });
                objectTools.push({
                    label: 'Usuń',
                    caption: 'Usuń',
                    icon: this.svgIcons.trash,
                    action: 'delete',
                });

                items.push({ section: 'Obiekt', toolbar: objectTools });
                items.push({ separator: true });

                // Kategoria WIDOK: Ukryj, Pokaż tylko, Pokaż wszystko
                const viewTools: any[] = [
                    { label: 'Ukryj', caption: 'Ukryj', icon: this.svgIcons.eyeOff, action: 'toggle-visibility' },
                    { label: 'Pokaż tylko', caption: 'Tylko', icon: this.svgIcons.eye, action: 'show-only' },
                    { label: 'Pokaż wszystko', caption: 'Wszystko', icon: this.svgIcons.eye, action: 'show-all' },
                ];
                items.push({ section: 'Widok', toolbar: viewTools });
                items.push({ separator: true });
                items.push({
                    section: 'Historia',
                    toolbar: [
                        { label: 'Cofnij (Ctrl+Z)', caption: 'Cofnij', icon: this.svgIcons.undo, action: 'undo', shortcut: 'Ctrl+Z', disabled: !canUndo() },
                        { label: 'Ponów (Ctrl+Y)', caption: 'Ponów', icon: this.svgIcons.redo, action: 'redo', shortcut: 'Ctrl+Y', disabled: !canRedo() },
                    ],
                });
            } else {
                if (this.lastInspectedData) {
                    items.push({
                        section: 'Obiekt',
                        toolbar: [{
                            label: 'Właściwości',
                            caption: 'Właściwości',
                            icon: this.svgIcons.properties,
                            action: 'open-properties',
                        }],
                    });
                    items.push({ separator: true });
                }
                items.push({
                    section: 'Widok',
                    toolbar: [{ label: 'Pokaż wszystko', caption: 'Wszystko', icon: this.svgIcons.eye, action: 'show-all' }],
                });
                items.push({ separator: true });
                items.push({
                    section: 'Historia',
                    toolbar: [
                        { label: 'Cofnij (Ctrl+Z)', caption: 'Cofnij', icon: this.svgIcons.undo, action: 'undo', shortcut: 'Ctrl+Z', disabled: !canUndo() },
                        { label: 'Ponów (Ctrl+Y)', caption: 'Ponów', icon: this.svgIcons.redo, action: 'redo', shortcut: 'Ctrl+Y', disabled: !canRedo() },
                    ],
                });
                items.push({ separator: true });
                items.push({
                    section: 'Projekt',
                    toolbar: [
                        { label: 'Rozkrój (nesting)', caption: 'Rozkrój', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="5" y="5" width="6" height="8"/><rect x="13" y="5" width="6" height="5"/><rect x="13" y="12" width="6" height="7"/></svg>', action: 'open-nesting' },
                        { label: 'Raport z projektu', caption: 'Raport', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', action: 'open-report' },
                    ],
                });
            }

            if (this.lastInspectedData?.panelId) {
                const panel = getAllPanels().find((p: any) => p.id === this.lastInspectedData.panelId);
                const isAlu = panel?.isAluFrame ? panel.isAluFrame() : panel?.panelForm === 'ALU_FRAME';
                items.push({ separator: true });
                items.push({
                    section: 'Ramka ALU',
                    toolbar: [
                        {
                            label: isAlu ? 'Przywróć pełną formatkę' : 'Konwertuj na ramkę aluminiową ze szkłem',
                            caption: isAlu ? 'Formatka' : 'Ramka ALU',
                            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10"/></svg>',
                            action: isAlu ? 'convert-to-solid' : 'convert-to-alu-frame',
                        },
                    ],
                });
            }

            if (this.lastInspectedData?.panelId || this.lastInspectedData?.containerId) {
                const isContainer = !this.lastInspectedData.panelId && !!this.lastInspectedData.containerId;

                items.push({ separator: true });
                items.push({
                    section: 'Produkcja',
                    toolbar: [
                        {
                            label: isContainer ? 'Raport z korpusu' : 'Raport z formatki',
                            caption: 'Raport',
                            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="18" x2="8" y2="14"/><line x1="12" y1="18" x2="12" y2="11"/><line x1="16" y1="18" x2="16" y2="15"/></svg>',
                            action: 'open-report',
                        },
                        {
                            label: 'Rozkrój (nesting)',
                            caption: 'Rozkrój',
                            icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="1.5"/><rect x="5" y="5" width="6" height="8"/><rect x="13" y="5" width="6" height="5"/><rect x="13" y="12" width="6" height="7"/></svg>',
                            action: 'open-nesting',
                        },
                        {
                            label: isContainer ? 'CNC — obróbka CNC' : 'CNC — obróbka formatki',
                            caption: 'CNC',
                            icon: this.svgIcons.cnc,
                            action: 'open-cnc',
                        },
                    ],
                });
            }

            contextMenu.show(e.clientX, e.clientY, items);
        });

        contextMenu.onAction((action: string) => {
            switch (action) {
                case 'close':
                case '__close__':
                    contextMenu.hide();
                    break;
                case 'edit-smartpart': {
                    const model = this._lastSmartPart;
                    if (model) {
                        doc.setActiveEntity?.(model);
                        UIController.instance?.emitTree?.('select-container', { id: model.id });
                        openCadEditEntity({ entityId: model.id, kind: 'smartpart' });
                    }
                    break;
                }
                case 'edit-panel': {
                    const panelId = String(this._lastManualPanelId || this.lastInspectedData?.panelId || '');
                    if (!panelId) break;
                    // Obrona w głąb: tylko ręczne (SmartPanel). Silnikowe → korpus/blok.
                    const guard = this.resolveManualPanel(panelId, this._lastPickedMesh, doc, getAllPanels);
                    if (!guard) {
                        UIController.instance?.setStatus?.('Formatki z korpusu / bloku edytuje się przez „Edytuj korpus” / „Edytuj blok”', true);
                        break;
                    }
                    {
                        const panelNode = doc.findNode?.(panelId);
                        const panel = panelNode?.domainData || guard;
                        if (panel) {
                            doc.setActiveEntity?.(panel);
                            UIController.instance?.emitTree?.('select-part', { id: panelId, uuid: panelId });
                        }
                        openCadEditEntity({ entityId: panelId, kind: 'panel' });
                    }
                    break;
                }
                case 'edit-agd': {
                    const model = this._lastAppliance;
                    if (model) {
                        doc.setActiveEntity?.(model);
                        UIController.instance?.emitTree?.('select-container', { id: model.id });
                        openCadEditEntity({ entityId: model.id, kind: 'agd' });
                    }
                    break;
                }
                case 'edit-operation': {
                    const op = this._lastLibraryOp;
                    if (op) {
                        const panelNode = doc.findNode?.(op.panelId);
                        const panel = panelNode?.domainData;
                        if (panel) {
                            doc.setActiveEntity?.(panel);
                            UIController.instance?.emitTree?.('select-part', { id: op.panelId, uuid: op.panelId });
                        }
                        UIController.instance?.emitTree?.('select-feature', {
                            id: op.featureId,
                            panelId: op.panelId,
                            face: op.face,
                            openProperties: false,
                        });
                        openCadEditEntity({
                            entityId: op.panelId,
                            kind: 'operation',
                            libraryId: op.libraryId,
                            featureId: op.featureId,
                            panelId: op.panelId,
                            face: op.face,
                            screenX: this._lastClientX,
                            screenY: this._lastClientY,
                        });
                    }
                    break;
                }
                case 'open-properties':
                case 'toggle-item-panel':
                    if (this.lastInspectedData) {
                        propertiesManager.showProperties(this.lastInspectedData);
                    } else if (propertiesManager.current) {
                        propertiesManager.showProperties(propertiesManager.current);
                    } else {
                        document.dispatchEvent(new CustomEvent('bloki-toggle-item-panel'));
                    }
                    break;
                case 'convert-to-alu-frame': {
                    if (this.lastInspectedData?.panelId) {
                        const panel = getAllPanels().find((p: any) => p.id === this.lastInspectedData.panelId);
                        if (panel) {
                            if (typeof panel.convertToAluFrame === 'function') {
                                panel.convertToAluFrame('Z1_BLACK');
                            } else {
                                panel.panelForm = 'ALU_FRAME';
                                panel.frameTemplateId = 'Z1_BLACK';
                                panel._emit?.('panelFormChanged', { panelForm: 'ALU_FRAME' });
                            }
                            doc.notifyDocumentChanged?.();
                            doc.emitChange?.('all');
                            UIController.instance?.setStatus?.('Formatka skonwertowana na ramkę aluminiową ze szkłem', true);
                        }
                    }
                    break;
                }
                case 'convert-to-solid': {
                    if (this.lastInspectedData?.panelId) {
                        const panel = getAllPanels().find((p: any) => p.id === this.lastInspectedData.panelId);
                        if (panel) {
                            if (typeof panel.convertToSolid === 'function') {
                                panel.convertToSolid();
                            } else {
                                panel.panelForm = 'SOLID';
                                panel.frameTemplateId = undefined;
                                panel._emit?.('panelFormChanged', { panelForm: 'SOLID' });
                            }
                            doc.notifyDocumentChanged?.();
                            doc.emitChange?.('all');
                            UIController.instance?.setStatus?.('Przywrócono pełną formatkę', true);
                        }
                    }
                    break;
                }
                case 'open-report': {
                    const isContainer = !this.lastInspectedData?.panelId && !!this.lastInspectedData?.containerId;
                    const targetId = this.lastInspectedData?.panelId || this.lastInspectedData?.containerId || 'root';
                    const targetName = this.lastInspectedData?.name || (isContainer ? 'Korpus' : (this.lastInspectedData?.panelId ? 'Formatka' : 'Projekt'));
                    getModuleOpenHandler()?.openReport({ type: this.lastInspectedData?.panelId ? 'PANEL' : (isContainer ? 'CONTAINER' : 'PROJECT'), id: targetId, name: targetName });
                    break;
                }
                case 'open-nesting': {
                    const isContainer = !this.lastInspectedData?.panelId && !!this.lastInspectedData?.containerId;
                    const targetId = this.lastInspectedData?.panelId || this.lastInspectedData?.containerId || 'root';
                    const targetName = this.lastInspectedData?.name || (isContainer ? 'Korpus' : (this.lastInspectedData?.panelId ? 'Formatka' : 'Projekt'));
                    getModuleOpenHandler()?.openNesting({ type: this.lastInspectedData?.panelId ? 'PANEL' : (isContainer ? 'CONTAINER' : 'PROJECT'), id: targetId, name: targetName });
                    break;
                }
                case 'open-cnc': {
                    const isContainer = !this.lastInspectedData?.panelId && !!this.lastInspectedData?.containerId;
                    const targetId = this.lastInspectedData?.panelId || this.lastInspectedData?.containerId;
                    const targetName = this.lastInspectedData?.name || (isContainer ? 'Korpus' : 'Formatka');
                    if (targetId) {
                        getModuleOpenHandler()?.openCnc({ type: isContainer ? 'CONTAINER' : 'PANEL', id: targetId, name: targetName });
                    }
                    break;
                }
                case 'open-quick-pick': {
                    const cands = findFacesAlongRay(viewport.scene, viewport.scene.pointerX, viewport.scene.pointerY);
                    if (cands.length > 0) {
                        openQuickPick({
                            screenX: this._lastClientX,
                            screenY: this._lastClientY,
                            candidates: cands,
                            onSelect: (c) => {
                                facePicker.selectFaceExplicit(c.mesh, c.worldPoint, c.smartId, c.panelModel, c.worldNormal);
                            }
                        });
                    }
                    break;
                }
                case 'edit-bloki': {
                    const cid = this._lastContainer?.id || this.lastInspectedData?.containerId;
                    if (cid) {
                        const cNode = doc.findNode?.(cid);
                        if (cNode?.domainData) {
                            doc.setActiveEntity?.(cNode.domainData);
                        }
                        UIController.instance?.emitTree?.('select-container', { id: cid });
                        openCadEditEntity({ entityId: cid, kind: 'blok' });
                    }
                    break;
                }
                case 'edit-korpus': {
                    const cid = this._lastContainer?.id || this.lastInspectedData?.containerId;
                    if (cid) {
                        const cNode = doc.findNode?.(cid);
                        if (cNode?.domainData) {
                            doc.setActiveEntity?.(cNode.domainData);
                        }
                        UIController.instance?.emitTree?.('select-container', { id: cid });
                        openCadEditEntity({ entityId: cid, kind: 'korpus' });
                    }
                    break;
                }
                case 'delete': {
                    if (this.lastInspectedData?.panelId) {
                        UIController.instance?.emitTree('delete-part', {
                            id: this.lastInspectedData.panelId,
                            uuid: this.lastInspectedData.panelId,
                        });
                    } else if (this.lastInspectedData?.holeProps || this.lastInspectedData?.grooveProps || this.lastInspectedData?.kind === 'feature') {
                        UIController.instance?.emitTree('delete-feature', {
                            id: this.lastInspectedData.id,
                            panelId: this.lastInspectedData.parentPanelId || this.lastInspectedData.panelId,
                        });
                    } else if (this.lastInspectedData?.containerId) {
                        UIController.instance?.emitTree('delete-container', {
                            id: this.lastInspectedData.containerId,
                        });
                    } else if (this._lastSmartPart?.id) {
                        UIController.instance?.emitTree('delete-container', {
                            id: this._lastSmartPart.id,
                        });
                    }
                    break;
                }
                case 'toggle-visibility': {
                    if (this.lastInspectedData?.panelId) {
                        UIController.instance?.emitTree('toggle-part-visibility', {
                            id: this.lastInspectedData.panelId,
                            uuid: this.lastInspectedData.panelId,
                            panelRef: this._lastPickedMesh?.metadata?.panelModel
                        });
                    } else if (this.lastInspectedData?.containerId) {
                        UIController.instance?.emitTree('toggle-container-visibility', {
                            id: this.lastInspectedData.containerId
                        });
                    } else if (this.lastInspectedData?.holeProps || this.lastInspectedData?.grooveProps || this.lastInspectedData?.kind === 'feature') {
                        UIController.instance?.emitTree('toggle-visibility', {
                            id: this.lastInspectedData.id,
                            panelId: this.lastInspectedData.parentPanelId || this.lastInspectedData.panelId
                        });
                    } else if (this._lastPickedMesh?.metadata?.type === 'hardware' || this.lastInspectedData?.hardwareId) {
                        const hwId = this._lastPickedMesh?.metadata?.id || this.lastInspectedData?.id || this.lastInspectedData?.hardwareId;
                        UIController.instance?.emitTree('toggle-hardware-visibility', { id: hwId });
                    }
                    break;
                }
                case 'show-only': {
                    const onlyId =
                        this._lastSmartPart?.id
                        || this.lastInspectedData?.panelId
                        || this.lastInspectedData?.containerId;
                    if (onlyId) {
                        const type = this._lastSmartPart?.id
                            ? 'handle'
                            : (this.lastInspectedData?.panelId ? 'part' : 'container');
                        UIController.instance?.emitTree('show-only', {
                            id: onlyId,
                            uuid: onlyId,
                            type,
                        });
                    }
                    break;
                }
                case 'show-all': {
                    UIController.instance?.emitTree('show-all', {
                        id: 'root',
                        uuid: 'root',
                        type: 'project',
                    });
                    break;
                }
                case 'toggle-freeze': {
                    if (this.lastInspectedData?.panelId) {
                        UIController.instance?.emitTree('toggle-freeze-part', {
                            id: this.lastInspectedData.panelId,
                            uuid: this.lastInspectedData.panelId
                        });
                    } else if (this.lastInspectedData?.holeProps || this.lastInspectedData?.grooveProps || this.lastInspectedData?.kind === 'feature') {
                        UIController.instance?.emitTree('toggle-freeze-feature', {
                            id: this.lastInspectedData.id,
                            panelId: this.lastInspectedData.parentPanelId || this.lastInspectedData.panelId
                        });
                    } else if (this._lastPickedMesh?.metadata?.type === 'hardware' || this.lastInspectedData?.hardwareId) {
                        const hwId = this._lastPickedMesh?.metadata?.id || this.lastInspectedData?.id || this.lastInspectedData?.hardwareId;
                        UIController.instance?.emitTree('toggle-freeze-hardware', { id: hwId });
                    }
                    break;
                }
                case 'undo':
                    applyUndo();
                    break;
                case 'redo':
                    applyRedo();
                    break;
            }
        });
    }
}
