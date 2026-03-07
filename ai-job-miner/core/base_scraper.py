"""
core/base_scraper.py
====================
Defines the abstract base class (Strategy interface) for all scraper strategies.

Design Pattern: Strategy Pattern
  - BaseScraper acts as the "Strategy" interface.
  - Concrete strategies (HtmlSmartScraper, JsonApiScraper) implement the `scrape` method.
  - This allows the engine to swap scraping algorithms at runtime without changing client code.
"""

import logging
from abc import ABC, abstractmethod

import aiohttp

# ---------------------------------------------------------------------------
# Module-level logger — each concrete strategy will inherit this logger
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)


class BaseScraper(ABC):
    """
    Abstract base class that defines the common scraping interface.

    All concrete scraper strategies MUST inherit from this class and provide
    a concrete implementation of the `scrape` coroutine.

    Attributes
    ----------
    None — state is intentionally kept outside the strategy to promote
    stateless, reusable strategy objects.
    """

    # ------------------------------------------------------------------
    # Abstract method — every concrete strategy MUST implement this
    # ------------------------------------------------------------------
    @abstractmethod
    async def scrape(self, url: str, **kwargs) -> dict:
        """
        Entry-point coroutine for a scraping strategy.

        Each concrete subclass defines its own scraping algorithm here.
        Callers never need to know which strategy is being used — they
        simply call `scrape()` through the BaseScraper interface.

        Parameters
        ----------
        url : str
            The target URL to scrape.
        **kwargs : dict
            Extra, strategy-specific keyword arguments (e.g., CSS selectors,
            API keys, request headers …).

        Returns
        -------
        dict
            A standardised result dictionary with at minimum the keys:
            ``type``, ``content``, and ``status``.
        """
        ...

    # ------------------------------------------------------------------
    # Concrete helper — shared by all strategies; no need to override
    # ------------------------------------------------------------------
    async def fetch_content(
        self,
        url: str,
        session: aiohttp.ClientSession,
    ) -> str:
        """
        Reusable coroutine that performs a raw HTTP GET and returns the
        response body as a string.

        Centralising the network call here means:
          • Every strategy benefits from the same error-handling logic.
          • Timeouts, retries, and logging are managed in one place.

        Parameters
        ----------
        url : str
            The target URL.
        session : aiohttp.ClientSession
            A live aiohttp session (caller-managed so connections can be
            pooled efficiently across many requests).

        Returns
        -------
        str
            The decoded response body on success, or an empty string on
            recoverable errors.

        Raises
        ------
        aiohttp.ClientResponseError
            Re-raised after logging so callers can decide how to handle
            HTTP-level errors (4xx / 5xx).
        asyncio.TimeoutError
            Re-raised after logging so callers can implement retry logic.
        """
        try:
            logger.info("Fetching URL: %s", url)

            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as response:
                # Raise an exception for 4xx / 5xx responses
                response.raise_for_status()
                content = await response.text()
                logger.info(
                    "Successfully fetched %s — HTTP %d (%d chars)",
                    url,
                    response.status,
                    len(content),
                )
                return content

        except aiohttp.ClientResponseError as exc:
            logger.error(
                "HTTP error while fetching %s — status: %d, message: %s",
                url,
                exc.status,
                exc.message,
            )
            raise

        except aiohttp.ServerTimeoutError as exc:
            logger.error("Request timed out while fetching %s: %s", url, exc)
            raise

        except aiohttp.ClientConnectionError as exc:
            logger.error("Connection error while fetching %s: %s", url, exc)
            raise

        except Exception as exc:  # noqa: BLE001 — intentional broad catch for logging
            logger.error("Unexpected error while fetching %s: %s", url, exc)
            raise
