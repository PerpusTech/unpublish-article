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
    return `${hours} jam ${minutes} mnt`;
  }
  if (minutes > 0) {
    return `${minutes} mnt ${secs > 0 ? `${secs} dtk` : ''}`;
  }
  return `${secs} dtk`;
};

const getHeatmapColor = (intensity: number): { bg: string; text: string; border: string } => {
  if (intensity === 0) {
    return { bg: 'var(--color-surface-subtle)', text: 'var(--color-text-muted)', border: 'var(--color-border)' };
  }
  if (intensity < 25) {
    return { bg: 'rgba(59, 130, 246, 0.15)', text: 'var(--color-primary)', border: 'rgba(59, 130, 246, 0.3)' };
  }
  if (intensity < 55) {
    return { bg: 'rgba(16, 185, 129, 0.25)', text: '#059669', border: 'rgba(16, 185, 129, 0.4)' };
  }
  if (intensity < 80) {
    return { bg: 'rgba(245, 158, 11, 0.35)', text: '#b45309', border: 'rgba(245, 158, 11, 0.5)' };
  }
  return { bg: 'rgba(239, 68, 68, 0.45)', text: '#b91c1c', border: 'rgba(239, 68, 68, 0.6)' };
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

  // 1. Fetch Summary list of studied manuscripts
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

  // 2. Fetch Heatmap detail when selectedEprintId changes
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

  return (
    <div style={{ marginTop: 24 }}>
      {/* Section Header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              Heatmap & Durasi Membaca per Halaman Naskah
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Analisis waktu nyata halaman & bab skripsi/tesis yang paling intensif dipelajari oleh pemustaka
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadSummary}
            disabled={loadingSummary}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            <span>Segarkan Data</span>
          </button>
        </div>

        {/* Global Reading KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 16 }}>
          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 4 }}>Total Durasi Membaca (Semua Naskah)</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary)' }}>
              {formatDuration(overallTotalSeconds)}
            </div>
          </div>

          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 4 }}>Pemustaka Yang Aktif Mengkaji</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
              {overallUniqueReaders.toLocaleString('id-ID')} mahasiswa
            </div>
          </div>

          <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginBottom: 4 }}>Naskah Terdata Waktu Baca</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>
              {summaryList.length} naskah
            </div>
          </div>
        </div>
      </div>

      {summaryList.length === 0 && !loadingSummary ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5, marginBottom: 10 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Belum Ada Data Durasi Membaca Halaman</div>
          <p style={{ fontSize: 12.5, maxWidth: 460, margin: '6px auto 0' }}>
            Data durasi membaca akan otomatis terakumulasi dan membentuk peta heatmap saat pemustaka membuka naskah PDF di portal katalog.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left Column: List of Studied Manuscripts */}
          <div className="card" style={{ margin: 0, padding: '16px 14px' }}>
            <h4 style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Daftar Naskah Terkaji</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>{summaryList.length} item</span>
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
              {summaryList.map((item) => {
                const isSelected = selectedEprintId === item.eprint_id;
                return (
                  <button
                    key={item.eprint_id}
                    type="button"
                    onClick={() => setSelectedEprintId(item.eprint_id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                      <span className="badge badge-unpublish" style={{ fontSize: 10 }}>#{item.eprint_id}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-primary)' }}>
                        {formatDuration(item.total_duration_seconds)}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: isSelected ? 700 : 500,
                        color: 'var(--color-text)',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {item.article_title}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                      <span>👤 {item.unique_readers} pembaca</span>
                      <span>•</span>
                      <span>📑 {item.pages_covered} hal dibaca</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Interactive Heatmap Visualizer */}
          <div className="card" style={{ margin: 0 }}>
            {loadingHeatmap ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <span>Memuat data heatmap halaman naskah...</span>
              </div>
            ) : heatmapData ? (
              <div>
                {/* Manuscript Info Header */}
                <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--color-border)', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-publish" style={{ fontSize: 10.5 }}>EPrint #{heatmapData.eprintId}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      Total {heatmapData.pages.length} Halaman Terdata
                    </span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 8px', color: 'var(--color-text)', lineHeight: 1.35 }}>
                    {heatmapData.articleTitle}
                  </h4>

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                    <span>⏱️ Total Waktu: <strong style={{ color: 'var(--color-text)' }}>{formatDuration(heatmapData.grandTotalSeconds)}</strong></span>
                    <span>👥 Total Pembaca: <strong style={{ color: 'var(--color-text)' }}>{heatmapData.totalUniqueReaders} orang</strong></span>
                    <span>🔄 Sesi Interaksi: <strong style={{ color: 'var(--color-text)' }}>{heatmapData.totalReadingEvents}x</strong></span>
                  </div>
                </div>

                {/* Heatmap Spectrum Legend */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>
                    Peta Intensitas Waktu Membaca (Per Halaman):
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                    <span>Cepat (0m)</span>
                    <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)' }} />
                    <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(59, 130, 246, 0.25)', border: '1px solid rgba(59, 130, 246, 0.4)' }} />
                    <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(16, 185, 129, 0.35)', border: '1px solid rgba(16, 185, 129, 0.5)' }} />
                    <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(245, 158, 11, 0.45)', border: '1px solid rgba(245, 158, 11, 0.6)' }} />
                    <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: 'rgba(239, 68, 68, 0.6)', border: '1px solid rgba(239, 68, 68, 0.7)' }} />
                    <span>Intensif / Lama</span>
                  </div>
                </div>

                {/* Page Heatmap Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                    gap: 8,
                    maxHeight: 280,
                    overflowY: 'auto',
                    padding: '8px 4px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    backgroundColor: 'var(--color-surface-subtle)',
                  }}
                >
                  {heatmapData.pages.map((p) => {
                    const color = getHeatmapColor(p.intensityScore);
                    const isHovered = hoveredPage?.pageNumber === p.pageNumber;

                    return (
                      <div
                        key={p.pageNumber}
                        onMouseEnter={() => setHoveredPage(p)}
                        style={{
                          backgroundColor: color.bg,
                          border: isHovered ? '2px solid var(--color-primary)' : `1px solid ${color.border}`,
                          borderRadius: 6,
                          padding: '8px 4px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                          boxShadow: isHovered ? '0 4px 10px rgba(0,0,0,0.1)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 700, color: color.text }}>
                          Hal {p.pageNumber}
                        </span>
                        <span style={{ fontSize: 10, color: color.text, opacity: 0.85, marginTop: 2 }}>
                          {formatDuration(p.totalDurationSeconds)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Hover Detail Card */}
                {hoveredPage ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-primary)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      fontSize: 12.5,
                    }}
                  >
                    <div>
                      <strong>Halaman {hoveredPage.pageNumber}</strong>: Total dikaji selama{' '}
                      <strong style={{ color: 'var(--color-primary)' }}>{formatDuration(hoveredPage.totalDurationSeconds)}</strong>
                      {' '}(Rata-rata {formatDuration(hoveredPage.avgDurationSeconds)} per pembaca).
                    </div>
                    <div style={{ color: 'var(--color-text-muted)' }}>
                      Dibaca {hoveredPage.viewCount}x oleh {hoveredPage.uniqueReaders} pemustaka (Intensitas: {hoveredPage.intensityScore}%)
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    Arahkan kursor pada kotak halaman di atas untuk melihat detail durasi dan frekuensi baca.
                  </div>
                )}

                {/* Top Peak Studied Pages (Bab / Bagian Teratas) */}
                {heatmapData.peakPages && heatmapData.peakPages.length > 0 && (
                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
                      🏆 Halaman Paling Lama & Sering Dikaji (Top Focus Pages):
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                      {heatmapData.peakPages.map((peak, idx) => (
                        <div
                          key={peak.pageNumber}
                          style={{
                            padding: '8px 10px',
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              backgroundColor: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : '#cbd5e1',
                              color: '#0f172a',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 10.5,
                              fontWeight: 800,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div style={{ fontSize: 12 }}>
                            <div><strong>Halaman {peak.pageNumber}</strong></div>
                            <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>
                              {formatDuration(peak.totalDurationSeconds)} ({peak.uniqueReaders} pembaca)
                            </div>
                          </div>
                        </div>
                      ))}
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
