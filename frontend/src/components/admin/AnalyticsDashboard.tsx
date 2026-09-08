import React, { useState, useEffect } from 'react';
import { api, AnalyticsData } from '../../services/api';

interface AnalyticsDashboardProps {
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onShowToast }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAnalytics();
      const analyticsData = (res as any)?.data || res;
      setData(analyticsData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data analitik.');
      if (onShowToast) onShowToast('Gagal memuat data analitik repositori.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
        <div className="spinner-inline" style={{ marginBottom: 12 }} />
        <div>Menghitung analitik & statistik pembacaan naskah repositori...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ color: 'var(--color-danger)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          Gagal Memuat Analitik
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          {error || 'Data statistik tidak tersedia.'}
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={fetchAnalytics}>
          Coba Muat Ulang
        </button>
      </div>
    );
  }

  const {
    kpis = {
      totalTokens: 0,
      activeTokens: 0,
      pendingTokens: 0,
      revokedTokens: 0,
      totalDocumentViews: 0,
      uniquePatrons: 0,
      averageDurationMinutes: 0,
    },
    topArticles = [],
    topPatrons = [],
    facultyDistribution = [],
    hourlyActivity = [],
    tokenStatusBreakdown = { ACTIVE: 0, PENDING: 0, EXPIRED: 0, REVOKED: 0 },
  } = data || {};

  const safeHourlyActivity = Array.isArray(hourlyActivity) ? hourlyActivity : [];
  const safeFacultyDist = Array.isArray(facultyDistribution) ? facultyDistribution : [];
  const safeTopPatrons = Array.isArray(topPatrons) ? topPatrons : [];
  const safeTopArticles = Array.isArray(topArticles) ? topArticles : [];

  // Max calculations for relative chart scaling
  const maxHourlyView = Math.max(...(safeHourlyActivity.length > 0 ? safeHourlyActivity.map((h) => h?.view_count || 0) : [0]), 1);
  const totalFacultyPatrons = safeFacultyDist.reduce((acc, curr) => acc + (curr?.patron_count || 0), 0) || 1;
  const totalTokenBreakdown =
    (tokenStatusBreakdown?.ACTIVE || 0) +
    (tokenStatusBreakdown?.PENDING || 0) +
    (tokenStatusBreakdown?.EXPIRED || 0) +
    (tokenStatusBreakdown?.REVOKED || 0) || 1;

  return (
    <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Bar with Refresh */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
            Statistik & Analitik Pembacaan Repositori
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Data tren pemustaka, jam sibuk pembacaan, dan naskah unpublish paling sering diakses
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchAnalytics}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* 6 Key Performance Indicators (KPI Cards - Editorial Minimalist) */}
      <div className="stat-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Total Akses Naskah</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">{kpis.totalDocumentViews.toLocaleString('id-ID')}</div>
            <div className="admin-metric-subtext">Akumulasi pembacaan berkas PDF</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Pemustaka Terdaftar</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">{kpis.uniquePatrons.toLocaleString('id-ID')}</div>
            <div className="admin-metric-subtext">Jumlah NIM mahasiswa aktif membaca</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Total Diterbitkan</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">{kpis.totalTokens.toLocaleString('id-ID')}</div>
            <div className="admin-metric-subtext">{kpis.activeTokens} sedang aktif membaca</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Rata-rata Durasi</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">
              {kpis.averageDurationMinutes} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)' }}>Menit</span>
            </div>
            <div className="admin-metric-subtext">Waktu izin baca per pemustaka</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Tiket Dicabut</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">{kpis.revokedTokens.toLocaleString('id-ID')}</div>
            <div className="admin-metric-subtext">Sesi dihentikan oleh pustakawan</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Menunggu Klaim</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">{kpis.pendingTokens.toLocaleString('id-ID')}</div>
            <div className="admin-metric-subtext">Belum diaktivasi di perangkat</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 20 }}>
        {/* Peak Reading Hours Chart */}
        <div className="card" style={{ margin: 0 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Distribusi Jam Akses Pemustaka (00:00 - 23:00)
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 18 }}>
            Aktivitas pembacaan naskah berdasarkan jam operasional layanan perpustakaan
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 4,
              height: 160,
              paddingTop: 16,
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: 6,
            }}
          >
            {safeHourlyActivity.map((h) => {
              const heightPercent = Math.max(4, Math.round(((h?.view_count || 0) / maxHourlyView) * 100));
              const isPeak = h?.view_count === maxHourlyView && (h?.view_count || 0) > 0;
              return (
                <div
                  key={h?.hour || Math.random()}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  title={`${h?.label || ''}: ${h?.view_count || 0} kali pembacaan dokumen`}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPercent}%`,
                      backgroundColor: isPeak ? 'var(--color-accent)' : 'var(--color-primary)',
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.3s ease',
                      opacity: (h?.view_count || 0) > 0 ? 0.9 : 0.2,
                    }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--color-text-light)', marginTop: 4 }}>
                    {parseInt(h?.hour || '0', 10) % 3 === 0 ? parseInt(h?.hour || '0', 10) : ''}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
            <span>00:00 (Malam)</span>
            <span>12:00 (Siang)</span>
            <span>23:00 (Malam)</span>
          </div>
        </div>

        {/* Token Status Breakdown Donut/Bars */}
        <div className="card" style={{ margin: 0 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            Status Tiket Pemustaka
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Distribusi peruntukan dan status terkini seluruh token akses
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Aktif Digunakan', count: tokenStatusBreakdown.ACTIVE, color: '#10b981', desc: 'Sesi baca sedang berlangsung' },
              { label: 'Menunggu Login', count: tokenStatusBreakdown.PENDING, color: '#3b82f6', desc: 'Belum dipakai login pemustaka' },
              { label: 'Kedaluwarsa', count: tokenStatusBreakdown.EXPIRED, color: '#94a3b8', desc: 'Durasi waktu tiket telah habis' },
              { label: 'Dicabut Admin', count: tokenStatusBreakdown.REVOKED, color: '#ef4448', desc: 'Tiket dibatalkan oleh petugas' },
            ].map((st) => {
              const pct = Math.round((st.count / totalTokenBreakdown) * 100);
              return (
                <div key={st.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: st.color, display: 'inline-block' }} />
                      {st.label}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                      <strong>{st.count}</strong> ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 6, backgroundColor: 'var(--color-surface-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: st.color, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid 2: Faculty Distribution & Top Patrons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Faculty Breakdown */}
        <div className="card" style={{ margin: 0 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Distribusi Fakultas Pemustaka (Berdasarkan NIM)
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Fakultas yang paling aktif mengakses naskah repositori unpublish
          </p>

          {safeFacultyDist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Belum ada data aktivitas pemustaka yang tercatat.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {safeFacultyDist.map((item) => {
                const percent = Math.round(((item?.patron_count || 0) / totalFacultyPatrons) * 100);
                return (
                  <div key={item?.prefix || Math.random()} style={{ borderBottom: '1px solid var(--color-surface-subtle)', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="brand-logo-badge" style={{ fontSize: 9.5, padding: '1px 5px' }}>
                          NIM {item?.prefix || '-'}
                        </span>
                        <strong>{item?.faculty || 'Umum / Lainnya'}</strong>
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        <strong>{item?.patron_count || 0}</strong> pemustaka ({percent}%) • <strong>{item?.activity_count || 0}</strong> aksi
                      </span>
                    </div>
                    <div style={{ height: 6, backgroundColor: 'var(--color-surface-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top 10 Most Active Patrons */}
        <div className="card" style={{ margin: 0 }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-accent)' }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Top 10 Pemustaka Paling Aktif
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Pemustaka dengan frekuensi pembacaan naskah tertinggi
          </p>

          {safeTopPatrons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Belum ada data pemustaka yang tercatat.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>NIM & Nama Pemustaka</th>
                    <th style={{ textAlign: 'center' }}>Dokumen Dibaca</th>
                    <th style={{ textAlign: 'center' }}>Tiket Digunakan</th>
                  </tr>
                </thead>
                <tbody>
                  {safeTopPatrons.map((p, idx) => (
                    <tr key={p?.patron_nim || idx}>
                      <td style={{ fontWeight: 700, color: idx < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        #{idx + 1}
                      </td>
                      <td>
                        <strong>{p?.patron_name || '-'}</strong>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>NIM: {p?.patron_nim || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {p?.document_views || 0}x
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-primary" style={{ fontSize: 10 }}>
                          {p?.tokens_used || 0} tiket
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top 10 Most Read Unpublish Articles */}
      <div className="card" style={{ margin: 0 }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          Top 10 Naskah Unpublish Paling Sering Dibaca
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18 }}>
          Peringkat naskah karya ilmiah yang paling banyak dibuka & dibaca oleh pemustaka
        </p>

        {safeTopArticles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: 13.5 }}>
            Belum ada log pembacaan naskah yang tercatat di database audit.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 50, textAlign: 'center' }}>Peringkat</th>
                  <th style={{ width: 100 }}>ID Naskah</th>
                  <th>Judul Naskah Ilmiah</th>
                  <th style={{ width: 140, textAlign: 'center' }}>Total Dibaca</th>
                  <th style={{ width: 140, textAlign: 'center' }}>Pembaca Unik</th>
                </tr>
              </thead>
              <tbody>
                {safeTopArticles.map((art, idx) => (
                  <tr key={`${art.eprint_id}-${idx}`}>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--color-surface-subtle)',
                          color: idx < 3 ? '#0f172a' : 'var(--color-text-muted)',
                          fontWeight: 800,
                          fontSize: 11,
                        }}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-unpublish" style={{ fontSize: 11 }}>
                        #{art.eprint_id}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      {art.article_title}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--color-primary)', fontSize: 14 }}>
                      {art.view_count.toLocaleString('id-ID')}x
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                      {art.unique_readers.toLocaleString('id-ID')} mahasiswa
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
