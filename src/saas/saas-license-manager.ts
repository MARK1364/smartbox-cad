import { FeatureEntitlement, LicensePayload, SubscriptionTier, TIER_ENTITLEMENTS, UserProfile } from './types';

/** Symulatory planów działają wyłącznie w trybie developerskim (vite dev). */
const IS_DEV = (import.meta as any).env?.DEV === true;

export class SaaSLicenseManager {
  private static _instance: SaaSLicenseManager | null = null;
  private _user: UserProfile | null = null;
  private _license: LicensePayload | null = null;
  private _listeners: Array<(tier: SubscriptionTier) => void> = [];

  public static get instance(): SaaSLicenseManager {
    if (!SaaSLicenseManager._instance) {
      SaaSLicenseManager._instance = new SaaSLicenseManager();
    }
    return SaaSLicenseManager._instance;
  }

  public setUser(user: UserProfile | null): void {
    // Ważna licencja jest źródłem prawdy — nie pozwalamy nadpisać jej sesją mock.
    if (this._license) return;
    // Poza DEV nie przyznajemy planów płatnych bez licencji.
    if (user && user.tier !== 'FREE' && !IS_DEV) {
      user = { ...user, tier: 'FREE' };
    }
    this._user = user;
    this.notify();
  }

  /**
   * Ustawia zweryfikowaną licencję. Tier i profil wyprowadzane są z licencji —
   * to jedyna droga do odblokowania funkcji PRO (poza jawnym trybem DEV).
   */
  public setLicense(license: LicensePayload | null): void {
    this._license = license;
    if (license) {
      this._user = {
        id: license.licenseId,
        email: license.email,
        fullName: license.fullName || license.email.split('@')[0],
        tier: license.tier,
        subscriptionExpiresAt: license.expiresAt,
        createdAt: license.issuedAt,
      };
    } else {
      this._user = null;
    }
    this.notify();
  }

  public getLicense(): LicensePayload | null {
    return this._license;
  }

  public isLicensed(): boolean {
    return this._license !== null;
  }

  public getUser(): UserProfile | null {
    return this._user;
  }

  public getTier(): SubscriptionTier {
    return this._user?.tier || 'FREE';
  }

  public getEntitlements(): FeatureEntitlement {
    const tier = this.getTier();
    return TIER_ENTITLEMENTS[tier] || TIER_ENTITLEMENTS.FREE;
  }

  public canExportGCode(): boolean {
    return this.getEntitlements().canExportGCode;
  }

  public canUseNestingMultiSheet(): boolean {
    return this.getEntitlements().canUseNestingMultiSheet;
  }

  public canSharePublic3DLink(): boolean {
    return this.getEntitlements().canSharePublic3DLink;
  }

  public maxCloudProjects(): number {
    return this.getEntitlements().maxCloudProjects;
  }

  public subscribe(callback: (tier: SubscriptionTier) => void): () => void {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    const tier = this.getTier();
    for (const listener of this._listeners) {
      try {
        listener(tier);
      } catch (err) {
        console.error('[SaaSLicenseManager] Listener error:', err);
      }
    }
  }
}
