import { Request, Response } from 'express';
import { SecuritySettingService, AccessControlMode } from '../services/securitySettingService';

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
}
