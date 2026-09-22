import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, PatronSession } from '../../services/api';

interface IntranetCheckinModalProps {
  isOpen: boolean;
  clientIp?: string;
  initialNim?: string;
  initialName?: string;
  onClose: () => void;
  onSuccess: (session: PatronSession) => void;
}

const JUNK_PATTERNS = [
  'TEST', 'TESTING', 'ASDF', 'QWERTY', 'ANONIM', 'ANONYMOUS', 'UNKNOWN',
  'ADMIN', 'USER', 'COBA', 'COBACOBA', 'SAMPLE', 'DEMO', '12345', '123456',
  'ABCDE', 'NULL', 'UNDEFINED', 'XYZ', 'XXXX', 'AAAA', 'JELEK', 'GAKTAU', 'GATAU'
];

export const IntranetCheckinModal: React.FC<IntranetCheckinModalProps> = ({
  isOpen,
  clientIp,
  initialNim = '',
  initialName = '',
  onClose,
  onSuccess,
}) => {
  const [patronNim, setPatronNim] = useState(initialNim);
  const [patronName, setPatronName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPatronNim(initialNim || '');
      setPatronName(initialName || '');
      setError(null);
      setLoading(false);
      setSsoLoading(false);

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, initialNim, initialName]);

  if (!isOpen) return null;

  const handleSsoLogin = async () => {
    setSsoLoading(true);
    setError(null);
    try {
      const { url } = await api.getPatronSsoLoginUrl();
      if (url) {
        window.location.href = url;
      } else {
        setError('Gagal mendapatkan URL login SSO CAS UMS.');
        setSsoLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menghubungi server SSO UMS.');
      setSsoLoading(false);
    }
  };

  const validateInputs = (): boolean => {
    const cleanNim = patronNim.trim().toUpperCase();
    const cleanName = patronName.trim();

    // 1. NIM / NIDN Validation
    if (!cleanNim) {
      setError('Harap masukkan NIM (Mahasiswa) atau NIDN (Dosen) Anda.');
      return false;
    }

    if (cleanNim.length < 5 || cleanNim.length > 25) {
      setError('Nomor identitas harus antara 5 hingga 25 karakter.');
      return false;
    }

    const isJunkNim = JUNK_PATTERNS.some((p) => cleanNim.includes(p)) || /^(.)\1{4,}$/.test(cleanNim);
    if (isJunkNim) {
      setError('Format identitas tidak valid. Harap masukkan NIM/NIDN resmi.');
      return false;
    }

    const isUmsNim = /^[A-Z][0-9]{8,10}$/.test(cleanNim);
    const isNidn = /^[0-9]{10}$/.test(cleanNim);
    const isGeneralId = /^[A-Z0-9-]{5,20}$/.test(cleanNim);

    if (!isUmsNim && !isNidn && !isGeneralId) {
      setError('Format NIM/NIDN tidak sesuai (Contoh: L200210001 atau 0612345678).');
      return false;
    }

    // 2. Name Validation
    if (!cleanName) {
      setError('Harap masukkan Nama Lengkap Anda.');
      return false;
    }

    if (cleanName.length < 5) {
      setError('Nama lengkap minimal 5 karakter.');
      return false;
    }

    if (!/^[a-zA-Z\s'’.\-]+$/.test(cleanName)) {
      setError('Nama lengkap hanya boleh memuat huruf alfabet.');
      return false;
    }

    const words = cleanName.split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      setError('Harap masukkan nama lengkap minimal 2 kata (Contoh: Ahmad Dahlan).');
      return false;
    }

    const upperName = cleanName.toUpperCase();
    const isJunkName = JUNK_PATTERNS.some((p) => upperName.includes(p)) || /^(.)\1{3,}$/.test(cleanName.replace(/\s/g, ''));
    if (isJunkName) {
      setError('Nama yang dimasukkan tidak valid. Harap gunakan nama lengkap asli.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) {
      return;
    }

    setLoading(true);
    setError(null);

    const res = await api.intranetCheckin(patronNim.trim().toUpperCase(), patronName.trim());
    setLoading(false);

    if (res.success && res.session) {
      onSuccess(res.session);
      onClose();
    } else {
      setError(res.error || 'Gagal memproses identifikasi pemustaka.');
    }
  };

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: 460 }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="modal-title" style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              Identifikasi Pemustaka
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Area Jaringan Kampus UMS
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Tutup"
            style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          {error && (
            <div
              className="alert-box alert-danger"
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                fontSize: '0.82rem',
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}

          {/* SSO Section */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              marginBottom: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                Civitas Akademika UMS
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(37, 99, 235, 0.15)',
                }}
              >
                Disarankan
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 12px', lineHeight: 1.4 }}>
              Masuk instan menggunakan akun MyUMS. Identitas terverifikasi otomatis.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSsoLogin}
              disabled={ssoLoading || loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '9px 14px',
                fontWeight: 600,
                fontSize: '0.85rem',
                borderRadius: 6,
              }}
            >
              {ssoLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} />
                  Menghubungkan ke SSO CAS...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Masuk dengan SSO CAS UMS
                </>
              )}
            </button>
          </div>

          {/* Subtle Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '0 0 16px',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
            <span>atau isi identitas manual</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="patron-nim-input" style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>
                NIM / NIDN / No. Identitas <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="patron-nim-input"
                name="patron_nim"
                type="text"
                className="form-input"
                placeholder="Contoh: L200210001 atau 0612345678"
                value={patronNim}
                onChange={(e) => setPatronNim(e.target.value.toUpperCase())}
                autoComplete="off"
                disabled={loading || ssoLoading}
                required
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="patron-name-input" style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>
                Nama Lengkap <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="patron-name-input"
                name="patron_name"
                type="text"
                className="form-input"
                placeholder="Contoh: Ahmad Dahlan"
                value={patronName}
                onChange={(e) => setPatronName(e.target.value)}
                autoComplete="name"
                disabled={loading || ssoLoading}
                required
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                Minimal 2 kata sesuai identitas resmi.
              </span>
            </div>

            {/* Quiet Security / Watermark Note */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: '9px 11px',
                borderRadius: 6,
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                fontSize: '0.74rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.4,
                marginBottom: 16,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div>
                Identitas ini dicantumkan sebagai watermark keamanan pada dokumen PDF dan tercatat pada log audit perpustakaan.
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading || ssoLoading}
                style={{ padding: '8px 14px', fontSize: '0.85rem' }}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || ssoLoading}
                style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                {loading ? 'Memverifikasi...' : 'Lanjutkan Membaca'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};


