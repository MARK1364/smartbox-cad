/**
 * Mock pamięciowy localStorage dla środowiska Vitest / Node.js
 */

const createMemoryStorage = () => {
    let store: Record<string, string> = {};
    return {
        getItem(key: string): string | null {
            return key in store ? store[key] : null;
        },
        setItem(key: string, value: string): void {
            store[key] = String(value);
        },
        removeItem(key: string): void {
            delete store[key];
        },
        clear(): void {
            store = {};
        },
        get length(): number {
            return Object.keys(store).length;
        },
        key(index: number): string | null {
            const keys = Object.keys(store);
            return index >= 0 && index < keys.length ? keys[index] : null;
        }
    };
};

if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage.getItem) {
    (globalThis as any).localStorage = createMemoryStorage();
}
