/**
 * E1_export - assembly-scene-adapter.ts
 * Pomost document (SSOT, nm) + C2 ConnectorStore → silnik sekwencji montażu,
 * oraz AssemblyPlan → SavedExportView[] (kadry kroku w menedżerze eksportu).
 *
 * Bez Babylon — operuje tylko na dokumentach CAD / domainData / typach eksportu.
 * Wywoływana z UI (assembly-ui.tsx) w kontekście modułu Eksport.
 */

import { NodeType } from '../A1_core/cad-node/node-type.js';
import type { CADNode } from '../A1_core/cad-node/cad-node.js';
import type { ProjectDocument } from '../A1_core/project-document.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { ConnectorStore } from '../C2_connectors/connector-store.js';
import type { SavedExportView, PaperFormat, ProjectionType, ExportRenderStyle } from '../E1_export/export-types.js';
import {
    buildAssemblySequence,
} from './assembly-sequence-engine.js';
import type { AssemblyPartRef, AssemblyNodeType, AssemblyConnectorRef, AssemblyPlan, AssemblySequenceRules } from './assembly-sequence-engine.js';
import { stepLektorText } from './assembly-lektor.js';


// ─── Dokument → części (dane wejściowe silnika) ───

function nodeTypeToAssembly(node: CADNode): AssemblyNodeType {
    if (node.nodeType === NodeType.PART) return 'PART';
    if (node.nodeType === NodeType.HARDWARE) return 'HARDWARE';
    return 'OTHER';
}

function readTranslationNm(node: CADNode): [number, number, number] | null {
    try {
        const { translation } = node.localMatrix.decompose();
        if (![translation.x, translation.y, translation.z].every(Number.isFinite)) return null;
        return [translation.x, translation.y, translation.z];
    } catch {
        return null;
    }
}

function isContainerLike(node: CADNode): boolean {
    const data = node.domainData as { type?: string } | null | undefined;
    return node.nodeType === NodeType.ASSEMBLY || data?.type === 'container';
}

/** Opcje scope zbierania: instrukcja dla pojedynczego korpusu / bloku = containerId. */
export interface AssemblyScopeOptions {
    /** Węzeł-korpus, z którego zbieramy części; null = cały projekt. */
    containerId?: string | null;
}

/**
 * Zbiera spis części do instrukcji: formatki + okucia z AZ całości sceny.
 * Kontenery (korpusy, bloki) trafiają jako parentId — nie jako osobne kroki.
 * `opts.containerId` = instrukcja dla pojedynczego korpusu (PPM w drzewie).
 */
export function collectAssemblyPartRefs(
    document: ProjectDocument | null | undefined,
    opts?: AssemblyScopeOptions | null,
): AssemblyPartRef[] {
    if (!document?.rootNode) return [];
    const parts: AssemblyPartRef[] = [];

    const walk = (node: CADNode, parentId: string | null) => {
        const data = node.domainData as
            | { role?: string; name?: string; hardwareId?: string; visible?: boolean; frozen?: boolean }
            | null
            | undefined;

        // Zamrożone węzły jak w raportach — ignorowane.
        const frozen = Boolean((node as unknown as { frozen?: boolean }).frozen || data?.frozen);
        if (frozen) return;

        const nt = nodeTypeToAssembly(node);
        if (nt === 'OTHER') {
            if (isContainerLike(node)) {
                for (const child of node.children) walk(child, node.id);
            }
            return;
        }

        const name = String(data?.name || node.name || node.id);
        parts.push({
            nodeId: node.id,
            name,
            role: data?.role ? String(data.role) : null,
            nodeType: nt,
            parentId,
            hardwareId: nt === 'HARDWARE' ? String(data?.hardwareId || '') || null : null,
            translationNm: readTranslationNm(node),
        });

        for (const child of node.children) walk(child, parentId);
    };

    // Scope pojedynczego korpusu (PPM) albo AZ całości projektu.
    const roots = opts?.containerId ? [document.findNode(opts.containerId)].filter(Boolean) : document.rootNode.children;
    for (const child of roots) walk(child, null);
    return parts;
}

// ─── ConnectorStore → AssemblyConnectorRef[] ───

