@REM @echo off
@REM echo 🚀 Démarrage de ReText...

@REM REM Activer l'environnement Python
@REM call venv\Scripts\activate.bat

@REM REM Créer les dossiers
@REM if not exist "cache\" mkdir cache
@REM if not exist "logs\" mkdir logs

@REM REM Attendre que le serveur soit prêt
@REM echo ⏳ Attente du serveur...
@REM timeout /t 5 /nobreak >nul

@REM REM Démarrer l'interface web
@REM echo 🌐 Démarrage de l'interface web...
@REM npm run dev

@echo off
title TranscriptionAI Pro - Démarrage
color 0A

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    TranscriptionAI Pro                       ║
echo ║                   Démarrage Instantané                       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Activer l'environnement Python
call venv\Scripts\activate.bat

REM Créer les dossiers si nécessaire
if not exist "cache\" mkdir cache
if not exist "logs\" mkdir logs
if not exist "jobs\" mkdir jobs

echo 🚀 Démarrage du serveur (instantané)...
start /min "TranscriptionAI Server" python scripts\transcription-server-async.py

echo ⏳ Initialisation (2 secondes)...
timeout /t 2 /nobreak >nul

echo 🌐 Démarrage de l'interface web...
echo.
echo 🎉 TranscriptionAI prêt!
echo 📱 Interface web: http://localhost:3000
echo 🔌 API serveur: http://localhost:8000
echo.
echo 💡 Modèle pré-chargé = Transcription immédiate!
echo.

REM Démarrer l'interface web
npm run dev
