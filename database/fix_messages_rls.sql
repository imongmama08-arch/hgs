-- ============================================================
-- Fix Messages Table RLS Policy
-- ============================================================
-- This script fixes the Row-Level Security policy for the messages table
-- to allow buyers to insert messages with their buyer_id

-- 1. Drop existing RLS policies (if any)
DROP POLICY IF EXISTS "Allow buyers to insert messages" ON messages;
DROP POLICY IF EXISTS "Allow sellers to view their messages" ON messages;
DROP POLICY IF EXISTS "Allow buyers to view their messages" ON messages;
DROP POLICY IF EXISTS "Allow sellers to update messages" ON messages;

-- 2. Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Create policy: Buyers can insert messages (with their own buyer_id)
CREATE POLICY "Allow buyers to insert messages"
ON messages
FOR INSERT
WITH CHECK (
  auth.uid() = buyer_id
);

-- 4. Create policy: Buyers can view their own messages
CREATE POLICY "Allow buyers to view their messages"
ON messages
FOR SELECT
USING (
  auth.uid() = buyer_id
);

-- 5. Create policy: Sellers can view messages sent to them
CREATE POLICY "Allow sellers to view their messages"
ON messages
FOR SELECT
USING (
  auth.uid() = seller_id
);

-- 6. Create policy: Sellers can update messages (to add replies)
CREATE POLICY "Allow sellers to update messages"
ON messages
FOR UPDATE
USING (
  auth.uid() = seller_id
)
WITH CHECK (
  auth.uid() = seller_id
);

-- 7. Verify the policies are in place
SELECT * FROM pg_policies WHERE tablename = 'messages';
