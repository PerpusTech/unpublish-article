import { Request, Response } from 'express';
import { EPrintsService } from '../services/eprintsService';
import { PdfStreamService } from '../services/pdfStreamService';
import { AuditService } from '../services/auditService';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

function getHeader(header: string | string[] | undefined): string {
  if (Array.isArray(header)) return header[0] || '';
  return header || '';
}

export class ArticleController {
  /**
   * Search and list catalog articles
   */
  public static async listArticles(req: Request, res: Response): Promise<void> {
    const q = req.query.q as string;
    const status = (req.query.status as any) || 'ALL';
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const division = req.query.division as string;
    const type = req.query.type as string;
    const subject = req.query.subject as string;
    const author = req.query.author as string;
    const id_number = req.query.id_number as string;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    try {
      const result = await EPrintsService.searchArticles({
        q,
        status,
        year,
        division,
        type,
        subject,
        author,
        id_number,
        page,
        limit
      });

      // If there's an active patron and search query, log the search
      if (req.patron && q && q.trim().length > 0) {
        const ip = getHeader(req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
        AuditService.logAction({
          tokenId: req.patron.id,
          patronNim: req.patron.patron_nim,
          patronName: req.patron.patron_name,
          action: 'SEARCH',
          articleTitle: `Pencarian: "${q.trim()}"`,
          ipAddress: ip,
          userAgent: getHeader(req.headers['user-agent']) || 'Unknown'
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal memuat daftar artikel.'
        }
      });
    }
  }

  /**
   * Browse repository items by category (year, subject, division, type, author)
   */
  public static async browseCategory(req: Request, res: Response): Promise<void> {
    const category = req.params.category as 'year' | 'subject' | 'division' | 'type' | 'author';
    const q = req.query.q as string;

    const validCategories = ['year', 'subject', 'division', 'type', 'author'];
    if (!validCategories.includes(category)) {
      res.status(400).json({
        error: {
          code: 'INVALID_CATEGORY',
          message: `Kategori penjelajahan tidak valid. Pilihan: ${validCategories.join(', ')}`
        }
      });
      return;
    }

    try {
      const result = await EPrintsService.browseCategory(category, q);
      res.json(result);
    } catch (err: any) {
      console.error('[ArticleController] Browse error:', err);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal memuat kategori penjelajahan.'
        }
      });
    }
  }

  /**
   * Get article details by ID
   */
  public static async getArticle(req: Request, res: Response): Promise<void> {
    const id = parseInt(getParam(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: { code: 'INVALID_ID', message: 'ID artikel harus berupa angka.' } });
      return;
    }

    try {
      const article = await EPrintsService.getArticleById(id);
      if (!article) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Artikel tidak ditemukan di repositori.' } });
        return;
      }

      // Record Audit Log for metadata viewing
      if (req.patron) {
        const ip = getHeader(req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
        AuditService.logAction({
          tokenId: req.patron.id,
          patronNim: req.patron.patron_nim,
          patronName: req.patron.patron_name,
          action: 'VIEW_METADATA',
          eprintId: article.eprintid,
          articleTitle: article.title,
          eprintStatus: article.eprint_status,
          ipAddress: ip,
          userAgent: getHeader(req.headers['user-agent']) || 'Unknown'
        });
      }

      res.json({ article });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Gagal memuat detail artikel.'
        }
      });
    }
  }

  /**
   * Stream protected PDF document
   */
  public static async streamDocument(req: Request, res: Response): Promise<void> {
    const id = parseInt(getParam(req.params.id), 10);
    const docId = parseInt(getParam(req.params.docId), 10);

    if (isNaN(id) || isNaN(docId)) {
      res.status(400).json({ error: { code: 'INVALID_PARAMS', message: 'ID artikel dan dokumen tidak valid.' } });
      return;
    }

    try {
      const article = await EPrintsService.getArticleById(id);
      if (!article) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Artikel tidak ditemukan.' } });
        return;
      }

      // Record Audit Log for PDF Reading
      if (req.patron) {
        const ip = getHeader(req.headers['x-forwarded-for']) || req.socket.remoteAddress || '127.0.0.1';
        AuditService.logAction({
          tokenId: req.patron.id,
          patronNim: req.patron.patron_nim,
          patronName: req.patron.patron_name,
          action: 'VIEW_PDF',
          eprintId: article.eprintid,
          articleTitle: article.title,
          eprintStatus: article.eprint_status,
          ipAddress: ip,
          userAgent: getHeader(req.headers['user-agent']) || 'Unknown'
        });
      }

      await PdfStreamService.pipeDocumentStream(article, docId, req, res);
    } catch (err: any) {
      console.error('[ArticleController] Stream error:', err);
      res.status(500).json({
        error: {
          code: 'STREAM_ERROR',
          message: 'Gagal menyalurkan dokumen PDF.'
        }
      });
    }
  }
}
