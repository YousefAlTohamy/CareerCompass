FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

# Set working directory to the root of our virtual container app
WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy the requirements files first to leverage Docker's layer caching.
COPY ./ai-cv-analyzer/requirements.txt /app/ai-cv-analyzer/requirements.txt
COPY ./ai-job-miner/requirements.txt /app/ai-job-miner/requirements.txt

# Install dependencies from all available requirements.txt
RUN pip install --no-cache-dir -r /app/ai-cv-analyzer/requirements.txt \
    && pip install --no-cache-dir -r /app/ai-job-miner/requirements.txt

# Explicitly install the Chromium browser for Playwright
RUN playwright install chromium

# The actual source code will be mapped via volumes for hot-reloading during development.
# We set the working directory to the orchestrator which serves as the entry point.
WORKDIR /app/ai-hybrid-orchestrator

# Run the FastAPI server via Uvicorn with hot-reload enabled
CMD ["uvicorn", "main_api:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
