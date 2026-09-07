import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { Response, Request } from 'express';
import { ENV } from '../config/env';
import { EPrintsService } from './eprintsService';
import { createSimplePdf } from '../utils/pdfGenerator';
import { DocumentItem } from '../config/eprintsDb';

import { mysqlPool } from '../config/eprintsDb';

export class PdfStreamService {
  /**
   * Downloads authentic PDF document directly from live EPrints repository server
   */
  private static async fetchFromEPrintsServer(
    eprintId: number,
    doc: DocumentItem | undefined,
    targetFile: string
  ): Promise<boolean> {
    if (!doc) return false;
    let filename = doc.main || doc.filename;
    let pos = doc.pos;

    // If pos or main is missing, query live MySQL table document
    if ((!pos || !filename) && mysqlPool && doc.docid) {
      try {
        const [rows]: any = await mysqlPool.query(
          'SELECT pos, main FROM document WHERE docid = ? LIMIT 1',
          [doc.docid]
        );
        if (rows && rows.length > 0) {
          if (rows[0].pos) pos = rows[0].pos;
          if (rows[0].main) filename = rows[0].main;
        }
      } catch (dbErr) {
        console.warn('[PdfStreamService] Error looking up doc pos:', dbErr);
      }
    }

    if (!filename) return false;
    const effectivePos = pos || 1;

    const urls = [
      `${ENV.EPRINTS_BASE_URL}/${eprintId}/${effectivePos}/${encodeURIComponent(filename)}`,
      `${ENV.EPRINTS_BASE_URL}/${eprintId}/${effectivePos}/${filename}`,
      `http://10.12.0.6/${eprintId}/${effectivePos}/${encodeURIComponent(filename)}`,
      `https://eprints.ums.ac.id/${eprintId}/${effectivePos}/${encodeURIComponent(filename)}`,
    ];

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UMS-Unpublish-Proxy/1.0',
    };

    if (ENV.EPRINTS_HTTP_USER && ENV.EPRINTS_HTTP_PASSWORD) {
      const auth = `${ENV.EPRINTS_HTTP_USER}:${ENV.EPRINTS_HTTP_PASSWORD}`;
      headers['Authorization'] = 'Basic ' + Buffer.from(auth).toString('base64');
    }

    const downloadUrl = async (url: string, redirectCount = 0): Promise<boolean> => {
      if (redirectCount > 3) return false;
      return new Promise<boolean>((resolve) => {
        try {
          const client = url.startsWith('https') ? https : http;
          const req = client.get(
            url,
            {
              headers,
              rejectUnauthorized: false,
              timeout: 15000,
            },
            (res) => {
              if (res.statusCode === 301 || res.statusCode === 302) {
                const redirectUrl = res.headers.location;
                if (redirectUrl) {
                  const nextUrl = redirectUrl.startsWith('http')
                    ? redirectUrl
                    : `${ENV.EPRINTS_BASE_URL}${redirectUrl}`;
                  res.resume();
                  return resolve(downloadUrl(nextUrl, redirectCount + 1));
                }
              }

              if (res.statusCode === 200) {
                const cType = res.headers['content-type'] || '';
                if (cType.includes('pdf') || cType.includes('octet-stream') || !cType) {
                  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
                  const fileStream = fs.createWriteStream(targetFile);
                  res.pipe(fileStream);
                  fileStream.on('finish', () => {
                    fileStream.close();
                    const downloadedSize = fs.statSync(targetFile).size;
                    console.log(`[PdfStreamService] Successfully retrieved real PDF from EPrints: ${url} (${downloadedSize} bytes)`);
                    resolve(true);
                  });
                  fileStream.on('error', (err) => {
                    console.warn(`[PdfStreamService] Write error for ${targetFile}:`, err.message);
                    resolve(false);
                  });
                  return;
                }
              }

              if (res.statusCode === 401) {
                console.warn(`[PdfStreamService] EPrints server requires authentication (401) for ${url}. Configure EPRINTS_HTTP_USER & EPRINTS_HTTP_PASSWORD.`);
              } else {
                console.warn(`[PdfStreamService] EPrints server returned status ${res.statusCode} for ${url}`);
              }
              res.resume();
              resolve(false);
            }
          );

          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
          req.on('error', (err) => {
            console.warn(`[PdfStreamService] Network error fetching ${url}:`, err.message);
            resolve(false);
          });
        } catch (e: any) {
          console.warn(`[PdfStreamService] Exception fetching ${url}:`, e.message);
          resolve(false);
        }
      });
    };

    for (const url of urls) {
      const success = await downloadUrl(url);
      if (success) return true;
    }

    return false;
  }

  /**
   * Resolves physical document file path on disk, retrieving from EPrints or creating sample if missing
   */
  public static async resolveDocumentPath(eprintId: number, docId: number): Promise<string> {
    const article = await EPrintsService.getArticleById(eprintId);
    const doc = article?.documents?.find((d) => d.docid === docId) || article?.documents?.[0];

    const targetDir = path.join(ENV.EPRINTS_DOCUMENTS_PATH, eprintId.toString());
    const targetFile = path.join(targetDir, `doc_${docId}.pdf`);
    const namedFile = doc?.filename ? path.join(targetDir, doc.filename) : null;

    // 1. Check if already downloaded on disk (by docId or filename)
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 2000) {
      return targetFile;
    }
    if (namedFile && fs.existsSync(namedFile) && fs.statSync(namedFile).size > 2000) {
      return namedFile;
    }

    // 2. Attempt to fetch authentic full-text PDF directly from EPrints server
    const fetched = await this.fetchFromEPrintsServer(eprintId, doc, targetFile);
    if (fetched && fs.existsSync(targetFile) && fs.statSync(targetFile).size > 2000) {
      return targetFile;
    }

    // 3. Fallback: If authentic file cannot be fetched, inform pustakawan via generated institutional sheet
    if (!fs.existsSync(targetFile)) {
      const title = article ? article.title : `Artikel Repositori #${eprintId}`;
      const author = article && article.creators.length > 0 ? article.creators.join(', ') : 'Peneliti UMS';
      const year = article ? article.date_year.toString() : '2025';
      const statusNote = article && article.eprint_status !== 'archive'
        ? 'DIBATASI: Karya Ilmiah Belum Terbit (Akses Khusus Perpustakaan UMS)'
        : 'TERBIT: Repositori Publik UMS';

      createSimplePdf(targetFile, title, author, year, statusNote);
    }

    return targetFile;
  }

  /**
   * Streams PDF file with HTTP Range support and strict no-download headers
   */
  public static streamPdf(filePath: string, req: Request, res: Response): void {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (range) {
      // Parse Range header (e.g. "bytes=0-1024")
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  }
}
