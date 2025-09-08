// ==================== desktop-server/server.js - COMPLETE FILE ====================
// Desktop Inventory Management Server
// Port 4000

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const Joi = require('joi');
const crypto = require('crypto');
const NodeCache = require('node-cache');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const https = require('https');
const { Server } = require('socket.io');
const http = require('http');
const NetworkDiscovery = require('./networkDiscovery');
const ModernNotificationManager = require('./ModernNotificationManager');

// SERP API Configuration
const SERP_API_KEY = 'c54cf53c128fb3ee1520d3f0cc3da4923e825c6d19d9a19cced9c84c7147cfa0';

const app = express();
const port = 4000;

// UDP Discovery Configuration
const dgram = require('dgram');
const UDP_BROADCAST_PORT = 8765;
const SERVICE_ID = 'REVOTEC_INVENTORY_SYSTEM';

// Create HTTP server and Socket.IO instance for real-time updates
const httpServer = http.createServer(app);

// Connection tracking for rate limiting
const connectionLimits = new Map();
const rateLimiters = new Map();

// Socket.IO with improved security
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // In development, allow all local network connections
      // In production, this should be restricted
      
      // Allow if no origin (same origin)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // Allow localhost connections
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
        return;
      }
      
      // Allow local network connections (192.168.x.x, 10.x.x.x)
      if (origin.includes('192.168.') || origin.includes('10.')) {
        callback(null, true);
        return;
      }
      
      // Allow Expo development
      if (origin.includes('exp://') || origin.includes('exps://')) {
        callback(null, true);
        return;
      }
      
      // For production, you would restrict this
      console.warn('⚠️ WebSocket connection from unknown origin:', origin);
      callback(null, true); // Allow for now in development
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  pingInterval: 25000, // Heartbeat every 25 seconds
  pingTimeout: 60000,  // Timeout after 60 seconds
  transports: ['websocket', 'polling'] // Allow both transports
});

// Initialize network discovery and notifications
const discovery = new NetworkDiscovery();
const notificationManager = new ModernNotificationManager();

const productCache = new NodeCache({ stdTTL: 300 });
const pendingInvoices = new NodeCache({ stdTTL: 3600 });
const imageCache = new NodeCache({ stdTTL: 1800 }); // 30 minutes cache for images
const serpCache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache for SERP results

// ==================== GCS IMAGE DOWNLOADER ====================
async function downloadGCSImage(gcsUrl, requestId, pageNumber = null) {
  if (!gcsUrl) return null;
  
  try {
    console.log(`[GCS_DOWNLOAD] Downloading image from: ${gcsUrl}`);
    
    const response = await axios({
      method: 'GET',
      url: gcsUrl,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Desktop-Invoice-App/1.0'
      }
    });

    if (response.status === 200) {
      const imageBuffer = Buffer.from(response.data);
      console.log(`[GCS_DOWNLOAD] Downloaded ${imageBuffer.length} bytes`);
      return imageBuffer;
    } else {
      console.error(`[GCS_DOWNLOAD] Failed to download: HTTP ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error(`[GCS_DOWNLOAD] Error downloading from GCS:`, error.message);
    return null;
  }
}

// ==================== DATABASE SETUP ====================
// Use the database in the main electron app directory
const dbPath = path.join(__dirname, '..', '..', 'inventory.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');

  // Enable foreign keys and force synchronous writes for data persistence
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA synchronous = FULL');  // Force immediate writes to disk
  db.run('PRAGMA journal_mode = DELETE'); // Use traditional journaling for better persistence

  // Create tables
  db.serialize(() => {
    // Vendors table
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
    `, (err) => {
      if (err) console.error('Error creating vendors table:', err);
      else console.log('Vendors table ready');
    });

    // Categories table
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating categories table:', err);
      else console.log('Categories table ready');
    });

    // Products table with image support
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT UNIQUE,
        price REAL,
        quantity REAL DEFAULT 0,
        vendor_id INTEGER,
        category_id INTEGER,
        description TEXT,
        min_stock_level REAL DEFAULT 5,
        max_stock_level REAL DEFAULT 100,
        cost_price REAL,
        markup_percentage REAL,
        is_active INTEGER DEFAULT 1,
        image_url TEXT DEFAULT NULL,
        image_local_path TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT,
        last_sold TEXT,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `, (err) => {
      if (err) console.error('Error creating products table:', err);
      else console.log('Products table ready');
    });

    // Inventory movements table
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
        quantity REAL NOT NULL,
        previous_quantity REAL NOT NULL,
        new_quantity REAL NOT NULL,
        reason TEXT,
        reference_transaction_id TEXT,
        user_id TEXT,
        timestamp TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `, (err) => {
      if (err) console.error('Error creating inventory_movements table:', err);
      else console.log('Inventory movements table ready');
    });

    // Recent scans tracking table
    db.run(`
      CREATE TABLE IF NOT EXISTS recent_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT NOT NULL,
        found INTEGER DEFAULT 0,
        scanned_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating recent_scans table:', err);
      else console.log('Recent scans table ready');
    });

    // Invoice images table for multiple images support
    db.run(`
      CREATE TABLE IF NOT EXISTS invoice_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        image_path TEXT,
        page_number INTEGER DEFAULT 1,
        image_type TEXT DEFAULT 'main',
        original_name TEXT,
        mime_type TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Error creating invoice_images table:', err);
      else console.log('Invoice images table ready');
    });

    // Transactions table
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL UNIQUE,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'purchase', 'adjustment')),
        timestamp TEXT DEFAULT (datetime('now')),
        notes TEXT,
        user_id TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `, (err) => {
      if (err) console.error('Error creating transactions table:', err);
      else console.log('Transactions table ready');
    });

    // Invoices table
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
    `, (err) => {
      if (err) console.error('Error creating invoices table:', err);
      else console.log('Invoices table ready');
    });

    // Add missing columns to existing invoices table
    db.run(`ALTER TABLE invoices ADD COLUMN invoice_date TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding invoice_date column:', err);
      }
    });
    
    db.run(`ALTER TABLE invoices ADD COLUMN invoice_image_url TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding invoice_image_url column:', err);
      }
    });
    
    db.run(`ALTER TABLE invoices ADD COLUMN vendor_name TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding vendor_name column:', err);
      }
    });
    
    // Add new columns for complete data extraction
    db.run(`ALTER TABLE invoices ADD COLUMN quality_analysis TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding quality_analysis column:', err);
      }
    });
    
    db.run(`ALTER TABLE invoices ADD COLUMN totals_data TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding totals_data column:', err);
      }
    });
    
    db.run(`ALTER TABLE invoices ADD COLUMN has_invoice_image BOOLEAN DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding has_invoice_image column:', err);
      }
    });

    // IMPORTANT: For existing databases, quantity fields need to be migrated from INTEGER to REAL
    // to support decimal quantities. If you have an existing database, you may need to:
    // 1. Back up your database
    // 2. Delete inventory.db to recreate with new schema
    // 3. Or manually run: ALTER TABLE products ADD COLUMN quantity_new REAL; UPDATE products SET quantity_new = quantity; etc.
    
    // Queue sync notifications table - NEW for enhanced queue system
    db.run(`
      CREATE TABLE IF NOT EXISTS queue_sync_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        queue_id TEXT NOT NULL,
        request_id TEXT,
        vendor TEXT NOT NULL,
        total_items INTEGER NOT NULL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        image_count INTEGER DEFAULT 0,
        is_multi_page INTEGER DEFAULT 0,
        page_count INTEGER DEFAULT 1,
        sync_timestamp TEXT DEFAULT (datetime('now')),
        source TEXT DEFAULT 'mobile_queue',
        raw_data TEXT,
        notification_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating queue_sync_notifications table:', err);
      else console.log('Queue sync notifications table ready');
    });

    // Sales sync notifications table - NEW for mobile sales tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS sales_sync_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        barcode TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        remaining_stock INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now')),
        source TEXT DEFAULT 'mobile_sale',
        raw_data TEXT,
        notification_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating sales_sync_notifications table:', err);
      else console.log('Sales sync notifications table ready');
    });

    // Scans sync notifications table - NEW for mobile scan tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS scans_sync_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT NOT NULL,
        scan_type TEXT NOT NULL, -- 'barcode_scan', 'invoice_scan'
        vendor TEXT,
        product_name TEXT,
        barcode TEXT,
        total_items INTEGER DEFAULT 0,
        total_amount REAL DEFAULT 0,
        image_count INTEGER DEFAULT 0,
        is_multi_page INTEGER DEFAULT 0,
        timestamp TEXT DEFAULT (datetime('now')),
        source TEXT DEFAULT 'mobile_scan',
        raw_data TEXT,
        notification_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating scans_sync_notifications table:', err);
      else console.log('Scans sync notifications table ready');
    });
    
    // Add image_path column to scans_sync_notifications if it doesn't exist
    db.run(`
      ALTER TABLE scans_sync_notifications 
      ADD COLUMN image_path TEXT DEFAULT NULL
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding image_path column to scans_sync_notifications:', err);
      } else if (!err) {
        console.log('Added image_path column to scans_sync_notifications table');
      }
    });
    
    // Modern notifications table - for persistent notification storage
    db.run(`
      CREATE TABLE IF NOT EXISTS modern_notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        icon TEXT,
        color TEXT,
        priority TEXT DEFAULT 'normal',
        timestamp INTEGER NOT NULL,
        read INTEGER DEFAULT 0,
        action TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT DEFAULT (datetime('now', '+7 days'))
      )
    `, (err) => {
      if (err) console.error('Error creating modern_notifications table:', err);
      else console.log('Modern notifications table ready');
    });

    // Create indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)');
    db.run('CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_queue_notifications_timestamp ON queue_sync_notifications(sync_timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_queue_notifications_read ON queue_sync_notifications(notification_read)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sales_notifications_timestamp ON sales_sync_notifications(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sales_notifications_read ON sales_sync_notifications(notification_read)');
    db.run('CREATE INDEX IF NOT EXISTS idx_scans_notifications_timestamp ON scans_sync_notifications(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_scans_notifications_read ON scans_sync_notifications(notification_read)');
    
    // Add product_code and reference columns if they don't exist (for Azure Document AI integration)
    db.run(`ALTER TABLE products ADD COLUMN product_code TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('Error adding product_code column:', err.message);
      } else if (!err) {
        console.log('✅ Added product_code column to products table');
      }
    });
    
    db.run(`ALTER TABLE products ADD COLUMN reference TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.log('Error adding reference column:', err.message);
      } else if (!err) {
        console.log('✅ Added reference column to products table');
      }
    });
    
    // Add indexes for the new columns
    db.run('CREATE INDEX IF NOT EXISTS idx_products_product_code ON products(product_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_products_reference ON products(reference)');
    
    console.log('Database initialization complete');
    
    // Initialize notification manager with database
    notificationManager.initialize(db).then(() => {
      console.log('✅ Notification manager initialized with database persistence');
      
      // Set up periodic cleanup of expired notifications (runs every 2 hours - optimized)
      setInterval(async () => {
        try {
          await notificationManager.cleanupExpired();
          console.log('🗑️ Periodic cleanup of expired notifications completed');
        } catch (error) {
          console.error('❌ Error during periodic notification cleanup:', error);
        }
      }, 2 * 60 * 60 * 1000); // Run every 2 hours (optimized from 1hr - less DB operations)
      
      // Run initial cleanup
      notificationManager.cleanupExpired();
    }).catch(err => {
      console.error('❌ Error initializing notification manager:', err);
    });
    
    // FIXED: Ensure invoice-images directory exists on startup
    const fs = require('fs');
    const invoiceImagesDir = path.join(__dirname, 'invoice-images');
    if (!fs.existsSync(invoiceImagesDir)) {
      fs.mkdirSync(invoiceImagesDir, { recursive: true });
      console.log(`✅ Created invoice-images directory: ${invoiceImagesDir}`);
    } else {
      console.log(`✅ Invoice-images directory exists: ${invoiceImagesDir}`);
    }
  });
});

// ==================== MIDDLEWARE ====================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/product-images', express.static(path.join(__dirname, 'product-images')));
app.use('/invoice-images', express.static(path.join(__dirname, 'invoice-images')));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Enhanced logging middleware for mobile app connections
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
  
  // Detect if request is likely from mobile app
  const isMobileApp = userAgent.includes('okhttp') || // React Native default
                      userAgent.includes('ReactNative') ||
                      userAgent.includes('Expo') ||
                      req.get('Accept')?.includes('application/json') ||
                      req.url.includes('/health') ||
                      req.url.includes('/products') ||
                      req.url.includes('/search');
                      
  if (isMobileApp || req.url.includes('/health')) {
    console.log(`📱 [${timestamp}] ${req.method} ${req.url} from ${clientIP}`);
    if (userAgent) {
      console.log(`   └─ User-Agent: ${userAgent.slice(0, 80)}${userAgent.length > 80 ? '...' : ''}`);
    }
    
    // Log successful connections
    res.on('finish', () => {
      const statusEmoji = res.statusCode < 300 ? '✅' : res.statusCode < 400 ? '⚠️' : '❌';
      console.log(`   └─ Response: ${statusEmoji} ${res.statusCode} (${res.get('Content-Length') || '0'} bytes)`);
      
      if (res.statusCode < 300 && req.url === '/health') {
        console.log('🎉 [CONNECTION] Mobile app successfully discovered desktop server!');
      }
    });
  }
  
  next();
});

app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));

// ==================== DATABASE HELPERS ====================
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

// ==================== SERP API INTEGRATION ====================
// Search for product images using SERP API
async function searchProductImages(productName, numResults = 15) {
  try {
    // Use the product name as-is - NO MODIFICATIONS!
    // Let SERP API find images however Google naturally would
    let searchQuery = productName.trim();
    
    // REMOVED: All query modifications that might bias results
    // Just search for exactly what the user provided
    
    // Check cache first
    const cacheKey = `serp_${searchQuery.toLowerCase().trim()}`;
    const cached = serpCache.get(cacheKey);
    if (cached && cached.images.length > 0) {
      console.log(`✓ SERP cache hit for: ${productName} (${cached.images.length} images)`);
      return cached;
    }

    console.log(`🔍 Searching SERP API for: "${searchQuery}" (original: "${productName}")`);
    
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_images',
        q: searchQuery,
        api_key: SERP_API_KEY,
        num: numResults,
        hl: 'fr',        // French language for local relevance
        gl: 'dz',        // Algeria geolocation for better local results
        safe: 'active'   // Keep some safety filtering
      },
      timeout: 15000
    });

    const images = response.data.images_results || [];
    
    // Process ALL images from SERP and detect blocked sources
    const validImages = [];
    
    // Helper function to detect blocked sources
    const isBlockedSource = (url) => {
      return url.includes('facebook') || url.includes('fbsbx') || 
             url.includes('instagram') || url.includes('cdninstagram') ||
             url.includes('twitter') || url.includes('twimg');
    };
    
    for (const img of images) {
      if (img.original && isValidImageUrl(img.original)) {
        const blocked = isBlockedSource(img.original);
        validImages.push({
          url: img.original,
          thumbnail: img.thumbnail || img.original,
          title: img.title || '',
          source: img.source || '',
          width: img.original_width || 0,
          height: img.original_height || 0,
          blocked: blocked,  // Mark blocked sources
          downloadable: !blocked  // Mark downloadable sources
        });
        console.log(`${blocked ? '🚫' : '✅'} ${blocked ? 'Blocked' : 'Downloadable'}: ${img.original}`);
      }
    }

    // If no valid images found, try a broader search
    if (validImages.length === 0) {
      console.log(`⚠️  No images found, trying broader search...`);
      
      // Try with just the first 2-3 words - NO RESTRICTIONS!
      const simplifiedQuery = productName.split(/\s+/).slice(0, 2).join(' ');
      
      const fallbackResponse = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_images',
          q: simplifiedQuery,
          api_key: SERP_API_KEY,
          num: 20,
          hl: 'fr',
          gl: 'dz',
          safe: 'active'
        },
        timeout: 10000
      }).catch(err => null);
      
      if (fallbackResponse?.data?.images_results) {
        for (const img of fallbackResponse.data.images_results) {
          if (img.original && isValidImageUrl(img.original)) {
            validImages.push({
              url: img.original,
              thumbnail: img.thumbnail || img.original,
              title: img.title || '',
              source: img.source || '',
              width: img.original_width || 0,
              height: img.original_height || 0
            });
          }
        }
        console.log(`✓ Fallback search found ${validImages.length} images`);
      }
    }

    // Enhanced image quality scoring for 100% accuracy
    const calculateImageQuality = (img) => {
      let score = 0;
      
      // 1. Size quality (resolution matters for product photos)
      const pixels = (img.width || 0) * (img.height || 0);
      if (pixels >= 300000) score += 100; // High res (excellent)
      else if (pixels >= 100000) score += 80; // Medium res (good)
      else if (pixels >= 50000) score += 60; // Low res (acceptable)
      else score += 20; // Very low res (poor)
      
      // 2. Aspect ratio quality (avoid extremely stretched images)
      if (img.width && img.height) {
        const aspectRatio = img.width / img.height;
        if (aspectRatio >= 0.5 && aspectRatio <= 2.0) {
          score += 30; // Good aspect ratio
        } else {
          score += 10; // Stretched/distorted
        }
      }
      
      // 3. Reliable source bonus (trustworthy product images)
      const reliableSources = [
        'amazon', 'ebay', 'alibaba', 'aliexpress', 'walmart', 'target',
        'shopify', 'woocommerce', 'magento', 'prestashop'
      ];
      if (reliableSources.some(s => img.url.toLowerCase().includes(s))) {
        score += 50; // Major bonus for e-commerce sites
      }
      
      // 4. Image format quality (prefer common web formats)
      const url = img.url.toLowerCase();
      if (url.includes('.jpg') || url.includes('.jpeg')) score += 20;
      else if (url.includes('.png')) score += 25;
      else if (url.includes('.webp')) score += 30; // Modern, optimized
      else score += 10; // Unknown or poor format
      
      // 5. URL quality indicators (clean, direct image URLs)
      if (img.url.includes('/images/') || img.url.includes('/photos/')) score += 15;
      if (img.url.includes('/products/') || img.url.includes('/items/')) score += 20;
      if (img.url.includes('thumb') || img.url.includes('small')) score -= 20; // Thumbnails
      if (img.url.includes('large') || img.url.includes('original')) score += 25; // Full size
      
      // 6. Title relevance bonus (if title matches product better)
      if (img.title) {
        const titleWords = img.title.toLowerCase().split(/\s+/);
        const productWords = productName.toLowerCase().split(/\s+/);
        const matchCount = titleWords.filter(word => 
          productWords.some(pWord => pWord.includes(word) || word.includes(pWord))
        ).length;
        score += Math.min(matchCount * 10, 40); // Up to 40 points for relevance
      }
      
      return score;
    };
    
    // Sort images: downloadable first, then by enhanced quality score
    const sortedImages = validImages.sort((a, b) => {
      // 1. Downloadable images ALWAYS first (non-negotiable)
      if (a.downloadable !== b.downloadable) {
        return a.downloadable ? -1 : 1;
      }
      
      // 2. Then by comprehensive quality score
      const scoreA = calculateImageQuality(a);
      const scoreB = calculateImageQuality(b);
      
      return scoreB - scoreA; // Highest quality first
    });

    const downloadableCount = sortedImages.filter(img => img.downloadable).length;
    const blockedCount = sortedImages.filter(img => img.blocked).length;
    
    const result = {
      query: productName,
      searchQuery: searchQuery,
      images: sortedImages,
      total: sortedImages.length,
      downloadableCount,
      blockedCount,
      bestImage: sortedImages.find(img => img.downloadable) || sortedImages[0], // Best downloadable or first available
      searchedAt: new Date().toISOString()
    };

    // Cache the results only if we found images
    if (sortedImages.length > 0) {
      serpCache.set(cacheKey, result);
    }
    
    console.log(`✓ SERP found ${sortedImages.length} images for: ${productName}`);
    console.log(`📊 Images breakdown: ${downloadableCount} downloadable, ${blockedCount} blocked`);
    return result;
    
  } catch (error) {
    console.error(`❌ SERP API error for "${productName}":`, error.response?.data || error.message);
    return {
      query: productName,
      images: [],
      total: 0,
      error: error.message,
      searchedAt: new Date().toISOString()
    };
  }
}

