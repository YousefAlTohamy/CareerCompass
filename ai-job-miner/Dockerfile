FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and its system dependencies (Chromium)
# This fixes Windows Winsock/environment errors by running in a Linux container
RUN playwright install --with-deps chromium

# Copy source code
COPY . .

# Default command (can be overridden in docker-compose or docker run)
CMD ["bash"]
