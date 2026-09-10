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
      try {
        const saved = localStorage.getItem('ums_patron_session') || localStorage.getItem('ums_intranet_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.patron_nim && !patronNim) setPatronNim(parsed.patron_nim);
          if (parsed.patron_name && !patronName) setPatronName(parsed.patron_name);
        }
      } catch { }

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSsoLogin = async () => {
    setSsoLoading(true);
    setError(null);
    try {
      const { url } = await api.getPatronSsoLoginUrl();
      if (url) {
        window.location.href = url;
      } else {
        setError('Gagal mendapatkan URL login SSO.');
        setSsoLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menghubungi server SSO UMS.');
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patronNim.trim()) {
      setError('Harap masukkan NIM atau Nomor Identitas Pemustaka.');
      return;
    }
    if (!patronName.trim()) {
      setError('Harap masukkan Nama Lengkap Pemustaka.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await api.intranetCheckin(patronNim, patronName);
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
      <div className="modal-dialog" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: '1.15rem', marginBottom: 2 }}>
                Identifikasi Pemustaka UMS
              </h2>
              <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                Terhubung Jaringan Kampus UMS
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Tutup"
            style={{ padding: '4px 8px' }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ paddingBottom: 12 }}>
          {error && (
            <div className="alert-box alert-danger" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* Quick SSO UMS Option */}
          <div
            style={{
              padding: '16px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(56, 189, 248, 0.12) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Login Instan dengan SSO UMS
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 3, lineHeight: 1.4 }}>
                  NIM/NIDN & Nama Lengkap resmi otomatis terisi & terverifikasi dari <code>auth.ums.ac.id</code>.
                </div>
              </div>
              <span className="badge badge-info" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap', padding: '2px 6px' }}>
                Direkomendasikan
              </span>
            </div>

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
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '0.9rem',
                borderRadius: 8,
              }}
            >
              {ssoLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} />
                  Menghubungkan ke SSO UMS...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Masuk dengan SSO UMS (CAS)
                </>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
            <span>atau isi identitas secara manual</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" htmlFor="patron-nim-input" style={{ fontSize: '0.85rem' }}>
                NIM / NIDN / No. Identitas <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
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
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" htmlFor="patron-name-input" style={{ fontSize: '0.85rem' }}>
                Nama Lengkap Pemustaka <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
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
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 5, display: 'block' }}>
                *Identitas dicantumkan pada watermark PDF & audit log resmi perpustakaan.
              </span>
            </div>

            <div className="modal-footer" style={{ padding: '12px 0 0', borderTop: '1px solid var(--color-border)' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading || ssoLoading}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading || ssoLoading}>
                {loading ? 'Menyimpan...' : 'Simpan & Mulai Membaca'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
