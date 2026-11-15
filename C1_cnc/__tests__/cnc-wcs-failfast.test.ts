import { describe, it, expect } from 'vitest';
import {
    isWcsConfigChanged,
    recalculateProgramWcsOrThrow,
    persistProgramInPanel
} from '../ui/cnc-program-persistence.js';
import { CNCProgramState } from '../core/cam-state-store.js';
import { WcsManager } from '../wcs/wcs-manager.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';

describe('C1_CNC: WCS Recalculation Fail-Fast & Consistency', () => {
    const validPanel: any = {
        id: 'panel_valid_wcs',
        name: 'Bok Lewy',
        role: 'LEFT_SIDE_PANEL',
        width: mmToNm(600),
        height: mmToNm(800),
        thickness: mmToNm(18),
        features: []
    };

    const initialProgram: CNCProgramState = {
        id: 'prog_test_1',
        name: 'Program 1',
        targetPanel: validPanel,
        targetPanelId: 'panel_valid_wcs',
        wcsName: 'G55',
        cornerIndex: 0,
        wcsOffsetX: 0,
        wcsOffsetY: 0,
        wcsOffsetZ: 0,
        wcsRotX: 0,
        wcsRotY: 0,
        wcsRotZ: 0,
        postprocessor: 'Mach3',
        isActive: true,
        features: [
            {
                featureId: 'hole_1',
                name: 'Otwór 1',
                diameter: 5,
                depth: 13,
                face: 'FACE_Z_PLUS',
                position: { x: 50, y: 100, z: 0 },
                panelPosition: { x: -250, y: -300, z: 9 }
            } as any
        ],
        toolAssignments: {}
    };

    it('isWcsConfigChanged poprawnie identyfikuje zmiany parametrów bazy WCS', () => {
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram })).toBe(false);
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram, cornerIndex: 1 })).toBe(true);
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram, wcsOffsetX: 10 })).toBe(true);
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram, wcsOffsetY: -5 })).toBe(true);
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram, wcsOffsetZ: 2 })).toBe(true);
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram, wcsRotX: 90 })).toBe(true);
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram, wcsRotY: 45 })).toBe(true);
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram, wcsRotZ: 180 })).toBe(true);
        expect(isWcsConfigChanged(initialProgram, { ...initialProgram, wcsName: 'G54' })).toBe(true);
    });

    it('recalculateProgramWcsOrThrow przelicza współrzędne przy poprawnej zmianie WCS', () => {
        const next: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 1 // zmiana naroża
        };

        const result = recalculateProgramWcsOrThrow(initialProgram, next, validPanel);
        expect(result.cornerIndex).toBe(1);
        expect(result.features).toHaveLength(1);
        // Współrzędne ulegają rekalkulacji dla nowego naroża
        expect((result.features[0] as any).position.x).not.toBe((initialProgram.features[0] as any).position.x);
    });

    it('FAIL-FAST: rzuca wyjątek i NIE zwraca niespójnego stanu gdy formatka jest uszkodzona lub brak referencji', () => {
        const invalidPanel = {
            id: 'panel_broken',
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: 0 // niepoprawna grubość
        };

        const next: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 2
        };

        // Musi rzucić błąd — fail fast przy błędnych wymiarach
        expect(() => recalculateProgramWcsOrThrow(initialProgram, next, invalidPanel)).toThrow(/poprawnych wymiarów fizycznych/);

        // Dla braku panelu (panel === null lub undefined) również natychmiast rzuca fail-fast
        expect(() => recalculateProgramWcsOrThrow(initialProgram, next, null)).toThrow(/Brak referencji do formatki/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, next, undefined)).toThrow(/Brak referencji do formatki/);
    });

    it('FAIL-FAST: rzuca wyjątek gdy wymiary formatki zawierają NaN lub Infinity', () => {
        const next: CNCProgramState = { ...initialProgram, cornerIndex: 2 };
        expect(() => recalculateProgramWcsOrThrow(initialProgram, next, { ...validPanel, width: NaN })).toThrow(/poprawnych wymiarów fizycznych/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, next, { ...validPanel, height: Infinity })).toThrow(/poprawnych wymiarów fizycznych/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, next, { ...validPanel, thickness: -Infinity })).toThrow(/poprawnych wymiarów fizycznych/);
    });

    it('recalculateProgramWcsOrThrow przelicza współrzędne kieszeni (PocketFeature) przy zmianie WCS', () => {
        const pocketProg: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 0,
            features: [
                {
                    featureId: 'pocket_test_1',
                    name: 'Kieszeń 1',
                    width: 50,
                    length: 100,
                    depth: 10,
                    boundaryPoints: [
                        { x: 10, y: 20, z: 0 },
                        { x: 60, y: 20, z: 0 },
                        { x: 60, y: 120, z: 0 },
                        { x: 10, y: 120, z: 0 }
                    ],
                    panelBoundaryPoints: [
                        { x: -290, y: -380, z: 9 },
                        { x: -240, y: -380, z: 9 },
                        { x: -240, y: -280, z: 9 },
                        { x: -290, y: -280, z: 9 }
                    ]
                } as any
            ]
        };

        const next: CNCProgramState = {
            ...pocketProg,
            cornerIndex: 1 // zmiana naroża
        };

        const result = recalculateProgramWcsOrThrow(pocketProg, next, validPanel);
        expect(result.cornerIndex).toBe(1);
        expect(result.features).toHaveLength(1);
        const transformedPocket = result.features[0] as any;
        expect(transformedPocket.boundaryPoints).toBeDefined();
        expect(transformedPocket.boundaryPoints).toHaveLength(4);
        // Punkty boundaryPoints muszą ulec przeliczeniu do nowego WCS
        expect(transformedPocket.boundaryPoints[0].x).not.toBe((pocketProg.features[0] as any).boundaryPoints[0].x);
        // Punkty lokalne panelBoundaryPoints muszą pozostać nienaruszone
        expect(transformedPocket.panelBoundaryPoints[0]).toEqual((pocketProg.features[0] as any).panelBoundaryPoints[0]);
    });

    it('FAIL-FAST: rzuca wyjątek gdy cornerIndex jest nieprawidłowy (spoza 0..7, niecałkowity lub niepoprawnego typu)', () => {
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: 8 }, validPanel)).toThrow(/Indeks naroża WCS/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: 2.5 }, validPanel)).toThrow(/Indeks naroża WCS/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: -2 }, validPanel)).toThrow(/Indeks naroża WCS/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: 100 }, validPanel)).toThrow(/Indeks naroża WCS/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: "2" as any }, validPanel)).toThrow(/Indeks naroża WCS/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: null as any }, validPanel)).toThrow(/Indeks naroża WCS/);
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: {} as any }, validPanel)).toThrow(/Indeks naroża WCS/);

        // cornerIndex -1 oraz 0..7 są dozwolone
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: -1 }, validPanel)).not.toThrow();
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: 0 }, validPanel)).not.toThrow();
        expect(() => recalculateProgramWcsOrThrow(initialProgram, { ...initialProgram, cornerIndex: 7 }, validPanel)).not.toThrow();
    });

    it('FAIL-FAST: rzuca wyjątek i nie dopuszcza do zapisu gdy cecha wygeneruje nieprawidłowe współrzędne lub wektory kierunku (axis / normal)', () => {
        const programWithCorruptedPos: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 2,
            features: [
                {
                    featureId: 'corrupted_hole_pos',
                    position: { x: NaN, y: 100, z: 0 },
                    panelPosition: { x: NaN, y: 100, z: 0 }
                } as any
            ]
        };
        expect(() => recalculateProgramWcsOrThrow(initialProgram, programWithCorruptedPos, validPanel)).toThrow(/Nieprawidłowe współrzędne po transformacji WCS/);

        // Test uszkodzonego wektora axis w otworze
        const programWithCorruptedAxis: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 2,
            features: [
                {
                    featureId: 'corrupted_hole_axis',
                    position: { x: 50, y: 100, z: 0 },
                    panelPosition: { x: -250, y: -300, z: 9 },
                    axis: { x: NaN, y: 0, z: 1 },
                    panelAxis: { x: NaN, y: 0, z: 1 }
                } as any
            ]
        };
        expect(() => recalculateProgramWcsOrThrow(initialProgram, programWithCorruptedAxis, validPanel)).toThrow(/Nieprawidłowe współrzędne po transformacji WCS \(hole axis/);

        // Test uszkodzonego wektora normal w kieszonce
        const programWithCorruptedNormal: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 2,
            features: [
                {
                    featureId: 'corrupted_pocket_normal',
                    boundaryPoints: [{ x: 10, y: 20, z: 0 }],
                    panelBoundaryPoints: [{ x: -290, y: -380, z: 9 }],
                    normal: { x: 0, y: Infinity, z: 1 },
                    panelNormal: { x: 0, y: Infinity, z: 1 }
                } as any
            ]
        };
        expect(() => recalculateProgramWcsOrThrow(initialProgram, programWithCorruptedNormal, validPanel)).toThrow(/Nieprawidłowe współrzędne po transformacji WCS \(pocket normal/);

        // Test wektora zerowego dla osi otworu (axis)
        const programWithZeroAxis: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 2,
            features: [
                {
                    featureId: 'zero_hole_axis',
                    position: { x: 50, y: 100, z: 0 },
                    panelPosition: { x: -250, y: -300, z: 9 },
                    axis: { x: 0, y: 0, z: 0 },
                    panelAxis: { x: 0, y: 0, z: 0 }
                } as any
            ]
        };
        expect(() => recalculateProgramWcsOrThrow(initialProgram, programWithZeroAxis, validPanel)).toThrow(/Wektor kierunku nie może być zerowy ani bliski zeru \(hole axis/);

        // Test wektora zerowego dla normalnej konturu (normal)
        const programWithZeroNormal: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 2,
            features: [
                {
                    featureId: 'zero_contour_normal',
                    points: [{ x: 10, y: 20, z: 0 }],
                    panelPoints: [{ x: -290, y: -380, z: 9 }],
                    normal: { x: 0, y: 0, z: 0 },
                    panelNormal: { x: 0, y: 0, z: 0 }
                } as any
            ]
        };
        expect(() => recalculateProgramWcsOrThrow(initialProgram, programWithZeroNormal, validPanel)).toThrow(/Wektor kierunku nie może być zerowy ani bliski zeru \(contour normal/);
    });

    it('IZOLACJA: nie mutuje współdzielonego WcsManager w razie błędu podczas przeliczania lub walidacji punktów', () => {
        const activeWcs = new WcsManager('G55');
        activeWcs.setManualOffset({ x: 0, y: 0, z: 0 });

        // Scenariusz: formatka jest w 100% poprawna geometrycznie, ale cecha obróbcza
        // ma uszkodzone współrzędne i powoduje awarię podczas walidacji przeliczonych punktów.
        // WcsManager tymczasowy zdążył już przyjąć nowe naroże i offsety, ale współdzielony
        // activeWcs nie może zostać zaktualizowany!
        const programFailingInTransform: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 3,
            wcsName: 'G59_REJECTED',
            wcsOffsetX: 999,
            features: [
                {
                    featureId: 'broken_pos_hole',
                    position: { x: NaN, y: 0, z: 0 },
                    panelPosition: { x: NaN, y: 0, z: 0 }
                } as any
            ]
        };

        expect(() => recalculateProgramWcsOrThrow(initialProgram, programFailingInTransform, validPanel, activeWcs)).toThrow(/Nieprawidłowe współrzędne/);

        // Kluczowa weryfikacja izolacji: aktywny manager zachowuje nienaruszony stan
        expect(activeWcs.getWcsName()).toBe('G55');
        expect(activeWcs.getOrigin().x).toBe(0);

        // Po podaniu w pełni poprawnego programu sukces aktualizuje aktywny manager
        const validNext: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 1,
            wcsName: 'G56_ACCEPTED',
            wcsOffsetX: 50
        };
        const successResult = recalculateProgramWcsOrThrow(initialProgram, validNext, validPanel, activeWcs);
        expect(successResult.wcsName).toBe('G56_ACCEPTED');
        expect(activeWcs.getWcsName()).toBe('G56_ACCEPTED');
    });

    it('FAIL-FAST: nie zapisuje niespójnego WCS do formatki docelowej w razie wyjątku', () => {
        const panel: any = {
            id: 'panel_stored',
            width: mmToNm(600),
            height: mmToNm(800),
            thickness: 0, // uszkodzona formatka
            cncPrograms: [{ ...initialProgram }]
        };

        const draftWithNewWcs: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 5,
            wcsOffsetX: 120
        };

        let updatedSaved = false;
        try {
            const calculated = recalculateProgramWcsOrThrow(initialProgram, draftWithNewWcs, panel);
            persistProgramInPanel(panel, calculated);
            updatedSaved = true;
        } catch {
            // błąd został rzucony, nie zapisujemy draftu
        }

        expect(updatedSaved).toBe(false);
        // Formatka w cncPrograms MUSI zachować poprzedni, nienaruszony program!
        expect(panel.cncPrograms[0].cornerIndex).toBe(0);
        expect(panel.cncPrograms[0].wcsOffsetX).toBe(0);
        expect((panel.cncPrograms[0].features[0] as any).position).toEqual((initialProgram.features[0] as any).position);
    });

    it('przelicza normal w ContourFeature przy zmianie WCS (np. obrót) i zachowuje lokalny panelNormal', () => {
        const contourProg: CNCProgramState = {
            ...initialProgram,
            wcsRotX: 0,
            features: [
                {
                    featureId: 'contour_1',
                    points: [
                        { x: 10, y: 10, z: 0 },
                        { x: 50, y: 10, z: 0 },
                        { x: 50, y: 50, z: 0 }
                    ],
                    panelPoints: [
                        { x: 10, y: 10, z: 0 },
                        { x: 50, y: 10, z: 0 },
                        { x: 50, y: 50, z: 0 }
                    ],
                    normal: { x: 0, y: 0, z: 1 },
                    panelNormal: { x: 0, y: 0, z: 1 }
                } as any
            ]
        };

        const nextWithRot: CNCProgramState = {
            ...contourProg,
            wcsRotX: 180 // obrót o 180 wokół X odwraca wektor Z: (0, 0, 1) -> (0, 0, -1)
        };

        const result = recalculateProgramWcsOrThrow(contourProg, nextWithRot, validPanel);
        const transformedContour = result.features[0] as any;

        expect(transformedContour.normal).toBeDefined();
        expect(transformedContour.normal.z).toBeCloseTo(-1, 5);
        // Lokalny panelNormal musi pozostać niezmieniony: (0, 0, 1)
        expect(transformedContour.panelNormal).toEqual({ x: 0, y: 0, z: 1 });

        // Kolejne przeliczenie (powrót do 0) z zachowanego panelNormal
        const nextReset: CNCProgramState = {
            ...result,
            wcsRotX: 0
        };
        const resultReset = recalculateProgramWcsOrThrow(result, nextReset, validPanel);
        const resetContour = resultReset.features[0] as any;
        expect(resetContour.normal.z).toBeCloseTo(1, 5);
        expect(resetContour.panelNormal).toEqual({ x: 0, y: 0, z: 1 });
    });

    it('przelicza depth (panelDepth) oraz segments (panelSegments) w ContourFeature przy zmianie WCS', () => {
        const contourProg: CNCProgramState = {
            ...initialProgram,
            cornerIndex: 0,
            wcsOffsetZ: 0,
            features: [
                {
                    featureId: 'cutout_with_segments',
                    points: [
                        { x: 50, y: 50, z: 18 },
                        { x: 150, y: 50, z: 18 }
                    ],
                    panelPoints: [
                        { x: -250, y: -350, z: 9 },
                        { x: -150, y: -350, z: 9 }
                    ],
                    depth: 0,
                    panelDepth: -9,
                    segments: [
                        {
                            type: 'ARC',
                            start: { x: 50, y: 50, z: 18 },
                            end: { x: 150, y: 50, z: 18 },
                            center: { x: 100, y: 50, z: 18 },
                            radius: 50,
                            direction: 'CCW',
                            plane: 'XY'
                        }
                    ],
                    panelSegments: [
                        {
                            type: 'ARC',
                            start: { x: -250, y: -350, z: 9 },
                            end: { x: -150, y: -350, z: 9 },
                            center: { x: -200, y: -350, z: 9 },
                            radius: 50,
                            direction: 'CCW',
                            plane: 'XY'
                        }
                    ],
                    normal: { x: 0, y: 0, z: 1 },
                    panelNormal: { x: 0, y: 0, z: 1 }
                } as any
            ]
        };

        // Przesunięcie bazy WCS o +10 mm w Z oraz +20 mm w X
        const nextProg: CNCProgramState = {
            ...contourProg,
            wcsOffsetX: 20,
            wcsOffsetZ: 10
        };

        const result = recalculateProgramWcsOrThrow(contourProg, nextProg, validPanel);
        const updatedContour = result.features[0] as any;

        // Różnica między powierzchnią (points[0].z) a dnem (depth) musi pozostać równa 18 mm
        expect(Math.abs(updatedContour.points[0].z - updatedContour.depth)).toBeCloseTo(18, 5);
        expect(updatedContour.panelDepth).toBe(-9);

        // Segment analityczny również został przetransformowany do nowego WCS
        expect(updatedContour.segments).toHaveLength(1);
        expect(updatedContour.segments[0].start.x).not.toBe(50);
        expect(updatedContour.segments[0].start.z).toBeCloseTo(updatedContour.points[0].z, 5);
        expect(updatedContour.panelSegments[0].start).toEqual({ x: -250, y: -350, z: 9 });
    });
});
