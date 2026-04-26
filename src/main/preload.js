const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getLocalIPs: () => ipcRenderer.invoke('get-local-ips'),
  getPort: () => ipcRenderer.invoke('get-port'),
  getHostname: () => ipcRenderer.invoke('get-hostname'),
  getShareDir: () => ipcRenderer.invoke('get-share-dir'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  pickFiles: (dirPath) => ipcRenderer.invoke('pick-files', { dirPath }),
  changeShareFolder: (p) => ipcRenderer.invoke('change-share-folder', p),
  openShareDir: () => ipcRenderer.invoke('open-share-dir'),
  openBrowser: (url) => ipcRenderer.invoke('open-browser', url),
  openFile: (fileName) => ipcRenderer.invoke('open-file', { fileName }),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', () => cb()),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  onFilesChanged: (cb) => ipcRenderer.on('files-changed', (_, data) => cb(data)),
  removeFilesChanged: () => ipcRenderer.removeAllListeners('files-changed')
});
