/**
 * I1_instrukcja — scope pojedynczego korpusu (PPM w drzewie).
 *
 * Instrukcja otwierana z drzewa dla jednego korpusu MUSI widzieć tylko jego
 * formatki i tylko jego złącza — dodanie części w innym korpusie nie może
 * unieważniać planu ani mieszać kroków.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectDocument } from '../../A1_core/project-document.js';
import { mmToNm } from '../../A1_core/cad-math/units.js';
import {
    assemblyScopeFingerprint,
    collectAssemblyPartRefs,
    isPlanStale,
    isolateContainerInSnapshot,
    mergeContainerIntoProjectSnapshot,
} from '../assembly-scene-adapter.js';
import { buildAssemblySequence } from '../assembly-sequence-engine.js';
import type { AssemblyPlan } from '../assembly-sequence-engine.js';

function addPanel(doc: ProjectDocument, cabinetId: string, name: string, role: string): string {
    const panel = doc.createPanel(
        { name, width: mmToNm(600), height: mmToNm(400), thickness: mmToNm(18) },
        cabinetId,
    );
    const node = doc.findNode(panel.id)!;
    (node.domainData as { role?: string }).role = role;
    return node.id;
}

describe('instrukcja — scope pojedynczego korpusu', () => {
    let doc: ProjectDocument;
    let cabA: { id: string };
    let cabB: { id: string };
    let aDno: string;
    let aWieniec: string;
    let bDno: string;

    beforeEach(() => {
        doc = new ProjectDocument({ name: 'Instrukcja scope' });
        cabA = doc.createAssembly({ name: 'Korpus A', width: mmToNm(800) });
        cabB = doc.createAssembly({ name: 'Korpus B', width: mmToNm(800) });
        aDno = addPanel(doc, cabA.id, 'Dno A', 'dno');
        aWieniec = addPanel(doc, cabA.id, 'Wieniec A', 'wieniec_gorny');
        bDno = addPanel(doc, cabB.id, 'Dno B', 'dno');
    });

    it('zbiera tylko części wskazanego korpusu', () => {
        const all = collectAssemblyPartRefs(doc);
        expect(all.map((p) => p.nodeId).sort()).toEqual([aDno, aWieniec, bDno].sort());

        const scoped = collectAssemblyPartRefs(doc, { containerId: cabA.id });
        expect(scoped.map((p) => p.nodeId).sort()).toEqual([aDno, aWieniec].sort());
        // Rodzicem formatek jest kliknięty korpus (a nie root projektu).
        expect(scoped.every((p) => p.parentId === cabA.id)).toBe(true);
    });

    it('fingerprint jest liczony w scope korpusu', () => {
        const scopeA = assemblyScopeFingerprint(doc, { containerId: cabA.id });
        expect(scopeA.scopeContainerIds).toEqual([cabA.id]);
        expect(scopeA.partsCount).toBe(2);

        const wholeProject = assemblyScopeFingerprint(doc);
        expect(wholeProject.partsCount).toBe(3);
        expect(scopeA.partsHash).not.toBe(wholeProject.partsHash);

        // Zmiana w INNYM korpusie nie zmienia fingerprintu tego korpusu.
        addPanel(doc, cabB.id, 'Bok B', 'bok_prawy');
        expect(assemblyScopeFingerprint(doc, { containerId: cabA.id }).partsHash)
            .toBe(scopeA.partsHash);
    });

    it('plan jest nieaktualny tylko przy zmianie własnego scope', () => {
        const parts = collectAssemblyPartRefs(doc, { containerId: cabA.id });
        const plan = buildAssemblySequence({ parts }) as AssemblyPlan;
        (plan as { meta?: unknown }).meta = assemblyScopeFingerprint(doc, { containerId: cabA.id });

        expect(isPlanStale(plan, doc)).toBe(false);

        // Inny korpus — plan pozostaje świeży.
        addPanel(doc, cabB.id, 'Bok B', 'bok_prawy');
        expect(isPlanStale(plan, doc)).toBe(false);

        // Ten sam korpus — plan do przeliczenia.
        addPanel(doc, cabA.id, 'Bok A', 'bok_prawy');
        expect(isPlanStale(plan, doc)).toBe(true);
    });

    it('usunięcie korpusu unieważnia jego plan', () => {
        const parts = collectAssemblyPartRefs(doc, { containerId: cabA.id });
        const plan = buildAssemblySequence({ parts }) as AssemblyPlan;
        (plan as { meta?: unknown }).meta = assemblyScopeFingerprint(doc, { containerId: cabA.id });

        doc.removeNode(cabA.id);
        expect(isPlanStale(plan, doc)).toBe(true);
    });

    it('isolateContainerInSnapshot izoluje TYLKO wskazany korpus ze snapshotu projektu', () => {
        const fullSnap = doc.serialize();
        expect(fullSnap.rootNode.children.length).toBe(2);

        const isolatedSnap = isolateContainerInSnapshot(fullSnap, cabA.id);
        expect(isolatedSnap.rootNode.children.length).toBe(1);
        expect(isolatedSnap.rootNode.children[0].id).toBe(cabA.id);
        // Pozycja lokalna zostaje zresetowana do zera, by stał w centrum
        expect(isolatedSnap.rootNode.children[0].translationNm).toEqual([0, 0, 0]);

        // Po załadowaniu do nowego dokumentu: obecny tylko Korpus A i jego formatki
        const isolatedDoc = new ProjectDocument({ name: 'Isolated' });
        isolatedDoc.load(isolatedSnap);

        expect(isolatedDoc.rootNode.children.length).toBe(1);
        expect(isolatedDoc.findNode(cabA.id)).toBeDefined();
        expect(isolatedDoc.findNode(cabB.id)).toBeNull();
        expect(isolatedDoc.findNode(aDno)).toBeDefined();
        expect(isolatedDoc.findNode(aWieniec)).toBeDefined();
        expect(isolatedDoc.findNode(bDno)).toBeNull();
    });

    it('mergeContainerIntoProjectSnapshot aktualizuje tylko ten korpus bez utraty pozostałych', () => {
        const fullSnap = doc.serialize();
        const isolatedSnap = isolateContainerInSnapshot(fullSnap, cabA.id);

        const isolatedDoc = new ProjectDocument({ name: 'Isolated' });
        isolatedDoc.load(isolatedSnap);

        // Dodaj nową formatkę w edytowanym korpusie w instrukcji
        const newPanelId = addPanel(isolatedDoc, cabA.id, 'Nowa Półka', 'polka');

        const scopedSnap = isolatedDoc.serialize();
        const mergedSnap = mergeContainerIntoProjectSnapshot(fullSnap, scopedSnap, cabA.id);

        // Pełny snapshot nadal posiada Korpus B
        const mergedDoc = new ProjectDocument({ name: 'Merged' });
        mergedDoc.load(mergedSnap);

        expect(mergedDoc.findNode(cabB.id)).toBeDefined();
        expect(mergedDoc.findNode(bDno)).toBeDefined();
        expect(mergedDoc.findNode(cabA.id)).toBeDefined();
        expect(mergedDoc.findNode(newPanelId)).toBeDefined();
    });
    it('extractInstrukcjaPayload przygotowuje wyizolowany snapshot tylko dla wskazanego korpusu', async () => {
        const { extractInstrukcjaPayload } = await import('../../src/module-data/cad-extract.js');
        const payload = extractInstrukcjaPayload(
            { type: 'CONTAINER', id: cabA.id, name: 'Korpus A' },
            doc,
        );

        expect(payload.snapshot).toBeDefined();
        expect(payload.snapshot.rootNode.children.length).toBe(1);
        expect(payload.snapshot.rootNode.children[0].id).toBe(cabA.id);

        const isolatedDoc = new ProjectDocument({ name: 'Loaded from payload' });
        isolatedDoc.load(payload.snapshot);

        expect(isolatedDoc.findNode(cabA.id)).toBeDefined();
        expect(isolatedDoc.findNode(cabB.id)).toBeNull();
    });
});
