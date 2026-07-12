"""
Stock of the Day — multi-factor scoring engine.

Computes six factors per candidate stock, z-score normalizes each factor
across that day's candidate universe, then combines them into a weighted
composite score. Highest composite score wins.

This module is pure computation (plus a thin yfinance fetch helper for the
Phase 1 demo). Phase 2 wraps Alpha Vantage calls (news sentiment, analyst
revisions) in a Postgres-backed cache; Phase 3 exposes this via FastAPI;
Phase 5 schedules it as a Railway cron job.
"""

import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf

# Default weights — mirrors the initial row seeded into factor_weights_config.
# The DB table is the source of truth at runtime; this dict is the fallback
# used if the DB is unreachable, and it seeds the migration's first version.
#
# "technical_setup" corresponds to what the product spec calls "RSI penalty"
# (weight 0.10) but its raw value blends RSI-overbought-penalty with the
# moving-average-crossover signal, since the spec describes both signals
# under one "Technical setup" factor and only allocates one weight bucket
# for it.
DEFAULT_WEIGHTS: Dict[str, float] = {
    "momentum": 0.20,
    "volume": 0.15,
    "analyst_revision": 0.15,
    "news_sentiment": 0.20,
    "technical_setup": 0.10,
    "vol_adjusted_momentum": 0.20,
}

FACTOR_KEYS: List[str] = list(DEFAULT_WEIGHTS.keys())


# ============= Pure math: normalization & composite =============

def zscore_normalize(values: Dict[str, Optional[float]]) -> Dict[str, float]:
    """Z-score normalize a single factor's raw values across the candidate universe.

    (value - mean) / stdev per candidate. Returns 0.0 for every candidate when
    the universe has fewer than 2 usable values or zero variance, since the
    z-score is undefined in those cases (rather than raising or dividing by
    zero) — a 0.0 contribution means that factor simply doesn't move the
    composite score for anyone that day.
    """
    clean = {k: v for k, v in values.items() if v is not None and not (isinstance(v, float) and math.isnan(v))}

    if len(clean) < 2:
        return {k: 0.0 for k in values}

    arr = np.array(list(clean.values()), dtype=float)
    mean = arr.mean()
    stdev = arr.std(ddof=0)

    if stdev == 0:
        return {k: 0.0 for k in values}

    return {k: ((v - mean) / stdev if k in clean else 0.0) for k, v in values.items()}


def compute_composite(zscores: Dict[str, float], weights: Optional[Dict[str, float]] = None) -> float:
    """Weighted sum of per-factor z-scores. A factor missing from `zscores`
    contributes 0 rather than raising, so a candidate with partial data can
    still be scored on what's available."""
    weights = weights or DEFAULT_WEIGHTS
    return sum(zscores.get(factor, 0.0) * weight for factor, weight in weights.items())


# ============= Raw factor calculators (single-ticker inputs) =============

def calculate_return(closes: pd.Series, lookback_days: int = 20) -> Optional[float]:
    """N-day return, as a percentage."""
    if len(closes) < lookback_days + 1:
        return None
    start = closes.iloc[-(lookback_days + 1)]
    end = closes.iloc[-1]
    if start == 0:
        return None
    return float((end / start - 1) * 100)


def calculate_relative_strength(ticker_closes: pd.Series, spy_closes: pd.Series, lookback_days: int = 20) -> Optional[float]:
    """Ticker's N-day return minus SPY's N-day return over the same window."""
    ticker_return = calculate_return(ticker_closes, lookback_days)
    spy_return = calculate_return(spy_closes, lookback_days)
    if ticker_return is None or spy_return is None:
        return None
    return ticker_return - spy_return


def calculate_volume_anomaly(volumes: pd.Series, lookback_days: int = 20) -> Optional[float]:
    """Today's volume vs trailing N-day average volume, as a ratio (1.0 = normal)."""
    if len(volumes) < lookback_days + 1:
        return None
    avg = volumes.iloc[-(lookback_days + 1):-1].mean()
    if avg == 0:
        return None
    return float(volumes.iloc[-1] / avg)


def calculate_rsi(closes: pd.Series, period: int = 14) -> Optional[float]:
    """Standard N-day RSI using a simple rolling mean of gains/losses."""
    if len(closes) < period + 1:
        return None
    delta = closes.diff().dropna()
    gains = delta.clip(lower=0)
    losses = -delta.clip(upper=0)
    avg_gain = gains.rolling(period).mean().iloc[-1]
    avg_loss = losses.rolling(period).mean().iloc[-1]
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return float(100 - (100 / (1 + rs)))


