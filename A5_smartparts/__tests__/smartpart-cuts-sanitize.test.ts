/**
 * Eksport/odczyt cuts = 1:1 z drzewem Studio (żywy partId).
 * Orphany (zły/brak partId) nie wiszą pod Partem → nie mogą trafić do JSON / CAD.
 * Bez „dedupe geometrii” — to maskowało błąd zapisu.
 */
import { describe, it, expect } from 'vitest';
import {
    cutsOwnedByLiveParts,
    normalizeSmartPartToCadCoords,
    orphanSmartPartCuts,
    type SmartPartPackageDefinition,
} from '../../S5_studio/index.js';
import { smartPartCutsForPart, smartPartBodies } from '../hangers/hanger-apply.js';

function basePkg(cuts: SmartPartPackageDefinition['cuts']): SmartPartPackageDefinition {
    return {
        id: 'sp:Test',
        name: 'Test',
        units: 'mm',
        version: '1.0',
        type: 'CUSTOM',
        cutsFrame: 'PART',
        coordSystem: 'CAD',
        mainContainer: { widthMm: 600, heightMm: 600, depthMm: 330 },
        parts: [
            {
                id: 'part_1', name: 'Part 1', widthMm: 18, heightMm: 38, depthMm: 68,
                xMm: -272, yMm: 0, zMm: 270, refX: 'LEFT', colorHex: '#38bdf8',
            },
            {
                id: 'part_2', name: 'Part 2', widthMm: 18, heightMm: 38, depthMm: 68,
                xMm: 272, yMm: 0, zMm: 0, refX: 'RIGHT', colorHex: '#10b981',
            },
        ],
        cuts,
        updatedAt: 0,
    };
}

describe('cutsOwnedByLiveParts — zapis 1:1 z drzewem Studio', () => {
    it('zostawia tylko cuts z żywym partId (jak w drzewie pod Partami)', () => {
        const def = basePkg([
            {
                id: 'w1', name: 'Walec 1', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                xMm: -9, yMm: 0, zMm: 0, axis: 'X', direction: -1, partId: 'part_1',
            },
            {
                id: 'w2', name: 'Walec 2', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                xMm: -9, yMm: 16, zMm: 0, axis: 'X', direction: -1, partId: 'part_1',
            },
            {
                id: 'ghost', name: 'Ghost', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                xMm: -9, yMm: 0, zMm: 0, axis: 'X', direction: -1,
                partId: 'sp:Deleted/part:old', // nie ma w parts → niewidoczny w drzewie
            },
            {
                id: 'wR', name: 'Walec R', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                xMm: 9, yMm: 0, zMm: 0, axis: 'X', direction: 1, partId: 'part_2',
            },
        ]);

        expect(orphanSmartPartCuts(def)).toHaveLength(1);
        expect(orphanSmartPartCuts(def)[0].id).toBe('ghost');

        const owned = cutsOwnedByLiveParts(def);
        expect(owned).toHaveLength(3);
        expect(owned.map((c) => c.id).sort()).toEqual(['w1', 'w2', 'wR']);

        const normalized = normalizeSmartPartToCadCoords(def);
        const bodies = smartPartBodies(normalized);
        expect(smartPartCutsForPart(normalized, bodies[0].id, 0)).toHaveLength(2);
        expect(smartPartCutsForPart(normalized, bodies[1].id, 1)).toHaveLength(1);
        // ghost NIE wraca na Part1 przez „dedupe” ani zgadywanie geometrii
        expect(normalized.cuts.some((c) => c.id === 'ghost')).toBe(false);
    });

    it('nie usuwa dwóch różnych walców na tym samym Partie (to nie są duplikaty do kasowania)', () => {
        const def = normalizeSmartPartToCadCoords(basePkg([
            {
                id: 'w1', name: 'Walec 1', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                xMm: -9, yMm: 0, zMm: 0, axis: 'X', direction: -1, partId: 'part_1',
            },
            {
                id: 'w2', name: 'Walec 2', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                xMm: -9, yMm: 16, zMm: 0, axis: 'X', direction: -1, partId: 'part_1',
            },
        ]));
        expect(def.cuts).toHaveLength(2);
    });

    it('cut bez partId przy multi-part jest orphanem (nie dokleja do Part1)', () => {
        const def = basePkg([
            {
                id: 'orphan', name: 'Orphan', type: 'HOLE', diameterMm: 8, lengthMm: 24,
                xMm: 0, yMm: 0, zMm: 0, axis: 'X', direction: 1,
            },
        ]);
        expect(orphanSmartPartCuts(def)).toHaveLength(1);
        expect(cutsOwnedByLiveParts(def)).toHaveLength(0);
        expect(normalizeSmartPartToCadCoords(def).cuts).toHaveLength(0);
    });
});
