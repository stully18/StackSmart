# Real Market Data Integration

## Overview
The College Wealth Builder now displays live market data for VOO (Vanguard S&P 500 ETF) on the dashboard, helping students make informed decisions by seeing actual market performance.

## Features

### Live Market Data Display
- **Current VOO Price**: Real-time or near real-time price
- **Today's Change**: Daily percentage change (green for positive, red for negative)
- **YTD Return**: Year-to-date performance
- **1-Year Return**: Trailing 12-month performance
- **Historical Average**: 5-year average annual return (~10%)
- **Data Source**: Displays which API provided the data

### Data Sources (Automatic Fallback)

1. **Alpha Vantage** (Primary)
   - Free tier: 25 requests/day
   - Requires API key (optional)
   - Get key at: https://www.alphavantage.co/support/#api-key

2. **Yahoo Finance** (Fallback)
   - No API key required
   - Unlimited requests (with rate limiting)
   - Automatically used if Alpha Vantage fails or API key not set

3. **Default Values** (Final Fallback)
   - Used if both APIs fail
   - Shows approximate values with disclaimer
   - Ensures dashboard always has data

## Backend Implementation

### New API Endpoints

**GET /api/market/voo-live**
```json
{
  "ticker": "VOO",
  "price": 450.25,
  "change_percent_today": 1.23,
  "ytd_return": 5.67,
  "one_year_return": 12.34,
  "five_year_avg_return": 10.0,
  "data_source": "Yahoo Finance",
  "last_updated": "2026-01-17T12:00:00"
}
```

**GET /api/market/sp500-performance**
```json
{
  "index": "S&P 500",
  "one_year_return": 15.5,
  "historical_avg_return": 10.0,
  "note": "S&P 500 tracks 500 largest US companies",
  "last_updated": "2026-01-17T12:00:00"
}
```

### Files Modified

#### Backend
- `backend/app/main.py` - Added market data endpoints
- `backend/app/services/market_data_fetcher.py` - NEW: Market data fetching logic
- `backend/.env.example` - Added Alpha Vantage API key documentation

#### Frontend
- `frontend/app/dashboard/page.tsx` - Added market data display
- `frontend/types/index.ts` - TypeScript types (if added)

## Setup Instructions

### Optional: Alpha Vantage API Key

1. Get free API key: https://www.alphavantage.co/support/#api-key
2. Create/update `.env` file in `backend/` directory:
   ```bash
   ALPHA_VANTAGE_API_KEY=your_api_key_here
   ```
3. Restart backend server

**Note**: If you don't set an API key, the system will automatically use Yahoo Finance. Both work fine!

## Technical Details

### market_data_fetcher.py Functions

```python
def get_voo_live_data() -> Dict:
    """
    Get live VOO data with automatic fallback chain:
    1. Try Alpha Vantage (if API key set)
    2. Fall back to Yahoo Finance
    3. Return defaults if all fail
    """

def get_voo_data_yahoo() -> Dict:
    """
    Fetch VOO data from Yahoo Finance API.
    Calculates YTD and 1-year returns from historical data.
    """

def get_default_market_data() -> Dict:
    """
    Return safe default values if all APIs fail.
    Shows ~$450 price with disclaimer.
    """

def get_multiple_etf_data(tickers: list) -> Dict:
    """
    Batch fetch data for multiple ETFs (VOO, VXUS, BND, etc.)
    """

def get_sp500_performance() -> Dict:
    """
    Get S&P 500 index performance for comparison.
    """
```

### Frontend Implementation

The dashboard fetches market data on page load:

```typescript
useEffect(() => {
  const fetchMarketData = async () => {
    setMarketDataLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/market/voo-live');
      if (response.ok) {
        const data = await response.json();
        setVooData(data);
      }
    } catch (err) {
      console.error('Failed to fetch market data:', err);
    } finally {
      setMarketDataLoading(false);
    }
  };

  fetchMarketData();
}, []);
```

## Why This Matters

1. **Real Data**: Students see actual market performance, not just theoretical 10%
2. **Informed Decisions**: Live returns help students understand market volatility
3. **Educational**: Shows how market returns vary year-to-year
4. **Comparison**: Students can compare their debt interest rates against actual market performance

## Example Use Cases

### High Interest Debt (Credit Card at 18%)
Dashboard shows:
- VOO 1-year return: +12%
- Recommendation: Pay debt (18% guaranteed > 12% risky)
- Live data reinforces the math

### Low Interest Debt (Student Loan at 4%)
Dashboard shows:
- VOO 1-year return: +15%
- Recommendation: Invest (15% > 4%)
- Live data shows market is performing well

### Market Downturn
Dashboard shows:
- VOO 1-year return: -8%
- Recommendation: May shift toward debt payoff
- Live data helps students see current market conditions

## Future Enhancements

Possible future additions:
- Historical performance charts
- Multiple timeframes (3-month, 5-year, 10-year)
- Comparison with other indices (NASDAQ, Russell 2000)
- Dividend yield information
- Expense ratio comparison
- Real-time streaming updates (WebSocket)

## Troubleshooting

### Market Data Not Loading
1. Check backend logs for API errors
2. Verify internet connection
3. Check if Yahoo Finance is rate limiting
4. Backend will fall back to defaults automatically

### Stale Data
- Data updates on page load
- Future: Add refresh button or auto-refresh timer

### Rate Limiting
- Alpha Vantage: Max 25 requests/day on free tier
- Yahoo Finance: Implement request throttling if needed
- System automatically falls back to defaults

## Dependencies

Already in `requirements.txt`:
- `requests>=2.31.0` - HTTP requests
- `python-dotenv>=1.0.0` - Environment variables

No additional dependencies required!
