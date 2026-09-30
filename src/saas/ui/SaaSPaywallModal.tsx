import React from 'react';
import { SaaSAuthService } from '../saas-auth-service';
import { tx } from '../../../T1_tlumaczenia/core.js';
import { useLocale } from '../../../T1_tlumaczenia/react.js';
import type { ModuleTexts } from '../../../T1_tlumaczenia/types.js';
import srcTekstRaw from '../../src_tekst.json';

const srcTekst = srcTekstRaw as unknown as ModuleTexts;
const TX_NS = 'src';

interface SaaSPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureTitle?: string;
}

export const SaaSPaywallModal: React.FC<SaaSPaywallModalProps> = ({
  isOpen,
  onClose,
  featureTitle,
}) => {
  useLocale();
  if (!isOpen) return null;

  const handleUpgradeMock = () => {
    SaaSAuthService.instance.setTier('PRO');
    alert(tx(srcTekst, 'saas.pro_congrats', TX_NS));
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(10px)',
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
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '16px',
          width: 'min(580px, 94vw)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(59, 130, 246, 0.25)',
          overflow: 'hidden',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner u góry */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3b82f6 100%)',
            padding: '24px 20px',
            position: 'relative',
          }}
        >
          <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🚀</div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>
            Odblokuj SmartPanel PRO
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#bfdbfe' }}>
            {featureTitle
              ? tx(srcTekst, 'saas.pro_feature_locked', TX_NS, { name: featureTitle })
              : tx(srcTekst, 'saas.pro_subtitle', TX_NS)}
          </p>

          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(0,0,0,0.2)',
              border: 'none',
              color: '#fff',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Lista korzyści */}
        <div style={{ padding: '24px', textAlign: 'left' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ color: '#38bdf8', fontSize: '1.1rem' }}>⚡</span>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#f1f5f9' }}>Generowanie kodu CNC (G-Code / CLData)</strong>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {tx(srcTekst, 'saas.pro_paths', TX_NS)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ color: '#38bdf8', fontSize: '1.1rem' }}>📐</span>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#f1f5f9' }}>Optymalizator Nesting Multi-Sheet</strong>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {tx(srcTekst, 'saas.pro_nesting', TX_NS)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ color: '#38bdf8', fontSize: '1.1rem' }}>☁</span>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#f1f5f9' }}>Nielimitowana chmura CAD</strong>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {tx(srcTekst, 'saas.pro_cloud', TX_NS)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ color: '#38bdf8', fontSize: '1.1rem' }}>🔗</span>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#f1f5f9' }}>{tx(srcTekst, 'saas.pro_preview_title', TX_NS)}</strong>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  {tx(srcTekst, 'saas.pro_preview', TX_NS)}
                </div>
              </div>
            </div>
          </div>

          {/* Przyciski akcji */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleUpgradeMock}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
              }}
            >
              Aktywuj Plan PRO (Symulacja / Stripe Checkout)
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {tx(srcTekst, 'saas.later', TX_NS)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
