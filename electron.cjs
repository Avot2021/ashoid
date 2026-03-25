/**
 * ASHOID — Electron main process
 * Lance l'app comme une vraie application Windows (.exe)
 */

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron')
const path = require('path')
const fs   = require('fs')

const isDev  = process.env.ELECTRON_DEV === 'true'
const DEV_URL = 'http://localhost:5173'

// ── Chemin des données utilisateur (persist entre sessions) ──────────────────
const DATA_DIR  = app.getPath('userData')
const DATA_FILE = path.join(DATA_DIR, 'ashoid_data.json')

// ── IPC : lecture/écriture des données depuis le renderer ───────────────────
ipcMain.handle('data:read', () => {
  try {
    if (fs.existsSync(DATA_FILE)) return fs.readFileSync(DATA_FILE, 'utf8')
  } catch (e) { console.error('data:read error', e) }
  return null
})

ipcMain.handle('data:write', (_event, json) => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DATA_FILE, json, 'utf8')
    return true
  } catch (e) { console.error('data:write error', e); return false }
})

ipcMain.handle('data:backup', () => {
  const { filePath } = dialog.showSaveDialogSync({
    title: 'Sauvegarder les données ASHOID',
    defaultPath: `ashoid_backup_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  }) || {}
  if (!filePath) return false
  try {
    if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, filePath)
    return true
  } catch (e) { return false }
})

ipcMain.handle('data:restore', () => {
  const { filePaths } = dialog.showOpenDialogSync({
    title: 'Restaurer une sauvegarde ASHOID',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  }) || {}
  if (!filePaths || !filePaths[0]) return null
  try { return fs.readFileSync(filePaths[0], 'utf8') }
  catch (e) { return null }
})

// ── Création de la fenêtre principale ────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:  1320,
    height: 860,
    minWidth:  900,
    minHeight: 600,
    icon: path.join(__dirname, 'public', 'icon.png'),
    title: 'ASHOID — Gestion Associative',
    show: false,   // montre seulement quand prêt
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      webSecurity:      !isDev,
    }
  })

  // Menu simplifié
  const menu = Menu.buildFromTemplate([
    {
      label: 'Fichier',
      submenu: [
        { label: '💾 Sauvegarder les données', click: () => win.webContents.send('menu:backup') },
        { label: '📂 Restaurer une sauvegarde', click: () => win.webContents.send('menu:restore') },
        { type: 'separator' },
        { label: '❌ Quitter', role: 'quit' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: '🔄 Recharger' },
        { role: 'togglefullscreen', label: '⛶ Plein écran' },
        { type: 'separator' },
        { role: 'zoomin',  label: '🔍 Zoom +' },
        { role: 'zoomout', label: '🔍 Zoom -' },
        { role: 'resetzoom', label: 'Zoom normal' },
      ]
    },
    {
      label: 'Aide',
      submenu: [
        { label: '🌐 Site ASHOID', click: () => shell.openExternal('https://ashoid.onrender.com') },
        { label: 'ℹ️ Version', click: () => dialog.showMessageBox({ title: 'ASHOID', message: 'ASHOID v13\nGestion Associative\n© 2025' }) }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)

  // Chargement
  if (isDev) {
    win.loadURL(DEV_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => app.quit())
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
