import React, { useState, useEffect } from 'react';
import { GoogleDriveService, GoogleDriveFile } from './google-drive/google-drive-service';
import { ContextManager } from '../A1_core/context-manager';
import { UIController } from '../A1_core/ui-controller';

interface GoogleDriveModalProps {
  isOpen: boolean;
  initialMode?: 'open' | 'save' | 'settings';
  onClose: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  initialMode = 'open',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'open' | 'save' | 'settings'>(initialMode);
  const [clientId, setClientId] = useState<string>(() => GoogleDriveService.instance.getClientId());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => GoogleDriveService.instance.isAuthenticated());
  const [user, setUser] = useState(() => GoogleDriveService.instance.getUser());
  
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [projectName, setProjectName] = useState('Projekt_Meble');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setClientId(GoogleDriveService.instance.getClientId());
      setIsAuthenticated(GoogleDriveService.instance.isAuthenticated());
      setUser(GoogleDriveService.instance.getUser());
      setStatusNotice(null);

      // Pobierz domyślną nazwę projektu z dokumentu
      const doc = ContextManager.instance.document;
      const curName = doc?.metadata?.name || doc?.rootNode?.name || 'Projekt_Meble';
      setProjectName(curName.replace(/\.spp\.json$/, '').replace(/\.json$/, ''));

      if (GoogleDriveService.instance.isAuthenticated()) {
        loadFilesList();
      }
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    const unsub = GoogleDriveService.instance.subscribe(() => {
      setIsAuthenticated(GoogleDriveService.instance.isAuthenticated());
      setUser(GoogleDriveService.instance.getUser());
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const loadFilesList = async () => {
    setIsLoading(true);
    setStatusNotice(null);
    try {
      const list = await GoogleDriveService.instance.listProjects();
      setFiles(list);
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message || 'Błąd ładowania listy plików.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!clientId.trim()) {
      setStatusNotice({ type: 'error', text: 'Wpisz identyfikator Google Client ID w zakładce Ustawienia.' });
      setActiveTab('settings');
      return;
    }

    setIsLoading(true);
    setStatusNotice(null);
    try {
      await GoogleDriveService.instance.signIn(clientId.trim());
      setStatusNotice({ type: 'success', text: 'Pomyślnie połączono z kontem Google!' });
      await loadFilesList();
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message || 'Logowanie nie powiodło się.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    GoogleDriveService.instance.signOut();
    setFiles([]);
    setStatusNotice({ type: 'info', text: 'Wylogowano z Dysku Google.' });
  };

  const handleSaveToDrive = async (overwriteId?: string) => {
    const doc = ContextManager.instance.document;
    if (!doc) {
      setStatusNotice({ type: 'error', text: 'Brak aktywnego dokumentu CAD do zapisu.' });
      return;
    }

    setIsLoading(true);
    setStatusNotice(null);
    try {
      const projectJson = doc.serialize();
      const targetName = projectName.trim() || 'Projekt_Meble';
      const savedFile = await GoogleDriveService.instance.saveProject(targetName, projectJson, overwriteId);
      
      setStatusNotice({ type: 'success', text: `Projekt "${savedFile.name}" został pomyślnie zapisany w chmurze!` });
      await loadFilesList();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message || 'Nie udało się zapisać projektu.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFromDrive = async (file: GoogleDriveFile) => {
    setIsLoading(true);
    setStatusNotice(null);
    try {
      const projectJson = await GoogleDriveService.instance.loadProject(file.id);
      const doc = ContextManager.instance.document;
      if (!doc) throw new Error('Brak aktywnego silnika CAD.');

      doc.deserialize(projectJson);
      
      // Zaktualizuj widok
      if (UIController.instance) {
        (UIController.instance as any).syncDocument();
      }

      setStatusNotice({ type: 'success', text: `Wczytano projekt: ${file.name}` });
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message || 'Błąd otwierania projektu.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Czy na pewno usunąć projekt "${fileName}" z Dysku Google?`)) return;

    setIsLoading(true);
    try {
      await GoogleDriveService.instance.deleteProject(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      setStatusNotice({ type: 'info', text: `Usunięto projekt "${fileName}".` });
    } catch (err: any) {
      setStatusNotice({ type: 'error', text: err.message || 'Błąd usuwania pliku.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveClientId = () => {
    GoogleDriveService.instance.setClientId(clientId.trim());
    setStatusNotice({ type: 'success', text: 'Zapisano Google Client ID dla tej przeglądarki.' });
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      tabIndex={0}
    >
      <div
        style={{
          backgroundColor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '10px',
          width: 'min(760px, 94vw)',
          height: 'min(620px, 88vh)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(59, 130, 246, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#e2e8f0',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Nagłówek ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
              Dysk Google (Chmura CAD)
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              Synchronizacja projektów pomiędzy stanowiskami pracy
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
            title="Zamknij (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ─── Pasek nawigacji zakładek & Stan logowania ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#141416',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('open')}
              style={{
                padding: '6px 14px',
                background: activeTab === 'open' ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'open' ? '#ffffff' : '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'open' ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              Otwórz z chmury
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('save')}
              style={{
                padding: '6px 14px',
                background: activeTab === 'save' ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'save' ? '#ffffff' : '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'save' ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              Zapisz w chmurze
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              style={{
                padding: '6px 14px',
                background: activeTab === 'settings' ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === 'settings' ? '#ffffff' : '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'settings' ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              Ustawienia połączenia
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem' }}>
            {isAuthenticated ? (
              <>
                <span style={{ color: '#86efac' }}>
                  Zalogowano: <strong>{user?.email || 'Konto Google'}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Wyloguj
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '5px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                }}
              >
                Zaloguj przez Google
              </button>
            )}
          </div>
        </div>

        {/* ─── Zawartość modala ─── */}
        <div style={{ flex: 1, minHeight: 0, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Baner statusu */}
          {statusNotice && (
            <div
              style={{
                padding: '8px 12px',
                marginBottom: '12px',
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

          {/* ─── ZAKŁADKA: OTWIERANIE Z CHMURY ─── */}
          {activeTab === 'open' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Filtruj projekty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#141416',
                    border: '1px solid #3f3f46',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                  }}
                />
                <button
                  type="button"
                  onClick={loadFilesList}
                  disabled={!isAuthenticated || isLoading}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#cbd5e1',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  Odśwież
                </button>
              </div>

              {/* Lista plików */}
              <div
                style={{
                  flex: 1,
                  minHeight: '200px',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  backgroundColor: '#141416',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {!isAuthenticated ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    <p>Połącz się z kontem Google, aby wczytać listę projektów.</p>
                    <button
                      type="button"
                      onClick={handleSignIn}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: '0.82rem',
                      }}
                    >
                      Zaloguj do Google Drive
                    </button>
                  </div>
                ) : isLoading ? (
                  <div style={{ margin: 'auto', color: '#94a3b8', fontSize: '0.85rem' }}>
                    Trwa ładowanie projektów z chmury...
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div style={{ margin: 'auto', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center' }}>
                    <p>Brak zapisanych projektów w folderze "SmartPanel CAD Projects".</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('save')}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      Zapisz bieżący projekt
                    </button>
                  </div>
                ) : (
                  filteredFiles.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFileId(f.id)}
                      onDoubleClick={() => handleOpenFromDrive(f)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderBottom: '1px solid #222225',
                        backgroundColor: selectedFileId === f.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f8fafc' }}>
                          {f.name.replace(/\.spp\.json$/, '').replace(/\.json$/, '')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                          Modyfikacja: {new Date(f.modifiedTime).toLocaleString('pl-PL')}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenFromDrive(f)}
                          style={{
                            background: '#2563eb',
                            border: 'none',
                            color: '#ffffff',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          Wczytaj
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteFile(f.id, f.name, e)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          title="Usuń plik z Dysku Google"
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── ZAKŁADKA: ZAPISYWANIE W CHMURZE ─── */}
          {activeTab === 'save' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                  Nazwa projektu w chmurze:
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="np. Kuchnia_Klient_Kowalski"
                  style={{
                    width: '100%',
                    background: '#141416',
                    border: '1px solid #3f3f46',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                  Plik zostanie zapisany w formacie JSON w folderze "SmartPanel CAD Projects" na Twoim Dysku Google.
                </div>
              </div>

              {/* Nadpisywanie istniejącego */}
              {files.length > 0 && (
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                    Lub wybierz istniejący projekt do nadpisania:
                  </label>
                  <select
                    value={selectedFileId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedFileId(id || null);
                      const f = files.find(x => x.id === id);
                      if (f) setProjectName(f.name.replace(/\.spp\.json$/, '').replace(/\.json$/, ''));
                    }}
                    style={{
                      width: '100%',
                      background: '#141416',
                      border: '1px solid #3f3f46',
                      color: '#fff',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <option value="">-- Zapisz jako nowy plik --</option>
                    {files.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({new Date(f.modifiedTime).toLocaleDateString('pl-PL')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSaveToDrive(selectedFileId || undefined)}
                  disabled={!isAuthenticated || isLoading || !projectName.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: (!isAuthenticated || isLoading || !projectName.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (!isAuthenticated || isLoading || !projectName.trim()) ? 0.6 : 1,
                  }}
                >
                  {isLoading ? 'Zapisywanie...' : selectedFileId ? 'Nadpisz projekt w chmurze' : 'Zapisz nowy projekt w chmurze'}
                </button>
              </div>
            </div>
          )}

          {/* ─── ZAKŁADKA: USTAWIENIA ─── */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.82rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#f8fafc' }}>
                  Google OAuth 2.0 Client ID:
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="np. 1234567890-abcdefg.apps.googleusercontent.com"
                  style={{
                    width: '100%',
                    background: '#141416',
                    border: '1px solid #3f3f46',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                  Identyfikator Client ID jest generowany w darmowej konsoli Google Cloud (Credentials $\rightarrow$ OAuth Client ID dla aplikacji webowych z adresem Twojego CADa).
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleSaveClientId}
                  style={{
                    background: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Zapisz Client ID
                </button>
              </div>

              <div
                style={{
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  lineHeight: 1.5,
                  color: '#94a3b8',
                }}
              >
                <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Instrukcja dla 3 komputerów:
                </div>
                1. Na każdym komputerze wprowadź ten sam Client ID (lub zaloguj się swoim kontem Google).<br />
                2. Pliki zapisane w jednym miejscu pojawią się automatycznie w oknie "Otwórz z chmury" na pozostałych maszynach.<br />
                3. Aplikacja tworzy dedykowany folder <strong>SmartPanel CAD Projects</strong> na Twoim Dysku Google.
              </div>
            </div>
          )}

        </div>

        {/* ─── Stopka ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              padding: '6px 16px',
              borderRadius: '4px',
              fontSize: '0.82rem',
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
