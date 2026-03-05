"""
core/http_client.py
====================
Phase 5 — Smart Async HTTP Client with Evasion & Rate Limiting

Implements three complementary mechanisms to produce a reliable,
polite, and evasion-aware HTTP client:

1. **Token Bucket Rate Limiter**
   A bucket of capacity ``C`` tokens refills at rate ``R`` tokens/second.
   Each request consumes one token.  If the bucket is empty the caller
   waits until a token is available.  This gives a *smooth* request
   rate rather than a burst–pause pattern.

   * Time complexity: O(1) per request (no iteration, no queues)
   * Space complexity: O(1) (two floats + a lock)

2. **Exponential Backoff with Jitter**
   On HTTP 429 (Too Many Requests) or 5xx transient errors, the client
   retries after a delay of::

       delay = min(base_delay × 2^attempt, max_delay) + U(0, jitter)

   The random jitter prevents the "thundering herd" problem where many
   concurrent clients retry at exactly the same moment.

3. **User-Agent Rotation**
   Each request selects a real browser User-Agent string at random from a
   curated list.  This reduces the fingerprint signal that rate-limiting
   WAFs use to identify scrapers.

CS Background
-------------
* Token Bucket: a classical traffic-shaping algorithm (RFC 4115).
  Unlike leaky-bucket it allows short bursts up to capacity C.
* Exponential Backoff: standard in distributed systems (AWS SDK, gRPC).
  The capped variant prevents unbounded delays.
"""

from __future__ import annotations

import asyncio
import logging
import math
import random
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Real-browser User-Agent strings (sampled from caniuse.com analytics 2024)
# ---------------------------------------------------------------------------
_USER_AGENTS: tuple[str, ...] = (
    # Chrome – Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    # Chrome – macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    # Firefox – Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) "
    "Gecko/20100101 Firefox/124.0",
    # Firefox – Linux
    "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) "
    "Gecko/20100101 Firefox/124.0",
    # Safari – macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
    # Edge – Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    # Chrome – Android
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36",
    # Safari – iOS
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 "
    "Mobile/15E148 Safari/604.1",
)

# HTTP status codes that should trigger a retry with backoff
_RETRYABLE_STATUS: frozenset[int] = frozenset({429, 500, 502, 503, 504})


# ===========================================================================
# Token Bucket
# ===========================================================================

class TokenBucket:
    """
    Thread-safe (asyncio-safe) Token Bucket rate limiter.

    Parameters
    ----------
    rate : float
        Tokens added per second (i.e. maximum sustained request rate).
    capacity : float
        Maximum burst size (number of tokens the bucket can hold).
        If ``capacity`` is not set, it defaults to ``rate`` (1-second burst).
    """

    def __init__(self, rate: float, capacity: Optional[float] = None) -> None:
        if rate <= 0:
            raise ValueError("rate must be positive.")
        self._rate = rate
        self._capacity = capacity if capacity is not None else rate
        self._tokens: float = self._capacity   # start full
        self._last_refill: float = time.monotonic()
        self._lock: asyncio.Lock = asyncio.Lock()

    async def acquire(self) -> None:
        """
        Wait until a token is available, then consume it.

        The bucket is refilled lazily at each ``acquire`` call based on the
        elapsed time since the last call — O(1) computation, no background task.
        """
        async with self._lock:
            while True:
                now = time.monotonic()
                elapsed = now - self._last_refill
                # Refill proportional to elapsed time (capped at capacity)
                self._tokens = min(
                    self._capacity,
                    self._tokens + elapsed * self._rate,
                )
                self._last_refill = now

                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return

                # Not enough tokens — compute when the next one arrives
                wait_time = (1.0 - self._tokens) / self._rate
                logger.debug(
                    "[TokenBucket] Rate limited: waiting %.3f s for next token", wait_time
                )
                await asyncio.sleep(wait_time)


# ===========================================================================
# SmartAsyncClient
# ===========================================================================

