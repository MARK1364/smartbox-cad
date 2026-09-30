import { describe, it, expect, beforeEach } from 'vitest';
import { SaaSLicenseManager } from '../saas-license-manager';
import { SaaSAuthService } from '../saas-auth-service';
import { SaaSProjectService } from '../saas-project-service';
import { SafeStorage } from '../storage-helper';
import { TIER_ENTITLEMENTS } from '../types';

describe('SaaS Architecture & Feature Gating Tests', () => {
  beforeEach(() => {
    SafeStorage.clear();
    SaaSAuthService.instance.signOut();
  });

  it('powinien domyślnie posiadać uprawnienia FREE dla niezalogowanego gościa', () => {
    const license = SaaSLicenseManager.instance;
    expect(license.getTier()).toBe('FREE');
    expect(license.canExportGCode()).toBe(false);
    expect(license.maxCloudProjects()).toBe(TIER_ENTITLEMENTS.FREE.maxCloudProjects);
  });

  it('powinien poprawnie logować użytkownika w trybie FREE oraz aktualizować uprawnienia', async () => {
    const user = await SaaSAuthService.instance.signIn('stolarz.poczatkujacy@test.pl');
    expect(user.tier).toBe('FREE');
    expect(SaaSAuthService.instance.isAuthenticated()).toBe(true);

    const license = SaaSLicenseManager.instance;
    expect(license.getTier()).toBe('FREE');
    expect(license.canExportGCode()).toBe(false);
    expect(license.canSharePublic3DLink()).toBe(false);
  });

  it('powinien odblokować funkcje PRO (G-Code, multi-sheet nesting, share link) dla użytkownika PRO', async () => {
    const user = await SaaSAuthService.instance.signIn('mistrz.stolarski.pro@test.pl');
    expect(user.tier).toBe('PRO');

    const license = SaaSLicenseManager.instance;
    expect(license.getTier()).toBe('PRO');
    expect(license.canExportGCode()).toBe(true);
    expect(license.canUseNestingMultiSheet()).toBe(true);
    expect(license.canSharePublic3DLink()).toBe(true);
    expect(license.maxCloudProjects()).toBe(100);
  });

  it('powinien zapisywać i wczytywać projekt w chmurze (SaaSProjectService)', async () => {
    await SaaSAuthService.instance.signIn('jan.pro@test.pl');

    const cadMock = {
      rootNode: { name: 'Szafka_Kuchenna', panels: [{ id: 'p1', width: 600 }] }
    };

    const saved = await SaaSProjectService.instance.saveProject('Kuchnia Nowaka', cadMock);
    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Kuchnia Nowaka');
    expect(saved.version).toBe(1);

    const list = await SaaSProjectService.instance.listProjects();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Kuchnia Nowaka');

    const loaded = await SaaSProjectService.instance.loadProject(saved.id);
    expect(loaded.cadDocument).toEqual(cadMock);
  });

  it('powinien egzekwować limit projektów dla planu FREE', async () => {
    await SaaSAuthService.instance.signIn('uzytkownik.free@test.pl');
    const max = TIER_ENTITLEMENTS.FREE.maxCloudProjects; // 3

    for (let i = 0; i < max; i++) {
      await SaaSProjectService.instance.saveProject(`Projekt_${i}`, { index: i });
    }

    // Próba zapisu 4-tego projektu na planie FREE powinna rzucić błąd limitu
    await expect(
      SaaSProjectService.instance.saveProject('Projekt_Przekraczajacy_Limit', {})
    ).rejects.toThrow(/limit/i);
  });

  it('powinien wspierać dynamiczną aktualizację subskrypcji (np. po Stripe webhook)', async () => {
    await SaaSAuthService.instance.signIn('klient@firma.pl');
    expect(SaaSLicenseManager.instance.canExportGCode()).toBe(false);

    // Symulacja aktywacji subskrypcji PRO
    SaaSAuthService.instance.setTier('PRO');
    expect(SaaSLicenseManager.instance.getTier()).toBe('PRO');
    expect(SaaSLicenseManager.instance.canExportGCode()).toBe(true);
  });
});
