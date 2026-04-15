@echo off
chcp 65001 >nul
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   🏛️  ASHOID v13 — Installation     ║
echo  ╚══════════════════════════════════════╝
echo.

:: Vérifier Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js n'est pas installé !
    echo    Téléchargez-le sur https://nodejs.org
    echo    Choisissez la version LTS
    pause
    exit /b 1
)

echo ✅ Node.js détecté
node --version

echo.
echo 📦 Installation des dépendances...
call npm install
if %ERRORLEVEL% neq 0 (
    echo ❌ Erreur lors de l'installation
    pause
    exit /b 1
)

echo.
echo 🔨 Compilation du front React...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ❌ Erreur lors de la compilation
    pause
    exit /b 1
)

echo.
echo ✅ Installation terminée !
echo.
echo Choisissez comment lancer ASHOID :
echo   [1] Lancer comme application de bureau (Electron)
echo   [2] Lancer le serveur web (accès via navigateur)
echo   [3] Générer le fichier .exe (installation Windows)
echo.
set /p choix="Votre choix (1/2/3) : "

if "%choix%"=="1" (
    echo.
    echo 🖥️  Lancement de l'application bureau...
    call npm run electron:dev
) else if "%choix%"=="2" (
    echo.
    echo 🌐 Lancement du serveur web sur http://localhost:3000
    echo    Ouvrez votre navigateur sur http://localhost:3000
    echo    Appuyez sur Ctrl+C pour arrêter
    call node server/index.js
) else if "%choix%"=="3" (
    echo.
    echo ⚙️  Génération du .exe Windows...
    echo    (Peut prendre 3-5 minutes)
    call npm run electron:build
    echo.
    echo ✅ Fichier .exe généré dans le dossier dist_exe/
    explorer dist_exe
) else (
    echo Choix invalide.
)

pause
