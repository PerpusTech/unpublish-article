import React from 'react';

export type ToggleSwitchSize = 'sm' | 'md';

export interface ToggleSwitchProps {
  /** Current checked state */
  checked: boolean;
  /** Change event callback returning new checked state */
  onChange: (checked: boolean) => void;
  /** Primary label */
  label?: React.ReactNode;
  /** Optional secondary helper / description text */
  description?: React.ReactNode;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Size of toggle */
  size?: ToggleSwitchSize;
  /** HTML ID for accessibility */
  id?: string;
  /** Additional custom class names */
  className?: string;
  /** Custom style overrides */
  style?: React.CSSProperties;
}

/**
 * Modern, accessible ToggleSwitch component for boolean settings and toggles.
 * 
 * @example
 * ```tsx
 * <ToggleSwitch
 *   label="Aktifkan Mode Gelap"
 *   description="Ubah tema visual aplikasi menjadi hitam pekat"
 *   checked={darkMode}
 *   onChange={setDarkMode}
 * />
 * ```
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  id,
  className = '',
  style,
}) => {
  const switchWidth = size === 'sm' ? 36 : 46;
  const switchHeight = size === 'sm' ? 20 : 26;
  const knobSize = size === 'sm' ? 14 : 18;
  const knobTranslate = size === 'sm' ? 16 : 20;

  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div
      onClick={handleToggle}
      className={`toggle-switch-container ${disabled ? 'is-disabled' : ''} ${className}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
        ...style,
      }}
    >
      {(label || description) && (
        <div style={{ flex: 1 }}>
          {label && (
            <div
              style={{
                fontSize: size === 'sm' ? 13 : 14,
                fontWeight: 600,
                color: 'var(--color-text)',
                lineHeight: 1.3,
              }}
            >
              {label}
            </div>
          )}
          {description && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              {description}
            </div>
          )}
        </div>
      )}

      <div
        id={id}
        role="switch"
        tabIndex={disabled ? -1 : 0}
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        onKeyDown={handleKeyDown}
        className="toggle-track"
        style={{
          width: switchWidth,
          height: switchHeight,
          borderRadius: 9999,
          backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
          position: 'relative',
          padding: size === 'sm' ? 3 : 4,
          flexShrink: 0,
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
          outline: 'none',
        }}
      >
        <div
          className="toggle-knob"
          style={{
            width: knobSize,
            height: knobSize,
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
            transform: checked ? `translateX(${knobTranslate}px)` : 'translateX(0)',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
};
