/**
 * API BARCODE FIX
 * Ensures barcode/product code data is always returned properly
 */

// Add this function to process product data before sending
function enrichProductData(product) {
  if (!product) return product;
  
  // Ensure all code fields are populated
  return {
    ...product,
    barcode: product.barcode || null,
    product_code: product.product_code || product.barcode || null,
    reference: product.reference || product.barcode || null,
    has_barcode: !!product.barcode,
    barcode_source: product.barcode ? 
      (product.barcode.startsWith('GEN_') ? 'generated' : 'scanned') : 
      'none'
  };
}

// Use in endpoints like this:
// Before: res.json(product);
// After:  res.json(enrichProductData(product));

// For product lists:
function enrichProductList(products) {
  return products.map(enrichProductData);
}

module.exports = {
  enrichProductData,
  enrichProductList
};