BOT_NAME = "ai_job_miner"

SPIDER_MODULES = ["ai_job_miner.spiders"]
NEWSPIDER_MODULE = "ai_job_miner.spiders"

# Obey robots.txt rules for public crawling hygiene.
ROBOTSTXT_OBEY = True

# Scrapy Playwright settings
DOWNLOAD_HANDLERS = {
    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}

TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"

PLAYWRIGHT_BROWSER_TYPE = "chromium"
PLAYWRIGHT_LAUNCH_OPTIONS = {
    "headless": True,
}

RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 400, 403, 408, 429]

DOWNLOAD_DELAY = 3
RANDOMIZE_DOWNLOAD_DELAY = True

# Keep middleware conservative: retries and polite delays only. No proxy
# rotation, stealth scripts, or fingerprint evasion are used.
DOWNLOADER_MIDDLEWARES = {
    'scrapy.downloadermiddlewares.retry.RetryMiddleware': 500,
}

# Pipelines
ITEM_PIPELINES = {
    'ai_job_miner.pipelines.DeduplicationPipeline': 100,
    'ai_job_miner.pipelines.NERPipeline': 200,
    'ai_job_miner.pipelines.LaravelExportPipeline': 300,
}

# Set settings whose default value is deprecated to a future-proof value
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
FEED_EXPORT_ENCODING = "utf-8"
