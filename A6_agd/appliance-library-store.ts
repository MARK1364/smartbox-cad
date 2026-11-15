/**
 * A6_agd — appliance-library-store.ts
 *
 * Magazyn biblioteki urządzeń AGD (modele parametryczne B-rep oraz modele GLB).
 */

import {
    type ApplianceTemplateItem,
    DEFAULT_FRIDGE_PARAMS,
    DEFAULT_FREESTANDING_FRIDGE_PARAMS,
} from './smart-appliance-types.js';
import { DEFAULT_SINK_PARAMS } from './sinks/sink-types.js';
import { createSmartAppliance } from './smart-appliance-core.js';
import { ContextManager } from '../A1_core/context-manager.js';
import { loadScenePropsFromCatalog } from '../B1_biblioteka/wyposazenie/scene-props-from-catalog.js';

const CATALOG_SCENE_PROP_TEMPLATES: ApplianceTemplateItem[] = loadScenePropsFromCatalog().map((entry) => {
    const stem = entry.modelPath
        ? entry.modelPath.replace(/^.*[\\/]/, '').replace(/\.(glb|gltf|obj|stl)$/i, '')
        : undefined;
    return {
        id: entry.id,
        name: entry.name,
        kind: 'SCENE_PROP',
        source: 'PARAMETRIC',
        category: entry.category,
        modelFormat: entry.modelFormat,
        glbPath: entry.modelPath,
        thumbnail: entry.pngPath,
        defaultParams: {
            width_mm: entry.width_mm,
            depth_mm: entry.depth_mm,
            height_mm: entry.height_mm,
            modelId: stem,
            modelFormat: entry.modelFormat,
            category: entry.category,
            parts: entry.parts,
        },
    };
});

export const DEFAULT_APPLIANCE_TEMPLATES: ApplianceTemplateItem[] = [
    {
        id: 'param_microwave_standard',
        name: 'Mikrofala',
        kind: 'MICROWAVE',
        source: 'PARAMETRIC',
        category: 'APPLIANCE',
        defaultParams: {
            frontHeight: 380,
            nalGoraMicro: 20,
            nalDolneMicro: 8,
            frontWidth: 595,
            frontDepth: 20,
            corpusWidth: 560,
            corpusDepth: 320,
        },
    },
    {
        id: 'param_oven_standard_60',
        name: 'Piekarnik',
        kind: 'OVEN',
        source: 'PARAMETRIC',
        category: 'APPLIANCE',
        defaultParams: {
            frontHeight: 596,
            nalGoraMicro: 20,
            nalDolneMicro: 0,
            frontWidth: 595,
            frontDepth: 22,
            corpusWidth: 560,
            corpusDepth: 550,
        },
    },
    {
        id: 'param_fridge_standard_178',
        name: 'Lodówka do zabudowy',
        kind: 'FRIDGE',
        source: 'PARAMETRIC',
        category: 'APPLIANCE',
        defaultParams: DEFAULT_FRIDGE_PARAMS,
    },
    {
        id: 'param_fridge_freestanding_side_by_side',
        name: 'Lodówka wolnostojąca (Side-by-Side)',
        kind: 'FRIDGE',
        source: 'PARAMETRIC',
        category: 'APPLIANCE',
        defaultParams: DEFAULT_FREESTANDING_FRIDGE_PARAMS,
    },
    {
        id: 'param_sink_standard_1k',
        name: 'Zlew nakładany jednokomorowy',
        kind: 'SINK',
        source: 'PARAMETRIC',
        category: 'APPLIANCE',
        defaultParams: DEFAULT_SINK_PARAMS,
    },
    ...CATALOG_SCENE_PROP_TEMPLATES,
];

export class ApplianceLibraryStore {
    private static _instance: ApplianceLibraryStore | null = null;
    private _items: ApplianceTemplateItem[] = [...DEFAULT_APPLIANCE_TEMPLATES];
    private _subscribers: Set<() => void> = new Set();

    public static get instance(): ApplianceLibraryStore {
        if (!this._instance) {
            this._instance = new ApplianceLibraryStore();
        }
        return this._instance;
    }

    public getAll(): ApplianceTemplateItem[] {
        return [...this._items];
    }

    public getById(id: string): ApplianceTemplateItem | undefined {
        return this._items.find((item) => item.id === id);
    }

    public registerItem(item: ApplianceTemplateItem): void {
        const idx = this._items.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
            this._items[idx] = item;
        } else {
            this._items.push(item);
        }
        this._notify();
    }

    public subscribe(cb: () => void): () => void {
        this._subscribers.add(cb);
        return () => this._subscribers.delete(cb);
    }

    private _notify(): void {
        this._subscribers.forEach((cb) => cb());
    }

    /**
     * Wstawia wybrany szablon AGD do sceny CAD na podanej pozycji.
     */
    public instantiate(
        template: ApplianceTemplateItem,
        position?: { x: number; y: number; z?: number },
        docTarget?: any
    ): any {
        const doc = docTarget || ContextManager.instance.document;
        if (!doc) return null;

        return createSmartAppliance({
            kind: template.kind,
            name: template.name,
            position: position || { x: 0, y: 0, z: undefined },
            params: template.defaultParams as any,
        }, doc);
    }
}

export const applianceLibraryStore = ApplianceLibraryStore.instance;
