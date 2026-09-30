/**
 * A6_agd — microwave-engine.test.ts
 * Testy silnika parametrycznej kuchenki mikrofalowej B-rep.
 */

import { describe, it, expect } from 'vitest';
import { planMicrowave } from '../microwave-engine.js';
import {
    DEFAULT_MICROWAVE_PARAMS,
    isSmartApplianceContainer,
    isAppliancePart,
} from '../smart-appliance-types.js';
import { createSmartAppliance, rebuildSmartAppliance } from '../smart-appliance-core.js';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { nmToMm } from '../../A1_core/cad-math/units.js';

describe('A6_agd — Microwave Engine & B-rep Structure', () => {
    it('oblicza wysokość korpusu według reguły z piekarnikowa.html (frontHeight - nalGora - nalDol)', () => {
        const plan = planMicrowave({
            frontHeight: 380,
            nalGoraMicro: 20,
            nalDolneMicro: 8,
            frontWidth: 595,
            frontDepth: 20,
            corpusWidth: 560,
            corpusDepth: 320,
        });

        // 380 - 20 - 8 = 352
        expect(plan.corpusHeight).toBe(352);
        expect(plan.parts.length).toBe(2);

        const corpus = plan.parts.find((p) => p.role === 'APPLIANCE_CORPUS');
        const front = plan.parts.find((p) => p.role === 'APPLIANCE_FRONT');

        expect(corpus).toBeDefined();
        expect(front).toBeDefined();

        // Wymiary korpusu
        expect(corpus!.dim.x).toBe(560);
        expect(corpus!.dim.y).toBe(320);
        expect(corpus!.dim.z).toBe(352);
        // Baza korpusu Z=0 (dolna krawędź oparta o wieniec, środek Z = 352/2 = 176)
        expect(corpus!.loc.z).toBe(176);
        // W trybie wolnostojącym: całkowite D = 320 + 20 = 340. Lico = -150. Środek korpusu = -150 + 160 = +10.
        expect(corpus!.loc.y).toBe(10);

        // Wymiary frontu
        expect(front!.dim.x).toBe(595);
        expect(front!.dim.y).toBe(20);
        expect(front!.dim.z).toBe(380);
        // Środek frontu Z: (380/2) - 8 = 190 - 8 = 182
        expect(front!.loc.z).toBe(182);
        // Środek frontu Y = -150 - 10 = -160 (od -170 do -150)
        expect(front!.loc.y).toBe(-160);

        // Taksonomia: excludeFromProduction dla ochrony przed piłą / CAM
        expect(corpus!.custom_properties.excludeFromProduction).toBe(true);
        expect(front!.custom_properties.excludeFromProduction).toBe(true);
    });

    it('w trybie zadokowanym we wnęce (bayDepth) chowa korpus do wnęki i wysuwa front na zewnątrz', () => {
        const plan = planMicrowave({
            frontHeight: 380,
            nalGoraMicro: 20,
            nalDolneMicro: 8,
            frontWidth: 595,
            frontDepth: 20,
            corpusWidth: 560,
            corpusDepth: 320,
            bayDepth: 540,
        });

        const corpus = plan.parts.find((p) => p.role === 'APPLIANCE_CORPUS')!;
        const front = plan.parts.find((p) => p.role === 'APPLIANCE_FRONT')!;

        // Wnęka o głębokości 540 mm (od -270 do +270). Lico przodu to Y = -270.
        // Korpus wchodzi w głąb wnęki (+Y): od -270 do -270 + 320 = +50 mm (środek: -110 mm)
        expect(corpus.loc.y).toBe(-110);
        // Front wysuwa się na zewnątrz (-Y): od -290 do -270 mm (środek: -280 mm)
        expect(front.loc.y).toBe(-280);
    });

    it('tworzy strukturę kontenera z 2 panelami B-rep w dokumencie CAD', () => {
        const doc = new ProjectDocument();
        const node = createSmartAppliance({
            kind: 'MICROWAVE',
            params: {
                frontHeight: 380,
                nalGoraMicro: 20,
                nalDolneMicro: 8,
            },
        }, doc);

        expect(node).toBeDefined();
        expect(isSmartApplianceContainer(node!.domainData)).toBe(true);

        const children = node!.children;
        expect(children.length).toBe(2);

        for (const child of children) {
            expect(child.nodeType).toBe('PART');
            const panel = child.domainData as any;
            expect(isAppliancePart(panel)).toBe(true);
            expect(panel.custom_properties.excludeFromProduction).toBe(true);
        }

        const frontChild = children.find((c: any) => c.domainData?.role === 'APPLIANCE_FRONT');
        const corpusChild = children.find((c: any) => c.domainData?.role === 'APPLIANCE_CORPUS');

        expect(frontChild).toBeDefined();
        expect(corpusChild).toBeDefined();

        expect(nmToMm(frontChild!.domainData.height)).toBe(380);
        expect(nmToMm(corpusChild!.domainData.height)).toBe(352);
    });

    it('reaguje na dynamiczną zmianę parametrów i aktualizuje wysokość korpusu', () => {
        const doc = new ProjectDocument();
        const node = createSmartAppliance({}, doc);
        const container = node!.domainData as any;

        // Zmiana wysokości frontu na 450 mm i nałożenia górnego na 30 mm
        container.generatorParams.frontHeight = 450;
        container.generatorParams.nalGoraMicro = 30;
        container.generatorParams.nalDolneMicro = 10;

        rebuildSmartAppliance(container, doc);

        // Nowa wysokość korpusu: 450 - 30 - 10 = 410 mm
        const corpusChild = node!.children.find((c: any) => c.domainData?.role === 'APPLIANCE_CORPUS');
        expect(nmToMm(corpusChild!.domainData.height)).toBe(410);

        const frontChild = node!.children.find((c: any) => c.domainData?.role === 'APPLIANCE_FRONT');
        expect(nmToMm(frontChild!.domainData.height)).toBe(450);
    });

    it('używa krótkich nazw bez ozdobników (Mikrofala / Piekarnik)', () => {
        const doc = new ProjectDocument();
        const microNode = createSmartAppliance({ kind: 'MICROWAVE' }, doc);
        expect(microNode!.name).toBe('Mikrofala');

        const ovenNode = createSmartAppliance({ kind: 'OVEN' }, doc);
        expect(ovenNode!.name).toBe('Piekarnik');
    });
});