// Validate image URL - NO MORE BLOCKING!
function isValidImageUrl(url) {
  // ALLOW ALL IMAGES - Let SERP API decide!
  // No restrictions, no filters, just validate it's a URL
  
  if (!url || typeof url !== 'string') return false;
  
  // Only check if it's a valid URL - nothing else!
  try {
    new URL(url);
    // Accept any http/https URL - let SERP API be the judge!
    return url.startsWith('http');
  } catch {
    return false;
  }
}

// ==================== INTELLIGENT IMAGE SELECTION FOR BACKGROUND PROCESSING ====================
// Server-side adaptation of UI's selectBestImage logic for automatic processing
function selectBestImagesForBackground(images, productName = '', maxImages = 3) {
  if (!images || images.length === 0) return [];
  
  // CRITICAL: Filter downloadable images first (non-blocked sources)
  const downloadableImages = images.filter(img => !img.blocked);
  
  if (downloadableImages.length === 0) {
    console.log(`⚠️ No downloadable images found for "${productName}" - all ${images.length} images are blocked`);
    return [];
  }
  
  console.log(`🎯 Found ${downloadableImages.length} downloadable images for "${productName}" (${images.length - downloadableImages.length} blocked)`);
  
  // Score each downloadable image using same logic as UI
  const scoredImages = downloadableImages.map(image => {
    let score = 0;
    const url = image.url || '';
    const title = (image.title || '').toLowerCase();
    const source = (image.source || '').toLowerCase();
    
    // Prefer high-quality image hosts (same as UI)
    if (url.includes('amazon')) score += 50;
    if (url.includes('ebay')) score += 40;
    if (url.includes('bestbuy')) score += 40;
    if (url.includes('walmart')) score += 35;
    if (url.includes('target')) score += 35;
    if (url.includes('gamestop')) score += 45;
    if (url.includes('playstation') || url.includes('xbox') || url.includes('nintendo')) score += 40;
    
    // Avoid low-quality sources
    if (url.includes('aliexpress') || url.includes('wish')) score -= 20;
    if (url.includes('pinterest')) score -= 15;
    
    // Prefer images with relevant keywords in title
    if (productName) {
      const productWords = productName.toLowerCase().split(' ');
      productWords.forEach(word => {
        if (word.length > 2 && title.includes(word)) {
          score += 15;
        }
      });
    }
    
    // Prefer gaming-related keywords
    const gamingKeywords = ['gaming', 'game', 'controller', 'console', 'playstation', 'xbox', 'nintendo', 'pc'];
    gamingKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 10;
    });
    
    // Prefer product images over lifestyle/scene images
    if (title.includes('product') || title.includes('official')) score += 20;
    if (title.includes('lifestyle') || title.includes('scene') || title.includes('setup')) score -= 10;
    
    // Prefer HTTPS and common image formats
    if (url.startsWith('https://')) score += 10;
    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) score += 15;
    
    // Penalize very long URLs (often complex/generated)
    if (url.length > 200) score -= 10;
    
    // Prefer images with dimensions info (usually higher quality)
    if (image.width && image.height) {
      const area = image.width * image.height;
      if (area > 400000) score += 20; // > 800x500
      else if (area > 250000) score += 15; // > 500x500
      else if (area > 100000) score += 10; // > 316x316
      else if (area < 10000) score -= 20; // < 100x100 (too small)
      
      // Prefer square or landscape orientations for products
      const ratio = image.width / image.height;
      if (ratio >= 0.8 && ratio <= 1.5) score += 10; // Good product ratios
    }
    
    return { ...image, score };
  });
  
  // Sort by score (highest first) and return the best ones for retry
  const bestImages = scoredImages.sort((a, b) => b.score - a.score).slice(0, maxImages);
  
  console.log(`🏆 Selected ${bestImages.length} best images for "${productName}":`);
  bestImages.forEach((img, idx) => {
    console.log(`   ${idx + 1}. Score: ${img.score} - ${img.url.substring(0, 80)}...`);
  });
  
  return bestImages;
}

// Smart retry mechanism for background image downloading
async function tryMultipleImagesForBackground(images, productId, productName) {
  if (!images || images.length === 0) {
    console.log(`❌ No images to try for product ${productId} "${productName}"`);
    return null;
  }
  
  console.log(`🔄 Trying ${images.length} high-quality images for "${productName}"...`);
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      console.log(`   Attempt ${i + 1}/${images.length}: Downloading ${image.url.substring(0, 80)}... (Score: ${image.score})`);
      
      const result = await downloadImageWithValidation(image.url, productId);
      
      if (result && (result.localPath || result.url)) {
        console.log(`   ✅ SUCCESS on attempt ${i + 1}: ${result.localPath ? 'Downloaded locally' : 'Using direct URL'}`);
        return { ...result, originalUrl: image.url }; // Success - include original URL for consistency
      } else {
        console.log(`   ⚠️ Attempt ${i + 1} returned no result - trying next image`);
      }
    } catch (error) {
      console.log(`   ❌ Attempt ${i + 1} failed: ${error.message}${i < images.length - 1 ? ' - trying next image' : ''}`);
      continue; // Try next image
    }
  }
  
  console.log(`❌ All ${images.length} attempts failed for "${productName}"`);
  return null; // All attempts failed
}

// Download and validate image with timeout and size limits
// If download fails, we'll still return the URL for direct display
async function downloadImageWithValidation(url, productId, maxSizeKB = 2048, allowFallback = true) {
  try {
    if (!url || !isValidImageUrl(url)) {
      throw new Error('Invalid image URL');
    }

    console.log(`📥 Downloading image for product ${productId}: ${url}`);

    const uploadPath = path.join(__dirname, 'product-images/');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Create a timeout for the download
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 10000,
      signal: controller.signal,
      maxContentLength: maxSizeKB * 1024, // Size limit in bytes
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);

    // Check content type
    const contentType = response.headers['content-type'];
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const filename = `product_${productId}_${Date.now()}.jpg`;
    const filepath = path.join(uploadPath, filename);
    const writer = fs.createWriteStream(filepath);

    return new Promise((resolve, reject) => {
      let downloadedSize = 0;
      const maxSize = maxSizeKB * 1024;

      response.data.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (downloadedSize > maxSize) {
          writer.destroy();
          fs.unlink(filepath, () => {}); // Clean up partial file
          reject(new Error(`Image too large: ${downloadedSize} bytes`));
          return;
        }
      });

      response.data.pipe(writer);
      
      writer.on('finish', () => {
        writer.close();
        console.log(`✓ Downloaded image for product ${productId}: ${filename} (${downloadedSize} bytes)`);
        // Return object with local path for downloaded image
        resolve({ localPath: `/product-images/${filename}`, url: null });
      });
      
      writer.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Clean up on error
        reject(err);
      });
    });

  } catch (error) {
    console.error(`⚠️ Failed to download image for product ${productId}:`, error.message);
    
    // Enhanced fallback logic for blocked/restricted images
    if (allowFallback && url && isValidImageUrl(url)) {
      // Determine the reason for failure to provide better logging
      const errorMsg = error.message.toLowerCase();
      let reason = 'unknown';
      
      if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
        reason = 'timeout';
      } else if (errorMsg.includes('cors') || errorMsg.includes('403') || errorMsg.includes('forbidden')) {
        reason = 'blocked/cors';
      } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        reason = 'not_found';
      } else if (errorMsg.includes('content-type') || errorMsg.includes('invalid')) {
        reason = 'invalid_format';
      } else if (errorMsg.includes('large') || errorMsg.includes('size')) {
        reason = 'too_large';
      }
      
      console.log(`🌐 Download failed (${reason}) - Using direct URL display for product ${productId}: ${url}`);
      
      // Return URL for direct display - React will handle CORS and blocked images gracefully
      return { 
        localPath: null, 
        url: url,
        fallbackReason: reason,
        downloadFailed: true 
      };
    }
    
    console.warn(`❌ Complete failure for product ${productId} - URL not valid or fallback disabled`);
    return { localPath: null, url: null, error: error.message };
  }
}

// Image proxy endpoint to bypass CORS restrictions
app.get('/proxy/image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }
  
  try {
    console.log(`🖼️ Proxying image: ${url}`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.facebook.com/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    // Set appropriate content type
    const contentType = response.headers['content-type'];
    if (contentType && contentType.startsWith('image/')) {
      res.set('Content-Type', contentType);
    } else {
      res.set('Content-Type', 'image/jpeg'); // Default fallback
    }
    
    // Set CORS headers to allow frontend access
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Pipe the image data directly to the response
    response.data.pipe(res);
    
  } catch (error) {
    console.error(`❌ Image proxy failed for ${url}:`, error.message);
    
    // Return a 1x1 transparent GIF as fallback
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(transparentGif);
  }
});

