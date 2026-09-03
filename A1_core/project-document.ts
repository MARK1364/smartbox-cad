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
 */

import { CADNode } from './cad-node/cad-node.js';
import { NodeType } from './cad-node/node-type.js';
import { Vec3 } from './cad-math/vec3.js';
import { Quat } from './cad-math/quat.js';
import { ContainerModel, ContainerModelOptions } from './container-model.js';
import type { DomainData } from './domain-data.js';
import {
    applyDefaultDomainHandlers,
    type DomainFactory,
    type DomainHydrator,
} from './domain-registry.js';
import appPackage from '../package.json';

export const PROJECT_FORMAT = 'smartpanel-project';
export const PROJECT_FORMAT_VERSION = 3;
export const PROJECT_APP_VERSION = String((appPackage as { version?: string }).version || '0.0.0');

/** Klucze, które w formacie v2 leżały w korzeniu pliku zamiast w `extensions`. */
const V2_ROOT_EXTENSION_KEYS = ['pmi', 'constraints'] as const;

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

export interface ProjectMetadataJSON {
    savedAt?: string;
    appVersion?: string;
    [key: string]: unknown;
}

export interface ProjectDocumentJSON {
    format: string;
    version: number;
    domainUnit: string;
    id: string;
    name: string;
    metadata?: ProjectMetadataJSON;
    rootNode: Record<string, any>;
    extensions?: Record<string, any>;
}

/**
 * Podnosi plik v2 (rozszerzenia i kamera w korzeniu) do v3 (`extensions`).
 * Czysty v3 przechodzi bez zmian struktury drzewa. Nieznane klucze w
 * `extensions` są zachowywane, żeby moduł nieobecny przy load nie gubił danych.
 */
export function migrateProjectToCurrent(data: any): ProjectDocumentJSON {
    if (!data || data.format !== PROJECT_FORMAT) {
        throw new Error(
            `ProjectDocument.load: Unsupported project format. Expected "${PROJECT_FORMAT}" version >= 2.`
        );
    }
    const version = Number(data.version);
    if (!Number.isFinite(version) || version < 2) {
        throw new Error(
            `ProjectDocument.load: Unsupported project version ${data.version}. Expected format "${PROJECT_FORMAT}" version >= 2.`
        );
    }
    if (version > PROJECT_FORMAT_VERSION) {
        console.warn(
            `ProjectDocument: plik w wersji ${version} jest nowszy niż obsługiwana ${PROJECT_FORMAT_VERSION}. Wczytuję z semantyką v${PROJECT_FORMAT_VERSION}.`
        );
    }
    if (!data.rootNode) {
        throw new Error('ProjectDocument.load: missing rootNode.');
    }

    const extensions: Record<string, any> = {};
    if (data.extensions && typeof data.extensions === 'object') {
        Object.assign(extensions, data.extensions);
    }

    for (const key of V2_ROOT_EXTENSION_KEYS) {
        if (data[key] !== undefined && extensions[key] === undefined) {
            extensions[key] = data[key];
        }
    }

    if (data.camera !== undefined && extensions.viewport === undefined) {
        extensions.viewport = { version: 1, camera: data.camera };
    }

    return {
        format: PROJECT_FORMAT,
        version: PROJECT_FORMAT_VERSION,
        domainUnit: data.domainUnit || 'nm',
        id: data.id,
        name: data.name,
        metadata: data.metadata && typeof data.metadata === 'object' ? { ...data.metadata } : {},
        rootNode: data.rootNode,
        extensions,
    };
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
    readonly domainUnit: string = 'nm';
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
        if (options.domainUnit && options.domainUnit !== 'nm') {
            throw new Error(`ProjectDocument: unsupported domainUnit "${options.domainUnit}". Only "nm" is allowed.`);
        }
        this.id = options.id ?? `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        this.name = options.name ?? 'Projekt WebCAD';
        this.domainUnit = 'nm';

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
            const parentDomain = node.parent.domainData as ContainerModel;
            if (parentDomain) {
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
     */
    createContainer(options: ContainerModelOptions = {}, parentId?: string): ContainerModel {
        const container = new ContainerModel(options);
        const node = new CADNode(container.id, container.name, NodeType.ASSEMBLY);
        node.domainData = container;
        const targetParentId = parentId ?? this._rootNode.id;
        this.addNode(targetParentId, node);
        return container;
    }

    /**
     * Tworzy nowy panel (PART) i przypina go do dokumentu.
     */
    createPanel(options: any = {}, parentId?: string): DomainData {
        const factory = this._factories.get(NodeType.PART);
        if (!factory) {
            throw new Error('ProjectDocument.createPanel: no PART factory registered. Import project-domain.ts or call registerFactory().');
        }
        const panel = factory(options);
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
                translation.x + (offsetMm.x * 1000000),
                translation.y + (offsetMm.y * 1000000),
                translation.z + (offsetMm.z * 1000000)
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
                    console.error(`ProjectDocument: błąd wczytywania rozszerzenia "${key}":`, err);
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
                console.error(`ProjectDocument: błąd wczytywania rozszerzenia "${key}":`, err);
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
                console.error(`ProjectDocument: błąd serializacji rozszerzenia "${key}":`, err);
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
            if (typeof data.toJSON === 'function') {
                json.domainData = data.toJSON();
            }
        }

        return json;
    }

    load(data: any, options?: LoadOptions): void {
        if (!data) {
            this._rootNode = new CADNode('root_room', 'Pokój', NodeType.ROOM);
            this._nodeIndex.clear();
            this._registerSubtree(this._rootNode);
            this.activeEntity = null;
            this.metadata = {};
            this._revision = 0;
            this._loadExtensions(null, options);
            this.emitChange('loaded');
            this._savedRevision = this._revision;
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
            console.warn(`ProjectDocument: brak hydratora dla nodeType "${node.nodeType}" — domainData pominięte.`);
            return;
        }

        try {
            node.domainData = hydrator(raw, nodeJson);
        } catch (err) {
            console.error(`ProjectDocument: błąd hydratacji "${node.nodeType}" (${nodeJson.id}):`, err);
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
