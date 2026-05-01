BOT_NAME = "ai_job_miner"

SPIDER_MODULES = ["ai_job_miner.spiders"]
NEWSPIDER_MODULE = "ai_job_miner.spiders"

# Obey robots.txt rules
ROBOTSTXT_OBEY = False

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

# Stealth and Anti-Detection
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 400, 403, 408, 429]

DOWNLOAD_DELAY = 3
RANDOMIZE_DOWNLOAD_DELAY = True

# Middlewares
DOWNLOADER_MIDDLEWARES = {
    'ai_job_miner.middlewares.UserAgentSpoofingMiddleware': 400,
    'ai_job_miner.middlewares.ProxyRotationMiddleware': 410,
    'scrapy.downloadermiddlewares.retry.RetryMiddleware': 500,
}

# Pipelines
ITEM_PIPELINES = {
    'ai_job_miner.pipelines.NERPipeline': 100,
    'ai_job_miner.pipelines.DeduplicationPipeline': 200,
    'ai_job_miner.pipelines.LaravelExportPipeline': 300,
}

# Set settings whose default value is deprecated to a future-proof value
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
FEED_EXPORT_ENCODING = "utf-8"
