import React, { useState, useEffect, useCallback } from 'react';
import { api, AnalyticsData, AnalyticsPeriodInfo, AnalyticsFilterParams } from '../../services/api';
import { ReadingHeatmapSection } from './ReadingHeatmapSection';
import { AnalyticsReportModal } from './AnalyticsReportModal';

interface AnalyticsDashboardProps {
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onShowToast }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [periodInfo, setPeriodInfo] = useState<AnalyticsPeriodInfo>({
    type: 'monthly',
    label: 'Bulan Ini',
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Filter State
  const now = new Date();
  const [periodType, setPeriodType] = useState<'daily' | 'monthly' | 'yearly' | 'custom' | 'all'>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(now.toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(now.toISOString().slice(0, 10));

  // Current year options (e.g., 2020..currentYear+1)
  const availableYears = Array.from({ length: 8 }, (_, i) => now.getFullYear() - 5 + i).reverse();

  const getActiveFilterParams = useCallback((): AnalyticsFilterParams => {
    if (periodType === 'daily') {
      return { periodType: 'daily', date: selectedDate };
    }
    if (periodType === 'monthly') {
      return { periodType: 'monthly', month: selectedMonth, year: selectedYear };
    }
    if (periodType === 'yearly') {
      return { periodType: 'yearly', year: selectedYear };
    }
    if (periodType === 'custom') {
      return { periodType: 'custom', startDate: customStartDate, endDate: customEndDate };
    }
    return { periodType: 'all' };
  }, [periodType, selectedDate, selectedMonth, selectedYear, customStartDate, customEndDate]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = getActiveFilterParams();
      const res = await api.getAnalytics(params);
      if (res && res.data) {
        setData(res.data);
        if (res.period) {
          setPeriodInfo(res.period);
        }
      } else {
        setData((res as any) || null);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data analitik.');
      if (onShowToast) onShowToast('Gagal memuat data analitik repositori.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [getActiveFilterParams, onShowToast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  const handleDownloadExcel = async () => {
    setExportingExcel(true);
    try {
      const params = getActiveFilterParams();
      const blob = await api.exportAnalyticsExcel(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanLabel = (periodInfo.label || 'Laporan').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Laporan_Penggunaan_EPrints_${cleanLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      if (onShowToast) onShowToast('Laporan Excel berhasil diunduh.', 'success');
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Gagal mengunduh laporan Excel.', 'danger');
    } finally {
      setExportingExcel(false);
    }
  };

  const setQuickToday = () => {
    setPeriodType('daily');
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  const setQuickThisMonth = () => {
    setPeriodType('monthly');
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  const setQuickThisYear = () => {
    setPeriodType('yearly');
    setSelectedYear(now.getFullYear());
  };

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
    dailyTrend = [],
    tokenStatusBreakdown = { ACTIVE: 0, PENDING: 0, EXPIRED: 0, REVOKED: 0 },
  } = data || {};

  const safeHourlyActivity = Array.isArray(hourlyActivity) ? hourlyActivity : [];
  const safeDailyTrend = Array.isArray(dailyTrend) ? dailyTrend : [];
  const safeFacultyDist = Array.isArray(facultyDistribution) ? facultyDistribution : [];
  const safeTopPatrons = Array.isArray(topPatrons) ? topPatrons : [];
  const safeTopArticles = Array.isArray(topArticles) ? topArticles : [];

  const maxTimelineView = Math.max(...(safeDailyTrend.length > 0 ? safeDailyTrend.map((d) => d?.document_views || 0) : [0]), 1);
  const maxHourlyView = Math.max(...(safeHourlyActivity.length > 0 ? safeHourlyActivity.map((h) => h?.view_count || 0) : [0]), 1);
  const totalFacultyPatrons = safeFacultyDist.reduce((acc, curr) => acc + (curr?.patron_count || 0), 0) || 1;
  const totalTokenBreakdown =
    (tokenStatusBreakdown?.ACTIVE || 0) +
    (tokenStatusBreakdown?.PENDING || 0) +
    (tokenStatusBreakdown?.EXPIRED || 0) +
    (tokenStatusBreakdown?.REVOKED || 0) || 1;

  return (
    <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ========================================================================= */}
      {/* PERIOD FILTER & REPORT EXPORT TOOLBAR */}
      {/* ========================================================================= */}
      <div
        className="card"
        style={{
          margin: 0,
          padding: '16px 20px',
          backgroundColor: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          {/* Left: Period Type Tabs */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Filter Periode Laporan:
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${periodType === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriodType('daily')}
                style={{ fontWeight: 700, borderRadius: 20, padding: '4px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Harian</span>
              </button>

              <button
                type="button"
                className={`btn btn-sm ${periodType === 'monthly' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriodType('monthly')}
                style={{ fontWeight: 700, borderRadius: 20, padding: '4px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="8" y1="14" x2="8.01" y2="14" />
                  <line x1="12" y1="14" x2="12.01" y2="14" />
                  <line x1="16" y1="14" x2="16.01" y2="14" />
                  <line x1="8" y1="18" x2="8.01" y2="18" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                <span>Bulanan</span>
              </button>

              <button
                type="button"
                className={`btn btn-sm ${periodType === 'yearly' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriodType('yearly')}
                style={{ fontWeight: 700, borderRadius: 20, padding: '4px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Tahunan</span>
              </button>

              <button
                type="button"
                className={`btn btn-sm ${periodType === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriodType('custom')}
                style={{ fontWeight: 700, borderRadius: 20, padding: '4px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                <span>Rentang Kustom</span>
              </button>

              <button
                type="button"
                className={`btn btn-sm ${periodType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriodType('all')}
                style={{ fontWeight: 700, borderRadius: 20, padding: '4px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <span>Semua Waktu</span>
              </button>
            </div>
          </div>

          {/* Right: Export & PDF Report Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadExcel}
              disabled={exportingExcel || loading}
              title="Ekspor seluruh data periode ke format Excel (.xlsx) dengan border rapi"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '6px 14px' }}
            >
              {exportingExcel ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              )}
              <span>Ekspor Excel</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsReportModalOpen(true)}
              disabled={loading || !data}
              title="Buka dokumen laporan resmi UMS dan cetak PDF"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '6px 16px', boxShadow: '0 2px 6px rgba(30, 58, 138, 0.25)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Laporan Resmi & Cetak PDF</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchAnalytics}
              disabled={loading}
              title="Segarkan Data"
              style={{ padding: '6px 10px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin-animation' : ''}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dynamic Parameter Selectors corresponding to Period Type */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {periodType === 'daily' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>
                  Pilih Tanggal:
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ width: 160 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={setQuickToday}
                  style={{ fontSize: 11 }}
                >
                  Hari Ini
                </button>
              </div>
            )}

            {periodType === 'monthly' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>
                  Pilih Bulan & Tahun:
                </label>
                <select
                  className="form-select form-select-sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  style={{ width: 145 }}
                >
                  {MONTH_NAMES_ID.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  style={{ width: 100 }}
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={setQuickThisMonth}
                  style={{ fontSize: 11 }}
                >
                  Bulan Ini
                </button>
              </div>
            )}

            {periodType === 'yearly' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>
                  Pilih Tahun:
                </label>
                <select
                  className="form-select form-select-sm"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  style={{ width: 125 }}
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Tahun {yr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={setQuickThisYear}
                  style={{ fontSize: 11 }}
                >
                  Tahun Ini
                </button>
              </div>
            )}

            {periodType === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>
                  Dari:
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{ width: 145 }}
                />
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>
                  Sampai:
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{ width: 145 }}
                />
              </div>
            )}

            {periodType === 'all' && (
              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                Menampilkan seluruh akumulasi data historis sejak awal operasional aplikasi.
              </div>
            )}
          </div>

          {/* Active Period Pill Display */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 16,
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-primary)',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
            <span>{periodInfo.label}</span>
          </div>
        </div>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          <div className="spinner-inline" style={{ marginBottom: 12 }} />
          <div>Menghitung data analitik untuk {periodInfo.label}...</div>
        </div>
      )}

      {error && !data && (
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
      )}

      {data && (
        <>
          {/* 6 Key Performance Indicators (KPI Cards) */}
          <div className="stat-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
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
                <span className="admin-metric-label">Pemustaka Unik</span>
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
                <div className="admin-metric-subtext">NIM mahasiswa aktif membaca</div>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-header-row">
                <span className="admin-metric-label">Token Diterbitkan</span>
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
                <div className="admin-metric-subtext">Waktu izin baca per sesi</div>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-header-row">
                <span className="admin-metric-label">Sesi Dibatalkan</span>
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
                <div className="admin-metric-subtext">Sesi dibatalkan petugas</div>
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-header-row">
                <span className="admin-metric-label">Belum Diaktivasi</span>
                <div className="admin-metric-icon-wrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="admin-metric-number">{kpis.pendingTokens.toLocaleString('id-ID')}</div>
                <div className="admin-metric-subtext">Tiket belum diklaim pemustaka</div>
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
            {/* Timeline Activity Trend */}
            <div className="card" style={{ margin: 0 }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Tren Aktivitas Pembacaan ({periodInfo.label})
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 18 }}>
                Distribusi pembacaan naskah sepanjang periode waktu yang dipilih
              </p>

              {safeDailyTrend.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Belum ada catatan aktivitas pada periode ini.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 6,
                    height: 160,
                    paddingTop: 16,
                    borderBottom: '1px solid var(--color-border)',
                    overflowX: 'auto',
                  }}
                >
                  {safeDailyTrend.map((item, idx) => {
                    const views = item.document_views || 0;
                    const heightPct = Math.max(Math.round((views / maxTimelineView) * 100), views > 0 ? 8 : 2);
                    const label = item.date || item.label || String(idx + 1);
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          minWidth: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                        }}
                        title={`${label}: ${views} kali naskah dibaca (${item.total_events || 0} total aksi)`}
                      >
                        <div
                          style={{
                            width: '100%',
                            maxWidth: 24,
                            height: `${heightPct}%`,
                            backgroundColor: views > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                            borderRadius: '3px 3px 0 0',
                            transition: 'height 0.3s ease',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--color-text-muted)',
                            marginTop: 6,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 32,
                            textAlign: 'center',
                          }}
                        >
                          {label.length > 5 ? label.slice(5) : label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
                Pola jam sibuk pemustaka mengakses naskah dalam periode {periodInfo.label}
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 4,
                  height: 160,
                  paddingTop: 16,
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {safeHourlyActivity.map((item, idx) => {
                  const views = item.view_count || 0;
                  const heightPct = Math.max(Math.round((views / maxHourlyView) * 100), views > 0 ? 8 : 2);
                  const isBusinessHour = idx >= 8 && idx <= 17;
                  return (
                    <div
                      key={item.hour}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                      title={`${item.label}: ${views} kali naskah dibaca (${item.count} total aksi)`}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${heightPct}%`,
                          backgroundColor: views > 0 ? (isBusinessHour ? '#3b82f6' : '#6366f1') : 'var(--color-border)',
                          borderRadius: '3px 3px 0 0',
                          transition: 'height 0.3s ease',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          color: 'var(--color-text-muted)',
                          marginTop: 6,
                          fontWeight: idx % 3 === 0 ? 700 : 400,
                        }}
                      >
                        {idx % 3 === 0 ? item.hour : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section: Faculty Distribution & Most Active Patrons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
            {/* Faculty Distribution */}
            <div className="card" style={{ margin: 0 }}>
              <h3 className="card-title" style={{ fontSize: 15, marginBottom: 4 }}>
                Distribusi Pembaca per Fakultas
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 18 }}>
                Sebaran mahasiswa berdasarkan prefix NIM ({periodInfo.label})
              </p>

              {safeFacultyDist.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Belum ada aktivitas mahasiswa yang tercatat pada periode ini.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {safeFacultyDist.slice(0, 6).map((f) => {
                    const pct = Math.round(((f.patron_count || 0) / totalFacultyPatrons) * 100);
                    return (
                      <div key={f.prefix}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="badge badge-unpublish" style={{ fontSize: 10, padding: '2px 6px' }}>{f.prefix}</span>
                            <span>{f.faculty}</span>
                          </span>
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            {f.patron_count} pemustaka ({pct}%)
                          </span>
                        </div>
                        <div style={{ height: 6, width: '100%', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              backgroundColor: 'var(--color-primary)',
                              borderRadius: 3,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Active Patrons Table */}
            <div className="card" style={{ margin: 0 }}>
              <h3 className="card-title" style={{ fontSize: 15, marginBottom: 4 }}>
                Pemustaka Paling Aktif
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                Mahasiswa/peneliti dengan pembacaan naskah terbanyak ({periodInfo.label})
              </p>

              {safeTopPatrons.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Belum ada data pemustaka pada periode ini.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>NIM</th>
                        <th>Nama Pemustaka</th>
                        <th style={{ textAlign: 'center' }}>Naskah Dibaca</th>
                        <th style={{ textAlign: 'center' }}>Total Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeTopPatrons.slice(0, 6).map((p, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{p.patron_nim}</td>
                          <td style={{ fontWeight: 600 }}>{p.patron_name}</td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--color-primary)' }}>
                            {p.document_views}x
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            {p.total_actions}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Section: Top Read Manuscripts Table */}
          <div className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 className="card-title" style={{ fontSize: 16, margin: 0 }}>
                  10 Naskah Unpublish Paling Sering Dibaca ({periodInfo.label})
                </h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                  Peringkat karya ilmiah yang paling diminati pembaca pada periode terpilih
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadExcel}
                disabled={exportingExcel}
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Unduh laporan lengkap format Excel (.xlsx) dengan border"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Unduh Lengkap (Excel)</span>
              </button>
            </div>

            {safeTopArticles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: 13.5 }}>
                Belum ada log pembacaan naskah yang tercatat di database audit pada periode ini.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
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

          {/* Reading Heatmap & Duration Analytics per Manuscript */}
          <ReadingHeatmapSection onShowToast={onShowToast} />
        </>
      )}

      {/* Official Printable Executive Report Modal */}
      {data && (
        <AnalyticsReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          data={data}
          period={periodInfo}
          onDownloadExcel={handleDownloadExcel}
        />
      )}
    </div>
  );
};
