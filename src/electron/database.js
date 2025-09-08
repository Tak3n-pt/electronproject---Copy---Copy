const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use the database in the main electron app directory
const dbPath = path.join(__dirname, '..', '..', 'inventory.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

db.run('PRAGMA foreign_keys = ON');

db.serialize(() => {
  
  // Create tables first
  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      contact_email TEXT,
      contact_phone TEXT,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE,
      price REAL,
      quantity INTEGER DEFAULT 0,
      vendor_id INTEGER,
      category_id INTEGER,
      description TEXT,
      min_stock_level INTEGER DEFAULT 5,
      max_stock_level INTEGER DEFAULT 100,
      cost_price REAL,
      
      markup_percentage REAL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      last_sold TEXT,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
      quantity INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      reason TEXT,
      reference_transaction_id TEXT,
      user_id TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL UNIQUE,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'purchase', 'adjustment')),
      timestamp TEXT DEFAULT (datetime('now')),
      notes TEXT,
      user_id TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      invoice_number TEXT,
      invoice_date TEXT,
      invoice_image_url TEXT,
      vendor_id INTEGER,
      vendor_name TEXT,
      total_items INTEGER NOT NULL,
      total_amount REAL,
      processing_notes TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'finalized', 'cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      finalized_at TEXT,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)');
  db.run('CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type)');
  
  // Add image_url column if it doesn't exist
  db.run(`ALTER TABLE products ADD COLUMN image_url TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      // Silently ignore if column already exists
    }
  });
  
  // Add image_local_path column if it doesn't exist  
  db.run(`ALTER TABLE products ADD COLUMN image_local_path TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      // Silently ignore if column already exists
    }
  });
  
  // Add additional_data column to invoices table for storing extra fields from Content Understanding
  db.run(`ALTER TABLE invoices ADD COLUMN additional_data TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('✅ Added additional_data column to invoices table');
    }
  });
  
  // Add extraction_method column to track which method was used
  db.run(`ALTER TABLE invoices ADD COLUMN extraction_method TEXT DEFAULT 'standard'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('✅ Added extraction_method column to invoices table');
    }
  });
  
  // Add confidence_scores column for tracking extraction confidence
  db.run(`ALTER TABLE invoices ADD COLUMN confidence_scores TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('✅ Added confidence_scores column to invoices table');
    }
  });
});

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

async function getOrCreateVendor(vendorName) {
  if (!vendorName) return null;
  
  let vendor = await dbGet('SELECT * FROM vendors WHERE name = ?', [vendorName]);
  if (!vendor) {
    const result = await dbRun('INSERT INTO vendors (name) VALUES (?)', [vendorName]);
    vendor = await dbGet('SELECT * FROM vendors WHERE id = ?', [result.id]);
  }
  return vendor;
}

async function getOrCreateCategory(categoryName) {
  if (!categoryName) return null;
  
  let category = await dbGet('SELECT * FROM categories WHERE name = ?', [categoryName]);
  if (!category) {
    const result = await dbRun('INSERT INTO categories (name) VALUES (?)', [categoryName]);
    category = await dbGet('SELECT * FROM categories WHERE id = ?', [result.id]);
  }
  return category;
}

async function logInventoryMovement(productId, movementType, quantity, previousQuantity, newQuantity, reason, referenceTransactionId = null, userId = null) {
  try {
    await dbRun(
      `INSERT INTO inventory_movements 
       (product_id, movement_type, quantity, previous_quantity, new_quantity, reason, reference_transaction_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, movementType, quantity, previousQuantity, newQuantity, reason, referenceTransactionId, userId]
    );
  } catch (err) {
    console.error('Failed to log inventory movement:', err);
  }
}

async function addProduct(productData) {
  const {
    name,
    barcode = null,
    price = null,
    quantity = 0,
    vendor = null,
    category = null,
    description = null,
    minStockLevel = 5,
    maxStockLevel = 100,
    costPrice = null,
    markupPercentage = null,
    imageUrl = null,
    isActive = 1
  } = productData;

  const vendorObj = await getOrCreateVendor(vendor);
  const categoryObj = await getOrCreateCategory(category);

  const result = await dbRun(
  `INSERT INTO products 
   (name, barcode, price, quantity, vendor_id, category_id, description, min_stock_level, max_stock_level, cost_price, markup_percentage, is_active, image_url)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    name,
    barcode,
    price,
    quantity,
    vendorObj?.id || null,
    categoryObj?.id || null,
    description,
    minStockLevel,
    maxStockLevel,
    costPrice,
    markupPercentage,
    isActive,
    imageUrl // <-- add here
  ]
);

  const product = await dbGet(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.id = ?
  `, [result.id]);

  if (quantity > 0) {
    await logInventoryMovement(result.id, 'in', quantity, 0, quantity, 'Initial stock');
  }

  return product;
}

