"""Daily Stock of the Day generation.

1. Skip on non-trading days (weekends + NYSE holidays, via
   pandas_market_calendars — a maintained calendar beats a hardcoded holiday
   list that goes stale every January).
2. Skip if run outside the intended ET execution window (see SCHEDULING
   below) — a no-op, not a failure.
3. Unless force=True, skip if a pick already exists for the date — a retry
   (e.g. a redeployed cron trigger) must not silently overwrite an
   already-published pick with a possibly-different result.
4. Pre-filter the watchlist to a shortlist (candidate_prefilter_service).
5. Fetch price/volume/analyst/news data per shortlisted ticker (Phase 2
   cache layer) and compute raw factors. A fetch failure for one ticker's
   price history excludes that ticker; a failure on just its analyst or news
   data degrades that one factor to missing rather than dropping the ticker
   entirely — score_candidates() already excludes missing per-candidate
   factors and redistributes their weight instead of scoring them neutral.
   pick_stock_of_the_day() additionally requires a minimum fraction of the
   total factor weight to have real data before a candidate is eligible to
   win outright, so a thinly-covered candidate can't win purely because
   its few available factors happened to score well.
6. Score candidates, pick the highest composite score, upsert into
   stock_of_the_day_picks.

FAILURE HANDLING: an empty shortlist, missing SPY data, or zero scorable
candidates are genuine failures (something's actually broken), not benign
skips — they raise MorningPickJobError, and __main__ turns that into a
non-zero exit so Railway marks the run failed instead of silently "passing"
with no pick written. A non-trading day or an out-of-window run is not a
failure and exits 0.

SCHEDULING: Railway cron schedules are fixed UTC and don't shift for US
DST, so a single UTC schedule can't stay pinned to a fixed ET time
year-round. Work around it by registering the cron trigger TWICE — once for
each DST regime — and let this job's own ET-based window check discard
whichever trigger fires at the wrong actual ET time:
    10:05 ET target (chosen over 9:35 ET so volume anomaly isn't scored off
    just the first 5 minutes of trading):
      - EDT (Mar-Nov): cron `5 14 * * 1-5`  (14:05 UTC = 10:05 ET)
      - EST (Nov-Mar): cron `5 15 * * 1-5`  (15:05 UTC = 10:05 ET)
Both are configured on the same Railway service; on any given day only the
one matching the current ET offset falls inside EXECUTION_WINDOW below, and
the other exits 0 immediately as a no-op.

Run manually: python -m app.jobs.morning_pick_job
Scheduled via Railway cron (set on the service in the Railway dashboard —
there's no single railway.json across services for per-service cron).
"""

import os
import sys
from datetime import date, datetime, time
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
EASTERN = ZoneInfo("America/New_York")

# Wide enough to comfortably contain the 10:05 ET target from either of the
# two DST-regime cron triggers described above, narrow enough to reject a
# trigger firing at the wrong UTC-offset assumption (e.g. 9:05 or 11:05 ET).
EXECUTION_WINDOW = (time(9, 45), time(10, 45))

# A pick can win outright only if at least this fraction of the total
# factor weight came from real data — see stock_of_the_day_service.
MIN_COVERAGE_FRACTION = 0.7


class MorningPickJobError(Exception):
    """A genuine failure: the job could not produce a pick. Distinct from a
    benign skip (non-trading day, outside the execution window, or a pick
    already exists for today), which returns None instead of raising."""


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def is_trading_day(day: date) -> bool:
    return not NYSE.schedule(start_date=day, end_date=day).empty


def is_within_execution_window(now: Optional[datetime] = None) -> bool:
    now_et = (now or datetime.now(EASTERN)).astimezone(EASTERN)
    start, end = EXECUTION_WINDOW
    return start <= now_et.time() <= end


def _get_existing_pick(supabase: Client, pick_date_iso: str) -> Optional[Dict]:
    result = (
        supabase.table("stock_of_the_day_picks")
        .select("*")
        .eq("pick_date", pick_date_iso)
        .execute()
    )
    return result.data[0] if result.data else None


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


def run(pick_date: Optional[date] = None, force: bool = False) -> Optional[Dict]:
    """Generate and store the Stock of the Day pick for `pick_date`
    (default: today in America/New_York).

    Returns the stored row, or None for a benign skip (non-trading day,
    outside the execution window, or a pick already exists and force=False).
    Raises MorningPickJobError for a genuine failure to produce a pick.
    """
    pick_date = pick_date or datetime.now(EASTERN).date()

    if not is_trading_day(pick_date):
        print(f"[INFO] {pick_date} is not a NYSE trading day, skipping.")
        return None

    if not is_within_execution_window():
        print("[INFO] Outside the intended ET execution window, skipping (see SCHEDULING in module docstring).")
        return None

    supabase = get_supabase_client()

    if not force:
        existing = _get_existing_pick(supabase, pick_date.isoformat())
        if existing is not None:
            print(f"[INFO] A pick already exists for {pick_date}, skipping (pass force=True to recompute).")
            return existing

    shortlist = select_shortlist()
    if not shortlist:
        raise MorningPickJobError("Pre-filter returned an empty shortlist")

    try:
        spy_closes = get_price_history("SPY")["Close"]
    except Exception as e:
        raise MorningPickJobError(f"Could not fetch SPY history: {str(e)}") from e
    if spy_closes.empty:
        raise MorningPickJobError("SPY history came back empty")

    raw_factors_by_ticker = {}
    for ticker in shortlist:
        factors = _safe_compute_raw_factors(ticker, spy_closes)
        if factors is not None:
            raw_factors_by_ticker[ticker] = factors

    if not raw_factors_by_ticker:
        raise MorningPickJobError("No candidates could be scored today")

    ticker, result = pick_stock_of_the_day(raw_factors_by_ticker, min_coverage_fraction=MIN_COVERAGE_FRACTION)

    row = {
        "pick_date": pick_date.isoformat(),
        "ticker": ticker,
        "composite_score": result["composite_score"],
        "factor_breakdown": result["factor_breakdown"],
    }

    supabase.table("stock_of_the_day_picks").upsert(row, on_conflict="pick_date").execute()

    print(f"[INFO] Stock of the Day for {pick_date}: {ticker} (composite={result['composite_score']:+.3f})")
    return row


if __name__ == "__main__":
    try:
        run()
    except MorningPickJobError as e:
        print(f"[ERROR] Morning pick job failed: {str(e)}")
        sys.exit(1)
