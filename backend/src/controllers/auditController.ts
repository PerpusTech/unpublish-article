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
}
