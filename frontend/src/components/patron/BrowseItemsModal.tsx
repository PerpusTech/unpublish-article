import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, BrowseItem } from '../../services/api';

export type BrowseCategory = 'year' | 'subject' | 'division' | 'type' | 'author';

interface BrowseItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFilter: (category: BrowseCategory, value: string, label: string) => void;
  activeCategory?: BrowseCategory;
}

const TABS: { id: BrowseCategory; label: string; desc: string }[] = [
  { id: 'year', label: 'Tahun', desc: 'Jelajahi naskah berdasarkan tahun terbit' },
  { id: 'subject', label: 'Subjek', desc: 'Jelajahi naskah berdasarkan subjek keilmuan' },
  { id: 'division', label: 'Divisi / Fakultas', desc: 'Jelajahi naskah berdasarkan fakultas atau unit' },
  { id: 'type', label: 'Jenis Naskah', desc: 'Jelajahi naskah berdasarkan tipe karya (skripsi, jurnal, dsb)' },
  { id: 'author', label: 'Penulis', desc: 'Jelajahi naskah berdasarkan nama pengarang' },
];

export const BrowseItemsModal: React.FC<BrowseItemsModalProps> = ({
  isOpen,
  onClose,
  onSelectFilter,
  activeCategory = 'year',
}) => {
  const [currentTab, setCurrentTab] = useState<BrowseCategory>(activeCategory);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Synchronize initial tab when activeCategory changes
  useEffect(() => {
    if (isOpen) {
      setCurrentTab(activeCategory);
      setSearchQuery('');
    }
  }, [isOpen, activeCategory]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load items when currentTab or debounce search changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.browseCategory(currentTab, searchQuery);
        if (isMounted) {
          setItems(res.items || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Gagal memuat kategori penjelajahan');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }, searchQuery ? 300 : 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, currentTab, searchQuery]);

  if (!isOpen) return null;

  const currentTabMeta = TABS.find((t) => t.id === currentTab) || TABS[0];

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog large animated-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '920px',
          width: '95%',
          height: '82vh',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-surface-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 19 21 12 17 5 21 12 2" />
              </svg>
            </div>
            <div>
              <h2
                className="modal-title"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--color-text)',
                }}
              >
                Jelajahi Repositori (Browse Items)
              </h2>
              <p
                style={{
                  fontSize: 12,
                  margin: '2px 0 0',
                  color: 'var(--color-text-muted)',
                }}
              >
                Pilih kategori untuk menyaring naskah repositori Perpustakaan UMS
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{
              borderRadius: '50%',
              width: 32,
              height: 32,
              padding: 0,
              display: 'grid',
              placeItems: 'center',
            }}
            title="Tutup (ESC)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Bar */}
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            padding: '6px 16px 0',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {TABS.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCurrentTab(tab.id);
                  setSearchQuery('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  backgroundColor: isActive ? 'var(--color-surface)' : 'transparent',
                  borderTop: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  borderLeft: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
                  borderRight: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
                  borderBottom: isActive ? '1px solid var(--color-surface)' : 'none',
                  borderRadius: '8px 8px 0 0',
                  cursor: 'pointer',
                  marginBottom: -1,
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sub-bar with search & description */}
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            {currentTabMeta.desc}
          </div>

          {currentTab !== 'year' && (
            <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
              <input
                type="text"
                placeholder={`Cari di ${currentTabMeta.label.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 28px 6px 12px',
                  fontSize: 12.5,
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  color: 'var(--color-text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Hapus pencarian"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: 'var(--color-surface-subtle)',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
                color: 'var(--color-text-muted)',
              }}
            >
              <div
                className="spinner-inline"
                style={{ width: 28, height: 28, borderWidth: 3, marginBottom: 12 }}
              />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                Memuat data {currentTabMeta.label}...
              </span>
            </div>
          ) : error ? (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 0',
                color: 'var(--color-text-muted)',
              }}
            >
              <div style={{ color: 'var(--color-text-light)', marginBottom: 8 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                Tidak ada data ditemukan
              </div>
              <p style={{ fontSize: 12.5, marginTop: 4 }}>
                {searchQuery
                  ? `Tidak ada hasil yang cocok dengan kata kunci "${searchQuery}"`
                  : 'Belum ada data tersedia untuk kategori ini'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 12, fontSize: 12 }}
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : currentTab === 'year' ? (
            /* Year Grid */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 12,
              }}
            >
              {items.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onSelectFilter('year', item.value, `Tahun: ${item.label}`);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '14px 10px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      lineHeight: 1.2,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      padding: '2px 8px',
                      borderRadius: 12,
                    }}
                  >
                    {item.count.toLocaleString('id-ID')} naskah
                  </span>
                </button>
              ))}
            </div>
          ) : currentTab === 'type' ? (
            /* Type List */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 10,
              }}
            >
              {items.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onSelectFilter('type', item.value, `Jenis: ${item.label}`);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, var(--color-surface))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, paddingRight: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-light)', flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      padding: '3px 8px',
                      borderRadius: 12,
                      flexShrink: 0,
                    }}
                  >
                    {item.count.toLocaleString('id-ID')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            /* Division, Subject, Author */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 10,
              }}
            >
              {items.map((item) => {
                const prefix =
                  currentTab === 'division' ? 'Divisi' : currentTab === 'subject' ? 'Subjek' : 'Penulis';
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      onSelectFilter(currentTab, item.value, `${prefix}: ${item.label}`);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 14px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      gap: 12,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-hover, var(--color-surface))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--color-text)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.label}
                      >
                        {item.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: 'var(--color-primary)',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        padding: '2px 8px',
                        borderRadius: 10,
                        flexShrink: 0,
                      }}
                    >
                      {item.count.toLocaleString('id-ID')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-surface)',
            fontSize: 12.5,
            color: 'var(--color-text-muted)',
            flexShrink: 0,
          }}
        >
          <div>
            Menampilkan <strong style={{ color: 'var(--color-text)' }}>{items.length}</strong> entri{' '}
            {currentTabMeta.label.toLowerCase()}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ fontWeight: 600 }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
