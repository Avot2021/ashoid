require('dotenv').config()
const express     = require('express')
const path        = require('path')
const fs          = require('fs')
const session     = require('express-session')
const cors        = require('cors')
const compression = require('compression')
const helmet      = require('helmet')

const app  = express()
const PORT = process.env.PORT || 3000
const DATA_DIR  = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const DATA_FILE = path.join(DATA_DIR, 'ashoid_data.json')

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

app.use(compression())
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    }
  }
}))
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(session({
  secret: process.env.SESSION_SECRET || 'ashoid_secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }
}))

// ── API données ──────────────────────────────────────────────────────────────
app.get('/api/data', (_req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return res.json({ ok: true, data: null })
    res.json({ ok: true, data: JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) })
  } catch (e) { res.status(500).json({ ok: false, error: e.message }) }
})

app.post('/api/data', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(req.body), 'utf8')
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ ok: false, error: e.message }) }
})

app.get('/api/backup', (_req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.status(404).json({ ok: false })
  const filename = `ashoid_backup_${new Date().toISOString().slice(0,10)}.json`
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Type', 'application/json')
  res.sendFile(DATA_FILE)
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '14.0.0', time: new Date().toISOString() })
})

// ── Front React ──────────────────────────────────────────────────────────────
const DIST = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
} else {
  app.get('/', (_req, res) => res.send('<h2>Lancez <code>npm run build</code> d\'abord.</h2>'))
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🏛️  ASHOID v14 — Serveur actif\n  http://localhost:${PORT}\n`)
})
