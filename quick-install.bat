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

REM Étape 4: Dépendances Node.js
echo [4/6] Installation des dépendances Node.js...
pnpm install --silent
echo ✅ Dépendances Node.js installées

REM Étape 5: Dépendances Python
echo [5/6] Installation des dépendances Python...
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo ✅ Dépendances Python installées

REM Étape 6: Modèle IA
echo [6/6] Téléchargement du modèle IA...
echo ⏳ Cela peut prendre 5-10 minutes selon votre connexion...
python -c "from faster_whisper import WhisperModel; print('Téléchargement...'); WhisperModel('large-v3', device='cpu', compute_type='int8'); print('✅ Modèle prêt!')"

REM Finalisation
if not exist "cache\" mkdir cache
if not exist "logs\" mkdir logs

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                  🎉 INSTALLATION TERMINÉE! 🎉                ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo 🚀 Pour démarrer TranscriptionAI:
echo    Double-cliquez sur: start.bat
echo.
echo 📱 Interface web: http://localhost:3020
echo 🔌 API: http://localhost:8000
echo.
echo Appuyez sur une touche pour fermer...
pause >nul
