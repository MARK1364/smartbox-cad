/**
 * SmartPanel Web — ProjectDocument
 *
 * Scentralizowany dokument domenowy CAD. Jedyny właściciel drzewa `CADNode` i stanu domenowego.
 *
 * ZASADY INTEGRALNOŚCI:
 * 1. Jednostką domenową są wyłącznie nanometry [nm].
 * 2. Korzeniem drzewa jest pojedynczy węzeł `ROOM`.
 * 3. Utrzymuje szybki indeks `nodeIndex: Map<NodeId, CADNode>`.
 * 4. Zapewnia brak cykli w drzewie oraz spójność referencji rodzic-dziecko.
 * 5. Emituje opisowe zdarzenia domenowe (`documentChanged`).
 * 6. Zero zależności od Babylon.js, DOM czy warstwy widoku.
 * 7. Dane spoza drzewa (PMI, więzy, kamera) żyją w `extensions`, nie w korzeniu JSON.
 * 8. Błędy serializacji / hydracji / load rozszerzeń przerywają operację — bez cichego gubienia danych.
 */

import { CADNode } from './cad-node/cad-node.js';
import { NodeType } from './cad-node/node-type.js';
import { Vec3 } from './cad-math/vec3.js';
import { Quat } from './cad-math/quat.js';
import { mmToNm } from './cad-math/units.js';
import type { DomainData } from './domain-data.js';
import { isContainerModel } from './domain-data.js';
import {
    applyDefaultDomainHandlers,
    type DomainFactory,
    type DomainHydrator,
} from './domain-registry.js';
import appPackage from '../package.json';
import {
    PROJECT_FORMAT,
    PROJECT_FORMAT_VERSION,
    PROJECT_DOMAIN_UNIT,
    migrateProjectToCurrent,
    type ProjectDocumentJSON,
    type ProjectMetadataJSON,
} from './project-file-format.js';

export {
    PROJECT_FORMAT,
    PROJECT_FORMAT_VERSION,
    PROJECT_DOMAIN_UNIT,
    migrateProjectToCurrent,
};
export type { ProjectDocumentJSON, ProjectMetadataJSON };

export const PROJECT_APP_VERSION = String((appPackage as { version?: string }).version || '0.0.0');

export type DocumentChangeType = 'structure' | 'transform' | 'dimensions' | 'features' | 'loaded' | 'all';

export interface DocumentChangeEvent {
    type: DocumentChangeType;
    affectedNodeIds?: string[];
    revision: number;
}

export type DocumentChangeSubscriber = (event: DocumentChangeEvent) => void;

export interface ProjectDocumentOptions {
    id?: string;
    name?: string;
    domainUnit?: string;
}

/**
 * Sekcja dokumentu utrzymywana poza drzewem `CADNode` (np. adnotacje PMI).
 * Pozwala dołączyć własne dane do serializacji bez wprowadzania zależności
 * z `ProjectDocument` do modułów warstwy widoku.
 */
export interface DocumentExtension {
    serialize(): any;
    load(data: any): void;
    /** Domyślnie true. `false` wyłącza sekcję ze snapshotów undo (np. arkusze, materiały). */
    includeInSnapshots?: boolean;
}

export interface SerializeOptions {
    snapshot?: boolean;
}

export interface LoadOptions {
    snapshot?: boolean;
}

export class ProjectDocument {
    id: string;
    name: string;
    readonly domainUnit: string = PROJECT_DOMAIN_UNIT;
    readonly formatVersion: number = PROJECT_FORMAT_VERSION;
    metadata: ProjectMetadataJSON = {};

    private _rootNode: CADNode;
    private _nodeIndex: Map<string, CADNode> = new Map();
    private _revision: number = 0;
    private _savedRevision: number = 0;
    private _extensions: Map<string, DocumentExtension> = new Map();
    /** Sekcje z pliku, dla których nie było zarejestrowanego rozszerzenia przy load. */
    private _orphanExtensions: Record<string, any> = {};
    private _hydrators: Map<string, DomainHydrator> = new Map();
    private _factories: Map<string, DomainFactory> = new Map();

    activeEntity: DomainData | null = null;

    private _subscribers: Set<DocumentChangeSubscriber> = new Set();

