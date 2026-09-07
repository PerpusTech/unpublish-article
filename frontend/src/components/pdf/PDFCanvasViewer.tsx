import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, PatronSession, ArticleItem } from '../../services/api';

interface PDFCanvasViewerProps {
  articleId: number;
  docId: number;
  articleTitle: string;
  session: PatronSession | null;
  onClose: () => void;
}

interface SecondaryDocumentInfo {
  articleId: number;
  docId: number;
  title: string;
  filename?: string;
}

export const PDFCanvasViewer: React.FC<PDFCanvasViewerProps> = ({
  articleId,
  docId,
  articleTitle,
  session,
  onClose,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'single' | 'spread'>('single');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isWindowFocused, setIsWindowFocused] = useState<boolean>(true);
  const [screenshotWarning, setScreenshotWarning] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>(() => new Date().toLocaleString('id-ID'));
  
  // Current article details (to list all documents attached to this article)
  const [currentArticleDetail, setCurrentArticleDetail] = useState<ArticleItem | null>(null);
  const [loadingArticleDetail, setLoadingArticleDetail] = useState<boolean>(false);

  // Secondary Document for Right Pane in 2-Page / Comparative Mode
  const [secondaryDoc, setSecondaryDoc] = useState<SecondaryDocumentInfo | null>(null);
  const [isDocPickerOpen, setIsDocPickerOpen] = useState<boolean>(false);
  const [docPickerTab, setDocPickerTab] = useState<'article_docs' | 'recent_reads' | 'catalog_search'>('article_docs');
  
  // Catalog search state inside Document Picker
  const [searchCatalogQuery, setSearchCatalogQuery] = useState<string>('');
  const [searchCatalogResults, setSearchCatalogResults] = useState<ArticleItem[]>([]);
  const [searchCatalogLoading, setSearchCatalogLoading] = useState<boolean>(false);
  const [expandedSearchArticleId, setExpandedSearchArticleId] = useState<number | null>(null);
  const [searchArticleDetails, setSearchArticleDetails] = useState<Record<number, ArticleItem>>({});
  const [loadingSearchArticleDoc, setLoadingSearchArticleDoc] = useState<number | null>(null);

  // Recent reads from session storage
  const [recentReadsList, setRecentReadsList] = useState<any[]>([]);

  const viewerContainerRef = useRef<HTMLDivElement>(null);

  let currentSession = session;
  if (!currentSession) {
    try {
      const saved = localStorage.getItem('ums_patron_session');
      if (saved) currentSession = JSON.parse(saved);
    } catch {}
  }

  const effectiveTokenId = currentSession?.id || localStorage.getItem('ums_patron_token_id') || undefined;
  const mainStreamUrl = api.getDocumentStreamUrl(articleId, docId, effectiveTokenId);
  const secondaryStreamUrl = secondaryDoc
    ? api.getDocumentStreamUrl(secondaryDoc.articleId, secondaryDoc.docId, effectiveTokenId)
    : mainStreamUrl;

  // Fetch current article details (to list other documents in this article)
  useEffect(() => {
    let isMounted = true;
    setLoadingArticleDetail(true);
    api
      .getArticle(articleId)
      .then((art) => {
        if (isMounted && art) {
          setCurrentArticleDetail(art);
          // If secondaryDoc is not set and article has multiple documents, auto-suggest next document if available
          if (art.documents && art.documents.length > 1) {
            const otherDoc = art.documents.find((d) => d.docid !== docId);
            if (otherDoc) {
              setSecondaryDoc((prev: SecondaryDocumentInfo | null) =>
                prev || {
                  articleId: art.eprintid,
                  docId: otherDoc.docid,
                  title: art.title,
                  filename: otherDoc.filename || `Dokumen #${otherDoc.docid}`,
                }
              );
            }
          }
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat daftar dokumen naskah:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingArticleDetail(false);
      });

    return () => {
      isMounted = false;
    };
  }, [articleId, docId]);

  // Load recent reads from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ums_patron_recent_reads');
      if (raw) {
        setRecentReadsList(JSON.parse(raw));
      }
    } catch {}
  }, [isDocPickerOpen]);

  // Search catalog handler for right pane picker
  const handleSearchCatalog = async (q: string) => {
    setSearchCatalogQuery(q);
    if (!q.trim()) {
      setSearchCatalogResults([]);
      return;
    }
    setSearchCatalogLoading(true);
    try {
      const res = await api.searchArticles({ q: q.trim(), limit: 8 });
      setSearchCatalogResults(res.items || []);
    } catch {
      setSearchCatalogResults([]);
    } finally {
      setSearchCatalogLoading(false);
    }
  };

  // Expand article in catalog search to see its documents
  const handleExpandSearchArticle = async (artId: number) => {
    if (expandedSearchArticleId === artId) {
      setExpandedSearchArticleId(null);
      return;
    }
    setExpandedSearchArticleId(artId);
    if (!searchArticleDetails[artId]) {
      setLoadingSearchArticleDoc(artId);
      try {
        const full = await api.getArticle(artId);
        if (full) {
          setSearchArticleDetails((prev: Record<number, ArticleItem>) => ({ ...prev, [artId]: full }));
        }
      } catch (e) {
        console.warn('Gagal mengambil dokumen artikel:', e);
      } finally {
        setLoadingSearchArticleDoc(null);
      }
    }
  };

  // Toggle browser Fullscreen mode with robust cross-browser API & fallback
  const toggleFullscreen = useCallback(() => {
    try {
      const doc = document as any;
      const docEl = document.documentElement as any;
      const container = viewerContainerRef.current as any;

      const isFs = !!(
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isFs) {
        if (container?.requestFullscreen) {
          container.requestFullscreen().catch(() => {
            if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
          });
        } else if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        } else if (container?.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (container?.mozRequestFullScreen) {
          container.mozRequestFullScreen();
        } else if (docEl.mozRequestFullScreen) {
          docEl.mozRequestFullScreen();
        } else if (container?.msRequestFullscreen) {
          container.msRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen toggle error:', e);
    }
  }, []);

  // Sync fullscreen state across all vendor events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement
        )
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Update dynamic watermark timestamp every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleString('id-ID'));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // 1. Anti-Snipping Tool / Screen Blur when window loses focus (onBlur / Alt-Tab / Win+Shift+S)
  useEffect(() => {
    const handleBlur = () => {
      setIsWindowFocused(false);
    };

    const handleFocus = () => {
      setIsWindowFocused(true);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
      } else {
        setIsWindowFocused(true);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 2. Block PrintScreen, Snipping Shortcuts, DevTools, Ctrl+P, Ctrl+S & Clear Clipboard
  useEffect(() => {
    const triggerProtection = (msg: string, violationAction: string = 'SECURITY_VIOLATION') => {
      // Clear clipboard to neutralize potential screen grabs
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Perpustakaan UMS — Perlindungan Hak Cipta Naskah Unpublish.');
        }
      } catch {}

      // Send live incident telemetry to backend for Librarian Live Alert
      api.reportSecurityIncident({
        action: violationAction,
        articleId,
        docId,
        articleTitle,
      }).catch(() => {});

      // Temporarily blank/blur screen
      setIsWindowFocused(false);
      setScreenshotWarning(msg);

      setTimeout(() => {
        setIsWindowFocused(true);
      }, 1800);

      setTimeout(() => {
        setScreenshotWarning(null);
      }, 5000);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Tombol PrintScreen terdeteksi! Tangkapan layar dinonaktifkan demi perlindungan hak cipta.', 'PRINTSCREEN_ATTEMPT');
        return;
      }

      // Windows Snipping Tool (Win + Shift + S) or Mac (Cmd + Shift + 4 / 3 / 5)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5')) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Pintasan perekaman / tangkapan layar dinonaktifkan.', 'SNIPPING_TOOL_ATTEMPT');
        return;
      }

      // Ctrl+P (Print), Ctrl+S (Save), Ctrl+U (Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Fitur pencetakan & pengunduhan dinonaktifkan.', 'PRINT_OR_SAVE_ATTEMPT');
        return;
      }

      // F11: Toggle Fullscreen Mode
      if (e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
        return;
      }

      // DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (
        e.key === 'F12' ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Pemeriksaan elemen (DevTools) dinonaktifkan.', 'DEVTOOLS_INSPECT_ATTEMPT');
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        triggerProtection('Tangkapan layar dinonaktifkan.', 'PRINTSCREEN_ATTEMPT');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [articleId, docId, articleTitle, toggleFullscreen]);

  // Prevent background body scrolling while reader is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
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
      ref={viewerContainerRef}
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
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden', minWidth: 200, flex: 1 }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* View Mode: Single vs Spread (2 Halaman) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 3,
                gap: 3,
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('single')}
                title="Tampilan 1 Halaman Standar"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  backgroundColor: viewMode === 'single' ? '#3b82f6' : 'transparent',
                  color: viewMode === 'single' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <line x1="8" y1="6" x2="16" y2="6" />
                  <line x1="8" y1="10" x2="16" y2="10" />
                </svg>
                <span>1 Halaman</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('spread')}
                title="Tampilan 2 Halaman Berdampingan (Mode Buku / Layar Lebar)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  backgroundColor: viewMode === 'spread' ? '#3b82f6' : 'transparent',
                  color: viewMode === 'spread' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span>2 Halaman (Buku)</span>
              </button>
            </div>

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
                onClick={() => setZoom((z: number) => Math.max(40, z - 15))}
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
                onClick={() => setZoom((z: number) => Math.min(250, z + 15))}
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

            {/* Fullscreen Toggle Button (F11) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Keluar dari Mode Layar Penuh (F11)' : 'Masuk ke Mode Layar Penuh (F11)'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                backgroundColor: isFullscreen ? '#0284c7' : '#1e293b',
                color: '#ffffff',
                border: isFullscreen ? '1px solid #38bdf8' : '1px solid #475569',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              {isFullscreen ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                  <span>Keluar Layar Penuh</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                  <span>Layar Penuh</span>
                </>
              )}
              <span style={{ opacity: 0.65, fontSize: 10.5 }}>(F11)</span>
            </button>

            {/* Close Button */}
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

        {/* Screenshot / Screen Grab Warning Toast */}
        {screenshotWarning && (
          <div
            style={{
              position: 'fixed',
              top: 70,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: 8,
              boxShadow: '0 10px 30px rgba(220, 38, 38, 0.5)',
              zIndex: 10001,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontWeight: 700,
              fontSize: 13.5,
              animation: 'slideDown 0.3s ease-out',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{screenshotWarning}</span>
          </div>
        )}

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
          {viewMode === 'single' ? (
            /* Single Page View */
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
              <iframe
                src={`${mainStreamUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                title="PDF Reader"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                }}
              />

              {/* Dynamic Multi-Line High-Density Watermark Overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gridTemplateRows: 'repeat(5, 1fr)',
                  opacity: 0.22,
                  zIndex: 40,
                  userSelect: 'none',
                  padding: '20px 0',
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        transform: 'rotate(-25deg)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#0f172a',
                        textAlign: 'center',
                        lineHeight: 1.35,
                        border: '1px dashed rgba(15, 23, 42, 0.5)',
                        padding: '6px 14px',
                        borderRadius: 6,
                        backgroundColor: 'rgba(255, 255, 255, 0.55)',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <div style={{ fontSize: '10px', color: '#1e40af', letterSpacing: '0.5px' }}>
                        PERPUSTAKAAN UNIVERSITAS MUHAMMADIYAH SURAKARTA
                      </div>
                      <div style={{ color: '#0f172a', fontWeight: 800 }}>
                        {currentSession?.patron_name || 'PEMUSTAKA RESMI'} (NIM: {currentSession?.patron_nim || 'CIVITAS UMS'})
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#475569' }}>
                        TOKEN: {currentSession?.token_code || 'RESTRICTED'} • {currentTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Two-Page Spread (Buku / Side-by-Side Comparative) View */
            <div
              style={{
                position: 'relative',
                width: `${Math.round(1760 * (zoom / 100))}px`,
                minWidth: '640px',
                maxWidth: 'none',
                minHeight: '100%',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                flexShrink: 0,
                transition: 'width 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {/* Left Spread Pane (Primary Document) */}
              <div
                style={{
                  position: 'relative',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
                  borderRadius: '4px 0 0 4px',
                  overflow: 'hidden',
                  borderRight: '2px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Left Pane Header Banner */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#93c5fd',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #334155',
                    fontSize: 11,
                    fontWeight: 700,
                    zIndex: 30,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <span style={{ backgroundColor: '#1e40af', color: '#fff', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>
                      HALAMAN KIRI (UTAMA)
                    </span>
                    <span style={{ color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {articleTitle}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <iframe
                    src={`${mainStreamUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                    title="PDF Reader - Left Pane"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      display: 'block',
                    }}
                  />
                  {/* Left Watermark */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gridTemplateRows: 'repeat(5, 1fr)',
                      opacity: 0.22,
                      zIndex: 40,
                      userSelect: 'none',
                      padding: '20px 0',
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div
                          style={{
                            transform: 'rotate(-25deg)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0f172a',
                            textAlign: 'center',
                            lineHeight: 1.35,
                            border: '1px dashed rgba(15, 23, 42, 0.5)',
                            padding: '6px 14px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(255, 255, 255, 0.55)',
                          }}
                        >
                          <div style={{ fontSize: '10px', color: '#1e40af' }}>PERPUSTAKAAN UMS</div>
                          <div style={{ color: '#0f172a', fontWeight: 800 }}>
                            {currentSession?.patron_name || 'PEMUSTAKA'} ({currentSession?.patron_nim || 'UMS'})
                          </div>
                          <div style={{ fontSize: '9px', color: '#475569' }}>{currentTime}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Spread Pane (Secondary / Comparative Document) */}
              <div
                style={{
                  position: 'relative',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)',
                  borderRadius: '0 4px 4px 0',
                  overflow: 'hidden',
                  borderLeft: '2px solid #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Right Pane Header Banner with Document Switcher Button */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#93c5fd',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #334155',
                    fontSize: 11,
                    fontWeight: 700,
                    zIndex: 30,
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
                    <span style={{ backgroundColor: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>
                      HALAMAN KANAN
                    </span>
                    <span style={{ color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {secondaryDoc ? `${secondaryDoc.filename || secondaryDoc.title}` : articleTitle}
                    </span>
                  </div>

                  {/* Switch PDF Document Button for Right Pane */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setIsDocPickerOpen(true)}
                      title="Pilih dokumen / bab lain untuk dibandingkan berdampingan"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: '1px solid #60a5fa',
                        borderRadius: 5,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span>Pilih PDF Kanan</span>
                      {currentArticleDetail?.documents && currentArticleDetail.documents.length > 1 && (
                        <span style={{ backgroundColor: '#1d4ed8', padding: '0 4px', borderRadius: 3, fontSize: 9.5 }}>
                          {currentArticleDetail.documents.length} File
                        </span>
                      )}
                    </button>

                    {secondaryDoc && (
                      <button
                        type="button"
                        onClick={() => setSecondaryDoc(null)}
                        title="Kembalikan ke dokumen asal yang sama"
                        style={{
                          backgroundColor: '#334155',
                          color: '#cbd5e1',
                          border: '1px solid #475569',
                          borderRadius: 5,
                          padding: '3px 6px',
                          fontSize: 10.5,
                          cursor: 'pointer',
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <iframe
                    src={`${secondaryStreamUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                    title="PDF Reader - Right Pane"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      display: 'block',
                    }}
                  />
                  {/* Right Watermark */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gridTemplateRows: 'repeat(5, 1fr)',
                      opacity: 0.22,
                      zIndex: 40,
                      userSelect: 'none',
                      padding: '20px 0',
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div
                          style={{
                            transform: 'rotate(-25deg)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0f172a',
                            textAlign: 'center',
                            lineHeight: 1.35,
                            border: '1px dashed rgba(15, 23, 42, 0.5)',
                            padding: '6px 14px',
                            borderRadius: 6,
                            backgroundColor: 'rgba(255, 255, 255, 0.55)',
                          }}
                        >
                          <div style={{ fontSize: '10px', color: '#1e40af' }}>PERPUSTAKAAN UMS</div>
                          <div style={{ color: '#0f172a', fontWeight: 800 }}>
                            {currentSession?.patron_name || 'PEMUSTAKA'} ({currentSession?.patron_nim || 'UMS'})
                          </div>
                          <div style={{ fontSize: '9px', color: '#475569' }}>{currentTime}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Document Picker Modal for Dual Reading (Mode 2 Halaman) */}
          {isDocPickerOpen && (
            <div
              className="modal-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 10002,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setIsDocPickerOpen(false)}
            >
              <div
                className="modal-content"
                style={{
                  width: '100%',
                  maxWidth: 680,
                  maxHeight: '85vh',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  color: '#ffffff',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                        Pilih PDF Halaman Kanan (Mode 2 Halaman)
                      </h4>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                        Bandingkan bab atau naskah lain secara berdampingan
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDocPickerOpen(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: 18,
                      cursor: 'pointer',
                      padding: 4,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Navigation Tabs inside Picker */}
                <div
                  style={{
                    display: 'flex',
                    borderBottom: '1px solid #334155',
                    backgroundColor: '#1e293b',
                    padding: '0 16px',
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDocPickerTab('article_docs')}
                    style={{
                      padding: '10px 14px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: docPickerTab === 'article_docs' ? '2px solid #38bdf8' : '2px solid transparent',
                      color: docPickerTab === 'article_docs' ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Dokumen Naskah Ini ({currentArticleDetail?.documents?.length || 1})
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocPickerTab('recent_reads')}
                    style={{
                      padding: '10px 14px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: docPickerTab === 'recent_reads' ? '2px solid #38bdf8' : '2px solid transparent',
                      color: docPickerTab === 'recent_reads' ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Riwayat Baca Terakhir ({recentReadsList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setDocPickerTab('catalog_search')}
                    style={{
                      padding: '10px 14px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: docPickerTab === 'catalog_search' ? '2px solid #38bdf8' : '2px solid transparent',
                      color: docPickerTab === 'catalog_search' ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Cari Naskah Lain
                  </button>
                </div>

                {/* Tab Contents */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                  {/* Tab 1: Current Article Documents */}
                  {docPickerTab === 'article_docs' && (
                    <div>
                      {loadingArticleDetail ? (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>
                          Memuat daftar berkas dokumen naskah...
                        </div>
                      ) : currentArticleDetail?.documents && currentArticleDetail.documents.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                            Pilih berkas dari naskah <strong>{articleTitle}</strong>:
                          </div>
                          {currentArticleDetail.documents.map((docItem) => {
                            const isCurrentlyPrimary = docItem.docid === docId;
                            const isCurrentlySecondary = secondaryDoc?.docId === docItem.docid;
                            return (
                              <div
                                key={docItem.docid}
                                onClick={() => {
                                  setSecondaryDoc({
                                    articleId: currentArticleDetail.eprintid,
                                    docId: docItem.docid,
                                    title: currentArticleDetail.title,
                                    filename: docItem.filename || `Dokumen #${docItem.docid}`,
                                  });
                                  setIsDocPickerOpen(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 16px',
                                  backgroundColor: isCurrentlySecondary ? '#1e3a5f' : '#1e293b',
                                  border: isCurrentlySecondary ? '1px solid #38bdf8' : '1px solid #334155',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 6,
                                      backgroundColor: '#dc2626',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 10,
                                      fontWeight: 800,
                                    }}
                                  >
                                    PDF
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#f8fafc' }}>
                                      {docItem.filename || `Berkas Dokumen #${docItem.docid}`}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                      Format: {docItem.format || 'application/pdf'} • Ukuran: {docItem.filesize ? `${Math.round(docItem.filesize / 1024)} KB` : 'PDF'}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {isCurrentlyPrimary && (
                                    <span style={{ fontSize: 10.5, backgroundColor: '#1e40af', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                                      Aktif di Kiri
                                    </span>
                                  )}
                                  {isCurrentlySecondary && (
                                    <span style={{ fontSize: 10.5, backgroundColor: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                                      Aktif di Kanan
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    style={{
                                      backgroundColor: isCurrentlySecondary ? '#38bdf8' : '#334155',
                                      color: isCurrentlySecondary ? '#0f172a' : '#ffffff',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '5px 12px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {isCurrentlySecondary ? 'Terpilih' : 'Pilih'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>
                          Naskah ini hanya memiliki 1 berkas dokumen. Anda dapat memilih dari tab <strong>Riwayat Baca</strong> atau <strong>Cari Naskah Lain</strong> untuk membandingkan antar-naskah.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Recent Reads */}
                  {docPickerTab === 'recent_reads' && (
                    <div>
                      {recentReadsList.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                            Pilih naskah yang baru saja Anda buka untuk dimuat di halaman kanan:
                          </div>
                          {recentReadsList.map((item) => (
                            <div
                              key={item.eprintid}
                              onClick={async () => {
                                try {
                                  const full = await api.getArticle(item.eprintid);
                                  const targetDocId = full.documents?.[0]?.docid || 1;
                                  setSecondaryDoc({
                                    articleId: item.eprintid,
                                    docId: targetDocId,
                                    title: item.title,
                                    filename: full.documents?.[0]?.filename || item.title,
                                  });
                                  setIsDocPickerOpen(false);
                                } catch (e) {
                                  console.warn('Gagal memuat dokumen:', e);
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                backgroundColor: secondaryDoc?.articleId === item.eprintid ? '#1e3a5f' : '#1e293b',
                                border: secondaryDoc?.articleId === item.eprintid ? '1px solid #38bdf8' : '1px solid #334155',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ overflow: 'hidden', paddingRight: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 3 }}>
                                  {item.title}
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                  {item.creators ? `Penulis: ${item.creators}` : ''} {item.year ? `(${item.year})` : ''} • Dibuka: {item.openedAt}
                                </div>
                              </div>

                              <button
                                type="button"
                                style={{
                                  backgroundColor: secondaryDoc?.articleId === item.eprintid ? '#38bdf8' : '#2563eb',
                                  color: secondaryDoc?.articleId === item.eprintid ? '#0f172a' : '#ffffff',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 12px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Muat di Kanan
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>
                          Belum ada riwayat baca dalam sesi ini.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Catalog Live Search */}
                  {docPickerTab === 'catalog_search' && (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <input
                          type="text"
                          value={searchCatalogQuery}
                          onChange={(e) => handleSearchCatalog(e.target.value)}
                          placeholder="Ketik judul naskah, topik, atau penulis..."
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            backgroundColor: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: 8,
                            color: '#ffffff',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>

                      {searchCatalogLoading && (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 12.5 }}>
                          Mencari di katalog...
                        </div>
                      )}

                      {!searchCatalogLoading && searchCatalogResults.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {searchCatalogResults.map((art) => {
                            const isExpanded = expandedSearchArticleId === art.eprintid;
                            const fullDetail = searchArticleDetails[art.eprintid];
                            return (
                              <div
                                key={art.eprintid}
                                style={{
                                  backgroundColor: '#1e293b',
                                  border: '1px solid #334155',
                                  borderRadius: 8,
                                  padding: '10px 14px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>{art.title}</div>
                                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                      {art.creators?.join(', ')} • {art.date_year || ''}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleExpandSearchArticle(art.eprintid)}
                                    style={{
                                      backgroundColor: '#334155',
                                      color: '#93c5fd',
                                      border: '1px solid #475569',
                                      borderRadius: 6,
                                      padding: '4px 10px',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isExpanded ? 'Tutup Berkas' : 'Lihat Berkas PDF'}
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #334155' }}>
                                    {loadingSearchArticleDoc === art.eprintid ? (
                                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Memuat berkas...</div>
                                    ) : fullDetail?.documents && fullDetail.documents.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {fullDetail.documents.map((d) => (
                                          <div
                                            key={d.docid}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              backgroundColor: '#0f172a',
                                              padding: '6px 10px',
                                              borderRadius: 6,
                                            }}
                                          >
                                            <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                                              📄 {d.filename || `Dokumen #${d.docid}`}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSecondaryDoc({
                                                  articleId: art.eprintid,
                                                  docId: d.docid,
                                                  title: art.title,
                                                  filename: d.filename || `Dokumen #${d.docid}`,
                                                });
                                                setIsDocPickerOpen(false);
                                              }}
                                              style={{
                                                backgroundColor: '#2563eb',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: 4,
                                                padding: '3px 8px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Pilih Berkas Ini
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSecondaryDoc({
                                            articleId: art.eprintid,
                                            docId: 1,
                                            title: art.title,
                                            filename: art.title,
                                          });
                                          setIsDocPickerOpen(false);
                                        }}
                                        style={{
                                          backgroundColor: '#2563eb',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: 4,
                                          padding: '4px 10px',
                                          fontSize: 11.5,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Buka Naskah di Kanan
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!searchCatalogLoading && searchCatalogQuery.trim() && searchCatalogResults.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 12.5 }}>
                          Tidak ditemukan naskah dengan kata kunci &quot;{searchCatalogQuery}&quot;.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    padding: '12px 20px',
                    borderTop: '1px solid #334155',
                    backgroundColor: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                    Kedua dokumen dilindungi tanda air dinamis & pemantauan sesi aktif.
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDocPickerOpen(false)}
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Anti-Snipping Tool / Window Unfocused Privacy Curtain */}
          {!isWindowFocused && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backdropFilter: 'blur(35px)',
                backgroundColor: 'rgba(15, 23, 42, 0.94)',
                zIndex: 90,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                textAlign: 'center',
                color: '#ffffff',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '2px solid rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  color: '#f87171',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '1.5px',
                  color: '#f87171',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }}
              >
                Perlindungan Hak Cipta Naskah
              </div>

              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#ffffff',
                  marginBottom: 10,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                Tampilan Dinonaktifkan: Jendela Tidak Aktif
              </h3>

              <p
                style={{
                  maxWidth: 440,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#94a3b8',
                  marginBottom: 24,
                }}
              >
                Untuk mencegah perekaman layar & tangkapan naskah secara tidak sah, tampilan dokumen otomatis disamarkan saat jendela kehilangan fokus.
              </p>

              <button
                type="button"
                onClick={() => setIsWindowFocused(true)}
                className="btn btn-primary"
                style={{ padding: '10px 22px', fontSize: 13, fontWeight: 700 }}
              >
                Klik untuk Melanjutkan Membaca
              </button>
            </div>
          )}
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
          Perpustakaan Universitas Muhammadiyah Surakarta — Seluruh aktivitas membaca naskah tercatat dalam Log Audit institusional (NIM: {currentSession?.patron_nim || 'Guest'} • Token: {currentSession?.token_code || '-'}).
        </div>
      </div>
    </div>,
    document.body
  );
};
