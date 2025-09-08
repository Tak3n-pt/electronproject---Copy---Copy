/**
 * BARCODE SEARCH FIX FOR SELLING
 * Makes the selling process work with ANY product identifier
 */

// Replace the GET /products/:barcode endpoint (line 2096) with this:

async function enhancedBarcodeSearch(searchCode) {
  // First, try exact barcode match (for real barcodes)
  let product = await dbGet(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.barcode = ? AND p.is_active = 1
  `, [searchCode]);
  
  if (product) {
    console.log(`✅ Found by barcode: ${searchCode}`);
    return product;
  }
  
  // If not found, check if this might be an SKU or internal code
  // This handles products that were created with productCode instead of barcode
  product = await dbGet(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE (
      p.barcode = ? OR 
      p.sku = ? OR 
      p.internal_code = ? OR
      p.barcode LIKE ?
    ) AND p.is_active = 1
  `, [searchCode, searchCode, searchCode, `%${searchCode}%`]);
  
  if (product) {
    console.log(`✅ Found by SKU/internal code: ${searchCode}`);
    // IMPORTANT: Set the barcode field to what was scanned
    // so the mobile app gets back what it expects
    product.barcode = searchCode;
    return product;
  }
  
  return null;
}

// NEW ENDPOINT: Universal product search for selling
app.get('/products/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    console.log(`🔍 [SELL] Searching for product with code: ${barcode}`);
    
    // Check cache first
    const cached = productCache.get(barcode);
    if (cached) {
      console.log(`📦 [SELL] Found in cache: ${barcode}`);
      return res.json(cached);
    }
    
    // Use enhanced search that checks all fields
    const product = await enhancedBarcodeSearch(barcode);
    
    if (!product) {
      console.log(`❌ [SELL] Product not found: ${barcode}`);
      return res.status(404).json({ 
        error: 'Product not found',
        searchedCode: barcode,
        suggestion: 'Product may not exist or code may be incorrect'
      });
    }
    
    // Ensure the response includes the scanned code
    const enrichedProduct = {
      ...product,
      barcode: barcode, // Always return what was scanned
      original_barcode: product.barcode, // Keep original if different
      matched_by: product.barcode === barcode ? 'barcode' : 'alternative',
      scannable: true
    };
    
    console.log(`✅ [SELL] Found product: ${product.name} (${barcode})`);
    productCache.set(barcode, enrichedProduct);
    res.json(enrichedProduct);
    
  } catch (err) {
    console.error('❌ [SELL] Error in product search:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// INVOICE PROCESSING FIX: Save the right codes to the right fields
function processInvoiceItem(item, requestId, index) {
  const result = {
    name: item.name || item.description,
    barcode: null,  // Reserved for REAL scannable barcodes
    sku: null,      // For product codes/SKUs
    internal_code: null, // For generated codes
  };
  
  // Determine what type of code we have
  const code = item.barcode || item.productCode || item.reference;
  
  if (code) {
    // Is it a real barcode? (8-13 digits)
    if (/^\d{8,13}$/.test(code)) {
      result.barcode = code; // This goes to barcode field
    } 
    // Is it a product code/SKU?
    else if (item.productCode || item.reference) {
      result.sku = code; // This goes to SKU field
      // Also put it in barcode for backward compatibility
      result.barcode = code;
    }
    // Is it from barcode field but not standard?
    else {
      result.internal_code = code;
      // Also put it in barcode for backward compatibility
      result.barcode = code;
    }
  } else {
    // Generate a code if nothing exists
    result.internal_code = `GEN_${requestId}_${index}`;
    result.barcode = result.internal_code; // For backward compatibility
  }
  
  return result;
}

module.exports = {
  enhancedBarcodeSearch,
  processInvoiceItem
};