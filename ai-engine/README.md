# CareerCompass AI Engine 🤖

> **Python FastAPI Microservice** for CV parsing, skill extraction, and job scraping

## 📋 Overview

The AI Engine is a FastAPI-based microservice that provides intelligent CV analysis and job scraping capabilities for the CareerCompass platform. It uses NLP (spaCy) and fuzzy matching to extract skills from CVs and scrapes job listings from Wuzzuf.net.

---

## ✨ Features

- **PDF Parsing** - Extract text from PDF CVs using PDFMiner.six
- **Skill Extraction** - Advanced dual-mode:
- **Skill Extraction** - Advanced dual-mode:
  - **NLP-based Extraction** (Primary) - Uses spaCy for contextual extraction and dynamic skill discovery
  - **Fuzzy Matching** (Fallback) - Fast, efficient string matching for predefined lists
- **Hybrid Job Scraping** - Multi-source dynamic dispatch across:
  - **API Sources** (Remotive API, Adzuna US API)
  - **HTML Sources** (Wuzzuf via undetected-chromedriver)
- **Skill Frequency Analysis** - Calculate skill demand statistics from scraped jobs
- **Sample Jobs** - Built-in test data for offline development
- **RESTful API** - 7 endpoints with automatic OpenAPI documentation
- **CORS Enabled** - Ready for cross-origin requests from frontend/backend

---

## 🏗️ Architecture

