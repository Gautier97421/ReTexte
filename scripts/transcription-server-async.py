import os
import asyncio
import tempfile
import hashlib
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import threading
from queue import Queue

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel
import torch
print("CUDA disponible :", torch.cuda.is_available())
if torch.cuda.is_available():
    print("Nom du GPU :", torch.cuda.get_device_name(0))
else:
    print("GPU non détecté, utilisation CPU")
print("Version CUDA utilisée par torch :", torch.version.cuda)


# Configuration optimisée
MODEL_SIZE = "medium"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if torch.cuda.is_available() else "int8"
CACHE_DIR = Path("./cache")
JOBS_DIR = Path("./jobs")
MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB
LARGE_FILE_THRESHOLD = 50 * 1024 * 1024  # 50MB

# NOUVEAU: Gestion de la concurrence
MAX_CONCURRENT_TRANSCRIPTIONS = 1  # Une seule transcription à la fois
transcription_queue = Queue()
active_transcriptions = 0
transcription_lock = threading.Lock()

print(f"🚀 ReTexte - Mode Réseau Local")
print(f"   📱 Modèle: {MODEL_SIZE}")
print(f"   🖥️  Device: {DEVICE}")
print(f"   👥 Utilisateurs simultanés: ♾️  (interface)")
print(f"   🎵 Transcriptions simultanées: {MAX_CONCURRENT_TRANSCRIPTIONS}")

