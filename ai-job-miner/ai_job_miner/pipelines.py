import os
import json
import logging
import re
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem

# Import NER extractor from our AI module
from ai.ner_extractor import CustomSkillExtractor

import httpx

logger = logging.getLogger(__name__)

class DeduplicationPipeline:
    """
    Prevents sending the same job posting to the backend multiple times during a single run.
    Uses a simple memory set. Also queries the Laravel backend for persistent deduplication.
    """
    def __init__(self):
        self.seen_urls = set()
        self.api_check_url = os.getenv('LARAVEL_API_CHECK_URL', 'http://127.0.0.1:8000/api/jobs/import/check')
        self.api_token = os.getenv('LARAVEL_API_TOKEN', '')
        self.request_id = os.getenv('REQUEST_ID', '')
        
        transport = httpx.AsyncHTTPTransport(retries=1)
        self.client = httpx.AsyncClient(transport=transport, timeout=5.0)

    async def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        url = adapter.get('url')
        
        if not url:
            return item

        if url in self.seen_urls:
            raise DropItem(f"Duplicate job found in local cache: {url}")
            
        self.seen_urls.add(url)

        if not self.api_token:
            logger.warning("LARAVEL_API_TOKEN is not configured; backend deduplication check skipped")
            return item
        
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            **self._correlation_headers(),
        }
        
        try:
            response = await self.client.post(self.api_check_url, json={"url": url}, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if data.get('exists'):
                    raise DropItem(f"Duplicate job found in database: {url}")
        except httpx.RequestError as e:
            logger.warning(f"Backend deduplication check failed for {url}: {e}")
            # If backend check fails, we proceed rather than dropping, to not lose data
            
        return item

    def _correlation_headers(self):
        if not self.request_id:
            return {}

        return {"X-Request-ID": self.request_id}
        
    def close_spider(self, spider):
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.client.aclose())
            else:
                loop.run_until_complete(self.client.aclose())
        except Exception:
            pass


class NERPipeline:
    """
    Pipeline to extract skills and clean up the title/description using the NER module.
    """
    def __init__(self):
        self.extractor = CustomSkillExtractor(use_spacy=True)
        # Redundant boilerplate regex
        self.boilerplate_pattern = re.compile(
            r'(?i)\b(apply now|about the company|about us|show more|click here|read more)\b', 
            re.IGNORECASE
        )

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        
        title = adapter.get('title')
        description = adapter.get('description')
        
        if not title or not description:
            raise DropItem(f"Missing title or description in {item.get('url')}")
            
        # 1. Title Validation
        title_res = self.extractor.extract_and_validate_title(title)
        if not title_res.is_valid:
            if title_res.should_flag_dlq:
                logger.warning(f"Invalid Title flagged for DLQ: {title_res.rejection_reason}")
            raise DropItem(f"Invalid Job Title: {title}")
            
        adapter['title'] = title_res.title
        
        # 2. Advanced Data Cleaning
        clean_desc = self._clean_html(description)
        adapter['description'] = clean_desc
        
        # 3. Skill Extraction from Cleaned Description
        extracted_skills = self.extractor.extract_skills(clean_desc)
        adapter['skills'] = extracted_skills
        
        # Optionally populate requirements as the raw text for now
        adapter['requirements'] = ""

        return item

    def _clean_html(self, text):
        from bs4 import BeautifulSoup
        if not text:
            return ""
        
        # Strip structural noise while preserving whitespace
        soup = BeautifulSoup(text, "html.parser")
        
        # Remove script and style elements
        for script in soup(["script", "style", "noscript"]):
            script.extract()
            
        clean_text = soup.get_text(separator="\n", strip=True)
        
        # Remove redundant boilerplate
        clean_text = self.boilerplate_pattern.sub('', clean_text)
        
        return clean_text.strip()


class LaravelExportPipeline:
    """
    Pipeline that sends the processed JobItem to the Laravel API.
    """
    def __init__(self):
        self.api_url = os.getenv('LARAVEL_API_URL', 'http://127.0.0.1:8000/api/jobs/import')
        self.api_token = os.getenv('LARAVEL_API_TOKEN', '')
        self.request_id = os.getenv('REQUEST_ID', '')
        
        # Implement robust retries
        transport = httpx.AsyncHTTPTransport(retries=3)
        self.client = httpx.AsyncClient(transport=transport, timeout=15.0)

    async def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        if not self.api_token:
            raise DropItem("LARAVEL_API_TOKEN is not configured; refusing to export scraped job")
        
        payload = {
            "title": adapter.get("title"),
            "description": adapter.get("description"),
            "company": adapter.get("company"),
            "url": adapter.get("url"),
            "scraping_source_id": adapter.get("scraping_source_id"),
            "location": adapter.get("location", ""),
            "requirements": adapter.get("requirements", ""),
            "skills": adapter.get("skills", []),
            "work_type": adapter.get("work_type", ""),
            "job_type": adapter.get("job_type", ""),
            "experience": adapter.get("experience", ""),
            "salary_range": adapter.get("salary_range", ""),
            "source": adapter.get("source", "Scrapy Spider")
        }

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            **self._correlation_headers(),
        }

        try:
            response = await self.client.post(self.api_url, json=payload, headers=headers)
            
            if response.status_code in (200, 201):
                logger.info(f"Successfully exported job to Laravel: '{adapter.get('title')}' at {adapter.get('company')}")
            else:
                logger.error(f"Failed to export job. Status: {response.status_code}, Body: {response.text}")
                
        except httpx.RequestError as e:
            logger.error(f"HTTP Request failed while exporting job: {e}")

        return item

    def _correlation_headers(self):
        if not self.request_id:
            return {}

        return {"X-Request-ID": self.request_id}
        
    def close_spider(self, spider):
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.client.aclose())
            else:
                loop.run_until_complete(self.client.aclose())
        except Exception:
            pass
