"""
Self-hosted TTS proxy using Edge TTS (Microsoft, free, no API key).
Default voice: en-US-GuyNeural (deep male, Jarvis-like).
Endpoint: POST /tts  { "text": "...", "voice": "en-US-GuyNeural" }
Returns: audio/mpeg (MP3). Falls back to Google Translate TTS if Edge fails.
No model files, no GPU — just a fast cloud call, so cold starts are quick.
"""
import io
import os
import urllib.parse
import urllib.request
from typing import Optional

import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response

APP = FastAPI(title="Neural Link TTS", version="2.0.0")

DEFAULT_VOICE = os.environ.get("TTS_VOICE", "en-US-GuyNeural")  # deep male


async def synth_edge(text: str, voice: str) -> bytes:
    comm = edge_tts.Communicate(text, voice)
    buf = bytearray()
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            buf += chunk["data"]
    if not buf:
        raise RuntimeError("Edge TTS returned empty audio")
    return bytes(buf)


def synth_google(text: str) -> bytes:
    url = (
        "https://translate.google.com/translate_tts?ie=UTF-8&q="
        + urllib.parse.quote(text)
        + "&tl=en&client=tw-ob"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/tts")
async def tts(payload: dict):
    text = (payload or {}).get("text")
    if not text or not isinstance(text, str):
        raise HTTPException(status_code=400, detail="Provide 'text' as a string.")
    text = text.strip()
    if len(text) > 4000:
        raise HTTPException(status_code=400, detail="Text too long (max 4000 chars).")
    voice = (payload or {}).get("voice") or DEFAULT_VOICE

    try:
        audio = await synth_edge(text, voice)
        return Response(content=audio, media_type="audio/mpeg")
    except Exception as exc:  # noqa: BLE001
        # Fallback to Google Translate TTS (fast, free, no key).
        try:
            audio = synth_google(text)
            return Response(content=audio, media_type="audio/mpeg")
        except Exception:
            raise HTTPException(status_code=502, detail=f"TTS failed: {exc}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(APP, host="0.0.0.0", port=port)
