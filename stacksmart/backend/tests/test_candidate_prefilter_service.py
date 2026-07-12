"""Unit tests for the cheap bulk pre-filter."""

import pandas as pd

from app.services import candidate_prefilter_service as prefilter


def _make_frame(prices, volumes):
    dates = pd.date_range("2026-01-01", periods=len(prices), freq="D")
    return pd.DataFrame({"Close": prices, "Volume": volumes}, index=dates)


class TestSelectShortlist:
    def test_ranks_by_combined_relative_strength_and_volume(self, monkeypatch):
        monkeypatch.setattr(prefilter, "STOCK_WATCHLIST", ["AAA", "BBB", "CCC"])

        spy_prices = [100 + i * 0.1 for i in range(30)]
        frames = {
            "SPY": _make_frame(spy_prices, [1000] * 30),
            "AAA": _make_frame([100 + i * 2 for i in range(30)], [1000] * 29 + [5000]),  # outperformer + volume spike
            "BBB": _make_frame(spy_prices, [1000] * 30),  # tracks SPY, normal volume
            "CCC": _make_frame([100 - i * 0.5 for i in range(30)], [1000] * 30),  # underperformer
        }
        bulk = pd.concat(frames, axis=1)
        monkeypatch.setattr(prefilter, "_bulk_download", lambda tickers, period="3mo": bulk)

        shortlist = prefilter.select_shortlist(shortlist_size=2)

        assert shortlist[0] == "AAA"
        assert "CCC" not in shortlist

    def test_missing_spy_returns_empty_list(self, monkeypatch):
        monkeypatch.setattr(prefilter, "STOCK_WATCHLIST", ["AAA"])
        monkeypatch.setattr(prefilter, "_bulk_download", lambda tickers, period="3mo": pd.DataFrame())

        assert prefilter.select_shortlist() == []

    def test_ticker_missing_from_bulk_download_is_excluded_not_neutral(self, monkeypatch):
        monkeypatch.setattr(prefilter, "STOCK_WATCHLIST", ["AAA", "ZZZ"])
        frames = {
            "SPY": _make_frame([100] * 30, [1000] * 30),
            "AAA": _make_frame([100 + i for i in range(30)], [1000] * 30),
            # ZZZ intentionally absent from the bulk download result (e.g. delisted)
        }
        bulk = pd.concat(frames, axis=1)
        monkeypatch.setattr(prefilter, "_bulk_download", lambda tickers, period="3mo": bulk)

        assert prefilter.select_shortlist() == ["AAA"]
