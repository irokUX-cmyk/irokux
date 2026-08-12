# Self-hosted Kokoro TTS service (free, open-source, male "Jarvis-like" voice).
# Uses the int8 quantized model (~88MB) so it fits Render's 512MB free tier.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 curl ca-certificates espeak-ng && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the int8 Kokoro model + voices at build time (baked into image).
RUN curl -L -o kokoro-v0_19.int8.onnx \
      https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.int8.onnx && \
    curl -L -o voices.bin \
      https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.bin

COPY app.py .

ENV PORT=8000
ENV TTS_VOICE=bm_george
EXPOSE 8000

CMD ["python", "app.py"]
