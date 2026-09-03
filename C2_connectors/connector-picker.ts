/**
 * Budowa grupy złączy z wykrytego styku + tryb multi-wyboru płaszczyzn.
 */

import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { applyTabSelectionPolicy } from '../A1_core/selection-highlight.js';
import { setConnectorsPlanePickActive } from '../A1_core/selection-mode.js';
import { renderToCAD } from '../A1_core/cad-math/coord-system.js';
import { Vec3 } from '../A1_core/cad-math/vec3.js';
import { TooltipManager } from '../A1_core/tooltip-manager.js';
import { localMmToWorldMm, worldMmToLocalMm } from '../S2_solver/constraint-geometry.js';
import { ConnectorsEngine, countRulePositions } from './connectors-engine.js';
import {
    AddConnectorGroupCommand,
    executeConnectorCommand,
    ReplaceConnectorGroupCommand,
} from './connector-commands.js';
import { ConnectorStore } from './connector-store.js';
import { ConnectorVisualizer } from './connector-visualizer.js';
import { pickEligibleFace, scanEligibleConnectorFaces } from './contact-scanner.js';
import type {
    ConnectorGroup,
    ConnectorInstance,
    EligibleContactFace,
    Vec3Tuple,
} from './connectors-types.js';

declare const BABYLON: any;

export interface ConnectorPickState {
    active: boolean;
    count: number;
}

let _active = false;
let _count = 0;
let _faces: EligibleContactFace[] = [];
let _observer: any = null;
let _keyHandler: ((e: KeyboardEvent) => void) | null = null;
let _lastClick = 0;

function engine(): ConnectorsEngine {
    return new ConnectorsEngine();
}

function cameraRayCad(): { origin: Vec3; dir: Vec3 } | null {
    const scene = ContextManager.instance.viewport?.scene;
    const camera = ContextManager.instance.viewport?.camera;
    if (!scene || !camera || typeof BABYLON === 'undefined') return null;
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);
    if (!ray?.origin || !ray?.direction) return null;
    const origin = renderToCAD(new Vec3(ray.origin.x, ray.origin.y, ray.origin.z));
    const dir = renderToCAD(new Vec3(ray.direction.x, ray.direction.y, ray.direction.z)).normalize();
    return { origin, dir };
}

function toLocal(node: CADNode, world: Vec3Tuple): Vec3Tuple {
    return worldMmToLocalMm(node, new Vec3(world[0], world[1], world[2]));
}

export function buildGroupFromContact(
    document: any,
    face: EligibleContactFace,
    placementRule: string,
    positionsActive?: boolean[] | null,
    existing?: ConnectorGroup | null,
    firstOffsetMm?: number | null,
): ConnectorGroup | null {
    const parent = document?.findNode?.(face.panelId);
    if (!parent) return null;

    const store = ConnectorStore.instance;
    const rule = engine().getPlacementRuleDefinition(placementRule);
    const total = countRulePositions(rule);
    const active = positionsActive
        ? [...positionsActive]
        : existing?.positionsActive?.length
            ? [...existing.positionsActive]
            : Array(total).fill(true);
    while (active.length < total) active.push(true);

    const { rotation } = parent.getWorldMatrix().decompose();
    const alongWorld = rotation.rotateVec3(Vec3.UNIT_Y);
    const resolvedFirstOffset = firstOffsetMm ?? existing?.firstOffsetMm ?? store.firstOffsetMm;
    const placements = engine().generateConnectors(
        face.clippedVertsWorldMm,
        face.normalWorldMm,
        placementRule,
        active,
        [alongWorld.x, alongWorld.y, alongWorld.z],
        resolvedFirstOffset,
    );

    const faceVertsLocalMm = face.clippedVertsWorldMm.map((v) => toLocal(parent, v));
    const nLocalVec = rotation.inverse().rotateVec3(new Vec3(
        face.normalWorldMm[0],
        face.normalWorldMm[1],
        face.normalWorldMm[2],
    )).normalize();
    const nLocal: Vec3Tuple = [nLocalVec.x, nLocalVec.y, nLocalVec.z];

    const connectors: ConnectorInstance[] = placements.map((p) => ({
        type: p.type,
        index: p.index,
        offsetMm: p.offsetMm,
        side: p.side,
        positionLocalMm: toLocal(parent, p.positionMm),
        normalLocalMm: nLocal,
        diameterMm: p.diameterMm,
        lengthMm: p.lengthMm,
    }));

    const id = existing?.id ?? store.nextGroupId();
    const parentName = parent.name || (parent.domainData as any)?.name || 'Formatka';
    const numeric = id.replace(/^CONN_/, '');
    return {
        id,
        name: `${numeric}. ${parentName} (Złącza)`,
        parentObjectId: face.panelId,
        otherObjectId: face.otherPanelId,
        faceName: face.faceName,
        placementRule,
        firstOffsetMm: resolvedFirstOffset,
        positionsActive: active.slice(0, total),
        faceVertsLocalMm,
        faceNormalLocalMm: nLocal,
        connectors,
    };
}

