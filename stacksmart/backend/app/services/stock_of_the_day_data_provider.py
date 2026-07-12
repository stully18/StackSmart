"""External data inputs for Stock of the Day, wired through the Postgres TTL
cache in market_data_cache_service.

- News sentiment: Alpha Vantage NEWS_SENTIMENT, cached daily (AV free tier
  is heavily rate-limited, so this matters a lot for a 20-40 ticker shortlist).
- Analyst revisions: yfinance's upgrades_downgrades history (no AV endpoint
  for this on the free tier), cached 5-7 days since ratings change slowly.
- Price/volume: yfinance daily OHLCV, cached daily.

stock_of_the_day_service.py stays pure computation; this module is where
the I/O and cache plumbing live.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Tuple

import pandas as pd
import yfinance as yf

from app.services.alpha_vantage_client import AlphaVantageError, fetch_news_sentiment_raw
from app.services.market_data_cache_service import get_cached_or_fetch

NEWS_SENTIMENT_TTL_SECONDS = 24 * 60 * 60           # daily, per spec
ANALYST_REVISION_TTL_SECONDS = 6 * 24 * 60 * 60      # 5-7 days, per spec
PRICE_HISTORY_TTL_SECONDS = 24 * 60 * 60             # daily, per spec
ANALYST_LOOKBACK_DAYS = 10                           # "last 5-10 trading days"


# ============= News sentiment (Alpha Vantage) =============

def get_news_items_for_ticker(ticker: str) -> List[Dict]:
    """Return parsed news items for `ticker`: sentiment_score/relevance_score/
    time_published (datetime), ready for calculate_news_sentiment.

    Backed by a daily-TTL cache entry holding the raw Alpha Vantage response.
    Timestamps round-trip through JSONB as strings, so parsing back into
    datetimes happens fresh on every call.

    A transient Alpha Vantage failure (rate limit, outage, bad payload)
    degrades to "no news for today" for this call only — it is deliberately
    NOT cached, so the next call (or tomorrow's run) gets a fresh attempt
    instead of 24h of a poisoned empty result. Downstream, an empty list
    makes calculate_news_sentiment return None, which the scoring engine
    treats as missing data (excluded + weight redistributed), not a
    confirmed-neutral score.
    """
    try:
        raw = get_cached_or_fetch(
            provider="alpha_vantage",
            cache_key=f"news_sentiment_{ticker}",
            ttl_seconds=NEWS_SENTIMENT_TTL_SECONDS,
            fetch_fn=lambda: fetch_news_sentiment_raw(ticker),
        )
    except AlphaVantageError as e:
        print(f"[ERROR] News sentiment unavailable for {ticker}, treating as missing data: {str(e)}")
        return []

    news_items = []
    for article in raw.get("feed", []):
        time_published_raw = article.get("time_published")
        if not time_published_raw:
            continue
        try:
            time_published = datetime.strptime(time_published_raw, "%Y%m%dT%H%M%S")
        except ValueError:
            continue

        ticker_match = next(
            (ts for ts in article.get("ticker_sentiment", []) if ts.get("ticker") == ticker),
            None,
        )
        if ticker_match is None:
            continue

        try:
            sentiment_score = float(ticker_match.get("ticker_sentiment_score", 0.0))
            relevance_score = float(ticker_match.get("relevance_score", 0.0))
        except (TypeError, ValueError):
            continue

        news_items.append({
            "sentiment_score": sentiment_score,
            "relevance_score": relevance_score,
            "time_published": time_published,
        })

    return news_items


# ============= Analyst revisions (yfinance) =============

def _fetch_analyst_actions_raw(ticker: str) -> List[Dict]:
    """Full upgrades/downgrades history from yfinance, as JSON-safe rows.
    Cached as the whole history (not just the lookback window) so the
    lookback filter below stays accurate for the entire cache TTL window."""
    history = yf.Ticker(ticker).upgrades_downgrades
    if history is None or history.empty:
        return []

    rows = []
    for grade_date, row in history.iterrows():
        rows.append({
            "grade_date": grade_date.isoformat(),
            "action": row.get("Action"),
        })
    return rows


def get_analyst_revision_counts(ticker: str) -> Tuple[int, int]:
    """Return (upgrades, downgrades) counts over the last ANALYST_LOOKBACK_DAYS."""
    raw_actions = get_cached_or_fetch(
        provider="yfinance",
        cache_key=f"analyst_revision_{ticker}",
        ttl_seconds=ANALYST_REVISION_TTL_SECONDS,
        fetch_fn=lambda: _fetch_analyst_actions_raw(ticker),
    )

    cutoff = datetime.now() - timedelta(days=ANALYST_LOOKBACK_DAYS)
    upgrades = 0
    downgrades = 0
    for row in raw_actions:
        try:
            grade_date = datetime.fromisoformat(row["grade_date"])
        except (KeyError, ValueError, TypeError):
            continue
        if grade_date < cutoff:
            continue
        action = row.get("action")
        if action == "up":
            upgrades += 1
        elif action == "down":
            downgrades += 1

    return upgrades, downgrades


# ============= Price/volume history (yfinance) =============

def _fetch_price_history_raw(ticker: str, period: str) -> Dict:
    df = yf.download(ticker, period=period, progress=False, multi_level_index=False)
    records = [
        {"date": date.isoformat(), "close": float(row["Close"]), "volume": float(row["Volume"])}
        for date, row in df.iterrows()
    ]
    return {"records": records}


def get_price_history(ticker: str, period: str = "3mo") -> pd.DataFrame:
    """Daily OHLCV (Close/Volume only) for a ticker, via a daily-TTL cache."""
    raw = get_cached_or_fetch(
        provider="yfinance",
        cache_key=f"price_history_{ticker}_{period}",
        ttl_seconds=PRICE_HISTORY_TTL_SECONDS,
        fetch_fn=lambda: _fetch_price_history_raw(ticker, period),
    )

    records = raw.get("records", [])
    if not records:
        return pd.DataFrame(columns=["Close", "Volume"])

    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    return df.set_index("date").rename(columns={"close": "Close", "volume": "Volume"})
