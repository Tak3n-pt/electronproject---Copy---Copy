-- SELLING FIX: Make barcode field work for ML Kit scanning
-- Run this to add support for multiple reference types

-- Add columns to track different identifiers
ALTER TABLE products ADD COLUMN sku TEXT;
ALTER TABLE products ADD COLUMN internal_code TEXT;
ALTER TABLE products ADD COLUMN barcode_source TEXT DEFAULT 'manual';

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_internal_code ON products(internal_code);

-- Update existing products to separate SKU from barcode
UPDATE products 
SET sku = barcode,
    barcode_source = CASE 
        WHEN barcode LIKE 'GEN_%' THEN 'generated'
        WHEN barcode LIKE 'SKU_%' THEN 'sku'
        WHEN barcode LIKE 'MAN_%' THEN 'manual'
        WHEN barcode GLOB '[0-9]*' AND LENGTH(barcode) BETWEEN 8 AND 13 THEN 'scanned'
        ELSE 'unknown'
    END
WHERE barcode IS NOT NULL;

-- Clean up barcode field to only contain scannable codes
UPDATE products 
SET internal_code = barcode,
    barcode = NULL
WHERE barcode LIKE 'GEN_%' OR barcode LIKE 'SKU_%' OR barcode LIKE 'MAN_%';