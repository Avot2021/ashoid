// ═══════════════════════════════════════════════════════════════════
// ASHOID — electron.cjs
// Menu Aide avec liens Railway + Render
// Correction synchronisation Render
// ═══════════════════════════════════════════════════════════════════
const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const path   = require("path");
const fs     = require("fs");
const https  = require("https");
const http   = require("http");

// ── URLs des serveurs ───────────────────────────────────────────────
const SERVER_RAILWAY = "https://ashoid-production.up.railway.app";
const SERVER_RENDER  = "https://ashoid.onrender.com";

// ── Chemins des données locales ─────────────────────────────────────
const DATA_DIR    = path.join(app.getPath("userData"), "ashoid_data");
const DATA_FILE   = path.join(DATA_DIR, "data.json");
const BACKUP_DIR  = path.join(DATA_DIR, "backups");

if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR,   { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ── Fenêtre principale ──────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, "public", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "default",
    title: "ASHOID — Gestion Associative",
  });

  // Charger l'app
  const indexPath = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }

  buildMenu();
}

// ── Construction du menu ────────────────────────────────────────────
function buildMenu() {
  const template = [
    // ── Fichier ──────────────────────────────────────────────────
    {
      label: "Fichier",
      submenu: [
        {
          label: "💾 Sauvegarder maintenant",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow.webContents.send("menu-backup"),
        },
        {
          label: "📂 Restaurer une sauvegarde",
          click: () => mainWindow.webContents.send("menu-restore"),
        },
        { type: "separator" },
        {
          label: "Quitter",
          accelerator: "Alt+F4",
          role: "quit",
        },
      ],
    },

    // ── Affichage ─────────────────────────────────────────────────
    {
      label: "Affichage",
      submenu: [
        { role: "reload", label: "Actualiser" },
        { role: "toggleDevTools", label: "Outils développeur" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom normal" },
        { role: "zoomIn",    label: "Zoom +" },
        { role: "zoomOut",   label: "Zoom -" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
      ],
    },

    // ── Synchronisation ───────────────────────────────────────────
    {
      label: "Synchronisation",
      submenu: [
        {
          label: "🔄 Synchroniser maintenant",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow.webContents.send("menu-sync"),
        },
        { type: "separator" },
        {
          label: "🚂 Railway → ☁️ Render",
          click: () => mainWindow.webContents.send("menu-sync-railway-to-render"),
        },
        {
          label: "☁️ Render → 🚂 Railway",
          click: () => mainWindow.webContents.send("menu-sync-render-to-railway"),
        },
        { type: "separator" },
        {
          label: "📊 Statut des serveurs",
          click: () => mainWindow.webContents.send("menu-sync-status"),
        },
      ],
    },

    // ── Aide ──────────────────────────────────────────────────────
    {
      label: "Aide",
      submenu: [
        // ── Ouvrir les serveurs directement ──────────────────────
        {
          label: "🚂 Ouvrir Railway (serveur principal)",
          click: () => shell.openExternal(SERVER_RAILWAY),
        },
        {
          label: "☁️ Ouvrir Render (serveur miroir)",
          click: () => shell.openExternal(SERVER_RENDER),
        },
        { type: "separator" },
        // ── Tester les serveurs ───────────────────────────────────
        {
          label: "🔍 Tester Railway",
          click: async () => {
            const ok = await testerServeur(SERVER_RAILWAY);
            dialog.showMessageBox(mainWindow, {
              type: ok ? "info" : "error",
              title: "Railway",
              message: ok
                ? "✅ Railway est en ligne !\n" + SERVER_RAILWAY
                : "❌ Railway inaccessible\n" + SERVER_RAILWAY,
              buttons: ["OK", "Ouvrir dans le navigateur"],
            }).then(({ response }) => {
              if (response === 1) shell.openExternal(SERVER_RAILWAY);
            });
          },
        },
        {
          label: "🔍 Tester Render",
          click: async () => {
            const ok = await testerServeur(SERVER_RENDER);
            dialog.showMessageBox(mainWindow, {
              type: ok ? "info" : "error",
              title: "Render",
              message: ok
                ? "✅ Render est en ligne !\n" + SERVER_RENDER
                : "❌ Render inaccessible\n" + SERVER_RENDER,
              buttons: ["OK", "Ouvrir dans le navigateur"],
            }).then(({ response }) => {
              if (response === 1) shell.openExternal(SERVER_RENDER);
            });
          },
        },
        { type: "separator" },
        // ── Liens utiles ──────────────────────────────────────────
        {
          label: "📊 Dashboard Railway",
          click: () => shell.openExternal("https://railway.app/dashboard"),
        },
        {
          label: "📊 Dashboard Render",
          click: () => shell.openExternal("https://dashboard.render.com"),
        },
        {
          label: "🐙 Code source GitHub",
          click: () => shell.openExternal("https://github.com/Avot2021/ashoid"),
        },
        { type: "separator" },
        // ── Infos ─────────────────────────────────────────────────
        {
          label: "ℹ️ À propos d'ASHOID",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "À propos d'ASHOID",
              message: "ASHOID — Gestion Associative",
              detail: [
                "Version : 14.0.0",
                "",
                "Serveur principal (Railway) :",
                SERVER_RAILWAY,
                "",
                "Serveur miroir (Render) :",
                SERVER_RENDER,
                "",
                "Synchronisation automatique toutes les 30 secondes.",
              ].join("\n"),
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Tester un serveur ────────────────────────────────────────────────
function testerServeur(baseUrl) {
  return new Promise((resolve) => {
    const url = `${baseUrl}/api/health`;
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 8000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

// ── Fetch universel (Node.js, sans CORS) ────────────────────────────
function fetchNode(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const { method = "GET", body, timeout = 10000 } = options;

    const urlObj   = new URL(url);
    const reqOpts  = {
      hostname : urlObj.hostname,
      port     : urlObj.port || (url.startsWith("https") ? 443 : 80),
      path     : urlObj.pathname + urlObj.search,
      method,
      headers  : {
        "Content-Type": "application/json",
        "User-Agent"  : "ASHOID-Electron/14.0",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
      timeout,
    };

    const req = lib.request(reqOpts, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => JSON.parse(data) }); }
        catch { resolve({ ok: false, status: res.statusCode, json: () => ({}) }); }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    if (body) req.write(body);
    req.end();
  });
}

// ── IPC : Lire les données ──────────────────────────────────────────
ipcMain.handle("read-data", async () => {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    return fs.readFileSync(DATA_FILE, "utf8");
  } catch (e) { return null; }
});

// ── IPC : Écrire les données ────────────────────────────────────────
ipcMain.handle("write-data", async (_, jsonStr) => {
  try {
    fs.writeFileSync(DATA_FILE, jsonStr, "utf8");
    // Backup horaire
    const now  = new Date();
    const bak  = path.join(BACKUP_DIR, `backup_${now.toISOString().slice(0,10)}_h${String(now.getHours()).padStart(2,"0")}.json`);
    if (!fs.existsSync(bak)) {
      fs.writeFileSync(bak, jsonStr, "utf8");
      // Garder 48 backups max
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("backup_")).sort().reverse();
      files.slice(48).forEach(f => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {} });
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── IPC : Charger depuis Railway (principal) ────────────────────────
ipcMain.handle("render-load", async () => {
  // 1. Essayer Railway
  try {
    const r = await fetchNode(`${SERVER_RAILWAY}/api/data`, { timeout: 8000 });
    if (r.ok) {
      const j = r.json();
      if (j.ok && j.data) return { ok: true, data: j.data, source: "railway" };
    }
  } catch (e) { console.warn("[ASHOID] Railway load failed:", e.message); }

  // 2. Fallback Render
  try {
    const r = await fetchNode(`${SERVER_RENDER}/api/data`, { timeout: 12000 });
    if (r.ok) {
      const j = r.json();
      if (j.ok && j.data) return { ok: true, data: j.data, source: "render" };
    }
  } catch (e) { console.warn("[ASHOID] Render load failed:", e.message); }

  return { ok: false };
});

// ── IPC : Sauvegarder vers Railway + Render ─────────────────────────
ipcMain.handle("render-save", async (_, data) => {
  const body = JSON.stringify(data);
  const resultats = { railway: false, render: false };

  // Railway
  try {
    const r = await fetchNode(`${SERVER_RAILWAY}/api/data`, { method: "POST", body, timeout: 8000 });
    resultats.railway = r.ok;
    console.log("[ASHOID] Railway save:", r.ok ? "OK" : "FAILED");
  } catch (e) { console.warn("[ASHOID] Railway save error:", e.message); }

  // Render — timeout plus long car peut être en veille
  try {
    const r = await fetchNode(`${SERVER_RENDER}/api/data`, { method: "POST", body, timeout: 15000 });
    resultats.render = r.ok;
    console.log("[ASHOID] Render save:", r.ok ? "OK" : "FAILED");
  } catch (e) { console.warn("[ASHOID] Render save error:", e.message); }

  return { ok: resultats.railway || resultats.render, ...resultats };
});

// ── IPC : Sync Railway → Render ──────────────────────────────────────
ipcMain.handle("sync-railway-to-render", async () => {
  try {
    // Lire depuis Railway
    const r1 = await fetchNode(`${SERVER_RAILWAY}/api/data`, { timeout: 8000 });
    if (!r1.ok) return { ok: false, error: "Railway inaccessible" };
    const j1 = r1.json();
    if (!j1.data) return { ok: false, error: "Pas de données sur Railway" };

    // Écrire vers Render
    const body = JSON.stringify(j1.data);
    const r2 = await fetchNode(`${SERVER_RENDER}/api/data`, { method: "POST", body, timeout: 15000 });
    console.log("[ASHOID] Railway→Render:", r2.ok ? "OK" : "FAILED");
    return { ok: r2.ok };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── IPC : Sync Render → Railway ──────────────────────────────────────
ipcMain.handle("sync-render-to-railway", async () => {
  try {
    const r1 = await fetchNode(`${SERVER_RENDER}/api/data`, { timeout: 12000 });
    if (!r1.ok) return { ok: false, error: "Render inaccessible" };
    const j1 = r1.json();
    if (!j1.data) return { ok: false, error: "Pas de données sur Render" };

    const body = JSON.stringify(j1.data);
    const r2 = await fetchNode(`${SERVER_RAILWAY}/api/data`, { method: "POST", body, timeout: 8000 });
    console.log("[ASHOID] Render→Railway:", r2.ok ? "OK" : "FAILED");
    return { ok: r2.ok };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── IPC : Statut des deux serveurs ──────────────────────────────────
ipcMain.handle("sync-status", async () => {
  const [r1, r2] = await Promise.allSettled([
    testerServeur(SERVER_RAILWAY),
    testerServeur(SERVER_RENDER),
  ]);
  return {
    railway: r1.status === "fulfilled" && r1.value,
    render:  r2.status === "fulfilled" && r2.value,
  };
});

// ── IPC : Lister les sauvegardes locales ────────────────────────────
ipcMain.handle("list-backups", async () => {
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup_") && f.endsWith(".json"))
      .sort().reverse().slice(0, 48)
      .map(f => {
        const fp    = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(fp);
        const match = f.match(/backup_(\d{4}-\d{2}-\d{2})_h(\d{2})\.json/);
        return {
          nom  : f,
          path : fp,
          date : match ? `${match[1]}T${match[2]}:00:00.000Z` : stats.mtime.toISOString(),
          size : stats.size,
          source: "local",
        };
      });
  } catch { return []; }
});

// ── IPC : Restaurer une sauvegarde locale ───────────────────────────
ipcMain.handle("restore-backup", async (_, filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch { return null; }
});

// ── IPC : Restaurer depuis un fichier choisi ─────────────────────────
ipcMain.handle("restore-data", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Choisir une sauvegarde JSON",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths.length) return null;
  try { return fs.readFileSync(filePaths[0], "utf8"); } catch { return null; }
});

// ── IPC : Sauvegarder vers un fichier ───────────────────────────────
ipcMain.handle("backup-data", async (_, jsonStr) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Sauvegarder les données ASHOID",
    defaultPath: `ashoid_backup_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { ok: false };
  try { fs.writeFileSync(filePath, jsonStr, "utf8"); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

// ── Démarrage ────────────────────────────────────────────────────────
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
