"""
Real Market Data Fetcher

Fetches live market data for ETFs (VOO, VXUS, BND, SPY, etc.)
Uses yfinance library for reliable Yahoo Finance data
Includes caching and rate limiting to avoid 429 errors
"""

import yfinance as yf
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import threading
import time

# Simple in-memory cache with TTL
_cache: Dict[str, Dict] = {}
_cache_lock = threading.Lock()
CACHE_TTL_MINUTES = 30  # Cache data for 30 minutes to reduce API calls

# Rate limiting
_last_api_call = datetime.min
_rate_limit_lock = threading.Lock()
MIN_REQUEST_INTERVAL = 1.0  # Minimum seconds between API calls


def _rate_limit():
    """Enforce rate limiting between API calls"""
    global _last_api_call
    with _rate_limit_lock:
        now = datetime.now()
        elapsed = (now - _last_api_call).total_seconds()
        if elapsed < MIN_REQUEST_INTERVAL:
            time.sleep(MIN_REQUEST_INTERVAL - elapsed)
        _last_api_call = datetime.now()


def _get_cached(key: str) -> Optional[Dict]:
    """Get cached data if not expired"""
    with _cache_lock:
        if key in _cache:
            data, timestamp = _cache[key]
            if datetime.now() - timestamp < timedelta(minutes=CACHE_TTL_MINUTES):
                return data
            else:
                del _cache[key]
    return None


def _set_cache(key: str, data: Dict) -> None:
    """Store data in cache"""
    with _cache_lock:
        _cache[key] = (data, datetime.now())


def _batch_download_etfs(tickers: List[str]) -> Dict:
    """
    Download multiple ETFs in a single batch request to avoid rate limiting.
    Returns dict of ticker -> data
    """
    cache_key = f"batch_{'_'.join(sorted(tickers))}"
    cached = _get_cached(cache_key)
    if cached:
        print(f"[CACHE] Using cached batch data for {len(tickers)} ETFs")
        return cached

    try:
        _rate_limit()
        print(f"[DEBUG] Batch downloading {len(tickers)} ETFs: {', '.join(tickers)}")

        # Download all tickers at once
        data = yf.download(tickers, period="1y", group_by='ticker', progress=False, threads=False, multi_level_index=False)

        results = {}
        for ticker in tickers:
            try:
                if len(tickers) == 1:
                    hist = data
                else:
                    hist = data[ticker] if ticker in data.columns.get_level_values(0) else None

                if hist is None or hist.empty:
                    results[ticker] = get_demo_etf_data(ticker)
                    continue

                # Get current and historical prices
                current_price = float(hist['Close'].iloc[-1])
                previous_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price
                first_price = float(hist['Close'].iloc[0])

                # Calculate returns
                change_percent = ((current_price - previous_close) / previous_close) * 100 if previous_close > 0 else 0
                one_year_return = ((current_price - first_price) / first_price) * 100 if first_price > 0 else None

                # Calculate YTD return
                ytd_return = None
                current_year = datetime.now().year
                ytd_data = hist[hist.index.year == current_year]
                if not ytd_data.empty:
                    year_start_price = float(ytd_data['Close'].iloc[0])
                    if year_start_price > 0:
                        ytd_return = ((current_price - year_start_price) / year_start_price) * 100

                # ETF expense ratios (static data)
                expense_ratios = {
                    "VOO": 0.03, "VXUS": 0.07, "BND": 0.03, "VTI": 0.03,
                    "QQQ": 0.20, "AGG": 0.03, "VNQ": 0.12, "VWO": 0.08,
                    "SCHD": 0.06, "VIG": 0.06, "DGRO": 0.08
                }

                results[ticker] = {
                    "ticker": ticker,
                    "price": round(current_price, 2),
                    "change_percent_today": round(change_percent, 2),
                    "ytd_return": round(ytd_return, 2) if ytd_return else None,
                    "one_year_return": round(one_year_return, 2) if one_year_return else None,
                    "expense_ratio": expense_ratios.get(ticker, 0.10),
                    "data_source": "Yahoo Finance",
                    "last_updated": datetime.now().isoformat()
                }
            except Exception as e:
                print(f"[ERROR] Failed to process {ticker}: {str(e)}")
                results[ticker] = get_demo_etf_data(ticker)

        _set_cache(cache_key, results)
        print(f"[DEBUG] Batch download complete for {len(results)} ETFs")
        return results

    except Exception as e:
        print(f"[ERROR] Batch download failed: {str(e)}")
        # Return demo data for all tickers
        return {ticker: get_demo_etf_data(ticker) for ticker in tickers}


