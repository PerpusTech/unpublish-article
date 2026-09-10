/**
 * Utility to parse and format dates safely with proper UTC -> Local timezone handling.
 * SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:mm:ss" in UTC without 'Z'.
 * Without 'Z', JavaScript interprets it as local time, causing a 7-hour discrepancy in WIB (GMT+7).
 */

export function parseDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(input).trim();
  if (!str) return null;

  // Check if string is SQLite datetime format "YYYY-MM-DD HH:mm:ss" or missing 'Z'
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    const normalized = str.replace(' ', 'T') + 'Z';
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(
  input: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = '-'
): string {
  const date = parseDate(input);
  if (!date) return fallback;

  try {
    // If dateStyle or timeStyle is explicitly provided, Intl does not allow day, month, hour, etc.
    if (options && (options.dateStyle || options.timeStyle)) {
      return date.toLocaleString('id-ID', options);
    }

    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    };

    return date.toLocaleString('id-ID', defaultOptions);
  } catch {
    try {
      return date.toLocaleString('id-ID');
    } catch {
      return fallback;
    }
  }
}

export function formatDate(
  input: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = '-'
): string {
  const date = parseDate(input);
  if (!date) return fallback;

  try {
    if (options && (options.dateStyle || options.timeStyle)) {
      return date.toLocaleDateString('id-ID', options);
    }

    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...options,
    };

    return date.toLocaleDateString('id-ID', defaultOptions);
  } catch {
    try {
      return date.toLocaleDateString('id-ID');
    } catch {
      return fallback;
    }
  }
}

export function formatTime(
  input: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = '-'
): string {
  const date = parseDate(input);
  if (!date) return fallback;

  try {
    if (options && (options.dateStyle || options.timeStyle)) {
      return date.toLocaleTimeString('id-ID', options);
    }

    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    };

    return date.toLocaleTimeString('id-ID', defaultOptions);
  } catch {
    try {
      return date.toLocaleTimeString('id-ID');
    } catch {
      return fallback;
    }
  }
}

