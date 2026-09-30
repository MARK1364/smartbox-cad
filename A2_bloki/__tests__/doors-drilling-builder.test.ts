import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CADNode } from '../../A1_core/cad-node/cad-node.js';
import { NodeType } from '../../A1_core/cad-node/node-type.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { Quat } from '../../A1_core/cad-math/quat.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { buildDoorsDrillings } from '../doors-drilling-builder.js';
import { update_bloki_core } from '../bloki-core.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('Doors Drilling Builder (buildDoorsDrillings)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    it('generates hinge plate drillings directly on PARTITION panel when customReferences are set', () => {
        const cabinet = doc.createAssembly({ name: 'Korpus z przegroda' });
        const cabinetNode = doc.findNode(cabinet.id)!;

        // 1. Lewy bok (X = -400)
        const leftPanel = new PanelModel({
            name: 'Bok Lewy',
            role: 'LEFT_SIDE_PANEL',
            width: mmToNm(600),
            height: mmToNm(2000),
            thickness: mmToNm(18)
        });
        const leftNode = CADNode.create(NodeType.PART, leftPanel.name, leftPanel.id);
        leftNode.domainData = leftPanel;
        leftNode.setLocalTransform(new Vec3(mmToNm(-391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
        doc.addNode(cabinetNode.id, leftNode);

        // 2. Przegroda pionowa w Ĺ›rodku (X = 0)
        const partitionPanel = new PanelModel({
            name: 'Przegroda Srodkowa',
            role: 'PARTITION',
            width: mmToNm(600),
            height: mmToNm(2000),
            thickness: mmToNm(18)
        });
        const partitionNode = CADNode.create(NodeType.PART, partitionPanel.name, partitionPanel.id);
        partitionNode.domainData = partitionPanel;
        partitionNode.setLocalTransform(new Vec3(0, 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, -Math.PI / 2));
        doc.addNode(cabinetNode.id, partitionNode);

        // 3. Prawy bok (X = +400)
        const rightPanel = new PanelModel({
            name: 'Bok Prawy',
            role: 'RIGHT_SIDE_PANEL',
            width: mmToNm(600),
            height: mmToNm(2000),
            thickness: mmToNm(18)
        });
        const rightNode = CADNode.create(NodeType.PART, rightPanel.name, rightPanel.id);
        rightNode.domainData = rightPanel;
        rightNode.setLocalTransform(new Vec3(mmToNm(391), 0, mmToNm(1000)), Quat.fromEulerXYZ(0, 0, Math.PI / 2));
        doc.addNode(cabinetNode.id, rightNode);

        // 4. Wstawiamy Bloki z drzwiami lewostronnymi w PRAWEJ wnÄ™ce (miÄ™dzy przegrodÄ… a prawym bokiem)
        // LewÄ… Ĺ›cianÄ… tej wnÄ™ki jest PRZEGRODA (prawa strona przegrody to FACE_Z_MINUS)
        const sbContainer = new ContainerModel({
            name: 'blok_doors_prawa_strefa',
            width: mmToNm(382),
            height: mmToNm(2000),
            depth: mmToNm(600)
        });
        sbContainer.generatorParams = {
            type: 'blok_doors',
            boxType: 'DOORS',
            rodzaj_drzwi: 'LEFT',
            uzyj_zawias_1: true,
            uzyj_zawias_6: true,
            width_mm: 382,
            height_mm: 2000,
            depth_mm: 600,
            customReferences: {
                xMin: { partKey: 'Przegroda Srodkowa', face: 'FACE_Z_MINUS', panelId: partitionPanel.id },
                xMax: { partKey: 'Bok Prawy', face: 'FACE_Z_PLUS', panelId: rightPanel.id }
            },
            disabledReferences: { yMin: true, yMax: true, zMin: true, zMax: true }
        };

        const sbNode = CADNode.create(NodeType.ASSEMBLY, sbContainer.name, sbContainer.id);
        sbNode.domainData = sbContainer;
        sbNode.setLocalTransform(new Vec3(mmToNm(195.5), 0, 0), Quat.IDENTITY);
        doc.addNode(cabinetNode.id, sbNode);

        // Generujemy plan i synchronizujemy
        update_bloki_core(sbContainer, doc);

        // 5. Sprawdzamy czy nawiercenia zawiasĂłw trafiĹ‚y na PRZEGRODÄ!
        const intents = buildDoorsDrillings(doc, cabinet.id);
        expect(intents.length).toBeGreaterThan(0);

        const partitionIntents = intents.filter(i => i.targetNodeId === partitionPanel.id);
        expect(partitionIntents.length).toBeGreaterThan(0);

        // Prowadnik powinien byÄ‡ nawiercony na wskazanej Ĺ›cianie FACE_Z_MINUS
        for (const intent of partitionIntents) {
            expect(intent.feature.face).toBe('FACE_Z_MINUS');
            expect(intent.feature.params.isDoorDrilling).toBe(true);
            expect(intent.feature.params.u).toBeGreaterThan(0);
            expect(intent.feature.params.v).toBeGreaterThan(0);
        }

        // Prawy bok nie powinien dostaÄ‡ zawiasĂłw (drzwi sÄ… lewe)
        const rightIntents = intents.filter(i => i.targetNodeId === rightPanel.id);
        expect(rightIntents).toHaveLength(0);
    });

    it('loads parallel hinges in library list and identifies them', async () => {
        const { listByType, isParallelHinge } = await import('../../B1_biblioteka/index.js');
        const hinges = listByType('HINGE');
        const parallel = hinges.find(h => h.id === 'BLUM_79B9550');
        expect(parallel).toBeDefined();
        expect(parallel?.name).toContain('równoległy');
        expect(isParallelHinge('BLUM_79B9550')).toBe(true);
        expect(isParallelHinge('BLUM_79T9550')).toBe(true);
        expect(isParallelHinge('BLUM_71B3550')).toBe(false);
    });

    it('generates parallel hinge drillings on BLIND_PANEL on FACE_Z_PLUS for korpus_rogowy1', async () => {
        const { CreateKorpusCommand } = await import('../../A3_smartframe/commands/create-korpus-command.js');
        const { probeBayFromCADPoint } = await import('../bloki-bay-detector.js');
        const { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } = await import('../bloki-bay-actions.js');
        const { computeFaceData, localTo3D } = await import('../../A4_smartpanel/native_core/face-lcs.js');
        const { nmToMm } = await import('../../A1_core/cad-math/units.js');

        const cmd = new CreateKorpusCommand({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            wysokosc_strefy_dolnej_mm: 100,
            wysokosc_strefy_srodkowej_mm: 1000,
            typ_korpusu: 'korpus_rogowy1',
            szerokosc_blendy_mm: 400,
            strona_blendy: 'LEFT',
            cofniecie_plecow_mm: 3
        });
        cmd.execute(doc);

        const cab = doc.getContainers()[0];
        const bay = probeBayFromCADPoint(doc, { x: 200, y: 0, z: 1000 });
        expect(bay).toBeDefined();

        if (bay) {
            const doorOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DOORS')!;
            const sbNode = createBlokInDetectedBay(doc, bay, doorOpt, {
                rodzaj_drzwi: 'LEFT'
            });

            // Ustawiamy szablon zawiasu równoległego
            (sbNode!.domainData as any).generatorParams.domyslny_zawias_id = 'BLUM_79B9550';

            const intents = buildDoorsDrillings(doc, cab.id);
            expect(intents.length).toBe(4); // 2 zawiasy x 2 otwory

            for (const intent of intents) {
                const targetNode = doc.findNode(intent.targetNodeId)!;
                const p = targetNode.domainData as any;
                expect(p.role).toBe('BLIND_PANEL');
                expect(intent.feature.face).toBe('FACE_Z_PLUS');
                expect(intent.feature.params.u).toBe(363); // 400 - 37 = 363

                const w = nmToMm(p.width);
                const h = nmToMm(p.height);
                const t = nmToMm(p.thickness);
                const fd = computeFaceData(intent.feature.face, w, h, t);
                const local3D = localTo3D(fd, intent.feature.params.u, intent.feature.params.v);
                const cadLocal = new Vec3(
                    local3D[0] * 1_000_000,
                    local3D[2] * 1_000_000,
                    local3D[1] * 1_000_000
                );
                const worldPos = targetNode.getWorldMatrix().transformPoint(cadLocal);
                const wx = nmToMm(worldPos.x);
                const wy = nmToMm(worldPos.y);

                // Otwory muszÄ… wypaĹ›Ä‡ na wewnÄ™trznej powierzchni blendy (Y = -282 mm)
                expect(wy).toBeCloseTo(-282, 0);
                // 37 mm od krawÄ™dzi otworu (X = -19 mm)
                expect(wx).toBeCloseTo(-19, 0);
                // Nie w powietrzu przed szafkÄ…
                expect(wy).toBeGreaterThan(-290);
            }
        }
    });

    it('rejects standard hinge on narrow blind panel edge and produces 0 floating holes', async () => {
        const { CreateKorpusCommand } = await import('../../A3_smartframe/commands/create-korpus-command.js');
        const { probeBayFromCADPoint } = await import('../bloki-bay-detector.js');
        const { createBlokInDetectedBay, BLOKI_INTERNAL_OPTIONS } = await import('../bloki-bay-actions.js');

        const cmd = new CreateKorpusCommand({
            szerokosc_mm: 800,
            wysokosc_mm: 2200,
            glebokosc_mm: 600,
            liczba_stref: 1,
            wysokosc_strefy_dolnej_mm: 100,
            wysokosc_strefy_srodkowej_mm: 1000,
            typ_korpusu: 'korpus_rogowy1',
            szerokosc_blendy_mm: 400,
            strona_blendy: 'LEFT',
            cofniecie_plecow_mm: 3
        });
        cmd.execute(doc);

        const cab = doc.getContainers()[0];
        const bay = probeBayFromCADPoint(doc, { x: 200, y: 0, z: 1000 });
        expect(bay).toBeDefined();

        if (bay) {
            const doorOpt = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DOORS')!;
            const sbNode = createBlokInDetectedBay(doc, bay, doorOpt, {
                rodzaj_drzwi: 'LEFT'
            });

            // Pozostawiamy standardowy zawias boczny (BLUM_71B3550)
            (sbNode!.domainData as any).generatorParams.domyslny_zawias_id = 'BLUM_71B3550';

            const intents = buildDoorsDrillings(doc, cab.id);
            // KrawÄ™dĹş boczna blendy ma tylko 18mm gruboĹ›ci, a zawias standardowy wymaga 37mm.
            // Silnik nie moĹĽe wywierciÄ‡ otworĂłw w powietrzu!
            expect(intents.length).toBe(0);
        }
    });
});

