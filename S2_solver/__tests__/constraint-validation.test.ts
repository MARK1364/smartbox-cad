/**
 * Testy walidacji więzów przed dragiem i solve.
 */

import { describe, it, expect } from 'vitest';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { makeAnchor, makeSolverConstraint } from '../constraint-types.js';
import { validateConstraints } from '../constraint-validation.js';

describe('validateConstraints', () => {
    it('odrzuca wiązanie korpusu z samym sobą', () => {
        const result = validateConstraints([
            makeSolverConstraint({
                id: 'self',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                anchorB: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
            }),
        ]);
        expect(result.skipIds.has('self')).toBe(true);
        expect(result.issues.some((i) => i.code === 'SELF_BIND')).toBe(true);
    });

    it('odrzuca drugi GROUND na tym samym korpusie', () => {
        const result = validateConstraints([
            makeSolverConstraint({
                id: 'g1',
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'OBJECT' }),
            }),
            makeSolverConstraint({
                id: 'g2',
                bindType: 'GROUND',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
            }),
        ]);
        expect(result.skipIds.has('g1')).toBe(false);
        expect(result.skipIds.has('g2')).toBe(true);
        expect(result.issues.some((i) => i.code === 'DUPLICATE_GROUND')).toBe(true);
    });

    it('odrzuca duplikat VERTEX na tych samych narożnikach', () => {
        const result = validateConstraints([
            makeSolverConstraint({
                id: 'v1',
                bindType: 'VERTEX',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'VERTEX', cornerIndex: 0 }),
                anchorB: makeAnchor({ nodeId: 'b', kind: 'VERTEX', cornerIndex: 1 }),
            }),
            makeSolverConstraint({
                id: 'v2',
                bindType: 'VERTEX',
                anchorA: makeAnchor({ nodeId: 'b', kind: 'VERTEX', cornerIndex: 1 }),
                anchorB: makeAnchor({ nodeId: 'a', kind: 'VERTEX', cornerIndex: 0 }),
            }),
        ]);
        expect(result.skipIds.has('v2')).toBe(true);
        expect(result.issues.some((i) => i.code === 'DUPLICATE_VERTEX')).toBe(true);
    });

    it('dwa COPLANAR na różnych ścianach tej samej pary są poprawne', () => {
        const result = validateConstraints([
            makeSolverConstraint({
                id: 'front',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                anchorB: makeAnchor({ nodeId: 'b', kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
            }),
            makeSolverConstraint({
                id: 'bottom',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
                anchorB: makeAnchor({ nodeId: 'b', kind: 'FACE', faceName: 'FACE_Z_MINUS' }),
            }),
        ]);
        expect(result.skipIds.size).toBe(0);
    });

    it('COPLANAR i FLUSH na tych samych ścianach — ostrzeżenie o kierunku', () => {
        const result = validateConstraints([
            makeSolverConstraint({
                id: 'c',
                bindType: 'COPLANAR',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                anchorB: makeAnchor({ nodeId: 'b', kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
            }),
            makeSolverConstraint({
                id: 'f',
                bindType: 'FLUSH',
                anchorA: makeAnchor({ nodeId: 'a', kind: 'FACE', faceName: 'FACE_Y_MINUS' }),
                anchorB: makeAnchor({ nodeId: 'b', kind: 'FACE', faceName: 'FACE_Y_PLUS' }),
            }),
        ]);
        expect(result.issues.some((i) => i.code === 'PLANE_DIRECTION_CONFLICT')).toBe(true);
    });

    it('zregenerowana formatka daje ostrzeżenie, ale więz zostaje aktywny', () => {
        const document = new ProjectDocument();
        const cabA = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const cabB = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });

        const result = validateConstraints(
            [
                makeSolverConstraint({
                    id: 'front',
                    bindType: 'COPLANAR',
                    anchorA: makeAnchor({
                        nodeId: cabA.id,
                        kind: 'FACE',
                        faceName: 'FACE_Z_PLUS',
                        sourceNodeId: 'formatka_po_regeneracji',
                        localPointMm: [0, -250, 360],
                        localNormalMm: [0, -1, 0],
                    }),
                    anchorB: makeAnchor({
                        nodeId: cabB.id,
                        kind: 'FACE',
                        faceName: 'FACE_Y_MINUS',
                    }),
                }),
            ],
            document,
        );

        expect(result.skipIds.size).toBe(0);
        const stale = result.issues.filter((i) => i.code === 'STALE_SOURCE');
        expect(stale).toHaveLength(1);
        expect(stale[0].severity).toBe('warning');
    });

    it('pomija szkice bez kotwic — nie są błędami', () => {
        const result = validateConstraints([
            makeSolverConstraint({ id: 'draft', bindType: 'COPLANAR' }),
        ]);
        expect(result.skipIds.size).toBe(0);
        expect(result.issues).toHaveLength(0);
    });

    it('nierównoległe płaszczyzny — ostrzeżenie, więz zostaje aktywny', () => {
        const document = new ProjectDocument();
        const cabA = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const cabB = document.createContainer({
            width: mmToNm(600),
            height: mmToNm(720),
            depth: mmToNm(500),
        });
        const result = validateConstraints(
            [
                makeSolverConstraint({
                    id: 'skew',
                    bindType: 'COPLANAR',
                    anchorA: makeAnchor({
                        nodeId: cabA.id,
                        kind: 'FACE',
                        faceName: 'FACE_Z_MINUS',
                        localPointMm: [0, 0, 0],
                        localNormalMm: [0, 0, -1],
                    }),
                    anchorB: makeAnchor({
                        nodeId: cabB.id,
                        kind: 'FACE',
                        faceName: 'FACE_Y_MINUS',
                        localPointMm: [0, -250, 360],
                        localNormalMm: [0, -1, 0],
                    }),
                }),
            ],
            document,
        );
        expect(result.skipIds.size).toBe(0);
        expect(result.issues.some((i) => i.code === 'NON_PARALLEL_PLANES')).toBe(true);
    });
});
