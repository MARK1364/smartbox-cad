import React, { useState, useEffect } from 'react';
import { PerformanceConfigManager, PerformanceConfigData } from '../A1_core/performance-config';
import { UIController } from '../A1_core/ui-controller';

interface PerformanceOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerformanceOptionsModal: React.FC<PerformanceOptionsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<PerformanceConfigData>(() => PerformanceConfigManager.instance.getConfig());
  const [selectedProfile, setSelectedProfile] = useState<string>(() => PerformanceConfigManager.instance.getActiveProfile());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customScaling, setCustomScaling] = useState(config.current.hardwareScalingLevel);
  const [customAntialias, setCustomAntialias] = useState(config.current.antialias);
  const [customThrottle, setCustomThrottle] = useState(config.current.throttleHoverMs);
  const [customPowerPref, setCustomPowerPref] = useState(config.current.powerPreference);
  const [customEngine, setCustomEngine] = useState<'webgl2' | 'webgpu'>(() => PerformanceConfigManager.instance.getPreferredEngine());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentConfig = PerformanceConfigManager.instance.getConfig();
      setConfig(currentConfig);
      setSelectedProfile(currentConfig.activeProfile);
      setCustomScaling(currentConfig.current.hardwareScalingLevel);
      setCustomAntialias(currentConfig.current.antialias);
      setCustomThrottle(currentConfig.current.throttleHoverMs);
      setCustomPowerPref(currentConfig.current.powerPreference);
      setCustomEngine(currentConfig.current.preferredEngine || 'webgl2');
      setSavedNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectProfile = (profileKey: 'low' | 'medium' | 'high') => {
    setSelectedProfile(profileKey);
    const prof = config.profiles[profileKey];
    if (prof) {
      setCustomScaling(prof.hardwareScalingLevel);
      setCustomAntialias(prof.antialias);
      setCustomThrottle(prof.throttleHoverMs);
      if (prof.powerPreference) setCustomPowerPref(prof.powerPreference);
    }
  };

  const handleApply = () => {
    const mgr = PerformanceConfigManager.instance;
    if (selectedProfile === 'low' || selectedProfile === 'medium' || selectedProfile === 'high' || selectedProfile === 'auto') {
      mgr.setProfile(selectedProfile as any, true);
    }

    const currentSavedEngine = mgr.getPreferredEngine();
    const engineChanged = customEngine !== currentSavedEngine;

    mgr.updateCurrent({
      preferredEngine: customEngine,
      ...(showAdvanced ? {
        hardwareScalingLevel: customScaling,
        antialias: customAntialias,
        throttleHoverMs: customThrottle,
        powerPreference: customPowerPref
      } : {})
    }, true);

    // Natychmiastowe zastosowanie poziomu skalowania do aktywnego silnika 3D
    try {
      const viewport = (UIController.instance as any)?.viewport;
      if (viewport?.engine) {
        mgr.applyToEngine(viewport.engine);
      }
    } catch (e) {
      console.warn('Nie udało się zaaplikować do silnika natychmiast:', e);
    }

    if (engineChanged) {
      setSavedNotice('Zapisano! Odśwież stronę (F5), aby przełączyć silnik 3D.');
      setTimeout(() => {
        setSavedNotice(null);
        onClose();
      }, 1500);
    } else {
      setSavedNotice('Ustawienia zapisane dla tego stanowiska!');
      setTimeout(() => {
        setSavedNotice(null);
        onClose();
      }, 900);
    }
  };

  const handleResetDefaults = () => {
    const mgr = PerformanceConfigManager.instance;
    mgr.resetToDefaults();
    const currentConfig = mgr.getConfig();
    setConfig(currentConfig);
    setSelectedProfile(currentConfig.activeProfile);
    setCustomScaling(currentConfig.current.hardwareScalingLevel);
    setCustomAntialias(currentConfig.current.antialias);
    setCustomThrottle(currentConfig.current.throttleHoverMs);
    setCustomPowerPref(currentConfig.current.powerPreference);
    setCustomEngine('webgl2');

    try {
      const viewport = (UIController.instance as any)?.viewport;
      if (viewport?.engine) {
        mgr.applyToEngine(viewport.engine);
      }
    } catch { /* ignoruj */ }

    setSavedNotice('Przywrócono ustawienia fabryczne!');
    setTimeout(() => setSavedNotice(null), 1500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
          borderRadius: '12px',
          width: 'min(720px, 94vw)',
          maxHeight: 'min(780px, 90vh)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(59, 130, 246, 0.25)',
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
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>⚙️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
                Opcje Wydajności i Grafiki 3D
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Wybierz profil zoptymalizowany pod kartę graficzną tego komputera
              </p>
            </div>
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
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            title="Zamknij (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ─── Treść modala ─── */}
        <div style={{ flex: 1, minHeight: 0, padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Notatka / info o zapamiętywaniu per-komputer */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#93c5fd',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>💡</span>
            <span>Ustawienia są zapamiętywane w pamięci tej przeglądarki (możesz ustawić inną opcję na warsztacie, a inną w biurze).</span>
          </div>

          {/* Karty profili do wyboru */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Profil HIGH */}
            <div
              onClick={() => handleSelectProfile('high')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                borderRadius: '8px',
                border: selectedProfile === 'high' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: selectedProfile === 'high' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="perfProfile"
                checked={selectedProfile === 'high'}
                onChange={() => handleSelectProfile('high')}
                style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#3b82f6' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                    🚀 Wysoka wydajność i ostrość (Dedykowana GPU)
                  </span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa', borderRadius: '4px', fontWeight: 600 }}>
                    NVIDIA Quadro M4000 / RTX / Radeon
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.35 }}>
                  Pełna ostrość 100% (żyleta), włączony antyaliasing, natychmiastowe podświetlanie elementów (20 ms).
                </div>
              </div>
            </div>

            {/* Profil MEDIUM */}
            <div
              onClick={() => handleSelectProfile('medium')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                borderRadius: '8px',
                border: selectedProfile === 'medium' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: selectedProfile === 'medium' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="perfProfile"
                checked={selectedProfile === 'medium'}
                onChange={() => handleSelectProfile('medium')}
                style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#3b82f6' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                    ⚖️ Zrównoważony
                  </span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1', borderRadius: '4px' }}>
                    Średnie laptopy / Biuro
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.35 }}>
                  Skalowanie 1.25 (80% rozdzielczości), włączony antyaliasing, zrównoważona reakcja (35 ms).
                </div>
              </div>
            </div>

            {/* Profil LOW */}
            <div
              onClick={() => handleSelectProfile('low')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                borderRadius: '8px',
                border: selectedProfile === 'low' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: selectedProfile === 'low' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="perfProfile"
                checked={selectedProfile === 'low'}
                onChange={() => handleSelectProfile('low')}
                style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#3b82f6' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>
                    ⚡ Lekki / Słaby komputer (Zintegrowana grafika)
                  </span>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', borderRadius: '4px', fontWeight: 600 }}>
                    Intel Graphics / Komputer warsztatowy
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.35 }}>
                  Skalowanie 1.5 (lżejszy render o 55%), wyłączony antyaliasing (płynny obrót), odciążony procesor (50 ms).
                </div>
              </div>
            </div>

          </div>

          {/* Przycisk rozwijania zaawansowanych ustawień */}
          <div style={{ marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: '#60a5fa',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0',
              }}
            >
              <span>{showAdvanced ? '▼ Ukryj ustawienia zaawansowane' : '▶ Pokaż ustawienia zaawansowane (suwaki)'}</span>
            </button>
          </div>

          {/* Sekcja zaawansowana */}
          {showAdvanced && (
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontSize: '0.82rem',
              }}
            >
              {/* Hardware scaling level */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="scalingSlider">Skalowanie rozdzielczości (DPI):</label>
                  <span style={{ fontWeight: 600, color: '#60a5fa' }}>{customScaling}x {customScaling === 1 ? '(100% ostrość)' : `(~${Math.round(100 / customScaling)}% rozdzielczości)`}</span>
                </div>
                <input
                  id="scalingSlider"
                  type="range"
                  min="1.0"
                  max="2.0"
                  step="0.25"
                  value={customScaling}
                  onChange={(e) => setCustomScaling(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                  <span>1.0 (Żyleta)</span>
                  <span>1.25</span>
                  <span>1.5 (Szybki)</span>
                  <span>1.75</span>
                  <span>2.0 (Bardzo lekki)</span>
                </div>
              </div>

              {/* Antyaliasing */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>Wygładzanie krawędzi (Antyaliasing / MSAA)</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Wyłączenie drastycznie przyspiesza karty Intel Graphics</div>
                </div>
                <input
                  type="checkbox"
                  checked={customAntialias}
                  onChange={(e) => setCustomAntialias(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                />
              </div>

              {/* Throttle hover */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="throttleSlider">Częstotliwość próbkowania kursora (Raycast Hover):</label>
                  <span style={{ fontWeight: 600, color: '#60a5fa' }}>{customThrottle} ms</span>
                </div>
                <input
                  id="throttleSlider"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={customThrottle}
                  onChange={(e) => setCustomThrottle(parseInt(e.target.value, 10))}
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                  <span>10 ms (Natychmiast)</span>
                  <span>35 ms (Standard)</span>
                  <span>100 ms (Oszczędza CPU)</span>
                </div>
              </div>

              {/* Silnik graficzny 3D (WebGL 2 vs WebGPU) */}
              <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>Silnik renderujący 3D:</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Wymaga odświeżenia (F5)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label
                    onClick={() => setCustomEngine('webgl2')}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: customEngine === 'webgl2' ? '1.5px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: customEngine === 'webgl2' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(255, 255, 255, 0.02)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="engineChoice"
                      value="webgl2"
                      checked={customEngine === 'webgl2'}
                      onChange={() => setCustomEngine('webgl2')}
                      style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#f8fafc' }}>WebGL 2</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.25, marginTop: '2px' }}>
                        Stabilny, rekomendowany standard produkcyjny dla CAD.
                      </div>
                    </div>
                  </label>

                  <label
                    onClick={() => setCustomEngine('webgpu')}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: customEngine === 'webgpu' ? '1.5px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: customEngine === 'webgpu' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(255, 255, 255, 0.02)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="engineChoice"
                      value="webgpu"
                      checked={customEngine === 'webgpu'}
                      onChange={() => setCustomEngine('webgpu')}
                      style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#3b82f6' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#f8fafc' }}>WebGPU</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.25, marginTop: '2px' }}>
                        Eksperymentalny silnik nowej generacji.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* Komunikat o zapisie */}
          {savedNotice && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '6px',
                color: '#34d399',
                fontSize: '0.85rem',
                textAlign: 'center',
                fontWeight: 500,
              }}
            >
              ✓ {savedNotice}
            </div>
          )}

        </div>

        {/* ─── Stopka z przyciskami ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 22px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            type="button"
            onClick={handleResetDefaults}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Przywróć domyślne
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleApply}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                padding: '8px 20px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
              }}
            >
              Zastosuj i zapisz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
