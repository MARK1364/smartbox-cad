import React, { useState, useEffect } from 'react';
import { SaaSProjectService } from '../saas-project-service';
import { SaaSAuthService } from '../saas-auth-service';
import { SaaSLicenseManager } from '../saas-license-manager';
import { SaaSProjectMetadata, SubscriptionTier, UserProfile } from '../types';
import { ContextManager } from '../../../A1_core/context-manager';
import { UIController } from '../../../A1_core/ui-controller';
import { tx } from '../../../T1_tlumaczenia/core.js';
import { useLocale } from '../../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

interface SaaSProjectsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPaywall: () => void;
}

export const SaaSProjectsDashboardModal: React.FC<SaaSProjectsDashboardModalProps> = ({
  isOpen,
  onClose,
  onOpenPaywall,
}) => {
  const [projects, setProjects] = useState<SaaSProjectMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => SaaSAuthService.instance.getCurrentUser());
  useLocale();
  const [tier, setTier] = useState<SubscriptionTier>(() => SaaSLicenseManager.instance.getTier());

  useEffect(() => {
    if (isOpen) {
      setUser(SaaSAuthService.instance.getCurrentUser());
      setTier(SaaSLicenseManager.instance.getTier());
      setStatusNotice(null);

      // Pobierz domyślną nazwę z aktywnego dokumentu
      const doc = ContextManager.instance.document;
      const curName = doc?.metadata?.name || doc?.rootNode?.name || 'Projekt_Meble';
      setNewProjectName(String(curName).replace(/\.spp\.json$/, '').replace(/\.json$/, ''));

      loadProjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const loadProjects = async () => {
    setIsLoading(true);
    setStatusNotice(null);
    try {
      const list = await SaaSProjectService.instance.listProjects();
      setProjects(list);
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message || tx(srcTekst, 'saas.err_load', TX_NS) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCurrent = async () => {
    const doc = ContextManager.instance.document;
    if (!doc) {
      setStatusNotice({ type: 'error', text: 'Brak aktywnego dokumentu do zapisu.' });
      return;
    }

    setIsLoading(true);
    setStatusNotice(null);
    try {
      const projectJson = doc.serialize();
      const saved = await SaaSProjectService.instance.saveProject(newProjectName, projectJson);
      setStatusNotice({ type: 'success', text: tx(srcTekst, 'saas.ok_saved', TX_NS, { name: saved.name }) });
      await loadProjects();
    } catch (err: any) {
      if (err.message.includes('limit')) {
        onOpenPaywall();
      } else {
        setStatusNotice({ type: 'error', text: err.message || tx(srcTekst, 'saas.err_save', TX_NS) });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = async (meta: SaaSProjectMetadata) => {
    setIsLoading(true);
    setStatusNotice(null);
    try {
      const fullProj = await SaaSProjectService.instance.loadProject(meta.id);
      const api = ContextManager.instance.appAPI;
      if (api && typeof api.loadProjectData === 'function') {
        api.loadProjectData(fullProj.cadDocument, `Wczytano projekt z chmury: ${meta.name}`);
      } else {
        const doc = ContextManager.instance.document;
        if (!doc) throw new Error('Silnik CAD nie jest zainicjalizowany.');
        doc.load(fullProj.cadDocument);
        window.document.dispatchEvent(new CustomEvent('bloki-project-changed'));
      }

      setStatusNotice({ type: 'success', text: `Wczytano projekt: ${meta.name}` });
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message || tx(srcTekst, 'saas.err_open', TX_NS) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (meta: SaaSProjectMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(tx(srcTekst, 'saas.confirm_delete', TX_NS, { name: meta.name }))) return;

    setIsLoading(true);
    try {
      await SaaSProjectService.instance.deleteProject(meta.id);
      setProjects(prev => prev.filter(p => p.id !== meta.id));
      setStatusNotice({ type: 'info', text: tx(srcTekst, 'saas.ok_deleted', TX_NS, { name: meta.name }) });
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message || tx(srcTekst, 'saas.err_delete', TX_NS) });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareToggle = async (meta: SaaSProjectMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!SaaSLicenseManager.instance.canSharePublic3DLink()) {
      onOpenPaywall();
      return;
    }

    try {
      const shareId = await SaaSProjectService.instance.togglePublicShare(meta.id, !meta.isPublicShared);
      if (shareId) {
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${shareId}`;
        navigator.clipboard.writeText(shareUrl);
        setStatusNotice({ type: 'success', text: tx(srcTekst, 'saas.ok_link', TX_NS, { url: shareUrl }) });
      } else {
        setStatusNotice({ type: 'info', text: tx(srcTekst, 'saas.ok_unshared', TX_NS) });
      }
      await loadProjects();
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message });
    }
  };

  const maxProjects = SaaSLicenseManager.instance.maxCloudProjects();
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#141416',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          width: 'min(900px, 94vw)',
          height: 'min(680px, 90vh)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(59, 130, 246, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>☁</span> Projekty w Chmurze (SaaS Cloud)
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Konto: <strong style={{ color: '#cbd5e1' }}>{user?.email || tx(srcTekst, 'saas.anonymous', TX_NS)}</strong> | {tx(srcTekst, 'saas.plan', TX_NS)} <strong style={{ color: tier === 'PRO' ? '#60a5fa' : '#a855f7' }}>{tier}</strong> ({projects.length}/{maxProjects >= 9999 ? '∞' : maxProjects} projektów)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Pasek akcji: Nowy zapis + Szukajka */}
        <div
          style={{
            padding: '12px 24px',
            background: '#1a1a1e',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Zapisz bieżący */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 320px' }}>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder={tx(srcTekst, 'saas.current_name_ph', TX_NS)}
              style={{
                flex: 1,
                background: '#121214',
                border: '1px solid #3f3f46',
                color: '#fff',
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '0.82rem',
              }}
            />
            <button
              type="button"
              onClick={handleSaveCurrent}
              disabled={isLoading || !newProjectName.trim()}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                color: '#fff',
                padding: '7px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tx(srcTekst, 'saas.save_current', TX_NS)}
            </button>
          </div>

          {/* Filtrowanie */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj w projektach..."
              style={{
                width: '180px',
                background: '#121214',
                border: '1px solid #3f3f46',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem',
              }}
            />
            <button
              type="button"
              onClick={loadProjects}
              disabled={isLoading}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              🔄
            </button>
          </div>
        </div>

        {/* Treść */}
        <div style={{ flex: 1, minHeight: 0, padding: '20px 24px', overflowY: 'auto' }}>
          {statusNotice && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: '16px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                backgroundColor: statusNotice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : statusNotice.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                border: statusNotice.type === 'success' ? '1px solid rgba(16, 185, 129, 0.4)' : statusNotice.type === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)',
                color: statusNotice.type === 'success' ? '#34d399' : statusNotice.type === 'error' ? '#f87171' : '#93c5fd',
              }}
            >
              {statusNotice.text}
            </div>
          )}

          {isLoading && projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              {tx(srcTekst, 'saas.loading', TX_NS)}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#e2e8f0' }}>{tx(srcTekst, 'saas.no_projects', TX_NS)}</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{tx(srcTekst, 'saas.no_projects_hint', TX_NS)}</div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  onDoubleClick={() => handleOpenProject(proj)}
                  style={{
                    backgroundColor: '#1c1c21',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  {/* Miniaturka */}
                  <div
                    style={{
                      height: '120px',
                      backgroundColor: '#0f172a',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {proj.thumbnailBase64 ? (
                      <img
                        src={proj.thumbnailBase64}
                        alt={proj.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '28px' }}>📦</span>
                    )}

                    <div
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        color: '#94a3b8',
                      }}
                    >
                      v{proj.version}
                    </div>
                  </div>

                  {/* Szczegóły */}
                  <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f8fafc', marginBottom: '4px' }}>
                      {proj.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '12px' }}>
                      Zmieniono: {new Date(proj.updatedAt).toLocaleDateString('pl-PL')}
                    </div>

                    {/* Przyciski */}
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenProject(proj)}
                        style={{
                          flex: 1,
                          background: '#2563eb',
                          border: 'none',
                          color: '#fff',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Wczytaj
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleShareToggle(proj, e)}
                        title={proj.isPublicShared ? tx(srcTekst, 'saas.unshare', TX_NS) : tx(srcTekst, 'saas.share_3d', TX_NS)}
                        style={{
                          background: proj.isPublicShared ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                          border: proj.isPublicShared ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: proj.isPublicShared ? '#34d399' : '#cbd5e1',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        🔗
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(proj, e)}
                        title={tx(srcTekst, 'saas.delete_cloud', TX_NS)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stopka */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {tier === 'FREE' ? (
            <button
              type="button"
              onClick={onOpenPaywall}
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)',
                border: '1px solid #3b82f6',
                color: '#93c5fd',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tx(srcTekst, 'saas.upgrade', TX_NS)}
            </button>
          ) : (
            <div style={{ fontSize: '0.75rem', color: '#86efac' }}>
              ✓ Nielimitowane miejsce w chmurze (Plan {tier})
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