async function findByBarcode(barcode) {
  return await dbGet(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.barcode = ? AND p.is_active = 1
  `, [barcode]);
}

async function findByName(name) {
  let product = await dbGet(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.name = ? AND p.is_active = 1
  `, [name]);
  
  if (!product) {
    product = await dbGet(`
      SELECT p.*, v.name as vendor_name, c.name as category_name 
      FROM products p 
      LEFT JOIN vendors v ON p.vendor_id = v.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.name LIKE ? AND p.is_active = 1 
      ORDER BY p.name LIMIT 1
    `, [`%${name}%`]);
  }
  
  return product;
}

async function updateProduct(existingProduct, updates) {
  const {
    name = existingProduct.name,
    barcode = existingProduct.barcode,
    price = existingProduct.price,
    quantity = existingProduct.quantity,
    vendor = existingProduct.vendor_name,
    category = existingProduct.category_name,
    description = existingProduct.description,
    minStockLevel = existingProduct.min_stock_level,
    maxStockLevel = existingProduct.max_stock_level,
    costPrice = existingProduct.cost_price,
    markupPercentage = existingProduct.markup_percentage,
    lastSold = existingProduct.last_sold,
    imageUrl = existingProduct.image_url
  } = updates;

  const vendorObj = await getOrCreateVendor(vendor);
  const categoryObj = await getOrCreateCategory(category);

  const previousQuantity = existingProduct.quantity || 0;
  const newQuantity = quantity;

  await dbRun(
  `UPDATE products 
   SET name = ?, barcode = ?, price = ?, quantity = ?, vendor_id = ?, category_id = ?, description = ?, 
       min_stock_level = ?, max_stock_level = ?, cost_price = ?, markup_percentage = ?, 
       image_url = ?, updated_at = CURRENT_TIMESTAMP, last_sold = ?
   WHERE id = ?`,
  [
    name,
    barcode,
    price,
    newQuantity,
    vendorObj?.id || null,
    categoryObj?.id || null,
    description,
    minStockLevel,
    maxStockLevel,
    costPrice,
    markupPercentage,
    imageUrl,     // ✅ Keep this
    lastSold,     // ✅ Then this
    existingProduct.id // ✅ Final one
  ]
);
  if (newQuantity !== previousQuantity) {
    const movementType = newQuantity > previousQuantity ? 'in' : 'out';
    const diff = Math.abs(newQuantity - previousQuantity);
    const reason = movementType === 'in' ? 'Stock replenishment' : 'Stock adjustment';
    await logInventoryMovement(existingProduct.id, movementType, diff, previousQuantity, newQuantity, reason);
  }

  return await dbGet(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.id = ?
  `, [existingProduct.id]);
}

async function getProducts(limit = 100, offset = 0) {
  return await dbAll(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.is_active = 1 
    ORDER BY p.name 
    LIMIT ? OFFSET ?
  `, [limit, offset]);
}

async function getProductsByVendor(vendorName) {
  return await dbAll(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE v.name = ? AND p.is_active = 1 
    ORDER BY p.name
  `, [vendorName]);
}

async function getLowStockProducts() {
  return await dbAll(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.quantity <= p.min_stock_level AND p.is_active = 1 
    ORDER BY p.quantity ASC
  `);
}

