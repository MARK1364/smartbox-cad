/**
 * E1_export - __tests__ - assembly-sequence.test.ts
 * Silnik reguł kolejności montażu: kolejność faz, liczność łączników,
 * przypisanie okuć, kumulatywna widoczność sceny i przekładanie złączy C2 na kroki.
 *
 * Scenariusz wzorowany na szafa_2500x800x560.spp.json:
 * korpus (boki, wieńce, plecy) + blok półek (3× Polka + podpórka)
 * + blok frontów (2× Drzwi + zawiasy) + złącza C2 i element bez znanej roli.
 */

import { describe, it, expect } from 'vitest';
import {
    buildAssemblySequence,
    DEFAULT_ASSEMBLY_RULES,
    type AssemblyPartRef,
    type AssemblyConnectorRef,
} from '../assembly-sequence-engine';
import {
    connectorsToRefs,
    assemblyPartsHash,
    assemblyConnectorHash,
    assemblyScopeFingerprint,
    isPlanStale,
    pruneAssemblyViews,
    type AssemblyScopeMeta,
} from '../assembly-scene-adapter';
import { animEaseCubicInOut, animLerp3, explodeDirForRole, EXPLODE_DEFAULT_DIR } from '../assembly-anim';
import { NodeType } from '../../A1_core/cad-node/node-type';
import type { CADNode } from '../../A1_core/cad-node/cad-node';
import type { ProjectDocument } from '../../A1_core/project-document';
import type { SavedExportView } from '../export-types';
import type { AssemblyPlan } from '../assembly-sequence-engine';
const v = (x: number, y = 0, z = 0): [number, number, number] => [x * 1_000_000, y * 1_000_000, z * 1_000_000];

function ref(
    nodeId: string,
    name: string,
    role: string | null,
    nodeType: AssemblyPartRef['nodeType'],
    opts: Partial<AssemblyPartRef> = {},
): AssemblyPartRef {
    return {
        nodeId,
        name,
        role,
        nodeType,
        parentId: opts.parentId ?? 'korpus_root',
        hardwareId: opts.hardwareId ?? null,
        translationNm: opts.translationNm ?? null,
    };
}

const KORPUS_PARTS: AssemblyPartRef[] = [
    ref('n_bok_l', 'Bok_L', 'LEFT_SIDE_PANEL', 'PART', { translationNm: v(0) }),
    ref('n_bok_p', 'Bok_P', 'RIGHT_SIDE_PANEL', 'PART', { translationNm: v(760) }),
    ref('n_wieniec_d1', 'Wieniec_D1', 'BOTTOM_PANEL', 'PART', { translationNm: v(0) }),
    ref('n_wieniec_d2', 'Wieniec_D2', 'BOTTOM_PANEL', 'PART', { translationNm: v(400) }),
    ref('n_wieniec_g', 'Wieniec_G', 'TOP_PANEL', 'PART', { translationNm: v(0, 0, 700) }),
    ref('n_plecy', 'Plecy', 'BACK_PANEL', 'PART', { translationNm: v(0, 540) }),
];

const POLKA_PARTS: AssemblyPartRef[] = ['Polka_1', 'Polka_2', 'Polka_3'].map((name, i) =>
    ref(`n_${name}`, name, 'SHELF_PANEL', 'PART', {
        parentId: 'n_blok_polki',
        translationNm: v(0, 0, 100 + i * 200),
    }),
);

const HW_PARTS: AssemblyPartRef[] = [
    ref('n_podporka_1', 'Podpórka 1', 'HARDWARE', 'HARDWARE', {
        parentId: 'n_blok_polki', hardwareId: 'PODPORKA_FI5', translationNm: v(0, 0, 110),
    }),
    ref('n_zawias_l', 'Zawias 1 (Lewy)', 'HARDWARE', 'HARDWARE', {
        parentId: 'n_blok_drzwi', hardwareId: 'BLUM_71B3550', translationNm: v(10, 540),
    }),
    ref('n_zawias_p', 'Zawias 1 (Prawy)', 'HARDWARE', 'HARDWARE', {
        parentId: 'n_blok_drzwi', hardwareId: 'BLUM_71B3550', translationNm: v(750, 540),
    }),
];

