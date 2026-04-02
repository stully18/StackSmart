# College Wealth Builder - Complete Platform Guide

## Overview

**College Wealth Builder** is a comprehensive fintech platform designed specifically for college students to make smart financial decisions about debt repayment vs investing. The platform combines multiple powerful tools into one unified service.

---

## Features

### 1. Unified Dashboard (MAIN FEATURE)
**Route:** `/dashboard`

**One Plaid connection gets EVERYTHING:**
- Bank accounts (checking, savings)
- Investment accounts (Fidelity, Robinhood, 401k, IRA)
- Student loans (balances, interest rates, minimum payments)
- Credit cards (balances, APRs, utilization)
- **Automatic net worth calculation**

**Intelligent Action Plan:**
The dashboard doesn't just show data—it tells you exactly what to do:
- "Pay $500 to Credit Card X (18% APR)"
- "Invest $2,000 in VOO"
- "Build emergency fund first"
- Explains WHY with real math (compares debt rates vs expected returns)
- Prioritizes actions: emergency fund → high-interest debt → investing

### 2. Debt vs Invest Calculator
**Route:** `/` (homepage)

**What it does:**
- Mathematically compares paying extra on student loans vs investing
- Shows optimal path based on interest rates vs expected market returns
- Provides specific ETF allocation recommendations
- Auto-fills spare cash from Plaid connection

**Key feature:** Uses 10% S&P 500 return assumption (historical average)

### 3. Investment Plan Generator
**Route:** `/plan`

**Creates personalized investment strategy:**
- Risk tolerance slider (1-10)
- Specific ETF recommendations with dollar amounts (VOO, VXUS, BND, VXF)
- Exact monthly auto-invest breakdown
- 10-year wealth projections
- **NEW: Real-time market data** for each recommended ETF:
  - Current price
  - 1-year, 5-year, 10-year returns
  - Dividend yields
  - Expense ratios

**Advice based on portfolio size:**
- Small portfolios ($0-$1k): Focus on 1-2 ETFs
- Medium portfolios ($1k-$10k): Diversify across 3-4 ETFs
- Large portfolios ($10k+): Full diversification

### 4. Investment Analyzer
**Route:** `/investments`

