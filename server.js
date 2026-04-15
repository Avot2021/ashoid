// ═══════════════════════════════════════════════════════════════════
// ASHOID — server.js (Railway + Render)
// Correction : CORS complet, /api/health, timeout long pour Render
// ═══════════════════════════════════════════════════════════════════
const express = require("express");
const path    = require("path");
const fs      = require("fs");

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "ashoid_data.json");

// ── S'assurer que le dossier data existe ────────────────────────────
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// ── CORS — OBLIGATOIRE pour Render + Railway + .exe ────────────────
const ALLOWED_ORIGINS = [
  "https://ashoid-production.up.railway.app",
  "https://ashoid.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "app://.",          // Electron
  "file://",          // Electron (certaines versions)
];

app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  // Autoriser toutes les origines connues + Electron (pas d'origine)
  if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  } else {
    res.setHeader("Access-Control-Allow-Origin", origin); // permissif pour debug
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "dist")));

// ── /api/health — CRITIQUE pour le badge dans App.jsx ──────────────
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    server: process.env.RENDER ? "render" : (process.env.RAILWAY_ENVIRONMENT ? "railway" : "local"),
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: "14.0",
  });
});

// ── /api/data GET — lire les données ───────────────────────────────
app.get("/api/data", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ ok: true, data: null, source: "empty" });
    }
    const raw  = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    res.json({ ok: true, data, source: process.env.RENDER ? "render" : "railway" });
  } catch (e) {
    console.error("[ASHOID] Erreur lecture data:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/data POST — sauvegarder les données ───────────────────────
app.post("/api/data", (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ ok: false, error: "Données invalides" });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), "utf8");

    // ── Sauvegarde automatique horodatée (backup toutes les heures) ─
    try {
      const backupDir  = path.join(__dirname, "data", "backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

      const now     = new Date();
      const heure   = now.getHours();
      const dateStr = now.toISOString().slice(0, 10);
      const backupFile = path.join(backupDir, `backup_${dateStr}_h${String(heure).padStart(2,"0")}.json`);

      // Sauvegarder seulement si le fichier de cette heure n'existe pas encore
      if (!fs.existsSync(backupFile)) {
        fs.writeFileSync(backupFile, JSON.stringify(data), "utf8");
        // Garder seulement les 48 dernières sauvegardes
        const files = fs.readdirSync(backupDir)
          .filter(f => f.startsWith("backup_"))
          .sort()
          .reverse();
        files.slice(48).forEach(f => {
          try { fs.unlinkSync(path.join(backupDir, f)); } catch {}
        });
      }
    } catch {}

    res.json({ ok: true, saved: true });
  } catch (e) {
    console.error("[ASHOID] Erreur sauvegarde:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/backups GET — liste des sauvegardes disponibles ───────────
app.get("/api/backups", (req, res) => {
  try {
    const backupDir = path.join(__dirname, "data", "backups");
    if (!fs.existsSync(backupDir)) return res.json({ ok: true, backups: [] });

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith("backup_") && f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 48)
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats    = fs.statSync(filePath);
        const match    = f.match(/backup_(\d{4}-\d{2}-\d{2})_h(\d{2})\.json/);
        const date     = match ? `${match[1]}T${match[2]}:00:00.000Z` : stats.mtime.toISOString();
        return { nom: f, date, size: stats.size, source: process.env.RENDER ? "render" : "railway" };
      });

    res.json({ ok: true, backups: files });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/backups/:nom GET — récupérer une sauvegarde précise ───────
app.get("/api/backups/:nom", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "backups", req.params.nom);
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "Introuvable" });
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/sync POST — forcer une copie entre serveurs ───────────────
// Utilisé par le .exe pour Railway→Render ou Render→Railway
app.post("/api/sync", async (req, res) => {
  try {
    const { target, data } = req.body;
    if (!data) return res.status(400).json({ ok: false, error: "Pas de données" });

    const url = target === "render"
      ? "https://ashoid.onrender.com/api/data"
      : "https://ashoid-production.up.railway.app/api/data";

    // fetch natif Node 18+
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    });

    const result = await r.json();
    res.json({ ok: r.ok, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── SPA fallback ────────────────────────────────────────────────────
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("App non buildée — lancez npm run build");
  }
});

// ── Démarrage ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  const env = process.env.RENDER ? "Render.com" : (process.env.RAILWAY_ENVIRONMENT ? "Railway" : "Local");
  console.log(`[ASHOID] Serveur ${env} démarré sur port ${PORT}`);
  console.log(`[ASHOID] Health: http://localhost:${PORT}/api/health`);
  console.log(`[ASHOID] Data:   http://localhost:${PORT}/api/data`);
});
