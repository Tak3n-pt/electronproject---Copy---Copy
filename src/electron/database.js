// File: electron/database.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "inventory.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      price REAL,
      category TEXT,
      description TEXT,
      quantity INTEGER,
      supplier TEXT,
      sku TEXT,
      barcode TEXT,
      location TEXT,
      reorderLevel INTEGER,
      autoOrder INTEGER
    )
  `);
});

function addProduct(product) {
  const stmt = db.prepare(`
    INSERT INTO products 
    (name, price, category, description, quantity, supplier, sku, barcode, location, reorderLevel, autoOrder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    product.name,
    product.price,
    product.category,
    product.description,
    product.quantity,
    product.supplier,
    product.sku,
    product.barcode,
    product.location,
    product.reorderLevel,
    product.autoOrder ? 1 : 0,
  ]);
  stmt.finalize();
}

function getProducts(callback) {
  db.all(`SELECT * FROM products ORDER BY name ASC`, [], (err, rows) => {
    if (err) {
      console.error(err);
      callback([]);
    } else {
      callback(rows);
    }
  });
}

module.exports = {
  addProduct,
  getProducts,
};
