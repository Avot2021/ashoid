/**
 * ASHOID — Preload script
 * Expose les APIs Electron au renderer de manière sécurisée (contextBridge)
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Lecture des données depuis le fichier local
  readData:    ()     => ipcRenderer.invoke('data:read'),
  // Écriture des données dans le fichier local
  writeData:   (json) => ipcRenderer.invoke('data:write', json),
  // Sauvegarde manuelle (boîte de dialogue)
  backupData:  ()     => ipcRenderer.invoke('data:backup'),
  // Restauration depuis un fichier
  restoreData: ()     => ipcRenderer.invoke('data:restore'),
  // Écoute des commandes du menu
  onMenuBackup:  (cb) => ipcRenderer.on('menu:backup',  cb),
  onMenuRestore: (cb) => ipcRenderer.on('menu:restore', cb),
  // Détecter si on est dans Electron
  isElectron: true
})
