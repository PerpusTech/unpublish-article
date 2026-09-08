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
}
