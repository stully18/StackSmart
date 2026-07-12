"""Unit tests for the Stock of the Day factor scoring engine."""

import math
from datetime import datetime, timedelta

import pandas as pd
import pytest

from app.services.stock_of_the_day_service import (
    DEFAULT_WEIGHTS,
    FACTOR_KEYS,
    _rsi_component,
    calculate_analyst_revision,
    calculate_ma_crossover,
    calculate_news_sentiment,
    calculate_return,
    calculate_rsi,
    calculate_technical_setup,
    calculate_vol_adjusted_momentum,
    compute_composite,
    pick_stock_of_the_day,
    score_candidates,
    zscore_normalize,
)


# ============= zscore_normalize =============

class TestZscoreNormalize:
    def test_normal_case(self):
        values = {"a": 10.0, "b": 20.0, "c": 30.0}
        result = zscore_normalize(values)
        # mean=20, stdev=sqrt(((10-20)^2+(0)+(10)^2)/3)=sqrt(200/3)
        stdev = math.sqrt(200 / 3)
        assert result["a"] == pytest.approx((10 - 20) / stdev)
        assert result["b"] == pytest.approx(0.0)
        assert result["c"] == pytest.approx((30 - 20) / stdev)

    def test_all_equal_values_returns_zero(self):
        values = {"a": 5.0, "b": 5.0, "c": 5.0}
        result = zscore_normalize(values)
        assert result == {"a": 0.0, "b": 0.0, "c": 0.0}

    def test_single_candidate_returns_zero(self):
        values = {"a": 42.0}
        result = zscore_normalize(values)
        assert result == {"a": 0.0}

    def test_empty_universe(self):
        assert zscore_normalize({}) == {}

    def test_none_values_excluded_from_stats_but_present_in_output(self):
        values = {"a": 10.0, "b": None, "c": 30.0}
        result = zscore_normalize(values)
        assert set(result.keys()) == {"a", "b", "c"}
        assert result["b"] == 0.0
        # a and c should be normalized against each other only (mean=20, stdev=10)
        assert result["a"] == pytest.approx(-1.0)
        assert result["c"] == pytest.approx(1.0)

    def test_nan_values_treated_like_none(self):
        values = {"a": 10.0, "b": float("nan"), "c": 30.0}
        result = zscore_normalize(values)
        assert result["b"] == 0.0
        assert result["a"] == pytest.approx(-1.0)
        assert result["c"] == pytest.approx(1.0)

    def test_fewer_than_two_clean_values_returns_zero(self):
        values = {"a": 10.0, "b": None, "c": None}
        result = zscore_normalize(values)
        assert result == {"a": 0.0, "b": 0.0, "c": 0.0}


# ============= compute_composite =============

class TestComputeComposite:
    def test_weighted_sum_with_default_weights(self):
        zscores = {
            "momentum": 1.0,
            "volume": 2.0,
            "analyst_revision": 0.0,
            "news_sentiment": -1.0,
            "technical_setup": 0.5,
            "vol_adjusted_momentum": 1.5,
        }
        expected = (
            1.0 * 0.20 + 2.0 * 0.15 + 0.0 * 0.15 + -1.0 * 0.20 + 0.5 * 0.10 + 1.5 * 0.20
        )
        assert compute_composite(zscores) == pytest.approx(expected)

    def test_custom_weights(self):
        zscores = {"momentum": 2.0, "volume": 4.0}
        weights = {"momentum": 0.5, "volume": 0.5}
        assert compute_composite(zscores, weights) == pytest.approx(3.0)

    def test_missing_factor_contributes_zero(self):
        zscores = {"momentum": 1.0}  # all other factors absent
        result = compute_composite(zscores)
        assert result == pytest.approx(1.0 * DEFAULT_WEIGHTS["momentum"])

    def test_all_zero_zscores_gives_zero_composite(self):
        zscores = {k: 0.0 for k in DEFAULT_WEIGHTS}
        assert compute_composite(zscores) == 0.0


# ============= score_candidates / pick_stock_of_the_day =============

