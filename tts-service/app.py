"""
Self-hosted TTS service using Kokoro ONNX (free, open-source).
Default voice: bm_george (deep male, Jarvis-like).
Endpoint: POST /tts  { "text": "...", "voice": "bm_george" }
Returns: audio/wav (24kHz mono).
"""
import io
import os
import urllib.request
from typing import Optional

import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response

APP = FastAPI(title="Neural Link TTS", version="1.0.0")

MODEL_PATH = os.environ.get("KOKORO_MODEL", "kokoro-v0_19.int8.onnx")
VOICES_PATH = os.environ.get("KOKORO_VOICES", "voices.bin")
DEFAULT_VOICE = os.environ.get("TTS_VOICE", "bm_george")
_Kokoro = None


def get_kokoro():
    global _Kokoro
    if _Kokoro is None:
        from kokoro_onnx import Kokoro
        if not os.path.exists(MODEL_PATH) or not os.path.exists(VOICES_PATH):
            raise RuntimeError("Kokoro model/voices files not found")
        _Kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
    return _Kokoro


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/tts")
def tts(payload: dict):
    text = (payload or {}).get("text")
    if not text or not isinstance(text, str):
        raise HTTPException(status_code=400, detail="Provide 'text' as a string.")
    text = text.strip()
    if len(text) > 4000:
        raise HTTPException(status_code=400, detail="Text too long (max 4000 chars).")
    voice = (payload or {}).get("voice") or DEFAULT_VOICE

    try:
        kokoro = get_kokoro()
        audio, sr = kokoro.create(text, voice)
        buf = io.BytesIO()
        sf.write(buf, audio, sr, format="WAV")
        return Response(content=buf.getvalue(), media_type="audio/wav")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {exc}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(APP, host="0.0.0.0", port=port)
