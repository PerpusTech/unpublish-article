import React, { useState, useMemo } from 'react';
import { api, TokenAdminItem } from '../../services/api';

interface ActiveSessionsTableProps {
  tokens: TokenAdminItem[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCreate: () => void;
}

export const ActiveSessionsTable: React.FC<ActiveSessionsTableProps> = ({
  tokens,
  loading,
  onRefresh,
  onOpenCreate,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const handleCopyToken = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleExtend = async (id: string, minutes: number) => {
    setActionLoading(id);
    try {
      await api.extendToken(id, minutes);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal memperpanjang sesi.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin mencabut izin akses membaca untuk pemustaka ${name}?`)) {
      return;
    }
    setActionLoading(id);
    try {
      await api.revokeToken(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Gagal mencabut token.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTokens = useMemo(() => {
    return tokens.filter((t) => {
      const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
      if (!matchStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.token_code.toLowerCase().includes(q) ||
        t.patron_name.toLowerCase().includes(q) ||
        t.patron_nim.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    });
  }, [tokens, statusFilter, searchQuery]);

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
              Semua ({tokens.length})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ACTIVE')}
            >
              Sedang Aktif ({tokens.filter((t) => t.status === 'ACTIVE').length})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setStatusFilter('PENDING')}
            >
              Menunggu Klaim ({tokens.filter((t) => t.status === 'PENDING').length})
            </button>
            <button
              type="button"
              className={`pill-btn ${statusFilter === 'EXPIRED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('EXPIRED')}
            >
              Selesai / Expired
            </button>
          </div>

          {/* Inline Quick Search */}
          <div style={{ position: 'relative', width: 220 }}>
            <input
              type="text"
              placeholder="Cari nama / NIM / token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 28px 6px 10px',
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
                  right: 6,
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
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
            <span>{loading ? 'Menyegarkan...' : 'Segarkan Data'}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>+ Terbitkan Token Baru</span>
          </button>
        </div>
      </div>

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
            {filteredTokens.length === 0 ? (
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
              filteredTokens.map((token) => (
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
                            onClick={() => handleExtend(token.id, 30)}
                            disabled={actionLoading === token.id}
                            title="Tambah durasi membaca 30 menit"
                            style={{ fontSize: 11.5, padding: '4px 8px', fontWeight: 700 }}
                          >
                            +30m
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleExtend(token.id, 60)}
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
                          onClick={() => handleRevoke(token.id, token.patron_name)}
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
    </div>
  );
};

