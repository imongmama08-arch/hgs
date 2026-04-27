-- ============================================================
-- Setup Messages Table for Buyer-Seller Communication
-- Run this in Supabase SQL Editor
-- ============================================================

-- Create messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  product_id UUID,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  message TEXT NOT NULL,
  reply TEXT,
  replied_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_seller_id_fkey'
  ) THEN
    ALTER TABLE messages
    ADD CONSTRAINT messages_seller_id_fkey
    FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_product_id_fkey'
  ) THEN
    ALTER TABLE messages
    ADD CONSTRAINT messages_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_seller_id ON messages(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_buyer_email ON messages(buyer_email);
CREATE INDEX IF NOT EXISTS idx_messages_product_id ON messages(product_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can send messages" ON messages;
DROP POLICY IF EXISTS "Sellers can read their messages" ON messages;
DROP POLICY IF EXISTS "Buyers can read their messages" ON messages;
DROP POLICY IF EXISTS "Sellers can reply to messages" ON messages;
DROP POLICY IF EXISTS "Public can insert messages" ON messages;

-- Policy 1: Allow anyone to insert messages (for unauthenticated buyers)
CREATE POLICY "Public can insert messages"
ON messages FOR INSERT
TO public
WITH CHECK (true);

-- Policy 2: Allow sellers to read their messages
CREATE POLICY "Sellers can read their messages"
ON messages FOR SELECT
TO public
USING (
  seller_id IN (
    SELECT id FROM sellers WHERE id = auth.uid()
  )
);

-- Policy 3: Allow buyers to read their messages (by email)
CREATE POLICY "Buyers can read their messages"
ON messages FOR SELECT
TO public
USING (
  buyer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR buyer_email = current_setting('request.jwt.claims', true)::json->>'email'
);

-- Policy 4: Allow sellers to update (reply to) their messages
CREATE POLICY "Sellers can reply to messages"
ON messages FOR UPDATE
TO public
USING (
  seller_id IN (
    SELECT id FROM sellers WHERE id = auth.uid()
  )
)
WITH CHECK (
  seller_id IN (
    SELECT id FROM sellers WHERE id = auth.uid()
  )
);

-- Verify the setup
SELECT 
  'Messages table' as component,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') 
    THEN '✅ Created' 
    ELSE '❌ Missing' 
  END as status;

SELECT 
  'RLS Enabled' as component,
  CASE WHEN relrowsecurity 
    THEN '✅ Enabled' 
    ELSE '❌ Disabled' 
  END as status
FROM pg_class
WHERE relname = 'messages';

SELECT 
  policyname as policy_name,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY policyname;

-- Test insert (should work)
-- INSERT INTO messages (seller_id, buyer_name, buyer_email, message)
-- VALUES (
--   (SELECT id FROM sellers LIMIT 1),
--   'Test Buyer',
--   'test@example.com',
--   'This is a test message'
-- );

-- Check recent messages
SELECT 
  id,
  seller_id,
  buyer_name,
  buyer_email,
  LEFT(message, 50) as message_preview,
  created_at
FROM messages
ORDER BY created_at DESC
LIMIT 5;
