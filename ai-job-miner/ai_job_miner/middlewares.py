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
    def __init__(self, proxies):
        self.proxies = proxies

    @classmethod
    def from_crawler(cls, crawler):
        proxies = []
        import os
        import requests

        if os.getenv('SCRAPER_USE_PROXIES', 'true').lower() in {'0', 'false', 'no', 'off'}:
            logger.info("Proxy rotation disabled by SCRAPER_USE_PROXIES")
            return cls(proxies)
        
        api_url = os.getenv('LARAVEL_API_PROXIES_URL', 'http://127.0.0.1:8000/api/proxies/active')
        api_token = os.getenv('LARAVEL_API_TOKEN', '')
        request_id = os.getenv('REQUEST_ID', '')

        if not api_token:
            logger.warning("LARAVEL_API_TOKEN is not configured; proxy rotation disabled")
            return cls(proxies)
        
        try:
            response = requests.get(
                api_url,
                headers={
                    "Authorization": f"Bearer {api_token}",
                    "Accept": "application/json",
                    **({"X-Request-ID": request_id} if request_id else {}),
                },
                timeout=10
            )
            if response.status_code == 200:
                body = response.json()
                data = body.get("data", body) if isinstance(body, dict) else body
                for p in data:
                    # Construct proxy URL: protocol://username:password@host:port
                    protocol = p.get('protocol', 'http')
                    host = p.get('host')
                    port = p.get('port')
                    user = p.get('username')
                    pwd = p.get('password')
                    
                    if host and port:
                        if user and pwd:
                            proxies.append(f"{protocol}://{user}:{pwd}@{host}:{port}")
                        else:
                            proxies.append(f"{protocol}://{host}:{port}")
                logger.info(f"Loaded {len(proxies)} proxies from Laravel API")
            else:
                logger.warning(f"Failed to fetch proxies. Status: {response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching proxies from Laravel API: {e}")

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
