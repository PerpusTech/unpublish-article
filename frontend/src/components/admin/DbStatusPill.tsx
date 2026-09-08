import React, { useState, useEffect } from 'react';
import { api, EPrintsDbStatus } from '../../services/api';

interface DbStatusPillProps {
  onOpenModal: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const DbStatusPill: React.FC<DbStatusPillProps> = ({ onOpenModal, className = '', style = {} }) => {
  const [status, setStatus] = useState<EPrintsDbStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStatus = async () => {
    try {
      const data = await api.getEPrintsDbStatus();
      setStatus(data);
    } catch {
      // keep fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Re-check periodically every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isLive = status?.mode === 'LIVE_MYSQL';
  const isConnected = status?.connected ?? false;

  const dotColor = isLive
    ? isConnected
      ? '#10b981'
      : '#ef4444'
    : '#f59e0b';

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className={`db-status-pill ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '4px 10px',
        backgroundColor: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
        borderRadius: 9999,
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--color-text)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        ...style,
      }}
      title="Klik untuk melihat diagnostik & status koneksi database repositori EPrints"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: dotColor,
          display: 'inline-block',
          boxShadow: `0 0 0 2px ${isLive && isConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
        }}
      />
      <span>
        {loading
          ? 'Cek DB...'
          : isLive
          ? isConnected
            ? `Live MySQL (${status?.latencyMs}ms)`
            : 'MySQL Putus'
          : `Mock Adapter (${status?.totalArticles || 6} Naskah)`}
      </span>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
};