app = FastAPI(
    title="ReTexte", 
    version="2.2.0",
    description="Serveur multi-utilisateurs avec file d'attente"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variables globales
whisper_model = None
jobs_status = {}
stats = {
    "total_transcriptions": 0, 
    "cache_hits": 0,
    "sync_jobs": 0,
    "async_jobs": 0,
    "concurrent_users": 0,
    "queue_length": 0,
    "avg_processing_speed": 0
}

# Créer les dossiers
CACHE_DIR.mkdir(exist_ok=True)
JOBS_DIR.mkdir(exist_ok=True)

def load_model():
    """Charge le modèle pré-téléchargé (thread-safe)"""
    global whisper_model
    if whisper_model is None:
        with transcription_lock:
            if whisper_model is None:  # Double-check
                print(f"🤖 Chargement du modèle {MODEL_SIZE}...")
                start_time = time.time()
                
                whisper_model = WhisperModel(
                    MODEL_SIZE, 
                    device=DEVICE, 
                    compute_type=COMPUTE_TYPE,
                    cpu_threads=min(8, os.cpu_count() or 4),
                    num_workers=1
                )
                load_time = time.time() - start_time
                print(f"✅ Modèle {MODEL_SIZE} chargé en {load_time:.1f}s!")

def get_cache_path(file_hash: str) -> Path:
    return CACHE_DIR / f"{file_hash}.json"

def save_cache(file_hash: str, result: Dict[str, Any]):
    try:
        with open(get_cache_path(file_hash), 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Erreur sauvegarde cache: {e}")

def load_cache(file_hash: str) -> Optional[Dict[str, Any]]:
    cache_path = get_cache_path(file_hash)
    if cache_path.exists():
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                stats["cache_hits"] += 1
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Erreur lecture cache: {e}")
    return None

def transcribe_file_safe(file_path: str, language: str, filename: str, user_id: str = "unknown", job_id: Optional[str] = None) -> Dict[str, Any]:
    """Transcription thread-safe avec file d'attente et mise à jour de la progression"""
    global active_transcriptions

    try:
        # Attendre son tour dans la file
        with transcription_lock:
            active_transcriptions += 1
            queue_position = active_transcriptions

        if queue_position > 1:
            print(f"⏳ Utilisateur {user_id}: En attente (position {queue_position} dans la file)")

        # Attendre que ce soit notre tour
        while True:
            with transcription_lock:
                if active_transcriptions == 1:  # C'est notre tour
                    break
            time.sleep(1)  # Attendre 1 seconde

        print(f"🎵 Utilisateur {user_id}: Début transcription de {filename}")

        # Chargement du modèle
        load_model()

        # Vérification du fichier
        if not os.path.exists(file_path):
            raise Exception(f"Fichier non trouvé: {file_path}")

        file_size = os.path.getsize(file_path)
        print(f"📁 Utilisateur {user_id}: Fichier {file_size} bytes")

        # Transcription
        start_time = time.time()

        segments_gen, info = whisper_model.transcribe(
            file_path,
            language=language if language != "auto" else None,
            beam_size=3,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200
            ),
            chunk_length=30,
            condition_on_previous_text=False
        )

        # Construction du résultat
        segments = list(segments_gen)
        segments_list = []
        full_text = ""
        total_segments = len(segments)

        for idx, segment in enumerate(segments):
            segment_data = {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            }
            segments_list.append(segment_data)
            full_text += segment.text.strip() + " "

            # Mise à jour de la progression (tous les 10 %)
            if job_id and total_segments > 10 and idx % max(1, (total_segments // 10)) == 0:
                progress_value = 20 + int((idx / total_segments) * 70)
                jobs_status[job_id]["progress"] = progress_value

        processing_time = time.time() - start_time
        file_size_mb = file_size / (1024 * 1024)
        speed_mb_per_min = (file_size_mb / processing_time) * 60 if processing_time > 0 else 0

        result = {
            "text": full_text.strip(),
            "segments": segments_list,
            "info": {
                "language": info.language,
                "duration": info.duration,
                "processing_time": processing_time,
                "speed_ratio": info.duration / processing_time if processing_time > 0 else 0,
                "total_segments": len(segments_list),
                "processing_speed_mb_per_min": speed_mb_per_min
            },
            "metadata": {
                "filename": filename,
                "model": MODEL_SIZE,
                "device": DEVICE,
                "processing_mode": "network",
                "file_size_mb": file_size_mb,
                "user_id": user_id,
                "queue_position": queue_position
            }
        }

        print(f"✅ Utilisateur {user_id}: Transcription terminée en {processing_time:.1f}s")
        return result

    except Exception as e:
        print(f"❌ Utilisateur {user_id}: Erreur transcription: {str(e)}")
        raise e

    finally:
        # Libérer la file d'attente
        with transcription_lock:
            active_transcriptions -= 1
            stats["queue_length"] = active_transcriptions


async def process_transcription_async(job_id: str, file_content: bytes, filename: str, language: str, user_id: str):
    """Traitement asynchrone avec file d'attente"""
    try:
        jobs_status[job_id] = {"status": "queued", "progress": 0, "user_id": user_id}
        
        # Vérifier le cache
        file_hash = hashlib.sha256(file_content).hexdigest()
        cached_result = load_cache(file_hash)
        if cached_result:
            print(f"📋 Utilisateur {user_id}: Cache hit pour {filename}")
            jobs_status[job_id] = {"status": "completed", "result": cached_result, "progress": 100}
            return

        jobs_status[job_id]["status"] = "processing"
        jobs_status[job_id]["progress"] = 10
        
        # Traitement avec file d'attente
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as tmp_file:
            tmp_file.write(file_content)
            tmp_file_path = tmp_file.name

        try:
            jobs_status[job_id]["progress"] = 20
            result = transcribe_file_safe(tmp_file_path, language, filename, user_id)
            result["metadata"]["processing_mode"] = "async"
            
            jobs_status[job_id]["progress"] = 90
            save_cache(file_hash, result)
            stats["total_transcriptions"] += 1
            stats["async_jobs"] += 1
            
            jobs_status[job_id] = {"status": "completed", "result": result, "progress": 100}
            
        finally:
            try:
                os.unlink(tmp_file_path)
            except:
                pass
                
    except Exception as e:
        print(f"❌ Utilisateur {user_id}: Erreur async: {e}")
        jobs_status[job_id] = {"status": "error", "error": str(e)}

@app.get("/")
async def root():
    return {
        "message": "ReTexte - Réseau Local Multi-Utilisateurs", 
        "status": "ok",
        "version": "2.2.0",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "model_loaded": whisper_model is not None,
        "concurrent_support": True,
        "max_concurrent_transcriptions": MAX_CONCURRENT_TRANSCRIPTIONS,
        "current_queue_length": active_transcriptions
    }

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_SIZE,
        "device": DEVICE,
        "stats": stats,
        "active_jobs": len([j for j in jobs_status.values() if j["status"] == "processing"]),
        "model_loaded": whisper_model is not None,
        "queue_length": active_transcriptions,
        "concurrent_users": stats.get("concurrent_users", 0)
    }

@app.post("/transcribe")
async def transcribe_unified(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...), 
    language: str = "fr"
):
    """Transcription multi-utilisateurs avec file d'attente"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nom de fichier manquant")
    
    # Générer un ID utilisateur unique
    user_id = str(uuid.uuid4())[:8]
    
    file_content = await file.read()
    file_size = len(file_content)
    file_size_mb = file_size / (1024 * 1024)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"Fichier trop volumineux")
    
    print(f"📁 Utilisateur {user_id}: Fichier reçu {file.filename} ({file_size_mb:.1f}MB)")
    
    # Vérifier le cache
    file_hash = hashlib.sha256(file_content).hexdigest()
    cached_result = load_cache(file_hash)
    if cached_result:
        print(f"📋 Utilisateur {user_id}: Résultat en cache")
        return JSONResponse(content=cached_result)
    
    # Informer sur la file d'attente
    current_queue = active_transcriptions
    if current_queue > 0:
        print(f"⏳ Utilisateur {user_id}: {current_queue} transcription(s) en cours")
    
    # Décision du mode
    is_large_file = file_size > LARGE_FILE_THRESHOLD
    
    if is_large_file:
        # Mode asynchrone avec file d'attente
        job_id = str(uuid.uuid4())
        estimated_minutes = max(1, int(file_size_mb / 8))
        
        # Ajouter le temps d'attente si file d'attente
        if current_queue > 0:
            estimated_minutes += current_queue * 2  # +2min par job en attente
        
        print(f"🐘 Utilisateur {user_id}: Job asynchrone {job_id}")
        
        background_tasks.add_task(process_transcription_async, job_id, file_content, file.filename, language, user_id)
        
        return {
            "job_id": job_id, 
            "status": "queued", 
            "estimated_time_minutes": estimated_minutes,
            "queue_position": current_queue + 1,
            "mode": "async",
            "user_id": user_id
        }
    
    else:
        # Mode synchrone avec file d'attente
        print(f"🐁 Utilisateur {user_id}: Traitement synchrone")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            tmp_file.write(file_content)
            tmp_file_path = tmp_file.name
    
        try:
            result = transcribe_file_safe(tmp_file_path, language, file.filename, user_id)
            result["metadata"]["processing_mode"] = "sync"
        
            save_cache(file_hash, result)
            stats["total_transcriptions"] += 1
            stats["sync_jobs"] += 1
        
            return JSONResponse(content=result)
        
        except Exception as e:
            error_msg = f"Erreur transcription: {str(e)}"
            print(f"❌ Utilisateur {user_id}: {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
    
        finally:
            try:
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
            except Exception as cleanup_error:
                print(f"⚠️ Erreur nettoyage: {cleanup_error}")

@app.get("/transcribe/status/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in jobs_status:
        raise HTTPException(status_code=404, detail="Job non trouvé")
    
    status = jobs_status[job_id].copy()
    status["current_queue_length"] = active_transcriptions
    return status

@app.get("/transcribe/result/{job_id}")
async def get_job_result(job_id: str):
    if job_id not in jobs_status:
        raise HTTPException(status_code=404, detail="Job non trouvé")
    
    job = jobs_status[job_id]
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Job pas encore terminé")
    
    return job["result"]

@app.get("/queue/status")
async def get_queue_status():
    """Statut de la file d'attente pour tous les utilisateurs"""
    return {
        "active_transcriptions": active_transcriptions,
        "total_jobs": len(jobs_status),
        "processing_jobs": len([j for j in jobs_status.values() if j["status"] == "processing"]),
        "queued_jobs": len([j for j in jobs_status.values() if j["status"] == "queued"]),
        "model_loaded": whisper_model is not None
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 10001))
    print("🚀 Démarrage ReTexte - Réseau Local...")
    print("   👥 Support multi-utilisateurs avec file d'attente")
    print("   🎵 Une transcription à la fois (évite les conflits)")
    print()
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
