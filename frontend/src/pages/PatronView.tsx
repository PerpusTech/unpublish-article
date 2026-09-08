import React, { useState, useEffect } from 'react';
import { api, ArticleItem, PatronSession } from '../services/api';
import { ArticleCard } from '../components/patron/ArticleCard';
import { ArticleCardSkeleton } from '../components/patron/ArticleCardSkeleton';
import { ArticleDetailModal } from '../components/patron/ArticleDetailModal';
import { PDFCanvasViewer } from '../components/pdf/PDFCanvasViewer';
import { BrowseItemsModal, BrowseCategory, ActiveFacetsState } from '../components/patron/BrowseItemsModal';
import { PaginationControls } from '../components/common/PaginationControls';
import { copyToClipboard } from '../utils/clipboard';

export interface RecentReadItem {
  eprintid: number;
  title: string;
  creators?: string;
  year?: string | number;
  article_status?: string;
  openedAt: string;
}

export interface FacetedFilters {
  status: 'ALL' | 'UNPUBLISH' | 'PUBLISH';
  year?: number;
  division?: string;
  divisionLabel?: string;
  type?: string;
  typeLabel?: string;
  subject?: string;
  subjectLabel?: string;
  author?: string;
  authorLabel?: string;
}

interface PatronViewProps {
  session: PatronSession | null;
  onOpenClaimModal: () => void;
}

