import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, TokenAdminItem } from '../../services/api';
import { PaginationControls } from '../common/PaginationControls';
import { ConfirmModal } from '../common/ConfirmModal';
import { ShareTokenModal } from './ShareTokenModal';
import { ThermalSlipModal, ThermalSlipItem } from './ThermalSlipModal';
import { copyToClipboard } from '../../utils/clipboard';

interface ActiveSessionsTableProps {
  tokens?: TokenAdminItem[];
  loading?: boolean;
  currentAdminRole?: string;
  onRefresh?: () => void;
  onOpenCreate: () => void;
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

export const ActiveSessionsTable: React.FC<ActiveSessionsTableProps> = ({
  currentAdminRole,
  onRefresh,
  onOpenCreate,
  onShowToast,
}) => {
  const [tokens, setTokens] = useState<TokenAdminItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;
  const pageSizeRef = React.useRef(pageSize);
  pageSizeRef.current = pageSize;

  // Row action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string; tokenCode: string } | null>(null);
  const [deleteTargetToken, setDeleteTargetToken] = useState<{ id: string; code: string; patronName: string } | null>(null);

  // Share & Thermal Print states
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [shareTargetToken, setShareTargetToken] = useState<TokenAdminItem | null>(null);
  const [thermalModalOpen, setThermalModalOpen] = useState<boolean>(false);
  const [thermalItems, setThermalItems] = useState<ThermalSlipItem[]>([]);

  const getQrUrl = (tokenCode: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tokenCode)}`;
  };

  const handlePrintSingleThermal = (t: TokenAdminItem) => {
    setThermalItems([{ token: t, qrDataUrl: getQrUrl(t.token_code) }]);
    setThermalModalOpen(true);
  };

  const handlePrintPageThermal = () => {
    const list = Array.isArray(tokens) ? tokens : [];
    if (list.length === 0) return;
    const items: ThermalSlipItem[] = list.map((t: TokenAdminItem) => ({
      token: t,
      qrDataUrl: getQrUrl(t.token_code),
    }));
    setThermalItems(items);
    setThermalModalOpen(true);
  };

  const fetchTokensData = useCallback(
    async (targetPage?: number, targetPageSize?: number, isSilent = false) => {
      const pageToFetch = targetPage !== undefined ? targetPage : currentPageRef.current;
      const sizeToFetch = targetPageSize !== undefined ? targetPageSize : pageSizeRef.current;

      if (!isSilent) setLoading(true);
      try {
        const res = await api.listTokens({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
          page: pageToFetch,
          limit: sizeToFetch,
        });

        setTokens(res.tokens || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setCurrentPage(res.page || pageToFetch);
        currentPageRef.current = res.page || pageToFetch;
      } catch (err: any) {
        console.error('Failed to load tokens:', err);
        if (onShowToast && !isSilent) {
          onShowToast(err.message || 'Gagal memuat daftar token.', 'danger');
        }
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [statusFilter, searchQuery, onShowToast]
  );

  // Re-fetch on filter or search change with debounce (reset to page 1 only when filters/search change)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTokensData(1, pageSize);
    }, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, searchQuery, pageSize]);

  // Periodic silent background auto-reload (every 6 seconds) keeping current active page
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTokensData(currentPageRef.current, pageSizeRef.current, true);
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchTokensData]);

  // Lock body scroll when revoke modal is open
  useEffect(() => {
    if (!revokeTarget) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [revokeTarget]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || loading) return;
    setCurrentPage(newPage);
    currentPageRef.current = newPage;
    fetchTokensData(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    pageSizeRef.current = newSize;
    fetchTokensData(1, newSize);
  };

  const handleCopyToken = async (code: string, id: string) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedTokenId(id);
      setTimeout(() => setCopiedTokenId(null), 2000);
    }
  };

  const handleExtend = async (id: string, minutes: number, patronName: string) => {
    setActionLoading(id);
    try {
      await api.extendToken(id, minutes);
      if (onShowToast) {
        onShowToast(`Waktu membaca ${patronName} berhasil ditambah ${minutes} menit.`, 'success');
      }
      fetchTokensData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(err.message || 'Gagal memperpanjang sesi.', 'danger');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const executeRevoke = async () => {
    if (!revokeTarget) return;
    const { id, name, tokenCode } = revokeTarget;
    setActionLoading(id);
    setRevokeTarget(null);
    try {
      await api.revokeToken(id);
      if (onShowToast) {
        onShowToast(`Sesi pemustaka ${name} (${tokenCode}) berhasil dibatalkan.`, 'success');
      }
      fetchTokensData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(err.message || 'Gagal membatalkan sesi tiket.', 'danger');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDeleteToken = async () => {
    if (!deleteTargetToken) return;
    const { id, code } = deleteTargetToken;

    setActionLoading(id);
    try {
      await api.deleteToken(id);
      if (onShowToast) {
        onShowToast(`Tiket ${code} berhasil dihapus permanen.`, 'success');
      }
      setDeleteTargetToken(null);
      fetchTokensData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(err.message || 'Gagal menghapus tiket.', 'danger');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const isSuperAdmin = currentAdminRole === 'SUPER_ADMIN';

  const renderBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="badge badge-publish" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'currentColor',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span>Aktif</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="badge badge-unpublish" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
            <span>Menunggu</span>
          </span>
        );
      case 'EXPIRED_UNCLAIMED':
        return (
          <span
            className="badge badge-expired"
            style={{ whiteSpace: 'nowrap', backgroundColor: 'rgba(234, 88, 12, 0.12)', color: '#c2410c', borderColor: 'rgba(234, 88, 12, 0.25)' }}
            title="Tiket hangus karena tidak diaktivasi pemustaka dalam batas waktu klaim"
          >
            Hangus
          </span>
        );
      case 'EXPIRED':
        return <span className="badge badge-expired" style={{ whiteSpace: 'nowrap' }}>Berakhir</span>;
      case 'REVOKED':
        return <span className="badge badge-revoked" style={{ whiteSpace: 'nowrap' }}>Dibatalkan</span>;
      default:
        return <span className="badge" style={{ whiteSpace: 'nowrap' }}>{status}</span>;
    }
  };

  const formatRemaining = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return '-';
    if (seconds <= 0) return 'Habis';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}j ${mins}m`;
    }
    return `${mins}m`;
  };

  const exportUrl = api.getTokensExportUrl({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    search: searchQuery.trim() || undefined,
  });

  return (
    <div>
      {/* Table Action Bar & Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div className="filter-pills" style={{ margin: 0 }}>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              Semua
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              Sedang Aktif
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              Menunggu Klaim
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'EXPIRED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('EXPIRED')}
            >
              Berakhir
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'REVOKED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('REVOKED')}
            >
              Dibatalkan
            </button>
          </div>

          {/* Inline Quick Search */}
          <div style={{ position: 'relative', width: 240 }}>
            <input
              id="active-sessions-search-input"
              name="sessions_search"
              type="text"
              placeholder="Cari nama / NIM / token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              style={{
                width: '100%',
                padding: '7px 28px 7px 12px',
                fontSize: 12.5,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            ) : (
              <span
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-light)',
                  pointerEvents: 'none',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Thermal Slip Batch Print Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handlePrintPageThermal}
            disabled={tokens.length === 0 || loading}
            title="Cetak slip termal seluruh tiket di halaman ini"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Slip Termal ({tokens.length})</span>
          </button>

          {/* Export Excel Button */}
          <a
            href={exportUrl}
            className="btn btn-secondary btn-sm"
            download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            title="Unduh data tiket sesi format Excel (.xlsx) dengan border rapi"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Ekspor Excel ({total.toLocaleString('id-ID')})</span>
          </a>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              fetchTokensData();
              if (onRefresh) onRefresh();
            }}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{loading ? 'Menyegarkan...' : 'Segarkan'}</span>
          </button>
        </div>
      </div>

      {/* Sessions Data Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kode Token</th>
              <th>Pemustaka</th>
              <th>NIM / NIP</th>
              <th>Status Sesi</th>
              <th>Durasi Diberikan</th>
              <th>Sisa Waktu</th>
              <th style={{ textAlign: 'right' }}>Aksi Pengelolaan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <div className="spinner-inline" style={{ marginBottom: 8 }} />
                  <div>Memuat data sesi pemustaka...</div>
                </td>
              </tr>
            ) : tokens.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--color-text-light)' }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600 }}>Tidak ada tiket pemustaka yang sesuai kriteria.</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginTop: 4 }}>
                    Gunakan tombol di kanan atas untuk menerbitkan tiket membaca baru.
                  </div>
                </td>
              </tr>
            ) : (
              (Array.isArray(tokens) ? tokens : []).map((token) => {
                const hasIncident = Boolean(token.incident_count && token.incident_count > 0);

                const formatIncidentShort = (tStr?: string) => {
                  if (!tStr) return 'Pelanggaran';
                  if (tStr.includes('PRINTSCREEN')) return 'PrintScreen';
                  if (tStr.includes('SNIPPING')) return 'Snipping';
                  if (tStr.includes('DEVTOOLS')) return 'DevTools';
                  if (tStr.includes('PRINT') || tStr.includes('SAVE')) return 'Cetak/Simpan';
                  if (tStr.includes('COPY')) return 'Copy Teks';
                  return tStr;
                };

                return (
                  <tr key={token.id} className={hasIncident ? 'row-security-violation' : undefined}>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: hasIncident ? '#dc2626' : 'var(--color-primary)',
                            letterSpacing: '0.2px',
                          }}
                        >
                          {token.token_code}
                        </span>
                        <button
                          type="button"
                          className="copy-token-btn"
                          onClick={() => handleCopyToken(token.token_code, token.id)}
                          title="Salin kode token"
                          aria-label="Salin kode token"
                        >
                          {copiedTokenId === token.id ? (
                            <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: 10 }}>✓</span>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{token.patron_name}</div>
                      {hasIncident && (
                        <div style={{ marginTop: 4 }}>
                          <span className="badge-incident-warning" title={`Terakhir terdeteksi: ${token.last_incident_at || 'Baru saja'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span>{token.incident_count}x Insiden ({formatIncidentShort(token.last_incident_type)})</span>
                          </span>
                        </div>
                      )}
                      {token.notes && (
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {token.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: 12.5, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        {token.patron_nim}
                      </span>
                    </td>
                    <td>{renderBadge(token.status)}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{token.duration_minutes}m</span>
                      {token.extended_minutes > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--color-success)', display: 'block', fontWeight: 500 }}>
                          (+{token.extended_minutes}m)
                        </span>
                      )}
                    </td>
                    <td>
                      {token.status === 'ACTIVE' ? (
                        <span
                          style={{
                            fontWeight: 600,
                            color: hasIncident ? '#dc2626' : 'var(--color-primary)',
                            fontSize: 13,
                          }}
                        >
                          {formatRemaining(token.remaining_seconds)}
                        </span>
                      ) : token.status === 'PENDING' ? (
                        <span
                          style={{
                            fontWeight: 600,
                            color: token.claim_remaining_seconds && token.claim_remaining_seconds < 300 ? '#ea580c' : 'var(--color-text)',
                            fontSize: 13,
                          }}
                          title="Batas waktu klaim token"
                        >
                          {formatRemaining(token.claim_remaining_seconds)}
                        </span>
                      ) : token.status === 'EXPIRED_UNCLAIMED' ? (
                        <span style={{ fontSize: 12, color: '#c2410c', fontWeight: 500 }}>
                          Hangus
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                          {formatRemaining(token.remaining_seconds)}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                        {/* Share WhatsApp & Email */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setShareTargetToken(token);
                            setShareModalOpen(true);
                          }}
                          title="Kirim / Bagikan ke WhatsApp & Email Pemustaka"
                          aria-label="Kirim tiket"
                          style={{ padding: '5px 7px', color: '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                          </svg>
                        </button>

                        {/* Print Thermal Slip */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handlePrintSingleThermal(token)}
                          title="Cetak slip tiket ke printer termal POS"
                          aria-label="Cetak slip termal"
                          style={{ padding: '5px 7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                        </button>

                        {(token.status === 'ACTIVE' || token.status === 'EXPIRED') && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleExtend(token.id, 30, token.patron_name)}
                              disabled={actionLoading === token.id}
                              title="Tambah durasi membaca 30 menit"
                              style={{ fontSize: 11, padding: '4px 6px', fontWeight: 600 }}
                            >
                              +30m
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleExtend(token.id, 60, token.patron_name)}
                              disabled={actionLoading === token.id}
                              title="Tambah durasi membaca 1 jam"
                              style={{ fontSize: 11, padding: '4px 6px', fontWeight: 600 }}
                            >
                              +1j
                            </button>
                          </>
                        )}

                        {token.status !== 'REVOKED' && token.status !== 'EXPIRED' && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setRevokeTarget({ id: token.id, name: token.patron_name, tokenCode: token.token_code })}
                            disabled={actionLoading === token.id}
                            title={hasIncident ? 'Peringatan! Sesi ini memiliki pelanggaran. Klik untuk membatalkan izin sekarang.' : 'Batalkan izin sesi'}
                            aria-label="Batalkan izin sesi"
                            style={{
                              padding: '5px 7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: hasIncident ? '#dc2626' : undefined,
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                          </button>
                        )}

                        {/* Super Admin Permanent Delete Button */}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTargetToken({ id: token.id, code: token.token_code, patronName: token.patron_name })}
                            disabled={actionLoading === token.id}
                            title="Hapus permanen data tiket/sesi ini (Khusus Super Admin)"
                            aria-label="Hapus permanen"
                            style={{
                              padding: '5px 7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: 'var(--color-danger)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination */}
      <PaginationControls
        position="bottom"
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={total}
        itemLabel="tiket"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />

      {/* Revoke Modal */}
      {revokeTarget &&
        createPortal(
          <div className="modal-backdrop">
            <div className="modal-card modal-pop-in" style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(220, 38, 38, 0.1)',
                      color: 'var(--color-danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0, fontSize: 16, color: 'var(--color-text)' }}>
                      Batalkan Izin Akses Sesi?
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRevokeTarget(null)}
                  style={{ padding: '4px 8px', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  Tindakan ini akan membatalkan dan mengakhiri sesi membaca aktif pemustaka secara permanen pada perangkat yang bersangkutan.
                </p>

                <div
                  style={{
                    backgroundColor: 'var(--color-surface-subtle)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-border)',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <div>Pemustaka: <strong>{revokeTarget.name}</strong></div>
                  <div style={{ marginTop: 3 }}>
                    Kode Tiket: <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{revokeTarget.tokenCode}</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRevokeTarget(null)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={executeRevoke}
                  disabled={actionLoading === revokeTarget.id}
                  style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {actionLoading === revokeTarget.id ? (
                    <span>Membatalkan...</span>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                      <span>Ya, Batalkan Akses</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Share Modal */}
      <ShareTokenModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        token={shareTargetToken}
        onShowToast={onShowToast}
      />

      {/* Thermal Slip Modal */}
      <ThermalSlipModal
        isOpen={thermalModalOpen}
        onClose={() => setThermalModalOpen(false)}
        items={thermalItems}
      />

      {/* Modern Confirm Deletion Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetToken)}
        title="Hapus Tiket / Sesi Baca"
        message={
          <div>
            Apakah Anda yakin ingin menghapus permanen tiket{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {deleteTargetToken?.code}
            </code>{' '}
            milik <strong>{deleteTargetToken?.patronName}</strong>? Riwayat sesi dan akses membaca pemustaka akan dihapus permanen.
          </div>
        }
        confirmText="Hapus Permanen"
        confirmVariant="danger"
        isLoading={Boolean(actionLoading && deleteTargetToken && actionLoading === deleteTargetToken.id)}
        onConfirm={confirmDeleteToken}
        onClose={() => {
          if (!actionLoading) setDeleteTargetToken(null);
        }}
      />
    </div>
  );
};