export function connectorsToRefs(groups: unknown): AssemblyConnectorRef[] {
    if (!Array.isArray(groups)) return [];
    const refs: AssemblyConnectorRef[] = [];
    for (const raw of groups) {
        const group = raw as
            | { id?: string; parentObjectId?: string; otherObjectId?: string; connectors?: { type?: string; index?: number }[] }
            | null;
        if (!group?.id || !group.parentObjectId || !group.otherObjectId) continue;
        const counts: Record<string, number> = {};
        for (const inst of group.connectors || []) {
            if (!inst?.type) continue;
            counts[inst.type] = (counts[inst.type] || 0) + 1;
        }
        refs.push({
            id: String(group.id),
            parentObjectId: String(group.parentObjectId),
            otherObjectId: String(group.otherObjectId),
            counts,
        });
    }
    return refs;
}

// ─── Konwersja planu → kadry eksportu ───

export interface AssemblyViewCameraBase {
    cameraAlpha?: number;
    cameraBeta?: number;
    cameraRadius?: number;
    cameraTarget?: [number, number, number];
    orthoScale?: number;
}

export interface AssemblyViewBase extends AssemblyViewCameraBase {
    furnitureName: string;
    paperFormat: PaperFormat;
    projectionType: ProjectionType;
    renderStyle?: ExportRenderStyle;
    showGrid?: boolean;
    includePMI?: boolean;
    /** Skala / nr bazowy — kadr kroku dostawał numer Krok i/N w titleBlock. */
    scale?: string;
    drawingNumber?: string;
    author?: string;
    projectName?: string;
}

function cloneVisibility(items: unknown): SavedExportView['nodeVisibility'] {
    if (!Array.isArray(items)) return [];
    return (items as { nodeId: string; visible: boolean }[]).map((it) => ({
        nodeId: it.nodeId,
        visible: it.visible !== false,
    }));
}

export function assemblyPlanToSavedViews(
    plan: AssemblyPlan,
    base: AssemblyViewBase,
    scopeMeta?: AssemblyScopeMeta | null,
): SavedExportView[] {
    const includeInventory = !!plan.inventoryStep;
    const totalSteps = plan.steps.length + (includeInventory ? 1 : 0);
    const views: SavedExportView[] = [];
    const stamp = Date.now();
    const nowIso = new Date().toISOString();

    const cameraTarget = base.cameraTarget || [0, 0, 0];
    const camera = {
        cameraAlpha: base.cameraAlpha ?? -Math.PI / 4,
        cameraBeta: base.cameraBeta ?? Math.PI / 4,
        cameraRadius: base.cameraRadius ?? 0,
        cameraTarget: (base.cameraTarget || [0, 0, 0]) as [number, number, number],
        orthoScale: base.orthoScale,
    };

    const makeView = (
        stepIndex: number,
        name: string,
        text: string,
        visibility: SavedExportView['nodeVisibility'],
    ): SavedExportView => ({
        id: `asm_${stamp}_${stepIndex}`,
        name,
        createdAt: nowIso,
        paperFormat: base.paperFormat || 'A4_LANDSCAPE',
        projectionType: base.projectionType || 'PERSP',
        renderStyle: base.renderStyle,
        showGrid: base.showGrid ?? false,
        ...camera,
        notes: text,
        description: name,
        includeBOM: false,
        includePMI: base.includePMI ?? false,
        titleBlock: {
            projectName: base.projectName || '',
            furnitureName: base.furnitureName || '',
            author: base.author || '',
            date: nowIso.split('T')[0],
            scale: base.scale || '1:10',
            sheetNumber: `${stepIndex + 1} / ${totalSteps}`,
            drawingNumber: `${base.drawingNumber || 'INSTR'}-${String(stepIndex + 1).padStart(2, '0')}`,
            remarks: text,
        },
        nodeVisibility: cloneVisibility(visibility),
    });

    if (plan.inventoryStep) {
        const inv = plan.inventoryStep;
        views.push(
            tagAssemblyView(
                makeView(0, `Krok 0 — Inwentarz`, stepLektorText(inv), inv.visibility),
                scopeMeta ?? null,
            ),
        );
    }

    let i = includeInventory ? 1 : 0;
    for (const step of plan.steps) {
        const label = step.mode === 'single' && step.actions[0]?.name
            ? `${step.actions[0].name}`
            : `${step.actions.length}×`;
        views.push(
            tagAssemblyView(
                makeView(i, `Krok ${i} — ${label}`, stepLektorText(step), step.visibility),
                scopeMeta ?? null,
            ),
        );
        i += 1;
    }

    return views;
}

