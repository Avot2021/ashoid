const express = require("express");
const path    = require("path");
const fs      = require("fs");
const https   = require("https");
const http    = require("http");

const app  = express();
const PORT = process.env.PORT || 3000;

const IS_RENDER  = !!process.env.RENDER;
const ENV_NAME   = IS_RENDER ? "Render" : "Local";
const SERVER_RENDER = "https://ashoid.onrender.com";

// DISQUE PERSISTANT sur /var/data (configuré sur Render dashboard)
const DATA_DIR   = IS_RENDER ? "/var/data" : path.join(__dirname, "data");
const DATA_FILE  = path.join(DATA_DIR, "ashoid_data.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");

if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR,   { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// CORS permissif
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "dist")));

// HEALTH
app.get("/api/health", (req, res) => {
  res.json({
    ok        : true,
    version   : "14.0.0",
    timestamp : new Date().toISOString(),
    dataDir   : DATA_DIR,
    dataExiste: fs.existsSync(DATA_FILE),
    nbPersonnes   : 0,
    nbCotisations : 0,
    env       : "production",
    uptime    : Math.floor(process.uptime()),
  });
});

// LIRE LES DONNÉES
app.get("/api/data", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ ok: true, data: null, source: ENV_NAME, empty: true });
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    res.json({ ok: true, data, source: ENV_NAME });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// SAUVEGARDER LES DONNÉES
app.post("/api/data", (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ ok: false, error: "Données invalides" });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), "utf8");
    console.log("[ASHOID-" + ENV_NAME + "] Sauvegardé dans " + DATA_FILE);

    // Backup horaire
    try {
      const now = new Date();
      const bak = path.join(BACKUP_DIR,
        "backup_" + now.toISOString().slice(0,10) +
        "_h" + String(now.getHours()).padStart(2,"0") + ".json");
      if (!fs.existsSync(bak)) {
        fs.writeFileSync(bak, JSON.stringify(data), "utf8");
        const files = fs.readdirSync(BACKUP_DIR)
          .filter(f => f.startsWith("backup_")).sort().reverse();
        files.slice(48).forEach(f => {
          try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
        });
      }
    } catch {}

    res.json({ ok: true, saved: true, server: ENV_NAME });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// BACKUPS
app.get("/api/backups", (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ ok: true, backups: [] });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup_") && f.endsWith(".json"))
      .sort().reverse().slice(0, 48)
      .map(f => {
        const fp    = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(fp);
        const m     = f.match(/backup_(\d{4}-\d{2}-\d{2})_h(\d{2})\.json/);
        return {
          nom   : f,
          date  : m ? m[1] + "T" + m[2] + ":00:00.000Z" : stats.mtime.toISOString(),
          size  : stats.size,
          source: ENV_NAME,
        };
      });
    res.json({ ok: true, backups: files });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/backups/:nom", (req, res) => {
  try {
    const fp = path.join(BACKUP_DIR, req.params.nom);
    if (!fs.existsSync(fp)) return res.status(404).json({ ok: false });
    res.json({ ok: true, data: JSON.parse(fs.readFileSync(fp, "utf8")) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// SPA
app.get("*", (req, res) => {
  const idx = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(idx)) res.sendFile(idx);
  else res.status(404).send("Lancez npm run build");
});

app.listen(PORT, () => {
  console.log("[ASHOID-" + ENV_NAME + "] Démarré port " + PORT);
  console.log("[ASHOID-" + ENV_NAME + "] Données dans: " + DATA_DIR);
});
