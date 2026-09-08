import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, TokenAdminItem } from '../../services/api';
import { ThermalSlipModal, ThermalSlipItem } from './ThermalSlipModal';
import { ShareTokenModal } from './ShareTokenModal';
import { copyToClipboard } from '../../utils/clipboard';

interface TokenGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

interface BatchPatronInput {
  patronName: string;
  patronNim: string;
  notes?: string;
}

export const TokenGeneratorModal: React.FC<TokenGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'SINGLE' | 'BATCH'>('SINGLE');

  // --- Single Mode State ---
  const [patronName, setPatronName] = useState('');
  const [patronNim, setPatronNim] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Single Result
  const [generatedResult, setGeneratedResult] = useState<{
    token: TokenAdminItem;
    qrDataUrl: string;
  } | null>(null);

  // --- Batch Mode State ---
  const [batchInputMode, setBatchInputMode] = useState<'PASTE' | 'ROWS'>('PASTE');
  const [batchRawText, setBatchRawText] = useState('');
  const [batchRows, setBatchRows] = useState<BatchPatronInput[]>([
    { patronName: '', patronNim: '', notes: '' },
    { patronName: '', patronNim: '', notes: '' },
  ]);
  const [batchDefaultNotes, setBatchDefaultNotes] = useState('');
  const [batchDuration, setBatchDuration] = useState(120);

  // Batch Result
  const [batchGeneratedResults, setBatchGeneratedResults] = useState<ThermalSlipItem[] | null>(null);

  // Modal Children (Share & Thermal Print)
  const [thermalModalOpen, setThermalModalOpen] = useState(false);
  const [thermalItems, setThermalItems] = useState<ThermalSlipItem[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTargetToken, setShareTargetToken] = useState<TokenAdminItem | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Parse Raw Paste Text for Batch ---
  const parseRawBatchText = (text: string): BatchPatronInput[] => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed: BatchPatronInput[] = [];

    for (const line of lines) {
      // Split by comma, semicolon, or tab
      let parts = line.split(/[,;\t]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1 && line.includes(' ')) {
        // Fallback split by multiple spaces
        parts = line.split(/\s{2,}|\t/).map((s) => s.trim()).filter(Boolean);
      }

      if (parts.length >= 2) {
        // Determine which one looks like a NIM (contains numbers) vs Name
        const p0HasDigits = /\d/.test(parts[0]);
        const p1HasDigits = /\d/.test(parts[1]);

        let nim = '';
        let name = '';

        if (p0HasDigits && !p1HasDigits) {
          nim = parts[0];
          name = parts[1];
        } else if (!p0HasDigits && p1HasDigits) {
          name = parts[0];
          nim = parts[1];
        } else {
          nim = parts[0];
          name = parts[1];
        }

        const note = parts.slice(2).join(', ');
        parsed.push({
          patronNim: nim.toUpperCase(),
          patronName: name,
          notes: note || undefined,
        });
      }
    }
    return parsed;
  };

  const parsedBatchItems = parseRawBatchText(batchRawText);

  // --- Submit Single Token ---
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patronName.trim() || !patronNim.trim()) {
      setError('Nama dan NIM pemustaka wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.createToken({
        patronName: patronName.trim(),
        patronNim: patronNim.trim().toUpperCase(),
        durationMinutes,
        notes: notes.trim() || undefined,
      });

      setGeneratedResult(res);
      onSuccess();
      if (onShowToast) onShowToast(`Tiket membaca ${patronName} berhasil dibuat!`, 'success');
    } catch (err: any) {
      setError(err.message || 'Gagal menerbitkan token.');
    } finally {
      setLoading(false);
    }
  };

  // --- Submit Batch Tokens ---
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let itemsToSubmit: BatchPatronInput[] = [];

    if (batchInputMode === 'PASTE') {
      itemsToSubmit = parsedBatchItems;
    } else {
      itemsToSubmit = batchRows.filter((r) => r.patronName.trim() && r.patronNim.trim());
    }

    if (itemsToSubmit.length === 0) {
      setError('Harap masukkan minimal 1 data pemustaka yang valid (Nama & NIM).');
      return;
    }

    if (itemsToSubmit.length > 100) {
      setError('Maksimal 100 tiket per proses pembuatan massal.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.createBatchTokens({
        items: itemsToSubmit,
        durationMinutes: batchDuration,
        defaultNotes: batchDefaultNotes.trim() || undefined,
      });

      setBatchGeneratedResults(res.tokens || []);
      onSuccess();
      if (onShowToast) {
        onShowToast(`Berhasil menerbitkan ${res.count} tiket membaca secara massal!`, 'success');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menerbitkan tiket massal.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSingle = () => {
    setPatronName('');
    setPatronNim('');
    setNotes('');
    setGeneratedResult(null);
    setError(null);
    setCopiedCode(false);
  };

  const handleResetBatch = () => {
    setBatchRawText('');
    setBatchRows([
      { patronName: '', patronNim: '', notes: '' },
      { patronName: '', patronNim: '', notes: '' },
    ]);
    setBatchDefaultNotes('');
    setBatchGeneratedResults(null);
    setError(null);
  };

  const handleAddBatchRow = () => {
    setBatchRows([...batchRows, { patronName: '', patronNim: '', notes: '' }]);
  };

  const handleRemoveBatchRow = (index: number) => {
    setBatchRows(batchRows.filter((_, idx) => idx !== index));
  };

  const handleBatchRowChange = (index: number, field: keyof BatchPatronInput, value: string) => {
    const updated = [...batchRows];
    updated[index] = { ...updated[index], [field]: value };
    setBatchRows(updated);
  };

  const handleCopy = async (code: string) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleOpenSingleThermal = () => {
    if (!generatedResult) return;
    setThermalItems([generatedResult]);
    setThermalModalOpen(true);
  };

  const handleOpenBatchThermal = () => {
    if (!batchGeneratedResults || batchGeneratedResults.length === 0) return;
    setThermalItems(batchGeneratedResults);
    setThermalModalOpen(true);
  };

  const handleOpenShare = (tokenItem: TokenAdminItem) => {
    setShareTargetToken(tokenItem);
    setShareModalOpen(true);
  };

  const handleExportBatchCsv = () => {
    if (!batchGeneratedResults || batchGeneratedResults.length === 0) return;
    const headers = ['Kode Token', 'Nama Pemustaka', 'NIM/NIP', 'Durasi (Menit)', 'Catatan', 'Tautan Akses Langsung'];
    const origin = window.location.origin;
    const rows = batchGeneratedResults.map(({ token }) => [
      `"${token.token_code}"`,
      `"${(token.patron_name || '').replace(/"/g, '""')}"`,
      `"${(token.patron_nim || '').replace(/"/g, '""')}"`,
      `"${token.duration_minutes}"`,
      `"${(token.notes || '').replace(/"/g, '""')}"`,
      `"${origin}/?claim_token=${token.token_code}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_tiket_unpublish_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const durationOptions = [
    { value: 60, label: '1 Jam', sub: '60 menit' },
    { value: 120, label: '2 Jam (Standar)', sub: '120 menit • Rekomendasi' },
    { value: 180, label: '3 Jam', sub: '180 menit' },
    { value: 240, label: '4 Jam', sub: '240 menit' },
  ];

  return createPortal(
    <>
      <div className="modal-backdrop">
        <div
          className="modal-dialog animated-modal"
          style={{
            maxWidth: activeTab === 'BATCH' && !batchGeneratedResults ? 720 : batchGeneratedResults ? 780 : 540,
            transition: 'max-width 0.2s ease',
          }}
        >
          {/* Modal Header & Tabs */}
          <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, paddingBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17 }}>
                {generatedResult || batchGeneratedResults ? (
                  <>
                    <span style={{ color: 'var(--color-success)' }}>✓</span>
                    <span>Tiket Membaca Berhasil Diterbitkan</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span>Layanan Penerbitan Tiket Membaca</span>
                  </>
                )}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  handleResetSingle();
                  handleResetBatch();
                  onClose();
                }}
                style={{ padding: '4px 8px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher Tabs (Only when not in result screen) */}
            {!generatedResult && !batchGeneratedResults && (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  backgroundColor: 'var(--color-surface-subtle)',
                  padding: 4,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('SINGLE');
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    fontSize: 13,
                    fontWeight: activeTab === 'SINGLE' ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: activeTab === 'SINGLE' ? 'var(--color-surface)' : 'transparent',
                    color: activeTab === 'SINGLE' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: activeTab === 'SINGLE' ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <line x1="7" y1="8" x2="17" y2="8" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="7" y1="16" x2="13" y2="16" />
                  </svg>
                  <span>Tiket Tunggal (Individu)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('BATCH');
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 12px',
                    fontSize: 13,
                    fontWeight: activeTab === 'BATCH' ? 700 : 500,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: activeTab === 'BATCH' ? 'var(--color-surface)' : 'transparent',
                    color: activeTab === 'BATCH' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: activeTab === 'BATCH' ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>Tiket Massal (Kelompok / Kelas Riset)</span>
                </button>
              </div>
            )}
          </div>

          {/* ================= MODE 1: SINGLE TOKEN ================= */}
          {activeTab === 'SINGLE' && !generatedResult && (
            <form onSubmit={handleSingleSubmit}>
              <div className="modal-body" style={{ maxHeight: 'calc(85vh - 160px)', overflowY: 'auto' }}>
                {error && <div className="alert-box alert-danger">{error}</div>}

                <div className="form-group">
                  <label className="form-label" htmlFor="patron-name">
                    Nama Lengkap Pemustaka *
                  </label>
                  <input
                    id="patron-name"
                    name="patron_name"
                    type="text"
                    className="form-input"
                    placeholder="Misal: Ahmad Zaky Kurniawan"
                    value={patronName}
                    onChange={(e) => setPatronName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="patron-nim">
                    NIM / NIP Pemustaka *
                  </label>
                  <input
                    id="patron-nim"
                    name="patron_nim"
                    type="text"
                    className="form-input"
                    placeholder="Misal: L200210045"
                    value={patronNim}
                    onChange={(e) => setPatronNim(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Durasi Sesi Membaca *</label>
                  <div className="duration-preset-grid">
                    {durationOptions.map((opt) => (
                      <div
                        key={opt.value}
                        className={`duration-chip ${durationMinutes === opt.value ? 'selected' : ''}`}
                        onClick={() => setDurationMinutes(opt.value)}
                      >
                        <div className="duration-chip-title">{opt.label}</div>
                        <div className="duration-chip-desc">{opt.sub}</div>
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 8, display: 'block', lineHeight: 1.4 }}>
                    ℹ️ Hitungan mundur durasi membaca baru akan dimulai saat token pertama kali diaktivasi di komputer pemustaka.
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="token-notes">
                    Catatan Keperluan (Opsional)
                  </label>
                  <input
                    id="token-notes"
                    name="token_notes"
                    type="text"
                    className="form-input"
                    placeholder="Misal: Referensi tugas akhir skripsi FKI"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    handleResetSingle();
                    onClose();
                  }}
                  disabled={loading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {loading ? (
                    <span>Menerbitkan...</span>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Terbitkan Tiket & Buat QR</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= SINGLE RESULT VIEW ================= */}
          {activeTab === 'SINGLE' && generatedResult && (
            <div>
              <div className="modal-body printable-slip" style={{ maxHeight: 'calc(85vh - 160px)', overflowY: 'auto' }}>
                <div
                  style={{
                    border: '2px dashed var(--color-border-dark)',
                    borderRadius: 'var(--radius-md)',
                    padding: '24px 20px',
                    textAlign: 'center',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary)', fontFamily: 'var(--font-heading)', letterSpacing: '0.5px' }}>
                    UPT PERPUSTAKAAN DAN LAYANAN DIGITAL UNIVERSITAS MUHAMMADIYAH SURAKARTA
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 16, fontFamily: 'var(--font-heading)' }}>
                    SLIP VOUCHER AKSES REPOSITORI UNPUBLISH
                  </div>

                  <div
                    style={{
                      display: 'inline-block',
                      padding: 8,
                      backgroundColor: '#ffffff',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: 'var(--shadow-sm)',
                      marginBottom: 14,
                    }}
                  >
                    <img
                      src={generatedResult.qrDataUrl}
                      alt="QR Code"
                      style={{ width: 170, height: 170, display: 'block' }}
                    />
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>Kode Token Akses:</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 28,
                      fontWeight: 800,
                      color: 'var(--color-primary)',
                      letterSpacing: 3,
                      margin: '4px 0 16px 0',
                      backgroundColor: 'var(--color-surface-subtle)',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-block',
                    }}
                  >
                    {generatedResult.token.token_code}
                  </div>

                  <div
                    style={{
                      fontSize: 12.5,
                      textAlign: 'left',
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Pemustaka:</span>
                      <strong>{generatedResult.token.patron_name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>NIM / NIP:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{generatedResult.token.patron_nim}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Durasi Membaca:</span>
                      <strong>{generatedResult.token.duration_minutes} Menit</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Masa Berlaku Klaim:</span>
                      <span>24 Jam sejak diterbitkan</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleCopy(generatedResult.token.token_code)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {copiedCode ? (
                    <span style={{ color: 'var(--color-success)', fontWeight: 800 }}>✓ Kode Tersalin!</span>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>Salin Kode</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenShare(generatedResult.token)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a', borderColor: '#16a34a' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span>Kirim WA / Email</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenSingleThermal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  <span>Cetak Slip Termal (POS)</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleResetSingle}
                >
                  + Buat Token Lain
                </button>
              </div>
            </div>
          )}

          {/* ================= MODE 2: BATCH TOKEN GENERATOR ================= */}
          {activeTab === 'BATCH' && !batchGeneratedResults && (
            <form onSubmit={handleBatchSubmit}>
              <div className="modal-body" style={{ maxHeight: 'calc(85vh - 160px)', overflowY: 'auto' }}>
                {error && <div className="alert-box alert-danger">{error}</div>}

                {/* Sub Mode: Paste vs Table */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    Metode Input Mahasiswa / Pemustaka:
                  </label>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      type="button"
                      className={`btn btn-xs ${batchInputMode === 'PASTE' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setBatchInputMode('PASTE')}
                      style={{ fontSize: 12, padding: '3px 8px' }}
                    >
                      Salin-Tempel Teks / CSV
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${batchInputMode === 'ROWS' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setBatchInputMode('ROWS')}
                      style={{ fontSize: 12, padding: '3px 8px' }}
                    >
                      Input Tabel Baris
                    </button>
                  </div>
                </div>

                {batchInputMode === 'PASTE' ? (
                  <div className="form-group">
                    <textarea
                      id="batch-raw-text-area"
                      name="batch_raw_text"
                      className="form-input"
                      rows={6}
                      placeholder={`Format: NIM, Nama Mahasiswa, Catatan (Opsional)\nContoh:\nL200210045, Ahmad Zaky Kurniawan, Kelompok 1\nL200210046, Budi Santoso, Kelompok 1\nL200210047, Siti Nurhaliza\nF100220332, Muhammad Rizky`}
                      value={batchRawText}
                      onChange={(e) => setBatchRawText(e.target.value)}
                      autoComplete="off"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.5 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
                      <span>Dapat disalin langsung dari Excel / Google Sheets / Presensi.</span>
                      <strong style={{ color: parsedBatchItems.length > 0 ? 'var(--color-success)' : 'var(--color-text-light)' }}>
                        {parsedBatchItems.length} Pemustaka Terdeteksi
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                      {batchRows.map((row, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--color-text-light)', width: 18 }}>#{idx + 1}</span>
                          <input
                            id={`batch-nim-${idx}`}
                            name={`batch_nim_${idx}`}
                            type="text"
                            placeholder="NIM / NIP"
                            value={row.patronNim}
                            onChange={(e) => handleBatchRowChange(idx, 'patronNim', e.target.value)}
                            autoComplete="off"
                            className="form-input"
                            style={{ width: '32%', fontSize: 12 }}
                          />
                          <input
                            id={`batch-name-${idx}`}
                            name={`batch_name_${idx}`}
                            type="text"
                            placeholder="Nama Lengkap"
                            value={row.patronName}
                            onChange={(e) => handleBatchRowChange(idx, 'patronName', e.target.value)}
                            autoComplete="name"
                            className="form-input"
                            style={{ flex: 1, fontSize: 12 }}
                          />
                          <input
                            id={`batch-notes-${idx}`}
                            name={`batch_notes_${idx}`}
                            type="text"
                            placeholder="Catatan"
                            value={row.notes || ''}
                            onChange={(e) => handleBatchRowChange(idx, 'notes', e.target.value)}
                            autoComplete="off"
                            className="form-input"
                            style={{ width: '28%', fontSize: 12 }}
                          />
                          {batchRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBatchRow(idx)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 14 }}
                              title="Hapus baris"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddBatchRow}
                      style={{ marginTop: 8, fontSize: 12 }}
                    >
                      + Tambah Baris Pemustaka
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="batch-duration-select">Durasi Seluruh Tiket *</label>
                    <select
                      id="batch-duration-select"
                      name="batch_duration"
                      className="form-input"
                      value={batchDuration}
                      onChange={(e) => setBatchDuration(parseInt(e.target.value, 10))}
                      style={{ fontWeight: 600 }}
                    >
                      <option value={60}>1 Jam (60 Menit)</option>
                      <option value={120}>2 Jam (120 Menit - Standar)</option>
                      <option value={180}>3 Jam (180 Menit)</option>
                      <option value={240}>4 Jam (240 Menit)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="batch-default-notes-input">Catatan Kelompok / Mata Kuliah</label>
                    <input
                      id="batch-default-notes-input"
                      name="batch_default_notes"
                      type="text"
                      className="form-input"
                      placeholder="Misal: Kelas Riset FKI Kelompok 2"
                      value={batchDefaultNotes}
                      onChange={(e) => setBatchDefaultNotes(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    handleResetBatch();
                    onClose();
                  }}
                  disabled={loading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {loading ? (
                    <span>Menerbitkan Massal...</span>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <span>Terbitkan Tiket Massal Sekaligus</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= BATCH RESULTS VIEW ================= */}
          {activeTab === 'BATCH' && batchGeneratedResults && (
            <div>
              <div className="modal-body" style={{ maxHeight: 'calc(85vh - 160px)', overflowY: 'auto' }}>
                {/* Result Summary Banner */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: '#047857', fontSize: 14 }}>
                      ✓ {batchGeneratedResults.length} Tiket Berhasil Diterbitkan
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      Durasi: {batchDuration} Menit • Siap dibagikan atau dicetak ke printer termal
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleExportBatchCsv}
                      style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Ekspor CSV</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleOpenBatchThermal}
                      style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      <span>Cetak Semua Slip Termal ({batchGeneratedResults.length})</span>
                    </button>
                  </div>
                </div>

                {/* Generated Tokens Table */}
                <div className="table-responsive" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                  <table className="data-table" style={{ fontSize: 12.5 }}>
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Kode Token</th>
                        <th>Pemustaka</th>
                        <th>NIM / NIP</th>
                        <th>Catatan</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchGeneratedResults.map(({ token, qrDataUrl }, idx) => (
                        <tr key={token.id || idx}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', letterSpacing: '0.5px' }}>
                              {token.token_code}
                            </strong>
                          </td>
                          <td style={{ fontWeight: 600 }}>{token.patron_name}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{token.patron_nim}</td>
                          <td style={{ color: 'var(--color-text-muted)' }}>{token.notes || '-'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleCopy(token.token_code)}
                                title="Salin kode"
                              >
                                Salin
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleOpenShare(token)}
                                title="Kirim WA / Email"
                                style={{ color: '#16a34a' }}
                              >
                                Kirim
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => {
                                  setThermalItems([{ token, qrDataUrl }]);
                                  setThermalModalOpen(true);
                                }}
                                title="Cetak slip termal"
                              >
                                Slip Termal
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleResetBatch}>
                  + Buat Batch Lain
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    handleResetBatch();
                    onClose();
                  }}
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Child Modal: Thermal Slip Modal */}
      <ThermalSlipModal
        isOpen={thermalModalOpen}
        onClose={() => setThermalModalOpen(false)}
        items={thermalItems}
      />

      {/* Child Modal: Share Token Modal */}
      <ShareTokenModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        token={shareTargetToken}
        onShowToast={onShowToast}
      />
    </>,
    document.body
  );
};