// ─── Snapshot bazowy z modułu eksportu + widoku ───

export function assemblyPlanFromScene(
    rules?: AssemblySequenceRules | null,
    opts?: AssemblyScopeOptions | null,
): AssemblyPlan | null {
    const doc = ContextManager.instance?.document;
    const parts = collectAssemblyPartRefs(doc, opts);
    if (parts.length === 0) return null;
    const partIds = new Set(parts.map((p) => p.nodeId));
    const connectorRefs = connectorsToRefs(ConnectorStore.instance.groups)
        .filter((r) => partIds.has(r.parentObjectId) && partIds.has(r.otherObjectId));
    const plan = buildAssemblySequence({ parts, connectors: connectorRefs, rules: rules || null });
    // Plan przypięty do szafek(scope) + fingerprintu zawartości (staleness check przy odtwarzaniu).
    (plan as { meta?: AssemblyScopeMeta }).meta = assemblyScopeFingerprint(doc, opts);
    return plan;
}

export function readAssemblyViewBase(overrides: Partial<AssemblyViewBase> = {}): AssemblyViewBase {
    const viewport = ContextManager.instance?.viewport as
        | { camera?: { alpha?: number; beta?: number; radius?: number; target?: { x: number; y: number; z: number } } }
        | null
        | undefined;
    const cam = viewport?.camera;
    const target = cam?.target
        ? ([cam.target.x, cam.target.y, cam.target.z] as [number, number, number])
        : ([0, 0, 0] as [number, number, number]);

    return {
        furnitureName: '',
        paperFormat: 'A4_LANDSCAPE' as PaperFormat,
        projectionType: 'PERSP' as ProjectionType,
        ...overrides,
        cameraAlpha: cam?.alpha,
        cameraBeta: cam?.beta,
        cameraRadius: cam?.radius,
        cameraTarget: target,
    };
}

// ─── Powiązanie planu / kadrów z szafkami projektu (scope + fingerprint) ───

export interface AssemblyScopeMeta {
    /** Id kontenerów-szafek (ASSEMBLY pod rootNode), do których przypięto plan. */
    scopeContainerIds: string[];
    /** Fingerprint zawartości (nodeId + rola) — zmiana korpusu != ten sam hash. */
    partsHash: string;
    partsCount: number;
}

/** Stabilny hash spisu części (djb2 nad posortowanymi kluczami). */
export function assemblyPartsHash(parts: AssemblyPartRef[]): string {
    const key = parts
        .map((p) => `${p.nodeType}:${p.nodeId}:${p.role || ''}:${p.parentId || ''}:hardware=${p.hardwareId || ''}`)
        .sort()
        .join('|');
    let h = 5381;
    for (let i = 0; i < key.length; i++) {
        h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
    }
    return `p${parts.length}_${h.toString(16)}`;
}

/** Stabilny hash spisu złączy C2 (djb2 nad posortowanymi kluczami grup). */
export function assemblyConnectorHash(refs: AssemblyConnectorRef[]): string {
    const key = refs
        .map((r) => `${r.id}:${r.parentObjectId}:${r.otherObjectId}:${
            Object.keys(r.counts || {}).sort().map((t) => `${t}x${r.counts[t]}`).join(',')
        }`)
        .sort()
        .join('|');
    let h = 5381;
    for (let i = 0; i < key.length; i++) {
        h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
    }
    return `c${refs.length}_${h.toString(16)}`;
}

/** Id top-level kontenerów (szafek) pod rootNode — scope planu/kadrów. */
export function collectScopeContainerIds(document: ProjectDocument | null | undefined): string[] {
    if (!document?.rootNode) return [];
    const ids: string[] = [];
    for (const child of document.rootNode.children) {
        if (isContainerLike(child)) ids.push(child.id);
    }
    return ids;
}

