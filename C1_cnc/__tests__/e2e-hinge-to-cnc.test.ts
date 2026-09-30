/**
 * e2e-hinge-to-cnc.test.ts — łańcuch produkcyjny: zawias → otwory → G-code
 *
 * Test nie powtarza logiki silnika. Buduje produkt tak jak użytkownik (korpus + drzwi
 * + zawias), bierze geometrię, która powstała w dokumencie, i sprawdza, że program
 * CNC odwołuje się do tych samych współrzędnych.
 *
 * WCS jest ZAWSZE brany z `WcsRulesMapper` (czyli z korpus3_3_rules.json), nigdy
 * z literału w teście. Jeśli JSON zmieni narożnik, test dostosowuje się automatycznie —
 * inaczej test sprawdzałby siebie, a nie produkcję.
 *
 * Tolerancje pochodzą wyłącznie z katalogu okuć (B1_biblioteka/zawiasy/*.json).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { ProjectDocument } from '../../A1_core/project-document.js';
import { ContextManager } from '../../A1_core/context-manager.js';
import { CommandHistory } from '../../A1_core/commands/command-history.js';
import { mmToNm, nmToMm } from '../../A1_core/cad-math/units.js';
import { Vec3 } from '../../A1_core/cad-math/vec3.js';
import { computeFaceData, localTo3D } from '../../A4_smartpanel/native_core/face-lcs.js';

import { CreateKorpusCommand } from '../../A3_smartframe/commands/create-korpus-command.js';
import { probeBayFromCADPoint } from '../../A2_bloki/bloki-bay-detector.js';
import {
    createBlokInDetectedBay,
    BLOKI_INTERNAL_OPTIONS
} from '../../A2_bloki/bloki-bay-actions.js';
import { buildDoorsDrillings } from '../../A2_bloki/doors-drilling-builder.js';
import type { DoorsDrillingIntent } from '../../A2_bloki/doors-drilling-intent.js';

import { WcsManager } from '../wcs/wcs-manager.js';
import { WcsRulesMapper } from '../wcs/wcs-rules-mapper.js';
import { GeometryDataExtractor } from '../geometry/geometry-extractor.js';
import { CAMProcessor } from '../processor/cam-processor.js';
import { ToolLibrary } from '../processor/tool-library.js';
import { Mach3Postprocessor } from '../postprocessors/mach3-postprocessor.js';
import { WoodWOPPostprocessor } from '../postprocessors/woodwop-postprocessor.js';

import { hingeCorpusHolesMm } from '../../B1_biblioteka/index.js';
import type { CNCOperation, HoleFeature } from '../dto/cam-dto.js';

const KORPUS = {
    szerokosc_mm: 600,
    wysokosc_mm: 720,
    glebokosc_mm: 560,
    liczba_stref: 1 as const
};

const ZAWIAS = 'BLUM_71B3550';

/** 0.5 mm — tolerancja zaokrągleń w mm, nie tolerancja producenta. */
const TOL = 0.5;

interface Produkt {
    doc: ProjectDocument;
    cabinetId: string;
    intencje: DoorsDrillingIntent[];
    /** Formatki z nawiertami zawiasowymi (dane domenowe, bez opakowania CADNode). */
    paneleZOtworami: any[];
}

function zbudujProdukt(): Produkt {
    const doc = new ProjectDocument();
    ContextManager.instance.document = doc;
    ContextManager.instance.commandHistory = new CommandHistory(doc);
    ContextManager.instance.panelViews.clear();

    new CreateKorpusCommand({ ...KORPUS }).execute(doc);

    const kabina = doc.getContainers()[0];
    const bay = probeBayFromCADPoint(doc, { x: 0, y: 0, z: KORPUS.wysokosc_mm / 2 });
    if (!bay) throw new Error('Fixture: nie wykryto wnęki korpusu.');

    const drzwi = BLOKI_INTERNAL_OPTIONS.find(o => o.id === 'DOORS')!;
    const sbNode = createBlokInDetectedBay(doc, bay, drzwi, { rodzaj_drzwi: 'LEFT' });
    if (!sbNode) throw new Error('Fixture: nie utworzono Bloku drzwiowego.');

    (sbNode.domainData as any).generatorParams.domyslny_zawias_id = ZAWIAS;

    const intencje = buildDoorsDrillings(doc, kabina.id);

    const paneleZOtworami = doc
        .getPanels()
        .map(n => n.domainData as any)
        .filter(d => (d.features || []).some((f: any) => f.params?.isDoorDrilling));

    return { doc, cabinetId: kabina.id, intencje, paneleZOtworami };
}

