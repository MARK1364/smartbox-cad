/**
 * A2_bloki/core/smart-module-registry.ts
 *
 * Centralny Rejestr Modułów Bloki (SmartModuleRegistry).
 * Pozwala dynamicznie odpytywać silnik oraz UI o rejestrowane wtyczki
 * zamiast hardcoded switch / if-else w bloki-core.ts i bloki-ui.tsx.
 */

import type { BlokiModuleId, SmartModulePlugin } from './smart-module-plugin.js';

class SmartModuleRegistryImpl {
    private plugins = new Map<BlokiModuleId, SmartModulePlugin<object>>();

    /** Rejestruje nową wtyczkę modułu Bloki. */
    register<TParams extends object>(plugin: SmartModulePlugin<TParams>): void {
        if (this.plugins.has(plugin.id)) {
            console.warn(`[SmartModuleRegistry] Moduł ${plugin.id} został zastąpiony nową rejestracją.`);
        }
        this.plugins.set(plugin.id, plugin as unknown as SmartModulePlugin<object>);
    }

    /** Wyrejestrowuje podany moduł. */
    unregister(id: BlokiModuleId): void {
        this.plugins.delete(id);
    }

    /** Pobiera wtyczkę po ID (niezależnie od flagi enabled). */
    get<TParams extends object = Record<string, unknown>>(id: BlokiModuleId | string): SmartModulePlugin<TParams> | undefined {
        return this.plugins.get(id as BlokiModuleId) as SmartModulePlugin<TParams> | undefined;
    }

    /** Sprawdza, czy moduł jest zarejestrowany i włączony w runtime. */
    isModuleEnabled(id: BlokiModuleId | string): boolean {
        const plugin = this.get(id);
        if (!plugin) return false;
        if (plugin.enabled === undefined) return true;
        return typeof plugin.enabled === 'function' ? plugin.enabled() : Boolean(plugin.enabled);
    }

    /** Pobiera listę aktywnych modułów dostępnych do dodania w UI. */
    getActiveModules(): SmartModulePlugin<object>[] {
        return Array.from(this.plugins.values())
            .filter(p => {
                if (p.enabled === undefined) return true;
                return typeof p.enabled === 'function' ? p.enabled() : Boolean(p.enabled);
            })
            .sort((a, b) => a.meta.order - b.meta.order);
    }

    /** Czyści cały rejestr (np. w celach testowych). */
    clear(): void {
        this.plugins.clear();
    }
}

export const SmartModuleRegistry = new SmartModuleRegistryImpl();