// Test endpoint for blocked image handling
app.post('/test/blocked-image', async (req, res) => {
  try {
    // Test with a Facebook image URL that should be blocked
    const testUrls = [
      'https://scontent.facebook.com/test-image.jpg', // Facebook (blocked)
      'https://instagram.com/p/test/media/?url=test.jpg', // Instagram (blocked)
      'https://images-na.ssl-images-amazon.com/images/test.jpg', // Amazon (might work)
      'https://i.ebayimg.com/images/test.jpg' // eBay (might work)
    ];
    
    const results = [];
    
    for (const url of testUrls) {
      console.log(`\n🧪 Testing blocked image handling: ${url}`);
      const result = await downloadImageWithValidation(url, 'test-blocked-' + Date.now(), 500, true);
      
      results.push({
        url,
        result: result,
        canDownload: !!result?.localPath,
        hasUrl: !!result?.url,
        status: result?.localPath ? 'downloaded' : result?.url ? 'url-only' : 'failed',
        reason: result?.fallbackReason || 'unknown'
      });
    }
    
    res.json({
      success: true,
      message: 'Blocked image test complete',
      results,
      summary: {
        total: results.length,
        downloaded: results.filter(r => r.status === 'downloaded').length,
        urlOnly: results.filter(r => r.status === 'url-only').length,
        failed: results.filter(r => r.status === 'failed').length
      }
    });
    
  } catch (error) {
    console.error('Blocked image test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to check image directory status
app.get('/debug/images-dir', (req, res) => {
  try {
    const imageDir = path.join(__dirname, 'product-images/');
    const exists = fs.existsSync(imageDir);
    
    let stats = null;
    let files = [];
    
    if (exists) {
      stats = fs.statSync(imageDir);
      files = fs.readdirSync(imageDir);
    }
    
    res.json({
      success: true,
      directory: imageDir,
      exists,
      stats: stats ? {
        isDirectory: stats.isDirectory(),
        permissions: stats.mode.toString(8),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      } : null,
      fileCount: files.length,
      files: files.slice(0, 10), // Show first 10 files
      canWrite: exists ? fs.constants.W_OK : 'Directory does not exist'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// Test endpoint for external image URLs (Facebook, Instagram, etc.)
app.post('/test/external-image', async (req, res) => {
  const testUrls = [
    // Facebook CDN test
    'https://lookaside.fbsbx.com/test-image.jpg',
    // Instagram test  
    'https://instagram.com/p/test-image.jpg',
    // Regular image that should download
    'https://via.placeholder.com/300x200',
  ];
  
  const results = [];
  
  for (const url of testUrls) {
    console.log(`\n🧪 Testing image URL: ${url}`);
    const isValid = isValidImageUrl(url);
    console.log(`  Valid: ${isValid}`);
    
    if (isValid) {
      const result = await downloadImageWithValidation(url, 'test-product-' + Date.now(), 500, true);
      results.push({
        url,
        isValid,
        downloadResult: result,
        status: result?.localPath ? 'downloaded' : result?.url ? 'url-only' : 'failed'
      });
    } else {
      results.push({ url, isValid, status: 'invalid' });
    }
  }
  
  res.json({
    success: true,
    message: 'External image test complete',
    results,
    summary: {
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      downloaded: results.filter(r => r.status === 'downloaded').length,
      urlOnly: results.filter(r => r.status === 'url-only').length,
      failed: results.filter(r => r.status === 'failed' || r.status === 'invalid').length
    }
  });
});

// ==================== IMAGE HANDLING ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'product-images/');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

// Legacy download image function for backward compatibility
async function downloadImage(url, productId) {
  const result = await downloadImageWithValidation(url, productId);
  // For backward compatibility, return local path if available, otherwise URL
  return result?.localPath || result?.url || null;
}

// ==================== VENDOR & CATEGORY HELPERS ====================
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

// ==================== INVENTORY MANAGEMENT ====================
async function logInventoryMovement(productId, movementType, quantity, previousQuantity, newQuantity, reason, referenceTransactionId = null, userId = null) {
  try {
    await dbRun(
      `INSERT INTO inventory_movements
       (product_id, movement_type, quantity, previous_quantity, new_quantity, reason, reference_transaction_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, movementType, quantity, previousQuantity, newQuantity, reason, referenceTransactionId, userId]
    );
  } catch (err) {
    console.error('Failed to log inventory movement:', err.message);
  }
}

async function createTransaction(transactionData) {
  const { transactionId, productId, quantity, unitPrice, totalPrice, type, notes = null, userId = null } = transactionData;

  await dbRun(
    `INSERT INTO transactions
     (transaction_id, product_id, quantity, unit_price, total_price, transaction_type, notes, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [transactionId, productId, quantity, unitPrice, totalPrice, type, notes, userId]
  );
}

// ==================== SERP API ENDPOINTS ====================
// Get product images from SERP API
app.post('/products/search-images', async (req, res) => {
  const { productName, numResults = 10 } = req.body;
  
  if (!productName) {
    return res.status(400).json({
      success: false,
      error: 'Product name is required'
    });
  }
  
  try {
    const result = await searchProductImages(productName.toString().trim(), parseInt(numResults));
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Image search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search for images',
      details: error.message
    });
  }
});

// Download specific image and return local path
app.post('/products/download-image', async (req, res) => {
  const { imageUrl, productId } = req.body;
  
  if (!imageUrl || !productId) {
    return res.status(400).json({
      success: false,
      error: 'Image URL and product ID are required'
    });
  }
  
  try {
    // Always download a fresh image when user explicitly changes it
    const downloadResult = await downloadImageWithValidation(imageUrl, productId);

    if (!downloadResult) {
      return res.status(400).json({
        success: false,
        error: 'Failed to process image',
        originalUrl: imageUrl,
      });
    }
    
    // Accept result even if only URL is available (download failed but URL is valid)
    if (!downloadResult.localPath && !downloadResult.url) {
      return res.status(400).json({
        success: false,
        error: 'Invalid image URL or complete download failure',
        originalUrl: imageUrl,
        details: downloadResult.error || 'No valid path or URL returned'
      });
    }
      
    // Update product in database
    try {
      const product = await dbGet('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);
      if (product) {
        const newLocalPath = downloadResult.localPath || null; // May be null for blocked images
        const newImageUrl = imageUrl; // Always save the original URL
        
        await dbRun(
          'UPDATE products SET image_url = ?, image_local_path = ?, updated_at = datetime("now") WHERE id = ?',
          [newImageUrl, newLocalPath, productId]
        );
        
        if (newLocalPath) {
          console.log(`✓ Downloaded and stored locally for product ${productId}. Local: ${newLocalPath}, URL: ${newImageUrl}`);
        } else {
          console.log(`✓ Stored URL for product ${productId} (download blocked/failed). URL: ${newImageUrl} - will display directly`);
        }

        
        // Clean up old image file if it exists and is different
        if (product.image_local_path && newLocalPath && product.image_local_path !== newLocalPath) {
          try {
            const oldImagePath = path.join(__dirname, product.image_local_path);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
              console.log(`🗑️ Cleaned up old image: ${product.image_local_path}`);
            }
          } catch (cleanupError) {
            console.warn('Failed to cleanup old image:', cleanupError.message);
          }
        }
        
        res.json({
          success: true,
          message: newLocalPath ? 'Image downloaded and updated successfully' : 'Using direct URL for image display',
          localPath: newLocalPath,
          imageUrl: newImageUrl,
          originalUrl: imageUrl
        });
      } else {
        res.status(404).json({ success: false, error: 'Product not found, cannot assign image.' });
      }
    } catch (dbError) {
      console.warn('Failed to update product with image path:', dbError.message);
      res.status(500).json({ success: false, error: 'Failed to update database with new image.' });
    }
    
  } catch (error) {
    console.error('❌ Image download error:', error);
    
    // Provide more specific error messages
    let userMessage = 'Failed to download image';
    if (error.message.includes('Invalid image URL')) {
      // No more blocking - this shouldn't happen now
      userMessage = 'Invalid image URL format';
    } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      userMessage = 'Download timed out - the image server may be slow or unavailable';
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      userMessage = 'Cannot connect to image server - please try a different image';
    } else if (error.message.includes('too large')) {
      userMessage = 'Image file is too large (max 2MB) - please try a smaller image';
    } else if (error.message.includes('Invalid content type')) {
      userMessage = 'Invalid image format - only JPG, PNG, WebP, GIF allowed';
    } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
      userMessage = 'File permission error - unable to save image to disk';
    }
    
    res.status(500).json({
      success: false,
      error: userMessage,
      originalUrl: imageUrl,
      details: error.message
    });
  }
});

// Batch search images for multiple products
app.post('/products/batch-search-images', async (req, res) => {
  const { products } = req.body;
  
  if (!products || !Array.isArray(products)) {
    return res.status(400).json({
      success: false,
      error: 'Products array is required'
    });
  }
  
  try {
    const results = [];
    
    // Process up to 5 products at a time to avoid overwhelming SERP API
    for (let i = 0; i < products.length; i += 5) {
      const batch = products.slice(i, i + 5);
      const batchPromises = batch.map(async (product) => {
        if (!product.name) return { productId: product.id, images: [], error: 'No product name' };
        
        const searchResult = await searchProductImages(product.name, 5); // Get fewer images for batch
        return {
          productId: product.id,
          productName: product.name,
          ...searchResult
        };
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message }));
      
      // Small delay between batches to be respectful to the API
      if (i + 5 < products.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    res.json({
      success: true,
      results: results,
      totalProducts: products.length
    });
    
  } catch (error) {
    console.error('Batch image search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search for images',
      details: error.message
    });
  }
});

// ==================== NEW: BATCH CHECK PRODUCTS ====================
// Endpoint for checking if products exist (called by mobile app test)
app.post('/products/check-batch', async (req, res) => {
  const { barcodes } = req.body;
  
  if (!barcodes || !Array.isArray(barcodes)) {
    return res.status(400).json({
      success: false,
      error: 'Barcodes array is required'
    });
  }
  
  try {
    console.log(`[CHECK-BATCH] Checking ${barcodes.length} barcodes`);
    const products = [];
    
    for (const barcode of barcodes) {
      const productData = await dbGet(`
        SELECT p.*, v.name as vendor_name, c.name as category_name 
        FROM products p 
        LEFT JOIN vendors v ON p.vendor_id = v.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.barcode = ? AND p.is_active = 1
      `, [barcode]);
      
      products.push({
        barcode: barcode,
        found: !!productData,
        name: productData?.name || null,
        quantity: productData?.quantity || 0,
        price: productData?.price || 0,
        product: productData
      });
    }
    
    const foundCount = products.filter(p => p.found).length;
    console.log(`[CHECK-BATCH] Found ${foundCount}/${barcodes.length} products`);
    
    res.json({
      success: true,
      products: products,
      summary: {
        total: barcodes.length,
        found: foundCount,
        notFound: barcodes.length - foundCount
      }
    });
  } catch (error) {
    console.error('[CHECK-BATCH] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check products'
    });
  }
});

app.post('/products/batch-check', async (req, res) => {
  const { products } = req.body;
  
  if (!products || !Array.isArray(products)) {
    return res.status(400).json({
      success: false,
      error: 'Products array is required'
    });
  }
  
  try {
    console.log(`[BATCH-CHECK] Checking ${products.length} products`);
    const results = [];
    
    for (const product of products) {
      let found = false;
      let productData = null;
      
      // Try barcode first
      if (product.barcode) {
        productData = await dbGet(`
          SELECT p.*, v.name as vendor_name, c.name as category_name 
          FROM products p 
          LEFT JOIN vendors v ON p.vendor_id = v.id 
          LEFT JOIN categories c ON p.category_id = c.id 
          WHERE p.barcode = ? AND p.is_active = 1
        `, [product.barcode]);
        
        if (productData) found = true;
      }
      
      // Try by name if not found
      if (!found && product.name) {
        productData = await dbGet(`
          SELECT p.*, v.name as vendor_name, c.name as category_name 
          FROM products p 
          LEFT JOIN vendors v ON p.vendor_id = v.id 
          LEFT JOIN categories c ON p.category_id = c.id 
          WHERE p.name = ? AND p.is_active = 1
        `, [product.name]);
        
        if (!productData) {
          // Try partial match
          productData = await dbGet(`
            SELECT p.*, v.name as vendor_name, c.name as category_name 
            FROM products p 
            LEFT JOIN vendors v ON p.vendor_id = v.id 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.name LIKE ? AND p.is_active = 1 
            ORDER BY p.name LIMIT 1
          `, [`%${product.name}%`]);
        }
        
        if (productData) found = true;
      }
      
      results.push({
        name: product.name,
        barcode: product.barcode,
        found: found,
        product: productData
      });
    }
    
    const foundCount = results.filter(r => r.found).length;
    console.log(`[BATCH-CHECK] Found ${foundCount}/${products.length} products`);
    
    res.json({
      success: true,
      results: results,
      summary: {
        total: products.length,
        found: foundCount,
        notFound: products.length - foundCount
      }
    });
    
  } catch (err) {
    console.error('Batch check error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check products' 
    });
  }
});

// ==================== NEW: RECEIVE COMPLETE INVOICE FROM BACKEND ====================
app.post('/invoices/finalize', async (req, res) => {
  console.log(`📨 [INVOICE FINALIZE] Mobile app ${req.ip || req.connection.remoteAddress} sending invoice with requestId: ${req.body.requestId}`);
  const { 
    requestId, vendor, vendorDetails, invoiceNumber, invoiceDate, 
    invoiceImage, invoiceImages, imageUris, items, totals, processingNotes, 
    qualityAnalysis, hasInvoiceImage, isMultiPage, pageCount, total,
    // Additional fields from Content Understanding
    additionalFields, metadata, processingMethod, totalValidation,
    confidence, extractionMethod 
  } = req.body;
  
  // Enhanced input validation with data consistency checks
  if (!requestId || typeof requestId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing requestId'
    });
  }
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing items array'
    });
  }
  
  // Calculate expected total from items for consistency check
  let calculatedTotal = 0;
  
  // Validate each item with enhanced checks
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (!item.name && !item.description) {
      return res.status(400).json({
        success: false,
        error: `Item ${i + 1}: Must have a name or description`
      });
    }
    
    // Validate and sanitize quantity
    const quantity = parseFloat(item.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: `Item ${i + 1} (${item.name || 'unnamed'}): Invalid quantity (${item.quantity}). Must be a positive number`
      });
    }
    item.quantity = quantity; // Ensure it's a number
    
    // Validate and sanitize prices
    const costPrice = parseFloat(item.costPrice || item.unitPrice || 0);
    const sellingPrice = parseFloat(item.sellingPrice || costPrice || 0);
    
    if (isNaN(costPrice) || costPrice < 0) {
      return res.status(400).json({
        success: false,
        error: `Item ${i + 1} (${item.name || 'unnamed'}): Invalid cost price (${item.costPrice}). Must be a non-negative number`
      });
    }
    
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      return res.status(400).json({
        success: false,
        error: `Item ${i + 1} (${item.name || 'unnamed'}): Invalid selling price (${item.sellingPrice}). Must be a non-negative number`
      });
    }
    
    // Ensure prices are set
    item.costPrice = costPrice;
    item.unitPrice = costPrice; // For compatibility
    item.sellingPrice = sellingPrice;
    
    // Calculate total for this item
    calculatedTotal += costPrice * quantity;
    
    // Warn if selling price is less than cost price (but don't fail)
    if (sellingPrice < costPrice && sellingPrice > 0) {
      console.warn(`[FINALIZE] Warning: Item ${i + 1} (${item.name}) selling price (${sellingPrice}) is less than cost price (${costPrice})`);
    }
  }
  
  // Validate total amount consistency (if provided)
  if (total && Math.abs(total - calculatedTotal) > 0.01) { // Allow for small floating point differences
    console.warn(`[FINALIZE] Total mismatch - Provided: ${total}, Calculated: ${calculatedTotal.toFixed(2)}`);
    // Don't fail, just log the warning and use calculated total as fallback
  }
  
  // Ensure we have a valid total
  const finalTotal = total || calculatedTotal;
  
  // Sanitize vendor name
  const sanitizedVendor = vendor ? vendor.toString().trim().substring(0, 255) : 'Unknown';
  
  let transactionStarted = false;
  
  try {
    console.log(`[FINALIZE] Processing invoice ${requestId} with ${items.length} items`);
    console.log(`[FINALIZE] Total values - direct total: ${total}, totals object:`, totals);
    console.log(`[FINALIZE] Calculated total from items:`, items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0));
    
    // Save invoice image(s) locally for desktop display
    let invoiceImagePath = null;
    const savedImagePaths = [];
    const fs = require('fs');
    const invoiceImagesDir = path.join(__dirname, 'invoice-images');
    
    // Create invoice-images directory if it doesn't exist
    if (!fs.existsSync(invoiceImagesDir)) {
      console.log(`[FINALIZE] Creating invoice-images directory: ${invoiceImagesDir}`);
      fs.mkdirSync(invoiceImagesDir, { recursive: true });
    }
    
    // Handle multiple invoice images (for multi-page invoices) from backend
    if (invoiceImages && Array.isArray(invoiceImages) && invoiceImages.length > 0) {
      console.log(`[FINALIZE] Processing ${invoiceImages.length} invoice page images from backend`);
      
      for (let i = 0; i < invoiceImages.length; i++) {
        const img = invoiceImages[i];
        const pageNumber = img.pageNumber || (i + 1);
        
        console.log(`[FINALIZE] Processing page ${pageNumber}:`, {
          hasGcsUrl: !!img.gcsUrl,
          hasBase64: !!img.base64,
          originalName: img.originalName,
          mimeType: img.mimeType
        });
        
        // ALWAYS save images locally for desktop display
        if (img.base64) {
          try {
            console.log(`[FINALIZE] Processing base64 data for page ${pageNumber}`);
            const imageBuffer = Buffer.from(img.base64, 'base64');
            const timestamp = Date.now();
            const fileName = `invoice_${requestId}_page${pageNumber}_${timestamp}.jpg`;
            const imagePath = path.join(__dirname, 'invoice-images', fileName);
            
            console.log(`[FINALIZE] Saving invoice page ${pageNumber} to: ${imagePath}`);
            fs.writeFileSync(imagePath, imageBuffer);
            savedImagePaths.push({
              path: `/invoice-images/${fileName}`,
              pageNumber: pageNumber,
              type: 'local',
              originalName: img.originalName,
              mimeType: img.mimeType
            });
            console.log(`[FINALIZE] ✅ Successfully saved local image: ${fileName}`);
          } catch (error) {
            console.error(`[FINALIZE] Failed to save invoice page ${pageNumber}:`, error);
          }
        }
        
        // Warn if no image data at all
        if (!img.base64) {
          console.warn(`[FINALIZE] ⚠️ No base64 image data available for page ${pageNumber}`);
        }
      }
      
      // Use LOCAL paths for desktop display
      if (savedImagePaths.length > 0) {
        // For multi-page, store all paths as JSON array for UI to parse
        if (savedImagePaths.length > 1) {
          invoiceImagePath = JSON.stringify(savedImagePaths.map(p => p.path));
          console.log(`[FINALIZE] Storing ${savedImagePaths.length} image paths as JSON for multi-page display`);
        } else {
          // Single page - store as simple string
          invoiceImagePath = savedImagePaths[0].path;
          console.log(`[FINALIZE] Using single image path for display: ${invoiceImagePath}`);
        }
      } else {
        console.warn(`[FINALIZE] ⚠️ No local images saved for invoice`);
      }
    }
    // Fallback to single image (for backward compatibility)
    else if (invoiceImage) {
      // ALWAYS save locally - GCS URLs are private and won't work for display
      if (invoiceImage.base64) {
        try {
          console.log(`[FINALIZE] Processing base64 data for single image`);
          const imageBuffer = Buffer.from(invoiceImage.base64, 'base64');
          const timestamp = Date.now();
          const fileName = `invoice_${requestId}_${timestamp}.jpg`;
          const imagePath = path.join(__dirname, 'invoice-images', fileName);
          
          console.log(`[FINALIZE] Saving single invoice image to: ${imagePath}`);
          console.log(`[FINALIZE] Image buffer size: ${imageBuffer.length} bytes`);
          
          fs.writeFileSync(imagePath, imageBuffer);
          invoiceImagePath = `/invoice-images/${fileName}`;
          console.log(`[FINALIZE] ✅ Single invoice image saved successfully: ${invoiceImagePath}`);
        } catch (error) {
          console.error('[FINALIZE] Failed to save invoice image:', error);
        }
      } else {
        console.warn(`[FINALIZE] ⚠️ No base64 data available for single invoice`);
      }
    } else {
      console.log(`[FINALIZE] No invoice image provided`);
    }
    
    // Check if invoice already exists (idempotency)
    const existingInvoice = await dbGet(
      `SELECT id, status, vendor_name, total_items, invoice_image_url 
       FROM invoices WHERE request_id = ?`,
      [requestId]
    );
    
    if (existingInvoice) {
      console.log(`[FINALIZE] Invoice ${requestId} already exists with ID ${existingInvoice.id}`);
      
      // Return success with existing invoice data (idempotent response)
      return res.json({
        success: true,
        message: 'Invoice already processed (idempotent response)',
        invoiceId: existingInvoice.id,
        requestId: requestId,
        duplicate: true,
        stats: {
          totalItems: existingInvoice.total_items,
          processedItems: existingInvoice.total_items,
          failedItems: 0,
          vendor: existingInvoice.vendor_name
        }
      });
    }

    // Begin transaction for atomic operation
    await dbRun('BEGIN TRANSACTION');
    transactionStarted = true;
    console.log('[FINALIZE] Transaction started');
    
    // Create vendor
    const vendorObj = await getOrCreateVendor(sanitizedVendor);
      
    // Create invoice record with additional fields support
    const invoiceResult = await dbRun(
      `INSERT INTO invoices 
       (request_id, invoice_number, invoice_date, invoice_image_url, vendor_id, vendor_name, 
        total_items, total_amount, processing_notes, quality_analysis, totals_data, 
        has_invoice_image, status, finalized_at, additional_data, extraction_method, confidence_scores)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'finalized', datetime('now'), ?, ?, ?)`,
      [
        requestId, 
        invoiceNumber || 'NO-NUMBER', 
        invoiceDate || new Date().toISOString().split('T')[0],
        invoiceImagePath,  // Use local image path instead of URL
        vendorObj?.id, 
        sanitizedVendor,
        items.length, 
        finalTotal || totals?.invoiceTotal || totals?.total || 0,
        processingNotes || null,
        qualityAnalysis ? JSON.stringify(qualityAnalysis) : null,
        totals ? JSON.stringify(totals) : null,
        hasInvoiceImage ? 1 : 0,
        // New fields for additional data from Content Understanding
        additionalFields ? JSON.stringify(additionalFields) : null,
        extractionMethod || processingMethod || 'custom_analyzer',
        confidence ? JSON.stringify(confidence) : null
      ]
    );
    
    const invoiceId = invoiceResult.id;
    console.log(`[FINALIZE] Created invoice with ID: ${invoiceId}`);
    
    // Save multiple images to invoice_images table
    if (savedImagePaths.length > 0) {
      console.log(`[FINALIZE] Saving ${savedImagePaths.length} local images to invoice_images table`);
      
      // Save local file paths only
      for (let i = 0; i < savedImagePaths.length; i++) {
        const localImg = savedImagePaths[i];
        await dbRun(
          `INSERT INTO invoice_images (invoice_id, image_url, image_path, page_number, image_type, original_name, mime_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [invoiceId, localImg.path, localImg.path, localImg.pageNumber, localImg.type, localImg.originalName, localImg.mimeType]
        );
        console.log(`[FINALIZE] Saved local image page ${localImg.pageNumber}: ${localImg.path}`);
      }
      
      // If we have a single invoice image (legacy), also save it
      if (invoiceImagePath && savedImagePaths.length === 0) {
        await dbRun(
          `INSERT INTO invoice_images (invoice_id, image_url, image_path, page_number, image_type)
           VALUES (?, ?, ?, ?, ?)`,
          [invoiceId, invoiceImagePath, invoiceImagePath, 1, 'main']
        );
        console.log(`[FINALIZE] Saved main invoice image: ${invoiceImagePath}`);
      }
    }
      
    const processedItems = [];
    let downloadedImages = 0;
    
    // Process each item
    for (const item of items) {
      try {
        // Check if product exists
        // ENHANCED DUPLICATE PREVENTION - Try multiple strategies to find existing product
        // This prevents creating duplicates when products have different identifier formats
        let existingProduct = null;
        
        // Strategy 1: Try exact barcode match (for real barcodes)
        if (item.barcode && !existingProduct) {
          existingProduct = await dbGet(
            'SELECT * FROM products WHERE barcode = ? AND is_active = 1',
            [item.barcode]
          );
          if (existingProduct) {
            console.log(`[MATCH] Found by exact barcode: ${item.barcode}`);
          }
        }
        
        // Strategy 2: Try productCode as barcode or with SKU prefix
        if (item.productCode && !existingProduct) {
          existingProduct = await dbGet(
            `SELECT * FROM products 
             WHERE is_active = 1 AND (
               barcode = ? OR 
               barcode = ? OR
               barcode LIKE ?
             )`,
            [
              item.productCode,                  // Exact match
              `SKU_${item.productCode}`,        // With SKU prefix
              `%_${item.productCode}`            // Ends with productCode (catches any prefix)
            ]
          );
          if (existingProduct) {
            console.log(`[MATCH] Found by productCode: ${item.productCode}`);
          }
        }
        
        // Strategy 3: Try any identifier with multiple patterns
        const identifier = item.barcode || item.productCode;
        if (identifier && !existingProduct) {
          existingProduct = await dbGet(
            `SELECT * FROM products 
             WHERE is_active = 1 AND (
               barcode = ? OR 
               barcode = ? OR
               barcode = ? OR
               barcode LIKE ? OR
               barcode LIKE ?
             )`,
            [
              identifier,                        // Exact match
              `SKU_${identifier}`,              // With SKU prefix
              `MAN_${identifier}`,              // With manual prefix
              `%_${identifier}`,                // Ends with identifier
              `${identifier}_%`                 // Starts with identifier
            ]
          );
          if (existingProduct) {
            console.log(`[MATCH] Found by pattern matching: ${identifier}`);
          }
        }
        
        // Strategy 4: Try by product name (last resort to avoid wrong matches)
        if (!existingProduct && item.name) {
          // Strict name matching to avoid false positives
          existingProduct = await dbGet(
            'SELECT * FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND is_active = 1',
            [item.name]
          );
          if (existingProduct) {
            console.log(`[MATCH] Found by exact name: ${item.name}`);
          }
        }
        
        let productId;
        let imagePath = null;
        
        if (existingProduct) {
          // Update existing product
          console.log(`[UPDATE] Found existing product: ${existingProduct.name} (ID: ${existingProduct.id})`);
          const newQuantity = existingProduct.quantity + (item.quantity || 0);
          
          // Keep existing image path - SERP images will be handled separately
          imagePath = existingProduct.image_local_path;
          
          await dbRun(
            `UPDATE products 
             SET quantity = ?, cost_price = ?, price = ?, image_url = ?, image_local_path = ?, 
                 updated_at = datetime('now')
             WHERE id = ?`,
            [
              newQuantity,
              item.costPrice || item.unitPrice || existingProduct.cost_price,
              item.sellingPrice || existingProduct.price,
              item.imageUrl || existingProduct.image_url,
              imagePath || existingProduct.image_local_path,
              existingProduct.id
            ]
          );
          
          productId = existingProduct.id;
          
          // Log inventory movement
          await logInventoryMovement(
            productId,
            'in',
            item.quantity,
            existingProduct.quantity,
            newQuantity,
            `Invoice ${invoiceNumber}`,
            requestId
          );
          
        } else {
          // Create new product
          console.log(`[CREATE] Creating new product: ${item.name || item.description}`);
          
          // Images will be handled by SERP API - don't download from backend
          imagePath = null;
          
          // SMART BARCODE ASSIGNMENT - Use appropriate identifier format
          // This ensures ML Kit scanning can find products regardless of identifier type
          let finalBarcode = null;
          
          if (item.barcode) {
            // Check if it's a real scannable barcode (8-13 digits)
            if (/^\d{8,13}$/.test(item.barcode)) {
              // Real barcode - save as-is for ML Kit scanning
              finalBarcode = item.barcode;
              console.log(`[BARCODE] Using real barcode: ${finalBarcode}`);
            } else {
              // Non-standard barcode - keep as-is (ML Kit might scan custom codes)
              finalBarcode = item.barcode;
              console.log(`[BARCODE] Using custom barcode: ${finalBarcode}`);
            }
          } else if (item.productCode) {
            // Product code/SKU - save as-is for ML Kit to find
            // Don't add prefix so ML Kit scanning works directly
            finalBarcode = item.productCode;
            console.log(`[BARCODE] Using product code as barcode: ${finalBarcode}`);
          } else {
            // Generate unique identifier if nothing exists
            finalBarcode = `GEN_${requestId}_${index}`;
            console.log(`[BARCODE] Generated barcode: ${finalBarcode}`);
          }
          const productData = [
            item.name || item.description,
            finalBarcode,
            item.sellingPrice || item.unitPrice * 1.3,
            item.quantity || 1,
            vendorObj?.id,
            item.costPrice || item.unitPrice,
            null, // No imageUrl from backend
            null  // No imagePath - will be set by SERP API
          ];
          
          console.log(`[CREATE] Creating product with name: "${item.name || item.description}" and barcode: "${finalBarcode}"`);
          console.log(`[CREATE] Full product data:`, productData);
          
          // Add product_code and reference if available
          const extendedProductData = [
            ...productData.slice(0, 2), // name, barcode
            item.productCode || item.code || null,  // product_code from Azure Document AI
            item.reference || null,                  // reference field
            ...productData.slice(2)                  // price, quantity, vendor_id, cost_price, image_url, image_local_path
          ];
          
          const result = await dbRun(
            `INSERT INTO products 
             (name, barcode, product_code, reference, price, quantity, vendor_id, cost_price, image_url, image_local_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            extendedProductData
          );
          
          productId = result.id;
          console.log(`[CREATE] Product created with ID: ${productId}`);
          
          // Log initial stock
          await logInventoryMovement(
            productId,
            'in',
            item.quantity,
            0,
            item.quantity,
            `Initial stock - Invoice ${invoiceNumber}`,
            requestId
          );
        }
        
        // Create purchase transaction
        await createTransaction({
          transactionId: `PUR_${requestId}_${productId}`,
          productId: productId,
          quantity: item.quantity,
          unitPrice: item.costPrice || item.unitPrice,
          totalPrice: (item.costPrice || item.unitPrice) * item.quantity,
          type: 'purchase',
          notes: `Invoice ${invoiceNumber}`,
          userId: 'system'
        });
        
        processedItems.push({
          itemId: item.id,
          productId: productId,
          name: item.name,
          quantity: item.quantity,
          processed: true,
          imageDownloaded: !!imagePath
        });
        
      } catch (itemError) {
        console.error(`Failed to process item ${item.name}:`, itemError);
        processedItems.push({
          itemId: item.id,
          name: item.name,
          processed: false,
          error: itemError.message
        });
      }
    }
    
    // Commit the transaction to persist all changes
    await dbRun('COMMIT');
    console.log('[FINALIZE] Transaction committed successfully');
    
    // Create SCANS notification for the finalized invoice
    try {
      // Prepare image path for notification - handle both single and multi-page
      let notificationImagePath = null;
      if (savedImagePaths.length > 0) {
        // Multi-page: store as JSON array of paths
        notificationImagePath = JSON.stringify(savedImagePaths.map(img => img.path));
        console.log(`[FINALIZE] Storing multi-page image paths for notification: ${notificationImagePath}`);
      } else if (invoiceImagePath) {
        // Single image: store as single path
        notificationImagePath = invoiceImagePath;
        console.log(`[FINALIZE] Storing single image path for notification: ${notificationImagePath}`);
      }
      
      await dbRun(`
        INSERT INTO scans_sync_notifications (
          scan_id, scan_type, vendor, product_name, barcode,
          total_items, total_amount, image_count, is_multi_page,
          timestamp, source, raw_data, notification_read, image_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        requestId,
        'invoice_scan',
        sanitizedVendor,
        null, // No single product name for invoice
        null, // No single barcode for invoice
        items.length,
        total || totals?.total || 0,
        savedImagePaths.length || (invoiceImagePath ? 1 : 0),
        isMultiPage ? 1 : 0,
        new Date().toISOString(),
        'desktop_finalize',
        JSON.stringify({ 
          requestId, 
          vendor: sanitizedVendor, 
          vendorDetails,
          items, // Full items with confidence scores
          invoiceNumber,
          invoiceDate,
          totals,
          additionalFields,
          metadata,
          processingMethod,
          totalValidation,
          qualityAnalysis,
          processingNotes
        }),
        0, // unread
        notificationImagePath // Store the prepared image path(s)
      ]);
      console.log('[FINALIZE] ✅ Scan notification created with image path(s)');
    } catch (notifError) {
      console.error('[FINALIZE] Failed to create notification:', notifError);
      // Don't fail the whole operation if notification fails
    }
    
    // Clear cache
    productCache.flushAll();
    
    const successCount = processedItems.filter(i => i.processed).length;
    
    console.log(`[FINALIZE] Invoice ${requestId} processed:`);
    console.log(`  - Items: ${successCount}/${items.length} successful`);
    console.log(`  - Vendor: ${vendorObj?.name}`);
    console.log(`  - Invoice: ${invoiceNumber}`);
    
    // Start background image search for all processed items
    console.log(`[DEBUG] About to start background processing for ${processedItems.length} items`);
    console.log(`[DEBUG] Processed items:`, processedItems.filter(i => i.processed).map(i => i.name));
    
    setImmediate(async () => {
      try {
        console.log(`[IMAGE_SEARCH] Starting background image search for ${processedItems.length} items...`);
        for (const processedItem of processedItems.filter(item => item.processed)) {
          try {
            const searchResult = await searchProductImages(processedItem.name, 5);
            if (searchResult.images && searchResult.images.length > 0) {
              // Use intelligent image selection with retry logic (FIX: replaced blind first image selection)
              const bestImages = selectBestImagesForBackground(searchResult.images, processedItem.name, 3);
              const result = await tryMultipleImagesForBackground(bestImages, processedItem.productId, processedItem.name);
              
              if (result && (result.localPath || result.url)) {
                // Update product with either local path or direct URL (consistent with manual download process)
                const imagePath = result.localPath || null;
                const originalImageUrl = result.originalUrl || result.url || null; // Store original URL like manual process
                
                await dbRun(
                  'UPDATE products SET image_url = ?, image_local_path = ?, updated_at = datetime("now") WHERE id = ?',
                  [originalImageUrl, imagePath, processedItem.productId]
                );
                console.log(`✅ Successfully processed image for ${processedItem.name}`);
              }
            }
          } catch (imageError) {
            console.warn(`⚠️ Failed to process images for ${processedItem.name}:`, imageError.message);
          }
        }
        console.log(`[IMAGE_SEARCH] Background image search completed`);
      } catch (error) {
        console.error('Background image search failed:', error);
      }
    });
    
    // Send desktop notification for successful invoice processing
    notificationManager.notifyInvoiceProcessed({
      vendor: vendorObj?.name || sanitizedVendor,
      invoiceNumber: invoiceNumber || 'N/A',
      totalItems: successCount,
      requestId: requestId,
      processingMethod: processingMethod || 'unknown'
    });

    res.json({
      success: true,
      message: 'Invoice processed and inventory updated',
      invoiceId: invoiceResult.id,
      requestId: requestId,
      stats: {
        totalItems: items.length,
        processedItems: successCount,
        failedItems: items.length - successCount,
        imageSearchStarted: true,
        vendor: vendorObj?.name
      },
      items: processedItems
    });
    
    
  } catch (error) {
    // Rollback transaction on error if started
    if (transactionStarted) {
      await dbRun('ROLLBACK');
      console.error('[FINALIZE] Transaction rolled back due to error:', error);
    }
    console.error('[FINALIZE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process invoice',
      details: error.message
    });
  }
});

// ==================== EXISTING PRODUCT ENDPOINTS ====================
app.get('/products/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    console.log(`🔍 [SELL] ML Kit scanned: ${barcode}`);
    
    const cached = productCache.get(barcode);
    if (cached) return res.json(cached);

    // ENHANCED SEARCH: Check barcode field with multiple patterns
    // This handles: real barcodes, SKUs, generated codes, ALL IN ONE FIELD!
    const product = await dbGet(`
      SELECT p.*, v.name as vendor_name, c.name as category_name 
      FROM products p 
      LEFT JOIN vendors v ON p.vendor_id = v.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.is_active = 1 AND (
        p.barcode = ? OR 
        p.barcode = ? OR
        p.barcode = ? OR
        p.barcode LIKE ? OR
        p.barcode LIKE ?
      )
    `, [
      barcode,                    // Exact match
      `SKU_${barcode}`,          // If scanned code is actually an SKU
      `MAN_${barcode}`,          // If it's a manual code
      `%_${barcode}`,            // Ends with the scanned code
      `${barcode}_%`             // Starts with the scanned code
    ]);
    
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // IMPORTANT: Return the scanned code so mobile app is happy
    product.barcode = barcode;
    productCache.set(barcode, product);
    res.json(product);
  } catch (err) {
    console.error('GET /products/:barcode error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/products', async (req, res) => {
  try {
    const { barcode, name, product_code, reference, vendor, category, limit = 100, offset = 0 } = req.query;
    
    // Search by barcode
    if (barcode) {
      const product = await dbGet(`
        SELECT p.*, v.name as vendor_name, c.name as category_name 
        FROM products p 
        LEFT JOIN vendors v ON p.vendor_id = v.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.barcode = ? AND p.is_active = 1
      `, [barcode]);
      
      if (!product) return res.status(404).json({ error: 'Product not found' });
      return res.json(product);
    }
    
    // Search by product_code (from Azure Document AI)
    if (product_code) {
      const product = await dbGet(`
        SELECT p.*, v.name as vendor_name, c.name as category_name 
        FROM products p 
        LEFT JOIN vendors v ON p.vendor_id = v.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.product_code = ? AND p.is_active = 1
      `, [product_code]);
      
      if (!product) return res.status(404).json({ error: 'Product not found by product code' });
      return res.json(product);
    }
    
    // Search by reference
    if (reference) {
      const product = await dbGet(`
        SELECT p.*, v.name as vendor_name, c.name as category_name 
        FROM products p 
        LEFT JOIN vendors v ON p.vendor_id = v.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.reference = ? AND p.is_active = 1
      `, [reference]);
      
      if (!product) return res.status(404).json({ error: 'Product not found by reference' });
      return res.json(product);
    }
    
    // Search by name
    if (name) {
      const product = await dbGet(`
        SELECT p.*, v.name as vendor_name, c.name as category_name 
        FROM products p 
        LEFT JOIN vendors v ON p.vendor_id = v.id 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.name = ? AND p.is_active = 1
      `, [name]);
      
      if (!product) return res.status(404).json({ error: 'Product not found' });
      return res.json(product);
    }

    let query = `
      SELECT p.*, v.name as vendor_name, c.name as category_name 
      FROM products p 
      LEFT JOIN vendors v ON p.vendor_id = v.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.is_active = 1
    `;
    const params = [];

    if (vendor) {
      query += ' AND v.name LIKE ?';
      params.push(`%${vendor}%`);
    }

    if (category) {
      query += ' AND c.name LIKE ?';
      params.push(`%${category}%`);
    }

    query += ' ORDER BY p.name LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const products = await dbAll(query, params);
    
    res.json({ 
      products, 
      pagination: { 
        limit: parseInt(limit), 
        offset: parseInt(offset), 
        hasMore: products.length === parseInt(limit) 
      } 
    });
  } catch (err) {
    console.error('GET /products error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== DELETE PRODUCT ====================
app.delete('/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { hardDelete = false, reason = 'User deletion' } = req.body;

    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    // Check if product exists
    const product = await dbGet('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (hardDelete) {
      // Hard delete - remove from database completely
      console.log(`[DELETE] Hard deleting product: ${product.name} (ID: ${productId})`);
      
      // Begin transaction
      await dbRun('BEGIN TRANSACTION');
      
      try {
        // Delete related records first (foreign key constraints)
        await dbRun('DELETE FROM inventory_movements WHERE product_id = ?', [productId]);
        await dbRun('DELETE FROM transactions WHERE product_id = ?', [productId]);
        
        // Delete the product
        await dbRun('DELETE FROM products WHERE id = ?', [productId]);
        
        // Delete product image if exists
        if (product.image_local_path) {
          const imagePath = path.join(__dirname, '..', '..', product.image_local_path);
          try {
            if (fs.existsSync(imagePath)) {
              fs.unlinkSync(imagePath);
              console.log(`[DELETE] Removed image: ${product.image_local_path}`);
            }
          } catch (imgError) {
            console.warn(`[DELETE] Could not remove image: ${imgError.message}`);
          }
        }
        
        await dbRun('COMMIT');
        console.log(`[DELETE] Product ${product.name} hard deleted successfully`);
        
        // Broadcast product deletion via WebSocket
        broadcastProductUpdate(productId, 'deleted');
        broadcastInventoryUpdate();
        
      } catch (error) {
        await dbRun('ROLLBACK');
        throw error;
      }
    } else {
      // Soft delete - mark as inactive
      console.log(`[DELETE] Soft deleting product: ${product.name} (ID: ${productId})`);
      
      await dbRun(
        'UPDATE products SET is_active = 0, updated_at = datetime("now") WHERE id = ?',
        [productId]
      );
      
      // Broadcast product update via WebSocket
      broadcastProductUpdate(productId, 'soft-deleted');
      broadcastInventoryUpdate();
      
      // Log inventory movement for audit trail
      await logInventoryMovement(
        productId,
        'adjustment',
        -product.quantity,
        product.quantity,
        0,
        reason,
        `DELETE_${Date.now()}`
      );
    }

    // Clear cache
    productCache.flushAll();

    res.json({
      success: true,
      message: `Product ${hardDelete ? 'permanently deleted' : 'deactivated'} successfully`,
      deletedProduct: {
        id: product.id,
        name: product.name,
        hardDelete: hardDelete
      }
    });

  } catch (error) {
    console.error('DELETE /products/:id error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==================== UPDATE/EDIT PRODUCT ====================
app.put('/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { 
      name, 
      barcode,
      product_code,  // Add product_code field
      reference,     // Add reference field
      price, 
      quantity, 
      vendor, 
      category, 
      description, 
      costPrice, 
      minStockLevel, 
      maxStockLevel,
      markupPercentage 
    } = req.body;

    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    // Check if product exists
    const existingProduct = await dbGet('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);
    
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validate required fields
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return res.status(400).json({ error: 'Product name cannot be empty' });
    }

    // Begin transaction for atomic update
    await dbRun('BEGIN TRANSACTION');
    
    try {
      // Handle vendor
      let vendorId = existingProduct.vendor_id;
      if (vendor) {
        const vendorObj = await getOrCreateVendor(vendor);
        vendorId = vendorObj?.id || vendorId;
      }

      // Handle category
      let categoryId = existingProduct.category_id;
      if (category) {
        const categoryObj = await getOrCreateCategory(category);
        categoryId = categoryObj?.id || categoryId;
      }

      // Prepare update fields
      const updateFields = [];
      const updateValues = [];

      if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name.trim());
      }
      
      if (barcode !== undefined) {
        // Check if barcode is unique (excluding current product)
        if (barcode && barcode.trim()) {
          const existingBarcode = await dbGet(
            'SELECT id FROM products WHERE barcode = ? AND id != ? AND is_active = 1', 
            [barcode.trim(), productId]
          );
          if (existingBarcode) {
            throw new Error('Barcode already exists for another product');
          }
        }
        updateFields.push('barcode = ?');
        updateValues.push(barcode ? barcode.trim() : null);
      }
      
      // Handle product_code field (from Azure Document AI)
      if (product_code !== undefined) {
        updateFields.push('product_code = ?');
        updateValues.push(product_code ? product_code.trim() : null);
      }
      
      // Handle reference field
      if (reference !== undefined) {
        updateFields.push('reference = ?');
        updateValues.push(reference ? reference.trim() : null);
      }
      
      if (price !== undefined) {
        updateFields.push('price = ?');
        updateValues.push(parseFloat(price) || 0);
      }
      
      if (quantity !== undefined) {
        const newQuantity = parseFloat(quantity) || 0;
        const quantityDiff = newQuantity - existingProduct.quantity;
        
        updateFields.push('quantity = ?');
        updateValues.push(newQuantity);
        
        // Log inventory movement if quantity changed
        if (quantityDiff !== 0) {
          await logInventoryMovement(
            productId,
            quantityDiff > 0 ? 'in' : 'out',
            Math.abs(quantityDiff),
            existingProduct.quantity,
            newQuantity,
            'Manual adjustment via edit',
            `EDIT_${Date.now()}`
          );
        }
      }
      
      if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description ? description.trim() : null);
      }
      
      if (costPrice !== undefined) {
        updateFields.push('cost_price = ?');
        updateValues.push(parseFloat(costPrice) || null);
      }
      
      if (minStockLevel !== undefined) {
        updateFields.push('min_stock_level = ?');
        updateValues.push(parseInt(minStockLevel) || 5);
      }
      
      if (maxStockLevel !== undefined) {
        updateFields.push('max_stock_level = ?');
        updateValues.push(parseInt(maxStockLevel) || 100);
      }
      
      if (markupPercentage !== undefined) {
        updateFields.push('markup_percentage = ?');
        updateValues.push(parseFloat(markupPercentage) || null);
      }

      if (vendorId !== existingProduct.vendor_id) {
        updateFields.push('vendor_id = ?');
        updateValues.push(vendorId);
      }

      if (categoryId !== existingProduct.category_id) {
        updateFields.push('category_id = ?');
        updateValues.push(categoryId);
      }

      // Always update the updated_at timestamp
      updateFields.push('updated_at = datetime("now")');

      if (updateFields.length > 1) { // More than just updated_at
        const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
        updateValues.push(productId);
        
        await dbRun(query, updateValues);
        console.log(`[UPDATE] Product ${existingProduct.name} updated successfully`);
      }

      await dbRun('COMMIT');

      // Get updated product with vendor/category names
      const updatedProduct = await dbGet(`
        SELECT p.*, v.name as vendor_name, c.name as category_name
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `, [productId]);

      // Clear cache
      productCache.flushAll();
      
      // Broadcast product update via WebSocket
      broadcastProductUpdate(productId, 'updated');
      broadcastInventoryUpdate();

      res.json({
        success: true,
        message: 'Product updated successfully',
        product: updatedProduct
      });

    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('PUT /products/:id error:', error);
    res.status(500).json({ error: error.message || 'Failed to update product' });
  }
});

// Update product barcode specifically
app.put('/products/:id/barcode', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // Check if product exists
    const existingProduct = await dbGet('SELECT * FROM products WHERE id = ? AND is_active = 1', [productId]);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if barcode is already used by another product
    const existingBarcode = await dbGet(
      'SELECT id, name FROM products WHERE barcode = ? AND id != ? AND is_active = 1', 
      [barcode, productId]
    );
    
    if (existingBarcode) {
      return res.status(409).json({ 
        error: `Barcode ${barcode} is already used by product: ${existingBarcode.name}` 
      });
    }

    // Update barcode
    await dbRun(
      `UPDATE products SET barcode = ?, updated_at = datetime('now') WHERE id = ?`,
      [barcode, productId]
    );

    // Get updated product
    const updatedProduct = await dbGet(`
      SELECT p.*, v.name as vendor_name, c.name as category_name
      FROM products p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [productId]);

    console.log(`✅ Barcode updated for product ${existingProduct.name}: ${barcode}`);

    res.json({
      success: true,
      message: 'Barcode updated successfully',
      product: updatedProduct,
      barcode: barcode
    });

  } catch (error) {
    console.error('PUT /products/:id/barcode error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to update barcode' 
    });
  }
});

