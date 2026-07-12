"""Thin HTTP client for the Alpha Vantage endpoints Stock of the Day needs.

Kept separate from app/services/market_data_service.py (which powers the
existing ETF tools) so this addition doesn't touch that shared file.
"""

import os
from typing import Dict

import requests

ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
BASE_URL = "https://www.alphavantage.co/query"


class AlphaVantageError(Exception):
    """Raised on any request/parsing failure so callers (the cache layer) can
    tell a real API failure apart from a genuine 'no news today' result and
    avoid caching the failure as if it were valid data."""


def fetch_news_sentiment_raw(ticker: str, limit: int = 50) -> Dict:
    """Call Alpha Vantage NEWS_SENTIMENT for a single ticker.

    Returns the raw parsed JSON response. Raises AlphaVantageError on any
    request/parsing failure or rate-limit/error payload instead of quietly
    returning {"feed": []} — a caller that caches this result must not cache
    a transient failure as 24h of "no news".
    """
    try:
        params = {
            "function": "NEWS_SENTIMENT",
            "tickers": ticker,
            "limit": str(limit),
            "apikey": ALPHA_VANTAGE_API_KEY,
        }
        response = requests.get(BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        raise AlphaVantageError(f"Failed to fetch news sentiment for {ticker}: {str(e)}") from e

    # Alpha Vantage returns 200 OK with an "Information"/"Note"/"Error Message"
    # body for rate limits and invalid keys rather than a non-2xx status.
    if "feed" not in data:
        raise AlphaVantageError(
            f"Unexpected Alpha Vantage response for {ticker}: {data.get('Information') or data.get('Note') or data.get('Error Message') or data}"
        )
    return data
