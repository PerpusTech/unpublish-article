# EPrints Unpublish Article Viewer — UPT Perpustakaan UMS

> **Sistem Repositori & Pembaca Naskah Terproteksi (Unpublish / Embargo)**  
> UPT Perpustakaan dan Layanan Digital — Universitas Muhammadiyah Surakarta

Sistem web terintegrasi untuk membaca, mengontrol, dan melindungi akses karya ilmiah berstatus *Unpublish* / *Restricted* pada repositori EPrints UMS dengan paradigma **Zero Direct Storage Access**, **Dynamic Forensic Watermarking**, **Lock Device Fingerprinting**, dan **Multi-Tab Session Synchronization**.

---

## 🚀 Quick Start (Menjalankan Aplikasi)

Pastikan **Docker & Docker Compose** sudah terpasang pada komputer / server Anda:

```bash
# 1. Clone repository & masuk ke direktori
cd unpublish-article

# 2. Salin konfigurasi environment
cp .env.example .env

# 3. Jalankan container aplikasi
docker compose up -d --build
```

Setelah container berjalan:
* 🌐 **Katalog & Viewer Pemustaka**: [http://localhost:3000](http://localhost:3000)
* 🔐 **Meja Layanan & Panel Admin**: [http://localhost:3000/admin](http://localhost:3000/admin)
* ⚙️ **Backend REST API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)

---

## 📚 Pusat Dokumentasi Teknis (Documentation Suite)

Seluruh dokumentasi teknis sistem telah disusun rapi pada folder [`docs/`](./docs/):

```
docs/
├── ARCHITECTURE.md                # Diagram alur, model keamanan, & siklus hidup token
├── API_REFERENCE.md               # Dokumentasi lengkap seluruh endpoint REST API
├── FRONTEND_COMPONENTS.md         # Panduan UI Design System & Reusable Components
└── DEPLOYMENT_AND_MAINTENANCE.md  # Runbook operasional IT, backup DB SQLite, & troubleshooting
```

### 1. [Arsitektur & Keamanan Sistem (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
* Diagram arsitektur visual Mermaid (Client, Gateway, Backend, DB Lokal, DB EPrints).
* Paradigma *Zero Direct Storage Access* & *Dynamic Forensic Watermarking*.
* Isolasi database: Mengapa database EPrints murni disentuh secara **Read-Only**.
* Siklus hidup token membaca (`PENDING` ➔ `ACTIVE` ➔ `EXPIRED` / `REVOKED`).
* Sinkronisasi status sesi multi-tab secara instan (*Dual-Channel Sync*).

### 2. [Referensi REST API (`docs/API_REFERENCE.md`)](./docs/API_REFERENCE.md)
* Endpoint Pencarian & Katalog: Faceted Filter, Smart Search, dan PDF Secure Streaming.
* Endpoint Sesi & Token: Klaim token, status jaringan UMS, dan heartbeat telemetri baca.
* Endpoint Meja Layanan Admin: Penerbitan tiket single & massal (batch), perpanjangan waktu, dan pencabutan token.
* Endpoint Pemeliharaan Database & Keamanan: Backup snapshot SQLite, export JSON, VACUUM defrag, dan whitelist IP.

### 3. [Panduan UI Design System & Components (`docs/FRONTEND_COMPONENTS.md`)](./docs/FRONTEND_COMPONENTS.md)
* Standar token warna CSS (*Light Mode* & *Dark Mode*).
* Panduan dan contoh penggunaan komponen reusable dasar:
  * `<Button>` (Varian, ukuran, built-in loading spinner, icon slot)
  * `<Modal>` (Portal dialog, backdrop blur, escape key, body-scroll lock)
  * `<Badge>` & `<StatusPill>` (Dot indikator live, radar pulse animation)
  * `<FormInput>` & `<FormSelect>` (Label, error helper text, search-clearable)
  * `<Card>` & `<StatCard>` (Container modular, dashboard metric tile)
  * `<ToggleSwitch>` (Switch toggle modern dengan aksesibilitas keyboard)
* Tutorial membuat form dan view baru.

### 4. [Panduan Deployment & Maintenance Runbook (`docs/DEPLOYMENT_AND_MAINTENANCE.md`)](./docs/DEPLOYMENT_AND_MAINTENANCE.md)
* Spesifikasi minimum server & konfigurasi port.
* Kamus lengkap variabel konfigurasi `.env`.
* Prosedur pencadangan (backup) satu klik via admin & cron job server.
* Prosedur Disaster Recovery (pemulihan database ke server baru).
* Pemulihan darurat akun Super Admin via SQLite CLI.
* Panduan troubleshooting insiden umum.

---

## 🛠️ Tech Stack & Teknologi yang Digunakan

* **Frontend**: React 18, TypeScript, Vite, PDF.js Canvas Engine, Vanilla CSS Design System (Light & Dark Theme).
* **Backend**: Node.js 22 LTS, Express.js, TypeScript.
* **Database**:
  * **Database Lokal**: SQLite 3 (`better-sqlite3`) dengan Journal Mode WAL (*Write-Ahead Logging*).
  * **Database Repositori EPrints**: MySQL / MariaDB (*Read-Only Adapter*).
* **Autentikasi & Keamanan**: Central Authentication Service (CAS SSO 2.0 `auth.ums.ac.id`), JWT Token, Device Fingerprinting.
* **Containerization**: Docker & Docker Compose (Multi-stage build dengan Nginx Alpine).

---

## 👥 Pengembang & Pemelihara

* **Institusi**: UPT Perpustakaan dan Layanan Digital, Universitas Muhammadiyah Surakarta.
* **Lisensi**: Hak Cipta dilindungi undang-undang — Khusus Penggunaan Internal Perpustakaan UMS.
