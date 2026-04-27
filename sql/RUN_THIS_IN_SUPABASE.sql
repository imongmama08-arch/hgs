-- ============================================================
-- REWEAR — SAFE SETUP (Run anytime, as many times as you want)
-- 
-- Uses IF NOT EXISTS everywhere:
--   - Tables already exist? SKIPPED (data kept safe)
--   - Columns already exist? SKIPPED
--   - Policies already exist? SKIPPED
--   - Data already seeded? SKIPPED
--
-- Supabase Dashboard → SQL Editor → New Query → Paste → RUN
-- ============================================================


-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  price            numeric(10,2) not null,
  category         text not null,
  image_url        text,
  rating           numeric(2,1) default 5.0,
  in_stock         boolean default true,
  quantity         int default 1,
  status           text default 'approved',
  sizes            text[] default array['S','M','L'],
  suggested_price  numeric(10,2),
  description      text,
  rejection_reason text,
  seller_id        uuid,
  listing_fee_id   uuid,
  created_at       timestamptz default now()
);

-- Add columns if they don't exist yet
alter table products add column if not exists quantity         int default 1;
alter table products add column if not exists status          text default 'approved';
alter table products add column if not exists sizes           text[] default array['S','M','L'];
alter table products add column if not exists suggested_price numeric(10,2);
alter table products add column if not exists description     text;
alter table products add column if not exists rejection_reason text;
alter table products add column if not exists seller_id       uuid;
alter table products add column if not exists listing_fee_id  uuid;
alter table products add column if not exists in_stock        boolean default true;

