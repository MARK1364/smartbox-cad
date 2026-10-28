import { describe, it, expect, beforeEach } from 'vitest';
import { IDManager, EntityType, SmartID } from '../id-manager';
import { PanelModel } from '../../A4_smartpanel/panel-model';
import { mmToNm } from '../cad-math/units';

describe('IDManager — Centralny system identyfikatorów i tożsamości cech', () => {
    let idMgr: IDManager;

    beforeEach(() => {
        idMgr = IDManager.getInstance();
        idMgr.clear();
    });

    it('1. Rejestruje hierarchiczny SmartID dla encji sceny', () => {
        const frameId = idMgr.register(EntityType.SMARTFRAME, '', 'korpus');
        expect(frameId.fullPath).toBe('sf:korpus');
        expect(frameId.entityType).toBe('sf');
        expect(frameId.uid).toBe('korpus');

        const partId = idMgr.register(EntityType.PART, frameId.fullPath, 'bok_l');
        expect(partId.fullPath).toBe('sf:korpus/part:bok_l');
        expect(partId.parentPath).toBe('sf:korpus');

        const featId = idMgr.registerFeature(partId.fullPath, 'hole_1');
        expect(featId.fullPath).toBe('sf:korpus/part:bok_l/feat:hole_1');
        expect(featId.entityType).toBe('feat');
        expect(featId.uid).toBe('hole_1');
    });

    it('2. Unika kolizji przy rejestracji kolejnych cech tego samego typu', () => {
        const pPath = 'part:bok_l';
        const h1 = idMgr.registerFeature(pPath, 'hole');
        const h2 = idMgr.registerFeature(pPath, 'hole');
        const h3 = idMgr.registerFeature(pPath, 'hole');

        expect(h1.fullPath).toBe('part:bok_l/feat:hole');
        expect(h2.fullPath).toBe('part:bok_l/feat:hole_2');
        expect(h3.fullPath).toBe('part:bok_l/feat:hole_3');
    });

    it('3. registerStable zachowuje to samo SmartID i aktualizuje metadane', () => {
        const pPath = 'part:bok_l';
        const s1 = idMgr.registerStable(EntityType.FEATURE, pPath, 'custom_hole', { diameter: 5 });
        const s2 = idMgr.registerStable(EntityType.FEATURE, pPath, 'custom_hole', { diameter: 8 });

        expect(s1.fullPath).toBe('part:bok_l/feat:custom_hole');
        expect(s2.fullPath).toBe('part:bok_l/feat:custom_hole');
        expect(idMgr.lookup('part:bok_l/feat:custom_hole')?.metadata?.diameter).toBe(8);
    });

    it('4. PanelModel automatycznie rejestruje cechy w IDManagerze i nadaje SmartID', () => {
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18),
            name: 'Wieniec Dolny'
        });

        // Dodanie cechy bez ID
        const id1 = panel.addFeature({
            type: 'hole',
            face: 'FACE_Z_PLUS',
            params: { u: 50, v: 50, diameter: 8, depth: 12 }
        });

        expect(id1).toBeDefined();
        expect(panel.features[0].id).toBe(id1);
        expect(panel.features[0].smartId).toBeDefined();
        expect(panel.features[0].smartId).toContain('feat:hole');

        // Sprawdzenie obecności w rejestrze IDManagera
        const lookup = idMgr.lookup(panel.features[0].smartId);
        expect(lookup).not.toBeNull();
        expect(lookup?.metadata?.panel).toBe(panel);
        expect(lookup?.metadata?.feature?.params?.diameter).toBe(8);

        // Usunięcie cechy wyrejestrowuje ją z IDManagera
        panel.removeFeature(id1);
        expect(idMgr.lookup(panel.features[0]?.smartId || 'non_existent')).toBeNull();
    });

    it('5. setFeatures i fromJSON gwarantują rejestrację cech w IDManagerze nawet gdy wejście nie ma ID', () => {
        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(18)
        });

        panel.setFeatures([
            { type: 'groove', face: 'FACE_Z_PLUS', params: { u: 10, width: 4, depth: 8 } },
            { id: 'custom_cutout', type: 'cutout', face: 'FACE_Z_PLUS', params: { u: 100, v: 100 } }
        ]);

        expect(panel.features.length).toBe(2);
        expect(panel.features[0].id).toBe('groove');
        expect(panel.features[0].smartId).toContain('feat:groove');
        expect(panel.features[1].id).toBe('custom_cutout');
        expect(panel.features[1].smartId).toContain('feat:custom_cutout');

        expect(idMgr.lookup(panel.features[0].smartId)).not.toBeNull();
        expect(idMgr.lookup(panel.features[1].smartId)).not.toBeNull();
    });
});
