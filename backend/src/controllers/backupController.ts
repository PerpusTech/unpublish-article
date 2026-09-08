import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { query, dbPath } from '../config/appDb';
import { ENV } from '../config/env';

export class BackupController {
  /**
   * Get SQLite database statistics, table row counts, and health status
   */
  public static async getDatabaseStats(req: Request, res: Response): Promise<void> {
    try {
      if (!fs.existsSync(dbPath)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'File database tidak ditemukan di path server.' },
        });
        return;
      }

      const fileStats = fs.statSync(dbPath);
      const sizeBytes = fileStats.size;
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      const sizeKB = (sizeBytes / 1024).toFixed(1);

      // Fetch row counts across all local SQLite tables
      const [tokensCount, auditCount, usersCount] = await Promise.all([
        query.get<{ count: number }>('SELECT COUNT(*) as count FROM tokens').catch(() => ({ count: 0 })),
        query.get<{ count: number }>('SELECT COUNT(*) as count FROM audit_logs').catch(() => ({ count: 0 })),
        query.get<{ count: number }>('SELECT COUNT(*) as count FROM admin_users').catch(() => ({ count: 0 })),
      ]);

      // PRAGMA health & config checks
      let integrity = 'OK';
      let journalMode = 'WAL';
      let pageSize = 4096;
      let pageCount = 0;

      try {
        const integrityCheck = await query.get<{ integrity_check: string }>('PRAGMA integrity_check;');
        if (integrityCheck && integrityCheck.integrity_check) {
          integrity = integrityCheck.integrity_check;
        }
        const jm = await query.get<{ journal_mode: string }>('PRAGMA journal_mode;');
        if (jm && jm.journal_mode) {
          journalMode = jm.journal_mode.toUpperCase();
        }
        const ps = await query.get<{ page_size: number }>('PRAGMA page_size;');
        if (ps && ps.page_size) {
          pageSize = ps.page_size;
        }
        const pc = await query.get<{ page_count: number }>('PRAGMA page_count;');
        if (pc && pc.page_count) {
          pageCount = pc.page_count;
        }
      } catch (pragmaErr) {
        console.warn('[BackupController] PRAGMA check error:', pragmaErr);
      }

      res.json({
        success: true,
        stats: {
          databaseFile: path.basename(dbPath),
          databasePath: dbPath,
          sizeBytes,
          sizeFormatted: sizeBytes >= 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`,
          lastModified: fileStats.mtime.toISOString(),
          created: fileStats.birthtime.toISOString(),
          integrity,
          journalMode,
          pageSize,
          pageCount,
          tables: {
            tokens: tokensCount?.count || 0,
            audit_logs: auditCount?.count || 0,
            admin_users: usersCount?.count || 0,
          },
          totalRecords: (tokensCount?.count || 0) + (auditCount?.count || 0) + (usersCount?.count || 0),
        },
      });
    } catch (err: any) {
      console.error('[BackupController] Error fetching db stats:', err);
      res.status(500).json({
        success: false,
        error: { code: 'STATS_ERROR', message: err.message || 'Gagal memuat statistik database.' },
      });
    }
  }

  /**
   * One-click download of the active SQLite database snapshot (.sqlite)
   * Uses SQLite VACUUM INTO or safe temporary snapshot to prevent locking/corruption
   */
  public static async downloadBackup(req: Request, res: Response): Promise<void> {
    try {
      if (!fs.existsSync(dbPath)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'File database tidak ditemukan.' },
        });
        return;
      }

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `unpublish_db_backup_${dateStr}.sqlite`;
      const tempBackupFile = path.join(ENV.DATA_DIR, `temp_backup_${Date.now()}.sqlite`);

      // Attempt safe snapshot using VACUUM INTO (guarantees a consistent, defragmented single-file snapshot)
      let usedVacuum = false;
      try {
        await query.run(`VACUUM INTO ?`, [tempBackupFile]);
        usedVacuum = true;
      } catch (vacuumErr) {
        console.warn('[BackupController] VACUUM INTO failed, falling back to direct copy:', vacuumErr);
        // Fallback: checkpoint WAL and copy
        try {
          await query.run('PRAGMA wal_checkpoint(TRUNCATE);').catch(() => { });
        } catch { }
        fs.copyFileSync(dbPath, tempBackupFile);
      }

      console.log(`[BackupController] SQLite backup generated (${usedVacuum ? 'VACUUM INTO' : 'COPY'}): ${tempBackupFile}`);

      res.setHeader('Content-Type', 'application/x-sqlite3');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.download(tempBackupFile, filename, (err) => {
        // Clean up temporary file after streaming completes
        try {
          if (fs.existsSync(tempBackupFile)) {
            fs.unlinkSync(tempBackupFile);
          }
        } catch (cleanupErr) {
          console.warn('[BackupController] Failed to clean up temp backup file:', cleanupErr);
        }

        if (err) {
          console.error('[BackupController] Error streaming backup file:', err);
        }
      });
    } catch (err: any) {
      console.error('[BackupController] Error generating database backup:', err);
      res.status(500).json({
        success: false,
        error: { code: 'BACKUP_FAILED', message: err.message || 'Gagal membuat file backup database.' },
      });
    }
  }

  /**
   * Export all database records as structured JSON archive
   */
  public static async exportJson(req: Request, res: Response): Promise<void> {
    try {
      const [tokens, auditLogs, adminUsers] = await Promise.all([
        query.all('SELECT * FROM tokens ORDER BY created_at DESC'),
        query.all('SELECT * FROM audit_logs ORDER BY created_at DESC'),
        query.all('SELECT email, name, role, is_active, last_login_at, created_at FROM admin_users ORDER BY created_at ASC'),
      ]);

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const filename = `unpublish_db_export_${dateStr}.json`;

      const dumpPayload = {
        metadata: {
          appName: 'EPrints Unpublish Article Viewer - UPT Perpustakaan dan Layanan Digital UMS',
          exportDate: now.toISOString(),
          totalRecords: tokens.length + auditLogs.length + adminUsers.length,
          tableCounts: {
            tokens: tokens.length,
            audit_logs: auditLogs.length,
            admin_users: adminUsers.length,
          },
        },
        tables: {
          tokens,
          audit_logs: auditLogs,
          admin_users: adminUsers,
        },
      };

      const jsonStr = JSON.stringify(dumpPayload, null, 2);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(jsonStr);
    } catch (err: any) {
      console.error('[BackupController] Error exporting database as JSON:', err);
      res.status(500).json({
        success: false,
        error: { code: 'EXPORT_FAILED', message: err.message || 'Gagal mengekspor data database ke JSON.' },
      });
    }
  }

  /**
   * Run maintenance optimization (VACUUM and PRAGMA optimize)
   */
  public static async optimizeDatabase(req: Request, res: Response): Promise<void> {
    try {
      console.log('[BackupController] Starting database maintenance and VACUUM...');
      await query.run('VACUUM;');
      await query.run('PRAGMA optimize;');

      const fileStats = fs.statSync(dbPath);
      const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
      const sizeKB = (fileStats.size / 1024).toFixed(1);

      res.json({
        success: true,
        message: 'Database SQLite berhasil di-VACUUM, didefragmentasi, dan dioptimasi.',
        currentSizeFormatted: fileStats.size >= 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`,
      });
    } catch (err: any) {
      console.error('[BackupController] Error optimizing database:', err);
      res.status(500).json({
        success: false,
        error: { code: 'OPTIMIZE_FAILED', message: err.message || 'Gagal mengoptimasi database.' },
      });
    }
  }
}
