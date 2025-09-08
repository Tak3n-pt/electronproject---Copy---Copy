// Test script to verify the barcode/identifier flow
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

// Promisify database operations
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    err ? reject(err) : resolve({ id: this.lastID, changes: this.changes });
  });
});

async function testBarcodeFlow() {
  console.log('\n🔍 TESTING BARCODE/IDENTIFIER FLOW\n');
  console.log('=' .repeat(50));

  try {
    // Test 1: Check products with different identifier types
    console.log('\n1️⃣ CHECKING EXISTING PRODUCTS:');
    const products = await dbAll(`
      SELECT id, name, barcode, quantity 
      FROM products 
      WHERE is_active = 1 
      LIMIT 10
    `);
    
    console.log(`Found ${products.length} products:`);
    products.forEach(p => {
      const identifierType = 
        /^\d{8,13}$/.test(p.barcode) ? 'REAL BARCODE' :
        p.barcode?.startsWith('GEN_') ? 'GENERATED' :
        p.barcode?.startsWith('SKU_') ? 'SKU' :
        p.barcode?.startsWith('MAN_') ? 'MANUAL' :
        p.barcode ? 'CUSTOM' : 'NO IDENTIFIER';
      
      console.log(`  - ${p.name}: ${p.barcode || 'NULL'} [${identifierType}]`);
    });

    // Test 2: Simulate ML Kit scanning different types
    console.log('\n2️⃣ SIMULATING ML KIT SCANNING:');
    
    const testCodes = [
      '8901030865278',  // Real barcode
      'ABC123',         // Product code
      'TEST_SKU',       // SKU
      'GEN_123_456',    // Generated code
    ];

    for (const code of testCodes) {
      console.log(`\nScanning: "${code}"`);
      
      // Simulate the server's enhanced search
      const result = await dbGet(`
        SELECT name, barcode 
        FROM products 
        WHERE is_active = 1 AND (
          barcode = ? OR 
          barcode = ? OR
          barcode = ? OR
          barcode LIKE ? OR
          barcode LIKE ?
        )
      `, [
        code,
        `SKU_${code}`,
        `MAN_${code}`,
        `%_${code}`,
        `${code}_%`
      ]);
      
      if (result) {
        console.log(`  ✅ FOUND: ${result.name} (stored as: ${result.barcode})`);
      } else {
        console.log(`  ❌ NOT FOUND - Would create new product`);
      }
    }

    // Test 3: Check for potential duplicates
    console.log('\n3️⃣ CHECKING FOR DUPLICATE PRODUCTS:');
    const duplicates = await dbAll(`
      SELECT name, COUNT(*) as count 
      FROM products 
      WHERE is_active = 1 
      GROUP BY LOWER(TRIM(name)) 
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    
    if (duplicates.length > 0) {
      console.log('⚠️ Found potential duplicates:');
      duplicates.forEach(d => {
        console.log(`  - "${d.name}": ${d.count} instances`);
      });
    } else {
      console.log('✅ No duplicate products found!');
    }

    // Test 4: Verify identifier consistency
    console.log('\n4️⃣ CHECKING IDENTIFIER CONSISTENCY:');
    const stats = await dbGet(`
      SELECT 
        COUNT(*) as total,
        COUNT(barcode) as with_barcode,
        COUNT(CASE WHEN barcode IS NULL OR barcode = '' THEN 1 END) as without_barcode,
        COUNT(CASE WHEN barcode GLOB '[0-9]*' AND LENGTH(barcode) BETWEEN 8 AND 13 THEN 1 END) as real_barcodes,
        COUNT(CASE WHEN barcode LIKE 'GEN_%' THEN 1 END) as generated,
        COUNT(CASE WHEN barcode LIKE 'SKU_%' THEN 1 END) as skus,
        COUNT(CASE WHEN barcode LIKE 'MAN_%' THEN 1 END) as manual
      FROM products 
      WHERE is_active = 1
    `);
    
    console.log(`Total products: ${stats.total}`);
    console.log(`With identifier: ${stats.with_barcode} (${(stats.with_barcode/stats.total*100).toFixed(1)}%)`);
    console.log(`Without identifier: ${stats.without_barcode} (${(stats.without_barcode/stats.total*100).toFixed(1)}%)`);
    console.log('\nIdentifier types:');
    console.log(`  Real barcodes: ${stats.real_barcodes}`);
    console.log(`  Generated: ${stats.generated}`);
    console.log(`  SKUs: ${stats.skus}`);
    console.log(`  Manual: ${stats.manual}`);
    console.log(`  Other: ${stats.with_barcode - stats.real_barcodes - stats.generated - stats.skus - stats.manual}`);

    console.log('\n' + '=' .repeat(50));
    console.log('✅ TEST COMPLETE!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    db.close();
  }
}

// Run the test
testBarcodeFlow();