import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/appDb';

export interface AuditLogEntry {
  id: string;
  token_id: string;
  patron_nim: string;
  patron_name: string;
  action: 'ACTIVATE_TOKEN' | 'SEARCH' | 'VIEW_METADATA' | 'VIEW_PDF' | 'SESSION_EXPIRED';
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
  public static async logAction(params: {
    tokenId: string;
    patronNim: string;
    patronName: string;
    action: 'ACTIVATE_TOKEN' | 'SEARCH' | 'VIEW_METADATA' | 'VIEW_PDF' | 'SESSION_EXPIRED';
    eprintId?: number;
    articleTitle?: string;
    eprintStatus?: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<void> {
    const id = uuidv4();
    try {
      await query.run(
        `INSERT INTO audit_logs (
          id, token_id, patron_nim, patron_name, action,
          eprint_id, article_title, eprint_status, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          params.tokenId,
          params.patronNim,
          params.patronName,
          params.action,
          params.eprintId || null,
          params.articleTitle || null,
          params.eprintStatus || null,
          params.ipAddress,
          params.userAgent || null,
        ]
      );
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err);
    }
  }

  /**
   * Query logs with search and filters for admin
   */
  public static async getLogs(filter?: {
    search?: string;
    nim?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLogEntry[]; total: number }> {
    let whereClauses = ['1=1'];
    const params: any[] = [];

    if (filter?.search) {
      whereClauses.push('(patron_name LIKE ? OR patron_nim LIKE ? OR article_title LIKE ?)');
      const term = `%${filter.search.trim()}%`;
      params.push(term, term, term);
    }

    if (filter?.nim) {
      whereClauses.push('patron_nim = ?');
      params.push(filter.nim.trim());
    }

    if (filter?.action && filter.action !== 'ALL') {
      whereClauses.push('action = ?');
      params.push(filter.action);
    }

    const whereSql = whereClauses.join(' AND ');

    const countRow = await query.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE ${whereSql}`,
      params
    );
    const total = countRow?.count || 0;

    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    const logs = await query.all<AuditLogEntry>(
      `SELECT * FROM audit_logs WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { logs, total };
  }

  /**
   * Export all matching logs as CSV
   */
  public static async exportCsv(search?: string): Promise<string> {
    const { logs } = await this.getLogs({ search, limit: 10000 });

    const headers = [
      'Waktu Akses',
      'NIM Pemustaka',
      'Nama Pemustaka',
      'Aktivitas',
      'ID EPrint',
      'Judul Artikel',
      'Status Artikel',
      'IP Address',
      'Perangkat / User Agent'
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = logs.map((l) => [
      escapeCsv(l.created_at),
      escapeCsv(l.patron_nim),
      escapeCsv(l.patron_name),
      escapeCsv(l.action),
      escapeCsv(l.eprint_id || '-'),
      escapeCsv(l.article_title || '-'),
      escapeCsv(l.eprint_status || '-'),
      escapeCsv(l.ip_address),
      escapeCsv(l.user_agent || '-')
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }
}
