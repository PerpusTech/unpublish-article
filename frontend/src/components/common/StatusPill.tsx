import React from 'react';

export type StatusPillType =
  | 'success'
  | 'active'
  | 'warning'
  | 'danger'
  | 'error'
  | 'info'
  | 'neutral'
  | 'offline';

export interface StatusPillProps {
  /** Status type determining color theme */
  status?: StatusPillType;
  /** Custom dot indicator color (e.g. '#10b981', '#ef4444', '#f59e0b') */
  dotColor?: string;
  /** Whether the dot has a live pulse animation */
  pulse?: boolean;
  /** Optional icon before label */
  icon?: React.ReactNode;
  /** Text content or custom React node */
  children?: React.ReactNode;
  /** Optional click handler (makes pill interactive with click/hover animation) */
  onClick?: () => void;
  /** Additional custom class names */
  className?: string;
  /** Custom style overrides */
  style?: React.CSSProperties;
}

const statusColorMap: Record<StatusPillType, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: 'var(--color-success-bg)',
    text: 'var(--color-success)',
    border: 'var(--color-success-border)',
    dot: '#10b981',
  },
  active: {
    bg: 'var(--color-primary-light)',
    text: 'var(--color-primary)',
    border: 'var(--color-border)',
    dot: '#2563eb',
  },
  warning: {
    bg: 'var(--color-warning-bg)',
    text: 'var(--color-warning)',
    border: 'var(--color-warning-border)',
    dot: '#f59e0b',
  },
  danger: {
    bg: 'var(--color-danger-bg)',
    text: 'var(--color-danger)',
    border: 'var(--color-danger-border)',
    dot: '#ef4444',
  },
  error: {
    bg: 'var(--color-danger-bg)',
    text: 'var(--color-danger)',
    border: 'var(--color-danger-border)',
    dot: '#ef4444',
  },
  info: {
    bg: 'var(--color-primary-light)',
    text: 'var(--color-primary)',
    border: 'var(--color-border)',
    dot: '#3b82f6',
  },
  neutral: {
    bg: 'var(--color-surface-subtle)',
    text: 'var(--color-text-muted)',
    border: 'var(--color-border)',
    dot: '#94a3b8',
  },
  offline: {
    bg: 'var(--color-surface-subtle)',
    text: 'var(--color-text-light)',
    border: 'var(--color-border)',
    dot: '#64748b',
  },
};

/**
 * Reusable StatusPill component with dot indicator, pulse animation, and optional click action.
 * Perfect for database status, connectivity indicators, user role tags, and network badges.
 * 
 * @example
 * ```tsx
 * <StatusPill status="success" pulse onClick={openModal}>
 *   Database Live (MySQL)
 * </StatusPill>
 * ```
 */
export const StatusPill: React.FC<StatusPillProps> = ({
  status = 'neutral',
  dotColor,
  pulse = false,
  icon,
  children,
  onClick,
  className = '',
  style,
}) => {
  const theme = statusColorMap[status] || statusColorMap.neutral;
  const activeDotColor = dotColor || theme.dot;

  const pillStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '4px 12px',
    backgroundColor: theme.bg,
    border: `1px solid ${theme.border}`,
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    color: theme.text,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.15s ease',
    userSelect: 'none',
    textDecoration: 'none',
    ...style,
  };

  const content = (
    <>
      <span
        className={`status-pill-dot ${pulse ? 'badge-dot-pulse' : ''}`}
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: activeDotColor,
          display: 'inline-block',
          boxShadow: pulse ? `0 0 8px ${activeDotColor}` : undefined,
        }}
      />
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children && <span>{children}</span>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`status-pill pill-btn ${className}`}
        style={pillStyles}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`status-pill ${className}`} style={pillStyles}>
      {content}
    </div>
  );
};