-- Seed sample products only if table is empty
insert into products (name, price, category, image_url, rating, sizes, suggested_price, status, in_stock)
select * from (values
  ('Premium Cotton Shirt',  89.00,  'shirts',      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&q=80', 5.0, array['S','M','L'],         75.00,  'approved', true),
  ('Classic Denim Jacket',  129.00, 'jackets',     'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80',   5.0, array['S','M','L','XL'],    110.00, 'approved', true),
  ('Tailored Trousers',     109.00, 'pants',       'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&q=80', 4.0, array['S','M','L'],         92.00,  'approved', true),
  ('Linen Blend Shirt',     79.00,  'shirts',      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80', 5.0, array['S','M','L'],         67.00,  'approved', true),
  ('Leather Sneakers',      149.00, 'shoes',       'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=600&q=80', 5.0, array['38','40','42','44'], 126.00, 'approved', true),
  ('Wool Overcoat',         259.00, 'jackets',     'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&q=80',   5.0, array['S','M','L','XL'],    220.00, 'approved', true),
  ('Slim Fit Jeans',        99.00,  'pants',       'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&q=80', 4.0, array['S','M','L'],         84.00,  'approved', true),
  ('Leather Messenger Bag', 189.00, 'accessories', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',   5.0, array['One Size'],           160.00, 'approved', true),
  ('Oxford Shirt',          85.00,  'shirts',      'https://images.unsplash.com/photo-1602810319250-971d62e889f3?w=600&q=80', 5.0, array['S','M','L'],         72.00,  'approved', true),
  ('Bomber Jacket',         139.00, 'jackets',     'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', 4.0, array['S','M','L','XL'],    118.00, 'approved', true),
  ('Chelsea Boots',         169.00, 'shoes',       'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600&q=80', 5.0, array['38','40','42','44'], 143.00, 'approved', true),
  ('Leather Belt',          59.00,  'accessories', 'https://images.unsplash.com/photo-1523772354886-34a1dc2f72e7?w=600&q=80', 5.0, array['One Size'],           50.00,  'approved', true)
) as v(name, price, category, image_url, rating, sizes, suggested_price, status, in_stock)
where not exists (select 1 from products limit 1);


-- ============================================================
-- BLOG POSTS TABLE
-- ============================================================
create table if not exists blog_posts (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  excerpt           text,
  category          text not null,
  image_url         text,
  read_time_minutes int default 5,
  published_at      timestamptz default now(),
  created_at        timestamptz default now()
);

insert into blog_posts (title, excerpt, category, image_url, read_time_minutes, published_at)
select * from (values
  ('How to master the art of minimalist street style',    'Discover the secrets to creating effortlessly chic looks with a capsule wardrobe.',                        'style',   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80', 5, '2026-04-15 00:00:00+00'::timestamptz),
  ('Spring essentials: what''s trending for the season',  'From oversized blazers to tailored trousers, explore the key pieces defining this season''s aesthetic.',   'trends',  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80', 4, '2026-04-12 00:00:00+00'::timestamptz),
  ('Premium fabric care: keeping your pieces timeless',   'Expert tips on washing, storing, and maintaining your premium wardrobe for years to come.',                'care',    'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80', 6, '2026-04-10 00:00:00+00'::timestamptz),
  ('Behind the collection: designing with intention',     'An inside look at how our design team creates pieces that balance form, function, and timeless appeal.',    'stories', 'https://images.unsplash.com/photo-1558769132-cb1aea1c8347?w=800&q=80', 7, '2026-04-08 00:00:00+00'::timestamptz),
  ('Layering techniques for transitional weather',        'Master the art of layering with our guide to creating depth and dimension in your outfits.',                'style',   'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80', 5, '2026-04-05 00:00:00+00'::timestamptz),
  ('The fashion industry''s shift toward sustainability', 'Exploring how conscious consumption and ethical production are reshaping modern fashion.',                  'trends',  'https://images.unsplash.com/photo-1467043198406-dc953a3defa0?w=800&q=80', 8, '2026-04-03 00:00:00+00'::timestamptz),
  ('10 wardrobe essentials every closet needs',           'Build a foundation of versatile pieces that work seamlessly together for endless styling options.',         'style',   'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=800&q=80', 6, '2026-04-01 00:00:00+00'::timestamptz),
  ('The artisans behind your favorite pieces',            'Meet the skilled craftspeople who bring precision and passion to every stitch and seam.',                   'stories', 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80', 7, '2026-03-28 00:00:00+00'::timestamptz),
  ('The definitive guide to leather shoe care',           'Keep your premium leather footwear looking pristine with these essential maintenance techniques.',          'care',    'https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=800&q=80', 5, '2026-03-25 00:00:00+00'::timestamptz)
) as v(title, excerpt, category, image_url, read_time_minutes, published_at)
where not exists (select 1 from blog_posts limit 1);


-- ============================================================
-- NEWSLETTER + CONTACT TABLES
-- ============================================================
create table if not exists newsletter_subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  subscribed_at timestamptz default now()
);

create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name  text not null,
  email      text not null,
  phone      text,
  subject    text not null,
  message    text not null,
  created_at timestamptz default now()
);


-- ============================================================
-- SELLERS TABLE
-- ============================================================
create table if not exists sellers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid,
  business_name    text not null,
  email            text not null unique,
  phone            text,
  description      text,
  verified         boolean default false,
  verified_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz default now()
);

-- Add columns if missing
alter table sellers add column if not exists user_id          uuid;
alter table sellers add column if not exists phone            text;
alter table sellers add column if not exists description      text;
alter table sellers add column if not exists verified_at      timestamptz;
alter table sellers add column if not exists rejection_reason text;

-- Seed 3 sample sellers only if table is empty
insert into sellers (business_name, email, phone, description, verified)
select * from (values
  ('Maria Fashion Store', 'maria@example.com', '+63 912 345 6789', 'Selling pre-loved designer clothes', false),
  ('Juan Thrift Shop',    'juan@example.com',  '+63 917 234 5678', 'Affordable second-hand clothing',    false),
  ('Ana Vintage Closet',  'ana@example.com',   '+63 918 345 6789', 'Curated vintage pieces',             true)
) as v(business_name, email, phone, description, verified)
where not exists (select 1 from sellers limit 1);


-- ============================================================
-- ORDERS TABLE
-- ============================================================
create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid references products(id) on delete set null,
  seller_id      uuid,
  buyer_name     text not null,
  buyer_email    text not null,
  size_selected  text,
  quantity       int default 1,
  total_price    numeric(10,2),
  status         text default 'pending',
  transaction_id uuid,
  buyer_user_id  uuid,
  created_at     timestamptz default now()
);

-- Add columns if missing
alter table orders add column if not exists seller_id      uuid;
alter table orders add column if not exists transaction_id uuid;
alter table orders add column if not exists buyer_user_id  uuid;
alter table orders add column if not exists size_selected  text;
alter table orders add column if not exists quantity       int default 1;
alter table orders add column if not exists total_price    numeric(10,2);

-- Seed 2 sample orders only if table is empty
insert into orders (buyer_name, buyer_email, size_selected, quantity, total_price, status)
select * from (values
  ('Jose Santos', 'jose@example.com', 'M', 1, 89.00,  'pending'::text),
  ('Liza Reyes',  'liza@example.com', 'L', 1, 129.00, 'confirmed'::text)
) as v(buyer_name, buyer_email, size_selected, quantity, total_price, status)
where not exists (select 1 from orders limit 1);


-- ============================================================
-- WISHLISTS TABLE
-- ============================================================
create table if not exists wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  product_id uuid not null references products(id) on delete cascade,
  added_at   timestamptz default now(),
  unique (user_id, product_id)
);


-- ============================================================
-- ADMIN SESSIONS TABLE (PIN: 1234)
-- ============================================================
create table if not exists admin_sessions (
  id         uuid primary key default gen_random_uuid(),
  pin_hash   text not null,
  created_at timestamptz default now()
);

-- Insert default PIN only if no PIN exists yet
insert into admin_sessions (pin_hash)
select '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
where not exists (select 1 from admin_sessions limit 1);


-- ============================================================
-- LISTING FEES TABLE
-- ============================================================
create table if not exists listing_fees (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references sellers(id) on delete cascade,
  tier           text not null default 'basic',
  amount_paid    numeric(10,2) not null default 0,
  max_listings   int not null default 5,
  listings_used  int not null default 0,
  status         text not null default 'active',
  paid_at        timestamptz default now(),
  expires_at     timestamptz,
  payment_method text,
  payment_ref    text,
  created_at     timestamptz default now()
);

-- Add columns if missing
alter table listing_fees add column if not exists payment_method text;
alter table listing_fees add column if not exists payment_ref    text;
alter table listing_fees add column if not exists expires_at     timestamptz;


-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
create table if not exists transactions (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid references orders(id) on delete restrict,
  seller_id         uuid references sellers(id) on delete restrict,
  gross_amount      numeric(10,2) not null,
  commission_rate   numeric(4,3) not null,
  commission_amount numeric(10,2) not null,
  seller_payout     numeric(10,2) not null,
  status            text not null default 'pending',
  released_at       timestamptz,
  created_at        timestamptz default now()
);

-- Add columns if missing
alter table transactions add column if not exists released_at timestamptz;


-- ============================================================
-- EARNINGS TABLE
-- ============================================================
create table if not exists earnings (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,
  reference_id uuid,
  amount       numeric(10,2) not null,
  recorded_at  timestamptz default now()
);


-- ============================================================
-- BUYERS TABLE
-- ============================================================
create table if not exists buyers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null unique,
  phone      text,
  created_at timestamptz default now()
);