app.post('/stock/add', async (req, res) => {
  try {
    const { name, quantity, costPrice, sellingPrice, barcode, vendor } = req.body;

    if (!name || !quantity) {
      return res.status(400).json({ error: 'Name and quantity are required' });
    }

    const normalizedQuantity = parseFloat(quantity) || 1;
    const normalizedCostPrice = parseFloat(costPrice) || null;
    const normalizedSellingPrice = parseFloat(sellingPrice) || null;

    let existingProduct = null;
    
    if (barcode) {
      existingProduct = await dbGet('SELECT * FROM products WHERE barcode = ? AND is_active = 1', [barcode]);
    }
    
    if (!existingProduct && name) {
      existingProduct = await dbGet('SELECT * FROM products WHERE name = ? AND is_active = 1', [name]);
    }

    const vendorObj = await getOrCreateVendor(vendor);

    if (existingProduct) {
      const newQuantity = existingProduct.quantity + normalizedQuantity;
      
      await dbRun(
        `UPDATE products 
         SET quantity = ?, cost_price = ?, price = ?, vendor_id = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          newQuantity,
          normalizedCostPrice || existingProduct.cost_price,
          normalizedSellingPrice || existingProduct.price,
          vendorObj?.id || existingProduct.vendor_id,
          existingProduct.id
        ]
      );
      
      await logInventoryMovement(
        existingProduct.id,
        'in',
        normalizedQuantity,
        existingProduct.quantity,
        newQuantity,
        'Stock addition'
      );
      
      if (barcode) productCache.del(barcode);
      
      const updatedProduct = await dbGet('SELECT * FROM products WHERE id = ?', [existingProduct.id]);
      
      // Broadcast stock update via WebSocket
      broadcastProductUpdate(existingProduct.id, 'restocked');
      broadcastInventoryUpdate();
      
      res.json({
        success: true,
        id: existingProduct.id,
        message: 'Stock updated successfully',
        product: updatedProduct
      });
    } else {
      const result = await dbRun(
        `INSERT INTO products 
         (name, barcode, price, quantity, vendor_id, cost_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name,
          barcode,
          normalizedSellingPrice || normalizedCostPrice * 1.3,
          normalizedQuantity,
          vendorObj?.id,
          normalizedCostPrice
        ]
      );
      
      await logInventoryMovement(result.id, 'in', normalizedQuantity, 0, normalizedQuantity, 'Initial stock');
      
      const newProduct = await dbGet('SELECT * FROM products WHERE id = ?', [result.id]);
      
      // Broadcast new product addition via WebSocket
      broadcastProductUpdate(result.id, 'created');
      broadcastInventoryUpdate();
      
      res.json({
        success: true,
        id: result.id,
        message: 'Product added successfully',
        product: newProduct
      });
    }
  } catch (err) {
    console.error('POST /stock/add error', err);
    res.status(500).json({ error: 'Failed to add stock' });
  }
});

