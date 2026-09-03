/**
 * GLOBAL ID MANAGER — Centralny system identyfikatorów SmartBox (Wersja Web)
 * 
 * Odpowiednik pythonowego skryptu z Blendera.
 * Każda encja na scenie otrzymuje unikalny, hierarchiczny identyfikator SmartID.
 * 
 * Format:   <typ>:<uid>
 * Przykład: sf:a1b2c3d4e5f6
 *           sf:a1b2c3d4e5f6/part:bok_l
 */

export const EntityType = {
    SMARTFRAME:  "sf",
    SMARTBOX:    "sb",
    PART:        "part",
    EDGE:        "edge",
    FACE:        "face",
    VERTEX:      "vert",
    FEATURE:     "feat",
    DIMENSION:   "dim",
};

export class SmartID {
    _fullPath: string = "";

    constructor(entityType: string, uid: string, parent = "") {
        const segment = `${entityType}:${uid}`;
        if (parent) {
            this._fullPath = `${parent}/${segment}`;
        } else {
            this._fullPath = segment;
        }
    }

    static fromString(path: string): SmartID {
        const obj = new SmartID("", "");
        obj._fullPath = path;
        return obj;
    }

    get fullPath(): string { return this._fullPath; }
    
    get entityType(): string {
        const lastSegment = this._fullPath.split('/').pop() || "";
        return lastSegment.split(':')[0];
    }

    get uid(): string {
        const lastSegment = this._fullPath.split('/').pop() || "";
        const parts = lastSegment.split(':');
        return parts.length > 1 ? parts[1] : parts[0];
    }

    get parentPath(): string | null {
        const parts = this._fullPath.split('/');
        if (parts.length <= 1) return null;
        parts.pop();
        return parts.join('/');
    }

    child(entityType: string, uid: string): SmartID {
        return new SmartID(entityType, uid, this._fullPath);
    }

    toString(): string { return this._fullPath; }
}

export class IDManager {
    static instance: IDManager | null = null;
    _registry: Map<string, any> = new Map();

    constructor() {
        if (IDManager.instance) {
            return IDManager.instance;
        }
        this._registry = new Map();
        IDManager.instance = this;
    }

    static getInstance(): IDManager {
        if (!IDManager.instance) {
            IDManager.instance = new IDManager();
        }
        return IDManager.instance;
    }

    _generateUID(): string {
        return Math.random().toString(36).substring(2, 14);
    }

    register(entityType: string, parentId = "", role = "", metadata = {}): SmartID {
        let uid = role;
        if (!uid) {
            uid = this._generateUID();
        }

        let smartId = new SmartID(entityType, uid, parentId);
        
        let counter = 2;
        while (this._registry.has(smartId.fullPath)) {
            uid = `${role}_${counter}`;
            smartId = new SmartID(entityType, uid, parentId);
            counter++;
        }

        this._registry.set(smartId.fullPath, {
            id: smartId,
            metadata: metadata
        });

        return smartId;
    }

    /**
     * Rejestruje SmartID pod deterministyczną ścieżką `<parentId>/<entityType>:<role>`.
     *
     * W przeciwieństwie do `register()` nie dokleja sufiksu `_2` przy kolizji, tylko
     * zwraca istniejący wpis i odświeża jego metadane. Dzięki temu ten sam element
     * (np. wymiar albo krawędź formatki) zachowuje ten sam identyfikator po każdej
     * przebudowie geometrii — czego wymaga trwałe wiązanie adnotacji PMI.
     */
    registerStable(entityType: string, parentId = "", role = "", metadata = {}): SmartID {
        if (!role) {
            throw new Error('IDManager.registerStable: parametr "role" jest wymagany dla stabilnego identyfikatora.');
        }

        const smartId = new SmartID(entityType, role, parentId);
        const existing = this._registry.get(smartId.fullPath);

        if (existing) {
            existing.metadata = metadata;
            return existing.id;
        }

        this._registry.set(smartId.fullPath, { id: smartId, metadata });
        return smartId;
    }

    lookup(idString: string): any {
        return this._registry.get(idString) || null;
    }

    unregister(idString: string): boolean {
        return this._registry.delete(idString);
    }

    clear(): void {
        this._registry.clear();
    }
}
