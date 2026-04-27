-- ============================================================
-- REWEAR — RUN 6: BUYER FLOW COLUMNS & TABLES
-- Adds missing columns to orders, seller profiles, ratings,
-- and messaging tables needed for the complete buyer flow.
-- Run this after 05_critical_fixes.sql
-- ============================================================

-- -------------------------------------------------------
-- 1. ADD MISSING COLUMNS TO ORDERS
-- -------------------------------------------------------
alter table orders
  add column if not exists delivery_address  text,
  add column if not exists buyer_phone       text,
  add column if not exists payment_reference text,
  add column if not exists payment_proof_url text,
  add column if not exists payment_status    text default 'pending'
    check (payment_status in ('pending','submitted','verified','rejected')),
  add column if not exists payment_rejected_reason text,
  add column if not exists tracking_number   text,
  add column if not exists courier_name      text,
  add column if not exists delivered_at      timestamptz,
  add column if not exists received_at       timestamptz,
  add column if not exists confirmed_at      timestamptz;

-- -------------------------------------------------------
-- 2. ADD GCASH COLUMNS TO SELLERS
-- -------------------------------------------------------
alter table sellers
  add column if not exists gcash_number text,
  add column if not exists gcash_name   text,
  add column if not exists avatar_url   text,
  add column if not exists rating       numeric(2,1) default 5.0,
  add column if not exists total_sales  int default 0;

-- -------------------------------------------------------
-- 3. RATINGS / REVIEWS TABLE
-- Buyers leave a rating after confirming receipt
-- -------------------------------------------------------
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  seller_id   uuid references sellers(id) on delete set null,
  buyer_email text not null,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now()
);

alter table reviews enable row level security;
create policy "Anyone can read reviews"  on reviews for select using (true);
create policy "Anyone can insert review" on reviews for insert with check (true);

create index if not exists idx_reviews_product  on reviews(product_id);
create index if not exists idx_reviews_seller   on reviews(seller_id);
create index if not exists idx_reviews_order    on reviews(order_id);

-- -------------------------------------------------------
-- 4. MESSAGES / INQUIRIES TABLE
-- Buyer-to-seller chat/inquiry system
-- -------------------------------------------------------
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references products(id) on delete set null,
  seller_id    uuid references sellers(id) on delete set null,
  buyer_email  text not null,
  buyer_name   text not null,
  message      text not null,
  reply        text,
  replied_at   timestamptz,
  is_read      boolean default false,
  created_at   timestamptz default now()
);

alter table messages enable row level security;
create policy "Anyone can read messages"  on messages for select using (true);
create policy "Anyone can send message"   on messages for insert with check (true);
create policy "Anyone can update message" on messages for update using (true);

create index if not exists idx_messages_seller  on messages(seller_id);
create index if not exists idx_messages_buyer   on messages(buyer_email);
create index if not exists idx_messages_product on messages(product_id);

-- -------------------------------------------------------
-- 5. EXPAND PRODUCT CATEGORY CONSTRAINT
-- Add 'dresses' category to match the seller form options
-- -------------------------------------------------------
alter table products
  drop constraint if exists products_category_check;

alter table products
  add constraint products_category_check
    check (category in ('shirts','pants','jackets','shoes','accessories','dresses','bags'));

-- -------------------------------------------------------
-- 6. ADD MISSING COLUMNS TO PRODUCTS
-- -------------------------------------------------------
alter table products
  add column if not exists condition text
    check (condition in ('new','like-new','excellent','good','fair')),
  add column if not exists brand text;

-- -------------------------------------------------------
-- 7. ADD FEE PROOF UPLOAD TO LISTING_FEES
-- -------------------------------------------------------
alter table listing_fees
  add column if not exists proof_url        text,
  add column if not exists fee_status       text default 'pending_payment'
    check (fee_status in ('pending_payment','proof_submitted','active','expired','exhausted','rejected')),
  add column if not exists rejection_reason text;
