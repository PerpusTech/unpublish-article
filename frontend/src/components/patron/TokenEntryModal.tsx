import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, PatronSession } from '../../services/api';

interface TokenEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: PatronSession) => void;
}

export const TokenEntryModal: React.FC<TokenEntryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tokenCode, setTokenCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">Aktivasi Token Membaca</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert-box alert-info">
              Setiap naskah skripsi/artikel unpublish dilindungi hak cipta institusional. Masukkan kode token resmi dari pustakawan untuk mengaktifkan sesi membaca Anda.
            </div>

            {error && (
              <div className="alert-box alert-danger">
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="token-code-input">
                Kode Token Pemustaka
              </label>
              <input
                id="token-code-input"
                type="text"
                className="form-input token-input-code"
                placeholder="CONTOH: UMS-ABC123"
                value={tokenCode}
                onChange={(e) => setTokenCode(e.target.value.toUpperCase())}
                autoFocus
                disabled={loading}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                *Satu token akan terkunci secara otomatis ke perangkat/browser ini hingga batas waktu habis.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Memverifikasi...' : 'Aktifkan & Mulai Membaca'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
