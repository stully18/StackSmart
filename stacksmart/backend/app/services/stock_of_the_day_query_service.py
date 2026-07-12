"""Read-only queries against the Stock of the Day tables.

Kept separate from stock_of_the_day_service.py (pure scoring computation) and
stock_of_the_day_data_provider.py (external market data + cache) — this
module only reads what the cron job has already written to Supabase.
"""

import os
from typing import Dict, List, Optional

from supabase import create_client, Client


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, key)


def get_latest_pick() -> Optional[Dict]:
    """Most recent Stock of the Day pick, or None if the cron job hasn't run yet."""
    supabase = get_supabase_client()
    result = (
        supabase.table("stock_of_the_day_picks")
        .select("*")
        .order("pick_date", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_pick_history(days: int = 30) -> List[Dict]:
    """Most recent `days` picks, newest first."""
    supabase = get_supabase_client()
    result = (
        supabase.table("stock_of_the_day_picks")
        .select("*")
        .order("pick_date", desc=True)
        .limit(days)
        .execute()
    )
    return result.data


def get_performance_history(days: int = 90) -> List[Dict]:
    """Most recent `days` backfilled performance rows, newest first."""
    supabase = get_supabase_client()
    result = (
        supabase.table("stock_of_the_day_performance")
        .select("*")
        .order("pick_date", desc=True)
        .limit(days)
        .execute()
    )
    return result.data


def get_performance_summary(records: List[Dict]) -> Dict:
    """Aggregate win-rate/avg-return stats for the 1d/5d/20d windows.

    Each window is computed only from rows where that window has already
    been backfilled (return_Nd and spy_return_Nd both non-null), since 1d,
    5d, and 20d windows land at different times after the pick date.
    """

    def _window_stats(return_key: str, spy_key: str) -> Optional[Dict]:
        pairs = [
            (row[return_key], row[spy_key])
            for row in records
            if row.get(return_key) is not None and row.get(spy_key) is not None
        ]
        if not pairs:
            return None
        avg_return = sum(p[0] for p in pairs) / len(pairs)
        avg_spy_return = sum(p[1] for p in pairs) / len(pairs)
        win_rate = sum(1 for p in pairs if p[0] > p[1]) / len(pairs)
        return {
            "sample_size": len(pairs),
            "avg_return": avg_return,
            "avg_spy_return": avg_spy_return,
            "win_rate_vs_spy": win_rate,
        }

    return {
        "1d": _window_stats("return_1d", "spy_return_1d"),
        "5d": _window_stats("return_5d", "spy_return_5d"),
        "20d": _window_stats("return_20d", "spy_return_20d"),
    }
