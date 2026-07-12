"""Backfill 1d/5d/20d performance for past Stock of the Day picks.

For each recent pick, checks how many trading days have elapsed since
pick_date and fills in whichever of price_1d/5d/20d (+ returns, + SPY
returns for the same windows) have now come due. Trading-day counting comes
directly from the fetched price series (it only contains days the market was
open), so no separate market-calendar dependency is needed here.

Idempotent: re-running always recomputes price_at_pick and any due windows
and upserts via the pick_date UNIQUE constraint, so a retry after a partial
failure just re-fills what's still missing rather than erroring or
duplicating.

Run daily after market close: python -m app.jobs.eod_backfill_job
Scheduled via Railway cron — see railway.json.
"""

import os
from datetime import date, datetime
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

import pandas as pd
from supabase import create_client, Client

from app.services.stock_of_the_day_data_provider import get_price_history

WINDOWS = [1, 5, 20]
LOOKBACK_LIMIT = 60  # calendar days of recent picks to consider for backfill


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def _fetch_picks_needing_backfill(supabase: Client) -> List[Dict]:
    result = (
        supabase.table("stock_of_the_day_picks")
        .select("pick_date, ticker")
        .order("pick_date", desc=True)
        .limit(LOOKBACK_LIMIT)
        .execute()
    )
    return result.data or []


def _fetch_existing_performance(supabase: Client, pick_date_iso: str) -> Optional[Dict]:
    result = (
        supabase.table("stock_of_the_day_performance")
        .select("*")
        .eq("pick_date", pick_date_iso)
        .execute()
    )
    return result.data[0] if result.data else None


def _price_n_trading_days_after(closes: pd.Series, pick_date: date, n: int) -> Optional[float]:
    future = closes[closes.index.date > pick_date]
    if len(future) < n:
        return None
    return float(future.iloc[n - 1])


def _compute_update(ticker: str, pick_date: date) -> Optional[Dict]:
    try:
        ticker_closes = get_price_history(ticker, period="3mo")["Close"]
        spy_closes = get_price_history("SPY", period="3mo")["Close"]
    except Exception as e:
        print(f"[ERROR] Backfill: price history fetch failed for {ticker}: {str(e)}")
        return None

    pick_day_closes = ticker_closes[ticker_closes.index.date <= pick_date]
    spy_pick_day_closes = spy_closes[spy_closes.index.date <= pick_date]
    if pick_day_closes.empty or spy_pick_day_closes.empty:
        return None

    price_at_pick = float(pick_day_closes.iloc[-1])
    spy_price_at_pick = float(spy_pick_day_closes.iloc[-1])

    update: Dict = {}
    for window in WINDOWS:
        price_n = _price_n_trading_days_after(ticker_closes, pick_date, window)
        spy_price_n = _price_n_trading_days_after(spy_closes, pick_date, window)
        if price_n is not None:
            update[f"price_{window}d"] = price_n
            update[f"return_{window}d"] = (price_n / price_at_pick) - 1
        if spy_price_n is not None:
            update[f"spy_return_{window}d"] = (spy_price_n / spy_price_at_pick) - 1

    if not update:
        return None

    update["price_at_pick"] = price_at_pick
    return update


def run(as_of: Optional[date] = None) -> int:
    """Backfill performance rows due for an update as of `as_of` (default:
    today in America/New_York). Returns the count of rows written."""
    as_of = as_of or datetime.now(ZoneInfo("America/New_York")).date()
    supabase = get_supabase_client()

    picks = _fetch_picks_needing_backfill(supabase)
    written = 0

    for pick in picks:
        pick_date = date.fromisoformat(pick["pick_date"])
        if pick_date >= as_of:
            continue  # nothing can have closed yet for a pick made today

        ticker = pick["ticker"]
        existing = _fetch_existing_performance(supabase, pick["pick_date"])
        if existing and all(existing.get(f"return_{w}d") is not None for w in WINDOWS):
            continue  # fully backfilled already

        update = _compute_update(ticker, pick_date)
        if update is None:
            continue

        row = {"pick_date": pick["pick_date"], "ticker": ticker, **update}
        try:
            supabase.table("stock_of_the_day_performance").upsert(row, on_conflict="pick_date").execute()
            written += 1
        except Exception as e:
            print(f"[ERROR] Backfill: failed to write performance row for {pick['pick_date']}: {str(e)}")

    print(f"[INFO] EOD backfill: wrote {written} performance row(s) as of {as_of}.")
    return written


if __name__ == "__main__":
    run()
