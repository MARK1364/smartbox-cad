import React, { useEffect, useState } from 'react';

interface NewProjectModalProps {
  isOpen: boolean;
  isDirty: boolean;
  projectName?: string;
  onSaveAndNew: () => Promise<void> | void;
  onDiscardAndNew: () => void;
  onCancel: () => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  isDirty,
  projectName = 'Projekt',
  onSaveAndNew,
  onDiscardAndNew,
  onCancel,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSaving(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSaveClick = async () => {
    try {
      setIsSaving(true);
      await onSaveAndNew();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onCancel();
        }
      }}
    >
      <div
        style={{
          width: '380px',
          maxWidth: '90vw',
          backgroundColor: '#181e29',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          color: '#f8fafc',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ─── Nagłówek ─── */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            id="new-project-title"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#f1f5f9',
            }}
          >
            Nowy projekt
          </span>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '16px',
              cursor: isSaving ? 'default' : 'pointer',
              padding: '2px 6px',
              borderRadius: '4px',
              lineHeight: 1,
            }}
            title="Zamknij (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ─── Pytanie ─── */}
        <div style={{ padding: '16px', fontSize: '13px', lineHeight: 1.4, color: '#e2e8f0' }}>
          {isDirty
            ? `Zapisać zmiany w projekcie „${projectName}”?`
            : `Zamknąć projekt „${projectName}” i utworzyć nowy?`}
        </div>

        {/* ─── Przyciski akcji ─── */}
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          {isDirty ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                style={{
                  padding: '6px 12px',
                  borderRadius: '5px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  color: '#94a3b8',
                  cursor: isSaving ? 'default' : 'pointer',
                }}
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={onDiscardAndNew}
                disabled={isSaving}
                style={{
                  padding: '6px 12px',
                  borderRadius: '5px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#fca5a5',
                  cursor: isSaving ? 'default' : 'pointer',
                }}
              >
                Nie zapisuj
              </button>

              <button
                type="button"
                onClick={handleSaveClick}
                disabled={isSaving}
                style={{
                  padding: '6px 14px',
                  borderRadius: '5px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: isSaving ? '#1d4ed8' : '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  cursor: isSaving ? 'wait' : 'pointer',
                }}
              >
                {isSaving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '6px 12px',
                  borderRadius: '5px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                Anuluj
              </button>

              <button
                type="button"
                onClick={onDiscardAndNew}
                style={{
                  padding: '6px 14px',
                  borderRadius: '5px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Nowy projekt
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
