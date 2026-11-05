import { describe, it, expect, vi } from 'vitest';
import { PanelModel } from '../panel-model.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import { ReportDataNormalizer } from '../../R1_reports/report-data-normalizer.js';
import { extractNestingPayload } from '../../src/module-data/cad-extract.js';

describe('Formatka Grain Rotation (Obrót usłojenia)', () => {
    it('PanelModel toggles rotate_grain and emits grainChanged event', () => {
        const panel = new PanelModel({
            width: mmToNm(400),
            height: mmToNm(720),
            thickness: mmToNm(18),
            role: 'FRONT',
            name: 'Front Szafki'
        });

        expect(panel.rotate_grain).toBe(false);

        const listener = vi.fn();
        panel.onChange(listener);

        // Pierwszy obrót (w poprzek / 90°)
        const res1 = panel.toggleGrainDirection();
        expect(res1).toBe(true);
        expect(panel.rotate_grain).toBe(true);
        expect(panel.custom_properties.rotate_grain).toBe(true);
        expect(listener).toHaveBeenCalledWith('grainChanged', { rotate_grain: true });

        // Drugi obrót (przywrócenie wzdłużnego)
        const res2 = panel.toggleGrainDirection();
        expect(res2).toBe(false);
        expect(panel.rotate_grain).toBe(false);
        expect(panel.custom_properties.rotate_grain).toBe(false);
        expect(listener).toHaveBeenCalledWith('grainChanged', { rotate_grain: false });
    });

    it('serializes and deserializes rotate_grain in toJSON and fromJSON', () => {
        const panel = new PanelModel({
            width: mmToNm(400),
            height: mmToNm(720),
            thickness: mmToNm(18),
        });
        panel.rotate_grain = true;

        const json = panel.toJSON();
        expect(json.rotate_grain).toBe(true);

        const restored = new PanelModel({
            width: mmToNm(100),
            height: mmToNm(100),
            thickness: mmToNm(18)
        });
        restored.fromJSON(json);
        expect(restored.rotate_grain).toBe(true);
    });

    it('swaps length_mm and width_mm in cutting reports when grain is rotated', () => {
        const panelNormal = new PanelModel({
            width: mmToNm(400),
            height: mmToNm(720),
            thickness: mmToNm(18),
            role: 'FRONT'
        });

        const contractNormal = ReportDataNormalizer.buildContractFromPanel(panelNormal);
        expect(contractNormal).not.toBeNull();
        // Standardowo długość po słoju to dłuższy bok (720), szerokość to 400
        expect(contractNormal!.length_mm).toBe(720);
        expect(contractNormal!.width_mm).toBe(400);
        expect(contractNormal!.rotate_grain).toBeUndefined();

        const panelRotated = new PanelModel({
            width: mmToNm(400),
            height: mmToNm(720),
            thickness: mmToNm(18),
            role: 'FRONT'
        });
        panelRotated.toggleGrainDirection();

        const contractRotated = ReportDataNormalizer.buildContractFromPanel(panelRotated);
        expect(contractRotated).not.toBeNull();
        // Przy obrocie usłojenia o 90°: wymiar wzdłuż usłojenia staje się 400, a w poprzek 720!
        expect(contractRotated!.length_mm).toBe(400);
        expect(contractRotated!.width_mm).toBe(720);
        expect(contractRotated!.rotate_grain).toBe(true);
    });

    it('updates Nesting parts with rotated dimensions and locks rotation (canRotate=false)', () => {
        const panelRotated = new PanelModel({
            width: mmToNm(400),
            height: mmToNm(720),
            thickness: mmToNm(18),
            role: 'FRONT',
            id: 'panel_front_1'
        });
        panelRotated.rotate_grain = true;

        const mockDoc = {
            rootNode: {
                children: [
                    {
                        id: 'panel_front_1',
                        domainData: panelRotated,
                        nodeType: 'PART',
                    }
                ]
            },
            findNode: (id: string) => (id === 'panel_front_1' ? { id, domainData: panelRotated } : null)
        };

        const payload = extractNestingPayload({ type: 'PROJECT', id: 'p1', name: 'Projekt' }, mockDoc as any);
        expect(payload.parts.length).toBe(1);

        const nestingPart = payload.parts[0];
        // Wymiar wzdłuż słoja arkusza: 400, w poprzek: 720
        expect(nestingPart.width).toBe(400);
        expect(nestingPart.height).toBe(720);
        // Obrót zablokowany, aby piła/nesting nie obróciła formatki z powrotem
        expect(nestingPart.canRotate).toBe(false);
        expect(nestingPart.grain).toBe('horizontal');
    });
});