def get_voo_live_data() -> Dict:
    """
    Get live VOO data including:
    - Current price
    - YTD return
    - 1-year return
    - 5-year average annual return
    """
    # Check cache first
    cached = _get_cached("VOO_live")
    if cached:
        return cached

    try:
        _rate_limit()
        print("[DEBUG] Fetching live VOO market data with yfinance...")

        # Use download instead of Ticker to avoid quoteSummary endpoint
        hist = yf.download("VOO", period="1y", progress=False, multi_level_index=False)

        if hist.empty:
            return get_default_market_data()

        current_price = float(hist['Close'].iloc[-1])
        previous_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else current_price
        first_price = float(hist['Close'].iloc[0])

        # Calculate daily change
        change_percent = ((current_price - previous_close) / previous_close) * 100 if previous_close > 0 else 0

        # Calculate 1-year return
        one_year_return = ((current_price - first_price) / first_price) * 100 if first_price > 0 else None

        # Calculate YTD return
        ytd_return = None
        current_year = datetime.now().year
        ytd_data = hist[hist.index.year == current_year]
        if not ytd_data.empty:
            year_start_price = float(ytd_data['Close'].iloc[0])
            if year_start_price > 0:
                ytd_return = ((current_price - year_start_price) / year_start_price) * 100

        print(f"[DEBUG] VOO: ${current_price:.2f} ({change_percent:+.2f}% today) - Source: Yahoo Finance")

        result = {
            "ticker": "VOO",
            "price": round(current_price, 2),
            "change_percent_today": round(change_percent, 2),
            "ytd_return": round(ytd_return, 2) if ytd_return else None,
            "one_year_return": round(one_year_return, 2) if one_year_return else None,
            "five_year_avg_return": 10.0,  # Historical average
            "data_source": "Yahoo Finance",
            "last_updated": datetime.now().isoformat()
        }
        _set_cache("VOO_live", result)
        return result

    except Exception as e:
        print(f"[ERROR] yfinance fetch failed: {str(e)}")
        return get_default_market_data()


def get_default_market_data() -> Dict:
    """
    Return default/cached market data if API fails
    """
    return {
        "ticker": "VOO",
        "price": 527.85,
        "change_percent_today": 0.45,
        "ytd_return": 2.3,
        "one_year_return": 24.8,
        "five_year_avg_return": 10.0,
        "data_source": "Demo Mode (API unavailable)",
        "last_updated": datetime.now().isoformat()
    }


def get_etf_details(ticker_symbol: str) -> Dict:
    """
    Get detailed ETF information including price, returns, and expense ratio.
    Uses batch download for efficiency.
    """
    # Check cache first
    cache_key = f"etf_{ticker_symbol}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    # Use batch download for single ticker
    results = _batch_download_etfs([ticker_symbol])
    if ticker_symbol in results:
        _set_cache(cache_key, results[ticker_symbol])
        return results[ticker_symbol]

    return get_demo_etf_data(ticker_symbol)


