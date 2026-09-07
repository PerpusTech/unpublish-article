# PRD — EPrints Unpublish Viewer Perpustakaan UMS

Aplikasi web internal Perpustakaan Universitas Muhammadiyah Surakarta (UMS) untuk memberikan akses terkontrol, berbatas waktu, dan aman kepada pemustaka yang ingin membaca artikel ilmiah / karya tulis pada repositori EPrints yang berstatus belum terbit (*unpublish* / buffer / restricted).

---

## 1. Konteks & Tujuan

- **Masalah Nyata**:
  - Repositori EPrints UMS memuat ribuan karya ilmiah mahasiswa dan dosen. Sebagian karya berstatus *unpublish* (misal: menunggu revisi akhir, status buffer, atau berstatus restricted/embargo karena paten atau kebijakan prodi).
  - Pemustaka (mahasiswa/dosen/peneliti) sering membutuhkan referensi dari karya-karya ini untuk riset langsung di perpustakaan, namun tidak dapat diakses secara publik lewat portal EPrints luar.
  - Saat ini, staf perpustakaan harus mencari manual di server/admin EPrints atau memberikan file PDF mentah yang berisiko disebarluaskan tanpa jejak (potensi plagiarisme atau pelanggaran hak cipta karya unpublish).
- **Solusi yang Dibangun**:
  - Aplikasi katalog & pembaca PDF khusus yang terhubung *read-only* ke basis data EPrints.
  - Akses pemustaka dilindungi menggunakan **Sistem Token / Voucher Berwaktu** (1–4 jam) yang digenerate oleh Pustakawan (Admin) dan dikunci ke 1 perangkat pemustaka saat aktivasi.
  - Dokumen PDF disajikan secara *view-only* langsung di browser dengan **watermark dinamis** (Nama pemustaka, NIM, Token, Timestamp) tanpa fitur unduh/cetak langsung, disertai **audit trail lengkap**.

---

## 2. Success Metrics

1. **Keamanan Dokumen**: 100% pembacaan PDF unpublish terproteksi watermark beridentitas pemustaka dan tidak menyediakan tautan unduh langsung.
2. **Kendali Sesi Presisi**: Akses otomatis terputus saat hitung mundur sesi habis, dengan toleransi sinkronisasi waktu server < 2 detik.
3. **Pencegahan Penyalahgunaan Akun**: 1 token hanya dapat diaktivasi dan digunakan oleh 1 perangkat (*device binding*).
4. **Auditabilitas Penuh**: Setiap aksi pemustaka (pencarian, buka metadata, buka full text PDF) tercatat dalam log audit dengan identitas pemustaka dan timestamp.

---

## 3. User & Role

| Role | Yang BOLEH Dilakukan | Yang TIDAK BOLEH Dilakukan (Eksplisit) |
|---|---|---|
| **Pustakawan / Admin** | - Login menggunakan akun Google Workspace kampus (`@ums.ac.id`)<br>- Generate token baru (input Nama, NIM, durasi jam)<br>- Monitoring sesi aktif secara real-time<br>- Memperpanjang durasi sesi pemustaka yang sedang aktif atau baru expired<br>- Mencabut/revoke token sewaktu-waktu<br>- Melihat riwayat audit log pembacaan artikel | - Mengubah/menghapus/menulis data di database EPrints asli (koneksi wajib *Read-Only*)<br>- Mengunduh file PDF secara massal |
| **Pemustaka (Patron)** | - Aktivasi token via input kode atau scan QR Code di browser perangkatnya<br>- Mencari dan memfilter artikel repositori (baik yang berstatus Publish maupun Unpublish)<br>- Membaca metadata lengkap artikel<br>- Membaca naskah PDF secara streaming dengan watermark nama & NIM selama sesi aktif | - Mengakses katalog atau membaca PDF sebelum memasukkan token valid<br>- Menggunakan token yang sama di perangkat kedua secara bersamaan<br>- Membaca dokumen setelah countdown sesi habis (otomatis terkunci)<br>- Mengunduh (*direct download*) atau mencetak file PDF asli |
| **Tamu / Publik (Tanpa Token)** | - Hanya melihat layar sambutan dan form aktivasi token/scan QR | - Melihat judul, abstrak, maupun daftar artikel apapun |

