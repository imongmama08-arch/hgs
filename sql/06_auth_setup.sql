-- ============================================================
-- REWEAR — RUN 6: Supabase Auth Setup
-- Run this in Supabase SQL Editor AFTER running RUN_THIS_IN_SUPABASE.sql
--
-- This wires Supabase Auth to your sellers/buyers tables so
-- when a user signs up, their profile is auto-created.
-- ============================================================


-- ============================================================
-- 1. AUTO-CREATE SELLER RECORD ON SIGNUP
-- When a user signs up with accountType = 'seller',
-- automatically insert a row into the sellers table.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_account_type text;
  v_name         text;
begin
  v_account_type := new.raw_user_meta_data->>'accountType';
  v_name         := new.raw_user_meta_data->>'name';

  -- Always create a buyer profile
  insert into public.buyers (id, name, email)
  values (
    new.id,
    coalesce(v_name, split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  -- If seller, also create a sellers record
  if v_account_type = 'seller' then
    insert into public.sellers (id, user_id, business_name, email, verified)
    values (
      new.id,
      new.id,
      coalesce(v_name, split_part(new.email, '@', 1)),
      new.email,
      false
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Drop old trigger if exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 2. RLS — Allow authenticated users to read their own data
-- ============================================================

-- Buyers can read/update their own profile
drop policy if exists "Buyers read own profile"   on buyers;
drop policy if exists "Buyers update own profile" on buyers;
drop policy if exists "Anyone can manage buyers"  on buyers;
drop policy if exists "Admin read all buyers"     on buyers;

create policy "Buyers read own profile"
  on buyers for select
  using (auth.uid() = id);

create policy "Buyers update own profile"
  on buyers for update
  using (auth.uid() = id);

create policy "Admin read all buyers"
  on buyers for select
  to anon
  using (true);

-- Sellers can read their own record
drop policy if exists "Sellers read own record" on sellers;

create policy "Sellers read own record"
  on sellers for select
  using (auth.uid() = id);

-- Products: sellers can insert their own products
drop policy if exists "Sellers insert own products" on products;

create policy "Sellers insert own products"
  on products for insert
  to authenticated
  with check (auth.uid()::text = seller_id::text);

-- Products: sellers can update their own products
drop policy if exists "Sellers update own products" on products;

create policy "Sellers update own products"
  on products for update
  to authenticated
  using (auth.uid()::text = seller_id::text);

-- Orders: buyers can read their own orders
drop policy if exists "Buyers read own orders" on orders;

create policy "Buyers read own orders"
  on orders for select
  to authenticated
  using (auth.uid()::text = buyer_user_id::text);

-- Admin read all buyers (drop first to avoid duplicate error)
drop policy if exists "Admin read all buyers" on buyers;

create policy "Admin read all buyers"
  on buyers for select
  to anon
  using (true);


-- ============================================================
-- 3. VERIFY — Check the trigger was created
-- ============================================================
select trigger_name, event_manipulation, event_object_table
from information_schema.triggers
where trigger_name = 'on_auth_user_created';