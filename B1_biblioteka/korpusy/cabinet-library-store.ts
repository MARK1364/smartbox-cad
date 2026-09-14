/**
 * B1_biblioteka/korpusy/cabinet-library-store.ts
 *
 * Magazyn biblioteki szafek (localStorage + eksport/import plików .json na dysk).
 */

import type { CabinetTemplate } from './types.js';

const STORAGE_KEY = 'smartbox_cabinet_library_v1';

/** Szablony startowe — pusta tablica, użytkownik sam tworzy własne szafki */
export const DEFAULT_TEMPLATES: CabinetTemplate[] = [];

class CabinetLibraryStore {
    private _subscribers: Set<() => void> = new Set();
    private _cache: CabinetTemplate[] | null = null;

    subscribe(cb: () => void): () => void {
        this._subscribers.add(cb);
        return () => this._subscribers.delete(cb);
    }

    private _notify(): void {
        for (const cb of this._subscribers) {
            try { cb(); } catch (e) { console.error(e); }
        }
    }

    /**
     * Zwraca wszystkie zapisane szablony korpusów.
     */
    getAll(): CabinetTemplate[] {
        if (this._cache) return [...this._cache];

        if (typeof window === 'undefined' || !window.localStorage) {
            return [];
        }

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                this._cache = [];
                return [];
            }
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                // Odfiltrowujemy stare szablony demonstracyjne std_*
                const userOnly = parsed.filter((t: any) => t && !String(t.id || '').startsWith('std_'));
                this._cache = userOnly;
                return [...this._cache];
            }
        } catch (e) {
            console.warn('[CabinetLibraryStore] Błąd odczytu z localStorage:', e);
        }

        this._cache = [];
        return [];
    }

    getById(id: string): CabinetTemplate | undefined {
        return this.getAll().find((t) => t.id === id);
    }

    /**
     * Zapisuje lub aktualizuje szablon szafki.
     */
    save(template: CabinetTemplate): void {
        const list = this.getAll();
        const existingIdx = list.findIndex((t) => t.id === template.id);
        if (existingIdx >= 0) {
            list[existingIdx] = { ...template };
        } else {
            list.unshift({ ...template });
        }
        this._cache = list;
        this._saveToLocalStorage(list);
        this._notify();
    }

    /**
     * Usuwa szablon o podanym identyfikatorze.
     */
    remove(id: string): boolean {
        const list = this.getAll();
        const next = list.filter((t) => t.id !== id);
        if (next.length !== list.length) {
            this._cache = next;
            this._saveToLocalStorage(next);
            this._notify();
            return true;
        }
        return false;
    }

    /**
     * Przywraca szablony domyślne.
     */
    resetToDefaults(): void {
        this._cache = [...DEFAULT_TEMPLATES];
        this._saveToLocalStorage(this._cache);
        this._notify();
    }

    /**
     * Eksportuje pojedynczy szablon jako plik JSON na dysk.
     */
    exportToJsonFile(template: CabinetTemplate): void {
        if (typeof window === 'undefined') return;
        const jsonStr = JSON.stringify(template, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `${template.name.toLowerCase().replace(/[^a-z0-9_-]/gi, '_')}.json`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Eksportuje całą bibliotekę jako jeden plik JSON.
     */
    exportAllToJsonFile(): void {
        if (typeof window === 'undefined') return;
        const list = this.getAll();
        const jsonStr = JSON.stringify(list, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `biblioteka_korpusow_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Importuje szablony z tekstu JSON (obsługuje pojedynczy obiekt lub tablicę).
     */
    importFromJson(jsonStr: string): { success: boolean; count: number; error?: string } {
        try {
            const data = JSON.parse(jsonStr);
            let importedCount = 0;

            if (Array.isArray(data)) {
                for (const item of data) {
                    if (this._isValidTemplate(item)) {
                        this.save(item);
                        importedCount++;
                    }
                }
            } else if (this._isValidTemplate(data)) {
                this.save(data);
                importedCount = 1;
            } else {
                return { success: false, count: 0, error: 'Niepoprawny format pliku JSON szafki.' };
            }

            return { success: true, count: importedCount };
        } catch (e: any) {
            return { success: false, count: 0, error: e?.message || 'Błąd parsowania JSON.' };
        }
    }

    private _isValidTemplate(item: any): item is CabinetTemplate {
        return (
            item &&
            typeof item === 'object' &&
            typeof item.name === 'string' &&
            item.dimensions &&
            typeof item.dimensions.width === 'number' &&
            typeof item.dimensions.height === 'number' &&
            typeof item.dimensions.depth === 'number'
        );
    }

    private _saveToLocalStorage(data: CabinetTemplate[]): void {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('[CabinetLibraryStore] Nie udało się zapisać do localStorage:', e);
        }
    }
}

export const cabinetLibraryStore = new CabinetLibraryStore();
