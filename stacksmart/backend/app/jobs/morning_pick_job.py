"""Daily Stock of the Day generation.

1. Skip on non-trading days (weekends + NYSE holidays, via
   pandas_market_calendars — a maintained calendar beats a hardcoded holiday
   list that goes stale every January).
2. Pre-filter the watchlist to a shortlist (candidate_prefilter_service).
3. Fetch price/volume/analyst/news data per shortlisted ticker (Phase 2
   cache layer) and compute raw factors. A fetch failure for one ticker's
   price history excludes that ticker; a failure on just its analyst or news
   data degrades that one factor to missing rather than dropping the ticker
   entirely — score_candidates() already excludes missing per-candidate
   factors and redistributes their weight instead of scoring them neutral.
4. Score candidates, pick the highest composite score, upsert into
   stock_of_the_day_picks. Idempotent: re-running for a date that already
   has a pick overwrites it via the pick_date UNIQUE constraint rather than
   erroring or duplicating.

Run manually: python -m app.jobs.morning_pick_job
Scheduled via Railway cron — see railway.json.
"""

import os
from datetime import date, datetime
from typing import Dict, Optional
from zoneinfo import ZoneInfo

import pandas_market_calendars as mcal
from supabase import create_client, Client

from app.services.candidate_prefilter_service import select_shortlist
from app.services.stock_of_the_day_data_provider import (
    get_analyst_revision_counts,
    get_news_items_for_ticker,
    get_price_history,
)
from app.services.stock_of_the_day_service import (
    calculate_analyst_revision,
    calculate_news_sentiment,
    calculate_relative_strength,
    calculate_technical_setup,
    calculate_volume_anomaly,
    calculate_vol_adjusted_momentum,
    pick_stock_of_the_day,
)

NYSE = mcal.get_calendar("NYSE")


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def is_trading_day(day: date) -> bool:
    return not NYSE.schedule(start_date=day, end_date=day).empty


def _safe_compute_raw_factors(ticker: str, spy_closes) -> Optional[Dict[str, Optional[float]]]:
    """Compute one candidate's raw factors, or None to skip it entirely
    (only when price history — required for every factor — can't be
    fetched)."""
    try:
        history = get_price_history(ticker)
        closes = history["Close"]
        volumes = history["Volume"]
    except Exception as e:
        print(f"[ERROR] Skipping {ticker}: price history fetch failed: {str(e)}")
        return None

    if closes.empty or len(closes) < 2:
        print(f"[ERROR] Skipping {ticker}: insufficient price history")
        return None

    try:
        upgrades, downgrades = get_analyst_revision_counts(ticker)
        analyst_revision = calculate_analyst_revision(upgrades, downgrades)
    except Exception as e:
        print(f"[ERROR] {ticker}: analyst revision fetch failed, treating as missing: {str(e)}")
        analyst_revision = None

    try:
        news_items = get_news_items_for_ticker(ticker)
        news_sentiment = calculate_news_sentiment(news_items)
    except Exception as e:
        print(f"[ERROR] {ticker}: news sentiment fetch failed, treating as missing: {str(e)}")
        news_sentiment = None

    return {
        "momentum": calculate_relative_strength(closes, spy_closes),
        "volume": calculate_volume_anomaly(volumes),
        "analyst_revision": analyst_revision,
        "news_sentiment": news_sentiment,
        "technical_setup": calculate_technical_setup(closes),
        "vol_adjusted_momentum": calculate_vol_adjusted_momentum(closes),
    }


def run(pick_date: Optional[date] = None) -> Optional[Dict]:
    """Generate and store the Stock of the Day pick for `pick_date`
    (default: today in America/New_York). Returns the stored row, or None
    if skipped (non-trading day, or no candidate could be scored)."""
    pick_date = pick_date or datetime.now(ZoneInfo("America/New_York")).date()

    if not is_trading_day(pick_date):
        print(f"[INFO] {pick_date} is not a NYSE trading day, skipping.")
        return None

    shortlist = select_shortlist()
    if not shortlist:
        print("[ERROR] Pre-filter returned an empty shortlist, aborting.")
        return None

    try:
        spy_closes = get_price_history("SPY")["Close"]
    except Exception as e:
        print(f"[ERROR] Could not fetch SPY history, aborting: {str(e)}")
        return None
    if spy_closes.empty:
        print("[ERROR] SPY history came back empty, aborting.")
        return None

    raw_factors_by_ticker = {}
    for ticker in shortlist:
        factors = _safe_compute_raw_factors(ticker, spy_closes)
        if factors is not None:
            raw_factors_by_ticker[ticker] = factors

    if not raw_factors_by_ticker:
        print("[ERROR] No candidates could be scored today, aborting.")
        return None

    ticker, result = pick_stock_of_the_day(raw_factors_by_ticker)

    row = {
        "pick_date": pick_date.isoformat(),
        "ticker": ticker,
        "composite_score": result["composite_score"],
        "factor_breakdown": result["factor_breakdown"],
    }

    supabase = get_supabase_client()
    supabase.table("stock_of_the_day_picks").upsert(row, on_conflict="pick_date").execute()

    print(f"[INFO] Stock of the Day for {pick_date}: {ticker} (composite={result['composite_score']:+.3f})")
    return row


if __name__ == "__main__":
    run()
