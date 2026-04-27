-- ============================================================
-- REWEAR — RUN 5: CRITICAL FIXES
-- Atomic operations, order-seller link, DB constraints
--
-- Run this after 04_marketplace.sql in the Supabase SQL Editor.
-- ============================================================

-- -------------------------------------------------------
-- 1. ADD SELLER_ID TO ORDERS
-- Links each order directly to the seller for faster queries
-- and proper transaction tracking.
-- -------------------------------------------------------
alter table orders
  add column if not exists seller_id uuid references sellers(id) on delete restrict;

-- Backfill existing orders (if any)
update orders o
set seller_id = p.seller_id
from products p
where o.product_id = p.id
  and o.seller_id is null;

-- Add index for seller order queries
create index if not exists idx_orders_seller_id on orders(seller_id);

-- -------------------------------------------------------
-- 2. ADD BUYER_USER_ID TO ORDERS
-- Prepares for future auth integration — links orders to
-- authenticated buyer accounts.
-- -------------------------------------------------------
alter table orders
  add column if not exists buyer_user_id uuid;  -- Will reference auth.users(id) once auth is live

-- Add index for buyer order history queries
create index if not exists idx_orders_buyer_user_id on orders(buyer_user_id);

-- -------------------------------------------------------
-- 3. ADD QUANTITY COLUMN TO PRODUCTS
-- Enables proper inventory management instead of just
-- boolean in_stock flag.
-- -------------------------------------------------------
alter table products
  add column if not exists quantity int not null default 1;

-- Add constraint: quantity must be non-negative
alter table products
  add constraint if not exists quantity_non_negative check (quantity >= 0);

-- Backfill: set quantity=1 for in_stock products, 0 for out of stock
update products
set quantity = case when in_stock then 1 else 0 end
where quantity = 1;  -- Only update rows that still have default value

-- -------------------------------------------------------
-- 4. ADD DB CONSTRAINTS FOR DATA INTEGRITY
-- -------------------------------------------------------

-- Products: price must be positive and reasonable
alter table products
  add constraint if not exists price_positive check (price > 0);

alter table products
  add constraint if not exists price_reasonable check (price < 1000000);

-- Listing fees: amount_paid must be positive
alter table listing_fees
  add constraint if not exists amount_paid_positive check (amount_paid > 0);

-- Listing fees: max_listings must be positive
alter table listing_fees
  add constraint if not exists max_listings_positive check (max_listings > 0);

-- Listing fees: listings_used cannot exceed max_listings
alter table listing_fees
  add constraint if not exists listings_used_within_max check (listings_used <= max_listings);

-- Transactions: amounts must be non-negative
alter table transactions
  add constraint if not exists gross_amount_non_negative check (gross_amount >= 0);

alter table transactions
  add constraint if not exists commission_amount_non_negative check (commission_amount >= 0);

alter table transactions
  add constraint if not exists seller_payout_non_negative check (seller_payout >= 0);

-- Earnings: amount must be positive
alter table earnings
  add constraint if not exists earnings_amount_positive check (amount > 0);

-- -------------------------------------------------------
-- 5. ATOMIC FUNCTION: INCREMENT LISTINGS_USED
-- Prevents race conditions when multiple listings are
-- submitted simultaneously.
-- -------------------------------------------------------
create or replace function increment_listings_used(fee_uuid uuid)
returns void as $$
declare
  v_new_used int;
  v_max_listings int;
begin
  -- Atomic increment with row lock
  update listing_fees
  set listings_used = listings_used + 1
  where id = fee_uuid
  returning listings_used, max_listings into v_new_used, v_max_listings;

  -- Auto-mark as exhausted if limit reached
  if v_new_used >= v_max_listings then
    update listing_fees
    set status = 'exhausted'
    where id = fee_uuid;
  end if;
end;
$$ language plpgsql;

-- -------------------------------------------------------
-- 6. ATOMIC FUNCTION: DECREMENT PRODUCT QUANTITY
-- Automatically decrements product quantity when an order
-- is placed, and marks out of stock when quantity reaches 0.
-- -------------------------------------------------------
create or replace function decrement_product_quantity()
returns trigger as $$
begin
  update products
  set quantity = quantity - coalesce(NEW.quantity, 1),
      in_stock = (quantity - coalesce(NEW.quantity, 1) > 0)
  where id = NEW.product_id;
  
  return NEW;
end;
$$ language plpgsql;

-- Create trigger to auto-decrement on order insert
drop trigger if exists on_order_placed on orders;
create trigger on_order_placed
  after insert on orders
  for each row
  execute function decrement_product_quantity();

-- -------------------------------------------------------
-- 7. FUNCTION: SUBMIT LISTING (ATOMIC TRANSACTION)
-- Combines all listing submission logic into a single
-- atomic database transaction to prevent partial failures.
-- -------------------------------------------------------
create or replace function submit_listing_atomic(
  p_seller_id uuid,
  p_name text,
  p_price numeric,
  p_category text,
  p_image_url text,
  p_description text,
  p_sizes text[],
  p_suggested_price numeric default null
) returns jsonb as $$
declare
  v_fee_id uuid;
  v_product_id uuid;
  v_seller_verified boolean;
