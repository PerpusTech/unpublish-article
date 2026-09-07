import React, { useState, useEffect } from 'react';
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

  return (
    <div
      className="modal-backdrop"
      style={{ padding: 0, zIndex: 2000 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1e293b',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setZoom((z) => Math.max(70, z - 15))}
                title="Perkecil"
              >
                -
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', minWidth: 40, textAlign: 'center' }}>
                {zoom}%
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setZoom((z) => Math.min(180, z + 15))}
                title="Perbesar"
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }}
            >
              Tutup Pembaca (Esc) ✕
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
            padding: '24px 0',
            backgroundColor: '#334155',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${zoom}%`,
              maxWidth: '960px',
              minHeight: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            {/* The Document View Frame */}
            <iframe
              src={`${streamUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title="PDF Reader"
              style={{
                width: '100%',
                height: '100%',
                minHeight: '88vh',
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
    </div>
  );
};