class TestScoreCandidates:
    def test_highest_raw_momentum_wins_when_other_factors_equal(self):
        raw_factors = {
            "AAA": {"momentum": 5.0, "volume": 1.0, "analyst_revision": 0.0,
                     "news_sentiment": 0.0, "technical_setup": 0.0, "vol_adjusted_momentum": 0.0},
            "BBB": {"momentum": 10.0, "volume": 1.0, "analyst_revision": 0.0,
                     "news_sentiment": 0.0, "technical_setup": 0.0, "vol_adjusted_momentum": 0.0},
            "CCC": {"momentum": -5.0, "volume": 1.0, "analyst_revision": 0.0,
                     "news_sentiment": 0.0, "technical_setup": 0.0, "vol_adjusted_momentum": 0.0},
        }
        ticker, result = pick_stock_of_the_day(raw_factors)
        assert ticker == "BBB"
        assert result["composite_score"] > 0

    def test_breakdown_contains_all_factor_fields(self):
        raw_factors = {
            "AAA": {"momentum": 1.0, "volume": 2.0, "analyst_revision": 1.0,
                     "news_sentiment": 0.5, "technical_setup": -0.5, "vol_adjusted_momentum": 0.2},
            "BBB": {"momentum": -1.0, "volume": -2.0, "analyst_revision": -1.0,
                     "news_sentiment": -0.5, "technical_setup": 0.5, "vol_adjusted_momentum": -0.2},
        }
        scored = score_candidates(raw_factors)
        for ticker in raw_factors:
            breakdown = scored[ticker]["factor_breakdown"]
            assert set(breakdown.keys()) == set(DEFAULT_WEIGHTS.keys())
            for factor, detail in breakdown.items():
                assert set(detail.keys()) == {"raw_value", "zscore", "weight", "weighted_contribution"}
                assert detail["weighted_contribution"] == pytest.approx(detail["zscore"] * detail["weight"])

    def test_empty_universe_raises(self):
        with pytest.raises(ValueError):
            pick_stock_of_the_day({})

    def test_single_candidate_gets_zero_composite(self):
        raw_factors = {
            "AAA": {"momentum": 5.0, "volume": 2.0, "analyst_revision": 1.0,
                     "news_sentiment": 0.3, "technical_setup": 0.1, "vol_adjusted_momentum": 0.4},
        }
        ticker, result = pick_stock_of_the_day(raw_factors)
        assert ticker == "AAA"
        assert result["composite_score"] == 0.0

    def test_missing_factor_excluded_and_weight_redistributed(self):
        # AAA is missing news_sentiment entirely (e.g. no news that day).
        # It should NOT be scored as if it had a neutral (average) news
        # score — that factor should drop out of its composite, and the
        # remaining factors' weights should be rescaled to still sum to the
        # full weight total for AAA specifically.
        raw_factors = {
            "AAA": {"momentum": 1.0, "volume": 1.0, "analyst_revision": 1.0,
                     "news_sentiment": None, "technical_setup": 1.0, "vol_adjusted_momentum": 1.0},
            "BBB": {"momentum": 1.0, "volume": 1.0, "analyst_revision": 1.0,
                     "news_sentiment": 1.0, "technical_setup": 1.0, "vol_adjusted_momentum": 1.0},
        }
        scored = score_candidates(raw_factors)

        aaa_breakdown = scored["AAA"]["factor_breakdown"]
        assert aaa_breakdown["news_sentiment"]["weight"] == 0.0
        assert aaa_breakdown["news_sentiment"]["weighted_contribution"] == 0.0

        # Every other factor's weight for AAA should be scaled up so the
        # available weights still sum to the full 1.0 total.
        available_weight_sum = sum(
            detail["weight"] for factor, detail in aaa_breakdown.items() if factor != "news_sentiment"
        )
        assert available_weight_sum == pytest.approx(sum(DEFAULT_WEIGHTS.values()))

        # Displayed contributions must always sum to the composite score.
        assert sum(d["weighted_contribution"] for d in aaa_breakdown.values()) == pytest.approx(
            scored["AAA"]["composite_score"]
        )

        # BBB has full data, so its weights are untouched.
        bbb_breakdown = scored["BBB"]["factor_breakdown"]
        for factor in FACTOR_KEYS:
            assert bbb_breakdown[factor]["weight"] == pytest.approx(DEFAULT_WEIGHTS[factor])

    def test_all_factors_missing_gives_zero_composite_not_error(self):
        raw_factors = {
            "AAA": {k: None for k in DEFAULT_WEIGHTS},
            "BBB": {"momentum": 1.0, "volume": 1.0, "analyst_revision": 1.0,
                     "news_sentiment": 1.0, "technical_setup": 1.0, "vol_adjusted_momentum": 1.0},
        }
        scored = score_candidates(raw_factors)
        assert scored["AAA"]["composite_score"] == 0.0


