# Self-hosted Piper TTS service (free, open-source, tiny ~50MB, male "Jarvis-like" voice).
# Uses espeakng-loader (pip) so no system espeak-ng apt package is needed.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Voice model is downloaded at runtime (first request) into this dir and cached.
RUN mkdir -p /app/piper_voice
ENV PIPER_VOICE_DIR=/app/piper_voice
ENV TTS_VOICE=en_US-libritts_r-medium

COPY app.py .

ENV PORT=8000
EXPOSE 8000

CMD ["python", "app.py"]
