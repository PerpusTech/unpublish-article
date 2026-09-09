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
      <div className="modal-dialog" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert-box alert-info" style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
              Perangkat Anda terhubung ke <strong>Jaringan Kampus UMS</strong> ({clientIp || 'Wi-Fi/Intranet'}). Masukkan identitas Anda untuk logging resmi & watermark keamanan naskah tanpa perlu meminta tiket token.
            </div>

            {error && (
              <div className="alert-box alert-danger">
                {error}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" htmlFor="patron-nim-input">
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
                autoFocus
                disabled={loading}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" htmlFor="patron-name-input">
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
                disabled={loading}
                required
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, display: 'block' }}>
                *Identitas ini akan dicantumkan secara dinamis pada watermark PDF dan audit log akses perpustakaan.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan & Mulai Membaca'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