    constructor(options: ProjectDocumentOptions = {}) {
        if (options.domainUnit && options.domainUnit !== PROJECT_DOMAIN_UNIT) {
            throw new Error(`ProjectDocument: unsupported domainUnit "${options.domainUnit}". Only "${PROJECT_DOMAIN_UNIT}" is allowed.`);
        }
        this.id = options.id ?? `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        this.name = options.name ?? 'Projekt WebCAD';
        this.domainUnit = PROJECT_DOMAIN_UNIT;

        // Utwórz główny korzeń typu ROOM
        this._rootNode = new CADNode('root_room', 'Pokój', NodeType.ROOM);
        this._registerSubtree(this._rootNode);
        applyDefaultDomainHandlers(this);
    }

    // ─── Gettery stanu ──────────────────────────────────────────

    get rootNode(): CADNode {
        return this._rootNode;
    }

    get revision(): number {
        return this._revision;
    }

    get savedRevision(): number {
        return this._savedRevision;
    }

    isDirty(): boolean {
        return this._revision !== this._savedRevision;
    }

    markSaved(): void {
        this._savedRevision = this._revision;
    }

    setActiveEntity(entity: DomainData | null): void {
        this.activeEntity = entity;
        this.emitChange('all');
    }

    getTransformableTarget(entity: DomainData | null): { target: DomainData | null; isChildPanel: boolean } {
        if (!entity) return { target: null, isChildPanel: false };

        if (entity.type === 'container') {
            return { target: entity, isChildPanel: false };
        }

        const node = this.findNode(entity.id);
        if (node && node.parent && node.parent.nodeType === NodeType.ASSEMBLY) {
            // Panel ręczny jest niezależny — gizmo i relacje ruszają jego, nie cały korpus.
            if ((entity as any).engineManaged === false) {
                return { target: entity, isChildPanel: false };
            }
            const parentDomain = node.parent.domainData;
            if (parentDomain && isContainerModel(parentDomain)) {
                return { target: parentDomain, isChildPanel: true };
            }
        }

        return { target: entity, isChildPanel: false };
    }

    // ─── Rejestr węzłów ──────────────────────────────────────────

    private _registerSubtree(node: CADNode): void {
        if (this._nodeIndex.has(node.id) && this._nodeIndex.get(node.id) !== node) {
            throw new Error(`ProjectDocument: duplicate node ID "${node.id}".`);
        }
        this._nodeIndex.set(node.id, node);
        for (const child of node.children) {
            this._registerSubtree(child);
        }
    }

    private _unregisterSubtree(node: CADNode): void {
        this._nodeIndex.delete(node.id);
        for (const child of node.children) {
            this._unregisterSubtree(child);
        }
    }

    /**
     * Wyszukuje węzeł w projekcie po stabilnym ID.
     */
    findNode(id: string): CADNode | null {
        return this._nodeIndex.get(id) ?? null;
    }

    /**
     * Zwraca wszystkie węzły danego typu z drzewa dokumentu.
     */
    getNodesByType(type: NodeType): CADNode[] {
        return Array.from(this._nodeIndex.values()).filter(n => n.nodeType === type);
    }

    /**
     * Zwraca węzły formatki (PART).
     */
    getPanels(): CADNode[] {
        return this.getNodesByType(NodeType.PART);
    }

    /**
     * Zwraca węzły korpusów/złożeń (ASSEMBLY).
     */
    getContainers(): CADNode[] {
        return this.getNodesByType(NodeType.ASSEMBLY);
    }

    // ─── Operacje strukturalne ────────────────────────────────────

    /**
     * Dodaje węzeł do wybranego rodzica.
     */
    addNode(parentId: string, node: CADNode, index?: number): void {
        const parent = this.findNode(parentId);
        if (!parent) {
            throw new Error(`ProjectDocument.addNode: parent node "${parentId}" not found.`);
        }

        // Sprawdź czy węzeł nie powoduje cyklu
        let ancestor: CADNode | null = parent;
        while (ancestor !== null) {
            if (ancestor === node) {
                throw new Error(`ProjectDocument.addNode: cycle detected — cannot add "${node.id}" under "${parentId}".`);
            }
            ancestor = ancestor.parent;
        }

        parent.addChild(node);

        // Jeśli podano konkretny indeks w liście dzieci
        if (index !== undefined && index >= 0 && index < parent.children.length - 1) {
            const childrenArr = (parent as any)._children as CADNode[];
            if (childrenArr) {
                const currentIdx = childrenArr.indexOf(node);
                if (currentIdx !== -1) {
                    childrenArr.splice(currentIdx, 1);
                    childrenArr.splice(index, 0, node);
                }
            }
        }

        this._registerSubtree(node);
        this.emitChange('structure', [node.id, parentId]);
    }

    /**
     * Usuwa węzeł z drzewa dokumentu (wraz z poddrzewem).
     */
    removeNode(nodeId: string): CADNode | null {
        const node = this.findNode(nodeId);
        if (!node) return null;
        if (node === this._rootNode) {
            throw new Error('ProjectDocument.removeNode: cannot remove the root ROOM node.');
        }

        const parent = node.parent;
        const parentId = parent?.id;

        node.detach();
        this._unregisterSubtree(node);

        this.emitChange('structure', parentId ? [nodeId, parentId] : [nodeId]);
        return node;
    }

    /**
     * Zmienia rodzica węzła (reparenting).
     */
    reparentNode(
        nodeId: string,
        newParentId: string,
        options: { mode?: 'keepLocal' | 'keepWorld'; index?: number } = {}
    ): void {
        const node = this.findNode(nodeId);
        if (!node) {
            throw new Error(`ProjectDocument.reparentNode: node "${nodeId}" not found.`);
        }
        const newParent = this.findNode(newParentId);
        if (!newParent) {
            throw new Error(`ProjectDocument.reparentNode: new parent "${newParentId}" not found.`);
        }

        if (node === this._rootNode) {
            throw new Error('ProjectDocument.reparentNode: cannot reparent root ROOM node.');
        }

        const oldWorldMatrix = node.getWorldMatrix().clone();
        const mode = options.mode ?? 'keepWorld';

        newParent.addChild(node);

        if (options.index !== undefined) {
            const childrenArr = (newParent as any)._children as CADNode[];
            if (childrenArr) {
                const currentIdx = childrenArr.indexOf(node);
                if (currentIdx !== -1) {
                    childrenArr.splice(currentIdx, 1);
                    childrenArr.splice(options.index, 0, node);
                }
            }
        }

        if (mode === 'keepWorld') {
            const parentWorldInv = newParent.getWorldMatrix().invert();
            const newLocalMatrix = parentWorldInv.multiply(oldWorldMatrix);
            node.setLocalMatrix(newLocalMatrix);
        }

        this.emitChange('structure', [nodeId, newParentId]);
    }

    // ─── Fabryki obiektów domenowych ─────────────────────────────

    /**
     * Tworzy nowy kontener (ASSEMBLY) i przypina go do dokumentu.
     * Używa rejestru fabryk domenowych — analogicznie do createPanel.
     * Fabrykę ASSEMBLY rejestruje project-domain.ts lub registerFactory().
     */
    createAssembly(options: Record<string, unknown> = {}, parentId?: string): DomainData {
        const factory = this._factories.get(NodeType.ASSEMBLY);
        if (!factory) {
            throw new Error(
                'ProjectDocument.createAssembly: no ASSEMBLY factory registered. Import src/application/project-domain or call registerFactory().'
            );
        }
        const container = factory(options);
        const node = new CADNode(container.id, container.name, NodeType.ASSEMBLY);
        node.domainData = container;
        const targetParentId = parentId ?? this._rootNode.id;
        this.addNode(targetParentId, node);
        return container;
    }

    /**
     * Tworzy nowy panel (PART) i przypina go do dokumentu.
     * Wymiary (width/height/thickness w nm) są wymagane — alias `depth` → `thickness`.
     */
    createPanel(options: any = {}, parentId?: string): DomainData {
        const factory = this._factories.get(NodeType.PART);
        if (!factory) {
            throw new Error('ProjectDocument.createPanel: no PART factory registered. Import src/application/project-domain or call registerFactory().');
        }
        const normalized = {
            ...options,
            thickness: options.thickness ?? options.depth,
        };
        const panel = factory(normalized);
        const node = new CADNode(panel.id, panel.name, NodeType.PART);
        node.domainData = panel;
        const targetParentId = parentId ?? this._rootNode.id;
        this.addNode(targetParentId, node);
        return panel;
    }

    /**
     * Tworzy i wstawia kompletną kopię węzła 3D (kontenera lub formatki) z przesunięciem na scenie.
     */
    duplicateCADNode(sourceNodeId: string, offsetMm: { x: number; y: number; z: number } = { x: 500, y: 0, z: 0 }): CADNode | null {
        const sourceNode = this.findNode(sourceNodeId);
        if (!sourceNode) return null;

        const json = this._serializeNode(sourceNode);

        const remapIds = (data: any) => {
            const newId = `${data.nodeType || 'node'}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
            data.id = newId;
            data.name = `${data.name || 'Obiekt'} (Kopia)`;
            if (data.domainData) {
                data.domainData.id = newId;
                data.domainData.name = data.name;
            }
            if (data.children && Array.isArray(data.children)) {
                for (const child of data.children) {
                    remapIds(child);
                }
            }
        };
        remapIds(json);

