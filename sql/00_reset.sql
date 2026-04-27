-- ============================================================
-- REWEAR — RESET (run this ONLY if you need a clean slate)
-- WARNING: This drops ALL tables and ALL data.
-- Only run this if you want to start fresh.
-- After running this, run 01 through 05 in order.
-- ============================================================

drop table if exists buyer_addresses    cascade;
drop table if exists buyers             cascade;
drop table if exists earnings           cascade;
drop table if exists transactions       cascade;
drop table if exists listing_fees       cascade;
drop table if exists wishlists          cascade;
drop table if exists orders             cascade;
drop table if exists sellers            cascade;
drop table if exists admin_sessions     cascade;
drop table if exists contact_messages   cascade;
drop table if exists newsletter_subscribers cascade;
drop table if exists blog_posts         cascade;
drop table if exists products           cascade;

drop function if exists increment_listings_used(uuid);
drop function if exists decrement_product_quantity();
drop function if exists submit_listing_atomic(uuid,text,numeric,text,text,text,text[],numeric);
