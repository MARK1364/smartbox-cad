import { describe, it, expect } from 'vitest';
import { formatFaceLabels, findFacesAlongRay } from '../quick-pick/quick-pick-detector.js';

describe('QuickPick — formatFaceLabels', () => {
    it('poprawnie formatuje etykiety kanoniczne i skróty osi', () => {
        const fzPlus = formatFaceLabels('FACE_Z_PLUS');
        expect(fzPlus.badge).toBe('+Z');
        expect(fzPlus.label).toContain('Front');

        const fzMinus = formatFaceLabels('FACE_Z_MINUS');
        expect(fzMinus.badge).toBe('-Z');
        expect(fzMinus.label).toContain('Tył');

        const fyPlus = formatFaceLabels('FACE_Y_PLUS');
        expect(fyPlus.badge).toBe('+Y');
        expect(fyPlus.label).toContain('Góra');

        const fyMinus = formatFaceLabels('FACE_Y_MINUS');
        expect(fyMinus.badge).toBe('-Y');
        expect(fyMinus.label).toContain('Dół');

        const fxPlus = formatFaceLabels('FACE_X_PLUS');
        expect(fxPlus.badge).toBe('+X');
        expect(fxPlus.label).toContain('Prawa');

        const fxMinus = formatFaceLabels('FACE_X_MINUS');
        expect(fxMinus.badge).toBe('-X');
        expect(fxMinus.label).toContain('Lewa');
    });

    it('poprawnie normalizuje aliasy legacy (front, back, left, top)', () => {
        expect(formatFaceLabels('front').badge).toBe('+Z');
        expect(formatFaceLabels('back').badge).toBe('-Z');
        expect(formatFaceLabels('top').badge).toBe('+Y');
        expect(formatFaceLabels('bottom').badge).toBe('-Y');
        expect(formatFaceLabels('left').badge).toBe('-X');
        expect(formatFaceLabels('right').badge).toBe('+X');
    });
});

describe('QuickPick — findFacesAlongRay', () => {
    it('zwraca pustą listę gdy brak sceny lub brak trafień', () => {
        expect(findFacesAlongRay(null, 100, 100)).toEqual([]);
        const emptyScene = {
            multiPick: () => [],
        };
        expect(findFacesAlongRay(emptyScene, 100, 100)).toEqual([]);
    });

    it('sortuje płaszczyzny rosnąco wg dystansu i oznacza zakryte (isObscured)', () => {
        const mockPanel1 = { id: 'p1', name: 'Bok lewy' };
        const mockPanel2 = { id: 'p2', name: 'Półka 1' };

        const meshFront = {
            uniqueId: 101,
            isEnabled: () => true,
            metadata: { faceName: 'FACE_Z_PLUS', panelModel: mockPanel1, smartId: 'p1' },
        };
        const meshBack = {
            uniqueId: 102,
            isEnabled: () => true,
            metadata: { faceName: 'FACE_Z_MINUS', panelModel: mockPanel1, smartId: 'p1' },
        };
        const meshShelf = {
            uniqueId: 201,
            isEnabled: () => true,
            metadata: { faceName: 'FACE_Y_PLUS', panelModel: mockPanel2, smartId: 'p2' },
        };

        const mockScene = {
            multiPick: (_x: number, _y: number, predicate: Function) => {
                const raw = [
                    { hit: true, distance: 1218, pickedMesh: meshBack, pickedPoint: { x: 0, y: 0, z: 1218 } },
                    { hit: true, distance: 1200, pickedMesh: meshFront, pickedPoint: { x: 0, y: 0, z: 1200 } },
                    { hit: true, distance: 1450, pickedMesh: meshShelf, pickedPoint: { x: 0, y: 0, z: 1450 } },
                ];
                return raw.filter((r) => predicate(r.pickedMesh));
            },
        };

        const candidates = findFacesAlongRay(mockScene, 200, 300);

        expect(candidates).toHaveLength(3);

        // #1 Front (najbliższa)
        expect(candidates[0].index).toBe(0);
        expect(candidates[0].panelName).toBe('Bok lewy');
        expect(candidates[0].faceName).toBe('FACE_Z_PLUS');
        expect(candidates[0].distanceMm).toBe(1200);
        expect(candidates[0].isObscured).toBe(false);

        // #2 Tył (zakryta o grubość 18mm)
        expect(candidates[1].index).toBe(1);
        expect(candidates[1].panelName).toBe('Bok lewy');
        expect(candidates[1].faceName).toBe('FACE_Z_MINUS');
        expect(candidates[1].distanceMm).toBe(1218);
        expect(candidates[1].deltaDistanceMm).toBe(18);
        expect(candidates[1].isObscured).toBe(true);

        // #3 Półka (wewnątrz korpusu)
        expect(candidates[2].index).toBe(2);
        expect(candidates[2].panelName).toBe('Półka 1');
        expect(candidates[2].faceName).toBe('FACE_Y_PLUS');
        expect(candidates[2].distanceMm).toBe(1450);
        expect(candidates[2].deltaDistanceMm).toBe(232);
        expect(candidates[2].isObscured).toBe(true);
    });

    it('deduplikuje wielokrotne trafienia w tę samą ścianę formatki', () => {
        const mockPanel = { id: 'p1', name: 'Front meblowy' };
        const meshFront = {
            uniqueId: 101,
            isEnabled: () => true,
            metadata: { faceName: 'FACE_Z_PLUS', panelModel: mockPanel, smartId: 'p1' },
        };

        const mockScene = {
            multiPick: (_x: number, _y: number, predicate: Function) => {
                const raw = [
                    { hit: true, distance: 1000, pickedMesh: meshFront, pickedPoint: { x: 0, y: 0, z: 1000 } },
                    { hit: true, distance: 1001, pickedMesh: meshFront, pickedPoint: { x: 1, y: 0, z: 1001 } },
                ];
                return raw.filter((r) => predicate(r.pickedMesh));
            },
        };

        const candidates = findFacesAlongRay(mockScene, 200, 300);
        expect(candidates).toHaveLength(1);
        expect(candidates[0].distanceMm).toBe(1000);
    });
});
