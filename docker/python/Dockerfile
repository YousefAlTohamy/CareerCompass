FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

# Set working directory to the root of our virtual container app
WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Copy the requirements files first to leverage Docker's layer caching.
# We copy all three directories to catch any requirements.txt files.
# The wildcard ensures COPY doesn't fail if a file doesn't exist.
COPY ./ai-cv-analyzer/requirements.txt /app/ai-cv-analyzer/requirements.txt
COPY ./ai-job-miner/requirements.txt /app/ai-job-miner/requirements.txt
COPY ./ai-hybrid-orchestrator/requirements.txt* /app/ai-hybrid-orchestrator/

# Install dependencies from all available requirements.txt
RUN pip install --no-cache-dir -r /app/ai-cv-analyzer/requirements.txt \
    && pip install --no-cache-dir -r /app/ai-job-miner/requirements.txt \
    && if [ -f "/app/ai-hybrid-orchestrator/requirements.txt" ]; then pip install --no-cache-dir -r /app/ai-hybrid-orchestrator/requirements.txt; fi

# Explicitly install the Chromium browser for Playwright
RUN playwright install chromium

# The actual source code will be mapped via volumes for hot-reloading during development.
# We set the working directory to the orchestrator which serves as the entry point.
WORKDIR /app/ai-hybrid-orchestrator

# Run the FastAPI server via Uvicorn with hot-reload enabled
CMD ["uvicorn", "main_api:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
