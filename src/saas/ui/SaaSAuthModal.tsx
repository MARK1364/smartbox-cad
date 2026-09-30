import React, { useState } from 'react';
import { SaaSAuthService } from '../saas-auth-service';
import { tx } from '../../../T1_tlumaczenia/core.js';
import { useLocale } from '../../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

interface SaaSAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SaaSAuthModal: React.FC<SaaSAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useLocale();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg(tx(srcTekst, 'saas.auth_email', TX_NS));
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      if (tab === 'login') {
        await SaaSAuthService.instance.signIn(email.trim(), password);
      } else {
        await SaaSAuthService.instance.signUp(email.trim(), fullName.trim(), password);
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tx(srcTekst, 'saas.auth_error', TX_NS));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (demoType: 'free' | 'pro' | 'enterprise') => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const demoEmail = demoType === 'enterprise' ? 'fabryka.meble@bloki.saas' : demoType === 'pro' ? 'stolarz.pro@bloki.saas' : 'klient.free@bloki.saas';
      await SaaSAuthService.instance.signIn(demoEmail, 'password');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tx(srcTekst, 'saas.auth_demo', TX_NS));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await SaaSAuthService.instance.signInWithGoogle();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || tx(srcTekst, 'saas.auth_google', TX_NS));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
          backgroundColor: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          width: 'min(440px, 92vw)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.25)',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div
          style={{
            padding: '20px 24px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>
              {tab === 'login' ? tx(srcTekst, 'saas.login_title', TX_NS) : tx(srcTekst, 'saas.register_title', TX_NS)}
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              Synchronizuj meble, rozkroje i CNC na wszystkich komputerach
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
            }}
          >
            ✕
          </button>
        </div>

        {/* Zakładki */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#121214' }}>
          <button
            type="button"
            onClick={() => setTab('login')}
            style={{
              flex: 1,
              padding: '10px',
              background: tab === 'login' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: tab === 'login' ? '#60a5fa' : '#94a3b8',
              border: 'none',
              borderBottom: tab === 'login' ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Logowanie
          </button>
          <button
            type="button"
            onClick={() => setTab('register')}
            style={{
              flex: 1,
              padding: '10px',
              background: tab === 'register' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: tab === 'register' ? '#60a5fa' : '#94a3b8',
              border: 'none',
              borderBottom: tab === 'register' ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Rejestracja
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {errorMsg && (
            <div
              style={{
                marginBottom: '14px',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                fontSize: '0.8rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Logowanie One-Click Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '9px 16px',
              background: '#ffffff',
              color: '#0f172a',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              marginBottom: '16px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Kontynuuj przez Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', color: '#64748b', fontSize: '0.75rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
            <span style={{ padding: '0 10px' }}>lub przez e-mail</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {tab === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  {tx(srcTekst, 'saas.name_label', TX_NS)}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="np. Jan Kowalski (Meble Styl)"
                  style={{
                    width: '100%',
                    background: '#121214',
                    border: '1px solid #3f3f46',
                    color: '#fff',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px' }}>
                Adres E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj.email@firma.pl"
                style={{
                  width: '100%',
                  background: '#121214',
                  border: '1px solid #3f3f46',
                  color: '#fff',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '4px' }}>
                {tx(srcTekst, 'saas.password', TX_NS)}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: '#121214',
                  border: '1px solid #3f3f46',
                  color: '#fff',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: '6px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                color: '#fff',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
                {isLoading ? tx(srcTekst, 'saas.processing', TX_NS) : tab === 'login' ? tx(srcTekst, 'saas.login_btn', TX_NS) : tx(srcTekst, 'saas.register_btn', TX_NS)}
            </button>
          </form>

          {/* Szybkie konta demonstracyjne dla wygody */}
          <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '6px' }}>Szybkie logowanie testowe:</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleQuickDemo('free')}
                style={{
                  flex: 1,
                  padding: '5px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#cbd5e1',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Konto FREE
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('pro')}
                style={{
                  flex: 1,
                  padding: '5px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '4px',
                  color: '#93c5fd',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Konto PRO
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
