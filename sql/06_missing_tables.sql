-- ============================================================
-- REWEAR — RUN 6: MISSING TABLES & COLUMNS
-- seller_applications table + orders.payment_status column
-- Run this after 05_critical_fixes.sql
-- ============================================================

-- -------------------------------------------------------
-- 1. SELLER APPLICATIONS TABLE
-- Tracks seller sign-up applications for admin review
-- -------------------------------------------------------
create table if not exists seller_applications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  business_name       text not null,
  email               text not null,
  phone               text,
  address             text,
  business_description text,
  years_in_business   text,
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected')),
  rejection_reason    text,
  submitted_at        timestamptz default now(),
  reviewed_at         timestamptz,
  reviewed_by         text
);

alter table seller_applications enable row level security;

create policy "Anyone can apply"              on seller_applications for insert to anon with check (true);
create policy "Admin read all applications"   on seller_applications for select to anon using (true);
create policy "Admin update applications"     on seller_applications for update to anon using (true) with check (true);

create index if not exists idx_seller_apps_user_id on seller_applications(user_id);
create index if not exists idx_seller_apps_status  on seller_applications(status);

-- -------------------------------------------------------
-- 2. ADD payment_status TO orders
-- Tracks GCash payment proof submission & verification
-- -------------------------------------------------------
alter table orders
  add column if not exists payment_status text default 'pending'
    check (payment_status in ('pending', 'submitted', 'verified', 'rejected'));

alter table orders
  add column if not exists payment_proof_url  text;

alter table orders
  add column if not exists payment_reference  text;

alter table orders
  add column if not exists buyer_phone        text;

alter table orders
  add column if not exists delivery_address   text;

alter table orders
  add column if not exists tracking_number    text;

alter table orders
  add column if not exists courier_name       text;

alter table orders
  add column if not exists confirmed_at       timestamptz;

alter table orders
  add column if not exists delivered_at       timestamptz;

-- Index for payment status queries
create index if not exists idx_orders_payment_status on orders(payment_status);

-- -------------------------------------------------------
-- 3. ADD EXTRA COLUMNS TO sellers
-- verification_level used by admin approval flow
-- gcash_number/gcash_name for payment display
-- -------------------------------------------------------
alter table sellers
  add column if not exists verification_level text default 'basic';

alter table sellers
  add column if not exists gcash_number text;

alter table sellers
  add column if not exists gcash_name text;

-- -------------------------------------------------------
-- 6. ADD proof_submitted STATUS TO listing_fees
-- Needed for admin fee verification flow
-- -------------------------------------------------------
alter table listing_fees drop constraint if exists listing_fees_status_check;
alter table listing_fees
  add constraint listing_fees_status_check
  check (status in ('pending', 'proof_submitted', 'active', 'expired', 'exhausted', 'rejected'));

-- Add proof_url column for payment proof uploads
alter table listing_fees
  add column if not exists proof_url text;

alter table listing_fees
  add column if not exists rejection_reason text;
-- Used by admin approval/rejection flows
-- -------------------------------------------------------
create table if not exists notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  notification_type text not null,
  title             text not null,
  message           text,
  data              jsonb,
  read              boolean default false,
  created_at        timestamptz default now()
);

alter table notifications enable row level security;
create policy "Anyone can read notifications" on notifications for select to anon using (true);
create policy "Anyone can insert notifications" on notifications for insert to anon with check (true);
create policy "Anyone can update notifications" on notifications for update to anon using (true) with check (true);

-- -------------------------------------------------------
-- 5. MARKETPLACE ACTIVITY LOGS TABLE
-- Used by admin approval/rejection flows
-- -------------------------------------------------------
create table if not exists marketplace_activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  user_type   text,
  action_type text not null,
  target_id   uuid,
  target_type text,
  details     jsonb,
  created_at  timestamptz default now()
);

alter table marketplace_activity_logs enable row level security;
create policy "Admin read logs"   on marketplace_activity_logs for select to anon using (true);
create policy "Admin insert logs" on marketplace_activity_logs for insert to anon with check (true);
