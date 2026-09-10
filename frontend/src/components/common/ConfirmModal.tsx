import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Hapus',
  cancelText = 'Batal',
  confirmVariant = 'danger',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    if (confirmVariant === 'danger') {
      return (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--color-danger, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>
      );
    }
    if (confirmVariant === 'warning') {
      return (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
      );
    }
    return (
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          color: 'var(--color-primary, #2563eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </div>
    );
  };

  const getConfirmButtonClass = () => {
    if (confirmVariant === 'danger') return 'btn btn-danger';
    if (confirmVariant === 'warning') return 'btn btn-warning';
    return 'btn btn-primary';
  };

  return createPortal(
    <div
      className="modal-backdrop animated-fade-in"
      style={{ zIndex: 9999 }}
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="modal-dialog animated-modal"
        style={{ maxWidth: 440, padding: 0, overflow: 'hidden' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div style={{ padding: '24px 24px 20px 24px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {getIcon()}
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: 16.5,
                  fontWeight: 700,
                  margin: '0 0 8px 0',
                  color: 'var(--color-text)',
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
              <div
                style={{
                  fontSize: 13.5,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.5,
                }}
              >
                {message}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '14px 24px',
            backgroundColor: 'var(--color-surface-subtle, rgba(0, 0, 0, 0.02))',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={isLoading}
            style={{ minWidth: 76 }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`${getConfirmButtonClass()} btn-sm`}
            onClick={onConfirm}
            disabled={isLoading}
            style={{ minWidth: 96, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {isLoading && (
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  border: '2px solid currentColor',
                  borderRightColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.75s linear infinite',
                }}
              />
            )}
            <span>{isLoading ? 'Memproses...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
