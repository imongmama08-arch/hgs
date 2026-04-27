-- Add GCash columns to sellers table
-- Run this in your MAIN Supabase database SQL Editor

ALTER TABLE sellers 
ADD COLUMN IF NOT EXISTS gcash_number TEXT,
ADD COLUMN IF NOT EXISTS gcash_name TEXT;

-- Verify
SELECT id, business_name, gcash_number, gcash_name FROM sellers LIMIT 5;
