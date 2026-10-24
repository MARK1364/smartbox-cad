/**
 * Brama eksportu (gate) — decyduje czy użytkownik może wykonać akcję
 * produkcyjną (eksport G-code) i czy wynik ma zostać opatrzony watermarkiem.
 *
 * Model:
 *  - Licencja  → pełny dostęp (watermark śledzący z ID licencji).
 *  - Trial     → 1 darmowy eksport z widocznym watermarkiem "WERSJA PRÓBNA".
 *  - Blocked   → trial wykorzystany, brak licencji → akcja zablokowana.
 *
 * Wszystko lokalnie ($0). Gdy pojawi się serwer, `checkExportGate` podmienia się
 * na wariant zdalny — reszta kodu (komponenty) nie wymaga zmian.
 */

import { SaaSLicenseManager } from './saas-license-manager.js';
import { SafeStorage } from './storage-helper.js';
import type { LicensePayload } from './types.js';

const TRIAL_EXPORT_KEY = 'smartpanel_trial_export_used';

export type GateReason = 'licensed' | 'trial' | 'blocked';

export interface ExportGateResult {
  allowed: boolean;
  watermark: boolean;
  watermarkText: string;
  reason: GateReason;
}

export function hasUsedTrialExport(): boolean {
  return SafeStorage.getItem(TRIAL_EXPORT_KEY) === '1';
}

export function consumeTrialExport(): void {
  SafeStorage.setItem(TRIAL_EXPORT_KEY, '1');
}

/** Reset triala — przydatne w testach / trybie DEV. */
export function resetTrialExport(): void {
  SafeStorage.removeItem(TRIAL_EXPORT_KEY);
}

function licenseWatermark(license: LicensePayload): string {
  return `Licencja ${license.email} [${license.licenseId}]`;
}

const TRIAL_WATERMARK = 'WERSJA PRÓBNA (TRIAL) — nieaktywna licencja. Kup licencję, aby usunąć znak wodny.';

export function checkExportGate(): ExportGateResult {
  const license = SaaSLicenseManager.instance.getLicense();

  if (license) {
    return {
      allowed: true,
      watermark: true,
      watermarkText: licenseWatermark(license),
      reason: 'licensed',
    };
  }

  if (!hasUsedTrialExport()) {
    return {
      allowed: true,
      watermark: true,
      watermarkText: TRIAL_WATERMARK,
      reason: 'trial',
    };
  }

  return {
    allowed: false,
    watermark: false,
    watermarkText: '',
    reason: 'blocked',
  };
}