create table if not exists buyer_addresses (
  id             uuid primary key default gen_random_uuid(),
  buyer_id       uuid not null references buyers(id) on delete cascade,
  label          text not null default 'Home',
  street_address text not null,
  city           text not null,
  province       text not null,
  postal_code    text not null,
  country        text not null default 'Philippines',
  is_default     boolean not null default false,
  created_at     timestamptz default now()
);


-- ============================================================
-- ROW LEVEL SECURITY — safe to re-run (drop if exists first)
-- ============================================================

-- Enable RLS on all tables
alter table products              enable row level security;
alter table blog_posts            enable row level security;
alter table newsletter_subscribers enable row level security;
alter table contact_messages      enable row level security;
alter table sellers               enable row level security;
alter table orders                enable row level security;
alter table wishlists             enable row level security;
alter table admin_sessions        enable row level security;
alter table listing_fees          enable row level security;
alter table transactions          enable row level security;
alter table earnings              enable row level security;
alter table buyers                enable row level security;
alter table buyer_addresses       enable row level security;

-- Drop old policies first so re-running doesn't error
drop policy if exists "Public read approved products"  on products;
drop policy if exists "Admin read all products"        on products;
drop policy if exists "Admin insert products"          on products;
drop policy if exists "Admin update products"          on products;
drop policy if exists "Public read products"           on products;
drop policy if exists "Buyers read approved products"  on products;

drop policy if exists "Public read blog posts"         on blog_posts;

drop policy if exists "Anyone can subscribe"           on newsletter_subscribers;
drop policy if exists "Anyone can read subscribers"    on newsletter_subscribers;

drop policy if exists "Anyone can contact"             on contact_messages;

drop policy if exists "Anyone can apply as seller"     on sellers;
drop policy if exists "Admin read all sellers"         on sellers;
drop policy if exists "Admin update sellers"           on sellers;
drop policy if exists "Public can read verified sellers" on sellers;

drop policy if exists "Anyone can place order"         on orders;
drop policy if exists "Admin read all orders"          on orders;
drop policy if exists "Admin update orders"            on orders;
drop policy if exists "Anyone can read orders"         on orders;
drop policy if exists "Buyers can view their own orders" on orders;

