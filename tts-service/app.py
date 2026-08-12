"""
Self-hosted TTS service using Piper (free, open-source, tiny footprint).
Serves a deep male "Jarvis-like" voice (en_US-libritts_r-medium) by default.
Endpoint: POST /tts  { "text": "...", "voice": "en_US-libritts_r-medium" }
Returns: audio/wav (22.05kHz mono).
"""
import io
import os
import wave
from typing import Optional

import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response

# Piper is imported lazily so healthz works before the (small) model load.
APP = FastAPI(title="Neural Link TTS", version="1.0.0")

# Piper needs the onnx model + json config. We download them at startup if absent.
VOICE_DIR = os.environ.get("PIPER_VOICE_DIR", "/app/piper_voice")
DEFAULT_VOICE = os.environ.get("TTS_VOICE", "en_US-libritts_r-medium")
_Synthesizer = None


def get_synthesizer(voice: str):
    global _Synthesizer
    if _Synthesizer is None:
        from piper import PiperVoice
        model_path = os.path.join(VOICE_DIR, f"{voice}.onnx")
        config_path = os.path.join(VOICE_DIR, f"{voice}.onnx.json")
        if not os.path.exists(model_path) or not os.path.exists(config_path):
            # Download the voice files on first use (cached afterwards).
            base = (
                "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
                f"en/en_US/libritts_r/medium/{voice}"
            )
            urllib.request.urlretrieve(f"{base}.onnx", model_path)
            urllib.request.urlretrieve(f"{base}.onnx.json", config_path)
        _Synthesizer = PiperVoice.load(model_path, config_path=config_path)
    return _Synthesizer


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
        synth = get_synthesizer(voice)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_file:
            synth.synthesize_wav(text, wav_file)
        return Response(content=buf.getvalue(), media_type="audio/wav")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {exc}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(APP, host="0.0.0.0", port=port)
