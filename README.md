# 💧 AquaFlow - Catatan Pemasukan & Pengeluaran Depot Air Galon

Aplikasi web modern, responsif, dan elegan untuk pencatatan kasir dan manajemen keuangan depot air minum galon. Dilengkapi dengan sistem penyaringan multi-dimensi berdasarkan **Tanggal**, **Hari**, **Bulan**, dan **Tahun**, integrasi database cloud **Supabase** (CRUD), visualisasi grafik analitik, manajemen stok galon, ekspor Excel, dan siap di-deploy langsung ke **Vercel**.

---

## ✨ Fitur Unggulan

1. **CRUD Transaksi Lengkap (Create, Read, Update, Delete)**:
   - **Pemasukan**: Isi ulang galon (*refill*), penjualan galon baru + isi, tutup & tisu, delivery/antar, dll.
   - **Pengeluaran**: Pembelian air tangki/sumber baku, pemeliharaan filter & mesin UV/RO, bensin kurir, listrik & PAM, gaji karyawan, sewa, operasional, dll.
   - **Kalkulasi Otomatis**: `Jumlah Galon (Qty) × Harga Satuan` otomatis menghasilkan total nominal uang.

2. **⚡ Kasir Cepat Depot (Quick Cashier)**:
   - Tombol instan 1-klik: `+1 Galon Isi Ulang (Rp 6.000)`, `+5 Galon (Rp 30.000)`, `+10 Galon (Rp 60.000)`, `+1 Galon Baru (Rp 45.000)`.
   - Mempercepat pelayanan loket saat antrean depot sedang ramai.

3. **📅 Penyaringan Multi-Dimensi (Waktu & Kategori)**:
   - **Filter Tanggal**: Pilih tanggal spesifik atau rentang tanggal kustom (*Date Range* dari tanggal A s/d B).
   - **Filter Hari**: Rekapitulasi per hari dalam seminggu (*Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu*) untuk melihat performa hari teramai.
   - **Filter Bulan**: Pilih bulan (*Januari - Desember*) dan tahun untuk rekap bulanan.
   - **Filter Tahun**: Pilih tahun untuk membandingkan omset dan laba tahunan.
   - **Preset Cepat**: *Hari Ini, Kemarin, 7 Hari Terakhir, Bulan Ini, Bulan Lalu, Tahun Ini, Semua Waktu*.
   - **Pencarian & Metode Pembayaran**: Cari nama pelanggan/catatan dan filter metode bayar (*Tunai, QRIS, Transfer Bank*).

4. **📊 Dashboard & Grafik Analitik Interaktif**:
   - **Kartu Ringkasan Finansial**: Total Pemasukan, Total Pengeluaran, Laba Bersih (*Net Profit*), Total Volume Galon Terjual, Rata-rata Penjualan/Hari.
   - **Grafik Tren Garis**: Visualisasi tren pemasukan vs pengeluaran dari waktu ke waktu.
   - **Diagram Donat**: Komposisi kategori pemasukan & pengeluaran.

5. **📦 Manajemen Inventaris & Stok Galon**:
   - Pantau stok fisik: Galon Isi (Siap Jual), Galon Kosong, dan Galon Dipinjam Pelanggan.
   - Otomatis memperbarui stok saat ada penjualan galon.
   - Pengaturan harga default depot.

6. **📥 Ekspor Laporan & Cetak PDF**:
   - Unduh laporan spreadsheet **Excel (.xlsx)** lengkap dengan baris ringkasan total.
   - Unduh file **CSV**.
   - Cetak Laporan Keuangan rapi / Simpan ke PDF (*Print-Ready Layout* dengan kop laporan).
   - Cadangkan & Pulihkan data lokal via file **JSON**.

7. **☁️ Database Supabase & Mode Hybrid**:
   - Dapat berjalan langsung secara offline (*LocalStorage*) atau terhubung ke database cloud *Supabase*.
   - Fitur *1-Click Sync* untuk mengunggah catatan lokal ke cloud Supabase.

8. **🚀 Siap Deploy ke Vercel**:
   - Konfigurasi `vercel.json` sudah tersedia untuk deployment tanpa repot.

---

## 🗄️ Panduan Menyiapkan Database Supabase (3 Menit)

1. Buat akun gratis di [https://supabase.com](https://supabase.com) dan buat proyek baru.
2. Di dashboard proyek Supabase Anda, klik menu **SQL Editor** pada sidebar kiri.
3. Klik **New Query**, lalu salin seluruh isi file [`supabase_schema.sql`](./supabase_schema.sql) dan klik tombol **Run**.
4. Buka menu **Project Settings -> API** di Supabase:
   - Salin **Project URL** (contoh: `https://xxxx.supabase.co`)
   - Salin **anon public API Key** (contoh: `eyJhbGciOi...`)
5. Buka aplikasi AquaFlow, klik indikator database di pojok kanan atas (*Database Setting*), tempel URL & Anon Key, lalu klik **Simpan Konfigurasi**.
6. Klik tombol **Tes Koneksi** untuk memastikan database sudah terhubung dengan sempurna.

---

## 🚀 Panduan Deploy ke Vercel

### Opsi A: Deploy via GitHub (Paling Mudah)
1. Unggah folder proyek ini ke repository GitHub Anda (Public atau Private).
2. Buka [https://vercel.com](https://vercel.com) dan login.
3. Klik tombol **Add New... -> Project**.
4. Pilih repository GitHub Anda, lalu klik **Deploy**.
5. Aplikasi AquaFlow Anda langsung aktif di domain `https://nama-proyek-anda.vercel.app`!

### Opsi B: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel
```

---

## 💻 Cara Menjalankan di Komputer Lokal

Aplikasi ini dapat langsung dibuka dan dijalankan:
1. Cukup buka file `index.html` langsung di browser favorit Anda (Google Chrome, Microsoft Edge, Safari, Firefox).
2. Atau jalankan local web server jika Anda menggunakan ekstensi Live Server di VS Code / PowerShell HTTP server.

---

## 📁 Struktur Direktori Proyek

```
c:/Users/DEDE/Documents/galon/
├── index.html               # Struktur UI halaman utama, kasir, filter, dan modal
├── css/
│   └── style.css            # Stylesheet tema modern Aqua Blue, dark mode & print CSS
├── js/
│   ├── app.js               # Logika inti aplikasi, event listeners, state management
│   ├── supabase-client.js   # Modul CRUD Supabase + Fallback Local Storage
│   ├── filter.js            # Modul logika penyaringan tanggal, hari, bulan, tahun & KPI
│   ├── charts.js            # Visualisasi grafik Chart.js
│   └── export.js            # Modul ekspor Excel XLSX, CSV, cetak struk PDF & backup
├── supabase_schema.sql      # Skrip SQL untuk setup tabel database & RLS di Supabase
├── vercel.json              # Konfigurasi deploy Vercel
├── .env.example             # Contoh format environment variables Supabase
├── package.json             # Metadata proyek web
└── README.md                # Dokumentasi lengkap
```

---

## 🔒 Lisensi
Proyek ini dibuat untuk keperluan operasional depot air minum galon. Bebas dikembangkan dan dimodifikasi sesuai kebutuhan bisnis Anda.