---

## 4. Business Rules & State Machine

### 4.1. Siklus Hidup Token Pemustaka (*Token State Machine*)

```
[CREATED] (Admin generate)
    │
    ├───────────(Tidak diaktivasi > 24 jam)───────────> [EXPIRED_UNCLAIMED]
    │
    ▼ (Pemustaka input token di browser)
[ACTIVE] (Countdown sesi berjalan, terkunci ke 1 device)
    │
    ├───────────(Admin tambah durasi)─────────────────> [ACTIVE] (Durasi bertambah)
    ├───────────(Waktu habis / timer = 0)─────────────> [EXPIRED]
    └───────────(Admin paksa stop / batalkan)─────────> [REVOKED]
```

### 4.2. Aturan Bisnis Kunci (*Business Rules*)

1. **Device Binding**: Pada request aktivasi pertama, backend menyimpan *fingerprint* perangkat (kombinasi IP, User-Agent, dan UUID client). Request selanjutnya dari browser lain dengan token yang sama akan ditolak.
2. **Trigger Hitung Mundur**: Sesi waktu (1–4 jam) **tidak** berkurang saat token baru dibuat, melainkan baru mulai dihitung mundur detik per detik saat pemustaka mengklik tombol aktivasi pertama kali di browsernya.
3. **Masa Berlaku Klaim**: Token yang belum pernah diaktivasi memiliki masa hangus otomatis 24 jam sejak pembuatan.
4. **Katalog Campuran Berlabel**: Pemustaka dapat menelusuri artikel yang berstatus *Publish* (arsip publik) maupun *Unpublish* (buffer/inbox/restricted), masing-masing diberi *status badge* yang jelas.
5. **Watermark Dinamis**: Setiap halaman PDF yang dirender menyertakan watermark diagonal semi-transparan berformat:
   `Perpustakaan UMS • [NIM] - [Nama Pemustaka] • Token: [TokenID] • [Tanggal & Waktu]`
6. **Perpanjangan Sesi**: Admin dapat menambahkan waktu (misal: +30 atau +60 menit) langsung dari dasbor monitoring tanpa membuat pemustaka harus login ulang.

---

## 5. Functional Requirements

