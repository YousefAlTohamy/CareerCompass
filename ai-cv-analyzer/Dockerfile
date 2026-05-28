FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install dependencies with retries because the AI package set is large and
# demo-machine networks can time out during PyPI downloads.
RUN pip install --no-cache-dir --retries 10 --timeout 300 -r requirements.txt

# Copy source code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Start FastAPI application on port 8000 as requested
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
