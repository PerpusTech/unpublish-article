import { Request, Response } from 'express';
import { query } from '../config/appDb';
import { ENV } from '../config/env';
import { CasService } from '../services/casService';

export class UserController {
  /**
   * List users with search, filter & pagination
   */
  public static async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const search = (req.query.search as string || '').trim();
      const role = (req.query.role as string || '').trim().toUpperCase();
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const offset = (page - 1) * limit;

      let whereSql = ' WHERE 1=1';
      const params: any[] = [];

      if (search) {
        whereSql += ' AND (email LIKE ? OR name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      if (role && role !== 'ALL') {
        whereSql += ' AND role = ?';
        params.push(role);
      }

      const countRow = await query.get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM admin_users ${whereSql}`, params);
      const total = countRow?.cnt || 0;

      const sql = `SELECT email, name, role, is_active, sso_attributes, last_login_at, created_at FROM admin_users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      const users = await query.all(sql, [...params, limit, offset]);

      // Auto-enrich generic names with real campus names from EPrints database
      for (const u of users) {
        if (!u.name || u.name === 'Pustakawan UMS' || u.name === 'Civitas UMS' || u.name === u.email.split('@')[0]) {
          const campusName = await CasService.resolveCampusName(u.email);
          if (campusName && campusName !== u.name) {
            u.name = campusName;
            await query.run('UPDATE admin_users SET name = ? WHERE email = ?', [campusName, u.email]);
          }
        }
      }

