import { describe, expect, it } from 'vitest';
import { ContainerView } from '../container-view.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('ContainerView — Sloped Wireframe', () => {
    it('detects sloped dimensions from detectedBay on Bloki container', () => {
        const container = new ContainerModel({
            name: 'Blok Drzwi Skosne',
            width: mmToNm(800),
            height: mmToNm(2200),
            depth: mmToNm(600)
        });
        container.generatorParams = {
            type: 'blok_drzwi_skosne',
            detectedBay: {
                boundsMm: { width: 800, height: 2200, depth: 600 },
                boundsNm: { width: mmToNm(800), height: mmToNm(2200), depth: mmToNm(600) },
                centerWorldMm: { x: 0, y: 0, z: 1100 },
                roofAngleDeg: -25,
                heightLeftMm: 2200,
                heightRightMm: 1400,
                boundary: {
                    left: {} as any,
                    right: {} as any,
                    bottom: {} as any,
                    top: { slopeAngleDeg: -25 } as any,
                    back: {} as any,
                    front: {} as any,
                    frontPlaneYMm: 0
                }
            }
        };

        const view = new ContainerView({} as any, container);
        const slopedInfo = view._getSlopedInfo();

        expect(slopedInfo).not.toBeNull();
        expect(slopedInfo!.isSloped).toBe(true);
        expect(slopedInfo!.yTopLeft).toBe(2200);
        expect(slopedInfo!.yTopRight).toBe(1400);
    });

    it('returns null for standard rectangular container', () => {
        const container = new ContainerModel({
            name: 'Standard Box',
            width: mmToNm(800),
            height: mmToNm(2000),
            depth: mmToNm(600)
        });
        container.generatorParams = {
            type: 'korpus3_2',
            liczba_stref: 1
        };

        const view = new ContainerView({} as any, container);
        const slopedInfo = view._getSlopedInfo();

        expect(slopedInfo).toBeNull();
    });

    it('detects sloped dimensions for korpus_skosny_lr cabinet', () => {
        const container = new ContainerModel({
            name: 'Szafka Skosna LR',
            width: mmToNm(900),
            height: mmToNm(2400),
            depth: mmToNm(550)
        });
        container.generatorParams = {
            typ_korpusu: 'korpus_skosny_lr',
            wysokosc_lewy_mm: 1200,
            wysokosc_prawy_mm: 2400
        };

        const view = new ContainerView({} as any, container);
        const slopedInfo = view._getSlopedInfo();

        expect(slopedInfo).not.toBeNull();
        expect(slopedInfo!.isSloped).toBe(true);
        expect(slopedInfo!.yTopLeft).toBe(1200);
        expect(slopedInfo!.yTopRight).toBe(2400);
    });

    it('creates sloped vertex data with 8 vertices and 6 faces with sloped top', () => {
        const prevBabylon = (globalThis as any).BABYLON;
        (globalThis as any).BABYLON = {
            VertexData: class {
                positions: number[] = [];
                indices: number[] = [];
                normals: number[] = [];
                static ComputeNormals(pos: number[], ind: number[], norm: number[]) {
                    norm.push(...new Array(pos.length).fill(0));
                }
            }
        };

        try {
            const view = Object.create(ContainerView.prototype);
            const vData = view._createSlopedVertexData(800, 600, {
                yTopLeft: 1400,
                yTopRight: 2000
            });

            expect(vData).not.toBeNull();
            expect(vData!.positions.length).toBe(24); // 8 wierzchołków * 3 współrzędne
            expect(vData!.indices.length).toBe(36);   // 12 trójkątów * 3

            // Sprawdzenie wierzchołków Y:
            // Wierzchołki dolne mają Y = 0
            expect(vData!.positions[1]).toBe(0); // 0 (front-left-bottom)
            expect(vData!.positions[4]).toBe(0); // 1 (front-right-bottom)
            // Wierzchołki górne:
            expect(vData!.positions[7]).toBe(2000); // 2 (front-right-top) Y
            expect(vData!.positions[10]).toBe(1400); // 3 (front-left-top) Y
            expect(vData!.positions[19]).toBe(2000); // 6 (back-right-top) Y
            expect(vData!.positions[22]).toBe(1400); // 7 (back-left-top) Y
        } finally {
            (globalThis as any).BABYLON = prevBabylon;
        }
    });
});
