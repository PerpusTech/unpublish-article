import React, { useState, useEffect, useMemo } from 'react';
import { api, UserItem } from '../../services/api';
import { UserModal } from './UserModal';

interface UserManagementTableProps {
  currentAdminEmail?: string;
  onShowToast: (message: string, type?: 'success' | 'danger') => void;
}

export const UserManagementTable: React.FC<UserManagementTableProps> = ({
  currentAdminEmail,
  onShowToast,
}) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [inspectingSsoUser, setInspectingSsoUser] = useState<UserItem | null>(null);

  // Action loading per row
  const [actionLoadingEmail, setActionLoadingEmail] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.listUsers({ search: searchQuery, role: roleFilter });
      setUsers(data);
    } catch (err: any) {
      onShowToast(err.message || 'Gagal memuat pengguna', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, roleFilter]);

  // Quick toggle role: ADMIN <-> USER
  const handleToggleRole = async (user: UserItem) => {
    const isCurrentlyAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    const newRole = isCurrentlyAdmin ? 'USER' : 'ADMIN';
    const actionText = isCurrentlyAdmin
      ? `turunkan hak akses ${user.name} menjadi USER biasa (tidak bisa akses panel pustakawan)`
      : `jadikan ${user.name} sebagai ADMIN (berhak akses panel pustakawan & kelola tiket)`;

    if (!window.confirm(`Apakah Anda yakin ingin ${actionText}?`)) {
      return;
    }

    setActionLoadingEmail(user.email);
    try {
      await api.updateUser(user.email, { role: newRole });
      onShowToast(`Hak akses ${user.name} berhasil diubah menjadi ${newRole}.`);
      fetchUsers();
    } catch (err: any) {
      onShowToast(err.message || 'Gagal memperbarui hak akses.', 'danger');
    } finally {
      setActionLoadingEmail(null);
    }
  };

  // Toggle active / inactive status
  const handleToggleActive = async (user: UserItem) => {
    const newStatus = user.is_active === 1 ? 0 : 1;
    const actionText = newStatus === 1 ? 'mengaktifkan kembali' : 'menonaktifkan';

    if (!window.confirm(`Yakin ingin ${actionText} akun ${user.name} (${user.email})?`)) {
      return;
    }

    setActionLoadingEmail(user.email);
    try {
      await api.updateUser(user.email, { is_active: newStatus });
      onShowToast(`Akun ${user.name} berhasil ${newStatus === 1 ? 'diaktifkan' : 'dinonaktifkan'}.`);
      fetchUsers();
    } catch (err: any) {
      onShowToast(err.message || 'Gagal mengubah status akun.', 'danger');
    } finally {
      setActionLoadingEmail(null);
    }
  };

  // Delete user
  const handleDelete = async (user: UserItem) => {
    if (!window.confirm(`Hapus permanen akun pengguna ${user.name} (${user.email}) dari sistem?`)) {
      return;
    }

    setActionLoadingEmail(user.email);
    try {
      await api.deleteUser(user.email);
      onShowToast(`Akun ${user.name} berhasil dihapus.`);
      fetchUsers();
    } catch (err: any) {
      onShowToast(err.message || 'Gagal menghapus pengguna.', 'danger');
    } finally {
      setActionLoadingEmail(null);
    }
  };

  const isSelf = (email: string) => {
    return currentAdminEmail?.toLowerCase() === email.toLowerCase();
  };

  return (
    <div className="animated-tab-content">
      {/* Search & Actions Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 280 }}>
          {/* Real-time Search Input */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <span
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-light)',
                fontSize: 14,
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              className="form-input search-input-animated"
              style={{ paddingLeft: 34, height: 38 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau email civitas..."
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-light)',
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`pill-btn ${roleFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setRoleFilter('ALL')}
            >
              Semua
            </button>
            <button
              type="button"
              className={`pill-btn ${roleFilter === 'ADMIN' ? 'active' : ''}`}
              onClick={() => setRoleFilter('ADMIN')}
            >
              Admin ({users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length})
            </button>
            <button
              type="button"
              className={`pill-btn ${roleFilter === 'USER' ? 'active' : ''}`}
              onClick={() => setRoleFilter('USER')}
            >
              User Biasa ({users.filter((u) => u.role === 'USER').length})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchUsers}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{loading ? 'Memuat...' : 'Muat Ulang'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingUser(null);
              setIsModalOpen(true);
            }}
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>+ Tambah Pengguna Baru</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-responsive" style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '26%' }}>Pengguna Civitas</th>
              <th style={{ width: '24%' }}>Email Resmi UMS</th>
              <th style={{ width: '15%' }}>Hak Akses (Role)</th>
              <th style={{ width: '10%' }}>Status</th>
              <th style={{ width: '12%' }}>Terakhir Login</th>
              <th style={{ width: '13%', textAlign: 'right' }}>Aksi Kelola</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                  <div className="spinner-inline" /> Memuat data pengguna...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
                  {searchQuery
                    ? `Tidak ada pengguna yang cocok dengan kata kunci "${searchQuery}".`
                    : 'Belum ada data pengguna terdaftar.'}
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isAdmin = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN';
                const isSuperAdmin = u.role === 'SUPER_ADMIN';
                const self = isSelf(u.email);
                const isActionBusy = actionLoadingEmail === u.email;

                return (
                  <tr key={u.email} className="table-row-animated">
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{u.name}</span>
                        {self && <span style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 700 }}>(Anda)</span>}
                        <button
                          type="button"
                          onClick={() => setInspectingSsoUser(u)}
                          title="Lihat rincian atribut SSO & identitas civitas"
                          style={{
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface-subtle)',
                            color: 'var(--color-primary)',
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                          <span>Info SSO</span>
                        </button>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-light)', marginTop: 2 }}>
                        Terdaftar: {u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                    </td>

                    <td>
                      <code style={{ fontSize: 12, backgroundColor: 'var(--color-surface-subtle)', padding: '3px 7px', borderRadius: 4, border: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)' }}>
                        {u.email}
                      </code>
                    </td>

                    <td>
                      {isSuperAdmin ? (
                        <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Super Administrator Utama">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          <span>SUPER ADMIN</span>
                        </span>
                      ) : isAdmin ? (
                        <span className="badge badge-active" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Berhak mengakses Meja Layanan">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span>ADMIN</span>
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Pemustaka Biasa">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>USER</span>
                        </span>
                      )}
                    </td>

                    <td>
                      {u.is_active === 1 ? (
                        <span className="badge badge-publish">Aktif</span>
                      ) : (
                        <span className="badge badge-expired">Nonaktif</span>
                      )}
                    </td>

                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {u.last_login_at
                        ? new Date(u.last_login_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Belum pernah login'}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {/* Promote / Demote Button */}
                        {!isSuperAdmin && !self && (
                          <button
                            type="button"
                            className={`btn btn-sm ${isAdmin ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => handleToggleRole(u)}
                            disabled={isActionBusy}
                            title={isAdmin ? 'Ubah role menjadi USER biasa' : 'Promosikan menjadi ADMIN meja layanan'}
                            style={{ fontSize: 11, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            {isActionBusy ? (
                              '...'
                            ) : isAdmin ? (
                              <span>Jadikan User</span>
                            ) : (
                              <>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <span>Set Admin</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Toggle Active / Deactivate */}
                        {!isSuperAdmin && !self && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleActive(u)}
                            disabled={isActionBusy}
                            title={u.is_active === 1 ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            {u.is_active === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingUser(u);
                            setIsModalOpen(true);
                          }}
                          disabled={isActionBusy}
                          title="Edit nama dan hak akses"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          Edit
                        </button>

                        {/* Delete Button */}
                        {!isSuperAdmin && !self && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(u)}
                            disabled={isActionBusy}
                            title="Hapus pengguna"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* User Modal for Create & Edit */}
      <UserModal
        isOpen={isModalOpen}
        editUser={editingUser}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={(msg) => {
          onShowToast(msg, 'success');
          fetchUsers();
        }}
      />

      {/* Modal Detail Info SSO & Identitas Civitas */}
      {inspectingSsoUser && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content animated-modal" style={{ maxWidth: 540 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Detail Autentikasi SSO & Data Civitas</span>
              </h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setInspectingSsoUser(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, marginTop: 12 }}>
              <div style={{ background: 'var(--color-surface-subtle)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  Nama Lengkap Civitas
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>
                  {inspectingSsoUser.name}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--color-surface-subtle)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700 }}>Email Resmi SSO</div>
                  <div style={{ fontWeight: 600, marginTop: 4, wordBreak: 'break-all', fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>{inspectingSsoUser.email}</div>
                </div>
                <div style={{ background: 'var(--color-surface-subtle)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700 }}>Role Akses Sistem</div>
                  <div style={{ fontWeight: 800, marginTop: 4, color: inspectingSsoUser.role === 'SUPER_ADMIN' ? 'var(--color-primary)' : inspectingSsoUser.role === 'ADMIN' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                    {inspectingSsoUser.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : inspectingSsoUser.role === 'ADMIN' ? 'ADMIN LAYANAN' : 'USER PEMUSTAKA'}
                  </div>
                </div>
              </div>

              {/* Rincian Atribut SSO / Sumber Data */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text)', fontSize: 13 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span>Atribut Server CAS SSO (auth.ums.ac.id)</span>
                </div>

                {inspectingSsoUser.sso_attributes ? (() => {
                  try {
                    const attrs = JSON.parse(inspectingSsoUser.sso_attributes);
                    const entries = Object.entries(attrs);
                    if (entries.length === 0) throw new Error();
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {entries.map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
                            <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{k}</span>
                            <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })() : (
                  <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-primary)', marginBottom: 3 }}>Autentikasi CAS SSO 2.0 Aktif</div>
                    <div>
                      Server SSO CAS UMS memvalidasi tiket login via protokol CAS 2.0 XML (<code>&lt;cas:user&gt;</code>). Nama lengkap civitas disinkronisasi secara otomatis dari database repositori EPrints Kampus UMS (<code>etd2018</code>).
                    </div>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                Login Terakhir: {inspectingSsoUser.last_login_at ? new Date(inspectingSsoUser.last_login_at).toLocaleString('id-ID') : 'Belum pernah login'}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14, marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setInspectingSsoUser(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

