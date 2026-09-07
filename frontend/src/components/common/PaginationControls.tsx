import React, { useState } from 'react';

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  loading?: boolean;
  position?: 'top' | 'bottom';
  style?: React.CSSProperties;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  itemLabel = 'data',
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  loading = false,
  position = 'bottom',
  style,
}) => {
  const [jumpInput, setJumpInput] = useState<string>('');

  if (totalItems === 0) return null;

  // Generate pagination page numbers window
  const getPaginationPages = (curr: number, total: number): (number | string)[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    const left = Math.max(2, curr - 1);
    const right = Math.min(total - 1, curr + 1);

    if (left > 2) {
      pages.push('...');
    }

    for (let i = left; i <= right; i++) {
      pages.push(i);
    }

    if (right < total - 1) {
      pages.push('...');
    }

    pages.push(total);
    return pages;
  };

  const startRecord = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endRecord = Math.min(currentPage * pageSize, totalItems);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p);
      setJumpInput('');
    }
  };

  return (
    <div
      className="pagination-container"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 18px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        marginTop: position === 'top' ? 0 : 16,
        marginBottom: position === 'top' ? 16 : 0,
        ...style,
      }}
    >
      {/* Information text */}
      <div className="pagination-info" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        <span>
          Menampilkan <strong>{startRecord}</strong> - <strong>{endRecord}</strong> dari{' '}
          <strong>{totalItems.toLocaleString('id-ID')}</strong> {itemLabel}
        </span>
      </div>

      {/* Center: Page numbers navigation */}
      <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* First Page Button */}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || loading}
          title="Halaman Pertama"
        >
          «
        </button>

        {/* Prev Page Button */}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          title="Halaman Sebelumnya"
        >
          ‹
        </button>

        {/* Page numbers */}
        {getPaginationPages(currentPage, totalPages).map((p, idx) =>
          typeof p === 'number' ? (
            <button
              key={`${position}-page-${p}`}
              type="button"
              className={`pagination-btn ${p === currentPage ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
              disabled={loading}
            >
              {p}
            </button>
          ) : (
            <span key={`${position}-ellipsis-${idx}`} className="pagination-ellipsis" style={{ padding: '0 4px', color: 'var(--color-text-light)' }}>
              ...
            </span>
          )
        )}

        {/* Next Page Button */}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          title="Halaman Berikutnya"
        >
          ›
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || loading}
          title="Halaman Terakhir"
        >
          »
        </button>
      </div>

      {/* Right controls: Page Size & Jump to Page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {/* Page Size Selector */}
        <div className="pagination-page-size" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Per hal:</span>
          <select
            id={`pagination-select-${position}`}
            name={`page_size_${position}`}
            className="pagination-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={loading}
            style={{
              padding: '4px 8px',
              fontSize: 12.5,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Jump to Page */}
        {totalPages > 1 && (
          <form onSubmit={handleJumpSubmit} className="pagination-jump" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Ke hal:</span>
            <input
              id={`pagination-jump-input-${position}`}
              name={`jump_page_${position}`}
              type="number"
              min={1}
              max={totalPages}
              className="pagination-jump-input"
              placeholder={currentPage.toString()}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              disabled={loading}
              autoComplete="off"
              style={{
                width: 54,
                padding: '4px 6px',
                fontSize: 12.5,
                textAlign: 'center',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            />
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              style={{ height: 28, padding: '0 8px', fontSize: 12 }}
              disabled={loading || !jumpInput}
            >
              Buka
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
