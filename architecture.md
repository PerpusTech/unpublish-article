# Architecture — EPrints Unpublish Viewer Perpustakaan UMS

## 1. Diagram Arsitektur

```
[Browser Pemustaka]                    [Browser Admin / Pustakawan]
  (Katalog, Search,                        (Google SSO @ums.ac.id,
   PDF.js Canvas Viewer,                    Token Generator, QR Code,
   Dynamic Watermark, Timer)                Live Monitor, Audit Logs)
          │                                          │
          └───────────────────┬──────────────────────┘
                              ▼
                   [Reverse Proxy / Nginx]
                              │
                              ▼
            [Backend Service (Node.js / TypeScript)]
            ├── Auth & Session Middleware (Device Fingerprint)
            ├── Token & Session Service (Timer, QR, Extend)
            ├── EPrints Read-Only Repository Service
            ├── PDF Stream & Watermark Injection Controller
            └── Audit Trail Logger
                    │                      │
      ┌─────────────┴────────────┐         │ (Read-Only Mount)
      ▼                          ▼         ▼
[Local App DB]             [EPrints MySQL/MariaDB]   [EPrints Document Storage]
(SQLite/PostgreSQL:        (Read-Only: tabel eprint,  (/var/eprints3/.../documents)
 tokens, admin, logs)       eprint_authors, dsb)     (File PDF Skripsi/Artikel)
```

### Alur Request Utama
1. **Request Katalog & Pencarian**:
   - Pemustaka mengirim query pencarian dengan menyertakan session token.
   - Backend memverifikasi validitas token pemustaka (apakah aktif dan sisa waktu > 0).
   - Backend membaca data metadata artikel langsung dari database EPrints (`SELECT` read-only) dan memformat hasilnya (badge Publish vs Unpublish).
2. **Request Streaming PDF**:
   - Pemustaka meminta baca dokumen PDF (`/api/v1/articles/:id/documents/:docId/view`).
   - Middleware memverifikasi token dan masa berlaku sesi.
   - Backend melacak path file fisik di storage mount EPrints (`/archives/[id]/documents/...`).
   - Backend mencatat entri baru di tabel `audit_logs` (NIM, Nama, ID Artikel, Waktu).
   - Backend menyalurkan stream file PDF dengan proteksi HTTP header (`Content-Disposition: inline`, anti-caching, anti-iframe eksternal).
3. **Penyajian PDF di Frontend**:
   - Frontend me-render lembar PDF menggunakan kanvas PDF.js.
   - Lapisan kanvas atas menggambar teks watermark dinamis diagonal semi-transparan (`NIM - Nama - Token - Waktu`).
   - Menu klik kanan, shortcut keyboard print (`Ctrl+P`), dan simpan (`Ctrl+S`) dicegah di sisi klien.

---

## 2. Komponen & Alasan Pemisahan

| Komponen | Status & Arsitektur | Alasan Pemisahan / Keputusan |
|---|---|---|
| **Backend API (Node.js / TypeScript)** | Monolith Modular | Performa streaming file tinggi (*Node.js streams* & *buffers* sangat efisien untuk PDF), kemudahan pemeliharaan oleh tim IT kampus tanpa kompleksitas microservices. |
| **Frontend Web App (React / Vite)** | SPA / Terintegrasi | UI interaktif dengan timer countdown real-time, canvas rendering untuk watermark PDF, dan dasbor responsif untuk admin. |
| **Database Aplikasi Lokal (SQLite / PostgreSQL)** | Terpisah dari DB EPrints | **Sangat Kritis**: Menjaga integritas data EPrints UMS. Database EPrints murni disentuh secara *read-only*. Seluruh data operasional aplikasi baru (token, log audit, daftar admin) disimpan terisolasi di database lokal. |
| **Storage Dokumen EPrints** | Read-Only Mount (NFS / Local Bind) | Aplikasi membaca file dokumen asli langsung dari folder repositori tanpa perlu menduplikasi atau menyalin bergiga-giga file PDF ke disk baru. |

---

## 3. Data Sementara vs Permanen

- **Data Sementara (In-Memory / Sesi Cepat)**:
  - Cache metadata artikel populer / pencarian sering diulang (TTL 10–30 menit).
  - State countdown timer client-side (disinkronkan dengan timestamp expiry di server).
