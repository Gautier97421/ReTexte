# Étape 1 : Image de base avec Python
FROM python:3.11-slim

# Étape 2 : Installer les dépendances système (FFmpeg + build tools + libav)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavdevice-dev libavfilter-dev libavformat-dev libavcodec-dev libavutil-dev \
    libswscale-dev libswresample-dev pkg-config \
    build-essential \
    && apt-get clean

# Étape 3 : Définir le dossier de travail
WORKDIR /app

# Étape 4 : Copier tous les fichiers dans l’image
COPY . .

# Étape 5 : Installer les dépendances Python
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Étape 6 : Exposer le port que ton API utilise (8000 par défaut avec uvicorn)
EXPOSE 10001

# Étape 7 : Commande de démarrage (tu peux l’ajuster si besoin)
CMD ["python", "scripts/transcription-server-async.py"]
