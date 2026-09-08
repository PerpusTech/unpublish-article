import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, EPrintsDbStatus } from '../../services/api';

interface EPrintsDbStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

export const EPrintsDbStatusModal: React.FC<EPrintsDbStatusModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [status, setStatus] = useState<EPrintsDbStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const fetchStatus = async (isManualTest = false) => {
    if (isManualTest) setTesting(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getEPrintsDbStatus();
      setStatus(data);
      if (isManualTest && onShowToast) {
        if (data.connected) {
          onShowToast(`Koneksi ${data.mode === 'LIVE_MYSQL' ? 'Live MySQL' : 'Mock Adapter'} aktif (${data.latencyMs}ms)`, 'success');
        } else {
          onShowToast('Koneksi ke database EPrints gagal', 'danger');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengecek status koneksi database EPrints.');
      if (onShowToast) onShowToast('Gagal melakukan uji koneksi database', 'danger');
    } finally {
      setLoading(false);
      setTesting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLive = status?.mode === 'LIVE_MYSQL';
  const isConnected = status?.connected ?? false;

  return createPortal(
    <div
      className="modal-backdrop animated-fade-in"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal animated-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-surface-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-md)',
                backgroundColor: isLive
                  ? isConnected
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(245, 158, 11, 0.12)',
                color: isLive
                  ? isConnected
                    ? 'var(--color-success)'
                    : 'var(--color-danger)'
                  : 'var(--color-accent)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>
                Status Koneksi Database Repositori EPrints
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Diagnostik konektivitas server data MySQL & penyimpanan berkas naskah
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: 18,
              padding: 6,
              borderRadius: 6,
            }}
            title="Tutup dialog"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loading && !status ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
              <div className="spinner-inline" style={{ marginBottom: 10 }} />
              <div>Memeriksa konektivitas database EPrints...</div>
            </div>
          ) : error ? (
            <div
              style={{
                padding: 16,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--color-danger)',
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Pemeriksaan Status Gagal</div>
              <div>{error}</div>
            </div>
          ) : status ? (
            <>
              {/* Main Status Hero Banner */}
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isLive
                    ? isConnected
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'rgba(239, 68, 68, 0.08)'
                    : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${
                    isLive
                      ? isConnected
                        ? 'rgba(16, 185, 129, 0.3)'
                        : 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(245, 158, 11, 0.3)'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: isLive
                        ? isConnected
                          ? '#10b981'
                          : '#ef4444'
                        : '#f59e0b',
                      boxShadow: `0 0 0 4px ${
                        isLive
                          ? isConnected
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)'
                          : 'rgba(245, 158, 11, 0.2)'
                      }`,
                      animation: isConnected ? 'pulse 2s infinite' : 'none',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>
                      {isLive
                        ? isConnected
                          ? 'Live MySQL EPrints Terhubung'
                          : 'Koneksi Live MySQL Terputus'
                        : 'Mode Mock Adapter Repositori'}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {status.statusMessage}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fetchStatus(true)}
                  disabled={testing}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {testing ? (
                    <>
                      <div className="spinner-inline" style={{ width: 12, height: 12 }} />
                      <span>Menguji...</span>
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                      <span>Uji Koneksi Ulang</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status Metric Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-card-label" style={{ fontSize: 11 }}>Mode Repositori</div>
                  <div className="stat-card-value" style={{ fontSize: 14, marginTop: 4, fontWeight: 700 }}>
                    <span
                      className={`badge ${isLive ? 'badge-publish' : 'badge-unpublish'}`}
                      style={{ fontSize: 11.5 }}
                    >
                      {isLive ? 'LIVE MYSQL (RO)' : 'MOCK ADAPTER'}
                    </span>
                  </div>
                </div>

                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-card-label" style={{ fontSize: 11 }}>Latensi Query Ping</div>
                  <div className="stat-card-value" style={{ fontSize: 16, marginTop: 4, color: isConnected ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {status.latencyMs} ms
                  </div>
                </div>

                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-card-label" style={{ fontSize: 11 }}>Total Naskah Terindeks</div>
                  <div className="stat-card-value" style={{ fontSize: 16, marginTop: 4, color: 'var(--color-primary)' }}>
                    {status.totalArticles.toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="stat-card" style={{ padding: '12px 14px' }}>
                  <div className="stat-card-label" style={{ fontSize: 11 }}>Naskah Khusus (Unpublish)</div>
                  <div className="stat-card-value" style={{ fontSize: 16, marginTop: 4, color: 'var(--color-accent)' }}>
                    {status.unpublishArticles.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Database Parameter Details */}
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12.5,
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>Parameter Konfigurasi Server Data</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 16px' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Database Host: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{status.host}:{status.port}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Database Name: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{status.database}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Database User: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{status.user}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Pemeriksaan Terakhir: </span>
                    <span>{new Date(status.lastChecked).toLocaleTimeString('id-ID')}</span>
                  </div>
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Jalur Storage Berkas PDF: </span>
                    <code style={{ fontSize: 11.5 }}>{status.documentsPath}</code>
                  </div>
                  <span
                    className={`badge ${status.documentsPathExists ? 'badge-publish' : 'badge-unpublish'}`}
                    style={{ fontSize: 10.5 }}
                  >
                    {status.documentsPathExists ? '✓ Storage Terkoneksi' : '⚠ Storage Belum Di-mount'}
                  </span>
                </div>
              </div>

              {/* Setup Guidance Alert */}
              {!isLive && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(59, 130, 246, 0.06)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Info Pengalihan ke Live MySQL EPrints UMS:</span>
                  </strong>
                  Untuk menghubungkan ke database MySQL EPrints UMS asli, set nilai variabel <code style={{ fontSize: 11 }}>EPRINTS_USE_MOCK=false</code> dan isi kredensial <code style={{ fontSize: 11 }}>EPRINTS_DB_HOST</code>, <code style={{ fontSize: 11 }}>EPRINTS_DB_NAME</code>, <code style={{ fontSize: 11 }}>EPRINTS_DB_USER</code> pada file konfigurasi environment server.
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