app.post('/stock/sell', async (req, res) => {
  try {
    const { barcode, name, qty = 1 } = req.body;

    if (!barcode && !name) {
      return res.status(400).json({ error: 'Barcode or name required' });
    }

    let product;
    if (barcode) {
      product = await dbGet('SELECT * FROM products WHERE barcode = ? AND is_active = 1', [barcode]);
    } else {
      product = await dbGet('SELECT * FROM products WHERE name = ? AND is_active = 1', [name]);
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const saleQty = parseFloat(qty) || 1;
    const newQty = product.quantity - saleQty;
    
    if (newQty < 0) {
      return res.status(409).json({ error: 'Not enough stock' });
    }

    const transactionId = crypto.randomBytes(8).toString('hex');
    const unitPrice = product.price || 0;
    const totalPrice = unitPrice * saleQty;

    await dbRun(
      `UPDATE products 
       SET quantity = ?, updated_at = datetime('now'), last_sold = datetime('now')
       WHERE id = ?`,
      [newQty, product.id]
    );

    await createTransaction({
      transactionId,
      productId: product.id,
      quantity: saleQty,
      unitPrice,
      totalPrice,
      type: 'sale',
      notes: `Sale via ${barcode ? 'barcode' : 'name'} lookup`
    });

    await logInventoryMovement(
      product.id,
      'out',
      saleQty,
      product.quantity,
      newQty,
      'Sale',
      transactionId
    );

    // Log the scan for recent scans tracking
    if (product.barcode) {
      await dbRun(
        `INSERT INTO recent_scans (barcode, found, scanned_at) 
         VALUES (?, 1, datetime('now'))`,
        [product.barcode]
      );
      productCache.del(product.barcode);
    }
    
    // Broadcast stock update via WebSocket
    broadcastProductUpdate(product.id, 'sold');
    broadcastInventoryUpdate();

    res.json({
      success: true,
      message: 'Sale recorded',
      transactionId,
      newStock: newQty,
      remainingStock: newQty,  // Add this for mobile compatibility
      saleDetails: {
        productName: product.name,
        quantity: saleQty,
        unitPrice,
        totalPrice
      }
    });
  } catch (err) {
    console.error('POST /stock/sell error', err);
    res.status(500).json({ error: 'Failed to record sale' });
  }
});

// ==================== SALES ENDPOINTS ====================
app.get('/sales/recent', async (req, res) => {
  try {
    const { limit = 50, offset = 0, period = 'all' } = req.query;
    
    // Build date filter based on period
    let dateFilter = '';
    let queryParams = [parseInt(limit), parseInt(offset)];
    
    switch (period) {
      case 'today':
        dateFilter = "AND DATE(t.timestamp) = DATE('now')";
        break;
      case 'week':
        dateFilter = "AND DATE(t.timestamp) >= DATE('now', '-7 days')";
        break;
      case 'month':
        dateFilter = "AND DATE(t.timestamp) >= DATE('now', '-30 days')";
        break;
      case 'all':
      default:
        dateFilter = '';
        break;
    }
    
    console.log(`📊 Fetching sales for period: ${period}, with filter: ${dateFilter}`);
    
    const sales = await dbAll(`
      SELECT 
        t.id,
        t.transaction_id,
        t.quantity,
        t.unit_price,
        t.total_price,
        t.timestamp,
        t.notes,
        p.id as product_id,
        p.name as product_name,
        p.barcode,
        v.name as vendor_name,
        c.name as category_name
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE t.transaction_type = 'sale' ${dateFilter}
      ORDER BY t.timestamp DESC
      LIMIT ? OFFSET ?
    `, queryParams);
    
    console.log(`✅ Found ${sales.length} sales transactions`);

    const totalSales = sales.reduce((sum, sale) => sum + sale.total_price, 0);
    const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    
    const todaySales = await dbAll(`
      SELECT 
        COUNT(*) as count,
        SUM(total_price) as total_revenue,
        SUM(quantity) as total_items
      FROM transactions 
      WHERE transaction_type = 'sale' 
      AND DATE(timestamp) = DATE('now')
    `);

    res.json({
      success: true,
      sales,
      summary: {
        totalSales: Math.round(totalSales * 100) / 100,
        totalQuantity,
        averageTransaction: sales.length > 0 ? Math.round((totalSales / sales.length) * 100) / 100 : 0,
        salesCount: sales.length
      },
      today: {
        count: todaySales[0].count || 0,
        revenue: Math.round((todaySales[0].total_revenue || 0) * 100) / 100,
        items: todaySales[0].total_items || 0
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: sales.length === parseInt(limit)
      }
    });
  } catch (err) {
    console.error('GET /sales/recent error', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get recent sales',
      message: err.message 
    });
  }
});

