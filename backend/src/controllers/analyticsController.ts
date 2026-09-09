import { Request, Response } from 'express';
import { query } from '../config/appDb';

export class AnalyticsController {
  /**
   * Faculty mapping by UMS NIM prefix
   */
  private static getFacultyName(prefix: string): string {
    const map: Record<string, string> = {
      A: 'FKIP (Keguruan & Ilmu Pendidikan)',
      B: 'FEB (Ekonomi & Bisnis)',
      C: 'Fakultas Hukum',
      D: 'Fakultas Teknik',
      E: 'Fakultas Farmasi',
      F: 'Fakultas Psikologi',
      G: 'Fakultas Geografi',
      H: 'FAI (Agama Islam)',
      I: 'FIK (Ilmu Kesehatan)',
      J: 'Fakultas Kedokteran',
      K: 'Fakultas Kedokteran Gigi',
      L: 'FKI (Komunikasi & Informatika)',
      M: 'Sekolah Pascasarjana',
    };
    return map[prefix.toUpperCase()] || `Lainnya / Umum (${prefix.toUpperCase()})`;
  }

  /**
   * Get comprehensive analytics & insights data
   */
  public static async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // 1. KPI Summary Metrics
      const totalTokensRow: any = await query.get('SELECT COUNT(*) as count FROM tokens');
      const activeTokensRow: any = await query.get("SELECT COUNT(*) as count FROM tokens WHERE status = 'ACTIVE'");
      const pendingTokensRow: any = await query.get("SELECT COUNT(*) as count FROM tokens WHERE status = 'PENDING'");
      const revokedTokensRow: any = await query.get("SELECT COUNT(*) as count FROM tokens WHERE status = 'REVOKED'");
      const expiredTokensRow: any = await query.get("SELECT COUNT(*) as count FROM tokens WHERE status = 'EXPIRED'");

      const totalViewsRow: any = await query.get("SELECT COUNT(*) as count FROM audit_logs WHERE action IN ('VIEW_PDF', 'VIEW_DOCUMENT')");
      const uniquePatronsRow: any = await query.get('SELECT COUNT(DISTINCT patron_nim) as count FROM audit_logs');
      const avgDurationRow: any = await query.get('SELECT AVG(duration_minutes + extended_minutes) as avgDuration FROM tokens');

      // 2. Top 10 Most Read Articles
      const topArticles: any[] = await query.all(`
        SELECT 
          eprint_id,
          article_title,
          COUNT(*) as view_count,
          COUNT(DISTINCT patron_nim) as unique_readers
        FROM audit_logs
        WHERE action IN ('VIEW_PDF', 'VIEW_DOCUMENT') AND eprint_id IS NOT NULL AND article_title IS NOT NULL
        GROUP BY eprint_id, article_title
        ORDER BY view_count DESC
        LIMIT 10
      `);

      // 3. Top 10 Most Active Pemustaka
      const topPatrons: any[] = await query.all(`
        SELECT 
          patron_nim,
          patron_name,
          COUNT(*) as total_actions,
          SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as document_views,
          COUNT(DISTINCT token_id) as tokens_used,
          MAX(created_at) as last_activity
        FROM audit_logs
        GROUP BY patron_nim, patron_name
        ORDER BY document_views DESC, total_actions DESC
        LIMIT 10
      `);

      // 4. Faculty / Department Distribution based on NIM prefix
      const facultyDistributionRaw: any[] = await query.all(`
        SELECT 
          UPPER(SUBSTR(patron_nim, 1, 1)) as prefix,
          COUNT(DISTINCT patron_nim) as patron_count,
          COUNT(*) as activity_count
        FROM audit_logs
        WHERE patron_nim IS NOT NULL AND LENGTH(patron_nim) >= 2
        GROUP BY prefix
        ORDER BY activity_count DESC
      `);

      const facultyDistribution = facultyDistributionRaw.map((row) => ({
        prefix: row.prefix,
        faculty: AnalyticsController.getFacultyName(row.prefix),
        patron_count: row.patron_count,
        activity_count: row.activity_count,
      }));

