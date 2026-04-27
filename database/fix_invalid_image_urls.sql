-- ============================================================
-- Fix Invalid Image URLs in Products Table
-- Run this to fix products with local file paths
-- ============================================================

-- First, let's see what we're dealing with
SELECT 
    id,
    name,
    image_url,
    CASE 
        WHEN image_url LIKE 'file://%' THEN 'Local file:// path'
        WHEN image_url LIKE 'C:\%' OR image_url LIKE '%:\\%' THEN 'Windows path'
        WHEN image_url LIKE '%Users/%' AND NOT image_url LIKE 'http%' THEN 'Unix/Mac path'
        WHEN image_url LIKE 'data:image/%' THEN 'Data URL (OK)'
        WHEN image_url LIKE 'http%' THEN 'Web URL (OK)'
        WHEN image_url LIKE '/%' OR image_url LIKE './%' THEN 'Relative path (OK)'
        ELSE 'Unknown format'
    END as url_type
FROM products
WHERE image_url IS NOT NULL
ORDER BY url_type, created_at DESC;

-- Count products by URL type
SELECT 
    CASE 
        WHEN image_url LIKE 'file://%' THEN 'Local file:// path'
        WHEN image_url LIKE 'C:\%' OR image_url LIKE '%:\\%' THEN 'Windows path'
        WHEN image_url LIKE '%Users/%' AND NOT image_url LIKE 'http%' THEN 'Unix/Mac path'
        WHEN image_url LIKE 'data:image/%' THEN 'Data URL (OK)'
        WHEN image_url LIKE 'http%' THEN 'Web URL (OK)'
        WHEN image_url LIKE '/%' OR image_url LIKE './%' THEN 'Relative path (OK)'
        ELSE 'Unknown format'
    END as url_type,
    COUNT(*) as count
FROM products
WHERE image_url IS NOT NULL
GROUP BY url_type
ORDER BY count DESC;

-- Fix: Replace invalid URLs with placeholder
-- BACKUP YOUR DATA BEFORE RUNNING THIS!

-- Option 1: Set to placeholder image (use relative path from pages/ folder)
UPDATE products
SET image_url = '../assets/images/studio-white.jpg'
WHERE image_url LIKE 'file://%' 
   OR image_url LIKE 'C:\%'
   OR image_url LIKE '%:\\%'
   OR (image_url LIKE '%Users/%' AND NOT image_url LIKE 'http%');

-- Option 2: Set to NULL (will use default in code)
-- UPDATE products
-- SET image_url = NULL
-- WHERE image_url LIKE 'file://%' 
--    OR image_url LIKE 'C:\%'
--    OR image_url LIKE '%:\\%'
--    OR (image_url LIKE '%Users/%' AND NOT image_url LIKE 'http%');

-- Verify the fix
SELECT 
    COUNT(*) as total_products,
    COUNT(CASE WHEN image_url LIKE 'file://%' OR image_url LIKE 'C:\%' OR image_url LIKE '%:\\%' THEN 1 END) as invalid_urls,
    COUNT(CASE WHEN image_url = '../assets/images/studio-white.jpg' THEN 1 END) as placeholder_images,
    COUNT(CASE WHEN image_url LIKE 'data:image/%' THEN 1 END) as data_urls,
    COUNT(CASE WHEN image_url LIKE 'http%' THEN 1 END) as web_urls
FROM products;

-- List products that still need attention
SELECT 
    id,
    name,
    seller_id,
    image_url,
    status,
    created_at
FROM products
WHERE image_url = '../assets/images/studio-white.jpg'
ORDER BY created_at DESC;

-- Expected output after fix:
-- - invalid_urls: 0
-- - All products should have valid image URLs or placeholder
