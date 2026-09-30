import { describe, it, expect } from 'vitest';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { PanelModel, validatePanelDimensionsNm } from '../panel-model.js';
import { buildMeshFromPanel } from '../native_core/mesh_builder.js';

describe('A4_smartpanel fail-fast wymiary formatki', () => {
    it('validatePanelDimensionsNm rzuca przy braku / zerowej grubości', () => {
        expect(() => validatePanelDimensionsNm({ width: mmToNm(600), height: mmToNm(720), thickness: 0 }))
            .toThrow(/Nieprawidłowe wymiary/);
        expect(() => validatePanelDimensionsNm({ width: mmToNm(600), height: mmToNm(720) } as any))
            .toThrow(/Nieprawidłowe wymiary/);
    });

    it('PanelModel wymaga jawnych width/height/thickness (brak domyślnego 18 mm)', () => {
        expect(() => new PanelModel({} as any)).toThrow(/Nieprawidłowe wymiary/);
        expect(() => new PanelModel({ width: mmToNm(600), height: mmToNm(720) } as any))
            .toThrow(/Nieprawidłowe wymiary/);

        const panel = new PanelModel({
            width: mmToNm(600),
            height: mmToNm(720),
            thickness: mmToNm(16),
        });
        expect(panel.thickness).toBe(mmToNm(16));
    });

    it('buildMeshFromPanel rzuca przy brakujących wymiarach', () => {
        expect(() => buildMeshFromPanel({ width: mmToNm(600), height: mmToNm(720) }))
            .toThrow(/Nieprawidłowe wymiary/);
    });
});
