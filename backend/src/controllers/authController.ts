import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { query } from '../config/appDb';
import { CasService } from '../services/casService';

export class AuthController {
  /**
   * Quick development login for librarian testing
   */
  public static async devLogin(req: Request, res: Response): Promise<void> {
    const { email } = req.body;
    const targetEmail = (email || 'pustakawan@ums.ac.id').trim().toLowerCase();

    // 1. Enforce domain
    if (ENV.ALLOWED_EMAIL_DOMAIN && !targetEmail.endsWith(`@${ENV.ALLOWED_EMAIL_DOMAIN}`)) {
      res.status(403).json({
        error: {
          code: 'DOMAIN_RESTRICTED',
          message: `Harus menggunakan email resmi dengan domain @${ENV.ALLOWED_EMAIL_DOMAIN}`
        }
      });
      return;
    }

    // 2. Check user in database or auto-resolve from EPrints
    let user = await query.get('SELECT * FROM admin_users WHERE email = ?', [targetEmail]);

    // Check if specifically Muhammad Asharul Ma'ali (mam708@ums.ac.id)
    const isAsharul = targetEmail === 'mam708@ums.ac.id' || targetEmail.includes('asharul');

    if (!user) {
      const campusUser = await CasService.resolveCampusUser(targetEmail);
      if (campusUser) {
        const role = isAsharul ? 'SUPER_ADMIN' : campusUser.role;
        await query.run(
          'INSERT INTO admin_users (email, name, role, is_active) VALUES (?, ?, ?, 1)',
          [targetEmail, campusUser.name, role]
        );
        user = await query.get('SELECT * FROM admin_users WHERE email = ?', [targetEmail]);
      } else if (targetEmail === 'pustakawan@ums.ac.id') {
        await query.run(
          'INSERT INTO admin_users (email, name, role, is_active) VALUES (?, ?, ?, 1)',
          [targetEmail, 'Pustakawan Layanan UMS', 'SUPER_ADMIN']
        );
        user = await query.get('SELECT * FROM admin_users WHERE email = ?', [targetEmail]);
      }
    } else if (isAsharul && user.role !== 'SUPER_ADMIN') {
      await query.run("UPDATE admin_users SET role = 'SUPER_ADMIN' WHERE email = ?", [targetEmail]);
      user.role = 'SUPER_ADMIN';
    }

    if (!user) {
      res.status(403).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Akun Anda belum terdaftar di Meja Layanan. Silakan hubungi Administrator Pustakawan.'
        }
      });
      return;
    }

    if (user.is_active !== 1) {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Akun Anda telah dinonaktifkan. Hubungi Administrator.'
        }
      });
      return;
    }

    // 3. Enforce ADMIN / SUPER_ADMIN role
    const normalizedRole = (user.role || '').toUpperCase();
    if (normalizedRole !== 'ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        error: {
          code: 'ROLE_RESTRICTED',
          message: `Akses ditolak. Akun Anda memiliki role "${user.role}". Meja Layanan Pustakawan hanya dapat diakses oleh akun ber-role Admin.`
        }
      });
      return;
    }

    // Update last login timestamp
    await query.run(
      'UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE email = ?',
      [targetEmail]
    );

    const payload = {
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '8h' });
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

    res.cookie('admin_jwt', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 3600 * 1000
    });

    res.json({
      success: true,
      message: `Berhasil login sebagai ${user.role} (${user.name}).`,
      admin: payload,
      user: payload,
      token
    });
  }

  /**
   * Returns Google OAuth URL or redirect
   */
  public static getGoogleAuthUrl(req: Request, res: Response): void {
    if (!ENV.GOOGLE_CLIENT_ID) {
      res.status(400).json({
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message: 'Google Client ID belum dikonfigurasi di file environment.'
        }
      });
      return;
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: ENV.GOOGLE_CALLBACK_URL,
      client_id: ENV.GOOGLE_CLIENT_ID,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      hd: ENV.ALLOWED_EMAIL_DOMAIN, // Restrict to campus domain in Google prompt
    };

    const qs = new URLSearchParams(options);
    res.json({ url: `${rootUrl}?${qs.toString()}` });
  }

  /**
   * Initiate CAS SSO Login (UMS)
   */
  public static casLogin(req: Request, res: Response): void {
    const loginUrl = CasService.getLoginUrl();
    const switchAccountUrl = CasService.getLogoutUrl(loginUrl);
    res.json({ url: loginUrl, switchAccountUrl });
  }

  /**
   * Handle CAS SSO Callback with Ticket
   */
  public static async casCallback(req: Request, res: Response): Promise<void> {
    const ticket = req.query.ticket as string;
    const frontendBase = ENV.FRONTEND_URL;

    if (!ticket) {
      res.redirect(`${frontendBase}/?error=NO_CAS_TICKET`);
      return;
    }

    try {
      const authResult = await CasService.validateTicket(ticket);

      if (!authResult.success || !authResult.email) {
        const errorMsg = encodeURIComponent(authResult.error || 'Autentikasi SSO UMS gagal.');
        res.redirect(`${frontendBase}/?error=${errorMsg}`);
        return;
      }

      const targetEmail = authResult.email.toLowerCase();

      // Enforce domain check
      if (ENV.ALLOWED_EMAIL_DOMAIN && !targetEmail.endsWith(`@${ENV.ALLOWED_EMAIL_DOMAIN}`)) {
        const errorMsg = encodeURIComponent(`Akun SSO (${targetEmail}) bukan domain resmi @${ENV.ALLOWED_EMAIL_DOMAIN}`);
        res.redirect(`${frontendBase}/?error=${errorMsg}`);
        return;
      }

      // Resolve user role & profile from live EPrints repository user table
      const campusUser = await CasService.resolveCampusUser(authResult.username || targetEmail);
      const isAsharul =
        targetEmail === 'mam708@ums.ac.id' ||
        authResult.username === 'masharulmaali' ||
        authResult.username === 'mam708' ||
        campusUser?.role === 'SUPER_ADMIN';

      // Check user in database
      let user = await query.get('SELECT * FROM admin_users WHERE email = ?', [targetEmail]);

      if (!user) {
        const initialRole = isAsharul
          ? 'SUPER_ADMIN'
          : campusUser?.role
          ? campusUser.role
          : targetEmail === 'pustakawan@ums.ac.id'
          ? 'SUPER_ADMIN'
          : 'USER';

        const officialName = campusUser?.name || authResult.name || 'Civitas UMS';

        await query.run(
          'INSERT INTO admin_users (email, name, role, is_active) VALUES (?, ?, ?, 1)',
          [targetEmail, officialName, initialRole]
        );
        user = await query.get('SELECT * FROM admin_users WHERE email = ?', [targetEmail]);
      } else {
        // Update role if EPrints Repository Administrator or masharulmaali
        if (isAsharul && user.role !== 'SUPER_ADMIN') {
          await query.run("UPDATE admin_users SET role = 'SUPER_ADMIN' WHERE email = ?", [targetEmail]);
          user.role = 'SUPER_ADMIN';
        } else if (campusUser?.role === 'ADMIN' && user.role === 'USER') {
          await query.run("UPDATE admin_users SET role = 'ADMIN' WHERE email = ?", [targetEmail]);
          user.role = 'ADMIN';
        }

        if (campusUser?.name && user.name !== campusUser.name) {
          await query.run('UPDATE admin_users SET name = ? WHERE email = ?', [campusUser.name, targetEmail]);
          user.name = campusUser.name;
        }
      }

      if (user.is_active !== 1) {
        const errorMsg = encodeURIComponent('Akun Anda telah dinonaktifkan oleh Administrator.');
        res.redirect(`${frontendBase}/?error=${errorMsg}`);
        return;
      }

      const role = (user.role || '').toUpperCase();
      if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        const errorMsg = encodeURIComponent(
          `Akun SSO (${targetEmail}) berhasil terhubung, namun role Anda adalah "${user.role}". Hubungi Admin Perpustakaan untuk diberikan hak akses Admin.`
        );
        res.redirect(`${frontendBase}/?sso_pending=${errorMsg}`);
        return;
      }

      // Update last login
      await query.run('UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE email = ?', [targetEmail]);

      const payload = {
        email: user.email,
        name: user.name,
        role: user.role,
      };

      const token = jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '8h' });

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

      res.cookie('admin_jwt', token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 3600 * 1000,
      });

      res.redirect(`${frontendBase}/?view=admin&sso=success&token=${encodeURIComponent(token)}`);
    } catch (err: any) {
      console.error('[CAS Callback Error]:', err);
      const errorMsg = encodeURIComponent('Terjadi kesalahan sistem saat memproses login SSO.');
      res.redirect(`${frontendBase}/?error=${errorMsg}`);
    }
  }

  /**
   * Get currently logged-in admin
   */
  public static me(req: Request, res: Response): void {
    res.json({ admin: req.admin });
  }

  /**
   * Logout admin & return CAS logout URL to terminate SSO session
   */
  public static logout(req: Request, res: Response): void {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie('admin_jwt', {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('admin_jwt');

    const casLogoutUrl = CasService.getLogoutUrl();
    res.json({
      success: true,
      message: 'Berhasil keluar dari sesi meja layanan.',
      casLogoutUrl
    });
  }

  /**
   * Direct CAS SSO Logout redirect
   */
  public static casLogout(req: Request, res: Response): void {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie('admin_jwt', {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('admin_jwt');

    const logoutUrl = CasService.getLogoutUrl();
    res.redirect(logoutUrl);
  }
}
