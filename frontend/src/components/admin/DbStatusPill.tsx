import React, { useState, useEffect } from 'react';
import { api, EPrintsDbStatus } from '../../services/api';
import { StatusPill } from '../common';

export interface DbStatusPillProps {
  onOpenModal: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Diagnostic status pill button displaying live database latency, mode (MySQL vs Mock),
 * and connection status.
 */
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

  const pillStatus = isLive
    ? isConnected
      ? 'success'
      : 'danger'
    : 'warning';

  const dotColor = isLive
    ? isConnected
      ? '#10b981'
      : '#ef4444'
    : '#f59e0b';

  const labelText = loading
    ? 'Cek DB...'
    : isLive
    ? isConnected
      ? `Live MySQL (${status?.latencyMs ?? 0}ms)`
      : 'MySQL Putus'
    : `Mock Adapter (${status?.totalArticles || 6} Naskah)`;

  return (
    <StatusPill
      status={pillStatus}
      dotColor={dotColor}
      pulse={isLive && isConnected}
      onClick={onOpenModal}
      className={`db-status-pill ${className}`}
      style={{
        fontSize: 11.5,
        padding: '4px 10px',
        ...style,
      }}
    >
      <span>{labelText}</span>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--color-text-muted)', marginLeft: 2 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </StatusPill>
  );
};
