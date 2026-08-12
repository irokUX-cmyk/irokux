"""
Self-hosted TTS service using Kokoro ONNX (free, open-source).
Serves a deep male "Jarvis-like" voice (bm_george) by default.
Endpoint: POST /tts  { "text": "...", "voice": "bm_george" }
Returns: audio/wav (24kHz mono).
"""
import io
import os
from typing import Optional

import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from kokoro_onnx import Kokoro

MODEL_PATH = os.environ.get("KOKORO_MODEL", "kokoro-v1.0.fp16.onnx")
VOICES_PATH = os.environ.get("KOKORO_VOICES", "voices-v1.0.bin")
DEFAULT_VOICE = os.environ.get("TTS_VOICE", "bm_george")  # deep male British

app = FastAPI(title="Neural Link TTS", version="1.0.0")

# Lazy-load the model (large file) on first request.
_KOKORO = None


def get_kokoro() -> Kokoro:
    global _KOKORO
    if _KOKORO is None:
        if not os.path.exists(MODEL_PATH) or not os.path.exists(VOICES_PATH):
            raise RuntimeError("Kokoro model files not found")
        _KOKORO = Kokoro(model_path=MODEL_PATH, voices_path=VOICES_PATH)
    return _KOKORO


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
        audio, sr = kokoro.create(text, voice=voice, speed=1.0, lang="en-us")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {exc}")

    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
