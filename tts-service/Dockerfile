# Self-hosted Kokoro TTS service (free, open-source, male "Jarvis-like" voice).
FROM python:3.11-slim

# System deps for soundfile/onnxruntime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Kokoro model + voices at build time so they are baked into the image
# (avoids slow runtime downloads on Render's free tier).
RUN curl -L -o kokoro-v1.0.onnx \
      https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx && \
    curl -L -o voices-v1.0.bin \
      https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

COPY app.py .

ENV PORT=8000
EXPOSE 8000

CMD ["python", "app.py"]
