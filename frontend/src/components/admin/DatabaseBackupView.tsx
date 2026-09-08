import React, { useState, useEffect } from 'react';
import { adminApi, DatabaseStats } from '../../services/api';
import { copyToClipboard } from '../../utils/clipboard';

interface DatabaseBackupViewProps {
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

export const DatabaseBackupView: React.FC<DatabaseBackupViewProps> = ({ onShowToast }) => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingDb, setDownloadingDb] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getDatabaseStats();
      if (res.success && res.stats) {
        setStats(res.stats);
      } else {
        onShowToast?.(res.error?.message || 'Gagal memuat informasi database.', 'danger');
      }
    } catch {
      onShowToast?.('Gagal terhubung ke server database.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDownloadBackup = async () => {
    setDownloadingDb(true);
    try {
      await adminApi.downloadDatabaseBackup();
      onShowToast?.('Backup snapshot SQLite (.sqlite) berhasil diunduh.', 'success');
    } catch (err: any) {
      onShowToast?.(err.message || 'Gagal mengunduh file backup SQLite.', 'danger');
    } finally {
      setDownloadingDb(false);
    }
  };

  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      await adminApi.exportDatabaseJson();
      onShowToast?.('Export arsip JSON database berhasil diunduh.', 'success');
    } catch (err: any) {
      onShowToast?.(err.message || 'Gagal mengekspor data JSON.', 'danger');
    } finally {
      setExportingJson(false);
    }
  };

  const handleOptimize = async () => {
    if (!confirm('Jalankan proses VACUUM dan optimasi database SQLite sekarang?')) return;
    setOptimizing(true);
    try {
      const res = await adminApi.optimizeDatabase();
      if (res.success) {
        onShowToast?.(res.message || 'Database berhasil dioptimasi.', 'success');
        await fetchStats();
      } else {
        onShowToast?.(res.error?.message || 'Gagal mengoptimasi database.', 'danger');
      }
    } catch {
      onShowToast?.('Gagal menghubungi server untuk optimasi database.', 'danger');
    } finally {
      setOptimizing(false);
    }
  };

  const handleCopyPath = async () => {
    if (!stats?.databasePath) return;
    const success = await copyToClipboard(stats.databasePath);
    if (success) {
      setCopiedPath(true);
      onShowToast?.('Path database disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedPath(false), 2500);
    }
  };

  return (
    <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner & One-Click Action Center */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: 16,
          padding: '24px 28px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div style={{ maxWidth: 620 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              Backup & Pemeliharaan Database SQLite
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 12,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              HOT SNAPSHOT READY
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            Unduh salinan berkas database lokal (<code>app.db</code>) secara langsung dalam sekali klik tanpa perlu menjalankan perintah CLI atau kueri SQL manual. Snapshot dibuat secara konsisten tanpa menghentikan layanan.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={handleDownloadBackup}
            disabled={downloadingDb || loading}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              padding: '10px 18px',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            {downloadingDb ? (
              <>
                <span className="spinner-border spinner-border-sm" />
                <span>Membuat Snapshot...</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Unduh Backup (.sqlite)</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn"
            onClick={handleExportJson}
            disabled={exportingJson || loading}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontWeight: 600,
              fontSize: 13,
              padding: '10px 16px',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          >
            {exportingJson ? (
              <>
                <span className="spinner-border spinner-border-sm" />
                <span>Mengekspor...</span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Export JSON Dump</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Stats Cards (Editorial Minimalist) */}
      <div className="stat-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Ukuran Berkas DB</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">
              {stats ? stats.sizeFormatted : '...'}
            </div>
            <div className="admin-metric-subtext">SQLite Single File Storage</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Total Record Tabel</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">
              {stats ? stats.totalRecords.toLocaleString('id-ID') : '...'}
            </div>
            <div className="admin-metric-subtext">Akumulasi seluruh tabel lokal</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Integritas & Mode</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
              <span style={{ fontSize: 24 }}>{stats?.integrity === 'OK' || stats?.integrity === 'ok' ? 'OK (Sehat)' : stats?.integrity || 'OK'}</span>
            </div>
            <div className="admin-metric-subtext">Journal: {stats?.journalMode || 'WAL'} (Concurrency High)</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Alokasi Halaman</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M10 4v16" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">
              {stats ? `${stats.pageCount} Hal` : '...'}
            </div>
            <div className="admin-metric-subtext">Ukuran per Halaman: {stats ? `${stats.pageSize} Bytes` : '...'}</div>
          </div>
        </div>
      </div>

      {/* Database Details & Table Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Tables Metadata */}
        <div className="admin-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-main)' }}>
              Rincian Tabel Database Lokal
            </h3>
            <button
              type="button"
              className="btn btn-outline"
              onClick={fetchStats}
              disabled={loading}
              style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Segarkan</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="token-table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Nama Tabel</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>Deskripsi / Fungsi</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px' }}>Jumlah Baris</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>
                    tokens
                  </td>
                  <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>
                    Tiket akses pemustaka, token unik, status, & durasi baca
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {stats?.tables.tokens.toLocaleString('id-ID') ?? '-'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>
                    audit_logs
                  </td>
                  <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>
                    Rekam jejak aktivitas, telemetri pembacaan, & log insiden
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {stats?.tables.audit_logs.toLocaleString('id-ID') ?? '-'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>
                    admin_users
                  </td>
                  <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>
                    Daftar staf pustakawan & hak akses admin terdaftar
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {stats?.tables.admin_users.toLocaleString('id-ID') ?? '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Path Info */}
          <div
            style={{
              marginTop: 20,
              padding: '12px 16px',
              backgroundColor: 'var(--color-bg-alt, #f8fafc)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-light)', display: 'block', textTransform: 'uppercase' }}>
                Lokasi Berkas di Server
              </span>
              <code style={{ fontSize: 12, color: 'var(--color-text-main)', fontFamily: 'monospace' }}>
                {stats?.databasePath || 'Memuat...'}
              </code>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopyPath}
              style={{ fontSize: 12, padding: '5px 10px', flexShrink: 0 }}
            >
              {copiedPath ? 'Tersalin!' : 'Salin Path'}
            </button>
          </div>
        </div>

        {/* Right Column: Maintenance & Recovery Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Optimization Box */}
          <div className="admin-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  color: '#b45309',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-main)' }}>
                Pemeliharaan & Optimasi (VACUUM)
              </h3>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Jalankan perintah defragmentasi internal SQLite untuk membersihkan halaman memori yang tidak terpakai, memperkecil ukuran file di disk, dan mempercepat respons kueri analitik.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleOptimize}
              disabled={optimizing || loading}
              style={{
                width: '100%',
                fontWeight: 600,
                fontSize: 13,
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {optimizing ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  <span>Mengoptimasi Database...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4" />
                    <path d="M12 18v4" />
                    <path d="M4.93 4.93l2.83 2.83" />
                    <path d="M16.24 16.24l2.83 2.83" />
                    <path d="M2 12h4" />
                    <path d="M18 12h4" />
                    <path d="M4.93 19.07l2.83-2.83" />
                    <path d="M16.24 7.76l2.83-2.83" />
                  </svg>
                  <span>Jalankan VACUUM & Defrag Sekarang</span>
                </>
              )}
            </button>
          </div>

          {/* Disaster Recovery Guide Card */}
          <div className="admin-card" style={{ padding: 24, backgroundColor: '#fafbfc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-text-main)' }}>
                Panduan Pemulihan (Disaster Recovery)
              </h4>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <li>Simpan file cadangan <code>.sqlite</code> di media penyimpanan aman secara berkala.</li>
              <li>Untuk memulihkan di server baru / kontainer Docker lain, ganti file <code>backend/data/app.db</code> dengan file backup yang telah diunduh, lalu jalankan restart kontainer backend.</li>
              <li>Data audit log dan tiket lama akan langsung terbaca otomatis tanpa migrasi manual.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
