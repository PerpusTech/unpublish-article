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

      const cleanNim = (patronNim && typeof patronNim === 'string' ? patronNim : '').trim().toUpperCase();
      const cleanName = (patronName && typeof patronName === 'string' ? patronName : '').trim();

      const JUNK_PATTERNS = [
        'TEST', 'TESTING', 'ASDF', 'QWERTY', 'ANONIM', 'ANONYMOUS', 'UNKNOWN',
        'ADMIN', 'USER', 'COBA', 'COBACOBA', 'SAMPLE', 'DEMO', '12345', '123456',
        'ABCDE', 'NULL', 'UNDEFINED', 'XYZ', 'XXXX', 'AAAA', 'JELEK', 'GAKTAU', 'GATAU'
      ];

      // 1. NIM Validation
      if (!cleanNim) {
        res.status(400).json({
          error: {
            code: 'INVALID_NIM',
            message: 'NIM / NIDN / No. Identitas wajib diisi.',
          },
        });
        return;
      }

      if (cleanNim.length < 5 || cleanNim.length > 25) {
        res.status(400).json({
          error: {
            code: 'INVALID_NIM',
            message: 'Nomor identitas NIM/NIDN harus antara 5 hingga 25 karakter.',
          },
        });
        return;
      }

      const isJunkNim = JUNK_PATTERNS.some((p) => cleanNim.includes(p)) || /^(.)\1{4,}$/.test(cleanNim);
      if (isJunkNim) {
        res.status(400).json({
          error: {
            code: 'INVALID_NIM',
            message: 'Format NIM/NIDN tidak valid. Mohon masukkan identitas resmi Anda.',
          },
        });
        return;
      }

      // 2. Name Validation
      if (!cleanName) {
        res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'Nama lengkap wajib diisi.',
          },
        });
        return;
      }

      if (cleanName.length < 5) {
        res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'Nama lengkap minimal 5 karakter.',
          },
        });
        return;
      }

      if (!/^[a-zA-Z\s'’.\-]+$/.test(cleanName)) {
        res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'Nama lengkap hanya boleh memuat huruf alfabet (tanpa angka atau karakter aneh).',
          },
        });
        return;
      }

      const words = cleanName.split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'Harap masukkan nama lengkap minimal 2 kata (contoh: Ahmad Dahlan atau Muhammad Ilham).',
          },
        });
        return;
      }

      const upperName = cleanName.toUpperCase();
      const isJunkName = JUNK_PATTERNS.some((p) => upperName.includes(p)) || /^(.)\1{3,}$/.test(cleanName.replace(/\s/g, ''));
      if (isJunkName) {
        res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'Nama yang dimasukkan tidak valid. Harap gunakan nama lengkap resmi.',
          },
        });
        return;
      }

      const sanitizedIp = clientIp.replace(/[^a-zA-Z0-9]/g, '_');
      const sessionId = `intranet_${sanitizedIp}_${cleanNim}`;

      const durationMinutes = settings.sessionDurationMinutes || 120;
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const expiresAt = new Date(nowMs + durationMinutes * 60 * 1000).toISOString();
      const remainingSeconds = durationMinutes * 60;

      // Set cookies for subsequent requests
      const cookieOptions = {
        httpOnly: false,
        secure: false,
        sameSite: 'lax' as const,
        maxAge: durationMinutes * 60 * 1000,
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
      const tokenCode = `INT-${cleanNim}`;

      try {
        const { query } = await import('../config/appDb');
        await query.run('DELETE FROM tokens WHERE id = ? OR token_code = ?', [sessionId, tokenCode]);
        await query.run(
          `INSERT INTO tokens (
            id, token_code, patron_name, patron_nim, duration_minutes,
            status, created_by_admin, created_at, claimed_at, expires_at, notes
          ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'CAMPUS_INTRANET', ?, ?, ?, ?)`,
          [
            sessionId,
            tokenCode,
            cleanName,
            cleanNim,
            durationMinutes,
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
        remaining_seconds: remainingSeconds,
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
   * Get admin security settings (Access Mode + IP Whitelist + Session Duration + Test Client IP)
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
    const { accessMode, umsIpWhitelist, sessionDurationMinutes } = req.body;

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
      const duration = parseInt(sessionDurationMinutes, 10) || 120;
      const updated = await SecuritySettingService.updateSettings(
        accessMode as AccessControlMode,
        umsIpWhitelist,
        adminEmail,
        duration
      );

      res.json({
        success: true,
        message: 'Pengaturan keamanan, kebijakan jaringan, dan durasi sesi UMS berhasil diperbarui.',
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
  public static async patronCasLogin(req: Request, res: Response): Promise<void> {
    try {
      const settings = await SecuritySettingService.getSettings();
      if (settings.accessMode === 'TOKEN_ONLY') {
        res.status(403).json({
          error: {
            code: 'TOKEN_ONLY_POLICY',
            message: 'Kebijakan akses repositori saat ini diatur khusus tiket token meja layanan. Login SSO dinonaktifkan.',
          },
        });
        return;
      }
      const serviceUrl = `${ENV.FRONTEND_URL || 'http://localhost:3000'}/api/v1/patron/sso/callback`;
      const loginUrl = CasService.getPatronLoginUrl(serviceUrl);
      res.json({ url: loginUrl });
    } catch (err: any) {
      console.error('[SettingController] Error patronCasLogin:', err);
      res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Gagal memproses URL login SSO.' } });
    }
  }

  /**
   * Handle CAS SSO Callback for Patrons
   */
  public static async patronCasCallback(req: Request, res: Response): Promise<void> {
    const ticket = req.query.ticket as string;
    const frontendBase = ENV.FRONTEND_URL || 'http://localhost:3000';
    const serviceUrl = `${ENV.FRONTEND_URL || 'http://localhost:3000'}/api/v1/patron/sso/callback`;

    if (!ticket) {
      res.redirect(`${frontendBase}/?patron_sso_error=NO_CAS_TICKET`);
      return;
    }

    try {
      const clientIp = SecuritySettingService.extractClientIp(req);
      const isUmsNetwork = await SecuritySettingService.isClientInUmsNetwork(clientIp);
      const settings = await SecuritySettingService.getSettings();

      if (settings.accessMode === 'TOKEN_ONLY') {
        const errorMsg = encodeURIComponent('Akses saat ini dibatasi hanya dengan Tiket Token Meja Layanan.');
        res.redirect(`${frontendBase}/?patron_sso_error=${errorMsg}`);
        return;
      }

      const authResult = await CasService.validateTicket(ticket, serviceUrl);

      if (!authResult.success) {
        const errorMsg = encodeURIComponent(authResult.error || 'Tiket SSO CAS tidak valid.');
        res.redirect(`${frontendBase}/?patron_sso_error=${errorMsg}`);
        return;
      }

      const rawNim =
        authResult.attributes?.['nim'] ||
        authResult.attributes?.['mhs_nim'] ||
        authResult.attributes?.['nip'] ||
        authResult.attributes?.['nik'] ||
        authResult.username ||
        authResult.email?.split('@')[0] ||
        'CIVITAS';

      const cleanNim = rawNim.trim().toUpperCase();

      let cleanName = (authResult.name || '').trim();
      if (!cleanName || cleanName === cleanNim || cleanName === authResult.username) {
        const campusName = await CasService.resolveCampusName(cleanNim);
        cleanName = campusName || authResult.username || 'Civitas Akademika UMS';
      }

      const sanitizedIp = clientIp.replace(/[^a-zA-Z0-9]/g, '_');
      const sessionId = `sso_${sanitizedIp}_${cleanNim}_${Date.now().toString(36)}`;
      const tokenCode = `SSO-${cleanNim}`;

      const durationMinutes = settings.sessionDurationMinutes || 120;
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const expiresAt = new Date(nowMs + durationMinutes * 60 * 1000).toISOString();
      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

      const cookieOptions = {
        httpOnly: false,
        secure: isHttps,
        sameSite: 'lax' as const,
        maxAge: durationMinutes * 60 * 1000,
        path: '/',
      };

      res.cookie('ums_intranet_nim', cleanNim, cookieOptions);
      res.cookie('ums_intranet_name', cleanName, cookieOptions);

      // Log activation audit event
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

      // Also persist to tokens table so it appears in Sesi & Tiket active sessions tab
      const { query } = await import('../config/appDb');
      try {
        await query.run('DELETE FROM tokens WHERE id = ? OR token_code = ?', [sessionId, tokenCode]);
        await query.run(
          `INSERT INTO tokens (
            id, token_code, patron_name, patron_nim, duration_minutes,
            status, created_by_admin, created_at, claimed_at, expires_at, notes
          ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'CAS_SSO', ?, ?, ?, ?)`,
          [
            sessionId,
            tokenCode,
            cleanName,
            cleanNim,
            durationMinutes,
            now,
            now,
            expiresAt,
            `Login Otomatis SSO UMS auth.ums.ac.id (${clientIp})`,
          ]
        );
      } catch (dbErr) {
        console.warn('[SettingController] Warning persisting SSO token:', dbErr);
      }

      const remainingSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - nowMs) / 1000));

      res.redirect(
        `${frontendBase}/?patron_sso=success&nim=${encodeURIComponent(cleanNim)}&name=${encodeURIComponent(cleanName)}&token_id=${encodeURIComponent(sessionId)}&token_code=${encodeURIComponent(tokenCode)}&expires_at=${encodeURIComponent(expiresAt)}&remaining_seconds=${remainingSeconds}`
      );
    } catch (err: any) {
      console.error('[Patron CAS Callback Error]:', err);
      const errorMsg = encodeURIComponent('Terjadi kesalahan saat memproses identitas SSO.');
      res.redirect(`${frontendBase}/?patron_sso_error=${errorMsg}`);
    }
  }
}
