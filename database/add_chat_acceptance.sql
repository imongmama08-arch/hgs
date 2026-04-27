-- ============================================================
-- Add Chat Acceptance Feature to Messages Table
-- ============================================================
-- This adds the ability for sellers to accept/reject chats

-- 1. Add acceptance columns if they don't exist
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_accepted ON messages(accepted);
CREATE INDEX IF NOT EXISTS idx_messages_seller_accepted ON messages(seller_id, accepted);

-- 3. Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;
