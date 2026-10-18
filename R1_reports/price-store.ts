/**
 * Runtime'owy magazyn cennika (SSOT wyceny po stronie przeglądarki).
 *
 * Źródło cen = R1_reports/prices.json (import domyślny). Edytor cennika nadpisuje go
 * w localStorage (klucz CAD_PRICES_OVERRIDE) i rozgłasza zmianę przez BroadcastChannel,
 * dzięki czemu otwarte okna (CAD, raport) przeliczają się bez przeładowania.
 */

import defaultPrices from './prices.json';
import { storageAdapter } from '../src/storage/storage-adapter.js';
import {
    validatePriceDatabase,
    type PriceDatabase,
} from './prices-validate.js';

export const PRICES_OVERRIDE_KEY = 'CAD_PRICES_OVERRIDE';
export const PRICES_CHANNEL_NAME = 'smartpanel-cad-prices';
export const PRICES_UPDATED_MESSAGE = 'prices-updated';

function clone<T>(value: T): T {
    return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function readOverride(): PriceDatabase | null {
    const raw = storageAdapter.getItem(PRICES_OVERRIDE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        validatePriceDatabase(parsed);
        return parsed;
    } catch {
        return null;
    }
}

export type PricesUnsubscribe = () => void;

export class PriceStore {
    private static _instance: PriceStore | null = null;

    static get instance(): PriceStore {
        if (!this._instance) this._instance = new PriceStore();
        return this._instance;
    }

    private _prices: PriceDatabase;
    private _listeners = new Set<() => void>();
    private _channel: BroadcastChannel | null = null;

    private constructor() {
        this._prices = readOverride() ?? this.defaults();
        this.setupChannel();
    }

    /** Aktualnie obowiązujący cennik (kopia niemodyfikowalna w miejscu). */
    get prices(): PriceDatabase {
        return this._prices;
    }

    /** Ceny wbudowane w aplikację (prices.json). */
    defaults(): PriceDatabase {
        return clone(defaultPrices) as unknown as PriceDatabase;
    }

    /** Czy aktywny jest zapisany lokalnie nadpisany cennik. */
    get isOverridden(): boolean {
        return readOverride() !== null;
    }

    subscribe(listener: () => void): PricesUnsubscribe {
        this._listeners.add(listener);
        return () => {
            this._listeners.delete(listener);
        };
    }

    /** Waliduje i ustawia nowy cennik, utrwalając go w localStorage. */
    setPrices(db: unknown): void {
        validatePriceDatabase(db);
        this._prices = clone(db);
        storageAdapter.setItem(PRICES_OVERRIDE_KEY, JSON.stringify(this._prices));
        this.notify();
    }

    /** Ustawia cennik bez zapisu lokalnego (np. świeżo odczytany z dysku przez /api/prices). */
    applyPrices(db: unknown, persist = false): void {
        validatePriceDatabase(db);
        this._prices = clone(db);
        if (persist) storageAdapter.setItem(PRICES_OVERRIDE_KEY, JSON.stringify(this._prices));
        this.notify();
    }

    /** Przywraca ceny domyślne (usuwa lokalne nadpisanie). */
    reset(): void {
        storageAdapter.removeItem(PRICES_OVERRIDE_KEY);
        this._prices = this.defaults();
        this.notify();
    }

    private notify(): void {
        for (const listener of this._listeners) {
            try {
                listener();
            } catch {
                /* pojedynczy odbiorca nie może przerwać rozgłaszania */
            }
        }
        this._channel?.postMessage({ type: PRICES_UPDATED_MESSAGE });
    }

    private setupChannel(): void {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
        this._channel = new BroadcastChannel(PRICES_CHANNEL_NAME);
        this._channel.onmessage = (event: MessageEvent) => {
            if ((event?.data as any)?.type !== PRICES_UPDATED_MESSAGE) return;
            this._prices = readOverride() ?? this.defaults();
            for (const listener of this._listeners) {
                try {
                    listener();
                } catch {
                    /* ignore */
                }
            }
        };
    }
}

export const priceStore = PriceStore.instance;
