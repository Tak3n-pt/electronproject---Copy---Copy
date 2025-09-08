// API utilities for the desktop app
import apiConfig from './apiConfig';

// Enhanced fetch with timeout and error handling
export const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    throw error;
  }
};

// Helper function to construct proper image URLs
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Check if it's already a full URL (GCS URL or other external URL)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Handle relative paths by constructing URL relative to desktop server
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${apiConfig.getBaseUrl()}${cleanPath}`;
};

// Dynamic API endpoints that update with server discovery
export const API_ENDPOINTS = new Proxy({}, {
  get: (target, prop) => {
    const endpoints = apiConfig.getEndpoints();
    return endpoints[prop] || (() => {
      // Handle dynamic endpoints like PRODUCT_BY_BARCODE
      const base = apiConfig.getBaseUrl();
      switch (prop) {
        case 'STOCK_ADD':
          return `${base}/stock/add`;
        case 'STOCK_SELL':
          return `${base}/stock/sell`;
        case 'SEARCH_IMAGES':
          return `${base}/products/search-images`;
        case 'DOWNLOAD_IMAGE':
          return `${base}/products/download-image`;
        case 'RECENT_SCANS':
          return `${base}/api/recent-scans`;
        case 'INVOICES_RECENT':
          return `${base}/invoices/recent`;
        case 'PRODUCT_BY_BARCODE':
          return (barcode) => `${base}/api/product-by-barcode/${barcode}`;
        case 'INVENTORY_STATS':
          return `${base}/inventory/stats`;
        default:
          return `${base}/${prop.toLowerCase()}`;
      }
    })();
  }
});

// Common API operations
export const apiOperations = {
  // Get all products
  getProducts: async () => {
    const response = await fetchWithTimeout(API_ENDPOINTS.PRODUCTS);
    const data = await response.json();
    return data.products || [];
  },

  // Add new product
  addProduct: async (productData) => {
    const response = await fetchWithTimeout(API_ENDPOINTS.STOCK_ADD, {
      method: 'POST',
      body: JSON.stringify(productData)
    });
    return response.json();
  },

  // Update product
  updateProduct: async (productId, productData) => {
    const response = await fetchWithTimeout(`${API_ENDPOINTS.PRODUCTS}/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
    return response.json();
  },

  // Delete product
  deleteProduct: async (productId, hardDelete = true) => {
    const response = await fetchWithTimeout(`${API_ENDPOINTS.PRODUCTS}/${productId}`, {
      method: 'DELETE',
      body: JSON.stringify({ hardDelete, reason: 'User delete' })
    });
    return response.json();
  },

  // Search product images
  searchImages: async (productName, numResults = 15) => {
    const response = await fetchWithTimeout(API_ENDPOINTS.SEARCH_IMAGES, {
      method: 'POST',
      body: JSON.stringify({ productName, numResults })
    });
    return response.json();
  },

  // Download and set product image
  downloadImage: async (imageUrl, productId) => {
    const response = await fetchWithTimeout(API_ENDPOINTS.DOWNLOAD_IMAGE, {
      method: 'POST',
      body: JSON.stringify({ imageUrl, productId })
    });
    return response.json();
  },

  // Get product by barcode
  getProductByBarcode: async (barcode) => {
    const response = await fetchWithTimeout(API_ENDPOINTS.PRODUCT_BY_BARCODE(barcode));
    return response.json();
  },

  // Sell product
  sellProduct: async (barcode, quantity = 1) => {
    const response = await fetchWithTimeout(API_ENDPOINTS.STOCK_SELL, {
      method: 'POST',
      body: JSON.stringify({ barcode, qty: quantity })
    });
    return response.json();
  },

  // Get recent invoices
  getRecentInvoices: async (limit = 10) => {
    const response = await fetchWithTimeout(`${API_ENDPOINTS.INVOICES_RECENT}?limit=${limit}`);
    return response.json();
  },

  // Get inventory stats
  getInventoryStats: async () => {
    const response = await fetchWithTimeout(API_ENDPOINTS.INVENTORY_STATS);
    return response.json();
  },

  // Health check
  healthCheck: async () => {
    const response = await fetchWithTimeout(API_ENDPOINTS.HEALTH);
    return response.json();
  },

  // Get sales data
  getSales: async (period = 'all') => {
    try {
      const base = apiConfig.getBaseUrl();
      const response = await fetchWithTimeout(`${base}/sales/recent?period=${period}`);
      return response.json();
    } catch (error) {
      console.error('Error fetching sales:', error);
      return { success: false, message: error.message, sales: [] };
    }
  },

  // Get recent scans with comprehensive invoice details
  getRecentScans: async (limit = 20) => {
    try {
      // Use enhanced endpoint with full details including items and images
      const response = await fetchWithTimeout(`${API_ENDPOINTS.INVOICES_RECENT}?limit=${limit}&includeDetails=true`);
      const data = await response.json();
      
      // Map invoices to scans format with comprehensive invoice info
      if (data.invoices && Array.isArray(data.invoices)) {
        data.scans = data.invoices.map(invoice => {
          // Process images array properly
          let images = [];
          if (invoice.images && Array.isArray(invoice.images)) {
            images = invoice.images.map(img => ({
              url: getImageUrl(img.image_url || img.image_path || img.path),
              path: img.image_path || img.path,
              page: img.page_number || img.page || 1,
              type: img.image_type || img.type || 'main'
            }));
          }

          return {
            ...invoice,
            // Keep original image properties for compatibility
            invoice_image_url: invoice.invoice_image_url ? getImageUrl(invoice.invoice_image_url) : null,
            invoice_image_path: invoice.invoice_image_path ? getImageUrl(invoice.invoice_image_path) : null,
            invoiceImageUrl: invoice.invoice_image_url || invoice.invoice_image_path ? 
              getImageUrl(invoice.invoice_image_url || invoice.invoice_image_path) : null,
            invoiceImagePath: invoice.invoice_image_path ? getImageUrl(invoice.invoice_image_path) : null,
            // Add processed images array
            images: images,
            image_count: images.length || (invoice.invoice_image_url || invoice.invoice_image_path ? 1 : 0),
            // Ensure items are available
            items: invoice.items || [],
            total_items: invoice.total_items || (invoice.items ? invoice.items.length : 0)
          };
        });
      } else if (data.scans && Array.isArray(data.scans)) {
        data.scans = data.scans.map(scan => ({
          ...scan,
          invoiceImageUrl: scan.invoiceImagePath ? getImageUrl(scan.invoiceImagePath) : null,
          items: scan.items || [],
          image_count: scan.images?.length || 1
        }));
      } else {
        data.scans = [];
      }
      
      console.log('📊 Enhanced recent scans loaded:', {
        total: data.scans?.length || 0,
        withImages: data.scans?.filter(s => s.images?.length > 0 || s.invoiceImageUrl).length || 0,
        withItems: data.scans?.filter(s => s.items?.length > 0).length || 0
      });
      
      return data;
    } catch (error) {
      console.error('Error fetching recent scans:', error);
      return { success: false, message: error.message, scans: [] };
    }
  }
};

// Error handling utilities
export const handleApiError = (error, customMessage = null) => {
  console.error('API Error:', error);
  
  if (error.message.includes('timed out')) {
    return 'Connection timeout. Please check your internet connection.';
  }
  
  if (error.message.includes('HTTP 404')) {
    return 'Resource not found. Please try again.';
  }
  
  if (error.message.includes('HTTP 500')) {
    return 'Server error. Please try again later.';
  }
  
  if (error.message.includes('Failed to fetch')) {
    return 'Unable to connect to server. Please check if the server is running.';
  }
  
  return customMessage || error.message || 'An unexpected error occurred.';
};

// Export the API configuration instance for direct access if needed
export { apiConfig };

export default {
  fetchWithTimeout,
  getImageUrl,
  API_ENDPOINTS,
  apiOperations,
  handleApiError,
  apiConfig
};