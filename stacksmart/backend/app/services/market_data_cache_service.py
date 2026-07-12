"""Postgres-backed TTL cache for external market data API calls.

No Redis in this infra, so `market_data_cache` (migrations/002) stands in
for it. Wraps rate-limited/expensive calls (Alpha Vantage news sentiment,
yfinance analyst data) so the daily Stock of the Day run doesn't re-fetch
the same ticker more often than its TTL allows.
"""

import os
from datetime import datetime, timezone
from typing import Any, Callable

from supabase import create_client, Client


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def get_cached_or_fetch(
    provider: str,
    cache_key: str,
    ttl_seconds: int,
    fetch_fn: Callable[[], Any],
    force_refresh: bool = False,
) -> Any:
    """Return the cached `response` for (provider, cache_key) if still within
    its TTL; otherwise call `fetch_fn`, store the result, and return it.

    `fetch_fn`'s return value must be JSON-serializable (it's written to a
    JSONB column as-is).

    Fails open, not closed: a Supabase read error is treated as a cache miss
    (falls through to `fetch_fn`) rather than aborting, and a Supabase write
    error is logged but does not discard an already-successful `fetch_fn`
    result. `fetch_fn` itself is never caught here — if it raises, that's a
    real failure and must propagate so the caller doesn't treat it as valid
    data.

    `force_refresh=True` skips the read entirely and always calls `fetch_fn`
    (still writing the result to cache). Needed by callers where the daily
    TTL isn't the right freshness signal — e.g. the EOD backfill job needs
    the post-close bar even though the morning job already populated this
    same (provider, cache_key) earlier today, well within its 24h TTL.
    """
    supabase = get_supabase_client()

    if not force_refresh:
        try:
            existing = (
                supabase.table("market_data_cache")
                .select("response, fetched_at, ttl_seconds")
                .eq("provider", provider)
                .eq("cache_key", cache_key)
                .execute()
            )
            if existing.data:
                row = existing.data[0]
                fetched_at = datetime.fromisoformat(row["fetched_at"])
                age_seconds = (datetime.now(timezone.utc) - fetched_at).total_seconds()
                if age_seconds < row["ttl_seconds"]:
                    return row["response"]
        except Exception as e:
            print(f"[ERROR] Cache read failed for {provider}/{cache_key}, falling back to fetch: {str(e)}")

    fresh = fetch_fn()

    try:
        supabase.table("market_data_cache").upsert(
            {
                "provider": provider,
                "cache_key": cache_key,
                "response": fresh,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "ttl_seconds": ttl_seconds,
            },
            on_conflict="provider,cache_key",
        ).execute()
    except Exception as e:
        print(f"[ERROR] Cache write failed for {provider}/{cache_key}, returning fetched result uncached: {str(e)}")

    return fresh
