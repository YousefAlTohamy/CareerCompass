import scrapy
from ai_job_miner.items import JobItem
from scrapy_playwright.page import PageMethod
import logging

logger = logging.getLogger(__name__)

class BasePlaywrightSpider(scrapy.Spider):
    """
    Base Spider template that automatically uses Playwright to handle SPA/JS pages.
    """
    name = "base_playwright"
    
    # Define selector for the "Show More" button to expand descriptions
    show_more_selector = None

    def start_requests(self):
        for url in self.start_urls:
            yield scrapy.Request(
                url,
                meta={
                    "playwright": True,
                    "playwright_include_page": True,
                },
                callback=self.parse,
                errback=self.on_error
            )

    async def on_error(self, failure):
        logger.error(f"Request failed: {failure.request.url}, error: {repr(failure.value)}")
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
            
        import httpx
        import os
        from datetime import datetime
        
        api_failed_url = os.getenv('LARAVEL_API_FAILED_URL', 'http://127.0.0.1:8000/api/jobs/import/failed')
        api_token = os.getenv('LARAVEL_API_TOKEN', 'YOUR_SANCTUM_TOKEN')
        
        payload = {
            "url": failure.request.url,
            "error_message": repr(failure.value),
            "failed_at": datetime.now().isoformat()
        }
        
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(api_failed_url, json=payload, headers=headers, timeout=5.0)
                if response.status_code in (200, 201):
                    logger.info(f"Successfully reported failure to DLQ for {failure.request.url}")
                else:
                    logger.error(f"Failed to report to DLQ. Status: {response.status_code}, Body: {response.text}")
        except Exception as e:
            logger.error(f"Failed to contact DLQ endpoint: {e}")

    async def parse(self, response):
        page = response.meta.get("playwright_page")
        if not page:
            logger.warning(f"No Playwright page found for {response.url}")
            return

        try:
            # Inject generic "Show More" interaction logic
            if self.show_more_selector:
                try:
                    # Wait for the button to appear (timeout after 3s if not present)
                    await page.wait_for_selector(self.show_more_selector, state="visible", timeout=3000)
                    await page.click(self.show_more_selector)
                    # Small wait to allow DOM to expand
                    await page.wait_for_timeout(1000)
                except Exception as e:
                    # It's fine if the button isn't there, we just log debug
                    logger.debug(f"Show more button not found or failed to click: {e}")

            # Once page is fully rendered/expanded, extract HTML
            content = await page.content()
            
            # Create a new Scrapy response from the Playwright HTML to use CSS/XPath easily
            html_response = response.replace(body=content.encode('utf-8'))
            
            # Delegate to child spider's extraction logic
            for item in self.parse_job(html_response):
                yield item
            
        finally:
            await page.close()

    def parse_job(self, response):
        """
        To be implemented by child spiders.
        Should yield JobItem.
        """
        raise NotImplementedError
