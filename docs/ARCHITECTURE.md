# Arsitektur & Keamanan Sistem — EPrints Unpublish Viewer

> **UPT Perpustakaan dan Layanan Digital**  
> Universitas Muhammadiyah Surakarta (UMS)

Dokumen ini menjelaskan arsitektur perangkat lunak, paradigma keamanan perlindungan karya ilmiah, model pemisahan database, dan siklus hidup sesi pembacaan pada sistem EPrints Unpublish Viewer.

---

## 1. Diagram Arsitektur Sistem

```mermaid
flowchart TD
    subgraph Client["Klien / Browser Pemustaka & Pustakawan"]
        A[Browser Pemustaka\n- Katalog & Pencarian\n- PDF.js Canvas Viewer\n- Dynamic Forensic Watermark\n- Multi-Tab Session Sync]
        B[Browser Pustakawan / Admin\n- Meja Layanan Tiket Token\n- Monitoring Sesi Real-time\n- Pengaturan Kebijakan Keamanan\n- Database Backup & Analytics]
    end

    subgraph Gateway["Reverse Proxy & Gateway"]
        N[Nginx Web Server\n- Port 3000 / 80\n- HTTP Security Headers\n- Rate Limiting]
    end

    subgraph Backend["Backend Service (Node.js + Express + TypeScript)"]
        BE_AUTH[Auth & Security Middleware\n- Device Fingerprinting\n- UMS Subnet Whitelist Checker\n- CAS SSO 2.0 Validator]
        BE_TOKEN[Token & Session Engine\n- Auto-expiry Cron Job\n- Token Normalizer\n- Duration Extender]
        BE_STREAM[PDF Secure Streaming Controller\n- Zero Direct Storage Access\n- Watermark Metadata Injector\n- Reading Telemetry Recorder]
        BE_ADAPTER[EPrints Read-Only Repository Adapter\n- Live MySQL / Mock Fallback\n- Metadata Query & Search Engine]
    end

    subgraph DataStorage["Penyimpanan Data & Repositori"]
        DB_LOCAL[(Database Aplikasi Lokal\nSQLite: app.db\n- tokens\n- admin_users\n- audit_logs\n- security_settings)]
        DB_EPRINTS[(Database EPrints UMS\nMySQL / MariaDB\nMURNI READ-ONLY\n- eprint, document, etc)]
        FILE_STORAGE[Direktori Dokumen EPrints\nRead-Only Mount\n/var/eprints3/.../documents\nFile PDF Asli Skripsi/Artikel]
    end

    A --> N
    B --> N
    N --> BE_AUTH
    BE_AUTH --> BE_TOKEN
    BE_AUTH --> BE_STREAM
    BE_AUTH --> BE_ADAPTER

    BE_TOKEN --> DB_LOCAL
    BE_STREAM --> DB_LOCAL
    BE_STREAM --> FILE_STORAGE
    BE_ADAPTER --> DB_EPRINTS
```

---

## 2. Paradigma Keamanan Inti (Security Architecture)

Sistem dirancang dengan standar perlindungan hak cipta ketat untuk naskah skripsi/tesis/artikel yang berstatus **Unpublish / Embargo / Restriktif**:

### A. Zero Direct Storage Access
- File PDF asli repositori **tidak pernah dibuka atau diekspos melalui static URL publik** (misal `http://.../file.pdf`).
- Pemustaka hanya dapat membaca melalui streaming data terenkripsi berbasis token via endpoint `/api/v1/articles/:id/documents/:docId/view`.
- Setiap chunk streaming diverifikasi secara ketat terhadap keaktifan token sesi, kecocokan IP, dan fingerprint perangkat.

### B. Dynamic Forensic Watermarking
- Di sisi klien, naskah dirender menggunakan kanvas grafis PDF.js.
- Di atas kanvas, diinjeksi lapisan watermark diagonal semi-transparan yang memuat:
  $$\text{Watermark} = [\text{NIM/NIP Pemustaka}] - [\text{Nama Civitas}] - [\text{IP Address}] - [\text{Waktu Akses}]$$
- Watermark ini menempel pada setiap lembar halaman. Jika ada upaya memotret layar (screen capture) atau merekam, identitas pelaku pembocoran naskah langsung terlacak secara forensik.

### C. Proteksi Anti-Copy, Anti-Print, & Anti-Download
- Menu konteks klik kanan dinonaktifkan pada area pembaca.
- Pintasan keyboard browser seperti `Ctrl+P` (Print), `Ctrl+S` (Save), `Ctrl+U` (View Source), dan `Ctrl+Shift+I` (DevTools) dicegah secara otomatis.
- Seleksi teks (text highlighting/copy) dinonaktifkan pada naskah terproteksi.

