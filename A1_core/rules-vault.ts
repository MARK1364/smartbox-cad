/**
 * rules-vault.ts
 * 
 * Centralny, bezpieczny magazyn reguł modułów (A2_bloki, A3_smartframe).
 * 
 * ZASADY ARCHITEKTONICZNE:
 * 1. 100% SYNCHRONICZNY odczyt O(1): getModuleRules('03_shelf') / getModuleRules('korpus3').
 *    Silniki A2 i A3 to czyste funkcje matematyczne działające synchronicznie w 60 FPS.
 * 2. Samoczynna inicjalizacja: Pierwsze wywołanie getModuleRules() natychmiast odszyfrowuje
 *    zaszyfrowany kontener w pamięci operacyjnej (< 1 ms).
 * 3. W kodzie JS dla środowiska produkcyjnego brak czytelnych JSON-ów i brak jawnych stringów haseł.
 */

import { chacha20Transform, base64ToUint8Array } from './crypto/synced-cipher';
import { GENERATED_RULES_VAULT_PAYLOAD } from './vault-payload.generated';

// Domyślny wewnętrzny stan w pamięci RAM
const _rulesCache = new Map<string, any>();
let _isInitialized = false;

export interface EncryptedVaultPayload {
  nonce: string; // Base64
  data: string;  // Base64
  kParts: number[][]; // Składowe XOR klucza 32-bajtowego
}

let _encryptedPayload: EncryptedVaultPayload | null = GENERATED_RULES_VAULT_PAYLOAD;

/**
 * Pozwala wstrzyknąć zaszyfrowany payload wygenerowany podczas buildu lub w testach
 */
export function setEncryptedVaultPayload(payload: EncryptedVaultPayload): void {
  _encryptedPayload = payload;
  _isInitialized = false;
}

/**
 * Czyści pamięć podręczną (używane w testach jednostkowych)
 */
export function resetRulesVault(): void {
  _rulesCache.clear();
  _encryptedPayload = GENERATED_RULES_VAULT_PAYLOAD;
  _isInitialized = false;
}

/**
 * Odtwarza 32-bajtowy klucz z fragmentów XOR
 */
function reconstructKey(parts: number[][]): Uint8Array {
  const key = new Uint8Array(32);
  for (const part of parts) {
    for (let i = 0; i < 32; i++) {
      key[i] ^= (part[i] || 0);
    }
  }
  return key;
}

/**
 * Inicjalizuje magazyn reguł w pamięci RAM (synchronicznie, < 1 ms).
 * Idempotentne.
 */
export function initRulesVault(): void {
  if (_isInitialized) return;

  if (_encryptedPayload && _encryptedPayload.data) {
    try {
      const key = reconstructKey(_encryptedPayload.kParts);
      const nonce = base64ToUint8Array(_encryptedPayload.nonce);
      const encryptedBytes = base64ToUint8Array(_encryptedPayload.data);

      const decryptedBytes = chacha20Transform(key, nonce, encryptedBytes);
      const decoder = new TextDecoder();
      const jsonText = decoder.decode(decryptedBytes);
      const dictionary = JSON.parse(jsonText);

      for (const [key, rules] of Object.entries(dictionary)) {
        _rulesCache.set(key, rules);
      }
      _isInitialized = true;
      return;
    } catch (err) {
      _isInitialized = false;
      throw new Error(`[RulesVault] Krytyczny błąd deszyfrowania zasobów reguł produkcyjnych: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Jeśli brak payloadu, a cache jest pusty -> fail-fast!
  if (_rulesCache.size === 0) {
    _isInitialized = false;
    throw new Error('[RulesVault] Krytyczny błąd (FAIL-FAST): Brak zaszyfrowanego pakietu reguł produkcyjnych (pusty lub brakujący payload). Uruchom "npm run build:vault" lub skrypt pakujący.');
  }

  _isInitialized = true;
}

/**
 * Rejestruje regułę ręcznie (używane w trybie DEV / testach Vitest)
 */
export function registerModuleRules(id: string, rules: any): void {
  _rulesCache.set(id, rules);
}

/**
 * Pobiera regułę produkcyjną dla wskazanego modułu (synchronicznie O(1)).
 * Jeśli nie zainicjalizowano, samoczynnie odszyfrowuje pakiet przy pierwszym odczycie.
 */
export function getModuleRules<T = any>(id: string): T {
  if (!_isInitialized) {
    initRulesVault();
  }

  const rules = _rulesCache.get(id);
  if (!rules) {
    throw new Error(`[RulesVault] Brak reguł produkcyjnych dla modułu: '${id}'. Upewnij się, że reguła została zarejestrowana.`);
  }
  return rules as T;
}

/**
 * Sprawdza czy reguła jest dostępna w pamięci
 */
export function hasModuleRules(id: string): boolean {
  if (!_isInitialized) initRulesVault();
  return _rulesCache.has(id);
}

/**
 * Zwraca mapę modułów okuć z B1_biblioteka pasujących do wskazanego prefiksu ścieżki
 * (np. './zawiasy/', './szuflady/', './uchwyty/').
 * Zastępuje bezpośrednie użycie Vite import.meta.glob dla plików JSON,
 * eliminując wyciek baz okuć w wyjściowym bundle.
 */
export function getHardwareFileModules(patternPrefix: string): Record<string, any> {
  const hardwareDict = getModuleRules<Record<string, any>>('b1_hardware');
  const result: Record<string, any> = {};
  const normalizedPrefix = patternPrefix.replace(/\\/g, '/');

  for (const [relPath, content] of Object.entries(hardwareDict)) {
    if (relPath.startsWith(normalizedPrefix) || relPath.includes(normalizedPrefix.replace(/^\.\//, ''))) {
      result[relPath] = content;
    }
  }

  return result;
}

/**
 * Zwraca listę zarejestrowanych identyfikatorów reguł
 */
export function getAllRegisteredRuleIds(): string[] {
  if (!_isInitialized) initRulesVault();
  return Array.from(_rulesCache.keys());
}
