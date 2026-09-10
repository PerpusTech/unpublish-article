import { Request, Response } from 'express';
import { SecuritySettingService, AccessControlMode } from '../services/securitySettingService';
import { CasService } from '../services/casService';
import { ENV } from '../config/env';

export class SettingController {
  /**
   * Get public network status & active access policy for Patron Portal
   */
  public static async getPatronNetworkStatus(req: Request, res: Response): Promise<void> {
    try {
      const clientIp = SecuritySettingService.extractClientIp(req);
      const isUmsNetwork = await SecuritySettingService.isClientInUmsNetwork(clientIp);
      const settings = await SecuritySettingService.getSettings();

      const canReadDirectly =
        (settings.accessMode === 'UMS_NETWORK_ONLY' || settings.accessMode === 'HYBRID') &&
        isUmsNetwork;

      const isTokenRequired =
        settings.accessMode === 'TOKEN_ONLY' ||
        (!isUmsNetwork && settings.accessMode === 'HYBRID');

      const isBlocked = settings.accessMode === 'UMS_NETWORK_ONLY' && !isUmsNetwork;

      let message = 'Akses naskah terbuka melalui jaringan intranet UMS.';
      if (settings.accessMode === 'TOKEN_ONLY') {
        message = 'Akses membaca naskah memerlukan token aktif dari pustakawan.';
      } else if (isBlocked) {
        message = 'Naskah repositori dibatasi khusus untuk perangkat yang terhubung ke Wi-Fi / Jaringan Kampus UMS.';
      } else if (isUmsNetwork) {
        message = 'Terhubung ke Jaringan Kampus UMS — Akses langsung tanpa token diaktifkan.';
      }

      res.json({
        clientIp,
        isUmsNetwork,
        accessMode: settings.accessMode,
        canReadDirectly,
        isTokenRequired,
        isBlocked,
        message,
      });
    } catch (err: any) {
      console.error('[SettingController] Error getPatronNetworkStatus:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Gagal mendeteksi status jaringan.' } });
    }
  }

  /**
   * Patron self-identification check-in for UMS Campus Network
   */
  public static async intranetCheckin(req: Request, res: Response): Promise<void> {
    try {
      const clientIp = SecuritySettingService.extractClientIp(req);
      const isUmsNetwork = await SecuritySettingService.isClientInUmsNetwork(clientIp);
      const settings = await SecuritySettingService.getSettings();

      if (settings.accessMode === 'TOKEN_ONLY' || (!isUmsNetwork && settings.accessMode === 'UMS_NETWORK_ONLY')) {
        res.status(403).json({
          error: {
            code: 'CAMPUS_NETWORK_REQUIRED',
            message: 'Check-in mandiri hanya tersedia untuk perangkat yang terhubung ke jaringan kampus UMS.',
          },
        });
        return;
      }

      const { patronNim, patronName } = req.body;

      if (!patronNim || typeof patronNim !== 'string' || !patronNim.trim()) {
        res.status(400).json({
          error: {
            code: 'INVALID_NIM',
            message: 'NIM / NIDN / No. Identitas wajib diisi.',
          },
        });
        return;
      }

      if (!patronName || typeof patronName !== 'string' || !patronName.trim()) {
        res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'Nama lengkap wajib diisi.',
          },
        });
        return;
      }

      const cleanNim = patronNim.trim().toUpperCase();
      const cleanName = patronName.trim();
      const sanitizedIp = clientIp.replace(/[^a-zA-Z0-9]/g, '_');
      const sessionId = `intranet_${sanitizedIp}_${cleanNim}`;

      // Set cookies for subsequent requests
      const cookieOptions = {
        httpOnly: false,
        secure: false,
        sameSite: 'lax' as const,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      };

      res.cookie('ums_intranet_nim', cleanNim, cookieOptions);
      res.cookie('ums_intranet_name', cleanName, cookieOptions);

      // Log check-in activation audit event
      const userAgent = (Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent']) || 'Unknown';
      const { AuditService } = await import('../services/auditService');
      AuditService.logAction({
        tokenId: sessionId,
        patronNim: cleanNim,
        patronName: cleanName,
        action: 'ACTIVATE_TOKEN',
        articleTitle: 'Check-in Mandiri Jaringan Kampus UMS',
        ipAddress: clientIp,
        userAgent,
      });

      // Also persist to tokens table so it appears in Sesi & Tiket active sessions tab
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      const tokenCode = `INT-${cleanNim}`;

      try {
        const { query } = await import('../config/appDb');
        await query.run('DELETE FROM tokens WHERE id = ? OR token_code = ?', [sessionId, tokenCode]);
        await query.run(
          `INSERT INTO tokens (
            id, token_code, patron_name, patron_nim, duration_minutes,
            status, created_by_admin, created_at, claimed_at, expires_at, notes
          ) VALUES (?, ?, ?, ?, 1440, 'ACTIVE', 'CAMPUS_INTRANET', ?, ?, ?, ?)`,
          [
            sessionId,
            tokenCode,
            cleanName,
            cleanNim,
            now,
            now,
            expiresAt,
            `Check-in Mandiri Wi-Fi Kampus UMS (${clientIp})`,
          ]
        );
      } catch (dbErr) {
        console.warn('[SettingController] Warning persisting to tokens table:', dbErr);
      }

      const session = {
        id: sessionId,
        token_code: tokenCode,
        patron_name: cleanName,
        patron_nim: cleanNim,
        expires_at: expiresAt,
        remaining_seconds: 86400,
      };

      res.json({
        success: true,
        message: `Selamat datang, ${cleanName}. Identitas membaca Anda berhasil diaktifkan.`,
        session,
      });
    } catch (err: any) {
      console.error('[SettingController] Error intranetCheckin:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Gagal memproses identifikasi pemustaka.' } });
    }
  }

  /**
   * Get admin security settings (Access Mode + IP Whitelist + Test Client IP)
   */
  public static async getSecuritySettings(req: Request, res: Response): Promise<void> {
    try {
      const clientIp = SecuritySettingService.extractClientIp(req);
      const isUmsNetwork = await SecuritySettingService.isClientInUmsNetwork(clientIp);
      const settings = await SecuritySettingService.getSettings();

      res.json({
        settings,
        currentClientIp: clientIp,
        isCurrentClientInUmsNetwork: isUmsNetwork,
      });
    } catch (err: any) {
      console.error('[SettingController] Error getSecuritySettings:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Gagal mengambil pengaturan keamanan.' } });
    }
  }

  /**
   * Update security settings (Admin only)
   */
  public static async updateSecuritySettings(req: Request, res: Response): Promise<void> {
    const { accessMode, umsIpWhitelist } = req.body;

    if (!accessMode || !['HYBRID', 'UMS_NETWORK_ONLY', 'TOKEN_ONLY'].includes(accessMode)) {
      res.status(400).json({
        error: {
          code: 'INVALID_ACCESS_MODE',
          message: 'Mode akses tidak valid. Pilih: HYBRID, UMS_NETWORK_ONLY, atau TOKEN_ONLY.',
        },
      });
      return;
    }

    if (!Array.isArray(umsIpWhitelist) || umsIpWhitelist.length === 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_WHITELIST',
          message: 'Daftar IP / Subnet UMS tidak boleh kosong.',
        },
      });
      return;
    }

    try {
      const adminEmail = req.admin?.email || 'admin@ums.ac.id';
      const updated = await SecuritySettingService.updateSettings(
        accessMode as AccessControlMode,
        umsIpWhitelist,
        adminEmail
      );

      res.json({
        success: true,
        message: 'Pengaturan keamanan dan kebijakan jaringan UMS berhasil diperbarui.',
        settings: updated,
      });
    } catch (err: any) {
      console.error('[SettingController] Error updateSecuritySettings:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Gagal menyimpan pengaturan keamanan.' } });
    }
  }

  /**
   * Initiate CAS SSO Login for Patrons (Students/Lecturers)
   */
  public static patronCasLogin(req: Request, res: Response): void {
    const loginUrl = CasService.getPatronLoginUrl();
    const switchAccountUrl = CasService.getPatronLogoutUrl(loginUrl);
    res.json({ url: loginUrl, switchAccountUrl });
  }

  /**
   * Handle CAS SSO Callback for Patrons
   */
  public static async patronCasCallback(req: Request, res: Response): Promise<void> {
    const ticket = req.query.ticket as string;
    const frontendBase = ENV.FRONTEND_URL;

    if (!ticket) {
      res.redirect(`${frontendBase}/?patron_sso_error=NO_CAS_TICKET`);
      return;
    }

    try {
      const patronServiceUrl = ENV.CAS_SERVICE_URL;
      const authResult = await CasService.validateTicket(ticket, patronServiceUrl);

      if (!authResult.success) {
        const errorMsg = encodeURIComponent(authResult.error || 'Autentikasi SSO UMS gagal.');
        res.redirect(`${frontendBase}/?patron_sso_error=${errorMsg}`);
        return;
      }

      // Extract NIM/UniID
      const rawNim =
        authResult.attributes?.['nim'] ||
        authResult.attributes?.['mhs_nim'] ||
        authResult.attributes?.['nip'] ||
        authResult.attributes?.['nik'] ||
        authResult.username ||
        authResult.email?.split('@')[0] ||
        'CIVITAS';

      const cleanNim = rawNim.trim().toUpperCase();

      // Extract official full name
      let cleanName = (authResult.name || '').trim();
      if (!cleanName || cleanName === cleanNim || cleanName === authResult.username) {
        const campusName = await CasService.resolveCampusName(cleanNim);
        cleanName = campusName || authResult.username || 'Civitas Akademika UMS';
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
      const sanitizedIp = clientIp.replace(/[^a-zA-Z0-9]/g, '_');
      const sessionId = `sso_${sanitizedIp}_${cleanNim}_${Date.now().toString(36)}`;
      const tokenCode = `SSO-${cleanNim}`;

      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 86400000).toISOString(); // 24 hours

      // Set cookie
      const cookieOptions = {
        httpOnly: false,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: 'lax' as const,
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      };

      res.cookie('ums_intranet_nim', cleanNim, cookieOptions);
      res.cookie('ums_intranet_name', cleanName, cookieOptions);

      // Audit log
      const userAgent = (Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent']) || 'Unknown';
      const { AuditService } = await import('../services/auditService');
      AuditService.logAction({
        tokenId: sessionId,
        patronNim: cleanNim,
        patronName: cleanName,
        action: 'ACTIVATE_TOKEN',
        articleTitle: `Login Terverifikasi SSO UMS (${cleanName})`,
        ipAddress: clientIp,
        userAgent,
      });

      // Persist / update civitas patron in admin_users table for login history & user management
      const { query } = await import('../config/appDb');
      const patronEmail = authResult.email?.toLowerCase() || `${cleanNim.toLowerCase()}@ums.ac.id`;
      try {
        const existingCivitas = await query.get('SELECT * FROM admin_users WHERE email = ?', [patronEmail]);
        if (!existingCivitas) {
          await query.run(
            'INSERT INTO admin_users (email, name, role, is_active, last_login_at, sso_attributes) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, ?)',
            [patronEmail, cleanName, 'USER', JSON.stringify(authResult.attributes || {})]
          );
        } else {
          await query.run(
            'UPDATE admin_users SET name = ?, last_login_at = CURRENT_TIMESTAMP, sso_attributes = ? WHERE email = ?',
            [cleanName, JSON.stringify(authResult.attributes || {}), patronEmail]
          );
        }
      } catch (userDbErr) {
        console.warn('[SettingController] Warning updating patron in admin_users:', userDbErr);
      }

      // Persist to tokens table so it is managed in active sessions
      try {
        await query.run('DELETE FROM tokens WHERE id = ? OR token_code = ?', [sessionId, tokenCode]);
        await query.run(
          `INSERT INTO tokens (
            id, token_code, patron_name, patron_nim, duration_minutes,
            status, created_by_admin, created_at, claimed_at, expires_at, notes
          ) VALUES (?, ?, ?, ?, 1440, 'ACTIVE', 'CAS_SSO', ?, ?, ?, ?)`,
          [
            sessionId,
            tokenCode,
            cleanName,
            cleanNim,
            now,
            now,
            expiresAt,
            `Login Otomatis SSO UMS auth.ums.ac.id (${clientIp})`,
          ]
        );
      } catch (dbErr) {
        console.warn('[SettingController] Warning persisting SSO token:', dbErr);
      }

      res.redirect(
        `${frontendBase}/?patron_sso=success&nim=${encodeURIComponent(cleanNim)}&name=${encodeURIComponent(cleanName)}&token_id=${encodeURIComponent(sessionId)}&token_code=${encodeURIComponent(tokenCode)}&expires_at=${encodeURIComponent(expiresAt)}`
      );
    } catch (err: any) {
      console.error('[Patron CAS Callback Error]:', err);
      const errorMsg = encodeURIComponent('Terjadi kesalahan saat memproses identitas SSO.');
      res.redirect(`${frontendBase}/?patron_sso_error=${errorMsg}`);
    }
  }
}
