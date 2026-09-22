import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { query } from '../config/appDb';
import { AuditService } from './auditService';
import { generateStyledExcelBuffer } from '../utils/excelGenerator';

export interface TokenRecord {
  id: string;
  token_code: string;
  patron_name: string;
  patron_nim: string;
  duration_minutes: number;
  claim_window_minutes?: number;
  claim_expires_at?: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'EXPIRED_UNCLAIMED' | 'REVOKED';
  device_fingerprint?: string;
  created_by_admin: string;
  created_at: string;
  claimed_at?: string;
  expires_at?: string;
  extended_minutes: number;
  notes?: string;
  remaining_seconds?: number;
  claim_remaining_seconds?: number;
  incident_count?: number;
  last_incident_at?: string;
  last_incident_type?: string;
}

export class TokenService {
  /**
   * Generates a readable token string like "UMS-8K2N9F"
   */
  private static generateTokenCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0, 1, I, O
    let result = 'UMS-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generates device fingerprint hash from request headers and unique browser storage (IP + User-Agent + ClientUUID)
   */
  public static createFingerprint(ip: string, userAgent: string, clientUuid?: string): string {
    const raw = `${ip}|${userAgent}|${clientUuid || 'anonymous'}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Legacy 3-part fingerprint for backwards compatibility
   */
  public static createLegacyFingerprint(ip: string, userAgent: string, clientUuid?: string): string {
    const raw = `${ip}|${userAgent}|${clientUuid || 'none'}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Admin generates a new token
   */
  public static async createToken(params: {
    patronName: string;
    patronNim: string;
    durationMinutes: number;
    claimWindowMinutes?: number;
    createdByAdmin: string;
    notes?: string;
  }): Promise<{ token: TokenRecord; qrDataUrl: string }> {
    const id = uuidv4();
    let tokenCode = this.generateTokenCode();

    // Ensure uniqueness
    let existing = await query.get('SELECT id FROM tokens WHERE token_code = ?', [tokenCode]);
    while (existing) {
      tokenCode = this.generateTokenCode();
      existing = await query.get('SELECT id FROM tokens WHERE token_code = ?', [tokenCode]);
    }

    // Determine claim window and claim expiration timestamp
    // claimWindowMinutes:
    // - Positive number (e.g. 15, 30, 60, 120): X minutes from now
    // - -1: Same-Day (until 23:59:59 today)
    // - 0: Unlimited / 24 hours
    // - Undefined: default to 30 minutes
    const windowMinutes = params.claimWindowMinutes !== undefined ? params.claimWindowMinutes : 30;
    let claimExpiresAt: string | null = null;
    const now = new Date();

    if (windowMinutes === -1) {
      // End of current day (23:59:59.999)
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      claimExpiresAt = endOfDay.toISOString();
    } else if (windowMinutes > 0) {
      claimExpiresAt = new Date(now.getTime() + windowMinutes * 60 * 1000).toISOString();
    } else {
      // 0 means no strict claim window (fallback 24h)
      claimExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    await query.run(
      `INSERT INTO tokens (
        id, token_code, patron_name, patron_nim, duration_minutes,
        claim_window_minutes, claim_expires_at,
        status, created_by_admin, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [
        id,
        tokenCode,
        params.patronName.trim(),
        params.patronNim.trim(),
        params.durationMinutes,
        windowMinutes,
        claimExpiresAt,
        params.createdByAdmin,
        params.notes || null,
      ]
    );

    const token = (await query.get<TokenRecord>('SELECT * FROM tokens WHERE id = ?', [id]))!;
    
    // Generate QR Code containing the token code
    const qrDataUrl = await QRCode.toDataURL(tokenCode, {
      margin: 2,
      width: 280,
      color: {
        dark: '#0b2545',
        light: '#ffffff'
      }
    });

    return { token, qrDataUrl };
  }

  /**
   * Admin generates multiple tokens in batch (for research classes/groups)
   */
  public static async createBatchTokens(params: {
    items: { patronName: string; patronNim: string; notes?: string }[];
    durationMinutes: number;
    claimWindowMinutes?: number;
    createdByAdmin: string;
    defaultNotes?: string;
  }): Promise<{ tokens: { token: TokenRecord; qrDataUrl: string }[]; count: number }> {
    const results: { token: TokenRecord; qrDataUrl: string }[] = [];

    for (const item of params.items) {
      const name = item.patronName?.trim();
      const nim = item.patronNim?.trim();
      if (!name || !nim) continue;

      const note = item.notes?.trim() || params.defaultNotes?.trim() || null;
      const res = await this.createToken({
        patronName: name,
        patronNim: nim,
        durationMinutes: params.durationMinutes,
        claimWindowMinutes: params.claimWindowMinutes,
        createdByAdmin: params.createdByAdmin,
        notes: note || undefined,
      });

      results.push(res);
    }

    return { tokens: results, count: results.length };
  }

  /**
   * Patron claims/activates a token in their browser
   */
  public static async claimToken(
    tokenCode: string,
    fingerprint: string
  ): Promise<{ success: boolean; message: string; token?: TokenRecord }> {
    // Normalize: remove all internal whitespace and auto-correct common prefix typos
    let code = (tokenCode || '').trim().toUpperCase().replace(/\s+/g, '');
    if (code.startsWith('SS0-')) {
      code = code.replace(/^SS0-/, 'SSO-');
    }

    const token = await query.get<TokenRecord>(
      'SELECT * FROM tokens WHERE token_code = ?',
      [code]
    );

    if (!token) {
      return { success: false, message: 'Kode token tidak ditemukan. Mohon periksa kembali atau hubungi pustakawan.' };
    }

    // Check if token was revoked
    if (token.status === 'REVOKED') {
      return { success: false, message: 'Izin token ini telah dibatalkan oleh pustakawan.' };
    }

    // Check if already active
    if (token.status === 'ACTIVE') {
      // Check device fingerprint binding
      if (token.device_fingerprint && token.device_fingerprint !== fingerprint) {
        return {
          success: false,
          message: 'Token ini sudah terkunci pada perangkat/browser lain. Satu token hanya berlaku untuk 1 perangkat pemustaka.',
        };
      }

      // Check expiry
      const now = new Date().getTime();
      const expiresAt = new Date(token.expires_at!).getTime();
      if (now >= expiresAt) {
        await query.run("UPDATE tokens SET status = 'EXPIRED' WHERE id = ?", [token.id]);
        return { success: false, message: 'Masa aktif sesi token ini telah berakhir.' };
      }

      token.remaining_seconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
      return { success: true, message: 'Sesi aktif berhasil dilanjutkan.', token };
    }

    if (token.status === 'EXPIRED' || token.status === 'EXPIRED_UNCLAIMED') {
      return { success: false, message: 'Token ini sudah kedaluwarsa.' };
    }

    // Check unclaimed expiration (Claim Window Deadline)
    const nowTime = new Date().getTime();
    if (token.claim_expires_at) {
      const claimExpiresTime = new Date(token.claim_expires_at).getTime();
      if (nowTime >= claimExpiresTime) {
        await query.run("UPDATE tokens SET status = 'EXPIRED_UNCLAIMED' WHERE id = ?", [token.id]);
        const expiryFormatted = new Date(token.claim_expires_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        return {
          success: false,
          message: `Masa berlaku klaim token ini telah berakhir pada pukul ${expiryFormatted} WIB (Batas klaim: ${token.claim_window_minutes || 30} menit). Silakan minta tiket baru kepada pustakawan di meja sirkulasi.`,
        };
      }
    } else {
      // Fallback: 24 hours
      const createdAt = new Date(token.created_at).getTime();
      if (nowTime - createdAt > 24 * 60 * 60 * 1000) {
        await query.run("UPDATE tokens SET status = 'EXPIRED_UNCLAIMED' WHERE id = ?", [token.id]);
        return { success: false, message: 'Token hangus karena belum diaktivasi lebih dari 24 jam sejak diterbitkan.' };
      }
    }

    // Activate token now!
    const claimedAt = new Date();
    const expiresAt = new Date(claimedAt.getTime() + token.duration_minutes * 60 * 1000);

    await query.run(
      `UPDATE tokens SET
        status = 'ACTIVE',
        claimed_at = ?,
        expires_at = ?,
        device_fingerprint = ?
      WHERE id = ?`,
      [
        claimedAt.toISOString(),
        expiresAt.toISOString(),
        fingerprint,
        token.id,
      ]
    );

    const updated = (await query.get<TokenRecord>('SELECT * FROM tokens WHERE id = ?', [token.id]))!;
    updated.remaining_seconds = Math.floor((expiresAt.getTime() - claimedAt.getTime()) / 1000);

    return { success: true, message: 'Aktivasi berhasil! Selamat membaca.', token: updated };
  }

  /**
   * Validates active session and returns remaining seconds
   */
  public static async getSessionStatus(
    tokenId: string,
    fingerprint: string,
    fallbacks: string[] = []
  ): Promise<{
    isValid: boolean;
    token?: TokenRecord;
    reason?: string;
  }> {
    const token = await query.get<TokenRecord>('SELECT * FROM tokens WHERE id = ?', [tokenId]);
    if (!token) {
      return { isValid: false, reason: 'Token tidak ditemukan.' };
    }

    if (token.status === 'REVOKED') {
      return { isValid: false, reason: 'Izin sesi telah dibatalkan oleh pustakawan.' };
    }

    // Check device fingerprint with fallback allowances (proxy, iframe, header variations)
    if (token.device_fingerprint) {
      const isExactMatch = token.device_fingerprint === fingerprint;
      const isFallbackMatch = fallbacks.some((fb) => fb && fb === token.device_fingerprint);

      if (!isExactMatch && !isFallbackMatch) {
        return { isValid: false, reason: 'Perangkat tidak cocok dengan sesi terdaftar.' };
      }
    }

    const now = new Date().getTime();
    const expiresAt = new Date(token.expires_at || 0).getTime();

    if (token.status !== 'ACTIVE' || now >= expiresAt) {
      if (token.status === 'ACTIVE') {
        await query.run("UPDATE tokens SET status = 'EXPIRED' WHERE id = ?", [token.id]);
      }
      return { isValid: false, reason: 'Waktu sesi membaca Anda telah habis.' };
    }

    token.remaining_seconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
    return { isValid: true, token };
  }

  /**
   * Admin extends duration (e.g. +30 mins, +60 mins)
   */
  public static async extendSession(tokenId: string, extraMinutes: number): Promise<{
    success: boolean;
    token?: TokenRecord;
    message: string;
  }> {
    const token = await query.get<TokenRecord>('SELECT * FROM tokens WHERE id = ?', [tokenId]);
    if (!token) {
      return { success: false, message: 'Token tidak ditemukan.' };
    }

    if (token.status === 'REVOKED') {
      return { success: false, message: 'Tidak dapat memperpanjang token yang telah dibatalkan.' };
    }

    const now = new Date().getTime();
    let currentExpires = token.expires_at ? new Date(token.expires_at).getTime() : now;

    // If already expired, extend starting from right now
    if (currentExpires < now) {
      currentExpires = now;
    }

    const newExpires = new Date(currentExpires + extraMinutes * 60 * 1000);
    const newTotalMinutes = token.duration_minutes + extraMinutes;
    const newExtended = token.extended_minutes + extraMinutes;

    await query.run(
      `UPDATE tokens SET
        status = 'ACTIVE',
        duration_minutes = ?,
        expires_at = ?,
        extended_minutes = ?
      WHERE id = ?`,
      [newTotalMinutes, newExpires.toISOString(), newExtended, tokenId]
    );

    const updated = (await query.get<TokenRecord>('SELECT * FROM tokens WHERE id = ?', [tokenId]))!;
    updated.remaining_seconds = Math.max(0, Math.floor((newExpires.getTime() - now) / 1000));

    return {
      success: true,
      message: `Berhasil menambahkan waktu ${extraMinutes} menit.`,
      token: updated
    };
  }

  /**
   * Admin revokes token
   */
  public static async revokeSession(tokenId: string): Promise<boolean> {
    const res = await query.run("UPDATE tokens SET status = 'REVOKED' WHERE id = ?", [tokenId]);
    return res.changes > 0;
  }

  public static async getTokenById(tokenId: string): Promise<TokenRecord | undefined> {
    return await query.get<TokenRecord>('SELECT * FROM tokens WHERE id = ?', [tokenId]);
  }

  /**
   * Gets paginated list of tokens for admin monitoring
   */
  public static async listTokens(filter?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    tokens: TokenRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let whereSql = ' WHERE 1=1';
    const params: any[] = [];

    if (filter?.status && filter.status !== 'ALL') {
      whereSql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.search) {
      whereSql += ' AND (patron_name LIKE ? OR patron_nim LIKE ? OR token_code LIKE ? OR notes LIKE ?)';
      const term = `%${filter.search.trim()}%`;
      params.push(term, term, term, term);
    }

    const countRow = await query.get<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM tokens ${whereSql}`, params);
    const total = countRow?.cnt || 0;

    const page = Math.max(1, filter?.page || 1);
    const limit = Math.max(1, Math.min(100, filter?.limit || 10));
    const offset = (page - 1) * limit;

    const sql = `SELECT * FROM tokens ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const tokens = await query.all<TokenRecord>(sql, [...params, limit, offset]);
    const now = new Date().getTime();

    // Attach remaining seconds and handle expired
    const processedTokens = tokens.map((t) => {
      if (t.status === 'ACTIVE' && t.expires_at) {
        const exp = new Date(t.expires_at).getTime();
        t.remaining_seconds = Math.max(0, Math.floor((exp - now) / 1000));
        if (t.remaining_seconds === 0) {
          t.status = 'EXPIRED';
        }
      } else if (t.status === 'PENDING') {
        if (t.claim_expires_at) {
          const claimExp = new Date(t.claim_expires_at).getTime();
          t.claim_remaining_seconds = Math.max(0, Math.floor((claimExp - now) / 1000));
          if (t.claim_remaining_seconds === 0) {
            t.status = 'EXPIRED_UNCLAIMED';
          }
        }
      }
      return t;
    });

    return {
      tokens: processedTokens,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Export tokens list as formatted Excel (.xlsx) with borders and styled headers
   */
  public static async exportExcel(filter?: { status?: string; search?: string }): Promise<Buffer> {
    let whereSql = ' WHERE 1=1';
    const params: any[] = [];

    if (filter?.status && filter.status !== 'ALL') {
      whereSql += ' AND status = ?';
      params.push(filter.status);
    }

    if (filter?.search) {
      whereSql += ' AND (patron_name LIKE ? OR patron_nim LIKE ? OR token_code LIKE ? OR notes LIKE ?)';
      const term = `%${filter.search.trim()}%`;
      params.push(term, term, term, term);
    }

    const tokens = await query.all<TokenRecord>(
      `SELECT * FROM tokens ${whereSql} ORDER BY created_at DESC`,
      params
    );

    const formatStatusLabel = (st: string) => {
      switch (st) {
        case 'ACTIVE':
          return 'Aktif';
        case 'PENDING':
          return 'Menunggu';
        case 'EXPIRED_UNCLAIMED':
          return 'Hangus';
        case 'EXPIRED':
          return 'Berakhir';
        case 'REVOKED':
          return 'Dibatalkan';
        default:
          return st;
      }
    };

    const columns = [
      { header: 'Kode Token', key: 'token_code', width: 18, align: 'center' as const },
      { header: 'Nama Pemustaka', key: 'patron_name', width: 26, align: 'left' as const },
      { header: 'NIM/NIP', key: 'patron_nim', width: 16, align: 'center' as const },
      { header: 'Status', key: 'status_label', width: 14, align: 'center' as const },
      { header: 'Durasi Awal (Menit)', key: 'duration_minutes', width: 20, align: 'right' as const },
      { header: 'Perpanjangan (Menit)', key: 'extended_minutes', width: 22, align: 'right' as const },
      { header: 'Diterbitkan Oleh', key: 'created_by_admin', width: 20, align: 'left' as const },
      { header: 'Waktu Diterbitkan', key: 'created_at', width: 22, align: 'center' as const },
      { header: 'Waktu Klaim', key: 'claimed_at', width: 22, align: 'center' as const },
      { header: 'Waktu Kedaluwarsa', key: 'expires_at', width: 22, align: 'center' as const },
      { header: 'Catatan', key: 'notes', width: 30, align: 'left' as const },
    ];

    const rows = tokens.map((t) => ({
      token_code: t.token_code,
      patron_name: t.patron_name || '-',
      patron_nim: t.patron_nim || '-',
      status_label: formatStatusLabel(t.status),
      duration_minutes: t.duration_minutes,
      extended_minutes: t.extended_minutes || 0,
      created_by_admin: t.created_by_admin || 'System',
      created_at: t.created_at || '-',
      claimed_at: t.claimed_at || '-',
      expires_at: t.expires_at || '-',
      notes: t.notes || '-',
    }));

    return generateStyledExcelBuffer({
      sheetName: 'Daftar Sesi Tiket',
      columns,
      rows,
      headerBgColor: 'FF0F4C81', // UMS Navy Blue
    });
  }

  /**
   * Export batch generated tokens as formatted Excel (.xlsx) with borders
   */
  public static async exportBatchExcel(items: Array<{ token: TokenRecord }>, appOrigin: string): Promise<Buffer> {
    const columns = [
      { header: 'Kode Token', key: 'token_code', width: 18, align: 'center' as const },
      { header: 'Nama Pemustaka', key: 'patron_name', width: 26, align: 'left' as const },
      { header: 'NIM/NIP', key: 'patron_nim', width: 16, align: 'center' as const },
      { header: 'Durasi (Menit)', key: 'duration_minutes', width: 16, align: 'right' as const },
      { header: 'Catatan', key: 'notes', width: 28, align: 'left' as const },
      { header: 'Tautan Akses Langsung', key: 'direct_link', width: 45, align: 'left' as const },
    ];

    const rows = items.map(({ token }) => ({
      token_code: token.token_code,
      patron_name: token.patron_name || '-',
      patron_nim: token.patron_nim || '-',
      duration_minutes: token.duration_minutes,
      notes: token.notes || '-',
      direct_link: `${appOrigin}/?claim_token=${token.token_code}`,
    }));

    return generateStyledExcelBuffer({
      sheetName: 'Tiket Massal',
      columns,
      rows,
      headerBgColor: 'FF0F4C81',
    });
  }

  /**
   * Records a security incident / violation attempt triggered by client telemetry
   */
  public static async recordIncident(params: {
    tokenId: string;
    action: string;
    articleId?: number;
    docId?: number;
    articleTitle?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ success: boolean; token?: TokenRecord }> {
    try {
      const token = await query.get<TokenRecord>('SELECT * FROM tokens WHERE id = ?', [params.tokenId]);
      if (!token) return { success: false };

      await query.run(
        `UPDATE tokens SET 
          incident_count = COALESCE(incident_count, 0) + 1,
          last_incident_at = CURRENT_TIMESTAMP,
          last_incident_type = ?
         WHERE id = ?`,
        [params.action, params.tokenId]
      );

      // Write to audit log as well
      await AuditService.logAction({
        tokenId: token.id,
        patronNim: token.patron_nim,
        patronName: token.patron_name,
        action: 'SECURITY_INCIDENT' as any,
        eprintId: params.articleId,
        articleTitle: params.articleTitle
          ? `[PELANGGARAN: ${params.action}] ${params.articleTitle}`
          : `[PELANGGARAN: ${params.action}]`,
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent,
      });

      const updated = await query.get<TokenRecord>('SELECT * FROM tokens WHERE id = ?', [params.tokenId]);
      return { success: true, token: updated };
    } catch (err) {
      console.error('[TokenService] Error recording incident:', err);
      return { success: false };
    }
  }

  /**
   * Get latest live security incidents for admin real-time alert
   */
  public static async getRecentIncidents(limit = 10): Promise<any[]> {
    try {
      const rows = await query.all(
        `SELECT 
          a.id,
          a.token_id,
          a.patron_nim,
          a.patron_name,
          a.action,
          a.article_title,
          a.eprint_id,
          a.ip_address,
          a.user_agent,
          a.created_at,
          t.token_code,
          t.status as token_status,
          t.incident_count,
          t.last_incident_type,
          t.last_incident_at
         FROM audit_logs a
         LEFT JOIN tokens t ON a.token_id = t.id
         WHERE a.action = 'SECURITY_INCIDENT' OR a.article_title LIKE '[PELANGGARAN%'
         ORDER BY a.created_at DESC
         LIMIT ?`,
        [limit]
      );
      return rows;
    } catch {
      return [];
    }
  }

  /**
   * Periodic maintenance: automatically expire active and unclaimed tokens that exceeded deadlines
   */
  public static async cleanupExpiredTokens(): Promise<{ expiredActive: number; expiredUnclaimed: number }> {
    try {
      const nowIso = new Date().toISOString();
      const nowMs = Date.now();

      // 1. Expire active tokens
      const activeExpired = await query.run(
        `UPDATE tokens SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at <= ?`,
        [nowIso]
      );

      // 2. Expire unclaimed pending tokens past claim deadline
      const unclaimedExpired = await query.run(
        `UPDATE tokens SET status = 'EXPIRED_UNCLAIMED' WHERE status = 'PENDING' AND claim_expires_at IS NOT NULL AND claim_expires_at <= ?`,
        [nowIso]
      );

      return {
        expiredActive: activeExpired.changes || 0,
        expiredUnclaimed: unclaimedExpired.changes || 0,
      };
    } catch (err) {
      console.error('[TokenService] Error cleaning up expired tokens:', err);
      return { expiredActive: 0, expiredUnclaimed: 0 };
    }
  }
}

