# 💧 AquaFlow - Catatan & Manajemen Mutasi Stok Galon Depot

Aplikasi web modern, responsif, dan elegan untuk pencatatan mutasi dan manajemen stok fisik depot air minum galon (Galon Masuk, Galon Keluar, Galon Isi Siap Jual, Galon Kosong, Dipinjam Pelanggan, dan Rusak/Afkir). Dilengkapi dengan sistem penyaringan multi-dimensi berdasarkan **Tanggal**, **Hari**, **Bulan**, dan **Tahun**, integrasi database cloud **Supabase** (CRUD), visualisasi grafik analitik, ekspor Excel/CSV/PDF, dan siap di-deploy langsung ke **Vercel**.

---

## ✨ Fitur Unggulan

1. **CRUD Catatan Mutasi Stok Lengkap (Create, Read, Update, Delete)**:
   - **Galon Keluar (-)**: Penjualan isi ulang galon (*refill*), penjualan galon baru + isi, galon dipinjamkan ke pelanggan, pengiriman, galon rusak/pecah, dll.
   - **Galon Masuk (+)**: Pengadaan/pembelian galon baru dari pabrik, pengembalian galon pinjaman dari pelanggan, pasokan galon isi, dll.
   - **Otomatisasi Stok Fisik**: Setiap pencatatan mutasi langsung menyesuaikan jumlah stok galon isi, kosong, dipinjam, atau rusak secara otomatis.

2. **⚡ Pencatatan Cepat (Quick Action Bar)**:
   - Tombol instan 1-klik: `+1 Galon Isi Ulang`, `+5 Galon Isi Ulang`, `+10 Galon Isi Ulang`, `+1 Galon Baru (+Bodi)`.
   - Mempercepat pencatatan saat aktivitas pengisian atau distribusi galon sedang ramai.

3. **📅 Penyaringan Multi-Dimensi (Waktu & Kategori Mutasi)**:
   - **Filter Tanggal**: Pilih tanggal spesifik atau rentang tanggal kustom (*Date Range* dari tanggal A s/d B).
   - **Filter Hari**: Rekapitulasi per hari dalam seminggu (*Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu*) untuk melihat volume pergerakan galon di hari tertentu.
   - **Filter Bulan**: Pilih bulan (*Januari - Desember*) dan tahun untuk rekap bulanan.
   - **Filter Tahun**: Pilih tahun untuk membandingkan volume mutasi tahunan.
   - **Preset Cepat**: *Hari Ini, Kemarin, 7 Hari Terakhir, Bulan Ini, Bulan Lalu, Tahun Ini, Semua Waktu*.
   - **Pencarian Cepat**: Cari nama pelanggan/vendor atau catatan keterangan.

4. **📊 Dashboard & Grafik Analitik Interaktif**:
   - **Kartu Ringkasan Stok**: Galon Siap Jual (Isi), Total Galon Keluar, Total Galon Masuk, Galon Dipinjam Pelanggan, dan Galon Kosong.
   - **Grafik Tren Garis**: Visualisasi tren perbandingan Galon Keluar vs Galon Masuk dari hari ke hari.
   - **Diagram Donat**: Komposisi kategori pergerakan galon.

5. **📦 Manajemen Inventaris & Stok Fisik Depot**:
   - Pantau stok fisik secara real-time: **Galon Isi (Siap Jual)**, **Galon Kosong (Siap Isi)**, **Galon Dipinjam (Pelanggan)**, dan **Galon Rusak / Afkir**.
   - Fitur penyesuaian manual (Stok Opname).

6. **📥 Ekspor Laporan & Cetak PDF**:
   - Unduh laporan spreadsheet **Excel (.xlsx)** lengkap dengan baris ringkasan total mutasi.
   - Unduh file **CSV**.
   - Cetak Laporan Mutasi Stok rapi / Simpan ke PDF (*Print-Ready Layout* dengan kop laporan).
   - Cadangkan & Pulihkan data lokal via file **JSON**.

7. **☁️ Database Supabase & Mode Hybrid**:
   - Berjalan lancar secara offline (*LocalStorage*) atau terhubung ke database cloud *Supabase*.
   - Fitur *1-Click Sync* untuk mengunggah catatan lokal ke cloud Supabase.

8. **🚀 Siap Deploy ke Vercel**:
   - Konfigurasi `vercel.json` sudah tersedia untuk deployment instan.

---

## 🗄️ Panduan Menyiapkan Database Supabase

1. Buat akun gratis di [https://supabase.com](https://supabase.com) dan buat proyek baru.
2. Di dashboard proyek Supabase Anda, klik menu **SQL Editor** pada sidebar kiri.
3. Klik **New Query**, lalu salin seluruh isi file [`supabase_schema.sql`](./supabase_schema.sql) dan klik tombol **Run**.
4. Buka menu **Project Settings -> API** di Supabase:
   - Salin **Project URL** (contoh: `https://xxxx.supabase.co`)
   - Salin **anon public API Key** (contoh: `eyJhbGciOi...`)
5. Buka aplikasi AquaFlow, klik tombol **Pengaturan DB** di kanan atas, tempel URL & Anon Key, lalu klik **Simpan Konfigurasi** (atau masukkan di file `env.js`).
6. Klik tombol **Tes Koneksi** untuk memastikan database sudah terhubung dengan sukses.

---

## 🚀 Panduan Deploy ke Vercel

1. Unggah folder proyek ini ke repository GitHub Anda (Public atau Private).
2. Buka [https://vercel.com](https://vercel.com) dan login.
3. Klik tombol **Add New... -> Project**.
4. Pilih repository GitHub Anda, lalu klik **Deploy**.
5. Aplikasi AquaFlow Anda langsung aktif di domain `https://nama-proyek-anda.vercel.app`!

---

## 💻 Cara Menjalankan di Komputer Lokal

Aplikasi ini berbasis web murni:
1. Buka file `index.html` langsung di browser Anda (Google Chrome, Microsoft Edge, Firefox).
2. Atau jalankan local web server:
   ```bash
   npm run dev
   ```
   atau jalankan script PowerShell `serve.ps1`.