      // 5. Peak Hours Activity Distribution (00 - 23)
      const hourlyDistributionRaw: any[] = await query.all(`
        SELECT 
          strftime('%H', created_at) as hour,
          COUNT(*) as count,
          SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as view_count
        FROM audit_logs
        GROUP BY hour
        ORDER BY hour ASC
      `);

      // Fill in all 24 hours
      const hourlyActivity: { hour: string; label: string; count: number; view_count: number }[] = [];
      const hourMap = new Map(hourlyDistributionRaw.map((r) => [r.hour, r]));
      for (let h = 0; h < 24; h++) {
        const hourStr = h.toString().padStart(2, '0');
        const match = hourMap.get(hourStr);
        hourlyActivity.push({
          hour: hourStr,
          label: `${hourStr}:00`,
          count: match ? match.count : 0,
          view_count: match ? match.view_count : 0,
        });
      }

      // 6. Daily Activity Trend (Last 14 days)
      const dailyTrend: any[] = await query.all(`
        SELECT 
          date(created_at) as date,
          COUNT(*) as total_events,
          SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as document_views,
          COUNT(DISTINCT patron_nim) as active_readers
        FROM audit_logs
        WHERE created_at >= date('now', '-14 days')
        GROUP BY date(created_at)
        ORDER BY date ASC
      `);

      // 7. Token Status Summary
      const tokenStatusBreakdown = {
        ACTIVE: activeTokensRow?.count || 0,
        PENDING: pendingTokensRow?.count || 0,
        EXPIRED: expiredTokensRow?.count || 0,
        REVOKED: revokedTokensRow?.count || 0,
      };

