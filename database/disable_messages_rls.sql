-- ============================================================
-- Disable RLS on Messages Table
-- ============================================================
-- This allows the messaging system to work with local authentication
-- Run this in Supabase SQL Editor

ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'messages';
