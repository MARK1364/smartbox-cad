import { SaaSLicenseManager } from './saas-license-manager';
import { SubscriptionTier, UserProfile } from './types';
import { SafeStorage } from './storage-helper';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

const STORAGE_KEY_USER = 'smartpanel_saas_user';
const STORAGE_KEY_TOKEN = 'smartpanel_saas_token';

/** Symulatory planów działają wyłącznie w trybie developerskim (vite dev). */
const IS_DEV = (import.meta as any).env?.DEV === true;

export class SaaSAuthService {
  private static _instance: SaaSAuthService | null = null;
  private _currentUser: UserProfile | null = null;
  private _token: string | null = null;
  private _listeners: Array<(user: UserProfile | null) => void> = [];

  public static get instance(): SaaSAuthService {
    if (!SaaSAuthService._instance) {
      SaaSAuthService._instance = new SaaSAuthService();
    }
    return SaaSAuthService._instance;
  }

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      const stored = SafeStorage.getItem(STORAGE_KEY_USER);
      if (stored) {
        this._currentUser = JSON.parse(stored);
        this._token = SafeStorage.getItem(STORAGE_KEY_TOKEN);
        SaaSLicenseManager.instance.setUser(this._currentUser);
      }
    } catch (e) {
      console.warn('[SaaSAuth] Failed to restore session', e);
    }
  }

  public getCurrentUser(): UserProfile | null {
    return this._currentUser;
  }

  public isAuthenticated(): boolean {
    return this._currentUser !== null;
  }

  public getToken(): string | null {
    return this._token;
  }

  /**
   * Logowanie za pomocą email i hasła.
   * Wspiera zarówno backend w chmurze (Supabase) jak i lokalny mock trybu standalone.
   */
  public async signIn(email: string, _password?: string): Promise<UserProfile> {
    // 1. Sprawdź czy zdefiniowano klucze Supabase w zmiennych środowiskowych
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
          },
          body: JSON.stringify({ email, password: _password }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.msg || errData.error_description || tx(srcTekst, 'saas_svc.auth_fallback', TX_NS));
        }
        const data = await response.json();
        const user: UserProfile = {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name || email.split('@')[0],
          tier: (data.user.user_metadata?.tier as SubscriptionTier) || 'FREE',
          createdAt: data.user.created_at,
        };
        this.setSession(user, data.access_token);
        return user;
      } catch (err: any) {
        console.warn('[SaaSAuth] Supabase direct login failed, falling back or throwing:', err.message);
        throw err;
      }
    }

    // Tryb lokalny / Standalone SaaS Simulator.
    // UWAGA: poza trybem DEV mock nigdy nie przyznaje planu płatnego — jedyną
    // drogą do PRO jest zweryfikowana licencja (license-loader).
    const isPro = IS_DEV && (email.toLowerCase().includes('pro') || email.toLowerCase().includes('admin'));
    const isEnterprise = IS_DEV && (email.toLowerCase().includes('enterprise') || email.toLowerCase().includes('fabryka'));

    const tier: SubscriptionTier = isEnterprise ? 'ENTERPRISE' : isPro ? 'PRO' : 'FREE';

    const user: UserProfile = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email,
      fullName: email.split('@')[0].toUpperCase(),
      tier,
      createdAt: new Date().toISOString(),
    };

    this.setSession(user, `mock_jwt_token_${user.id}`);
    return user;
  }

  /**
   * Rejestracja nowego konta
   */
  public async signUp(email: string, fullName: string, _password?: string, defaultTier: SubscriptionTier = 'FREE'): Promise<UserProfile> {
    const user: UserProfile = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email,
      fullName: fullName || email.split('@')[0],
      tier: defaultTier,
      createdAt: new Date().toISOString(),
    };

    this.setSession(user, `mock_jwt_token_${user.id}`);
    return user;
  }

  /**
   * Logowanie kontem Google One-Click
   */
  public async signInWithGoogle(googleEmail?: string, googleName?: string): Promise<UserProfile> {
    const email = googleEmail || 'uzytkownik.google@smartpanel.cad';
    const user: UserProfile = {
      id: `usr_google_${Date.now()}`,
      email,
      fullName: googleName || tx(srcTekst, 'saas_svc.google_user', TX_NS),
      tier: IS_DEV ? 'PRO' : 'FREE', // PRO tylko w DEV; produkcyjnie wymaga licencji
      createdAt: new Date().toISOString(),
    };

    this.setSession(user, `google_oauth_token_${user.id}`);
    return user;
  }

  /**
   * Zmiana planu subskrypcji użytkownika (np. po płatności Stripe)
   */
  public setTier(tier: SubscriptionTier): void {
    if (!this._currentUser) return;
    // Podniesienie planu bez licencji jest zablokowane poza trybem DEV.
    if (tier !== 'FREE' && !IS_DEV && !SaaSLicenseManager.instance.isLicensed()) {
      console.warn('[SaaSAuth] Odblokowanie planu bez licencji zostało zablokowane.');
      return;
    }
    this._currentUser = {
      ...this._currentUser,
      tier,
    };
    this.setSession(this._currentUser, this._token);
  }

  public signOut(): void {
    this._currentUser = null;
    this._token = null;
    SafeStorage.removeItem(STORAGE_KEY_USER);
    SafeStorage.removeItem(STORAGE_KEY_TOKEN);
    SaaSLicenseManager.instance.setUser(null);
    this.notify();
  }

  public subscribe(callback: (user: UserProfile | null) => void): () => void {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  private setSession(user: UserProfile, token: string | null): void {
    this._currentUser = user;
    this._token = token;
    try {
      SafeStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      if (token) SafeStorage.setItem(STORAGE_KEY_TOKEN, token);
    } catch (e) {
      console.warn('[SaaSAuth] Failed to persist session', e);
    }
    SaaSLicenseManager.instance.setUser(user);
    this.notify();
  }

  private notify(): void {
    for (const listener of this._listeners) {
      try {
        listener(this._currentUser);
      } catch (err) {
        console.error('[SaaSAuth] Listener error:', err);
      }
    }
  }
}
