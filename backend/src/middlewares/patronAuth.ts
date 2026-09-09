import { Request, Response, NextFunction } from 'express';
import { TokenService, TokenRecord } from '../services/tokenService';
import { SecuritySettingService } from '../services/securitySettingService';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      patron?: TokenRecord;
      fingerprint?: string;
      admin?: {
        email: string;
        name: string;
        role: string;
      };
    }
  }
}

export function extractClientIp(req: Request): string {
  return SecuritySettingService.extractClientIp(req);
}

export async function requirePatronSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const clientIp = extractClientIp(req);
  const rawIp = req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent']) || 'Unknown';
  const clientUuid =
    (Array.isArray(req.headers['x-client-uuid']) ? req.headers['x-client-uuid'][0] : req.headers['x-client-uuid']) ||
    (req.query?.client_uuid as string) ||
    req.cookies?.client_uuid ||
    undefined;

  const tokenId = (req.cookies?.patron_token_id ||
    req.headers['x-patron-token-id'] ||
    req.query?.token_id ||
    req.query?.tid) as string;

  // Retrieve current security & network policy settings
  const settings = await SecuritySettingService.getSettings();
  const isUmsNetwork = await SecuritySettingService.isClientInUmsNetwork(clientIp);

  // === CASE 1: Mode UMS_NETWORK_ONLY ===
  if (settings.accessMode === 'UMS_NETWORK_ONLY') {
    if (!isUmsNetwork) {
      res.status(403).json({
        error: {
          code: 'CAMPUS_NETWORK_REQUIRED',
          message: 'Akses membaca naskah dibatasi khusus untuk perangkat yang terhubung ke jaringan Wi-Fi / Intranet Kampus UMS.',
        },
      });
      return;
    }

    // Auto-grant Intranet Patron Session for UMS Network client
    req.patron = {
      id: `intranet_${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`,
      token_code: 'INTRANET_UMS',
      patron_name: 'Civitas Akademika UMS',
      patron_nim: clientIp,
      duration_minutes: 1440,
      extended_minutes: 0,
      status: 'ACTIVE',
      created_by_admin: 'CAMPUS_IP_POLICY',
      created_at: new Date().toISOString(),
      claimed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      remaining_seconds: 86400,
    };
    return next();
  }

  // === CASE 2: Mode HYBRID (Jaringan UMS ATAU Token) ===
  if (settings.accessMode === 'HYBRID') {
    // If inside UMS Campus Network, automatically allow read access
    if (isUmsNetwork && !tokenId) {
      req.patron = {
        id: `intranet_${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`,
        token_code: 'INTRANET_UMS',
        patron_name: 'Civitas Akademika UMS',
        patron_nim: clientIp,
        duration_minutes: 1440,
        extended_minutes: 0,
        status: 'ACTIVE',
        created_by_admin: 'CAMPUS_IP_POLICY',
        created_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        remaining_seconds: 86400,
      };
      return next();
    }
  }

  // === CASE 3: Token Verification (For TOKEN_ONLY or HYBRID outside campus) ===
  if (!tokenId) {
    const errorMsg =
      settings.accessMode === 'HYBRID'
        ? 'Perangkat Anda terdeteksi di luar jaringan kampus UMS. Silakan masukkan token membaca aktif dari pustakawan.'
        : 'Akses memerlukan token membaca aktif yang diterbitkan oleh pustakawan UMS.';

    res.status(401).json({
      error: {
        code: 'TOKEN_REQUIRED',
        message: errorMsg,
      },
    });
    return;
  }

  const fingerprint = TokenService.createFingerprint(clientIp, userAgent, clientUuid);
  req.fingerprint = fingerprint;

  const fallbacks: string[] = [];
  if (rawIp && rawIp !== clientIp) {
    fallbacks.push(TokenService.createFingerprint(rawIp, userAgent, clientUuid));
  }
  fallbacks.push(TokenService.createFingerprint('127.0.0.1', userAgent, clientUuid));
  fallbacks.push(TokenService.createFingerprint('::1', userAgent, clientUuid));
  fallbacks.push(TokenService.createFingerprint('172.29.0.1', userAgent, clientUuid));
  fallbacks.push(TokenService.createLegacyFingerprint(clientIp, userAgent, clientUuid));
  fallbacks.push(TokenService.createLegacyFingerprint(rawIp, userAgent, clientUuid));

  const status = await TokenService.getSessionStatus(tokenId, fingerprint, fallbacks);

  if (!status.isValid || !status.token) {
    res.status(401).json({
      error: {
        code: 'SESSION_EXPIRED',
        message: status.reason || 'Sesi membaca Anda telah berakhir atau token tidak valid.',
      },
    });
    return;
  }

  // Set/refresh cookie
  res.cookie('patron_token_id', status.token.id, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: (status.token.remaining_seconds || 7200) * 1000,
  });

  req.patron = status.token;
  next();
}

export async function optionalPatronSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const clientIp = extractClientIp(req);
  const rawIp = req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent']) || 'Unknown';
  const clientUuid =
    (Array.isArray(req.headers['x-client-uuid']) ? req.headers['x-client-uuid'][0] : req.headers['x-client-uuid']) ||
    (req.query?.client_uuid as string) ||
    req.cookies?.client_uuid ||
    undefined;

  const tokenId = (req.cookies?.patron_token_id ||
    req.headers['x-patron-token-id'] ||
    req.query?.token_id ||
    req.query?.tid) as string;

  try {
    const settings = await SecuritySettingService.getSettings();
    const isUmsNetwork = await SecuritySettingService.isClientInUmsNetwork(clientIp);

    if ((settings.accessMode === 'UMS_NETWORK_ONLY' || settings.accessMode === 'HYBRID') && isUmsNetwork && !tokenId) {
      req.patron = {
        id: `intranet_${clientIp.replace(/[^a-zA-Z0-9]/g, '_')}`,
        token_code: 'INTRANET_UMS',
        patron_name: 'Civitas Akademika UMS',
        patron_nim: clientIp,
        duration_minutes: 1440,
        extended_minutes: 0,
        status: 'ACTIVE',
        created_by_admin: 'CAMPUS_IP_POLICY',
        created_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        remaining_seconds: 86400,
      };
      return next();
    }

    if (!tokenId) {
      return next();
    }

    const fingerprint = TokenService.createFingerprint(clientIp, userAgent, clientUuid);
    req.fingerprint = fingerprint;

    const fallbacks: string[] = [];
    if (rawIp && rawIp !== clientIp) {
      fallbacks.push(TokenService.createFingerprint(rawIp, userAgent, clientUuid));
    }
    fallbacks.push(TokenService.createFingerprint('127.0.0.1', userAgent, clientUuid));
    fallbacks.push(TokenService.createFingerprint('::1', userAgent, clientUuid));
    fallbacks.push(TokenService.createFingerprint('172.29.0.1', userAgent, clientUuid));
    fallbacks.push(TokenService.createLegacyFingerprint(clientIp, userAgent, clientUuid));
    fallbacks.push(TokenService.createLegacyFingerprint(rawIp, userAgent, clientUuid));

    const status = await TokenService.getSessionStatus(tokenId, fingerprint, fallbacks);
    if (status.isValid && status.token) {
      req.patron = status.token;
    }
  } catch (e) {
    // Ignore error in optional session
  }

  next();
}
