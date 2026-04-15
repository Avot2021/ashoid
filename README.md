# 🏛️ ASHOID v13 — Guide de déploiement

## Structure du projet

```
ashoid/
├── src/
│   ├── App.jsx          ← Application React principale (20 modules)
│   └── main.jsx         ← Point d'entrée React
├── server/
│   └── index.js         ← Serveur Express (déploiement en ligne)
├── public/
│   └── icon.png         ← Icône de l'application
├── electron.cjs         ← Electron (génération .exe)
├── preload.cjs          ← Pont sécurisé Electron ↔ React
├── vite.config.js       ← Configuration Vite
├── package.json         ← Dépendances et scripts
├── render.yaml          ← Config déploiement Render.com
└── .env.example         ← Variables d'environnement
```

---

## 📋 Prérequis

1. **Node.js 18+** → https://nodejs.org (choisir LTS)
2. **Git** → https://git-scm.com
3. **VS Code** (recommandé)

Vérifier :
```bash
node --version   # doit afficher v18.x ou +
npm --version    # doit afficher 9.x ou +
```

---

## 🚀 Installation (première fois)

```bash
# Cloner ou copier le projet dans un dossier
cd ashoid

# Installer toutes les dépendances
npm install
```

---

## 💻 Mode développement local

```bash
npm run dev
# Ouvre http://localhost:5173
```

---

## 🌐 DÉPLOIEMENT EN LIGNE (serveur)

### Option A — Render.com (gratuit, recommandé)

1. **Créer un compte** sur https://render.com

2. **Pousser le projet sur GitHub** :
   ```bash
   git init
   git add .
   git commit -m "ASHOID v13"
   git remote add origin https://github.com/VOTRE_USER/ashoid.git
   git push -u origin main
   ```

3. **Sur Render.com** :
   - Cliquer "New +" → "Web Service"
   - Connecter votre repo GitHub
   - Render détecte automatiquement `render.yaml`
   - Cliquer "Create Web Service"
   - ✅ L'app est en ligne en ~3 minutes sur `https://ashoid.onrender.com`

4. **Variables d'environnement sur Render** (onglet Environment) :
   ```
   NODE_ENV=production
   SESSION_SECRET=un_secret_tres_long_et_aleatoire
   PORT=3000  (Render l'injecte automatiquement)
   ```

### Option B — Railway.app

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Option C — VPS (Ubuntu/Debian)

```bash
# Sur votre serveur
sudo apt update && sudo apt install -y nodejs npm nginx

# Cloner le projet
git clone https://github.com/VOTRE_USER/ashoid.git
cd ashoid
npm install
npm run build

# Copier .env.example en .env et configurer
cp .env.example .env
nano .env   # modifier SESSION_SECRET et DATA_DIR

# Lancer avec PM2 (gestionnaire de process)
npm install -g pm2
pm2 start server/index.js --name ashoid
pm2 startup
pm2 save

# Nginx comme reverse proxy (optionnel)
# Fichier /etc/nginx/sites-available/ashoid :
# server {
#   listen 80;
#   server_name votredomaine.fr;
#   location / { proxy_pass http://localhost:3000; }
# }
```

---

## 🖥️ GÉNÉRATION DU .EXE WINDOWS

### Étape 1 — Prérequis Windows

Sur **Windows uniquement** :
- **Python** (requis par electron-builder) : https://python.org
- **Visual Studio Build Tools** : https://visualstudio.microsoft.com/visual-cpp-build-tools/
  - Cocher "Développement Desktop en C++"

### Étape 2 — Installer les dépendances

```bash
npm install
```

### Étape 3 — Ajouter une icône (optionnel mais recommandé)

Placez votre logo en `public/icon.ico` (Windows) — format ICO 256x256 pixels.

Convertisseur gratuit : https://convertio.co/png-ico/

### Étape 4 — Générer le .exe

```bash
npm run electron:build
```

Le fichier `.exe` se trouve dans :
```
dist_exe/
└── ASHOID Setup 13.0.0.exe   ← installeur Windows
```

### Étape 5 — Distribuer

Envoyez `ASHOID Setup 13.0.0.exe` à vos utilisateurs.
L'installation crée :
- Un raccourci sur le Bureau
- Un raccourci dans le Menu Démarrer
- Les données sauvegardées dans `C:\Users\[user]\AppData\Roaming\ashoid\`

---

## 🔄 Persistence des données selon l'environnement

| Environnement | Stockage |
|---|---|
| **Electron (.exe)** | Fichier JSON local (`AppData/ashoid/`) |
| **Serveur en ligne** | Fichier JSON sur le serveur (`/data/`) + cache localStorage |
| **Dev local** | localStorage du navigateur |

---

## 📦 Commandes résumé

| Commande | Description |
|---|---|
| `npm run dev` | Développement local (hot-reload) |
| `npm run build` | Compile le front React → `/dist` |
| `npm start` | Lance le serveur Express |
| `npm run electron:dev` | Test Electron en mode dev |
| `npm run electron:build` | Génère le `.exe` Windows |

---

## 🔐 Comptes par défaut

| Login | Mot de passe | Rôle |
|---|---|---|
| admin | admin123 | Admin |
| tresor | tresor123 | Trésorier |
| secretaire | secretaire123 | Secrétaire |
| lecture | lecture123 | Lecture |

⚠️ **Changez ces mots de passe** dans Sécurité & Paramètres avant la mise en production.
