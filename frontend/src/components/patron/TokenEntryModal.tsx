import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, PatronSession } from '../../services/api';

interface TokenEntryModalProps {
  isOpen: boolean;
  initialTokenCode?: string;
  onClose: () => void;
  onSuccess: (session: PatronSession) => void;
}

export const TokenEntryModal: React.FC<TokenEntryModalProps> = ({
  isOpen,
  initialTokenCode = '',
  onClose,
  onSuccess,
}) => {
  const [tokenCode, setTokenCode] = useState(initialTokenCode);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTokenCode) {
      setTokenCode(initialTokenCode);
    }
  }, [initialTokenCode]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTokenCode) {
      setTokenCode(initialTokenCode);
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, initialTokenCode]);

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
    if (!tokenCode.trim()) {
      setError('Harap masukkan kode token.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await api.claimToken(tokenCode);
    setLoading(false);

    if (res.success && res.session) {
      onSuccess(res.session);
      onClose();
    } else {
      setError(res.error || 'Aktivasi token gagal.');
    }
  };

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 className="modal-title">Aktivasi Sesi Membaca</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert-box alert-danger" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* SSO UMS Instant Login */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(56, 189, 248, 0.12) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Civitas Akademika UMS?
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
              Masuk instan dengan akun SSO UMS tanpa perlu meminta tiket token ke pustakawan.
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSsoLogin}
              disabled={ssoLoading || loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontWeight: 600,
                padding: '8px 12px',
              }}
            >
              {ssoLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} />
                  Menghubungkan ke auth.ums.ac.id...
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Masuk dengan SSO UMS
                </>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
            <span>atau gunakan kode token pustakawan</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="token-code-input">
                Kode Token Pemustaka
              </label>
              <input
                id="token-code-input"
                name="token_code"
                type="text"
                className="form-input token-input-code"
                placeholder="CONTOH: UMS-ABC123"
                value={tokenCode}
                onChange={(e) => setTokenCode(e.target.value.toUpperCase())}
                autoComplete="off"
                disabled={loading || ssoLoading}
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                *Token akan terkunci secara otomatis ke perangkat/browser ini.
              </span>
            </div>

            <div className="modal-footer" style={{ padding: '12px 0 0', borderTop: '1px solid var(--color-border)' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading || ssoLoading}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading || ssoLoading}>
                {loading ? 'Memverifikasi...' : 'Aktifkan Token'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
