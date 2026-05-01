import scrapy

class JobItem(scrapy.Item):
    title = scrapy.Field()
    description = scrapy.Field()
    company = scrapy.Field()
    url = scrapy.Field()
    scraping_source_id = scrapy.Field()
    location = scrapy.Field()
    requirements = scrapy.Field()
    skills = scrapy.Field()
    work_type = scrapy.Field()
    job_type = scrapy.Field()
    experience = scrapy.Field()
    salary_range = scrapy.Field()
    source = scrapy.Field()