### D. Device Fingerprint & Lock Binding
- Saat token diaktivasi, sistem menghasilkan hash sidik jari perangkat pemustaka (`x-client-uuid` + user agent).
- Token terkunci ke 1 perangkat/browser tersebut. Jika kode token dibagikan ke orang lain di perangkat berbeda, aktivasi akan ditolak otomatis.

### E. Multi-Tab Session Synchronization (Dual-Channel)
- Sistem memantau status sesi lintas tab browser menggunakan saluran ganda:
  1. `BroadcastChannel('ums_patron_session_channel')` (Latensi 0 ms).
  2. `window.addEventListener('storage')` (Fallback lintas tab).
- Jika pemustaka mengklik **"Keluar Sesi"** pada Tab A, maka Tab B yang sedang membuka naskah langsung otomatis:
  - Mengirim sisa detak jantung baca terakhir (*reading telemetry*) ke server.
  - Menghapus seluruh buffer piksel dari memori kanvas (`ctx.clearRect`).
  - Menutup modal pembaca seketika dan mengunci tampilan.

---

## 3. Pemisahan Database & Integritas Data EPrints

Salah satu keputusan arsitektural paling fundamental adalah **Isolasi Database**:

```
┌────────────────────────────────────────────────────────┐
│               DATABASE EPRINTS UTAMA (UMS)             │
│               - Status: MURNI READ-ONLY               │
│               - Tidak ada INSERT / UPDATE / DELETE     │
└────────────────────────────────────────────────────────┘
                           ▲
                           │ (Query SELECT Metadata)
┌────────────────────────────────────────────────────────┐
│             BACKEND UNPUBLISH VIEWER                   │
└────────────────────────────────────────────────────────┘
                           │
                           ▼ (Baca / Tulis Sesi & Log)
┌────────────────────────────────────────────────────────┐
│               DATABASE LOKAL (SQLite app.db)           │
│               - tokens (Tiket sesi membaca)            │
│               - admin_users (Staf pustakawan)          │
│               - audit_logs (Rekam jejak pembacaan)     │
│               - security_settings (Whitelist IP/Mode)  │
└────────────────────────────────────────────────────────┘
```

> **Keuntungan**: Tidak ada risiko korupsi data atau beban kueri berat pada database induk EPrints kampus. Seluruh operasi pencatatan token, mutasi status, dan log insiden terjadi terisolasi di database lokal `app.db`.

---

## 4. Siklus Hidup Token (Token Lifecycle)

```mermaid
stateDiagram-v2
    [*] --> PENDING : Diterbitkan Pustakawan (Masa berlaku klaim: 24 Jam)
    PENDING --> ACTIVE : Diaktivasi Pemustaka di Browser
    PENDING --> EXPIRED_UNCLAIMED : Tidak diklaim > 24 Jam
    
    [*] --> ACTIVE : Login Otomatis via SSO UMS (auth.ums.ac.id)
    
    ACTIVE --> ACTIVE : Perpanjangan Waktu (+30m / +1j oleh Admin)
    ACTIVE --> EXPIRED : Durasi Membaca Habis (Countdown = 0)
    ACTIVE --> REVOKED : Dicabut Manual oleh Pustakawan
    
    EXPIRED --> [*]
    EXPIRED_UNCLAIMED --> [*]
    REVOKED --> [*]
```

---

## 5. Mekanisme Kebijakan Akses Jaringan UMS & SSO

Sistem mendukung 3 mode kontrol akses yang dapat diubah secara live dari panel admin:

1. **Mode Fleksibel / Hybrid (Default)**:
   - Pengguna di Jaringan Wi-Fi / LAN Kampus UMS (terdaftar di IP Whitelist) dapat **langsung membaca tanpa token**.
   - Pengguna di luar kampus wajib melakukan login SSO UMS atau memasukkan tiket token pustakawan.
2. **Mode Jaringan Kampus UMS Saja (`UMS_NETWORK_ONLY`)**:
   - Naskah hanya dapat dibuka dari lingkungan kampus UMS. Akses dari luar kampus ditolak dengan pesan informatif.
3. **Mode Khusus Tiket Token (`TOKEN_ONLY`)**:
   - Seluruh pemustaka (baik di dalam maupun di luar kampus) wajib memiliki tiket token aktif dari meja layanan pustakawan.