**Analyzes your existing portfolio:**
- Portfolio diversification score (0-100)
- Asset allocation breakdown (stocks, bonds, cash)
- Recurring deposit detection (identifies if you're auto-investing)
- Investment health score
- Gain/loss tracking on all holdings
- Personalized recommendations based on your actual holdings

### 5. Roth IRA Education Module (NEW!)
**Route:** `/roth-ira`

**Interactive calculator and education:**
- Shows power of tax-free growth with real numbers
- Interactive calculator:
  - Adjust age, contribution, years to retirement
  - See future value projections
  - Calculate tax savings vs regular brokerage account
- Explains how Roth IRA works step-by-step
- Answers common questions
- Provides actionable next steps to open an account

**Example calculation:**
- $7,000/year from age 20-65 at 10% = $3,156,000 TAX-FREE
- Tax savings vs taxable account: $757,000+

---

## How To Use

### Starting the Application

```bash
cd ~/Development/FinanceFolder/net-worth-optimizer
./run.sh
```

This starts:
- Backend API on http://localhost:8000
- Frontend on http://localhost:3000

### Recommended Flow

#### Option 1: Complete Financial Picture (RECOMMENDED)
1. Go to http://localhost:3000/dashboard
2. Click "Connect All Your Accounts"
3. In Plaid modal: Search "First Platypus Bank" (sandbox test bank)
4. Login: `user_good` / `pass_good`
5. See your complete financial snapshot:
   - Net worth
   - All accounts and balances
   - All debts and interest rates
6. Get intelligent action plan telling you exactly what to do

#### Option 2: Individual Tools
1. **Homepage (/)**: Debt vs invest calculator
2. **/plan**: Generate investment strategy
3. **/investments**: Analyze your portfolio
4. **/roth-ira**: Learn about Roth IRAs
5. **/dashboard**: See everything unified

---

## Technical Architecture

### Backend (FastAPI + Python)

**Location:** `backend/`

**Key Services:**

1. **plaid_service.py**
   - Plaid integration for all products (auth, transactions, investments, liabilities)
   - `get_complete_financial_picture()` - main function for unified dashboard
   - `get_liabilities()` - fetches student loans and credit cards
   - `get_investment_holdings()` - fetches portfolio data
   - `analyze_investment_behavior()` - generates investment health scores

2. **action_planner.py** (NEW)
   - Intelligent action plan engine
   - Compares debt interest rates vs expected investment returns
   - Generates prioritized recommendations with specific dollar amounts
   - Projects net worth 1-year and 5-year out

3. **investment_planner.py**
   - Risk-based investment plan generator
   - Specific ETF allocations based on risk tolerance (1-10)
   - Includes real-time market data for each recommendation
   - Monthly contribution breakdown

4. **market_data_service.py** (NEW)
   - Real-time stock/ETF data integration
   - Fetches current prices, historical returns, dividend yields
   - Uses Alpha Vantage API (with fallback to historical averages)
   - 1-hour caching to reduce API calls

5. **optimization_engine.py**
   - Debt vs invest mathematical modeling
   - Uses 10% S&P 500 return assumption
   - Calculates optimal financial path

**Main Endpoints:**

```
Dashboard:
  POST /api/dashboard/complete-picture  - Get everything (net worth, accounts, debts)
  POST /api/dashboard/action-plan       - Generate intelligent recommendations

Investments:
  POST /api/investments/analyze         - Portfolio analysis
  POST /api/investments/create-plan     - Generate investment plan
  POST /api/investments/holdings        - Get current holdings

Market Data (NEW):
  POST /api/market/quote                - Current stock price
  POST /api/market/etf-details          - Complete ETF data
  POST /api/market/batch-etf-data       - Batch fetch multiple ETFs

Plaid:
  POST /api/plaid/create-link-token     - Initialize Plaid Link
  POST /api/plaid/exchange-token        - Exchange public token
  POST /api/plaid/balance               - Get account balances

Optimization:
  POST /api/optimize                    - Debt vs invest calculator
```

### Frontend (Next.js 14 + React + TypeScript)

**Location:** `frontend/`

**Key Pages:**

- `app/page.tsx` - Homepage with debt vs invest calculator
- `app/dashboard/page.tsx` - Unified financial dashboard (NEW)
- `app/plan/page.tsx` - Investment plan generator
- `app/investments/page.tsx` - Portfolio analyzer
- `app/roth-ira/page.tsx` - Roth IRA education (NEW)

**Key Components:**

- `components/PlaidLinkButton.tsx` - Plaid integration component
- `components/InvestmentDashboard.tsx` - Investment analysis display
- `components/RecommendationCard.tsx` - Debt vs invest results
- `components/ResultsVisualization.tsx` - Chart.js visualizations

---

## Environment Variables

### Backend (.env)

```bash
# Plaid API Credentials
PLAID_CLIENT_ID=69630dc44ce2010021c68fcb
PLAID_SECRET=aecc277cf0b92e873e81fd92abc943
PLAID_ENV=sandbox

# Alpha Vantage API (NEW)
ALPHA_VANTAGE_API_KEY=demo  # Replace with your key from alphavantage.co
```

**To get Alpha Vantage API key (FREE):**
1. Go to https://www.alphavantage.co/support/#api-key
2. Enter your email
3. Get instant free API key (25 requests/day, 5/minute)
4. Add to `.env` file

---

## Testing Guide

### Test Plaid Integration (Sandbox)

**Recommended test bank:** First Platypus Bank
- Username: `user_good`
- Password: `pass_good`

This test bank has:
- Bank accounts (checking, savings)
- Investment accounts with holdings
- Student loans
- Credit cards

### Test Each Feature

1. **Unified Dashboard**
   ```
   http://localhost:3000/dashboard
   → Connect account
   → See net worth
   → Get action plan
   ```

2. **Investment Plan**
   ```
   http://localhost:3000/plan
   → Enter portfolio value: $10,000
   → Set risk tolerance: 7
   → Monthly contribution: $500
   → See ETF recommendations with real market data
   ```

3. **Roth IRA Calculator**
   ```
   http://localhost:3000/roth-ira
   → Set age: 20
   → Contribution: $7,000
   → See tax-free growth projection
   ```

4. **Portfolio Analyzer**
   ```
   http://localhost:3000/investments
   → Connect investment account
   → See diversification score
   → Get recommendations
   ```

---

## What Makes This Special

### 1. ONE Connection = EVERYTHING
Most apps require separate connections for:
- Banking
- Investments
- Loans
- Credit cards

**This platform:** One Plaid connection gets ALL of it.

### 2. Smart Decisions, Not Just Data
Doesn't just show your accounts. It tells you:
- "Pay $X to Debt Y (here's why)"
- "Invest $Z in Fund A (here's the math)"
- Compares your actual loan rates vs expected investment returns
- Makes optimal decision automatically

### 3. Real Market Data
Shows live data for recommended ETFs:
- Current prices
- 1-year, 5-year, 10-year returns
- Dividend yields
- Daily changes

### 4. Specific Instructions
Not generic advice like "diversify" or "invest more."

Instead:
- "Buy $1,200 of VOO (S&P 500 ETF)"
- "Invest $600 in VXUS (International ETF)"
- "Pay $500 to Chase Credit Card (18% APR)"

With tickers, dollar amounts, and reasoning.

### 5. Beginner-Friendly Education
- Explains complex concepts simply
- Interactive calculators with real numbers
- Shows the "why" behind every recommendation
- Roth IRA module makes retirement investing accessible

---

## Future Enhancements

### Planned Features

1. **Historical Net Worth Tracking**
   - Store snapshots monthly
   - Chart net worth growth over time
   - Milestone celebrations ($10k, $50k, $100k)

2. **Manual Account Entry**
   - For loans/accounts Plaid can't detect
   - Custom investment tracking
   - Private loan support

3. **Enhanced Market Data**
   - Real-time stock prices (currently uses historical averages as fallback)
   - P/E ratios, market cap
   - Sector analysis
   - Risk metrics (beta, Sharpe ratio)

4. **Tax Optimization**
   - Tax-loss harvesting suggestions
   - Roth vs Traditional IRA comparisons
   - Capital gains analysis

5. **Budgeting Integration**
   - Spending categorization from transactions
   - Budget recommendations
   - Savings goal tracking

6. **Alerts & Notifications**
   - When to rebalance portfolio
   - Debt payoff milestones
   - Contribution reminders

### Monetization Strategy (Future)

1. **Free Tier**
   - 1 connected account
   - Basic features
   - Monthly data updates

2. **Premium Tier ($9.99/month)**
   - Unlimited accounts
   - Real-time market data
   - Historical tracking
   - Advanced analytics
   - Priority support

3. **Affiliate Revenue**
   - Brokerage referral links (Fidelity, Vanguard)
   - Credit card recommendations
   - Refinancing offers

4. **Display Ads**
   - Financial product ads
   - Educational content sponsorships

---

## Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
lsof -ti:8000 | xargs kill -9

# Reinstall dependencies
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend won't start
```bash
# Check if port 3000 is in use
lsof -ti:3000 | xargs kill -9

# Reinstall dependencies
cd frontend
npm install
```

### Plaid connection fails
- Ensure backend is running on port 8000
- Check `.env` has correct Plaid credentials
- Use sandbox test account: `user_good` / `pass_good`

### Market data not loading
- Check if `ALPHA_VANTAGE_API_KEY` is set in backend `.env`
- Free tier limit: 25 requests/day, 5/minute
- Falls back to historical averages if API fails

---

## File Structure

```
net-worth-optimizer/
├── backend/
│   ├── app/
│   │   ├── main.py                    # API endpoints
│   │   ├── models/
│   │   │   └── schemas.py             # Pydantic models
│   │   └── services/
│   │       ├── plaid_service.py       # Plaid integration
│   │       ├── action_planner.py      # Action plan engine (NEW)
│   │       ├── investment_planner.py  # Investment plan generator
│   │       ├── market_data_service.py # Market data API (NEW)
│   │       └── optimization_engine.py # Debt vs invest math
│   ├── requirements.txt
│   ├── .env                           # Plaid + Alpha Vantage credentials
│   └── run.sh
├── frontend/
│   ├── app/
│   │   ├── page.tsx                   # Homepage
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Unified dashboard (NEW)
│   │   ├── plan/
│   │   │   └── page.tsx              # Investment plan
│   │   ├── investments/
│   │   │   └── page.tsx              # Portfolio analyzer
│   │   └── roth-ira/
│   │       └── page.tsx              # Roth IRA education (NEW)
│   ├── components/
│   │   ├── PlaidLinkButton.tsx
│   │   ├── InvestmentDashboard.tsx
│   │   ├── RecommendationCard.tsx
│   │   └── ResultsVisualization.tsx
│   ├── package.json
│   └── run.sh
├── run.sh                             # Start everything
└── COMPLETE-PLATFORM-GUIDE.md        # This file
```

---

## API Rate Limits

### Plaid (Sandbox)
- Unlimited requests
- No cost in sandbox mode
- Production: Pay per active user

### Alpha Vantage (Free Tier)
- 25 API calls per day
- 5 API calls per minute
- **Recommendation:** Upgrade to $50/month for production (500 calls/day)

**Platform handles limits gracefully:**
- 1-hour caching reduces API calls
- Falls back to historical averages if limit exceeded
- No crashes or errors—just slightly less current data

---

## Production Deployment Checklist

When ready to deploy to production:

1. **Plaid**
   - Apply for Production access
   - Complete Plaid compliance questionnaire
   - Switch `PLAID_ENV=production` in `.env`

2. **Alpha Vantage**
   - Upgrade to paid plan ($50/month for 500/day)
   - Update `ALPHA_VANTAGE_API_KEY` in `.env`

3. **Security**
   - Implement user authentication (JWT tokens)
   - Encrypt access tokens in database
   - Use HTTPS everywhere
   - Add rate limiting to API

4. **Database**
   - Set up PostgreSQL for user data
   - Store encrypted Plaid tokens
   - Historical net worth tracking

5. **Hosting**
   - Backend: Railway, Render, or AWS
   - Frontend: Vercel or Netlify
   - Database: Railway PostgreSQL or AWS RDS

6. **Domain & SSL**
   - Register domain (e.g., collegewealthbuilder.com)
   - Configure SSL certificates

---

## Contributing

Built by Shane using Claude Code.

**Technologies:**
- Backend: FastAPI, Python, NumPy
- Frontend: Next.js 14, React, TypeScript, Tailwind CSS
- APIs: Plaid (financial data), Alpha Vantage (market data)
- Charts: Chart.js

---

## License

Private project. Not for redistribution.

---

## Contact & Support

For questions or issues, refer to the codebase documentation or backend logs.

**Have fun building wealth!** 🚀📈
