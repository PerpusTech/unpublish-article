import React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Form field label displayed above select */
  label?: React.ReactNode;
  /** Error message displayed below select in danger style */
  error?: string | null;
  /** Helper or informational text below select */
  helperText?: React.ReactNode;
  /** Show red asterisk next to label */
  required?: boolean;
  /** Array of option items (optional if children are passed) */
  options?: SelectOption[];
  /** Custom class for outer wrapper */
  containerClassName?: string;
  /** Custom style for outer wrapper */
  containerStyle?: React.CSSProperties;
}

/**
 * Reusable FormSelect component with label, option mapping, and error validation feedback.
 * 
 * @example
 * ```tsx
 * <FormSelect
 *   label="Peran Pengguna"
 *   value={role}
 *   onChange={(e) => setRole(e.target.value)}
 *   options={[
 *     { value: 'STAFF', label: 'Staf Perpustakaan' },
 *     { value: 'SUPERADMIN', label: 'Super Administrator' },
 *   ]}
 *   required
 * />
 * ```
 */
export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  error,
  helperText,
  required = false,
  options,
  containerClassName = '',
  containerStyle,
  className = '',
  id,
  disabled,
  children,
  style,
  ...restProps
}) => {
  const generatedId = id || (typeof label === 'string' ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const isInvalid = Boolean(error);

  return (
    <div className={`form-group ${containerClassName}`} style={{ marginBottom: 16, ...containerStyle }}>
      {label && (
        <label
          htmlFor={generatedId}
          className="form-label"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 6,
            color: 'var(--color-text)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
        </label>
      )}

      <select
        id={generatedId}
        disabled={disabled}
        className={`form-select ${isInvalid ? 'is-invalid' : ''} ${className}`}
        style={{
          width: '100%',
          borderColor: isInvalid ? 'var(--color-danger)' : undefined,
          backgroundColor: disabled ? 'var(--color-surface-subtle)' : undefined,
          cursor: disabled ? 'not-allowed' : undefined,
          opacity: disabled ? 0.7 : undefined,
          ...style,
        }}
        {...restProps}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>

      {error ? (
        <div
          className="form-error-text animated-fade-in"
          style={{
            fontSize: 12,
            color: 'var(--color-danger)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      ) : helperText ? (
        <div
          className="form-helper-text"
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginTop: 4,
          }}
        >
          {helperText}
        </div>
      ) : null}
    </div>
  );
};
