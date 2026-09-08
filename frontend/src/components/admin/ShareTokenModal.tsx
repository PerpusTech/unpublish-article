import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TokenAdminItem } from '../../services/api';
import { copyToClipboard } from '../../utils/clipboard';

interface ShareTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: TokenAdminItem | null;
  onShowToast?: (message: string, type?: 'success' | 'danger') => void;
}

export const ShareTokenModal: React.FC<ShareTokenModalProps> = ({
  isOpen,
  onClose,
  token,
  onShowToast,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [copiedType, setCopiedType] = useState<'link' | 'wa' | 'email' | null>(null);

  useEffect(() => {
    if (!isOpen || !token) return;
    const defaultEmail = token.patron_nim ? `${token.patron_nim.trim().toLowerCase()}@student.ums.ac.id` : '';
    setCustomEmail(defaultEmail);
    setPhoneNumber('');
    setCopiedType(null);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, token]);

  if (!isOpen || !token) return null;

  const originUrl = window.location.origin;
  const directClaimUrl = `${originUrl}/?claim_token=${encodeURIComponent(token.token_code)}`;

  const waMessage = `*TIKET AKSES REPOSITORI UNPUBLISH — UPT Perpustakaan dan Layanan Digital UMS*

Yth. Sdr/i *${token.patron_name}* (${token.patron_nim}),

Berikut adalah tiket akses membaca naskah khusus EPrints Unpublish Anda:
🔑 *Kode Token:* \`${token.token_code}\`
⏱️ *Durasi Sesi:* ${token.duration_minutes} Menit
🔗 *Tautan Akses Langsung:*
${directClaimUrl}

*Petunjuk Penggunaan:*
1. Buka tautan di atas melalui komputer layanan perpustakaan.
2. Atau masukkan Kode Token di halaman beranda.
3. Hitungan mundur durasi membaca dimulai saat token pertama kali diaktifkan.

_UPT Perpustakaan dan Layanan Digital UMS_`;

  const emailSubject = `[UPT Perpustakaan dan Layanan Digital UMS] Tiket Akses Repositori Unpublish (${token.token_code})`;
  const emailBody = `Yth. Sdr/i ${token.patron_name} (${token.patron_nim}),

Berikut adalah tiket otorisasi membaca naskah EPrints Unpublish UPT Perpustakaan dan Layanan Digital UMS:

- Kode Token: ${token.token_code}
- Durasi Membaca: ${token.duration_minutes} Menit
- Tautan Akses Langsung: ${directClaimUrl}

Petunjuk Penggunaan:
1. Buka tautan di atas di browser komputer layanan perpustakaan.
2. Atau masukkan kode token di halaman utama katalog.
3. Durasi membaca akan mulai aktif setelah token diverifikasi.

Salam hangat,
Meja Layanan UPT Perpustakaan dan Layanan Digital UMS
https://library.ums.ac.id`;

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(directClaimUrl);
    if (ok) {
      setCopiedType('link');
      if (onShowToast) onShowToast('Tautan akses langsung berhasil disalin!', 'success');
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleCopyWaText = async () => {
    const ok = await copyToClipboard(waMessage);
    if (ok) {
      setCopiedType('wa');
      if (onShowToast) onShowToast('Format pesan WhatsApp berhasil disalin!', 'success');
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleOpenWhatsApp = () => {
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }
    const waUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waMessage)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`;
    window.open(waUrl, '_blank');
  };

  const handleOpenEmail = () => {
    const target = customEmail.trim() || `${token.patron_nim.toLowerCase()}@student.ums.ac.id`;
    const mailtoUrl = `mailto:${encodeURIComponent(target)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');
  };

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-dialog animated-modal" style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Kirim & Bagikan Tiket Pemustaka</span>
          </h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
          {/* Token Summary Chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text)' }}>{token.patron_name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {token.patron_nim} • Durasi: {token.duration_minutes} Menit
              </div>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--color-primary)',
                backgroundColor: 'var(--color-surface)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                letterSpacing: 1,
              }}
            >
              {token.token_code}
            </div>
          </div>

          {/* Action 1: Direct Claim URL */}
          <div style={{ marginBottom: 20 }}>
            <label className="form-label" htmlFor="share-direct-url-input" style={{ fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              <span>Tautan Akses Langsung (Auto-Claim URL)</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="share-direct-url-input"
                name="direct_claim_url"
                type="text"
                readOnly
                value={directClaimUrl}
                className="form-input"
                style={{ fontSize: 12, fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-surface-subtle)' }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCopyLink}
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
              >
                {copiedType === 'link' ? (
                  <span>✓ Tersalin!</span>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Salin Link</span>
                  </>
                )}
              </button>
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
              Pemustaka cukup membuka tautan ini di browser, token otomatis terisi & siap diaktifkan.
            </span>
          </div>

          {/* Action 2: WhatsApp Share */}
          <div
            style={{
              padding: '14px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, color: '#15803d' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.97.53 1.83.813 2.796.813 3.183 0 5.77-2.587 5.77-5.766-.001-3.18-2.588-5.8-5.77-5.8zm0-2.172c4.418 0 8 3.582 8 8 0 4.419-3.582 8.001-8 8.001-1.393 0-2.698-.36-3.837-.986l-4.57 1.196 1.218-4.453c-.705-1.185-1.111-2.56-1.111-4.025 0-4.418 3.582-7.733 8.3-7.733z" />
              </svg>
              <span>Kirim via WhatsApp</span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                id="share-whatsapp-phone-input"
                name="whatsapp_phone"
                type="text"
                placeholder="Nomor WhatsApp Pemustaka (Misal: 08123456789)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoComplete="tel"
                className="form-input"
                style={{ fontSize: 12.5 }}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenWhatsApp}
                style={{
                  backgroundColor: '#16a34a',
                  borderColor: '#16a34a',
                  color: '#fff',
                  flexShrink: 0,
                  fontSize: 12.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <span>Buka WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyWaText}
              style={{ width: '100%', fontSize: 12 }}
            >
              {copiedType === 'wa' ? '✓ Format Pesan WhatsApp Tersalin!' : 'Salin Teks Format WhatsApp'}
            </button>
          </div>

          {/* Action 3: Email Kampus */}
          <div
            style={{
              padding: '14px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, color: 'var(--color-primary)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span>Kirim ke Email Mahasiswa (@student.ums.ac.id)</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="share-custom-email-input"
                name="share_email"
                type="email"
                placeholder="Email Tujuan"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                autoComplete="email"
                className="form-input"
                style={{ fontSize: 12.5 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenEmail}
                style={{ flexShrink: 0, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>Buka Mailto</span>
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
