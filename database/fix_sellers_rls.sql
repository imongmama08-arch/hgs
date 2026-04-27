-- ============================================================
-- Fix Row Level Security (RLS) for Sellers Table
-- This allows the admin panel to access seller data
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable RLS on sellers table (if not already enabled)
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to sellers" ON sellers;
DROP POLICY IF EXISTS "Allow public insert to sellers" ON sellers;
DROP POLICY IF EXISTS "Allow public update to sellers" ON sellers;

-- Policy 1: Allow public read access (for admin panel and seller queries)
CREATE POLICY "Allow public read access to sellers"
ON sellers FOR SELECT
TO public
USING (true);

-- Policy 2: Allow public insert (for seller signup)
CREATE POLICY "Allow public insert to sellers"
ON sellers FOR INSERT
TO public
WITH CHECK (true);

-- Policy 3: Allow public update (for admin approval and seller profile updates)
CREATE POLICY "Allow public update to sellers"
ON sellers FOR UPDATE
TO public
USING (true);

-- Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'sellers';

-- Expected output: 3 policies
-- 1. Allow public read access to sellers (SELECT)
-- 2. Allow public insert to sellers (INSERT)
-- 3. Allow public update to sellers (UPDATE)
