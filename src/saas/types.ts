/**
 * SaaS Core Types for SmartPanel CAD
 * Supports Multi-tenant, Cloud Sync, Subscriptions and Feature Gating.
 */

export type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  companyName?: string;
  avatarUrl?: string;
  tier: SubscriptionTier;
  subscriptionExpiresAt?: string | null; // ISO Date string
  createdAt: string;
}

/**
 * Zawartość licencji (bez podpisu). To jest część podpisywana kluczem
 * prywatnym wydawcy; aplikacja weryfikuje ją wbudowanym kluczem publicznym.
 */
export interface LicensePayload {
  /** Unikalny identyfikator licencji (do watermarku / wykrywania wycieków). */
  licenseId: string;
  email: string;
  fullName?: string;
  tier: SubscriptionTier;
  /** ISO Date — data wystawienia. */
  issuedAt: string;
  /** ISO Date lub null (licencja bezterminowa). */
  expiresAt: string | null;
  /** Opcjonalne nadpisanie uprawnień (feature keys). */
  features?: string[];
}

/**
 * Plik licencji `.lic` — payload + podpis Ed25519 (base64url).
 * Podpis liczony jest po kanonicznej formie payloadu (licz.
 * `canonicalizeLicensePayload`), więc kolejność pól w pliku nie ma znaczenia.
 */
export interface LicenseFile extends LicensePayload {
  sig: string;
  alg?: 'Ed25519';
}

export interface SaaSProjectMetadata {
  id: string;
  userId: string;
  name: string;
  description?: string;
  thumbnailBase64?: string;
  tags?: string[];
  version: number;
  isPublicShared?: boolean;
  shareId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaaSProjectData extends SaaSProjectMetadata {
  cadDocument: any; // Serialized Document / Project State
}

export interface FeatureEntitlement {
  maxCloudProjects: number;
  canExportGCode: boolean;
  canExportDxf: boolean;
  canUseNestingMultiSheet: boolean;
  canUseGrainMatching: boolean;
  canSharePublic3DLink: boolean;
  canUseCustomBranding: boolean;
  canUseTeamCollaboration: boolean;
}

export const TIER_ENTITLEMENTS: Record<SubscriptionTier, FeatureEntitlement> = {
  FREE: {
    maxCloudProjects: 3,
    canExportGCode: false,
    canExportDxf: true,
    canUseNestingMultiSheet: false,
    canUseGrainMatching: false,
    canSharePublic3DLink: false,
    canUseCustomBranding: false,
    canUseTeamCollaboration: false,
  },
  PRO: {
    maxCloudProjects: 100,
    canExportGCode: true,
    canExportDxf: true,
    canUseNestingMultiSheet: true,
    canUseGrainMatching: true,
    canSharePublic3DLink: true,
    canUseCustomBranding: false,
    canUseTeamCollaboration: false,
  },
  ENTERPRISE: {
    maxCloudProjects: 99999,
    canExportGCode: true,
    canExportDxf: true,
    canUseNestingMultiSheet: true,
    canUseGrainMatching: true,
    canSharePublic3DLink: true,
    canUseCustomBranding: true,
    canUseTeamCollaboration: true,
  },
};
