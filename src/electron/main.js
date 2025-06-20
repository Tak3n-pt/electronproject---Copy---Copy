// File: electron/main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const db = require("./database");

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(app.getAppPath(), "dist-react/index.html"));
  }
}

app.whenReady().then(createWindow);

ipcMain.handle("add-product", async (_event, product) => {
  db.addProduct(product);
  return "OK";
});

ipcMain.handle("get-products", async () => {
  return new Promise((resolve) => {
    db.getProducts((rows) => resolve(rows));
  });
});
