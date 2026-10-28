/**
 * A6_agd — fridge-engine.test.ts
 * Testy silnika parametrycznej lodówki do zabudowy z komponentami AGD (drzwi, uszczelki, cokół, korpus).
 */

import { describe, it, expect } from 'vitest';
import {
    planFridge,
    FRIDGE_DOOR_WHITE_COLOR,
    FRIDGE_DOOR_INOX_COLOR,
    FRIDGE_GASKET_COLOR,
    FRIDGE_CORPUS_COLOR,
} from '../fridge-engine.js';
import {
    DEFAULT_FRIDGE_PARAMS,
    isSmartApplianceContainer,
    isAppliancePart,
} from '../smart-appliance-types.js';
import { createSmartAppliance, rebuildSmartAppliance } from '../smart-appliance-core.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContainerModel } from '../../A1_core/container-model.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('A6_agd — Fridge Engine & Realistic Components Structure', () => {
    it('oblicza geometrię lodówki: wysokość całkowita jako parametr wejściowy, front górny wyliczany automatycznie', () => {
        const plan = planFridge({
            totalHeight: 1775,
            frontBottomHeight: 714,
            doorGap: 15,
            doorDepth: 45,
            plinthHeight: 40,
            corpusWidth: 550,
            corpusDepth: 545,
            finish: 'WHITE',
        });

        // Wysokość całkowita zadana = 1775 mm
        expect(plan.corpusHeight).toBe(1775);
        // Wyliczony front górny: 1775 - 40 - 714 - 15 = 1006 mm
        expect(plan.frontTopHeight).toBe(1006);
        expect(plan.parts.length).toBe(6);

        const corpus = plan.parts.find((p) => p.custom_properties.partKey === 'corpus');
        const plinth = plan.parts.find((p) => p.custom_properties.partKey === 'plinth');
        const doorBottom = plan.parts.find((p) => p.custom_properties.partKey === 'door_bottom');
        const doorTop = plan.parts.find((p) => p.custom_properties.partKey === 'door_top');
        const gasketBottom = plan.parts.find((p) => p.custom_properties.partKey === 'gasket_bottom');
        const gasketTop = plan.parts.find((p) => p.custom_properties.partKey === 'gasket_top');

        expect(corpus).toBeDefined();
        expect(plinth).toBeDefined();
        expect(doorBottom).toBeDefined();
        expect(doorTop).toBeDefined();
        expect(gasketBottom).toBeDefined();
        expect(gasketTop).toBeDefined();

        // Role komponentów AGD (nie meblowe formatki)
        expect(corpus!.role).toBe('APPLIANCE_CORPUS');
        expect(doorBottom!.role).toBe('APPLIANCE_DOOR');
        expect(doorTop!.role).toBe('APPLIANCE_DOOR');
        expect(gasketBottom!.role).toBe('APPLIANCE_GASKET');
        expect(gasketTop!.role).toBe('APPLIANCE_GASKET');
        expect(plinth!.role).toBe('APPLIANCE_PLINTH');

        // Gabaryty korpusu (wsuwany w głąb wnęki)
        expect(corpus!.dim.x).toBe(550);
        expect(corpus!.dim.y).toBe(545);
        expect(corpus!.dim.z).toBe(1775);

        // Gabaryty i pozycje drzwi lodówki (szerokość = szerokość lodówki 550 mm)
        expect(doorBottom!.dim.x).toBe(550);
        expect(doorBottom!.dim.z).toBe(714);
        expect(doorBottom!.loc.z).toBe(40 + 714 / 2); // cokół 40 + połowa drzwi

        expect(doorTop!.dim.x).toBe(550);
        expect(doorTop!.dim.z).toBe(1006);
        // Spód górnych drzwi: 40 + 714 + 15 = 769. Środek: 769 + 1006 / 2 = 769 + 503 = 1272
        expect(doorTop!.loc.z).toBe(1272);

        // Kolorystyka: cała lodówka (korpus i drzwi) w wybranym kolorze wykończenia
        expect(doorBottom!.color).toEqual(FRIDGE_DOOR_WHITE_COLOR);
        expect(gasketBottom!.color).toEqual(FRIDGE_GASKET_COLOR);
        expect(corpus!.color).toEqual(FRIDGE_DOOR_WHITE_COLOR);

        // Taksonomia: ochrona przed CAM / cięciem
        plan.parts.forEach((p) => {
            expect(p.custom_properties.excludeFromProduction).toBe(true);
            expect(p.custom_properties.isComponent).toBe(true);
            expect(p.custom_properties.applianceType).toBe('FRIDGE');
        });
    });

    it('obsługuje wykończenie INOX (stal szlachetna)', () => {
        const plan = planFridge({
            totalHeight: 1800,
            doorLayout: 'TOP_BOTTOM',
            frontBottomHeight: 650,
            doorGap: 20,
            plinthHeight: 40,
            corpusWidth: 550,
            corpusDepth: 545,
            finish: 'INOX',
        });

        // 1800 - 40 - 650 - 20 = 1090 mm
        expect(plan.frontTopHeight).toBe(1090);
        const doorBottom = plan.parts.find((p) => p.custom_properties.partKey === 'door_bottom');
        const doorTop = plan.parts.find((p) => p.custom_properties.partKey === 'door_top');
        const corpus = plan.parts.find((p) => p.custom_properties.partKey === 'corpus');
        expect(doorBottom!.color).toEqual(FRIDGE_DOOR_INOX_COLOR);
        expect(doorTop!.color).toEqual(FRIDGE_DOOR_INOX_COLOR);
        expect(corpus!.color).toEqual(FRIDGE_DOOR_INOX_COLOR);
    });

    it('tworzy strukturę CADNode i komponenty B-rep dla FRIDGE ze zmianą wysokości całkowitej', () => {
        const doc = new ProjectDocument();
        const node = createSmartAppliance({
            kind: 'FRIDGE',
            name: 'Lodowka Pod Zabudowe',
            params: {
                totalHeight: 1775,
                doorLayout: 'TOP_BOTTOM',
                isFreestanding: false,
                frontBottomHeight: 714,
                doorGap: 15,
                plinthHeight: 40,
                corpusWidth: 550,
                corpusDepth: 545,
                doorDepth: 45,
            },
        }, doc);

        expect(node).toBeDefined();
        const container = node!.domainData as ContainerModel;
        expect(isSmartApplianceContainer(container)).toBe(true);
        expect(container.generatorParams.kind).toBe('FRIDGE');

        // Sprawdź dzieci (6 komponentów B-rep: korpus, cokół, 2x drzwi, 2x uszczelka)
        const parts = node!.children.map((c: any) => c.domainData);
        expect(parts.length).toBe(6);
        parts.forEach((p: any) => {
            expect(isAppliancePart(p)).toBe(true);
            expect(p.custom_properties.excludeFromProduction).toBe(true);
            expect(p.custom_properties.isComponent).toBe(true);
        });

        // Wymiary kontenera = 1775 mm
        expect(nmToMm(container.height)).toBe(1775);
        expect(nmToMm(container.width)).toBe(550);

        // Zmiana wysokości dolnych drzwi na 720:
        // Drzwi górne wyliczą się: 1775 - 40 - 720 - 15 = 1000 mm
        container.generatorParams.frontBottomHeight = 720;
        rebuildSmartAppliance(container, doc);

        expect(nmToMm(container.height)).toBe(1775);
        const updatedBottom = node!.children.find((c: any) => c.domainData.custom_properties.partKey === 'door_bottom');
        const updatedTop = node!.children.find((c: any) => c.domainData.custom_properties.partKey === 'door_top');
        expect(nmToMm(updatedBottom.domainData.height)).toBe(720);
        expect(nmToMm(updatedTop.domainData.height)).toBe(1000);
    });

    it('obsługuje lodówkę wolnostojącą z dwoma drzwiami w pionie (Side-by-Side)', () => {
        const plan = planFridge({
            totalHeight: 1850,
            corpusWidth: 900,
            corpusDepth: 650,
            doorDepth: 50,
            plinthHeight: 45,
            doorGap: 10,
            doorLayout: 'SIDE_BY_SIDE',
            isFreestanding: true,
            finish: 'INOX',
            frontBottomHeight: 714,
        });

        expect(plan.corpusHeight).toBe(1850);
        // Sprawdź drzwi lewe i prawe (podział pionowy):
        // Szerokość skrzydła: (900 - 10) / 2 = 445 mm
        const doorLeft = plan.parts.find((p) => p.custom_properties.partKey === 'door_left');
        const doorRight = plan.parts.find((p) => p.custom_properties.partKey === 'door_right');
        const handleLeft = plan.parts.find((p) => p.custom_properties.partKey === 'handle_left');
        const handleRight = plan.parts.find((p) => p.custom_properties.partKey === 'handle_right');

        expect(doorLeft).toBeDefined();
        expect(doorRight).toBeDefined();
        expect(doorLeft!.dim.x).toBe(445);
        expect(doorRight!.dim.x).toBe(445);
        expect(doorLeft!.dim.z).toBe(1850 - 45); // 1805 mm
        expect(doorRight!.dim.z).toBe(1805);

        // Uchwyty relingowe dla wolnostojącej
        expect(handleLeft).toBeDefined();
        expect(handleRight).toBeDefined();
        expect(handleLeft!.role).toBe('APPLIANCE_HANDLE');
        expect(handleRight!.role).toBe('APPLIANCE_HANDLE');
    });
});
