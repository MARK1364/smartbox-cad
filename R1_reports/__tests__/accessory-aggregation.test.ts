import { describe, it, expect } from 'vitest';
import { ReportDataNormalizer } from '../report-data-normalizer.js';
import { GlobalReportsEngineWeb } from '../global-reports-engine.js';

function shelfPin(id: string, name: string) {
    return {
        id,
        name,
        nodeType: 'HARDWARE',
        domainData: {
            type: 'hardware',
            id,
            name,
            role: 'HARDWARE',
            hardwareType: 'SHELF_PIN',
            hardwareId: 'PODPORKA_FI5',
        },
    };
}

describe('R1_reports — sumowanie powtarzających się akcesoriów', () => {
    it('scala podpórki tego samego typu w jednej pozycji i sumuje qty', () => {
        const fakeDoc = {
            rootNode: {
                id: 'cab1',
                name: 'Szafka',
                nodeType: 'ASSEMBLY',
                domainData: { type: 'container', name: 'Szafka' },
                children: [
                    {
                        id: 'sb1',
                        name: 'Blok_Polki',
                        nodeType: 'ASSEMBLY',
                        domainData: { is_blok: true, name: 'Blok_Polki' },
                        children: [
                            shelfPin('pin1', 'Podpórka 1 (Lewy Przód)'),
                            shelfPin('pin2', 'Podpórka 1 (Lewy Tył)'),
                            shelfPin('pin3', 'Podpórka 1 (Prawy Przód)'),
                            shelfPin('pin4', 'Podpórka 1 (Prawy Tył)'),
                        ],
                    },
                ],
            },
        };

        const result = ReportDataNormalizer.extractProjectData(fakeDoc);

        const pins = result.accessories.filter((a) => a.library_id === 'PODPORKA_FI5');
        expect(pins).toHaveLength(1);
        expect(pins[0].qty).toBe(4);
        expect(pins[0].name).toBe('Podpórka fi 5');
        expect(pins[0].blok_id).toBe('sb1');
    });

    it('wycenia podpórkę fi 5 po 0,10 PLN za sztukę i sumuje w podsumowaniu', () => {
        const engine = new GlobalReportsEngineWeb();

        const pricing = engine.calculateAccessoryPricing({
            id: 'pin1',
            name: 'Podpórka fi 5',
            role: 'HARDWARE',
            library_id: 'PODPORKA_FI5',
            qty: 4,
            furniture_name: 'Szafka',
        });

        expect(pricing.unit_price_pln).toBe(0.1);
        expect(pricing.total_price_pln).toBe(0.4);

        const summary = engine.calculateGlobalSummary([], [pricing]);
        expect(summary.Calkowite_liczba_akcesorii_szt).toBe(4);
        expect(summary.SUMA_AKCESORIA_PLN).toBe(0.4);
    });
});
