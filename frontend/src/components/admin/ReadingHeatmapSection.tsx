import React, { useState, useEffect } from 'react';
import {
  getReadingHeatmap,
  getReadingHeatmapSummary,
  ReadingHeatmapData,
  ReadingHeatmapSummaryItem,
  HeatmapPageStat,
} from '../../services/api';

interface ReadingHeatmapSectionProps {
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0 dtk';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}j ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs > 0 ? `${secs}s` : ''}`;
  }
  return `${secs}s`;
};

const getIntensityStyle = (intensity: number) => {
  if (intensity === 0) {
    return {
      bg: 'var(--color-surface-subtle)',
      border: 'var(--color-border)',
      color: 'var(--color-text-muted)',
      barColor: 'var(--color-border)',
    };
  }
  if (intensity < 25) {
    return {
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.3)',
      color: 'var(--color-primary)',
      barColor: '#3b82f6',
    };
  }
  if (intensity < 55) {
    return {
      bg: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.35)',
      color: '#059669',
      barColor: '#10b981',
    };
  }
  if (intensity < 80) {
    return {
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.4)',
      color: '#d97706',
      barColor: '#f59e0b',
    };
  }
  return {
    bg: 'rgba(239, 68, 68, 0.18)',
    border: 'rgba(239, 68, 68, 0.45)',
    color: '#dc2626',
    barColor: '#ef4444',
  };
};

