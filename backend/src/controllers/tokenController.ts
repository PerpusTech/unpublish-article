import { Request, Response } from 'express';
import { TokenService } from '../services/tokenService';
import { AuditService } from '../services/auditService';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

function getHeader(header: string | string[] | undefined): string {
  if (Array.isArray(header)) return header[0] || '';
  return header || '';
}

export class TokenController {
  /**
   * Admin creates a new token
   */
  public static async createToken(req: Request, res: Response): Promise<void> {
    const { patronName, patronNim, durationMinutes, notes } = req.body;

    if (!patronName || !patronNim) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Nama dan NIM Pemustaka wajib diisi.'
        }
      });
      return;
    }

    const duration = parseInt(durationMinutes || '120', 10);
    if (isNaN(duration) || duration < 15 || duration > 480) {
      res.status(400).json({
        error: {
          code: 'INVALID_DURATION',
          message: 'Durasi harus berupa angka antara 15 hingga 480 menit (8 jam).'
        }
      });
      return;
    }

    try {
      const createdBy = req.admin?.email || 'admin@ums.ac.id';
      const result = await TokenService.createToken({
        patronName,
        patronNim,
        durationMinutes: duration,
        createdByAdmin: createdBy,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Token berhasil diterbitkan.',
        token: result.token,
        qrDataUrl: result.qrDataUrl
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal menerbitkan token.'
        }
      });
    }
  }

  /**
   * Admin lists active and pending tokens
   */
  public static async listTokens(req: Request, res: Response): Promise<void> {
    const status = (req.query.status as string) || 'ALL';
    const search = req.query.search as string;

    try {
      const tokens = await TokenService.listTokens({ status, search });
      res.json({ tokens });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal memuat daftar token.'
        }
      });
    }
  }

  /**
   * Admin extends active/expired token duration
   */
  public static async extendToken(req: Request, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const { minutes } = req.body;

    const extra = parseInt(minutes || '30', 10);
    if (isNaN(extra) || extra <= 0 || extra > 240) {
      res.status(400).json({
        error: {
          code: 'INVALID_MINUTES',
          message: 'Jumlah penambahan waktu harus antara 1 sampai 240 menit.'
        }
      });
      return;
    }

    try {
      const result = await TokenService.extendSession(id, extra);
      if (!result.success) {
        res.status(400).json({ error: { code: 'EXTEND_FAILED', message: result.message } });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        token: result.token
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal memperpanjang sesi.'
        }
      });
    }
  }

  /**
   * Admin revokes token
   */
  public static async revokeToken(req: Request, res: Response): Promise<void> {
    const id = getParam(req.params.id);

    try {
      const ok = await TokenService.revokeSession(id);
      if (!ok) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Token tidak ditemukan.' } });
        return;
      }

      res.json({ success: true, message: 'Token berhasil dicabut.' });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal mencabut token.'
        }
      });
    }
  }

  /**
   * Patron claims / activates a token
   */
  public static async claimToken(req: Request, res: Response): Promise<void> {
    const { tokenCode, clientUuid } = req.body;

    if (!tokenCode) {
      res.status(400).json({
        error: {
          code: 'CODE_REQUIRED',
          message: 'Kode token wajib diisi.'
        }
      });
      return;
    }

    const ip = getHeader(req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = getHeader(req.headers['user-agent']) || 'Unknown';
    const fingerprint = TokenService.createFingerprint(ip, userAgent, clientUuid);

    try {
      const result = await TokenService.claimToken(tokenCode, fingerprint);

      if (!result.success || !result.token) {
        res.status(400).json({
          error: {
            code: 'CLAIM_FAILED',
            message: result.message
          }
        });
        return;
      }

      // Record Audit Log for Activation
      await AuditService.logAction({
        tokenId: result.token.id,
        patronNim: result.token.patron_nim,
        patronName: result.token.patron_name,
        action: 'ACTIVATE_TOKEN',
        ipAddress: ip,
        userAgent
      });

      // Set cookies for patron token ID and client UUID
      res.cookie('patron_token_id', result.token.id, {
        httpOnly: true,
        secure: false, // Local/Intranet friendly
        sameSite: 'lax',
        maxAge: result.token.duration_minutes * 60 * 1000
      });
      if (clientUuid) {
        res.cookie('client_uuid', clientUuid, {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          maxAge: result.token.duration_minutes * 60 * 1000
        });
      }

      res.json({
        success: true,
        message: result.message,
        session: {
          id: result.token.id,
          token_code: result.token.token_code,
          patron_name: result.token.patron_name,
          patron_nim: result.token.patron_nim,
          expires_at: result.token.expires_at,
          remaining_seconds: result.token.remaining_seconds
        }
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal mengaktivasi token.'
        }
      });
    }
  }

  /**
   * Patron gets current session status
   */
  public static async getSessionStatus(req: Request, res: Response): Promise<void> {
    const tokenId = (req.cookies?.patron_token_id ||
      req.headers['x-patron-token-id'] ||
      req.query?.token_id) as string;

    if (!tokenId) {
      res.json({ isActive: false });
      return;
    }

    const xf = getHeader(req.headers['x-forwarded-for']);
    const clientIp = xf ? xf.split(',')[0].trim() : (req.socket.remoteAddress || '127.0.0.1');
    const rawIp = req.socket.remoteAddress || '127.0.0.1';
    const userAgent = getHeader(req.headers['user-agent']) || 'Unknown';
    const clientUuid = (getHeader(req.headers['x-client-uuid']) || req.cookies?.client_uuid || (req.query?.client_uuid as string)) as string;
    const fingerprint = TokenService.createFingerprint(clientIp, userAgent, clientUuid);

    const fallbacks: string[] = [
      TokenService.createFingerprint(clientIp, userAgent),
      TokenService.createFingerprint(rawIp, userAgent),
      TokenService.createLegacyFingerprint(clientIp, userAgent, clientUuid),
      TokenService.createLegacyFingerprint(clientIp, userAgent, undefined),
      TokenService.createLegacyFingerprint(clientIp, userAgent, 'none'),
      TokenService.createLegacyFingerprint(rawIp, userAgent, clientUuid),
      TokenService.createLegacyFingerprint(rawIp, userAgent, undefined),
      TokenService.createLegacyFingerprint(rawIp, userAgent, 'none'),
      TokenService.createLegacyFingerprint('127.0.0.1', userAgent),
      TokenService.createLegacyFingerprint('::1', userAgent),
      TokenService.createLegacyFingerprint('172.29.0.1', userAgent),
      TokenService.createFingerprint('172.29.0.1', userAgent),
      TokenService.createFingerprint('127.0.0.1', userAgent),
      TokenService.createFingerprint('::1', userAgent),
    ];
    if (clientUuid) {
      fallbacks.push(TokenService.createLegacyFingerprint('127.0.0.1', userAgent, clientUuid));
      fallbacks.push(TokenService.createLegacyFingerprint('::1', userAgent, clientUuid));
      fallbacks.push(TokenService.createLegacyFingerprint('172.29.0.1', userAgent, clientUuid));
    }

    const status = await TokenService.getSessionStatus(tokenId, fingerprint, fallbacks);

    if (!status.isValid || !status.token) {
      // Only clear cookie if token explicitly expired or revoked
      if (status.reason?.includes('habis') || status.reason?.includes('dicabut')) {
        res.clearCookie('patron_token_id');
      }
      res.json({
        isActive: false,
        reason: status.reason || 'Sesi telah berakhir.'
      });
      return;
    }

    // Refresh cookies
    res.cookie('patron_token_id', status.token.id, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: (status.token.remaining_seconds || 7200) * 1000
    });
    if (clientUuid) {
      res.cookie('client_uuid', clientUuid, {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        maxAge: (status.token.remaining_seconds || 7200) * 1000
      });
    }

    res.json({
      isActive: true,
      session: {
        id: status.token.id,
        token_code: status.token.token_code,
        patron_name: status.token.patron_name,
        patron_nim: status.token.patron_nim,
        expires_at: status.token.expires_at,
        remaining_seconds: status.token.remaining_seconds
      }
    });
  }

  /**
   * Patron logout
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('patron_token_id');
    res.json({ success: true, message: 'Sesi selesai.' });
  }
}
