/**
 * Cienki adapter pamięci podręcznej (Storage) z fallbackiem in-memory.
 * Umożliwia bezpieczne użycie w środowisku przeglądarki oraz Node.js/Vitest.
 */

const memoryStore: Record<string, string> = {};

export interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}

export const storageAdapter: StorageAdapter = {
    getItem(key: string): string | null {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage.getItem(key);
            }
            if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
                return (globalThis as any).localStorage.getItem(key);
            }
        } catch {}
        return memoryStore[key] || null;
    },

    setItem(key: string, value: string): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, value);
                return;
            }
            if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
                (globalThis as any).localStorage.setItem(key, value);
                return;
            }
        } catch {}
        memoryStore[key] = value;
    },

    removeItem(key: string): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
                return;
            }
            if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
                (globalThis as any).localStorage.removeItem(key);
                return;
            }
        } catch {}
        delete memoryStore[key];
    },

    clear(): void {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.clear();
            }
            if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
                (globalThis as any).localStorage.clear();
            }
        } catch {}
        for (const k of Object.keys(memoryStore)) {
            delete memoryStore[k];
        }
    }
};

export const getItem = storageAdapter.getItem;
export const setItem = storageAdapter.setItem;
export const removeItem = storageAdapter.removeItem;
export const clear = storageAdapter.clear;
