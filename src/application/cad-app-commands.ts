/**
 * SmartPanel Web — App Commands (composition root)
 *
 * Centralny rejestr komend aplikacji wywoływanych przez interfejs użytkownika (React / Toolbar / Shortcuts).
 */

import { ContextManager, IAppAPI } from '../../A1_core/context-manager.js';
import { isManualPanel, PanelModel } from '../../A4_smartpanel/panel-model.js';
import { ReparentNodeCommand } from '../../A1_core/commands/reparent-node-command.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { rebuildSmartFrameContainer } from '../../A3_smartframe/smartframe-adapter.js';
import { isUserAbort, ProjectFileIO } from '../../A1_core/project-file-io.js';

import { AddNodeCommand } from '../../A1_core/commands/add-node-command.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { nmToMm, mmToNm } from '../../A1_core/cad-math/units.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';
import { CAMStateStore } from '../../C1_cnc/core/cam-state-store.js';
import { namedCameraView } from '../../S3_scena/named-camera-view.js';
import { tx } from '../../T1_tlumaczenia/core.js';
import { openCadEditEntity } from '../floating-edit/cad-edit-entity.js';

declare const BABYLON: any;

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

export function isSmartFrameContainer(domain: any): boolean {
    if (!domain || domain.type !== 'container') return false;
    const t = String(domain.generatorParams?.type || '');
    return t === 'korpus3_2' || t === 'korpus3_1' || t === 'KORPUS3' || t === 'smartframe' || t.startsWith('korpus');
}

/** Aktywny SmartFrame: zaznaczony korpus albo przodek formatki / Bloku. */
export function resolveActiveSmartFrame(doc: any): { id: string; name: string } | null {
    if (!doc || typeof doc.findNode !== 'function') return null;
    const ae = doc.activeEntity;
    let node = ae ? doc.findNode(ae.id) : null;
    while (node) {
        if (node.nodeType === NodeType.ASSEMBLY && isSmartFrameContainer(node.domainData)) {
            const name = node.domainData?.name || node.name || 'SmartFrame';
            return { id: node.id, name };
        }
        node = node.parent;
    }
    return null;
}

/** Rodzic panelu ręcznego: aktywny SmartFrame tylko po zgodzie użytkownika, inaczej scena (ROOM). */
export function resolveManualPanelParent(doc: any, attachToActive = false): { parentId: string; inAssembly: boolean } {
    if (!doc?.rootNode) {
        return { parentId: '', inAssembly: false };
    }
    if (attachToActive) {
        const frame = resolveActiveSmartFrame(doc);
        if (frame) {
            return { parentId: frame.id, inAssembly: true };
        }
    }
    return { parentId: doc.rootNode.id, inAssembly: false };
}

export function resolveReparentTargetId(doc: any, rawParentId: string): string | null {
    if (!doc?.rootNode) return null;
    if (rawParentId === 'project-root' || rawParentId === 'ALL' || rawParentId === 'root') {
        return doc.rootNode.id;
    }
    const parent = doc.findNode(rawParentId);
    if (!parent) return null;
    if (parent.nodeType === NodeType.ROOM) return parent.id;
    if (parent.nodeType === NodeType.ASSEMBLY && isSmartFrameContainer(parent.domainData)) {
        return parent.id;
    }
    return null;
}

export function canReparentManualPanel(doc: any, panelId: string, rawParentId: string): boolean {
    if (!doc) return false;
    const panelNode = doc.findNode(panelId);
    if (!panelNode || panelNode.nodeType !== NodeType.PART || !isManualPanel(panelNode.domainData)) {
        return false;
    }
    const targetId = resolveReparentTargetId(doc, rawParentId);
    if (!targetId || targetId === panelId) return false;
    if (panelNode.parent?.id === targetId) return false;
    return true;
}

export function reparentManualPanel(doc: any, panelId: string, rawParentId: string): boolean {
    if (!canReparentManualPanel(doc, panelId, rawParentId)) return false;
    const targetId = resolveReparentTargetId(doc, rawParentId);
    if (!targetId) return false;
    const cmdHist = ContextManager.instance.commandHistory;
    const label = targetId === doc.rootNode.id
        ? tx(srcTekst, 'cmd.move_panel_scene', TX_NS)
        : tx(srcTekst, 'cmd.move_panel_frame', TX_NS);
    if (cmdHist) {
        cmdHist.execute(new ReparentNodeCommand(doc, panelId, targetId, { mode: 'keepWorld', label }));
    } else {
        doc.reparentNode(panelId, targetId, { mode: 'keepWorld' });
    }
    return true;
}

function manualPanelLocalOffset(parentDomain: any, inAssembly: boolean): Vec3 {
    if (inAssembly && parentDomain?.type === 'container') {
        const w = parentDomain.width ?? mmToNm(600);
        const h = parentDomain.height ?? mmToNm(720);
        const d = parentDomain.depth ?? mmToNm(500);
        return new Vec3(w * 0.15, h * 0.2, d * 0.3);
    }
    return new Vec3(mmToNm(Math.random() * 200), mmToNm(Math.random() * 200), 0);
}