class SmartAsyncClient:
    """
    A smart async HTTP client combining Token Bucket rate limiting,
    Exponential Backoff retry, and User-Agent rotation.

    Designed to be used as an **async context manager**::

        async with SmartAsyncClient(rate=2.0) as client:
            text = await client.get("https://example.com")

    Parameters
    ----------
    rate : float
        Max sustained request rate in requests-per-second.
        Default: 2.0 (polite scraping pace).
    burst_capacity : float, optional
        Token Bucket burst capacity.  Defaults to ``rate``.
    max_retries : int
        Maximum number of retry attempts on retryable errors.  Default: 4.
    base_delay : float
        Initial backoff delay in seconds.  Default: 1.0.
    max_delay : float
        Maximum backoff delay cap in seconds.  Default: 60.0.
    jitter : float
        Maximum random jitter added to each backoff delay.  Default: 1.0.
    timeout : float
        Per-request timeout in seconds.  Default: 30.0.
    """

    def __init__(
        self,
        rate: float = 2.0,
        burst_capacity: Optional[float] = None,
        max_retries: int = 4,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        jitter: float = 1.0,
        timeout: float = 30.0,
    ) -> None:
        self._bucket = TokenBucket(rate=rate, capacity=burst_capacity)
        self._max_retries = max_retries
        self._base_delay = base_delay
        self._max_delay = max_delay
        self._jitter = jitter
        self._timeout = timeout
        self._session: Any = None   # aiohttp.ClientSession (lazy init)

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "SmartAsyncClient":
        try:
            import aiohttp  # type: ignore
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self._timeout),
            )
        except ImportError:
            # aiohttp not installed — tests will inject a mock
            self._session = None
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._session is not None:
            await self._session.close()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get(self, url: str, **kwargs: Any) -> str:
        """
        Perform a rate-limited, retry-capable HTTP GET request.

        Flow
        ----
        1. Acquire a Token Bucket token (waits if rate limit exceeded).
        2. Select a random User-Agent.
        3. Execute the request.
        4. On 429 / 5xx → Exponential Backoff, then retry.
        5. On success → return response text.
        6. After ``max_retries`` exhausted → raise ``RuntimeError``.

        Parameters
        ----------
        url : str
            Target URL.
        **kwargs
            Extra keyword arguments forwarded to ``aiohttp``'s ``get()``.

        Returns
        -------
        str
            Response body as a string.

        Raises
        ------
        RuntimeError
            If all retry attempts are exhausted.
        """
        for attempt in range(self._max_retries + 1):
            # 1. Rate limit
            await self._bucket.acquire()

            # 2. Rotate User-Agent
            ua = random.choice(_USER_AGENTS)
            headers = {**kwargs.pop("headers", {}), "User-Agent": ua}

            try:
                status, text = await self._do_request(url, headers=headers, **kwargs)
            except Exception as exc:
                # Network-level error (timeout, connection refused, …)
                status, text = 0, str(exc)

            if status == 200:
                logger.debug("[SmartAsyncClient] GET %s → 200 OK (UA: %s…)", url, ua[:30])
                return text

            if status in _RETRYABLE_STATUS or status == 0:
                delay = self._backoff_delay(attempt)
                logger.warning(
                    "[SmartAsyncClient] %s → status=%d attempt=%d/%d  backing off %.2f s",
                    url, status, attempt + 1, self._max_retries, delay,
                )
                await asyncio.sleep(delay)
                continue

            # Non-retryable HTTP error (e.g. 404)
            raise RuntimeError(f"HTTP {status} for URL: {url}")

        raise RuntimeError(
            f"Exceeded {self._max_retries} retries for URL: {url}"
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _do_request(
        self, url: str, headers: dict, **kwargs: Any
    ) -> tuple[int, str]:
        """Execute one HTTP GET and return (status_code, body_text)."""
        if self._session is None:
            raise RuntimeError("SmartAsyncClient must be used as an async context manager.")
        async with self._session.get(url, headers=headers, **kwargs) as resp:
            text = await resp.text()
            return resp.status, text

    def _backoff_delay(self, attempt: int) -> float:
        """
        Calculate the Exponential Backoff delay for the given attempt number.

        Formula::

            delay = min(base_delay × 2^attempt, max_delay) + U(0, jitter)

        The ``min`` cap prevents the delay from growing indefinitely.
        The random jitter de-synchronises concurrent scrapers.
        """
        exponential = self._base_delay * (2 ** attempt)
        capped = min(exponential, self._max_delay)
        jitter = random.uniform(0, self._jitter)
        return capped + jitter

    @staticmethod
    def random_user_agent() -> str:
        """Return a randomly selected real-browser User-Agent string."""
        return random.choice(_USER_AGENTS)