def calculate_ma_crossover(closes: pd.Series, short: int = 20, long: int = 50) -> Optional[float]:
    """Percentage gap between short and long moving averages; positive = bullish."""
    if len(closes) < long:
        return None
    short_ma = closes.iloc[-short:].mean()
    long_ma = closes.iloc[-long:].mean()
    if long_ma == 0:
        return None
    return float((short_ma - long_ma) / long_ma * 100)


def calculate_realized_volatility(closes: pd.Series, period: int = 20) -> Optional[float]:
    """Annualized realized volatility (%) over the trailing window."""
    if len(closes) < period + 1:
        return None
    daily_returns = closes.pct_change().dropna().iloc[-period:]
    return float(daily_returns.std() * math.sqrt(252) * 100)


def calculate_vol_adjusted_momentum(closes: pd.Series, lookback_days: int = 20) -> Optional[float]:
    """Momentum divided by realized volatility (Sharpe-like ratio). Uses the
    stock's own absolute return (not relative-to-SPY) since the momentum
    factor already captures relative strength — this factor differentiates
    by rewarding smooth/efficient moves over noisy ones."""
    momentum = calculate_return(closes, lookback_days)
    vol = calculate_realized_volatility(closes)
    if momentum is None or vol is None or vol == 0:
        return None
    return momentum / vol


def _rsi_component(rsi: Optional[float]) -> Optional[float]:
    """Map RSI onto a continuous -1..1 scale: 0 at neutral (50), rising to
    +1 at RSI 70 (healthy strength), then falling from +1 back down to -1 as
    RSI runs from 70 to 100 (overbought). Both branches meet at exactly +1.0
    at RSI=70 by construction — a discontinuity here would mean a fraction
    of a point of RSI could swing a candidate's score by a full point."""
    if rsi is None:
        return None
    if rsi > 70:
        return max(1.0 - 2.0 * (rsi - 70) / 30, -1.0)
    return (rsi - 50) / 20


def _crossover_component(crossover_pct: Optional[float]) -> Optional[float]:
    """Squash the MA crossover percentage gap onto a roughly -1..1 scale."""
    if crossover_pct is None:
        return None
    return float(math.tanh(crossover_pct / 5.0))


def calculate_technical_setup(closes: pd.Series) -> Optional[float]:
    """Blend of RSI overbought penalty (60%) and MA crossover signal (40%)
    into one raw score. Both sub-signals are normalized to a comparable
    -1..1 range before blending, since RSI is quoted 0-100 and the crossover
    is a percentage gap — averaging them unscaled would let RSI dominate."""
    rsi_component = _rsi_component(calculate_rsi(closes))
    crossover_component = _crossover_component(calculate_ma_crossover(closes))

    if rsi_component is None and crossover_component is None:
        return None
    if rsi_component is None:
        return crossover_component
    if crossover_component is None:
        return rsi_component
    return 0.6 * rsi_component + 0.4 * crossover_component


def calculate_analyst_revision(upgrades: int, downgrades: int) -> float:
    """Net upgrades minus downgrades over the lookback window (5-10 trading days)."""
    return float(upgrades - downgrades)


def calculate_news_sentiment(news_items: List[Dict], now: Optional[datetime] = None) -> Optional[float]:
    """Relevance-weighted, recency-decayed average sentiment score.

    Each item is expected to have: sentiment_score (-1..1), relevance_score
    (0..1), and time_published (datetime). Recency decay uses a 3-day
    half-life so today's news dominates but the last few days still count.
    """
    if not news_items:
        return None

    now = now or datetime.utcnow()
    weighted_sum = 0.0
    weight_total = 0.0
    for item in news_items:
        age_days = max((now - item["time_published"]).total_seconds() / 86400, 0)
        recency_weight = 0.5 ** (age_days / 3.0)
        weight = item.get("relevance_score", 0.0) * recency_weight
        weighted_sum += item.get("sentiment_score", 0.0) * weight
        weight_total += weight

    if weight_total == 0:
        return None
    return weighted_sum / weight_total


# ============= Orchestration =============

