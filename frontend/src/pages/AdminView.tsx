import React, { useState, useEffect } from 'react';
import { api, TokenAdminItem } from '../services/api';
import { ActiveSessionsTable } from '../components/admin/ActiveSessionsTable';
import { TokenGeneratorModal } from '../components/admin/TokenGeneratorModal';
import { AuditLogTable } from '../components/admin/AuditLogTable';
import { UserManagementTable } from '../components/admin/UserManagementTable';
import { AnalyticsDashboard } from '../components/admin/AnalyticsDashboard';
import { DatabaseBackupView } from '../components/admin/DatabaseBackupView';
import { DbStatusPill } from '../components/admin/DbStatusPill';
import { EPrintsDbStatusModal } from '../components/admin/EPrintsDbStatusModal';
import { SecuritySettingsView } from '../components/admin/SecuritySettingsView';

interface AdminViewProps {
  onBackToPatron: () => void;
}

interface ToastState {
  message: string;
  type: 'success' | 'danger';
}

export const AdminView: React.FC<AdminViewProps> = ({ onBackToPatron }) => {
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'TOKENS' | 'ANALYTICS' | 'AUDIT' | 'USERS' | 'SECURITY' | 'SYSTEM' | 'BACKUP'>('TOKENS');

  // Token management
  const [tokens, setTokens] = useState<TokenAdminItem[]>([]);
  const [tokensLoading, setTokensLoading] = useState<boolean>(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState<boolean>(false);

  // EPrints DB Diagnostic Modal State
  const [isDbStatusOpen, setIsDbStatusOpen] = useState<boolean>(false);

  // Login state
  const [ssoLoading, setSsoLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Toast feedback state
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = React.useCallback((message: string, type: 'success' | 'danger' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const checkAdminAuth = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminMe();
      if (data?.admin) {
        setAdminUser(data.admin);
        fetchTokens();
      } else {
        setAdminUser(null);
      }
    } catch {
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchTokens = async () => {
    setTokensLoading(true);
    try {
      const res = await api.listTokens({ limit: 1000 });
      setTokens(res.tokens || []);
    } catch (err) {
      console.error('Failed to load tokens:', err);
    } finally {
      setTokensLoading(false);
    }
  };

  useEffect(() => {
    // Check URL parameters for SSO callback messages or errors
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const ssoPending = params.get('sso_pending');
    const ssoSuccess = params.get('sso');
    const token = params.get('token');

    if (token) {
      localStorage.setItem('ums_admin_token', token);
    }

    if (err) {
      setLoginError(decodeURIComponent(err));
    } else if (ssoPending) {
      setLoginError(decodeURIComponent(ssoPending));
    } else if (ssoSuccess === 'success') {
      showToast('Berhasil masuk melalui SSO UMS.', 'success');
      window.history.replaceState({}, document.title, '/admin');
    }

    checkAdminAuth();
  }, []);

  const handleCasLogin = async () => {
    setSsoLoading(true);
    setLoginError(null);
    try {
      const res = await api.getCasLoginUrl();
      if (res.url) {
        window.location.href = res.url;
      } else {
        setLoginError('URL SSO UMS tidak tersedia.');
        setSsoLoading(false);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Gagal menghubungi gerbang SSO UMS.');
      setSsoLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    setSsoLoading(true);
    setLoginError(null);
    try {
      await api.adminLogout();
      const res = await api.getCasLoginUrl();
      if (res.switchAccountUrl) {
        window.location.href = res.switchAccountUrl;
      } else if (res.url) {
        window.location.href = `https://auth.ums.ac.id/cas/logout?service=${encodeURIComponent(res.url)}`;
      } else {
        window.location.href = `https://auth.ums.ac.id/cas/logout?service=${encodeURIComponent(window.location.origin + '/admin')}`;
      }
    } catch (err: any) {
      setLoginError(err.message || 'Gagal memproses pengalihan akun SSO.');
      setSsoLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await api.adminLogout();
      setAdminUser(null);
      if (res?.casLogoutUrl) {
        window.location.href = res.casLogoutUrl;
      } else {
        showToast('Sesi Meja Layanan telah berakhir.', 'success');
      }
    } catch {
      setAdminUser(null);
      showToast('Sesi Meja Layanan telah berakhir.', 'success');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
        <div className="spinner-inline" style={{ marginBottom: 12 }} />
        <div>Memeriksa sesi otentikasi pustakawan...</div>
      </div>
    );
  }

  // Admin Login View (Option A: Centered Modern Academic Card)
  if (!adminUser) {
    return (
      <div className="admin-auth-page animated-fade-in">
        <div className="admin-auth-card animated-modal">
          {/* Official UMS Library Brand & Logo */}
          <div className="admin-auth-logo-wrap">
            <img
              src="/img/Logo-Perpus-TP.webp"
              alt="Logo Perpustakaan UMS"
              className="admin-auth-logo-img"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                // Graceful fallback if image is unreachable
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          <h2 className="admin-auth-title">Otentikasi Pustakawan</h2>
          <p className="admin-auth-subtitle">
            Portal Otorisasi & Pengelolaan Akses Naskah EPrints Khusus UPT Perpustakaan dan Layanan Digital UMS
          </p>

          {/* Security Features Badge Line */}
          <div className="admin-auth-features">
            <span className="feat-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>SSO CAS UMS</span>
            </span>
            <span className="feat-dot">·</span>
            <span className="feat-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Token Termal</span>
            </span>
            <span className="feat-dot">·</span>
            <span className="feat-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Audit Log Terisolasi</span>
            </span>
          </div>

          {loginError && (
            <div className="alert-box alert-danger animated-fade-in" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 12, lineHeight: 1.5 }}>{loginError}</div>
              <button
                type="button"
                className="btn"
                onClick={handleSwitchAccount}
                disabled={ssoLoading}
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  border: '1px solid #ef4444',
                  color: '#b91c1c',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '9px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                <span>Ganti Akun SSO (Keluar & Masuk Akun Lain)</span>
              </button>
            </div>
          )}

          {/* Primary Action: CAS SSO UMS */}
          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="admin-sso-main-btn"
              onClick={handleCasLogin}
              disabled={ssoLoading}
            >
              {ssoLoading ? (
                <>
                  <div className="spinner-inline" style={{ width: 16, height: 16 }} />
                  <span>Menghubungkan ke SSO UMS...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  <span>Masuk dengan SSO UMS (auth.ums.ac.id)</span>
                </>
              )}
            </button>
            <div style={{ fontSize: 11.5, color: 'var(--color-text-light)', textAlign: 'center', marginTop: 10 }}>
              Khusus staf perpustakaan ber-role <strong>Admin</strong> pada SSO UMS
            </div>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-outline admin-auth-back-btn"
              onClick={onBackToPatron}
            >
              <span>← Kembali ke Katalog Pemustaka</span>
            </button>
          </div>

          <div className="admin-auth-footer">
            <span>UPT Perpustakaan dan Layanan Digital UMS · v1.0</span>
            <span className="admin-auth-status-online">
              <span className="admin-auth-status-dot" />
              <span>auth.ums.ac.id</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Active metrics calculation
  const activeCount = tokens.filter((t) => t.status === 'ACTIVE').length;
  const pendingCount = tokens.filter((t) => t.status === 'PENDING').length;
  const expiredCount = tokens.filter((t) => t.status === 'EXPIRED').length;
  const totalTokens = tokens.length;

  // Authenticated Admin Dashboard (Service Desk)
  return (
    <div>
      {/* Floating Animated Toast Notification */}
      {toast && (
        <div
          className={`floating-toast animated-toast ${toast.type === 'danger' ? 'toast-danger' : 'toast-success'}`}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {toast.type === 'danger' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Admin Subheader Bar (Librarian Station Header) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 16,
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="brand-logo-badge" style={{ fontSize: 10, padding: '2px 7px' }}>
              MEJA LAYANAN
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>UPT Perpustakaan dan Layanan Digital UMS</span>
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
              fontFamily: 'var(--font-heading)',
              margin: 0,
            }}
          >
            Meja Layanan Repositori & Tiket Pemustaka
          </h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Pustakawan:</span>
            <strong style={{ color: 'var(--color-text)' }}>{adminUser.name}</strong>
            <span style={{ color: 'var(--color-text-light)' }}>({adminUser.email})</span>
            <span className="badge badge-publish" style={{ fontSize: 10 }}>
              {adminUser.role}
            </span>
            <DbStatusPill onOpenModal={() => setIsDbStatusOpen(true)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsGeneratorOpen(true)}
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Terbitkan Tiket Pemustaka</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onBackToPatron}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span>Katalog Pemustaka</span>
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleLogout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Daily Metrics Cards (Editorial Minimalist) */}
      <div className="stat-card-grid" style={{ marginBottom: 28, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Pemustaka Aktif</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeCount}
              {activeCount > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 10,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Sesi aktif sedang berjalan"
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }} />
                </span>
              )}
            </div>
            <div className="admin-metric-subtext">Sedang membaca terkunci perangkat</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Menunggu Klaim</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">{pendingCount}</div>
            <div className="admin-metric-subtext">Tiket siap diaktivasi pemustaka</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Total Diterbitkan</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">{totalTokens}</div>
            <div className="admin-metric-subtext">Akumulasi izin baca naskah</div>
          </div>
        </div>

        <div className="admin-metric-card">
          <div className="admin-metric-header-row">
            <span className="admin-metric-label">Sesi Selesai</span>
            <div className="admin-metric-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div>
            <div className="admin-metric-number">{expiredCount}</div>
            <div className="admin-metric-subtext">Sesi telah habis masa berlakunya</div>
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs (UI/UX Pro Max) */}
      <div className="admin-tab-bar">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'TOKENS' ? 'active' : ''}`}
          onClick={() => setActiveTab('TOKENS')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M7 8h10" />
            <path d="M7 12h10" />
            <path d="M7 16h6" />
          </svg>
          <span>Sesi Pemustaka & Tiket</span>
          <span className="admin-tab-counter">{tokens.length}</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'ANALYTICS' ? 'active' : ''}`}
          onClick={() => setActiveTab('ANALYTICS')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Statistik & Analitik</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'AUDIT' ? 'active' : ''}`}
          onClick={() => setActiveTab('AUDIT')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>Audit Trail & Log Akses</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'USERS' ? 'active' : ''}`}
          onClick={() => setActiveTab('USERS')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          <span>Kelola Pengguna & Role</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'SECURITY' ? 'active' : ''}`}
          onClick={() => setActiveTab('SECURITY')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Keamanan & Jaringan UMS</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'SYSTEM' ? 'active' : ''}`}
          onClick={() => setActiveTab('SYSTEM')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <span>Status Repositori & Sistem</span>
        </button>

        <button
          type="button"
          className={`admin-tab-btn ${activeTab === 'BACKUP' ? 'active' : ''}`}
          onClick={() => setActiveTab('BACKUP')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Backup Database</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'TOKENS' && (
        <ActiveSessionsTable
          tokens={tokens}
          loading={tokensLoading}
          onRefresh={fetchTokens}
          onOpenCreate={() => setIsGeneratorOpen(true)}
          onShowToast={showToast}
        />
      )}

      {activeTab === 'ANALYTICS' && (
        <AnalyticsDashboard onShowToast={showToast} />
      )}

      {activeTab === 'AUDIT' && <AuditLogTable />}

      {activeTab === 'USERS' && (
        <UserManagementTable
          currentAdminEmail={adminUser.email}
          onShowToast={showToast}
        />
      )}

      {activeTab === 'SYSTEM' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
          {/* EPrints Database Connectivity Diagnostics Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
                    Status Koneksi Database EPrints
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    Diagnostik konektivitas MySQL repositori karya ilmiah UMS
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsDbStatusOpen(true)}
                style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>Buka Panel Diagnostik & Panduan</span>
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
              Sistem mendukung koneksi <strong>Live MySQL EPrints</strong> langsung maupun <strong>Mock Database Adapter</strong> untuk pengembangan lokal tanpa downtime. Klik tombol di atas untuk melihat detail port, latency, metrik naskah, dan verifikasi direktori dokumen.
            </p>
          </div>

          {/* Security & Isolation Card */}
          <div className="card">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Arsitektur Keamanan & Isolasi Naskah</span>
            </h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Sistem Viewer Naskah Unpublish UPT Perpustakaan dan Layanan Digital UMS dirancang dengan paradigma keamanan <strong>Zero Direct Storage Access</strong> dan <strong>Dynamic Watermarking</strong>. Dokumen PDF asli disimpan pada server repository lokal yang terisolasi dan hanya diakses melalui streaming berbasis token aktif.
            </p>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-surface-subtle)', paddingBottom: 8 }}>
                <strong>Penyimpanan Naskah:</strong>
                <span style={{ color: 'var(--color-text)' }}>Terisolasi (Non-Public Web Directory)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-surface-subtle)', paddingBottom: 8 }}>
                <strong>Streaming Engine:</strong>
                <span style={{ color: 'var(--color-text)' }}>In-Memory Token Authorization & Canvas DRM</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-surface-subtle)', paddingBottom: 8 }}>
                <strong>Proteksi Visual:</strong>
                <span style={{ color: 'var(--color-text)' }}>Watermark Dinamis (NIM, Nama, IP, Timestamp)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-surface-subtle)', paddingBottom: 8 }}>
                <strong>Batasan Perangkat:</strong>
                <span style={{ color: 'var(--color-text)' }}>1 Tiket token terikat ke 1 perangkat pemustaka (Fingerprint Lock)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Otentikasi Civitas:</strong>
                <span style={{ color: 'var(--color-text)' }}>CAS SSO UMS (<code>auth.ums.ac.id</code>) & Otorisasi Berbasis Role</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'SECURITY' && (
        <SecuritySettingsView onShowToast={showToast} />
      )}

      {activeTab === 'BACKUP' && (
        <DatabaseBackupView onShowToast={showToast} />
      )}

      {/* Modal Generator Token */}
      <TokenGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSuccess={() => {
          fetchTokens();
          showToast('Tiket pemustaka berhasil diterbitkan.');
        }}
      />

      {/* Modal Status Database EPrints */}
      <EPrintsDbStatusModal
        isOpen={isDbStatusOpen}
        onClose={() => setIsDbStatusOpen(false)}
        onShowToast={showToast}
      />
    </div>
  );
};


