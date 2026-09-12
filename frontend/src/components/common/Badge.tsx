import React from 'react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'accent'
  | 'publish'
  | 'unpublish'
  | 'pending'
  | 'active'
  | 'expired'
  | 'revoked';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual color style variant */
  variant?: BadgeVariant;
  /** Size of badge */
  size?: BadgeSize;
  /** Display a small colored circle dot indicator */
  dot?: boolean;
  /** Add a pulsating radar effect to the dot */
  pulse?: boolean;
  /** Optional icon displayed before text */
  icon?: React.ReactNode;
  /** Content of badge */
  children?: React.ReactNode;
  /** Additional custom class names */
  className?: string;
}

/**
 * Reusable Badge component for category tags, counts, and item states.
 * 
 * @example
 * ```tsx
 * <Badge variant="success" dot pulse>
 *   AKTIF
 * </Badge>
 * ```
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  pulse = false,
  icon,
  children,
  className = '',
  style,
  ...restProps
}) => {
  const variantClass = `badge-${variant}`;
  const sizeClass = size === 'sm' ? 'badge-sm' : '';

  const combinedClassName = ['badge', variantClass, sizeClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={combinedClassName}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        fontSize: size === 'sm' ? 10 : 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderRadius: 'var(--radius-sm)',
        lineHeight: 1.2,
        ...style,
      }}
      {...restProps}
    >
      {dot && (
        <span
          className={`badge-dot ${pulse ? 'badge-dot-pulse' : ''}`}
          style={{
            width: size === 'sm' ? 5 : 6,
            height: size === 'sm' ? 5 : 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            display: 'inline-block',
          }}
        />
      )}
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children && <span>{children}</span>}
    </span>
  );
};
