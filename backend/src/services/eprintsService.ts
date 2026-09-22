import fs from 'fs';
import { ENV } from '../config/env';
import { mysqlPool, MOCK_EPRINTS, EPrintItem, DocumentItem } from '../config/eprintsDb';

export interface EPrintsDbStatus {
  mode: 'LIVE_MYSQL' | 'MOCK';
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  latencyMs: number;
  totalArticles: number;
  unpublishArticles: number;
  publishArticles: number;
  documentsPath: string;
  documentsPathExists: boolean;
  lastChecked: string;
  statusMessage: string;
  error?: string;
}

export interface SearchQuery {
  q?: string;
  status?: 'ALL' | 'UNPUBLISH' | 'PUBLISH';
  year?: number;
  subject?: string;
  division?: string;
  type?: string;
  author?: string;
  id_number?: string;
  page?: number;
  limit?: number;
}

export interface BrowseItem {
  value: string;
  label: string;
  count: number;
}

export interface BrowseCategoryResult {
  category: 'year' | 'subject' | 'division' | 'type' | 'author';
  items: BrowseItem[];
}

export interface SearchSuggestions {
  nearestKeywords: string[];
  relatedDivisions: BrowseItem[];
  relatedSubjects: BrowseItem[];
  popularKeywords: string[];
}

export interface ArticleSearchResult {
  items: EPrintItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  suggestions?: SearchSuggestions;
}

