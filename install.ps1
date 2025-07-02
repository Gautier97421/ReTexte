# Installation ReTexte
Write-Host "🚀 Installation de ReTexte..." -ForegroundColor Green

# Vérifier Python
try {
    $pythonVersion = python --version 2>$null
    if ($pythonVersion -match "Python (\d+\.\d+)") {
        $version = [version]$matches[1]
        if ($version -lt [version]"3.8") {
            Write-Host "❌ Python 3.8+ requis. Téléchargez depuis: https://www.python.org/downloads/" -ForegroundColor Red
            exit 1
        }
        Write-Host "✅ Python $($matches[1]) détecté" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Python non trouvé. Installez Python depuis: https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}

# Créer environnement virtuel Python
Write-Host "🐍 Création de l'environnement virtuel..." -ForegroundColor Blue
if (Test-Path "venv") { Remove-Item -Recurse -Force venv }
python -m venv venv

# Activer l'environnement virtuel
Write-Host "🔧 Activation de l'environnement virtuel..." -ForegroundColor Blue
& ".\venv\Scripts\Activate.ps1"

# Installer les dépendances Python
Write-Host "📚 Installation des dépendances Python..." -ForegroundColor Blue
python -m pip install --upgrade pip
pip install -r requirements.txt

# Installer les dépendances Node.js
Write-Host "📦 Installation des dépendances Node.js..." -ForegroundColor Blue
npm install

# Télécharger le modèle Whisper
Write-Host "🤖 Téléchargement du modèle Whisper..." -ForegroundColor Blue
python -c "from faster_whisper import WhisperModel; WhisperModel('large-v3', device='cpu', compute_type='int8'); print('✅ Modèle prêt!')"

# Créer les dossiers
New-Item -ItemType Directory -Force -Path "cache", "logs" | Out-Null

Write-Host ""
Write-Host "🎉 Installation terminée!" -ForegroundColor Green
Write-Host "Pour démarrer: .\start.bat" -ForegroundColor Cyan
