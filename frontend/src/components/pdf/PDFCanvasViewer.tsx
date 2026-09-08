import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { api, PatronSession, ArticleItem } from '../../services/api';

// Set up PDF.js worker via reliable CDN matching the installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

interface PDFCanvasViewerProps {
  articleId: number;
  docId: number;
  articleTitle: string;
  session: PatronSession | null;
  onClose: () => void;
}

interface DocumentInfo {
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

  // Primary Document (Left Pane / Single Mode)
  const [primaryDoc, setPrimaryDoc] = useState<DocumentInfo>({
    articleId,
    docId,
    title: articleTitle,
  });

  // Secondary Document (Right Pane in Spread Mode)
  const [secondaryDoc, setSecondaryDoc] = useState<DocumentInfo | null>(null);

  // Document Picker Modal State
  const [isDocPickerOpen, setIsDocPickerOpen] = useState<boolean>(false);
  const [docPickerTarget, setDocPickerTarget] = useState<'left' | 'right'>('right');
  const [docPickerTab, setDocPickerTab] = useState<'article_docs' | 'recent_reads' | 'catalog_search'>('article_docs');

  // PDF.js State for Primary Document
  const [primaryPdfDoc, setPrimaryPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [primaryNumPages, setPrimaryNumPages] = useState<number>(0);
  const [primaryCurrentPage, setPrimaryCurrentPage] = useState<number>(1);
  const [primaryLoading, setPrimaryLoading] = useState<boolean>(true);
  const [primaryError, setPrimaryError] = useState<string | null>(null);

  // PDF.js State for Secondary Document (Spread / Dual View)
  const [secondaryPdfDoc, setSecondaryPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [secondaryNumPages, setSecondaryNumPages] = useState<number>(0);
  const [secondaryCurrentPage, setSecondaryCurrentPage] = useState<number>(1);
  const [secondaryLoading, setSecondaryLoading] = useState<boolean>(false);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);

  // Current article details (to list all documents attached to this article)
  const [currentArticleDetail, setCurrentArticleDetail] = useState<ArticleItem | null>(null);
  const [loadingArticleDetail, setLoadingArticleDetail] = useState<boolean>(false);

  // Catalog search state inside Document Picker
  const [searchCatalogQuery, setSearchCatalogQuery] = useState<string>('');
  const [searchCatalogResults, setSearchCatalogResults] = useState<ArticleItem[]>([]);
  const [searchCatalogLoading, setSearchCatalogLoading] = useState<boolean>(false);
  const [expandedSearchArticleId, setExpandedSearchArticleId] = useState<number | null>(null);
  const [searchArticleDetails, setSearchArticleDetails] = useState<Record<number, ArticleItem>>({});
  const [loadingSearchArticleDoc, setLoadingSearchArticleDoc] = useState<number | null>(null);

  // Recent reads from session storage
  const [recentReadsList, setRecentReadsList] = useState<any[]>([]);

  // Canvas Refs
  const primaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const focusCooldownRef = useRef<boolean>(false);

  const handleResumeFocus = useCallback(() => {
    focusCooldownRef.current = true;
    setIsWindowFocused(true);
    window.focus();
    setTimeout(() => {
      focusCooldownRef.current = false;
    }, 450);
  }, []);

  let currentSession = session;
  if (!currentSession) {
    try {
      const saved = localStorage.getItem('ums_patron_session');
      if (saved) currentSession = JSON.parse(saved);
    } catch { }
  }

  const effectiveTokenId = currentSession?.id || localStorage.getItem('ums_patron_token_id') || undefined;
  const primaryStreamUrl = api.getDocumentStreamUrl(primaryDoc.articleId, primaryDoc.docId, effectiveTokenId);
  const secondaryStreamUrl = secondaryDoc
    ? api.getDocumentStreamUrl(secondaryDoc.articleId, secondaryDoc.docId, effectiveTokenId)
    : primaryStreamUrl;

  // 1. Fetch current article details (to list other documents in this article)
  useEffect(() => {
    let isMounted = true;
    setLoadingArticleDetail(true);
    api
      .getArticle(articleId)
      .then((art) => {
        if (isMounted && art) {
          setCurrentArticleDetail(art);
          if (art.documents && art.documents.length > 1) {
            const otherDoc = art.documents.find((d) => d.docid !== docId);
            if (otherDoc) {
              setSecondaryDoc((prev: DocumentInfo | null) =>
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

  // 2. Load Primary Document using PDF.js
  useEffect(() => {
    let isCancelled = false;
    setPrimaryLoading(true);
    setPrimaryError(null);
    setPrimaryPdfDoc(null);

    const loadingTask = pdfjsLib.getDocument({
      url: primaryStreamUrl,
      withCredentials: true,
    });

    loadingTask.promise
      .then((pdf) => {
        if (!isCancelled) {
          setPrimaryPdfDoc(pdf);
          setPrimaryNumPages(pdf.numPages);
          setPrimaryCurrentPage(1);
          setPrimaryLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Gagal memuat PDF Utama via PDF.js:', err);
          setPrimaryError('Gagal memuat render PDF utama.');
          setPrimaryLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      try {
        loadingTask.destroy();
      } catch { }
    };
  }, [primaryStreamUrl]);

  // 3. Load Secondary Document using PDF.js when in spread mode
  useEffect(() => {
    if (viewMode !== 'spread') return;
    let isCancelled = false;
    setSecondaryLoading(true);
    setSecondaryError(null);
    setSecondaryPdfDoc(null);

    const loadingTask = pdfjsLib.getDocument({
      url: secondaryStreamUrl,
      withCredentials: true,
    });

    loadingTask.promise
      .then((pdf) => {
        if (!isCancelled) {
          setSecondaryPdfDoc(pdf);
          setSecondaryNumPages(pdf.numPages);
          setSecondaryCurrentPage(1);
          setSecondaryLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('Gagal memuat PDF Kedua via PDF.js:', err);
          setSecondaryError('Gagal memuat render PDF kedua.');
          setSecondaryLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      try {
        loadingTask.destroy();
      } catch { }
    };
  }, [secondaryStreamUrl, viewMode]);

  // 4. Render Primary Page onto Canvas
  useEffect(() => {
    if (!primaryPdfDoc || !primaryCanvasRef.current || (primaryPdfDoc as any)._transport === null) return;
    let isCancelled = false;
    let renderTask: any = null;

    try {
      primaryPdfDoc.getPage(primaryCurrentPage)
        .then((page) => {
          if (isCancelled || !primaryCanvasRef.current) return;

          const canvas = primaryCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const dpr = window.devicePixelRatio || 1.5;
          const scaleMultiplier = viewMode === 'spread' ? 1.05 : 1.35;
          const baseScale = (zoom / 100) * scaleMultiplier;
          const viewport = page.getViewport({ scale: baseScale * dpr });

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
          canvas.style.height = `${Math.round(viewport.height / dpr)}px`;

          const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
          };

          renderTask = page.render(renderContext);
          renderTask.promise.catch(() => { });
        })
        .catch((e) => {
          console.warn('Gagal render halaman utama:', e);
        });
    } catch (e) {
      console.warn('Error getPage utama:', e);
    }

    return () => {
      isCancelled = true;
      if (renderTask && renderTask.cancel) {
        try {
          renderTask.cancel();
        } catch { }
      }
    };
  }, [primaryPdfDoc, primaryCurrentPage, zoom, viewMode]);

  // 5. Render Secondary Page onto Canvas
  useEffect(() => {
    if (viewMode !== 'spread' || !secondaryPdfDoc || !secondaryCanvasRef.current || (secondaryPdfDoc as any)._transport === null) return;
    let isCancelled = false;
    let renderTask: any = null;

    try {
      secondaryPdfDoc.getPage(secondaryCurrentPage)
        .then((page) => {
          if (isCancelled || !secondaryCanvasRef.current) return;

          const canvas = secondaryCanvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const dpr = window.devicePixelRatio || 1.5;
          const baseScale = (zoom / 100) * 1.05;
          const viewport = page.getViewport({ scale: baseScale * dpr });

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
          canvas.style.height = `${Math.round(viewport.height / dpr)}px`;

          const renderContext = {
            canvasContext: ctx,
            viewport: viewport,
          };

          renderTask = page.render(renderContext);
          renderTask.promise.catch(() => { });
        })
        .catch((e) => {
          console.warn('Gagal render halaman kedua:', e);
        });
    } catch (e) {
      console.warn('Error getPage kedua:', e);
    }

    return () => {
      isCancelled = true;
      if (renderTask && renderTask.cancel) {
        try {
          renderTask.cancel();
        } catch { }
      }
    };
  }, [secondaryPdfDoc, secondaryCurrentPage, zoom, viewMode]);

  // 6. Load recent reads from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ums_patron_recent_reads');
      if (raw) {
        setRecentReadsList(JSON.parse(raw));
      }
    } catch { }
  }, [isDocPickerOpen]);

  // Search catalog handler for picker
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

  // Helper to apply picked document to the active target pane (left or right)
  const applyPickedDocument = (docItem: DocumentInfo) => {
    if (docPickerTarget === 'left') {
      setPrimaryDoc(docItem);
    } else {
      setSecondaryDoc(docItem);
    }
    setIsDocPickerOpen(false);
  };

  // Toggle browser Fullscreen mode with robust cross-browser API
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
            if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => { });
          });
        } else if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => { });
        } else if (container?.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => { });
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
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

  // Continuous Clipboard Sanitization
  const sanitizeClipboard = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(
          'DOKUMEN INI DILINDUNGI HAK CIPTA UPT PERPUSTAKAAN DAN LAYANAN DIGITAL UNIVERSITAS MUHAMMADIYAH SURAKARTA.\n' +
          'Perekaman dan tangkapan layar dinonaktifkan demi perlindungan hak orisinalitas riset civitas akademik.'
        ).catch(() => { });
      }
    } catch { }
  }, []);

  // 7. Multi-Layer Anti-Screenshot & Screen Capture Protection
  useEffect(() => {
    const triggerProtection = (msg: string, violationAction: string = 'SECURITY_VIOLATION') => {
      // Blank/blur screen immediately
      setIsWindowFocused(false);
      setScreenshotWarning(msg);

      // Overwrite clipboard
      sanitizeClipboard();

      // Send live incident telemetry to backend
      api.reportSecurityIncident({
        action: violationAction,
        articleId: primaryDoc.articleId,
        docId: primaryDoc.docId,
        articleTitle: primaryDoc.title,
      }).catch(() => { });

      setTimeout(() => {
        setScreenshotWarning(null);
      }, 5000);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key (standard, code, keyCode 44, Snapshot)
      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.key === 'Snapshot' ||
        e.keyCode === 44 ||
        e.which === 44
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Tombol PrintScreen terdeteksi! Tangkapan layar dinonaktifkan demi perlindungan hak cipta.', 'PRINTSCREEN_ATTEMPT');
        return;
      }

      // Windows Snipping Tool (Win + Shift + S), Mac (Cmd + Shift + 3/4/5), Browser (Ctrl + Shift + S)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4' || e.key === '5')) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Pintasan tangkapan layar dinonaktifkan.', 'SNIPPING_TOOL_ATTEMPT');
        return;
      }

      // Ctrl+C (Copy), Ctrl+X (Cut), Ctrl+A (Select All)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X' || e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Penyalinan & seleksi naskah dinonaktifkan.', 'COPY_ATTEMPT');
        return;
      }

      // Ctrl+P (Print), Ctrl+S (Save), Ctrl+U (Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Pencetakan & pengunduhan dinonaktifkan.', 'PRINT_OR_SAVE_ATTEMPT');
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
      if (
        e.key === 'PrintScreen' ||
        e.code === 'PrintScreen' ||
        e.key === 'Snapshot' ||
        e.keyCode === 44 ||
        e.which === 44
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerProtection('Tombol PrintScreen terdeteksi! Tangkapan layar dinonaktifkan.', 'PRINTSCREEN_ATTEMPT');
      }
    };

    const handleCopyCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sanitizeClipboard();
      triggerProtection('Penyalinan teks dokumen dinonaktifkan.', 'COPY_ATTEMPT');
    };

    const handlePreventContextAndSelect = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
      }
    };

    const handleWindowBlur = () => {
      if (focusCooldownRef.current) return;
      // Debounce window blur to prevent false positive when switching UI controls
      setTimeout(() => {
        if (!document.hasFocus() || document.hidden) {
          setIsWindowFocused(false);
        }
      }, 150);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (focusCooldownRef.current) return;
      if (!e.relatedTarget && e.clientY <= 0) {
        setIsWindowFocused(false);
      }
    };

    // Register all capture phase event listeners
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('copy', handleCopyCut, true);
    document.addEventListener('cut', handleCopyCut, true);
    document.addEventListener('contextmenu', handlePreventContextAndSelect, true);
    document.addEventListener('dragstart', handlePreventContextAndSelect, true);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', () => setIsWindowFocused(true));
    window.addEventListener('blur', handleWindowBlur);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('copy', handleCopyCut, true);
      document.removeEventListener('cut', handleCopyCut, true);
      document.removeEventListener('contextmenu', handlePreventContextAndSelect, true);
      document.removeEventListener('dragstart', handlePreventContextAndSelect, true);

      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [primaryDoc, toggleFullscreen, sanitizeClipboard]);

  // Prevent background body scrolling while reader is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return createPortal(
    <div
      ref={viewerContainerRef}
      tabIndex={0}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => {
        e.preventDefault();
        sanitizeClipboard();
      }}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#09090b',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        color: '#f4f4f5',
      }}
    >
      {/* CSS Rules for DRM Privacy & Print Blocker */}
      <style>{`
        @media print {
          body * {
            display: none !important;
            visibility: hidden !important;
          }
          body::after {
            content: "DOKUMEN DILINDUNGI HAK CIPTA UPT PERPUSTAKAAN UMS — PENCETAKAN DINONAKTIFKAN";
            display: block !important;
            font-size: 24pt;
            text-align: center;
            padding-top: 200px;
            color: #000000;
          }
        }
        @keyframes pulseAlert {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        @keyframes slideDownBanner {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #121215;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>

      {/* Top Security Banner & Warning Toast */}
      {screenshotWarning && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10005,
            backgroundColor: '#18181b',
            color: '#f87171',
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 700,
            animation: 'pulseAlert 0.4s ease-in-out',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{screenshotWarning}</span>
        </div>
      )}

      {/* True Dark Mode Control Header Bar */}
      <div
        style={{
          backgroundColor: '#121215',
          borderBottom: '1px solid #27272a',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 50,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Left: Protected View Badge & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden', flex: 1, paddingRight: 16 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.5px',
              color: '#f59e0b',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <span>PROTECTED VIEW</span>
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#f4f4f5',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={primaryDoc.title}
          >
            {primaryDoc.title}
          </span>
        </div>

        {/* Center: Controls (View Mode, Page Navigation, Zoom, Fullscreen) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* View Mode Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: 6,
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('single')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'single' ? '#27272a' : 'transparent',
                color: viewMode === 'single' ? '#ffffff' : '#a1a1aa',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" />
              </svg>
              <span>1 Halaman</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('spread')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: viewMode === 'spread' ? '#27272a' : 'transparent',
                color: viewMode === 'spread' ? '#ffffff' : '#a1a1aa',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>2 Halaman (Buku)</span>
            </button>
          </div>

          {/* Page Navigation Controls for Single Mode */}
          {viewMode === 'single' && primaryNumPages > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: 6,
                padding: '2px 6px',
                gap: 4,
              }}
            >
              <button
                type="button"
                disabled={primaryCurrentPage <= 1}
                onClick={() => setPrimaryCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: primaryCurrentPage <= 1 ? '#52525b' : '#f4f4f5',
                  cursor: primaryCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Halaman Sebelumnya"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <span style={{ fontSize: 12, fontWeight: 700, color: '#f4f4f5', minWidth: 64, textAlign: 'center' }}>
                Hal {primaryCurrentPage} / {primaryNumPages}
              </span>

              <button
                type="button"
                disabled={primaryCurrentPage >= primaryNumPages}
                onClick={() => setPrimaryCurrentPage((p) => Math.min(primaryNumPages, p + 1))}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: primaryCurrentPage >= primaryNumPages ? '#52525b' : '#f4f4f5',
                  cursor: primaryCurrentPage >= primaryNumPages ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Halaman Selanjutnya"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: 6,
              padding: '2px 4px',
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 15))}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#f4f4f5',
                cursor: 'pointer',
                padding: '4px 6px',
                fontSize: 13,
                fontWeight: 700,
              }}
              title="Perkecil (-)"
            >
              −
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f4f4f5', minWidth: 38, textAlign: 'center' }}>
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 15))}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#f4f4f5',
                cursor: 'pointer',
                padding: '4px 6px',
                fontSize: 13,
                fontWeight: 700,
              }}
              title="Perbesar (+)"
            >
              +
            </button>
          </div>

          {/* Fullscreen Mode Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: '#18181b',
              color: '#f4f4f5',
              border: '1px solid #27272a',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Layar Penuh (F11)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            <span>{isFullscreen ? 'Keluar Penuh' : 'Layar Penuh'}</span>
          </button>
        </div>

        {/* Right: Close Reader Button */}
        <div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#18181b',
              color: '#ffffff',
              border: '1px solid #27272a',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.borderColor = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#18181b';
              e.currentTarget.style.borderColor = '#27272a';
            }}
          >
            <span>Tutup Pembaca</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>(Esc)</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: '#09090b',
        }}
      >
        {/* Scrollable Canvas Container */}
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            backgroundColor: '#09090b',
            padding: '24px 16px',
          }}
        >
          {/* Inner Document Canvas Container with DRM Blur & Blanking Filter */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              minHeight: '100%',
              width: '100%',
              filter: !isWindowFocused ? 'blur(36px) saturate(0)' : 'none',
              opacity: !isWindowFocused ? 0.05 : 1,
              pointerEvents: !isWindowFocused ? 'none' : 'auto',
              transition: 'filter 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease',
            }}
          >
            {viewMode === 'single' ? (
              /* Single Page Canvas View */
              <div
                style={{
                  position: 'relative',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 12px 48px rgba(0, 0, 0, 0.75)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  flexShrink: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minWidth: 320,
                  minHeight: 480,
                }}
              >
                {primaryLoading && (
                  <div style={{ padding: '60px 40px', color: '#71717a', textAlign: 'center', fontSize: 13 }}>
                    <div style={{ width: 24, height: 24, border: '2px solid #27272a', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                    Memuat naskah terproteksi...
                  </div>
                )}

                {primaryError ? (
                  /* Fallback Iframe if PDF.js decoding fails */
                  <iframe
                    src={`${primaryStreamUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                    title="PDF Reader Fallback"
                    style={{
                      width: `${Math.round(960 * (zoom / 100))}px`,
                      height: '85vh',
                      border: 'none',
                      display: 'block',
                    }}
                  />
                ) : (
                  /* Primary HTML5 Canvas */
                  <canvas ref={primaryCanvasRef} style={{ display: primaryLoading ? 'none' : 'block' }} />
                )}

                {/* High-Density DRM Legal Watermark Grid */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gridTemplateRows: 'repeat(5, 1fr)',
                    opacity: 0.28,
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
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0f172a',
                          textAlign: 'center',
                          lineHeight: 1.35,
                          border: '1px dashed rgba(15, 23, 42, 0.6)',
                          padding: '6px 14px',
                          borderRadius: 6,
                          backgroundColor: 'rgba(255, 255, 255, 0.65)',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <div style={{ fontSize: '10px', color: '#1e40af', letterSpacing: '0.5px' }}>
                          UPT PERPUSTAKAAN DAN LAYANAN DIGITAL UNIVERSITAS MUHAMMADIYAH SURAKARTA
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
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 16,
                  flexShrink: 0,
                }}
              >
                {/* Left Spread Pane (Primary Document) */}
                <div
                  style={{
                    position: 'relative',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.75)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Left Pane Header Bar with Doc Switcher & Pagination */}
                  <div
                    style={{
                      backgroundColor: '#121215',
                      color: '#f4f4f5',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #27272a',
                      fontSize: 11,
                      fontWeight: 700,
                      zIndex: 30,
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
                      <span style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#fff', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>
                        HALAMAN KIRI
                      </span>
                      <span style={{ color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {primaryDoc.filename || primaryDoc.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Left Page Number Controls */}
                      {primaryNumPages > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 4, padding: '1px 4px', gap: 2 }}>
                          <button
                            type="button"
                            disabled={primaryCurrentPage <= 1}
                            onClick={() => setPrimaryCurrentPage((p) => Math.max(1, p - 1))}
                            style={{ background: 'transparent', border: 'none', color: primaryCurrentPage <= 1 ? '#52525b' : '#fff', cursor: 'pointer', padding: 2, fontSize: 10 }}
                          >
                            ◀
                          </button>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#f4f4f5', minWidth: 40, textAlign: 'center' }}>
                            {primaryCurrentPage}/{primaryNumPages}
                          </span>
                          <button
                            type="button"
                            disabled={primaryCurrentPage >= primaryNumPages}
                            onClick={() => setPrimaryCurrentPage((p) => Math.min(primaryNumPages, p + 1))}
                            style={{ background: 'transparent', border: 'none', color: primaryCurrentPage >= primaryNumPages ? '#52525b' : '#fff', cursor: 'pointer', padding: 2, fontSize: 10 }}
                          >
                            ▶
                          </button>
                        </div>
                      )}

                      {/* Select PDF for Left Pane */}
                      <button
                        type="button"
                        onClick={() => {
                          setDocPickerTarget('left');
                          setIsDocPickerOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: '#18181b',
                          color: '#ffffff',
                          border: '1px solid #3f3f46',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        <span>Pilih PDF Kiri</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ position: 'relative', minWidth: 320, minHeight: 460, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {primaryLoading && (
                      <div style={{ padding: '40px', color: '#71717a', fontSize: 12 }}>Memuat naskah kiri...</div>
                    )}
                    {primaryError ? (
                      <iframe
                        src={`${primaryStreamUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                        title="PDF Left"
                        style={{ width: '460px', height: '80vh', border: 'none' }}
                      />
                    ) : (
                      <canvas ref={primaryCanvasRef} style={{ display: primaryLoading ? 'none' : 'block' }} />
                    )}

                    {/* Watermark Left */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gridTemplateRows: 'repeat(5, 1fr)',
                        opacity: 0.28,
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
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#0f172a',
                              textAlign: 'center',
                              lineHeight: 1.35,
                              border: '1px dashed rgba(15, 23, 42, 0.6)',
                              padding: '6px 14px',
                              borderRadius: 6,
                              backgroundColor: 'rgba(255, 255, 255, 0.65)',
                            }}
                          >
                            <div style={{ fontSize: '10px', color: '#0f172a' }}>UPT Perpustakaan UMS</div>
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

                {/* Right Spread Pane (Secondary Document) */}
                <div
                  style={{
                    position: 'relative',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.75)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Right Pane Header Bar with Doc Switcher & Pagination */}
                  <div
                    style={{
                      backgroundColor: '#121215',
                      color: '#f4f4f5',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #27272a',
                      fontSize: 11,
                      fontWeight: 700,
                      zIndex: 30,
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
                      <span style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#fff', padding: '1px 6px', borderRadius: 3, fontSize: 10 }}>
                        HALAMAN KANAN
                      </span>
                      <span style={{ color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {secondaryDoc ? `${secondaryDoc.filename || secondaryDoc.title}` : primaryDoc.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Right Page Number Controls */}
                      {secondaryNumPages > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 4, padding: '1px 4px', gap: 2 }}>
                          <button
                            type="button"
                            disabled={secondaryCurrentPage <= 1}
                            onClick={() => setSecondaryCurrentPage((p) => Math.max(1, p - 1))}
                            style={{ background: 'transparent', border: 'none', color: secondaryCurrentPage <= 1 ? '#52525b' : '#fff', cursor: 'pointer', padding: 2, fontSize: 10 }}
                          >
                            ◀
                          </button>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#f4f4f5', minWidth: 40, textAlign: 'center' }}>
                            {secondaryCurrentPage}/{secondaryNumPages}
                          </span>
                          <button
                            type="button"
                            disabled={secondaryCurrentPage >= secondaryNumPages}
                            onClick={() => setSecondaryCurrentPage((p) => Math.min(secondaryNumPages, p + 1))}
                            style={{ background: 'transparent', border: 'none', color: secondaryCurrentPage >= secondaryNumPages ? '#52525b' : '#fff', cursor: 'pointer', padding: 2, fontSize: 10 }}
                          >
                            ▶
                          </button>
                        </div>
                      )}

                      {/* Select PDF for Right Pane */}
                      <button
                        type="button"
                        onClick={() => {
                          setDocPickerTarget('right');
                          setIsDocPickerOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: '#18181b',
                          color: '#ffffff',
                          border: '1px solid #3f3f46',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                        <span>Pilih PDF Kanan</span>
                      </button>

                      {secondaryDoc && (
                        <button
                          type="button"
                          onClick={() => setSecondaryDoc(null)}
                          style={{
                            backgroundColor: '#18181b',
                            color: '#a1a1aa',
                            border: '1px solid #27272a',
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

                  <div style={{ position: 'relative', minWidth: 320, minHeight: 460, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {secondaryLoading && (
                      <div style={{ padding: '40px', color: '#71717a', fontSize: 12 }}>Memuat naskah kanan...</div>
                    )}
                    {secondaryError ? (
                      <iframe
                        src={`${secondaryStreamUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                        title="PDF Right"
                        style={{ width: '460px', height: '80vh', border: 'none' }}
                      />
                    ) : (
                      <canvas ref={secondaryCanvasRef} style={{ display: secondaryLoading ? 'none' : 'block' }} />
                    )}

                    {/* Watermark Right */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        display: 'grid',
                        gridTemplateColumns: '1fr',
                        gridTemplateRows: 'repeat(5, 1fr)',
                        opacity: 0.28,
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
                              fontFamily: 'var(--font-mono, monospace)',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#0f172a',
                              textAlign: 'center',
                              lineHeight: 1.35,
                              border: '1px dashed rgba(15, 23, 42, 0.6)',
                              padding: '6px 14px',
                              borderRadius: 6,
                              backgroundColor: 'rgba(255, 255, 255, 0.65)',
                            }}
                          >
                            <div style={{ fontSize: '10px', color: '#0f172a' }}>UPT Perpustakaan UMS</div>
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
          </div>

          {/* Document Picker Modal (Target Left or Right Pane) */}
          {isDocPickerOpen && (
            <div
              className="modal-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
                  backgroundColor: '#121215',
                  border: '1px solid #27272a',
                  borderRadius: 12,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
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
                    borderBottom: '1px solid #27272a',
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
                        backgroundColor: '#18181b',
                        border: '1px solid #27272a',
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
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f4f4f5' }}>
                        Pilih PDF Halaman {docPickerTarget === 'left' ? 'Kiri' : 'Kanan'}
                      </h4>
                      <p style={{ margin: 0, fontSize: 12, color: '#a1a1aa' }}>
                        Bandingkan bab naskah atau referensi lain secara berdampingan
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDocPickerOpen(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#a1a1aa',
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
                    borderBottom: '1px solid #27272a',
                    backgroundColor: '#18181b',
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
                      borderBottom: docPickerTab === 'article_docs' ? '2px solid #ffffff' : '2px solid transparent',
                      color: docPickerTab === 'article_docs' ? '#ffffff' : '#a1a1aa',
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
                      borderBottom: docPickerTab === 'recent_reads' ? '2px solid #ffffff' : '2px solid transparent',
                      color: docPickerTab === 'recent_reads' ? '#ffffff' : '#a1a1aa',
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
                      borderBottom: docPickerTab === 'catalog_search' ? '2px solid #ffffff' : '2px solid transparent',
                      color: docPickerTab === 'catalog_search' ? '#ffffff' : '#a1a1aa',
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
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#a1a1aa', fontSize: 13 }}>
                          Memuat daftar berkas dokumen naskah...
                        </div>
                      ) : currentArticleDetail?.documents && currentArticleDetail.documents.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>
                            Pilih berkas dari naskah <strong>{articleTitle}</strong>:
                          </div>
                          {currentArticleDetail.documents.map((docItem: any) => {
                            const isSelectedInLeft = primaryDoc.docId === docItem.docid;
                            const isSelectedInRight = secondaryDoc?.docId === docItem.docid;
                            return (
                              <div
                                key={docItem.docid}
                                onClick={() => {
                                  applyPickedDocument({
                                    articleId: currentArticleDetail.eprintid,
                                    docId: docItem.docid,
                                    title: currentArticleDetail.title,
                                    filename: docItem.filename || `Dokumen #${docItem.docid}`,
                                  });
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 16px',
                                  backgroundColor: (docPickerTarget === 'left' ? isSelectedInLeft : isSelectedInRight) ? '#27272a' : '#18181b',
                                  border: (docPickerTarget === 'left' ? isSelectedInLeft : isSelectedInRight) ? '1px solid #52525b' : '1px solid #27272a',
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
                                      backgroundColor: '#27272a',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#ef4444',
                                    }}
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                      <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#f4f4f5' }}>
                                      {docItem.filename || `Berkas Dokumen #${docItem.docid}`}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
                                      Format: {docItem.format || 'application/pdf'} • Ukuran: {docItem.filesize ? `${Math.round(docItem.filesize / 1024)} KB` : 'PDF'}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {isSelectedInLeft && (
                                    <span style={{ fontSize: 10.5, backgroundColor: '#27272a', border: '1px solid #3f3f46', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                                      Aktif di Kiri
                                    </span>
                                  )}
                                  {isSelectedInRight && (
                                    <span style={{ fontSize: 10.5, backgroundColor: '#3f3f46', color: '#fff', padding: '2px 8px', borderRadius: 4 }}>
                                      Aktif di Kanan
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    style={{
                                      backgroundColor: (docPickerTarget === 'left' ? isSelectedInLeft : isSelectedInRight) ? '#ffffff' : '#27272a',
                                      color: (docPickerTarget === 'left' ? isSelectedInLeft : isSelectedInRight) ? '#09090b' : '#ffffff',
                                      border: (docPickerTarget === 'left' ? isSelectedInLeft : isSelectedInRight) ? 'none' : '1px solid #3f3f46',
                                      borderRadius: 6,
                                      padding: '5px 12px',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {(docPickerTarget === 'left' ? isSelectedInLeft : isSelectedInRight) ? 'Terpilih' : `Pilih untuk ${docPickerTarget === 'left' ? 'Kiri' : 'Kanan'}`}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#a1a1aa', fontSize: 13 }}>
                          Naskah ini hanya memiliki 1 berkas dokumen.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Recent Reads */}
                  {docPickerTab === 'recent_reads' && (
                    <div>
                      {recentReadsList.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>
                            Pilih naskah yang baru saja Anda buka untuk dimuat di halaman {docPickerTarget === 'left' ? 'kiri' : 'kanan'}:
                          </div>
                          {recentReadsList.map((item) => (
                            <div
                              key={item.eprintid}
                              onClick={async () => {
                                try {
                                  const full = await api.getArticle(item.eprintid);
                                  const targetDocId = full.documents?.[0]?.docid || 1;
                                  applyPickedDocument({
                                    articleId: item.eprintid,
                                    docId: targetDocId,
                                    title: item.title,
                                    filename: full.documents?.[0]?.filename || item.title,
                                  });
                                } catch (e) {
                                  console.warn('Gagal memuat dokumen:', e);
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                backgroundColor: '#18181b',
                                border: '1px solid #27272a',
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ overflow: 'hidden', paddingRight: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', marginBottom: 3 }}>
                                  {item.title}
                                </div>
                                <div style={{ fontSize: 11, color: '#a1a1aa' }}>
                                  {item.creators ? `Penulis: ${item.creators}` : ''} {item.year ? `(${item.year})` : ''} • Dibuka: {item.openedAt}
                                </div>
                              </div>

                              <button
                                type="button"
                                style={{
                                  backgroundColor: '#27272a',
                                  color: '#ffffff',
                                  border: '1px solid #3f3f46',
                                  borderRadius: 6,
                                  padding: '5px 12px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Muat di {docPickerTarget === 'left' ? 'Kiri' : 'Kanan'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#a1a1aa', fontSize: 13 }}>
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
                            backgroundColor: '#18181b',
                            border: '1px solid #27272a',
                            borderRadius: 8,
                            color: '#ffffff',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>

                      {searchCatalogLoading && (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#a1a1aa', fontSize: 12.5 }}>
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
                                  backgroundColor: '#18181b',
                                  border: '1px solid #27272a',
                                  borderRadius: 8,
                                  padding: '10px 14px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>{art.title}</div>
                                    <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>
                                      {art.creators?.join(', ')} • {art.date_year || ''}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleExpandSearchArticle(art.eprintid)}
                                    style={{
                                      backgroundColor: '#27272a',
                                      color: '#f4f4f5',
                                      border: '1px solid #3f3f46',
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
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #27272a' }}>
                                    {loadingSearchArticleDoc === art.eprintid ? (
                                      <div style={{ fontSize: 12, color: '#a1a1aa' }}>Memuat berkas...</div>
                                    ) : fullDetail?.documents && fullDetail.documents.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {fullDetail.documents.map((d: any) => (
                                          <div
                                            key={d.docid}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              backgroundColor: '#121215',
                                              border: '1px solid #27272a',
                                              padding: '6px 10px',
                                              borderRadius: 6,
                                            }}
                                          >
                                            <span style={{ fontSize: 12, color: '#cbd5e1', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ef4444' }}>
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                              </svg>
                                              <span>{d.filename || `Dokumen #${d.docid}`}</span>
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                applyPickedDocument({
                                                  articleId: art.eprintid,
                                                  docId: d.docid,
                                                  title: art.title,
                                                  filename: d.filename || `Dokumen #${d.docid}`,
                                                });
                                              }}
                                              style={{
                                                backgroundColor: '#27272a',
                                                color: '#fff',
                                                border: '1px solid #3f3f46',
                                                borderRadius: 4,
                                                padding: '3px 8px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Pilih untuk {docPickerTarget === 'left' ? 'Kiri' : 'Kanan'}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          applyPickedDocument({
                                            articleId: art.eprintid,
                                            docId: 1,
                                            title: art.title,
                                            filename: art.title,
                                          });
                                        }}
                                        style={{
                                          backgroundColor: '#27272a',
                                          color: '#fff',
                                          border: '1px solid #3f3f46',
                                          borderRadius: 4,
                                          padding: '4px 10px',
                                          fontSize: 11.5,
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        Buka di {docPickerTarget === 'left' ? 'Kiri' : 'Kanan'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    padding: '12px 20px',
                    borderTop: '1px solid #27272a',
                    backgroundColor: '#121215',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: 11.5, color: '#a1a1aa' }}>
                    Kedua dokumen dilindungi tanda air dinamis & pemantauan sesi aktif.
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDocPickerOpen(false)}
                    style={{
                      backgroundColor: '#18181b',
                      color: '#f4f4f5',
                      border: '1px solid #27272a',
                      borderRadius: 6,
                      padding: '5px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Anti-Snipping Tool / Window Unfocused Privacy Auto-Shield Curtain */}
          {!isWindowFocused && (
            <div
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleResumeFocus();
              }}
              style={{
                position: 'absolute',
                inset: 0,
                backdropFilter: 'blur(40px)',
                backgroundColor: 'rgba(9, 9, 11, 0.96)',
                zIndex: 90,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                textAlign: 'center',
                color: '#ffffff',
                userSelect: 'none',
                cursor: 'pointer',
                animation: 'slideDownBanner 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title="Klik di mana saja untuk mengaktifkan kembali tampilan pembaca naskah"
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '2px solid rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 18,
                  color: '#f87171',
                  boxShadow: '0 0 24px rgba(239, 68, 68, 0.2)',
                }}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>

              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '1.8px',
                  color: '#f87171',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  padding: '3px 10px',
                  borderRadius: 20,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <span>DRM AUTO-SHIELD: TAB TIDAK AKTIF</span>
              </div>

              <h3
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#ffffff',
                  marginBottom: 10,
                  fontFamily: 'var(--font-heading, sans-serif)',
                  letterSpacing: '-0.01em',
                }}
              >
                Tampilan Naskah Otomatis Disamarkan
              </h3>

              <p
                style={{
                  maxWidth: 480,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#a1a1aa',
                  marginBottom: 24,
                }}
              >
                Sistem perlindungan hak cipta repositori UMS mendeteksi tab browser kehilangan fokus. Tampilan naskah otomatis diburamkan (*canvas auto-shield*) untuk mencegah perekaman layar dan tangkapan dokumen tidak berizin.
              </p>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleResumeFocus();
                }}
                style={{
                  padding: '11px 26px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#27272a',
                  color: '#ffffff',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3f3f46';
                  e.currentTarget.style.borderColor = '#52525b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#27272a';
                  e.currentTarget.style.borderColor = '#3f3f46';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Fokus Kembali & Lanjutkan Membaca</span>
              </button>

              <div style={{ marginTop: 14, fontSize: 11.5, color: '#71717a' }}>
                (atau klik di sembarang tempat pada layar ini)
              </div>
            </div>
          )}
        </div>

        {/* Security Notice Footer */}
        <div
          style={{
            backgroundColor: '#121215',
            color: '#a1a1aa',
            fontSize: 11,
            fontFamily: 'var(--font-sans, sans-serif)',
            padding: '6px 20px',
            textAlign: 'center',
            borderTop: '1px solid #27272a',
          }}
        >
          UPT Perpustakaan dan Layanan Digital Universitas Muhammadiyah Surakarta — Seluruh aktivitas membaca naskah tercatat dalam Log Audit institusional (NIM: {currentSession?.patron_nim || 'Guest'} • Token: {currentSession?.token_code || '-'}).
        </div>
      </div>
    </div>,
    document.body
  );
};
