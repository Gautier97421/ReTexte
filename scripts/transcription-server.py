# app/scripts/transcription-server.py

import os
import tempfile
import hashlib
import json
import time
from pathlib import Path
from typing import Dict, Any

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel
import torch

# Configuration
MODEL_SIZE = "large-v3"  # Meilleure qualité
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if torch.cuda.is_available() else "int8"
CACHE_DIR = Path("./cache")
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

# Créer l'application
app = FastAPI(title="TranscriptionAI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variables globales
whisper_model = None
stats = {"total_transcriptions": 0, "cache_hits": 0}

def load_model():
    """Charge le modèle Whisper une seule fois"""
    global whisper_model
    if whisper_model is None:
        print(f"🚀 Chargement du modèle {MODEL_SIZE} sur {DEVICE}...")
        whisper_model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        print("✅ Modèle chargé!")

def get_cache_path(file_hash: str) -> Path:
    """Chemin du fichier cache"""
    CACHE_DIR.mkdir(exist_ok=True)
    return CACHE_DIR / f"{file_hash}.json"

def save_cache(file_hash: str, result: Dict[str, Any]):
    """Sauvegarde dans le cache"""
    with open(get_cache_path(file_hash), 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

def load_cache(file_hash: str) -> Dict[str, Any] | None:
    """Charge depuis le cache"""
    cache_path = get_cache_path(file_hash)
    if cache_path.exists():
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                stats["cache_hits"] += 1
                return json.load(f)
        except:
            pass
    return None

@app.get("/")
async def root():
    return {"message": "TranscriptionAI - Serveur de transcription", "status": "ok"}

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "stats": stats
    }

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), language: str = "fr"):
    """Transcrit un fichier audio en texte"""
    
    # Vérifications
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    # Lire le fichier
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 500MB)")
    
    # Vérifier le cache
    file_hash = hashlib.sha256(file_content).hexdigest()
    cached_result = load_cache(file_hash)
    if cached_result:
        print(f"📋 Cache hit pour {file.filename}")
        return JSONResponse(content=cached_result)
    
    # Charger le modèle
    load_model()
    
    # Sauvegarder temporairement
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
        tmp_file.write(file_content)
        tmp_file_path = tmp_file.name
    
    try:
        print(f"🎵 Transcription de {file.filename}...")
        start_time = time.time()
        
        # Transcription
        segments, info = whisper_model.transcribe(
            tmp_file_path,
            language=language if language != "auto" else None,
            beam_size=5,
            temperature=0.0,
            vad_filter=True
        )
        
        # Construire le résultat
        segments_list = []
        full_text = ""
        
        for segment in segments:
            segment_data = {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            }
            segments_list.append(segment_data)
            full_text += segment.text.strip() + " "
        
        processing_time = time.time() - start_time
        
        result = {
            "text": full_text.strip(),
            "segments": segments_list,
            "info": {
                "language": info.language,
                "duration": info.duration,
                "processing_time": processing_time,
                "speed_ratio": info.duration / processing_time if processing_time > 0 else 0
            },
            "metadata": {
                "filename": file.filename,
                "model": MODEL_SIZE,
                "device": DEVICE
            }
        }
        
        # Sauvegarder dans le cache
        save_cache(file_hash, result)
        stats["total_transcriptions"] += 1
        
        print(f"✅ Transcription terminée en {processing_time:.2f}s")
        return JSONResponse(content=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")
    
    finally:
        # Nettoyer
        try:
            os.unlink(tmp_file_path)
        except:
            pass

if __name__ == "__main__":
    print("🚀 Démarrage du serveur de transcription...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
