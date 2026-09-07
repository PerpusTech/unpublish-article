import fs from 'fs';
import path from 'path';

/**
 * Creates a valid, well-structured minimal PDF file for testing
 */
export function createSimplePdf(filePath: string, title: string, author: string, nimOrYear: string, note: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Sanitize text for PDF stream
  const safeTitle = title.replace(/[()\\]/g, '');
  const safeAuthor = author.replace(/[()\\]/g, '');
  const safeNote = note.replace(/[()\\]/g, '');

  const streamContent = [
    'BT',
    '/F1 20 Tf 50 730 Td (PERPUSTAKAAN UNIVERSITAS MUHAMMADIYAH SURAKARTA) Tj',
    '/F1 12 Tf 0 -25 Td (Jl. A. Yani, Pabelan, Kartasura, Sukoharjo, Jawa Tengah 57162) Tj',
    '0 -10 Td (_____________________________________________________________________) Tj',
    '/F1 14 Tf 0 -45 Td (DOKUMEN REPOSITORI INTERNAL E-PRINTS) Tj',
    '/F1 12 Tf 0 -35 Td (Judul Karya: ) Tj',
    '/F1 11 Tf 0 -20 Td (' + safeTitle.substring(0, 75) + ') Tj',
    safeTitle.length > 75 ? '0 -15 Td (' + safeTitle.substring(75, 150) + ') Tj' : '',
    '/F1 12 Tf 0 -35 Td (Penulis / Peneliti: ) Tj',
    '/F1 11 Tf 0 -20 Td (' + safeAuthor + ') Tj',
    '/F1 12 Tf 0 -35 Td (Tahun / Identifikasi: ' + nimOrYear + ') Tj',
    '/F1 10 Tf 0 -45 Td (Status Dokumen:) Tj',
    '/F1 11 Tf 0 -18 Td (' + safeNote + ') Tj',
    '/F1 9 Tf 0 -60 Td (PEMBERITAHUAN KEAMANAN PERPUSTAKAAN UMS:) Tj',
    '/F1 9 Tf 0 -15 Td (Dokumen ini disajikan khusus untuk pembacaan terbatas di lingkungan Perpustakaan UMS.) Tj',
    '/F1 9 Tf 0 -15 Td (Dilarang memperbanyak, mendistribusikan, atau menyalin tanpa izin tertulis dari penulis.) Tj',
    'ET'
  ].filter(Boolean).join('\n');

  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  const pdf = [
    '%PDF-1.4',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    'endobj',
    '4 0 obj',
    `<< /Length ${streamLength} >>`,
    'stream',
    streamContent,
    'endstream',
    'endobj',
    '5 0 obj',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    'endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000058 00000 n ',
    '0000000115 00000 n ',
    '0000000228 00000 n ',
    `0000000${(300 + streamLength).toString().padStart(3, '0')} 00000 n `,
    'trailer',
    '<< /Size 6 /Root 1 0 R >>',
    'startxref',
    `${400 + streamLength}`,
    '%%EOF'
  ].join('\n');

  fs.writeFileSync(filePath, pdf, 'utf-8');
}
