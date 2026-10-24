/**
 * Loader licencji — wczytanie pliku `.lic`, weryfikacja podpisu, aktywacja,
 * przywracanie sesji i deaktywacja. To jedyna ścieżka odblokowania PRO.
 */

import { SaaSLicenseManager } from './saas-license-manager.js';
import { isLicenseExpired, parseLicenseFile, verifyLicenseFile } from './license-crypto.js';
import { SafeStorage } from './storage-helper.js';
import type { LicensePayload } from './types.js';

const LICENSE_STORAGE_KEY = 'smartpanel_license_file';

export type LicenseErrorCode = 'invalid_format' | 'invalid_signature' | 'expired';

export interface LicenseActivationResult {
  ok: boolean;
  error?: LicenseErrorCode;
  license?: LicensePayload;
}

/** Weryfikuje i aktywuje licencję z surowego tekstu pliku `.lic`. */
export async function activateLicenseText(raw: string): Promise<LicenseActivationResult> {
  const file = parseLicenseFile(raw);
  if (!file) return { ok: false, error: 'invalid_format' };

  const payload = await verifyLicenseFile(file);
  if (!payload) return { ok: false, error: 'invalid_signature' };
  if (isLicenseExpired(payload)) return { ok: false, error: 'expired' };

  try {
    SafeStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(file));
  } catch (err) {
    console.warn('[license] Nie udało się zapisać licencji:', err);
  }
  SaaSLicenseManager.instance.setLicense(payload);
  return { ok: true, license: payload };
}

/** Weryfikuje i aktywuje licencję z pliku wybranego przez użytkownika. */
export async function activateLicenseFromFile(file: File): Promise<LicenseActivationResult> {
  const text = await file.text();
  return activateLicenseText(text);
}

/**
 * Przywraca zapisaną licencję przy starcie aplikacji.
 * Niepoprawna lub wygasła licencja jest usuwana.
 */
export async function restoreLicense(): Promise<LicensePayload | null> {
  const raw = SafeStorage.getItem(LICENSE_STORAGE_KEY);
  if (!raw) return null;

  const file = parseLicenseFile(raw);
  if (!file) {
    SafeStorage.removeItem(LICENSE_STORAGE_KEY);
    return null;
  }

  const payload = await verifyLicenseFile(file);
  if (!payload || isLicenseExpired(payload)) {
    SafeStorage.removeItem(LICENSE_STORAGE_KEY);
    SaaSLicenseManager.instance.setLicense(null);
    return null;
  }

  SaaSLicenseManager.instance.setLicense(payload);
  return payload;
}

/** Usuwa licencję z urządzenia. */
export function deactivateLicense(): void {
  SafeStorage.removeItem(LICENSE_STORAGE_KEY);
  SaaSLicenseManager.instance.setLicense(null);
}
