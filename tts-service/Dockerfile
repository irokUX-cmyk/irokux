# Self-hosted Kokoro TTS service (free, open-source, male "Jarvis-like" voice).
# Uses the standard fp32 v1.0 model from model-files-v1.0 (proven to build + synth).
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN curl -L -o kokoro-v1.0.onnx \
      https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx && \
    curl -L -o voices-v1.0.bin \
      https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

COPY app.py .

ENV PORT=8000
ENV TTS_VOICE=bm_george
EXPOSE 8000

CMD ["python", "app.py"]
