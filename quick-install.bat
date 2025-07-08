@echo off
title Installation ReTexte - Étape par étape
color 0A

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                           ReTexte                            ║
echo ║                   Installation Automatique                   ║
echo ╚═══════════════════════════════════════════��═══════════════╝
echo.

REM Étape 1: Vérifier Python
echo [1/6] Vérification de Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python non installé
    echo.
    echo 📥 Téléchargement automatique de Python...
    echo Ouvrez https://www.python.org/downloads/ et installez Python
    echo ⚠️  IMPORTANT: Cochez "Add Python to PATH"
    echo.
    echo Appuyez sur une touche après l'installation de Python...
    pause
    
    REM Revérifier Python
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Python toujours non détecté. Redémarrez le terminal après installation.
        pause
        exit /b 1
    )
)
echo ✅ Python OK

REM Étape 2: Vérifier Node.js
echo [2/6] Vérification de Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js non installé
    echo.
    echo 📥 Installez Node.js depuis: https://nodejs.org/
    echo Choisissez la version LTS (recommandée)
    echo.
    echo Appuyez sur une touche après l'installation de Node.js...
    pause
    
    REM Revérifier Node.js
    node --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Node.js toujours non détecté. Redémarrez le terminal après installation.
        pause
        exit /b 1
    )
)
echo ✅ Node.js OK

REM Étape 3: Environnement Python
echo [3/6] Création de l'environnement Python...
if exist "venv\" (
    echo Suppression de l'ancien environnement...
    rmdir /s /q venv
)
python -m venv venv
call venv\Scripts\activate.bat
echo ✅ Environnement Python créé

@REM REM Étape 4: Dépendances Node.js
@REM echo [4/6] Installation des dépendances Node.js...
@REM REM Détecter pnpm
@REM pnpm --version >nul 2>&1
@REM if %errorlevel% neq 0 (
@REM     echo ⚠️  pnpm non trouvé. Utilisation de npm.
@REM     npm install
@REM     if %errorlevel% neq 0 (
@REM         echo ❌ Erreur lors de "npm install"
@REM         pause
@REM         exit /b 1
@REM     )
@REM ) else (
@REM     echo ✅ pnpm détecté
@REM     pnpm install
@REM     if %errorlevel% neq 0 (
@REM         echo ❌ Erreur lors de "pnpm install"
@REM         pause
@REM         exit /b 1
@REM     )
@REM )

echo ✅ Dépendances Node.js installées

REM Étape 5: Dépendances Python
echo [5/6] Installation des dépendances Python...
rustc --version >nul 2>&1
IF ERRORLEVEL 1 (
  echo Rust n'est pas installe, lancement de l'installation...
  start https://rustup.rs/
  pause
) ELSE (
  echo Rust est deja installe.
)
python -m pip install --upgrade pip
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Erreur lors de l'installation des dépendances Python
    pause
    exit /b 1
)
echo ✅ Dépendances Python installées

REM Étape 6: Téléchargement modèle IA
echo [6/6] Téléchargement du modèle IA...
echo ⏳ Cela peut prendre 5-10 minutes...
python -c "from faster_whisper import WhisperModel; print('Téléchargement...'); WhisperModel('large-v3', device='cpu', compute_type='int8'); print('✅ Modèle prêt!')"
if %errorlevel% neq 0 (
    echo ❌ Erreur lors du téléchargement du modèle IA
    pause
    exit /b 1
)

REM Finalisation
if not exist "cache\" mkdir cache
if not exist "logs\" mkdir logs

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                  🎉 INSTALLATION TERMINÉE! 🎉                ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo 🚀 Pour démarrer ReTexte:
echo    Double-cliquez sur: start.bat
echo.
echo 📱 Interface web: http://localhost:3020
echo 🔌 API: http://localhost:8000
echo.
echo Appuyez sur une touche pour fermer...
pause >nul

@REM @echo off
@REM title Installation ReTexte - Étape par étape
@REM color 0A

