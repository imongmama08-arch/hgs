-- ============================================================
-- Fix Listing Fees Status Constraint
-- Run this if you get "listing_fees_status_check" error
-- ============================================================

-- Drop the old constraint if it exists
ALTER TABLE listing_fees 
DROP CONSTRAINT IF EXISTS listing_fees_status_check;

-- Add the updated constraint with all valid statuses
ALTER TABLE listing_fees
ADD CONSTRAINT listing_fees_status_check
CHECK (status IN ('pending', 'proof_submitted', 'active', 'expired', 'exhausted', 'rejected'));

-- Verify the constraint was added
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'listing_fees_status_check';

-- Expected output:
-- constraint_name: listing_fees_status_check
-- constraint_definition: CHECK ((status = ANY (ARRAY['pending'::text, 'proof_submitted'::text, 'active'::text, 'expired'::text, 'exhausted'::text, 'rejected'::text])))
