import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { runEngineAndApply } from '../../A3_smartframe/smartframe-adapter.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import {
    buildRogowy90CornerDoorsReferences,
    applyCornerDoorsDefaultRefs,
} from '../corner-doors-refs.js';
import { ContainerModel } from '../../A1_core/container-model.js';

describe('corner doors references (rogowy90)', () => {
    let doc: ProjectDocument;

    beforeEach(() => {
        doc = new ProjectDocument();
        ContextManager.instance.document = doc;
    });

    function buildCab() {
        const cabinet = doc.createAssembly({ name: 'Rogowy90' }) as ContainerModel;
        cabinet.generatorParams = {
            type: 'korpus_rogowy90',
            liczba_stref: 1,
            glebokosc_boku_lewego_mm: 600,
            glebokosc_boku_prawego_mm: 600,
        };
        runEngineAndApply(cabinet, 900, 720, 900, 1, 0, 0, 0);
        return doc.findNode(cabinet.id)!;
    }

    it('domyĹ›lne refs (model 4+2): zMin, zMax, xMax, yMin przypisane; xMin, yMax undefined (do wskazania w 3D)', () => {
        const refs = buildRogowy90CornerDoorsReferences(buildCab());
        expect(refs).not.toBeNull();
        expect(refs!.xMin).toBeUndefined();
        expect(refs!.yMax).toBeUndefined();
        expect(refs!.xMax.partKey.toUpperCase()).toMatch(/BOK_P/);
        expect(refs!.yMin.partKey.toUpperCase()).toMatch(/BOK_L/);
        expect(refs!.zMin.face).toBe('FACE_Z_PLUS');
        expect(refs!.zMax.face).toBe('FACE_Z_PLUS'); // INNER spĂłd wieĹ„ca gĂłry
    });

    it('applyCornerDoorsDefaultRefs â†’ innerL_wieniec i model 4+2', () => {
        const applied = applyCornerDoorsDefaultRefs(buildCab());
        expect(applied?.cornerAt).toBe('innerL_wieniec');
        expect(applied?.customReferences.xMin).toBeUndefined();
        expect(applied?.customReferences.yMax).toBeUndefined();
        expect(applied?.customReferences.yMin.partKey.toUpperCase()).toMatch(/BOK_L/);
        expect(applied?.customReferences.xMax.partKey.toUpperCase()).toMatch(/BOK_P/);
        expect(applied?.customReferences.zMax.face).toBe('FACE_Z_PLUS');
    });
});
