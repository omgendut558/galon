-- ==============================================================================
-- AQUAFLOW - SKEMA DATABASE SUPABASE UNTUK PENCATATAN & MUTASI STOK GALON
-- ==============================================================================
-- Jalankan skrip ini di Supabase SQL Editor (Dashboard Supabase -> SQL Editor -> New Query)

-- 1. Buat Tabel Mutasi & Transaksi Stok Galon
CREATE TABLE IF NOT EXISTS public.gallon_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Informasi Waktu Mutasi
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TIME NOT NULL DEFAULT CURRENT_TIME,
    day_name VARCHAR(20) NOT NULL, -- Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu
    day_of_week INT NOT NULL,      -- 1 (Senin) s/d 7 (Minggu)
    month INT NOT NULL,            -- 1 s/d 12
    year INT NOT NULL,             -- 2024, 2025, 2026, dst.
    
    -- Tipe & Rincian Mutasi Stok
    type VARCHAR(20) NOT NULL CHECK (type IN ('keluar', 'masuk')),
    category VARCHAR(100) NOT NULL,
    
    -- Detail Stok Galon
    gallon_qty INT NOT NULL DEFAULT 1 CHECK (gallon_qty > 0), -- Jumlah fisik galon
    
    -- Identitas & Keterangan
    customer_name VARCHAR(150), -- Nama pelanggan / vendor / pengantar (opsional)
    notes TEXT                  -- Catatan tambahan / keterangan
);

-- 2. Buat Tabel Inventaris Stok Galon Fisik Depot
CREATE TABLE IF NOT EXISTS public.gallon_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    stock_filled INT NOT NULL DEFAULT 85,    -- Galon siap jual / isi
    stock_empty INT NOT NULL DEFAULT 30,     -- Galon kosong siap isi
    stock_borrowed INT NOT NULL DEFAULT 12,  -- Galon dipinjam pelanggan
    stock_broken INT NOT NULL DEFAULT 0      -- Galon rusak / pecah / afkir
);

-- 3. Buat Index untuk Performa Filter Cepat
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.gallon_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_year_month ON public.gallon_transactions(year, month);
CREATE INDEX IF NOT EXISTS idx_transactions_day_name ON public.gallon_transactions(day_name);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.gallon_transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.gallon_transactions(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.gallon_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallon_inventory ENABLE ROW LEVEL SECURITY;

-- 5. Buat Policy RLS Publik (Anon Key)
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

-- 7. Insert Data Awal Default untuk Inventaris jika belum ada
INSERT INTO public.gallon_inventory (id, stock_filled, stock_empty, stock_borrowed, stock_broken)
SELECT gen_random_uuid(), 85, 30, 12, 0
WHERE NOT EXISTS (SELECT 1 FROM public.gallon_inventory);