export class EPrintsService {
  /**
   * Search repository catalog (both publish and unpublish)
   */
  public static async searchArticles(query: SearchQuery): Promise<ArticleSearchResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(50, query.limit || 10));

    // Helper for mock dataset filtering
    const filterMockDataset = (q: SearchQuery): EPrintItem[] => {
      let filtered = [...MOCK_EPRINTS].filter(
        (i) => i.title && i.title.trim().length > 0 && i.title.trim().toLowerCase() !== 'tanpa judul'
      );

      // Filter by Status
      if (q.status === 'UNPUBLISH') {
        filtered = filtered.filter((i) => i.eprint_status !== 'archive');
      } else if (q.status === 'PUBLISH') {
        filtered = filtered.filter((i) => i.eprint_status === 'archive');
      }

      // Filter by Year
      if (q.year) {
        filtered = filtered.filter((i) => i.date_year === Number(q.year));
      }

      // Filter by Division / Department
      if (q.division) {
        const divLower = q.division.toLowerCase().trim();
        filtered = filtered.filter((i) => (i.department || '').toLowerCase().includes(divLower));
      }

      // Filter by Type
      if (q.type) {
        const typeLower = q.type.toLowerCase().trim();
        filtered = filtered.filter((i) => (i.type || '').toLowerCase() === typeLower);
      }

      // Filter by Subject (in mock, matches department/title/abstract)
      if (q.subject) {
        const subLower = q.subject.toLowerCase().trim();
        filtered = filtered.filter((i) =>
          (i.department || '').toLowerCase().includes(subLower) ||
          i.title.toLowerCase().includes(subLower) ||
          i.abstract.toLowerCase().includes(subLower)
        );
      }

      // Filter by Author / Creator
      if (q.author) {
        const authorLower = q.author.toLowerCase().trim();
        filtered = filtered.filter((i) =>
          i.creators.some((c) => c.toLowerCase().includes(authorLower))
        );
      }

      // Filter by ID Number / NIM
      if (q.id_number) {
        const term = q.id_number.toLowerCase().trim();
        filtered = filtered.filter((i) => (i.id_number || i.nim || '').toLowerCase().includes(term));
      }

      // Filter by Search Query
      if (q.q && q.q.trim().length > 0) {
        const terms = q.q.toLowerCase().trim().split(/\s+/);
        filtered = filtered.filter((item) => {
          const haystack = [
            item.title,
            item.abstract,
            item.creators.join(' '),
            item.department || '',
            item.id_number || '',
            item.nim || '',
            item.eprintid.toString()
          ].join(' ').toLowerCase();

          return terms.every((term) => haystack.includes(term));
        });
      }

      // Sort newest uploaded articles first (highest eprintid / newest upload)
      filtered.sort((a, b) => {
        if ((b.date_year || 0) !== (a.date_year || 0)) {
          return (b.date_year || 0) - (a.date_year || 0);
        }
        return b.eprintid - a.eprintid;
      });

      return filtered;
    };

    // If using Mock or MySQL pool is not active
    if (!mysqlPool) {
      const filtered = filterMockDataset(query);
      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);
      const suggestions = total === 0 ? await this.getSearchSuggestions(query) : undefined;

      return {
        items: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        suggestions,
      };
    }

    // LIVE MySQL EPrints Query (Read-Only)
    try {
      let whereClauses = [
        "e.title IS NOT NULL AND TRIM(e.title) != '' AND LOWER(TRIM(e.title)) != 'tanpa judul'"
      ];
      const params: any[] = [];

      if (query.status === 'UNPUBLISH') {
        whereClauses.push("e.eprint_status IN ('buffer', 'inbox')");
      } else if (query.status === 'PUBLISH') {
        whereClauses.push("e.eprint_status = 'archive'");
      }

      if (query.year) {
        whereClauses.push('e.date_year = ?');
        params.push(query.year);
      }

      if (query.division) {
        whereClauses.push('e.department = ?');
        params.push(query.division);
      }

      if (query.type) {
        whereClauses.push('e.type = ?');
        params.push(query.type);
      }

      if (query.subject) {
        whereClauses.push('e.eprintid IN (SELECT eprintid FROM eprint_subjects WHERE subjects = ?)');
        params.push(query.subject);
      }

      if (query.author) {
        const authorClean = query.author.trim().toLowerCase();
        const term = `%${authorClean}%`;
        whereClauses.push(`e.eprintid IN (
          SELECT eprintid FROM eprint_creators_name 
          WHERE LOWER(creators_name_family) LIKE ? 
             OR LOWER(creators_name_given) LIKE ?
             OR LOWER(CONCAT(IFNULL(creators_name_family, ''), ', ', IFNULL(creators_name_given, ''))) LIKE ?
             OR LOWER(CONCAT(IFNULL(creators_name_given, ''), ' ', IFNULL(creators_name_family, ''))) LIKE ?
        )`);
        params.push(term, term, term, term);
      }

      if (query.id_number) {
        const idClean = query.id_number.trim().toLowerCase();
        const term = `%${idClean}%`;
        whereClauses.push('(LOWER(e.id_number) LIKE ? OR LOWER(e.nim) LIKE ?)');
        params.push(term, term);
      }

      if (query.q) {
        const cleanQ = query.q.trim().toLowerCase();
        const term = `%${cleanQ}%`;
        whereClauses.push(`(
          LOWER(e.title) LIKE ? 
          OR LOWER(e.abstract) LIKE ? 
          OR LOWER(e.id_number) LIKE ? 
          OR LOWER(e.nim) LIKE ?
          OR e.eprintid IN (
            SELECT eprintid FROM eprint_creators_name 
            WHERE LOWER(creators_name_family) LIKE ? 
               OR LOWER(creators_name_given) LIKE ?
               OR LOWER(CONCAT(IFNULL(creators_name_family, ''), ', ', IFNULL(creators_name_given, ''))) LIKE ?
               OR LOWER(CONCAT(IFNULL(creators_name_given, ''), ' ', IFNULL(creators_name_family, ''))) LIKE ?
          )
        )`);
        params.push(term, term, term, term, term, term, term, term);
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count
      const [countResult]: any = await mysqlPool.query(
        `SELECT COUNT(*) as total FROM eprint e WHERE ${whereSql}`,
        params
      );
      const total = countResult[0]?.total || 0;

      // Paginated items
      const offset = (page - 1) * limit;
      const [rows]: any = await mysqlPool.query(
        `SELECT e.eprintid, e.title, e.abstract, e.date_year, e.type, e.eprint_status, e.department, e.id_number, e.nim, e.nidn
         FROM eprint e
         WHERE ${whereSql}
         ORDER BY e.eprintid DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      // Fetch creators for the returned eprintids in a single batch query
      const eprintIds = rows.map((r: any) => r.eprintid);
      const creatorsMap = new Map<number, string[]>();

      if (eprintIds.length > 0) {
        try {
          const [creatorRows]: any = await mysqlPool.query(
            `SELECT eprintid, creators_name_given, creators_name_family 
             FROM eprint_creators_name 
             WHERE eprintid IN (?) 
             ORDER BY pos ASC`,
            [eprintIds]
          );

          for (const c of creatorRows) {
            const name = [c.creators_name_given, c.creators_name_family].filter(Boolean).join(' ').trim();
            if (name) {
              if (!creatorsMap.has(c.eprintid)) creatorsMap.set(c.eprintid, []);
              creatorsMap.get(c.eprintid)!.push(name);
            }
          }
        } catch (creatorErr) {
          console.warn('[EPrintsService] Error fetching creators, continuing without:', creatorErr);
        }

        // Batch load digital documents for all eprints on this page
        var documentsMap = new Map<number, DocumentItem[]>();
        try {
          const [docRows]: any = await mysqlPool.query(
            `SELECT d.docid, d.eprintid, d.pos, d.format, d.security, d.main, f.filesize, f.filename 
             FROM document d 
             LEFT JOIN file f ON f.datasetid = 'document' AND f.objectid = d.docid 
             WHERE d.eprintid IN (?) 
               AND d.format NOT IN ('indexcodes', 'image/jpeg', 'image/png')
             ORDER BY d.docid ASC`,
            [eprintIds]
          );

          for (const d of docRows || []) {
            if (!documentsMap.has(d.eprintid)) documentsMap.set(d.eprintid, []);
            documentsMap.get(d.eprintid)!.push({
              docid: d.docid,
              pos: d.pos,
              main: d.main,
              filename: d.filename || d.main || `Naskah_${d.eprintid}_doc_${d.docid}.pdf`,
              filesize: d.filesize || 1048576,
              format: d.format || 'application/pdf',
              security: d.security || 'staffonly'
            });
          }
        } catch (docErr) {
          console.warn('[EPrintsService] Error batch loading documents:', docErr);
        }
      }

      // Map rows with live creators and documents
      const items: EPrintItem[] = rows.map((r: any) => ({
        eprintid: r.eprintid,
        title: r.title || 'Tanpa Judul',
        abstract: r.abstract || '',
        date_year: r.date_year || 0,
        type: r.type || 'article',
        eprint_status: r.eprint_status,
        id_number: r.id_number || r.nim || undefined,
        nim: r.nim || undefined,
        nidn: r.nidn || undefined,
        creators: creatorsMap.get(r.eprintid) || [],
        department: r.department || '',
        documents: (documentsMap && documentsMap.get(r.eprintid)) || []
      }));


      const suggestions = total === 0 ? await this.getSearchSuggestions(query) : undefined;

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        suggestions,
      };
    } catch (err) {
      console.error('[EPrintsService] Error querying live MySQL, falling back to mock dataset:', err);
      // Direct mock fallback (no recursion)
      let filtered = [...MOCK_EPRINTS];
      if (query.status === 'UNPUBLISH') {
        filtered = filtered.filter((i) => i.eprint_status !== 'archive');
      } else if (query.status === 'PUBLISH') {
        filtered = filtered.filter((i) => i.eprint_status === 'archive');
      }
      return {
        items: filtered.slice(0, limit),
        total: filtered.length,
        page: 1,
        limit,
        totalPages: 1,
        suggestions: filtered.length === 0 ? await this.getSearchSuggestions(query) : undefined,
      };
    }
  }

  /**
   * Get single article details with attached documents
   */
  public static async getArticleById(eprintId: number): Promise<EPrintItem | null> {
    if (!mysqlPool) {
      const item = MOCK_EPRINTS.find((i) => i.eprintid === eprintId);
      return item || null;
    }

    try {
      const [rows]: any = await mysqlPool.query(
        `SELECT e.eprintid, e.title, e.abstract, e.date_year, e.type, e.eprint_status, e.department, e.id_number, e.nim, e.nidn
         FROM eprint e WHERE e.eprintid = ?`,
        [eprintId]
      );

      if (!rows || rows.length === 0) return null;
      const r = rows[0];

      // Get creators
      let creators: string[] = [];
      try {
        const [cRows]: any = await mysqlPool.query(
          `SELECT creators_name_given, creators_name_family 
           FROM eprint_creators_name 
           WHERE eprintid = ? 
           ORDER BY pos ASC`,
          [eprintId]
        );
        creators = (cRows || []).map((c: any) =>
          [c.creators_name_given, c.creators_name_family].filter(Boolean).join(' ').trim()
        ).filter(Boolean);
      } catch (cErr) {
        console.warn('[EPrintsService] Could not load creators for ID:', eprintId);
      }

      // Get documents with accurate filename and file size
      let [docRows]: any = await mysqlPool.query(
        `SELECT d.docid, d.eprintid, d.pos, d.format, d.security, d.main, f.filesize, f.filename 
         FROM document d 
         LEFT JOIN file f ON f.datasetid = 'document' AND f.objectid = d.docid 
         WHERE d.eprintid = ? 
           AND d.format NOT IN ('indexcodes', 'image/jpeg', 'image/png')
         ORDER BY (CASE WHEN d.format = 'application/pdf' OR d.main LIKE '%.pdf' THEN 0 ELSE 1 END), d.docid ASC`,
        [eprintId]
      );

      // Fallback if strict filter yielded no results
      if (!docRows || docRows.length === 0) {
        const [anyDocs]: any = await mysqlPool.query(
          `SELECT d.docid, d.eprintid, d.pos, d.format, d.security, d.main, f.filesize, f.filename 
           FROM document d 
           LEFT JOIN file f ON f.datasetid = 'document' AND f.objectid = d.docid 
           WHERE d.eprintid = ? AND d.format != 'indexcodes'`,
          [eprintId]
        );
        docRows = anyDocs;
      }

      return {
        eprintid: r.eprintid,
        title: r.title,
        abstract: r.abstract,
        date_year: r.date_year,
        type: r.type,
        eprint_status: r.eprint_status,
        id_number: r.id_number || r.nim || undefined,
        nim: r.nim || undefined,
        nidn: r.nidn || undefined,
        creators,
        department: r.department,
        documents: (docRows || []).map((d: any) => ({
          docid: d.docid,
          pos: d.pos,
          main: d.main,
          filename: d.filename || d.main || `Naskah_${eprintId}_Doc_${d.docid}.pdf`,
          filesize: d.filesize || 1048576,
          format: d.format || 'application/pdf',
          security: d.security || 'staffonly'
        }))
      };
    } catch (err) {
      console.error('[EPrintsService] Error in getArticleById:', err);
      return MOCK_EPRINTS.find((i) => i.eprintid === eprintId) || null;
    }
  }

  /**
   * Browse repository items by category: year, subject, division, type, author
   */
  private static browseCache = new Map<string, { data: BrowseCategoryResult; timestamp: number }>();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  public static async browseCategory(
    category: 'year' | 'subject' | 'division' | 'type' | 'author',
    searchQuery?: string
  ): Promise<BrowseCategoryResult> {
    const cacheKey = `${category}:${(searchQuery || '').trim().toLowerCase()}`;
    const cached = this.browseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    if (!mysqlPool) {
      // Mock fallback
      const items = this.getMockBrowseItems(category, searchQuery);
      const result: BrowseCategoryResult = { category, items };
      return result;
    }

    try {
      let items: BrowseItem[] = [];

      switch (category) {
        case 'year': {
          const [rows]: any = await mysqlPool.query(
            `SELECT date_year as value, CAST(date_year AS CHAR) as label, COUNT(*) as count 
             FROM eprint 
             WHERE date_year IS NOT NULL 
               AND date_year >= 1990 
               AND date_year <= YEAR(CURDATE()) + 1
               AND title IS NOT NULL AND TRIM(title) != '' AND LOWER(TRIM(title)) != 'tanpa judul'
             GROUP BY date_year 
             ORDER BY date_year DESC`
          );
          items = (rows || []).map((r: any) => ({
            value: String(r.value),
            label: String(r.label),
            count: Number(r.count)
          }));
          break;
        }

        case 'division': {
          let sql = `SELECT department as value, department as label, COUNT(*) as count 
                     FROM eprint 
                     WHERE department IS NOT NULL AND TRIM(department) != ''
                       AND title IS NOT NULL AND TRIM(title) != '' AND LOWER(TRIM(title)) != 'tanpa judul'`;
          const params: any[] = [];
          if (searchQuery && searchQuery.trim()) {
            sql += ` AND department LIKE ?`;
            params.push(`%${searchQuery.trim()}%`);
          }
          sql += ` GROUP BY department ORDER BY count DESC LIMIT 100`;

          const [rows]: any = await mysqlPool.query(sql, params);
          items = (rows || []).map((r: any) => ({
            value: String(r.value),
            label: String(r.label),
            count: Number(r.count)
          }));
          break;
        }

        case 'type': {
          const [rows]: any = await mysqlPool.query(
            `SELECT type as value, type as label, COUNT(*) as count 
             FROM eprint 
             WHERE type IS NOT NULL AND TRIM(type) != '' 
               AND title IS NOT NULL AND TRIM(title) != '' AND LOWER(TRIM(title)) != 'tanpa judul'
             GROUP BY type 
             ORDER BY count DESC`
          );

          const TYPE_LABELS: Record<string, string> = {
            thesis: 'Thesis / Skripsi / Tesis / Disertasi',
            article: 'Article / Jurnal',
            conference_item: 'Conference Item / Prosiding',
            book: 'Book / Buku',
            book_section: 'Book Section / Bagian Buku',
            patent: 'Patent / Hak Paten',
            monograph: 'Monograph / Monograf',
            other: 'Other / Lainnya',
            teaching_resource: 'Teaching Resource',
            video: 'Video / Multimedia',
            audio: 'Audio',
            image: 'Image / Gambar',
            experiment: 'Experiment / Data Penelitian',
            composition: 'Composition / Karya Musik',
            exhibition: 'Exhibition / Pameran'
          };

          items = (rows || []).map((r: any) => ({
            value: String(r.value),
            label: TYPE_LABELS[r.value] || String(r.label),
            count: Number(r.count)
          }));
          break;
        }

        case 'subject': {
          let sql = `SELECT s.subjects as value, sn.name_name as label, COUNT(*) as count 
                     FROM eprint_subjects s 
                     JOIN subject_name_name sn ON s.subjects = sn.subjectid
                     JOIN eprint e ON s.eprintid = e.eprintid
                     WHERE e.title IS NOT NULL AND TRIM(e.title) != '' AND LOWER(TRIM(e.title)) != 'tanpa judul'`;
          const params: any[] = [];
          if (searchQuery && searchQuery.trim()) {
            sql += ` AND (LOWER(sn.name_name) LIKE ? OR LOWER(s.subjects) LIKE ?)`;
            const term = `%${searchQuery.trim().toLowerCase()}%`;
            params.push(term, term);
          }
          sql += ` GROUP BY s.subjects, sn.name_name ORDER BY count DESC LIMIT 150`;

          const [rows]: any = await mysqlPool.query(sql, params);
          items = (rows || []).map((r: any) => ({
            value: String(r.value),
            label: `${r.value} - ${r.label}`,
            count: Number(r.count)
          }));
          break;
        }

        case 'author': {
          let sql = '';
          const params: any[] = [];

          if (searchQuery && searchQuery.trim()) {
            sql = `SELECT TRIM(CONCAT(IFNULL(c.creators_name_family, ''), ', ', IFNULL(c.creators_name_given, ''))) as label,
                          TRIM(CONCAT(IFNULL(c.creators_name_family, ''), ', ', IFNULL(c.creators_name_given, ''))) as value,
                          COUNT(DISTINCT c.eprintid) as count 
                   FROM eprint_creators_name c
                   JOIN eprint e ON c.eprintid = e.eprintid
                   WHERE e.title IS NOT NULL AND TRIM(e.title) != '' AND LOWER(TRIM(e.title)) != 'tanpa judul'
                     AND (LOWER(c.creators_name_family) LIKE ? 
                          OR LOWER(c.creators_name_given) LIKE ?
                          OR e.eprintid IN (SELECT e2.eprintid FROM eprint e2 WHERE LOWER(e2.id_number) LIKE ? OR LOWER(e2.nim) LIKE ?))
                   GROUP BY c.creators_name_family, c.creators_name_given 
                   ORDER BY count DESC 
                   LIMIT 100`;
            const term = `%${searchQuery.trim().toLowerCase()}%`;
            params.push(term, term, term, term);
          } else {
            sql = `SELECT TRIM(CONCAT(IFNULL(c.creators_name_family, ''), ', ', IFNULL(c.creators_name_given, ''))) as label,
                          TRIM(CONCAT(IFNULL(c.creators_name_family, ''), ', ', IFNULL(c.creators_name_given, ''))) as value,
                          COUNT(DISTINCT c.eprintid) as count 
                   FROM eprint_creators_name c
                   JOIN eprint e ON c.eprintid = e.eprintid
                   WHERE e.title IS NOT NULL AND TRIM(e.title) != '' AND LOWER(TRIM(e.title)) != 'tanpa judul'
                     AND (c.creators_name_family IS NOT NULL AND TRIM(c.creators_name_family) != '')
                   GROUP BY c.creators_name_family, c.creators_name_given 
                   HAVING count >= 5 
                   ORDER BY count DESC 
                   LIMIT 150`;
          }

          const [rows]: any = await mysqlPool.query(sql, params);
          items = (rows || [])
            .map((r: any) => ({
              value: String(r.value),
              label: String(r.label),
              count: Number(r.count)
            }))
            .filter((item: BrowseItem) => item.label && item.label !== ',');
          break;
        }
      }

      const result: BrowseCategoryResult = { category, items };
      this.browseCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      console.error(`[EPrintsService] Error browsing category ${category}:`, err);
      return { category, items: [] };
    }
  }

  private static getMockBrowseItems(category: string, searchQuery?: string): BrowseItem[] {
    const counts = new Map<string, number>();
    const validEprints = MOCK_EPRINTS.filter(
      (i) => i.title && i.title.trim().length > 0 && i.title.trim().toLowerCase() !== 'tanpa judul'
    );
    for (const item of validEprints) {
      let key = '';
      if (category === 'year') key = String(item.date_year);
      else if (category === 'division') key = item.department || 'Umum';
      else if (category === 'type') key = item.type || 'thesis';
      else if (category === 'author') {
        for (const author of item.creators) {
          counts.set(author, (counts.get(author) || 0) + 1);
        }
        continue;
      }
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([value, count]) => ({
      value,
      label: value,
      count
    }));
  }

  /**
   * Diagnostic test & real-time connection status for EPrints database
   */
  public static async getConnectionStatus(): Promise<EPrintsDbStatus> {
    const isMock = !mysqlPool || ENV.EPRINTS_USE_MOCK;
    const documentsPath = ENV.EPRINTS_DOCUMENTS_PATH || '/eprints/documents';
    let documentsPathExists = false;
    try {
      documentsPathExists = fs.existsSync(documentsPath);
    } catch {
      documentsPathExists = false;
    }

    if (isMock || !mysqlPool) {
      const validArticles = MOCK_EPRINTS.filter(
        (i) => i.title && i.title.trim().length > 0 && i.title.trim().toLowerCase() !== 'tanpa judul'
      );
      const totalArticles = validArticles.length;
      const unpublishArticles = validArticles.filter((a) => a.eprint_status !== 'archive').length;
      const publishArticles = totalArticles - unpublishArticles;

      return {
        mode: 'MOCK',
        connected: true,
        host: ENV.EPRINTS_DB_HOST || 'local-mock',
        port: ENV.EPRINTS_DB_PORT || 3306,
        database: ENV.EPRINTS_DB_NAME || 'eprints_mock',
        user: ENV.EPRINTS_DB_USER || 'mock_user',
        latencyMs: 1,
        totalArticles,
        unpublishArticles,
        publishArticles,
        documentsPath,
        documentsPathExists,
        lastChecked: new Date().toISOString(),
        statusMessage: 'Menggunakan Mock Data Adapter (Lingkungan Pengembangan / Simulasi Lokal)',
      };
    }

    // Live MySQL Check
    const start = Date.now();
    try {
      await mysqlPool.query('SELECT 1 as ping');
      const latencyMs = Date.now() - start;

      const [counts]: any = await mysqlPool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN eprint_status IN ('buffer', 'inbox') THEN 1 ELSE 0 END) as unpublish,
          SUM(CASE WHEN eprint_status = 'archive' THEN 1 ELSE 0 END) as publish
        FROM eprint
        WHERE title IS NOT NULL AND TRIM(title) != '' AND LOWER(TRIM(title)) != 'tanpa judul'
      `);

      const totalArticles = Number(counts[0]?.total || 0);
      const unpublishArticles = Number(counts[0]?.unpublish || 0);
      const publishArticles = Number(counts[0]?.publish || 0);

      return {
        mode: 'LIVE_MYSQL',
        connected: true,
        host: ENV.EPRINTS_DB_HOST,
        port: ENV.EPRINTS_DB_PORT,
        database: ENV.EPRINTS_DB_NAME,
        user: ENV.EPRINTS_DB_USER,
        latencyMs,
        totalArticles,
        unpublishArticles,
        publishArticles,
        documentsPath,
        documentsPathExists,
        lastChecked: new Date().toISOString(),
        statusMessage: `Terhubung ke Live MySQL EPrints UMS (${ENV.EPRINTS_DB_NAME})`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        mode: 'LIVE_MYSQL',
        connected: false,
        host: ENV.EPRINTS_DB_HOST,
        port: ENV.EPRINTS_DB_PORT,
        database: ENV.EPRINTS_DB_NAME,
        user: ENV.EPRINTS_DB_USER,
        latencyMs,
        totalArticles: 0,
        unpublishArticles: 0,
        publishArticles: 0,
        documentsPath,
        documentsPathExists,
        lastChecked: new Date().toISOString(),
        statusMessage: 'Koneksi ke Live MySQL Terputus / Gagal',
        error: err.message || String(err),
      };
    }
  }

  /**
   * Calculate Smart Search Suggestions for empty search states:
   * 1. Nearest keywords based on Levenshtein distance and token similarity
   * 2. Related Divisions / Faculties
   * 3. Related Subjects
   * 4. Popular Academic Research Topics
   */
  private static POPULAR_KEYWORDS = [
    'Kecerdasan Buatan',
    'Machine Learning',
    'Perpustakaan Digital',
    'Sistem Informasi',
    'Teknik Informatika',
    'Hukum Pidana',
    'Manajemen Bisnis',
    'Pendidikan Karakter',
    'Farmasi Klinis',
    'Teknik Sipil',
    'Psikologi Pendidikan',
    'Kesehatan Masyarakat',
  ];

  public static async getSearchSuggestions(query: SearchQuery): Promise<SearchSuggestions> {
    const qRaw = (query.q || '').trim();
    const qLower = qRaw.toLowerCase();

    const nearestKeywords: string[] = [];
    if (qLower.length >= 2) {
      const candidateTerms = new Set<string>();
      this.POPULAR_KEYWORDS.forEach((kw) => {
        candidateTerms.add(kw);
        kw.split(/\s+/).forEach((w) => {
          if (w.length >= 3) candidateTerms.add(w);
        });
      });

      if (mysqlPool) {
        try {
          const [sampleRows]: any = await mysqlPool.query(
            `SELECT title, department FROM eprint WHERE title IS NOT NULL ORDER BY eprintid DESC LIMIT 250`
          );
          (sampleRows || []).forEach((r: any) => {
            if (r.title) {
              r.title.split(/[\s,.:;()\-–"—]+/).forEach((w: string) => {
                if (w.length >= 4) candidateTerms.add(w);
              });
            }
            if (r.department) candidateTerms.add(r.department);
          });
        } catch {
          // ignore error
        }
      }

      MOCK_EPRINTS.forEach((item) => {
        candidateTerms.add(item.title);
        item.title.split(/[\s,.:;()\-–"—]+/).forEach((w) => {
          if (w.length >= 4) candidateTerms.add(w);
        });
        if (item.department) candidateTerms.add(item.department);
        item.creators.forEach((c) => candidateTerms.add(c));
      });

      const levenshtein = (a: string, b: string): number => {
        const an = a.length;
        const bn = b.length;
        if (an === 0) return bn;
        if (bn === 0) return an;
        const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
        for (let j = 0; j <= an; j++) matrix[0][j] = j;
        for (let i = 1; i <= bn; i++) {
          for (let j = 1; j <= an; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[bn][an];
      };

      const scoredTerms: { term: string; score: number }[] = [];
      for (const term of candidateTerms) {
        const termLower = term.toLowerCase();
        if (termLower === qLower) continue;

        let score = 0;
        if (termLower.includes(qLower) || qLower.includes(termLower)) {
          score = 0.85;
        } else {
          const dist = levenshtein(qLower, termLower);
          const maxLen = Math.max(qLower.length, termLower.length);
          const sim = 1 - dist / maxLen;
          if (sim >= 0.55 && dist <= 3) {
            score = sim;
          }
        }

        if (score > 0.5) {
          scoredTerms.push({ term, score });
        }
      }

      scoredTerms.sort((a, b) => b.score - a.score);
      const uniqueSelected = new Set<string>();
      for (const item of scoredTerms) {
        const clean = item.term.trim();
        const lower = clean.toLowerCase();
        if (!uniqueSelected.has(lower) && lower !== qLower) {
          uniqueSelected.add(lower);
          nearestKeywords.push(clean);
          if (nearestKeywords.length >= 4) break;
        }
      }
    }

    // 2. Related Divisions
    const divisionResult = await this.browseCategory('division');
    let relatedDivisions = divisionResult.items;
    if (qLower) {
      const filtered = divisionResult.items.filter((d) =>
        d.label.toLowerCase().includes(qLower) || qLower.includes(d.label.toLowerCase())
      );
      if (filtered.length > 0) {
        relatedDivisions = filtered;
      }
    }
    relatedDivisions = relatedDivisions.slice(0, 4);

    // 3. Related Subjects
    const subjectResult = await this.browseCategory('subject');
    let relatedSubjects = subjectResult.items;
    if (qLower) {
      const filtered = subjectResult.items.filter((s) =>
        s.label.toLowerCase().includes(qLower) || qLower.includes(s.label.toLowerCase())
      );
      if (filtered.length > 0) {
        relatedSubjects = filtered;
      }
    }
    relatedSubjects = relatedSubjects.slice(0, 4);

    return {
      nearestKeywords,
      relatedDivisions,
      relatedSubjects,
      popularKeywords: this.POPULAR_KEYWORDS.slice(0, 6),
    };
  }
}

