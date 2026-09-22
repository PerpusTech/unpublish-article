# Panduan UI Design System & Reusable Components

Dokumen ini adalah pedoman bagi developer frontend dalam membangun halaman, dialog modal, tabel, dan formulir baru agar konsisten, responsif, dan mendukung penuh **Light Mode & Dark Mode**.

Semua komponen dasar telah diisolasi dan diekspor secara terpusat melalui:
```tsx
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Badge,
  StatusPill,
  FormInput,
  FormSelect,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  StatCard,
  ToggleSwitch,
  ConfirmModal,
  PaginationControls,
} from '../common';
```

---

## 1. Design Tokens & CSS Variables (`src/styles/index.css`)

Aplikasi menggunakan sistem token warna HSL & Slate Modern:

| Token Variable | Light Mode | Dark Mode | Kegunaan |
|---|---|---|---|
| `--color-primary` | `#0a2540` (Academic Navy) | `#2563eb` (Deep Blue) | Warna brand utama, tombol aksi primer |
| `--color-bg` | `#ffffff` (Pure White) | `#09090b` (Jet Black) | Latar belakang dasar halaman |
| `--color-surface` | `#ffffff` | `#121215` (Elevated Zinc) | Latar belakang kartu, tabel, dan modal |
| `--color-surface-subtle` | `#f8fafc` | `#1c1c20` | Header tabel, background input, badge neutral |
| `--color-border` | `#e2e8f0` | `#27272a` | Garis pembatas komponen |
| `--color-text` | `#0f172a` | `#f4f4f5` | Teks utama |
| `--color-text-muted` | `#475569` | `#a1a1aa` | Teks sekunder / deskripsi |
| `--color-success` | `#065f46` | `#34d399` | Status aktif / berhasil |
| `--color-warning` | `#92400e` | `#fbbf24` | Status perhatian / peringatan |
| `--color-danger` | `#991b1b` | `#f87171` | Status error / bahaya / hapus |

---

## 2. Komponen UI Dasar

### A. `Button`
Tombol aksi dengan loading spinner otomatis terintegrasi dan slot ikon.

```tsx
import { Button } from '../common';
import { FiDownload, FiTrash2 } from 'react-icons/fi';

// 1. Tombol Primer dengan Loading
<Button
  variant="primary"
  size="md"
  isLoading={isSaving}
  loadingText="Menyimpan..."
  onClick={handleSave}
>
  Simpan Perubahan
</Button>

// 2. Tombol Bahaya / Hapus dengan Ikon
<Button
  variant="danger"
  size="sm"
  leftIcon={<FiTrash2 />}
  onClick={handleDelete}
>
  Hapus Pengguna
</Button>

// 3. Tombol Outline Lebar Penuh (Full Width)
<Button
  variant="outline"
  fullWidth
  leftIcon={<FiDownload />}
  onClick={handleDownload}
>
  Unduh Berkas (.sqlite)
</Button>
```

**Props `Button`:**
* `variant`: `'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' | 'accent'`
* `size`: `'sm' | 'md' | 'lg'`
* `isLoading`: `boolean` (Disables click & renders animated spinner)
* `loadingText`: `string`
* `leftIcon` / `rightIcon`: `React.ReactNode`
* `fullWidth`: `boolean`

---

### B. `Modal` (Base Modal Dialog)
Wrapper modal universal berbasis React Portal dengan backdrop blur, escape key handling, dan body scroll lock.

```tsx
import { useState } from 'react';
import { Modal, ModalBody, Button } from '../common';

export const MyCustomModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title="Rincian Atribut SSO Civitas"
      subtitle="Data identitas resmi dari auth.ums.ac.id"
      size="md"
      footer={
        <Button variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
          Tutup
        </Button>
      }
    >
      <ModalBody>
        <p>Konten modal diletakkan di sini...</p>
      </ModalBody>
    </Modal>
  );
};
```

**Props `Modal`:**
* `isOpen`: `boolean`
* `onClose`: `() => void`
* `title`: `React.ReactNode`
* `subtitle`: `React.ReactNode`
* `size`: `'sm' (420px) | 'md' (580px) | 'lg' (820px) | 'xl' (1050px) | 'full'`
* `closeOnClickOutside`: `boolean` (default: `true`)
* `closeOnEscape`: `boolean` (default: `true`)
* `headerIcon`: `React.ReactNode`
* `footer`: `React.ReactNode`

---

