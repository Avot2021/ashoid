// ═══════════════════════════════════════════════════════════════════
// ASHOID — server.js (Railway + Render)
// Stratégie : Railway = MASTER, Render = MIROIR automatique
// Render récupère les données de Railway au démarrage + toutes les 5min
// ═══════════════════════════════════════════════════════════════════
const express = require("express");
const path    = require("path");
const fs      = require("fs");
const https   = require("https");
const http    = require("http");

const app  = express();
const PORT = process.env.PORT || 3000;

const IS_RENDER  = !!process.env.RENDER;
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const ENV_NAME   = IS_RENDER ? "Render" : IS_RAILWAY ? "Railway" : "Local";

const SERVER_RAILWAY = "https://ashoid-production.up.railway.app";
const SERVER_RENDER  = "https://ashoid.onrender.com";

// Sur Render sans disque : /tmp (perd données au redémarrage mais sync auto)
// Sur Railway : ./data/ (persistant)
const DATA_DIR   = IS_RENDER ? "/var/data" : path.join(__dirname, "data");
const DATA_FILE  = path.join(DATA_DIR, "ashoid_data.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR,   { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function fetchInternal(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = "GET", body, timeout = 15000 } = options;
    const lib    = url.startsWith("https") ? https : http;
    const urlObj = new URL(url);
    const reqOpts = {
      hostname: urlObj.hostname,
      port    : urlObj.port || (url.startsWith("https") ? 443 : 80),
      path    : urlObj.pathname,
      method,
      headers : {
        "Content-Type": "application/json",
        "User-Agent"  : "ASHOID-Server/14.0",
        "Accept"      : "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
      timeout,
    };
    const req = lib.request(reqOpts, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ ok: false, status: res.statusCode, data: null }); }
      });
    });
    req.on("error",   reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout: " + url)); });
    if (body) req.write(body);
    req.end();
  });
}

// CORS permissif
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "dist")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, server: ENV_NAME, timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()), version: "14.0" });
});

app.get("/api/data", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return res.json({ ok: true, data: null, source: ENV_NAME });
    res.json({ ok: true, data: JSON.parse(fs.readFileSync(DATA_FILE, "utf8")), source: ENV_NAME });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post("/api/data", (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== "object") return res.status(400).json({ ok: false, error: "Données invalides" });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), "utf8");
    console.log("[ASHOID-" + ENV_NAME + "] Sauvegardé (" + JSON.stringify(data).length + " octets)");

    // Backup horaire
    try {
      const now = new Date();
      const bak = path.join(BACKUP_DIR, "backup_" + now.toISOString().slice(0,10) + "_h" + String(now.getHours()).padStart(2,"0") + ".json");
      if (!fs.existsSync(bak)) {
        fs.writeFileSync(bak, JSON.stringify(data), "utf8");
        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("backup_")).sort().reverse();
        files.slice(48).forEach(f => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {} });
      }
    } catch {}

    // Railway → copie vers Render automatiquement
    if (IS_RAILWAY) {
      fetchInternal(SERVER_RENDER + "/api/data", { method: "POST", body: JSON.stringify(data), timeout: 15000 })
        .then(r => console.log("[ASHOID-Railway] Miroir Render: " + (r.ok ? "OK" : "FAILED")))
        .catch(e => console.warn("[ASHOID-Railway] Miroir Render: " + e.message));
    }

    res.json({ ok: true, saved: true, server: ENV_NAME });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post("/api/sync", async (req, res) => {
  try {
    const r = await fetchInternal(SERVER_RAILWAY + "/api/data", { timeout: 10000 });
    if (!r.ok || !r.data?.data) return res.status(502).json({ ok: false, error: "Railway inaccessible" });
    fs.writeFileSync(DATA_FILE, JSON.stringify(r.data.data), "utf8");
    console.log("[ASHOID-" + ENV_NAME + "] Sync forcée OK");
    res.json({ ok: true, synced: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get("/api/backups", (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ ok: true, backups: [] });
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("backup_") && f.endsWith(".json")).sort().reverse().slice(0, 48)
      .map(f => { const fp = path.join(BACKUP_DIR, f); const stats = fs.statSync(fp); const match = f.match(/backup_(\d{4}-\d{2}-\d{2})_h(\d{2})\.json/); return { nom: f, date: match ? match[1] + "T" + match[2] + ":00:00.000Z" : stats.mtime.toISOString(), size: stats.size, source: ENV_NAME }; });
    res.json({ ok: true, backups: files });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get("/api/backups/:nom", (req, res) => {
  try {
    const fp = path.join(BACKUP_DIR, req.params.nom);
    if (!fs.existsSync(fp)) return res.status(404).json({ ok: false });
    res.json({ ok: true, data: JSON.parse(fs.readFileSync(fp, "utf8")) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get("*", (req, res) => {
  const idx = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.status(404).send("Lancez npm run build");
});

// ══════════════════════════════════════════════════════════════════
// DÉMARRAGE + SYNC AUTOMATIQUE RENDER
// ══════════════════════════════════════════════════════════════════
app.listen(PORT, async () => {
  console.log("[ASHOID-" + ENV_NAME + "] Démarré sur port " + PORT);

  if (IS_RENDER) {
    console.log("[ASHOID-Render] Sync automatique depuis Railway dans 5s...");
    await new Promise(r => setTimeout(r, 5000));

    const syncDepuisRailway = async () => {
      try {
        const r = await fetchInternal(SERVER_RAILWAY + "/api/data", { timeout: 15000 });
        if (r.ok && r.data && r.data.data) {
          fs.writeFileSync(DATA_FILE, JSON.stringify(r.data.data), "utf8");
          console.log("[ASHOID-Render] OK - Données Railway copiées");
          return true;
        }
        console.warn("[ASHOID-Render] Railway vide ou inaccessible");
        return false;
      } catch (e) {
        console.warn("[ASHOID-Render] Erreur sync: " + e.message);
        return false;
      }
    };

    // Sync au démarrage
    await syncDepuisRailway();

    // Resync toutes les 5 minutes
    setInterval(syncDepuisRailway, 5 * 60 * 1000);
  }
});
