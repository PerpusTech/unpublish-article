import React from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'outline'
  | 'ghost'
  | 'accent';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual color style variant */
  variant?: ButtonVariant;
  /** Size of the button */
  size?: ButtonSize;
  /** Whether the button is in a loading state (disables button and shows spinner) */
  isLoading?: boolean;
  /** Optional text to display while loading */
  loadingText?: string;
  /** Icon displayed before children */
  leftIcon?: React.ReactNode;
  /** Icon displayed after children */
  rightIcon?: React.ReactNode;
  /** Stretch button to 100% of parent width */
  fullWidth?: boolean;
  /** Additional custom class names */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Reusable Button component with built-in loading states, icon slots, and multiple variants.
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="md" leftIcon={<FiSave />} isLoading={saving} onClick={handleSave}>
 *   Simpan Perubahan
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  loadingText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled = false,
  className = '',
  style,
  children,
  type = 'button',
  ...restProps
}) => {
  const variantClass = `btn-${variant}`;
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  const fullWidthClass = fullWidth ? 'btn-full-width' : '';
  const loadingClass = isLoading ? 'is-loading' : '';

  const combinedClassName = ['btn', variantClass, sizeClass, fullWidthClass, loadingClass, className]
    .filter(Boolean)
    .join(' ');

  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={combinedClassName}
      style={{
        width: fullWidth ? '100%' : undefined,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !isLoading ? 0.6 : undefined,
        ...style,
      }}
      {...restProps}
    >
      {isLoading ? (
        <>
          <span
            className="btn-spinner"
            style={{
              width: size === 'sm' ? 12 : 14,
              height: size === 'sm' ? 12 : 14,
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="btn-icon btn-left-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{leftIcon}</span>}
          {children && <span>{children}</span>}
          {rightIcon && <span className="btn-icon btn-right-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
