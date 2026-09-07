import React, { useState, useEffect, useCallback } from 'react';
import { api, AuditLogItem } from '../../services/api';
import { PaginationControls } from '../common/PaginationControls';

export const AuditLogTable: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;
  const pageSizeRef = React.useRef(pageSize);
  pageSizeRef.current = pageSize;

  const fetchLogs = useCallback(
    async (targetPage?: number, targetPageSize?: number, isSilent = false) => {
      const pageToFetch = targetPage !== undefined ? targetPage : currentPageRef.current;
      const sizeToFetch = targetPageSize !== undefined ? targetPageSize : pageSizeRef.current;

      if (!isSilent) setLoading(true);
      try {
        const res = await api.getAuditLogs({
          search: search.trim() || undefined,
          action: actionFilter !== 'ALL' ? actionFilter : undefined,
          page: pageToFetch,
          limit: sizeToFetch,
        });
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setCurrentPage(res.page || pageToFetch);
        currentPageRef.current = res.page || pageToFetch;
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [search, actionFilter]
  );

  // Debounced search & filter refresh (resets to page 1 on filter/search change)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs(1, pageSize);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, actionFilter, pageSize]);

  // Periodic silent auto-reload (every 10 seconds) preserving active page
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(currentPageRef.current, pageSizeRef.current, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || loading) return;
    setCurrentPage(newPage);
    currentPageRef.current = newPage;
    fetchLogs(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    pageSizeRef.current = newSize;
    fetchLogs(1, newSize);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1, pageSize);
  };

  const formatAction = (action: string) => {
    switch (action) {
      case 'VIEW_PDF':
        return <span className="badge badge-unpublish">BACA FULLTEXT PDF</span>;
      case 'VIEW_METADATA':
        return <span className="badge badge-active">LIHAT DETAIL</span>;
      case 'ACTIVATE_TOKEN':
        return <span className="badge badge-publish">AKTIVASI TOKEN</span>;
      case 'SEARCH':
        return <span className="badge badge-pending">PENCARIAN</span>;
      default:
        return <span className="badge">{action}</span>;
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('id-ID', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });
    } catch {
      return isoStr;
    }
  };

  const exportUrl = api.getAuditExportUrl({
    search: search.trim() || undefined,
    action: actionFilter !== 'ALL' ? actionFilter : undefined,
  });

  return (
    <div>
      {/* Search & Action Filter Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 280 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              id="audit-log-search-input"
              name="audit_search"
              type="text"
              className="form-input"
              placeholder="Cari berdasarkan NIM, Nama Pemustaka, atau Judul Artikel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              style={{ width: '100%', paddingRight: search ? 30 : 12 }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
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
            )}
          </div>
          <button type="submit" className="btn btn-secondary" disabled={loading}>
            Cari
          </button>
        </form>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            id="audit-log-action-select"
            name="audit_action_filter"
            className="form-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ width: 170 }}
          >
            <option value="ALL">Semua Aktivitas</option>
            <option value="VIEW_PDF">Baca PDF Saja</option>
            <option value="VIEW_METADATA">Lihat Metadata</option>
            <option value="ACTIVATE_TOKEN">Aktivasi Sesi</option>
            <option value="SEARCH">Pencarian</option>
          </select>

          <a
            href={exportUrl}
            className="btn btn-secondary btn-sm"
            download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', textDecoration: 'none' }}
            title="Unduh catatan aktivitas pemustaka format CSV"
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
            onClick={() => fetchLogs()}
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
            <span>{loading ? 'Memuat...' : 'Segarkan'}</span>
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
        itemLabel="aktivitas"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />

      {/* Main Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Waktu Akses</th>
              <th>NIM</th>
              <th>Nama Pemustaka</th>
              <th>Jenis Aktivitas</th>
              <th>Artikel Yang Diakses</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>
                  <div className="spinner-inline" style={{ marginBottom: 8 }} />
                  <div>Memuat data log audit...</div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--color-text-muted)' }}>
                  Tidak ada catatan aktivitas yang cocok.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{log.patron_nim}</span>
                  </td>
                  <td>{log.patron_name}</td>
                  <td>{formatAction(log.action)}</td>
                  <td>
                    {log.article_title ? (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{log.article_title}</div>
                        {log.eprint_id && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                            ID EPrint: #{log.eprint_id}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-light)' }}>-</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {log.ip_address}
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
        itemLabel="aktivitas"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />
    </div>
  );
};
