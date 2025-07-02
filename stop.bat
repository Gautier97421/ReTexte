@echo off
echo 🛑 Arrêt des services...

REM Arrêter les processus Node.js et Python
taskkill /f /im python.exe 2>nul
taskkill /f /im node.exe 2>nul
echo ✅ Services arrêtés!

REM Arrêter Redis Docker
docker stop transcription-redis 2>nul
docker rm transcription-redis 2>nul
echo ✅ Redis arrêté

echo.
echo 🎉 Tous les services ont été arrêtés!
pause