class TestMinCoverageFraction:
    def test_thin_data_candidate_excluded_from_winning_despite_higher_score(self):
        # AAA is missing news_sentiment + analyst_revision (35% of weight)
        # but scores well on what little it has. BBB has full data with a
        # more modest score. Without a coverage floor AAA could still win;
        # with one, BBB should win instead.
        raw_factors = {
            "AAA": {"momentum": 5.0, "volume": 5.0, "analyst_revision": None,
                     "news_sentiment": None, "technical_setup": 5.0, "vol_adjusted_momentum": 5.0},
            "BBB": {"momentum": 1.0, "volume": 1.0, "analyst_revision": 1.0,
                     "news_sentiment": 1.0, "technical_setup": 1.0, "vol_adjusted_momentum": 1.0},
        }
        ticker, _ = pick_stock_of_the_day(raw_factors, min_coverage_fraction=0.7)
        assert ticker == "BBB"

    def test_default_threshold_of_zero_preserves_prior_behavior(self):
        raw_factors = {
            "AAA": {"momentum": 5.0, "volume": 5.0, "analyst_revision": None,
                     "news_sentiment": None, "technical_setup": 5.0, "vol_adjusted_momentum": 5.0},
            "BBB": {"momentum": 1.0, "volume": 1.0, "analyst_revision": 1.0,
                     "news_sentiment": 1.0, "technical_setup": 1.0, "vol_adjusted_momentum": 1.0},
        }
        ticker, _ = pick_stock_of_the_day(raw_factors)  # no min_coverage_fraction passed
        assert ticker == "AAA"

    def test_falls_back_to_all_candidates_when_none_meet_threshold(self):
        raw_factors = {
            "AAA": {"momentum": 5.0, "volume": None, "analyst_revision": None,
                     "news_sentiment": None, "technical_setup": None, "vol_adjusted_momentum": None},
            "BBB": {"momentum": 1.0, "volume": None, "analyst_revision": None,
                     "news_sentiment": None, "technical_setup": None, "vol_adjusted_momentum": None},
        }
        # Neither candidate meets a 0.7 threshold, but a pick still comes back.
        ticker, result = pick_stock_of_the_day(raw_factors, min_coverage_fraction=0.7)
        assert ticker in raw_factors
        assert result is not None


# ============= Individual factor calculators =============

def _make_price_series(prices):
    return pd.Series(prices, index=pd.date_range("2026-01-01", periods=len(prices), freq="D"))


class TestCalculateReturn:
    def test_basic_return(self):
        prices = [100.0] * 20 + [110.0]
        closes = _make_price_series(prices)
        assert calculate_return(closes, lookback_days=20) == pytest.approx(10.0)

    def test_insufficient_history_returns_none(self):
        closes = _make_price_series([100.0, 101.0])
        assert calculate_return(closes, lookback_days=20) is None

    def test_zero_start_price_returns_none(self):
        closes = _make_price_series([0.0] * 20 + [10.0])
        assert calculate_return(closes, lookback_days=20) is None


class TestCalculateRSI:
    def test_all_gains_gives_rsi_100(self):
        closes = _make_price_series([100 + i for i in range(20)])
        assert calculate_rsi(closes) == pytest.approx(100.0)

    def test_all_losses_gives_rsi_0(self):
        closes = _make_price_series([100 - i for i in range(20)])
        assert calculate_rsi(closes) == pytest.approx(0.0)

    def test_insufficient_history_returns_none(self):
        closes = _make_price_series([100.0, 101.0])
        assert calculate_rsi(closes) is None