// Test endpoint to create sample sales data for testing
app.post('/sales/create-test-data', async (req, res) => {
  try {
    console.log('🧪 Creating test sales data...');
    
    // Get first available product
    const product = await dbGet('SELECT * FROM products WHERE is_active = 1 LIMIT 1');
    
    if (!product) {
      return res.status(400).json({ 
        success: false, 
        error: 'No products available. Add a product first.' 
      });
    }
    
    // Create 5 test sales
    const testSales = [];
    for (let i = 0; i < 5; i++) {
      const transactionId = `TEST_${Date.now()}_${i}`;
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = product.price || 10.00;
      const totalPrice = unitPrice * quantity;
      
      // Create past timestamps for variety
      const daysBack = Math.floor(Math.random() * 7);
      const hoursBack = Math.floor(Math.random() * 24);
      const testTimestamp = new Date();
      testTimestamp.setDate(testTimestamp.getDate() - daysBack);
      testTimestamp.setHours(testTimestamp.getHours() - hoursBack);
      
      await dbRun(
        `INSERT INTO transactions
         (transaction_id, product_id, quantity, unit_price, total_price, transaction_type, notes, user_id, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId, 
          product.id, 
          quantity, 
          unitPrice, 
          totalPrice, 
          'sale', 
          `Test sale ${i + 1} - ${product.name}`, 
          'test-user',
          testTimestamp.toISOString()
        ]
      );
      
      testSales.push({
        transactionId,
        productName: product.name,
        quantity,
        unitPrice,
        totalPrice,
        timestamp: testTimestamp.toISOString()
      });
    }
    
    console.log(`✅ Created ${testSales.length} test sales transactions`);
    res.json({
      success: true,
      message: `Created ${testSales.length} test sales`,
      testSales
    });
    
  } catch (err) {
    console.error('POST /sales/create-test-data error', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create test sales',
      message: err.message 
    });
  }
});

// REMOVED: Image update polling endpoint - not needed
// Products refresh when navigating between pages

// ==================== INVENTORY STATS ====================
app.get('/inventory/stats', async (req, res) => {
  try {
    const stats = await dbGet(`
      SELECT 
        COUNT(*) as total_products,
        SUM(quantity) as total_quantity,
        SUM(CASE WHEN price IS NOT NULL THEN price * quantity ELSE 0 END) as total_value,
        COUNT(CASE WHEN quantity < min_stock_level THEN 1 END) as low_stock,
        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock,
        COUNT(CASE WHEN barcode IS NOT NULL THEN 1 END) as with_barcodes,
        COUNT(CASE WHEN image_local_path IS NOT NULL THEN 1 END) as with_images
      FROM products WHERE is_active = 1
    `);

    const vendorCount = await dbGet('SELECT COUNT(*) as vendor_count FROM vendors');
    const categoryCount = await dbGet('SELECT COUNT(*) as category_count FROM categories');

    res.json({
      ...stats,
      suppliers: vendorCount.vendor_count,
      categories: categoryCount.category_count
    });
  } catch (err) {
    console.error('GET /inventory/stats error', err);
    res.status(500).json({ error: 'Failed to generate stats' });
  }
});

app.get('/inventory/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;
    const products = await dbAll(`
      SELECT p.*, v.name as vendor_name, c.name as category_name 
      FROM products p 
      LEFT JOIN vendors v ON p.vendor_id = v.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.quantity <= ? AND p.is_active = 1 
      ORDER BY p.quantity ASC
    `, [threshold]);

    res.json({ threshold, count: products.length, products });
  } catch (err) {
    console.error('GET /inventory/low-stock error', err);
    res.status(500).json({ error: 'Failed to get low stock products' });
  }
});

// ==================== INVENTORY LISTING FOR MOBILE ====================
app.get('/api/inventory', async (req, res) => {
  try {
    const { 
      search = '',
      category = '',
      vendor = '',
      status = 'all', // 'all', 'in_stock', 'low_stock', 'out_of_stock'
      limit = 50,
      offset = 0,
      sortBy = 'name',
      sortOrder = 'ASC'
    } = req.query;

    let whereConditions = ['p.is_active = 1'];
    let queryParams = [];

    // Search filter
    if (search.trim()) {
      whereConditions.push('(p.name LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Category filter
    if (category.trim()) {
      whereConditions.push('c.name LIKE ?');
      queryParams.push(`%${category.trim()}%`);
    }

    // Vendor filter
    if (vendor.trim()) {
      whereConditions.push('v.name LIKE ?');
      queryParams.push(`%${vendor.trim()}%`);
    }

    // Status filter
    switch (status) {
      case 'in_stock':
        whereConditions.push('p.quantity > 0');
        break;
      case 'low_stock':
        whereConditions.push('p.quantity <= p.min_stock_level AND p.quantity > 0');
        break;
      case 'out_of_stock':
        whereConditions.push('p.quantity = 0');
        break;
    }

    // Valid sort columns
    const validSortColumns = ['name', 'quantity', 'price', 'created_at', 'last_sold'];
    const sortColumn = validSortColumns.includes(sortBy) ? `p.${sortBy}` : 'p.name';
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM products p 
      LEFT JOIN vendors v ON p.vendor_id = v.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      ${whereClause}
    `;
    const countResult = await dbGet(countQuery, queryParams);

    // Get products
    const query = `
      SELECT 
        p.id,
        p.name,
        p.barcode,
        p.price,
        p.quantity,
        p.description,
        p.min_stock_level,
        p.max_stock_level,
        p.cost_price,
        p.markup_percentage,
        p.image_url,
        p.image_local_path,
        p.created_at,
        p.updated_at,
        p.last_sold,
        v.name as vendor_name,
        c.name as category_name,
        CASE 
          WHEN p.quantity = 0 THEN 'out_of_stock'
          WHEN p.quantity <= p.min_stock_level THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p 
      LEFT JOIN vendors v ON p.vendor_id = v.id 
      LEFT JOIN categories c ON p.category_id = c.id 
      ${whereClause}
      ORDER BY ${sortColumn} ${order}
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(parseInt(limit), parseInt(offset));
    const products = await dbAll(query, queryParams);

    res.json({
      success: true,
      products: products,
      pagination: {
        total: countResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(countResult.total / parseInt(limit))
      },
      filters: {
        search,
        category,
        vendor,
        status,
        sortBy,
        sortOrder
      }
    });
  } catch (err) {
    console.error('GET /api/inventory error', err);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

// ==================== RECENT SCANS TRACKING ====================
app.get('/api/recent-scans', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // FIXED: Get both recent invoices AND recent scans from scans_sync_notifications
    const invoices = await dbAll(`
      SELECT 
        i.*,
        v.name as vendor_name
      FROM invoices i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      ORDER BY i.created_at DESC
      LIMIT ?
    `, [limit]);

    // FIXED: Also get recent scans from mobile app (scans_sync_notifications table)
    const recentScans = await dbAll(`
      SELECT 
        scan_id as invoice_number,
        vendor,
        total_items,
        total_amount as total,
        image_count,
        is_multi_page,
        timestamp as created_at,
        image_path,
        scan_type,
        raw_data
      FROM scans_sync_notifications
      WHERE scan_type = 'invoice_scan' OR scan_type = 'invoice'
      ORDER BY timestamp DESC
      LIMIT ?
    `, [limit]);

    console.log(`📊 [/api/recent-scans] Found ${invoices.length} invoices and ${recentScans.length} mobile scans`);

    // Get all images for each invoice
    const scans = await Promise.all(invoices.map(async (invoice) => {
      let images = [];
      
      // First check the new invoice_images table for multiple images
      const multipleImages = await dbAll(`
        SELECT image_url, image_path, page_number, image_type 
        FROM invoice_images 
        WHERE invoice_id = ? 
        ORDER BY page_number, id
      `, [invoice.id]);
      
      if (multipleImages && multipleImages.length > 0) {
        images = multipleImages.map(img => ({
          url: img.image_url,
          path: img.image_path,
          page: img.page_number,
          type: img.image_type
        }));
      } else if (invoice.invoice_image_url) {
        // Fallback to single image from main invoice record
        images = [{
          url: invoice.invoice_image_url,
          path: invoice.invoice_image_url,
          page: 1,
          type: 'main'
        }];
      }
      
      // Parse stored items data if available
      let items = [];
      let additionalFields = {};
      try {
        if (invoice.items_data) {
          items = JSON.parse(invoice.items_data);
        }
        if (invoice.additional_fields) {
          additionalFields = JSON.parse(invoice.additional_fields);
        }
      } catch (e) {
        console.error('Failed to parse invoice data:', e);
      }
      
      return {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        vendor_name: invoice.vendor_name,
        total_amount: invoice.total_amount,
        total_items: invoice.total_items,
        status: invoice.status,
        processing_notes: invoice.processing_notes,
        created_at: invoice.created_at,
        // Legacy single image fields for backward compatibility
        invoice_image_url: invoice.invoice_image_url,
        invoice_image_path: invoice.invoice_image_url,
        invoiceImagePath: invoice.invoice_image_url,
        invoiceImageUrl: invoice.invoice_image_url,
        has_invoice_image: images.length > 0,
        // New multiple images support
        images: images,
        image_count: images.length,
        // Add ALL extracted data fields
        quality_analysis: invoice.quality_analysis ? JSON.parse(invoice.quality_analysis) : null,
        totals_data: invoice.totals_data ? JSON.parse(invoice.totals_data) : null,
        // Add items and additional fields
        items: items,
        additionalFields: additionalFields,
        customer_name: invoice.customer_name,
        processingMethod: invoice.processing_method || 'legacy'
      };
    }));

    // FIXED: Convert mobile scans to same format as invoices
    const mobileScanItems = recentScans.map(scan => {
      // Parse raw_data to get items and additional fields
      let parsedData = {};
      try {
        if (scan.raw_data) {
          parsedData = JSON.parse(scan.raw_data);
        }
      } catch (e) {
        console.error('Failed to parse raw_data:', e);
      }
      
      console.log(`🔍 [/api/recent-scans] Processing mobile scan:`, {
        scan_id: scan.invoice_number,
        vendor: scan.vendor,
        image_path: scan.image_path,
        has_items: !!(parsedData.items && parsedData.items.length),
        has_image: !!scan.image_path
      });

      // Handle multi-page images stored as JSON array
      let images = [];
      let imagePaths = [];
      
      if (scan.image_path) {
        try {
          // Try to parse as JSON array (multi-page)
          imagePaths = JSON.parse(scan.image_path);
          if (Array.isArray(imagePaths)) {
            images = imagePaths.map((path, index) => ({
              url: null, // Will be converted by getImageUrl in frontend
              path: path,
              page: index + 1,
              type: 'page'
            }));
          } else {
            throw new Error('Not an array');
          }
        } catch {
          // Single image path
          imagePaths = [scan.image_path];
          images = [{
            url: null, // Will be converted by getImageUrl in frontend  
            path: scan.image_path,
            page: 1,
            type: 'main'
          }];
        }
      }

      return {
        id: `mobile_${scan.invoice_number}`,
        invoice_number: scan.invoice_number,
        invoice_date: parsedData.invoiceDate || scan.created_at,
        vendor_name: scan.vendor || 'Mobile Scan',
        total_amount: scan.total || 0,
        total_items: scan.total_items || 0,
        status: 'processed',
        processing_notes: parsedData.processingNotes || 'Mobile scan',
        created_at: scan.created_at,
        // FIXED: Map image_path to all the expected fields
        invoice_image_url: scan.image_path,
        invoice_image_path: scan.image_path,
        invoiceImagePath: scan.image_path,
        invoiceImageUrl: scan.image_path,
        has_invoice_image: !!scan.image_path,
        images: images,
        image_count: images.length,
        is_multi_page: scan.is_multi_page || (images.length > 1),
        source: 'mobile_app',
        // Add items and additional data from raw_data
        items: parsedData.items || [],
        additionalFields: parsedData.additionalFields || {},
        customer_name: parsedData.customer || null,
        quality_analysis: parsedData.qualityAnalysis || null,
        totals_data: parsedData.totals || null,
        processingMethod: parsedData.processingMethod || 'legacy'
      };
    });

    // Combine and sort all scans by date
    const allScans = [...scans, ...mobileScanItems].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    ).slice(0, limit);

    console.log(`✅ [/api/recent-scans] Returning ${allScans.length} total scans (${scans.length} invoices + ${mobileScanItems.length} mobile scans)`);

    res.json({
      success: true,
      scans: allScans
    });
  } catch (err) {
    console.error('GET /api/recent-scans error', err);
    res.status(500).json({ error: 'Failed to get recent scans' });
  }
});

app.post('/api/log-scan', async (req, res) => {
  try {
    const { barcode, found } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    await dbRun(`
      INSERT INTO recent_scans (barcode, found, scanned_at)
      VALUES (?, ?, datetime('now'))
    `, [barcode, found ? 1 : 0]);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/log-scan error', err);
    res.status(500).json({ error: 'Failed to log scan' });
  }
});

// ==================== RECENT SALES POST ENDPOINT (Mobile App) ====================
// Create SALES notifications for mobile sales
app.post('/recent-sales', async (req, res) => {
  try {
    const saleData = req.body;
    console.log('[RECENT_SALE] 🔥 SALES ENDPOINT HIT - Mobile app saving recent sale (creating SALES notification):', {
      productName: saleData.productName,
      quantity: saleData.quantity,
      total: saleData.total,
      barcode: saleData.barcode
    });
    
    // Check for duplicates using timestamp + product name
    const duplicateCheck = `product_name = ? AND ABS(strftime('%s', 'now') - strftime('%s', timestamp)) < 10`;
    const checkParams = [saleData.productName || 'Unknown Product'];
      
    const existing = await dbGet(`
      SELECT id FROM sales_sync_notifications 
      WHERE ${duplicateCheck}
      ORDER BY created_at DESC LIMIT 1
    `, checkParams);
    
    if (existing) {
      console.log('⚠️ [RECENT_SALE] Duplicate sale detected, skipping notification');
      return res.json({ 
        success: true, 
        message: 'Duplicate sale, notification skipped',
        notificationSkipped: true
      });
    }
    
    // Create SALES notification
    try {
      await dbRun(`
        INSERT INTO sales_sync_notifications (
          sale_id, product_name, barcode, quantity, unit_price, total,
          remaining_stock, timestamp, source, raw_data, notification_read
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        saleData.id || `sale_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        saleData.productName || 'Unknown Product',
        saleData.barcode || null,
        saleData.quantity || 1,
        saleData.unitPrice || 0,
        saleData.total || 0,
        saleData.remainingStock || null,
        saleData.timestamp || new Date().toISOString(),
        'mobile_sale',
        JSON.stringify(saleData),
        0 // unread notification
      ]);
      
      console.log('✅ [RECENT_SALE] SALES notification created successfully');
      
    } catch (notificationError) {
      console.error('❌ [RECENT_SALE] Error creating sales notification:', notificationError);
      // Continue anyway - don't fail the sale save
    }
    
    res.json({ 
      success: true, 
      message: 'Recent sale logged and notification created'
    });
    
  } catch (err) {
    console.error('POST /recent-sales error', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to log recent sale' 
    });
  }
});

// ==================== RECENT SCANS POST ENDPOINT (Mobile App) ====================
// FIXED: Create SCANS notifications (not queue) for regular invoice scans
app.post('/recent-scans', async (req, res) => {
  try {
    const scanData = req.body;
    console.log('[RECENT_SCAN] 📋 SCANS ENDPOINT HIT - Mobile app saving recent scan (creating SCANS notification):', {
      type: scanData.type,
      vendor: scanData.vendor,
      totalItems: scanData.totalItems,
      total: scanData.total,
      hasImage: !!scanData.imageUri,
      requestId: scanData.requestId,
      productName: scanData.productName,
      barcode: scanData.barcode
    });
    
    // ALERT if sales data is incorrectly coming to scans endpoint
    if (scanData.type === 'sale' || scanData.productName) {
      console.log('🚨 [RECENT_SCAN] WARNING: Potential sale data received at scans endpoint!');
      console.log('🚨 [RECENT_SCAN] This might be why sales show in scans tab');
    }
    
    // FIXED: Create SCANS notification for regular invoice scans
    try {
      // Check for duplicates using requestId or timestamp + vendor
      const duplicateCheck = scanData.requestId ? 
        `scan_id = ?` : `vendor = ? AND ABS(strftime('%s', 'now') - strftime('%s', timestamp)) < 10`;
      const checkParams = scanData.requestId ? 
        [scanData.requestId] : [scanData.vendor || 'Unknown'];
        
      const existing = await dbGet(`
        SELECT id FROM scans_sync_notifications 
        WHERE ${duplicateCheck}
        ORDER BY created_at DESC LIMIT 1
      `, checkParams);
      
      if (existing) {
        console.log('⚠️ [RECENT_SCAN] Duplicate scan detected, skipping notification');
        return res.json({ 
          success: true, 
          message: 'Duplicate scan, notification skipped',
          notificationSkipped: true
        });
      }
      
      // FIXED: Process and save invoice image if provided
      let invoiceImagePath = null;
      
      // DEBUG: Log what image data we received
      console.log('🔍 [RECENT_SCAN] Image data check:', {
        hasImageBase64: !!scanData.imageBase64,
        imageBase64Length: scanData.imageBase64 ? scanData.imageBase64.length : 0,
        hasImagesBase64: !!scanData.imagesBase64,
        imagesBase64Count: scanData.imagesBase64 ? scanData.imagesBase64.length : 0,
        hasInvoiceImage: scanData.hasInvoiceImage,
        isMultiPage: scanData.isMultiPage,
        pageCount: scanData.pageCount
      });
      
      // Handle multi-page invoices with multiple base64 images
      if (scanData.imagesBase64 && scanData.imagesBase64.length > 0 && scanData.isMultiPage) {
        console.log(`📄 [RECENT_SCAN] Processing ${scanData.imagesBase64.length} invoice pages...`);
        const fs = require('fs');
        const path = require('path');
        const invoiceImagesDir = path.join(__dirname, 'invoice-images');
        
        // Create directory if needed
        if (!fs.existsSync(invoiceImagesDir)) {
          fs.mkdirSync(invoiceImagesDir, { recursive: true });
        }
        
        const savedImagePaths = [];
        
        for (let i = 0; i < scanData.imagesBase64.length; i++) {
          if (scanData.imagesBase64[i]) {
            try {
              const imageBuffer = Buffer.from(scanData.imagesBase64[i], 'base64');
              const imageFileName = `invoice_${scanData.requestId || Date.now()}_page${i + 1}.jpg`;
              const fullImagePath = path.join(invoiceImagesDir, imageFileName);
              
              fs.writeFileSync(fullImagePath, imageBuffer);
              savedImagePaths.push(`invoice-images/${imageFileName}`);
              
              console.log(`✅ [RECENT_SCAN] Page ${i + 1} saved: ${imageFileName} (${imageBuffer.length} bytes)`);
            } catch (pageError) {
              console.error(`❌ [RECENT_SCAN] Error saving page ${i + 1}:`, pageError);
            }
          }
        }
        
        // Store all image paths as JSON
        invoiceImagePath = savedImagePaths.length > 0 ? JSON.stringify(savedImagePaths) : null;
        console.log(`✅ [RECENT_SCAN] ${savedImagePaths.length} pages saved for multi-page invoice`);
        
      } else if (scanData.imageBase64) {
        // FIXED: Save image if imageBase64 exists, don't depend on hasInvoiceImage flag
        try {
          const fs = require('fs');
          const path = require('path');
          const invoiceImagesDir = path.join(__dirname, 'invoice-images');
          
          console.log(`📁 [RECENT_SCAN] Invoice images directory: ${invoiceImagesDir}`);
          
          // Create invoice-images directory if it doesn't exist
          if (!fs.existsSync(invoiceImagesDir)) {
            console.log(`[RECENT_SCAN] Creating invoice-images directory: ${invoiceImagesDir}`);
            fs.mkdirSync(invoiceImagesDir, { recursive: true });
          }
          
          // Save image from base64 data
          console.log(`📝 [RECENT_SCAN] Converting base64 to buffer (length: ${scanData.imageBase64.length})...`);
          const imageBuffer = Buffer.from(scanData.imageBase64, 'base64');
          console.log(`📝 [RECENT_SCAN] Buffer created (size: ${imageBuffer.length} bytes)`);
          
          const imageFileName = `invoice_${scanData.requestId || Date.now()}.jpg`;
          const fullImagePath = path.join(invoiceImagesDir, imageFileName);
          
          console.log(`💾 [RECENT_SCAN] Saving image to: ${fullImagePath}`);
          fs.writeFileSync(fullImagePath, imageBuffer);
          
          // Verify file was saved
          if (fs.existsSync(fullImagePath)) {
            const stats = fs.statSync(fullImagePath);
            console.log(`✅ [RECENT_SCAN] Image saved successfully! Size: ${stats.size} bytes`);
            invoiceImagePath = `invoice-images/${imageFileName}`; // Relative path for database
          } else {
            console.error('❌ [RECENT_SCAN] Image file was not created!');
          }
          
        } catch (imageError) {
          console.error('❌ [RECENT_SCAN] Error saving invoice image:', imageError);
          console.error('Stack trace:', imageError.stack);
          // Continue anyway - don't fail the scan save
        }
      } else {
        console.log('⚠️ [RECENT_SCAN] No image data to save:', {
          hasImageBase64: !!scanData.imageBase64,
          imageBase64Length: scanData.imageBase64 ? scanData.imageBase64.length : 0,
          hasImagesBase64: !!scanData.imagesBase64,
          imagesBase64Count: scanData.imagesBase64 ? scanData.imagesBase64.length : 0,
          hasInvoiceImage: scanData.hasInvoiceImage,
          isMultiPage: scanData.isMultiPage,
          imageUri: scanData.imageUri,
          imageUris: scanData.imageUris
        });
        console.log('🔍 [RECENT_SCAN] Full scanData keys:', Object.keys(scanData));
      }
      
      // Create SCANS notification (handle both invoice and barcode scans)
      // Include all additional fields from Content Understanding in raw_data
      const enhancedScanData = {
        ...scanData,
        vendorDetails: scanData.vendorDetails,
        additionalFields: scanData.additionalFields,
        metadata: scanData.metadata,
        processingMethod: scanData.processingMethod,
        lowConfidenceItems: scanData.lowConfidenceItems
      };
      
      await dbRun(`
        INSERT INTO scans_sync_notifications (
          scan_id, scan_type, vendor, product_name, barcode,
          total_items, total_amount, image_count, is_multi_page,
          timestamp, source, raw_data, notification_read, image_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        scanData.requestId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        scanData.type || 'invoice_scan', // 'invoice_scan' or 'barcode'
        scanData.type === 'barcode' ? null : (scanData.vendor || 'Unknown Vendor'), // Only invoices have vendors
        scanData.productName || null, // Barcode scans have productName
        scanData.barcode || null, // Barcode scans have barcode
        scanData.totalItems || 0,
        scanData.total || 0,
        invoiceImagePath ? 1 : (scanData.imageUri ? 1 : 0), // Count actual images saved
        scanData.isMultiPage ? 1 : 0, // Handle multi-page invoices
        scanData.timestamp || new Date().toISOString(),
        'mobile_scan',
        JSON.stringify(enhancedScanData), // Store enhanced data with all additional fields
        0, // unread notification
        invoiceImagePath // Store saved image path
      ]);
      
      console.log('✅ [RECENT_SCAN] SCANS notification created successfully');
      
    } catch (notificationError) {
      console.error('❌ [RECENT_SCAN] Error creating scans notification:', notificationError);
      // Continue anyway - don't fail the scan save
    }
    
    res.json({ 
      success: true, 
      message: 'Recent scan logged and notification created'
    });
    
  } catch (err) {
    console.error('POST /recent-scans error', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to log recent scan' 
    });
  }
});

// ==================== ENHANCED QUEUE SYNC ENDPOINT ====================
// This endpoint receives complete invoice data from mobile queue system
app.post('/recent-scans/sync', async (req, res) => {
  try {
    const { queueId, scanData, timestamp, source } = req.body;
    
    console.log('📋 [QUEUE_SYNC] Enhanced queue sync request received:', {
      queueId,
      vendor: scanData?.vendor || 'Unknown',
      totalItems: scanData?.totalItems || 0,
      hasImages: !!(scanData?.imageUris?.length || scanData?.imageUri),
      imageCount: scanData?.imageUris?.length || (scanData?.imageUri ? 1 : 0),
      isMultiPage: scanData?.isMultiPage || false,
      pageCount: scanData?.pageCount || 1,
      requestId: scanData?.requestId
    });
    
    // Store the enhanced queue sync data in a dedicated table for notifications
    await dbRun(`
      INSERT OR REPLACE INTO queue_sync_notifications (
        queue_id, request_id, vendor, total_items, total_amount,
        image_count, is_multi_page, page_count, sync_timestamp,
        source, raw_data, notification_read
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      queueId,
      scanData?.requestId || queueId,
      scanData?.vendor || 'Unknown Vendor',
      scanData?.totalItems || 0,
      scanData?.total || 0,
      scanData?.imageUris?.length || (scanData?.imageUri ? 1 : 0),
      scanData?.isMultiPage ? 1 : 0,
      scanData?.pageCount || 1,
      timestamp || new Date().toISOString(),
      source || 'mobile_queue',
      JSON.stringify(scanData),
      0 // unread notification
    ]);
    
    console.log('✅ [QUEUE_SYNC] Queue sync data stored for desktop notification');
    
    res.json({
      success: true,
      scanId: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      queueId,
      message: 'Recent scan data synchronized successfully',
      imageCount: scanData?.imageUris?.length || (scanData?.imageUri ? 1 : 0),
      notification: 'Queue update available in desktop'
    });
    
  } catch (err) {
    console.error('❌ [QUEUE_SYNC] Error processing queue sync:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process queue sync data',
      details: err.message 
    });
  }
});

// ==================== QUEUE NOTIFICATIONS ENDPOINTS ====================
// Get pending queue notifications for desktop UI
app.get('/api/queue-notifications', async (req, res) => {
  try {
    const notifications = await dbAll(`
      SELECT 
        id,
        queue_id,
        request_id,
        vendor,
        total_items,
        total_amount,
        image_count,
        is_multi_page,
        page_count,
        sync_timestamp,
        source,
        notification_read
      FROM queue_sync_notifications 
      ORDER BY sync_timestamp DESC 
      LIMIT 10
    `);
    
    const unreadCount = notifications.filter(n => !n.notification_read).length;
    
    console.log(`📊 [QUEUE_NOTIFICATIONS] Returning ${notifications.length} notifications (${unreadCount} unread)`);
    
    res.json({
      success: true,
      notifications: notifications.map(n => ({
        id: n.id,
        queueId: n.queue_id,
        requestId: n.request_id,
        vendor: n.vendor,
        totalItems: n.total_items,
        totalAmount: n.total_amount,
        imageCount: n.image_count,
        isMultiPage: !!n.is_multi_page,
        pageCount: n.page_count,
        syncTimestamp: n.sync_timestamp,
        source: n.source,
        isRead: !!n.notification_read
      })),
      unreadCount,
      totalCount: notifications.length
    });
    
  } catch (err) {
    console.error('❌ [QUEUE_NOTIFICATIONS] Error getting notifications:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get queue notifications' 
    });
  }
});

// Mark queue notification as read
app.post('/api/queue-notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    await dbRun(`
      UPDATE queue_sync_notifications 
      SET notification_read = 1 
      WHERE id = ?
    `, [id]);
    
    console.log(`✅ [QUEUE_NOTIFICATIONS] Marked notification ${id} as read`);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
    
  } catch (err) {
    console.error('❌ [QUEUE_NOTIFICATIONS] Error marking notification as read:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as read' 
    });
  }
});

// Clear all queue notifications
app.post('/api/queue-notifications/clear', async (req, res) => {
  try {
    await dbRun('DELETE FROM queue_sync_notifications');
    
    console.log('🧹 [QUEUE_NOTIFICATIONS] All notifications cleared');
    
    res.json({
      success: true,
      message: 'All notifications cleared'
    });
    
  } catch (err) {
    console.error('❌ [QUEUE_NOTIFICATIONS] Error clearing notifications:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear notifications' 
    });
  }
});

// ==================== SALES NOTIFICATIONS ENDPOINTS ====================
// Get sales notifications for desktop UI
app.get('/api/sales-notifications', async (req, res) => {
  try {
    const notifications = await dbAll(`
      SELECT 
        id,
        sale_id,
        product_name,
        barcode,
        quantity,
        unit_price,
        total,
        remaining_stock,
        timestamp,
        source,
        notification_read
      FROM sales_sync_notifications 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    
    const unreadCount = notifications.filter(n => !n.notification_read).length;
    
    console.log(`📊 [SALES_NOTIFICATIONS] Returning ${notifications.length} notifications (${unreadCount} unread)`);
    
    res.json({
      success: true,
      notifications: notifications.map(n => ({
        id: n.id,
        saleId: n.sale_id,
        productName: n.product_name,
        barcode: n.barcode,
        quantity: n.quantity,
        unitPrice: n.unit_price,
        total: n.total,
        remainingStock: n.remaining_stock,
        timestamp: n.timestamp,
        source: n.source,
        isRead: !!n.notification_read
      })),
      unreadCount,
      totalCount: notifications.length
    });
    
  } catch (err) {
    console.error('❌ [SALES_NOTIFICATIONS] Error getting notifications:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get sales notifications' 
    });
  }
});