| ID | Fitur | Detail & Edge Case | Acceptance Criteria |
|---|---|---|---|
| **FR-01** | Google OAuth Admin Login | Admin login menggunakan Google Workspace domain `@ums.ac.id`. Akun non-UMS ditolak dengan pesan error yang jelas. | Hanya email berakhiran `@ums.ac.id` yang terdaftar dalam daftar pustakawan yang dapat mengakses panel admin. |
| **FR-02** | Token Generator & QR Code | Admin memilih durasi (1, 2, 3, 4 jam atau custom menit), menginput Nama dan NIM pemustaka. Sistem menghasilkan token alfanumerik 6–8 karakter dan QR code yang dapat di-scan. | Token tersimpan dengan status `PENDING`, menampilkan QR code yang bisa langsung diarahkan ke URL aktivasi. |
| **FR-03** | Token Activation & Session Lock | Pemustaka membuka halaman aktivasi, memasukkan token atau scan QR. Sistem memvalidasi status, memulai timer, dan mengikat ke session cookie / device fingerprint. | Token berubah menjadi `ACTIVE`, timer mulai berjalan, cookie sesi aman terpasang di browser pemustaka. |
| **FR-04** | Pencarian & Filter Katalog | Pemustaka dapat mencari berdasarkan judul, penulis, tahun, subjek/prodi, serta filter status (Semua / Publish / Unpublish). | Hasil pencarian merespons < 500ms, membedakan badge status dengan warna kontras (Hijau = Publish, Oranye/Kuning = Unpublish). |
| **FR-05** | View-Only PDF Viewer | Menampilkan dokumen PDF di dalam browser menggunakan viewer kustom (PDF.js). Fitur klik kanan, copy teks, tombol download native, dan print dinonaktifkan via CSS & JavaScript. | PDF dapat dibaca dengan lancar; watermark pemustaka tercetak jelas di atas kanvas dokumen. |
| **FR-06** | Real-Time Countdown & Auto-Lock | Indikator waktu sisa sesi selalu terlihat di pojok atas layar pemustaka. Ketika waktu sisa mencapai 0, modal terkunci muncul dan akses PDF langsung di-revoke oleh server. | Ketika countdown 00:00:00, dokumen tertutup dan pemustaka dialihkan kembali ke layar input token. |
| **FR-07** | Admin Monitoring & Perpanjangan | Admin dapat melihat daftar sesi yang sedang aktif beserta sisa waktunya. Admin memiliki tombol "Tambah Waktu (+30m, +1j)" atau "Hentikan Akses (Revoke)". | Pembaruan durasi langsung terefleksi pada sesi pemustaka secara real-time. |
| **FR-08** | Audit Trail Lengkap | Sistem mencatat setiap artikel yang dibuka oleh pemustaka (ID eprint, judul, waktu buka, durasi baca, IP, NIM, Nama). | Admin dapat memfilter dan mengekspor riwayat audit log ke CSV / Excel untuk keperluan laporan perpustakaan. |

---

## 6. User Flow

### Flow 1: Pustakawan Memberikan Akses
1. Pemustaka datang ke meja layanan perpustakaan, menunjukkan KTM (Kartu Tanda Mahasiswa).
2. Pustakawan membuka Admin Dashboard (login via Google SSO UMS).
3. Pustakawan mengisi form: Nama, NIM, dan memilih durasi (misal: 2 jam) -> klik "Generate Token".
4. Pustakawan memperlihatkan QR Code atau menyebutkan kode token ke pemustaka.

### Flow 2: Pemustaka Mengakses Artikel
1. Pemustaka membuka situs aplikasi di browser laptop/ponselnya.
2. Pemustaka memasukkan kode token (atau scan QR).
3. Sesi aktif: Muncul ucapan selamat datang beserta floating badge "Sisa Waktu: 01:59:59".
4. Pemustaka mencari artikel skripsi/jurnal unpublish melalui kolom pencarian.
5. Pemustaka mengklik artikel -> halaman detail artikel terbuka dengan abstrak dan daftar file.
6. Pemustaka membuka viewer PDF: naskah dapat dibaca dengan watermark identitas pemustaka.
7. Saat waktu habis, layar terkunci otomatis dengan notifikasi sesi berakhir.

---

## 7. Non-Functional Requirements

- **Keamanan Database EPrints**: Koneksi ke database EPrints menggunakan user MySQL dengan hak akses `SELECT` saja (Strict Read-Only). Tidak ada query `INSERT/UPDATE/DELETE` yang dijalankan ke database EPrints.
- **Perlindungan File PDF**: Backend menyajikan file PDF secara streaming melalui endpoint terotentikasi token (misal: `/api/v1/articles/:id/pdf-stream`). URL file fisik server tidak pernah diekspos ke publik.
- **Performa Streaming**: Streaming PDF menggunakan *range requests* / chunking sehingga dokumen berukuran besar (>50MB) dapat dibuka cepat tanpa harus didownload menyeluruh sekaligus.
- **Ketersediaan**: Terpasang di jaringan lokal/server kampus UMS dengan latensi rendah.

---

## 8. Out of Scope

- Menulis atau mengubah metadata langsung ke EPrints dari aplikasi ini (tetap dikelola lewat panel EPrints resmi).
- Registrasi mandiri tanpa intervensi pustakawan (semua token wajib diterbitkan oleh admin perpustakaan).
- Pembayaran / komersialisasi dokumen.
