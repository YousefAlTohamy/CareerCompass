import os
import json
import logging
from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem

# Import NER extractor from our AI module
from ai.ner_extractor import CustomSkillExtractor

import httpx

logger = logging.getLogger(__name__)

class NERPipeline:
    """
    Pipeline to extract skills and clean up the title/description using the NER module.
    """
    def __init__(self):
        self.extractor = CustomSkillExtractor(use_spacy=True)

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
                # In production, we'd route this to DLQ or log as failed
                logger.warning(f"Invalid Title flagged for DLQ: {title_res.rejection_reason}")
            raise DropItem(f"Invalid Job Title: {title}")
            
        adapter['title'] = title_res.title
        
        # 2. Skill Extraction from Description
        # Basic text cleanup before NER
        clean_desc = self._strip_html(description)
        adapter['description'] = clean_desc
        
        extracted_skills = self.extractor.extract_skills(clean_desc)
        adapter['skills'] = extracted_skills
        
        # Optionally populate requirements as the raw text for now
        # or use a heuristics module to slice the "Requirements" section out.
        adapter['requirements'] = ""

        return item

    def _strip_html(self, text):
        from bs4 import BeautifulSoup
        if not text:
            return ""
        return BeautifulSoup(text, "html.parser").get_text(separator="\n").strip()


class DeduplicationPipeline:
    """
    Prevents sending the same job posting to the backend multiple times during a single run.
    Uses a simple memory set. For distributed scraping, use Redis.
    """
    def __init__(self):
        self.seen_urls = set()

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        url = adapter.get('url')
        
        if url in self.seen_urls:
            raise DropItem(f"Duplicate job found: {url}")
            
        self.seen_urls.add(url)
        return item


class LaravelExportPipeline:
    """
    Pipeline that sends the processed JobItem to the Laravel API.
    """
    def __init__(self):
        self.api_url = os.getenv('LARAVEL_API_URL', 'http://127.0.0.1:8000/api/jobs/import')
        self.api_token = os.getenv('LARAVEL_API_TOKEN', 'YOUR_SANCTUM_TOKEN')
        self.client = httpx.AsyncClient()

    async def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        
        payload = {
            "title": adapter.get("title"),
            "description": adapter.get("description"),
            "company": adapter.get("company"),
            "url": adapter.get("url"),
            "scraping_source_id": adapter.get("scraping_source_id", 1),
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
        }

        try:
            response = await self.client.post(self.api_url, json=payload, headers=headers, timeout=10.0)
            
            if response.status_code in (200, 201):
                logger.info(f"Successfully exported job to Laravel: {adapter.get('title')} at {adapter.get('company')}")
            else:
                logger.error(f"Failed to export job to Laravel. Status: {response.status_code}, Body: {response.text}")
                
        except httpx.RequestError as e:
            logger.error(f"HTTP Request failed while exporting job: {e}")

        return item
        
    def close_spider(self, spider):
        # We must explicitly close the httpx AsyncClient in a synchronous method 
        # or manage it correctly, but Scrapy pipelines prefer synchronous close.
        # Alternatively, we could just rely on the OS cleaning up sockets.
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.client.aclose())
            else:
                loop.run_until_complete(self.client.aclose())
        except Exception as e:
            pass
