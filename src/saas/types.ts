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
