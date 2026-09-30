/**
 * scripts/strip-dead-ui-config.mjs
 * Usuwa martwe sekcje `ui_config` + `messages` z produkcyjnych *_rules*.json.
 * Uzasadnienie: żaden kod ich nie czyta (zweryfikowane grepem), UI mieszka w *_tekst.json.
 * Odpalać TYLKO dla modułów z kompletnym *_tekst.json (pl/en/de) — inaczej stracimy tłumaczenia.
 *
 * Użycie: node scripts/strip-dead-ui-config.mjs <plik.json> [plik.json ...]
 */
import fs from 'node:fs';

const DEAD_KEYS = ['ui_config', 'messages'];
let removed = 0;

for (const file of process.argv.slice(2)) {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    let touched = false;
    for (const k of DEAD_KEYS) {
        if (data && Object.prototype.hasOwnProperty.call(data, k)) {
            delete data[k];
            touched = true;
        }
    }
    if (!touched) {
        console.log(`SKIP ${file} (brak martwych sekcji)`);
        continue;
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    removed++;
    console.log(`OK ${file}`);
}

console.log(`Usunięto sekcje w ${removed} plikach.`);
