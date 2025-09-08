-- BARCODE FIX SQL SCRIPT
-- Adds proper barcode tracking fields

-- Add new columns for better barcode tracking
ALTER TABLE products ADD COLUMN product_code TEXT;
ALTER TABLE products ADD COLUMN reference TEXT;
ALTER TABLE products ADD COLUMN barcode_type TEXT DEFAULT 'manual';

-- Update existing data
UPDATE products 
SET product_code = barcode 
WHERE barcode IS NOT NULL AND product_code IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_product_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_reference ON products(reference);