      res.json({
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      });
    } catch (err: any) {
      console.error('[UserController.listUsers] Error:', err);
      res.status(500).json({ error: { code: 'DB_ERROR', message: 'Gagal mengambil daftar pengguna.' } });
    }
  }

  /**
   * Export users list as CSV
   */
  public static async exportCsv(req: Request, res: Response): Promise<void> {
    try {
      const search = (req.query.search as string || '').trim();
      const role = (req.query.role as string || '').trim().toUpperCase();

      let whereSql = ' WHERE 1=1';
      const params: any[] = [];

      if (search) {
        whereSql += ' AND (email LIKE ? OR name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      if (role && role !== 'ALL') {
        whereSql += ' AND role = ?';
        params.push(role);
      }

      const users = await query.all(
        `SELECT email, name, role, is_active, last_login_at, created_at FROM admin_users ${whereSql} ORDER BY created_at DESC`,
        params
      );

      const headers = ['Nama Civitas', 'Email Resmi UMS', 'Hak Akses (Role)', 'Status Akun', 'Terakhir Login', 'Waktu Terdaftar'];

      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = users.map((u) => [
        escapeCsv(u.name),
        escapeCsv(u.email),
        escapeCsv(u.role),
        escapeCsv(u.is_active === 1 ? 'Aktif' : 'Nonaktif'),
        escapeCsv(u.last_login_at || '-'),
        escapeCsv(u.created_at || '-'),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const filename = `daftar-pengguna-ums-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err: any) {
      console.error('[UserController.exportCsv] Error:', err);
      res.status(500).json({ error: { code: 'DB_ERROR', message: 'Gagal mengekspor data pengguna.' } });
    }
  }

  /**
   * Create a new user with specific role
   */
  public static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, role = 'ADMIN' } = req.body;
      const currentAdminRole = (req.admin?.role || '').toUpperCase();

      if (!email || !name) {
        res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Nama dan email wajib diisi.' } });
        return;
      }

      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();
      const rawRole = role.toUpperCase();

      if (rawRole === 'SUPER_ADMIN' && currentAdminRole !== 'SUPER_ADMIN') {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN_SUPER_ADMIN',
            message: 'Akses ditolak. Administrator biasa tidak berwenang membuat akun dengan role Super Admin.',
          },
        });
        return;
      }

      const normalizedRole = rawRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : rawRole === 'USER' ? 'USER' : 'ADMIN';

      // Enforce ums.ac.id domain
      if (ENV.ALLOWED_EMAIL_DOMAIN && !trimmedEmail.endsWith(`@${ENV.ALLOWED_EMAIL_DOMAIN}`)) {
        res.status(400).json({
          error: {
            code: 'DOMAIN_RESTRICTED',
            message: `Hanya email resmi dengan domain @${ENV.ALLOWED_EMAIL_DOMAIN} yang dapat didaftarkan.`,
          },
        });
        return;
      }

      // Check if user already exists
      const existing = await query.get('SELECT email FROM admin_users WHERE email = ?', [trimmedEmail]);
      if (existing) {
        res.status(409).json({
          error: {
            code: 'USER_EXISTS',
            message: `Pengguna dengan email ${trimmedEmail} sudah terdaftar.`,
          },
        });
        return;
      }

      await query.run(
        'INSERT INTO admin_users (email, name, role, is_active) VALUES (?, ?, ?, 1)',
        [trimmedEmail, trimmedName, normalizedRole]
      );

      const newUser = await query.get(
        'SELECT email, name, role, is_active, last_login_at, created_at FROM admin_users WHERE email = ?',
        [trimmedEmail]
      );

      res.status(201).json({
        success: true,
        message: `Pengguna ${trimmedName} (${normalizedRole}) berhasil didaftarkan.`,
        user: newUser,
      });
    } catch (err: any) {
      console.error('[UserController.createUser] Error:', err);
      res.status(500).json({ error: { code: 'DB_ERROR', message: 'Gagal membuat pengguna baru.' } });
    }
  }

  /**
   * Update user (role, active status, or name)
   */
  public static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const targetEmail = decodeURIComponent(String(req.params.email)).toLowerCase();
      const currentAdminRole = (req.admin?.role || '').toUpperCase();
      const { role, is_active, name } = req.body;

      const user = await query.get('SELECT * FROM admin_users WHERE email = ?', [targetEmail]);
      if (!user) {
        res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan.' } });
        return;
      }

      const targetUserRole = (user.role || '').toUpperCase();

      // SECURITY ENFORCEMENT: Admin cannot modify Super Admin in any way!
      if (targetUserRole === 'SUPER_ADMIN' && currentAdminRole !== 'SUPER_ADMIN') {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN_SUPER_ADMIN_EDIT',
            message: 'Akses ditolak. Administrator biasa tidak berwenang mengubah role, status, atau data akun Super Admin.',
          },
        });
        return;
      }

      // SECURITY ENFORCEMENT: Admin cannot promote anyone to Super Admin!
      if (role && role.toUpperCase() === 'SUPER_ADMIN' && currentAdminRole !== 'SUPER_ADMIN') {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN_SUPER_ADMIN_PROMOTION',
            message: 'Akses ditolak. Hanya Super Admin yang berwenang mengangkat pengguna menjadi Super Admin.',
          },
        });
        return;
      }

      // Prevent self-lockout
      const currentAdminEmail = req.admin?.email?.toLowerCase();
      if (currentAdminEmail === targetEmail) {
        if (role && role !== user.role) {
          res.status(400).json({ error: { code: 'SELF_DEMOTION', message: 'Anda tidak dapat mengubah role akun Anda sendiri.' } });
          return;
        }
        if (is_active === 0) {
          res.status(400).json({ error: { code: 'SELF_DEACTIVATE', message: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' } });
          return;
        }
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (role !== undefined) {
        const rawRole = role.toUpperCase();
        const normalizedRole = rawRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : rawRole === 'USER' ? 'USER' : 'ADMIN';
        updates.push('role = ?');
        params.push(normalizedRole);
      }

      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active ? 1 : 0);
      }

      if (name !== undefined && name.trim()) {
        updates.push('name = ?');
        params.push(name.trim());
      }

      if (updates.length > 0) {
        params.push(targetEmail);
        await query.run(`UPDATE admin_users SET ${updates.join(', ')} WHERE email = ?`, params);
      }

      const updated = await query.get(
        'SELECT email, name, role, is_active, last_login_at, created_at FROM admin_users WHERE email = ?',
        [targetEmail]
      );

      res.json({
        success: true,
        message: 'Data pengguna berhasil diperbarui.',
        user: updated,
      });
    } catch (err: any) {
      console.error('[UserController.updateUser] Error:', err);
      res.status(500).json({ error: { code: 'DB_ERROR', message: 'Gagal memperbarui pengguna.' } });
    }
  }

  /**
   * Delete user
   */
  public static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const targetEmail = decodeURIComponent(String(req.params.email)).toLowerCase();
      const currentAdminEmail = req.admin?.email?.toLowerCase();
      const currentAdminRole = (req.admin?.role || '').toUpperCase();

      if (currentAdminEmail === targetEmail) {
        res.status(400).json({ error: { code: 'SELF_DELETE', message: 'Anda tidak dapat menghapus akun Anda sendiri.' } });
        return;
      }

      const user = await query.get('SELECT * FROM admin_users WHERE email = ?', [targetEmail]);
      if (!user) {
        res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan.' } });
        return;
      }

      const targetUserRole = (user.role || '').toUpperCase();

      // SECURITY ENFORCEMENT: Only Super Admin can delete users!
      if (currentAdminRole !== 'SUPER_ADMIN') {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN_SUPER_ADMIN_ONLY',
            message: 'Akses ditolak. Hanya Super Admin yang berwenang menghapus akun pengguna.',
          },
        });
        return;
      }

      if (targetEmail === 'pustakawan@ums.ac.id' || targetEmail === 'mam708@ums.ac.id') {
        res.status(400).json({ error: { code: 'PROTECTED_USER', message: 'Akun Super Admin utama institusi dilindungi dan tidak dapat dihapus.' } });
        return;
      }

      const result = await query.run('DELETE FROM admin_users WHERE email = ?', [targetEmail]);
      if (result.changes === 0) {
        res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan.' } });
        return;
      }

      res.json({ success: true, message: `Pengguna ${targetEmail} berhasil dihapus.` });
    } catch (err: any) {
      console.error('[UserController.deleteUser] Error:', err);
      res.status(500).json({ error: { code: 'DB_ERROR', message: 'Gagal menghapus pengguna.' } });
    }
  }
}
