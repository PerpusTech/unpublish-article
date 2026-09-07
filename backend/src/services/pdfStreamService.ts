import http from 'http';
import https from 'https';
import { Response, Request } from 'express';
import { ENV } from '../config/env';
import { createSimplePdfBuffer } from '../utils/pdfGenerator';
import { EPrintItem, DocumentItem, mysqlPool } from '../config/eprintsDb';

export class PdfStreamService {
  /**
   * Directly pipes authentic PDF document from EPrints repository server to client response.
   * Zero disk storage usage: operates entirely in memory / streaming network pipe.
   */
  public static async pipeDocumentStream(
    article: EPrintItem,
    docId: number,
    req: Request,
    res: Response
  ): Promise<void> {
    const eprintId = article.eprintid;
    const doc = article.documents?.find((d: DocumentItem) => d.docid === docId) || article.documents?.[0];

    if (!doc) {
      this.sendFallbackPdf(article, eprintId, res, 'Dokumen tidak terdaftar pada naskah ini.');
      return;
    }

    let filename = doc.main || doc.filename;
    let pos = doc.pos;

    // Look up pos & main from MySQL if missing
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

    if (!filename) {
      this.sendFallbackPdf(article, eprintId, res, 'Nama berkas naskah tidak ditemukan.');
      return;
    }

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

    // Forward Range header if patron's viewer requested partial chunks
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const pipeFromUrl = async (url: string, redirectCount = 0): Promise<boolean> => {
      if (redirectCount > 3) return false;
      return new Promise<boolean>((resolve) => {
        try {
          const client = url.startsWith('https') ? https : http;
          const eprintsReq = client.get(
            url,
            {
              headers,
              rejectUnauthorized: false,
              timeout: 15000,
            },
            (eprintsRes: http.IncomingMessage) => {
              if (eprintsRes.statusCode === 301 || eprintsRes.statusCode === 302) {
                const redirectUrl = eprintsRes.headers.location;
                if (redirectUrl) {
                  const nextUrl = redirectUrl.startsWith('http')
                    ? redirectUrl
                    : `${ENV.EPRINTS_BASE_URL}${redirectUrl}`;
                  eprintsRes.resume();
                  return resolve(pipeFromUrl(nextUrl, redirectCount + 1));
                }
              }

              if (eprintsRes.statusCode === 200 || eprintsRes.statusCode === 206) {
                const cType = eprintsRes.headers['content-type'] || '';
                if (cType.includes('pdf') || cType.includes('octet-stream') || !cType) {
                  // Set HTTP response status (200 OK or 206 Partial Content)
                  res.status(eprintsRes.statusCode);

                  // Security & Protected Streaming Headers
                  res.setHeader('Content-Type', 'application/pdf');
                  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename || 'document.pdf')}"`);
                  res.setHeader('X-Content-Type-Options', 'nosniff');
                  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
                  res.setHeader('Pragma', 'no-cache');
                  res.setHeader('Expires', '0');
                  res.setHeader('Accept-Ranges', 'bytes');

                  if (eprintsRes.headers['content-range']) {
                    res.setHeader('Content-Range', eprintsRes.headers['content-range']);
                  }
                  if (eprintsRes.headers['content-length']) {
                    res.setHeader('Content-Length', eprintsRes.headers['content-length']);
                  }

                  // Zero-disk on-the-fly streaming pipe
                  eprintsRes.pipe(res);

                  eprintsRes.on('end', () => {
                    resolve(true);
                  });
                  eprintsRes.on('error', (err) => {
                    console.warn(`[PdfStreamService] Stream error while piping ${url}:`, err.message);
                    resolve(false);
                  });
                  return;
                }
              }

              if (eprintsRes.statusCode === 401) {
                console.warn(`[PdfStreamService] EPrints server requires authorization for ${url}`);
              } else {
                console.warn(`[PdfStreamService] EPrints responded ${eprintsRes.statusCode} for ${url}`);
              }
              eprintsRes.resume();
              resolve(false);
            }
          );

          eprintsReq.on('timeout', () => {
            eprintsReq.destroy();
            resolve(false);
          });
          eprintsReq.on('error', (err) => {
            console.warn(`[PdfStreamService] Connection error fetching ${url}:`, err.message);
            resolve(false);
          });
        } catch (e: any) {
          console.warn(`[PdfStreamService] Exception connecting to ${url}:`, e.message);
          resolve(false);
        }
      });
    };

    for (const url of urls) {
      const success = await pipeFromUrl(url);
      if (success) return;
    }

    // Fallback: If authentic document could not be retrieved from EPrints live server
    this.sendFallbackPdf(
      article,
      eprintId,
      res,
      'Berkas fisik tidak dapat dijangkau di server arsip EPrints saat ini.'
    );
  }

  /**
   * Streams an institutional notice PDF created in-memory (Zero Disk Write)
   */
  private static sendFallbackPdf(
    article: EPrintItem | null,
    eprintId: number,
    res: Response,
    reason: string
  ): void {
    const title = article ? article.title : `Artikel Repositori #${eprintId}`;
    const author = article && article.creators.length > 0 ? article.creators.join(', ') : 'Peneliti UMS';
    const year = article ? article.date_year.toString() : '2025';
    const statusNote = `DIBATASI: ${reason}`;

    const pdfBuffer = createSimplePdfBuffer(title, author, year, statusNote);

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="notice.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.send(pdfBuffer);
  }
}
