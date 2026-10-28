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
import { createSmartAppliance } from './smart-appliance-core.js';
import { ContextManager } from '../A1_core/context-manager.js';

export const DEFAULT_APPLIANCE_TEMPLATES: ApplianceTemplateItem[] = [
    {
        id: 'param_microwave_standard',
        name: 'Mikrofala',
        kind: 'MICROWAVE',
        source: 'PARAMETRIC',
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
        defaultParams: DEFAULT_FRIDGE_PARAMS,
    },
    {
        id: 'param_fridge_freestanding_side_by_side',
        name: 'Lodówka wolnostojąca (Side-by-Side)',
        kind: 'FRIDGE',
        source: 'PARAMETRIC',
        defaultParams: DEFAULT_FREESTANDING_FRIDGE_PARAMS,
    },
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

        if (template.source === 'PARAMETRIC') {
            return createSmartAppliance({
                kind: template.kind,
                name: template.name,
                position: position || { x: 0, y: 0, z: 0 },
                params: template.defaultParams as any,
            }, doc);
        }

        console.warn(`[ApplianceLibraryStore] Obsługa modeli GLB będzie rozszerzona dla ${template.id}`);
        return null;
    }
}

export const applianceLibraryStore = ApplianceLibraryStore.instance;