// Mark sales notification as read
app.post('/api/sales-notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    await dbRun(`
      UPDATE sales_sync_notifications 
      SET notification_read = 1 
      WHERE id = ?
    `, [id]);
    
    console.log(`✅ [SALES_NOTIFICATIONS] Marked notification ${id} as read`);
    
    res.json({
      success: true,
      message: 'Sales notification marked as read'
    });
    
  } catch (err) {
    console.error('❌ [SALES_NOTIFICATIONS] Error marking notification as read:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark sales notification as read' 
    });
  }
});

// Clear all sales notifications
app.post('/api/sales-notifications/clear', async (req, res) => {
  try {
    await dbRun('DELETE FROM sales_sync_notifications');
    
    console.log('🧹 [SALES_NOTIFICATIONS] All notifications cleared');
    
    res.json({
      success: true,
      message: 'All sales notifications cleared'
    });
    
  } catch (err) {
    console.error('❌ [SALES_NOTIFICATIONS] Error clearing notifications:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear sales notifications' 
    });
  }
});

// ==================== SCANS NOTIFICATIONS ENDPOINTS ====================
// Get scans notifications for desktop UI
app.get('/api/scans-notifications', async (req, res) => {
  try {
    const notifications = await dbAll(`
      SELECT 
        id,
        scan_id,
        scan_type,
        vendor,
        product_name,
        barcode,
        total_items,
        total_amount,
        image_count,
        is_multi_page,
        timestamp,
        source,
        notification_read,
        image_path
      FROM scans_sync_notifications 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    
    const unreadCount = notifications.filter(n => !n.notification_read).length;
    
    console.log(`📊 [SCANS_NOTIFICATIONS] Returning ${notifications.length} notifications (${unreadCount} unread)`);
    
    res.json({
      success: true,
      notifications: notifications.map(n => {
        // Parse raw_data to extract additional fields
        let additionalData = {};
        try {
          const rawData = JSON.parse(n.raw_data || '{}');
          additionalData = {
            vendorDetails: rawData.vendorDetails,
            additionalFields: rawData.additionalFields,
            metadata: rawData.metadata,
            processingMethod: rawData.processingMethod,
            lowConfidenceItems: rawData.lowConfidenceItems
          };
        } catch (e) {
          console.log('Could not parse raw_data for notification', n.id);
        }
        
        return {
          id: n.id,
          scanId: n.scan_id,
          scanType: n.scan_type,
          vendor: n.vendor,
          productName: n.product_name,
          barcode: n.barcode,
          totalItems: n.total_items,
          totalAmount: n.total_amount,
          imageCount: n.image_count,
          isMultiPage: !!n.is_multi_page,
          timestamp: n.timestamp,
          source: n.source,
          isRead: !!n.notification_read,
          imagePath: n.image_path, // Include saved image path
          ...additionalData // Include all additional fields from Content Understanding
        };
      }),
      unreadCount,
      totalCount: notifications.length
    });
    
  } catch (err) {
    console.error('❌ [SCANS_NOTIFICATIONS] Error getting notifications:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get scans notifications' 
    });
  }
});

// Mark scans notification as read
app.post('/api/scans-notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    await dbRun(`
      UPDATE scans_sync_notifications 
      SET notification_read = 1 
      WHERE id = ?
    `, [id]);
    
    console.log(`✅ [SCANS_NOTIFICATIONS] Marked notification ${id} as read`);
    
    res.json({
      success: true,
      message: 'Scans notification marked as read'
    });
    
  } catch (err) {
    console.error('❌ [SCANS_NOTIFICATIONS] Error marking notification as read:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark scans notification as read' 
    });
  }
});

// Clear all scans notifications
app.post('/api/scans-notifications/clear', async (req, res) => {
  try {
    await dbRun('DELETE FROM scans_sync_notifications');
    
    console.log('🧹 [SCANS_NOTIFICATIONS] All notifications cleared');
    
    res.json({
      success: true,
      message: 'All scans notifications cleared'
    });
    
  } catch (err) {
    console.error('❌ [SCANS_NOTIFICATIONS] Error clearing notifications:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear scans notifications' 
    });
  }
});

// ==================== BATCH PRICE UPDATE ENDPOINT ====================
app.post('/api/update-batch-selling-prices', async (req, res) => {
  const { requestId, updatedItems, priceUpdates } = req.body;
  
  try {
    console.log(`[BATCH_PRICE] Processing batch price update for requestId: ${requestId}`);
    
    // Handle both old and new format
    const items = updatedItems || priceUpdates;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No items provided for price update'
      });
    }
    
    let totalUpdated = 0;
    
    for (const item of items) {
      if (item.barcode && item.sellingPrice) {
        try {
          const result = await dbRun(
            'UPDATE products SET price = ? WHERE barcode = ?',
            [parseFloat(item.sellingPrice), item.barcode]
          );
          
          if (result.changes > 0) {
            totalUpdated++;
            console.log(`[BATCH_PRICE] Updated selling price for barcode ${item.barcode}: ${item.sellingPrice} DZD`);
          } else {
            console.log(`[BATCH_PRICE] No product found for barcode ${item.barcode}`);
          }
        } catch (err) {
          console.error(`[BATCH_PRICE] Error updating barcode ${item.barcode}:`, err);
        }
      } else {
        console.log(`[BATCH_PRICE] Skipping item - missing barcode or selling price:`, item);
      }
    }
    
    res.json({
      success: true,
      message: `Updated selling prices for ${totalUpdated} products`,
      totalUpdated
    });
    
  } catch (err) {
    console.error('POST /api/update-batch-selling-prices error', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update batch selling prices'
    });
  }
});

// ==================== VENDORS & CATEGORIES ====================
app.get('/vendors', async (req, res) => {
  try {
    const vendors = await dbAll('SELECT * FROM vendors ORDER BY name');
    res.json({ vendors });
  } catch (err) {
    console.error('GET /vendors error', err);
    res.status(500).json({ error: 'Failed to get vendors' });
  }
});

app.post('/vendors', async (req, res) => {
  try {
    const { name, contactEmail, contactPhone, address } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }

    const result = await dbRun(
      'INSERT INTO vendors (name, contact_email, contact_phone, address) VALUES (?, ?, ?, ?)',
      [name, contactEmail, contactPhone, address]
    );

    const vendor = await dbGet('SELECT * FROM vendors WHERE id = ?', [result.id]);
    res.json({ success: true, vendor });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Vendor already exists' });
    }
    console.error('POST /vendors error', err);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

app.get('/categories', async (req, res) => {
  try {
    const categories = await dbAll('SELECT * FROM categories ORDER BY name');
    res.json({ categories });
  } catch (err) {
    console.error('GET /categories error', err);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

app.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const result = await dbRun(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name, description]
    );

    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [result.id]);
    res.json({ success: true, category });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Category already exists' });
    }
    console.error('POST /categories error', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ==================== BARCODE SCANNING API ====================
// Get product by barcode for mobile scanning
app.get('/api/product-by-barcode/:barcode', async (req, res) => {
  const { barcode } = req.params;
  console.log(`[BARCODE-SCAN] Looking up product: ${barcode}`);
  
  try {
    // First try to find by barcode
    let product = await dbGet(`
      SELECT p.*, v.name as vendor_name 
      FROM products p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.barcode = ? 
      AND p.is_active = 1
    `, [barcode]);
    
    // If not found by barcode, try searching by name (barcode might contain product name text)
    if (!product) {
      console.log(`[BARCODE-SCAN] Not found by barcode, trying by name: ${barcode}`);
      
      // Clean the text and search by name
      const searchText = barcode.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
      if (searchText.length > 2) {
        product = await dbGet(`
          SELECT p.*, v.name as vendor_name 
          FROM products p
          LEFT JOIN vendors v ON p.vendor_id = v.id
          WHERE LOWER(p.name) LIKE LOWER(?)
          AND p.is_active = 1
          ORDER BY p.quantity DESC
          LIMIT 1
        `, [`%${searchText}%`]);
        
        if (product) {
          console.log(`[BARCODE-SCAN] Found by name: ${product.name}`);
        }
      }
    }
    
    if (!product) {
      console.log(`[BARCODE-SCAN] Product not found: ${barcode}`);
      return res.status(404).json({ 
        error: 'Product not found',
        barcode: barcode,
        searchText: barcode 
      });
    }
    
    console.log(`[BARCODE-SCAN] Found product: ${product.name} (Stock: ${product.quantity})`);
    res.json({
      success: true,
      product: {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        price: product.selling_price || product.price,
        selling_price: product.selling_price || product.price,
        quantity: product.quantity,
        category: product.category,
        vendor: product.vendor_name || product.vendor,
        vendor_name: product.vendor_name,
        description: product.description,
        image_url: product.image_url
      }
    });
  } catch (error) {
    console.error('[BARCODE-SCAN] Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Search products by name
app.get('/api/products/search', async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) {
    return res.json({ success: true, products: [] });
  }
  
  try {
    const products = await dbAll(`
      SELECT p.*, v.name as vendor_name 
      FROM products p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE LOWER(p.name) LIKE LOWER(?)
      AND p.is_active = 1
      ORDER BY p.quantity DESC
      LIMIT 20
    `, [`%${q}%`]);
    
    res.json({
      success: true,
      products: products.map(p => ({
        id: p.id,
        barcode: p.barcode,
        name: p.name,
        price: p.selling_price || p.price,
        selling_price: p.selling_price || p.price,
        quantity: p.quantity,
        vendor: p.vendor_name,
        vendor_name: p.vendor_name
      }))
    });
  } catch (error) {
    console.error('[SEARCH] Error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Process product sale from barcode scanner
app.post('/api/sell-product', async (req, res) => {
  const { barcode, quantity, sellingPrice, totalAmount } = req.body;
  
  console.log(`[SALE] Processing sale - Barcode: ${barcode}, Qty: ${quantity}, Price: ${sellingPrice}`);
  
  try {
    await dbRun('BEGIN TRANSACTION');
    
    // Get current product
    const product = await dbGet(`
      SELECT * FROM products 
      WHERE (barcode = ? OR barcode = ?) 
      AND is_active = 1
    `, [barcode, barcode]);
    
    if (!product) {
      await dbRun('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (product.quantity < quantity) {
      await dbRun('ROLLBACK');
      return res.status(400).json({ 
        error: 'Insufficient stock',
        available: product.quantity 
      });
    }
    
    // Update product quantity
    const newQuantity = product.quantity - quantity;
    await dbRun(`
      UPDATE products 
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [newQuantity, product.id]);
    
    // Record the sale
    await dbRun(`
      INSERT INTO sales (
        product_id, product_name, barcode, quantity, 
        unit_price, total_amount, sale_date
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      product.id,
      product.name,
      barcode,
      quantity,
      sellingPrice,
      totalAmount
    ]);
    
    // Add to stock movement history
    await dbRun(`
      INSERT INTO stock_movements (
        product_id, type, quantity, unit_price, 
        total_value, notes, created_at
      ) VALUES (?, 'sale', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      product.id,
      -quantity, // Negative for sales
      sellingPrice,
      totalAmount,
      `Barcode sale - ${quantity} units`
    ]);
    
    await dbRun('COMMIT');
    
    console.log(`[SALE] Success - ${product.name}: Sold ${quantity} units, ${newQuantity} remaining`);
    
    res.json({
      success: true,
      message: 'Sale completed successfully',
      product: product.name,
      quantitySold: quantity,
      remainingStock: newQuantity,
      totalAmount: totalAmount
    });
    
  } catch (error) {
    await dbRun('ROLLBACK');
    console.error('[SALE] Error:', error);
    res.status(500).json({ error: 'Failed to process sale' });
  }
});

// ==================== TRANSACTIONS API ====================
// Get transactions with filtering
app.get('/api/transactions', async (req, res) => {
  try {
    const { type, period } = req.query;
    
    let query = `
      SELECT t.*, p.name as product_name 
      FROM transactions t 
      LEFT JOIN products p ON t.product_id = p.id 
      WHERE 1=1
    `;
    const params = [];
    
    // Filter by transaction type
    if (type) {
      query += ' AND t.transaction_type = ?';
      params.push(type);
    }
    
    // Filter by period
    if (period && period !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
          break;
      }
      
      if (startDate) {
        query += ' AND t.timestamp >= ?';
        params.push(startDate);
      }
    }
    
    query += ' ORDER BY t.timestamp DESC';
    
    const transactions = await dbAll(query, params);
    
    res.json({
      success: true,
      transactions,
      count: transactions.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch transactions',
      transactions: []
    });
  }
});

// Get single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await dbGet('SELECT * FROM products WHERE id = ?', [productId]);
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch product' 
    });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const timestamp = new Date().toISOString();
  
  console.log('┌─────────────────────────────────────────────────────────');
  console.log('│ 🏥 MOBILE APP CONNECTION ATTEMPT');
  console.log('├─────────────────────────────────────────────────────────');
  console.log(`│ 📱 Client IP: ${clientIP}`);
  console.log(`│ 🔧 User Agent: ${userAgent}`);
  console.log(`│ ⏰ Time: ${timestamp}`);
  console.log(`│ 🔗 Request Headers:`, JSON.stringify(req.headers, null, '│    '));
  console.log('└─────────────────────────────────────────────────────────');
  
  res.json({
    status: 'ok',
    message: 'Desktop server is running',
    timestamp: timestamp,
    uptime: process.uptime(),
    cache: { 
      products: productCache.keys().length, 
      images: imageCache.keys().length,
      serpResults: serpCache.keys().length,
      stats: {
        products: productCache.getStats(),
        images: imageCache.getStats(),
        serp: serpCache.getStats()
      }
    },
    database: 'connected'
  });
});

// Time synchronization endpoint for mobile app
app.get('/time', (req, res) => {
  res.json({ 
    timestamp: Date.now(),
    iso: new Date().toISOString()
  });
});

// ==================== CACHE MANAGEMENT ====================
app.post('/cache/clear', (req, res) => {
  const { type = 'all' } = req.body;
  let clearedKeys = 0;
  let clearedCaches = [];
  
  if (type === 'all' || type === 'products') {
    clearedKeys += productCache.keys().length;
    productCache.flushAll();
    clearedCaches.push('products');
  }
  
  if (type === 'all' || type === 'images') {
    clearedKeys += imageCache.keys().length;
    imageCache.flushAll();
    clearedCaches.push('images');
  }
  
  if (type === 'all' || type === 'serp') {
    clearedKeys += serpCache.keys().length;
    serpCache.flushAll();
    clearedCaches.push('serp');
  }
  
  res.json({ 
    success: true, 
    clearedKeys: clearedKeys,
    clearedCaches: clearedCaches,
    message: `Cache(s) cleared successfully: ${clearedCaches.join(', ')}` 
  });
});

// ==================== INVOICE ENDPOINTS ====================
app.get('/invoices/recent', async (req, res) => {
  try {
    const { limit = 10, includeDetails = false } = req.query;
    
    // Get recent invoices
    const invoices = await dbAll(`
      SELECT i.*, v.name as vendor_name 
      FROM invoices i
      LEFT JOIN vendors v ON i.vendor_id = v.id
      ORDER BY i.created_at DESC, i.finalized_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    // Enhanced processing with items and images
    const processedInvoices = await Promise.all(invoices.map(async (invoice) => {
      let items = [];
      let images = [];
      
      if (includeDetails === 'true' || includeDetails === true) {
        // Get products created from this invoice using request_id
        try {
          const inventoryMovements = await dbAll(`
            SELECT p.*, im.movement_type, im.quantity as quantity_change, im.notes
            FROM inventory_movements im
            JOIN products p ON im.product_id = p.id
            WHERE im.reference_transaction_id = ? AND im.movement_type = 'in'
            ORDER BY im.created_at DESC
          `, [invoice.request_id]);
          
          items = inventoryMovements.map(movement => ({
            id: movement.id,
            name: movement.name,
            barcode: movement.barcode,
            quantity: movement.quantity_change,
            costPrice: movement.cost_price,
            sellingPrice: movement.price,
            vendor: invoice.vendor_name,
            category: movement.category_id ? `Category ${movement.category_id}` : null,
            image_url: movement.image_url,
            image_local_path: movement.image_local_path
          }));
        } catch (error) {
          console.warn(`Failed to get items for invoice ${invoice.id}:`, error.message);
        }
        
        // Get invoice images
        try {
          images = await dbAll(`
            SELECT image_url, image_path, page_number, image_type, original_name
            FROM invoice_images 
            WHERE invoice_id = ?
            ORDER BY page_number ASC
          `, [invoice.id]);
        } catch (error) {
          console.warn(`Failed to get images for invoice ${invoice.id}:`, error.message);
        }
      }
      
      return {
        ...invoice,
        invoice_image_path: invoice.invoice_image_url, // Keep the full GCS URL
        invoiceImageUrl: invoice.invoice_image_url, // Add this for consistency
        items: items,
        images: images,
        totalItems: items.length || invoice.total_items || 0
      };
    }));

    res.json({
      success: true,
      invoices: processedInvoices
    });
  } catch (err) {
    console.error('GET /invoices/recent error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch recent invoices' 
    });
  }
});

// ==================== NOTIFICATION ENDPOINTS ====================
// Get notifications
app.get('/notifications', (req, res) => {
  try {
    const { type, unreadOnly, priority, limit } = req.query;
    
    const filters = {};
    if (type) filters.type = type;
    if (unreadOnly === 'true') filters.unreadOnly = true;
    if (priority) filters.priority = priority;
    if (limit) filters.limit = limit;
    
    const notifications = notificationManager.getNotifications(filters);
    const stats = notificationManager.getStats();
    
    res.json({
      success: true,
      notifications: notifications.map(n => notificationManager.formatNotification(n)),
      stats
    });
  } catch (error) {
    console.error('GET /notifications error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch notifications' 
    });
  }
});

// Mark notification as read
app.post('/notifications/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const success = notificationManager.markAsRead(id);
    
    if (success) {
      res.json({ success: true, message: 'Notification marked as read' });
    } else {
      res.status(404).json({ success: false, error: 'Notification not found' });
    }
  } catch (error) {
    console.error('POST /notifications/:id/read error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as read' 
    });
  }
});

// Mark all notifications as read
app.post('/notifications/read-all', (req, res) => {
  try {
    const markedCount = notificationManager.markAllAsRead();
    res.json({ 
      success: true, 
      message: `Marked ${markedCount} notifications as read`,
      markedCount 
    });
  } catch (error) {
    console.error('POST /notifications/read-all error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark all notifications as read' 
    });
  }
});

// Add queued invoice notification (called by mobile app)
app.post('/notifications/invoice-queued', (req, res) => {
  try {
    const queueData = req.body;
    const notification = notificationManager.notifyInvoiceQueued(queueData);
    
    res.json({
      success: true,
      message: 'Queue notification added',
      notification: notificationManager.formatNotification(notification)
    });
  } catch (error) {
    console.error('POST /notifications/invoice-queued error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add queue notification' 
    });
  }
});

// Clear old notifications
app.delete('/notifications/old', (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const clearedCount = notificationManager.clearOldNotifications(parseInt(hours));
    
    res.json({
      success: true,
      message: `Cleared ${clearedCount} old notifications`,
      clearedCount
    });
  } catch (error) {
    console.error('DELETE /notifications/old error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear old notifications' 
    });
  }
});

// ==================== SALES ENDPOINTS ====================
app.get('/sales', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    let whereClause = '';
    const now = new Date();
    
    switch(period) {
      case 'today':
        whereClause = `WHERE date(s.sale_date) = date('now')`;
        break;
      case 'week':
        whereClause = `WHERE date(s.sale_date) >= date('now', '-7 days')`;
        break;
      case 'month':
        whereClause = `WHERE date(s.sale_date) >= date('now', '-30 days')`;
        break;
      case 'all':
      default:
        whereClause = '';
        break;
    }
    
    // Get sales from transactions or create mock data
    const sales = await dbAll(`
      SELECT 
        t.id,
        t.product_id,
        p.name as productName,
        p.barcode as productBarcode,
        t.quantity,
        t.unit_price as unitPrice,
        t.total_price as totalPrice,
        t.transaction_type as type,
        t.created_at as timestamp,
        t.notes as customerName,
        'completed' as status,
        'cash' as paymentMethod,
        0 as discount,
        'INV_' || t.id as invoiceId
      FROM transactions t
      LEFT JOIN products p ON t.product_id = p.id
      WHERE t.transaction_type = 'sale'
      ${whereClause.replace('s.sale_date', 't.created_at')}
      ORDER BY t.created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      sales: sales.length > 0 ? sales : generateMockSales(period)
    });
  } catch (err) {
    console.error('GET /sales error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch sales data',
      sales: []
    });
  }
});

