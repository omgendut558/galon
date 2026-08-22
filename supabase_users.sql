-- ============================================================
-- GalonTracker - Tabel Pengguna (login ID + PIN, tanpa email)
-- Jalankan sekali di: Supabase Dashboard > SQL Editor > New query
--
-- Skrip ini juga MENGHAPUS tabel gallon_users versi lama
-- (yang masih terkait Supabase Auth / email) beserta akun
-- contoh di dalamnya, lalu membuat ulang dengan skema baru.
-- Setelah ini, daftarkan akun Anda lagi lewat aplikasi
-- (tab Daftar) - langsung aktif tanpa konfirmasi apa pun.
-- ============================================================

-- 1. Bersihkan sisa skema lama
drop table if exists public.gallon_users cascade;
drop trigger if exists trg_on_auth_user_created on auth.users;
drop function if exists public.handle_new_galon_user();

-- 2. Tabel pengguna baru
create table public.gallon_users (
    id uuid primary key default gen_random_uuid(),
    login_id varchar(50) unique not null,
    full_name varchar(120),
    pin_hash varchar(64) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.gallon_users is 'Akun GalonTracker (ID + PIN, hash SHA-256).';

-- 3. Keamanan baris: semua boleh baca & mendaftar
alter table public.gallon_users enable row level security;

create policy "gallon_users_select_all"
    on public.gallon_users for select
    using (true);

create policy "gallon_users_insert_all"
    on public.gallon_users for insert
    with check (true);

-- 4. updated_at otomatis saat baris diubah
create or replace function public.gallon_users_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_gallon_users_updated_at
    before update on public.gallon_users
    for each row execute function public.gallon_users_touch_updated_at();
