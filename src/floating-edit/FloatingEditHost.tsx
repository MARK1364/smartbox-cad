/**
 * Jedyny host pływającej edycji na scenie.
 * Obsługuje: smartpart, blok, korpus, agd.
 * panel / operation → Forward do FloatingOperationDialog (ten sam kontrakt close).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ContextManager } from '../../A1_core/context-manager.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import {
    CAD_EDIT_SMARTPART,
    SMARTPART_HANDLE_TYPE,
} from '../../A2_bloki/handles/handle-types.js';
import { HandleEditPanel } from '../../A2_bloki/handles/handle-edit-panel.js';
import { HandleDimGizmo } from '../../A2_bloki/handles/handle-dim-gizmo.js';
import { SinkDimGizmo } from '../../A2_bloki/sinks/sink-dim-gizmo.js';
import { SinkEditPanel } from '../../A2_bloki/sinks/sink-edit-panel.js';
import { SMARTPART_SINK_TYPE } from '../../A2_bloki/sinks/sink-types.js';
import {
    isCustomSmartPartModel,
    SmartPartEditPanel,
    CAD_CLOSE_FLOATING_SMARTPART,
} from '../../S5_studio/index.js';
import {
    CAD_OPEN_FLOATING_OPERATION,
    CAD_OPEN_FLOATING_PANEL_EDIT,
    CAD_CLOSE_FLOATING_OPERATION,
} from '../FloatingOperationDialog.js';
import { isSmartApplianceContainer, isAppliancePart } from '../../A6_agd/smart-appliance-types.js';
import { isSmartWallContainer } from '../../S4_sciany/smartwall-types.js';
import {
    CAD_CLOSE_FLOATING_EDIT,
    CAD_EDIT_ENTITY,
    type CadEditEntityDetail,
    type CadEditEntityKind,
    openCadEditEntity,
} from './cad-edit-entity.js';
import { isPanelModel } from '../../A4_smartpanel/panel-model.js';
import { FloatingEditShell } from './FloatingEditShell.js';
import { FloatingBlokEdit } from './FloatingBlokEdit.js';
import { FloatingAgdEdit } from './FloatingAgdEdit.js';
import { FloatingKorpusEdit } from './FloatingKorpusEdit.js';
import { FloatingWallEdit } from './FloatingWallEdit.js';
import {
    DIMENSION_TOOL_STATE,
    MEASURE_TOOL_STATE,
    DIMENSION_EDIT_TOOL_STATE,
    DIMENSION_TEXT_SHIFT_TOOL_STATE,
} from '../../A8_pmi/pmi-tool-activate.js';

type HostKind = Exclude<CadEditEntityKind, 'panel' | 'operation'>;

interface HostSession {
    kind: HostKind;
    entityId: string;
    model: any;
}

function isSmartPartHandle(model: any): boolean {
    if (!model) return false;
    const genType = String(model.generatorParams?.type || '');
    return (
        model.role === 'SMARTPART_HANDLE'
        || genType === SMARTPART_HANDLE_TYPE
        || model.generatorParams?.partType === 'HANDLE'
    );
}

function isSmartPartSink(model: any): boolean {
    if (!model) return false;
    const genType = String(model.generatorParams?.type || '');
    return (
        model.role === 'SMARTPART_SINK'
        || genType === SMARTPART_SINK_TYPE
        || model.generatorParams?.partType === 'SINK'
        || model.generatorParams?.boxType === 'SINKS'
    );
}

function canEditSmartPart(model: any): boolean {
    return isSmartPartHandle(model) || isSmartPartSink(model) || isCustomSmartPartModel(model);
}

function resolveSmartPartModel(doc: any, containerId: string): { id: string; model: any } | null {
    let node = doc.findNode(containerId);
    let model = node?.domainData;
    if ((model as any)?.role === 'SMARTPART_HANGER' || (model as any)?.generatorParams?.type === 'smartpart_hanger') {
        const groupId = (model as any)?.generatorParams?.groupId;
        if (groupId) {
            const groupNode = doc.findNode(groupId);
            if (groupNode?.domainData) {
                return { id: groupId, model: groupNode.domainData };
            }
        } else if (node?.parent?.domainData) {
            return { id: node.parent.id, model: node.parent.domainData };
        }
    }
    if (!canEditSmartPart(model)) return null;
    return { id: containerId, model };
}

function resolveAgdContainer(doc: any, entityId: string): ContainerModel | null {
    const node = doc.findNode(entityId);
    const model = node?.domainData;
    if (isSmartApplianceContainer(model)) return model as ContainerModel;
    if (isAppliancePart(model) && node?.parent && isSmartApplianceContainer(node.parent.domainData)) {
        return node.parent.domainData as ContainerModel;
    }
    return null;
}

function resolveKorpusContainer(doc: any, entityId: string): any | null {
    const node = doc.findNode(entityId);
    if (node?.domainData?.type === 'container') {
        const gp = node.domainData.generatorParams || {};
        const t = String(gp.type || gp.typ_korpusu || '');
        if (t.startsWith('blok_') || t.startsWith('smartpart') || t === 'smart_appliance' || t === 'smartwall') return null;
        if (isSmartApplianceContainer(node.domainData) || isSmartWallContainer(node.domainData)) return null;
        return node.domainData;
    }
    if (node?.parent?.domainData?.type === 'container') {
        return resolveKorpusContainer(doc, node.parent.id);
    }
    return null;
}

function resolveWallContainer(doc: any, entityId: string): any | null {
    const node = doc.findNode(entityId);
    if (!node) return null;
    const model = node.domainData;
    if (isSmartWallContainer(model)) return model;
    if (node.parent && isSmartWallContainer(node.parent.domainData)) {
        return node.parent.domainData;
    }
    return null;
}

function resolveBlokContainer(doc: any, entityId: string): any | null {
    const node = doc.findNode(entityId);
    const model = node?.domainData;
    if (!model) return null;
    if (model.type === 'container') {
        const gp = model.generatorParams || {};
        const role = String(model.role || '');
        if (
            String(gp.type || '').startsWith('blok_')
            || gp.boxType
            || role === 'SMARTPART_HANDLE'
            || role === 'SMARTPART_HANGERS'
            || gp.type === SMARTPART_HANDLE_TYPE
            || gp.type === 'smartpart_hangers'
        ) {
            return model;
        }
    }
    if (node?.parent?.domainData?.type === 'container') {
        return resolveBlokContainer(doc, node.parent.id);
    }
    return null;
}

function titleFor(session: HostSession): string {
    const name = session.model?.name;
    switch (session.kind) {
        case 'smartpart':
            if (isSmartPartHandle(session.model)) return 'Uchwyty';
            if (isSmartPartSink(session.model)) return 'Zlew (SmartPart)';
            return name || session.model?.generatorParams?.smartPartName || 'SmartPart';
        case 'blok':
            return name ? `Blok: ${name}` : 'Edycja Bloku';
        case 'korpus':
            return name ? `Korpus: ${name}` : 'Edycja korpusu';
        case 'agd':
            return name ? `AGD: ${name}` : 'Edycja AGD';
        case 'wall': {
            const preset = session.model?.generatorParams?.preset;
            if (preset === 'skos') return name ? `Skos: ${name}` : 'Edycja skosu';
            if (preset === 'single') return name ? `Ściana: ${name}` : 'Edycja ściany';
            return name ? `Ściany: ${name}` : 'Edycja ścian';
        }
        default:
            return name || 'Edycja';
    }
}

export function shouldKeepSessionForTarget(
    session: { kind: HostKind; modelId: string },
    targetId: string | null | undefined,
    doc: any
): boolean {
    if (!targetId) return false;
    if (targetId === session.modelId) return true;
    // Dla edycji korpusu lub bloku: aktywacja pojedynczej formatki (nawet należącej do tego korpusu/bloku) zamyka okno kontenera
    if (session.kind === 'korpus' || session.kind === 'blok') {
        const targetNode = doc?.findNode?.(targetId);
        const targetModel = targetNode?.domainData;
        const isSinglePanel = isPanelModel(targetModel)
            || targetModel?.type === 'panel'
            || targetModel?.type === 'part'
            || targetNode?.nodeType === 1 /* NodeType.PART */;
        if (isSinglePanel) {
            return false;
        }
    }
    if (doc?.findNode) {
        let node = doc.findNode(targetId);
        while (node?.parent) {
            if (node.parent.id === session.modelId || node.parent.domainData?.id === session.modelId) {
                return true;
            }
            node = node.parent;
        }
    }
    return false;
}

