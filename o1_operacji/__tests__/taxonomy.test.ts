import { describe, it, expect } from 'vitest';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { PanelModel } from '../../A4_smartpanel/panel-model.js';
import { getOperation } from '../operacje-catalog.js';
import { buildOperationFeature } from '../operacje-builder.js';
import { applyLibraryOperation } from '../operacje-apply.js';
import { SUPPORTED_FEATURE_TYPES, isSupportedFeatureType } from '../../A1_core/project-schema.js';

function makePanel(w = 600, h = 720, t = 18) {
    return new PanelModel({
        width: mmToNm(w),
        height: mmToNm(h),
        thickness: mmToNm(t),
        name: 'Front',
        engineManaged: false,
    });
}

describe('Taksonomia obróbek płytowych (hole / groove / pocket / cutout)', () => {
    it('waliduje dopuszczalne 4 typy cech w schemacie projektu', () => {
        expect(SUPPORTED_FEATURE_TYPES).toEqual(['hole', 'groove', 'pocket', 'cutout']);
        expect(isSupportedFeatureType('hole')).toBe(true);
        expect(isSupportedFeatureType('groove')).toBe(true);
        expect(isSupportedFeatureType('pocket')).toBe(true);
        expect(isSupportedFeatureType('cutout')).toBe(true);
        expect(isSupportedFeatureType('unknown' as any)).toBe(false);
    });

    it('ramka z dnem (przetłoczenie nieprzelotowe) generuje typ "pocket"', () => {
        const recipe = getOperation('przetloczenie')!;
        expect(recipe).toBeDefined();
        const panel = makePanel(600, 720, 18);
        const feat = buildOperationFeature(recipe, panel, 'FACE_Z_MINUS');
        expect(feat).not.toBeNull();
        expect(feat!.type).toBe('pocket');
        expect(feat!.params.through).toBe(false);
        expect(feat!.params.depth).toBe(3);
    });

    it('ramka bez dna pod szybę (through=true, fill=glass) generuje typ "cutout"', () => {
        const panel = makePanel(600, 720, 18);
        const feat = applyLibraryOperation(panel, 'przetloczenie', 'FACE_Z_MINUS', {
            through: true,
            fill: 'glass',
        });
        expect(feat).not.toBeNull();
        expect(feat!.type).toBe('cutout');
        expect(feat!.params.through).toBe(true);
        expect(feat!.params.fill).toBe('glass');
        expect(feat!.params.depth).toBe(18);
    });

    it('rewizja (wycięcie przelotowe edge_dims) generuje typ "cutout"', () => {
        const recipe = getOperation('rewizja')!;
        expect(recipe).toBeDefined();
        const panel = makePanel(600, 720, 18);
        const feat = buildOperationFeature(recipe, panel, 'FACE_Z_MINUS');
        expect(feat).not.toBeNull();
        expect(feat!.type).toBe('cutout');
        expect(feat!.params.through).toBe(true);
        expect(feat!.params.depth).toBe(18);
    });
});