export function regenerateGroup(
    document: any,
    group: ConnectorGroup,
    placementRule: string,
    positionsActive?: boolean[] | null,
    firstOffsetMm?: number | null,
): ConnectorGroup | null {
    const parent = document?.findNode?.(group.parentObjectId);
    if (!parent) return null;
    const { rotation } = parent.getWorldMatrix().decompose();
    const clippedVertsWorldMm = group.faceVertsLocalMm.map((v) => {
        const w = localMmToWorldMm(parent, v);
        return [w.x, w.y, w.z] as Vec3Tuple;
    });
    const nWorld = rotation.rotateVec3(new Vec3(
        group.faceNormalLocalMm[0],
        group.faceNormalLocalMm[1],
        group.faceNormalLocalMm[2],
    )).normalize();

    return buildGroupFromContact(
        document,
        {
            panelId: group.parentObjectId,
            otherPanelId: group.otherObjectId,
            faceName: group.faceName,
            centerWorldMm: clippedVertsWorldMm[0] ?? [0, 0, 0],
            normalWorldMm: [nWorld.x, nWorld.y, nWorld.z],
            clippedVertsWorldMm,
        },
        placementRule,
        positionsActive ?? group.positionsActive,
        group,
        firstOffsetMm,
    );
}

function rescan(): void {
    const doc = ContextManager.instance.document;
    _faces = scanEligibleConnectorFaces(doc);
    ConnectorVisualizer.instance.setEligibleFaces(_faces);
    TooltipManager.instance.setActiveHint({
        id: 'c2_connectors_pick',
        title: 'Wstaw połączenia',
        description: `Kliknij złącze | Dodano: ${_count} | ESC = zakończ`,
        cancelKey: 'Escape',
        category: 'general',
    });
    ContextManager.instance.appAPI?.setStatus?.(`Kliknij płaszczyznę styku (dodano ${_count})`, true);
}

function placeFace(face: EligibleContactFace): void {
    const doc = ContextManager.instance.document;
    const store = ConnectorStore.instance;
    const group = buildGroupFromContact(doc, face, store.placementRule);
    if (!group || group.connectors.length === 0) return;
    executeConnectorCommand(new AddConnectorGroupCommand(store, group));
    _count += 1;
    rescan();
}

function finishPick(): void {
    _active = false;
    _count = 0;
    _faces = [];
    setConnectorsPlanePickActive(false);
    ConnectorVisualizer.instance.clearEligible();
    TooltipManager.instance.setActiveHint(null);
    ContextManager.instance.appAPI?.setStatus?.('Gotowy', false);
    detachObservers();
    const tab = ContextManager.instance.activeTab;
    requestAnimationFrame(() => applyTabSelectionPolicy(tab));
}

function detachObservers(): void {
    const scene = ContextManager.instance.viewport?.scene;
    if (scene && _observer) {
        try { scene.onPointerObservable.remove(_observer); } catch {}
    }
    _observer = null;
    if (_keyHandler) {
        window.removeEventListener('keydown', _keyHandler, true);
        _keyHandler = null;
    }
}

export function isConnectorPickActive(): boolean {
    return _active;
}

export function getConnectorPickCount(): number {
    return _count;
}

export function stopConnectorPick(): void {
    if (_active) finishPick();
}

export function startConnectorPick(): void {
    stopConnectorPick();
    const doc = ContextManager.instance.document;
    if (!doc) return;
    _active = true;
    _count = 0;
    setConnectorsPlanePickActive(true);
    applyTabSelectionPolicy('tab-c2-connectors');
    rescan();

    const scene = ContextManager.instance.viewport?.scene;
    if (scene) {
        _observer = scene.onPointerObservable.add((info: any) => {
            if (!_active) return;
            const type = info.type;
            if (type === BABYLON.PointerEventTypes.POINTERMOVE) {
                if (info.event?.buttons) return;
                const ray = cameraRayCad();
                if (!ray) return;
                ConnectorVisualizer.instance.setHover(pickEligibleFace(_faces, ray.origin, ray.dir));
                return;
            }
            if (type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
            if (info.event?.button !== 0) {
                if (info.event?.button === 2) {
                    finishPick();
                    info.event?.preventDefault?.();
                }
                return;
            }
            const now = Date.now();
            if (now - _lastClick < 300) {
                _lastClick = now;
                finishPick();
                return;
            }
            _lastClick = now;
            const ray = cameraRayCad();
            if (!ray) return;
            const hit = pickEligibleFace(_faces, ray.origin, ray.dir);
            if (hit) {
                placeFace(hit);
                info.skipOnPointerObservable = true;
            }
        });
    }

    _keyHandler = (e: KeyboardEvent) => {
        if (!_active) return;
        if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            finishPick();
        }
    };
    window.addEventListener('keydown', _keyHandler, true);
}

export function confirmConnectorPick(): void {
    finishPick();
}

export function applyRuleToGroup(
    document: any,
    groupId: string,
    placementRule: string,
    positionsActive?: boolean[] | null,
    firstOffsetMm?: number | null,
): boolean {
    const store = ConnectorStore.instance;
    const group = store.get(groupId);
    if (!group) return false;
    const next = regenerateGroup(
        document,
        group,
        placementRule,
        positionsActive,
        firstOffsetMm ?? store.firstOffsetMm,
    );
    if (!next) return false;
    executeConnectorCommand(new ReplaceConnectorGroupCommand(store, group, next));
    return true;
}
