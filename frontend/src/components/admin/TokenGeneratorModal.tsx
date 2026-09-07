import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, TokenAdminItem } from '../../services/api';

interface TokenGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TokenGeneratorModal: React.FC<TokenGeneratorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [patronName, setPatronName] = useState('');
  const [patronNim, setPatronNim] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [generatedResult, setGeneratedResult] = useState<{
    token: TokenAdminItem;
    qrDataUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patronName.trim() || !patronNim.trim()) {
      setError('Nama dan NIM pemustaka wajib diisi.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.createToken({
        patronName,
        patronNim,
        durationMinutes,
        notes,
      });

      setGeneratedResult(res);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menerbitkan token.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPatronName('');
    setPatronNim('');
    setNotes('');
    setGeneratedResult(null);
    setError(null);
    setCopiedCode(false);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const durationOptions = [
    { value: 60, label: '1 Jam', sub: '60 menit' },
    { value: 120, label: '2 Jam (Standar)', sub: '120 menit • Rekomendasi' },
    { value: 180, label: '3 Jam', sub: '180 menit' },
    { value: 240, label: '4 Jam', sub: '240 menit' },
  ];

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17 }}>
            {generatedResult ? (
              <>
                <span style={{ color: 'var(--color-success)' }}>✓</span>
                <span>Slip Voucher Membaca Diterbitkan</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <span>Terbitkan Tiket Membaca Baru</span>
              </>
            )}
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              handleReset();
              onClose();
            }}
            style={{ padding: '4px 8px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {!generatedResult ? (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert-box alert-danger">{error}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="patron-name">
                  Nama Lengkap Pemustaka *
                </label>
                <input
                  id="patron-name"
                  type="text"
                  className="form-input"
                  placeholder="Misal: Ahmad Zaky Kurniawan"
                  value={patronName}
                  onChange={(e) => setPatronName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="patron-nim">
                  NIM / NIP Pemustaka *
                </label>
                <input
                  id="patron-nim"
                  type="text"
                  className="form-input"
                  placeholder="Misal: L200210045"
                  value={patronNim}
                  onChange={(e) => setPatronNim(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Durasi Sesi Membaca *
                </label>
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
                  type="text"
                  className="form-input"
                  placeholder="Misal: Referensi tugas akhir skripsi FKI"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  handleReset();
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
        ) : (
          <div>
            <div className="modal-body printable-slip">
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
                  PERPUSTAKAAN UNIVERSITAS MUHAMMADIYAH SURAKARTA
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

            <div className="modal-footer" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleCopy(generatedResult.token.token_code)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {copiedCode ? (
                  <span style={{ color: 'var(--color-success)', fontWeight: 800 }}>✓ Kode Tersalin!</span>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                <span>Cetak Slip Voucher</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReset}
              >
                + Buat Token Lainnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

