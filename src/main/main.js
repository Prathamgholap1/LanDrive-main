const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { startServer, stopServer, getShareDir, changeShareDir } = require('./server');

let mainWindow;
let tray;
let serverPort = 7070;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    backgroundColor: '#0f0f11',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../../public/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../public/icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error('empty');
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open LANDrive', click: () => mainWindow && mainWindow.show() },
    { label: 'Open in Browser', click: () => shell.openExternal(`http://localhost:${serverPort}`) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('LANDrive');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow && mainWindow.show());
}

app.whenReady().then(async () => {
  createWindow();
  createTray();

  const defaultShareDir = path.join(os.homedir(), 'LANDrive');
  if (!fs.existsSync(defaultShareDir)) fs.mkdirSync(defaultShareDir, { recursive: true });

  try {
    await startServer(serverPort, defaultShareDir, mainWindow);
  } catch (err) {
    console.error('Server start error:', err);
  }

  // Set up auto-updater
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.log('Update check failed:', err);
  }

  // Update event listeners
  autoUpdater.on('update-available', () => {
    console.log('Update available');
    mainWindow.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded, will install on restart');
    mainWindow.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.log('Update error:', err);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});

// IPC Handlers
ipcMain.handle('get-local-ips', () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ips.push({
          ip: addr.address,
          name: name
        });
      }
    }
  }
  // Remove duplicates
  const seen = new Set();
  return ips.filter(item => {
    if (seen.has(item.ip)) return false;
    seen.add(item.ip);
    return true;
  });
});

ipcMain.handle('get-port', () => serverPort);

ipcMain.handle('get-hostname', () => os.hostname());

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('change-share-folder', async (_, newPath) => {
  try {
    const { changeShareDir } = require('./server');
    await changeShareDir(newPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-share-dir', () => {
  const { getShareDir } = require('./server');
  return getShareDir();
});

ipcMain.handle('open-share-dir', () => {
  const { getShareDir } = require('./server');
  shell.openPath(getShareDir());
});

ipcMain.handle('pick-files', async (_, { dirPath }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return { canceled: true };
  
  try {
    console.log('Picked files:', result.filePaths);
    console.log('Dir path:', dirPath);
    
    // Directly link files without using fetch
    const shareDir = getShareDir();
    const linkedFilesPath = path.join(shareDir, '.linked-files.json');
    
    // Read existing linked files
    let linked = {};
    try {
      if (fs.existsSync(linkedFilesPath)) {
        linked = JSON.parse(fs.readFileSync(linkedFilesPath, 'utf8'));
      }
    } catch (e) {
      console.error('Error reading linked files:', e);
    }
    
    const validFiles = [];
    for (const filePath of result.filePaths) {
      try {
        if (!fs.existsSync(filePath)) {
          console.warn(`File not found: ${filePath}`);
          continue;
        }
        
        const fileName = path.basename(filePath);
        const linkKey = dirPath ? `${dirPath}/${fileName}` : fileName;
        linked[linkKey] = filePath;
        validFiles.push(fileName);
      } catch (e) {
        console.error(`Error linking ${filePath}:`, e);
      }
    }
    
    // Save linked files
    try {
      fs.writeFileSync(linkedFilesPath, JSON.stringify(linked, null, 2));
    } catch (e) {
      console.error('Error saving linked files:', e);
    }
    
    // Notify main window
    if (mainWindow) {
      mainWindow.webContents.send('files-changed', dirPath || '');
    }
    
    console.log('Linked files:', validFiles);
    return { canceled: false, uploaded: validFiles, count: validFiles.length };
  } catch (err) {
    console.error('Error linking files:', err);
    return { canceled: false, uploaded: [], count: 0, error: err.message };
  }
});

ipcMain.handle('window-minimize', () => mainWindow.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window-close', () => mainWindow.hide());
ipcMain.handle('open-browser', (_, url) => shell.openExternal(url));
ipcMain.handle('open-file', (_, { fileName }) => {
  const downloadsFolder = app.getPath('downloads');
  const filePath = path.join(downloadsFolder, fileName);
  shell.showItemInFolder(filePath);
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});
