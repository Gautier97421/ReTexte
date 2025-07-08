#!/bin/bash

echo "🚀 Démarrage ReTexte Production..."

# Créer les dossiers si nécessaire
mkdir -p cache logs jobs

# Démarrer le serveur Python en arrière-plan
echo "🐍 Démarrage du serveur de transcription..."
python scripts/transcription-server-async.py &
PYTHON_PID=$!

# Attendre que le serveur Python soit prêt
echo "⏳ Attente du serveur Python..."
sleep 5

# Vérifier que le serveur Python fonctionne
if ! curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "❌ Erreur: Le serveur Python n'a pas démarré correctement"
    exit 1
fi

echo "✅ Serveur Python prêt"

# Démarrer l'application Next.js
echo "🌐 Démarrage de l'application web..."
npm start &
NEXTJS_PID=$!

echo "🎉 Application démarrée!"
echo "📱 Interface web: http://localhost:3000"
echo "🔌 API serveur: http://localhost:8000"

# Fonction pour arrêter proprement les processus
cleanup() {
    echo "🛑 Arrêt des services..."
    kill $PYTHON_PID $NEXTJS_PID 2>/dev/null
    exit 0
}

# Capturer les signaux d'arrêt
trap cleanup SIGTERM SIGINT

# Attendre que les processus se terminent
wait $PYTHON_PID $NEXTJS_PID