begin
  -- 1. Check seller is verified
  select verified into v_seller_verified
  from sellers
  where id = p_seller_id;

  if not v_seller_verified then
    raise exception 'Seller not yet verified by admin';
  end if;

  -- 2. Find active fee with slots (with row lock to prevent race conditions)
  select id into v_fee_id
  from listing_fees
  where seller_id = p_seller_id
    and status = 'active'
    and listings_used < max_listings
    and (expires_at is null or expires_at > now())
  order by expires_at asc nulls last
  limit 1
  for update;  -- Lock the row

  if v_fee_id is null then
    raise exception 'No active listing fee found. Please purchase a listing tier.';
  end if;

  -- 3. Insert product
  insert into products (
    seller_id,
    listing_fee_id,
    name,
    price,
    category,
    image_url,
    description,
    sizes,
    suggested_price,
    status,
    in_stock
  ) values (
    p_seller_id,
    v_fee_id,
    p_name,
    p_price,
    p_category,
    p_image_url,
    p_description,
    p_sizes,
    p_suggested_price,
    'pending',
    true
  ) returning id into v_product_id;

  -- 4. Increment listings_used atomically
  perform increment_listings_used(v_fee_id);

  -- 5. Return product ID
  return jsonb_build_object('product_id', v_product_id, 'success', true);

exception
  when others then
    -- Rollback happens automatically
    return jsonb_build_object('error', SQLERRM, 'success', false);
end;
$$ language plpgsql;

-- -------------------------------------------------------
-- 8. ADD INDEXES FOR COMMON QUERIES
-- -------------------------------------------------------

-- Products: filter by seller and status
create index if not exists idx_products_seller_status on products(seller_id, status);

-- Products: filter by category and in_stock (shop page)
create index if not exists idx_products_category_stock on products(category, in_stock);

-- Orders: filter by status
create index if not exists idx_orders_status on orders(status);

-- Orders: composite for seller order queries
create index if not exists idx_orders_seller_status on orders(seller_id, status);

-- -------------------------------------------------------
-- 9. ADD FULL-TEXT SEARCH TO PRODUCTS
-- -------------------------------------------------------

-- Add search vector column
alter table products
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, ''))
  ) stored;

-- Add GIN index for fast full-text search
create index if not exists idx_products_search on products using gin(search_vector);

-- -------------------------------------------------------
-- 10. UPDATE RLS POLICIES (TEMPORARY - UNTIL AUTH IS LIVE)
-- Add comments indicating these need to be replaced with
-- proper auth-based policies.
-- -------------------------------------------------------

-- NOTE: These policies are TEMPORARY and allow anonymous access.
-- They MUST be replaced with auth.uid() checks once Supabase Auth is implemented.
-- See migration 06_auth_integration.sql for proper RLS policies.

comment on policy "Admin read listing_fees" on listing_fees is 
  'TEMPORARY: Replace with auth-based policy once Supabase Auth is live';

comment on policy "Admin read transactions" on transactions is 
  'TEMPORARY: Replace with auth-based policy once Supabase Auth is live';

comment on policy "Admin read earnings" on earnings is 
  'TEMPORARY: Replace with auth-based policy once Supabase Auth is live';


-- -------------------------------------------------------
-- 11. BUYERS TABLE
-- User profiles for buyers (all users get a buyer profile)
-- -------------------------------------------------------
create table if not exists buyers (
  id uuid primary key,  -- Will reference auth.users(id) once auth is live
  name text not null,
  email text not null unique,
  phone text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add RLS policies for buyers
alter table buyers enable row level security;

-- Temporary policy for development (replace with auth-based policies)
create policy "Buyers can view and edit their own profile" on buyers
  for all using (true);  -- TODO: Replace with auth.uid() = id

-- -------------------------------------------------------
-- 12. BUYER ADDRESSES TABLE
-- Shipping addresses for buyers
-- -------------------------------------------------------
create table if not exists buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references buyers(id) on delete cascade,
  label text not null default 'Home',  -- e.g., 'Home', 'Work', 'Office'
  street_address text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  country text not null default 'Philippines',
  is_default boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Ensure only one default address per buyer
create unique index if not exists idx_buyer_addresses_default 
  on buyer_addresses(buyer_id) where is_default = true;

-- Add RLS policies for buyer addresses
alter table buyer_addresses enable row level security;

-- Temporary policy for development (replace with auth-based policies)
create policy "Buyers can manage their own addresses" on buyer_addresses
  for all using (true);  -- TODO: Replace with auth.uid() = buyer_id

-- Add indexes for buyer addresses
create index if not exists idx_buyer_addresses_buyer_id on buyer_addresses(buyer_id);