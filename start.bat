@echo off
echo 🚀 Démarrage de ReText...

REM Activer l'environnement Python
call venv\Scripts\activate.bat

REM Créer les dossiers
if not exist "cache\" mkdir cache
if not exist "logs\" mkdir logs

REM Attendre que le serveur soit prêt
echo ⏳ Attente du serveur...
timeout /t 5 /nobreak >nul

REM Démarrer l'interface web
echo 🌐 Démarrage de l'interface web...
npm run dev