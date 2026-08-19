const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

// Production Vercel URL — override with APP_URL env var for local dev
const APP_URL = process.env.APP_URL || 'https://automator-subuser.vercel.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 375,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'GHL Automator',
    // Window icon (optional: add icon files to resources/)
    // icon: path.join(__dirname, 'resources', 'icon.png'),
  });

  // Open all external links in system browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://marketplace.gohighlevel.com') ||
        url.startsWith('https://accounts.google.com')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // Load the app
  win.loadURL(APP_URL);

  // Open DevTools in dev mode
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  return win;
}

// macOS: keep app running after all windows closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  // Remove default menu for a cleaner look (optional)
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }
  createWindow();
});
