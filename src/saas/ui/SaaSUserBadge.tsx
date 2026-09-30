import React, { useState, useEffect } from 'react';
import { SaaSAuthService } from '../saas-auth-service';
import { SaaSLicenseManager } from '../saas-license-manager';
import { SubscriptionTier, UserProfile } from '../types';
import { tx } from '../../../T1_tlumaczenia/core.js';
import { useLocale } from '../../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

interface SaaSUserBadgeProps {
  onOpenAuth: () => void;
  onOpenDashboard: () => void;
  onOpenPaywall: () => void;
}

export const SaaSUserBadge: React.FC<SaaSUserBadgeProps> = ({
  onOpenAuth,
  onOpenDashboard,
  onOpenPaywall,
}) => {
  const [user, setUser] = useState<UserProfile | null>(() => SaaSAuthService.instance.getCurrentUser());
  const [tier, setTier] = useState<SubscriptionTier>(() => SaaSLicenseManager.instance.getTier());
  const [menuOpen, setMenuOpen] = useState(false);
  useLocale();

  useEffect(() => {
    const unsubAuth = SaaSAuthService.instance.subscribe((u) => {
      setUser(u);
    });
    const unsubLicense = SaaSLicenseManager.instance.subscribe((t) => {
      setTier(t);
    });
    return () => {
      unsubAuth();
      unsubLicense();
    };
  }, []);

  const handleSignOut = () => {
    SaaSAuthService.instance.signOut();
    setMenuOpen(false);
  };

  const getTierColor = (t: SubscriptionTier) => {
    switch (t) {
      case 'ENTERPRISE':
        return { bg: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)', text: '#ffffff', border: '#c084fc' };
      case 'PRO':
        return { bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', text: '#ffffff', border: '#60a5fa' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.08)', text: '#94a3b8', border: 'rgba(255, 255, 255, 0.15)' };
    }
  };

  const tierStyle = getTierColor(tier);

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={onOpenAuth}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
            transition: 'all 0.15s ease',
          }}
          title={tx(srcTekst, 'saas.login_hint', TX_NS)}
        >
          <span style={{ fontSize: '12px' }}>☁</span> Chmura CAD / Zaloguj
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Przycisk Projekty w chmurze */}
      <button
        type="button"
        onClick={onOpenDashboard}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '6px',
          color: '#e2e8f0',
          fontSize: '0.76rem',
          cursor: 'pointer',
        }}
        title="Moje projekty w chmurze"
      >
        <span>📁</span> Moje Projekty
      </button>

      {/* Plakietka użytkownika */}
      <div
        onClick={() => setMenuOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '3px 8px 3px 4px',
          background: '#18181b',
          border: `1px solid ${tierStyle.border}`,
          borderRadius: '20px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            background: tierStyle.bg,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 700,
          }}
        >
          {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
        </div>

        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f1f5f9', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.fullName || user.email.split('@')[0]}
        </span>

        <span
          style={{
            fontSize: '0.65rem',
            padding: '1px 6px',
            borderRadius: '10px',
            background: tierStyle.bg,
            color: tierStyle.text,
            fontWeight: 700,
            letterSpacing: '0.5px',
          }}
        >
          {tier}
        </span>
      </div>

      {/* Menu rozwijane profilu */}
      {menuOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
            onClick={() => setMenuOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '240px',
              backgroundColor: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
              zIndex: 99999,
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>{user.fullName}</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', wordBreak: 'break-all' }}>{user.email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>Plan:</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: tier === 'PRO' ? '#60a5fa' : '#a855f7' }}>
                  {tier}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenDashboard();
              }}
              style={{
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: '#cbd5e1',
                padding: '6px 8px',
                borderRadius: '4px',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              {tx(srcTekst, 'saas.browse', TX_NS)}
            </button>

            {tier === 'FREE' && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenPaywall();
                }}
                style={{
                  textAlign: 'left',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%)',
                  border: '1px solid #3b82f6',
                  color: '#93c5fd',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tx(srcTekst, 'saas.go_pro', TX_NS)}
              </button>
            )}

            {/* Szybki przełącznik tierów w celach deweloperskich/testowych */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px', fontSize: '0.7rem', color: '#64748b' }}>
              <div>Symulator planu (Dev):</div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {(['FREE', 'PRO', 'ENTERPRISE'] as SubscriptionTier[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => SaaSAuthService.instance.setTier(t)}
                    style={{
                      flex: 1,
                      padding: '2px 4px',
                      fontSize: '0.65rem',
                      background: tier === t ? '#2563eb' : 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              style={{
                marginTop: '4px',
                textAlign: 'left',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                padding: '6px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {tx(srcTekst, 'saas.logout', TX_NS)}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
