# # Étape 1 : Image de base avec Python
# FROM python:3.11-slim

# # Étape 2 : Installer les dépendances système (FFmpeg + build tools + libav)
# RUN apt-get update && apt-get install -y \
#     ffmpeg \
#     libavdevice-dev libavfilter-dev libavformat-dev libavcodec-dev libavutil-dev \
#     libswscale-dev libswresample-dev pkg-config \
#     build-essential \
#     && apt-get clean

# # Étape 3 : Définir le dossier de travail
# WORKDIR /app

# # Étape 4 : Copier tous les fichiers dans l’image
# COPY . .

# # Étape 5 : Installer les dépendances Python
# RUN pip install --upgrade pip
# RUN pip install -r requirements.txt

# # Étape 6 : Exposer le port que ton API utilise (8000 par défaut avec uvicorn)
# EXPOSE 8000
# RUN npm run build
# # Étape 7 : Commande de démarrage (tu peux l’ajuster si besoin)
# CMD ["python", "scripts/transcription-server-async.py"]

# Multi-stage build pour optimiser la taille
FROM python:3.11-slim as python-base

# Variables d'environnement
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Installer Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app

# Copier les fichiers de dépendances
COPY requirements.txt package.json package-lock.json ./

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Installer les dépendances Node.js
RUN npm install --only=production --legacy-peer-deps

# Pré-télécharger le modèle Whisper
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('medium', device='cpu', compute_type='int8')"

# Copier le code source
COPY . .

# Build de l'application Next.js
RUN npm run build

# Créer les dossiers nécessaires
RUN mkdir -p cache logs jobs

# Exposer les ports
EXPOSE 3000 8000

# Script de démarrage
COPY start-production.sh /app/start-production.sh
RUN chmod +x /app/start-production.sh

CMD ["/app/start-production.sh"]