drop policy if exists "Users manage own wishlist"      on wishlists;

drop policy if exists "Admin read sessions"            on admin_sessions;
drop policy if exists "Admin can read sessions"        on admin_sessions;

drop policy if exists "Admin read listing fees"        on listing_fees;
drop policy if exists "Admin insert listing fees"      on listing_fees;
drop policy if exists "Admin update listing fees"      on listing_fees;
drop policy if exists "Admin read listing_fees"        on listing_fees;
drop policy if exists "Admin insert listing_fees"      on listing_fees;
drop policy if exists "Admin update listing_fees"      on listing_fees;

drop policy if exists "Admin read transactions"        on transactions;
drop policy if exists "Admin insert transactions"      on transactions;
drop policy if exists "Admin update transactions"      on transactions;

drop policy if exists "Admin read earnings"            on earnings;
drop policy if exists "Admin insert earnings"          on earnings;

drop policy if exists "Anyone can manage buyers"       on buyers;
drop policy if exists "Anyone can manage addresses"    on buyer_addresses;
drop policy if exists "Buyers can manage their own addresses" on buyer_addresses;
drop policy if exists "Buyers can view and edit their own profile" on buyers;

-- Create all policies fresh
create policy "Public read approved products"  on products for select to anon using (status = 'approved' and in_stock = true);
create policy "Admin read all products"        on products for select to anon using (true);
create policy "Admin insert products"          on products for insert to anon with check (true);
create policy "Admin update products"          on products for update to anon using (true) with check (true);

create policy "Public read blog posts"         on blog_posts for select to anon using (true);

create policy "Anyone can subscribe"           on newsletter_subscribers for insert to anon with check (true);
create policy "Anyone can read subscribers"    on newsletter_subscribers for select to anon using (true);

create policy "Anyone can contact"             on contact_messages for insert to anon with check (true);

create policy "Anyone can apply as seller"     on sellers for insert to anon with check (true);
create policy "Admin read all sellers"         on sellers for select to anon using (true);
create policy "Admin update sellers"           on sellers for update to anon using (true) with check (true);

create policy "Anyone can place order"         on orders for insert to anon with check (true);
create policy "Admin read all orders"          on orders for select to anon using (true);
create policy "Admin update orders"            on orders for update to anon using (true) with check (true);

create policy "Users manage own wishlist"      on wishlists for all using (auth.uid() = user_id);

create policy "Admin read sessions"            on admin_sessions for select to anon using (true);

create policy "Admin read listing fees"        on listing_fees for select to anon using (true);
create policy "Admin insert listing fees"      on listing_fees for insert to anon with check (true);
create policy "Admin update listing fees"      on listing_fees for update to anon using (true) with check (true);

create policy "Admin read transactions"        on transactions for select to anon using (true);
create policy "Admin insert transactions"      on transactions for insert to anon with check (true);
create policy "Admin update transactions"      on transactions for update to anon using (true) with check (true);

create policy "Admin read earnings"            on earnings for select to anon using (true);
create policy "Admin insert earnings"          on earnings for insert to anon with check (true);

create policy "Anyone can manage buyers"       on buyers for all to anon using (true) with check (true);
create policy "Anyone can manage addresses"    on buyer_addresses for all to anon using (true) with check (true);


-- ============================================================
-- INDEXES (safe to re-run)
-- ============================================================
create index if not exists idx_products_seller_status  on products(seller_id, status);
create index if not exists idx_products_category_stock on products(category, in_stock);
create index if not exists idx_orders_status           on orders(status);
create index if not exists idx_orders_seller_status    on orders(seller_id, status);
create index if not exists idx_listing_fees_seller     on listing_fees(seller_id, status);
create index if not exists idx_transactions_seller     on transactions(seller_id, status);
create index if not exists idx_earnings_source         on earnings(source, recorded_at);


-- ============================================================
-- VERIFY — shows row counts for all tables
-- ============================================================
select 'products'     as table_name, count(*) as rows from products
union all
select 'blog_posts',    count(*) from blog_posts
union all
select 'sellers',       count(*) from sellers
union all
select 'orders',        count(*) from orders
union all
select 'admin_sessions',count(*) from admin_sessions
union all
select 'listing_fees',  count(*) from listing_fees
union all
select 'transactions',  count(*) from transactions
union all
select 'earnings',      count(*) from earnings
order by table_name;
