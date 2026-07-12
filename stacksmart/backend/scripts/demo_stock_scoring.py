"""
Phase 1 checkpoint demo: run the factor scoring engine against a handful of
real tickers and print the composite scores + factor breakdown.

Analyst revision and news sentiment aren't wired to Alpha Vantage yet
(that's Phase 2 — the caching layer). This demo passes neutral placeholder
values for those two factors so the other four (which only need
price/volume history) can be verified against real market data today.

Run from backend/: python -m scripts.demo_stock_scoring
"""

from app.services.stock_of_the_day_service import (
    compute_raw_factors,
    fetch_price_history,
    score_candidates,
)

DEMO_TICKERS = ["AAPL", "NVDA", "TSLA", "JPM", "KO"]


def main():
    print(f"Fetching SPY history for relative-strength comparisons...")
    spy_history = fetch_price_history("SPY")
    spy_closes = spy_history["Close"]

    raw_factors_by_ticker = {}
    for ticker in DEMO_TICKERS:
        print(f"Fetching {ticker}...")
        history = fetch_price_history(ticker)
        raw_factors_by_ticker[ticker] = compute_raw_factors(
            ticker_closes=history["Close"],
            ticker_volumes=history["Volume"],
            spy_closes=spy_closes,
            # Placeholders until Phase 2 wires real Alpha Vantage calls:
            analyst_upgrades=0,
            analyst_downgrades=0,
            news_items=[],
        )

    scored = score_candidates(raw_factors_by_ticker)
    ranked = sorted(scored.items(), key=lambda kv: kv[1]["composite_score"], reverse=True)

    print("\n" + "=" * 72)
    print("STOCK OF THE DAY — sample composite scores (real price/volume data)")
    print("=" * 72)
    for rank, (ticker, result) in enumerate(ranked, start=1):
        marker = " <-- PICK" if rank == 1 else ""
        print(f"\n#{rank} {ticker}  composite={result['composite_score']:+.3f}{marker}")
        for factor, detail in result["factor_breakdown"].items():
            raw = detail["raw_value"]
            raw_str = f"{raw:+.3f}" if raw is not None else "N/A"
            print(
                f"    {factor:<22} raw={raw_str:>10}  zscore={detail['zscore']:+.3f}  "
                f"weight={detail['weight']:.2f}  contribution={detail['weighted_contribution']:+.3f}"
            )

    print("\nNote: analyst_revision and news_sentiment are placeholders (0/None)")
    print("until Phase 2 wires the Alpha Vantage cache layer.")


if __name__ == "__main__":
    main()
