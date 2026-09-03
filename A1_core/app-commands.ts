/**
 * SmartPanel Web — App Commands
 * 
 * Centralny rejestr komend aplikacji wywoływanych przez interfejs użytkownika (React / Toolbar / Shortcuts).
 */

import { ContextManager, IAppAPI } from './context-manager.js';
import { isManualPanel, PanelModel } from '../A4_smartpanel/panel-model.js';
import { ReparentNodeCommand } from './commands/reparent-node-command.js';
import { ContainerModel } from './container-model.js';
import { rebuildSmartFrameContainer } from '../A3_smartframe/smartframe-adapter.js';
import { update_smartbox_core } from '../A2_smartbox/smartbox-core.js';
import { isUserAbort, ProjectFileIO } from './project-file-io.js';

import { AddNodeCommand } from './commands/add-node-command.js';
import { NodeType } from './cad-node/node-type.js';
import { CADNode } from './cad-node/cad-node.js';
import { Vec3 } from './cad-math/vec3.js';
import { nmToMm, mmToNm } from './cad-math/units.js';
import { Quat } from './cad-math/quat.js';

declare const BABYLON: any;

export function isSmartFrameContainer(domain: any): boolean {
    if (!domain || domain.type !== 'container') return false;
    const t = String(domain.generatorParams?.type || '');
    return t === 'korpus3_2' || t === 'korpus3_1' || t === 'KORPUS3' || t === 'smartframe' || t.startsWith('korpus');
}

