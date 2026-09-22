# Panduan Deployment & Maintenance Runbook (IT Operasional)

> **UPT Perpustakaan dan Layanan Digital**  
> Universitas Muhammadiyah Surakarta (UMS)

Dokumen ini memuat panduan lengkap instalasi, konfigurasi berkas `.env`, prosedur pemeliharaan berkala, strategi pencadangan (backup) database, dan penanganan insiden (troubleshooting) untuk tim IT dan Sysadmin.

---

## 1. Prasyarat Sistem & Port

| Kebutuhan | Spesifikasi Minimum | Rekomendasi Production |
|---|---|---|
| **Sistem Operasi** | Linux Ubuntu 22.04 LTS / Debian 12 / Windows Server | Ubuntu 24.04 LTS / Rocky Linux 9 |
| **CPU & RAM** | 2 Core CPU, 2 GB RAM | 4 Core CPU, 4–8 GB RAM |
| **Penyimpanan** | 20 GB SSD | 50+ GB SSD (Tergantung volume log & snapshot) |
| **Engine** | Docker 24+ & Docker Compose v2 | Docker Engine + Systemd Service |
| **Port Akses** | Port `3000` (Frontend), Port `5000` (Backend API) | Reverse Proxy Nginx Port `80` & `443` (SSL) |

---

## 2. Kamus Konfigurasi Environment (`.env`)

Salin berkas `.env.example` menjadi `.env` di root project:
```bash
cp .env.example .env
```

### Rincian Variabel Konfigurasi:

```ini
# ==========================================
# 1. KONFIGURASI SERVER APLIKASI
# ==========================================
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://unpublish.ums.ac.id:3000

# ==========================================
# 2. DATABASE APLIKASI LOKAL (SQLite)
# ==========================================
APP_DB_PATH=./data/app.db
# Kunci rahasia untuk enkripsi token JWT & session sign
JWT_SECRET=ums_unpublish_secret_key_change_in_production_2026

# ==========================================
# 3. KONEKSI REPOSITORI EPRINTS UMS (READ-ONLY)
# ==========================================
# Mode: LIVE_MYSQL (Terkoneksi ke database EPrints asli) atau MOCK (Data dummy lokal untuk testing)
EPRINTS_DB_MODE=LIVE_MYSQL
EPRINTS_DB_HOST=172.29.0.50
EPRINTS_DB_PORT=3306
EPRINTS_DB_USER=eprints_readonly
EPRINTS_DB_PASS=password_readonly_anda
EPRINTS_DB_NAME=etd2018

# Direktori fisik mount file PDF EPrints di server
EPRINTS_DOCUMENTS_PATH=/var/eprints3/archives/etd2018/documents

# ==========================================
# 4. AUTENTIKASI CENTRAL AUTHENTICATION SERVICE (CAS SSO 2.0)
# ==========================================
CAS_SSO_BASE_URL=https://auth.ums.ac.id/cas
CAS_SSO_LOGIN_PATH=/login
CAS_SSO_VALIDATE_PATH=/serviceValidate
CAS_SSO_SERVICE_URL=http://unpublish.ums.ac.id:5000/api/v1/auth/sso/callback

# ==========================================
# 5. KEBIJAKAN DEFAULT TIKET TOKEN
# ==========================================
DEFAULT_TOKEN_DURATION_MINUTES=60
MAX_TOKEN_DURATION_MINUTES=240
```

---

## 3. Langkah Deployment via Docker (Rekomendasi)

Aplikasi telah dikemas dalam arsitektur multi-stage container:

### A. Menjalankan Aplikasi
```bash
# 1. Masuk ke direktori proyek
cd /opt/unpublish-article

# 2. Build image frontend & backend
docker compose build

# 3. Jalankan container di background
docker compose up -d

# 4. Periksa status container
docker compose ps
```

### B. Memantau Log Container Secara Real-Time
```bash
# Pantau log backend
docker compose logs -f backend

# Pantau log frontend
docker compose logs -f frontend
```

### C. Me-restart atau Memperbarui Aplikasi
```bash
git pull origin main
docker compose build frontend backend
docker compose up -d
```

---

## 4. Prosedur Pemeliharaan & Backup Database

Database aplikasi lokal disimpan dalam berkas SQLite terisolasi: `backend/data/app.db`.

