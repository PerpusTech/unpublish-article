import React from 'react';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Form field label displayed above input */
  label?: React.ReactNode;
  /** Error message displayed below input in danger style */
  error?: string | null;
  /** Helper or informational text below input */
  helperText?: React.ReactNode;
  /** Show red asterisk next to label */
  required?: boolean;
  /** Icon displayed inside the left of input */
  leftIcon?: React.ReactNode;
  /** Element or button placed inside the right of input */
  rightElement?: React.ReactNode;
  /** Custom class for outer wrapper */
  containerClassName?: string;
  /** Custom style for outer wrapper */
  containerStyle?: React.CSSProperties;
}

/**
 * Reusable FormInput component with label, left icon, right element, and error validation feedback.
 * 
 * @example
 * ```tsx
 * <FormInput
 *   label="Nama Lengkap"
 *   placeholder="Masukkan nama..."
 *   value={name}
 *   onChange={(e) => setName(e.target.value)}
 *   error={nameError}
 *   required
 * />
 * ```
 */
export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  helperText,
  required = false,
  leftIcon,
  rightElement,
  containerClassName = '',
  containerStyle,
  className = '',
  id,
  disabled,
  style,
  ...restProps
}) => {
  const generatedId = id || (typeof label === 'string' ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
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

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {leftIcon && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: 14,
            }}
          >
            {leftIcon}
          </div>
        )}

        <input
          id={generatedId}
          disabled={disabled}
          className={`form-input ${isInvalid ? 'is-invalid' : ''} ${className}`}
          style={{
            width: '100%',
            paddingLeft: leftIcon ? 36 : 13,
            paddingRight: rightElement ? 38 : 13,
            borderColor: isInvalid ? 'var(--color-danger)' : undefined,
            backgroundColor: disabled ? 'var(--color-surface-subtle)' : undefined,
            cursor: disabled ? 'not-allowed' : undefined,
            opacity: disabled ? 0.7 : undefined,
            ...style,
          }}
          {...restProps}
        />

        {rightElement && (
          <div
            style={{
              position: 'absolute',
              right: 10,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <div
          className="form-error-text animated-fade-in"
          style={{
            fontSize: 12,
            color: 'var(--color-danger)',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>⚠</span> {error}
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