@REM echo.
@REM echo ╔══════════════════════════════════════════════════════════════╗
@REM echo ║                         ReTexte Pro                          ║
@REM echo ║                   Installation Automatique                   ║
@REM echo ╚══════════════════════════════════════════════════════════════╝
@REM echo.

@REM REM Étape 1: Vérifier Python
@REM echo [1/6] Vérification de Python...
@REM python --version >nul 2>&1
@REM if %errorlevel% neq 0 (
@REM     echo ❌ Python non installé
@REM     echo.
@REM     echo 📥 Téléchargement automatique de Python...
@REM     echo Ouvrez https://www.python.org/downloads/ et installez Python
@REM     echo ⚠️  IMPORTANT: Cochez "Add Python to PATH"
@REM     echo.
@REM     echo Appuyez sur une touche après l'installation de Python...
@REM     pause
    
@REM     REM Revérifier Python
@REM     python --version >nul 2>&1
@REM     if %errorlevel% neq 0 (
@REM         echo ❌ Python toujours non détecté. Redémarrez le terminal après installation.
@REM         pause
@REM         exit /b 1
@REM     )
@REM )
@REM echo ✅ Python OK

@REM REM Étape 2: Vérifier Node.js
@REM echo [2/6] Vérification de Node.js...
@REM node --version >nul 2>&1
@REM if %errorlevel% neq 0 (
@REM     echo ❌ Node.js non installé
@REM     echo.
@REM     echo 📥 Installez Node.js depuis: https://nodejs.org/
@REM     echo Choisissez la version LTS (recommandée)
@REM     echo.
@REM     echo Appuyez sur une touche après l'installation de Node.js...
@REM     pause
    
@REM     REM Revérifier Node.js
@REM     node --version >nul 2>&1
@REM     if %errorlevel% neq 0 (
@REM         echo ❌ Node.js toujours non détecté. Redémarrez le terminal après installation.
@REM         pause
@REM         exit /b 1
@REM     )
@REM )
@REM echo ✅ Node.js OK

@REM REM Étape 3: Environnement Python
@REM echo [3/6] Création de l'environnement Python...
@REM if exist "venv\" (
@REM     echo Suppression de l'ancien environnement...
@REM     rmdir /s /q venv
@REM )
@REM python -m venv venv
@REM call venv\Scripts\activate.bat
@REM echo ✅ Environnement Python créé

@REM REM Étape 4: Dépendances Python
@REM echo [4/6] Installation des dépendances Python...
@REM python -m pip install --upgrade pip --quiet
@REM pip install -r requirements.txt --quiet
@REM echo ✅ Dépendances Python installées

@REM REM Étape 5: Dépendances Node.js
@REM echo [5/6] Installation des dépendances Node.js...
@REM npm install --silent
@REM echo ✅ Dépendances Node.js installées

@REM REM Étape 6: Modèle IA
@REM echo [6/6] Téléchargement du modèle IA...
@REM echo ⏳ Cela peut prendre 5-10 minutes selon votre connexion...
@REM python -c "from faster_whisper import WhisperModel; print('Téléchargement...'); WhisperModel('large-v3', device='cpu', compute_type='int8'); print('✅ Modèle prêt!')"

@REM REM Finalisation
@REM if not exist "cache\" mkdir cache
@REM if not exist "logs\" mkdir logs

@REM echo.
@REM echo ╔══════════════════════════════════════════════════════════════╗
@REM echo ║                  🎉 INSTALLATION TERMINÉE! 🎉                ║
@REM echo ╚══════════════════════════════════════════════════════════════╝
@REM echo.
@REM echo 🚀 Pour démarrer ReTexte:
@REM echo    Double-cliquez sur: start.bat
@REM echo.
@REM echo 📱 Interface web: http://localhost:3000
@REM echo 🔌 API: http://localhost:8000
@REM echo.
@REM echo Appuyez sur une touche pour fermer...
@REM pause >nul
