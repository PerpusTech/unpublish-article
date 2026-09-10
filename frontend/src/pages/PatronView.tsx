import React, { useState, useEffect } from 'react';
import { api, ArticleItem, PatronSession, NetworkStatusResponse, SearchSuggestions } from '../services/api';
import { subscribeSessionSync } from '../utils/sessionSync';
import { ArticleCard } from '../components/patron/ArticleCard';
import { ArticleCardSkeleton } from '../components/patron/ArticleCardSkeleton';
import { ArticleDetailModal } from '../components/patron/ArticleDetailModal';
import { PDFCanvasViewer } from '../components/pdf/PDFCanvasViewer';
import { BrowseItemsModal, BrowseCategory, ActiveFacetsState } from '../components/patron/BrowseItemsModal';
import { IntranetCheckinModal } from '../components/patron/IntranetCheckinModal';
import { RevokeSessionModal } from '../components/patron/RevokeSessionModal';
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
  networkStatus?: NetworkStatusResponse | null;
  onOpenClaimModal: () => void;
}

export const PatronView: React.FC<PatronViewProps> = ({ session, networkStatus, onOpenClaimModal }) => {
  const hasAccess = !!session || !!networkStatus?.canReadDirectly;
  const [intranetSession, setIntranetSession] = useState<PatronSession | null>(() => {
    try {
      const saved = localStorage.getItem('ums_patron_session') || localStorage.getItem('ums_intranet_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.patron_nim && parsed.patron_name && parsed.patron_name !== 'Civitas Akademika UMS') {
          return parsed;
        }
      }
    } catch { }
    return null;
  });
  const [isIntranetCheckinOpen, setIsIntranetCheckinOpen] = useState<boolean>(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState<boolean>(false);
  const [pendingPdf, setPendingPdf] = useState<{ articleId: number; docId: number; title: string } | null>(null);

  useEffect(() => {
    if (!session) {
      setIntranetSession(null);
    } else {
      setIntranetSession(session);
    }
  }, [session]);

  // Listen to cross-tab session logout / login events
  useEffect(() => {
    const unsubscribe = subscribeSessionSync({
      onLogout: () => {
        setIntranetSession(null);
        setActivePdf(null);
        setSelectedArticle(null);
      },
      onLogin: (newSession) => {
        setIntranetSession(newSession);
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const effectiveSession: PatronSession | null = session || intranetSession || (networkStatus?.canReadDirectly ? {
    id: 'INTRANET_UMS',
    token_code: 'UMS-INTRANET',
    patron_name: 'Civitas Akademika UMS',
    patron_nim: networkStatus.clientIp || 'Jaringan UMS',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    remaining_seconds: 86400,
  } : null);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [facets, setFacets] = useState<FacetedFilters>({
    status: 'ALL',
  });
  const [selectedArticle, setSelectedArticle] = useState<ArticleItem | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [crossTabLockNotice, setCrossTabLockNotice] = useState<string | null>(null);

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
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestions | null>(null);

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
    if (!hasAccess) {
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
      setSearchSuggestions(res.suggestions || null);
      setCurrentPage(pageToLoad);
      currentPageRef.current = pageToLoad;
    } catch (err: any) {
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cross-Tab Session Synchronization & Auto-Lock Listener
  useEffect(() => {
    const unsubscribe = subscribeSessionSync({
      onLogout: () => {
        // Immediately lock PDF reader, dismiss detail modal, and clear session
        setIntranetSession(null);
        setActivePdf(null);
        setSelectedArticle(null);
        setIsIntranetCheckinOpen(false);
        setIsRevokeModalOpen(false);
        setCrossTabLockNotice('Sesi pemustaka telah diakhiri di tab lain. Tampilan naskah dan kanvas PDF terkunci demi keamanan.');
        loadArticles(1, pageSizeRef.current, { status: 'ALL' });
      },
      onLogin: (newSession) => {
        setIntranetSession(newSession);
        setCrossTabLockNotice(null);
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasAccess) {
      setSelectedArticle(null);
      setActivePdf(null);
      setIsBrowseModalOpen(false);
    }
    loadArticles(1, pageSize);
  }, [session?.id, networkStatus?.canReadDirectly, facets]);

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

  const handleApplyKeywordSuggestion = (keyword: string) => {
    setSearchQuery(keyword);
    loadArticles(1, pageSize, facets, keyword);
  };

  const handleApplyDivisionSuggestion = (divVal: string, divLabel?: string) => {
    const nextFacets: FacetedFilters = {
      ...facets,
      division: divVal,
      divisionLabel: divLabel || divVal,
    };
    setFacets(nextFacets);
    loadArticles(1, pageSize, nextFacets, searchQuery);
  };

  const handleApplySubjectSuggestion = (subVal: string, subLabel?: string) => {
    const nextFacets: FacetedFilters = {
      ...facets,
      subject: subVal,
      subjectLabel: subLabel || subVal,
    };
    setFacets(nextFacets);
    loadArticles(1, pageSize, nextFacets, searchQuery);
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
    if (!hasAccess) {
      onOpenClaimModal();
      return;
    }
    if (networkStatus?.canReadDirectly && !session && !intranetSession) {
      setPendingPdf({ articleId, docId, title });
      setIsIntranetCheckinOpen(true);
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
            <polyline points="10 9 9 9 8 9" />
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
      {!hasAccess ? (
        networkStatus?.isBlocked ? (
          /* Campus Network Restriction View (Mode: UMS_NETWORK_ONLY) */
          <div className="gateway-hero" style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 9999,
                fontSize: 11.5,
                fontWeight: 700,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.8px',
                color: '#ef4444',
                marginBottom: 20,
                textTransform: 'uppercase',
              }}
            >
              <span>AKSES KHUSUS KAMPUS UMS</span>
              <span>•</span>
              <span>INTRANET / WI-FI ONLY</span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(24px, 4vw, 32px)',
                fontWeight: 800,
                color: 'var(--color-text)',
                marginBottom: 14,
                letterSpacing: '-0.025em',
                lineHeight: 1.25,
              }}
            >
              Akses Naskah Dibatasi Khusus Jaringan Kampus UMS
            </h1>

            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 15,
                lineHeight: 1.7,
                maxWidth: 640,
                margin: '0 auto 28px',
              }}
            >
              Sistem repositori saat ini menerapkan kebijakan keamanan <strong>Jaringan Kampus UMS Saja</strong>. Perangkat Anda saat ini terdeteksi berada di luar jaringan resmi UMS (<code style={{ color: 'var(--color-primary)' }}>{networkStatus?.clientIp || 'Luar Kampus'}</code>).
            </p>

            <div
              style={{
                maxWidth: 600,
                margin: '0 auto 24px',
                padding: '16px 20px',
                borderRadius: 12,
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: 'var(--color-text)' }}>
                Petunjuk Akses Naskah Karya Ilmiah:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                <li>Hubungkan perangkat Anda ke jaringan <strong>Wi-Fi Kampus UMS (Eduroam / UMS-Hotspot)</strong>.</li>
                <li>Setelah terhubung ke Wi-Fi UMS, muat ulang (refresh) halaman ini untuk langsung membaca naskah secara otomatis tanpa token.</li>
                <li>Atau kunjungi Gedung UPT Perpustakaan dan Layanan Digital UMS untuk mengakses terminal komputer layanan.</li>
              </ul>
            </div>
          </div>
        ) : (
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
        )
      ) : (
        /* UI/UX Pro Max: Authenticated Research Desk */
        <div>
          {/* Cross-Tab Auto-Lock Security Notice */}
          {crossTabLockNotice && (
            <div
              style={{
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                borderRadius: 'var(--radius-lg, 10px)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1.5px solid rgba(239, 68, 68, 0.35)',
                color: 'var(--color-text)',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#dc2626',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: 13.5, color: '#dc2626', fontWeight: 700 }}>
                    Tampilan Naskah Terkunci Otomatis (Cross-Tab Protection)
                  </strong>
                  <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                    {crossTabLockNotice}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCrossTabLockNotice(null)}
                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)' }}
              >
                Tutup Peringatan
              </button>
            </div>
          )}

          {/* Active Session Identity Banner */}
          {session ? (
            <div className="patron-session-bar">
              <div className="patron-session-info">
                <span className="patron-status-tag">
                  <span className="status-dot blue" />
                  Sesi Token
                </span>
                <span className="patron-divider">|</span>
                <span className="patron-identity-text">
                  Pemustaka: <strong>{session.patron_name}</strong>{' '}
                  <span className="patron-nim">({session.patron_nim})</span>
                </span>
                <span className="patron-divider">|</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Kode:</span>
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
                    {isCopied && <span style={{ color: 'var(--color-success)', fontSize: 10 }}>✓</span>}
                  </button>
                </div>
                <span className="patron-divider">|</span>
                <span className="patron-meta-note">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Perangkat Terkunci
                </span>
              </div>

              <div className="patron-session-controls">
                <button
                  type="button"
                  className="patron-action-btn danger"
                  onClick={() => setIsRevokeModalOpen(true)}
                  title="Cabut sesi tiket token dari perangkat ini jika selesai membaca"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Cabut Sesi</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="patron-session-bar">
              {intranetSession ? (
                <>
                  <div className="patron-session-info">
                    <span className="patron-status-tag">
                      <span className="status-dot green" />
                      Jaringan Kampus UMS
                    </span>
                    <span className="patron-divider">|</span>
                    <span className="patron-identity-text">
                      Pemustaka: <strong>{intranetSession.patron_name}</strong>{' '}
                      <span className="patron-nim">({intranetSession.patron_nim})</span>
                    </span>
                    <span className="patron-divider">|</span>
                    <span className="patron-meta-note">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      Watermark Aktif
                    </span>
                  </div>

                  <div className="patron-session-controls">
                    <button
                      type="button"
                      className="patron-action-btn"
                      onClick={() => setIsIntranetCheckinOpen(true)}
                      title="Ubah identitas nama atau NIM"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Ganti Identitas</span>
                    </button>

                    <button
                      type="button"
                      className="patron-action-btn danger"
                      onClick={() => setIsRevokeModalOpen(true)}
                      title="Cabut identitas dari PC ini setelah selesai membaca"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>Keluar Sesi</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="patron-session-info">
                    <span className="patron-status-tag">
                      <span className="status-dot green" />
                      Jaringan Kampus UMS
                    </span>
                    <span className="patron-divider">|</span>
                    <span className="patron-identity-text">
                      Akses Langsung Naskah Aktif <span className="patron-nim">({networkStatus?.clientIp || 'Wi-Fi/LAN'})</span>
                    </span>
                    <span className="patron-divider">|</span>
                    <span className="patron-meta-note">
                      Identitas belum terdaftar di perangkat ini
                    </span>
                  </div>

                  <div className="patron-session-controls">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600 }}
                      onClick={() => setIsIntranetCheckinOpen(true)}
                    >
                      Isi Identitas Pemustaka
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
                  <span>Riwayat Naskah Terakhir Dibuka</span>
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
            /* Smart Search Suggestion: Editorial Empty State */
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '36px 28px',
                textAlign: 'left',
                color: 'var(--color-text)',
              }}
            >
              {/* Header Row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: 'var(--color-surface-subtle)',
                    border: '1px solid var(--color-border)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                    Tidak Ditemukan Naskah yang Cocok
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
                    {searchQuery ? (
                      <>
                        Pencarian untuk kata kunci <strong style={{ color: 'var(--color-text)' }}>&quot;{searchQuery}&quot;</strong> tidak menghasilkan naskah. Periksa ejaan atau gunakan saran pencarian cerdas di bawah.
                      </>
                    ) : (
                      'Kombinasi filter yang Anda terapkan tidak menghasilkan naskah. Coba sesuaikan filter atau jelajahi kategori terkait.'
                    )}
                  </p>
                </div>
              </div>

              {/* 1. Nearest Keywords (Did You Mean?) */}
              {searchSuggestions?.nearestKeywords && searchSuggestions.nearestKeywords.length > 0 && (
                <div style={{ marginBottom: 20, padding: '14px 16px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Mungkin Maksud Anda (Rekomendasi Terdekat):</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {searchSuggestions.nearestKeywords.map((kw, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleApplyKeywordSuggestion(kw)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          backgroundColor: 'var(--color-surface)',
                          border: '1px solid var(--color-primary)',
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: 'var(--color-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <span>{kw}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Related Divisions / Faculties Shortcut */}
              {searchSuggestions?.relatedDivisions && searchSuggestions.relatedDivisions.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>Cari Berdasarkan Fakultas / Program Studi Terkait:</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {searchSuggestions.relatedDivisions.map((div, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleApplyDivisionSuggestion(div.value, div.label)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 11px',
                          backgroundColor: 'var(--color-surface-subtle)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 6,
                          fontSize: 12,
                          color: 'var(--color-text)',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <span>{div.label}</span>
                        <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)', padding: '1px 5px', borderRadius: 4 }}>
                          {div.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Related Subjects Shortcut */}
              {searchSuggestions?.relatedSubjects && searchSuggestions.relatedSubjects.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    <span>Cari Berdasarkan Subjek Terkait:</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {searchSuggestions.relatedSubjects.map((sub, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleApplySubjectSuggestion(sub.value, sub.label)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 11px',
                          backgroundColor: 'var(--color-surface-subtle)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 6,
                          fontSize: 12,
                          color: 'var(--color-text)',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{sub.label}</span>
                        <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface)', padding: '1px 5px', borderRadius: 4 }}>
                          {sub.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Popular Academic Research Topics */}
              {searchSuggestions?.popularKeywords && searchSuggestions.popularKeywords.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>Topik Kajian Populer di UMS:</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {searchSuggestions.popularKeywords.map((topic, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleApplyKeywordSuggestion(topic)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: 'var(--color-surface-subtle)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 9999,
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: 'var(--color-text)',
                          cursor: 'pointer',
                        }}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Navigation & Reset Shortcuts */}
              <div style={{ paddingTop: 16, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setBrowseCategoryTab('division');
                      setIsBrowseModalOpen(true);
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Jelajahi Semua Fakultas
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setBrowseCategoryTab('subject');
                      setIsBrowseModalOpen(true);
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Jelajahi Semua Subjek
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setBrowseCategoryTab('year');
                      setIsBrowseModalOpen(true);
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Jelajahi Berdasarkan Tahun
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleClearAllFilters}
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  Reset Semua Filter & Tampilkan Semua Naskah
                </button>
              </div>
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
                    searchQuery={searchQuery}
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
          searchQuery={searchQuery}
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
          session={effectiveSession}
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

      {/* Intranet Check-in Modal for Campus Network Self-Identification */}
      <IntranetCheckinModal
        isOpen={isIntranetCheckinOpen}
        clientIp={networkStatus?.clientIp}
        initialNim={intranetSession?.patron_nim}
        initialName={intranetSession?.patron_name}
        onClose={() => {
          setIsIntranetCheckinOpen(false);
          setPendingPdf(null);
        }}
        onSuccess={(newSession: PatronSession) => {
          setIntranetSession(newSession);
          if (pendingPdf) {
            addToRecentReads({
              eprintid: pendingPdf.articleId,
              title: pendingPdf.title,
            });
            setActivePdf(pendingPdf);
            setPendingPdf(null);
          }
        }}
      />

      {/* Revoke Session Confirmation Modal for Shared / Public Devices */}
      <RevokeSessionModal
        isOpen={isRevokeModalOpen}
        session={intranetSession}
        onClose={() => setIsRevokeModalOpen(false)}
        onSuccess={() => {
          setIntranetSession(null);
          setActivePdf(null);
          setSelectedArticle(null);
        }}
      />
    </div>
  );
};

