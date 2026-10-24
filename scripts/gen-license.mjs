#!/usr/bin/env node
/**
 * Generator licencji SmartPanel CAD (offline, Ed25519).
 *
 * Użycie:
 *   node scripts/gen-license.mjs keygen
 *       Generuje parę kluczy. Zapisuje klucz PRYWATNY do `license-private.key`
 *       (gitignore) i wypisuje klucz PUBLICZNY — wklej go do
 *       `src/saas/license-crypto.ts` (LICENSE_PUBLIC_KEY_B64U).
 *
 *   node scripts/gen-license.mjs sign <email> <TIER> <dni|0=bezterminowa> [imię/nazwa]
 *       Tworzy plik licencji `licenses/<email>.lic`.
 *
 * Przykład:
 *   node scripts/gen-license.mjs sign stolarz@firma.pl PRO 365 "Jan Kowalski"
 *
 * Klucz prywatny NIGDY nie może trafić do repo ani do zbudowanej aplikacji.
 */

import { webcrypto as crypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const PRIVATE_KEY_FILE = path.join(ROOT, 'license-private.key');
const LICENSES_DIR = path.join(ROOT, 'licenses');

function b64uEncode(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

/** MUSI być identyczne z `canonicalizeLicensePayload` w src/saas/license-crypto.ts. */
function canonicalizePayload(payload) {
  const ordered = {
    licenseId: payload.licenseId ?? '',
    email: payload.email ?? '',
    fullName: payload.fullName ?? '',
    tier: payload.tier ?? 'FREE',
    issuedAt: payload.issuedAt ?? '',
    expiresAt: payload.expiresAt ?? '',
    features: payload.features && payload.features.length ? [...payload.features].sort() : null,
  };
  return JSON.stringify(ordered);
}

function randomLicenseId() {
  const hex = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(hex, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `LIC-${new Date().getFullYear()}-${suffix}`;
}

async function keygen() {
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    console.error(`\n  UWAGA: ${PRIVATE_KEY_FILE} już istnieje.`);
    console.error('  Usuń go ręcznie, jeśli naprawdę chcesz wygenerować nową parę');
    console.error('  (stare licencje staną się nieważne).\n');
    process.exit(1);
  }

  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));

  fs.writeFileSync(PRIVATE_KEY_FILE, b64uEncode(pkcs8), 'utf8');

  console.log('\n  Wygenerowano parę kluczy Ed25519.\n');
  console.log(`  Klucz prywatny  → ${PRIVATE_KEY_FILE}`);
  console.log('  (plik jest w .gitignore — NIE commituj go, zrób kopię offline)\n');
  console.log('  Wklej poniższy klucz PUBLICZNY do src/saas/license-crypto.ts');
  console.log('  (pole LICENSE_PUBLIC_KEY_B64U):\n');
  console.log(`  ${b64uEncode(rawPub)}\n`);
}

async function sign(email, tier, daysArg, fullName) {
  if (!fs.existsSync(PRIVATE_KEY_FILE)) {
    console.error(`\n  BŁĄD: brak ${PRIVATE_KEY_FILE}. Uruchom najpierw:`);
    console.error('    node scripts/gen-license.mjs keygen\n');
    process.exit(1);
  }

  const normalizedTier = String(tier || 'PRO').toUpperCase();
  if (!['FREE', 'PRO', 'ENTERPRISE'].includes(normalizedTier)) {
    console.error(`  BŁĄD: nieznany tier "${tier}". Dozwolone: FREE, PRO, ENTERPRISE.`);
    process.exit(1);
  }

  const days = Number.parseInt(daysArg ?? '0', 10);
  if (Number.isNaN(days) || days < 0) {
    console.error(`  BŁĄD: nieprawidłowa liczba dni "${daysArg}".`);
    process.exit(1);
  }

  const pkcs8 = b64uDecode(fs.readFileSync(PRIVATE_KEY_FILE, 'utf8').trim());
  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);

  const now = new Date();
  const expiresAt = days > 0 ? new Date(now.getTime() + days * 86400000).toISOString() : null;

  const payload = {
    licenseId: randomLicenseId(),
    email,
    fullName: fullName || undefined,
    tier: normalizedTier,
    issuedAt: now.toISOString(),
    expiresAt,
  };

  const data = new TextEncoder().encode(canonicalizePayload(payload));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key, data));

  const licenseFile = { ...payload, alg: 'Ed25519', sig: b64uEncode(sig) };

  fs.mkdirSync(LICENSES_DIR, { recursive: true });
  const safeName = email.replace(/[^a-z0-9._-]+/gi, '_');
  const outPath = path.join(LICENSES_DIR, `${safeName}.lic`);
  fs.writeFileSync(outPath, JSON.stringify(licenseFile, null, 2), 'utf8');

  console.log('\n  Licencja utworzona:\n');
  console.log(`    ${outPath}`);
  console.log(`    ID: ${payload.licenseId}`);
  console.log(`    E-mail: ${email}`);
  console.log(`    Plan: ${normalizedTier}`);
  console.log(`    Wygasa: ${expiresAt ?? 'bezterminowo'}\n`);
  console.log('  Wyślij ten plik użytkownikowi. W aplikacji: menu → Plan PRO → Wgraj plik licencji.\n');
}

function usage() {
  console.log(`
  Generator licencji SmartPanel CAD

    node scripts/gen-license.mjs keygen
    node scripts/gen-license.mjs sign <email> <TIER> <dni|0> [imię/nazwa]

  TIER: FREE | PRO | ENTERPRISE
  dni:  liczba dni ważności, 0 = bezterminowo
`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'keygen':
      await keygen();
      break;
    case 'sign':
      await sign(rest[0], rest[1], rest[2], rest.slice(3).join(' ') || undefined);
      break;
    default:
      usage();
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('\n  BŁĄD:', err?.message || err, '\n');
  process.exit(1);
});
