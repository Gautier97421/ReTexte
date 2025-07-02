import os
import time
from pathlib import Path

def cleanup_cache():
    CACHE_DIR = Path(__file__).parent / "cache"
    MAX_AGE_DAYS = 5
    now = time.time()

    for file in CACHE_DIR.iterdir():
        if file.is_file():
            age_days = (now - file.stat().st_mtime) / 86400
            if age_days > MAX_AGE_DAYS:
                print(f"Suppression du cache trop vieux : {file}")
                file.unlink()

if __name__ == "__main__":
    cleanup_cache()
