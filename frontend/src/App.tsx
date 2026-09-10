import React, { useState, useEffect } from 'react';
import { api, PatronSession, NetworkStatusResponse } from './services/api';
import { subscribeSessionSync, broadcastLogout } from './utils/sessionSync';
import { Header } from './components/Header';
import { PatronView } from './pages/PatronView';
import { AdminView } from './pages/AdminView';
import { TokenEntryModal } from './components/patron/TokenEntryModal';
import { SessionExpiryBanner } from './components/patron/SessionExpiryBanner';
import { SessionExpiredModal } from './components/patron/SessionExpiredModal';
import { ThemeToggle } from './components/ThemeToggle';

export const App: React.FC = () => {
  const [session, setSession] = useState<PatronSession | null>(() => {
    try {
      const saved = localStorage.getItem('ums_patron_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [networkStatus, setNetworkStatus] = useState<NetworkStatusResponse | null>(null);
  const [expiredSession, setExpiredSession] = useState<PatronSession | null>(null);
  const [isExpiredModalOpen, setIsExpiredModalOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'PATRON' | 'ADMIN'>(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname.toLowerCase();
    if (
      path.startsWith('/admin') ||
      path.startsWith('/login') ||
      path.startsWith('/pustakawan') ||
      params.get('view') === 'admin' ||
      params.get('sso') ||
      params.get('error') ||
      params.get('sso_pending')
    ) {
      return 'ADMIN';
    }
    return 'PATRON';
  });
  const [isClaimModalOpen, setIsClaimModalOpen] = useState<boolean>(false);
  const [initialClaimToken, setInitialClaimToken] = useState<string>('');
  const [ssoToast, setSsoToast] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);

  // Handle Patron SSO Callback & direct claim token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // 1. Handle Patron SSO Success
    if (params.get('patron_sso') === 'success') {
      const nim = params.get('nim') || '';
      const name = params.get('name') || 'Civitas Akademika UMS';
      const tokenId = params.get('token_id') || `sso_${nim}_${Date.now()}`;
      const tokenCode = params.get('token_code') || `SSO-${nim}`;
      const expiresAt = params.get('expires_at') || new Date(Date.now() + 86400000).toISOString();

      const newSession: PatronSession = {
        id: tokenId,
        token_code: tokenCode,
        patron_name: name,
        patron_nim: nim,
        expires_at: expiresAt,
        remaining_seconds: 86400,
      };

      localStorage.setItem('ums_patron_session', JSON.stringify(newSession));
      localStorage.setItem('ums_intranet_session', JSON.stringify(newSession));
      localStorage.setItem('ums_patron_token_id', newSession.id);

      setSession(newSession);
      setViewMode('PATRON');
      setSsoToast({
        message: `Identitas SSO UMS Terverifikasi: ${name} (${nim})`,
        type: 'success',
      });

      // Clear query params from URL cleanly without reload
      window.history.replaceState({}, '', '/');
      return;
    }

    // 2. Handle Patron SSO Error
    const ssoError = params.get('patron_sso_error');
    if (ssoError) {
      setSsoToast({
        message: `Autentikasi SSO UMS gagal: ${decodeURIComponent(ssoError)}`,
        type: 'danger',
      });
      window.history.replaceState({}, '', '/');
      return;
    }

    // 3. Handle direct claim token
    const claimTokenParam = params.get('claim_token') || params.get('claim');
    if (claimTokenParam) {
      setInitialClaimToken(claimTokenParam.trim().toUpperCase());
      setIsClaimModalOpen(true);
      setViewMode('PATRON');
    }
  }, []);

  // Auto-dismiss SSO toast after 6 seconds
  useEffect(() => {
    if (ssoToast) {
      const timer = setTimeout(() => {
        setSsoToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [ssoToast]);

  // Sync route on popstate (browser back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname.toLowerCase();
      if (
        path.startsWith('/admin') ||
        path.startsWith('/login') ||
        path.startsWith('/pustakawan') ||
        params.get('view') === 'admin' ||
        params.get('sso') ||
        params.get('error') ||
        params.get('sso_pending')
      ) {
        setViewMode('ADMIN');
      } else {
        setViewMode('PATRON');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Check patron session on load and periodically
  const verifyPatronSession = async () => {
    try {
      const res = await api.getSessionStatus();
      if (res.isActive && res.session) {
        const activeSession = res.session;
        setSession((prev: PatronSession | null): PatronSession => {
          if (
            prev &&
            prev.id === activeSession.id &&
            prev.token_code === activeSession.token_code &&
            prev.expires_at === activeSession.expires_at
          ) {
            return prev;
          }
          return activeSession;
        });
        localStorage.setItem('ums_patron_session', JSON.stringify(activeSession));
        localStorage.setItem('ums_patron_token_id', activeSession.id);
      } else if (!res.isActive) {
        setSession((prev) => {
          if (prev) {
            setExpiredSession(prev);
            setIsExpiredModalOpen(true);
            broadcastLogout('REVOKED');
          }
          return null;
        });
        localStorage.removeItem('ums_patron_session');
        localStorage.removeItem('ums_intranet_session');
        localStorage.removeItem('ums_patron_token_id');
      }
    } catch {
      // Keep existing cached session if offline/transient hiccup
    }
  };

  const checkNetworkStatus = async () => {
    try {
      const res = await api.getPatronNetworkStatus();
      setNetworkStatus(res);
    } catch {
      // transient failure
    }
  };

  const handleSessionExpired = () => {
    setSession((prev) => {
      if (prev) {
        setExpiredSession(prev);
        setIsExpiredModalOpen(true);
        broadcastLogout('EXPIRED');
      }
      return null;
    });
    localStorage.removeItem('ums_patron_session');
    localStorage.removeItem('ums_intranet_session');
    localStorage.removeItem('ums_patron_token_id');
  };

  // Cross-Tab Session Synchronization Listener
  useEffect(() => {
    const unsubscribe = subscribeSessionSync({
      onLogout: (reason) => {
        setSession((prev) => {
          if (prev && reason === 'USER_LOGOUT') {
            setExpiredSession(prev);
            setIsExpiredModalOpen(true);
          }
          return null;
        });
      },
      onLogin: (newSession) => {
        setSession(newSession);
        setIsExpiredModalOpen(false);
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    verifyPatronSession();
    checkNetworkStatus();

    // Check session status every 5 seconds for fast response to revocation or expiry
    const sessionInterval = setInterval(() => {
      verifyPatronSession();
    }, 5000);

    // Refresh network status every 20 seconds
    const networkInterval = setInterval(() => {
      checkNetworkStatus();
    }, 20000);

    return () => {
      clearInterval(sessionInterval);
      clearInterval(networkInterval);
    };
  }, []);

  const handleLogoutPatron = async () => {
    await api.logoutPatron();
    setSession(null);
    localStorage.removeItem('ums_patron_session');
    localStorage.removeItem('ums_intranet_session');
    localStorage.removeItem('ums_patron_token_id');
    broadcastLogout('USER_LOGOUT');
  };

  return (
    <div className="app-container">
      {/* Session Expiry Warning Banner (Visible in Patron mode when <= 5 mins left) */}
      {viewMode === 'PATRON' && (
        <SessionExpiryBanner
          session={session}
          onOpenClaimModal={() => setIsClaimModalOpen(true)}
          onLogout={handleLogoutPatron}
          onSessionExpired={handleSessionExpired}
        />
      )}

      <Header
        session={session}
        networkStatus={networkStatus}
        isAdmin={viewMode === 'ADMIN'}
        onLogoutPatron={handleLogoutPatron}
        onOpenAdmin={() => {
          setViewMode('ADMIN');
          window.history.pushState({}, '', '/admin');
        }}
        onOpenPatron={() => {
          setViewMode('PATRON');
          window.history.pushState({}, '', '/');
        }}
        onOpenClaimModal={() => setIsClaimModalOpen(true)}
      />

      {/* SSO Verification Toast / Alert Notification */}
      {ssoToast && (
        <div
          style={{
            maxWidth: 1200,
            margin: '12px auto 0',
            padding: '0 20px',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div
            className={`alert-box alert-${ssoToast.type}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: '0.88rem',
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {ssoToast.type === 'success' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              <span>{ssoToast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSsoToast(null)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'currentColor',
                opacity: 0.7,
                padding: 4,
                display: 'flex',
              }}
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="content-wrapper">
        <div key={viewMode} className="page-transition">
          {viewMode === 'PATRON' ? (
            <PatronView
              session={session}
              networkStatus={networkStatus}
              onOpenClaimModal={() => setIsClaimModalOpen(true)}
            />
          ) : (
            <AdminView
              onBackToPatron={() => {
                setViewMode('PATRON');
                window.history.pushState({}, '', '/');
              }}
            />
          )}
        </div>
      </main>

      {/* Theme toggle bar positioned directly above the footer */}
      <div className="theme-toggle-container">
        <ThemeToggle />
      </div>

      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          padding: '18px 20px',
          fontSize: 12,
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          &copy; {new Date().getFullYear()} UPT Perpustakaan dan Layanan Digital Universitas Muhammadiyah Surakarta
          <br />
          Sistem Repositori Khusus Naskah Unpublish & Berkas Terbatas
        </div>
      </footer>

      {/* Claim / Token Entry Modal */}
      <TokenEntryModal
        isOpen={isClaimModalOpen}
        initialTokenCode={initialClaimToken}
        networkStatus={networkStatus}
        onClose={() => {
          setIsClaimModalOpen(false);
          setInitialClaimToken('');
        }}
        onSuccess={(newSession: PatronSession) => {
          setSession(newSession);
          localStorage.setItem('ums_patron_session', JSON.stringify(newSession));
          localStorage.setItem('ums_patron_token_id', newSession.id);
          setViewMode('PATRON');
          setInitialClaimToken('');
        }}
      />

      {/* Session Expired Informative Dialog */}
      <SessionExpiredModal
        isOpen={isExpiredModalOpen}
        session={expiredSession}
        onOpenClaimModal={() => {
          setIsExpiredModalOpen(false);
          setIsClaimModalOpen(true);
        }}
        onClose={() => {
          setIsExpiredModalOpen(false);
          setExpiredSession(null);
        }}
      />
    </div>
  );
};

export default App;
