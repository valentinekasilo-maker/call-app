import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let popupWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentIncomingCallPayload: any = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 780,
    minWidth: 420,
    minHeight: 650,
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    title: 'CallApp Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  return mainWindow;
}

function createIncomingCallPopup(payload: any): BrowserWindow {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }

  currentIncomingCallPayload = payload;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  const width = 380;
  const height = 180;
  const x = workArea.x + workArea.width - width - 24;
  const y = workArea.y + workArea.height - height - 24;

  popupWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  popupWindow.once('ready-to-show', () => {
    popupWindow?.show();
    popupWindow?.focus();
  });

  const url = VITE_DEV_SERVER_URL ? `${VITE_DEV_SERVER_URL}#popup` : `file://${path.join(__dirname, '../dist/index.html')}#popup`;
  popupWindow.loadURL(url);

  return popupWindow;
}

function createTray() {
  // Simple transparent 16x16 icon data uri for tray
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open CallApp',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit CallApp',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('CallApp - Internet Voice Calling');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// IPC Handlers
ipcMain.on('show-incoming-popup', (_event, payload) => {
  createIncomingCallPopup(payload);
  mainWindow?.flashFrame(true);

  if (Notification.isSupported()) {
    try {
      const notification = new Notification({
        title: `📞 Incoming Call: ${payload.callerName || 'Unknown'}`,
        body: `${payload.callerAppId || ''} is calling...`,
      });
      notification.on('click', () => {
        mainWindow?.show();
        mainWindow?.focus();
      });
      notification.show();
    } catch (e) {}
  }
});

ipcMain.on('close-incoming-popup', () => {
  mainWindow?.flashFrame(false);
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
    popupWindow = null;
  }
  currentIncomingCallPayload = null;
});

ipcMain.on('get-popup-data', (event) => {
  event.returnValue = currentIncomingCallPayload;
});

ipcMain.on('popup-accept-call', (_event, payload) => {
  mainWindow?.flashFrame(false);
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
    popupWindow = null;
  }
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('popup-action-triggered', { action: 'accept', payload });
  }
});

ipcMain.on('popup-reject-call', (_event, payload) => {
  mainWindow?.flashFrame(false);
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
    popupWindow = null;
  }
  if (mainWindow) {
    mainWindow.webContents.send('popup-action-triggered', { action: 'reject', payload });
  }
});

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
