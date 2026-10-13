import { describe, it, expect } from 'vitest';
import { isBlokiHeightHLocked } from '../bloki-height-h.js';

describe('isBlokiHeightHLocked', () => {
    it('locks H when top and bottom references are both set', () => {
        expect(isBlokiHeightHLocked(
            { zMin: { panelId: 'a' }, zMax: { panelId: 'b' } },
            {}
        )).toBe(true);
    });

    it('unlocks H when bottom reference is disabled', () => {
        expect(isBlokiHeightHLocked(
            { zMin: { panelId: 'a' }, zMax: { panelId: 'b' } },
            { zMin: true }
        )).toBe(false);
    });

    it('unlocks H when top reference is missing', () => {
        expect(isBlokiHeightHLocked(
            { zMin: { panelId: 'a' } },
            {}
        )).toBe(false);
    });
});
