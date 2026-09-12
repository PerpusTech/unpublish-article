import React from 'react';

export type CardVariant = 'default' | 'subtle' | 'bordered' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Visual variant of the card surface */
  variant?: CardVariant;
  /** Inner padding size */
  padding?: CardPadding;
  /** Optional card title for built-in header */
  title?: React.ReactNode;
  /** Optional card subtitle / description */
  subtitle?: React.ReactNode;
  /** Optional header right action slot */
  action?: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Content of card */
  children?: React.ReactNode;
  /** Additional custom class names */
  className?: string;
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface CardBodyProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export interface CardFooterProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
  style,
  children,
}) => {
  if (children) {
    return <div className={`card-header ${className}`} style={{ marginBottom: 16, ...style }}>{children}</div>;
  }

  return (
    <div
      className={`card-header ${className}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 16,
        ...style,
      }}
    >
      <div>
        {title && (
          <h3
            className="card-title"
            style={{
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-primary)',
              lineHeight: 1.3,
            }}
          >
            {title}
          </h3>
        )}
        {subtitle && (
          <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>

      {action && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{action}</div>}
    </div>
  );
};

export const CardBody: React.FC<CardBodyProps> = ({ className = '', style, children }) => {
  return (
    <div className={`card-body ${className}`} style={style}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardFooterProps> = ({ className = '', style, children }) => {
  return (
    <div
      className={`card-footer ${className}`}
      style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Reusable Card container component with customizable padding, variant styling, and modular subcomponents.
 * 
 * @example
 * ```tsx
 * <Card title="Statistik Sistem" subtitle="Ringkasan 24 jam terakhir" action={<Button size="sm">Refresh</Button>}>
 *   <p>Isi konten card...</p>
 * </Card>
 * ```
 */
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  title,
  subtitle,
  action,
  footer,
  children,
  className = '',
  style,
  ...restProps
}) => {
  const paddingMap: Record<CardPadding, string | number> = {
    none: 0,
    sm: '14px 16px',
    md: '20px 24px',
    lg: '28px 32px',
  };

  const variantStyleMap: Record<CardVariant, React.CSSProperties> = {
    default: {
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)',
    },
    subtle: {
      backgroundColor: 'var(--color-surface-subtle)',
      border: '1px solid var(--color-border)',
      boxShadow: 'none',
    },
    bordered: {
      backgroundColor: 'var(--color-surface)',
      border: '2px solid var(--color-border)',
      boxShadow: 'none',
    },
    elevated: {
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-md)',
    },
  };

  return (
    <div
      className={`card card-${variant} ${className}`}
      style={{
        borderRadius: 'var(--radius-md)',
        padding: paddingMap[padding],
        ...variantStyleMap[variant],
        ...style,
      }}
      {...restProps}
    >
      {(title || subtitle || action) && (
        <CardHeader title={title} subtitle={subtitle} action={action} />
      )}

      {children}

      {footer && <CardFooter>{footer}</CardFooter>}
    </div>
  );
};
