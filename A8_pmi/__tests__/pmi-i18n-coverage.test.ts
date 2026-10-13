import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Strażnik i18n dla modułu A8_pmi', () => {
    const pmiDir = path.resolve(__dirname, '..');
    const jsonPath = path.join(pmiDir, 'pmi_tekst.json');

    it('plik pmi_tekst.json istnieje i zawiera komplety kluczy pl, en, de', () => {
        expect(fs.existsSync(jsonPath)).toBe(true);
        const content = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        expect(Object.keys(content).length).toBeGreaterThan(15);

        for (const [key, translations] of Object.entries(content)) {
            const tr = translations as Record<string, string>;
            expect(typeof tr.pl, `Klucz "${key}" musi mieć tłumaczenie "pl"`).toBe('string');
            expect(typeof tr.en, `Klucz "${key}" musi mieć tłumaczenie "en"`).toBe('string');
            expect(typeof tr.de, `Klucz "${key}" musi mieć tłumaczenie "de"`).toBe('string');
            expect(tr.pl.length, `Tłumaczenie "pl" dla "${key}" nie może być puste`).toBeGreaterThan(0);
            expect(tr.en.length, `Tłumaczenie "en" dla "${key}" nie może być puste`).toBeGreaterThan(0);
            expect(tr.de.length, `Tłumaczenie "de" dla "${key}" nie może być puste`).toBeGreaterThan(0);
        }
    });

    it('wszystkie wywołania tx() w kodzie A8_pmi odwołują się do istniejących kluczy', () => {
        const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        const availableKeys = new Set(Object.keys(jsonContent));

        const files = fs.readdirSync(pmiDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
        const txRegex = /\btx\(\s*(?:pmiTekst|tekst|[a-zA-Z0-9_]+)\s*,\s*['"]([^'"]+)['"]/g;

        let totalTxCalls = 0;
        const missingKeys: { file: string; key: string }[] = [];

        for (const file of files) {
            const filePath = path.join(pmiDir, file);
            const src = fs.readFileSync(filePath, 'utf-8');

            let match: RegExpExecArray | null;
            while ((match = txRegex.exec(src)) !== null) {
                totalTxCalls++;
                const key = match[1];
                if (!availableKeys.has(key)) {
                    missingKeys.push({ file, key });
                }
            }
        }

        expect(totalTxCalls, 'Moduł A8_pmi powinien używać tx() w komponentach UI').toBeGreaterThan(10);
        expect(
            missingKeys,
            `Znaleziono odwołania do nieistniejących kluczy i18n: ${JSON.stringify(missingKeys)}`,
        ).toHaveLength(0);
    });
});
