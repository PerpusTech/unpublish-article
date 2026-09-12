import React from 'react';

export type StatCardColor = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'neutral';

export interface StatCardProps {
  /** Label / Metric title */
  label: string;
  /** Primary metric value */
  value: React.ReactNode;
  /** Optional descriptive subtitle or context */
  description?: React.ReactNode;
  /** Optional icon displayed in top right or beside value */
  icon?: React.ReactNode;
  /** Color theme accent */
  color?: StatCardColor;
  /** Optional trend indicator */
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  /** Whether metric is currently loading */
  loading?: boolean;
  /** Optional click handler for interactive stat tile */
  onClick?: () => void;
  /** Custom class name */
  className?: string;
  /** Custom style overrides */
  style?: React.CSSProperties;
}

const colorThemeMap: Record<StatCardColor, { bg: string; text: string; iconBg: string }> = {
  blue: {
    bg: 'var(--color-surface)',
    text: 'var(--color-primary)',
    iconBg: 'rgba(37, 99, 235, 0.1)',
  },
  green: {
    bg: 'var(--color-surface)',
    text: 'var(--color-success)',
    iconBg: 'var(--color-success-bg)',
  },
  amber: {
    bg: 'var(--color-surface)',
    text: 'var(--color-warning)',
    iconBg: 'var(--color-warning-bg)',
  },
  red: {
    bg: 'var(--color-surface)',
    text: 'var(--color-danger)',
    iconBg: 'var(--color-danger-bg)',
  },
  purple: {
    bg: 'var(--color-surface)',
    text: '#8b5cf6',
    iconBg: 'rgba(139, 92, 246, 0.1)',
  },
  neutral: {
    bg: 'var(--color-surface)',
    text: 'var(--color-text)',
    iconBg: 'var(--color-surface-subtle)',
  },
};

/**
 * Reusable StatCard component for metric dashboards, analytics, and overview counters.
 * 
 * @example
 * ```tsx
 * <StatCard
 *   label="Total Unduhan"
 *   value="1,420"
 *   icon={<FiDownload />}
 *   color="blue"
 *   description="Bulan ini"
 * />
 * ```
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  description,
  icon,
  color = 'blue',
  trend,
  loading = false,
  onClick,
  className = '',
  style,
}) => {
  const theme = colorThemeMap[color] || colorThemeMap.blue;

  return (
    <div
      onClick={onClick}
      className={`stat-card ${onClick ? 'interactive' : ''} ${className}`}
      style={{
        backgroundColor: theme.bg,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '18px 20px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="stat-label" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.6px' }}>
            {label}
          </div>
          {loading ? (
            <div style={{ height: 32, width: 80, backgroundColor: 'var(--color-border)', borderRadius: 4, marginTop: 6, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <div className="stat-value" style={{ fontSize: 24, fontWeight: 800, color: theme.text, marginTop: 4, lineHeight: 1.2 }}>
              {value}
            </div>
          )}
        </div>

        {icon && (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: theme.iconBg,
              color: theme.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {(description || trend) && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-light)' }}>
          {trend && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                fontWeight: 700,
                color: trend.isPositive ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {description && <span>{description}</span>}
        </div>
      )}
    </div>
  );
};
