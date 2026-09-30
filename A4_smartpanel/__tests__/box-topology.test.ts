import { describe, it, expect } from 'vitest';
import { buildBoxTopology } from '../native_core/box-topology';
import { KRAWEDZIE } from '../native_core/topology';

describe('box-topology SSOT', () => {
    it('emits exactly 12 edges keyed from topology.ts', () => {
        const { edges } = buildBoxTopology(600, 720, 18);
        expect(edges.length).toBe(12);
        for (const key of Object.keys(KRAWEDZIE)) {
            expect(edges.some((e) => e.key === key)).toBe(true);
        }
    });
});
