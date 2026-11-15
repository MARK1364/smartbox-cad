import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initRulesVault, 
  getModuleRules, 
  setEncryptedVaultPayload, 
  resetRulesVault,
  getAllRegisteredRuleIds
} from '../rules-vault';
import { GENERATED_RULES_VAULT_PAYLOAD } from '../vault-payload.generated';

describe('Generated Vault E2E', () => {
  beforeEach(() => {
    resetRulesVault();
  });

  it('successfully initializes and decrypts all production rules and hardware', () => {
    setEncryptedVaultPayload(GENERATED_RULES_VAULT_PAYLOAD);
    initRulesVault();

    const ids = getAllRegisteredRuleIds();
    expect(ids).toContain('03_shelf');
    expect(ids).toContain('korpus3');
    expect(ids).toContain('05_doors');
    expect(ids).toContain('09_drawers');
    expect(ids).toContain('connectors_3_rules');
    expect(ids).toContain('assembly_sequence_rules');
    expect(ids).toContain('smart_panel_V1');
    expect(ids).toContain('ramka_alu_templates');
    expect(ids).toContain('operacje');
    expect(ids).toContain('b1_hardware');

    // Sprawdźmy poprawność danych domenowych w zdeszyfrowanym korpus3
    const korpus3 = getModuleRules('korpus3');
    expect(korpus3).toBeDefined();
    expect(korpus3.metadata.module_type).toBe('SMARTFRAME_KORPUS3');

    // Sprawdźmy poprawność 04_shelves
    const shelves = getModuleRules('04_shelves');
    expect(shelves).toBeDefined();
    expect(shelves.metadata.module_type).toBe('BLOKI_SHELVES');
  });
});
