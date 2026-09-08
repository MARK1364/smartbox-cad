import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceConfigManager, PERF_CONFIG_STORAGE_KEY } from '../performance-config.js';

describe('PerformanceConfigManager', () => {
    beforeEach(() => {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(PERF_CONFIG_STORAGE_KEY);
        }
        PerformanceConfigManager.instance.resetToDefaults();
    });

    it('loads default values from performance-config.json', () => {
        const mgr = PerformanceConfigManager.instance;
        expect(mgr.getHardwareScalingLevel()).toBe(1.0);
        expect(mgr.getThrottleHoverMs()).toBe(35);
        expect(mgr.getAntialias()).toBe(true);
        expect(mgr.getPowerPreference()).toBe('high-performance');
    });

    it('switches to "low" performance profile correctly', () => {
        const mgr = PerformanceConfigManager.instance;
        mgr.setProfile('low', false);

        expect(mgr.getActiveProfile()).toBe('low');
        expect(mgr.getHardwareScalingLevel()).toBe(1.5);
        expect(mgr.getThrottleHoverMs()).toBe(50);
        expect(mgr.getAntialias()).toBe(false);
        expect(mgr.getPowerPreference()).toBe('default');
    });

    it('switches to "high" performance profile correctly', () => {
        const mgr = PerformanceConfigManager.instance;
        mgr.setProfile('high', false);

        expect(mgr.getActiveProfile()).toBe('high');
        expect(mgr.getHardwareScalingLevel()).toBe(1.0);
        expect(mgr.getThrottleHoverMs()).toBe(20);
        expect(mgr.getAntialias()).toBe(true);
    });

    it('applies hardwareScalingLevel to Babylon.js engine', () => {
        const mgr = PerformanceConfigManager.instance;
        mgr.setProfile('low', false);

        const mockEngine = {
            setHardwareScalingLevel: vi.fn()
        };

        mgr.applyToEngine(mockEngine);
        expect(mockEngine.setHardwareScalingLevel).toHaveBeenCalledWith(1.5);
    });
});
