from ai_job_miner.spiders.base_spider import BasePlaywrightSpider
from ai_job_miner.items import JobItem

class LinkedinSpider(BasePlaywrightSpider):
    name = "linkedin"
    allowed_domains = ["linkedin.com"]
    start_urls = [
        # Example target URL. In production, this would be injected via arguments or API
        "https://www.linkedin.com/jobs/view/123456789"
    ]
    
    # The selector to expand the full job description on LinkedIn
    show_more_selector = "button.show-more-less-html__button"

    def parse_job(self, response):
        item = JobItem()
        
        # Example CSS Selectors for LinkedIn
        item['title'] = response.css('h1.top-card-layout__title::text').get(default='').strip()
        item['company'] = response.css('a.topcard__org-name-link::text').get(default='').strip()
        item['location'] = response.css('span.topcard__flavor--bullet::text').get(default='').strip()
        item['description'] = response.css('div.show-more-less-html__markup').get(default='').strip()
        item['url'] = response.url
        item['source'] = 'LinkedIn'
        
        # Placeholder for scraping_source_id (In production, this is passed via spider arguments)
        item['scraping_source_id'] = getattr(self, 'source_id', 1) 
        
        # Additional fields can be mapped if available in DOM,
        # otherwise our NER pipeline will extract skills & requirements from the description.
        
        if item['title'] and item['description']:
            yield item
