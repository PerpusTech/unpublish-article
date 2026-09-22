import React, { useState, useEffect, useCallback } from 'react';
import { api, UserItem } from '../../services/api';
import { UserModal } from './UserModal';
import {
  Button,
  Badge,
  Modal,
  ModalBody,
  ModalFooter,
  FormInput,
  PaginationControls,
  ConfirmModal,
} from '../common';
import { formatDateTime, formatDate } from '../../utils/date';

interface UserManagementTableProps {
  currentAdminEmail?: string;
  currentAdminRole?: string;
  onShowToast: (message: string, type?: 'success' | 'danger') => void;
}

export const UserManagementTable: React.FC<UserManagementTableProps> = ({
  currentAdminEmail,
  currentAdminRole,
  onShowToast,
}) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Pagination refs to avoid stale closures in background refresh
  const currentPageRef = React.useRef(currentPage);
  currentPageRef.current = currentPage;
  const pageSizeRef = React.useRef(pageSize);
  pageSizeRef.current = pageSize;

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [inspectingSsoUser, setInspectingSsoUser] = useState<UserItem | null>(null);

  // Confirm modal state
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: React.ReactNode;
    confirmText: string;
    confirmVariant: 'danger' | 'warning' | 'primary';
    action: () => Promise<void>;
  } | null>(null);

  // Action loading per row
  const [actionLoadingEmail, setActionLoadingEmail] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (targetPage?: number, targetPageSize?: number, isSilent = false) => {
      const pageToFetch = targetPage ?? currentPageRef.current;
      const sizeToFetch = targetPageSize ?? pageSizeRef.current;

      if (!isSilent) {
        setLoading(true);
      }
      try {
        const res = await api.listUsers({
          search: searchQuery.trim() || undefined,
          role: roleFilter !== 'ALL' ? roleFilter : undefined,
          page: pageToFetch,
          limit: sizeToFetch,
        });

        setUsers(res.users || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setCurrentPage(res.page || pageToFetch);
        currentPageRef.current = res.page || pageToFetch;
      } catch (err: any) {
        if (!isSilent) {
          onShowToast(err.message || 'Gagal memuat pengguna', 'danger');
        }
      } finally {
        if (!isSilent) {
          setLoading(false);
        }
      }
    },
    [searchQuery, roleFilter, onShowToast]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1, pageSizeRef.current);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, roleFilter]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || loading) return;
    setCurrentPage(newPage);
    currentPageRef.current = newPage;
    fetchUsers(newPage, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    pageSizeRef.current = newSize;
    setCurrentPage(1);
    currentPageRef.current = 1;
    fetchUsers(1, newSize);
  };

  // Toggle Role (USER <-> ADMIN)
  const promptToggleRole = (user: UserItem) => {
    const isDemoting = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    const newRole = isDemoting ? 'USER' : 'ADMIN';

    setConfirmAction({
      title: isDemoting ? 'Ubah Hak Akses menjadi User Biasa' : 'Promosikan menjadi Staf Admin',
      message: (
        <div>
          Apakah Anda yakin ingin mengubah hak akses <strong>{user.name}</strong> ({user.email}) menjadi{' '}
          <strong style={{ color: isDemoting ? 'var(--color-text-muted)' : 'var(--color-primary)' }}>
            {newRole}
          </strong>?
          {isDemoting ? (
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-danger)' }}>
              Pengguna ini tidak akan dapat mengakses Meja Layanan Admin lagi.
            </p>
          ) : (
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Pengguna akan dapat membuat tiket token dan mengelola artikel di meja layanan.
            </p>
          )}
        </div>
      ),
      confirmText: isDemoting ? 'Jadikan User Biasa' : 'Jadikan Admin',
      confirmVariant: isDemoting ? 'warning' : 'primary',
      action: async () => {
        setActionLoadingEmail(user.email);
        try {
          await api.updateUser(user.email, { role: newRole });
          onShowToast(`Hak akses ${user.name} berhasil diubah menjadi ${newRole}.`);
          fetchUsers();
        } catch (err: any) {
          onShowToast(err.message || 'Gagal mengubah role pengguna.', 'danger');
        } finally {
          setActionLoadingEmail(null);
        }
      },
    });
  };

  // Toggle Active status
  const promptToggleActive = (user: UserItem) => {
    const isDeactivating = user.is_active === 1;
    const newStatus = isDeactivating ? 0 : 1;

    setConfirmAction({
      title: isDeactivating ? 'Nonaktifkan Akun Pengguna' : 'Aktifkan Kembali Akun Pengguna',
      message: (
        <div>
          Apakah Anda yakin ingin {isDeactivating ? 'menonaktifkan' : 'mengaktifkan kembali'} akun{' '}
          <strong>{user.name}</strong> ({user.email})?{' '}
          {isDeactivating ? 'Pengguna tidak akan dapat login ke sistem.' : 'Pengguna dapat kembali mengakses sistem.'}
        </div>
      ),
      confirmText: isDeactivating ? 'Nonaktifkan' : 'Aktifkan',
      confirmVariant: isDeactivating ? 'warning' : 'primary',
      action: async () => {
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
      },
    });
  };

  // Delete user
  const promptDelete = (user: UserItem) => {
    setConfirmAction({
      title: 'Hapus Permanen Akun Pengguna',
      message: (
        <div>
          Apakah Anda yakin ingin menghapus permanen akun <strong>{user.name}</strong> (
          <code>{user.email}</code>)? Seluruh data profil dan riwayat akun ini akan dihapus dari sistem.
        </div>
      ),
      confirmText: 'Hapus Permanen',
      confirmVariant: 'danger',
      action: async () => {
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
      },
    });
  };

  const isSelf = (email: string) => {
    return currentAdminEmail?.toLowerCase() === email.toLowerCase();
  };

  const exportUrl = api.getUsersExportUrl({
    search: searchQuery.trim() || undefined,
    role: roleFilter !== 'ALL' ? roleFilter : undefined,
  });

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
          {/* Real-time Search Input */}
          <div style={{ flex: 1, maxWidth: 360 }}>
            <FormInput
              id="user-management-search-input"
              name="user_search"
              placeholder="Cari nama atau email civitas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              }
              rightElement={
                searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-light)',
                      fontSize: 12,
                      padding: 4,
                    }}
                  >
                    ✕
                  </button>
                ) : undefined
              }
              containerStyle={{ marginBottom: 0 }}
            />
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
              Admin
            </button>
            <button
              type="button"
              className={`pill-btn ${roleFilter === 'USER' ? 'active' : ''}`}
              onClick={() => setRoleFilter('USER')}
            >
              User Biasa
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Export Excel Button */}
          <a
            href={exportUrl}
            className="btn btn-secondary btn-sm"
            download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            title="Unduh daftar pengguna format Excel (.xlsx) dengan border rapi"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Ekspor Excel ({total.toLocaleString('id-ID')})</span>
          </a>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchUsers()}
            isLoading={loading}
            loadingText="Memuat..."
            leftIcon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            }
          >
            Muat Ulang
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingUser(null);
              setIsModalOpen(true);
            }}
            style={{ fontWeight: 700 }}
            leftIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            + Tambah Pengguna Baru
          </Button>
        </div>
      </div>

      {/* Top Pagination */}
      <PaginationControls
        position="top"
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={total}
        itemLabel="pengguna"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />

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
                        Terdaftar: {formatDate(u.created_at)}
                      </div>
                    </td>

                    <td>
                      <code style={{ fontSize: 12, backgroundColor: 'var(--color-surface-subtle)', padding: '3px 7px', borderRadius: 4, border: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)' }}>
                        {u.email}
                      </code>
                    </td>

                    <td>
                      {isSuperAdmin ? (
                        <Badge
                          variant="primary"
                          icon={
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          }
                          title="Super Administrator Utama"
                        >
                          SUPER ADMIN
                        </Badge>
                      ) : isAdmin ? (
                        <Badge
                          variant="active"
                          icon={
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                          }
                          title="Berhak mengakses Meja Layanan"
                        >
                          ADMIN
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          icon={
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          }
                          title="Pemustaka Biasa"
                        >
                          USER
                        </Badge>
                      )}
                    </td>

                    <td>
                      {u.is_active === 1 ? (
                        <Badge variant="publish">Aktif</Badge>
                      ) : (
                        <Badge variant="expired">Nonaktif</Badge>
                      )}
                    </td>

                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {u.last_login_at
                        ? formatDateTime(u.last_login_at, {
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
                          <Button
                            variant={isAdmin ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => promptToggleRole(u)}
                            isLoading={isActionBusy}
                            disabled={isActionBusy}
                            title={isAdmin ? 'Ubah role menjadi USER biasa' : 'Promosikan menjadi ADMIN meja layanan'}
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            leftIcon={
                              !isAdmin && !isActionBusy ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              ) : undefined
                            }
                          >
                            {isAdmin ? 'Jadikan User' : 'Set Admin'}
                          </Button>
                        )}

                        {/* Toggle Active / Deactivate */}
                        {!isSuperAdmin && !self && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => promptToggleActive(u)}
                            disabled={isActionBusy}
                            title={u.is_active === 1 ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            {u.is_active === 1 ? 'Nonaktifkan' : 'Aktifkan'}
                          </Button>
                        )}

                        {/* Edit Button */}
                        {isSuperAdmin && currentAdminRole !== 'SUPER_ADMIN' ? (
                          <Badge
                            variant="secondary"
                            style={{
                              fontSize: 10.5,
                              padding: '5px 8px',
                              opacity: 0.85,
                              cursor: 'not-allowed',
                            }}
                            icon={
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                            }
                            title="Akun Super Admin terproteksi. Hanya sesama Super Admin yang berwenang mengubah akun ini."
                          >
                            Terproteksi
                          </Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingUser(u);
                              setIsModalOpen(true);
                            }}
                            disabled={isActionBusy}
                            title="Edit nama dan hak akses"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            Edit
                          </Button>
                        )}

                        {/* Delete Button */}
                        {currentAdminRole === 'SUPER_ADMIN' && !isSuperAdmin && !self && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => promptDelete(u)}
                            disabled={isActionBusy}
                            title="Hapus pengguna"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            Hapus
                          </Button>
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

      {/* Bottom Pagination */}
      <PaginationControls
        position="bottom"
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={total}
        itemLabel="pengguna"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />

      {/* User Modal for Create & Edit */}
      <UserModal
        isOpen={isModalOpen}
        editUser={editingUser}
        currentAdminRole={currentAdminRole}
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
      <Modal
        isOpen={Boolean(inspectingSsoUser)}
        onClose={() => setInspectingSsoUser(null)}
        title="Detail Autentikasi SSO & Data Civitas"
        size="md"
        headerIcon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        }
        footer={
          <Button variant="secondary" size="sm" onClick={() => setInspectingSsoUser(null)}>
            Tutup
          </Button>
        }
      >
        {inspectingSsoUser && (
          <ModalBody style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5 }}>
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
              Login Terakhir: {inspectingSsoUser.last_login_at ? formatDateTime(inspectingSsoUser.last_login_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Belum pernah login'}
            </div>
          </ModalBody>
        )}
      </Modal>

      {/* Modern Confirm Action Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmText={confirmAction?.confirmText || 'Konfirmasi'}
        confirmVariant={confirmAction?.confirmVariant || 'danger'}
        isLoading={Boolean(actionLoadingEmail)}
        onConfirm={async () => {
          if (confirmAction) {
            await confirmAction.action();
            setConfirmAction(null);
          }
        }}
        onClose={() => {
          if (!actionLoadingEmail) setConfirmAction(null);
        }}
      />
    </div>
  );
};
