import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { query } from '../config/appDb';

export interface AdminJwtPayload {
  email: string;
  name: string;
  role: string;
}

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.admin_jwt || (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Akses ditolak. Silakan login sebagai Pustakawan UMS terlebih dahulu.'
      }
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as AdminJwtPayload;

    // 1. Enforce domain restriction: must end with @ums.ac.id
    if (ENV.ALLOWED_EMAIL_DOMAIN && !decoded.email.toLowerCase().endsWith(`@${ENV.ALLOWED_EMAIL_DOMAIN}`)) {
      res.status(403).json({
        error: {
          code: 'DOMAIN_RESTRICTED',
          message: `Hanya email resmi dengan domain @${ENV.ALLOWED_EMAIL_DOMAIN} yang berwenang mengakses panel ini.`
        }
      });
      return;
    }

    // 2. Enforce role restriction: must be ADMIN or SUPER_ADMIN
    const normalizedRole = (decoded.role || '').toUpperCase();
    if (normalizedRole !== 'ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        error: {
          code: 'ROLE_RESTRICTED',
          message: 'Akses ditolak. Panel Meja Layanan Pustakawan hanya dapat diakses oleh akun ber-role Admin.'
        }
      });
      return;
    }

    // 3. Verify user status in database
    const dbUser = await query.get('SELECT is_active, role FROM admin_users WHERE email = ?', [decoded.email.toLowerCase()]);
    if (!dbUser) {
      res.status(403).json({
        error: {
          code: 'USER_NOT_REGISTERED',
          message: 'Akun Anda belum terdaftar dalam sistem Meja Layanan.'
        }
      });
      return;
    }

    if (dbUser.is_active !== 1) {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Akun Anda telah dinonaktifkan. Hubungi Administrator untuk informasi lebih lanjut.'
        }
      });
      return;
    }

    const currentRole = (dbUser.role || '').toUpperCase();
    if (currentRole !== 'ADMIN' && currentRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        error: {
          code: 'ROLE_RESTRICTED',
          message: 'Akses ditolak. Hak akses role akun Anda bukan Admin.'
        }
      });
      return;
    }

    req.admin = {
      ...decoded,
      role: dbUser.role
    };
    next();
  } catch (err) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Sesi login admin tidak valid atau telah berakhir. Silakan login kembali.'
      }
    });
  }
}