// Helper function to generate mock sales data
function generateMockSales(period) {
  const now = new Date();
  const sales = [];
  const numSales = period === 'today' ? 5 : period === 'week' ? 20 : 50;
  
  for (let i = 0; i < numSales; i++) {
    const hoursAgo = Math.floor(Math.random() * (period === 'today' ? 24 : period === 'week' ? 168 : 720));
    const saleDate = new Date(now - hoursAgo * 3600000);
    
    sales.push({
      id: `SALE_${Date.now()}_${i}`,
      productName: `Product ${Math.floor(Math.random() * 20) + 1}`,
      productBarcode: `123456789${Math.floor(Math.random() * 1000)}`,
      quantity: Math.floor(Math.random() * 5) + 1,
      unitPrice: (Math.random() * 50 + 10).toFixed(2),
      totalPrice: ((Math.random() * 50 + 10) * (Math.floor(Math.random() * 5) + 1)).toFixed(2),
      paymentMethod: ['cash', 'card', 'mobile'][Math.floor(Math.random() * 3)],
      timestamp: saleDate.toISOString(),
      invoiceId: `INV_${Date.now()}_${i}`,
      status: 'completed',
      customerName: Math.random() > 0.5 ? `Customer ${i + 1}` : null,
      discount: Math.random() < 0.3 ? (Math.random() * 10).toFixed(2) : 0
    });
  }
  
  return sales;
}

// ==================== IMAGE CLEANUP ====================
app.post('/images/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 30, dryRun = false } = req.body;
    
    const imageDir = path.join(__dirname, 'product-images');
    if (!fs.existsSync(imageDir)) {
      return res.json({ success: true, message: 'No images directory found', deletedCount: 0 });
    }
    
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    const files = fs.readdirSync(imageDir);
    let deletedCount = 0;
    const deletedFiles = [];
    
    for (const file of files) {
      const filePath = path.join(imageDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        // Check if image is still referenced in database
        const referenced = await dbGet(
          'SELECT id FROM products WHERE image_local_path LIKE ? AND is_active = 1',
          [`%${file}`]
        );
        
        if (!referenced) {
          if (!dryRun) {
            fs.unlinkSync(filePath);
          }
          deletedCount++;
          deletedFiles.push(file);
        }
      }
    }
    
    res.json({
      success: true,
      message: `${dryRun ? 'Would delete' : 'Deleted'} ${deletedCount} unreferenced images older than ${olderThanDays} days`,
      deletedCount,
      deletedFiles: dryRun ? deletedFiles : undefined
    });
    
  } catch (err) {
    console.error('POST /images/cleanup error:', err);
    res.status(500).json({ success: false, error: 'Cleanup failed' });
  }
});

// ==================== SERVE INVOICE IMAGES ====================
// Serve invoice images from the invoice-images directory
app.get('/invoice-images/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const fs = require('fs');
    const path = require('path');
    
    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const imagePath = path.join(__dirname, 'invoice-images', filename);
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Set appropriate headers
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg'; // default
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Stream the file
    const readStream = fs.createReadStream(imagePath);
    readStream.pipe(res);
    
    readStream.on('error', (err) => {
      console.error('Error serving image:', err);
      res.status(500).json({ error: 'Failed to serve image' });
    });
    
  } catch (err) {
    console.error('Error in image serving endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== MODERN NOTIFICATIONS ====================

// Get modern notifications
app.get('/api/modern-notifications', async (req, res) => {
  try {
    const filters = {
      unreadOnly: req.query.unreadOnly === 'true',
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    const notifications = notificationManager.getNotifications(filters);
    const stats = notificationManager.getStats();
    
    res.json({
      success: true,
      notifications: notifications.map(n => ({
        ...n,
        timeAgo: notificationManager.getTimeAgo(n.timestamp)
      })),
      stats
    });
  } catch (error) {
    console.error('Error getting modern notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark notification as read
app.post('/api/modern-notifications/:id/read', async (req, res) => {
  try {
    const success = notificationManager.markAsRead(req.params.id);
    res.json({ success });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove notification
app.delete('/api/modern-notifications/:id', async (req, res) => {
  try {
    const success = notificationManager.removeNotification(req.params.id);
    res.json({ success });
  } catch (error) {
    console.error('Error removing notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all notifications
app.post('/api/modern-notifications/clear', async (req, res) => {
  try {
    const count = notificationManager.clearAll();
    res.json({ success: true, cleared: count });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set notification language
app.post('/api/modern-notifications/language', async (req, res) => {
  try {
    const { language } = req.body;
    if (!language || typeof language !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid language code' });
    }
    
    notificationManager.setLanguage(language);
    res.json({ success: true, language });
  } catch (error) {
    console.error('Error setting notification language:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test notification endpoint (for development)
app.post('/api/modern-notifications/test', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    // Default test data based on type
    const testData = data || {
      vendor: 'Test Vendor',
      totalItems: 5,
      invoiceNumber: 'TEST-001'
    };
    
    console.log('🧪 [TEST] Creating test notification:', { type: type || 'invoice_processed', data: testData });
    
    const notification = notificationManager.addNotification(type || 'invoice_processed', testData);
    
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: [
      'GET /products/:barcode',
      'GET /products',
      'POST /products/batch-check',
      'POST /products/search-images',
      'POST /products/download-image',
      'POST /products/batch-search-images',
      'POST /stock/add',
      'POST /stock/sell',
      'POST /invoices/finalize',
      'GET /invoices/recent',
      'GET /notifications',
      'POST /notifications/:id/read',
      'POST /notifications/read-all',
      'POST /notifications/invoice-queued',
      'DELETE /notifications/old',
      'POST /images/cleanup',
      'GET /sales/recent',
      'GET /inventory/stats',
      'GET /inventory/low-stock',
      'GET /vendors',
      'POST /vendors',
      'GET /categories',
      'POST /categories',
      'GET /health',
      'POST /cache/clear'
    ]
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ==================== SERVER STARTUP ====================
let server;

// Check if server is already running
const isPortInUse = (port) => {
  return new Promise((resolve) => {
    const tester = require('net').createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);
  });
};

// ==================== WEBSOCKET HANDLERS ====================
// Cache for inventory count to reduce database load
let inventoryCountCache = { count: 0, timestamp: 0 };
const CACHE_TTL = 5000; // 5 seconds

// Handle WebSocket connections with security and rate limiting
io.on('connection', (socket) => {
  const clientIP = socket.handshake.address;
  console.log('📱 New WebSocket client connected:', socket.id, 'from', clientIP);
  
  // Connection limiting per IP
  const currentConnections = connectionLimits.get(clientIP) || 0;
  if (currentConnections >= 5) { // Max 5 connections per IP
    console.warn('⚠️ Connection limit exceeded for', clientIP);
    socket.emit('error', { message: 'Connection limit exceeded' });
    socket.disconnect(true);
    return;
  }
  connectionLimits.set(clientIP, currentConnections + 1);
  
  // Initialize rate limiter for this socket
  rateLimiters.set(socket.id, new Map());
  
  // Send current inventory count on connection (with caching)
  const now = Date.now();
  if (now - inventoryCountCache.timestamp < CACHE_TTL && inventoryCountCache.count > 0) {
    socket.emit('inventory-count', { 
      count: inventoryCountCache.count,
      cached: true 
    });
  } else {
    db.get('SELECT COUNT(*) as count FROM products WHERE is_active = 1', (err, row) => {
      if (err) {
        console.error('❌ Database error on connection:', err);
        socket.emit('error', { message: 'Failed to fetch inventory count' });
        return;
      }
      if (row) {
        inventoryCountCache = { count: row.count, timestamp: now };
        socket.emit('inventory-count', { count: row.count });
      }
    });
  }
  
  // Handle disconnection with cleanup
  socket.on('disconnect', (reason) => {
    console.log('📱 WebSocket client disconnected:', socket.id, 'Reason:', reason);
    
    // Clean up connection tracking
    const connections = connectionLimits.get(clientIP) || 1;
    if (connections <= 1) {
      connectionLimits.delete(clientIP);
    } else {
      connectionLimits.set(clientIP, connections - 1);
    }
    
    // Clean up rate limiter
    rateLimiters.delete(socket.id);
  });
  
  // Handle inventory refresh request with rate limiting
  socket.on('refresh-inventory', () => {
    const limiter = rateLimiters.get(socket.id);
    const lastRequest = limiter.get('refresh-inventory') || 0;
    
    if (Date.now() - lastRequest < 2000) { // 2 second cooldown
      console.warn('⚠️ Rate limit hit for refresh-inventory from', socket.id);
      socket.emit('error', { message: 'Too many requests. Please wait.' });
      return;
    }
    
    limiter.set('refresh-inventory', Date.now());
    console.log('📱 Client requested inventory refresh');
    broadcastInventoryUpdate();
  });
  
  // Handle errors
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Function to broadcast inventory updates to all connected clients with caching
function broadcastInventoryUpdate() {
  const now = Date.now();
  
  // Use cached value if still fresh
  if (now - inventoryCountCache.timestamp < CACHE_TTL && inventoryCountCache.count >= 0) {
    console.log('📡 Broadcasting cached inventory update:', inventoryCountCache.count, 'products');
    io.emit('inventory-update', { 
      count: inventoryCountCache.count,
      timestamp: new Date().toISOString(),
      cached: true
    });
    return;
  }
  
  // Fetch fresh data
  db.get('SELECT COUNT(*) as count FROM products WHERE is_active = 1', (err, row) => {
    if (err) {
      console.error('❌ Database error in broadcastInventoryUpdate:', err);
      // Send last known good value if available
      if (inventoryCountCache.count >= 0) {
        io.emit('inventory-update', { 
          count: inventoryCountCache.count,
          timestamp: new Date().toISOString(),
          cached: true,
          error: 'Using cached value due to database error'
        });
      }
      return;
    }
    
    if (row) {
      inventoryCountCache = { count: row.count, timestamp: now };
      console.log('📡 Broadcasting inventory update:', row.count, 'products');
      io.emit('inventory-update', { 
        count: row.count,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// Function to broadcast specific product updates with error handling
function broadcastProductUpdate(productId, action) {
  if (!productId || !action) {
    console.error('❌ Invalid parameters for broadcastProductUpdate');
    return;
  }
  
  // For deleted products, just send the ID and action
  if (action === 'deleted' || action === 'soft-deleted') {
    console.log(`📡 Broadcasting ${action} for product ID:`, productId);
    io.emit('product-update', {
      action: action,
      productId: productId,
      timestamp: new Date().toISOString()
    });
    // Invalidate cache
    inventoryCountCache.timestamp = 0;
    return;
  }
  
  // For other actions, fetch the product details
  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) {
      console.error('❌ Database error in broadcastProductUpdate:', err);
      io.emit('product-update', {
        action: action,
        productId: productId,
        timestamp: new Date().toISOString(),
        error: 'Failed to fetch product details'
      });
      return;
    }
    
    if (product) {
      console.log(`📡 Broadcasting ${action} for product:`, product.name);
      io.emit('product-update', {
        action: action,
        product: product,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn(`⚠️ Product ${productId} not found for broadcast`);
    }
    
    // Invalidate cache
    inventoryCountCache.timestamp = 0;
  });
}

const startServer = async () => {
  const portInUse = await isPortInUse(port);
  
  if (portInUse) {
    console.log(`Port ${port} is already in use. Server may already be running.`);
    return;
  }

  server = httpServer.listen(port, '0.0.0.0', () => {
    // Get local network IPs for mobile app connection
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const localIPs = [];
    
    for (let iface in interfaces) {
      for (let addr of interfaces[iface]) {
        if (addr.family === 'IPv4' && !addr.internal) {
          localIPs.push(`${addr.address}:${port}`);
        }
      }
    }
    
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║   DESKTOP INVENTORY MANAGEMENT SERVER                         ║
║────────────────────────────────────────────────────────────────║
║   Port: ${port} (listening on all interfaces: 0.0.0.0)        ║
║   Database: SQLite (inventory.db)                             ║
║                                                                ║
║   📱 MOBILE APP CONNECTION URLS:                              ║`);
    
    localIPs.forEach(ip => {
      console.log(`║   • http://${ip.padEnd(40)} ║`);
    });
    
    console.log(`║                                                                ║
║   Features:                                                   ║
║   • Product inventory management                              ║
║   • Batch product checking                                    ║
║   • Invoice processing from backend                           ║
║   • UDP Broadcast Discovery on port ${UDP_BROADCAST_PORT}     ║
║   • SERP API image search integration                         ║
║   • Lazy image downloading with caching                       ║
║   • Sales tracking                                            ║
║   • Vendor & category management                              ║
╚════════════════════════════════════════════════════════════════╝
Server is running and listening for requests...
  `);
    
    // Start network discovery broadcasting
    discovery.startBroadcasting(port);
    console.log('📡 Network auto-discovery enabled');
    
    // Also listen for backend server announcements
    discovery.startListening((service, rinfo) => {
      if (service.type === 'BACKEND_SERVER') {
        console.log(`🔗 Found backend server at ${rinfo.address}:${service.port}`);
      }
    });

    // ==================== CLOUD SYNC FUNCTIONALITY ====================
    // Option A Implementation: Desktop-to-Cloud Sync for dynamic IP solution
    
    const CLOUD_SERVER = 'https://invoice-processor-dot-my-invoice-server-2025.uc.r.appspot.com';
    const SYNC_INTERVAL = 120000; // 120 seconds (optimized from 60s - 50% less server load)
    const QUEUE_CHECK_INTERVAL = 60000; // 60 seconds (optimized from 30s - 50% less checks)
    
    let lastSyncTime = 0;
    let syncInProgress = false;
    
    // Function to get current inventory for cloud sync
    const getCurrentInventory = () => {
      return new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            id, barcode, name, description, cost_price, price as selling_price, 
            quantity as stock_quantity, min_stock_level as minimum_stock, 
            image_url, created_at as date_created, updated_at as date_modified
          FROM products 
          WHERE is_active = 1
          ORDER BY updated_at DESC
        `, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    };
    
    // Function to sync inventory to cloud server
    const syncInventoryToCloud = async () => {
      if (syncInProgress) {
        return;
      }
      
      try {
        syncInProgress = true;
        const inventory = await getCurrentInventory();
        const syncTime = Date.now();
        
        console.log(`☁️ [SYNC] Pushing ${inventory.length} products to cloud server...`);
        
        const response = await axios.post(`${CLOUD_SERVER}/sync/inventory`, {
          inventory: inventory,
          syncTime: syncTime,
          desktopServer: {
            port: port,
            timestamp: syncTime
          }
        }, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'REVOTEC-DESKTOP-SERVER'
          }
        });
        
        if (response.data.success) {
          lastSyncTime = syncTime;
          console.log(`✅ [SYNC] Inventory synced successfully - ${response.data.totalSynced || inventory.length} products`);
        } else {
          console.log(`⚠️ [SYNC] Sync acknowledged but with issues: ${response.data.message}`);
        }
        
      } catch (error) {
        console.log(`❌ [SYNC] Failed to sync inventory to cloud:`, error.message);
        // Don't throw - just log and continue
      } finally {
        syncInProgress = false;
      }
    };
    
    // Function to check for pending stock updates from cloud
    const checkPendingUpdates = async () => {
      try {
        const response = await axios.get(`${CLOUD_SERVER}/sync/pending-updates`, {
          timeout: 10000,
          headers: {
            'User-Agent': 'REVOTEC-DESKTOP-SERVER'
          }
        });
        
        if (response.data.updates && response.data.updates.length > 0) {
          console.log(`📥 [SYNC] Processing ${response.data.updates.length} pending stock updates...`);
          
          let processed = 0;
          const processedIds = [];
          
          for (const update of response.data.updates) {
            try {
              // Apply stock update to local database
              await new Promise((resolve, reject) => {
                db.run(`
                  UPDATE products 
                  SET price = ?, quantity = COALESCE(quantity + ?, quantity), updated_at = datetime('now')
                  WHERE barcode = ? OR name = ?
                `, [update.sellingPrice, update.quantityChange || 0, update.barcode, update.name], function(err) {
                  if (err) reject(err);
                  else resolve();
                });
              });
              
              processed++;
              if (update.queueId) {
                processedIds.push(update.queueId);
              }
              console.log(`✅ [SYNC] Updated ${update.name || update.barcode} - Price: $${update.sellingPrice}`);
              
            } catch (updateError) {
              console.log(`❌ [SYNC] Failed to update ${update.name}:`, updateError.message);
            }
          }
          
          // Acknowledge processed updates to cloud with specific IDs
          if (processed > 0) {
            await axios.post(`${CLOUD_SERVER}/sync/acknowledge-updates`, {
              processedCount: processed,
              processedIds: processedIds,
              timestamp: new Date().toISOString()
            }, {
              timeout: 5000,
              headers: { 'Content-Type': 'application/json' }
            });
            
            console.log(`✅ [SYNC] Acknowledged ${processed} processed updates to cloud`);
          }
        }
        
      } catch (error) {
        // Silently handle - cloud might be unreachable
        if (error.code !== 'ECONNREFUSED' && error.code !== 'ENOTFOUND') {
          console.log(`⚠️ [SYNC] Error checking pending updates:`, error.message);
        }
      }
    };
    
    // Start periodic sync to cloud server
    console.log('🔄 [SYNC] Starting periodic cloud sync...');
    
    // Initial sync after 10 seconds
    setTimeout(() => {
      syncInventoryToCloud();
    }, 10000);
    
    // Regular inventory sync every 60 seconds
    setInterval(() => {
      syncInventoryToCloud();
    }, SYNC_INTERVAL);
    
    // Check for pending updates every 30 seconds
    setInterval(() => {
      checkPendingUpdates();
    }, QUEUE_CHECK_INTERVAL);
    
    console.log(`⚡ [SYNC] Cloud sync initialized - Inventory push: ${SYNC_INTERVAL/1000}s, Queue check: ${QUEUE_CHECK_INTERVAL/1000}s`);
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Please kill the process or use a different port.`);
    }
  });
};

// Start the server
startServer();

// Keep the process alive
process.stdin.resume();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // For uncaught exceptions, we should probably exit
  process.exit(1);
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  db.close(() => {
    console.log('Database closed.');
    process.exit(0);
  });
});