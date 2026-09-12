import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback fired when the user closes the modal (via backdrop, escape key, or close button) */
  onClose: () => void;
  /** Optional modal title in standard header */
  title?: React.ReactNode;
  /** Optional modal subtitle / description */
  subtitle?: React.ReactNode;
  /** Size of modal dialog: sm (400px), md (580px), lg (820px), xl (1050px), full (96vw) */
  size?: ModalSize;
  /** Close modal when backdrop / overlay is clicked. Defaults to true. */
  closeOnClickOutside?: boolean;
  /** Close modal when ESC key is pressed. Defaults to true. */
  closeOnEscape?: boolean;
  /** Whether to show standard close button (X) in header. Defaults to true. */
  showCloseButton?: boolean;
  /** Optional custom header icon or badge */
  headerIcon?: React.ReactNode;
  /** Custom extra header actions */
  headerActions?: React.ReactNode;
  /** Additional custom class names for the modal dialog */
  className?: string;
  /** Modal body / content */
  children?: React.ReactNode;
  /** Optional custom footer element */
  footer?: React.ReactNode;
  /** Custom style overrides for dialog */
  style?: React.CSSProperties;
}

export interface ModalHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export interface ModalBodyProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface ModalFooterProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  onClose,
  showCloseButton = true,
  className = '',
  children,
}) => {
  return (
    <div className={`modal-header ${className}`}>
      {children || (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            {icon && <div style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</div>}
            <div style={{ minWidth: 0 }}>
              {title && (
                <h3 className="modal-title" style={{ margin: 0, lineHeight: 1.3 }}>
                  {title}
                </h3>
              )}
              {subtitle && (
                <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 3 }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {actions}
            {showCloseButton && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup"
                className="btn-modal-close"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  lineHeight: 1,
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                &times;
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const ModalBody: React.FC<ModalBodyProps> = ({ className = '', style, children }) => {
  return (
    <div className={`modal-body ${className}`} style={style}>
      {children}
    </div>
  );
};

export const ModalFooter: React.FC<ModalFooterProps> = ({ className = '', style, children }) => {
  return (
    <div className={`modal-footer ${className}`} style={style}>
      {children}
    </div>
  );
};

/**
 * Universal Modal component rendered via React Portal with backdrop, animations,
 * Escape key support, body-scroll lock, and clean accessibility.
 * 
 * @example
 * ```tsx
 * <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Konfirmasi" size="md">
 *   <p>Konten modal disini...</p>
 * </Modal>
 * ```
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  closeOnClickOutside = true,
  closeOnEscape = true,
  showCloseButton = true,
  headerIcon,
  headerActions,
  className = '',
  children,
  footer,
  style,
}) => {
  // Handle ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizeMaxWidthMap: Record<ModalSize, string | number> = {
    sm: 420,
    md: 580,
    lg: 820,
    xl: 1050,
    full: '95vw',
  };

  const modalContent = (
    <div
      className="modal-backdrop animated-fade-in"
      onClick={closeOnClickOutside ? onClose : undefined}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(10, 26, 44, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div
        className={`modal-dialog modal-pop-in ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: sizeMaxWidthMap[size],
          maxHeight: size === 'full' ? '95vh' : '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          ...style,
        }}
      >
        {(title || subtitle || headerIcon || headerActions) && (
          <ModalHeader
            title={title}
            subtitle={subtitle}
            icon={headerIcon}
            actions={headerActions}
            onClose={onClose}
            showCloseButton={showCloseButton}
          />
        )}

        {children}

        {footer && <ModalFooter>{footer}</ModalFooter>}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