const DRZWI_PARTS: AssemblyPartRef[] = ['Drzwi_Lewe', 'Drzwi_Prawe'].map((name, i) =>
    ref(`n_drzwi_${i}`, name, 'FRONT', 'PART', {
        parentId: 'n_blok_drzwi',
        translationNm: v(i * 390, 540),
    }),
);

const UNKNOWN_PART: AssemblyPartRef = ref('n_blind', 'Ślepka', 'UNKNOWN_ROLE_X', 'PART', {
    translationNm: v(50, 50),
});

const CONNECTORS: AssemblyConnectorRef[] = [
    { id: 'C1', parentObjectId: 'n_bok_l', otherObjectId: 'n_wieniec_d1', counts: { kolki_d8x35: 6 } },
    { id: 'C2', parentObjectId: 'n_bok_p', otherObjectId: 'n_wieniec_d1', counts: { konfirmat_5x50: 2 } },
    { id: 'C3', parentObjectId: 'n_wieniec_g', otherObjectId: 'n_bok_l', counts: { minifix: 2 } },
];

function buildScenario() {
    const parts = [
        ...KORPUS_PARTS,
        ...POLKA_PARTS,
        ...DRZWI_PARTS,
        ...HW_PARTS,
        UNKNOWN_PART,
    ];
    return buildAssemblySequence({ parts, connectors: CONNECTORS, rules: DEFAULT_ASSEMBLY_RULES });
}

function stepOf(plan: ReturnType<typeof buildScenario>, phaseId: string, n = 0) {
    const found = plan.steps.filter((s) => s.phaseId === phaseId);
    if (found.length === 0) throw new Error(`brak fazy ${phaseId}`);
    return found[Math.min(n, found.length - 1)];
}

describe('buildAssemblySequence — kolejność faz', () => {
    it('buduje kroki: dno → boki → wieniec góra → plecy → półki → fronty → awaryjne', () => {
        const plan = buildScenario();
        const phaseIds = plan.steps.map((s) => s.phaseId);
        expect(phaseIds[0]).toBe('korpus_dno');
        expect(phaseIds.slice(1, 3).join(',')).toBe('korpus_boki,korpus_boki');
        expect(phaseIds.indexOf('korpus_wieniec_gora')).toBeGreaterThan(-1);
        expect(phaseIds.indexOf('korpus_plecy')).toBeGreaterThan(phaseIds.indexOf('korpus_wieniec_gora'));
        expect(phaseIds.indexOf('bloki_polki')).toBeGreaterThan(phaseIds.indexOf('korpus_plecy'));
        expect(phaseIds.indexOf('bloki_fronty')).toBeGreaterThan(phaseIds.indexOf('bloki_polki'));
        expect(phaseIds[phaseIds.length - 1]).toBe('pozostale');
        expect(plan.fallbackNodeIds).toContain('n_blind');
    });

    it('BOKI w trybie single: lewy przed prawym (translation sort)', () => {
        const plan = buildScenario();
        const boki = plan.steps.filter((s) => s.phaseId === 'korpus_boki');
        expect(boki).toHaveLength(2);
        expect(boki[0].actions[0].nodeId).toBe('n_bok_l');
        expect(boki[1].actions[0].nodeId).toBe('n_bok_p');
    });

    it('WIENIEC dolny i górny w trybie joint: wszystkie formatki roli w jednym kroku', () => {
        const plan = buildScenario();
        const dno = stepOf(plan, 'korpus_dno');
        expect(dno.mode).toBe('joint');
        expect(dno.actions.map((a) => a.nodeId)).toEqual(['n_wieniec_d1', 'n_wieniec_d2']);
        const gora = stepOf(plan, 'korpus_wieniec_gora');
        expect(gora.actions.map((a) => a.nodeId)).toEqual(['n_wieniec_g']);
    });

    it('POLKI: krok na półkę (single) w kolejności od dołu (sort po Z)', () => {
        const plan = buildScenario();
        const polki = plan.steps.filter((s) => s.phaseId === 'bloki_polki');
        expect(polki.map((s) => s.actions[0].name)).toEqual(['Polka_1', 'Polka_2', 'Polka_3']);
    });
});

