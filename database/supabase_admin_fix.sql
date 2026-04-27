-- ============================================================
-- REWEAR — Admin RLS Fix
-- Run this ENTIRE file in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
--
-- This fixes the issue where admin dashboard shows no data.
-- Root cause: Missing RLS policies for anon role on all tables.
-- ============================================================


-- ============================================================
-- PRODUCTS — Admin needs to read ALL products (pending too)
-- ============================================================
drop policy if exists "Public can read products" on products;
drop policy if exists "Admin can read all products" on products;

-- Buyers see only approved + in_stock
create policy "Buyers read approved products"
  on products for select
  to anon
  using (status = 'approved' and in_stock = true);

-- NOTE: Since admin also uses anon key, we allow all reads.
-- The above policy is overridden by the one below for admin use.
-- Supabase evaluates OR across all matching policies.
create policy "Admin can read all products"
  on products for select
  to anon
  using (true);

-- Admin update (approve/reject)
drop policy if exists "Admin can update products" on products;
create policy "Admin can update products"
  on products for update
  to anon
  using (true)
  with check (true);

-- Sellers can insert products
drop policy if exists "Sellers can insert products" on products;
create policy "Sellers can insert products"
  on products for insert
  to anon
  with check (true);


-- ============================================================
-- SELLERS — Admin reads all, anyone can apply
-- ============================================================
drop policy if exists "Public can read verified sellers" on sellers;
drop policy if exists "Admin can read all sellers" on sellers;
drop policy if exists "Anyone can apply as seller" on sellers;
drop policy if exists "Admin can update sellers" on sellers;

create policy "Admin can read all sellers"
  on sellers for select
  to anon
  using (true);

create policy "Anyone can apply as seller"
  on sellers for insert
  to anon
  with check (true);

create policy "Admin can update sellers"
  on sellers for update
  to anon
  using (true)
  with check (true);


-- ============================================================
-- ORDERS — Admin reads and updates all
-- ============================================================
drop policy if exists "Anyone can place an order" on orders;
drop policy if exists "Buyers can view their own orders" on orders;
drop policy if exists "Admin can read all orders" on orders;
drop policy if exists "Admin can update orders" on orders;

create policy "Anyone can place an order"
  on orders for insert
  to anon
  with check (true);

create policy "Admin can read all orders"
  on orders for select
  to anon
  using (true);

create policy "Admin can update orders"
  on orders for update
  to anon
  using (true)
  with check (true);


-- ============================================================
-- TRANSACTIONS — Create table if missing, add full RLS
-- ============================================================
create table if not exists transactions (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid references orders(id) on delete set null,
  seller_id         uuid references sellers(id) on delete set null,
  gross_amount      numeric(10,2) not null,
  commission_rate   numeric(5,4) not null,
  commission_amount numeric(10,2) not null,
  seller_payout     numeric(10,2) not null,
  status            text default 'pending' check (status in ('pending','released')),
  released_at       timestamptz,
  created_at        timestamptz default now()
);

alter table transactions enable row level security;

drop policy if exists "Admin can read all transactions" on transactions;
drop policy if exists "Admin can insert transactions" on transactions;
drop policy if exists "Admin can update transactions" on transactions;

create policy "Admin can read all transactions"
  on transactions for select
  to anon
  using (true);

create policy "Admin can insert transactions"
  on transactions for insert
  to anon
  with check (true);

create policy "Admin can update transactions"
  on transactions for update
  to anon
  using (true)
  with check (true);

-- Add transaction_id column to orders if missing
alter table orders
  add column if not exists transaction_id uuid references transactions(id) on delete set null;


-- ============================================================
-- EARNINGS — Create table if missing, add full RLS
-- ============================================================
create table if not exists earnings (
  id           uuid primary key default gen_random_uuid(),
  source       text not null check (source in ('commission','listing_fee')),
  reference_id uuid,
  amount       numeric(10,2) not null,
  created_at   timestamptz default now()
);

alter table earnings enable row level security;

drop policy if exists "Admin can read all earnings" on earnings;
drop policy if exists "Admin can insert earnings" on earnings;

create policy "Admin can read all earnings"
  on earnings for select
  to anon
  using (true);

create policy "Admin can insert earnings"
  on earnings for insert
  to anon
  with check (true);


-- ============================================================
-- LISTING FEES — Create table if missing, add full RLS
-- ============================================================
create table if not exists listing_fees (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid references sellers(id) on delete cascade,
  tier           text default 'basic' check (tier in ('basic','standard','premium')),
  amount_paid    numeric(10,2) default 0,
  max_listings   int default 5,
  listings_used  int default 0,
  status         text default 'pending' check (status in ('pending','active','expired')),
  payment_method text,
  payment_ref    text,
  paid_at        timestamptz,
  created_at     timestamptz default now()
);

alter table listing_fees enable row level security;

drop policy if exists "Admin can read all listing fees" on listing_fees;
drop policy if exists "Admin can insert listing fees" on listing_fees;
drop policy if exists "Admin can update listing fees" on listing_fees;
drop policy if exists "Sellers can read own listing fees" on listing_fees;
drop policy if exists "Sellers can insert listing fees" on listing_fees;

create policy "Admin can read all listing fees"
  on listing_fees for select
  to anon
  using (true);

create policy "Admin can insert listing fees"
  on listing_fees for insert
  to anon
  with check (true);

create policy "Admin can update listing fees"
  on listing_fees for update
  to anon
  using (true)
  with check (true);


-- ============================================================
-- PRODUCTS — Add missing columns if not present
-- ============================================================
alter table products
  add column if not exists status       text default 'pending'
    check (status in ('pending','approved','rejected')),
  add column if not exists in_stock     boolean default true,
  add column if not exists rejection_reason text,
  add column if not exists seller_id    uuid references sellers(id) on delete set null,
  add column if not exists sizes        text[] default array['S','M','L'],
  add column if not exists description  text,
  add column if not exists suggested_price numeric(10,2);


-- ============================================================
-- SELLERS — Add missing columns if not present
-- ============================================================
alter table sellers
  add column if not exists rejection_reason text,
  add column if not exists verified_at      timestamptz,
  add column if not exists phone            text,
  add column if not exists description      text;


-- ============================================================
-- ORDERS — Add missing columns if not present
-- ============================================================
alter table orders
  add column if not exists status text default 'pending'
    check (status in ('pending','confirmed','shipped','delivered','received','cancelled')),
  add column if not exists buyer_name  text,
  add column if not exists buyer_email text,
  add column if not exists size_selected text,
  add column if not exists quantity    int default 1,
  add column if not exists total_price numeric(10,2);


-- ============================================================
-- VERIFY: Quick check — run these SELECT statements to confirm
-- data is visible. If they return rows, the fix worked.
-- ============================================================
-- select count(*) from sellers;
-- select count(*) from products;
-- select count(*) from orders;
-- select count(*) from transactions;
-- select count(*) from earnings;
-- select count(*) from listing_fees;
