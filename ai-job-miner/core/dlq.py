"""
core/dlq.py
============
Phase 5 — Dead Letter Queue (DLQ) for Fault-Tolerant Scraping

A **Dead Letter Queue** is a standard fault-tolerance pattern in distributed
systems (used in AWS SQS, RabbitMQ, Apache Kafka).  Failed messages are
not discarded — they are moved to a separate queue for inspection and retry.

In our scraping context, a "failed message" is a URL that could not be
scraped after all retry attempts in ``SmartAsyncClient`` are exhausted.

Design
------
* **In-memory store**: a list of ``FailedTask`` dataclass instances.
* **Attempt tracking**: every retry increments ``attempts`` so we can
  implement a max-retry limit at the DLQ level too.
* **Timestamp**: ISO-8601 wall-clock timestamp for observability.
* **asyncio.Lock**: ensures thread-safe mutations when multiple coroutines
  produce failures concurrently.

CS Concept: Queue ADT
----------------------
The DLQ is logically a FIFO queue.  However since we also need lookups by
URL (idempotent ``add_failure``) and filtered retrieval (``get_retryable``),
we Back it with a dict keyed by URL for O(1) duplicate detection, while
maintaining a list for ordered iteration — a classic list-of-dict pattern.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterator

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data class for a single failed task
# ---------------------------------------------------------------------------

@dataclass
class FailedTask:
    """
    Represents a single failed scraping task.

    Attributes
    ----------
    url : str
        The URL that failed.
    error : str
        Last error message or exception string.
    attempts : int
        Number of times this URL has been attempted (starts at 1 on first failure).
    first_failed_at : str
        ISO-8601 UTC timestamp of the first failure.
    last_failed_at : str
        ISO-8601 UTC timestamp of the most recent failure.
    """
    url: str
    error: str
    attempts: int = 1
    first_failed_at: str = field(default_factory=lambda: _now_iso())
    last_failed_at: str = field(default_factory=lambda: _now_iso())


def _now_iso() -> str:
    """Return the current UTC time as an ISO-8601 string."""
    return datetime.now(tz=timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Dead Letter Queue
# ---------------------------------------------------------------------------

class DeadLetterQueue:
    """
    Async-safe Dead Letter Queue for failed scraping tasks.

    Stores failed URLs with their error context and attempt counts.
    Supports idempotent failure recording — if a URL fails again,
    its entry is updated rather than duplicated.

    Parameters
    ----------
    max_attempts : int
        Maximum number of times a URL may be retried from the DLQ
        before it is considered permanently failed.  Default: 3.

    Usage
    -----
    ::

        dlq = DeadLetterQueue(max_attempts=3)

        # Record a failure
        await dlq.add_failure("https://example.com/job/1", "HTTP 503")

        # Retrieve tasks eligible for retry
        retryable = await dlq.get_retryable()
        for task in retryable:
            ...  # re-submit task.url to the scraper

        # Inspect queue state
        print(dlq.summary)
    """

    def __init__(self, max_attempts: int = 3) -> None:
        self._max_attempts = max_attempts
        self._store: dict[str, FailedTask] = {}   # url → FailedTask
        self._lock: asyncio.Lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    async def add_failure(self, url: str, error: str) -> FailedTask:
        """
        Record a failure for *url*.

        If the URL is already in the DLQ, increment its attempt counter
        and update the error / timestamp rather than adding a duplicate.

        Parameters
        ----------
        url : str
            The URL that failed.
        error : str
            Human-readable error description.

        Returns
        -------
        FailedTask
            The created or updated task record.
        """
        async with self._lock:
            if url in self._store:
                task = self._store[url]
                task.attempts += 1
                task.error = error
                task.last_failed_at = _now_iso()
                logger.warning(
                    "[DLQ] Updated existing entry: url=%s attempts=%d error=%s",
                    url, task.attempts, error,
                )
            else:
                task = FailedTask(url=url, error=error)
                self._store[url] = task
                logger.warning(
                    "[DLQ] New failure recorded: url=%s error=%s", url, error
                )
            return task

    async def clear_entry(self, url: str) -> bool:
        """
        Remove a URL from the DLQ (call after a successful retry).

        Parameters
        ----------
        url : str
            The URL to remove.

        Returns
        -------
        bool
            ``True`` if the entry was found and removed; ``False`` otherwise.
        """
        async with self._lock:
            removed = self._store.pop(url, None) is not None
            if removed:
                logger.info("[DLQ] Cleared entry for url=%s", url)
            return removed

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    async def get_retryable(self) -> list[FailedTask]:
        """
        Return all tasks whose attempt count is below ``max_attempts``.

        These are candidates for immediate re-queuing into the scraper.

        Returns
        -------
        list[FailedTask]
            Retryable task records, ordered by first failure time (FIFO).
        """
        async with self._lock:
            retryable = [
                task for task in self._store.values()
                if task.attempts < self._max_attempts
            ]
        logger.info("[DLQ] get_retryable: %d tasks eligible for retry", len(retryable))
        return retryable

    async def get_permanently_failed(self) -> list[FailedTask]:
        """
        Return tasks that have exhausted all retry attempts.

        These should be logged to persistent storage (database / file)
        for human review.

        Returns
        -------
        list[FailedTask]
            Tasks with ``attempts >= max_attempts``.
        """
        async with self._lock:
            return [
                task for task in self._store.values()
                if task.attempts >= self._max_attempts
            ]

    def __iter__(self) -> Iterator[FailedTask]:
        """Iterate over all DLQ entries (snapshot, no lock needed for read-only)."""
        return iter(list(self._store.values()))

    def __len__(self) -> int:
        """Number of URLs currently in the DLQ."""
        return len(self._store)

    @property
    def summary(self) -> dict:
        """
        A human-readable summary dict for logging / monitoring.

        Returns
        -------
        dict
            Keys: ``total``, ``retryable``, ``permanently_failed``.
        """
        total = len(self._store)
        perm_failed = sum(
            1 for t in self._store.values() if t.attempts >= self._max_attempts
        )
        return {
            "total": total,
            "retryable": total - perm_failed,
            "permanently_failed": perm_failed,
        }
