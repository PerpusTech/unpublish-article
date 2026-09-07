import React, { useState, useEffect } from 'react';
import { api, AuditLogItem } from '../../services/api';

export const AuditLogTable: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({
        search: search.trim() || undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
      });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
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

  return (
    <div>
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
          <input
            type="text"
            className="form-input"
            placeholder="Cari berdasarkan NIM, Nama Pemustaka, atau Judul Artikel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={loading}>
            Cari
          </button>
        </form>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
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
            href={api.getAuditExportUrl(search)}
            className="btn btn-primary btn-sm"
            download
            style={{ whiteSpace: 'nowrap' }}
          >
            Unduh Laporan CSV ({total})
          </a>
        </div>
      </div>

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
                  Memuat data log audit...
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
    </div>
  );
};
