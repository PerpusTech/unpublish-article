import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
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
   * Helper: Parse and normalize period filter from query parameters
   */
  private static parsePeriodFilter(queryParam: any): {
    periodType: 'daily' | 'monthly' | 'yearly' | 'custom' | 'all';
    startDate: string;
    endDate: string;
    periodLabel: string;
    hasFilter: boolean;
    whereClauseAudit: string;
    whereClauseTokens: string;
    whereClausePageLogs: string;
    params: any[];
    selectedDate?: string;
    selectedMonth?: number;
    selectedYear?: number;
  } {
    const periodType = (queryParam.periodType || 'monthly') as 'daily' | 'monthly' | 'yearly' | 'custom' | 'all';
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDateStr = now.toISOString().slice(0, 10);

    const MONTH_NAMES_ID = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    let startDate = '';
    let endDate = '';
    let periodLabel = '';
    let hasFilter = true;
    let selectedDate: string | undefined = undefined;
    let selectedMonth: number | undefined = undefined;
    let selectedYear: number | undefined = undefined;

    if (periodType === 'daily') {
      const dateStr = (queryParam.date || currentDateStr).trim();
      selectedDate = dateStr;
      startDate = `${dateStr} 00:00:00`;
      endDate = `${dateStr} 23:59:59`;
      
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = parseInt(parts[2], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parts[0];
        periodLabel = `Harian: ${d} ${MONTH_NAMES_ID[m] || ''} ${y}`;
      } else {
        periodLabel = `Harian: ${dateStr}`;
      }
    } else if (periodType === 'monthly') {
      const year = parseInt(queryParam.year || currentYear, 10);
      const month = Math.max(1, Math.min(12, parseInt(queryParam.month || currentMonth, 10)));
      selectedYear = year;
      selectedMonth = month;
      
      const lastDay = new Date(year, month, 0).getDate();
      const monthStr = month.toString().padStart(2, '0');
      startDate = `${year}-${monthStr}-01 00:00:00`;
      endDate = `${year}-${monthStr}-${lastDay.toString().padStart(2, '0')} 23:59:59`;
      periodLabel = `Bulanan: ${MONTH_NAMES_ID[month - 1]} ${year}`;
    } else if (periodType === 'yearly') {
      const year = parseInt(queryParam.year || currentYear, 10);
      selectedYear = year;
      startDate = `${year}-01-01 00:00:00`;
      endDate = `${year}-12-31 23:59:59`;
      periodLabel = `Tahunan: Tahun ${year}`;
    } else if (periodType === 'custom') {
      const start = (queryParam.startDate || currentDateStr).trim();
      const end = (queryParam.endDate || currentDateStr).trim();
      startDate = `${start} 00:00:00`;
      endDate = `${end} 23:59:59`;
      periodLabel = `Periode Kustom: ${start} s/d ${end}`;
    } else {
      // 'all'
      hasFilter = false;
      startDate = '1970-01-01 00:00:00';
      endDate = '2099-12-31 23:59:59';
      periodLabel = 'Semua Waktu (All Time)';
    }

    const whereClauseAudit = hasFilter ? 'created_at >= ? AND created_at <= ?' : '1=1';
    const whereClauseTokens = hasFilter ? 'created_at >= ? AND created_at <= ?' : '1=1';
    const whereClausePageLogs = hasFilter ? 'created_at >= ? AND created_at <= ?' : '1=1';
    const params = hasFilter ? [startDate, endDate] : [];

    return {
      periodType,
      startDate,
      endDate,
      periodLabel,
      hasFilter,
      whereClauseAudit,
      whereClauseTokens,
      whereClausePageLogs,
      params,
      selectedDate,
      selectedMonth,
      selectedYear,
    };
  }

  /**
   * Get comprehensive analytics & insights data with multi-period filters (Daily, Monthly, Yearly, Custom, All)
   */
  public static async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const filter = AnalyticsController.parsePeriodFilter(req.query);
      const { params, whereClauseAudit, whereClauseTokens } = filter;

      // 1. KPI Summary Metrics for the filtered period
      const totalTokensRow: any = await query.get(
        `SELECT COUNT(*) as count FROM tokens WHERE ${whereClauseTokens}`,
        params
      );
      const activeTokensRow: any = await query.get(
        `SELECT COUNT(*) as count FROM tokens WHERE status = 'ACTIVE' AND ${whereClauseTokens}`,
        params
      );
      const pendingTokensRow: any = await query.get(
        `SELECT COUNT(*) as count FROM tokens WHERE status = 'PENDING' AND ${whereClauseTokens}`,
        params
      );
      const revokedTokensRow: any = await query.get(
        `SELECT COUNT(*) as count FROM tokens WHERE status = 'REVOKED' AND ${whereClauseTokens}`,
        params
      );
      const expiredTokensRow: any = await query.get(
        `SELECT COUNT(*) as count FROM tokens WHERE status = 'EXPIRED' AND ${whereClauseTokens}`,
        params
      );

      const totalViewsRow: any = await query.get(
        `SELECT COUNT(*) as count FROM audit_logs WHERE action IN ('VIEW_PDF', 'VIEW_DOCUMENT') AND ${whereClauseAudit}`,
        params
      );
      const uniquePatronsRow: any = await query.get(
        `SELECT COUNT(DISTINCT patron_nim) as count FROM audit_logs WHERE ${whereClauseAudit}`,
        params
      );
      const avgDurationRow: any = await query.get(
        `SELECT AVG(duration_minutes + extended_minutes) as avgDuration FROM tokens WHERE ${whereClauseTokens}`,
        params
      );

      // 2. Top 10 Most Read Articles in the filtered period
      const topArticles: any[] = await query.all(
        `SELECT 
          eprint_id,
          article_title,
          COUNT(*) as view_count,
          COUNT(DISTINCT patron_nim) as unique_readers
        FROM audit_logs
        WHERE action IN ('VIEW_PDF', 'VIEW_DOCUMENT') 
          AND eprint_id IS NOT NULL 
          AND article_title IS NOT NULL
          AND ${whereClauseAudit}
        GROUP BY eprint_id, article_title
        ORDER BY view_count DESC
        LIMIT 10`,
        params
      );

      // 3. Top 10 Most Active Pemustaka in the filtered period
      const topPatrons: any[] = await query.all(
        `SELECT 
          patron_nim,
          patron_name,
          COUNT(*) as total_actions,
          SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as document_views,
          COUNT(DISTINCT token_id) as tokens_used,
          MAX(created_at) as last_activity
        FROM audit_logs
        WHERE ${whereClauseAudit}
        GROUP BY patron_nim, patron_name
        ORDER BY document_views DESC, total_actions DESC
        LIMIT 10`,
        params
      );

      // 4. Faculty / Department Distribution based on NIM prefix in the filtered period
      const facultyDistributionRaw: any[] = await query.all(
        `SELECT 
          UPPER(SUBSTR(patron_nim, 1, 1)) as prefix,
          COUNT(DISTINCT patron_nim) as patron_count,
          COUNT(*) as activity_count
        FROM audit_logs
        WHERE patron_nim IS NOT NULL 
          AND LENGTH(patron_nim) >= 2
          AND ${whereClauseAudit}
        GROUP BY prefix
        ORDER BY activity_count DESC`,
        params
      );

      const facultyDistribution = facultyDistributionRaw.map((row) => ({
        prefix: row.prefix,
        faculty: AnalyticsController.getFacultyName(row.prefix),
        patron_count: row.patron_count,
        activity_count: row.activity_count,
      }));

      // 5. Peak Hours Activity Distribution (00 - 23) in the filtered period
      const hourlyDistributionRaw: any[] = await query.all(
        `SELECT 
          strftime('%H', created_at) as hour,
          COUNT(*) as count,
          SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as view_count
        FROM audit_logs
        WHERE ${whereClauseAudit}
        GROUP BY hour
        ORDER BY hour ASC`,
        params
      );

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

      // 6. Timeline Activity Trend adapted to the active period
      let dailyTrend: any[] = [];
      if (filter.periodType === 'daily') {
        // Timeline by hour of that specific day
        dailyTrend = hourlyActivity.map((h) => ({
          date: h.label,
          total_events: h.count,
          document_views: h.view_count,
          active_readers: 0,
        }));
      } else if (filter.periodType === 'monthly') {
        // Timeline by all days of the selected month
        const monthlyDaysRaw: any[] = await query.all(
          `SELECT 
            date(created_at) as date,
            COUNT(*) as total_events,
            SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as document_views,
            COUNT(DISTINCT patron_nim) as active_readers
          FROM audit_logs
          WHERE ${whereClauseAudit}
          GROUP BY date(created_at)
          ORDER BY date ASC`,
          params
        );
        dailyTrend = monthlyDaysRaw;
      } else if (filter.periodType === 'yearly') {
        // Timeline by 12 months
        const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const yearlyMonthsRaw: any[] = await query.all(
          `SELECT 
            strftime('%m', created_at) as month_num,
            COUNT(*) as total_events,
            SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as document_views,
            COUNT(DISTINCT patron_nim) as active_readers
          FROM audit_logs
          WHERE ${whereClauseAudit}
          GROUP BY month_num
          ORDER BY month_num ASC`,
          params
        );
        const yMap = new Map(yearlyMonthsRaw.map((r) => [r.month_num, r]));
        for (let m = 1; m <= 12; m++) {
          const mStr = m.toString().padStart(2, '0');
          const row = yMap.get(mStr);
          dailyTrend.push({
            date: MONTH_SHORT[m - 1],
            total_events: row ? row.total_events : 0,
            document_views: row ? row.document_views : 0,
            active_readers: row ? row.active_readers : 0,
          });
        }
      } else {
        // Custom or All time (recent days)
        dailyTrend = await query.all(
          `SELECT 
            date(created_at) as date,
            COUNT(*) as total_events,
            SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as document_views,
            COUNT(DISTINCT patron_nim) as active_readers
          FROM audit_logs
          WHERE ${whereClauseAudit}
          GROUP BY date(created_at)
          ORDER BY date ASC
          LIMIT 31`,
          params
        );
      }

      // 7. Token Status Summary for the period
      const tokenStatusBreakdown = {
        ACTIVE: activeTokensRow?.count || 0,
        PENDING: pendingTokensRow?.count || 0,
        EXPIRED: expiredTokensRow?.count || 0,
        REVOKED: revokedTokensRow?.count || 0,
      };

      res.json({
        success: true,
        period: {
          type: filter.periodType,
          label: filter.periodLabel,
          startDate: filter.startDate,
          endDate: filter.endDate,
          selectedDate: filter.selectedDate,
          selectedMonth: filter.selectedMonth,
          selectedYear: filter.selectedYear,
        },
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
   * Export comprehensive usage report to formatted Excel (.xlsx) with styled sheets and borders
   */
  public static async exportAnalyticsExcel(req: Request, res: Response): Promise<void> {
    try {
      const filter = AnalyticsController.parsePeriodFilter(req.query);
      const { params, whereClauseAudit, whereClauseTokens, periodLabel } = filter;

      // 1. KPI Counts
      const totalTokensRow: any = await query.get(
        `SELECT COUNT(*) as count FROM tokens WHERE ${whereClauseTokens}`,
        params
      );
      const activeTokensRow: any = await query.get(
        `SELECT COUNT(*) as count FROM tokens WHERE status = 'ACTIVE' AND ${whereClauseTokens}`,
        params
      );
      const totalViewsRow: any = await query.get(
        `SELECT COUNT(*) as count FROM audit_logs WHERE action IN ('VIEW_PDF', 'VIEW_DOCUMENT') AND ${whereClauseAudit}`,
        params
      );
      const uniquePatronsRow: any = await query.get(
        `SELECT COUNT(DISTINCT patron_nim) as count FROM audit_logs WHERE ${whereClauseAudit}`,
        params
      );
      const avgDurationRow: any = await query.get(
        `SELECT AVG(duration_minutes + extended_minutes) as avgDuration FROM tokens WHERE ${whereClauseTokens}`,
        params
      );

      // 2. Top 25 Read Articles
      const topArticles: any[] = await query.all(
        `SELECT 
          eprint_id,
          article_title,
          COUNT(*) as view_count,
          COUNT(DISTINCT patron_nim) as unique_readers
        FROM audit_logs
        WHERE action IN ('VIEW_PDF', 'VIEW_DOCUMENT') 
          AND eprint_id IS NOT NULL 
          AND article_title IS NOT NULL
          AND ${whereClauseAudit}
        GROUP BY eprint_id, article_title
        ORDER BY view_count DESC
        LIMIT 25`,
        params
      );

      // 3. Top 25 Active Patrons
      const topPatrons: any[] = await query.all(
        `SELECT 
          patron_nim,
          patron_name,
          COUNT(*) as total_actions,
          SUM(CASE WHEN action IN ('VIEW_PDF', 'VIEW_DOCUMENT') THEN 1 ELSE 0 END) as document_views,
          COUNT(DISTINCT token_id) as tokens_used,
          MAX(created_at) as last_activity
        FROM audit_logs
        WHERE ${whereClauseAudit}
        GROUP BY patron_nim, patron_name
        ORDER BY document_views DESC, total_actions DESC
        LIMIT 25`,
        params
      );

      // 4. Faculty Distribution
      const facultyDistributionRaw: any[] = await query.all(
        `SELECT 
          UPPER(SUBSTR(patron_nim, 1, 1)) as prefix,
          COUNT(DISTINCT patron_nim) as patron_count,
          COUNT(*) as activity_count
        FROM audit_logs
        WHERE patron_nim IS NOT NULL 
          AND LENGTH(patron_nim) >= 2
          AND ${whereClauseAudit}
        GROUP BY prefix
        ORDER BY activity_count DESC`,
        params
      );

      // 5. Detailed Usage Logs (Up to 1000 rows)
      const logs: any[] = await query.all(
        `SELECT 
          id, token_id, patron_nim, patron_name, action,
          eprint_id, article_title, eprint_status, ip_address, created_at
        FROM audit_logs
        WHERE ${whereClauseAudit}
        ORDER BY created_at DESC
        LIMIT 1000`,
        params
      );

      const adminUser = req.admin?.name || req.admin?.email || 'Administrator Perpustakaan';
      const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      // Create ExcelJS Workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'UPT Perpustakaan UMS';
      workbook.created = new Date();

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      const styleSheet = (ws: ExcelJS.Worksheet) => {
        ws.views = [{ showGridLines: true }];
        const hRow = ws.getRow(1);
        hRow.height = 28;
        hRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
        hRow.alignment = { vertical: 'middle', horizontal: 'center' };

        ws.eachRow((row, rowNumber) => {
          row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = thinBorder;
            if (rowNumber > 1) {
              cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF1E293B' } };
              if (rowNumber % 2 === 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
              }
            }
          });
        });
      };

      // --- Sheet 1: Ringkasan Eksekutif (KPI) ---
      const wsKpi = workbook.addWorksheet('Ringkasan KPI');
      wsKpi.columns = [
        { header: 'Metrik Indikator', key: 'metric', width: 32 },
        { header: 'Nilai Statistik', key: 'value', width: 20 },
        { header: 'Keterangan Analisis', key: 'desc', width: 45 },
      ];
      wsKpi.addRow({ metric: 'Periode Analisis', value: periodLabel, desc: `${filter.startDate} s/d ${filter.endDate}` });
      wsKpi.addRow({ metric: 'Waktu Ekspor Laporan', value: nowStr + ' WIB', desc: `Diekspor oleh: ${adminUser}` });
      wsKpi.addRow({ metric: 'Total Pembacaan Naskah (PDF)', value: totalViewsRow?.count || 0, desc: 'Akumulasi pembacaan berkas PDF naskah unpublish' });
      wsKpi.addRow({ metric: 'Total Token Sesi Diterbitkan', value: totalTokensRow?.count || 0, desc: 'Total tiket sesi izin akses pemustaka' });
      wsKpi.addRow({ metric: 'Sesi Aktif / Digunakan', value: activeTokensRow?.count || 0, desc: 'Sesi yang berhasil diklaim pemustaka' });
      wsKpi.addRow({ metric: 'Jumlah Pemustaka Unik', value: uniquePatronsRow?.count || 0, desc: 'Jumlah mahasiswa/peneliti unik (NIM)' });
      wsKpi.addRow({ metric: 'Rata-rata Durasi Membaca', value: `${Math.round(avgDurationRow?.avgDuration || 30)} Menit`, desc: 'Durasi rata-rata per sesi pembacaan' });
      styleSheet(wsKpi);

      // --- Sheet 2: Top Naskah Dibaca ---
      const wsArticles = workbook.addWorksheet('Top Naskah Dibaca');
      wsArticles.columns = [
        { header: 'Peringkat', key: 'rank', width: 12 },
        { header: 'ID EPrint', key: 'eprint_id', width: 14 },
        { header: 'Judul Naskah Karya Ilmiah', key: 'title', width: 50 },
        { header: 'Jumlah Pembacaan', key: 'view_count', width: 20 },
        { header: 'Jumlah Pembaca Unik', key: 'unique_readers', width: 22 },
      ];
      topArticles.forEach((art, idx) => {
        wsArticles.addRow({
          rank: idx + 1,
          eprint_id: art.eprint_id,
          title: art.article_title,
          view_count: art.view_count,
          unique_readers: art.unique_readers,
        });
      });
      styleSheet(wsArticles);

      // --- Sheet 3: Top Pemustaka ---
      const wsPatrons = workbook.addWorksheet('Top Pemustaka');
      wsPatrons.columns = [
        { header: 'Peringkat', key: 'rank', width: 12 },
        { header: 'NIM Pemustaka', key: 'nim', width: 16 },
        { header: 'Nama Pemustaka', key: 'name', width: 26 },
        { header: 'Fakultas / Program Studi', key: 'faculty', width: 34 },
        { header: 'Total Aksi', key: 'total_actions', width: 14 },
        { header: 'Naskah Dibaca', key: 'views', width: 16 },
        { header: 'Token Digunakan', key: 'tokens', width: 18 },
      ];
      topPatrons.forEach((p, idx) => {
        const prefix = (p.patron_nim || '').slice(0, 1).toUpperCase();
        const faculty = AnalyticsController.getFacultyName(prefix);
        wsPatrons.addRow({
          rank: idx + 1,
          nim: p.patron_nim,
          name: p.patron_name,
          faculty,
          total_actions: p.total_actions,
          views: p.document_views,
          tokens: p.tokens_used,
        });
      });
      styleSheet(wsPatrons);

      // --- Sheet 4: Distribusi Fakultas ---
      const wsFac = workbook.addWorksheet('Distribusi Fakultas');
      wsFac.columns = [
        { header: 'Kode NIM', key: 'prefix', width: 14 },
        { header: 'Fakultas / Unit Kerja', key: 'faculty', width: 36 },
        { header: 'Jumlah Pemustaka Unik', key: 'patron_count', width: 24 },
        { header: 'Total Aktivitas', key: 'activity_count', width: 18 },
      ];
      facultyDistributionRaw.forEach((f) => {
        wsFac.addRow({
          prefix: f.prefix,
          faculty: AnalyticsController.getFacultyName(f.prefix),
          patron_count: f.patron_count,
          activity_count: f.activity_count,
        });
      });
      styleSheet(wsFac);

      // --- Sheet 5: Log Riwayat Aktivitas ---
      const wsLogs = workbook.addWorksheet('Log Riwayat Aktivitas');
      wsLogs.columns = [
        { header: 'Waktu Akses', key: 'created_at', width: 22 },
        { header: 'NIM Pemustaka', key: 'nim', width: 16 },
        { header: 'Nama Pemustaka', key: 'name', width: 26 },
        { header: 'Tindakan / Aksi', key: 'action', width: 18 },
        { header: 'ID EPrint', key: 'eprint_id', width: 14 },
        { header: 'Judul Naskah / Detail', key: 'title', width: 40 },
        { header: 'Status Naskah', key: 'status', width: 16 },
        { header: 'IP Address', key: 'ip', width: 18 },
      ];
      logs.forEach((log) => {
        wsLogs.addRow({
          created_at: log.created_at,
          nim: log.patron_nim,
          name: log.patron_name,
          action: log.action,
          eprint_id: log.eprint_id || '-',
          title: log.article_title || '-',
          status: log.eprint_status || '-',
          ip: log.ip_address,
        });
      });
      styleSheet(wsLogs);

      const buffer = await workbook.xlsx.writeBuffer();
      const cleanLabel = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
      const filename = `Laporan_Penggunaan_EPrints_${cleanLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error('[Export Analytics Excel Error]:', err);
      res.status(500).json({
        error: {
          code: 'EXPORT_FAILED',
          message: 'Gagal mengekspor laporan penggunaan ke format Excel.',
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
