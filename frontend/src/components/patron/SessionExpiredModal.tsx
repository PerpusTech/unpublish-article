import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PatronSession } from '../../services/api';

interface SessionExpiredModalProps {
  isOpen: boolean;
  session: PatronSession | null;
  onOpenClaimModal: () => void;
  onClose: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  session,
  onOpenClaimModal,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop animated-fade-in" style={{ zIndex: 999999 }}>
      <div
        className="modal-dialog animated-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        style={{
          maxWidth: 460,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: 'var(--color-surface, #ffffff)',
          boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--color-border, #e2e8f0)',
        }}
      >
        <div style={{ padding: '28px 24px 24px' }}>
          {/* Header Section */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1.5px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <h2
              id="session-expired-title"
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: 'var(--color-text-main, #0f172a)',
                margin: '0 0 6px',
                letterSpacing: '-0.01em',
              }}
            >
              Sesi Membaca Telah Selesai
            </h2>
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted, #64748b)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Masa aktif tiket membaca dokumen unpublish repositori Anda telah habis.
            </p>
          </div>

          {/* Session Details Box */}
          {session && (
            <div
              style={{
                backgroundColor: 'var(--color-surface-subtle, #f8fafc)',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>Kode Tiket:</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontWeight: 700,
                    backgroundColor: '#e2e8f0',
                    color: '#0f172a',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12.5,
                  }}
                >
                  {session.token_code || 'UMS-EXPIRED'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>Pemustaka:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-main, #0f172a)' }}>
                  {session.patron_name || session.patron_nim}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>NIM / Identitas:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-main, #0f172a)' }}>
                  {session.patron_nim}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  borderTop: '1px dashed var(--color-border, #e2e8f0)',
                  paddingTop: 8,
                  marginTop: 2,
                }}
              >
                <span style={{ color: 'var(--color-text-muted, #64748b)' }}>Status Sesi:</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    padding: '2px 8px',
                    borderRadius: 20,
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                  }}
                >
                  KADALUWARSA (EXPIRED)
                </span>
              </div>
            </div>
          )}

          {/* Info Notice Box */}
          <div
            style={{
              marginTop: 14,
              backgroundColor: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.22)',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 12,
              lineHeight: 1.5,
              color: '#0369a1',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 2 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              Akses dokumen terproteksi telah dikunci kembali sesuai kebijakan lisensi repositori.
              Silakan masukkan token baru dari Meja Layanan Perpustakaan untuk melanjutkan membaca.
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onOpenClaimModal();
              }}
              style={{
                width: '100%',
                justifyContent: 'center',
                fontWeight: 700,
                padding: '11px 16px',
                fontSize: 13.5,
                gap: 8,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              <span>Aktivasi Token Membaca Baru</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-main, #334155)',
              }}
            >
              Kembali ke Katalog Pemustaka
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
