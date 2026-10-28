import { describe, it, expect, beforeEach } from 'vitest';
import {
    listSmartPartPackages,
    saveSmartPartPackage,
    deleteSmartPartPackage,
    importSmartPartPackageJson,
    DEFAULT_HANGER_SMARTPART,
    SMARTPARTS_STORAGE_KEY,
    allocSmartPartPackageId,
    allocSmartPartBodyId,
    allocSmartPartCutId,
    calculateCutProtrusion,
    computeAbsoluteFromReference,
    computeReferenceFromAbsolute,
    type SmartPartPackageDefinition,
    type SmartPartHoleCut,
    type SmartPartPocketCut,
} from '../index.js';

describe('A5_smartparts / studio — Czysta Geometria SmartParts (Kontener, Okucie, Cięcia)', () => {
    beforeEach(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(SMARTPARTS_STORAGE_KEY);
        }
    });

    it('zwraca domyślny wzorzec SmartParta (czysta geometria, units === mm, bez producentów)', () => {
        const packages = listSmartPartPackages();
        expect(packages.length).toBeGreaterThanOrEqual(1);

        const hanger = packages.find((p) => p.id === 'smartpart_wzorzec_1');
        expect(hanger).toBeDefined();
        expect(hanger?.units).toBe('mm');
        expect(hanger?.mainContainer.widthMm).toBe(564);
        expect(hanger?.mainContainer.heightMm).toBe(600);
        expect(hanger?.mainContainer.depthMm).toBe(330);
        expect(hanger?.parts.length).toBe(1);
        expect(hanger?.cuts.length).toBe(3);
    });

    it('obsługuje dowolną liczbę części (parts: 1, 2, 100 sztuk)', () => {
        const multiPartDef: SmartPartPackageDefinition = {
            id: 'smartpart_multi_test',
            name: 'Akcesorium Złożone',
            units: 'mm',
            version: '1.0',
            type: 'CUSTOM',
            mainContainer: { widthMm: 100, heightMm: 100, depthMm: 100 },
            parts: Array.from({ length: 10 }, (_, i) => ({
                id: `part_${i + 1}`,
                name: `Część ${i + 1}`,
                widthMm: 10,
                heightMm: 20,
                depthMm: 30,
                xMm: i * 5,
                yMm: 0,
                zMm: 0,
                colorHex: '#38bdf8',
            })),
            cuts: [],
            updatedAt: Date.now(),
        };

        saveSmartPartPackage(multiPartDef);
        const list = listSmartPartPackages();
        const loaded = list.find((p) => p.id === 'smartpart_multi_test');
        expect(loaded).toBeDefined();
        expect(loaded?.parts.length).toBe(10);
        expect(loaded?.parts[0].name).toBe('Część 1');
        expect(loaded?.parts[9].xMm).toBe(45);
    });

    it('precyzyjnie wylicza, ile mm walec (otwór) i sześcian (rewizja) wystają poza Kontener Główny SmartParta', () => {
        const main = {
            widthMm: 20,  // CAD X od -10 do +10
            heightMm: 40, // CAD Z od -20 do +20
            depthMm: 70,  // CAD Y od -35 do +35
        };

        // Walec: xMm/yMm/zMm = początek (LCS) na lewej ścianie, direction −X → cała długość na zewnątrz
        // Środek = −10 + (−1)×12 = −22; AABB −34…−10 → wystaje 24 mm w −X
        const holeCut: SmartPartHoleCut = {
            id: 'h1',
            name: 'Walec 1',
            type: 'HOLE',
            diameterMm: 8,
            lengthMm: 24,
            xMm: -10,
            yMm: 0,
            zMm: 0,
            axis: 'X',
            direction: -1,
        };

        const holeProt = calculateCutProtrusion(holeCut, main);
        expect(holeProt.leftXMinusMm).toBe(24);
        expect(holeProt.rightXPlusMm).toBe(0);
        expect(holeProt.topYPlusMm).toBe(0);
        expect(holeProt.bottomYMinusMm).toBe(0);

        // Sześcian: początek na ścianie CAD −Y (−35), oś Y, direction −1 → głębokość na zewnątrz
        // Środek = −35 + (−1)×7.5 = −42.5; AABB −50…−35 → wystaje 15 mm w −Y (plecy w API)
        const pocketCut: SmartPartPocketCut = {
            id: 'p1',
            name: 'Sześcian 1',
            type: 'POCKET',
            widthMm: 16,
            heightMm: 30,
            depthMm: 15,
            xMm: 0,
            yMm: -35,
            zMm: 0,
            axis: 'Y',
            direction: -1,
        };

        const pocketProt = calculateCutProtrusion(pocketCut, main);
        expect(pocketProt.backZMinusMm).toBe(15);
        expect(pocketProt.frontZPlusMm).toBe(0);
    });

    it('zapisuje, odczytuje i usuwa pakiet w storage', () => {
        const customPkg: SmartPartPackageDefinition = {
            id: 'smartpart_custom_test',
            name: 'Mocowanie Narożne',
            units: 'mm',
            version: '1.0',
            type: 'CUSTOM',
            mainContainer: { widthMm: 20, heightMm: 38, depthMm: 70 },
            parts: [
                { id: 'part_1', name: 'Part 1', widthMm: 18, heightMm: 36, depthMm: 68, xMm: 0, yMm: 0, zMm: 0, colorHex: '#60a5fa' },
            ],
            cuts: [
                {
                    id: 'cut_1',
                    name: 'Walec montażowy',
                    type: 'HOLE',
                    diameterMm: 8,
                    lengthMm: 24,
                    xMm: -10,
                    yMm: 0,
                    zMm: 0,
                    axis: 'X',
                    direction: -1,
                },
            ],
            updatedAt: Date.now(),
        };

        saveSmartPartPackage(customPkg);
        let list = listSmartPartPackages();
        const found = list.find((p) => p.id === 'smartpart_custom_test');
        expect(found).toBeDefined();
        expect(found?.name).toBe('Mocowanie Narożne');
        expect(found?.mainContainer.widthMm).toBe(20);

        deleteSmartPartPackage('smartpart_custom_test');
        list = listSmartPartPackages();
        expect(list.find((p) => p.id === 'smartpart_custom_test')).toBeUndefined();
    });

    it('odrzuca import pliku JSON bez jednostek mm', () => {
        const badJson = JSON.stringify({
            id: 'bad',
            name: 'Zły',
            units: 'm', // Błąd reguły SSOT
            mainContainer: { widthMm: 20 },
        });

        expect(() => importSmartPartPackageJson(badJson)).toThrowError(/milimetrowe/i);
    });

    it('import JSON zachowuje ściany referencyjne i offsety parts/cuts', () => {
        const json = JSON.stringify({
            id: 'smartpart_import_refs',
            name: 'Import Ref',
            units: 'mm',
            type: 'CUSTOM',
            mainContainer: { widthMm: 100, heightMm: 80, depthMm: 60 },
            parts: [
                {
                    id: 'part_1',
                    name: 'Part 1',
                    widthMm: 18,
                    heightMm: 36,
                    depthMm: 40,
                    xMm: -40,
                    yMm: 20,
                    zMm: -20,
                    refX: 'LEFT',
                    offsetX_mm: 10,
                    refY: 'TOP',
                    offsetY_mm: 20,
                    refZ: 'BACK',
                    offsetZ_mm: 10,
                    colorHex: '#38bdf8',
                },
            ],
            cuts: [
                {
                    id: 'cut_1',
                    name: 'Walec',
                    type: 'HOLE',
                    diameterMm: 8,
                    lengthMm: 24,
                    xMm: -50,
                    yMm: 0,
                    zMm: 0,
                    refX: 'LEFT',
                    offsetX_mm: 0,
                    refY: 'CENTER',
                    offsetY_mm: 0,
                    refZ: 'CENTER',
                    offsetZ_mm: 0,
                    axis: 'X',
                    direction: -1,
                },
            ],
        });

        const imported = importSmartPartPackageJson(json);
        // Legacy Y=wys/Z=głęb → CAD; cięcia → LCS Parta
        expect(imported.coordSystem).toBe('CAD');
        expect(imported.cutsFrame).toBe('PART');
        expect(imported.parts[0].refX).toBe('LEFT');
        expect(imported.parts[0].offsetX_mm).toBe(10);
        expect(imported.parts[0].refY).toBe('BACK');
        expect(imported.parts[0].offsetY_mm).toBe(10);
        expect(imported.parts[0].refZ).toBe('TOP');
        expect(imported.parts[0].offsetZ_mm).toBe(20);
        expect(imported.cuts[0].refX).toBe('LEFT');
        expect(imported.cuts[0].xMm).toBe(-10); // -50 main − (-40) part
        expect(imported.cuts[0].offsetX_mm).toBe(-1); // lewa ściana part (halfW=9)
    });

    it('poprawnie przelicza pozycje względem ścian referencyjnych (CAD: X/Y=głęb/Z=wys)', () => {
        const main = { widthMm: 40, heightMm: 60, depthMm: 80 };

        // X: Bok Lewy (xMin = -20), offset 10 mm -> x = -10
        const absLeft = computeAbsoluteFromReference(main, 'LEFT', 10, 'CENTER', 0, 'CENTER', 0);
        expect(absLeft.xMm).toBe(-10);

        // X: Bok Prawy (xMax = +20), offset 5 mm -> x = +15
        const absRight = computeAbsoluteFromReference(main, 'RIGHT', 5, 'CENTER', 0, 'CENTER', 0);
        expect(absRight.xMm).toBe(15);

        // Y: Tył (+Y, yMax = +40), offset 15 mm -> y = +25
        const absBack = computeAbsoluteFromReference(main, 'CENTER', 0, 'BACK', 15, 'CENTER', 0);
        expect(absBack.yMm).toBe(25);

        // Y: Przód (−Y, yMin = -40), offset 10 mm -> y = -30
        const absFront = computeAbsoluteFromReference(main, 'CENTER', 0, 'FRONT', 10, 'CENTER', 0);
        expect(absFront.yMm).toBe(-30);

        // Z: Dół (zMin = -30), offset 8 mm -> z = -22
        const absBottom = computeAbsoluteFromReference(main, 'CENTER', 0, 'CENTER', 0, 'BOTTOM', 8);
        expect(absBottom.zMm).toBe(-22);

        // Z: Góra (zMax = +30), offset 12 mm -> z = +18
        const absTop = computeAbsoluteFromReference(main, 'CENTER', 0, 'CENTER', 0, 'TOP', 12);
        expect(absTop.zMm).toBe(18);

        // Odwrotna konwersja (computeReferenceFromAbsolute)
        const rel = computeReferenceFromAbsolute(main, -10, -30, 18, 'LEFT', 'FRONT', 'TOP');
        expect(rel.offsetX_mm).toBe(10);
        expect(rel.offsetY_mm).toBe(10);
        expect(rel.offsetZ_mm).toBe(12);

        // Gdy kontener powiększa głębokość z 80 mm na 100 mm (tył = +50), offset od Tyłu (15 mm) zostaje
        const resizedMain = { widthMm: 40, heightMm: 60, depthMm: 100 };
        const absAfterResize = computeAbsoluteFromReference(resizedMain, 'CENTER', 0, 'BACK', 15, 'CENTER', 0);
        expect(absAfterResize.yMm).toBe(35); // +50 - 15
    });

    it('import JSON z wieloma Partami i lokalnymi cuts w Part zachowuje ich pozycje bez odejmowania pozycji Parta', () => {
        const json = JSON.stringify({
            units: 'mm',
            mainContainer: { widthMm: 564, heightMm: 600, depthMm: 330 },
            parts: [
                {
                    id: 'part_1',
                    name: 'Zawieszka L',
                    widthMm: 20,
                    heightMm: 38,
                    depthMm: 65,
                    xMm: -272,
                    yMm: 133,
                    zMm: 281,
                    refX: 'LEFT',
                    offsetX_mm: 10,
                    refY: 'BACK',
                    offsetY_mm: 32.5,
                    refZ: 'TOP',
                    offsetZ_mm: 19,
                },
            ],
            cuts: [
                {
                    id: 'cut_1',
                    name: 'Walec 1',
                    type: 'HOLE',
                    diameterMm: 3,
                    lengthMm: 5,
                    xMm: -10,
                    yMm: 15,
                    zMm: 5,
                    refX: 'LEFT',
                    offsetX_mm: 0,
                    refY: 'BACK',
                    offsetY_mm: 17.5,
                    refZ: 'TOP',
                    offsetZ_mm: 14,
                    axis: 'X',
                    direction: -1,
                    partId: 'part_1',
                },
            ],
        });

        const imported = importSmartPartPackageJson(json);
        expect(imported.cutsFrame).toBe('PART');
        expect(imported.parts[0].xMm).toBe(-272);
        // Pozycja cięcia w LCS Parta nie może zostać podwójnie odjęta (np. -10 - (-272) = 262)
        expect(imported.cuts[0].xMm).toBe(-10);
        expect(imported.cuts[0].yMm).toBe(15);
        expect(imported.cuts[0].zMm).toBe(5);
        expect(imported.cuts[0].partId).toBe('part_1');
    });

    it('zachowuje rotację (axis/direction) POCKET niezależnie od ścian odniesienia (refX/refY/refZ) i obraca wymiary bryły 3D', async () => {
        const {
            cutOrientFromRefs,
            pocketBoxDimsCad,
            pocketCenterFromOriginCad,
            syncAssociativeMirrors,
        } = await import('../index.js');
        const pocketY: SmartPartPocketCut = {
            id: 'szescian_2',
            name: 'Wcięcie prostokątne 2',
            type: 'POCKET',
            widthMm: 15,
            heightMm: 50,
            depthMm: 16,
            xMm: -10,
            yMm: 32.5,
            zMm: -19,
            refX: 'LEFT',
            offsetX_mm: 0,
            refY: 'BACK',
            offsetY_mm: 0,
            refZ: 'TOP',
            offsetZ_mm: 38,
            axis: 'Y',
            direction: 1,
            partId: 'part_1',
        };

        // Dla axis='Y': przekrój (15×50) w XZ, głębokość cięcia (16) w Y
        expect(pocketBoxDimsCad(pocketY)).toEqual({ xMm: 15, yMm: 16, zMm: 50 });
        expect(pocketCenterFromOriginCad(pocketY)).toEqual({ xMm: -10, yMm: 40.5, zMm: -19 });

        // Po obrocie o 90° na oś X (wycięcie w lewym boku pod szynę zawieszki), przy zachowaniu tych samych refX='LEFT', refY='BACK', refZ='TOP':
        const pocketX: SmartPartPocketCut = {
            ...pocketY,
            axis: 'X',
            direction: -1,
        };
        expect(cutOrientFromRefs(pocketX)).toEqual({ axis: 'X', direction: -1 });
        // Dla axis='X': głębokość cięcia (16) w X, przekrój (15×50) w YZ
        expect(pocketBoxDimsCad(pocketX)).toEqual({ xMm: 16, yMm: 15, zMm: 50 });
        expect(pocketCenterFromOriginCad(pocketX)).toEqual({ xMm: -18, yMm: 32.5, zMm: -19 });

        // Po przeliczeniu odniesień / imporcie JSON-a / synchronizacji luster rotacja NIE wraca do punktu startowego
        const json = JSON.stringify({
            id: 'sp:test_rot',
            name: 'Test Rotacji',
            units: 'mm',
            type: 'CUSTOM',
            cutsFrame: 'PART',
            mainContainer: { widthMm: 564, heightMm: 600, depthMm: 330 },
            parts: [
                {
                    id: 'part_1',
                    name: 'Part 1',
                    widthMm: 20,
                    heightMm: 38,
                    depthMm: 65,
                    xMm: -272,
                    yMm: 132.5,
                    zMm: 281,
                    refX: 'LEFT',
                    offsetX_mm: 10,
                    refY: 'BACK',
                    offsetY_mm: 32.5,
                    refZ: 'TOP',
                    offsetZ_mm: 19,
                    colorHex: '#38bdf8',
                },
                {
                    id: 'part_2',
                    name: 'Part 1 (P)',
                    widthMm: 20,
                    heightMm: 38,
                    depthMm: 65,
                    xMm: 272,
                    yMm: 132.5,
                    zMm: 281,
                    refX: 'RIGHT',
                    offsetX_mm: 10,
                    refY: 'BACK',
                    offsetY_mm: 32.5,
                    refZ: 'TOP',
                    offsetZ_mm: 19,
                    colorHex: '#38bdf8',
                    mirroredFrom: 'part_1',
                    mirrorAxis: 'X',
                },
            ],
            cuts: [pocketX],
        });

        const imported = syncAssociativeMirrors(importSmartPartPackageJson(json));
        const leftCut = imported.cuts.find((c) => c.id === 'szescian_2')!;
        const rightCut = imported.cuts.find((c) => c.mirroredFrom === 'szescian_2')!;

        expect(leftCut.axis).toBe('X');
        expect(leftCut.direction).toBe(-1);
        expect(rightCut.axis).toBe('X');
        expect(rightCut.direction).toBe(1);
    });

    it('nadaje unikalne, hierarchiczne identyfikatory przez IDManager', () => {
        const pkgId = allocSmartPartPackageId('SmartPart_Testowy');
        expect(pkgId).toMatch(/^sp:SmartPart_Testowy/);

        const bodyId = allocSmartPartBodyId(pkgId, 'korpus');
        expect(bodyId).toMatch(/^sp:SmartPart_Testowy.*\/part:korpus/);

        const cutId = allocSmartPartCutId(pkgId, 'walec');
        expect(cutId).toMatch(/^sp:SmartPart_Testowy.*\/cut:walec/);
    });
});

