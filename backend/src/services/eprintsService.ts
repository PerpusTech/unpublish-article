import { mysqlPool, MOCK_EPRINTS, EPrintItem, DocumentItem } from '../config/eprintsDb';

export interface SearchQuery {
  q?: string;
  status?: 'ALL' | 'UNPUBLISH' | 'PUBLISH';
  year?: number;
  page?: number;
  limit?: number;
}

export class EPrintsService {
  /**
   * Search repository catalog (both publish and unpublish)
   */
  public static async searchArticles(query: SearchQuery): Promise<{
    items: EPrintItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(50, query.limit || 10));

    // If using Mock or MySQL pool is not active
    if (!mysqlPool) {
      let filtered = [...MOCK_EPRINTS];

      // Filter by Status
      if (query.status === 'UNPUBLISH') {
        filtered = filtered.filter((i) => i.eprint_status !== 'archive');
      } else if (query.status === 'PUBLISH') {
        filtered = filtered.filter((i) => i.eprint_status === 'archive');
      }

      // Filter by Year
      if (query.year) {
        filtered = filtered.filter((i) => i.date_year === Number(query.year));
      }

      // Filter by Search Query
      if (query.q && query.q.trim().length > 0) {
        const terms = query.q.toLowerCase().trim().split(/\s+/);
        filtered = filtered.filter((item) => {
          const haystack = [
            item.title,
            item.abstract,
            item.creators.join(' '),
            item.department || '',
            item.eprintid.toString()
          ].join(' ').toLowerCase();

          return terms.every((term) => haystack.includes(term));
        });
      }

      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return {
        items: paginated,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    // LIVE MySQL EPrints Query (Read-Only)
    try {
      let whereClauses = ['1=1'];
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

      if (query.q) {
        whereClauses.push('(e.title LIKE ? OR e.abstract LIKE ?)');
        const term = `%${query.q.trim()}%`;
        params.push(term, term);
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
        `SELECT e.eprintid, e.title, e.abstract, e.date_year, e.type, e.eprint_status, e.department
         FROM eprint e
         WHERE ${whereSql}
         ORDER BY e.date_year DESC, e.eprintid DESC
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
        creators: creatorsMap.get(r.eprintid) || [],
        department: r.department || '',
        documents: (documentsMap && documentsMap.get(r.eprintid)) || []
      }));


      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
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
        `SELECT e.eprintid, e.title, e.abstract, e.date_year, e.type, e.eprint_status, e.department
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
}