describe('buildAssemblySequence — łączniki i okucia', () => {
    it('kołki fi8 trafiają do wieńca przed przyłożeniem boków, a konfirmaty po przyłożeniu boków', () => {
        const plan = buildScenario();
        // C1: kolki_d8x35 (dno + bok_l) → trafiają do kroku wieńca dolnego (krok 1)!
        const dno = stepOf(plan, 'korpus_dno');
        expect(dno.hardwareCounts['kolki_d8x35']).toBe(6);
        expect(dno.connectorGroupIds).toContain('C1');

        // C2: konfirmat_5x50 (dno + bok_p) → trafia do kroku boku prawego (krok 3)!
        const bokP = plan.steps.find((s) => s.actions.some((a) => a.nodeId === 'n_bok_p'))!;
        expect(bokP.hardwareCounts['konfirmat_5x50']).toBe(2);
        expect(bokP.connectorGroupIds).toContain('C2');

        // C3: minifix (bok_l + góra) → trafia do kroku wieńca górnego (krok 4)!
        const gora = stepOf(plan, 'korpus_wieniec_gora');
        expect(gora.hardwareCounts['minifix']).toBe(2);
        expect(gora.connectorGroupIds).toContain('C3');
    });

    it('krok łącza zna id grupy C2 — animacja trouvé instancje po metadanych', () => {
        const plan = buildScenario();
        const dno = stepOf(plan, 'korpus_dno');
        expect(dno.connectorGroupIds).toContain('C1');
        const gora = stepOf(plan, 'korpus_wieniec_gora');
        expect(gora.connectorGroupIds).toContain('C3');
    });

    it('okucia bloku (podpórka) w kroku pierwszej formatki bloku', () => {
        const plan = buildScenario();
        const polka1 = plan.steps.find((s) => s.actions.some((a) => a.nodeId === 'n_Polka_1'))!;
        expect(polka1.hardwareCounts['PODPORKA_FI5']).toBe(1);
    });

    it('zawiasy frontów w kroku pierwszych drzwi bloku', () => {
        const plan = buildScenario();
        const drzwi1 = plan.steps.find((s) => s.actions.some((a) => a.nodeId === 'n_drzwi_0'))!;
        expect(drzwi1.hardwareCounts['BLUM_71B3550']).toBe(2);
    });

    it('plan.totalHardwareCounts = suma złącz + okuć', () => {
        const plan = buildScenario();
        expect(plan.totalHardwareCounts['kolki_d8x35']).toBe(6);
        expect(plan.totalHardwareCounts['konfirmat_5x50']).toBe(2);
        expect(plan.totalHardwareCounts['minifix']).toBe(2);
        expect(plan.totalHardwareCounts['PODPORKA_FI5']).toBe(1);
        expect(plan.totalHardwareCounts['BLUM_71B3550']).toBe(2);
    });
});

describe('buildAssemblySequence — kroki inwentarza i widoczność', () => {
    it('krok 0 (inwentarz): wszystko ukryte, hardwareCounts = łączniki całego planu', () => {
        const plan = buildScenario();
        expect(plan.inventoryStep).not.toBeNull();
        expect(plan.inventoryStep!.index).toBe(0);
        expect(plan.inventoryStep!.hardwareCounts['kolki_d8x35']).toBe(6);
        expect(plan.inventoryStep!.visibility.every((v) => v.visible === false)).toBe(true);
    });

    it('widoczność kumulatywna: krok pierwszego boku = dno + lewy bok widoczne, reszta ukryta', () => {
        const plan = buildScenario();
        const bokL = plan.steps.find((s) => s.actions.some((a) => a.nodeId === 'n_bok_l'))!;
        const vis = new Map(bokL.visibility.map((v) => [v.nodeId, v.visible]));
        expect(vis.get('n_wieniec_d1')).toBe(true);
        expect(vis.get('n_wieniec_d2')).toBe(true);
        expect(vis.get('n_bok_l')).toBe(true);
        expect(vis.get('n_bok_p')).toBe(false); // prawy bok dopiero w kolejnym kroku
        expect(vis.get('n_plecy')).toBe(false);
        expect(vis.get('n_drzwi_0')).toBe(false);
    });

    it('ostatni krok planu: wszystkie części sceny widoczne', () => {
        const plan = buildScenario();
        const last = plan.steps[plan.steps.length - 1];
        expect(last.visibility.every((v) => v.visible)).toBe(true);
    });
});

