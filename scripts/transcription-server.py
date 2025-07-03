# app/scripts/transcription-server.py

import os
import tempfile
import hashlib
import json
import time
from pathlib import Path
from typing import Dict, Any
from pydub import AudioSegment

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
app = FastAPI(title="ReTexte", version="1.0.0")
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


MAX_SEGMENT_DURATION_MS = 15 * 60 * 1000

def split_audio(file_path):
    audio = AudioSegment.from_file(file_path)
    segments = []
    for start_ms in range(0, len(audio), MAX_SEGMENT_DURATION_MS):
        end_ms = min(start_ms + MAX_SEGMENT_DURATION_MS, len(audio))
        segment = audio[start_ms:end_ms]
        segments.append(segment)
    return segments

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
    return {"message": "ReTExte - Serveur de transcription", "status": "ok"}

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
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")

    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 500MB)")

    file_hash = hashlib.sha256(file_content).hexdigest()
    cached_result = load_cache(file_hash)
    if cached_result:
        return JSONResponse(content=cached_result)

    load_model()

    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
        tmp_file.write(file_content)
        tmp_file_path = tmp_file.name

    try:
        audio = AudioSegment.from_file(tmp_file_path)
        total_duration_ms = len(audio)
        all_segments = []
        full_text = ""
        start_time = time.time()

        for start_ms in range(0, total_duration_ms, MAX_SEGMENT_DURATION_MS):
            end_ms = min(start_ms + MAX_SEGMENT_DURATION_MS, total_duration_ms)
            segment_audio = audio[start_ms:end_ms]

            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_seg_file:
                segment_audio.export(tmp_seg_file.name, format="wav")
                tmp_seg_path = tmp_seg_file.name

            segments, info = whisper_model.transcribe(
                tmp_seg_path,
                language=language if language != "auto" else None,
                beam_size=5,
                temperature=0.0,
                vad_filter=True
            )

            for segment in segments:
                segment_data = {
                    "start": segment.start + start_ms / 1000,
                    "end": segment.end + start_ms / 1000,
                    "text": segment.text.strip()
                }
                all_segments.append(segment_data)
                full_text += segment.text.strip() + " "

            os.unlink(tmp_seg_path)

        processing_time = time.time() - start_time

        result = {
            "text": full_text.strip(),
            "segments": all_segments,
            "info": {
                "language": info.language,
                "duration": total_duration_ms / 1000,
                "processing_time": processing_time,
                "speed_ratio": (total_duration_ms / 1000) / processing_time if processing_time > 0 else 0
            },
            "metadata": {
                "filename": file.filename,
                "model": MODEL_SIZE,
                "device": DEVICE
            }
        }

        save_cache(file_hash, result)
        stats["total_transcriptions"] += 1

        return JSONResponse(content=result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

    finally:
        try:
            os.unlink(tmp_file_path)
        except:
            pass



if __name__ == "__main__":
    print("🚀 Démarrage du serveur de transcription...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
