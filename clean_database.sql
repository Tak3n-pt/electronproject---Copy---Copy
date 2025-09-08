-- Database cleanup script for fresh desktop app testing
-- This will remove ALL data and reset counters

-- Delete all data from tables (in correct order to respect foreign keys)
DELETE FROM products;
DELETE FROM invoices;
DELETE FROM vendors;
DELETE FROM categories;

-- Reset auto-increment counters
UPDATE sqlite_sequence SET seq = 0 WHERE name = 'products';
UPDATE sqlite_sequence SET seq = 0 WHERE name = 'invoices';
UPDATE sqlite_sequence SET seq = 0 WHERE name = 'vendors';
UPDATE sqlite_sequence SET seq = 0 WHERE name = 'categories';

-- Verify tables are empty
SELECT 'Products count:' as info, COUNT(*) as count FROM products
UNION ALL
SELECT 'Invoices count:' as info, COUNT(*) as count FROM invoices  
UNION ALL
SELECT 'Vendors count:' as info, COUNT(*) as count FROM vendors
UNION ALL
SELECT 'Categories count:' as info, COUNT(*) as count FROM categories;