/**
 * Weryfikacja licencji offline — Ed25519 przez WebCrypto (bez zależności).
 *
 * Licencja = payload + podpis Ed25519 (base64url). Podpis tworzony jest po
 * kanonicznej (deterministycznej) formie payloadu, dzięki czemu kolejność pól
 * w pliku `.lic` jest bez znaczenia. Klucz prywatny wydawcy NIGDY nie trafia do
 * aplikacji — wbudowany jest wyłącznie klucz publiczny.
 *
 * Rodzina: 100% lokalna. Nie chroni przed patchowaniem klienta, ale daje
 * kontrolę (ty wydajesz licencje) i watermark do wykrywania wycieków.
 */

import type { LicenseFile, LicensePayload } from './types.js';

/**
 * Publiczny klucz wydawcy (32-bajtowy raw Ed25519, base64url).
 * Wygenerowany przez `node scripts/gen-license.mjs keygen`.
 * Wklej tu wynik `PUBLIC_KEY_B64U` z tego polecenia.
 */
export const LICENSE_PUBLIC_KEY_B64U = '0r65sws4rvvo4Vhn_sDLpiaSEKXY6aEybsQD6dCUuCw';

const ALG = 'Ed25519' as const;

function getCrypto(): Crypto {
  const c = (globalThis as any).crypto as Crypto | undefined;
  if (!c || !c.subtle) {
    throw new Error('[license] Brak WebCrypto (crypto.subtle) w tym środowisku.');
  }
  return c;
}

/** base64url → bajty (bez paddingu). */
export function base64UrlToBytes(b64u: string): Uint8Array {
  const normalized = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** bajty → base64url (bez paddingu). */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Kanoniczna, deterministyczna serializacja payloadu licencji.
 * MUSI być identyczna w `scripts/gen-license.mjs`.
 */
export function canonicalizeLicensePayload(payload: LicensePayload): string {
  const ordered: Record<string, unknown> = {
    licenseId: payload.licenseId ?? '',
    email: payload.email ?? '',
    fullName: payload.fullName ?? '',
    tier: payload.tier ?? 'FREE',
    issuedAt: payload.issuedAt ?? '',
    expiresAt: payload.expiresAt ?? '',
    features: payload.features && payload.features.length
      ? [...payload.features].sort()
      : null,
  };
  return JSON.stringify(ordered);
}

/** Parsuje surowy tekst pliku `.lic` do obiektu. Zwraca null gdy to nie JSON. */
export function parseLicenseFile(raw: string): LicenseFile | null {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object') return null;
    if (typeof (obj as any).sig !== 'string' || !(obj as any).sig) return null;
    return obj as LicenseFile;
  } catch {
    return null;
  }
}

/**
 * Weryfikuje podpis pliku licencji. Zwraca payload (bez podpisu) gdy poprawny,
 * albo null gdy podpis/klucz/format są błędne.
 *
 * @param publicKeyB64u pozwala wstawić klucz publiczny (testy / rotacja kluczy).
 */
export async function verifyLicenseFile(
  file: LicenseFile,
  publicKeyB64u: string = LICENSE_PUBLIC_KEY_B64U,
): Promise<LicensePayload | null> {
  try {
    if (!file || typeof file.sig !== 'string' || !file.sig) return null;
    const { sig, alg: _alg, ...payload } = file;

    const crypto = getCrypto();
    const publicKey = await crypto.subtle.importKey(
      'raw',
      base64UrlToBytes(publicKeyB64u) as unknown as BufferSource,
      { name: ALG },
      false,
      ['verify'],
    );

    const data = new TextEncoder().encode(canonicalizeLicensePayload(payload));
    const signature = base64UrlToBytes(sig) as unknown as BufferSource;

    const valid = await crypto.subtle.verify({ name: ALG }, publicKey, signature, data);
    return valid ? payload : null;
  } catch (err) {
    console.warn('[license] Weryfikacja nie powiodła się:', err);
    return null;
  }
}

/** Czy licencja wygasła? Brak `expiresAt` = bezterminowa. */
export function isLicenseExpired(payload: LicensePayload, now: Date = new Date()): boolean {
  if (!payload.expiresAt) return false;
  const exp = new Date(payload.expiresAt);
  if (Number.isNaN(exp.getTime())) return true;
  return exp.getTime() < now.getTime();
}