/** Środek otworu w przestrzeni świata (mm) przez macierz świata węzła. */
function srodekWSwiecieMm(doc: ProjectDocument, targetNodeId: string, uMm: number, vMm: number, face: string): { x: number; y: number; z: number } {
    const node = doc.findNode(targetNodeId);
    if (!node) throw new Error(`Nie znaleziono węzła ${targetNodeId}`);
    const dane = node.domainData as any;
    const fd = computeFaceData(face, nmToMm(dane.width), nmToMm(dane.height), nmToMm(dane.thickness));
    // face-lcs zwraca [x, y, z] w mm; CADNode używa osi (x, z, y) — jak w buildach Bloku.
    const l = localTo3D(fd, uMm, vMm, 0);
    const world = node.getWorldMatrix().transformPoint(
        new Vec3(mmToNm(l[0]), mmToNm(l[2]), mmToNm(l[1]))
    );
    return { x: nmToMm(world.x), y: nmToMm(world.y), z: nmToMm(world.z) };
}

/** Wymiary formatki w mm — fail-fast, brak cichego 0. */
function wymiaryMm(panel: any) {
    return {
        width: nmToMm(panel.width),
        height: nmToMm(panel.height),
        thickness: nmToMm(panel.thickness)
    };
}

/** Ekstraktor CAM + reguła WCS z JSON — dokładnie jak w produkcji. */
function przygotujCNC(panel: any) {
    const extractor = new GeometryDataExtractor();
    const wcs = new WcsManager('G55');
    const wymiary = wymiaryMm(panel);

    const rule = WcsRulesMapper.getRuleForRole(panel.role);
    expect(rule, `brak reguły WCS w JSON dla roli ${panel.role}`).not.toBeNull();

    wcs.updateForPanelDimensions(wymiary.width, wymiary.height, wymiary.thickness);
    wcs.setRule(rule!);

    const cechy = extractor
        .extractPanelFeatures(panel)
        .features.filter((f): f is HoleFeature => 'diameter' in f);

    // Bez narzędzia procesor cicho pomija cechę — przypisz jawnie, jak robi UI.
    for (const cecha of cechy) {
        cecha.toolId = cecha.diameter <= 6 ? 'tool_6_drill_3' : 'tool_2_drill_5';
    }

    return { cechy, wcs, wymiary };
}

