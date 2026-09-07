# Design Doc — EPrints Unpublish Viewer Perpustakaan UMS

## 1. Tech Stack

| Layer | Pilihan | Alasan Singkat |
|---|---|---|
| **Frontend** | React 19 + Vite + Vanilla CSS / Modern Glassmorphism Design System | Performa render tinggi, kendali penuh atas PDF canvas manipulation, bebas dependensi CSS yang berat, tampilan estetik dan modern. |
| **Backend** | Node.js + TypeScript (Express / Fastify) | Ekosistem streaming file yang tangguh, penanganan concurrency cepat, aman, dan integrasi mudah dengan OAuth Google. |
| **Database Aplikasi** | SQLite (Production bisa beralih ke PostgreSQL via Knex/Prisma) | Terisolasi dari DB EPrints, ringan, zero-config untuk tahap awal, tanpa overhead server database tambahan. |
| **Database Repositori** | MySQL / MariaDB (Driver `mysql2` Read-Only Pool) | Terhubung langsung ke database EPrints UMS hanya dengan hak akses `SELECT`. |
| **PDF Rendering & Security** | PDF.js (Mozilla) + HTML5 Canvas Watermark Overlay | Merender PDF di sisi klien tanpa plugin browser bawaan, memungkinkan pelapisan watermark dinamis dan penonaktifan tombol simpan/cetak browser. |
| **Autentikasi Admin** | Google OAuth 2.0 (Domain restricted: `@ums.ac.id`) | Memanfaatkan akun Google Workspace resmi pustakawan UMS tanpa repot mengelola reset password manual. |
| **Autentikasi Pemustaka** | Token-based Session (Signed HttpOnly Cookie + Device Fingerprint) | Aman dari serangan XSS/CSRF, mengunci sesi ke 1 browser fisik pemustaka. |

---

## 2. Skema Database Aplikasi Lokal

