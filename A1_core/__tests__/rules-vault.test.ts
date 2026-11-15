import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initRulesVault, 
  getModuleRules, 
  registerModuleRules, 
  setEncryptedVaultPayload,
  resetRulesVault,
  EncryptedVaultPayload
} from '../rules-vault';
import { chacha20Transform, uint8ArrayToBase64 } from '../crypto/synced-cipher';

describe('RulesVault', () => {
  beforeEach(() => {
    resetRulesVault();
  });
  it('registers and retrieves rules synchronously in memory', () => {
    registerModuleRules('test_shelf', { shelfThickness: 18, holes: [1, 2, 3] });
    const rules = getModuleRules('test_shelf');
    expect(rules).toEqual({ shelfThickness: 18, holes: [1, 2, 3] });
  });

  it('throws error when rule is missing', () => {
    expect(() => getModuleRules('non_existent_rule')).toThrowError(/Brak reguł produkcyjnych/);
  });

  it('throws fail-fast error when payload is empty and cache is empty', () => {
    setEncryptedVaultPayload({ nonce: '', data: '', kParts: [] });
    expect(() => initRulesVault()).toThrowError(/FAIL-FAST/);
  });

  it('decrypts encrypted payload on init', () => {
    const rawData = {
      '03_shelf': { name: 'Półka', thickness: 18 },
      'korpus3': { name: 'Korpus', zones: 3 }
    };
    const encoder = new TextEncoder();
    const plainBytes = encoder.encode(JSON.stringify(rawData));

    // Klucz 32 bajty
    const realKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) realKey[i] = (i + 17) & 0xff;

    // Podział klucza na 2 części XOR
    const partA = new Uint8Array(32);
    const partB = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      partA[i] = (i * 3 + 5) & 0xff;
      partB[i] = realKey[i] ^ partA[i];
    }

    const nonce = new Uint8Array(12).fill(99);
    const encryptedBytes = chacha20Transform(realKey, nonce, plainBytes);

    const payload: EncryptedVaultPayload = {
      nonce: uint8ArrayToBase64(nonce),
      data: uint8ArrayToBase64(encryptedBytes),
      kParts: [Array.from(partA), Array.from(partB)]
    };

    setEncryptedVaultPayload(payload);
    initRulesVault();

    expect(getModuleRules('03_shelf')).toEqual({ name: 'Półka', thickness: 18 });
    expect(getModuleRules('korpus3')).toEqual({ name: 'Korpus', zones: 3 });
  });
});
