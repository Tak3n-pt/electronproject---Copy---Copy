// File: electron/main.js
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const db = require("./database");

require('./server');

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "CoreLink Desktop",
    frame: false, // Remove default title bar
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    // Try port 5173 first, then 5174 if that fails
    win.loadURL("http://localhost:5173").catch(() => {
      win.loadURL("http://localhost:5174");
    });

    // Automatically open DevTools in development
    win.webContents.openDevTools({ mode: 'detach' });

    // Optional: Add context menu to manually open DevTools
    win.webContents.on("context-menu", () => {
      const menu = Menu.buildFromTemplate([
        {
          label: "Inspect Element",
          click: () => {
            win.webContents.openDevTools({ mode: "detach" });
          },
        },
      ]);
      menu.popup();
    });
  } else {
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

// Window control handlers
ipcMain.handle("window-close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

ipcMain.handle("window-minimize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.handle("window-maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

// Product handlers
ipcMain.handle("add-product", async (_event, product) => {
  try {
    const result = await db.addProduct(product);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error adding product:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-products", async () => {
  try {
    const products = await db.getProducts();
    return products;
  } catch (error) {
    console.error("Error getting products:", error);
    return [];
  }
});

ipcMain.handle("get-all-products", async () => {
  try {
    const products = await db.getProducts();
    return products;
  } catch (error) {
    console.error("Error getting all products:", error);
    return [];
  }
});

ipcMain.handle("delete-product", async (_event, productId, options) => {
  try {
    const result = await db.deleteProduct(productId, options);
    return result;
  } catch (error) {
    console.error("Error deleting product:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-product", async (_event, productId, updates) => {
  try {
    // First get the existing product
    const products = await db.getProducts();
    const existingProduct = products.find(p => p.id === productId);
    
    if (!existingProduct) {
      throw new Error("Product not found");
    }
    
    const result = await db.updateProduct(existingProduct, updates);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error updating product:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("search-products", async (_event, query) => {
  try {
    const products = await db.searchProducts(query);
    return products;
  } catch (error) {
    console.error("Error searching products:", error);
    return [];
  }
});

ipcMain.handle("get-low-stock-products", async () => {
  try {
    const products = await db.getLowStockProducts();
    return products;
  } catch (error) {
    console.error("Error getting low stock products:", error);
    return [];
  }
});

// Scan/Invoice handlers
ipcMain.handle("get-recent-scans", async () => {
  // Return mock data for now since we don't have scan functionality yet
  return [];
});

// Vendor handlers
ipcMain.handle("get-or-create-vendor", async (_event, vendorName) => {
  try {
    const vendor = await db.getOrCreateVendor(vendorName);
    return vendor;
  } catch (error) {
    console.error("Error with vendor:", error);
    return null;
  }
});

// Category handlers
ipcMain.handle("get-or-create-category", async (_event, categoryName) => {
  try {
    const category = await db.getOrCreateCategory(categoryName);
    return category;
  } catch (error) {
    console.error("Error with category:", error);
    return null;
  }
});

// Window handlers
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    db.closeDatabase();
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});