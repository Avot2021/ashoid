const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('electronAPI', {
  readData: () => ipcRenderer.invoke('data:read'),
  writeData: (json) => ipcRenderer.invoke('data:write', json),
  backupData: () => ipcRenderer.invoke('data:backup'),
  restoreData: () => ipcRenderer.invoke('data:restore'),
  renderLoad: () => ipcRenderer.invoke('render:load'),
  renderSave: (data) => ipcRenderer.invoke('render:save', data),
  listBackups: () => ipcRenderer.invoke('data:listBackups'),
  restoreBackup: (p) => ipcRenderer.invoke('data:restoreBackup', p),
  onMenuBackup: (cb) => ipcRenderer.on('menu:backup', cb),
  onMenuRestore: (cb) => ipcRenderer.on('menu:restore', cb),
  onMenuSync: (cb) => ipcRenderer.on('menu:sync', cb),
  isElectron: true
})
