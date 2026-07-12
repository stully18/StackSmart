"""
Static candidate watchlist for Stock of the Day.

Hand-curated pool of large-cap, liquid S&P 500 / Nasdaq 100 tickers,
already above typical liquidity/market-cap floors (mega- and large-cap
names with reliably high average daily volume). This list is the
candidate universe the daily pre-filter narrows down from ~150 to the
~20-40 tickers that get scored.

Update manually as needed (e.g. drop a ticker that got acquired/delisted,
add a new large-cap addition to the indices). There is no automated
index-constituents sync by design, to avoid taking a dependency on a
paid index-data API.
"""

STOCK_WATCHLIST = sorted({
    # Mega-cap tech
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA", "AVGO", "ORCL",
    "ADBE", "CRM", "CSCO", "AMD", "INTC", "IBM", "QCOM", "TXN", "NOW", "INTU",
    "AMAT", "MU", "LRCX", "ADI", "KLAC", "SNPS", "CDNS", "PANW", "FTNT", "CRWD",
    # Communication services
    "NFLX", "DIS", "CMCSA", "TMUS", "VZ", "T", "CHTR", "EA", "TTWO", "WBD",
    # Consumer discretionary
    "HD", "MCD", "NKE", "SBUX", "LOW", "TJX", "BKNG", "ABNB", "MAR", "CMG",
    "ORLY", "AZO", "YUM", "ROST", "DHI", "LEN", "GM", "F",
    # Consumer staples
    "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ", "CL", "TGT",
    "KMB", "GIS", "SYY", "KHC", "STZ",
    # Financials
    "BRK.B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "AXP", "SCHW",
    "BLK", "SPGI", "C", "PGR", "CB", "MMC", "ICE", "CME", "AON", "USB",
    "PYPL", "COF", "TFC", "PNC",
    # Health care
    "UNH", "JNJ", "LLY", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "BMY",
    "AMGN", "MDT", "GILD", "ISRG", "VRTX", "REGN", "CVS", "CI", "ELV", "HCA",
    "SYK", "BSX", "ZTS",
    # Industrials
    "CAT", "HON", "UPS", "RTX", "BA", "GE", "DE", "LMT", "UNP", "ADP",
    "ETN", "ITW", "NOC", "EMR", "CSX", "NSC", "FDX", "GD", "PH",
    # Energy
    "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "WMB",
    # Materials
    "LIN", "SHW", "APD", "ECL", "FCX", "NEM",
    # Real estate
    "PLD", "AMT", "EQIX", "PSA", "O", "SPG",
    # Utilities
    "NEE", "DUK", "SO", "D", "AEP",
    # Nasdaq-100 additions not already covered above
    "ASML", "PDD", "MELI", "ADSK", "MRVL", "WDAY", "DXCM", "IDXX", "FAST",
    "PAYX", "ODFL", "CTAS", "ROP", "CPRT", "VRSK", "EXC", "XEL", "KDP",
    "MNST", "CSGP", "ANSS", "TEAM", "DDOG", "ZS", "MDB",
})