export const ReadingHeatmapSection: React.FC<ReadingHeatmapSectionProps> = ({ onShowToast }) => {
  const [summaryList, setSummaryList] = useState<ReadingHeatmapSummaryItem[]>([]);
  const [overallTotalSeconds, setOverallTotalSeconds] = useState<number>(0);
  const [overallUniqueReaders, setOverallUniqueReaders] = useState<number>(0);
  const [selectedEprintId, setSelectedEprintId] = useState<number | null>(null);
  const [heatmapData, setHeatmapData] = useState<ReadingHeatmapData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);
  const [hoveredPage, setHoveredPage] = useState<HeatmapPageStat | null>(null);
  const [viewMode, setViewMode] = useState<'chart' | 'grid'>('chart');

  // Load summary list of studied manuscripts
  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await getReadingHeatmapSummary();
      setSummaryList(data.manuscripts || []);
      setOverallTotalSeconds(data.overallTotalSeconds || 0);
      setOverallUniqueReaders(data.overallUniqueReaders || 0);

      if (data.manuscripts && data.manuscripts.length > 0 && !selectedEprintId) {
        setSelectedEprintId(data.manuscripts[0].eprint_id);
      }
    } catch (err: any) {
      console.warn('Gagal memuat ringkasan durasi baca:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  // Fetch Heatmap detail when selected manuscript changes
  useEffect(() => {
    if (!selectedEprintId) return;

    let isMounted = true;
    setLoadingHeatmap(true);
    getReadingHeatmap(selectedEprintId)
      .then((data) => {
        if (isMounted) {
          setHeatmapData(data);
          setHoveredPage(null);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          if (onShowToast) onShowToast(err.message || 'Gagal memuat heatmap naskah', 'danger');
        }
      })
      .finally(() => {
        if (isMounted) setLoadingHeatmap(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedEprintId]);

  const maxDuration = Math.max(
    ...(heatmapData?.pages?.map((p) => p.totalDurationSeconds) || [1]),
    1
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      {/* Section Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          backgroundColor: 'var(--color-surface-subtle)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
              Heatmap & Durasi Membaca per Halaman
            </h3>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
              TELEMETRI NASKAH
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
            Analisis waktu nyata halaman dan bab naskah yang paling intensif dipelajari pemustaka
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Micro Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span>
              Total Baca: <strong style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{formatDuration(overallTotalSeconds)}</strong>
            </span>
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <span>
              Pembaca: <strong style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{overallUniqueReaders}</strong>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadSummary}
            disabled={loadingSummary}
            style={{ fontSize: 11.5, padding: '4px 10px', height: 28 }}
          >
            Segarkan
          </button>
        </div>
      </div>

      {summaryList.length === 0 && !loadingSummary ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Belum ada log durasi membaca halaman yang tercatat dari pemustaka.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 440 }}>
          {/* Left Column: Clean Master List */}
          <div
            style={{
              borderRight: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Naskah Terdata</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{summaryList.length}</span>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 520 }}>
              {summaryList.map((item) => {
                const isSelected = selectedEprintId === item.eprint_id;
                return (
                  <div
                    key={item.eprint_id}
                    onClick={() => setSelectedEprintId(item.eprint_id)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        #{item.eprint_id}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>
                        {formatDuration(item.total_duration_seconds)}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: isSelected ? 600 : 500,
                        color: 'var(--color-text)',
                        lineHeight: 1.35,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {item.article_title}
                    </div>

                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                      <span>{item.unique_readers} pembaca</span>
                      <span>·</span>
                      <span>{item.pages_covered} hal</span>
                      <span>·</span>
                      <span>{item.total_events} sesi</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Detailed Heatmap & Histogram */}
          <div style={{ padding: '18px 22px', backgroundColor: 'var(--color-surface)', overflowY: 'auto' }}>
            {loadingHeatmap ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                Memuat data telemetri naskah...
              </div>
            ) : heatmapData ? (
              <div>
                {/* Manuscript Header */}
                <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                      EPRINT #{heatmapData.eprintId}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
                    <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                      {heatmapData.pages.length} Halaman Terdata
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
                    <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                      Total Waktu: <strong style={{ color: 'var(--color-text)' }}>{formatDuration(heatmapData.grandTotalSeconds)}</strong>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>·</span>
                    <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                      {heatmapData.totalUniqueReaders} Pembaca
                    </span>
                  </div>

                  <h4 style={{ fontSize: 15, fontWeight: 700, margin: '2px 0 0', color: 'var(--color-text)', lineHeight: 1.4 }}>
                    {heatmapData.articleTitle}
                  </h4>
                </div>

                {/* View Controls & Intensity Legend */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  {/* View Switcher */}
                  <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--color-surface-subtle)', padding: 2, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('chart')}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        background: viewMode === 'chart' ? 'var(--color-surface)' : 'transparent',
                        color: viewMode === 'chart' ? 'var(--color-text)' : 'var(--color-text-muted)',
                        boxShadow: viewMode === 'chart' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Distribusi Waktu (Grafik)
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: 'none',
                        background: viewMode === 'grid' ? 'var(--color-surface)' : 'transparent',
                        color: viewMode === 'grid' ? 'var(--color-text)' : 'var(--color-text-muted)',
                        boxShadow: viewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Matriks Halaman
                    </button>
                  </div>

                  {/* Clean Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
                    <span>Rendah</span>
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)' }} />
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(59, 130, 246, 0.25)' }} />
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(16, 185, 129, 0.35)' }} />
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(245, 158, 11, 0.45)' }} />
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'rgba(239, 68, 68, 0.6)' }} />
                    <span>Tinggi</span>
                  </div>
                </div>

                {/* VIEW 1: Histogram Distribution Chart */}
                {viewMode === 'chart' ? (
                  <div
                    style={{
                      padding: '16px 14px 10px',
                      backgroundColor: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130, overflowX: 'auto', paddingBottom: 6 }}>
                      {heatmapData.pages.map((p) => {
                        const style = getIntensityStyle(p.intensityScore);
                        const heightPct = Math.max(Math.round((p.totalDurationSeconds / maxDuration) * 100), 12);
                        const isHovered = hoveredPage?.pageNumber === p.pageNumber;

                        return (
                          <div
                            key={p.pageNumber}
                            onMouseEnter={() => setHoveredPage(p)}
                            style={{
                              flex: '0 0 44px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              height: '100%',
                              justifyContent: 'flex-end',
                              cursor: 'pointer',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9.5,
                                fontFamily: 'var(--font-mono)',
                                color: isHovered ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                marginBottom: 4,
                                fontWeight: isHovered ? 700 : 500,
                              }}
                            >
                              {formatDuration(p.totalDurationSeconds)}
                            </span>

                            <div
                              style={{
                                width: '100%',
                                height: `${heightPct}%`,
                                backgroundColor: style.barColor,
                                opacity: isHovered ? 1 : 0.75,
                                borderRadius: '3px 3px 0 0',
                                transition: 'all 0.15s ease',
                                outline: isHovered ? '2px solid var(--color-text)' : 'none',
                              }}
                            />

                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: 'var(--font-mono)',
                                color: isHovered ? 'var(--color-text)' : 'var(--color-text-muted)',
                                marginTop: 6,
                                fontWeight: isHovered ? 700 : 500,
                              }}
                            >
                              p.{p.pageNumber}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* VIEW 2: Dense GitHub-style Grid */
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
                      gap: 6,
                      maxHeight: 220,
                      overflowY: 'auto',
                      padding: 10,
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      backgroundColor: 'var(--color-surface-subtle)',
                      marginBottom: 16,
                    }}
                  >
                    {heatmapData.pages.map((p) => {
                      const style = getIntensityStyle(p.intensityScore);
                      const isHovered = hoveredPage?.pageNumber === p.pageNumber;

                      return (
                        <div
                          key={p.pageNumber}
                          onMouseEnter={() => setHoveredPage(p)}
                          style={{
                            backgroundColor: style.bg,
                            border: isHovered ? '1.5px solid var(--color-primary)' : `1px solid ${style.border}`,
                            borderRadius: 4,
                            padding: '6px 2px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: style.color, fontFamily: 'var(--font-mono)' }}>
                            p.{p.pageNumber}
                          </div>
                          <div style={{ fontSize: 9.5, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                            {formatDuration(p.totalDurationSeconds)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sleek Tooltip Details Bar */}
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: hoveredPage ? 'rgba(59, 130, 246, 0.05)' : 'var(--color-surface-subtle)',
                    border: '1px solid var(--color-border)',
                    fontSize: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  {hoveredPage ? (
                    <>
                      <div>
                        <strong>Halaman {hoveredPage.pageNumber}</strong>: Total{' '}
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {formatDuration(hoveredPage.totalDurationSeconds)}
                        </span>
                        {' '}(rata-rata {formatDuration(hoveredPage.avgDurationSeconds)}/sesi)
                      </div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 11.5 }}>
                        {hoveredPage.viewCount}x interaksi · {hoveredPage.uniqueReaders} pembaca · Skor Intensitas: {hoveredPage.intensityScore}%
                      </div>
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 11.5 }}>
                      Arahkan kursor pada batang atau kotak halaman untuk meninjau rincian durasi.
                    </span>
                  )}
                </div>

                {/* Clean Top Focus Pages Table */}
                {heatmapData.peakPages && heatmapData.peakPages.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                      Halaman Paling Intensif Dikaji
                    </div>

                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                      <table className="data-table" style={{ margin: 0, fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 60, textAlign: 'center' }}>Posisi</th>
                            <th style={{ width: 90 }}>Halaman</th>
                            <th>Durasi Akumulasi</th>
                            <th style={{ width: 120, textAlign: 'center' }}>Rata-rata/Sesi</th>
                            <th style={{ width: 100, textAlign: 'center' }}>Pembaca</th>
                          </tr>
                        </thead>
                        <tbody>
                          {heatmapData.peakPages.map((peak, idx) => {
                            const pct = Math.round((peak.totalDurationSeconds / maxDuration) * 100);
                            return (
                              <tr key={peak.pageNumber}>
                                <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                  #{idx + 1}
                                </td>
                                <td>
                                  <span className="badge badge-unpublish" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>
                                    Halaman {peak.pageNumber}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ flex: 1, maxWidth: 120, height: 6, backgroundColor: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--color-primary)' }} />
                                    </div>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text)' }}>
                                      {formatDuration(peak.totalDurationSeconds)}
                                    </span>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                                  {formatDuration(peak.avgDurationSeconds)}
                                </td>
                                <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                  {peak.uniqueReaders} pemustaka
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