```sql
-- 1. Tabel Token Sesi Pemustaka
CREATE TABLE tokens (
    id TEXT PRIMARY KEY,                       -- UUID v4
    token_code TEXT UNIQUE NOT NULL,           -- Kode singkat alfanumerik (misal: "UMS-7B9X2K")
    patron_name TEXT NOT NULL,                 -- Nama lengkap pemustaka
    patron_nim TEXT NOT NULL,                  -- NIM / NIP pemustaka
    duration_minutes INTEGER NOT NULL,         -- Durasi yang diberikan (60, 120, 180, dst)
    status TEXT NOT NULL DEFAULT 'PENDING',    -- PENDING | ACTIVE | EXPIRED | EXPIRED_UNCLAIMED | REVOKED
    device_fingerprint TEXT,                   -- Hash (IP + User-Agent + Client UUID)
    created_by_admin TEXT NOT NULL,            -- Email admin pembuat
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at DATETIME,                       -- Waktu pertama kali diaktivasi di browser pemustaka
    expires_at DATETIME,                       -- Waktu kedaluwarsa sesi (claimed_at + duration_minutes)
    extended_minutes INTEGER DEFAULT 0,        -- Total perpanjangan waktu
    notes TEXT
);

CREATE INDEX idx_tokens_code ON tokens(token_code);
CREATE INDEX idx_tokens_status ON tokens(status);
CREATE INDEX idx_tokens_expires_at ON tokens(expires_at);

-- 2. Tabel Audit Log Aktivitas Pemustaka
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,                       -- UUID v4
    token_id TEXT NOT NULL,                    -- Relasi ke tabel tokens
    patron_nim TEXT NOT NULL,
    patron_name TEXT NOT NULL,
    action TEXT NOT NULL,                      -- ACTIVATE_TOKEN | SEARCH | VIEW_METADATA | VIEW_PDF | SESSION_EXPIRED
    eprint_id INTEGER,                         -- ID artikel EPrints yang diakses (jika ada)
    article_title TEXT,                        -- Judul artikel saat diakses (snapshot)
    eprint_status TEXT,                        -- Status artikel saat itu: 'archive' | 'buffer' | 'inbox'
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_logs_token ON audit_logs(token_id);
CREATE INDEX idx_audit_logs_nim ON audit_logs(patron_nim);
CREATE INDEX idx_audit_logs_eprint ON audit_logs(eprint_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 3. Tabel Riwayat Admin Pustakawan
CREATE TABLE admin_users (
    email TEXT PRIMARY KEY,                    -- Email @ums.ac.id
    name TEXT NOT NULL,
    picture_url TEXT,
    role TEXT NOT NULL DEFAULT 'LIBRARIAN',     -- LIBRARIAN | SUPER_ADMIN
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Konsistensi Data & Operasi Kritis

| Operasi | Tabel Terlibat | Perlu Lock / Transaksi? | Alasan & Pencegahan |
|---|---|---|---|
| **Aktivasi Token Pertama Kali** | `tokens`, `audit_logs` | Ya (Atomic DB Transaction) | Mencegah token yang sama diklaim di dua browser sekaligus (*race condition*). Status dicek dan diubah ke `ACTIVE` secara atomik dengan mengikat `device_fingerprint`. |
| **Perpanjangan Durasi Sesi** | `tokens`, `audit_logs` | Ya (Atomic DB Transaction) | Menambah `duration_minutes` dan menggeser `expires_at = expires_at + interval`. Status yang tadinya `EXPIRED` bisa dikembalikan ke `ACTIVE` jika diperpanjang seketika oleh admin. |
| **Streaming PDF & Log Audit** | `tokens` (Read), `audit_logs` (Insert) | Tidak perlu row lock | Pengecekan token membaca status real-time; logging dilakukan asinkron agar tidak memperlambat pembukaan awal berkas PDF. |

---

## 4. API Contract

Base URL: `/api/v1`

### 4.1. Auth & Admin Endpoints

| Method | Endpoint | Auth | Request Body | Response Success | Kasus Error |
|---|---|---|---|---|---|
| `GET` | `/auth/google` | Publik | - | Redirect ke Google OAuth Login | 500 jika config invalid |
| `GET` | `/auth/google/callback`| Publik | Query `code` | Redirect ke Dashboard Admin + Set Cookie JWT | 403 jika email bukan `@ums.ac.id` |
| `POST` | `/admin/tokens` | Admin (JWT) | `{ patron_name, patron_nim, duration_minutes, notes }` | `{ success: true, token: { code, qr_svg, expires_claim } }` | 400 jika data tidak lengkap |
| `GET` | `/admin/tokens/active` | Admin (JWT) | Query filter status, limit | `{ tokens: [...] }` | 401 jika session admin habis |
| `POST` | `/admin/tokens/:id/extend`| Admin (JWT) | `{ additional_minutes: 30 }` | `{ success: true, new_expires_at }` | 404 jika token tidak ada |
| `POST` | `/admin/tokens/:id/revoke`| Admin (JWT) | `{ reason }` | `{ success: true }` | 404 jika token tidak ada |
| `GET` | `/admin/audit-logs` | Admin (JWT) | Query `search, nim, start_date, end_date` | `{ logs: [...], total }` | 401 jika unauthorized |
| `GET` | `/admin/audit-logs/export` | Admin (JWT) | Query filter | Stream CSV File attachment | 401 jika unauthorized |

### 4.2. Patron Endpoints

| Method | Endpoint | Auth | Request Body | Response Success | Kasus Error |
|---|---|---|---|---|---|
| `POST` | `/patron/session/claim` | Publik | `{ token_code, client_uuid }` | `{ success: true, session: { patron_name, patron_nim, expires_at, remaining_seconds } }` | 400 invalid code, 403 device mismatch / expired |
| `GET` | `/patron/session/status`| Patron Cookie | - | `{ is_active: true, remaining_seconds: 3420 }` | 401 jika expired / revoked |
| `GET` | `/articles` | Patron Cookie | Query `q, status, year, page, limit` | `{ data: [...], pagination: {...} }` | 401 sesi habis |
| `GET` | `/articles/:id` | Patron Cookie | - | `{ article: { title, creators, abstract, year, status, documents: [...] } }` | 404 not found, 401 expired |
| `GET` | `/articles/:id/documents/:docId/view` | Patron Cookie | - | HTTP 200 Stream Binary PDF (`Content-Type: application/pdf`) | 401 sesi habis, 404 file hilang |

---

## 5. Arsitektur Frontend

```
frontend/
├── src/
│   ├── assets/              # Logo UMS, ilustrasi
│   ├── components/
│   │   ├── common/          # Navbar, Footer, Modal, StatusBadge, CountdownTimer
│   │   ├── patron/          # TokenEntryForm, ArticleCard, SearchFilterBar, DocumentViewerModal
│   │   ├── pdf/             # PDFCanvasViewer, WatermarkLayer, CustomControls
│   │   └── admin/           # TokenGeneratorModal, ActiveSessionTable, AuditLogTable, QRCodeDisplay
│   ├── hooks/
│   │   ├── useSessionTimer.ts     # Menghitung mundur detik, sync berkala dengan server
│   │   ├── useArticleSearch.ts    # Debounced search katalog
│   │   └── usePDFViewer.ts        # Render halaman PDF via PDF.js & inject watermark
│   ├── pages/
│   │   ├── PatronHome.tsx         # Halaman pencarian & katalog pemustaka
│   │   ├── PatronActivate.tsx     # Layar aktivasi token & scan QR
│   │   ├── AdminLogin.tsx         # Pintu masuk login Google SSO UMS
│   │   ├── AdminDashboard.tsx     # Manajemen token & live monitor sesi
│   │   └── AdminAuditLogs.tsx     # Pelaporan dan log audit
│   ├── services/
│   │   └── api.ts                 # Axios / Fetch client dengan error handling
│   ├── styles/
│   │   └── index.css              # Design system: variabel warna UMS, tipografi, glassmorphism
│   ├── App.tsx
│   └── main.tsx
```

---

## 6. Arsitektur Backend

```
backend/
├── src/
│   ├── config/
│   │   ├── appConfig.ts           # Env vars, port, paths
│   │   ├── appDb.ts               # Koneksi SQLite / Knex instance
│   │   └── eprintsDb.ts           # Read-Only MySQL pool connection
│   ├── controllers/
│   │   ├── authController.ts      # Google OAuth2 login & callback
│   │   ├── tokenController.ts     # Create, Claim, Extend, Revoke token
│   │   ├── articleController.ts   # Search & detail artikel dari EPrints
│   │   ├── documentController.ts  # Stream PDF file dari mounted path
│   │   └── auditController.ts     # Query log aktivitas & export CSV
│   ├── middlewares/
│   │   ├── requireAdminAuth.ts    # Validasi session pustakawan UMS
│   │   ├── requirePatronSession.ts# Validasi token aktif & sisa waktu > 0
│   │   └── errorHandler.ts
│   ├── services/
│   │   ├── tokenService.ts        # Logic generate kode unik & expiry
│   │   ├── eprintsService.ts      # Query SQL aman ke tabel eprint EPrints
│   │   ├── pdfStreamService.ts    # Resolusi path file PDF dan range stream
│   │   └── auditService.ts        # Logging asinkron
│   ├── utils/
│   │   ├── tokenGenerator.ts      # Pembuat string token ramah baca
│   │   └── fingerprint.ts         # Hashing device fingerprint
│   └── index.ts                   # Entry point Express / Fastify
```

---

## 7. Keputusan Teknis & Alasan

| Keputusan | Alasan |
|---|---|
| **Canvas Overlay Watermark (Client) + Stream Terproteksi** | Memberikan performa terbaik tanpa membebani CPU server untuk meng-edit setiap halaman PDF setiap kali diminta pemustaka, sembari tetap menjaga identitas pemustaka tercetak jelas di atas bacaan. |
| **Koneksi Read-Only Terpisah ke EPrints** | Menjamin 100% database utama repositori UMS tidak terancam korupsi data atau ketidaksengajaan modifikasi dari aplikasi pihak ketiga. |
| **Google Workspace SSO UMS** | Tidak memerlukan pembuatan akun admin baru; otentikasi diserahkan ke infrastruktur kampus yang sudah terstandarisasi. |
| **SQLite Default untuk App DB** | Pemasangan sangat cepat, tidak memerlukan setup server database tambahan untuk data token dan log jika server perpustakaan terpisah dari server utama. |

---

## 8. Yang SENGAJA Tidak Dipakai (Dan Kenapa)

- **Tidak Menggunakan Microservices**: Skala aplikasi adalah internal perpustakaan; monolith modular jauh lebih mudah di-deploy, di-debug, dan dioperasikan oleh tim infrastruktur perpustakaan UMS.
- **Tidak Mengubah Database EPrints**: Sama sekali tidak menambahkan tabel atau kolom ke database EPrints resmi untuk mencegah kendala saat EPrints versi baru di-update oleh tim repositori.
- **Tidak Mengizinkan Direct Download Link**: Mencegah file PDF karya unpublish tersimpan di harddisk pribadi pemustaka tanpa izin.
