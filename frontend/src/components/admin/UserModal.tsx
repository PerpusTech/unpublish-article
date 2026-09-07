import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, UserItem } from '../../services/api';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  editUser?: UserItem | null;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editUser,
}) => {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<'ADMIN' | 'USER'>('ADMIN');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (editUser) {
      setName(editUser.name);
      setEmail(editUser.email);
      setRole((editUser.role === 'ADMIN' || editUser.role === 'SUPER_ADMIN') ? 'ADMIN' : 'USER');
    } else {
      setName('');
      setEmail('');
      setRole('ADMIN');
    }
    setError(null);
  }, [editUser, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    if (!trimmedEmail.endsWith('@ums.ac.id')) {
      setError('Email harus menggunakan domain resmi @ums.ac.id');
      return;
    }

    setLoading(true);
    try {
      if (editUser) {
        // Edit existing user
        await api.updateUser(editUser.email, {
          name: trimmedName,
          role,
        });
        onSuccess(`Pengguna ${trimmedName} berhasil diperbarui (Role: ${role}).`);
      } else {
        // Create new user
        await api.createUser({
          name: trimmedName,
          email: trimmedEmail,
          role,
        });
        onSuccess(`Pengguna baru ${trimmedName} berhasil didaftarkan sebagai ${role}.`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan data pengguna.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop animated-fade-in" onClick={onClose}>
      <div
        className="modal-dialog animated-modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title" style={{ fontSize: 16 }}>
              {editUser ? 'Ubah Hak Akses & Role Pengguna' : 'Tambah Pengguna Meja Layanan'}
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3 }}>
              {editUser
                ? 'Sesuaikan role admin atau pemustaka untuk akun civitas UMS ini'
                : 'Daftarkan email civitas @ums.ac.id dan tentukan hak akses perannya'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Tutup"
            style={{ padding: '4px 8px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div className="alert-box alert-danger animated-fade-in">{error}</div>}

            <div className="form-group">
              <label className="form-label" htmlFor="user-name">
                Nama Lengkap
              </label>
              <input
                id="user-name"
                name="user_name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Muhammad Arif, S.Hum."
                autoComplete="name"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="user-email">
                Email Resmi UMS (@ums.ac.id)
              </label>
              <input
                id="user-email"
                name="user_email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama_user@ums.ac.id"
                autoComplete="email"
                disabled={!!editUser}
                required
              />
              {editUser && (
                <span style={{ fontSize: 11.5, color: 'var(--color-text-light)', marginTop: 4, display: 'block' }}>
                  Alamat email tidak dapat diubah setelah terdaftar.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="user-role">
                Hak Akses / Peran (Role)
              </label>
              <select
                id="user-role"
                name="user_role"
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value as 'ADMIN' | 'USER')}
                style={{ cursor: 'pointer', width: '100%' }}
              >
                <option value="ADMIN">ADMIN — Berwenang akses Meja Layanan & kelola tiket</option>
                <option value="USER">USER — Pemustaka biasa (Dilarang masuk Meja Layanan)</option>
              </select>
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: role === 'ADMIN' ? 'var(--color-surface-subtle)' : 'transparent',
                  border: '1px dashed var(--color-border)',
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}
              >
                {role === 'ADMIN' ? (
                  <span>
                    <strong>Akses Penuh:</strong> Pengguna dapat menerbitkan token baca, melihat log audit, serta memberikan hak admin ke orang lain.
                  </span>
                ) : (
                  <span>
                    <strong>Akses Terbatas:</strong> Pengguna hanya berstatus pemustaka biasa dan tidak dapat login ke panel ini.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading} style={{ fontWeight: 700 }}>
              {loading ? 'Menyimpan...' : editUser ? 'Simpan Perubahan' : 'Daftarkan Pengguna'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