/** Fingerprint aktualnej sceny: szafki-scope + zawartość (części + złącza C2). */
export function assemblyScopeFingerprint(
    document: ProjectDocument | null | undefined,
    opts?: AssemblyScopeOptions | null,
): AssemblyScopeMeta {
    const parts = collectAssemblyPartRefs(document, opts);
    const partIds = new Set(parts.map((p) => p.nodeId));
    const connRefs = connectorsToRefs(ConnectorStore.instance.groups)
        // Złącza poza scope nie wpływają na instrukcję tego scope'u.
        .filter((r) => partIds.has(r.parentObjectId) && partIds.has(r.otherObjectId));
    return {
        scopeContainerIds: opts?.containerId ? [opts.containerId] : collectScopeContainerIds(document),
        // Części + złącza C2: dodanie/usunięcie kolka też unieważnia plan.
        partsHash: `${assemblyPartsHash(parts)}+${assemblyConnectorHash(connRefs)}`,
        partsCount: parts.filter((p) => p.nodeType === 'PART').length,
    };
}

/** Plan skojarzony ze sceną, z którym powstał (staleness check). */
export function isPlanStale(plan: AssemblyPlan | null | undefined, document: ProjectDocument | null | undefined): boolean {
    if (!plan || !document) return true;
    const meta = (plan as { meta?: AssemblyScopeMeta | null }).meta;
    if (!meta) return true; // stary plan bez fused scope — przelicz od nowa
    // Plan scoped na jeden korpus liczy się przeciw fingerprintowi TEGO korpusu.
    const scopeOpts: AssemblyScopeOptions | null = meta.scopeContainerIds.length === 1
        ? { containerId: meta.scopeContainerIds[0] }
        : null;
    const now = assemblyScopeFingerprint(document, scopeOpts);
    if (now.partsHash !== meta.partsHash) return true;
    // Każda szafka-scope planu musi nadal istnieć w dokumencie.
    for (const id of meta.scopeContainerIds) {
        if (!document.findNode(id)) return true;
    }
    return false;
}

/** Tag kadru instrukcji (assembly) — tylko kadry asm_*. */
export function tagAssemblyView(view: SavedExportView, meta: AssemblyScopeMeta | null): SavedExportView {
    if (!meta) return view;
    return {
        ...view,
        assembly: {
            scopeContainerIds: [...meta.scopeContainerIds],
            partsHash: meta.partsHash,
        },
    };
}

/** Czy kadr to kadr instrukcji montażu (asm_*). */
export function isAssemblyView(view: SavedExportView): boolean {
    return String(view?.id || '').startsWith('asm_');
}

/**
 * Czyszczenie kadrów instrukcji po zmianie projektu / usunięciu korpusu:
 *  - kadry NON-asm — nietkane (arbusze wykonawcze użytkownika),
 *  - kadry asm_* bez tagu (stary format) — usuwane (łatwiej wygenerować od zera),
 *  - kadry asm_* ze zmienionym fingerprintem / nieistniejąca szafka — usuwane,
 *  - doc null (projekt zamknięty) — kadry asm_* usuwane; makiet user zostają.
 */
export function pruneAssemblyViews(views: unknown, document: ProjectDocument | null | undefined): SavedExportView[] {
    if (!Array.isArray(views)) return [];
    const out: SavedExportView[] = [];
    for (const raw of views) {
        const view = raw as SavedExportView;
        if (!isAssemblyView(view)) {
            out.push(view);
            continue;
        }
        if (!document) continue; // projekt zamknięty → kadry instrukcji kasowane
        const tag = view.assembly;
        if (!tag || !Array.isArray(tag.scopeContainerIds)) continue; // stary format → od nowa
        const anyScopeMissing = tag.scopeContainerIds.some((id) => !document.findNode(id));
        if (anyScopeMissing) continue; // szafka usunięta → kadr kasowany
        // Fingerprint w scope kadru (jeden korpus → fingerprint tego korpusu).
        const scopeOpts: AssemblyScopeOptions | null = Array.isArray(tag.scopeContainerIds)
                && tag.scopeContainerIds.length === 1
            ? { containerId: tag.scopeContainerIds[0] }
            : null;
        const now = assemblyScopeFingerprint(document, scopeOpts);
        if (now.partsHash !== tag.partsHash) continue; // zawartość się zmieniła → od nowa
        out.push(view);
    }
    return out;
}
