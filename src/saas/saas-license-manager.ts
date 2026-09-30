import { FeatureEntitlement, SubscriptionTier, TIER_ENTITLEMENTS, UserProfile } from './types';

export class SaaSLicenseManager {
  private static _instance: SaaSLicenseManager | null = null;
  private _user: UserProfile | null = null;
  private _listeners: Array<(tier: SubscriptionTier) => void> = [];

  public static get instance(): SaaSLicenseManager {
    if (!SaaSLicenseManager._instance) {
      SaaSLicenseManager._instance = new SaaSLicenseManager();
    }
    return SaaSLicenseManager._instance;
  }

  public setUser(user: UserProfile | null): void {
    this._user = user;
    this.notify();
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
