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
        detail_title = response.css('h1.top-card-layout__title::text').get(default='').strip()
        detail_description = response.css('div.show-more-less-html__markup').get(default='').strip()

        if detail_title and detail_description:
            item = JobItem()
            item['title'] = detail_title
            item['company'] = response.css('a.topcard__org-name-link::text, span.topcard__flavor::text').get(default='').strip()
            item['location'] = response.css('span.topcard__flavor--bullet::text, span.topcard__flavor--metadata::text').get(default='').strip()
            item['description'] = detail_description
            item['url'] = response.url
            item['source'] = 'LinkedIn'
            item['work_type'] = 'remote' if 'remote' in response.text.lower() else ''
            item['job_type'] = 'full-time'

            if self.source_id is not None:
                item['scraping_source_id'] = self.source_id

            yield item
            return

        cards = response.css('li div.base-card, div.job-search-card, li.jobs-search-results__list-item')
        for card in cards[: self.limit]:
            title = card.css('h3.base-search-card__title::text, a.job-card-list__title::text, h3::text').get(default='').strip()
            company = card.css('h4.base-search-card__subtitle a::text, h4.base-search-card__subtitle::text, .job-card-container__primary-description::text').get(default='').strip()
            location = card.css('.job-search-card__location::text, .job-card-container__metadata-item::text').get(default='').strip()
            href = card.css('a.base-card__full-link::attr(href), a[href*="/jobs/view/"]::attr(href)').get(default='').strip()
            snippet = " ".join(part.strip() for part in card.css('::text').getall() if part.strip())

            if not title or not href:
                continue

            item = JobItem()
            item['title'] = title
            item['company'] = company
            item['location'] = location
            item['description'] = snippet
            item['requirements'] = snippet
            item['url'] = href.split('?')[0]
            item['source'] = 'LinkedIn'
            item['work_type'] = 'remote' if 'remote' in snippet.lower() else ''
            item['job_type'] = 'full-time'

            if self.source_id is not None:
                item['scraping_source_id'] = self.source_id

            yield item