export const PatronView: React.FC<PatronViewProps> = ({ session, onOpenClaimModal }) => {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [facets, setFacets] = useState<FacetedFilters>({
    status: 'ALL',
  });
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Recent Reads State
  const [recentReads, setRecentReads] = useState<RecentReadItem[]>(() => {
    try {
      const saved = sessionStorage.getItem('ums_patron_recent_reads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToRecentReads = (art: { eprintid: number; title: string; creators?: string[] | string; date_year?: number; year?: string | number; eprint_status?: string; article_status?: string }) => {
    setRecentReads((prev: RecentReadItem[]) => {
      const filtered = prev.filter((r: RecentReadItem) => r.eprintid !== art.eprintid);
      const creatorStr = Array.isArray(art.creators) ? art.creators.join(', ') : art.creators || '';
      const yearStr = art.date_year || art.year || '';
      const updated: RecentReadItem[] = [
        {
          eprintid: art.eprintid,
          title: art.title,
          creators: creatorStr,
          year: yearStr,
          article_status: art.eprint_status || art.article_status || 'UNPUBLISH',
          openedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
        ...filtered,
      ].slice(0, 6);
      try {
        sessionStorage.setItem('ums_patron_recent_reads', JSON.stringify(updated));
      } catch { }
      return updated;
    });
  };

  const handleClearRecentReads = () => {
    setRecentReads([]);
    try {
      sessionStorage.removeItem('ums_patron_recent_reads');
    } catch { }
  };

  // Browse Items State
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState<boolean>(false);
  const [browseCategoryTab, setBrowseCategoryTab] = useState<BrowseCategory>('year');

  // PDF Viewer State
  const [activePdf, setActivePdf] = useState<{
    articleId: number;
    docId: number;
    title: string;
  } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);

  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;
  const pageSizeRef = React.useRef(pageSize);
  pageSizeRef.current = pageSize;

  const loadArticles = async (
    targetPage?: number,
    targetPageSize?: number,
    overrideFacets?: FacetedFilters,
    overrideQuery?: string
  ) => {
    if (!session) {
      setArticles([]);
      return;
    }

    const pageToLoad = targetPage !== undefined ? targetPage : currentPageRef.current;
    const sizeToLoad = targetPageSize !== undefined ? targetPageSize : pageSizeRef.current;
    const currentFacets = overrideFacets !== undefined ? overrideFacets : facets;
    const currentQuery = overrideQuery !== undefined ? overrideQuery : searchQuery;

    setLoading(true);
    try {
      const res = await api.searchArticles({
        q: currentQuery.trim() || undefined,
        status: currentFacets.status,
        year: currentFacets.year,
        division: currentFacets.division,
        type: currentFacets.type,
        subject: currentFacets.subject,
        author: currentFacets.author,
        page: pageToLoad,
        limit: sizeToLoad,
      });
      setArticles(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages || Math.ceil(res.total / sizeToLoad) || 1);
      setCurrentPage(pageToLoad);
      currentPageRef.current = pageToLoad;
    } catch (err: any) {
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session) {
      setSelectedArticle(null);
      setActivePdf(null);
      setIsBrowseModalOpen(false);
    }
    loadArticles(1, pageSize);
  }, [session?.id, facets]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadArticles(1, pageSize);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadArticles(1, pageSize, facets, '');
  };

  const handleSelectFacet = (cat: BrowseCategory, val: string, lbl: string) => {
    setFacets((prev) => {
      const next: FacetedFilters = { ...prev };
      if (cat === 'year') {
        next.year = parseInt(val, 10);
      } else if (cat === 'division') {
        next.division = val;
        next.divisionLabel = lbl.replace(/^Divisi:\s*/, '');
      } else if (cat === 'type') {
        next.type = val;
        next.typeLabel = lbl.replace(/^Jenis:\s*/, '');
      } else if (cat === 'subject') {
        next.subject = val;
        next.subjectLabel = lbl.replace(/^Subjek:\s*/, '');
      } else if (cat === 'author') {
        next.author = val;
        next.authorLabel = lbl.replace(/^Penulis:\s*/, '');
      }
      return next;
    });
  };

  const handleRemoveFacet = (cat: BrowseCategory) => {
    setFacets((prev) => {
      const next: FacetedFilters = { ...prev };
      if (cat === 'year') delete next.year;
      else if (cat === 'division') {
        delete next.division;
        delete next.divisionLabel;
      } else if (cat === 'type') {
        delete next.type;
        delete next.typeLabel;
      } else if (cat === 'subject') {
        delete next.subject;
        delete next.subjectLabel;
      } else if (cat === 'author') {
        delete next.author;
        delete next.authorLabel;
      }
      return next;
    });
  };

  const handleStatusChange = (status: 'ALL' | 'UNPUBLISH' | 'PUBLISH') => {
    setFacets((prev) => ({ ...prev, status }));
  };

  const handleRemoveStatusFacet = () => {
    setFacets((prev) => ({ ...prev, status: 'ALL' }));
  };

  const handleClearAllFilters = () => {
    setFacets({ status: 'ALL' });
    setSearchQuery('');
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || loading) return;
    loadArticles(newPage, pageSize);
    // Smooth scroll to top of search results container
    const searchSection = document.getElementById('search-catalog-section');
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    loadArticles(1, newSize);
  };

  const handleCopyToken = async () => {
    if (!session?.token_code) return;
    const ok = await copyToClipboard(session.token_code);
    if (ok) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleOpenPdf = (articleId: number, docId: number, title: string) => {
    if (!session) {
      onOpenClaimModal();
      return;
    }
    addToRecentReads({
      eprintid: articleId,
      title: title,
    });
    setActivePdf({ articleId, docId, title });
  };

  const handleSelectArticle = (art: ArticleItem) => {
    addToRecentReads(art);
    setSelectedArticle(art);
  };

  const renderCategoryIcon = (cat: BrowseCategory, size = 14) => {
    switch (cat) {
      case 'year':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case 'subject':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        );
      case 'division':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <path d="M9 22v-4h6v4" />
            <path d="M8 6h.01" />
            <path d="M16 6h.01" />
            <path d="M12 6h.01" />
          </svg>
        );
      case 'type':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        );
      case 'author':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
    }
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
            <span>UPT Perpustakaan dan Layanan Digital UMS</span>
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
            Belum memiliki tiket token? Silakan kunjungi <strong>Meja Layanan UPT Perpustakaan dan Layanan Digital UMS</strong> untuk mendapatkan tiket sesi membaca.
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

          {/* Recent Reads (Riwayat Baca Terakhir Pemustaka) */}
          {recentReads.length > 0 && (
            <div
              style={{
                marginBottom: 20,
                padding: '12px 16px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  <span>Riwayat Naskah Terakhir Dibuka (Recent Reads)</span>
                  <span
                    style={{
                      fontSize: 11,
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      color: 'var(--color-primary)',
                      padding: '1px 7px',
                      borderRadius: 999,
                      fontWeight: 800,
                    }}
                  >
                    {recentReads.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleClearRecentReads}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    fontSize: 11.5,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Hapus riwayat naskah yang baru saja dibuka"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Bersihkan Riwayat</span>
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 10,
                }}
              >
                {recentReads.map((item) => (
                  <div
                    key={`recent-${item.eprintid}`}
                    onClick={() => {
                      api.getArticle(item.eprintid)
                        .then((fullArt) => setSelectedArticle(fullArt))
                        .catch(() => {
                          setSelectedArticle({
                            eprintid: item.eprintid,
                            title: item.title,
                            abstract: '',
                            type: 'article',
                            creators: item.creators ? [item.creators] : [],
                            date_year: Number(item.year) || 0,
                            eprint_status: (item.article_status as any) || 'buffer',
                            documents: [],
                          });
                        });
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: 'var(--color-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span>ID #{item.eprintid}</span>
                        {item.year && <span>• {item.year}</span>}
                        <span>• Dibuka: {item.openedAt}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        backgroundColor: 'var(--color-surface)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        api.getArticle(item.eprintid)
                          .then((fullArt) => {
                            if (fullArt.documents && fullArt.documents.length > 0) {
                              handleOpenPdf(fullArt.eprintid, fullArt.documents[0].docid, fullArt.title);
                            } else {
                              setSelectedArticle(fullArt);
                            }
                          })
                          .catch(() => {
                            setSelectedArticle({
                              eprintid: item.eprintid,
                              title: item.title,
                              abstract: '',
                              type: 'article',
                              creators: item.creators ? [item.creators] : [],
                              date_year: Number(item.year) || 0,
                              eprint_status: (item.article_status as any) || 'buffer',
                              documents: [],
                            });
                          });
                      }}
                    >
                      Buka Lagi ↗
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Bar & Filter Controls (Academic Scholarly Box) */}
          <div id="search-catalog-section" className="search-container">
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
                  id="patron-catalog-search-input"
                  name="search_query"
                  type="text"
                  className="search-input"
                  style={{ paddingLeft: 42, paddingRight: searchQuery ? 40 : 16 }}
                  placeholder="Cari naskah: judul, topik, nama penulis, NIM / Nomor Identifikasi, atau ID eprint..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
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

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setBrowseCategoryTab('year');
                  setIsBrowseModalOpen(true);
                }}
                style={{
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '11px 18px',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border-dark)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                }}
                title="Buka menu jelajahi naskah berdasarkan tahun, subjek, divisi, jenis, atau penulis"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 19 21 12 17 5 21 12 2" />
                </svg>
                <span>Jelajahi (Browse)</span>
              </button>
            </form>

            {/* Browse Categories Quick Bar */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginRight: 2 }}>
                Jelajahi Repositori:
              </span>
              {[
                { id: 'year' as BrowseCategory, label: 'Tahun', activeVal: facets.year },
                { id: 'subject' as BrowseCategory, label: 'Subjek', activeVal: facets.subjectLabel || facets.subject },
                { id: 'division' as BrowseCategory, label: 'Divisi / Fakultas', activeVal: facets.divisionLabel || facets.division },
                { id: 'type' as BrowseCategory, label: 'Jenis Naskah', activeVal: facets.typeLabel || facets.type },
                { id: 'author' as BrowseCategory, label: 'Penulis', activeVal: facets.authorLabel || facets.author },
              ].map((cat) => {
                const isActive = Boolean(cat.activeVal);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setBrowseCategoryTab(cat.id);
                      setIsBrowseModalOpen(true);
                    }}
                    className={`facet-browse-pill ${isActive ? 'active' : ''}`}
                    title={isActive ? `Filter aktif: ${cat.activeVal}. Klik untuk ubah.` : `Buka filter ${cat.label}`}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>{renderCategoryIcon(cat.id, 13)}</span>
                    <span>{cat.label}</span>
                    {isActive && (
                      <span className="facet-active-indicator" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status Filter Pills */}
            <div className="filter-pills" style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginRight: 4 }}>
                Status Akses:
              </span>
              <button
                type="button"
                className={`pill-btn ${facets.status === 'ALL' ? 'active' : ''}`}
                onClick={() => handleStatusChange('ALL')}
              >
                Semua Koleksi Repositori
              </button>
              <button
                type="button"
                className={`pill-btn ${facets.status === 'UNPUBLISH' ? 'active' : ''}`}
                onClick={() => handleStatusChange('UNPUBLISH')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)' }} />
                Khusus Perpustakaan (Unpublish / Buffer / Inbox)
              </button>
              <button
                type="button"
                className={`pill-btn ${facets.status === 'PUBLISH' ? 'active' : ''}`}
                onClick={() => handleStatusChange('PUBLISH')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }} />
                Terbit Terbuka (Archive)
              </button>
            </div>

            {/* Active Faceted Filter Chips Bar */}
            {(facets.year ||
              facets.division ||
              facets.type ||
              facets.subject ||
              facets.author ||
              facets.status !== 'ALL' ||
              searchQuery.trim().length > 0) && (
              <div className="faceted-search-panel">
                <div className="faceted-search-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                    <span>Filter Aktif (Faceted Search):</span>
                  </div>

                  <button
                    type="button"
                    className="facet-clear-all-btn"
                    onClick={handleClearAllFilters}
                    title="Reset semua filter ke awal"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Hapus Semua Filter</span>
                  </button>
                </div>

                <div className="faceted-filter-chips-list">
                  {/* Search Query Chip */}
                  {searchQuery.trim().length > 0 && (
                    <div className="facet-chip">
                      <span className="facet-chip-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </span>
                      <span className="facet-chip-category">Kata Kunci:</span>
                      <span className="facet-chip-value">"{searchQuery.trim()}"</span>
                      <button
                        type="button"
                        className="facet-chip-remove"
                        onClick={handleClearSearch}
                        title="Hapus kata kunci pencarian"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Status Chip */}
                  {facets.status !== 'ALL' && (
                    <div className="facet-chip">
                      <span className="facet-chip-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                      <span className="facet-chip-category">Status:</span>
                      <span className="facet-chip-value">
                        {facets.status === 'UNPUBLISH' ? 'Khusus Perpustakaan (Unpublish)' : 'Terbit Terbuka (Archive)'}
                      </span>
                      <button
                        type="button"
                        className="facet-chip-remove"
                        onClick={handleRemoveStatusFacet}
                        title="Kembalikan ke semua status"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Year Chip */}
                  {facets.year && (
                    <div className="facet-chip">
                      <span className="facet-chip-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{renderCategoryIcon('year', 12)}</span>
                      <span className="facet-chip-category">Tahun:</span>
                      <span className="facet-chip-value">{facets.year}</span>
                      <button
                        type="button"
                        className="facet-chip-remove"
                        onClick={() => handleRemoveFacet('year')}
                        title="Hapus filter tahun"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Division / Faculty Chip */}
                  {facets.division && (
                    <div className="facet-chip">
                      <span className="facet-chip-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{renderCategoryIcon('division', 12)}</span>
                      <span className="facet-chip-category">Divisi:</span>
                      <span className="facet-chip-value">{facets.divisionLabel || facets.division}</span>
                      <button
                        type="button"
                        className="facet-chip-remove"
                        onClick={() => handleRemoveFacet('division')}
                        title="Hapus filter divisi"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Type Chip */}
                  {facets.type && (
                    <div className="facet-chip">
                      <span className="facet-chip-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{renderCategoryIcon('type', 12)}</span>
                      <span className="facet-chip-category">Jenis:</span>
                      <span className="facet-chip-value">{facets.typeLabel || facets.type}</span>
                      <button
                        type="button"
                        className="facet-chip-remove"
                        onClick={() => handleRemoveFacet('type')}
                        title="Hapus filter jenis naskah"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Subject Chip */}
                  {facets.subject && (
                    <div className="facet-chip">
                      <span className="facet-chip-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{renderCategoryIcon('subject', 12)}</span>
                      <span className="facet-chip-category">Subjek:</span>
                      <span className="facet-chip-value">{facets.subjectLabel || facets.subject}</span>
                      <button
                        type="button"
                        className="facet-chip-remove"
                        onClick={() => handleRemoveFacet('subject')}
                        title="Hapus filter subjek"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Author Chip */}
                  {facets.author && (
                    <div className="facet-chip">
                      <span className="facet-chip-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{renderCategoryIcon('author', 12)}</span>
                      <span className="facet-chip-category">Penulis:</span>
                      <span className="facet-chip-value">{facets.authorLabel || facets.author}</span>
                      <button
                        type="button"
                        className="facet-chip-remove"
                        onClick={() => handleRemoveFacet('author')}
                        title="Hapus filter penulis"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Results Summary Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              padding: '0 4px',
              flexWrap: 'wrap',
              gap: 8,
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

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--color-primary)',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontWeight: 600,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
                <span>Urutan: <strong>Terbaru Diunggah</strong></span>
              </div>

              <button
                type="button"
                onClick={() => loadArticles(currentPage, pageSize)}
                disabled={loading}
                title="Segarkan / Reload data katalog naskah"
                aria-label="Segarkan data naskah"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  opacity: loading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-subtle)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    animation: loading ? 'spin 1s linear infinite' : 'none',
                  }}
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>{loading ? 'Memuat...' : 'Refresh'}</span>
              </button>
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
              {/* Top Pagination Bar */}
              <PaginationControls
                position="top"
                itemLabel="naskah karya ilmiah"
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[10, 20, 50, 100]}
                loading={loading}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {articles.map((item) => (
                  <ArticleCard
                    key={item.eprintid}
                    article={item}
                    onSelect={handleSelectArticle}
                    onOpenPdf={handleOpenPdf}
                  />
                ))}
              </div>

              {/* Bottom Pagination Bar */}
              <PaginationControls
                position="bottom"
                itemLabel="naskah karya ilmiah"
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={total}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[10, 20, 50, 100]}
                loading={loading}
              />
            </div>
          )}
        </div>
      )}

      {/* Article Detail Modal (Returns back here when reader is closed) */}
      {selectedArticle && !activePdf && (
        <ArticleDetailModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onOpenPdf={(articleId: number, docId: number, title: string) => {
            handleOpenPdf(articleId, docId, title);
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

      {/* Browse Items Modal with Multi-Faceted Filter Support */}
      <BrowseItemsModal
        isOpen={isBrowseModalOpen}
        activeCategory={browseCategoryTab}
        activeFacets={facets}
        onClose={() => setIsBrowseModalOpen(false)}
        onSelectFilter={handleSelectFacet}
        onRemoveFilter={handleRemoveFacet}
      />
    </div>
  );
};

