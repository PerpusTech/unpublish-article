import React, { useState, useEffect } from 'react';
import { api, ArticleItem, PatronSession } from '../services/api';
import { ArticleCard } from '../components/patron/ArticleCard';
import { ArticleCardSkeleton } from '../components/patron/ArticleCardSkeleton';
import { ArticleDetailModal } from '../components/patron/ArticleDetailModal';
import { PDFCanvasViewer } from '../components/pdf/PDFCanvasViewer';

interface PatronViewProps {
  session: PatronSession | null;
  onOpenClaimModal: () => void;
}

export const PatronView: React.FC<PatronViewProps> = ({ session, onOpenClaimModal }) => {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPUBLISH' | 'PUBLISH'>('ALL');
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // PDF Viewer State
  const [activePdf, setActivePdf] = useState<{
    articleId: number;
    docId: number;
    title: string;
  } | null>(null);

  const loadArticles = async () => {
    if (!session) {
      setArticles([]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.searchArticles({
        q: searchQuery.trim() || undefined,
        status: statusFilter,
      });
      setArticles(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, [session, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadArticles();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (session) {
      setLoading(true);
      api.searchArticles({ status: statusFilter })
        .then((res) => {
          setArticles(res.items);
          setTotal(res.total);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  };

  const handleCopyToken = () => {
    if (!session?.token_code) return;
    navigator.clipboard.writeText(session.token_code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleOpenPdf = (articleId: number, docId: number, title: string) => {
    if (!session) {
      onOpenClaimModal();
      return;
    }
    setActivePdf({ articleId, docId, title });
  };

  return (
    <div className="page-transition">
      {!session ? (
        /* UI/UX Pro Max: Research Gateway Hero */
        <div className="gateway-hero">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
              borderRadius: 9999,
              fontSize: 11.5,
              fontWeight: 700,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.8px',
              color: 'var(--color-primary)',
              marginBottom: 20,
              textTransform: 'uppercase',
            }}
          >
            <span>Perpustakaan UMS</span>
            <span style={{ color: 'var(--color-accent)' }}>•</span>
            <span>Repositori Naskah Khusus</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(24px, 4vw, 34px)',
              fontWeight: 800,
              color: 'var(--color-primary)',
              marginBottom: 14,
              letterSpacing: '-0.025em',
              lineHeight: 1.25,
            }}
          >
            Layanan Baca Karya Ilmiah Terbatas
          </h1>

          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 15,
              lineHeight: 1.7,
              maxWidth: 620,
              margin: '0 auto 28px',
            }}
          >
            Platform pembacaan digital naskah repositori EPrints UMS yang berstatus <em>unpublish</em> (Buffer & Inbox). 
            Dirancang secara aman dengan proteksi kanvas dan penandaan identitas otomatis demi menjaga hak orisinalitas riset civitas akademik.
          </p>

          {/* Three Feature Highlight Pillars */}
          <div className="gateway-features-grid">
            <div className="gateway-feature-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)', fontWeight: 700, fontSize: 13 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Akses Bertiket Terbatas</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Sesi membaca terkontrol dengan batas durasi dan terikat pada perangkat Anda di area perpustakaan.
              </div>
            </div>

            <div className="gateway-feature-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)', fontWeight: 700, fontSize: 13 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Watermark Identitas</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Setiap halaman dokumen ditandai secara dinamis dengan nama & NIM Anda untuk perlindungan hak cipta.
              </div>
            </div>

            <div className="gateway-feature-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)', fontWeight: 700, fontSize: 13 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Kanvas View-Only</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Rendering langsung di browser tanpa mengekspos tautan unduh mentah file PDF naskah.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-primary btn-sso-animated"
              onClick={onOpenClaimModal}
              style={{
                padding: '14px 34px',
                fontSize: 15,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>Aktivasi Token Tiket Membaca</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          <div
            style={{
              marginTop: 28,
              paddingTop: 18,
              borderTop: '1px solid var(--color-border)',
              fontSize: 12.5,
              color: 'var(--color-text-light)',
            }}
          >
            Belum memiliki tiket token? Silakan kunjungi <strong>Meja Layanan Perpustakaan UMS</strong> untuk mendapatkan tiket sesi membaca.
          </div>
        </div>
      ) : (
        /* UI/UX Pro Max: Authenticated Research Desk */
        <div>
          {/* Active Session Identity Banner */}
          <div className="session-active-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span
                className="badge badge-publish"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                Sesi Terverifikasi
              </span>

              <span style={{ fontSize: 13.5, color: 'var(--color-text)' }}>
                Pemustaka: <strong>{session.patron_name}</strong> <span style={{ color: 'var(--color-text-muted)' }}>({session.patron_nim})</span>
              </span>

              <span style={{ color: 'var(--color-border-dark)' }}>•</span>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Kode Tiket:</span>
                <button
                  type="button"
                  className="copy-token-btn"
                  onClick={handleCopyToken}
                  title="Klik untuk menyalin kode token"
                >
                  <span>{session.token_code}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {isCopied && <span style={{ color: 'var(--color-success)', fontSize: 10 }}>✓ Tersalin</span>}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Perangkat Terkunci • Watermark Dinamis Aktif</span>
            </div>
          </div>

          {/* Search Bar & Filter Controls (Academic Scholarly Box) */}
          <div className="search-container">
            <form onSubmit={handleSearch} className="search-row" style={{ position: 'relative' }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 14,
                    color: 'var(--color-text-muted)',
                    pointerEvents: 'none',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>

                <input
                  type="text"
                  className="search-input"
                  style={{ paddingLeft: 42, paddingRight: searchQuery ? 40 : 16 }}
                  placeholder="Cari naskah: ketik judul karya ilmiah, nama peneliti / pembimbing, kata kunci, atau ID eprint..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={{
                      position: 'absolute',
                      right: 12,
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: 14,
                      padding: 4,
                    }}
                    title="Bersihkan pencarian"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '11px 22px',
                }}
              >
                {loading ? (
                  <>
                    <div className="spinner-inline" style={{ width: 14, height: 14 }} />
                    <span>Mencari...</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>Cari Naskah</span>
                  </>
                )}
              </button>
            </form>

            <div className="filter-pills" style={{ marginTop: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginRight: 4 }}>
                Filter Koleksi:
              </span>
              <button
                type="button"
                className={`pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
              >
                Semua Koleksi Repositori
              </button>
              <button
                type="button"
                className={`pill-btn ${statusFilter === 'UNPUBLISH' ? 'active' : ''}`}
                onClick={() => setStatusFilter('UNPUBLISH')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }} />
                Khusus Perpustakaan (Unpublish / Buffer / Inbox)
              </button>
              <button
                type="button"
                className={`pill-btn ${statusFilter === 'PUBLISH' ? 'active' : ''}`}
                onClick={() => setStatusFilter('PUBLISH')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
                Terbit Terbuka (Archive)
              </button>
            </div>
          </div>

          {/* Results Summary Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              padding: '0 4px',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>
                Menemukan <strong style={{ color: 'var(--color-text)' }}>{total.toLocaleString('id-ID')}</strong> naskah karya ilmiah repositori
              </span>
            </div>
          </div>

          {/* Articles Listing */}
          {loading ? (
            /* UI/UX Pro Max: Skeleton Loader for Cards */
            <div>
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
              <ArticleCardSkeleton />
            </div>
          ) : articles.length === 0 ? (
            /* UI/UX Pro Max: Empty State with Search Guidance */
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '56px 24px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--color-surface-subtle)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 16px',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>

              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
                Tidak ada naskah yang cocok
              </div>

              <p style={{ fontSize: 13.5, maxWidth: 440, margin: '0 auto 18px', lineHeight: 1.6 }}>
                Tidak ditemukan naskah dengan kata kunci &quot;{searchQuery}&quot;. Coba periksa ejaan, gunakan kata kunci yang lebih umum, atau ubah filter koleksi di atas.
              </p>

              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleClearSearch}
                  style={{ fontWeight: 600 }}
                >
                  Tampilkan Semua Koleksi
                </button>
              )}
            </div>
          ) : (
            <div>
              {articles.map((item) => (
                <ArticleCard
                  key={item.eprintid}
                  article={item}
                  onSelect={(art) => setSelectedArticle(art)}
                  onOpenPdf={handleOpenPdf}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Article Detail Modal */}
      {selectedArticle && (
        <ArticleDetailModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onOpenPdf={(articleId: number, docId: number, title: string) => {
            handleOpenPdf(articleId, docId, title);
            setSelectedArticle(null);
          }}
        />
      )}

      {/* Fullscreen Reading Canvas Modal with Dynamic Watermark */}
      {activePdf && (
        <PDFCanvasViewer
          articleId={activePdf.articleId}
          docId={activePdf.docId}
          articleTitle={activePdf.title}
          session={session}
          onClose={() => setActivePdf(null)}
        />
      )}
    </div>
  );
};
