# Referensi REST API — EPrints Unpublish Viewer

Dokumentasi ini menjelaskan seluruh endpoint REST API yang disediakan oleh Backend Service (`http://localhost:5000` / `/api/v1`).

---

## Standar Request & Response

### Format Base URL
```
http://<host>:<port>/api/v1
```

### Format Response Sukses
```json
{
  "success": true,
  "data": { ... },
  "message": "Operasi berhasil"
}
```

### Format Response Error
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Deskripsi pesan error yang ramah pengguna"
  }
}
```

### Autentikasi Admin
Endpoint di bawah `/api/v1/admin/*` memerlukan header HTTP:
```http
Authorization: Bearer <JWT_TOKEN_ADMIN>
```

---

## 1. Modul Pemustaka & Katalog Publik (Patron API)

### A. Pencarian Naskah (Faceted & Smart Search)
* **Endpoint**: `GET /api/v1/articles`
* **Query Parameters**:
  * `q` *(string)*: Kata kunci pencarian judul, abstrak, atau nama penulis.
  * `page` *(number, default: 1)*: Nomor halaman.
  * `limit` *(number, default: 12)*: Jumlah naskah per halaman.
  * `division` *(string)*: Filter fakultas / prodi.
  * `subject` *(string)*: Filter subjek keilmuan.
  * `type` *(string)*: Filter tipe (misal: `thesis`, `article`).
  * `year` *(string)*: Filter tahun terbit.
  * `author` *(string)*: Filter nama pengarang.
  * `access_status` *(string)*: `all` | `publish` | `unpublish`.
* **Response Contoh**:
```json
{
  "articles": [
    {
      "id": 14205,
      "title": "Analisis Pengaruh Good Corporate Governance terhadap Kinerja Keuangan Perbankan Syariah",
      "creators": ["Siti Rahmawati", "Drs. M. Wahyudi, M.Si."],
      "date": "2024",
      "division": "Fakultas Ekonomi dan Bisnis",
      "eprint_status": "archive",
      "is_unpublish": true,
      "documents": [
        {
          "docId": 45120,
          "format": "application/pdf",
          "security": "validuser",
          "filename": "NASKAH_PUBLIKASI_LENGKAP.pdf"
        }
      ]
    }
  ],
  "total": 450,
  "page": 1,
  "totalPages": 38
}
```

---

### B. Streaming Dokumen PDF Terproteksi
* **Endpoint**: `GET /api/v1/articles/:id/documents/:docId/view`
* **Header / Query**: `x-client-uuid` atau `?token=<token_id>`
* **Response**: Stream `application/pdf` dengan header HTTP:
  * `Content-Disposition: inline; filename="document.pdf"`
  * `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
  * `X-Content-Type-Options: nosniff`

---

### C. Aktivasi / Klaim Tiket Token
* **Endpoint**: `POST /api/v1/patron/session/claim`
* **Request Body**:
```json
{
  "tokenCode": "UMS-A7X9K2",
  "clientUuid": "device_fingerprint_hash"
}
```
* **Response**:
```json
{
  "success": true,
  "message": "Aktivasi berhasil! Selamat membaca.",
  "session": {
    "id": "s_9f3b2a",
    "tokenCode": "UMS-A7X9K2",
    "patronName": "Ahmad Fauzi",
    "patronNim": "L200200001",
    "durationMinutes": 60,
    "remainingSeconds": 3600,
    "expiresAt": "2026-09-12T10:00:00.000Z"
  }
}
```

---

### D. Pemeriksaan Status Jaringan Kampus UMS
* **Endpoint**: `GET /api/v1/patron/network-status`
* **Response**:
```json
{
  "clientIp": "10.20.4.15",
  "isInUmsNetwork": true,
  "accessMode": "HYBRID",
  "matchedRule": "10.0.0.0/8"
}
```

---

### E. Telemetri Detak Jantung Baca (Heartbeat)
* **Endpoint**: `POST /api/v1/patron/telemetry/heartbeat`
* **Request Body**:
```json
{
  "tokenId": "s_9f3b2a",
  "articleId": 14205,
  "docId": 45120,
  "pageNumber": 3,
  "secondsSpent": 30
}
```

---

## 2. Modul Meja Layanan Pustakawan (Token Management API)

### A. Terbitkan Tiket Token Baru
* **Endpoint**: `POST /api/v1/admin/tokens`
* **Request Body**:
```json
{
  "patronName": "Budi Santoso",
  "patronNim": "B100210045",
  "durationMinutes": 60,
  "notes": "Keperluan skripsi bab 4"
}
```

### B. Terbitkan Token Massal (Batch)
* **Endpoint**: `POST /api/v1/admin/tokens/batch`
* **Request Body**:
```json
{
  "count": 25,
  "durationMinutes": 120,
  "prefix": "KELAS_METOPEL",
  "notes": "Praktikum Metodologi Penelitian Kelas A"
}
```

### C. Perpanjang Durasi Token Aktif
* **Endpoint**: `POST /api/v1/admin/tokens/:id/extend`
* **Request Body**:
```json
{
  "additionalMinutes": 30
}
```

### D. Cabut / Batalkan Token
* **Endpoint**: `POST /api/v1/admin/tokens/:id/revoke`

---

## 3. Modul Pengaturan Keamanan & Database

### A. Ambil Konfigurasi Keamanan Jaringan
* **Endpoint**: `GET /api/v1/admin/security-settings`
* **Response**:
```json
{
  "settings": {
    "accessMode": "HYBRID",
    "umsIpWhitelist": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.1"],
    "updatedAt": "2026-09-12T05:00:00.000Z",
    "updatedBy": "admin@ums.ac.id"
  },
  "currentClientIp": "10.44.0.131",
  "isCurrentClientInUmsNetwork": true
}
```

### B. Simpan Konfigurasi Keamanan
* **Endpoint**: `PUT /api/v1/admin/security-settings`
* **Request Body**:
```json
{
  "accessMode": "HYBRID",
  "umsIpWhitelist": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "103.23.20.0/24"]
}
```

### C. Statistik Database SQLite
* **Endpoint**: `GET /api/v1/admin/database/stats`
* **Response**:
```json
{
  "success": true,
  "stats": {
    "sizeFormatted": "1.24 MB",
    "totalRecords": 1420,
    "integrity": "OK",
    "journalMode": "WAL",
    "pageCount": 310,
    "pageSize": 4096,
    "tables": {
      "tokens": 420,
      "audit_logs": 985,
      "admin_users": 15
    }
  }
}
```

### D. Unduh File Snapshot SQLite (.sqlite)
* **Endpoint**: `GET /api/v1/admin/database/backup`
* **Response**: Berkas biner `ums_unpublish_backup_<timestamp>.sqlite`

### E. Optimasi & Defrag Database (VACUUM)
* **Endpoint**: `POST /api/v1/admin/database/optimize`