- **Data Permanen (Database Lokal)**:
  - `tokens`: Kode token, identitas pemustaka (NIM, Nama), waktu pembuatan, waktu aktivasi, durasi sesi, waktu kedaluwarsa, device fingerprint, status (`PENDING`, `ACTIVE`, `EXPIRED`, `REVOKED`).
  - `audit_logs`: ID token, NIM, Nama, eprint ID, judul artikel, aksi (`SEARCH`, `VIEW_METADATA`, `VIEW_PDF`), IP address, user-agent, timestamp.
  - `admin_users`: Daftar email pustakawan UMS yang berhak login (`@ums.ac.id`) beserta riwayat aktivitas admin.
- **Data Eksternal (EPrints Source)**:
  - Tabel EPrints: `eprint`, `eprint__rdata`, `document`, `eprint_creators_name`, dsb. Murni dibaca (*read-only*), tidak ada modifikasi.

---

## 4. Background Process

1. **Token Auto-Expire & Cleaner Job** (Interval: setiap 1 menit):
   - Mengecek token dengan status `ACTIVE` yang `expires_at <= NOW()`, mengubah statusnya menjadi `EXPIRED`.
   - Mengecek token dengan status `PENDING` yang dibuat > 24 jam lalu, mengubah statusnya menjadi `EXPIRED_UNCLAIMED`.
   - Sifat: Idempotent, aman dijalankan berkala.
2. **Audit Log Archiving Job** (Interval: Bulanan):
   - Mengarsipkan atau mengekspor log audit yang sudah berusia lebih dari 1 tahun jika diperlukan penghematan ruang penyimpanan.

---

## 5. Environment & Deployment Stages

| Stage | Lingkungan / Target | Catatan |
|---|---|---|
| **Local Dev** | Node.js + SQLite lokal + Mock DB EPrints | Pengujian fitur, UI, token lifecycle, dan watermarking PDF tanpa menyentuh server EPrints hidup. |
| **Staging** | Docker Container di server IT UMS | Terhubung ke database EPrints staging / snapshot data EPrints UMS. |
| **Production** | Server Intranet / Docker Perpustakaan UMS | Terkoneksi ke MySQL EPrints (Read-Only user) dan volume mount direktori dokumen EPrints. |

---

## 6. Konfigurasi & Secret

| Nama Environment Variable | Kategori | Penjelasan |
|---|---|---|
| `PORT` | Config | Port server backend (default: 3000 / 8000) |
| `NODE_ENV` | Config | `development` / `production` |
| `APP_DB_TYPE` | Config | `sqlite` atau `postgres` |
| `APP_DB_PATH` | Config | Path file database jika SQLite (`./data/app.db`) |
| `GOOGLE_CLIENT_ID` | Secret | Client ID OAuth2 Google Workspace UMS |
| `GOOGLE_CLIENT_SECRET` | Secret | Client Secret OAuth2 Google Workspace |
| `ALLOWED_ADMIN_DOMAINS` | Config | `ums.ac.id` |
| `EPRINTS_DB_HOST` | Config | Host database EPrints |
| `EPRINTS_DB_PORT` | Config | Port database EPrints (3306) |
| `EPRINTS_DB_NAME` | Config | Nama database EPrints |
| `EPRINTS_DB_USER` | Config | User MySQL EPrints khusus (hanya GRANT SELECT) |
| `EPRINTS_DB_PASSWORD` | Secret | Password user MySQL EPrints |
| `EPRINTS_DOCUMENTS_PATH` | Config | Path direktori berkas fisik EPrints (misal `/var/eprints3/.../documents`) |
| `SESSION_SECRET` | Secret | Kunci penandatanganan JWT / Session Cookie pemustaka & admin |

---

## 7. Testing Strategy Khusus

1. **Device Binding & Token Race Condition Test**:
   - Menguji bahwa token yang sama tidak dapat diaktivasi pada 2 browser berbeda secara simultan.
   - Menguji bahwa pemustaka tidak bisa memperpanjang sendiri masa sesi dengan manipulasi jam lokal di browser (validasi waktu wajib selalu dari server).
2. **Strict Expiry & PDF Stream Interception Test**:
   - Menguji bahwa request ke endpoint streaming PDF langsung merespons `403 Forbidden` begitu waktu token habis, meskipun browser pemustaka masih memegang tab PDF terbuka.
3. **Database Read-Only Isolation Test**:
   - Memastikan kredensial database EPrints yang dipasang di aplikasi ini tidak memiliki izin DDL/DML selain `SELECT`, sehingga mustahil terjadi kerusakan data pada EPrints repository.
4. **Watermarking Integrity Test**:
   - Memastikan seluruh lembar kanvas PDF ter-render dengan teks watermark yang memuat data pemustaka sesuai token yang aktif.
