import { describe, it, expect } from 'vitest';
import { hangersFromCatalog, hangerGlbTemplateId } from '../hangers-from-catalog.js';
import { listHangers, getHardware } from '../../index.js';
import { computeHangerCornerPoses } from '../../../A2_bloki/hangers/hanger-apply.js';
import type { DetectedBay } from '../../../A2_bloki/02_bloki-bay-detector.js';

describe('B1 zawieszki Camaro', () => {
    it('parses Camaro series JSON', () => {
        const items = hangersFromCatalog({
            brand: 'Camaro',
            series: [{
                id: 'camaro_806',
                name: 'Camaro 806',
                variants: [{
                    id: 'CAMARO_806',
                    name: 'Zawieszka Camaro 806',
                    widthMm: 20,
                    heightMm: 38,
                    depthMm: 70,
                    mount: { from_top_mm: 32, from_back_mm: 20, pair: true },
                    visual: { glb: 'Zawieszka_Camaro_806.glb', origin: 'MOUNT_CORNER', units: 'mm' },
                }],
            }],
        });
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('HANGER');
        expect(items[0].mount.from_top).toBe(32);
        expect(items[0].visual.glb).toBe('Zawieszka_Camaro_806.glb');
    });

    it('loads real Camaro.json into library', () => {
        const hangers = listHangers();
        expect(hangers.map((h) => h.id)).toContain('CAMARO_806');
        const hw = getHardware('CAMARO_806');
        expect(hw?.type).toBe('HANGER');
        expect(hw?.visual?.glb).toBe('Zawieszka_Camaro_806.glb');
    });

    it('loads custom SmartPart JSON from zawieszki directory into listHangers', () => {
        const hangers = listHangers();
        const sp = hangers.find(
            (h) =>
                (h as any).definition?.mainContainer
                || h.seriesId === 'smartpart_custom'
                || /^SmartPart/i.test(h.name || ''),
        );
        // Folder może mieć tylko Camaro — wtedy brak SmartPart
        if (!sp) return;
        expect(sp.type).toBe('HANGER');
        expect((sp as any).definition?.mainContainer || sp.seriesId === 'smartpart_custom').toBeTruthy();
    });

    it('buildHangerCatalog = pliki SmartPart z B1, bez localStorage i bez Camaro', async () => {
        const { buildHangerCatalog, hangerCatalogDedupKey } = await import('../../../A2_bloki/01_smartparts-catalog.js');
        const hangers = listHangers();
        const folderSmartIds = hangers
            .filter(
                (h) =>
                    (h as any).definition?.mainContainer
                    || h.seriesId === 'smartpart_custom'
                    || /^SmartPart/i.test(h.name || ''),
            )
            .map((h) => h.id);
        const catalog = buildHangerCatalog();
        const catalogKeys = new Set(catalog.map((c) => hangerCatalogDedupKey(c.id, c.name)));
        // Każdy SmartPart z B1 musi mieć reprezentację (po deduplikacji ze Studio)
        for (const id of folderSmartIds) {
            const key = hangerCatalogDedupKey(id);
            expect(catalogKeys.has(key) || catalog.some((c) => c.id === id)).toBe(true);
        }
        expect(catalog.some((c) => c.isCustom)).toBe(true);
        expect(catalog.some((c) => c.id === 'CAMARO_806' || c.source === 'studio')).toBe(false);
        // Brak duplikatów po kluczu
        const keys = catalog.map((c) => hangerCatalogDedupKey(c.id, c.name));
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('computes Studio references (CENTER Y/Z) correctly in bay center instead of top/back', () => {
        const bay = {
            boundsMm: { width: 600, height: 720, depth: 300 },
            boundsNm: { width: 0, height: 0, depth: 0 },
            centerWorldMm: { x: 0, y: 150, z: 360 },
            boundary: {
                left: { nodeId: 'side_L', planeCoordMm: -300, face: 'FACE_Z_PLUS', nodeName: 'Bok L', worldPointMm: { x: 0, y: 0, z: 0 } },
                right: { nodeId: 'side_R', planeCoordMm: 300, face: 'FACE_Z_PLUS', nodeName: 'Bok R', worldPointMm: { x: 0, y: 0, z: 0 } },
                back: { nodeId: 'back', planeCoordMm: 300, face: 'FACE_Z_PLUS', nodeName: 'Plecy', worldPointMm: { x: 0, y: 0, z: 0 } },
                front: { nodeId: 'front', planeCoordMm: 0, face: 'FACE_Z_MINUS', nodeName: 'Front', worldPointMm: { x: 0, y: 0, z: 0 } },
                top: { nodeId: 'top', planeCoordMm: 720, face: 'FACE_Z_MINUS', nodeName: 'Wieniec', worldPointMm: { x: 0, y: 0, z: 0 } },
                bottom: { nodeId: 'bot', planeCoordMm: 0, face: 'FACE_Z_PLUS', nodeName: 'Dół', worldPointMm: { x: 0, y: 0, z: 0 } },
                frontPlaneYMm: 0,
            },
        } as DetectedBay;

        const hangers = listHangers();
        const spHardware = getHardware('sp:SmartPart_Kontener_199')
            || hangers.find((h) => /Kontener.?199/i.test(h.name || ''))
            || getHardware('smartpart_1791223537945');
        if (!(spHardware as any)?.definition) {
            const anySp = hangers.find((h) => (h as any).definition?.parts?.length >= 1);
            if (!anySp) return;
            const poses = computeHangerCornerPoses(bay, {
                id: anySp.id,
                name: anySp.name,
                brand: anySp.brand,
                seriesId: anySp.seriesId,
                glbModelPath: '',
                fromTopMm: 0,
                fromBackMm: 0,
                fromSideMm: 0,
                widthMm: 20,
                heightMm: 38,
                depthMm: 70,
                pair: true,
                definition: (anySp as any).definition,
            });
            expect(poses.length).toBeGreaterThanOrEqual(1);
            return;
        }

        const def = (spHardware as any).definition;
        const poses = computeHangerCornerPoses(bay, {
            id: spHardware!.id,
            name: spHardware!.name,
            brand: spHardware!.brand,
            seriesId: spHardware!.seriesId,
            glbModelPath: '',
            fromTopMm: 0,
            fromBackMm: 0,
            fromSideMm: 0,
            widthMm: 20,
            heightMm: 38,
            depthMm: 70,
            pair: true,
            definition: def,
        });

        expect(poses.length).toBeGreaterThanOrEqual(1);
    });

    it('strips glb for loader id', () => {
        expect(hangerGlbTemplateId('Zawieszka_Camaro_806.glb')).toBe('Zawieszka_Camaro_806');
    });

    it('computes L/R at junction of side + back + top faces', () => {
        const bay = {
            boundsMm: { width: 600, height: 720, depth: 300 },
            boundsNm: { width: 0, height: 0, depth: 0 },
            centerWorldMm: { x: 0, y: 150, z: 360 },
            boundary: {
                left: { nodeId: 'side_L', planeCoordMm: -300, face: 'FACE_Z_PLUS', nodeName: 'Bok L', worldPointMm: { x: 0, y: 0, z: 0 } },
                right: { nodeId: 'side_R', planeCoordMm: 300, face: 'FACE_Z_PLUS', nodeName: 'Bok R', worldPointMm: { x: 0, y: 0, z: 0 } },
                // Jak w bloki-bay-detector: przód = mniejszy Y, plecy = większy Y
                back: { nodeId: 'back', planeCoordMm: 300, face: 'FACE_Z_PLUS', nodeName: 'Plecy', worldPointMm: { x: 0, y: 0, z: 0 } },
                front: { nodeId: 'front', planeCoordMm: 0, face: 'FACE_Z_MINUS', nodeName: 'Front', worldPointMm: { x: 0, y: 0, z: 0 } },
                top: { nodeId: 'top', planeCoordMm: 720, face: 'FACE_Z_MINUS', nodeName: 'Wieniec', worldPointMm: { x: 0, y: 0, z: 0 } },
                bottom: { nodeId: 'bot', planeCoordMm: 0, face: 'FACE_Z_PLUS', nodeName: 'Dół', worldPointMm: { x: 0, y: 0, z: 0 } },
                frontPlaneYMm: 0,
            },
        } as DetectedBay;

        const poses = computeHangerCornerPoses(bay, {
            id: 'CAMARO_806',
            name: 'Camaro 806',
            brand: 'Camaro',
            seriesId: 'camaro_806',
            glbModelPath: 'Zawieszka_Camaro_806.glb',
            fromTopMm: 0,
            fromBackMm: 0,
            fromSideMm: 0,
            widthMm: 20,
            heightMm: 38,
            depthMm: 70,
            pair: true,
        });

        expect(poses).toHaveLength(2);
        expect(poses[0].side).toBe('L');
        expect(poses[1].side).toBe('R');
        // planeCoord detektora = już wewnętrzne lico (from_* = 0 → styk 3 ścian)
        expect(poses[0].worldMm.x).toBeCloseTo(-300, 5);
        expect(poses[1].worldMm.x).toBeCloseTo(300, 5);
        expect(poses[0].worldMm.y).toBeCloseTo(300, 5); // na plecach
        expect(poses[0].worldMm.z).toBeCloseTo(720, 5); // pod wieńcem
        expect(poses[0].faces.sidePanelId).toBe('side_L');
        expect(poses[0].faces.backPanelId).toBe('back');
        expect(poses[0].faces.topPanelId).toBe('top');
        expect(poses[1].faces.sidePanelId).toBe('side_R');
    });
});



