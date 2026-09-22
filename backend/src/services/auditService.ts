import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/appDb';
import { generateStyledExcelBuffer } from '../utils/excelGenerator';

export interface AuditLogEntry {
  id: string;
  token_id: string;
  patron_nim: string;
  patron_name: string;
  action: 'ACTIVATE_TOKEN' | 'SEARCH' | 'VIEW_METADATA' | 'VIEW_PDF' | 'SESSION_EXPIRED' | 'REVOKE_TOKEN';
  eprint_id?: number;
  article_title?: string;
  eprint_status?: string;
  ip_address: string;
  user_agent?: string;
  created_at: string;
}

export class AuditService {
  /**
   * Log an audit action asynchronously
   */
  public static async log(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
    try {
      const id = uuidv4();
      const sql = `
        INSERT INTO audit_logs (
          id, token_id, patron_nim, patron_name, action,
          eprint_id, article_title, eprint_status, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await query.run(sql, [
        id,
        entry.token_id,
        entry.patron_nim,
        entry.patron_name,
        entry.action,
        entry.eprint_id || null,
        entry.article_title || null,
        entry.eprint_status || null,
        entry.ip_address,
        entry.user_agent || null,
      ]);
    } catch (err) {
      console.error('[AuditService.log] Failed to insert audit log:', err);
    }
  }

  public static async logAction(params: {
    tokenId: string;
    patronNim: string;
    patronName: string;
    action: 'ACTIVATE_TOKEN' | 'SEARCH' | 'VIEW_METADATA' | 'VIEW_PDF' | 'SESSION_EXPIRED' | 'REVOKE_TOKEN';
    eprintId?: number;
    articleTitle?: string;
    eprintStatus?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    return this.log({
      token_id: params.tokenId,
      patron_nim: params.patronNim,
      patron_name: params.patronName,
      action: params.action,
      eprint_id: params.eprintId,
      article_title: params.articleTitle,
      eprint_status: params.eprintStatus,
      ip_address: params.ipAddress || '127.0.0.1',
      user_agent: params.userAgent,
    });
  }

  /**
   * Get paginated audit logs with search filter
   */
  public static async getLogs(options: {
    page?: number;
    limit?: number;
    offset?: number;
    search?: string;
    nim?: string;
    action?: string;
    tokenId?: string;
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const offset = options.offset !== undefined ? options.offset : (Math.max(1, options.page || 1) - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (options.search) {
      where += ` AND (
        patron_nim LIKE ? OR
        patron_name LIKE ? OR
        article_title LIKE ? OR
        ip_address LIKE ?
      )`;
      const s = `%${options.search}%`;
      params.push(s, s, s, s);
    }

    if (options.nim) {
      where += ' AND patron_nim = ?';
      params.push(options.nim.trim());
    }

    if (options.action) {
      where += ' AND action = ?';
      params.push(options.action);
    }

    if (options.tokenId) {
      where += ' AND token_id = ?';
      params.push(options.tokenId);
    }

    const countRow = await query.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM audit_logs ${where}`,
      params
    );
    const total = countRow?.count || 0;

    const logs = await query.all<AuditLogEntry>(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { logs, total };
  }

  /**
   * Export all matching logs as formatted Excel (.xlsx) with borders
   */
  public static async exportExcel(search?: string): Promise<Buffer> {
    const { logs } = await this.getLogs({ search, limit: 10000 });

    const columns = [
      { header: 'Waktu Akses', key: 'created_at', width: 22, align: 'center' as const },
      { header: 'NIM Pemustaka', key: 'patron_nim', width: 16, align: 'center' as const },
      { header: 'Nama Pemustaka', key: 'patron_name', width: 26, align: 'left' as const },
      { header: 'Aktivitas', key: 'action', width: 18, align: 'center' as const },
      { header: 'ID EPrint', key: 'eprint_id', width: 14, align: 'center' as const },
      { header: 'Judul Artikel', key: 'article_title', width: 38, align: 'left' as const },
      { header: 'Status Artikel', key: 'eprint_status', width: 16, align: 'center' as const },
      { header: 'IP Address', key: 'ip_address', width: 18, align: 'center' as const },
      { header: 'Perangkat / User Agent', key: 'user_agent', width: 35, align: 'left' as const },
    ];

    const rows = logs.map((l) => ({
      created_at: l.created_at,
      patron_nim: l.patron_nim,
      patron_name: l.patron_name,
      action: l.action,
      eprint_id: l.eprint_id || '-',
      article_title: l.article_title || '-',
      eprint_status: l.eprint_status || '-',
      ip_address: l.ip_address,
      user_agent: l.user_agent || '-',
    }));

    return generateStyledExcelBuffer({
      sheetName: 'Log Audit Keamanan',
      columns,
      rows,
      headerBgColor: 'FF0F4C81',
    });
  }
}
