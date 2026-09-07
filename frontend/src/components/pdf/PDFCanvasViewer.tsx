import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, PatronSession } from '../../services/api';

interface PDFCanvasViewerProps {
  articleId: number;
  docId: number;
  articleTitle: string;
  session: PatronSession | null;
  onClose: () => void;
}

export const PDFCanvasViewer: React.FC<PDFCanvasViewerProps> = ({
  articleId,
  docId,
  articleTitle,
  session,
  onClose,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  let currentSession = session;
  if (!currentSession) {
    try {
      const saved = localStorage.getItem('ums_patron_session');
      if (saved) currentSession = JSON.parse(saved);
    } catch {}
  }

  const effectiveTokenId = currentSession?.id || localStorage.getItem('ums_patron_token_id') || undefined;
  const streamUrl = api.getDocumentStreamUrl(articleId, docId, effectiveTokenId);

  // Generate watermark stamp
  const watermarkText = currentSession
    ? `Perpustakaan UMS • ${currentSession.patron_nim} - ${currentSession.patron_name} • Token: ${currentSession.token_code} • ${new Date().toLocaleDateString('id-ID')}`
    : `Perpustakaan UMS • Akses Baca Terbatas • ${new Date().toLocaleDateString('id-ID')}`;

  // Prevent background body scrolling while reader is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Anti-tamper: disable context menu, Ctrl+P, Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'u')) {
        e.preventDefault();
        alert('Fitur pencetakan atau pengunduhan naskah unpublish dinonaktifkan demi perlindungan hak cipta.');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Active session heartbeat: check every 3 seconds to instantly terminate reading if session is revoked by librarian
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await api.getSessionStatus();
        if (isMounted && (!res.isActive || !res.session)) {
          alert(res.reason || 'Sesi membaca Anda telah dicabut oleh petugas perpustakaan.');
          localStorage.removeItem('ums_patron_session');
          localStorage.removeItem('ums_patron_token_id');
          onClose();
          window.location.reload();
        }
      } catch {}
    };

    const interval = setInterval(checkStatus, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop"
      style={{
        padding: 0,
        zIndex: 9999,
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1e293b',
          overflow: 'hidden',
        }}
      >
        {/* PDF Reader Toolbar */}
        <div
          style={{
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #334155',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <span
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 2,
                whiteSpace: 'nowrap',
              }}
            >
              PROTECTED VIEW
            </span>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {articleTitle}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Zoom Controls */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 3,
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                title="Perkecil (Zoom Out)"
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 16,
                  lineHeight: 1,
                  transition: 'background 0.15s ease',
                }}
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setZoom(100)}
                title="Klik untuk reset zoom ke 100%"
                style={{
                  minWidth: 54,
                  height: 28,
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  color: '#93c5fd',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {zoom}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(250, z + 15))}
                title="Perbesar (Zoom In)"
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: 16,
                  lineHeight: 1,
                  transition: 'background 0.15s ease',
                }}
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{
                backgroundColor: '#334155',
                color: '#fff',
                borderColor: '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontWeight: 600,
              }}
            >
              <span>Tutup Pembaca</span>
              <span style={{ opacity: 0.7, fontSize: 11 }}>(Esc)</span>
              <span>✕</span>
            </button>
          </div>
        </div>

        {/* PDF Viewport & Watermark Area */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
            backgroundColor: '#1e293b',
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${Math.round(960 * (zoom / 100))}px`,
              minWidth: '320px',
              maxWidth: 'none',
              minHeight: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
              borderRadius: 4,
              overflow: 'hidden',
              flexShrink: 0,
              transition: 'width 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* The Document View Frame */}
            <iframe
              src={`${streamUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title="PDF Reader"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
            />

            {/* Dynamic Watermark Stamp Overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-around',
                alignItems: 'center',
                opacity: 0.18,
                zIndex: 50,
                userSelect: 'none',
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  style={{
                    transform: 'rotate(-25deg)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    color: '#0a2540',
                    whiteSpace: 'nowrap',
                    letterSpacing: '1.5px',
                    border: '1px dashed rgba(10, 37, 64, 0.45)',
                    padding: '4px 18px',
                    borderRadius: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                  }}
                >
                  {watermarkText}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security Notice Footer */}
        <div
          style={{
            backgroundColor: '#0f172a',
            color: '#94a3b8',
            fontSize: 11,
            fontFamily: 'var(--font-sans)',
            padding: '6px 20px',
            textAlign: 'center',
            borderTop: '1px solid #334155',
          }}
        >
          Perpustakaan Universitas Muhammadiyah Surakarta — Seluruh aktivitas membaca naskah tercatat dalam Log Audit institusional (NIM: {session?.patron_nim || 'Guest'}).
        </div>
      </div>
    </div>,
    document.body
  );
};
