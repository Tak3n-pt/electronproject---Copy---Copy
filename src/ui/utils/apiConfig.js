// ==================== DYNAMIC API CONFIGURATION ====================
// Centralized API configuration with automatic server discovery

class ApiConfig {
  constructor() {
    this.baseUrl = this.loadSavedUrl() || 'http://localhost:4000';
    this.invoiceServerUrl = 'https://invoice-processor-dot-my-invoice-server-2025.uc.r.appspot.com';
    this.isDiscovering = false;
    this.listeners = [];
  }

  // Load saved server URL from localStorage
  loadSavedUrl() {
    try {
      const saved = localStorage.getItem('desktop-server-url');
      if (saved) {
        console.log('📱 Using saved server URL:', saved);
        return saved;
      }
    } catch (error) {
      console.error('Failed to load saved URL:', error);
    }
    return null;
  }

  // Save server URL to localStorage
  saveUrl(url) {
    try {
      localStorage.setItem('desktop-server-url', url);
      console.log('💾 Saved server URL:', url);
    } catch (error) {
      console.error('Failed to save URL:', error);
    }
  }

  // Get current API base URL
  getBaseUrl() {
    return this.baseUrl;
  }

  // Get invoice processing server URL
  getInvoiceServerUrl() {
    return this.invoiceServerUrl;
  }

  // Set new base URL
  setBaseUrl(url) {
    this.baseUrl = url;
    this.saveUrl(url);
    this.notifyListeners(url);
    console.log('🔄 API base URL updated to:', url);
  }

  // Auto-discover server on the network
  async discoverServer() {
    if (this.isDiscovering) {
      console.log('⏳ Discovery already in progress...');
      return this.baseUrl;
    }

    this.isDiscovering = true;
    console.log('🔍 Starting server discovery...');

    try {
      // Try to communicate with Electron main process for discovery
      if (window.electronAPI && window.electronAPI.discoverServer) {
        const discoveredUrl = await window.electronAPI.discoverServer();
        if (discoveredUrl) {
          this.setBaseUrl(discoveredUrl);
          return discoveredUrl;
        }
      }

      // Fallback: Try common local addresses
      const addresses = [
        'http://localhost:4000',
        'http://127.0.0.1:4000',
        'http://192.168.1.2:4000',
        'http://192.168.1.3:4000',
        'http://192.168.1.4:4000',
        'http://192.168.1.5:4000',
        'http://192.168.0.2:4000',
        'http://192.168.0.3:4000',
        'http://192.168.0.4:4000',
        'http://192.168.0.5:4000',
      ];

      // Add current origin if different
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        addresses.unshift(`http://${window.location.hostname}:4000`);
      }

      for (const addr of addresses) {
        console.log(`Testing ${addr}...`);
        const isAlive = await this.testConnection(addr);
        if (isAlive) {
          console.log(`✅ Server found at ${addr}`);
          this.setBaseUrl(addr);
          return addr;
        }
      }

      console.warn('⚠️ No server found, using fallback');
      return this.baseUrl;

    } catch (error) {
      console.error('Discovery error:', error);
      return this.baseUrl;
    } finally {
      this.isDiscovering = false;
    }
  }

  // Test connection to a server
  async testConnection(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Add listener for URL changes
  addListener(callback) {
    this.listeners.push(callback);
  }

  // Remove listener
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  // Notify all listeners of URL change
  notifyListeners(newUrl) {
    this.listeners.forEach(listener => {
      try {
        listener(newUrl);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  // Create API endpoints based on current base URL
  getEndpoints() {
    const base = this.baseUrl;
    return {
      // Products
      PRODUCTS: `${base}/products`,
      PRODUCTS_SEARCH: `${base}/products/search`,
      PRODUCTS_BY_BARCODE: (barcode) => `${base}/products/barcode/${barcode}`,
      PRODUCT_BY_ID: (id) => `${base}/products/${id}`,
      PRODUCT_BARCODE: (id) => `${base}/products/${id}/barcode`,
      
      // Sales
      SALES: `${base}/sales`,
      SALES_RECENT: `${base}/sales/recent`,
      SALES_CREATE_TEST: `${base}/sales/create-test-data`,
      SALE_BY_ID: (id) => `${base}/sales/${id}`,
      
      // Invoices
      INVOICES_RECENT: `${base}/invoices/recent`,
      INVOICE_BY_ID: (id) => `${base}/invoices/${id}`,
      
      // Search
      SEARCH_PRODUCTS: `${base}/api/search-product`,
      
      // Health
      HEALTH: `${base}/health`,
      
      // Stats
      STATS: `${base}/stats`
    };
  }
}

// Create singleton instance
const apiConfig = new ApiConfig();

// Auto-discover on load
apiConfig.discoverServer().catch(console.error);

// Re-discover every 30 seconds if connection fails
setInterval(async () => {
  const isAlive = await apiConfig.testConnection(apiConfig.getBaseUrl());
  if (!isAlive) {
    console.log('⚠️ Server connection lost, rediscovering...');
    await apiConfig.discoverServer();
  }
}, 30000);

export default apiConfig;