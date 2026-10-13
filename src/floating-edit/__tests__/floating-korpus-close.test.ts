import { describe, it, expect } from 'vitest';
import { shouldKeepSessionForTarget, shouldKeepSessionForTab } from '../FloatingEditHost.js';

describe('FloatingEditHost - shouldKeepSessionForTarget', () => {
    const cabinetId = 'cabinet_1';
    const panelId = 'panel_bok_l';
    const subContainerId = 'sub_bay_1';
    const otherCabinetId = 'cabinet_2';

    const cabinetNode: any = {
        id: cabinetId,
        nodeType: 2, // ASSEMBLY
        domainData: { id: cabinetId, type: 'container', name: 'Szafka Dolna' },
        parent: null,
    };

    const panelNode: any = {
        id: panelId,
        nodeType: 1, // PART
        domainData: {
            id: panelId,
            type: 'panel',
            width: 720,
            height: 500,
            thickness: 18,
            name: 'Bok Lewy',
        },
        parent: cabinetNode,
    };

    const subContainerNode: any = {
        id: subContainerId,
        nodeType: 2, // ASSEMBLY
        domainData: { id: subContainerId, type: 'container', name: 'Wnęka 1' },
        parent: cabinetNode,
    };

    const otherCabinetNode: any = {
        id: otherCabinetId,
        nodeType: 2,
        domainData: { id: otherCabinetId, type: 'container', name: 'Szafka Wisząca' },
        parent: null,
    };

    const mockDoc = {
        findNode: (id: string) => {
            if (id === cabinetId) return cabinetNode;
            if (id === panelId) return panelNode;
            if (id === subContainerId) return subContainerNode;
            if (id === otherCabinetId) return otherCabinetNode;
            return null;
        },
    };

    it('dla sesji korpusu: zachowaj sesję, gdy celem jest sam korpus', () => {
        const keep = shouldKeepSessionForTarget({ kind: 'korpus', modelId: cabinetId }, cabinetId, mockDoc);
        expect(keep).toBe(true);
    });

    it('dla sesji korpusu: zamknij sesję (zwróć false), gdy celem jest pojedyncza formatka należąca do korpusu', () => {
        const keep = shouldKeepSessionForTarget({ kind: 'korpus', modelId: cabinetId }, panelId, mockDoc);
        expect(keep).toBe(false);
    });

    it('dla sesji korpusu: zachowaj sesję, gdy celem jest kontener wewnętrzny (nie formatka)', () => {
        const keep = shouldKeepSessionForTarget({ kind: 'korpus', modelId: cabinetId }, subContainerId, mockDoc);
        expect(keep).toBe(true);
    });

    it('dla sesji korpusu: zamknij sesję, gdy celem jest inny korpus', () => {
        const keep = shouldKeepSessionForTarget({ kind: 'korpus', modelId: cabinetId }, otherCabinetId, mockDoc);
        expect(keep).toBe(false);
    });

    it('zwraca false dla nieistniejącego lub pustego targetId', () => {
        expect(shouldKeepSessionForTarget({ kind: 'korpus', modelId: cabinetId }, null, mockDoc)).toBe(false);
        expect(shouldKeepSessionForTarget({ kind: 'korpus', modelId: cabinetId }, undefined, mockDoc)).toBe(false);
        expect(shouldKeepSessionForTarget({ kind: 'korpus', modelId: cabinetId }, 'non_existent', mockDoc)).toBe(false);
    });
});

describe('FloatingEditHost - shouldKeepSessionForTab', () => {
    it('przejście na moduł wymiarowania tab-a8-pmi zamyka sesję korpusu (zwraca false)', () => {
        expect(shouldKeepSessionForTab('korpus', 'tab-a8-pmi')).toBe(false);
    });

    it('przejście na moduł wymiarowania tab-a8-pmi zamyka sesję bloku, agd oraz smartpart', () => {
        expect(shouldKeepSessionForTab('blok', 'tab-a8-pmi')).toBe(false);
        expect(shouldKeepSessionForTab('agd', 'tab-a8-pmi')).toBe(false);
        expect(shouldKeepSessionForTab('smartpart', 'tab-a8-pmi')).toBe(false);
    });

    it('zachowuje sesję korpusu tylko dla zakładki korpusu lub biblioteki', () => {
        expect(shouldKeepSessionForTab('korpus', 'tab-a3-smartframe')).toBe(true);
        expect(shouldKeepSessionForTab('korpus', 'tab-b1-biblioteka')).toBe(true);
        expect(shouldKeepSessionForTab('korpus', 'tab-a4-smartpanel')).toBe(false);
        expect(shouldKeepSessionForTab('korpus', 'tab-a7-material')).toBe(false);
    });

    it('zwraca false dla braku zakładki', () => {
        expect(shouldKeepSessionForTab('korpus', null)).toBe(false);
        expect(shouldKeepSessionForTab('korpus', undefined)).toBe(false);
    });
});