async function searchProducts(query) {
  return await dbAll(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE (p.name LIKE ? OR p.description LIKE ?) AND p.is_active = 1
    ORDER BY p.name
    LIMIT 50
  `, [`%${query}%`, `%${query}%`]);
}

async function createTransaction(transactionData) {
  const {
    transactionId,
    productId,
    quantity,
    unitPrice,
    totalPrice,
    type,
    notes = null,
    userId = null
  } = transactionData;

  await dbRun(
    `INSERT INTO transactions
     (transaction_id, product_id, quantity, unit_price, total_price, transaction_type, notes, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [transactionId, productId, quantity, unitPrice, totalPrice, type, notes, userId]
  );
}

async function suggestSellingPrice(costPrice, productName = null, barcode = null) {
  if (!costPrice) return null;

  let suggestedPrice = costPrice * 1.3;

  if (barcode) {
    const existingProduct = await findByBarcode(barcode);
    if (existingProduct && existingProduct.price) {
      return existingProduct.price;
    }
  }

  if (productName) {
    const existingProduct = await findByName(productName);
    if (existingProduct && existingProduct.price) {
      return existingProduct.price;
    }
  }

  const similarProducts = await dbAll(`
    SELECT price FROM products 
    WHERE cost_price BETWEEN ? AND ? 
    AND price IS NOT NULL 
    AND is_active = 1
    LIMIT 5
  `, [costPrice * 0.8, costPrice * 1.2]);

  if (similarProducts.length > 0) {
    const avgPrice = similarProducts.reduce((sum, p) => sum + p.price, 0) / similarProducts.length;
    suggestedPrice = avgPrice;
  }

  return Math.round(suggestedPrice * 100) / 100;
}

async function deleteProduct(productId, options = {}) {
  const { hardDelete = false, reason = 'Product deleted by user' } = options;
  
  try {
    // First, check if product exists and is active
    const product = await dbGet('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);
    if (!product) {
      throw new Error('Product not found or already deleted');
    }
    
    if (hardDelete) {
      // Hard delete - completely remove from database
      // Note: This will only work if there are no foreign key constraints
      await dbRun('DELETE FROM products WHERE id = ?', [productId]);
      
      // Log the deletion in inventory movements
      await logInventoryMovement(
        productId, 
        'out', 
        product.quantity, 
        product.quantity, 
        0, 
        `Hard delete: ${reason}`
      );
    } else {
      // Soft delete - mark as inactive (your current implementation)
      await dbRun('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [productId]);
      
      // Log the deletion in inventory movements
      await logInventoryMovement(
        productId, 
        'adjustment', 
        product.quantity, 
        product.quantity, 
        0, 
        `Soft delete: ${reason}`
      );
    }
    
    return { 
      success: true, 
      message: `Product ${hardDelete ? 'permanently deleted' : 'deleted'} successfully`,
      productId: productId
    };
    
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// Additional helper functions you might want to add:

// Restore a soft-deleted product
async function restoreProduct(productId) {
  try {
    const product = await dbGet('SELECT * FROM products WHERE id = ? AND is_active = 0', [productId]);
    if (!product) {
      throw new Error('Product not found or not deleted');
    }
    
    await dbRun('UPDATE products SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [productId]);
    
    return { 
      success: true, 
      message: 'Product restored successfully',
      productId: productId
    };
  } catch (error) {
    console.error('Error restoring product:', error);
    throw error;
  }
}

// Get deleted products (for admin purposes)
async function getDeletedProducts(limit = 100, offset = 0) {
  return await dbAll(`
    SELECT p.*, v.name as vendor_name, c.name as category_name 
    FROM products p 
    LEFT JOIN vendors v ON p.vendor_id = v.id 
    LEFT JOIN categories c ON p.category_id = c.id 
    WHERE p.is_active = 0 
    ORDER BY p.updated_at DESC 
    LIMIT ? OFFSET ?
  `, [limit, offset]);
}

// Batch delete products
async function batchDeleteProducts(productIds, options = {}) {
  const results = [];
  
  for (const productId of productIds) {
    try {
      const result = await deleteProduct(productId, options);
      results.push({ productId, ...result });
    } catch (error) {
      results.push({ 
        productId, 
        success: false, 
        message: error.message 
      });
    }
  }
  
  return results;
}



function closeDatabase() {
  db.close((err) => {
    if (err) console.error('Error closing DB:', err);
    else console.log('✅ Closed SQLite database');
  });
}

module.exports = {
  addProduct,
  findByBarcode,
  findByName,
  updateProduct,
  getProducts,
  getProductsByVendor,
  getLowStockProducts,
  searchProducts,
  createTransaction,
  logInventoryMovement,
  suggestSellingPrice,
  deleteProduct,
  getOrCreateVendor,
  getOrCreateCategory,
  closeDatabase,
  
  restoreProduct,
  getDeletedProducts,
  batchDeleteProducts
};