def get_demo_etf_data(ticker: str) -> Dict:
    """
    Return demo data for common ETFs when API is unavailable.
    """
    etf_demos = {
        "VOO": {"ticker": "VOO", "name": "Vanguard S&P 500 ETF", "price": 527.85, "change_percent_today": 0.45, "ytd_return": 2.3, "one_year_return": 24.8, "expense_ratio": 0.03},
        "VTI": {"ticker": "VTI", "name": "Vanguard Total Stock Market ETF", "price": 289.50, "change_percent_today": 0.52, "ytd_return": 2.1, "one_year_return": 23.5, "expense_ratio": 0.03},
        "VXUS": {"ticker": "VXUS", "name": "Vanguard Total International Stock ETF", "price": 68.20, "change_percent_today": 0.38, "ytd_return": 1.8, "one_year_return": 14.2, "expense_ratio": 0.07},
        "BND": {"ticker": "BND", "name": "Vanguard Total Bond Market ETF", "price": 72.15, "change_percent_today": -0.12, "ytd_return": 0.5, "one_year_return": 3.8, "expense_ratio": 0.03},
        "AGG": {"ticker": "AGG", "name": "iShares Core US Aggregate Bond ETF", "price": 98.45, "change_percent_today": -0.10, "ytd_return": 0.6, "one_year_return": 4.1, "expense_ratio": 0.03},
        "VNQ": {"ticker": "VNQ", "name": "Vanguard Real Estate ETF", "price": 84.32, "change_percent_today": 0.65, "ytd_return": 1.2, "one_year_return": 8.5, "expense_ratio": 0.12},
        "QQQ": {"ticker": "QQQ", "name": "Invesco QQQ Trust (Nasdaq-100)", "price": 512.75, "change_percent_today": 0.88, "ytd_return": 3.5, "one_year_return": 32.1, "expense_ratio": 0.20},
        "VWO": {"ticker": "VWO", "name": "Vanguard Emerging Markets ETF", "price": 45.60, "change_percent_today": 0.42, "ytd_return": 1.5, "one_year_return": 11.8, "expense_ratio": 0.08},
        "SCHD": {"ticker": "SCHD", "name": "Schwab US Dividend Equity ETF", "price": 82.50, "change_percent_today": 0.35, "ytd_return": 1.8, "one_year_return": 12.5, "expense_ratio": 0.06},
        "VIG": {"ticker": "VIG", "name": "Vanguard Dividend Appreciation ETF", "price": 185.20, "change_percent_today": 0.42, "ytd_return": 2.0, "one_year_return": 15.3, "expense_ratio": 0.06},
        "DGRO": {"ticker": "DGRO", "name": "iShares Core Dividend Growth ETF", "price": 58.75, "change_percent_today": 0.38, "ytd_return": 1.9, "one_year_return": 14.8, "expense_ratio": 0.08}
    }

    if ticker in etf_demos:
        data = etf_demos[ticker].copy()
        data["data_source"] = "Demo Mode"
        data["last_updated"] = datetime.now().isoformat()
        return data

    return {
        "ticker": ticker,
        "price": 100.0,
        "change_percent_today": 0.0,
        "ytd_return": 0.0,
        "one_year_return": 0.0,
        "expense_ratio": 0.10,
        "data_source": "Demo Mode",
        "last_updated": datetime.now().isoformat()
    }


def get_multiple_etf_data(tickers: list = ["VOO", "VXUS", "BND"]) -> Dict:
    """
    Get data for multiple ETFs using batch download
    """
    return _batch_download_etfs(tickers)


def get_sp500_performance() -> Dict:
    """
    Get S&P 500 performance data for comparison
    """
    # Check cache first
    cached = _get_cached("sp500_performance")
    if cached:
        return cached

    try:
        _rate_limit()
        hist = yf.download("SPY", period="1y", progress=False, multi_level_index=False)

        one_year_return = None
        if not hist.empty:
            first_price = float(hist['Close'].iloc[0])
            last_price = float(hist['Close'].iloc[-1])
            if first_price > 0:
                one_year_return = ((last_price - first_price) / first_price) * 100

        result = {
            "index": "S&P 500",
            "one_year_return": round(one_year_return, 2) if one_year_return else None,
            "historical_avg_return": 10.0,
            "note": "S&P 500 tracks 500 largest US companies",
            "last_updated": datetime.now().isoformat()
        }
        _set_cache("sp500_performance", result)
        return result
    except Exception as e:
        print(f"[ERROR] S&P 500 fetch failed: {str(e)}")
        return {
            "index": "S&P 500",
            "one_year_return": None,
            "historical_avg_return": 10.0,
            "error": str(e)
        }