        const clonedNode = this._deserializeNode(json);

        const { translation, rotation, scale } = sourceNode.localMatrix.decompose();
        clonedNode.setLocalTransform(
            new Vec3(
                translation.x + mmToNm(offsetMm.x),
                translation.y + mmToNm(offsetMm.y),
                translation.z + mmToNm(offsetMm.z)
            ),
            rotation,
            scale
        );

        const targetParentId = sourceNode.parent ? sourceNode.parent.id : this._rootNode.id;
        this.addNode(targetParentId, clonedNode);
        this.emitChange('structure', [clonedNode.id]);
        return clonedNode;
    }

    // ─── System Zdarzeń ──────────────────────────────────────────

    private _eventListeners: Map<string, Set<Function>> = new Map();

    on(eventName: string, subscriber: Function): () => void {
        if (!this._eventListeners.has(eventName)) {
            this._eventListeners.set(eventName, new Set());
        }
        this._eventListeners.get(eventName)!.add(subscriber);
        return () => {
            this._eventListeners.get(eventName)?.delete(subscriber);
        };
    }

    off(eventName: string, subscriber: Function): void {
        this._eventListeners.get(eventName)?.delete(subscriber);
    }

    emit(eventName: string, ...args: any[]): void {
        const listeners = this._eventListeners.get(eventName);
        if (listeners) {
            for (const fn of listeners) {
                try { fn(...args); } catch (err) { console.error(`ProjectDocument listener error (${eventName}):`, err); }
            }
        }
    }

    onDocumentChanged(subscriber: DocumentChangeSubscriber): () => void {
        this._subscribers.add(subscriber);
        return () => this._subscribers.delete(subscriber);
    }

    notifyDocumentChanged(affectedNodeIds?: string[]): void {
        this.emitChange('all', affectedNodeIds);
    }

    emitChange(type: DocumentChangeType, affectedNodeIds?: string[]): void {
        this._revision++;
        const event: DocumentChangeEvent = {
            type,
            affectedNodeIds,
            revision: this._revision
        };
        for (const sub of this._subscribers) {
            try {
                sub(event);
            } catch (err) {
                console.error('ProjectDocument change listener error:', err);
            }
        }
    }

    // ─── Rozszerzenia dokumentu ───────────────────────────────────

    registerExtension(key: string, extension: DocumentExtension): () => void {
        this._extensions.set(key, extension);
        return () => { this._extensions.delete(key); };
    }

    registerHydrator(nodeType: string, hydrator: DomainHydrator): () => void {
        this._hydrators.set(nodeType, hydrator);
        return () => { this._hydrators.delete(nodeType); };
    }

    registerFactory(nodeType: string, factory: DomainFactory): () => void {
        this._factories.set(nodeType, factory);
        return () => { this._factories.delete(nodeType); };
    }

    private _loadExtensions(bag: Record<string, any> | null, options?: LoadOptions): void {
        this._orphanExtensions = {};
        const source = bag && typeof bag === 'object' ? bag : {};

        for (const [key, value] of Object.entries(source)) {
            const extension = this._extensions.get(key);
            if (extension) {
                try {
                    extension.load(value ?? null);
                } catch (err) {
                    throw new Error(
                        `ProjectDocument.load: błąd wczytywania rozszerzenia "${key}": ${err instanceof Error ? err.message : String(err)}`
                    );
                }
            } else {
                this._orphanExtensions[key] = value;
            }
        }

        for (const [key, extension] of this._extensions) {
            if (key in source) continue;
            if (options?.snapshot && extension.includeInSnapshots === false) continue;
            try {
                extension.load(null);
            } catch (err) {
                throw new Error(
                    `ProjectDocument.load: błąd resetu rozszerzenia "${key}": ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }
    }

    // ─── Serializacja i Deserializacja ────────────────────────────

    serialize(options?: SerializeOptions): ProjectDocumentJSON {
        const extensions: Record<string, any> = { ...this._orphanExtensions };

        for (const [key, extension] of this._extensions) {
            if (options?.snapshot && extension.includeInSnapshots === false) continue;
            try {
                extensions[key] = extension.serialize();
            } catch (err) {
                throw new Error(
                    `ProjectDocument.serialize: błąd serializacji rozszerzenia "${key}": ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }

        return {
            format: PROJECT_FORMAT,
            version: this.formatVersion,
            domainUnit: this.domainUnit,
            id: this.id,
            name: this.name,
            metadata: {
                ...this.metadata,
                appVersion: PROJECT_APP_VERSION,
            },
            rootNode: this._serializeNode(this._rootNode),
            extensions,
        };
    }

    private _serializeNode(node: CADNode): Record<string, any> {
        const { translation, rotation, scale } = node.localMatrix.decompose();
        const json: Record<string, any> = {
            id: node.id,
            name: node.name,
            nodeType: node.nodeType,
            translationNm: [translation.x, translation.y, translation.z],
            rotationQuat: [rotation.x, rotation.y, rotation.z, rotation.w],
            scale: [scale.x, scale.y, scale.z],
            children: node.children.map(c => this._serializeNode(c))
        };

        if (node.domainData) {
            const data = node.domainData as any;
            if (typeof data.toJSON !== 'function') {
                throw new Error(
                    `ProjectDocument.serialize: węzeł "${node.id}" (${node.nodeType}) ma domainData bez toJSON() — dane zostałyby pominięte.`
                );
            }
            json.domainData = data.toJSON();
        }

        return json;
    }

    /**
     * Całkowicie resetuje dokument do stanu czystego, nowego projektu.
     */
    reset(name = 'Nowy projekt'): void {
        this.id = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        this.name = name;
        this.metadata = {};
        this.activeEntity = null;
        this._rootNode = new CADNode('root_room', 'Pokój', NodeType.ROOM);
        this._nodeIndex.clear();
        this._registerSubtree(this._rootNode);
        this._orphanExtensions = {};
        this._revision = 0;
        this._loadExtensions(null);
        this.emitChange('loaded');
        this._savedRevision = this._revision;
    }

    load(data: any, options?: LoadOptions): void {
        if (!data) {
            this.reset();
            return;
        }

        const normalized = migrateProjectToCurrent(data);

        this._nodeIndex.clear();
        this.id = normalized.id || this.id;
        this.name = normalized.name || this.name;
        this.metadata = normalized.metadata ? { ...normalized.metadata } : {};
        this._rootNode = this._deserializeNode(normalized.rootNode);

        this.activeEntity = null;
        this._revision = 0;
        this._loadExtensions(normalized.extensions ?? {}, options);
        this.emitChange('loaded');
        this._savedRevision = this._revision;
    }

    private _hydrateDomainData(node: CADNode, nodeJson: any): void {
        const raw = nodeJson.domainData;
        if (!raw) return;

        const hydrator = this._hydrators.get(node.nodeType);
        if (!hydrator) {
            throw new Error(
                `ProjectDocument.load: brak hydratora dla nodeType "${node.nodeType}" (węzeł "${nodeJson.id}") — domainData nie zostałoby wczytane.`
            );
        }

        try {
            node.domainData = hydrator(raw, nodeJson);
        } catch (err) {
            throw new Error(
                `ProjectDocument.load: błąd hydratacji "${node.nodeType}" (${nodeJson.id}): ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    private _deserializeNode(nodeJson: any): CADNode {
        const type = nodeJson.nodeType as NodeType;
        const node = new CADNode(nodeJson.id, nodeJson.name || '', type);

        if (nodeJson.translationNm && nodeJson.rotationQuat) {
            const t = new Vec3(nodeJson.translationNm[0], nodeJson.translationNm[1], nodeJson.translationNm[2]);
            const q = new Quat(nodeJson.rotationQuat[0], nodeJson.rotationQuat[1], nodeJson.rotationQuat[2], nodeJson.rotationQuat[3]);
            const s = nodeJson.scale ? new Vec3(nodeJson.scale[0], nodeJson.scale[1], nodeJson.scale[2]) : undefined;
            node.setLocalTransform(t, q, s);
        }

        this._hydrateDomainData(node, nodeJson);

        this._registerSubtree(node);

        if (nodeJson.children && Array.isArray(nodeJson.children)) {
            for (const childJson of nodeJson.children) {
                const childNode = this._deserializeNode(childJson);
                node.addChild(childNode);
            }
        }

        return node;
    }
}
