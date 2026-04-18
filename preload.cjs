// ═══════════════════════════════════════════════════════════════════
// ASHOID — preload.cjs
// Pont sécurisé entre Electron (main) et React (renderer)
// ═══════════════════════════════════════════════════════════════════
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,

  // ── Données locales ─────────────────────────────────────────────
  readData:       ()      => ipcRenderer.invoke("read-data"),
  writeData:      (json)  => ipcRenderer.invoke("write-data", json),

  // ── Serveurs distants ───────────────────────────────────────────
  renderLoad:     ()      => ipcRenderer.invoke("render-load"),
  renderSave:     (data)  => ipcRenderer.invoke("render-save", data),

  // ── Synchronisation croisée ─────────────────────────────────────
  syncRailwayToRender: () => ipcRenderer.invoke("sync-railway-to-render"),
  syncRenderToRailway: () => ipcRenderer.invoke("sync-render-to-railway"),
  syncStatus:          () => ipcRenderer.invoke("sync-status"),

  // ── Sauvegardes ─────────────────────────────────────────────────
  listBackups:    ()      => ipcRenderer.invoke("list-backups"),
  restoreBackup:  (path)  => ipcRenderer.invoke("restore-backup", path),
  restoreData:    ()      => ipcRenderer.invoke("restore-data"),
  backupData:     (json)  => ipcRenderer.invoke("backup-data", json),

  // ── Événements du menu ──────────────────────────────────────────
  onMenuSync:               (cb) => ipcRenderer.on("menu-sync",                  () => cb()),
  onMenuBackup:             (cb) => ipcRenderer.on("menu-backup",                () => cb()),
  onMenuRestore:            (cb) => ipcRenderer.on("menu-restore",               () => cb()),
  onMenuSyncRailwayToRender:(cb) => ipcRenderer.on("menu-sync-railway-to-render",() => cb()),
  onMenuSyncRenderToRailway:(cb) => ipcRenderer.on("menu-sync-render-to-railway",() => cb()),
  onMenuSyncStatus:         (cb) => ipcRenderer.on("menu-sync-status",           () => cb()),
});