class TestRsiComponent:
    def test_continuous_across_overbought_boundary(self):
        # No cliff: a fraction of an RSI point around the RSI=70 boundary
        # should move the component by a comparably tiny amount, not jump
        # from +1 to ~0.
        just_below = _rsi_component(69.999)
        at_boundary = _rsi_component(70.0)
        just_above = _rsi_component(70.001)

        assert at_boundary == pytest.approx(1.0)
        assert just_below == pytest.approx(1.0, abs=0.01)
        assert just_above == pytest.approx(1.0, abs=0.01)

    def test_extreme_overbought_approaches_negative_one(self):
        assert _rsi_component(100) == pytest.approx(-1.0)

    def test_neutral_rsi_is_zero(self):
        assert _rsi_component(50) == pytest.approx(0.0)


class TestCalculateTechnicalSetup:
    def test_overbought_rsi_penalized_negative(self):
        # Strong uptrend -> RSI near 100 -> should be penalized (negative component)
        closes = _make_price_series([100 + i * 2 for i in range(60)])
        result = calculate_technical_setup(closes)
        assert result is not None
        assert result < 0

    def test_insufficient_history_returns_none(self):
        closes = _make_price_series([100.0, 101.0])
        assert calculate_technical_setup(closes) is None


class TestCalculateMACrossover:
    def test_uptrend_gives_positive_crossover(self):
        closes = _make_price_series([100 + i for i in range(60)])
        result = calculate_ma_crossover(closes)
        assert result is not None
        assert result > 0

    def test_downtrend_gives_negative_crossover(self):
        closes = _make_price_series([200 - i for i in range(60)])
        result = calculate_ma_crossover(closes)
        assert result is not None
        assert result < 0


class TestCalculateVolAdjustedMomentum:
    def test_zero_volatility_returns_none(self):
        # Flat prices -> zero realized volatility -> undefined ratio
        closes = _make_price_series([100.0] * 25)
        assert calculate_vol_adjusted_momentum(closes) is None

    def test_insufficient_history_returns_none(self):
        closes = _make_price_series([100.0, 101.0])
        assert calculate_vol_adjusted_momentum(closes) is None


class TestCalculateAnalystRevision:
    def test_net_upgrades(self):
        assert calculate_analyst_revision(upgrades=5, downgrades=2) == 3.0

    def test_net_downgrades(self):
        assert calculate_analyst_revision(upgrades=1, downgrades=4) == -3.0

    def test_no_activity(self):
        assert calculate_analyst_revision(upgrades=0, downgrades=0) == 0.0


class TestCalculateNewsSentiment:
    def test_empty_news_returns_none(self):
        assert calculate_news_sentiment([]) is None

    def test_relevance_weighting(self):
        now = datetime(2026, 7, 12, 12, 0, 0)
        news = [
            {"sentiment_score": 1.0, "relevance_score": 1.0, "time_published": now},
            {"sentiment_score": -1.0, "relevance_score": 0.01, "time_published": now},
        ]
        result = calculate_news_sentiment(news, now=now)
        # High-relevance positive item should dominate a barely-relevant negative one
        assert result > 0.9

    def test_recency_decay_favors_recent_news(self):
        now = datetime(2026, 7, 12, 12, 0, 0)
        news = [
            {"sentiment_score": 1.0, "relevance_score": 1.0, "time_published": now},
            {"sentiment_score": -1.0, "relevance_score": 1.0, "time_published": now - timedelta(days=30)},
        ]
        result = calculate_news_sentiment(news, now=now)
        # 30-day-old item has decayed to near-zero weight under a 3-day half-life
        assert result > 0.9

    def test_all_zero_weight_returns_none(self):
        now = datetime(2026, 7, 12, 12, 0, 0)
        news = [{"sentiment_score": 1.0, "relevance_score": 0.0, "time_published": now}]
        assert calculate_news_sentiment(news, now=now) is None
