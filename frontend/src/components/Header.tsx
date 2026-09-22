import React, { useEffect, useState } from 'react';
import { PatronSession, NetworkStatusResponse } from '../services/api';

interface HeaderProps {
  session: PatronSession | null;
  networkStatus?: NetworkStatusResponse | null;
  isAdmin?: boolean;
  onLogoutPatron: () => void;
  onOpenAdmin?: () => void;
  onOpenPatron?: () => void;
  onOpenClaimModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  networkStatus,
  isAdmin = false,
  onLogoutPatron,
  onOpenAdmin,
  onOpenPatron,
  onOpenClaimModal,
}) => {
  const getEffectiveSecondsLeft = (): number => {
    if (!session) return 0;
    if (session.expires_at) {
      const diff = Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return session.remaining_seconds || 0;
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(getEffectiveSecondsLeft);

  useEffect(() => {
    const initial = getEffectiveSecondsLeft();
    setSecondsLeft(initial);
    if (initial <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (session?.expires_at) {
          const current = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
          if (current <= 0) {
            clearInterval(interval);
            return 0;
          }
          return current;
        }
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.remaining_seconds, session?.expires_at, session?.id]);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerClass = () => {
    if (secondsLeft <= 180) return 'session-timer-badge critical';
    if (secondsLeft <= 600) return 'session-timer-badge warning';
    return 'session-timer-badge';
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <div
          className="brand-section"
          style={{ cursor: onOpenPatron ? 'pointer' : 'default' }}
          onClick={onOpenPatron}
          role={onOpenPatron ? 'button' : undefined}
          tabIndex={onOpenPatron ? 0 : undefined}
          onKeyDown={(e) => {
            if (onOpenPatron && (e.key === 'Enter' || e.key === ' ')) {
              onOpenPatron();
            }
          }}
        >
          <img
            src="/img/logo4a.png"
            alt="UPT Perpustakaan dan Layanan Digital UMS"
            className="brand-logo-img brand-logo-light"
          />
          <img
            src="/img/logo4.png"
            alt="UPT Perpustakaan dan Layanan Digital UMS"
            className="brand-logo-img brand-logo-dark"
          />
          <div>
            <h1 style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
              fontFamily: 'var(--font-heading)',
              margin: 0,
            }}>UPT Perpustakaan dan Layanan Digital UMS</h1>
            <p className="brand-subtitle">Portal Repositori E-Prints — Layanan Karya Ilmiah & Akses Khusus</p>
          </div>
        </div>

        <div className="header-actions">
          {/* UMS Campus Network Status Badge */}
          {networkStatus && !isAdmin && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                backgroundColor: networkStatus.isUmsNetwork
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(100, 116, 139, 0.12)',
                border: `1px solid ${networkStatus.isUmsNetwork
                  ? 'rgba(16, 185, 129, 0.3)'
                  : 'rgba(100, 116, 139, 0.25)'
                  }`,
                color: networkStatus.isUmsNetwork ? '#10b981' : 'var(--color-text-muted)',
                fontSize: 12,
                fontWeight: 600,
              }}
              title={`Status IP: ${networkStatus.clientIp} (${networkStatus.message})`}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: networkStatus.isUmsNetwork ? '#10b981' : '#94a3b8',
                  boxShadow: networkStatus.isUmsNetwork ? '0 0 6px #10b981' : 'none',
                }}
              />
              <span>
                {networkStatus.isUmsNetwork
                  ? 'Wi-Fi / Jaringan UMS'
                  : networkStatus.accessMode === 'UMS_NETWORK_ONLY'
                    ? 'Luar Kampus (Terkunci)'
                    : 'Luar Kampus (Perlu Token)'}
              </span>
            </div>
          )}

          {session && (
            <div className={getTimerClass()}>
              <span>Sisa Sesi:</span>
              <span className="timer-countdown">{formatTimer(secondsLeft)}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>({session.patron_nim})</span>
              <button
                type="button"
                onClick={onLogoutPatron}
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 6, padding: '2px 6px', fontSize: 11 }}
                title="Keluar dari sesi"
              >
                Tutup Sesi
              </button>
            </div>
          )}

          {!session && !isAdmin && !networkStatus?.canReadDirectly && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenClaimModal}
            >
              Aktivasi Token Membaca
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
