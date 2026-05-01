import random
from scrapy.exceptions import NotConfigured
import logging

logger = logging.getLogger(__name__)

class UserAgentSpoofingMiddleware:
    """
    Middleware to dynamically inject rotating modern browser User-Agents.
    """
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15"
    ]

    def process_request(self, request, spider):
        ua = random.choice(self.USER_AGENTS)
        request.headers.setdefault(b'User-Agent', ua.encode('utf-8'))
        
        # Also inject into Playwright if it's used
        if request.meta.get('playwright'):
            request.meta.setdefault('playwright_context_kwargs', {})
            request.meta['playwright_context_kwargs']['user_agent'] = ua

class ProxyRotationMiddleware:
    """
    Middleware to rotate proxies.
    For now, it fetches from a hardcoded list or environment variables.
    Eventually, this can be hooked up to an API endpoint on the Laravel backend.
    """
    def __init__(self, proxies):
        self.proxies = proxies

    @classmethod
    def from_crawler(cls, crawler):
        # We can pull from settings or .env here
        # E.g. proxies = crawler.settings.getlist('PROXY_LIST')
        # For demonstration, using a mock list. 
        # In production, fetch from Laravel API.
        proxies = [
            # "http://username:password@proxy.example.com:8080",
        ]
        return cls(proxies)

    def process_request(self, request, spider):
        if self.proxies:
            proxy = random.choice(self.proxies)
            request.meta['proxy'] = proxy
            
            # If using Playwright, proxy must be configured at the context level
            if request.meta.get('playwright'):
                request.meta.setdefault('playwright_context_kwargs', {})
                request.meta['playwright_context_kwargs']['proxy'] = {
                    "server": proxy
                }
                
    def process_exception(self, request, exception, spider):
        if 'proxy' in request.meta:
            logger.warning(f"Proxy failed: {request.meta['proxy']}, Exception: {exception}")
        return None
