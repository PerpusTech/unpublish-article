import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, TokenAdminItem } from '../../services/api';
import { PaginationControls } from '../common/PaginationControls';

interface ActiveSessionsTableProps {
  tokens?: TokenAdminItem[];
  loading?: boolean;
  onRefresh?: () => void;
  onOpenCreate: () => void;
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

export const ActiveSessionsTable: React.FC<ActiveSessionsTableProps> = ({
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

  // Row action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string; tokenCode: string } | null>(null);

  const fetchTokensData = useCallback(
    async (targetPage = currentPage, targetPageSize = pageSize) => {
      setLoading(true);
      try {
        const res = await api.listTokens({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
          page: targetPage,
          limit: targetPageSize,
        });

        setTokens(res.tokens || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setCurrentPage(res.page || targetPage);
      } catch (err: any) {
        console.error('Failed to load tokens:', err);
        if (onShowToast) {
          onShowToast(err.message || 'Gagal memuat daftar token.', 'danger');
        }
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, searchQuery, currentPage, pageSize, onShowToast]
  );

  // Re-fetch on filter or search change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTokensData(1, pageSize);
    }, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, searchQuery, pageSize]);

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
    fetchTokensData(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    fetchTokensData(1, newSize);
  };

  const handleCopyToken = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
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
      } else {
        alert(err.message || 'Gagal memperpanjang sesi.');
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
        onShowToast(`Sesi pemustaka ${name} (${tokenCode}) berhasil dicabut.`, 'success');
      }
      fetchTokensData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(err.message || 'Gagal mencabut token.', 'danger');
      } else {
        alert(err.message || 'Gagal mencabut token.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const renderBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="badge badge-publish" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'currentColor',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span>Aktif Membaca</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="badge badge-unpublish" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
            <span>Menunggu Klaim</span>
          </span>
        );
      case 'EXPIRED':
      case 'EXPIRED_UNCLAIMED':
        return <span className="badge badge-expired">Kedaluwarsa</span>;
      case 'REVOKED':
        return <span className="badge badge-revoked">Dicabut</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatRemaining = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return '-';
    if (seconds <= 0) return 'Habis';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}j ${mins}m`;
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
              Kedaluwarsa
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'REVOKED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('REVOKED')}
            >
              Dicabut
            </button>
          </div>

          {/* Inline Quick Search */}
          <div style={{ position: 'relative', width: 240 }}>
            <input
              type="text"
              placeholder="Cari nama / NIM / token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          {/* Export CSV Button */}
          <a
            href={exportUrl}
            className="btn btn-secondary btn-sm"
            download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            title="Unduh data tiket pemustaka format CSV"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Ekspor CSV ({total.toLocaleString('id-ID')})</span>
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

      {/* Top Pagination */}
      <PaginationControls
        position="top"
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={total}
        itemLabel="tiket"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />

      {/* Main Table */}
      <div className="table-wrapper">
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
              tokens.map((token) => (
                <tr key={token.id}>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: 13,
                          color: 'var(--color-primary)',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {token.token_code}
                      </span>
                      <button
                        type="button"
                        className="copy-token-btn"
                        onClick={() => handleCopyToken(token.token_code, token.id)}
                        title="Salin kode token"
                      >
                        {copiedTokenId === token.id ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: 800 }}>✓ Salin</span>
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
                    <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>{token.patron_name}</div>
                    {token.notes && (
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {token.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                      {token.patron_nim}
                    </span>
                  </td>
                  <td>{renderBadge(token.status)}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{token.duration_minutes} Menit</span>
                    {token.extended_minutes > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--color-success)', display: 'block', fontWeight: 600 }}>
                        (+{token.extended_minutes}m diperpanjang)
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: token.status === 'ACTIVE' ? 800 : 500,
                        color: token.status === 'ACTIVE' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      {formatRemaining(token.remaining_seconds)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                      {(token.status === 'ACTIVE' || token.status === 'EXPIRED') && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleExtend(token.id, 30, token.patron_name)}
                            disabled={actionLoading === token.id}
                            title="Tambah durasi membaca 30 menit"
                            style={{ fontSize: 11.5, padding: '4px 8px', fontWeight: 700 }}
                          >
                            +30m
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleExtend(token.id, 60, token.patron_name)}
                            disabled={actionLoading === token.id}
                            title="Tambah durasi membaca 1 jam"
                            style={{ fontSize: 11.5, padding: '4px 8px', fontWeight: 700 }}
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
                          title="Cabut sesi sekarang"
                          style={{
                            fontSize: 11.5,
                            padding: '4px 8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                          <span>Cabut</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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

      {/* In-App Revoke Confirmation Modal */}
      {revokeTarget &&
        createPortal(
          <div
            className="modal-backdrop animated-fade-in"
            onClick={() => setRevokeTarget(null)}
          >
            <div
              className="modal-dialog animated-modal"
              style={{
                maxWidth: 440,
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      color: 'var(--color-danger, #ef4444)',
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
                      Cabut Izin Akses Sesi?
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
                  Tindakan ini akan mengakhiri sesi membaca aktif pemustaka secara permanen pada perangkat yang bersangkutan.
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
                    Kode Tiket: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>{revokeTarget.tokenCode}</span>
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
                    <span>Mencabut...</span>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                      <span>Ya, Cabut Akses</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
