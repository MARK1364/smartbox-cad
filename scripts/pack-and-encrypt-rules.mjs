/**
 * scripts/pack-and-encrypt-rules.mjs
 * 
 * Skrypt budujący:
 * 1. Zbiera wszystkie produkcyjne pliki JSON reguł (A2_bloki, A3_smartframe, S4_sciany).
 * 2. Zbiera wszystkie produkcyjne pliki okuć z B1_biblioteka (zawiasy, szuflady, uchwyty, zawieszki itd.).
 * 3. FAIL-FAST: Jeśli jakikolwiek plik nie istnieje lub jest uszkodzony -> natychmiast process.exit(1).
 * 4. Konsoliduje je w jeden obiekt słownikowy.
 * 5. Generuje losowy 32-bajtowy klucz oraz 12-bajtowy nonce.
 * 6. Szyfruje pakiet algorytmem ChaCha20.
 * 7. Dzieli klucz na 3 maski XOR (key-splitting).
 * 8. Generuje plik A1_core/vault-payload.generated.ts dla builda produkcyjnego.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Lista chronionych plików reguł produkcyjnych (A2, A3, S4)
const PROTECTED_RULES = [
  { id: '03_shelf', path: 'A2_bloki/03_shelf_3_rules_V1.json' },
  { id: '04_shelves', path: 'A2_bloki/04_shelves_3_rules_V1.json' },
  { id: '05_doors', path: 'A2_bloki/05_doors_3_rules_V1.json' },
  { id: '06_skosne-doors', path: 'A2_bloki/06_skosne-doors_3_rules_V1.json' },
  { id: '08_tubes', path: 'A2_bloki/08_tubes_3_rules_V1.json' },
  { id: '09_drawers', path: 'A2_bloki/09_drawers_3_rules_V1.json' },
  { id: '10_dividers', path: 'A2_bloki/10_dividers_3_rules_V1.json' },
  { id: '11_panels', path: 'A2_bloki/11_panels_3_rules_V1.json' },
  { id: '12_flaps', path: 'A2_bloki/12_flaps_3_rules_V1.json' },
  { id: '13_led-internal', path: 'A2_bloki/13_led_internal_3_rules_V1.json' },
  { id: '14_led-external', path: 'A2_bloki/14_led_external_3_rules_V1.json' },
  { id: 'korpus3', path: 'A3_smartframe/korpus3_3_rules.json' },
  { id: 'korpus_rogowy1', path: 'A3_smartframe/korpus_rogowy1_rules.json' },
  { id: 'korpus_rogowy90', path: 'A3_smartframe/korpus_rogowy90_rules.json' },
  { id: 'korpus_skosny', path: 'A3_smartframe/korpus_skosny_rules.json' },
  { id: 'pillars', path: 'S4_sciany/pillars_3_rules_V1.json' },
  { id: 'walls', path: 'S4_sciany/walls_3_rules_V1.json' },
  { id: 'connectors_3_rules', path: 'C2_connectors/connectors_3_rules.json' },
  { id: 'assembly_sequence_rules', path: 'I1_instrukcja/assembly-sequence-rules.json' },
  { id: 'smart_panel_V1', path: 'A4_smartpanel/smart_panel_V1.json' },
  { id: 'ramka_alu_templates', path: 'A4_smartpanel/ramka_alu_templates.json' },
  { id: 'operacje', path: 'o1_operacji/katalog/operacje.json' }
];

// Foldery w B1_biblioteka do spakowania i zaszyfrowania
const B1_CATEGORIES = [
  'zawiasy',
  'szuflady',
  'uchwyty',
  'zawieszki',
  'polki_akcesoria',
  'drazki',
  'wyposazenie',
  'zlewy'
];

function collectJsonFilesRecursively(dir, baseDir, results = {}) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsonFilesRecursively(fullPath, baseDir, results);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      // Ignorujemy duplikaty indeksów catalog.json, legacy szuflady.json oraz kopie robocze edytora.
      if (entry.name === 'catalog.json' || entry.name === 'szuflady.json' || entry.name.endsWith('.backup.json')) {
        continue;
      }
      const relPath = './' + path.relative(baseDir, fullPath).replace(/\\/g, '/');
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        results[relPath] = JSON.parse(content);
      } catch (err) {
        console.error(`[pack-and-encrypt-rules] BŁĄD PARSOWANIA JSON: ${fullPath}: ${err.message}`);
        process.exit(1);
      }
    }
  }
  return results;
}

// Implementacja ChaCha20 w Node.js (zgodna z synced-cipher.ts)
function rotl(v, c) {
  return ((v << c) | (v >>> (32 - c))) >>> 0;
}

function quarterRound(x, a, b, c, d) {
  x[a] = (x[a] + x[b]) >>> 0; x[d] = rotl(x[d] ^ x[a], 16);
  x[c] = (x[c] + x[d]) >>> 0; x[b] = rotl(x[b] ^ x[c], 12);
  x[a] = (x[a] + x[b]) >>> 0; x[d] = rotl(x[d] ^ x[a], 8);
  x[c] = (x[c] + x[d]) >>> 0; x[b] = rotl(x[b] ^ x[c], 7);
}

function chacha20Block(key, nonce, counter, out, outOffset) {
  const state = new Uint32Array(16);
  state[0] = 0x61707865;
  state[1] = 0x3320646e;
  state[2] = 0x79622d32;
  state[3] = 0x6b206574;
  for (let i = 0; i < 8; i++) state[4 + i] = key[i];
  state[12] = counter >>> 0;
  state[13] = nonce[0];
  state[14] = nonce[1];
  state[15] = nonce[2];

  const working = new Uint32Array(16);
  working.set(state);

  for (let i = 0; i < 10; i++) {
    quarterRound(working, 0, 4, 8, 12);
    quarterRound(working, 1, 5, 9, 13);
    quarterRound(working, 2, 6, 10, 14);
    quarterRound(working, 3, 7, 11, 15);
    quarterRound(working, 0, 5, 10, 15);
    quarterRound(working, 1, 6, 11, 12);
    quarterRound(working, 2, 7, 8, 13);
    quarterRound(working, 3, 4, 9, 14);
  }

  for (let i = 0; i < 16; i++) {
    const val = (working[i] + state[i]) >>> 0;
    const base = outOffset + i * 4;
    out[base] = val & 0xff;
    out[base + 1] = (val >>> 8) & 0xff;
    out[base + 2] = (val >>> 16) & 0xff;
    out[base + 3] = (val >>> 24) & 0xff;
  }
}

function chacha20Encrypt(keyBytes, nonceBytes, input) {
  const keyWords = new Uint32Array(8);
  for (let i = 0; i < 8; i++) {
    const o = i * 4;
    keyWords[i] = (keyBytes[o] | (keyBytes[o + 1] << 8) | (keyBytes[o + 2] << 16) | (keyBytes[o + 3] << 24)) >>> 0;
  }

  const nonceWords = new Uint32Array(3);
  for (let i = 0; i < 3; i++) {
    const o = i * 4;
    nonceWords[i] = (nonceBytes[o] | (nonceBytes[o + 1] << 8) | (nonceBytes[o + 2] << 16) | (nonceBytes[o + 3] << 24)) >>> 0;
  }

  const output = new Uint8Array(input.length);
  const blockBuf = new Uint8Array(64);
  let curCounter = 1;

  for (let pos = 0; pos < input.length; pos += 64) {
    chacha20Block(keyWords, nonceWords, curCounter++, blockBuf, 0);
    const chunk = Math.min(64, input.length - pos);
    for (let i = 0; i < chunk; i++) {
      output[pos + i] = input[pos + i] ^ blockBuf[i];
    }
  }

  return output;
}

export function packAndEncryptRules() {
  console.log('[pack-and-encrypt-rules] Pakowanie i szyfrowanie reguł produkcyjnych (A2/A3/S4) oraz biblioteki B1...');

  const dictionary = {};

  // 1. Zbieranie reguł meblowych z twardym FAIL-FAST
  for (const item of PROTECTED_RULES) {
    const fullPath = path.join(ROOT_DIR, item.path);
    if (!fs.existsSync(fullPath)) {
      console.error(`[pack-and-encrypt-rules] BŁĄD KRYTYCZNY (FAIL-FAST): Brak pliku reguł: ${item.path}`);
      process.exit(1);
    }
    try {
      const rawContent = fs.readFileSync(fullPath, 'utf-8');
      dictionary[item.id] = JSON.parse(rawContent);
    } catch (err) {
      console.error(`[pack-and-encrypt-rules] BŁĄD KRYTYCZNY: Nieprawidłowy format JSON w ${item.path}: ${err.message}`);
      process.exit(1);
    }
  }

  // 2. Zbieranie okuć z B1_biblioteka
  const b1BaseDir = path.join(ROOT_DIR, 'B1_biblioteka');
  const b1HardwareDict = {};
  for (const cat of B1_CATEGORIES) {
    const catDir = path.join(b1BaseDir, cat);
    collectJsonFilesRecursively(catDir, b1BaseDir, b1HardwareDict);
  }

  const b1Count = Object.keys(b1HardwareDict).length;
  if (b1Count === 0) {
    console.error(`[pack-and-encrypt-rules] BŁĄD KRYTYCZNY (FAIL-FAST): Nie znaleziono żadnych plików okuć w B1_biblioteka!`);
    process.exit(1);
  }
  dictionary['b1_hardware'] = b1HardwareDict;

  const jsonString = JSON.stringify(dictionary);
  const plainBytes = Buffer.from(jsonString, 'utf-8');

  // Losowy klucz 32 bajty i nonce 12 bajtów
  const rawKey = crypto.randomBytes(32);
  const rawNonce = crypto.randomBytes(12);

  // Szyfrowanie ChaCha20
  const encryptedBytes = chacha20Encrypt(rawKey, rawNonce, plainBytes);

  // Podział klucza na 3 maski XOR (Key-Splitting)
  const part1 = crypto.randomBytes(32);
  const part2 = crypto.randomBytes(32);
  const part3 = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    part3[i] = rawKey[i] ^ part1[i] ^ part2[i];
  }

  const generatedTsContent = `/**
 * vault-payload.generated.ts
 * PLIK GENEROWANY AUTOMATYCZNIE PRZEZ scripts/pack-and-encrypt-rules.mjs
 * NIE EDYTUJ RĘCZNIE!
 */
import type { EncryptedVaultPayload } from './rules-vault';

export const GENERATED_RULES_VAULT_PAYLOAD: EncryptedVaultPayload = {
  nonce: "${rawNonce.toString('base64')}",
  data: "${Buffer.from(encryptedBytes).toString('base64')}",
  kParts: [
    [${Array.from(part1).join(',')}],
    [${Array.from(part2).join(',')}],
    [${Array.from(part3).join(',')}]
  ]
};
`;

  const targetPath = path.join(ROOT_DIR, 'A1_core', 'vault-payload.generated.ts');
  fs.writeFileSync(targetPath, generatedTsContent, 'utf-8');
  console.log(`[pack-and-encrypt-rules] Zapisano zaszyfrowany kontener do: ${targetPath}`);
  console.log(`[pack-and-encrypt-rules] Spakowano ${PROTECTED_RULES.length} reguł domenowych + ${b1Count} plików okuć B1 (${Math.round(plainBytes.length / 1024)} KB -> zaszyfrowane ${Math.round(encryptedBytes.length / 1024)} KB).`);
}

// Uruchomienie bezpośrednie ze skryptu
if (process.argv[1] && process.argv[1].endsWith('pack-and-encrypt-rules.mjs')) {
  packAndEncryptRules();
}
