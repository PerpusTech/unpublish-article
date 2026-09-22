import React from 'react';
import { createPortal } from 'react-dom';
import { AnalyticsData, AnalyticsPeriodInfo } from '../../services/api';

interface AnalyticsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AnalyticsData;
  period: AnalyticsPeriodInfo;
  onDownloadExcel?: () => void;
  onDownloadCsv?: () => void;
}

export const AnalyticsReportModal: React.FC<AnalyticsReportModalProps> = ({
  isOpen,
  onClose,
  data,
  period,
  onDownloadExcel,
  onDownloadCsv,
}) => {
  if (!isOpen || !data) return null;

  const handleDownload = onDownloadExcel || onDownloadCsv;

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
  } = data;

  const handlePrint = () => {
    document.body.classList.add('printing-report');
    const originalTitle = document.title;
    const cleanLabel = (period.label || 'Laporan').replace(/[^a-zA-Z0-9_-]/g, '_');
    document.title = `Laporan_Penggunaan_EPrints_${cleanLabel}_${new Date().toISOString().slice(0, 10)}`;

    const onAfterPrint = () => {
      document.body.classList.remove('printing-report');
      document.title = originalTitle;
      window.removeEventListener('afterprint', onAfterPrint);
    };

    window.addEventListener('afterprint', onAfterPrint);
    window.print();
  };

  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return createPortal(
    <div className="modal-backdrop">
      <div
        className="modal-dialog large animated-modal no-print-dialog"
        style={{ maxWidth: 880, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Toolbar (Screen Only) */}
        <div className="modal-header no-print" style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(30, 58, 138, 0.1)',
                color: 'var(--color-primary)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: 16, margin: 0 }}>
                Laporan Eksekutif Penggunaan Repositori
              </h2>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {period.label} • Siap Cetak / Unduh PDF & CSV
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onDownloadCsv}
              title="Unduh file format CSV untuk Excel"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Unduh CSV</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePrint}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              style={{ padding: '6px 10px', marginLeft: 4 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Printable Report Container */}
        <div
          className="modal-body printable-report-sheet"
          style={{
            padding: '30px 40px',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: '#ffffff',
            color: '#1e293b',
          }}
        >
          {/* Official Letterhead Header (KOP SURAT) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              paddingBottom: 16,
              borderBottom: '3px double #0f172a',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#1e3a8a' }}>
                UNIVERSITAS MUHAMMADIYAH SURAKARTA
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.5px', color: '#0f172a', marginTop: 2 }}>
                UPT PERPUSTAKAAN DAN LAYANAN DIGITAL
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                Jl. A. Yani, Tromol Pos 1 Pabelan Kartasura Surakarta 57102 • Telp: (0271) 717417 • Web: library.ums.ac.id
              </div>
            </div>
          </div>

          {/* Report Title & Metadata Banner */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1
              style={{
                fontSize: 16,
                fontWeight: 800,
                textTransform: 'uppercase',
                color: '#0f172a',
                margin: '0 0 6px 0',
                letterSpacing: '0.5px',
              }}
            >
              LAPORAN EKSEKUTIF PENGGUNAAN LAYANAN E-PRINTS UNPUBLISH
            </h1>
            <div
              style={{
                display: 'inline-block',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 20,
                padding: '4px 16px',
                fontSize: 12,
                fontWeight: 700,
                color: '#1e3a8a',
              }}
            >
              {period.label} ({period.startDate?.slice(0, 10)} s/d {period.endDate?.slice(0, 10)})
            </div>
          </div>

          {/* Section 1: Executive KPI Table */}
          <div style={{ marginBottom: 26 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#1e3a8a', margin: '0 0 10px 0', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
              I. Ringkasan Kinerja Utama (KPI Metrics)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Indikator Penggunaan</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#334155', width: 140 }}>Capaian Periode</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Keterangan Operasional</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>Total Pembacaan Naskah (PDF Views)</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#1e3a8a', fontSize: 14 }}>
                    {kpis.totalDocumentViews.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>Akumulasi berkas PDF karya unpublish dibuka</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>Total Tiket / Sesi Diterbitkan</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                    {kpis.totalTokens.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>Tiket izin akses yang dicetak di meja layanan sirkulasi</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>Sesi Aktif / Digunakan Pemustaka</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#16a34a', fontSize: 14 }}>
                    {kpis.activeTokens.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>Sesi yang sukses login & membaca di ruang baca</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>Jumlah Pemustaka Unik (NIM)</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                    {kpis.uniquePatrons.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>Mahasiswa/dosen unik yang memanfaatkan naskah</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>Rata-rata Durasi Membaca</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                    {kpis.averageDurationMinutes} Menit
                  </td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>Rata-rata alokasi waktu per peminjaman naskah</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Top Read Manuscripts */}
          <div style={{ marginBottom: 26, pageBreakInside: 'avoid' }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#1e3a8a', margin: '0 0 10px 0', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
              II. Karya Ilmiah & Naskah Unpublish Paling Banyak Diakses (Top 10)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: 35, color: '#334155' }}>No</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: 65, color: '#334155' }}>EPrint ID</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#334155' }}>Judul Naskah Karya Ilmiah</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: 75, color: '#334155' }}>Pembacaan</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', width: 75, color: '#334155' }}>Pembaca Unik</th>
                </tr>
              </thead>
              <tbody>
                {topArticles.length > 0 ? (
                  topArticles.map((art, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#1e3a8a' }}>#{art.eprint_id}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{art.article_title}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>{art.view_count} kali</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#475569' }}>{art.unique_readers} orang</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                      Tidak ada aktivitas pembacaan naskah pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Section 3: Top Active Patrons & Faculty Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 26, pageBreakInside: 'avoid' }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#1e3a8a', margin: '0 0 10px 0', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
                III. Pemustaka Paling Aktif
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '6px 6px', textAlign: 'left', color: '#334155' }}>NIM</th>
                    <th style={{ padding: '6px 6px', textAlign: 'left', color: '#334155' }}>Nama Pemustaka</th>
                    <th style={{ padding: '6px 6px', textAlign: 'center', color: '#334155' }}>Akses</th>
                  </tr>
                </thead>
                <tbody>
                  {topPatrons.slice(0, 7).map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '5px 6px', fontWeight: 700, color: '#1e3a8a' }}>{p.patron_nim}</td>
                      <td style={{ padding: '5px 6px', fontWeight: 600 }}>{p.patron_name}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700 }}>{p.document_views} naskah</td>
                    </tr>
                  ))}
                  {topPatrons.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                        Tidak ada aktivitas pemustaka.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#1e3a8a', margin: '0 0 10px 0', borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
                IV. Distribusi Fakultas Teraktif
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '6px 6px', textAlign: 'left', color: '#334155' }}>Fakultas / Program Studi</th>
                    <th style={{ padding: '6px 6px', textAlign: 'center', color: '#334155' }}>Pemustaka</th>
                    <th style={{ padding: '6px 6px', textAlign: 'center', color: '#334155' }}>Aktivitas</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyDistribution.slice(0, 7).map((f, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '5px 6px', fontWeight: 600 }}>{f.faculty}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'center' }}>{f.patron_count}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'center', fontWeight: 700 }}>{f.activity_count}</td>
                    </tr>
                  ))}
                  {facultyDistribution.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                        Tidak ada data fakultas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Signature / Pengesahan */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 36,
              paddingTop: 16,
              pageBreakInside: 'avoid',
              fontSize: 12,
              color: '#334155',
            }}
          >
            <div style={{ textAlign: 'center', width: 220 }}>
              <div>Mengetahui,</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>Kepala UPT Perpustakaan & Layanan Digital UMS</div>
              <div style={{ height: 60 }} />
              <div style={{ fontWeight: 800, textDecoration: 'underline' }}>( Maria Husnun Nisa, S.Sos., M.A. )</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>NIP / NIK. 100.1584</div>
            </div>

            <div style={{ textAlign: 'center', width: 220 }}>
              <div>Surakarta, {currentDateFormatted}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>Staf Administrasi & Layanan TI</div>
              <div style={{ height: 60 }} />
              <div style={{ fontWeight: 800, textDecoration: 'underline' }}>( Administrator Sistem )</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>UPT Perpustakaan UMS</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
