# Smart AI Scraper Engine

> **Phase 1 — Core Architecture & Design Patterns (Strategy + Factory)**  
> **Phase 2 — Smart DOM Analysis (Text Density Heuristics & Semantic Proximity)**

A highly scalable, generic web-scraping engine built with advanced software-engineering principles. The engine is designed to be **technology-agnostic**: adding a new data-source type (XML, GraphQL, browser-rendered SPA, …) requires zero changes to existing code — only a new strategy class and one line in the factory registry.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Directory Structure](#directory-structure)
3. [Phase 1: Architecture](#phase-1-architecture)
   - [Strategy Pattern](#strategy-pattern)
   - [Factory Pattern](#factory-pattern)
   - [Quick-Start Code Snippet](#quick-start-code-snippet)
4. [Phase 2: Smart DOM Analysis](#phase-2-smart-dom-analysis)
   - [Text Density Heuristic](#text-density-heuristic)
   - [DFS Density Traversal](#dfs-density-traversal)
   - [Semantic Proximity](#semantic-proximity)
   - [Phase 2 Quick-Start](#phase-2-quick-start)
5. [Installation](#installation)
6. [Testing](#testing)
7. [Roadmap](#roadmap)

---

## Project Overview

| Attribute     | Detail                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| **Language**  | Python 3.11+                                                              |
| **Async I/O** | `aiohttp` — non-blocking HTTP from day one                                |
| **Patterns**  | Strategy, Factory (Phase 1) · Observer, Chain of Responsibility (planned) |
| **Testing**   | `pytest` + `pytest-asyncio`; all network I/O is mocked                    |
| **Goal**      | A drop-in AI scraping library usable by any Python project                |

---

## Directory Structure

```
ai-engine-scraping/
│
├── core/
│   ├── __init__.py
│   ├── base_scraper.py          # Abstract Strategy interface + shared fetch_content()
│   └── heuristics.py            # Phase 2: Text Density, DFS traversal, Semantic Proximity
│
├── strategies/
│   ├── __init__.py
│   ├── html_scraper.py          # Concrete Strategy: HTML page scraper (Phase 2 heuristics)
│   └── api_scraper.py           # Concrete Strategy: JSON REST API scraper
│
├── factories/
│   ├── __init__.py
│   └── scraper_factory.py       # Factory: maps type strings → concrete strategies
│
├── tests/
│   ├── __init__.py
│   ├── test_architecture.py     # Phase 1: Factory, ABC, fetch_content tests
│   └── test_heuristics.py       # Phase 2: Density, DFS, Semantic Proximity tests
│
├── requirements.txt
└── README.md
```

---

## Phase 1: Architecture

### Strategy Pattern

**File:** `core/base_scraper.py`

The **Strategy Pattern** defines a family of algorithms, encapsulates each one, and makes them interchangeable. Here, `BaseScraper` is the _Strategy interface_:

```python
# core/base_scraper.py
from abc import ABC, abstractmethod

class BaseScraper(ABC):

    @abstractmethod
    async def scrape(self, url: str, **kwargs) -> dict:
        """Each concrete strategy implements its own scraping algorithm."""
        ...

    async def fetch_content(self, url: str, session: aiohttp.ClientSession) -> str:
        """Shared HTTP GET helper — error-handling & logging in one place."""
        ...
```

**Why?**

| Problem (without Strategy)                                                                 | Solution (with Strategy)                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| A single monolithic `scraper.py` with `if source == 'html': ... elif source == 'api': ...` | Each algorithm lives in its own class, tested independently |
| Adding new source type means editing existing code (risky)                                 | Add a new class — existing code is untouched                |
| Cannot easily swap algorithm at runtime                                                    | Swap via the Factory at construction time                   |

---

### Factory Pattern

**File:** `factories/scraper_factory.py`

The **Factory Pattern** decouples the _creation_ of objects from their _use_. Callers never import concrete strategy classes directly.

```python
# factories/scraper_factory.py
_SCRAPER_REGISTRY = {
    "html": HtmlSmartScraper,
    "api":  JsonApiScraper,
    # "xml": XmlScraper,  ← add new types here only
}

class ScraperFactory:
    @staticmethod
    def get_scraper(source_type: str) -> BaseScraper:
        scraper_class = _SCRAPER_REGISTRY.get(source_type.strip().lower())
        if scraper_class is None:
            raise ValueError(f"Unknown source type: '{source_type}'")
        return scraper_class()
```

**Why?**

| Problem (without Factory)                                   | Solution (with Factory)                                |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| Client imports `HtmlSmartScraper` directly → tight coupling | Client imports only `ScraperFactory` and `BaseScraper` |
| Changing class names breaks callers                         | Change the registry entry, callers are unaffected      |
| Cannot use dependency injection or mocking easily           | Mock the factory in tests                              |

---

### Quick-Start Code Snippet

```python
import asyncio
from factories.scraper_factory import ScraperFactory

async def main():
    # --- HTML page ---
    html_scraper = ScraperFactory.get_scraper("html")
    html_result  = await html_scraper.scrape("https://example.com")
    print(html_result["status"])   # "success"
    print(html_result["type"])     # "html"

    # --- JSON REST API ---
    api_scraper = ScraperFactory.get_scraper("api")
    api_result  = await api_scraper.scrape("https://jsonplaceholder.typicode.com/todos/1")
    print(api_result["status"])    # "success"
    print(api_result["content"])   # {"userId": 1, "id": 1, "title": "...", "completed": False}

    # --- Unknown type → explicit error ---
    try:
        ScraperFactory.get_scraper("graphql")
    except ValueError as e:
        print(e)  # Unknown source type: 'graphql'. Supported types are: ['api', 'html'].

asyncio.run(main())
```

---

## Installation

```bash
# 1. Navigate into the project directory
cd ai-engine-scraping

# 2. (Recommended) Create & activate a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

---

## Testing

All tests use `pytest` with the `pytest-asyncio` plugin. **No real network calls are made** — all HTTP I/O is mocked with `unittest.mock`.

```bash
# Run the full test suite from the ai-engine-scraping/ directory
pytest tests/ -v
```

### What is tested

| Test Class                   | Coverage                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `TestScraperFactory`         | Correct type instantiation, case-insensitivity, `ValueError` on unknown/empty types, new-instance-per-call guarantee |
| `TestBaseScraperAbstraction` | Direct instantiation raises `TypeError`, incomplete subclass raises `TypeError`, complete subclass works             |
| `TestFetchContent`           | Success path, HTTP 4xx/5xx error, timeout, connection error, unexpected exception                                    |
| `TestHtmlSmartScraper`       | End-to-end `scrape()` success and error result structures                                                            |
| `TestJsonApiScraper`         | End-to-end `scrape()` with valid JSON, invalid JSON body                                                             |

Expected output:

```
collected 19 items

tests/test_architecture.py::TestScraperFactory::test_get_scraper_html_returns_html_scraper PASSED
tests/test_architecture.py::TestScraperFactory::test_get_scraper_api_returns_json_api_scraper PASSED
...
19 passed in 0.XXs
```

---

## Phase 2: Smart DOM Analysis

**Files:** `core/heuristics.py` · `strategies/html_scraper.py` (updated)

Phase 2 eliminates the need for brittle, site-specific CSS selectors or XPath expressions.
Instead, we use three complementary **CS algorithms** to extract structured data from _any_ HTML page.

---

### Text Density Heuristic

> **CS Concept:** Signal-to-noise ratio applied to DOM trees.

Each DOM node is scored by how much meaningful text it carries relative to its markup complexity:

```
density = len(stripped_text) / (num_direct_child_tags + 1)
```

| Node Type                       | Characters | Child Tags | Density Score |
| ------------------------------- | ---------- | ---------- | ------------- |
| Job description `<div>` (prose) | 800        | 2          | **400.0** 🏆  |
| Navigation `<nav>` (many links) | 60         | 15         | 3.75          |
| Footer `<div>` (copyright)      | 80         | 4          | 16.0          |

The job description **always wins** — not because of its class name, but because of its content.

This approach is inspired by _Boilerplate Detection Using Shallow Text Features_ (Kohlschütter et al., WWW 2010).

---

### DFS Density Traversal

> **CS Concept:** Depth-First Search over a tree (O(n) — each node visited once).

`find_highest_density_node` runs a full DFS over all `<div>`, `<section>`, `<article>`, and `<main>` tags, scores each with the density formula, and returns the **globally highest-scoring node's text** — the job description.

```python
# core/heuristics.py
def find_highest_density_node(soup: BeautifulSoup, min_length: int = 200) -> str | None:
    best_node, best_score = None, -1.0
    for node in soup.find_all({"div", "section", "article", "main"}):
        score = get_text_density(node)
        if score > best_score and len(node.get_text()) >= min_length:
            best_score, best_node = score, node
    return best_node.get_text() if best_node else None
```

**Why no hardcoded selectors?** The same algorithm works on Indeed, LinkedIn, Glassdoor, or any custom job board — no per-site configuration required.

---

### Semantic Proximity

> **CS Concept:** Graph neighbour traversal (sibling walk) for label–value pair extraction.

`extract_semantic_sibling` finds a keyword (e.g. `"Salary"`) anywhere in the tree, then walks **next siblings** to retrieve the adjacent value — handling all four common HTML patterns:

| HTML Pattern    | Example                                     | Handles? |
| --------------- | ------------------------------------------- | -------- |
| Inline sibling  | `<span>Salary:</span><strong>$80k</strong>` | ✅       |
| Definition list | `<dt>Salary</dt><dd>$80k</dd>`              | ✅       |
| Table cells     | `<td>Pay</td><td>$120k</td>`                | ✅       |
| Inline text     | `<li>Salary: $80k – $100k</li>`             | ✅       |

Synonym keywords (`pay`, `compensation`, `remuneration`, `wage`, `stipend`) are tried in priority order — so even non-standard salary labels are captured.

---

### Phase 2 Quick-Start

```python
import asyncio
from factories.scraper_factory import ScraperFactory

async def main():
    scraper = ScraperFactory.get_scraper("html")
    result  = await scraper.scrape("https://example-jobs.com/listing/123")

    # result["description"] → full job description text (no CSS class needed)
    # result["salary_hint"] → extracted salary string, or None
    print(result["description"][:200])
    print(result["salary_hint"])

asyncio.run(main())
```

---

## Installation

```bash
# 1. Navigate into the project directory
cd ai-engine-scraping

# 2. (Recommended) Create & activate a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

---

## Testing

All tests use `pytest` with the `pytest-asyncio` plugin. **No real network calls are made** — all HTTP I/O is mocked with `unittest.mock`, and all heuristic tests use inline HTML strings.

```bash
# Run the full test suite from the ai-engine-scraping/ directory
pytest tests/ -v
```

### What is tested

| Test File              | Test Class                   | Coverage                                           |
| ---------------------- | ---------------------------- | -------------------------------------------------- |
| `test_architecture.py` | `TestScraperFactory`         | Factory dispatch, case-insensitivity, `ValueError` |
| `test_architecture.py` | `TestBaseScraperAbstraction` | ABC enforcement                                    |
| `test_architecture.py` | `TestFetchContent`           | Success, HTTP error, timeout, connection error     |
| `test_architecture.py` | `TestHtmlSmartScraper`       | End-to-end success/error                           |
| `test_architecture.py` | `TestJsonApiScraper`         | Valid + invalid JSON                               |
| `test_heuristics.py`   | `TestGetTextDensity`         | Density formula, leaf nodes, noisy nodes           |
| `test_heuristics.py`   | `TestFindHighestDensityNode` | DFS picks correct div by density, ignores noise    |
| `test_heuristics.py`   | `TestExtractSemanticSibling` | All 4 HTML patterns + synonyms + edge cases        |
| `test_heuristics.py`   | `TestIntegration`            | End-to-end on realistic job-listing HTML           |

---

## Roadmap

| Phase    | Feature                                                                            |
| -------- | ---------------------------------------------------------------------------------- |
| ✅ **1** | Strategy + Factory patterns, `BaseScraper`, HTML & API strategies, full test suite |
| ✅ **2** | DOM DFS Text-Density walker, Semantic Proximity salary extraction, heuristic tests |
| 🔲 **3** | AI-powered field extraction (OpenAI / local LLM integration)                       |
| 🔲 **4** | Observer Pattern for pipeline events (pre-fetch, post-parse, on-error hooks)       |
| 🔲 **5** | Async rate-limiting, retry with exponential back-off, proxy rotation               |
| 🔲 **6** | REST API wrapper (FastAPI) exposing the engine as a service                        |