def compute_raw_factors(
    ticker_closes: pd.Series,
    ticker_volumes: pd.Series,
    spy_closes: pd.Series,
    analyst_upgrades: int = 0,
    analyst_downgrades: int = 0,
    news_items: Optional[List[Dict]] = None,
) -> Dict[str, Optional[float]]:
    """Compute all 6 raw factor values for a single candidate ticker."""
    return {
        "momentum": calculate_relative_strength(ticker_closes, spy_closes),
        "volume": calculate_volume_anomaly(ticker_volumes),
        "analyst_revision": calculate_analyst_revision(analyst_upgrades, analyst_downgrades),
        "news_sentiment": calculate_news_sentiment(news_items or []),
        "technical_setup": calculate_technical_setup(ticker_closes),
        "vol_adjusted_momentum": calculate_vol_adjusted_momentum(ticker_closes),
    }


def score_candidates(
    raw_factors_by_ticker: Dict[str, Dict[str, Optional[float]]],
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Dict]:
    """Z-score normalize each factor across the candidate universe, then
    compute each candidate's weighted composite score.

    Returns, per ticker: {"composite_score": float, "factor_breakdown": {...}}
    where factor_breakdown has raw_value/zscore/weight/weighted_contribution
    per factor — this is what gets stored in stock_of_the_day_picks and
    surfaced in the frontend's factor breakdown chart.

    A factor with no raw value for a given candidate (missing news that day,
    no analyst coverage, insufficient price history, etc.) is excluded from
    that candidate's composite rather than defaulting to a neutral z-score of
    0 — a 0 reads as "average", which quietly rewards thin data over a
    genuinely below-average factor. The remaining available factors' weights
    are rescaled so they still sum to the full weight total, and the
    "weight" shown in the breakdown reflects that rescaled value, so the
    displayed contributions always sum to the composite score.
    """
    weights = weights or DEFAULT_WEIGHTS
    total_weight = sum(weights.values())

    zscores_by_factor: Dict[str, Dict[str, float]] = {}
    for factor in FACTOR_KEYS:
        raw_by_ticker = {t: factors.get(factor) for t, factors in raw_factors_by_ticker.items()}
        zscores_by_factor[factor] = zscore_normalize(raw_by_ticker)

    results = {}
    for ticker, raw_factors in raw_factors_by_ticker.items():
        ticker_zscores = {factor: zscores_by_factor[factor][ticker] for factor in FACTOR_KEYS}

        available_factors = [f for f in FACTOR_KEYS if raw_factors.get(f) is not None]
        available_weight = sum(weights[f] for f in available_factors)
        scale = (total_weight / available_weight) if available_weight > 0 else 0.0
        effective_weights = {
            f: (weights[f] * scale if f in available_factors else 0.0) for f in FACTOR_KEYS
        }

        composite = sum(ticker_zscores[f] * effective_weights[f] for f in FACTOR_KEYS)

        breakdown = {
            factor: {
                "raw_value": raw_factors.get(factor),
                "zscore": ticker_zscores[factor],
                "weight": effective_weights[factor],
                "weighted_contribution": ticker_zscores[factor] * effective_weights[factor],
            }
            for factor in FACTOR_KEYS
        }
        results[ticker] = {"composite_score": composite, "factor_breakdown": breakdown}

    return results


def pick_stock_of_the_day(
    raw_factors_by_ticker: Dict[str, Dict[str, Optional[float]]],
    weights: Optional[Dict[str, float]] = None,
) -> Tuple[str, Dict]:
    """Return the (ticker, result) with the highest composite score."""
    if not raw_factors_by_ticker:
        raise ValueError("raw_factors_by_ticker must contain at least one candidate")
    scored = score_candidates(raw_factors_by_ticker, weights)
    return max(scored.items(), key=lambda kv: kv[1]["composite_score"])


# ============= Data fetching (yfinance) =============
# Phase 2 wraps the Alpha Vantage calls (news sentiment, analyst revisions)
# in a Postgres-backed TTL cache. Price/volume history below uses yfinance
# directly, same as market_data_fetcher.py — no caching here yet since this
# is only used by the Phase 1 demo script; the real daily job will route
# through the Phase 2 cache layer.

def fetch_price_history(ticker: str, period: str = "3mo") -> pd.DataFrame:
    """Fetch daily OHLCV history for a ticker via yfinance."""
    return yf.download(ticker, period=period, progress=False, multi_level_index=False)
