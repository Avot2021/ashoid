const { app, BrowserWindow, Menu, shell, dialog, ipcMain, net } = require('electron')
const path = require('path')
const fs   = require('fs')
const isDev   = process.env.ELECTRON_DEV === 'true'
const DEV_URL = 'http://localhost:5173'
const SERVER  = 'https://ashoid-production.up.railway.app'
const DATA_DIR  = app.getPath('userData')
const DATA_FILE = path.join(DATA_DIR, 'ashoid_data.json')
function fetchRender(method, body) {
  return new Promise((resolve, reject) => {
    const req = net.request({ method, url: `${SERVER}/api/data`, headers: { 'Content-Type': 'application/json' } })
    let data = ''
    req.on('response', res => { res.on('data', chunk => { data += chunk }); res.on('end', () => { try { resolve({ ok: res.statusCode === 200, body: JSON.parse(data) }) } catch { resolve({ ok: false, body: null }) } }) })
    req.on('error', err => reject(err))
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}
ipcMain.handle('data:read', () => { try { if (fs.existsSync(DATA_FILE)) return fs.readFileSync(DATA_FILE, 'utf8') } catch {} return null })
ipcMain.handle('data:write', (_e, json) => { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DATA_FILE, json, 'utf8'); return true } catch { return false } })
ipcMain.handle('render:load', async () => { try { const r = await fetchRender('GET'); if (r.ok && r.body?.ok && r.body?.data) { try { fs.writeFileSync(DATA_FILE, JSON.stringify(r.body.data), 'utf8') } catch {}; return { ok: true, data: r.body.data } } return { ok: false } } catch(e) { return { ok: false, error: e.message } } })
ipcMain.handle('render:save', async (_e, data) => { try { const r = await fetchRender('POST', data); return { ok: r.ok } } catch(e) { return { ok: false, error: e.message } } })
ipcMain.handle('data:backup', () => { const { filePath } = dialog.showSaveDialogSync({ title: 'Sauvegarder ASHOID', defaultPath: `ashoid_backup_${new Date().toISOString().slice(0,10)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] }) || {}; if (!filePath) return false; try { if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, filePath); return true } catch { return false } })
ipcMain.handle('data:restore', () => { const { filePaths } = dialog.showOpenDialogSync({ title: 'Restaurer ASHOID', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] }) || {}; if (!filePaths?.[0]) return null; try { return fs.readFileSync(filePaths[0], 'utf8') } catch { return null } })
ipcMain.handle('data:listBackups', () => { try { return fs.readdirSync(DATA_DIR).filter(f => f.startsWith('backup_') && f.endsWith('.json')).sort().reverse().slice(0,48).map(f => ({ name: f, path: path.join(DATA_DIR, f), date: fs.statSync(path.join(DATA_DIR, f)).mtime.toISOString(), size: fs.statSync(path.join(DATA_DIR, f)).size })) } catch { return [] } })
ipcMain.handle('data:restoreBackup', (_e, p) => { try { if (!fs.existsSync(p)) return null; return fs.readFileSync(p, 'utf8') } catch { return null } })
function createWindow() {
  const win = new BrowserWindow({ width: 1320, height: 860, minWidth: 900, minHeight: 600, title: 'ASHOID', show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, webSecurity: false } })
  const menu = Menu.buildFromTemplate([{ label: 'Fichier', submenu: [{ label: 'Sauvegarder', click: () => win.webContents.send('menu:backup') }, { label: 'Restaurer', click: () => win.webContents.send('menu:restore') }, { type: 'separator' }, { label: 'Synchroniser', click: () => win.webContents.send('menu:sync') }, { type: 'separator' }, { label: 'Quitter', role: 'quit' }] }, { label: 'Affichage', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { label: 'Console', click: () => win.webContents.openDevTools() }] }, { label: 'Aide', submenu: [{ label: 'Site en ligne', click: () => shell.openExternal('https://ashoid-production.up.railway.app') }] }])
  Menu.setApplicationMenu(menu)
  if (isDev) { win.loadURL(DEV_URL); win.webContents.openDevTools() } else { win.loadFile(path.join(__dirname, 'dist', 'index.html')) }
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => app.quit())
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
