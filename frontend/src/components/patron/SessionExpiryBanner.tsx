import React, { useState, useEffect } from 'react';
import { PatronSession } from '../../services/api';

interface SessionExpiryBannerProps {
  session: PatronSession | null;
  onOpenClaimModal: () => void;
  onLogout: () => void;
  onSessionExpired?: () => void;
}

export const SessionExpiryBanner: React.FC<SessionExpiryBannerProps> = ({
  session,
  onOpenClaimModal,
  onLogout,
  onSessionExpired,
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => session?.remaining_seconds || 0);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [hasNotifiedExpired, setHasNotifiedExpired] = useState<boolean>(false);

  useEffect(() => {
    if (!session) {
      setSecondsLeft(0);
      setHasNotifiedExpired(false);
      return;
    }

    // Initialize or compute from expires_at if available
    if (session.expires_at) {
      const expTime = new Date(session.expires_at).getTime();
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((expTime - now) / 1000));
      setSecondsLeft(diffSecs);
    } else if (session.remaining_seconds) {
      setSecondsLeft(session.remaining_seconds);
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!hasNotifiedExpired && onSessionExpired) {
            setHasNotifiedExpired(true);
            onSessionExpired();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.id, session?.expires_at, session?.remaining_seconds]);

  // If no session or more than 5 minutes (300 seconds) remaining, keep banner quiet/hidden
  if (!session || secondsLeft <= 0 || secondsLeft > 300) {
    return null;
  }

  const isCritical = secondsLeft <= 120; // 2 minutes or less

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Minimized Floating Pill Mode
  if (isMinimized) {
    return (
      <aside
        aria-label="Peringatan sesi membaca terminimalisir"
        className={`session-expiry-pill ${isCritical ? 'critical' : 'warning'}`}
        onClick={() => setIsMinimized(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsMinimized(false);
        }}
        title="Klik untuk membuka detail peringatan waktu membaca"
      >
        <div className="session-expiry-pill-dot" />
        <span style={{ fontWeight: 700 }}>
          {isCritical ? ' Sisa Waktu:' : ' Sisa Waktu:'}
        </span>
        <span className="session-expiry-pill-timer">{formatTimer(secondsLeft)}</span>
        <span className="session-expiry-pill-expand" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </span>
      </aside>
    );
  }

  // Full Warning Banner Mode
  return (
    <aside
      aria-label="Peringatan masa aktif sesi membaca"
      className={`session-expiry-banner ${isCritical ? 'banner-critical' : 'banner-warning'}`}
      role="alert"
    >
      <div className="session-expiry-banner-inner">
        <div className="session-expiry-banner-icon">
          {isCritical ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
        </div>

        <div className="session-expiry-banner-content">
          <div className="session-expiry-banner-title">
            <span>
              {isCritical
                ? 'Sesi Membaca Anda Hampir Berakhir!'
                : 'Peringatan: Masa Aktif Sesi Membaca Segera Berakhir'}
            </span>
            <span className="session-expiry-countdown-tag">
              <span className="countdown-pulse-dot" />
              Sisa Waktu: <strong>{formatTimer(secondsLeft)}</strong>
            </span>
          </div>
          <div className="session-expiry-banner-desc">
            {isCritical
              ? 'Waktu membaca tersisa kurang dari 2 menit. Segera selesaikan telaah dokumen atau masukkan tiket token baru agar akses tidak terputus.'
              : 'Sesi tiket membaca Anda akan habis dalam waktu dekat. Anda dapat memperpanjang atau mengaktifkan tiket baru kapan saja.'}
          </div>
        </div>

        <div className="session-expiry-banner-actions">
          <button
            type="button"
            className="btn btn-sm session-banner-btn-primary"
            onClick={onOpenClaimModal}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
            <span>Aktivasi / Perpanjang Tiket</span>
          </button>

          <button
            type="button"
            className="btn btn-sm session-banner-btn-secondary"
            onClick={() => setIsMinimized(true)}
            title="Ciutkan notifikasi ke sudut layar agar tidak mengganggu bacaan"
          >
            <span>Ciutkan</span>
          </button>

          <button
            type="button"
            className="btn btn-sm session-banner-btn-ghost"
            onClick={onLogout}
            title="Selesaikan sesi membaca sekarang"
          >
            <span>Selesai & Keluar</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
