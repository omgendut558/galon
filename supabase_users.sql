-- ============================================================
-- GalonTracker - Skema Database Lengkap Multi-User
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > New query
--
-- Fitur:
-- 1. Autentikasi Pengguna (ID + PIN sha-256)
-- 2. Transaksi Galon terisolasi per akun pengguna (user_id)
-- 3. Stok Inventaris Galon terisolasi per akun pengguna (user_id)
-- ============================================================

-- 1. Tabel Pengguna (gallon_users)
create table if not exists public.gallon_users (
    id uuid primary key default gen_random_uuid(),
    login_id varchar(50) unique not null,
    full_name varchar(120),
    pin_hash varchar(64) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.gallon_users is 'Akun Pengguna GalonTracker (ID + PIN, hash SHA-256).';

-- 2. Tabel Transaksi Galon (gallon_transactions)
create table if not exists public.gallon_transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.gallon_users(id) on delete cascade,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    date date not null default current_date,
    time time not null default current_time,
    day_name varchar(20) not null,
    day_of_week int not null,
    month int not null,
    year int not null,
    type varchar(20) not null check (type in ('keluar', 'masuk')),
    category varchar(100) not null default 'Umum',
    gallon_qty int not null default 1 check (gallon_qty > 0),
    customer_name varchar(150),
    notes text
);

-- Pastikan kolom user_id ada jika tabel sudah dibuat sebelumnya
do $$
begin
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'gallon_transactions') then
        if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gallon_transactions' and column_name = 'user_id') then
            alter table public.gallon_transactions add column user_id uuid references public.gallon_users(id) on delete cascade;
        end if;
    end if;
end $$;

-- 3. Tabel Inventaris Galon per Pengguna (gallon_inventory)
create table if not exists public.gallon_inventory (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.gallon_users(id) on delete cascade,
    updated_at timestamptz default now(),
    stock_filled int not null default 85,
    stock_empty int not null default 30,
    stock_borrowed int not null default 12,
    stock_broken int not null default 0,
    constraint unique_user_inventory unique (user_id)
);

-- Pastikan kolom user_id ada jika tabel sudah dibuat sebelumnya
do $$
begin
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'gallon_inventory') then
        if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gallon_inventory' and column_name = 'user_id') then
            alter table public.gallon_inventory add column user_id uuid references public.gallon_users(id) on delete cascade;
            delete from public.gallon_inventory where user_id is null;
            if not exists (
                select 1 from information_schema.table_constraints 
                where table_name = 'gallon_inventory' and constraint_name = 'unique_user_inventory'
            ) then
                alter table public.gallon_inventory add constraint unique_user_inventory unique (user_id);
            end if;
        end if;
    end if;
end $$;

-- 4. Indeks Performa Query
create index if not exists idx_users_login_id on public.gallon_users(login_id);
create index if not exists idx_transactions_user_id on public.gallon_transactions(user_id);
create index if not exists idx_transactions_user_date on public.gallon_transactions(user_id, date desc);
create index if not exists idx_transactions_user_type on public.gallon_transactions(user_id, type);
create index if not exists idx_inventory_user_id on public.gallon_inventory(user_id);

-- 5. Row Level Security (RLS) & Policies
alter table public.gallon_users enable row level security;
alter table public.gallon_transactions enable row level security;
alter table public.gallon_inventory enable row level security;

-- Policy untuk gallon_users
drop policy if exists "gallon_users_select_all" on public.gallon_users;
create policy "gallon_users_select_all" on public.gallon_users for select using (true);

drop policy if exists "gallon_users_insert_all" on public.gallon_users;
create policy "gallon_users_insert_all" on public.gallon_users for insert with check (true);

drop policy if exists "gallon_users_update_all" on public.gallon_users;
create policy "gallon_users_update_all" on public.gallon_users for update using (true) with check (true);

-- Policy untuk gallon_transactions
drop policy if exists "Access for transactions" on public.gallon_transactions;
drop policy if exists "gallon_transactions_all" on public.gallon_transactions;
create policy "gallon_transactions_all" on public.gallon_transactions for all to authenticated, anon using (true) with check (true);

-- Policy untuk gallon_inventory
drop policy if exists "Access for inventory" on public.gallon_inventory;
drop policy if exists "gallon_inventory_all" on public.gallon_inventory;
create policy "gallon_inventory_all" on public.gallon_inventory for all to authenticated, anon using (true) with check (true);

-- 6. Trigger Otomatis updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_gallon_users_updated_at on public.gallon_users;
create trigger trg_gallon_users_updated_at
    before update on public.gallon_users
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_gallon_transactions_updated_at on public.gallon_transactions;
create trigger trg_gallon_transactions_updated_at
    before update on public.gallon_transactions
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_gallon_inventory_updated_at on public.gallon_inventory;
create trigger trg_gallon_inventory_updated_at
    before update on public.gallon_inventory
    for each row execute function public.touch_updated_at();
