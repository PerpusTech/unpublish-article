import React, { useEffect, useState } from 'react';
import { PatronSession } from '../services/api';

interface HeaderProps {
  session: PatronSession | null;
  isAdmin?: boolean;
  onLogoutPatron: () => void;
  onOpenAdmin?: () => void;
  onOpenPatron?: () => void;
  onOpenClaimModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  isAdmin = false,
  onLogoutPatron,
  onOpenAdmin,
  onOpenPatron,
  onOpenClaimModal,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(session?.remaining_seconds || 0);

  useEffect(() => {
    if (!session?.remaining_seconds) {
      setSecondsLeft(0);
      return;
    }

    setSecondsLeft(session.remaining_seconds);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.remaining_seconds, session?.expires_at]);

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
            <h1 className="brand-title">UPT Perpustakaan dan Layanan Digital UMS</h1>
            <p className="brand-subtitle">Portal Repositori E-Prints — Layanan Karya Ilmiah & Akses Khusus</p>
          </div>
        </div>

        <div className="header-actions">
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

          {!session && !isAdmin && (
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
