import mysql from 'mysql2/promise';
import { ENV } from './env';

export interface DocumentItem {
  docid: number;
  filename: string;
  filesize: number;
  format: string;
  security: string;
  pos?: number;
  main?: string;
}

export interface EPrintItem {
  eprintid: number;
  title: string;
  abstract: string;
  date_year: number;
  type: string; // 'thesis', 'article', 'conference_item'
  eprint_status: 'archive' | 'buffer' | 'inbox' | 'deletion';
  creators: string[];
  department?: string;
  id_number?: string;
  nim?: string;
  nidn?: string;
  documents: DocumentItem[];
}


// Realistic UMS Mock repository dataset
export const MOCK_EPRINTS: EPrintItem[] = [
  {
    eprintid: 101,
    title: 'Implementasi Algoritma Deep Learning YOLOv8 untuk Deteksi Hama Padi Berbasis Edge Computing',
    abstract: 'Penelitian ini mengembangkan sistem deteksi hama tanaman padi secara real-time menggunakan arsitektur YOLOv8 yang dioptimalkan untuk perangkat edge computing Raspberry Pi 4. Evaluasi model menunjukkan mAP@0.5 sebesar 91.4% dengan latensi inferensi 42ms pada citra pertanian lokal Sukoharjo. Dokumen ini masih dalam tahap review akhir dewan penguji skripsi dan belum diterbitkan secara terbuka.',
    date_year: 2025,
    type: 'thesis',
    eprint_status: 'buffer',
    id_number: 'L200210045',
    nim: 'L200210045',
    creators: ['Muhammad Rizqi Pratama', 'Dr. Fajar Suryawan, S.T., M.Eng.'],
    department: 'Program Studi Informatika, Fakultas Komunikasi dan Informatika',
    documents: [
      {
        docid: 1001,
        filename: 'Naskah_Publikasi_Informatika_101.pdf',
        filesize: 1845210,
        format: 'application/pdf',
        security: 'staffonly'
      }
    ]
  },
  {
    eprintid: 102,
    title: 'Uji Aktivitas Antibakteri Ekstrak Etanol Daun Kelor (Moringa oleifera) Terhadap Bakteri Staphylococcus aureus Resisten Metisilin (MRSA)',
    abstract: 'Studi in vitro mengenai efektivitas fraksi etil asetat daun kelor dalam menghambat koloni MRSA klinis. Naskah ini merupakan bagian dari riset kolaborasi berpaten tertunda (patent pending), sehingga akses naskah penuh dibatasi secara internal di lingkungan perpustakaan UMS.',
    date_year: 2025,
    type: 'thesis',
    eprint_status: 'buffer',
    id_number: 'K100210088',
    nim: 'K100210088',
    creators: ['Siti Nur Aisyah', 'Prof. Dr. apt. Muhammad Da\'i, M.Si.'],
    department: 'Fakultas Farmasi',
    documents: [
      {
        docid: 1002,
        filename: 'Fulltext_Farmasi_Embargo_102.pdf',
        filesize: 2411900,
        format: 'application/pdf',
        security: 'staffonly'
      }
    ]
  },
  {
    eprintid: 103,
    title: 'Analisis Faktor Risiko Kejadian Stunting pada Balita di Wilayah Puskesmas Kartasura Menggunakan Regresi Logistik Biner',
    abstract: 'Penelitian cross-sectional kuantitatif pada 120 balita di Kartasura untuk menganalisis korelasi antara sanitasi air bersih, pola asuh gizi 1000 HPK, dan pendapatan keluarga dengan insidensi stunting. Status unpublish: menunggu sidang komite etik riset kedokteran.',
    date_year: 2024,
    type: 'thesis',
    eprint_status: 'inbox',
    id_number: 'J500200112',
    nim: 'J500200112',
    creators: ['Ahmad Fauzan Hakim', 'dr. EM Sutrisna, M.Kes.'],
    department: 'Fakultas Kedokteran',
    documents: [
      {
        docid: 1003,
        filename: 'Draft_Skripsi_Kedokteran_103.pdf',
        filesize: 3120450,
        format: 'application/pdf',
        security: 'staffonly'
      }
    ]
  },
  {
    eprintid: 104,
    title: 'Rancang Bangun Sistem Monitoring Kualitas Daya Listrik 3 Fasa Berbasis Protokol MQTT dan Grafana di Gedung Induk Siti Walidah',
    abstract: 'Artikel ini memaparkan integrasi sensor PZEM-004T dengan microkontroller ESP32 untuk mendeteksi fluktuasi tegangan dan Total Harmonic Distortion (THD) pada gardu distribusi Siti Walidah UMS. Dokumen telah selesai direview dan berstatus terbit publik.',
    date_year: 2024,
    type: 'article',
    eprint_status: 'archive',
    id_number: 'D400200055',
    nim: 'D400200055',
    creators: ['Bagus Hendrawan', 'Ir. Agus Supardi, M.T.'],
    department: 'Program Studi Teknik Elektro, Fakultas Teknik',
    documents: [
      {
        docid: 1004,
        filename: 'Publikasi_Teknik_Elektro_104.pdf',
        filesize: 1450200,
        format: 'application/pdf',
        security: 'public'
      }
    ]
  },
  {
    eprintid: 105,
    title: 'Pengaruh Penerapan Nilai Al-Islam dan Kemuhammadiyahan (AIK) Terhadap Budaya Kerja dan Kepuasan Karyawan Rumah Sakit PKU Muhammadiyah',
    abstract: 'Penelitian empiris mengenai peran etos kerja Islam dalam memediasi kepemimpinan transformasional terhadap retensi tenaga medis. Telah terbit di repositori institusional UMS.',
    date_year: 2023,
    type: 'article',
    eprint_status: 'archive',
    id_number: 'B100190330',
    nim: 'B100190330',
    creators: ['Dian Wardhani', 'Dr. Anton Agus Setyawan, S.E., M.Si.'],
    department: 'Fakultas Ekonomi dan Bisnis',
    documents: [
      {
        docid: 1005,
        filename: 'Jurnal_Manajemen_AIK_105.pdf',
        filesize: 980100,
        format: 'application/pdf',
        security: 'public'
      }
    ]
  },
  {
    eprintid: 106,
    title: 'Optimasi Polimer Konduktif Berbasis Polianilin (PANI) untuk Elektroda Superkapasitor Ramah Lingkungan',
    abstract: 'Karya inovasi teknologi material baru universitas. Masih dalam masa retensi rahasia (embargo akademik prodi Teknik Kimia UMS) sebelum pengajuan paten sederhana disetujui.',
    date_year: 2025,
    type: 'thesis',
    eprint_status: 'buffer',
    id_number: 'D500210019',
    nim: 'D500210019',
    creators: ['Fajar Hidayat', 'Prof. Dr. Ir. H. Bambang Sumardiono, M.Sc.'],
    department: 'Teknik Kimia, Fakultas Teknik',
    documents: [
      {
        docid: 1006,
        filename: 'Superkapasitor_PANI_Unpublish_106.pdf',
        filesize: 2890100,
        format: 'application/pdf',
        security: 'staffonly'
      }
    ]
  }
];

// Read-only MySQL pool
let mysqlPool: mysql.Pool | null = null;

if (!ENV.EPRINTS_USE_MOCK) {
  try {
    mysqlPool = mysql.createPool({
      host: ENV.EPRINTS_DB_HOST,
      port: ENV.EPRINTS_DB_PORT,
      user: ENV.EPRINTS_DB_USER,
      password: ENV.EPRINTS_DB_PASSWORD,
      database: ENV.EPRINTS_DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    console.log(`[EPrints DB] Configured Read-Only MySQL pool: ${ENV.EPRINTS_DB_USER}@${ENV.EPRINTS_DB_HOST}:${ENV.EPRINTS_DB_PORT}/${ENV.EPRINTS_DB_NAME}`);
  } catch (err) {
    console.warn('[EPrints DB] Failed to create MySQL pool, falling back to mock mode:', err);
    mysqlPool = null;
  }
} else {
  console.log('[EPrints DB] Using Mock Repository Adapter (6 sample UMS articles loaded).');
}

export { mysqlPool };