/** Aktywny SmartFrame: zaznaczony korpus albo przodek formatki / SmartBoxa. */
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
        ? 'Przeniesiono panel ręczny na scenę'
        : 'Przeniesiono panel ręczny do SmartFrame';
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
            history,
            panelViews,
            containerViews,
            propertiesManager
        } = this.ctx;

        const rebuildGeometry = (msg = 'Gotowy') => {
            if ((window as any).__rebuildGeometry) {
                (window as any).__rebuildGeometry(msg);
            }
        };

        const pushHistory = (label: string) => {
            history.pushState(document.serialize({ snapshot: true }), label);
        };

        const confirmDiscardUnsaved = (): boolean => {
            if (!document.isDirty()) return true;
            return window.confirm('Projekt ma niezapisane zmiany. Kontynuować i je odrzucić?');
        };

        const addSmartPanel = () => {
            const doc = document;
            const activeFrame = resolveActiveSmartFrame(doc);
            const attachToActive = !!activeFrame && window.confirm(
                `Dodać panel do aktywnego obiektu „${activeFrame.name}”?`
            );
            const { parentId, inAssembly } = resolveManualPanelParent(doc, attachToActive);
            const parentNode = doc.findNode(parentId) ?? doc.rootNode;
            const parentDomain = parentNode.domainData;

            const newPanel = new PanelModel({
                width: mmToNm(600),
                height: mmToNm(720),
                thickness: mmToNm(18),
                name: 'Panel ręczny',
                role: 'MANUAL_PANEL',
                engineManaged: false,
            });

            const pNode = CADNode.create(NodeType.PART, newPanel.name, newPanel.id);
            pNode.domainData = newPanel;
            pNode.setLocalTransform(manualPanelLocalOffset(parentDomain, inAssembly), Quat.IDENTITY);

            const cmdHist = ContextManager.instance.commandHistory;
            const label = inAssembly ? 'Dodano panel ręczny do korpusu' : 'Dodano panel ręczny';
            if (cmdHist && doc) {
                cmdHist.execute(new AddNodeCommand(parentId, pNode, undefined, label));
            } else {
                doc.addNode(parentId, pNode);
            }
            document.setActiveEntity(newPanel);

            window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
            ui.setStatus(inAssembly
                ? `Dodano panel ręczny do „${activeFrame?.name || 'SmartFrame'}” — w drzewie możesz go przeciągnąć do innego`
                : 'Dodano panel ręczny na scenę');
            pushHistory(label);
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
                zoneCount: 3, 
                thickness: 18, 
                backOffset: 10,
                bottomHeight: 500,
                middleHeight: 1200
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
            
            window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
            ui.setStatus('Dodano nowy Korpus (SmartFrame)');
            pushHistory('Dodano SmartFrame');
        };

        const addSmartBox = () => {
            const containers = document.getContainers();
            let cabinet = containers.find((e: any) => (
                e.generatorParams?.type === 'korpus3_2' || 
                e.generatorParams?.type === 'korpus3_1' || 
                e.generatorParams?.type === 'smartframe' ||
                (e.name && e.name.includes('Korpus'))
            ));
            if (!cabinet) {
                cabinet = containers[0];
            }
            if (!cabinet) {
                alert("Najpierw utwórz Korpus (SmartFrame) w zakładce 'A3_smartframe'!");
                return;
            }

            const newContainer = new ContainerModel({ width: mmToNm(564), height: mmToNm(684), depth: mmToNm(480), name: "SmartBox" });
            newContainer.generatorParams = {
                type: 'smartbox_empty',
                boxType: 'EMPTY',
                parentContainerId: cabinet.id,
                targetZone: 'FULL',
                thickness: 18
            };
            
            const doc = document;
            const cabinetNode = doc?.findNode(cabinet.id);

            const cNode = CADNode.create(NodeType.ASSEMBLY, newContainer.name, newContainer.id);
            cNode.domainData = newContainer;

            const cmdHist = ContextManager.instance.commandHistory;
            if (cmdHist && doc && cabinetNode) {
                cmdHist.execute(new AddNodeCommand(cabinetNode.id, cNode, undefined, 'Dodano SmartBox'));
            } else if (doc && cabinetNode) {
                doc.addNode(cabinetNode.id, cNode);
            }
            document.setActiveEntity(newContainer);
            
            update_smartbox_core(newContainer, cabinet);
            
            window.document.dispatchEvent(new CustomEvent('smartbox-project-changed'));
            ui.setStatus('Dodano nowe Wnętrze (SmartBox)');
            pushHistory('Dodano SmartBox');
        };

        const fileIO = new ProjectFileIO();
        ContextManager.instance.projectFileIO = fileIO;

        const applyLoadedProject = (data: any, status = 'Wczytano projekt pomyślnie!') => {
            document.load(data);
            history.clear();
            pushHistory('Wczytano projekt');
            rebuildGeometry(status);
        };

        const resetProject = () => {
            if (!confirmDiscardUnsaved()) return;
            fileIO.clearHandle();
            ui.triggerReset();
        };

        const saveProject = async () => {
            try {
                const mode = await fileIO.save(document);
                ui.setStatus(
                    mode === 'native'
                        ? 'Zapisano projekt'
                        : 'Pobrano kopię projektu (.spp.json) — dokument nadal oznaczony jako niezapisany',
                    true
                );
            } catch (err) {
                if (isUserAbort(err)) return;
                console.error(err);
                ui.setStatus('Błąd podczas zapisu projektu!', true);
            }
        };

        const saveProjectAs = async () => {
            try {
                const mode = await fileIO.saveAs(document);
                ui.setStatus(
                    mode === 'native'
                        ? 'Zapisano projekt jako nowy plik'
                        : 'Pobrano kopię projektu (.spp.json) — dokument nadal oznaczony jako niezapisany',
                    true
                );
            } catch (err) {
                if (isUserAbort(err)) return;
                console.error(err);
                ui.setStatus('Błąd podczas zapisu projektu!', true);
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
                ui.setStatus('Błąd wczytywania pliku!', true);
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
                ui.setStatus('Błąd wczytywania pliku!', true);
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

            let alpha = 0;
            let beta = Math.PI / 2;

            switch (view) {
                case 'front':
                    alpha = -Math.PI / 2;
                    beta = Math.PI / 2;
                    break;
                case 'back':
                    alpha = Math.PI / 2;
                    beta = Math.PI / 2;
                    break;
                case 'left':
                    alpha = Math.PI;
                    beta = Math.PI / 2;
                    break;
                case 'right':
                    alpha = 0;
                    beta = Math.PI / 2;
                    break;
                case 'top':
                    alpha = -Math.PI / 2;
                    beta = 0.001;
                    break;
                case 'bottom':
                    alpha = -Math.PI / 2;
                    beta = Math.PI - 0.001;
                    break;
            }

            viewport.animateCameraTo(alpha, beta, radius, target);
        };

        const viewNormalToFace = () => {
            const faceMesh = facePicker.selectedFace;
            if (!faceMesh || faceMesh.isDisposed()) {
                ui.setStatus('Najpierw kliknij ścianę', true);
                return;
            }
            const faceName = faceMesh.metadata?.faceName;
            const pModel = faceMesh.metadata?.panelModel;
            if (!faceName || !pModel) {
                ui.setStatus('Zaznacz ścianę płyty', true);
                return;
            }

            const camera = viewport.scene.activeCamera;
            if (!camera) return;

            const panelView = panelViews.get(pModel);
            if (!panelView || !panelView.root) return;

            const root = panelView.root;
            const centerWorld = root.getAbsolutePosition ? root.getAbsolutePosition() : root.position;
            const w = pModel.width || 600;
            const h = pModel.height || 720;
            const t = pModel.thickness || 18;

            const panelCenter = centerWorld.add(new BABYLON.Vector3(w / 2, h / 2, t / 2));
            const maxDim = Math.max(w, h, t);

            camera.setTarget(panelCenter);
            camera.radius = maxDim * 2.2;

            if (faceName === 'front') { camera.alpha = Math.PI / 2; camera.beta = Math.PI / 2; }
            else if (faceName === 'back') { camera.alpha = -Math.PI / 2; camera.beta = Math.PI / 2; }
            else if (faceName === 'top') { camera.alpha = Math.PI / 2; camera.beta = 0.001; }
            else if (faceName === 'bottom') { camera.alpha = Math.PI / 2; camera.beta = Math.PI - 0.001; }
            else if (faceName === 'left') { camera.alpha = Math.PI; camera.beta = Math.PI / 2; }
            else if (faceName === 'right') { camera.alpha = 0; camera.beta = Math.PI / 2; }

            ui.setStatus(`Widok normalny: ${faceName}`, true);
        };

        const setLcsVisible = (visible: boolean) => {
            ContextManager.instance.lcsVisible = visible;
            rebuildGeometry();
        };

        const api: IAppAPI = {
            addSmartPanel,
            addSmartFrame,
            addSmartBox,
            newProject: resetProject,
            saveProject,
            saveProjectAs,
            openProject,
            openProjectFile,
            setRenderMode,
            toggleGrid,
            toggleProjection,
            zoomFit,
            setView: handleViewCubeClick,
            viewNormalToFace,
            setLcsVisible,
            undo: () => {
                const cmdHist = ContextManager.instance.commandHistory;
                if (cmdHist && cmdHist.canUndo) {
                    const label = cmdHist.lastUndoLabel;
                    cmdHist.undo();
                    rebuildGeometry(`Cofnięto: ${label || 'akcję'}`);
                } else {
                    const entry = history.undo();
                    if (entry) {
                        document.load(entry.snapshot, { snapshot: true });
                        rebuildGeometry(`Cofnięto akcję`);
                    }
                }
            },
            redo: () => {
                const cmdHist = ContextManager.instance.commandHistory;
                if (cmdHist && cmdHist.canRedo) {
                    const label = cmdHist.lastRedoLabel;
                    cmdHist.redo();
                    rebuildGeometry(`Ponowiono: ${label || 'akcję'}`);
                } else {
                    const entry = history.redo();
                    if (entry) {
                        document.load(entry.snapshot, { snapshot: true });
                        rebuildGeometry(`Ponowiono: ${entry.label}`);
                    }
                }
            },
            setSelectionMode: (mode: 'object' | 'subgeometry') => {
                facePicker.selectionMode = mode;
            },
            setStatus: (msg: string, highlight?: boolean) => {
                ui.setStatus(msg, highlight);
            }
        };

        ContextManager.instance.appAPI = api;
        return api;
    }
}
