-- ============================================================
-- QUICK FIX: Create Messages Table
-- Copy and paste this entire script into Supabase SQL Editor
-- ============================================================

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_seller_id ON public.messages(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_buyer_email ON public.messages(buyer_email);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert messages (for unauthenticated buyers)
CREATE POLICY "Anyone can insert messages"
ON public.messages FOR INSERT
TO public
WITH CHECK (true);

-- Allow sellers to read their messages
CREATE POLICY "Sellers can read their messages"
ON public.messages FOR SELECT
TO public
USING (seller_id = auth.uid());

-- Allow buyers to read their messages by email
CREATE POLICY "Buyers can read their messages"
ON public.messages FOR SELECT
TO public
USING (
  buyer_email = COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    current_setting('request.jwt.claims', true)::json->>'email'
  )
);

-- Allow sellers to reply to messages
CREATE POLICY "Sellers can reply to messages"
ON public.messages FOR UPDATE
TO public
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

-- Verify the table was created
SELECT 
  'Messages table created successfully!' as status,
  COUNT(*) as existing_messages
FROM public.messages;

-- Show table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;
