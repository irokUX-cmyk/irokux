# Neural Link TTS proxy — Edge TTS (Microsoft, free, no API key, male voice).
# No model files; just a fast cloud call, so cold starts are quick on free tier.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV PORT=8000
ENV TTS_VOICE=en-US-GuyNeural
EXPOSE 8000

CMD ["python", "app.py"]
