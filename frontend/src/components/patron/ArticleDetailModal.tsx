import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, ArticleItem } from '../../services/api';

interface ArticleDetailModalProps {
  article: ArticleItem | null;
  onClose: () => void;
  onOpenPdf: (articleId: number, docId: number, title: string) => void;
}

export const ArticleDetailModal: React.FC<ArticleDetailModalProps> = ({
  article,
  onClose,
  onOpenPdf,
}) => {
  const [currentArticle, setCurrentArticle] = useState<ArticleItem | null>(article);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Prevent background body scrolling while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    if (!article) {
      setCurrentArticle(null);
      return;
    }
    setCurrentArticle(article);

    // If documents are not yet loaded or empty, fetch full details from backend API
    if (!article.documents || article.documents.length === 0) {
      setLoadingDocs(true);
      api
        .getArticle(article.eprintid)
        .then((full) => {
          if (full) {
            setCurrentArticle(full);
          }
        })
        .catch((err) => {
          console.warn('Could not refresh article documents:', err);
        })
        .finally(() => {
          setLoadingDocs(false);
        });
    }
  }, [article]);

  if (!currentArticle) return null;

  const isPublish = currentArticle.eprint_status === 'archive';
  const docs = currentArticle.documents || [];

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog large animated-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ paddingRight: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="eprint-id-badge">EPRINT #{currentArticle.eprintid}</span>
              {currentArticle.type && (
                <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--color-text-muted)' }}>
                  • {currentArticle.type}
                </span>
              )}
            </div>
            <h2 className="modal-title" style={{ fontSize: 19, lineHeight: 1.35, color: 'var(--color-text)', margin: 0 }}>
              {currentArticle.title}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Tutup"
            style={{ borderRadius: '50%', width: 32, height: 32, padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Status & Year Badges */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            {isPublish ? (
              <span className="badge badge-publish" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                Status: Terbit Terbuka (Archive)
              </span>
            ) : (
              <span className="badge badge-unpublish" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                Status: Akses Khusus Perpustakaan ({currentArticle.eprint_status.toUpperCase()})
              </span>
            )}

            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Tahun Terbit: <strong>{currentArticle.date_year || '-'}</strong></span>
            </span>
          </div>

          {/* ========================================================= */}
          {/* ZERO-SCROLL ACTION SECTION: BERKAS NASKAH DIGITAL DI ATAS */}
          {/* ========================================================= */}
          <div
            style={{
              marginBottom: 22,
              padding: '16px 18px',
              backgroundColor: 'rgba(30, 58, 138, 0.04)',
              border: '1.5px solid var(--color-primary-light, #93c5fd)',
              borderRadius: 'var(--radius-lg, 10px)',
              boxShadow: '0 2px 8px rgba(30, 58, 138, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'var(--color-primary)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}>
                    Berkas Naskah Digital ({docs.length})
                  </h4>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Buka langsung di Kanvas Terproteksi (Watermark Dinamis & Anti-Download)
                  </span>
                </div>
              </div>

              {loadingDocs && (
                <span style={{ fontSize: 12, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span className="spinner-border spinner-border-sm" /> Memuat berkas...
                </span>
              )}
            </div>

            {docs.length === 0 ? (
              <div style={{ padding: '14px 16px', textAlign: 'center', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)', fontSize: 13, border: '1px dashed var(--color-border)' }}>
                {loadingDocs
                  ? 'Sedang memeriksa ketersediaan berkas digital di database EPrints...'
                  : 'Naskah ini tercatat belum memiliki dokumen PDF yang terhubung di server EPrints.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {docs.map((doc) => (
                  <div
                    key={doc.docid}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--color-surface)',
                      transition: 'all 0.15s ease',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#dc2626',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>

                      <div style={{ overflow: 'hidden' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13.5,
                            color: 'var(--color-text)',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                          }}
                          title={doc.filename}
                        >
                          {doc.filename}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {(doc.filesize / 1024 / 1024).toFixed(2)} MB • {doc.format} • Keamanan: <code style={{ fontSize: 11 }}>{doc.security}</code>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onOpenPdf(currentArticle.eprintid, doc.docid, currentArticle.title)}
                      style={{
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '9px 18px',
                        fontSize: 13,
                        boxShadow: '0 2px 6px rgba(30, 58, 138, 0.25)',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>Buka di Kanvas Terproteksi</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Creators / Authors */}
          <div style={{ marginBottom: 18 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: 8 }}>
              Kreator & Peneliti
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {currentArticle.creators && currentArticle.creators.length > 0 ? (
                currentArticle.creators.map((author, idx) => (
                  <span key={idx} className="author-chip" style={{ fontSize: 12.5, padding: '4px 12px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>{author}</span>
                    {idx === 0 && (currentArticle.id_number || currentArticle.nim) && (
                      <span className="author-id-number" title="Nomor Identifikasi / NIM Penulis">
                        {currentArticle.id_number || currentArticle.nim}
                      </span>
                    )}
                  </span>
                ))
              ) : (
                <span className="author-chip" style={{ fontSize: 12.5, padding: '4px 12px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Civitas Akademika UMS</span>
                  {(currentArticle.id_number || currentArticle.nim) && (
                    <span className="author-id-number" title="Nomor Identifikasi / NIM">
                      {currentArticle.id_number || currentArticle.nim}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Department / Faculty */}
          {currentArticle.department && (
            <div style={{ marginBottom: 18 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: 6 }}>
                Program Studi / Fakultas
              </h4>
              <p style={{ fontSize: 13.5, margin: 0, color: 'var(--color-text)' }}>{currentArticle.department}</p>
            </div>
          )}

          {/* Abstract */}
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-light)', marginBottom: 8 }}>
              Abstrak Ringkas
            </h4>
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.75,
                color: 'var(--color-text)',
                backgroundColor: 'var(--color-surface-subtle)',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              {currentArticle.abstract || 'Abstrak ringkas tidak disertakan pada rekaman repositori ini.'}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Repositori Publikasi Ilmiah Universitas Muhammadiyah Surakarta
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

