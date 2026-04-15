/**
 * ASHOID — Serveur Express v14
 * Compatible Railway.app, Render.com, VPS
 * Stockage persistant via volume Railway (/data)
 */

require('dotenv').config()

const express     = require('express')
const path        = require('path')
const fs          = require('fs')
const cors        = require('cors')
const compression = require('compression')
const helmet      = require('helmet')

const app  = express()
const PORT = process.env.PORT || 3000

// ── Dossier de données ────────────────────────────────────────────────────────
// Railway : monter un volume sur /data pour la persistance
// Render  : utilise le dossier local (perdu au redémarrage sur plan free)
// Sur Railway sans volume : utiliser un dossier dans le projet
// Sur Railway avec volume /data : DATA_DIR=/data dans les variables
const DATA_DIR  = process.env.DATA_DIR  || path.join(__dirname, '..', 'data_local')
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, 'ashoid_data.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')

// Créer les dossiers si nécessaire (avec gestion d'erreur complète)
;[DATA_DIR, BACKUP_DIR].forEach(d => {
  try {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
    console.log(`[ASHOID] Dossier OK: ${d}`)
  } catch (e) {
    console.warn(`[ASHOID] Impossible de créer ${d}:`, e.message)
  }
})

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(compression())
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "*"],
    }
  }
}))
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// ── Helper : sauvegarde horodatée ─────────────────────────────────────────────
const sauvegarderHoraire = (json) => {
  try {
    const now  = new Date()
    const date = now.toISOString().slice(0, 10)
    const h    = String(now.getHours()).padStart(2, '0')
    const file = path.join(BACKUP_DIR, `backup_${date}_h${h}.json`)
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, json, 'utf8')
      // Supprimer les sauvegardes de plus de 7 jours
      const limite = Date.now() - 7 * 24 * 60 * 60 * 1000
      fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_'))
        .map(f => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
        .filter(({ t }) => t < limite)
        .forEach(({ f }) => fs.unlinkSync(path.join(BACKUP_DIR, f)))
    }
  } catch (e) {
    console.warn('Sauvegarde horaire échouée:', e.message)
  }
}

// ── API : santé du serveur ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const dataExiste = fs.existsSync(DATA_FILE)
  let nbPersonnes  = 0
  let nbCotisations = 0
  if (dataExiste) {
    try {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
      nbPersonnes   = d.personnes?.length   || 0
      nbCotisations = d.cotisations?.length || 0
    } catch {}
  }
  res.status(200).json({
    ok: true,
    version: '14.0.0',
    timestamp: new Date().toISOString(),
    dataDir: DATA_DIR,
    dataExiste,
    nbPersonnes,
    nbCotisations,
    env: process.env.NODE_ENV || 'development',
    uptime: Math.round(process.uptime())
  })
})

// Route racine pour Railway health check
app.get('/_health', (_req, res) => res.status(200).send('OK'))

// ── API : lecture des données ────────────────────────────────────────────────
app.get('/api/data', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ ok: true, data: null, source: 'vide' })
    }
    const raw  = fs.readFileSync(DATA_FILE, 'utf8')
    const data = JSON.parse(raw)
    res.json({ ok: true, data, source: 'fichier' })
  } catch (e) {
    console.error('GET /api/data error:', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── API : sauvegarde des données ─────────────────────────────────────────────
app.post('/api/data', (req, res) => {
  try {
    const payload = req.body
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ ok: false, error: 'Payload invalide' })
    }

    // Vérification anti-écrasement : refuser si données entrantes moins riches
    if (fs.existsSync(DATA_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
        const scoreExist   = (existing.personnes?.length   || 0) * 10
          + (existing.cotisations?.length || 0) * 5
          + (existing.finances?.length    || 0) * 3
        const scoreNew = (payload.personnes?.length   || 0) * 10
          + (payload.cotisations?.length || 0) * 5
          + (payload.finances?.length    || 0) * 3

        if (scoreNew < scoreExist * 0.3 && scoreExist > 20) {
          console.warn(`[ASHOID] ⚠️ Sauvegarde refusée — données entrantes trop pauvres (${scoreNew} vs ${scoreExist})`)
          return res.json({ ok: false, raison: 'donnees_pauvres', scoreExist, scoreNew })
        }
      } catch {}
    }

    const json = JSON.stringify(payload)
    fs.writeFileSync(DATA_FILE, json, 'utf8')
    sauvegarderHoraire(json)
    res.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('POST /api/data error:', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── API : liste des sauvegardes ──────────────────────────────────────────────
app.get('/api/backups', (_req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort().reverse()
      .slice(0, 48)
      .map(f => ({
        nom:  f,
        date: fs.statSync(path.join(BACKUP_DIR, f)).mtime.toISOString(),
        taille: fs.statSync(path.join(BACKUP_DIR, f)).size
      }))
    res.json({ ok: true, backups: files })
  } catch (e) {
    res.json({ ok: true, backups: [] })
  }
})

// ── API : restaurer une sauvegarde ───────────────────────────────────────────
app.get('/api/backups/:nom', (req, res) => {
  try {
    const file = path.join(BACKUP_DIR, path.basename(req.params.nom))
    if (!fs.existsSync(file)) {
      return res.status(404).json({ ok: false, error: 'Sauvegarde introuvable' })
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    res.json({ ok: true, data })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── API : télécharger backup complet ────────────────────────────────────────
app.get('/api/backup', (_req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.status(404).json({ ok: false, error: 'Aucune donnée' })
    }
    const filename = `ashoid_backup_${new Date().toISOString().slice(0, 10)}.json`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/json')
    res.sendFile(DATA_FILE)
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ── Servir le front React compilé ────────────────────────────────────────────
const DIST = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
} else {
  app.get('/', (_req, res) => res.send(`
    <h2 style="font-family:sans-serif;padding:40px;color:#0F2D5C">
      ⚠️ ASHOID — Front non compilé<br>
      <small style="font-size:14px;color:#666">Lancez : npm run build</small>
    </h2>
  `))
}

// ── Démarrage ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🏛️  ASHOID v14 — Serveur actif         ║
  ║   Port    : ${PORT}                          ║
  ║   Données : ${DATA_FILE.slice(-35)}  ║
  ╚══════════════════════════════════════════╝
  `)
})

module.exports = app
