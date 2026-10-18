import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { runEngineAndApply } from '../smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { probeRogowy90BayFromCADPoint } from '../rogowy90-bay.js';
import { probeBayFromCADPoint } from '../../A2_bloki/02_bloki-bay-detector.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('rogowy90 bay detection', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
        ContextManager.instance.commandHistory = new CommandHistory(doc);
        ContextManager.instance.panelViews.clear();
    });

    function buildRogowy90() {
        const cabinet = doc.createAssembly({ name: 'Rogowy90' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_rogowy90',
            liczba_stref: 1,
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600
        };
        runEngineAndApply(cabinet, 900, 720, 900, 1, 0, 0, 0);
        return cabinet;
    }

    it('ramiÄ™ X: peĹ‚na szerokoĹ›Ä‡ (nie wciÄ™cie L)', () => {
        buildRogowy90();
        const bay = probeRogowy90BayFromCADPoint(doc, { x: 250, y: 0, z: 360 });
        expect(bay).not.toBeNull();
        // ~900 â’ plecy â’ bok â‰ 864 mm
        expect(bay!.boundsMm.width).toBeGreaterThan(820);
        expect(bay!.boundary.right.nodeName.toUpperCase()).toMatch(/BOK_P/);
        expect(bay!.boundary.left.nodeName.toUpperCase()).toMatch(/PLECY_X/);
    });

    it('ramiÄ™ Y: wÄ™ĹĽsza wnÄ™ka do naroĹĽnika L', () => {
        buildRogowy90();
        const bay = probeRogowy90BayFromCADPoint(doc, { x: -100, y: 0, z: 360 });
        expect(bay).not.toBeNull();
        // ~600 â’ plecy â’ bok â‰ 579 mm
        expect(bay!.boundsMm.width).toBeGreaterThan(540);
        expect(bay!.boundsMm.width).toBeLessThan(650);
        expect(bay!.boundary.right.nodeName.toUpperCase()).toMatch(/BOK_L/);
    });

    it('gĹ‚Ä™bokoĹ›Ä‡ obu ramion = peĹ‚na wnÄ™ka (â’Y â€¦ +Y plecy)', () => {
        buildRogowy90();
        const bayX = probeRogowy90BayFromCADPoint(doc, { x: 250, y: 0, z: 360 })!;
        const bayY = probeRogowy90BayFromCADPoint(doc, { x: -100, y: 0, z: 360 })!;
        expect(bayX.boundsMm.depth).toBeGreaterThan(820);
        expect(bayY.boundsMm.depth).toBeCloseTo(bayX.boundsMm.depth, -1);
    });

    it('lepsze niĹĽ generic probe w centrum (unika faĹ‚szywego wciÄ™cia)', () => {
        buildRogowy90();
        const generic = probeBayFromCADPoint(doc, { x: 250, y: 0, z: 360 });
        const rogowy = probeRogowy90BayFromCADPoint(doc, { x: 250, y: 0, z: 360 });
        expect(rogowy).not.toBeNull();
        if (generic) {
            expect(rogowy!.boundsMm.width).toBeGreaterThan(generic.boundsMm.width);
        }
    });

    it('gĂłra = INNER (FACE_Z_PLUS), nie OUTER dachu', () => {
        buildRogowy90();
        const bay = probeRogowy90BayFromCADPoint(doc, { x: 250, y: 0, z: 360 });
        expect(bay).not.toBeNull();
        expect(bay!.boundary.top.face).toBe('FACE_Z_PLUS');
        expect(bay!.boundary.bottom.face).toBe('FACE_Z_PLUS');
    });
});