### C. `Badge` & `StatusPill`
Label status kategori dan pill indikator interaktif dengan efek radar pulse.

```tsx
import { Badge, StatusPill } from '../common';

// Status Tag Kategori
<Badge variant="publish">PUBLISH</Badge>
<Badge variant="unpublish">UNPUBLISH (RESTRICTED)</Badge>
<Badge variant="primary" dot pulse>AKTIF</Badge>

// Status Pill Interaktif (Bisa diklik untuk buka modal diagnostik)
<StatusPill
  status="success"
  pulse
  onClick={openDbDiagnosticModal}
>
  Live MySQL (12ms)
</StatusPill>
```

---

### D. `FormInput` & `FormSelect`
Form field terstandarisasi dengan label, pesan validasi error, ikon pencarian, dan tombol clear.

```tsx
import { FormInput, FormSelect } from '../common';

<FormInput
  label="Alamat IP / Subnet CIDR"
  placeholder="contoh: 10.20.0.0/16"
  value={ipInput}
  onChange={(e) => setIpInput(e.target.value)}
  error={ipError} // Menampilkan teks error merah di bawah input
  required
  leftIcon={<FiGlobe />}
/>

<FormSelect
  label="Peran Pengguna (Role)"
  value={selectedRole}
  onChange={(e) => setSelectedRole(e.target.value)}
  options={[
    { value: 'USER', label: 'Pemustaka Biasa' },
    { value: 'ADMIN', label: 'Staf Meja Layanan' },
    { value: 'SUPER_ADMIN', label: 'Super Administrator' },
  ]}
/>
```

---

### E. `Card` & `StatCard`
Container modular untuk panel konfigurasi dan kartu KPI ringkasan statistik.

```tsx
import { Card, StatCard, Button } from '../common';

// Card Panel dengan Header & Tombol Aksi
<Card
  title="Daftar Subnet Kampus UMS"
  subtitle="Alamat IP yang dikenali sebagai jaringan internal resmi"
  action={<Button size="sm" variant="secondary">Reset Default</Button>}
  padding="md"
>
  <p>Isi tabel atau form di sini...</p>
</Card>

// Kartu Metrik Dashboard Statistik
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
  <StatCard
    label="Ukuran Database"
    value="1.24 MB"
    description="SQLite Single File"
    color="blue"
  />
  <StatCard
    label="Total Record"
    value="1,420"
    trend={{ value: "+12% minggu ini", isPositive: true }}
    color="purple"
  />
  <StatCard
    label="Integritas Database"
    value="OK (Sehat)"
    description="Journal Mode: WAL"
    color="green"
  />
  <StatCard
    label="Tiket Kedaluwarsa"
    value="14"
    color="amber"
  />
</div>
```

---

### F. `ToggleSwitch`
Switch toggle on/off modern dengan aksesibilitas keyboard (Space / Enter).

```tsx
import { ToggleSwitch } from '../common';

<ToggleSwitch
  label="Batasi Khusus Jaringan Kampus UMS"
  description="Pemustaka di luar jaringan Wi-Fi/LAN kampus tidak dapat mengakses naskah"
  checked={isRestricted}
  onChange={(checked) => setIsRestricted(checked)}
/>
```

---

## 3. Contoh: Membangun Modul Form Baru

Berikut contoh pola standar pembuatan view/form baru:

```tsx
import React, { useState } from 'react';
import { Card, FormInput, FormSelect, Button, ConfirmModal } from '../common';

export const ExampleSettingsView: React.FC = () => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('STAFF');
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // Jalankan API save...
    setSaving(false);
    setShowConfirm(false);
  };

  return (
    <Card title="Pengaturan Staf Baru" padding="md">
      <form onSubmit={(e) => { e.preventDefault(); setShowConfirm(true); }}>
        <FormInput
          label="Nama Staf"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <FormSelect
          label="Pilih Divisi Layanan"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: 'CIRCULATION', label: 'Layanan Sirkulasi' },
            { value: 'DIGITAL', label: 'Layanan Digital & Repositori' },
          ]}
        />

        <Button type="submit" variant="primary" isLoading={saving}>
          Simpan Data Staf
        </Button>
      </form>

      <ConfirmModal
        isOpen={showConfirm}
        title="Konfirmasi Penyimpanan"
        message={`Simpan data staf ${name}?`}
        onConfirm={handleSave}
        onClose={() => setShowConfirm(false)}
      />
    </Card>
  );
};
```
