FROM python:3.11-slim

RUN pip install --no-cache-dir fastapi uvicorn

RUN apt-get update && apt-get install -y curl ca-certificates && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/piper.tar.gz \
    https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz && \
    tar -xzf /tmp/piper.tar.gz -C /usr/local && \
    rm /tmp/piper.tar.gz

RUN mkdir -p /voices && \
    curl -fsSL -o /voices/es.onnx \
    https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_MX/claude/high/es_MX-claude-high.onnx && \
    curl -fsSL -o /voices/es.onnx.json \
    https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/es/es_MX/claude/high/es_MX-claude-high.onnx.json

COPY server.py /app/
WORKDIR /app

EXPOSE 5000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5000"]
