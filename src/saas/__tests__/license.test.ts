import { describe, it, expect, beforeEach } from 'vitest';
import {
  canonicalizeLicensePayload,
  verifyLicenseFile,
  isLicenseExpired,
  bytesToBase64Url,
  parseLicenseFile,
} from '../license-crypto';
import { checkExportGate, consumeTrialExport, resetTrialExport } from '../saas-gate';
import { watermarkGCode } from '../watermark';
import { SaaSLicenseManager } from '../saas-license-manager';
import { SafeStorage } from '../storage-helper';
import type { LicensePayload } from '../types';

const crypto = globalThis.crypto;

async function makeKeyPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
}

async function exportPubB64u(key: CryptoKey): Promise<string> {
  const raw = new Uint8Array((await crypto.subtle.exportKey('raw', key)) as ArrayBuffer);
  return bytesToBase64Url(raw);
}

async function signPayload(payload: LicensePayload, privateKey: CryptoKey) {
  const data = new TextEncoder().encode(canonicalizeLicensePayload(payload));
  const sig = new Uint8Array(
    (await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, data)) as ArrayBuffer,
  );
  return { ...payload, alg: 'Ed25519' as const, sig: bytesToBase64Url(sig) };
}

const basePayload: LicensePayload = {
  licenseId: 'LIC-TEST-0001',
  email: 'test@firma.pl',
  fullName: 'Jan Testowy',
  tier: 'PRO',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: null,
};

describe('Licencje offline (Ed25519)', () => {
  beforeEach(() => {
    SafeStorage.clear();
    SaaSLicenseManager.instance.setLicense(null);
    resetTrialExport();
  });

  it('kanonizacja jest deterministyczna niezależnie od kolejności pól', () => {
    const a = canonicalizeLicensePayload({ ...basePayload });
    const b = canonicalizeLicensePayload({
      expiresAt: null,
      tier: 'PRO',
      email: 'test@firma.pl',
      fullName: 'Jan Testowy',
      issuedAt: '2026-01-01T00:00:00.000Z',
      licenseId: 'LIC-TEST-0001',
    } as LicensePayload);
    expect(a).toBe(b);
  });

  it('weryfikuje poprawnie podpisany plik licencji', async () => {
    const pair = await makeKeyPair();
    const pub = await exportPubB64u(pair.publicKey);
    const file = await signPayload(basePayload, pair.privateKey);

    const payload = await verifyLicenseFile(file, pub);
    expect(payload).not.toBeNull();
    expect(payload?.licenseId).toBe('LIC-TEST-0001');
    expect(payload?.tier).toBe('PRO');
    expect((payload as any).sig).toBeUndefined();
  });

  it('odrzuca licencję ze zmienionym payloadem (podpis się nie zgadza)', async () => {
    const pair = await makeKeyPair();
    const pub = await exportPubB64u(pair.publicKey);
    const file = await signPayload(basePayload, pair.privateKey);

    const tampered = { ...file, tier: 'ENTERPRISE' as const };
    const payload = await verifyLicenseFile(tampered, pub);
    expect(payload).toBeNull();
  });

  it('odrzuca licencję z nieprawidłowym kluczem publicznym', async () => {
    const pair = await makeKeyPair();
    const other = await makeKeyPair();
    const file = await signPayload(basePayload, pair.privateKey);
    const wrongPub = await exportPubB64u(other.publicKey);

    expect(await verifyLicenseFile(file, wrongPub)).toBeNull();
  });

  it('rozpoznaje wygasłą i bezterminową licencję', () => {
    expect(isLicenseExpired({ ...basePayload, expiresAt: null })).toBe(false);
    expect(isLicenseExpired({ ...basePayload, expiresAt: '2020-01-01T00:00:00.000Z' })).toBe(true);
    expect(isLicenseExpired({ ...basePayload, expiresAt: '2999-01-01T00:00:00.000Z' })).toBe(false);
  });

  it('parseLicenseFile odrzuca nie-JSON oraz pliki bez podpisu', () => {
    expect(parseLicenseFile('to nie json')).toBeNull();
    expect(parseLicenseFile(JSON.stringify({ email: 'x@y.pl' }))).toBeNull();
    expect(parseLicenseFile(JSON.stringify({ ...basePayload, sig: 'abc' }))).not.toBeNull();
  });
});

describe('Brama eksportu (gate) i trial', () => {
  beforeEach(() => {
    SafeStorage.clear();
    SaaSLicenseManager.instance.setLicense(null);
    resetTrialExport();
  });

  it('bez licencji pierwszy eksport = trial z watermarkiem', () => {
    const gate = checkExportGate();
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBe('trial');
    expect(gate.watermark).toBe(true);
  });

  it('po wykorzystaniu triala eksport jest zablokowany', () => {
    consumeTrialExport();
    const gate = checkExportGate();
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('blocked');
  });

  it('z ważną licencją eksport jest dozwolony', () => {
    SaaSLicenseManager.instance.setLicense(basePayload);
    const gate = checkExportGate();
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBe('licensed');
    expect(gate.watermarkText).toContain(basePayload.email);
  });
});

describe('Watermark G-code', () => {
  it('Mach3/Fanuc — komentarz w nawiasach', () => {
    const out = watermarkGCode('G55\nG80 G90', 'Mach3', 'X');
    expect(out.startsWith('(Crevo CAM | X)')).toBe(true);
  });

  it('SCM — komentarz średnikiem', () => {
    const out = watermarkGCode('H DX=1', 'SCM', 'X');
    expect(out.startsWith('; ')).toBe(true);
  });

  it('WoodWOP — klucz w bloku [HEADER]', () => {
    const out = watermarkGCode('[HEADER]\nTYPE=MPR', 'WoodWOP', 'X');
    expect(out).toContain('[HEADER]\nWATERMARK=X');
  });

  it('Biesse — klucz w bloku nagłówka przed END HEADER', () => {
    const out = watermarkGCode('BEGIN HEADER\nEND HEADER', 'Biesse', 'X');
    expect(out).toContain('  WATERMARK=X\nEND HEADER');
  });
});
