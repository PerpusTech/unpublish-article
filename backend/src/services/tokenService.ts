import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { query } from '../config/appDb';

export interface TokenRecord {
  id: string;
  token_code: string;
  patron_name: string;
  patron_nim: string;
  duration_minutes: number;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'EXPIRED_UNCLAIMED' | 'REVOKED';
  device_fingerprint?: string;
  created_by_admin: string;
  created_at: string;
  claimed_at?: string;
  expires_at?: string;
  extended_minutes: number;
  notes?: string;
  remaining_seconds?: number;
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

    await query.run(
      `INSERT INTO tokens (
        id, token_code, patron_name, patron_nim, duration_minutes,
        status, created_by_admin, notes
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      [
        id,
        tokenCode,
        params.patronName.trim(),
        params.patronNim.trim(),
        params.durationMinutes,
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
    const code = tokenCode.trim().toUpperCase();
    const token = await query.get<TokenRecord>(
      'SELECT * FROM tokens WHERE token_code = ?',
      [code]
    );

    if (!token) {
      return { success: false, message: 'Kode token tidak ditemukan. Mohon periksa kembali atau hubungi pustakawan.' };
    }

    // Check if token was revoked
    if (token.status === 'REVOKED') {
      return { success: false, message: 'Token ini telah dibatalkan/dicabut oleh pustakawan.' };
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

    if (token.status !== 'PENDING') {
      return { success: false, message: `Status token tidak valid: ${token.status}` };
    }

    // Check unclaimed expiration (24 hours)
    const createdAt = new Date(token.created_at).getTime();
    const nowTime = new Date().getTime();
    if (nowTime - createdAt > 24 * 60 * 60 * 1000) {
      await query.run("UPDATE tokens SET status = 'EXPIRED_UNCLAIMED' WHERE id = ?", [token.id]);
      return { success: false, message: 'Token hangus karena belum diaktivasi lebih dari 24 jam sejak diterbitkan.' };
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
      return { isValid: false, reason: 'Sesi telah dicabut oleh pustakawan.' };
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
      return { success: false, message: 'Tidak dapat memperpanjang token yang telah dicabut.' };
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
   * Export tokens list as CSV
   */
  public static async exportCsv(filter?: { status?: string; search?: string }): Promise<string> {
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

    const headers = [
      'Kode Token',
      'Nama Pemustaka',
      'NIM/NIP',
      'Status',
      'Durasi Awal (Menit)',
      'Perpanjangan (Menit)',
      'Diterbitkan Oleh',
      'Waktu Diterbitkan',
      'Waktu Klaim',
      'Waktu Kedaluwarsa',
      'Catatan',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = tokens.map((t) => [
      escapeCsv(t.token_code),
      escapeCsv(t.patron_name),
      escapeCsv(t.patron_nim),
      escapeCsv(t.status),
      escapeCsv(t.duration_minutes),
      escapeCsv(t.extended_minutes || 0),
      escapeCsv(t.created_by_admin),
      escapeCsv(t.created_at),
      escapeCsv(t.claimed_at || '-'),
      escapeCsv(t.expires_at || '-'),
      escapeCsv(t.notes || '-'),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