export class AppCommands {
    private ctx: any;

    constructor(ctx: any) {
        this.ctx = ctx;
    }

    public register(): IAppAPI {
        const {
            document,
            viewport,
            facePicker,
            ui,
            panelBuilder,
            panelViews,
            containerViews,
            propertiesManager
        } = this.ctx;

        const rebuildGeometry = (msg = 'Gotowy') => {
            if ((window as any).__rebuildGeometry) {
                (window as any).__rebuildGeometry(msg);
            }
        };

        const clearEditHistory = () => {
            ContextManager.instance.commandHistory?.clear();
        };

        const confirmDiscardUnsaved = (): boolean => {
            if (!document.isDirty()) return true;
            return window.confirm(tx(srcTekst, 'cmd.confirm_unsaved', TX_NS));
        };

        const addSmartPanel = () => {
            const doc = document;
            const activeFrame = resolveActiveSmartFrame(doc);
            const attachToActive = !!activeFrame && window.confirm(
                tx(srcTekst, 'cmd.add_to_frame', TX_NS, { name: activeFrame.name })
            );
            const { parentId, inAssembly } = resolveManualPanelParent(doc, attachToActive);
            const parentNode = doc.findNode(parentId) ?? doc.rootNode;
            const parentDomain = parentNode.domainData;

            const newPanel = new PanelModel({
                width: mmToNm(720),
                height: mmToNm(510),
                thickness: mmToNm(18),
                name: tx(srcTekst, 'cmd.manual_panel', TX_NS),
                role: 'MANUAL_PANEL',
                engineManaged: false,
            });

            const pNode = CADNode.create(NodeType.PART, newPanel.name, newPanel.id);
            pNode.domainData = newPanel;
            pNode.setLocalTransform(manualPanelLocalOffset(parentDomain, inAssembly), Quat.IDENTITY);

            const cmdHist = ContextManager.instance.commandHistory;
            const label = inAssembly ? tx(srcTekst, 'cmd.added_to_body', TX_NS) : tx(srcTekst, 'cmd.added_panel', TX_NS);
            if (cmdHist && doc) {
                cmdHist.execute(new AddNodeCommand(parentId, pNode, undefined, label));
            } else {
                doc.addNode(parentId, pNode);
            }
            document.setActiveEntity(newPanel);

            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cad-open-floating-panel-edit', {
                    detail: { panelId: newPanel.id }
                }));
            }
            ui.setStatus(inAssembly
                ? tx(srcTekst, 'cmd.added_to_named', TX_NS, { name: activeFrame?.name || 'SmartFrame' })
                : tx(srcTekst, 'cmd.added_scene', TX_NS));
        };

        const addSmartFrame = () => {
            const newContainer = new ContainerModel({
                width: mmToNm(1000),
                height: mmToNm(2200),
                depth: mmToNm(600),
                name: "Korpus (SmartFrame)"
            });
            newContainer.generatorParams = {
                type: 'korpus3_2',
                szerokosc_mm: 1000,
                wysokosc_mm: 2200,
                glebokosc_mm: 600,
                liczba_stref: 3,
                wysokosc_strefy_dolnej_mm: 500,
                wysokosc_strefy_srodkowej_mm: 1200,
                cofniecie_plecow_mm: 3,
                offsets: {}
            };
            
            const doc = document;
            
            const cNode = CADNode.create(NodeType.ASSEMBLY, newContainer.name, newContainer.id);
            cNode.domainData = newContainer;
            cNode.setLocalTransform(
                new Vec3(mmToNm(Math.random() * 200), 0, mmToNm(Math.random() * 200)),
                Quat.IDENTITY
            );
            
            const cmdHist = ContextManager.instance.commandHistory;
            if (cmdHist && doc) {
                cmdHist.execute(new AddNodeCommand(doc.rootNode.id, cNode, undefined, 'Dodano SmartFrame'));
            } else {
                doc.addNode(doc.rootNode.id, cNode);
            }
            document.setActiveEntity(newContainer);
            
            rebuildSmartFrameContainer(newContainer);
            
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            ui.setStatus('Dodano nowy Korpus (SmartFrame)');
            openCadEditEntity({ entityId: newContainer.id, kind: 'korpus' });
        };

        const fileIO = new ProjectFileIO();
        ContextManager.instance.projectFileIO = fileIO;

        const applyLoadedProject = (data: any, status = tx(srcTekst, 'cmd.project_loaded', TX_NS)) => {
            document.load(data);
            clearEditHistory();
            rebuildGeometry(status);
        };

        const performResetProject = () => {
            document.reset('Nowy projekt');
            clearEditHistory();
            fileIO.clearHandle();
            ContextManager.instance.activePanel = null;
            ContextManager.instance.selectedPanel = null;
            ContextManager.instance.activeReferencePicker = null;
            ContextManager.instance.activeConstraintPicker = null;
            
            try {
                const camStore = CAMStateStore.getInstance();
                camStore.setPrograms([]);
                camStore.setActiveProgramId(null);
            } catch {}

            rebuildGeometry('Utworzono nowy projekt');
            
            if (viewport) {
                viewport.zoomToFit();
            }
            
            window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
            ui.setStatus('Utworzono nowy projekt', true);
        };

        const resetProject = () => {
            if (ContextManager.instance.requestNewProjectDialog) {
                ContextManager.instance.requestNewProjectDialog();
                return;
            }
            if (!confirmDiscardUnsaved()) return;
            performResetProject();
        };

        const saveProject = async (): Promise<boolean> => {
            try {
                const mode = await fileIO.save(document);
                ui.setStatus(
                    mode === 'native'
                        ? 'Zapisano projekt'
                        : tx(srcTekst, 'cmd.project_copy', TX_NS),
                    true
                );
                return true;
            } catch (err) {
                if (isUserAbort(err)) return false;
                console.error(err);
                ui.setStatus(tx(srcTekst, 'cmd.save_error', TX_NS), true, 'error');
                return false;
            }
        };

        const saveProjectAs = async (): Promise<boolean> => {
            try {
                const mode = await fileIO.saveAs(document);
                ui.setStatus(
                    mode === 'native'
                        ? 'Zapisano projekt jako nowy plik'
                        : tx(srcTekst, 'cmd.project_copy', TX_NS),
                    true
                );
                return true;
            } catch (err) {
                if (isUserAbort(err)) return false;
                console.error(err);
                ui.setStatus(tx(srcTekst, 'cmd.save_error', TX_NS), true, 'error');
                return false;
            }
        };

        const openProjectFile = async (file: File) => {
            if (!file) return;
            if (!confirmDiscardUnsaved()) return;
            try {
                const result = await fileIO.openFromFile(file);
                applyLoadedProject(result.data);
            } catch (err) {
                console.error(err);
                ui.setStatus(tx(srcTekst, 'cmd.load_error', TX_NS), true, 'error');
            }
        };

        const openProject = async () => {
            if (!confirmDiscardUnsaved()) return;
            try {
                const result = await fileIO.open();
                if (!result) return;
                applyLoadedProject(result.data);
            } catch (err) {
                if (isUserAbort(err)) return;
                console.error(err);
                ui.setStatus(tx(srcTekst, 'cmd.load_error', TX_NS), true, 'error');
            }
        };

        window.addEventListener('beforeunload', (event: BeforeUnloadEvent) => {
            if (!document.isDirty()) return;
            event.preventDefault();
            event.returnValue = '';
        });

        window.document.addEventListener('keydown', (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return;
            const key = event.key.toLowerCase();
            if (key === 's') {
                event.preventDefault();
                if (event.shiftKey) {
                    void saveProjectAs();
                } else {
                    void saveProject();
                }
            }
        });

        const setRenderMode = (mode: string) => {
            viewport.setRenderMode(mode);
        };

        const toggleGrid = () => {
            viewport.toggleGrid();
        };

        const toggleProjection = () => {
            viewport.toggleCameraProjection();
        };

        const zoomFit = () => {
            viewport.zoomToFit();
        };

        const handleViewCubeClick = (view: string) => {
            if (!viewport.camera) return;
            const radius = viewport.camera.radius;
            const target = viewport.camera.target;
            const nv = namedCameraView(view);
            viewport.animateCameraTo(nv.alpha, nv.beta, radius, target, nv.up);
        };

        const setLcsVisible = (visible: boolean) => {
            ContextManager.instance.lcsVisible = visible;
            rebuildGeometry();
        };

        const api: IAppAPI = {
            addSmartPanel,
            addSmartFrame,
            newProject: resetProject,
            forceResetProject: performResetProject,
            saveProject,
            saveProjectAs,
            openProject,
            openProjectFile,
            loadProjectData: (data: any, status?: string) => applyLoadedProject(data, status),
            setRenderMode,
            toggleGrid,
            toggleProjection,
            zoomFit,
            setView: handleViewCubeClick,
            setLcsVisible,
            undo: () => {
                const cmdHist = ContextManager.instance.commandHistory;
                if (!cmdHist?.canUndo) return;
                const label = cmdHist.lastUndoLabel;
                cmdHist.undo();
                rebuildGeometry(tx(srcTekst, 'cmd.undo_action', TX_NS, { label: label || tx(srcTekst, 'cmd.undo_default', TX_NS) }));
            },
            redo: () => {
                const cmdHist = ContextManager.instance.commandHistory;
                if (!cmdHist?.canRedo) return;
                const label = cmdHist.lastRedoLabel;
                cmdHist.redo();
                rebuildGeometry(tx(srcTekst, 'cmd.redo_action', TX_NS, { label: label || tx(srcTekst, 'cmd.undo_default', TX_NS) }));
            },
            setSelectionMode: (mode: 'object' | 'subgeometry') => {
                ContextManager.instance.deactivatePmiToolsIfActive();
                facePicker.selectionMode = mode;
            },
            setStatus: (msg: string, highlight?: boolean, kind?: 'info' | 'error') => {
                ui.setStatus(msg, highlight, kind);
            }
        };

        ContextManager.instance.appAPI = api;
        return api;
    }
}