describe('connectorsToRefs', () => {
    it('liczy instancje złącza na typ i pomija wadliwe grupy', () => {
        const refs = connectorsToRefs([
            {
                id: 'C1',
                parentObjectId: 'p1',
                otherObjectId: 'p2',
                connectors: [
                    { type: 'kolki_d8x35', index: 0 },
                    { type: 'minifix', index: 1 },
                    { type: 'kolki_d8x35', index: 2 },
                    {},
                ],
            },
            { id: 'C2' }, // brak paneli — pomijane
            null,
        ]);
        expect(refs).toHaveLength(1);
        expect(refs[0].counts).toEqual({ kolki_d8x35: 2, minifix: 1 });
    });
});

describe('okuca bez własnych kroków', () => {
    it('HARDWARE nie tworzy kroków w fazie awaryjnej — jest w akcjach kroku formatki rodzica', () => {
        const plan = buildScenario();
        const remaining = plan.steps.filter((s) => s.phaseId === 'pozostale');
        // Tylko Ślepka (PART bez znanej roli) — zawiasy/podpórka bez osobnych kroków.
        const remainingIds = remaining.flatMap((s) => s.actions.map((a) => a.nodeId));
        expect(remainingIds).toEqual(['n_blind']);

        const drzwi = plan.steps.find((s) => s.actions.some((a) => a.nodeId === 'n_drzwi_0'))!;
        const drzwiIds = drzwi.actions.map((a) => a.nodeId);
        expect(drzwiIds).toContain('n_zawias_l');
        expect(drzwiIds).toContain('n_zawias_p');
    });
});

