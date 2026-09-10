import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TokenAdminItem } from '../../services/api';
import { formatDateTime } from '../../utils/date';

export interface ThermalSlipItem {
  token: TokenAdminItem;
  qrDataUrl: string;
}

interface ThermalSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ThermalSlipItem[];
  title?: string;
}

export const ThermalSlipModal: React.FC<ThermalSlipModalProps> = ({
  isOpen,
  onClose,
  items,
  title = 'Cetak Slip Tiket Termal (POS 58mm / 80mm)',
}) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || items.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (isoString?: string) => {
    return formatDateTime(isoString || new Date(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-dialog animated-modal no-print-dialog" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>{title}</span>
          </h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: 'calc(85vh - 130px)', overflowY: 'auto' }}>
          {/* Print options toolbar */}
          <div
            className="no-print"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
              <span>Ukuran Kertas Printer Termal:</span>
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${paperWidth === '58mm' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPaperWidth('58mm')}
                  style={{ fontSize: 12, padding: '3px 10px' }}
                >
                  58 mm (Kecil)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${paperWidth === '80mm' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPaperWidth('80mm')}
                  style={{ fontSize: 12, padding: '3px 10px' }}
                >
                  80 mm (Standar)
                </button>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {items.length} Slip Tiket
            </div>
          </div>

          {/* Thermal Slips Preview Container */}
          <div
            className="thermal-preview-wrap"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              padding: '16px 0',
              backgroundColor: '#f1f5f9',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div id="thermal-printable-area" className="thermal-receipt-printable">
              {items.map(({ token, qrDataUrl }, idx) => (
                <div
                  key={token.id || idx}
                  className={`thermal-receipt-slip ${paperWidth === '58mm' ? 'slip-58mm' : 'slip-80mm'}`}
                  style={{
                    width: paperWidth === '58mm' ? '220px' : '300px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    padding: paperWidth === '58mm' ? '12px 10px' : '18px 16px',
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: paperWidth === '58mm' ? '11px' : '12px',
                    lineHeight: 1.35,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    marginBottom: items.length > 1 ? 24 : 0,
                    pageBreakAfter: 'always',
                    boxSizing: 'border-box',
                    textAlign: 'center',
                  }}
                >
                  {/* Header */}
                  <div style={{ fontWeight: 'bold', fontSize: paperWidth === '58mm' ? '12px' : '13px', letterSpacing: '0.5px' }}>
                    UPT Perpustakaan dan Layanan Digital UMS
                  </div>
                  <div style={{ fontSize: '10px', marginTop: 2 }}>
                    MEJA LAYANAN PUSTAKAWAN
                  </div>
                  <div style={{ fontSize: '9.5px', marginTop: 1, color: '#333' }}>
                    unpublish.ums.ac.id
                  </div>

                  <div style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />

                  <div style={{ fontWeight: 'bold', fontSize: paperWidth === '58mm' ? '11px' : '12px' }}>
                    SLIP AKSES E-PRINTS UNPUBLISH
                  </div>
                  <div style={{ fontSize: '9.5px', color: '#444', marginTop: 2 }}>
                    {formatDate(token.created_at)}
                  </div>

                  <div style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />

                  {/* QR Code */}
                  <div style={{ margin: '8px auto', display: 'inline-block' }}>
                    <img
                      src={qrDataUrl}
                      alt="QR Code"
                      style={{
                        width: paperWidth === '58mm' ? 120 : 150,
                        height: paperWidth === '58mm' ? 120 : 150,
                        display: 'block',
                        margin: '0 auto',
                        imageRendering: 'pixelated',
                      }}
                    />
                  </div>

                  {/* Token Code */}
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#555' }}>Kode Token Anda:</div>
                  <div
                    style={{
                      fontSize: paperWidth === '58mm' ? '18px' : '22px',
                      fontWeight: 'bold',
                      letterSpacing: '2px',
                      border: '1.5px solid #000',
                      padding: '4px 6px',
                      margin: '4px 0 10px 0',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    {token.token_code}
                  </div>

                  {/* Patron details */}
                  <div style={{ textAlign: 'left', fontSize: paperWidth === '58mm' ? '10px' : '11px', lineHeight: 1.4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Nama:</span>
                      <span style={{ fontWeight: 'bold', maxWidth: '65%', textAlign: 'right' }}>{token.patron_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>NIM/NIP:</span>
                      <span style={{ fontWeight: 'bold' }}>{token.patron_nim}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Durasi:</span>
                      <span style={{ fontWeight: 'bold' }}>{token.duration_minutes} Menit</span>
                    </div>
                    {token.notes && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Ket:</span>
                        <span style={{ fontStyle: 'italic', maxWidth: '65%', textAlign: 'right' }}>{token.notes}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />

                  {/* Usage Guide */}
                  <div style={{ fontSize: '9px', textAlign: 'left', lineHeight: 1.35, color: '#333' }}>
                    <strong>PETUNJUK PENGGUNAAN:</strong>
                    <div>1. Akses web: unpublish.ums.ac.id</div>
                    <div>2. Masukkan kode / scan QR di atas</div>
                    <div>3. Durasi dihitung saat token diaktifkan</div>
                    <div>4. Dilarang menyalin/menyebarkan naskah</div>
                  </div>

                  <div style={{ margin: '8px 0', borderTop: '1px dashed #000' }} />

                  <div style={{ fontSize: '9px', textAlign: 'center', color: '#555' }}>
                    Terima kasih telah berkunjung.<br />
                    UPT Perpustakaan dan Layanan Digital UMS
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>Cetak Slip ({items.length})</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
