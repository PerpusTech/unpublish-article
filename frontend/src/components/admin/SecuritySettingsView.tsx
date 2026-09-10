import React, { useState, useEffect } from 'react';
import {
  api,
  AccessControlMode,
  SecuritySettingsResponse,
} from '../../services/api';
import { formatDateTime } from '../../utils/date';

interface SecuritySettingsViewProps {
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

const DEFAULT_UMS_SUBNETS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.1',
  '::1',
  'localhost',
];

export const SecuritySettingsView: React.FC<SecuritySettingsViewProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [currentClientIp, setCurrentClientIp] = useState<string>('127.0.0.1');
  const [isClientInUms, setIsClientInUms] = useState<boolean>(true);

  // Active form states
  const [selectedMode, setSelectedMode] = useState<AccessControlMode>('HYBRID');
  const [ipList, setIpList] = useState<string[]>([]);
  const [newIpInput, setNewIpInput] = useState<string>('');
  const [ipInputError, setIpInputError] = useState<string | null>(null);
  const [lastUpdatedInfo, setLastUpdatedInfo] = useState<{ at?: string; by?: string }>({});

  // Simulator state
  const [testIpInput, setTestIpInput] = useState<string>('');
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    isInUms: boolean;
    matchingRule?: string;
  } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res: SecuritySettingsResponse = await api.getAdminSecuritySettings();
      if (res && res.settings) {
        setSelectedMode(res.settings.accessMode);
        setIpList(res.settings.umsIpWhitelist || DEFAULT_UMS_SUBNETS);
        setLastUpdatedInfo({
          at: res.settings.updatedAt,
          by: res.settings.updatedBy,
        });
        setCurrentClientIp(res.currentClientIp || '127.0.0.1');
        setIsClientInUms(!!res.isCurrentClientInUmsNetwork);
      }
    } catch (err: any) {
      onShowToast?.(err.message || 'Gagal memuat pengaturan keamanan.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Simple CIDR / IP validation helper
  const validateIpOrCidr = (value: string): boolean => {
    const val = value.trim();
    if (!val) return false;
    if (val === 'localhost' || val === '::1') return true;

    // IPv4 standard or CIDR (e.g. 10.0.0.0/8, 192.168.1.1)
    const ipv4CidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/;
    if (ipv4CidrRegex.test(val)) {
      const parts = val.split('/')[0].split('.');
      return parts.every((p) => {
        const num = parseInt(p, 10);
        return num >= 0 && num <= 255;
      });
    }

    // IPv6
    if (val.includes(':')) return true;

    return false;
  };

  const handleAddIp = () => {
    const trimmed = newIpInput.trim();
    if (!trimmed) return;

    if (!validateIpOrCidr(trimmed)) {
      setIpInputError('Format IP / CIDR tidak valid (contoh: 10.0.0.0/8, 192.168.1.50, ::1)');
      return;
    }

    if (ipList.includes(trimmed)) {
      setIpInputError('Subnet / IP ini sudah ada di dalam daftar whitelist.');
      return;
    }

    setIpList([...ipList, trimmed]);
    setNewIpInput('');
    setIpInputError(null);
  };

  const handleRemoveIp = (indexToRemove: number) => {
    if (ipList.length <= 1) {
      onShowToast?.('Daftar subnet tidak boleh kosong minimal 1 entri.', 'danger');
      return;
    }
    setIpList(ipList.filter((_, idx) => idx !== indexToRemove));
  };

  const handleResetToDefaults = () => {
    if (confirm('Kembalikan daftar subnet UMS ke konfigurasi standar (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, localhost)?')) {
      setIpList(DEFAULT_UMS_SUBNETS);
      onShowToast?.('Daftar subnet dikembalikan ke default.', 'success');
    }
  };

  const handleSaveSettings = async () => {
    if (ipList.length === 0) {
      onShowToast?.('Daftar IP / Subnet tidak boleh kosong.', 'danger');
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateAdminSecuritySettings(selectedMode, ipList);
      if (res.success) {
        onShowToast?.('Pengaturan kebijakan keamanan & jaringan UMS berhasil disimpan!', 'success');
        await fetchSettings();
      } else {
        onShowToast?.(res.message || 'Gagal menyimpan pengaturan.', 'danger');
      }
    } catch (err: any) {
      onShowToast?.(err.message || 'Gagal menyimpan pengaturan keamanan.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  // Live client-side simulator helper
  const handleTestIp = () => {
    const raw = testIpInput.trim();
    if (!raw) {
      setTestResult(null);
      return;
    }

    // Direct check against list
    let matchedRule: string | undefined = undefined;
    const isMatched = ipList.some((rule) => {
      const r = rule.trim();
      if (r === raw) {
        matchedRule = r;
        return true;
      }
      if (r.includes('/')) {
        const [net, mask] = r.split('/');
        const maskNum = parseInt(mask, 10);
        if (maskNum === 8 && raw.startsWith(net.split('.')[0] + '.')) {
          matchedRule = r;
          return true;
        }
        if (maskNum === 16 && raw.startsWith(net.split('.').slice(0, 2).join('.') + '.')) {
          matchedRule = r;
          return true;
        }
        if (maskNum === 24 && raw.startsWith(net.split('.').slice(0, 3).join('.') + '.')) {
          matchedRule = r;
          return true;
        }
      }
      return false;
    });

    setTestResult({
      tested: true,
      isInUms: isMatched,
      matchingRule: matchedRule,
    });
  };

  if (loading) {
    return (
      <div className="card animated-fade-in" style={{ padding: 40, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--color-text-muted)' }}>Memuat pengaturan keamanan & jaringan...</div>
      </div>
    );
  }

  return (
    <div className="animated-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      {/* 1. Header Banner & Diagnostics */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="badge badge-primary" style={{ fontSize: 11, fontWeight: 700 }}>
                JARINGAN & KEAMANAN
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Sistem Kontrol Akses Kampus UMS
              </span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>
              Pengaturan Keamanan & Kebijakan Jaringan UMS
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              Tentukan mekanisme akses naskah: Batasi khusus Jaringan Kampus UMS (Wi-Fi/LAN), Sistem Tiket Token Pustakawan, atau Mode Fleksibel (Hybrid).
            </p>
          </div>

          {/* Current IP & Status Indicator */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              backgroundColor: isClientInUms ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${isClientInUms ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: isClientInUms ? '#10b981' : '#ef4444',
                boxShadow: isClientInUms ? '0 0 10px #10b981' : '0 0 10px #ef4444',
              }}
            />
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-light)', fontWeight: 600 }}>IP Perangkat Anda</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text)' }}>
                {currentClientIp}
              </div>
              <div style={{ fontSize: 11, color: isClientInUms ? '#10b981' : '#ef4444', fontWeight: 600, marginTop: 2 }}>
                {isClientInUms ? '✓ Terdeteksi di Jaringan UMS' : '⚠ Di Luar Jaringan UMS'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Security Policy Selection Mode (3 Cards) */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text)' }}>
          1. Pilih Kebijakan Akses Repositori
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 16 }}>
          {/* Mode 1: HYBRID */}
          <div
            onClick={() => setSelectedMode('HYBRID')}
            style={{
              padding: '18px 20px',
              borderRadius: 12,
              border: `2px solid ${selectedMode === 'HYBRID' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              backgroundColor: selectedMode === 'HYBRID' ? 'rgba(2, 132, 199, 0.08)' : 'var(--color-bg-subtle)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            {selectedMode === 'HYBRID' && (
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 20,
                }}
              >
                AKTIF
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(2, 132, 199, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                  Mode Fleksibel (Hybrid)
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}>
                  Rekomendasi Utama
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              Pemustaka di Wi-Fi / Jaringan UMS dapat <strong>langsung membaca</strong> naskah tanpa token. Pemustaka di luar kampus <strong>wajib menggunakan token aktif</strong> dari pustakawan.
            </p>
          </div>

          {/* Mode 2: UMS_NETWORK_ONLY */}
          <div
            onClick={() => setSelectedMode('UMS_NETWORK_ONLY')}
            style={{
              padding: '18px 20px',
              borderRadius: 12,
              border: `2px solid ${selectedMode === 'UMS_NETWORK_ONLY' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              backgroundColor: selectedMode === 'UMS_NETWORK_ONLY' ? 'rgba(2, 132, 199, 0.08)' : 'var(--color-bg-subtle)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            {selectedMode === 'UMS_NETWORK_ONLY' && (
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 20,
                }}
              >
                AKTIF
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                  Jaringan Kampus UMS Saja
                </div>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                  Intranet / Wi-Fi Kampus
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              Naskah <strong>hanya dapat dibaca</strong> dari jaringan kampus UMS. Akses di luar kampus ditolak otomatis dengan pesan informatif. Token dinonaktifkan sementara.
            </p>
          </div>

          {/* Mode 3: TOKEN_ONLY */}
          <div
            onClick={() => setSelectedMode('TOKEN_ONLY')}
            style={{
              padding: '18px 20px',
              borderRadius: 12,
              border: `2px solid ${selectedMode === 'TOKEN_ONLY' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              backgroundColor: selectedMode === 'TOKEN_ONLY' ? 'rgba(2, 132, 199, 0.08)' : 'var(--color-bg-subtle)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
            }}
          >
            {selectedMode === 'TOKEN_ONLY' && (
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 20,
                }}
              >
                AKTIF
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                  Khusus Tiket Token
                </div>
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                  Verifikasi Meja Layanan
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              <strong>Semua pemustaka</strong> (di dalam maupun di luar kampus) wajib memasukkan token aktif yang diterbitkan oleh pustakawan di meja layanan.
            </p>
          </div>
        </div>
      </div>

      {/* 3. UMS Network IP / Subnet Whitelist Manager */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>
              2. Daftar Subnet & IP Kampus UMS (Whitelist)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
              Alamat IP atau CIDR yang dikenali sebagai jaringan resmi kampus Universitas Muhammadiyah Surakarta.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResetToDefaults}
            style={{ fontSize: 12 }}
          >
            Reset ke Default UMS
          </button>
        </div>

        {/* Add new IP Input */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Tambah Subnet CIDR / IP (contoh: 10.20.0.0/16, 172.16.5.0/24, 103.23.xxx.xxx)"
            value={newIpInput}
            onChange={(e) => {
              setNewIpInput(e.target.value);
              setIpInputError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddIp();
              }
            }}
            style={{ flex: 1, minWidth: 260, fontFamily: 'monospace', fontSize: 13 }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAddIp}
            style={{ padding: '8px 18px', fontWeight: 600 }}
          >
            + Tambah Subnet
          </button>
        </div>

        {ipInputError && (
          <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{ipInputError}</span>
          </div>
        )}

        {/* IP List Table */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {ipList.map((ip, index) => (
            <div
              key={index}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border)',
                fontFamily: 'monospace',
                fontSize: 13,
                color: 'var(--color-text)',
              }}
            >
              <span style={{ fontWeight: 600 }}>{ip}</span>
              <button
                type="button"
                onClick={() => handleRemoveIp(index)}
                title="Hapus subnet ini"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Real-time IP Diagnostic Simulator */}
      <div className="card" style={{ padding: '20px 24px', backgroundColor: 'var(--color-bg-subtle)' }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', color: 'var(--color-text)' }}>
          🔍 Simulator Pengujian IP
        </h4>
        <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
          Uji alamat IP tertentu untuk memeriksa apakah IP tersebut diizinkan sebagai Jaringan UMS di bawah konfigurasi saat ini.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Masukkan IP untuk simulasi (misal: 10.15.2.80 atau 114.122.1.2)"
            value={testIpInput}
            onChange={(e) => setTestIpInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleTestIp();
              }
            }}
            style={{ maxWidth: 380, fontFamily: 'monospace', fontSize: 13 }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleTestIp}
            style={{ padding: '8px 16px' }}
          >
            Uji IP Sekarang
          </button>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 8,
              backgroundColor: testResult.isInUms ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${testResult.isInUms ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              fontSize: 13,
              color: testResult.isInUms ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <strong>{testResult.isInUms ? '✓ DISETUJUI:' : '✕ DITOLAK:'}</strong>
            <span>
              IP <code style={{ color: 'inherit' }}>{testIpInput}</code>{' '}
              {testResult.isInUms
                ? `termasuk Jaringan UMS (Cocok dengan aturan: ${testResult.matchingRule || 'IP Match'}).`
                : 'berada di luar Jaringan UMS. Akses langsung tanpa token tidak diizinkan.'}
            </span>
          </div>
        )}
      </div>

      {/* 5. Action Footer Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          paddingTop: 8,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--color-text-light)' }}>
          {lastUpdatedInfo.at && (
            <span>
              Terakhir diperbarui: <strong>{formatDateTime(lastUpdatedInfo.at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong> oleh{' '}
              <strong>{lastUpdatedInfo.by}</strong>
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveSettings}
          disabled={saving}
          style={{
            minWidth: 180,
            padding: '10px 24px',
            fontWeight: 700,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {saving ? (
            <>
              <div className="spinner-inline" style={{ width: 16, height: 16 }} />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Simpan Perubahan Kebijakan</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
