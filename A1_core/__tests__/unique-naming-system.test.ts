import { describe, it, expect } from 'vitest';
import { ProjectDocument } from '../project-document.js';
import { mmToNm } from '../cad-math/units.js';
import { NodeType } from '../cad-node/node-type.js';

describe('System unikalnych nazw w dokumencie CAD (wzorem Blendera)', () => {
    it('tworzy kolejne panele z automatycznymi sufiksami .001, .002 przy kolizji nazw', () => {
        const doc = new ProjectDocument();
        const p1 = doc.createPanel({ width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok lewy' });
        const p2 = doc.createPanel({ width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok lewy' });
        const p3 = doc.createPanel({ width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok lewy' });

        const n1 = doc.findNode(p1.id)!;
        const n2 = doc.findNode(p2.id)!;
        const n3 = doc.findNode(p3.id)!;

        expect(n1.name).toBe('Bok lewy');
        expect(n2.name).toBe('Bok lewy.001');
        expect(n3.name).toBe('Bok lewy.002');

        // Panele w domainData mają te same zsynchronizowane unikalne nazwy
        expect((p1 as any).name).toBe('Bok lewy');
        expect((p2 as any).name).toBe('Bok lewy.001');
        expect((p3 as any).name).toBe('Bok lewy.002');
    });

    it('tworzy kolejne kontenery (ASSEMBLY) z automatyczną unikalnością nazw', () => {
        const doc = new ProjectDocument();
        const c1 = doc.createAssembly({ name: 'Szafka dolna' });
        const c2 = doc.createAssembly({ name: 'Szafka dolna' });

        const n1 = doc.findNode(c1.id)!;
        const n2 = doc.findNode(c2.id)!;

        expect(n1.name).toBe('Szafka dolna');
        expect(n2.name).toBe('Szafka dolna.001');
    });

    it('ensureUniqueNodeName nie koliduje z własną nazwą węzła przy edycji', () => {
        const doc = new ProjectDocument();
        const p1 = doc.createPanel({ width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18), name: 'Front' });
        const p2 = doc.createPanel({ width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18), name: 'Front' });

        // Jeśli edytujemy p1 i zatwierdzamy tę samą nazwę 'Front', nie powinno zmienić się na 'Front.002'
        const sameName = doc.ensureUniqueNodeName('Front', p1.id);
        expect(sameName).toBe('Front');

        // Jeśli edytujemy p2 i chcemy zmienić na 'Front' (nazwę zajętą przez p1), dostajemy pierwszą wolną unikalną
        const nextUnique = doc.ensureUniqueNodeName('Front', p2.id);
        expect(nextUnique).toBe('Front.001');
    });

    it('duplicateCADNode nadaje unikalne nazwy korpusu i dzieci (.001, .002...) bez powtórzeń', () => {
        const doc = new ProjectDocument();
        const c1 = doc.createAssembly({ name: 'Szafka' });
        doc.createPanel({ width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok lewy' }, c1.id);
        doc.createPanel({ width: mmToNm(500), height: mmToNm(720), thickness: mmToNm(18), name: 'Bok prawy' }, c1.id);

        const dup1 = doc.duplicateCADNode(c1.id)!;
        expect(dup1).toBeDefined();
        expect(dup1.name).toBe('Szafka.001');
        expect(dup1.children[0].name).toBe('Bok lewy.001');
        expect(dup1.children[1].name).toBe('Bok prawy.001');

        const dup2 = doc.duplicateCADNode(c1.id)!;
        expect(dup2).toBeDefined();
        expect(dup2.name).toBe('Szafka.002');
        expect(dup2.children[0].name).toBe('Bok lewy.002');
        expect(dup2.children[1].name).toBe('Bok prawy.002');

        // Kopiowanie kopii również generuje kolejny unikalny numer
        const dup3 = doc.duplicateCADNode(dup1.id)!;
        expect(dup3).toBeDefined();
        expect(dup3.name).toBe('Szafka.003');
        expect(dup3.children[0].name).toBe('Bok lewy.003');
        expect(dup3.children[1].name).toBe('Bok prawy.003');
    });

    it('addDatumLevel zapewnia unikalność nazw poziomów Z', () => {
        const doc = new ProjectDocument();
        const l1 = doc.addDatumLevel(500, 'Blat');
        const l2 = doc.addDatumLevel(500, 'Blat');
        expect(l1.name).toBe('Blat');
        expect(l2.name).toBe('Blat.001');
    });
});

