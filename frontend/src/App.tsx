import React, { useState, useEffect } from 'react';
import { api, PatronSession, NetworkStatusResponse } from './services/api';
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

  // Handle direct claim token from URL (e.g. ?claim_token=UMS-XXXXXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const claimTokenParam = params.get('claim_token') || params.get('claim');
    if (claimTokenParam) {
      setInitialClaimToken(claimTokenParam.trim().toUpperCase());
      setIsClaimModalOpen(true);
      setViewMode('PATRON');
    }
  }, []);

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

  // Check patron session on load
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
      } else if (res.isActive === false && res.reason) {
        if (session) {
          setExpiredSession(session);
          setIsExpiredModalOpen(true);
        }
        setSession(null);
        localStorage.removeItem('ums_patron_session');
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
    if (session) {
      setExpiredSession(session);
      setIsExpiredModalOpen(true);
    }
    setSession(null);
    localStorage.removeItem('ums_patron_session');
    localStorage.removeItem('ums_patron_token_id');
  };

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
    localStorage.removeItem('ums_patron_token_id');
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