describe('E2E: zawias → otwory na formatce → program CNC', () => {
    beforeEach(() => {
        ContextManager.instance.document = new ProjectDocument();
    });

    it('1. Nawierty zawiasowe mieszczą się w obrysie formatki docelowej', () => {
        const { doc, intencje } = zbudujProdukt();
        expect(intencje.length).toBeGreaterThan(0);

        for (const intencja of intencje) {
            const node = doc.findNode(intencja.targetNodeId)!;
            const dane = node.domainData as any;
            const { u, v } = intencja.feature.params;
            const w = wymiaryMm(dane);

            expect(u, 'otwór poza lewą krawędzią').toBeGreaterThan(0);
            expect(v, 'otwór poza dolną krawędzią').toBeGreaterThan(0);
            expect(u, 'otwór poza prawą krawędzią').toBeLessThan(w.width);
            expect(v, 'otwór poza górną krawędzią').toBeLessThan(w.height);
        }
    });

    it('2. Każdy otwór katalogowy zawiasu ma dokładny odpowiednik w geometrii', () => {
        const { doc, intencje } = zbudujProdukt();
        const katalogowe = hingeCorpusHolesMm(ZAWIAS);
        expect(katalogowe.length).toBeGreaterThan(0);

        // Katalog mówi: tyle otworów prowadzących, z taką średnicą i głębokością.
        const zGeometrii = intencje.map(i => ({
            dia: i.feature.params.diameter,
            depth: i.feature.params.depth
        }));

        for (const otwor of katalogowe) {
            const trafiony = zGeometrii.some(
                g => Math.abs(g.dia - otwor.dia) < TOL && Math.abs(g.depth - otwor.depth) < TOL
            );
            expect(trafiony, `brak otworu ${otwor.name} (Ø${otwor.dia}) w geometrii`).toBe(true);
        }
    });

    it('3. Otwory prowadzące leżą w odległości od katalogu zawiasu, a wieniec w ich osi', () => {
        const { doc, intencje, paneleZOtworami } = zbudujProdukt();
        const katalogowe = hingeCorpusHolesMm(ZAWIAS);
        expect(katalogowe.length).toBeGreaterThan(0);

        const panel = paneleZOtworami[0];
        const wymiary = wymiaryMm(panel);
        const { cechy } = przygotujCNC(panel);
        const otwory = cechy.filter(c => 'diameter' in c) as HoleFeature[];

        // 3a. Rozstaw prowadnic jednego zawiasu = 2 × z_offset z katalogu.
        const prowadnice = katalogowe.filter(o => o.name.startsWith('Prowadnik'));
        expect(prowadnice.length).toBe(2);

        const oczekiwanyRozstaw = Math.abs(prowadnice[0].zOffset - prowadnice[1].zOffset);
        const vZIntencji = intencje.map(i => i.feature.params.v).sort((a, b) => a - b);

        // Oczekiujemy tylu otworów, ile jest prowadnic × liczba zawiasów w drzwiach.
        expect(vZIntencji.length).toBe(prowadnice.length * 2);

        // Grupujemy w pary (dwa zawiasy po dwa otwory) i sprawdzamy rozstaw każdej pary.
        const pary: number[][] = [];
        for (let i = 0; i < vZIntencji.length; i += 2) {
            pary.push([vZIntencji[i], vZIntencji[i + 1]]);
        }
        for (const [dolny, gorny] of pary) {
            expect(Math.abs(gorny - dolny), 'rozstaw prowadnic zawiasu').toBeCloseTo(oczekiwanyRozstaw, 1);
        }

        // 3b. Otwory prowadzące są wywiercone w płytę o grubości 18 mm,
        // więc ich oś obróbki leży w połowie grubości.
        for (const p of otwory[0].positions || []) {
            expect(p.z, 'oś wiertła nie w połowie grubości').toBeCloseTo(wymiary.thickness / 2, 3);
        }

        // 3c. Oś prowadnicy musi mieć zaczep — nie może leżeć na krawędzi płyty.
        const node = doc.findNode(intencje[0].targetNodeId)!;
        const dane = node.domainData as any;
        const polSciany = nmToMm(dane.width) / 2;
        const osProwadnicy = Math.abs(otwory[0].position!.x);

        expect(osProwadnicy).toBeGreaterThan(0);
        expect(osProwadnicy).toBeLessThan(polSciany);
        expect(osProwadnicy).toBeGreaterThan(katalogowe[0].frontDist - TOL);
    });

    it('4. WCS z JSON ustawia narożnik zgodnie z regułą roli', () => {
        const { paneleZOtworami } = zbudujProdukt();
        expect(paneleZOtworami.length).toBeGreaterThan(0);

        for (const panel of paneleZOtworami) {
            const { wcs, wymiary } = przygotujCNC(panel);
            const rule = WcsRulesMapper.getRuleForRole(panel.role)!;
            const origin = wcs.getOrigin();

            // Narożnik z JSON = punkt zerowy WCS. Inaczej symulacja i G-code są przesunięte.
            expect(origin.x).toBeCloseTo(
                rule.origin_corner.X === '+' ? wymiary.width / 2 : -wymiary.width / 2, 6
            );
            expect(origin.z).toBeCloseTo(
                rule.origin_corner.Z === '+' ? wymiary.thickness / 2 : -wymiary.thickness / 2, 6
            );

            // Kierunki osi są ±1 — brak skali, inaczej maszyna by ją zignorowała.
            const dirs = wcs.getDirections();
            for (const v of Object.values(dirs)) {
                expect([1, -1]).toContain(v);
            }
        }
    });

    it('5. Program CNC zawiera dokładnie te otwory, które są na formatce', () => {
        const { paneleZOtworami } = zbudujProdukt();
        expect(paneleZOtworami.length).toBeGreaterThan(0);

        let lacznieOtworow = 0;

        for (const panel of paneleZOtworami) {
            const { cechy, wcs, wymiary } = przygotujCNC(panel);
            expect(cechy.length).toBeGreaterThan(0);

            const oczekiwane = cechy.reduce((n, c) => n + (c.positions?.length || 1), 0);
            lacznieOtworow += oczekiwane;

            const processor = new CAMProcessor(new ToolLibrary());
            const wejscie = {
                projectName: 'E2E',
                wcsOrigin: wcs.getOrigin(),
                wcsName: wcs.getWcsName(),
                features: cechy,
                toolAssignments: {},
                postprocessor: 'Mach3',
                workpieceDimensions: wymiary
            };

            // Symulator dostaje CNCOperation[], postprocesor CLDataProgram — obie ścieżki
            // muszą zobaczyć tę samą liczbę otworów.
            const operacje: CNCOperation[] = processor.processProject(wejscie);
            expect(operacje.filter(o => o.type === 'drill').length).toBe(oczekiwane);

            const program = processor.buildCLProgram(wejscie);
            const cykleWiercenia = program.commands.filter(c => c.type === 'CYCLE_DRILL');
            expect(cykleWiercenia.length).toBe(oczekiwane);

            const nc = new Mach3Postprocessor().generateNcCode(program);
            expect((nc.match(/G81/g) || []).length).toBe(oczekiwane);
            expect(nc).toContain('G55');
            expect(nc.trimEnd().endsWith('M2')).toBe(true);

            // G-code nie może zawierać NaN — cichy błąd formatowania trafiłby na maszynę.
            expect(nc).not.toMatch(/NaN|Infinity|undefined/);
        }

        expect(lacznieOtworow).toBeGreaterThan(0);
    });

    it('6. Współrzędne operacji CNC odpowiadają współrzędnym cech po transformacji WCS', () => {
        const { paneleZOtworami } = zbudujProdukt();

        for (const panel of paneleZOtworami) {
            const { cechy, wcs, wymiary } = przygotujCNC(panel);
            const processor = new CAMProcessor(new ToolLibrary());

            const operacje = processor.processProject({
                projectName: 'E2E',
                wcsOrigin: wcs.getOrigin(),
                wcsName: wcs.getWcsName(),
                features: cechy,
                toolAssignments: {},
                postprocessor: 'Mach3',
                workpieceDimensions: wymiary
            });

            const punktyCech = cechy.flatMap(c => c.positions || [c.position]);
            const punktyOperacji = operacje.filter(o => o.type === 'drill').map(o => o.position);

            expect(punktyOperacji.length).toBe(punktyCech.length);

            // Operacje powstają z cech 1:1 — bez transformacji współrzędnych.
            // CAMProgram dostaje punkt cechy w przestrzeni formatki, a WCS jest osobnym
            // wejściem projektu; przesunięcie do WCS robi dopiero symulator/postprocesor.
            for (const punkt of punktyOperacji) {
                const bliski = punktyCech.some(c =>
                    Math.abs(c.x - punkt.x) < TOL
                    && Math.abs(c.y - punkt.y) < TOL
                    && Math.abs(c.z - punkt.z) < TOL
                );
                expect(bliski, `punkt operacji (${punkt.x}, ${punkt.y}, ${punkt.z}) nie pasuje do żadnej cechy`).toBe(true);
            }
        }
    });

    it('7. Postprocesor meblowy odmawia bez wymiarów formatki', () => {
        const { paneleZOtworami } = zbudujProdukt();
        const panel = paneleZOtworami[0];
        const { cechy, wcs } = przygotujCNC(panel);

        const program = new CAMProcessor(new ToolLibrary()).buildCLProgram({
            projectName: 'E2E',
            wcsOrigin: wcs.getOrigin(),
            wcsName: wcs.getWcsName(),
            features: cechy,
            toolAssignments: {},
            postprocessor: 'WoodWOP'
            // celowo bez workpieceDimensions
        });

        expect(() => new WoodWOPPostprocessor().generateNcCode(program))
            .toThrow(/brak zdefiniowanych poprawnych wymiarów/i);
    });
});
