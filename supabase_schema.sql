-- ==============================================================================
-- AQUAFLOW - SKEMA DATABASE SUPABASE UNTUK CATATAN KEUANGAN DEPOT AIR GALON
-- ==============================================================================
-- Jalankan skrip ini di Supabase SQL Editor (Dashboard Supabase -> SQL Editor -> New Query)

-- 1. Buat Tabel Transaksi Keuangan Galon
CREATE TABLE IF NOT EXISTS public.gallon_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Informasi Waktu Transaksi
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TIME NOT NULL DEFAULT CURRENT_TIME,
    day_name VARCHAR(20) NOT NULL, -- Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu
    day_of_week INT NOT NULL,      -- 1 (Senin) s/d 7 (Minggu)
    month INT NOT NULL,            -- 1 s/d 12
    year INT NOT NULL,             -- 2024, 2025, 2026, dst.
    
    -- Tipe & Rincian Transaksi
    type VARCHAR(20) NOT NULL CHECK (type IN ('pemasukan', 'pengeluaran')),
    category VARCHAR(100) NOT NULL,
    
    -- Detail Galon & Finansial
    gallon_qty INT DEFAULT 0,              -- Jumlah galon (khusus penjualan/pembelian galon)
    unit_price NUMERIC(15, 2) DEFAULT 0,  -- Harga per unit/galon
    amount NUMERIC(15, 2) NOT NULL,       -- Total nominal uang (Rp)
    
    -- Pembayaran & Keterangan
    payment_method VARCHAR(50) DEFAULT 'Tunai', -- Tunai, QRIS, Transfer Bank, Hutang
    customer_name VARCHAR(150),                 -- Nama pelanggan / vendor (opsional)
    notes TEXT                                  -- Catatan tambahan / keterangan
);

-- 2. Buat Tabel Inventaris & Stok Galon
CREATE TABLE IF NOT EXISTS public.gallon_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    stock_filled INT DEFAULT 50,     -- Galon siap jual / isi
    stock_empty INT DEFAULT 20,      -- Galon kosong siap isi
    stock_borrowed INT DEFAULT 5,   -- Galon dipinjam pelanggan
    refill_price NUMERIC(15, 2) DEFAULT 6000,     -- Harga standar isi ulang
    new_gallon_price NUMERIC(15, 2) DEFAULT 45000 -- Harga standar galon baru + isi
);

-- 3. Buat Index untuk Performa Filter Cepat berdasarkan Waktu & Jenis
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.gallon_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_year_month ON public.gallon_transactions(year, month);
CREATE INDEX IF NOT EXISTS idx_transactions_day_name ON public.gallon_transactions(day_name);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.gallon_transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.gallon_transactions(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.gallon_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallon_inventory ENABLE ROW LEVEL SECURITY;

-- 5. Buat Policy RLS Publik (Anon Key) untuk Memudahkan CRUD dari Aplikasi Frontend
DROP POLICY IF EXISTS "Public access for transactions" ON public.gallon_transactions;
CREATE POLICY "Public access for transactions" 
ON public.gallon_transactions 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for inventory" ON public.gallon_inventory;
CREATE POLICY "Public access for inventory" 
ON public.gallon_inventory 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 6. Trigger Otomatis untuk Mengupdate Kolom updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_gallon_transactions_modtime ON public.gallon_transactions;
CREATE TRIGGER update_gallon_transactions_modtime
BEFORE UPDATE ON public.gallon_transactions
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- 7. Insert Data Awal Default untuk Stok Galon jika belum ada
INSERT INTO public.gallon_inventory (id, stock_filled, stock_empty, stock_borrowed, refill_price, new_gallon_price)
SELECT gen_random_uuid(), 85, 30, 12, 6000, 45000
WHERE NOT EXISTS (SELECT 1 FROM public.gallon_inventory);
