"""Cheap bulk pre-filter that narrows the full stock watchlist (~150 tickers)
down to the daily shortlist (~20-40) that actually gets the expensive,
rate-limited per-ticker treatment (Alpha Vantage news sentiment, yfinance
analyst revisions).

Screens on price/volume alone — relative strength vs SPY and volume anomaly,
the same math as two of the six full-model factors — fetched in a single
batched yfinance download instead of one call per ticker, so this stays
cheap even at 150 candidates. Not cached: it's one bulk call per run, and
the daily-TTL price cache in market_data_cache_service is keyed per-ticker,
which wouldn't help here.
"""

from typing import List

import pandas as pd
import yfinance as yf

from app.config.stock_watchlist import STOCK_WATCHLIST
from app.services.stock_of_the_day_service import (
    calculate_relative_strength,
    calculate_volume_anomaly,
    zscore_normalize,
)

SHORTLIST_SIZE = 30


def _bulk_download(tickers: List[str], period: str = "3mo") -> pd.DataFrame:
    return yf.download(tickers, period=period, progress=False, group_by="ticker", threads=True)


def _extract_series(data: pd.DataFrame, ticker: str, field: str) -> pd.Series:
    try:
        series = data[ticker][field].dropna()
    except (KeyError, TypeError):
        return pd.Series(dtype=float)
    return series


def select_shortlist(shortlist_size: int = SHORTLIST_SIZE) -> List[str]:
    """Return the top `shortlist_size` watchlist tickers by a cheap
    price/volume-only screen. A ticker that fails to download or has too
    little history to compute either signal is simply excluded, not scored
    as neutral — same missing-data philosophy as the full scoring engine."""
    data = _bulk_download(STOCK_WATCHLIST + ["SPY"])
    spy_closes = _extract_series(data, "SPY", "Close")
    if spy_closes.empty:
        print("[ERROR] Pre-filter: could not fetch SPY history, aborting.")
        return []

    relative_strength: dict = {}
    volume_anomaly: dict = {}
    for ticker in STOCK_WATCHLIST:
        closes = _extract_series(data, ticker, "Close")
        volumes = _extract_series(data, ticker, "Volume")
        if closes.empty or volumes.empty:
            continue
        relative_strength[ticker] = calculate_relative_strength(closes, spy_closes)
        volume_anomaly[ticker] = calculate_volume_anomaly(volumes)

    rs_z = zscore_normalize(relative_strength)
    vol_z = zscore_normalize(volume_anomaly)

    combined = {
        ticker: rs_z.get(ticker, 0.0) + vol_z.get(ticker, 0.0)
        for ticker in relative_strength
    }
    ranked = sorted(combined.items(), key=lambda kv: kv[1], reverse=True)
    return [ticker for ticker, _ in ranked[:shortlist_size]]
