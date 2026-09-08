/**
 * performance-config.ts
 * 
 * Scentralizowany menedżer konfiguracji wydajności dla całego CAD (Babylon.js, raycasty, shadery).
 * Umożliwia edycję parametrów przez plik performance-config.json, localStorage oraz parametry URL.
 */

import defaultConfig from '../performance-config.json';

export interface PerformanceProfile {
    name: string;
    hardwareScalingLevel: number;
    antialias: boolean;
    throttleHoverMs: number;
    maxFps?: number;
    renderOnDemand?: boolean;
    powerPreference?: 'high-performance' | 'default' | 'low-power';
}

export interface PerformanceConfigData {
    activeProfile: 'low' | 'medium' | 'high' | 'auto';
    profiles: Record<string, PerformanceProfile>;
    current: {
        hardwareScalingLevel: number;
        antialias: boolean;
        throttleHoverMs: number;
        powerPreference: 'high-performance' | 'default' | 'low-power';
        renderOnDemand?: boolean;
    };
}

export const PERF_CONFIG_STORAGE_KEY = 'SMARTPANEL_PERF_CONFIG';

export class PerformanceConfigManager {
    private static _instance: PerformanceConfigManager | null = null;
    private _config: PerformanceConfigData;

    private constructor() {
        this._config = JSON.parse(JSON.stringify(defaultConfig)) as PerformanceConfigData;
        this._loadFromStorageAndUrl();
    }

    public static get instance(): PerformanceConfigManager {
        if (!PerformanceConfigManager._instance) {
            PerformanceConfigManager._instance = new PerformanceConfigManager();
        }
        return PerformanceConfigManager._instance;
    }

    private _loadFromStorageAndUrl(): void {
        // 1. Wczytaj z localStorage jeśli istnieje
        if (typeof localStorage !== 'undefined') {
            try {
                const stored = localStorage.getItem(PERF_CONFIG_STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed && typeof parsed === 'object') {
                        this._config = {
                            ...this._config,
                            ...parsed,
                            current: { ...this._config.current, ...(parsed.current || {}) }
                        };
                    }
                }
            } catch (err) {
                console.warn('[PerformanceConfig] Błąd parsowania localStorage:', err);
            }
        }

        // 2. Nadpisywanie z URL (np. ?perf=low lub ?scale=1.5)
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            const perfParam = params.get('perf');
            if (perfParam && (perfParam === 'low' || perfParam === 'medium' || perfParam === 'high' || perfParam === 'auto')) {
                this._applyProfileInternal(perfParam);
            }

            const scaleParam = params.get('scale');
            if (scaleParam) {
                const val = parseFloat(scaleParam);
                if (!isNaN(val) && val > 0) {
                    this._config.current.hardwareScalingLevel = val;
                }
            }

            const throttleParam = params.get('throttle');
            if (throttleParam) {
                const val = parseInt(throttleParam, 10);
                if (!isNaN(val) && val >= 0) {
                    this._config.current.throttleHoverMs = val;
                }
            }
        }
    }

    private _applyProfileInternal(profileKey: 'low' | 'medium' | 'high' | 'auto'): void {
        this._config.activeProfile = profileKey;
        if (profileKey === 'auto') {
            // Domyślny profil w trybie auto
            this._config.current = {
                hardwareScalingLevel: 1.0,
                antialias: true,
                throttleHoverMs: 35,
                powerPreference: 'high-performance',
                renderOnDemand: false
            };
            return;
        }

        const profile = this._config.profiles[profileKey];
        if (profile) {
            this._config.current = {
                hardwareScalingLevel: profile.hardwareScalingLevel,
                antialias: profile.antialias,
                throttleHoverMs: profile.throttleHoverMs,
                powerPreference: profile.powerPreference || 'high-performance',
                renderOnDemand: profile.renderOnDemand ?? false
            };
        }
    }

    private _listeners: Set<(config: PerformanceConfigData) => void> = new Set();

    public getConfig(): PerformanceConfigData {
        return JSON.parse(JSON.stringify(this._config));
    }

    public subscribe(listener: (config: PerformanceConfigData) => void): () => void {
        this._listeners.add(listener);
        return () => {
            this._listeners.delete(listener);
        };
    }

    private _notifyListeners(): void {
        const copy = this.getConfig();
        for (const listener of this._listeners) {
            try {
                listener(copy);
            } catch (err) {
                console.error('[PerformanceConfig] Listener error:', err);
            }
        }
    }

    public getActiveProfile(): string {
        return this._config.activeProfile;
    }

    public setProfile(profileKey: 'low' | 'medium' | 'high' | 'auto', save: boolean = true): void {
        this._applyProfileInternal(profileKey);
        if (save && typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(PERF_CONFIG_STORAGE_KEY, JSON.stringify(this._config));
            } catch (err) {
                console.warn('[PerformanceConfig] Błąd zapisu do localStorage:', err);
            }
        }
        this._notifyListeners();
    }

    public updateCurrent(partial: Partial<PerformanceConfigData['current']>, save: boolean = true): void {
        this._config.current = {
            ...this._config.current,
            ...partial
        };
        if (save && typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(PERF_CONFIG_STORAGE_KEY, JSON.stringify(this._config));
            } catch (err) {
                console.warn('[PerformanceConfig] Błąd zapisu do localStorage:', err);
            }
        }
        this._notifyListeners();
    }

    public getHardwareScalingLevel(): number {
        return this._config.current?.hardwareScalingLevel ?? 1.0;
    }

    public getThrottleHoverMs(): number {
        return this._config.current?.throttleHoverMs ?? 35;
    }

    public getAntialias(): boolean {
        return this._config.current?.antialias ?? true;
    }

    public getPowerPreference(): 'high-performance' | 'default' | 'low-power' {
        return this._config.current?.powerPreference ?? 'high-performance';
    }

    public getRenderOnDemand(): boolean {
        return this._config.current?.renderOnDemand ?? false;
    }

    public applyToEngine(engine: any): void {
        if (!engine) return;
        const scale = this.getHardwareScalingLevel();
        if (typeof engine.setHardwareScalingLevel === 'function') {
            engine.setHardwareScalingLevel(scale);
        }
    }

    public resetToDefaults(): void {
        this._config = JSON.parse(JSON.stringify(defaultConfig)) as PerformanceConfigData;
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.removeItem(PERF_CONFIG_STORAGE_KEY);
            } catch { /* ignoruj */ }
        }
        this._notifyListeners();
    }
}