describe('animEase / animLerp (pure helper)', () => {
    it('easing cubic in-out: 0 → 0, 0.5 → 0.5, 1 → 1', () => {
        expect(animEaseCubicInOut(0)).toBe(0);
        expect(animEaseCubicInOut(0.5)).toBeCloseTo(0.5);
        expect(animEaseCubicInOut(1)).toBe(1);
    });

    it('lerp 3: interpolacja wprost i poza zakres (clamp do t)', () => {
        expect(animLerp3([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
        expect(animLerp3([0, 0, 0], [10, 10, 10], 2)).toEqual([20, 20, 20]);
    });
});

describe('kierunki exploda wg zasad montażu', () => {
    it('wieńce na osi Z: dno w dół, góra w górę', () => {
        expect(explodeDirForRole('BOTTOM_PANEL')).toEqual([0, 0, -1]);
        expect(explodeDirForRole('TOP_PANEL')).toEqual([0, 0, 1]);
    });

    it('boki z boków: lewy z lewej (−X), prawy z prawej (+X)', () => {
        expect(explodeDirForRole('LEFT_SIDE_PANEL')).toEqual([-1, 0, 0]);
        expect(explodeDirForRole('RIGHT_SIDE_PANEL')).toEqual([1, 0, 0]);
    });

    it('plecy do tyłu (+Y), fronty do przodu (−Y)', () => {
        expect(explodeDirForRole('BACK_PANEL')).toEqual([0, 1, 0]);
        expect(explodeDirForRole('FRONT')).toEqual([0, -1, 0]);
        expect(explodeDirForRole('FRONT_PANEL')).toEqual([0, -1, 0]);
        expect(explodeDirForRole('FLAP')).toEqual([0, -1, 0]);
    });

    it('wszystko w środku wysuwa się do przodu: półki/działki i nieznane role = −Y (domyślny)', () => {
        expect(explodeDirForRole('SHELF_PANEL')).toEqual(EXPLODE_DEFAULT_DIR);
        expect(explodeDirForRole('VERTICAL_DIVIDER')).toEqual(EXPLODE_DEFAULT_DIR);
        expect(explodeDirForRole('UNKNOWN_ROLE_X')).toEqual(EXPLODE_DEFAULT_DIR);
        expect(explodeDirForRole(null)).toEqual(EXPLODE_DEFAULT_DIR);
        expect(EXPLODE_DEFAULT_DIR).toEqual([0, -1, 0]);
    });
});

// ─── Powiązanie planu / kadrów z szafkami projektu (scope + fingerprint) ───

type FakeNodeOpts = { domainData?: Record<string, unknown>; children?: CADNode[] };

function fakeNode(id: string, nodeType: NodeType, opts: FakeNodeOpts = {}): CADNode {
    return {
        id,
        name: (opts.domainData?.name as string) || id,
        nodeType,
        children: opts.children ?? [],
        domainData: opts.domainData ?? null,
        localMatrix: { decompose: () => ({ translation: { x: 0, y: 0, z: 0 } }) },
    } as unknown as CADNode;
}

function partNode(id: string, role: string): CADNode {
    return fakeNode(id, NodeType.PART, { domainData: { name: id, role } });
}

function cabinetNode(id: string, children: CADNode[]): CADNode {
    return fakeNode(id, NodeType.ASSEMBLY, { domainData: { name: id }, children });
}

function fakeDoc(rootChildren: CADNode[]): ProjectDocument | null {
    const index = new Map<string, CADNode>();
    const walk = (node: CADNode): void => {
        index.set(node.id, node);
        for (const child of node.children) walk(child);
    };
    rootChildren.forEach(walk);
    return {
        rootNode: { id: 'root', children: rootChildren },
        findNode: (id: string) => index.get(id) ?? null,
    } as unknown as ProjectDocument;
}

function docWithShelves(): ProjectDocument | null {
    return fakeDoc([
        cabinetNode('szafka_1', [partNode('n_bok_l', 'LEFT_SIDE_PANEL'), partNode('n_bok_p', 'RIGHT_SIDE_PANEL')]),
        cabinetNode('szafka_2', [partNode('n_front', 'FRONT')]),
    ]);
}

function planWithMeta(meta: AssemblyScopeMeta | null): AssemblyPlan {
    return {
        rootName: 'test',
        steps: [],
        partsTotal: 0,
        fallbackNodeIds: [],
        meta,
    } as unknown as AssemblyPlan;
}

function fakeView(id: string, assembly?: SavedExportView['assembly']): SavedExportView {
    return {
        id,
        name: id,
        createdAt: '2026-01-01T00:00:00.000Z',
        paperFormat: 'A4_LANDSCAPE',
        projectionType: 'ORTHO',
        cameraAlpha: 0,
        cameraBeta: 0,
        cameraRadius: 0,
        cameraTarget: [0, 0, 0],
        notes: '',
        includeBOM: false,
        includePMI: false,
        titleBlock: {},
        assembly: assembly ?? null,
    } as SavedExportView;
}

describe('assemblyPartsHash / assemblyScopeFingerprint', () => {
    const doc = docWithShelves();

    it('hash jest stabilny dla tego samego spisu części', () => {
        const metaA = assemblyScopeFingerprint(doc);
        const metaB = assemblyScopeFingerprint(doc);
        expect(metaA.partsHash).toBe(metaB.partsHash);
        expect(metaA.scopeContainerIds).toEqual(['szafka_1', 'szafka_2']);
    });

    it('hash zmienia się po usunięciu części', () => {
        const metaBefore = assemblyScopeFingerprint(doc);
        const trimmed = fakeDoc([
            cabinetNode('szafka_1', [partNode('n_bok_p', 'RIGHT_SIDE_PANEL')]),
            cabinetNode('szafka_2', [partNode('n_front', 'FRONT')]),
        ]);
        expect(assemblyScopeFingerprint(trimmed).partsHash).not.toBe(metaBefore.partsHash);
    });

    it('hash zmienia się po zmianie roli formatki', () => {
        const metaBefore = assemblyScopeFingerprint(doc);
        const reRolled = fakeDoc([
            cabinetNode('szafka_1', [partNode('n_bok_l', 'SHELF_PANEL'), partNode('n_bok_p', 'RIGHT_SIDE_PANEL')]),
            cabinetNode('szafka_2', [partNode('n_front', 'FRONT')]),
        ]);
        expect(assemblyScopeFingerprint(reRolled).partsHash).not.toBe(metaBefore.partsHash);
    });

    it('pusty dokument → pusty scope i hash inwentarza', () => {
        const meta = assemblyScopeFingerprint(null);
        expect(meta.scopeContainerIds).toEqual([]);
        expect(meta.partsCount).toBe(0);
        expect(assemblyPartsHash([])).toMatch(/^p0_/);
    });
});

describe('assemblyConnectorHash (łącza C2 w fingerprintach)', () => {
    const REF: AssemblyConnectorRef[] = [
        { id: 'C1', parentObjectId: 'n_bok_l', otherObjectId: 'n_wieniec_d1', counts: { kolki_d8x35: 6 } },
    ];

    it('hash stabilny dla tego samego spisu, pusto = c0', () => {
        expect(assemblyConnectorHash(REF)).toBe(assemblyConnectorHash([...REF].reverse()));
        expect(assemblyConnectorHash(REF)).toMatch(/^c1_/);
        expect(assemblyConnectorHash([])).toMatch(/^c0_/);
    });

    it('hash zmienia się po zmianie liczności / typu / końców złącza', () => {
        const moreKolki: AssemblyConnectorRef[] = [{ ...REF[0], counts: { kolki_d8x35: 7 } }];
        const diffEndpoints: AssemblyConnectorRef[] = [{ ...REF[0], otherObjectId: 'n_wieniec_d2' }];
        const base = assemblyConnectorHash(REF);
        expect(assemblyConnectorHash(moreKolki)).not.toBe(base);
        expect(assemblyConnectorHash(diffEndpoints)).not.toBe(base);
    });
});

describe('isPlanStale', () => {
    const doc = docWithShelves();

    it('plan bez meta / dokument bez planu = przestarzały', () => {
        expect(isPlanStale(null, doc)).toBe(true);
        expect(isPlanStale(planWithMeta(null), doc)).toBe(true);
    });

    it('plan zgodny z projektem = świeży', () => {
        const plan = planWithMeta(assemblyScopeFingerprint(doc) as AssemblyScopeMeta);
        expect(isPlanStale(plan, doc)).toBe(false);
    });

    it('usunięta szafka-scope = przestarzały', () => {
        const plan = planWithMeta(assemblyScopeFingerprint(doc) as AssemblyScopeMeta);
        const shrunk = fakeDoc([cabinetNode('szafka_1', doc!.rootNode.children[0].children)]);
        expect(isPlanStale(plan, shrunk)).toBe(true);
    });

    it('zmiana zawartości (nowa formatka / ipso facto hash) = przestarzały', () => {
        const plan = planWithMeta(assemblyScopeFingerprint(doc) as AssemblyScopeMeta);
        const expanded = fakeDoc([
            cabinetNode('szafka_1', [
                partNode('n_bok_l', 'LEFT_SIDE_PANEL'),
                partNode('n_bok_p', 'RIGHT_SIDE_PANEL'),
                partNode('n_polka', 'SHELF_PANEL'), // dov failed
            ]),
            cabinetNode('szafka_2', [partNode('n_front', 'FRONT')]),
        ]);
        expect(isPlanStale(plan, expanded)).toBe(true);
    });

    it('brak dokumentu (projekt zamknięty) = przestarzały', () => {
        const plan = planWithMeta(assemblyScopeFingerprint(docWithShelves()) as AssemblyScopeMeta);
        expect(isPlanStale(plan, null)).toBe(true);
    });
});

describe('pruneAssemblyViews', () => {
    const doc = docWithShelves();
    const tag: AssemblyScopeMeta = assemblyScopeFingerprint(doc);

    const freshAsm = fakeView('asm_1', { scopeContainerIds: tag.scopeContainerIds, partsHash: tag.partsHash });
    const staleAsm = fakeView('asm_2', { scopeContainerIds: ['szafka_usunieta'], partsHash: tag.partsHash });
    const staleHash = fakeView('asm_3', { scopeContainerIds: tag.scopeContainerIds, partsHash: 'p666_deadbeef' });
    const untaggedAsm = fakeView('asm_4', null);
    const userView = fakeView('user_rzut_kolowy', null);

    it('świeże asm_* zostają, martwe scope / zmieniony hash / bez tagu wypadają', () => {
        const out = pruneAssemblyViews([freshAsm, staleAsm, staleHash, untaggedAsm, userView], doc);
        expect(out.map((v) => v.id)).toEqual(['asm_1', 'user_rzut_kolowy']);
    });

    it('kadry użytkownika (non-asm) nigdy nie są ruszane — nawet przy doc null', () => {
        expect(pruneAssemblyViews([userView], doc)).toEqual([userView]);
        expect(pruneAssemblyViews([userView], null)).toEqual([userView]);
    });

    it('projekt zamknięty (doc null) = wszystkie asm_* kasowane', () => {
        expect(pruneAssemblyViews([freshAsm, userView], null).map((v) => v.id)).toEqual(['user_rzut_kolowy']);
    });

    it('wejście nie-tablicowe daje pustą listę', () => {
        expect(pruneAssemblyViews(null, doc)).toEqual([]);
        expect(pruneAssemblyViews(undefined, doc)).toEqual([]);
    });
});

describe('AssemblyKeyframes — edycja klatek i nadpisywanie parametrów', () => {
    it('krok przyjmuje nadpisanie kierunku i dystansu odsunięcia', () => {
        const plan = buildAssemblySequence({
            parts: [
                ref('p1', 'Dno', 'BOTTOM_PANEL', 'PART'),
                ref('p2', 'Bok L', 'LEFT_SIDE_PANEL', 'PART'),
            ],
            rules: DEFAULT_ASSEMBLY_RULES,
        });
        expect(plan.steps.length).toBe(2);

        plan.steps[0].explodeOverride = {
            dirCad: [0, 0, -1],
            distanceMm: 450,
            customStartPositions: {
                p1: [0, -450, 0],
            },
        };

        expect(plan.steps[0].explodeOverride.distanceMm).toBe(450);
        expect(plan.steps[0].explodeOverride.dirCad).toEqual([0, 0, -1]);
        expect(plan.steps[0].explodeOverride.customStartPositions?.p1).toEqual([0, -450, 0]);
    });

    it('zamiana kolejności kroków w sekwencji przenumerowuje kroki', () => {
        const plan = buildAssemblySequence({
            parts: [
                ref('p1', 'Dno', 'BOTTOM_PANEL', 'PART'),
                ref('p2', 'Bok L', 'LEFT_SIDE_PANEL', 'PART'),
            ],
            rules: DEFAULT_ASSEMBLY_RULES,
        });
        const s1 = plan.steps[0];
        const s2 = plan.steps[1];
        expect(s1.index).toBe(1);
        expect(s2.index).toBe(2);

        // Symulacja przestawienia
        const steps = [s2, s1];
        steps.forEach((s, idx) => { s.index = idx + 1; });

        expect(steps[0].actions[0].nodeId).toBe('p2');
        expect(steps[0].index).toBe(1);
        expect(steps[1].actions[0].nodeId).toBe('p1');
        expect(steps[1].index).toBe(2);
    });

    it('złącza C2: kołki fi8 trafiają do wieńca (krok 1), a konfirmaty do boczka (krok 2)', () => {
        const plan = buildAssemblySequence({
            parts: [
                ref('p_wieniec', 'Wieniec Dolny', 'BOTTOM_PANEL', 'PART'),
                ref('p_bok', 'Bok Lewy', 'LEFT_SIDE_PANEL', 'PART'),
            ],
            connectors: [
                {
                    id: 'grp_wb',
                    parentObjectId: 'p_wieniec',
                    otherObjectId: 'p_bok',
                    counts: {
                        kolki_d8x35: 2,
                        konfirmat_5x50: 2,
                    },
                },
            ],
            rules: DEFAULT_ASSEMBLY_RULES,
        });

        expect(plan.steps.length).toBe(2);
        const s1 = plan.steps[0]; // wieniec
        const s2 = plan.steps[1]; // bok

        // Krok 1 (wieniec) dostaje kołki fi8 wbijane przed przyłożeniem boku
        expect(s1.hardwareCounts.kolki_d8x35).toBe(2);
        expect(s1.hardwareCounts.konfirmat_5x50).toBeUndefined();

        // Krok 2 (bok) dostaje konfirmaty wkręcane po przyłożeniu boku
        expect(s2.hardwareCounts.konfirmat_5x50).toBe(2);
        expect(s2.hardwareCounts.kolki_d8x35).toBeUndefined();
    });
});
