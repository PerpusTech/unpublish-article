import { Request, Response } from 'express';
import { AuditService } from '../services/auditService';

export class AuditController {
  public static async listLogs(req: Request, res: Response): Promise<void> {
    const search = req.query.search as string;
    const nim = req.query.nim as string;
    const action = req.query.action as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const offset = (page - 1) * limit;

    try {
      const { logs, total } = await AuditService.getLogs({ search, nim, action, limit, offset });
      res.json({
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal memuat log audit.'
        }
      });
    }
  }

  public static async exportCsv(req: Request, res: Response): Promise<void> {
    const search = req.query.search as string;

    try {
      const csv = await AuditService.exportCsv(search);
      const filename = `audit-log-ums-library-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal mengekspor CSV.'
        }
      });
    }
  }

  /**
   * Delete single audit log entry (Super Admin only)
   */
  public static async deleteLog(req: Request, res: Response): Promise<void> {
    const currentAdminRole = (req.admin?.role || '').toUpperCase();
    if (currentAdminRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_SUPER_ADMIN_ONLY',
          message: 'Akses ditolak. Hanya Super Admin yang berwenang menghapus catatan riwayat audit log.'
        }
      });
      return;
    }

    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: { code: 'INVALID_ID', message: 'ID log audit wajib disertakan.' } });
      return;
    }

    try {
      const { query } = await import('../config/appDb');
      await query.run('DELETE FROM audit_logs WHERE id = ?', [id]);
      res.json({ success: true, message: 'Catatan log audit berhasil dihapus.' });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal menghapus log audit.'
        }
      });
    }
  }

  /**
   * Delete bulk audit log entries (Super Admin only)
   */
  public static async deleteBulkLogs(req: Request, res: Response): Promise<void> {
    const currentAdminRole = (req.admin?.role || '').toUpperCase();
    if (currentAdminRole !== 'SUPER_ADMIN') {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN_SUPER_ADMIN_ONLY',
          message: 'Akses ditolak. Hanya Super Admin yang berwenang menghapus catatan riwayat audit log.'
        }
      });
      return;
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Daftar ID log yang akan dihapus tidak boleh kosong.' } });
      return;
    }

    try {
      const { query } = await import('../config/appDb');
      const placeholders = ids.map(() => '?').join(',');
      await query.run(`DELETE FROM audit_logs WHERE id IN (${placeholders})`, ids);
      res.json({ success: true, message: `Berhasil menghapus ${ids.length} catatan log audit.` });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal menghapus catatan log audit.'
        }
      });
    }
  }
}