      res.json({
        success: true,
        data: {
          kpis: {
            totalTokens: totalTokensRow?.count || 0,
            activeTokens: activeTokensRow?.count || 0,
            pendingTokens: pendingTokensRow?.count || 0,
            revokedTokens: revokedTokensRow?.count || 0,
            totalDocumentViews: totalViewsRow?.count || 0,
            uniquePatrons: uniquePatronsRow?.count || 0,
            averageDurationMinutes: Math.round(avgDurationRow?.avgDuration || 30),
          },
          topArticles,
          topPatrons,
          facultyDistribution,
          hourlyActivity,
          dailyTrend,
          tokenStatusBreakdown,
        },
      });
    } catch (err: any) {
      console.error('[Analytics Error]:', err);
      res.status(500).json({
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Gagal memproses data analitik dan statistik repositori.',
        },
      });
    }
  }

  /**
   * Record reading heartbeat for page duration tracking
   */
  public static async recordReadingHeartbeat(req: Request, res: Response): Promise<void> {
    try {
      const {
        eprintId,
        articleTitle,
        pageNumber,
        durationSeconds,
        patronNim,
        patronName,
        accessType = 'INTRANET',
      } = req.body;

      if (!eprintId || !pageNumber || typeof durationSeconds !== 'number') {
        res.status(400).json({
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'eprintId, pageNumber, dan durationSeconds wajib diisi.',
          },
        });
        return;
      }

      // Cap duration per heartbeat to 120s to avoid bogus spikes from paused background tabs
      const validDuration = Math.max(1, Math.min(Math.round(durationSeconds), 120));
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      await query.run(
        `INSERT INTO page_reading_logs (
          id, eprint_id, article_title, page_number, duration_seconds,
          patron_nim, patron_name, access_type, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          eprintId,
          articleTitle || `Naskah #${eprintId}`,
          pageNumber,
          validDuration,
          patronNim || 'Civitas UMS',
          patronName || 'Pemustaka Intranet',
          accessType,
          ipAddress,
        ]
      );

      res.json({ success: true, recordedDuration: validDuration });
    } catch (err: any) {
      console.error('[Analytics Heartbeat Error]:', err);
      res.status(500).json({
        error: {
          code: 'HEARTBEAT_RECORD_FAILED',
          message: 'Gagal mencatat durasi membaca halaman.',
        },
      });
    }
  }

  /**
   * Get page-by-page heatmap analytics for a specific manuscript
   */
  public static async getReadingHeatmap(req: Request, res: Response): Promise<void> {
    try {
      const eprintId = parseInt(String(req.params.eprintId), 10);
      if (isNaN(eprintId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_EPRINT_ID',
            message: 'EPrint ID tidak valid.',
          },
        });
        return;
      }

      // Page level aggregated metrics
      const pageStats: any[] = await query.all(
        `SELECT 
          page_number,
          SUM(duration_seconds) as total_duration_seconds,
          COUNT(*) as view_count,
          COUNT(DISTINCT patron_nim) as unique_readers,
          AVG(duration_seconds) as avg_duration_seconds
        FROM page_reading_logs
        WHERE eprint_id = ?
        GROUP BY page_number
        ORDER BY page_number ASC`,
        [eprintId]
      );

      // Article info & overall totals
      const articleSummary: any = await query.get(
        `SELECT 
          article_title,
          SUM(duration_seconds) as grand_total_seconds,
          COUNT(*) as total_reading_events,
          COUNT(DISTINCT patron_nim) as total_unique_readers,
          MAX(page_number) as max_recorded_page
        FROM page_reading_logs
        WHERE eprint_id = ?`,
        [eprintId]
      );

      // Find max duration on any page to compute relative intensity score (0-100%)
      const maxPageDuration = pageStats.reduce(
        (max, p) => Math.max(max, p.total_duration_seconds),
        0
      );

      const pages = pageStats.map((p) => ({
        pageNumber: p.page_number,
        totalDurationSeconds: p.total_duration_seconds,
        avgDurationSeconds: Math.round(p.avg_duration_seconds),
        viewCount: p.view_count,
        uniqueReaders: p.unique_readers,
        intensityScore:
          maxPageDuration > 0
            ? Math.round((p.total_duration_seconds / maxPageDuration) * 100)
            : 0,
      }));

      // Top peak pages
      const peakPages = [...pages]
        .sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds)
        .slice(0, 5);

      res.json({
        success: true,
        data: {
          eprintId,
          articleTitle: articleSummary?.article_title || `Naskah #${eprintId}`,
          grandTotalSeconds: articleSummary?.grand_total_seconds || 0,
          totalReadingEvents: articleSummary?.total_reading_events || 0,
          totalUniqueReaders: articleSummary?.total_unique_readers || 0,
          maxRecordedPage: articleSummary?.max_recorded_page || 0,
          pages,
          peakPages,
        },
      });
    } catch (err: any) {
      console.error('[Get Reading Heatmap Error]:', err);
      res.status(500).json({
        error: {
          code: 'HEATMAP_FETCH_FAILED',
          message: 'Gagal memuat data heatmap durasi membaca naskah.',
        },
      });
    }
  }

  /**
   * Get summary list of manuscripts with reading analytics
   */
  public static async getReadingHeatmapSummary(req: Request, res: Response): Promise<void> {
    try {
      const topManuscripts: any[] = await query.all(`
        SELECT 
          eprint_id,
          article_title,
          SUM(duration_seconds) as total_duration_seconds,
          COUNT(DISTINCT patron_nim) as unique_readers,
          COUNT(*) as total_events,
          COUNT(DISTINCT page_number) as pages_covered,
          MAX(created_at) as last_read_at
        FROM page_reading_logs
        GROUP BY eprint_id, article_title
        ORDER BY total_duration_seconds DESC
        LIMIT 20
      `);

      const totalOverallSecondsRow: any = await query.get(
        'SELECT SUM(duration_seconds) as total FROM page_reading_logs'
      );
      const totalOverallReadersRow: any = await query.get(
        'SELECT COUNT(DISTINCT patron_nim) as count FROM page_reading_logs'
      );

      res.json({
        success: true,
        data: {
          overallTotalSeconds: totalOverallSecondsRow?.total || 0,
          overallUniqueReaders: totalOverallReadersRow?.count || 0,
          manuscripts: topManuscripts,
        },
      });
    } catch (err: any) {
      console.error('[Get Reading Heatmap Summary Error]:', err);
      res.status(500).json({
        error: {
          code: 'HEATMAP_SUMMARY_FAILED',
          message: 'Gagal memuat ringkasan durasi membaca naskah.',
        },
      });
    }
  }
}
