import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, PatronSession } from '../../services/api';

interface RevokeSessionModalProps {
  isOpen: boolean;
  session: PatronSession | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RevokeSessionModal: React.FC<RevokeSessionModalProps> = ({
  isOpen,
  session,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !session) return null;

  const handleConfirmRevoke = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.logoutPatron({
        tokenId: session.id,
        patronNim: session.patron_nim,
        patronName: session.patron_name,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal mencabut sesi.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.15rem', marginBottom: 2 }}>
                Akhiri Sesi Membaca
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Pembersihan Identitas Perangkat Bersama
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Tutup"
            style={{ padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="alert-box alert-warning" style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 16 }}>
            Apakah Anda yakin ingin <strong>mencabut identitas membaca</strong> dari peramban ini?
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
              marginBottom: 16,
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Nama Pemustaka:</span>
              <strong style={{ color: 'var(--color-text)' }}>{session.patron_name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>NIM / No. Identitas:</span>
              <strong style={{ color: 'var(--color-text)', fontFamily: 'monospace' }}>{session.patron_nim}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Kode Sesi / Tiket:</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{session.token_code}</span>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
            *Setelah dicabut, riwayat sesi di komputer ini akan dihapus bersih sehingga pengguna berikutnya tidak dapat membaca naskah dengan identitas & watermark Anda.
          </p>

          {error && (
            <div className="alert-box alert-danger" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirmRevoke}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {loading ? 'Mencabut...' : 'Ya, Cabut & Akhiri Sesi'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
