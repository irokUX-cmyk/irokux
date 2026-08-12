# Self-hosted Piper TTS service (free, open-source, tiny ~50MB, male "Jarvis-like" voice).
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 curl ca-certificates espeak-ng && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download a deep male Piper voice (libritts_r-medium) at build time so it is
# baked into the image. ~50MB — fits the free tier's 512MB RAM comfortably.
RUN mkdir -p piper_voice && \
    curl -L -o piper_voice/en_US-libritts_r-medium.onnx \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx && \
    curl -L -o piper_voice/en_US-libritts_r-medium.onnx.json \
      https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx.json

COPY app.py .

ENV PORT=8000
ENV PIPER_VOICE_DIR=/app/piper_voice
ENV TTS_VOICE=en_US-libritts_r-medium
EXPOSE 8000

CMD ["python", "app.py"]
