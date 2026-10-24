import { SaaSAuthService } from './saas-auth-service';
import { SaaSLicenseManager } from './saas-license-manager';
import { SaaSProjectData, SaaSProjectMetadata } from './types';
import { SafeStorage } from './storage-helper';
import { tx } from '../../T1_tlumaczenia/core.js';
import type { ModuleTexts } from '../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

const STORAGE_KEY_CLOUD_PROJECTS = 'smartpanel_saas_cloud_projects';

export class SaaSProjectService {
  private static _instance: SaaSProjectService | null = null;

  public static get instance(): SaaSProjectService {
    if (!SaaSProjectService._instance) {
      SaaSProjectService._instance = new SaaSProjectService();
    }
    return SaaSProjectService._instance;
  }

  /**
   * Pobiera listę metadanych projektów dla aktualnie zalogowanego użytkownika
   */
  public async listProjects(): Promise<SaaSProjectMetadata[]> {
    const user = SaaSAuthService.instance.getCurrentUser();
    if (!user) {
      throw new Error(tx(srcTekst, 'saas_svc.browse_required', TX_NS));
    }

    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    const token = SaaSAuthService.instance.getToken();

    if (supabaseUrl && supabaseKey && token) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/projects?select=id,user_id,name,description,thumbnail_base64,tags,version,is_public_shared,share_id,created_at,updated_at&order=updated_at.desc`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const rows = await response.json();
          return rows.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            name: r.name,
            description: r.description,
            thumbnailBase64: r.thumbnail_base64,
            tags: r.tags || [],
            version: r.version || 1,
            isPublicShared: r.is_public_shared,
            shareId: r.share_id,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }));
        }
      } catch (err) {
        console.warn('[SaaSProjectService] Supabase listProjects failed, using local storage fallback', err);
      }
    }

    // Tryb lokalny (symulator bazy danych w chmurze)
    return this.getLocalProjects(user.id);
  }

  /**
   * Zapisuje lub aktualizuje projekt w chmurze
   */
  public async saveProject(
    name: string,
    cadDocumentJson: any,
    options?: {
      projectId?: string;
      description?: string;
      thumbnailBase64?: string;
      tags?: string[];
    }
  ): Promise<SaaSProjectMetadata> {
    const user = SaaSAuthService.instance.getCurrentUser();
    if (!user) {
      throw new Error(tx(srcTekst, 'saas_svc.save_required', TX_NS));
    }

    const currentProjects = await this.listProjects();
    const isUpdate = !!options?.projectId && currentProjects.some(p => p.id === options.projectId);

    // Limit darmowych projektów w chmurze
    const maxProjects = SaaSLicenseManager.instance.maxCloudProjects();
    if (!isUpdate && currentProjects.length >= maxProjects) {
      throw new Error(tx(srcTekst, 'saas_svc.limit', TX_NS, { n: maxProjects, tier: user.tier }));
    }

    const now = new Date().toISOString();
    const projectId = options?.projectId || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const existing = currentProjects.find(p => p.id === projectId);

    const projectData: SaaSProjectData = {
      id: projectId,
      userId: user.id,
      name: name.trim() || 'Projekt_Meble',
      description: options?.description || existing?.description || '',
      thumbnailBase64: options?.thumbnailBase64 || existing?.thumbnailBase64 || this.generatePlaceholderThumbnail(),
      tags: options?.tags || existing?.tags || ['Meble', 'Bloki'],
      version: (existing?.version || 0) + 1,
      isPublicShared: existing?.isPublicShared || false,
      shareId: existing?.shareId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      cadDocument: cadDocumentJson,
    };

    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    const token = SaaSAuthService.instance.getToken();

    if (supabaseUrl && supabaseKey && token) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            id: projectData.id,
            user_id: projectData.userId,
            name: projectData.name,
            description: projectData.description,
            thumbnail_base64: projectData.thumbnailBase64,
            tags: projectData.tags,
            version: projectData.version,
            is_public_shared: projectData.isPublicShared,
            share_id: projectData.shareId,
            cad_document: projectData.cadDocument,
            updated_at: projectData.updatedAt,
          }),
        });
        if (response.ok) {
          return {
            id: projectData.id,
            userId: projectData.userId,
            name: projectData.name,
            description: projectData.description,
            thumbnailBase64: projectData.thumbnailBase64,
            tags: projectData.tags,
            version: projectData.version,
            isPublicShared: projectData.isPublicShared,
            shareId: projectData.shareId,
            createdAt: projectData.createdAt,
            updatedAt: projectData.updatedAt,
          };
        }
      } catch (err) {
        console.warn('[SaaSProjectService] Supabase saveProject failed, fallback to local', err);
      }
    }

    // Zapis w lokalnym magazynie
    this.saveLocalProject(projectData);
    return {
      id: projectData.id,
      userId: projectData.userId,
      name: projectData.name,
      description: projectData.description,
      thumbnailBase64: projectData.thumbnailBase64,
      tags: projectData.tags,
      version: projectData.version,
      isPublicShared: projectData.isPublicShared,
      shareId: projectData.shareId,
      createdAt: projectData.createdAt,
      updatedAt: projectData.updatedAt,
    };
  }

  /**
   * Wczytuje pełne dane projektu CAD
   */
  public async loadProject(projectId: string): Promise<SaaSProjectData> {
    const user = SaaSAuthService.instance.getCurrentUser();
    if (!user) throw new Error(tx(srcTekst, 'saas_svc.login_required', TX_NS));

    const localProjects = this.getAllStoredProjects();
    const found = localProjects.find(p => p.id === projectId);
    if (!found) {
      throw new Error(`Nie znaleziono projektu o ID: ${projectId}`);
    }
    return found;
  }

  /**
   * Usuwa projekt
   */
  public async deleteProject(projectId: string): Promise<void> {
    const all = this.getAllStoredProjects();
    const filtered = all.filter(p => p.id !== projectId);
    SafeStorage.setItem(STORAGE_KEY_CLOUD_PROJECTS, JSON.stringify(filtered));
  }

  /**
   * Generuje lub wyłącza link publiczny do podglądu 3D dla klienta
   */
  public async togglePublicShare(projectId: string, enable: boolean): Promise<string | null> {
    if (!SaaSLicenseManager.instance.canSharePublic3DLink()) {
      throw new Error(tx(srcTekst, 'saas_svc.share_pro', TX_NS));
    }

    const all = this.getAllStoredProjects();
    const proj = all.find(p => p.id === projectId);
    if (!proj) throw new Error('Projekt nie istnieje.');

    proj.isPublicShared = enable;
    proj.shareId = enable ? (proj.shareId || `share_${Math.random().toString(36).substring(2, 10)}`) : undefined;
    proj.updatedAt = new Date().toISOString();

    SafeStorage.setItem(STORAGE_KEY_CLOUD_PROJECTS, JSON.stringify(all));
    return proj.shareId || null;
  }

  // --- Pomocnicze metody lokalne ---

  private getLocalProjects(userId: string): SaaSProjectMetadata[] {
    const all = this.getAllStoredProjects();
    return all
      .filter(p => p.userId === userId)
      .map(p => ({
        id: p.id,
        userId: p.userId,
        name: p.name,
        description: p.description,
        thumbnailBase64: p.thumbnailBase64,
        tags: p.tags,
        version: p.version,
        isPublicShared: p.isPublicShared,
        shareId: p.shareId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  private getAllStoredProjects(): SaaSProjectData[] {
    try {
      const raw = SafeStorage.getItem(STORAGE_KEY_CLOUD_PROJECTS);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private saveLocalProject(project: SaaSProjectData): void {
    const all = this.getAllStoredProjects();
    const idx = all.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      all[idx] = project;
    } else {
      all.unshift(project);
    }
    SafeStorage.setItem(STORAGE_KEY_CLOUD_PROJECTS, JSON.stringify(all));
  }

  private generatePlaceholderThumbnail(): string {
    // Generuje prostą grafikę SVG szafki jako placeholder
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200" fill="%231e293b"><rect width="320" height="200" fill="%230f172a"/><rect x="70" y="30" width="180" height="140" rx="4" fill="%231e293b" stroke="%2338bdf8" stroke-width="2"/><line x1="160" y1="30" x2="160" y2="170" stroke="%2338bdf8" stroke-width="1.5"/><line x1="70" y1="90" x2="160" y2="90" stroke="%2338bdf8" stroke-width="1.5"/><circle cx="145" cy="60" r="3" fill="%23f8fafc"/><circle cx="175" cy="100" r="3" fill="%23f8fafc"/><text x="160" y="190" fill="%2394a3b8" font-size="11" font-family="sans-serif" text-anchor="middle">Crevo 3D</text></svg>`;
  }
}
