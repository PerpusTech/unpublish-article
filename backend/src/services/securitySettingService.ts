import { query } from '../config/appDb';
import { Request } from 'express';

export type AccessControlMode = 'HYBRID' | 'UMS_NETWORK_ONLY' | 'TOKEN_ONLY';

export interface SecuritySettings {
  accessMode: AccessControlMode;
  umsIpWhitelist: string[];
  sessionDurationMinutes: number;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_UMS_IP_WHITELIST: string[] = [
  '10.0.0.0/8',       // Private UMS Intranet Subnet
  '172.16.0.0/12',    // Docker / Internal Campus Subnet
  '192.168.0.0/16',   // Local Campus Subnet
  '127.0.0.1',        // Localhost IPv4
  '::1',              // Localhost IPv6
  'localhost',
];

export class SecuritySettingService {
  private static cachedSettings: SecuritySettings | null = null;
  private static cacheExpiry = 0;

  /**
   * Convert IPv4 string to 32-bit unsigned integer
   */
  private static ipToInt(ip: string): number {
    return (
      ip
        .split('.')
        .reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0) >>> 0
    );
  }

  /**
   * Check if a given clean IPv4 address matches a CIDR range
   */
  public static matchesCidr(ip: string, cidr: string): boolean {
    const trimmedCidr = cidr.trim().toLowerCase();
    const trimmedIp = ip.trim().toLowerCase();

    // Localhost keywords
    if (trimmedCidr === 'localhost' || trimmedCidr === '127.0.0.1' || trimmedCidr === '::1') {
      if (
        trimmedIp === '127.0.0.1' ||
        trimmedIp === '::1' ||
        trimmedIp === '::ffff:127.0.0.1' ||
        trimmedIp === 'localhost'
      ) {
        return true;
      }
    }

    // Clean IPv6-mapped IPv4 (e.g., ::ffff:192.168.1.5)
    let cleanIp = trimmedIp;
    if (cleanIp.startsWith('::ffff:')) {
      cleanIp = cleanIp.replace('::ffff:', '');
    }

    if (!trimmedCidr.includes('/')) {
      return cleanIp === trimmedCidr;
    }

    const [range, bits] = trimmedCidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

    try {
      return (this.ipToInt(cleanIp) & mask) === (this.ipToInt(range) & mask);
    } catch {
      return false;
    }
  }

  /**
   * Extract client IP from request headers (x-forwarded-for, x-real-ip, or socket)
   */
  public static extractClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      const first = raw.split(',')[0].trim();
      if (first) return first;
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp.trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  /**
   * Retrieve active security settings from database or cache
   */
  public static async getSettings(): Promise<SecuritySettings> {
    const now = Date.now();
    if (this.cachedSettings && this.cacheExpiry > now) {
      return this.cachedSettings;
    }

    try {
      const modeRow = await query.get<{ value: string; updated_at: string }>(
        'SELECT value, updated_at FROM system_settings WHERE key = ?',
        ['access_mode']
      );

      const whitelistRow = await query.get<{ value: string }>(
        'SELECT value FROM system_settings WHERE key = ?',
        ['ums_ip_whitelist']
      );

      const durationRow = await query.get<{ value: string }>(
        'SELECT value FROM system_settings WHERE key = ?',
        ['session_duration_minutes']
      );

      const updatedByRow = await query.get<{ value: string }>(
        'SELECT value FROM system_settings WHERE key = ?',
        ['security_updated_by']
      );

      let accessMode: AccessControlMode = 'HYBRID';
      if (modeRow?.value && ['HYBRID', 'UMS_NETWORK_ONLY', 'TOKEN_ONLY'].includes(modeRow.value)) {
        accessMode = modeRow.value as AccessControlMode;
      }

      let umsIpWhitelist: string[] = DEFAULT_UMS_IP_WHITELIST;
      if (whitelistRow?.value) {
        try {
          const parsed = JSON.parse(whitelistRow.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            umsIpWhitelist = parsed;
          }
        } catch { }
      }

      let sessionDurationMinutes = 120; // Default 2 hours
      if (durationRow?.value) {
        const parsed = parseInt(durationRow.value, 10);
        if (!isNaN(parsed) && parsed >= 15 && parsed <= 10080) {
          sessionDurationMinutes = parsed;
        }
      }

      this.cachedSettings = {
        accessMode,
        umsIpWhitelist,
        sessionDurationMinutes,
        updatedAt: modeRow?.updated_at || new Date().toISOString(),
        updatedBy: updatedByRow?.value || 'SYSTEM',
      };
      this.cacheExpiry = now + 10000; // 10-second in-memory cache

      return this.cachedSettings;
    } catch (err) {
      console.warn('[SecuritySettingService] Gagal membaca system_settings dari DB, menggunakan default:', err);
      return {
        accessMode: 'HYBRID',
        umsIpWhitelist: DEFAULT_UMS_IP_WHITELIST,
        sessionDurationMinutes: 120,
        updatedAt: new Date().toISOString(),
        updatedBy: 'SYSTEM',
      };
    }
  }

  /**
   * Update active security settings in database
   */
  public static async updateSettings(
    accessMode: AccessControlMode,
    umsIpWhitelist: string[],
    adminEmail: string,
    sessionDurationMinutes: number = 120
  ): Promise<SecuritySettings> {
    const cleanedWhitelist = Array.from(
      new Set(
        umsIpWhitelist
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      )
    );

    const validDuration = Math.max(15, Math.min(10080, parseInt(sessionDurationMinutes as any, 10) || 120));
    const now = new Date().toISOString();

    await query.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('access_mode', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [accessMode, now]
    );

    await query.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('ums_ip_whitelist', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [JSON.stringify(cleanedWhitelist), now]
    );

    await query.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('session_duration_minutes', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [validDuration.toString(), now]
    );

    await query.run(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('security_updated_by', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [adminEmail, now]
    );

    this.cachedSettings = {
      accessMode,
      umsIpWhitelist: cleanedWhitelist,
      sessionDurationMinutes: validDuration,
      updatedAt: now,
      updatedBy: adminEmail,
    };
    this.cacheExpiry = Date.now() + 10000;

    console.log(`[SecuritySettings] Mode: ${accessMode}, Durasi Sesi: ${validDuration} menit oleh ${adminEmail}`);

    return this.cachedSettings;
  }

  /**
   * Test if client IP is within UMS campus network
   */
  public static async isClientInUmsNetwork(clientIp: string): Promise<boolean> {
    const settings = await this.getSettings();
    for (const cidr of settings.umsIpWhitelist) {
      if (this.matchesCidr(clientIp, cidr)) {
        return true;
      }
    }
    return false;
  }
}
