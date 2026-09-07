import { Request, Response, NextFunction } from 'express';
import { TokenService, TokenRecord } from '../services/tokenService';

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
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ipStr = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    if (ipStr && typeof ipStr === 'string') {
      const firstIp = ipStr.split(',')[0].trim();
      if (firstIp) return firstIp;
    }
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export async function requirePatronSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tokenId = (req.cookies?.patron_token_id ||
    req.headers['x-patron-token-id'] ||
    req.query?.token_id ||
    req.query?.tid) as string;

  if (!tokenId) {
    res.status(401).json({
      error: {
        code: 'TOKEN_REQUIRED',
        message: 'Akses memerlukan token membaca aktif yang diterbitkan oleh pustakawan UMS.'
      }
    });
    return;
  }

  const clientIp = extractClientIp(req);
  const rawIp = req.socket.remoteAddress || '127.0.0.1';
  const userAgent = (Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent']) || 'Unknown';
  const clientUuid = (Array.isArray(req.headers['x-client-uuid']) ? req.headers['x-client-uuid'][0] : req.headers['x-client-uuid'])
    || (req.query?.client_uuid as string)
    || req.cookies?.client_uuid
    || undefined;

  const fingerprint = TokenService.createFingerprint(clientIp, userAgent, clientUuid);
  req.fingerprint = fingerprint;

  // Strict device binding fallbacks: allow proxy/NAT IP variations ONLY with the matching clientUuid
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
        message: status.reason || 'Sesi membaca Anda telah berakhir atau token tidak valid.'
      }
    });
    return;
  }

  // Refresh or set cookie so browser retains patron_token_id for subsequent requests/iframes
  res.cookie('patron_token_id', status.token.id, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: (status.token.remaining_seconds || 7200) * 1000
  });

  req.patron = status.token;
  next();
}

export async function optionalPatronSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tokenId = (req.cookies?.patron_token_id ||
    req.headers['x-patron-token-id'] ||
    req.query?.token_id ||
    req.query?.tid) as string;

  if (!tokenId) {
    return next();
  }

  try {
    const clientIp = extractClientIp(req);
    const rawIp = req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent']) || 'Unknown';
    const clientUuid = (Array.isArray(req.headers['x-client-uuid']) ? req.headers['x-client-uuid'][0] : req.headers['x-client-uuid'])
      || (req.query?.client_uuid as string)
      || req.cookies?.client_uuid
      || undefined;

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

