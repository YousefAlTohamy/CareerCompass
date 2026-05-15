from ai_job_miner.spiders.base_spider import BasePlaywrightSpider
from ai_job_miner.items import JobItem

class LinkedinSpider(BasePlaywrightSpider):
    name = "linkedin"
    allowed_domains = ["linkedin.com"]
    def __init__(self, query=None, limit=30, source_id=None, endpoint=None, *args, **kwargs):
        super(LinkedinSpider, self).__init__(*args, **kwargs)
        self.query = query
        self.limit = int(limit)
        self.source_id = int(source_id) if source_id not in (None, "") else None
        
        if endpoint:
            self.start_urls = [endpoint]
        elif query:
            import urllib.parse
            encoded_query = urllib.parse.quote(query)
            self.start_urls = [f"https://www.linkedin.com/jobs/search/?keywords={encoded_query}"]
        else:
            self.start_urls = ["https://www.linkedin.com/jobs/search/"]
    
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
        
        if self.source_id is not None:
            item['scraping_source_id'] = self.source_id
        
        # Additional fields can be mapped if available in DOM,
        # otherwise our NER pipeline will extract skills & requirements from the description.
        
        if item['title'] and item['description']:
            yield item
