-- ============================================================
-- Manually Verify a Seller Account
-- Use this if admin approval didn't update the database
-- Run this in Supabase SQL Editor
-- ============================================================

-- STEP 1: Find your seller account
-- Replace 'your-email@example.com' with your actual email
SELECT 
    id,
    business_name,
    email,
    verified,
    rejection_reason,
    created_at
FROM sellers
WHERE email = 'your-email@example.com';  -- ← CHANGE THIS

-- STEP 2: Manually verify the seller
-- Copy the 'id' from Step 1 and paste it below
UPDATE sellers
SET 
    verified = true,
    verified_at = NOW(),
    rejection_reason = NULL
WHERE email = 'your-email@example.com';  -- ← CHANGE THIS

-- STEP 3: Verify the update worked
SELECT 
    id,
    business_name,
    email,
    verified,
    verified_at,
    rejection_reason
FROM sellers
WHERE email = 'your-email@example.com';  -- ← CHANGE THIS

-- Expected result: verified = true, verified_at = current timestamp

-- ============================================================
-- Alternative: Verify ALL pending sellers at once
-- ============================================================

-- View all pending sellers
SELECT 
    id,
    business_name,
    email,
    verified,
    created_at
FROM sellers
WHERE verified = false
  AND rejection_reason IS NULL
ORDER BY created_at DESC;

-- Verify ALL pending sellers (use with caution!)
-- Uncomment the lines below to run:

-- UPDATE sellers
-- SET 
--     verified = true,
--     verified_at = NOW()
-- WHERE verified = false
--   AND rejection_reason IS NULL;

-- ============================================================
-- Troubleshooting: Check if seller record exists
-- ============================================================

-- If no results, the seller record might not exist
-- Check by user ID instead (get from localStorage in browser console)
-- Run: localStorage.getItem('rewear_current_user')

SELECT * FROM sellers WHERE id = 'paste-user-id-here';

-- If no record exists, create one:
-- INSERT INTO sellers (id, business_name, email, verified, created_at)
-- VALUES (
--     'paste-user-id-here',
--     'Your Business Name',
--     'your-email@example.com',
--     true,
--     NOW()
-- );