export function shouldKeepSessionForTab(sessionKind: HostKind, newTab: string | null | undefined): boolean {
    if (!newTab) return false;
    if (sessionKind === 'blok' && newTab === 'tab-a2-bloki') return true;
    if (sessionKind === 'agd' && newTab === 'tab-agd') return true;
    if (sessionKind === 'smartpart' && newTab === 'tab-a5-smartparts') return true;
    if (sessionKind === 'korpus' && (newTab === 'tab-a3-smartframe' || newTab === 'tab-b1-biblioteka')) return true;
    if (sessionKind === 'wall' && newTab === 'tab-s4-sciany') return true;
    return false;
}

export function FloatingEditHost({ projectModel }: { projectModel?: any }): React.JSX.Element | null {
    const [session, setSession] = useState<HostSession | null>(null);

    const close = useCallback(() => {
        setSession(null);
        HandleDimGizmo.instance.detach();
        SinkDimGizmo.instance.detach();
    }, []);

    const openHost = useCallback((kind: HostKind, entityId: string) => {
        const doc = ContextManager.instance.document || projectModel;
        if (!doc || !entityId) return;

        // Zamknij stare pływające okna (operacja/formatka/smartpart legacy)
        window.dispatchEvent(new CustomEvent(CAD_CLOSE_FLOATING_OPERATION));
        window.dispatchEvent(new CustomEvent(CAD_CLOSE_FLOATING_SMARTPART));

        let model: any = null;
        let resolvedId = entityId;

        if (kind === 'smartpart') {
            const resolved = resolveSmartPartModel(doc, entityId);
            if (!resolved) return;
            model = resolved.model;
            resolvedId = resolved.id;
        } else if (kind === 'agd') {
            model = resolveAgdContainer(doc, entityId);
        } else if (kind === 'korpus') {
            model = resolveKorpusContainer(doc, entityId);
        } else if (kind === 'blok') {
            model = resolveBlokContainer(doc, entityId);
        } else if (kind === 'wall') {
            model = resolveWallContainer(doc, entityId);
        }

        if (!model) return;
        doc.setActiveEntity?.(model);
        setSession({ kind, entityId: resolvedId, model });
        if (kind === 'smartpart' && isSmartPartHandle(model)) {
            SinkDimGizmo.instance.detach();
            // HandleEditPanel sam podpina gizmo
        } else if (kind === 'smartpart' && isSmartPartSink(model)) {
            HandleDimGizmo.instance.detach();
            SinkDimGizmo.instance.attach(model);
        } else {
            HandleDimGizmo.instance.detach();
            SinkDimGizmo.instance.detach();
        }
    }, [projectModel]);

    useEffect(() => {
        const onEdit = (e: Event) => {
            const detail = (e as CustomEvent<CadEditEntityDetail>).detail;
            if (!detail?.entityId || !detail.kind) return;

            // panel / operation → istniejący FloatingOperationDialog
            if (detail.kind === 'panel') {
                close();
                window.dispatchEvent(new CustomEvent(CAD_OPEN_FLOATING_PANEL_EDIT, {
                    detail: { panelId: detail.entityId || detail.panelId },
                }));
                return;
            }
            if (detail.kind === 'operation') {
                close();
                window.dispatchEvent(new CustomEvent(CAD_OPEN_FLOATING_OPERATION, {
                    detail: {
                        featureId: detail.featureId,
                        panelId: detail.panelId || detail.entityId,
                        libraryId: detail.libraryId,
                        face: detail.face,
                        screenX: detail.screenX,
                        screenY: detail.screenY,
                    },
                }));
                return;
            }

            openHost(detail.kind, detail.entityId);
        };

        const onClose = () => close();

        // Adaptery starych eventów → host
        const onSmartPart = (e: Event) => {
            const id = (e as CustomEvent).detail?.containerId;
            if (typeof id === 'string' && id) {
                openHost('smartpart', id);
            }
        };
        const onKorpus = (e: Event) => {
            const id = (e as CustomEvent).detail?.containerId;
            if (typeof id === 'string' && id) {
                openHost('korpus', id);
            }
        };

        window.addEventListener(CAD_EDIT_ENTITY, onEdit as EventListener);
        window.addEventListener(CAD_CLOSE_FLOATING_EDIT, onClose);
        window.addEventListener(CAD_EDIT_SMARTPART, onSmartPart as EventListener);
        window.addEventListener('cad-edit-smartframe-korpus', onKorpus as EventListener);
        window.addEventListener(CAD_CLOSE_FLOATING_SMARTPART, onClose);

        return () => {
            window.removeEventListener(CAD_EDIT_ENTITY, onEdit as EventListener);
            window.removeEventListener(CAD_CLOSE_FLOATING_EDIT, onClose);
            window.removeEventListener(CAD_EDIT_SMARTPART, onSmartPart as EventListener);
            window.removeEventListener('cad-edit-smartframe-korpus', onKorpus as EventListener);
            window.removeEventListener(CAD_CLOSE_FLOATING_SMARTPART, onClose);
        };
    }, [close, openHost]);

    // Gdy otwierana jest formatka/operacja — zamknij host
    useEffect(() => {
        const onOpOrPanel = () => close();
        window.addEventListener(CAD_OPEN_FLOATING_OPERATION, onOpOrPanel);
        window.addEventListener(CAD_OPEN_FLOATING_PANEL_EDIT, onOpOrPanel);
        return () => {
            window.removeEventListener(CAD_OPEN_FLOATING_OPERATION, onOpOrPanel);
            window.removeEventListener(CAD_OPEN_FLOATING_PANEL_EDIT, onOpOrPanel);
        };
    }, [close]);

    // Gdy użytkownik wybierze inny obiekt w scenie/drzewie/belce hierarchii (np. formatkę) LUB zmieni moduł — zamknij okno edycji
    useEffect(() => {
        if (!session) return;
        const doc = ContextManager.instance.document || projectModel;
        if (!doc) return;

        const sessionId = session.model?.id || session.entityId;

        const isChildOrSame = (targetId: string | undefined): boolean => {
            return shouldKeepSessionForTarget({ kind: session.kind, modelId: sessionId }, targetId, doc);
        };

        const checkActive = () => {
            const currentActive = doc.activeEntity;
            if (!currentActive) return;
            if (isChildOrSame(currentActive.id)) return;
            close();
        };

        const unsub = doc.onDocumentChanged?.(() => {
            checkActive();
        });

        const onProps = (e: any) => {
            const id = e.detail?.id || e.detail?.partId || e.detail?.containerId;
            if (!id || isChildOrSame(id)) return;
            close();
        };
        document.addEventListener('bloki-properties-update', onProps);

        const onTabSwitched = (e: Event) => {
            const newTab = (e as CustomEvent).detail?.tabId;
            if (shouldKeepSessionForTab(session.kind, newTab)) return;
            close();
        };
        window.addEventListener('cad-tab-switched', onTabSwitched);
        window.addEventListener('cad-switch-tab', onTabSwitched);

        const sm = ContextManager.instance.stateMachine || (ContextManager.instance as any).appAPI?.stateMachine;
        const unsubSm = sm?.onStateChange?.((stateName: string) => {
            if (
                stateName === DIMENSION_TOOL_STATE ||
                stateName === MEASURE_TOOL_STATE ||
                stateName === DIMENSION_EDIT_TOOL_STATE ||
                stateName === DIMENSION_TEXT_SHIFT_TOOL_STATE
            ) {
                close();
            }
        });

        // Gdy użytkownik kliknie PPM poza oknem edycji (w canvas, scenę 3D lub drzewo) — natychmiast zamknij okno edycji
        const onContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && target.closest('.floating-edit-shell')) {
                return;
            }
            close();
        };
        window.addEventListener('contextmenu', onContextMenu);

        return () => {
            unsub?.();
            unsubSm?.();
            document.removeEventListener('bloki-properties-update', onProps);
            window.removeEventListener('cad-tab-switched', onTabSwitched);
            window.removeEventListener('cad-switch-tab', onTabSwitched);
            window.removeEventListener('contextmenu', onContextMenu);
        };
    }, [session, projectModel, close]);

    if (!session) return null;

    const isHandle = session.kind === 'smartpart' && isSmartPartHandle(session.model);
    const isSink = session.kind === 'smartpart' && isSmartPartSink(session.model);

    return (
        <FloatingEditShell
            key={`${session.kind}:${session.entityId}`}
            title={titleFor(session)}
            width={session.kind === 'blok' || session.kind === 'agd' || session.kind === 'wall' ? 320 : isHandle ? 260 : isSink ? 280 : 300}
            onClose={close}
        >
            {session.kind === 'smartpart' && (
                isHandle
                    ? <HandleEditPanel container={session.model} />
                    : isSink
                    ? <SinkEditPanel container={session.model} />
                    : <SmartPartEditPanel container={session.model} />
            )}
            {session.kind === 'blok' && <FloatingBlokEdit container={session.model} />}
            {session.kind === 'korpus' && (
                <FloatingKorpusEdit container={session.model} projectModel={projectModel} />
            )}
            {session.kind === 'agd' && (
                <FloatingAgdEdit container={session.model as ContainerModel} />
            )}
            {session.kind === 'wall' && (
                <FloatingWallEdit container={session.model} />
            )}
        </FloatingEditShell>
    );
}

/** Publiczny helper — otwórz edycję Bloku na scenie. */
export function openBlokEditOnScene(entityId: string): void {
    openCadEditEntity({ entityId, kind: 'blok' });
}

/** Publiczny helper — otwórz edycję AGD na scenie. */
export function openAgdEditOnScene(entityId: string): void {
    openCadEditEntity({ entityId, kind: 'agd' });
}

/** Publiczny helper — otwórz edycję korpusu na scenie. */
export function openKorpusEditOnScene(entityId: string): void {
    openCadEditEntity({ entityId, kind: 'korpus' });
}

/** Publiczny helper — otwórz edycję ściany / skosu na scenie. */
export function openWallEditOnScene(entityId: string): void {
    openCadEditEntity({ entityId, kind: 'wall' });
}
