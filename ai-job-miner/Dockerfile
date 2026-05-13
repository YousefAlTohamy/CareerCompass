FROM python:3.11-slim

WORKDIR /app

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN python -m pip install --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --retries 10 --timeout 300 -r requirements.txt

# Install Playwright and its system dependencies (Chromium)
# This fixes Windows Winsock/environment errors by running in a Linux container
RUN playwright install --with-deps chromium

# Copy source code
COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "service_api:app", "--host", "0.0.0.0", "--port", "8000"]
