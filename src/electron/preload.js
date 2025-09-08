// File: electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  // Window control methods
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("window-maximize"),
  
  // Product methods
  addProduct: (product) => ipcRenderer.invoke("add-product", product),
  getProducts: () => ipcRenderer.invoke("get-products"),
  getAllProducts: () => ipcRenderer.invoke("get-all-products"),
  deleteProduct: (productId, options) => ipcRenderer.invoke("delete-product", productId, options),
  updateProduct: (productId, updates) => ipcRenderer.invoke("update-product", productId, updates),
  searchProducts: (query) => ipcRenderer.invoke("search-products", query),
  getLowStockProducts: () => ipcRenderer.invoke("get-low-stock-products"),
  
  // Scan/Invoice methods
  getRecentScans: () => ipcRenderer.invoke("get-recent-scans"),
  
  // Vendor methods
  getOrCreateVendor: (vendorName) => ipcRenderer.invoke("get-or-create-vendor", vendorName),
  
  // Category methods
  getOrCreateCategory: (categoryName) => ipcRenderer.invoke("get-or-create-category", categoryName),
});

// Also expose as 'api' for backward compatibility
contextBridge.exposeInMainWorld("api", {
  addProduct: (product) => ipcRenderer.invoke("add-product", product),
  getProducts: () => ipcRenderer.invoke("get-products"),
});