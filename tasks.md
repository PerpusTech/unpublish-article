# Tasks & Roadmap — EPrints Unpublish Viewer UPT Perpustakaan dan Layanan Digital UMS

Dokumen daftar tugas implementasi teknis berdasarkan [PRD](file:///d:/Code/unpublish-article/prd.md), [Architecture](file:///d:/Code/unpublish-article/architecture.md), dan [Design Doc](file:///d:/Code/unpublish-article/design.md).

---

## Phase 1: Project Setup & Core Infrastructure

- [x] **T-01: Inisialisasi Repositori Monorepo / Backend & Frontend**
  - Setup struktur folder (`backend/` dan `frontend/`).
  - Konfigurasi TypeScript, Express, React + Vite.
  - Setup script root `package.json` dan Docker Compose.
- [x] **T-02: Konfigurasi Database Aplikasi Lokal & Migration**
  - Setup SQLite lokal (`data/app.db`) terisolasi dari database EPrints.
  - Migrasi otomatis tabel: `tokens`, `audit_logs`, `admin_users`.
  - Seed admin pustakawan UMS (`pustakawan@ums.ac.id`).
- [x] **T-03: Koneksi Read-Only ke EPrints MySQL & Mock Data Adapter**
  - Setup koneksi `mysql2` read-only ke EPrints.
  - Mock repository adapter dengan 6 sampel artikel realistis UMS (skripsi TI, Farmasi, Kedokteran, Elektro, Kimia, Ekonomi).

---

## Phase 2: Token Management & Session Engine

- [x] **T-04: Token Generation & QR Code Service**
  - Endpoint `POST /api/v1/admin/tokens` (Input: NIM, Nama, durasi 60–240 menit).
  - Generator token alfanumerik ramah baca format `UMS-XXXXXX`.
  - Generator SVG / Data URL QR Code untuk aktivasi instan.
- [x] **T-05: Token Claim & Device Binding Middleware**
  - Endpoint `POST /api/v1/patron/session/claim`.
  - Ekstraksi device fingerprint (IP + User-Agent + client UUID).
  - Mulai countdown `expires_at = claimed_at + duration_minutes`.
  - Mengunci token hanya ke 1 perangkat pemustaka.
- [x] **T-06: Real-Time Session Status & Auto-Lock Middleware**
  - Endpoint `GET /api/v1/patron/session/status`.
  - Middleware `requirePatronSession`: menolak request jika `expires_at <= NOW()` atau status bukan `ACTIVE`.
  - Endpoint perpanjangan waktu `POST /api/v1/admin/tokens/:id/extend` (+30m, +1j).
  - Endpoint pembatalan `POST /api/v1/admin/tokens/:id/revoke`.

---

## Phase 3: EPrints Catalog & Protected PDF Streaming

- [x] **T-07: Service Query Katalog EPrints (Publish & Unpublish)**
  - Endpoint `GET /api/v1/articles` dengan filter judul, penulis, tahun, dan status (`eprint_status`).
  - Endpoint `GET /api/v1/articles/:id` untuk detail metadata lengkap & daftar berkas dokumen.
  - Mapping status EPrints (`archive` -> Terbit Publik, `buffer`/`inbox` -> Akses Terbatas Perpus).
- [x] **T-08: Protected PDF Stream Handler**
  - Endpoint `GET /api/v1/articles/:id/documents/:docId/view`.
  - Validasi sesi pemustaka aktif dan sisa waktu > 0.
  - Penentuan path file fisik EPrints di direktori storage ter-mount.
  - Streaming chunked HTTP range PDF dengan header anti-download (`Content-Disposition: inline`).
- [x] **T-09: Audit Trail Logger Service**
  - Otomatis mencatat setiap aksi `VIEW_PDF`, `VIEW_METADATA`, `SEARCH`, dan `ACTIVATE_TOKEN` ke tabel `audit_logs`.
  - Menyimpan snapshot judul artikel, NIM, nama, IP, dan timestamp.

---

## Phase 4: Frontend Patron Experience & PDF Watermarking

- [x] **T-10: Design System & Layout Utama (Academic, Clean, No AI Slop)**
  - Tipografi akademik yang bersih, kontras tinggi, palet Deep Institutional Navy UMS (`#0a2540`), Slate, dan Amber.
  - Header dengan floating dynamic countdown badge `JJ:MM:DD`.
  - Tanpa gradasi berlebihan / tanpa elemen AI slop yang tidak perlu.
- [x] **T-11: Layar Aktivasi Token & Scanner QR**
  - Input form token kode dengan auto-uppercase & formatting.
  - Tampilan sisa waktu dan informasi identitas pemustaka setelah aktivasi berhasil.
- [x] **T-12: Halaman Katalog & Pencarian Interaktif**
  - Search bar interaktif.
  - Filter pills (Semua Koleksi, Khusus Perpustakaan / Unpublish, Terbit Terbuka).
  - Card artikel dengan badge status kontras dan detail abstrak.
- [x] **T-13: PDF Canvas Viewer dengan Dynamic Watermark**
  - Viewer naskah streaming terlindungi.
  - Layer watermark diagonal semi-transparan `UPT Perpustakaan dan Layanan Digital UMS • [NIM] - [Nama] • Token: [Code] • [Tanggal]`.
  - Pencegahan klik kanan (*context menu*), shortcut keyboard print (`Ctrl+P`), save (`Ctrl+S`).

---

## Phase 5: Admin Panel & Google SSO

- [x] **T-14: Integrasi Google OAuth 2.0 (@ums.ac.id) & Dev Quick Login**
  - Dukungan Google OAuth untuk domain kampus `@ums.ac.id`.
  - Tombol Dev Quick-Login untuk kemudahan pengujian staf lokal.
- [x] **T-15: Dasbor Manajemen Token & Live Monitoring Sesi**
  - Form pembuatan token cepat dengan pilihan durasi (1–4 jam).
  - Slip voucher pemustaka lengkap dengan QR Code siap cetak / salin.
  - Tabel live session: menampilkan pemustaka aktif, sisa waktu hitung mundur, tombol "+30m", "+1j", dan tombol "Cabut (Revoke)".
- [x] **T-16: Halaman Audit Trail & Export CSV**
  - Filter log berdasarkan tanggal, NIM, atau judul artikel.
  - Fitur ekspor laporan pembacaan artikel ke file CSV siap unduh untuk arsip perpustakaan.

---

## Phase 6: Verifikasi & Deployment

- [x] **T-17: End-to-End Testing & Security Audit**
  - Uji device locking (berhasil: perangkat kedua ditolak saat menggunakan token yang sama).
  - Uji validasi sesi dan proteksi PDF stream.
  - Uji logging otomatis ke SQLite.
- [x] **T-18: Dockerfile & Production Deployment**
  - `backend/Dockerfile` berbasis `node:22-slim` dengan healthcheck.
  - `frontend/Dockerfile` berbasis multi-stage Node 22 + Nginx Alpine.
  - `docker-compose.yml` dengan volume mount untuk database lokal dan berkas PDF EPrints.