```
ai-engine/
├── .env                 # API credentials (e.g., ADZUNA_APP_ID/KEY)
├── .gitignore           # Python ignored files
├── main.py              # FastAPI application & API endpoints
├── parser.py            # PDF text extraction using PDFMiner
├── extractor.py         # Skill extraction (fuzzy + NLP)
├── scraper.py           # Hybrid scraper dispatcher & job processing
├── api_fetcher.py       # Remotive & Adzuna API fetchers
├── html_scraper.py      # Wuzzuf HTML scraper (undetected-chromedriver)
├── test_engine.py       # Unit tests for CV analysis
├── test_scraper.py      # /test-source FastAPI router and tester
├── requirements.txt     # Python dependencies
├── README.md            # AI Engine documentation
└── venv/                # Virtual environment (created during setup)
```

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.11+ - [Download](https://www.python.org/)
- **pip** - Usually comes with Python

### Installation

#### 1️⃣ Navigate to AI Engine Directory

```bash
cd ai-engine
```

#### 2️⃣ Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate        # Windows
# OR
source venv/bin/activate     # macOS/Linux
```

You should see `(venv)` in your terminal prompt.

#### 3️⃣ Install Dependencies

```bash
# Install all required packages
pip install -r requirements.txt
```

**Dependencies installed:**

- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `python-multipart` - File upload support
- `spacy` - NLP library
- `pdfminer.six` - PDF parsing
- `fuzzywuzzy` - Fuzzy string matching
- `python-Levenshtein` - Fast string comparison
- `requests` - HTTP client
- `beautifulsoup4` - Web scraping
- `lxml` - HTML/XML parser

#### 4️⃣ Download spaCy Language Model (Required)

```bash
# Download English language model (~50MB)
python -m spacy download en_core_web_sm
```

> **Note**: This is required for dynamic NLP skill extraction, which allows the AI engine to discover new skills not present in the predefined list.

---

## ▶️ Running the Server

### Start the AI Engine

```bash
# Make sure virtual environment is activated
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# Start the server
uvicorn main:app --reload --port 8001
```

**Output:**

```
INFO:     Uvicorn running on http://127.0.0.1:8001 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Access the API

- **API Base URL**: http://127.0.0.1:8001
- **Interactive Docs** (Swagger UI): http://127.0.0.1:8001/docs
- **Alternative Docs** (ReDoc): http://127.0.0.1:8001/redoc

---

## 🔌 API Endpoints

### 1. Health Check

**GET** `/`

Check if the service is running.

```bash
curl http://127.0.0.1:8001/
```

**Response:**

```json
{
  "service": "CareerCompass AI Engine",
  "status": "running",
  "version": "1.0.0"
}
```

---

### 2. Get Predefined Skills

**GET** `/skills`

Retrieve the complete list of 84 predefined skills.

```bash
curl http://127.0.0.1:8001/skills
```

**Response:**

```json
{
  "technical": ["Python", "Laravel", "React", "..."],
  "soft": ["Communication", "Teamwork", "Leadership", "..."],
  "total": 84
}
```

---

### 3. Analyze CV

**POST** `/analyze`

Upload a CV (PDF) and extract skills automatically.

**Parameters:**

- `file` (required) - PDF file
- `use_nlp` (optional, default: false) - Use NLP-based extraction

**Example (using curl):**

```bash
curl -X POST http://127.0.0.1:8001/analyze \
  -F "file=@sample_cv.pdf" \
  -F "use_nlp=false"
```

**Example (using Python requests):**

```python
import requests

with open('sample_cv.pdf', 'rb') as f:
    response = requests.post(
        'http://127.0.0.1:8001/analyze',
        files={'file': f},
        params={'use_nlp': False}
    )
    print(response.json())
```

**Response:**

```json
{
  "filename": "sample_cv.pdf",
  "skills": [
    { "name": "Python", "type": "technical" },
    { "name": "Leadership", "type": "soft" },
    { "name": "New Dynamic Skill", "type": "technical" }
  ],
  "total_skills": 3,
  "technical_skills": [
    { "name": "Python", "type": "technical" },
    { "name": "New Dynamic Skill", "type": "technical" }
  ],
  "soft_skills": [{ "name": "Leadership", "type": "soft" }],
  "text_length": 3542,
  "status": "success"
}
```

---

### 4. Extract Text Only

**POST** `/extract-text`

Extract raw text from a PDF without skill analysis.

```bash
curl -X POST http://127.0.0.1:8001/extract-text \
  -F "file=@sample_cv.pdf"
```

**Response:**

```json
{
  "filename": "sample_cv.pdf",
  "text": "John Doe\nSoftware Engineer\n...",
  "length": 3542,
  "status": "success"
}
```

---

### 5. Scrape Jobs

**POST** `/scrape-jobs`

Fetch job listings using the hybrid scraping strategy. It accepts a `sources` array to dynamically dispatch scraping across API and HTML sources (Remotive, Adzuna, Wuzzuf).

**Request Body (JSON):**

```json
{
  "query": "PHP Developer",
  "max_results": 20,
  "use_samples": false,
  "calculate_statistics": true,
  "sources": [
    {
      "name": "Remotive Software Dev Jobs",
      "endpoint": "https://remotive.com/api/remote-jobs",
      "type": "api",
      "params": { "category": "software-dev" }
    }
  ]
}
```

**Example:**

```bash
curl -X POST http://127.0.0.1:8001/scrape-jobs \
  -H "Content-Type: application/json" \
  -d '{"query": "Python Developer", "max_results": 10, "use_samples": false}'
```

**Response:**

```json
{
  "success": true,
  "query": "Python Developer",
  "total_jobs": 10,
  "jobs": [
    {
      "title": "Senior Python Developer",
      "company": "Tech Corp",
      "description": "...",
      "url": "https://remotive.com/remote-jobs/...",
      "source": "remotive",
      "skills": ["Python", "Django", "REST API"]
    }
  ],
  "source": "hybrid",
  "statistics": {
    "skills": {
      "PHP": {
        "count": 10,
        "percentage": 100.0,
        "importance": "essential",
        "type": "technical"
      },
      "Laravel": {
        "count": 8,
        "percentage": 80.0,
        "importance": "essential",
        "type": "technical"
      }
    },
    "total_unique_skills": 15,
    "average_skills_per_job": 5.5
  }
}
```

> **Tip**: Set `"use_samples": true` to get sample jobs for testing without actual web scraping.

---

### 6. Test Single Source

**POST** `/test-source`

Probe a single scraping source for diagnostics. This is used by the Laravel admin dashboard to verify source health.

**Request Body (JSON):**

```json
{
  "name": "Adzuna US Tech Jobs",
  "endpoint": "https://api.adzuna.com/v1/api/jobs/us/search/1",
  "type": "api"
}
```

**Response:**

Returns a structured status indicating whether the source returned jobs successfully.

---

### 7. Scraper Status

**GET** `/scrape-jobs/status`

Check scraper service status and configuration. Note that NLP extraction is widely used in scraping for identifying new skills in real-time.

```bash
curl http://127.0.0.1:8001/scrape-jobs/status
```

**Response:**

```json
{
  "service": "Job Scraper",
  "status": "operational",
  "supported_sources": ["wuzzuf", "samples"],
  "rate_limit": "2 seconds between requests",
  "max_pages": 10
}
```

---

## 🧪 Testing

### Test CV Analysis

```bash
# Activate virtual environment first
venv\Scripts\activate  # or source venv/bin/activate

# Run CV analysis tests
python test_engine.py
```

**What it tests:**

- Skill extraction from predefined skills
- Text cleaning functions
- Multiple extraction methods

### Test Job Scraper

```bash
python test_scraper.py
```

**What it tests:**

- Sample job generation
- Job data structure validation
- Skill detection in job descriptions

---

## 🛠️ Technical Details

### Skill Extraction Methods

#### 1. NLP-based (Primary - Recommended)

- **Speed**: Moderate (~300ms for typical CV)
- **Accuracy**: Better for contextual understanding and dynamic discovery
- **Method**: Uses spaCy for noun chunks and token analysis
- **Requires**: `en_core_web_sm` model

**Advantages:**

- Allows for **dynamic skill creation** by finding skills not in any list
- Better context awareness
- Handles abbreviations and complex phrases better

#### 2. Fuzzy Matching (Fallback)

- **Speed**: Very fast (~50-100ms for typical CV)
- **Accuracy**: High for exact and near-exact matches to the predefined 84 skills
- **Method**: Uses FuzzyWuzzy with Levenshtein distance
- **Threshold**: 85% similarity (or token exact match)

**Advantages:**

- No model download required (if bypassing NLP)
- Faster processing
- Lower memory usage
- Works entirely offline with the seeded lists

### PDF Parsing

Uses **PDFMiner.six** for text extraction:

- Handle multi-page PDFs
- Extract text preserving layout
- Automatic text cleaning (remove extra whitespace, special chars)

### Hybrid Web Scraping

**Dynamic Dispatcher (`scraper.py`)**
Routes scraping requests to the appropriate module based on the source's `type` (API vs HTML). Built with error isolation so one failing source does not stop the others.

**API Fetchers (`api_fetcher.py`):**

- **Remotive API**: Fetches remote software dev jobs natively via JSON.
- **Adzuna API**: Fetches tech jobs (US). Uses `ai-engine/.env` for `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`. Includes User-Agent spoofing to bypass blocks.

**HTML Scrapers (`html_scraper.py`):**

- **Wuzzuf**: Uses `undetected-chromedriver` and `BeautifulSoup4` to parse complex job cards while bypassing anti-bot measures.
- Scrapes: title, company, description, URL.

**Common Scraping Features:**

- Respects rate limits with randomized delays (0.5 - 2s)
- Automatic duplicate prevention (URL-based deduplication)
- Fast fuzzy and NLP skill extraction per-job

**Sample Jobs:**

- 10+ predefined sample jobs for testing
- Covers various tech roles
- No internet connection required

---

## 📊 Performance Metrics

| Operation           | Average Time | Memory Usage |
| ------------------- | ------------ | ------------ |
| PDF Text Extraction | ~100ms       | ~10MB        |
| Fuzzy Skill Extract | ~50ms        | ~5MB         |
| NLP Skill Extract   | ~300ms       | ~100MB       |
| Scrape Single Page  | ~3s          | ~20MB        |

---

## 🐛 Troubleshooting

### Import Errors

```bash
# Ensure virtual environment is activated
venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt --upgrade
```

### spaCy Model Not Found

```bash
# Download the English model
python -m spacy download en_core_web_sm

# Verify installation
python -c "import spacy; nlp = spacy.load('en_core_web_sm'); print('✅ Model loaded!')"
```

### PDF Parsing Errors

**Issue**: Cannot extract text from scanned PDFs
**Solution**: The engine only supports text-based PDFs. For scanned documents, OCR preprocessing is required.

**Issue**: Encoding errors
**Solution**: PDFMiner handles most encodings automatically. Ensure PDFs are not corrupted.

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :8001
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8001 | xargs kill -9

# Or use a different port
uvicorn main:app --reload --port 8002
```

### Scraping Returns Empty Results

1. **Check internet connection**
2. **Website structure changed** - Update selectors in `scraper.py`
3. **Use sample mode for testing**:
   ```json
   { "query": "Developer", "use_samples": true }
   ```

---

## 🔧 Configuration

### Environment Variables (Optional)

Create a `.env` file for custom configuration:

```env
# Server Configuration
HOST=0.0.0.0
PORT=8001

# Logging
LOG_LEVEL=INFO

# Scraper Settings
SCRAPER_DELAY=2  # Seconds between requests
SCRAPER_TIMEOUT=10  # Request timeout
MAX_SCRAPE_PAGES=10
```

Load in `main.py`:

```python
from dotenv import load_dotenv
load_dotenv()
```

---

## 🔗 Integration with Laravel Backend

The AI Engine is designed to work seamlessly with the Laravel backend:

**Laravel makes HTTP requests to AI Engine:**

```php
$response = Http::timeout(30)
    ->attach('file', $pdfContent, 'cv.pdf')
    ->post('http://127.0.0.1:8001/analyze', [
        'use_nlp' => false
    ]);
```

**CORS is already configured** to allow all origins in development.

---

## 📚 Module Documentation

### `main.py`

FastAPI application with 7 endpoints, CORS configuration, and request validation.

### `parser.py`

- `extract_text_from_pdf(pdf_path)` - Extract text from PDF file
- `clean_text(text)` - Remove extra whitespace and special characters

### `extractor.py`

- `extract_skills_from_text(text)` - Fuzzy matching extraction (fast)
- `extract_skills_with_nlp(text)` - NLP-based extraction (accurate)
- `get_predefined_skills()` - Return all 84 skills

### `scraper.py`

- `scrape_wuzzuf(query, max_pages)` - Scrape jobs from Wuzzuf
- `scrape_sample_jobs(count)` - Generate sample jobs for testing

---

## 📦 Dependencies

| Package            | Version  | Purpose                |
| ------------------ | -------- | ---------------------- |
| fastapi            | 0.115.0  | Web framework          |
| uvicorn[standard]  | 0.32.1   | ASGI server            |
| python-multipart   | 0.0.20   | File upload support    |
| spacy              | 3.8.11   | Core NLP processing    |
| pdfminer.six       | 20231228 | PDF text extraction    |
| fuzzywuzzy         | 0.18.0   | Fuzzy string matching  |
| python-Levenshtein | 0.27.1   | Fast string comparison |
| requests           | 2.32.3   | HTTP client            |
| beautifulsoup4     | 4.12.3   | HTML parsing           |
| lxml               | 5.3.0    | XML/HTML processor     |

---

## 🎯 Usage Examples

### Example 1: Analyze CV with Fuzzy Matching

```python
import requests

url = "http://127.0.0.1:8001/analyze"

with open("my_cv.pdf", "rb") as f:
    files = {"file": f}
    params = {"use_nlp": False}

    response = requests.post(url, files=files, params=params)
    result = response.json()

    print(f"Found {result['total_skills']} skills:")
    for skill in result['skills']:
        print(f"  - {skill['name']} ({skill['type']})")
```

### Example 2: Scrape Jobs with Sample Data

```python
import requests

url = "http://127.0.0.1:8001/scrape-jobs"
payload = {
    "query": "Web Developer",
    "max_results": 5,
    "use_samples": True  # Use sample data for testing
}

response = requests.post(url, json=payload)
result = response.json()

print(f"Found {result['total_jobs']} jobs:")
for job in result['jobs']:
    print(f"\n{job['title']} at {job['company']}")
    print(f"Skills: {', '.join(job['skills'])}")
```

### Example 3: Get All Available Skills

```python
import requests

response = requests.get("http://127.0.0.1:8001/skills")
skills = response.json()

print(f"Technical Skills ({len(skills['technical'])}): {', '.join(skills['technical'][:5])}...")
print(f"Soft Skills ({len(skills['soft'])}): {', '.join(skills['soft'][:5])}...")
```

---

## 🚀 Production Deployment

### Security Recommendations

1. **Update CORS settings** in `main.py`:

   ```python
   allow_origins=["https://your-frontend.com", "https://your-backend.com"]
   ```

2. **Add authentication** for sensitive endpoints

3. **Rate limiting** to prevent abuse

   ```bash
   pip install slowapi
   ```

4. **Use environment variables** for configuration

5. **Enable HTTPS** with reverse proxy (nginx/Apache)

### Performance Optimization

1. **Use workers** for parallel processing:

   ```bash
   uvicorn main:app --workers 4 --port 8001
   ```

2. **Cache predefined skills** in memory (already implemented)

3. **Implement request queueing** for job scraping

4. **Monitor with logging**:
   ```bash
   uvicorn main:app --log-level info --access-log
   ```

---

## 📄 License

This AI Engine is part of the CareerCompass graduation project - MIT License

---

## 👥 Authors

CareerCompass Team - Graduation Project 2026

---

**Last Updated**: March 2026  
**Version**: 1.2.0  
**Status**: ✅ Production Ready (with NLP capabilities, Phase 21 Compliant)