### A. Metode 1: Unduh Backup Otomatis via Panel Admin (Satu Klik)
1. Buka antarmuka Admin: `http://<host>:3000/admin`.
2. Buka tab **"Pemeliharaan & Backup DB"**.
3. Klik tombol **"Unduh Backup (.sqlite)"** untuk snapshot hot backup konsisten, atau klik **"Export JSON Dump"** untuk arsip data teks.

### B. Metode 2: Backup Manual / Cron Job Server (CLI)
Tambahkan cron job harian pada server Linux:
```bash
# Buka crontab
crontab -e

# Tambahkan baris backup setiap jam 02:00 pagi:
0 2 * * * cp /opt/unpublish-article/backend/data/app.db /backup/unpublish_db_$(date +\%Y\%m\%d).sqlite
```

### C. Prosedur Disaster Recovery (Pemulihan ke Server Baru)
Jika terjadi kegagalan server total:
1. Siapkan server baru dengan Docker terpasang.
2. Clone repository unpublish-article.
3. Salin file cadangan database Anda menjadi:
   ```bash
   cp /backup/unpublish_db_20260912.sqlite /opt/unpublish-article/backend/data/app.db
   ```
4. Jalankan `docker compose up -d`.
5. Seluruh riwayat tiket, konfigurasi whitelist IP, data staf admin, dan audit log akan langsung pulih seketika tanpa perlu menjalankan skrip migrasi.

### D. Optimasi Database (VACUUM & Defragmentasi)
Setelah jutaan baris log audit dicatat, lakukan defragmentasi memori berkas SQLite:
* Melalui panel Admin: Klik tombol **"Jalankan VACUUM & Defrag Sekarang"**.
* Atau melalui CLI:
  ```bash
  sqlite3 /opt/unpublish-article/backend/data/app.db "VACUUM; PRAGMA optimize;"
  ```

---

## 5. Manajemen Akun Super Admin Darurat

Jika seluruh password admin hilang atau Anda baru saja melakukan deployment fresh di server baru:

### Membuat / Reset Akun Super Admin via SQLite CLI:
```bash
sqlite3 /opt/unpublish-article/backend/data/app.db

-- Tambahkan atau jadikan admin@ums.ac.id sebagai SUPER_ADMIN:
INSERT INTO admin_users (name, email, role, is_active, created_at) 
VALUES ('Super Admin Perpustakaan', 'admin@ums.ac.id', 'SUPER_ADMIN', 1, CURRENT_TIMESTAMP)
ON CONFLICT(email) DO UPDATE SET role = 'SUPER_ADMIN', is_active = 1;

.exit
```

---

## 6. Troubleshooting & Solusi Insiden

### Kasus 1: "Koneksi ke Database EPrints Gagal / Offline"
* **Gejala**: Header DbStatusPill berwarna oranye (Mock Mode) atau merah (MySQL Putus).
* **Solusi**:
  1. Periksa apakah server backend dapat me-reach IP MySQL EPrints: `ping 172.29.0.50` dan `nc -zv 172.29.0.50 3306`.
  2. Pastikan user MySQL memiliki hak `GRANT SELECT ON etd2018.* TO 'eprints_readonly'@'%'`.
  3. Cek log error backend: `docker compose logs --tail=50 backend`.

### Kasus 2: "Pemustaka Salah Ketik Format Token (Misal: SS0 - JM896)"
* **Solusi**:
  * Sistem kini telah dilengkapi **Smart Normalizer & Auto-Correction**: Spasi berlebih dan angka `0` pada awalan `SS0-` otomatis dibersihkan oleh backend dan frontend sebelum diproses.

### Kasus 3: "Akses Ditolak di Luar Jaringan Kampus UMS"
* **Gejala**: Pemustaka di jaringan gedung baru UMS mendadak terdeteksi *"Di Luar Jaringan UMS"*.
* **Solusi**:
  1. Buka Tab **Pengaturan Keamanan & Kebijakan Jaringan**.
  2. Tambahkan subnet gedung baru pada input **Daftar Subnet Whitelist** (misal: `10.45.0.0/16`).
  3. Klik **Simpan Perubahan Kebijakan** (Langsung berlaku seketika tanpa perlu me-restart server).
